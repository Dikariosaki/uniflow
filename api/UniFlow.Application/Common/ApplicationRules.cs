using System.Security.Cryptography;
using System.Text;
using UniFlow.Application.Abstractions;
using UniFlow.Domain.Entities;

namespace UniFlow.Application.Common;

public static class ApplicationRules
{
    public static async Task<UseCaseResult> CheckHealth(IApplicationStore db, CancellationToken ct)
    {
        try { if (await db.CanConnectAsync(ct)) return UseCaseResult.Ok(new { status = "ok", service = "uniflow-api", database = "connected" }); }
        catch (Exception) when (!ct.IsCancellationRequested) { }
        return UseCaseResult.Unavailable(new { status = "unavailable", service = "uniflow-api" });
    }

    public static async Task<bool> HasStaffRole(ICurrentUser user, IApplicationStore db, CancellationToken ct, params string[] roles)
    {
        var id = user.UserId;
        return id is not null && await db.StaffRoles.AnyAsync(r => r.UserId == id && r.Active && roles.Contains(r.Role), ct);
    }

    public static string CreateTrackingToken() => Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    public static string CsvCell(string value)
    {
        if (value.Length > 0 && "=+-@\t\r\n".Contains(value[0])) value = "'" + value;
        return "\"" + value.Replace("\"", "\"\"") + "\"";
    }

    public static string HashToken(string token) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));

    public static void AddAdminAudit(IApplicationStore db, ICurrentUser user, string action, string entityType, string? entityId, string? details) =>
        db.AdminAuditEvents.Add(new AdminAuditEvent { ActorId = user.UserId ?? "unknown", Action = action, EntityType = entityType, EntityId = entityId, Details = details });

    public static DateTimeOffset BogotaDayStart(DateOnly day)
    {
        var zone = TimeZoneInfo.FindSystemTimeZoneById("America/Bogota");
        return new DateTimeOffset(TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(day.ToDateTime(TimeOnly.MinValue), DateTimeKind.Unspecified), zone));
    }

    public static async Task<bool> IsOpenAt(IApplicationStore db, DateTimeOffset instant, CancellationToken ct)
    {
        var zone = TimeZoneInfo.FindSystemTimeZoneById("America/Bogota");
        var local = TimeZoneInfo.ConvertTime(instant, zone);
        var date = DateOnly.FromDateTime(local.DateTime);
        var exception = await db.OpeningHours.FirstOrDefaultAsync(h => h.Date == date, ct);
        if (exception is not null) return !exception.Closed && TimeOnly.FromDateTime(local.DateTime) >= exception.OpensAt && TimeOnly.FromDateTime(local.DateTime) < exception.ClosesAt;
        var weekday = (int)local.DayOfWeek;
        var hours = await db.OpeningHours.FirstOrDefaultAsync(h => h.Weekday == weekday && h.Date == null, ct);
        return hours is not null && !hours.Closed && TimeOnly.FromDateTime(local.DateTime) >= hours.OpensAt && TimeOnly.FromDateTime(local.DateTime) < hours.ClosesAt;
    }

    public static async Task<bool> IsSlotOpen(IApplicationStore db, DateTimeOffset start, DateTimeOffset end, CancellationToken ct)
    {
        if (end <= start) return false;
        var zone = TimeZoneInfo.FindSystemTimeZoneById("America/Bogota");
        if (TimeZoneInfo.ConvertTime(start, zone).Date != TimeZoneInfo.ConvertTime(end.AddTicks(-1), zone).Date) return false;
        return await IsOpenAt(db, start, ct) && await IsOpenAt(db, end.AddTicks(-1), ct);
    }
}
