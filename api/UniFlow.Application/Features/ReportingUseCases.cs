using System.Text;
using System.Security.Cryptography;
using UniFlow.Application.Abstractions;
using UniFlow.Application.Common;
using UniFlow.Application.Contracts;
using UniFlow.Domain.Entities;
using UniFlow.Domain.Orders;
using static UniFlow.Application.Common.ApplicationRules;

namespace UniFlow.Application.Features;

public sealed class ReportingUseCases(IApplicationStore db, ICurrentUser user)
{
    public async Task<UseCaseResult> GetAudit(CancellationToken ct)
    {
        if (!await HasStaffRole(user, db, ct, "administrator")) return UseCaseResult.Forbid();
        return UseCaseResult.Ok(await db.AdminAuditEvents.ReadOnly().OrderByDescending(e => e.CreatedAt).Take(150).ToListAsync(ct));
    }

    public async Task<UseCaseResult> GetReportsDaily(DateOnly? date, CancellationToken ct)
    {
        if (!await HasStaffRole(user, db, ct, "administrator")) return UseCaseResult.Forbid();
        var day = date ?? DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, TimeZoneInfo.FindSystemTimeZoneById("America/Bogota")).DateTime);
        var from = BogotaDayStart(day); var to = BogotaDayStart(day.AddDays(1));
        var orders = await db.Orders.Where(o => o.CreatedAt >= from && o.CreatedAt < to).ToListAsync(ct);
        return UseCaseResult.Ok(new { date = day, created = orders.Count, confirmed = orders.Count(o => o.Status != "RECHAZADO"), ready = orders.Count(o => o.ReadyAt != null), delivered = orders.Count(o => o.Status == "ENTREGADO"), cancelled = orders.Count(o => o.Status == "CANCELADO"), revenueCop = orders.Where(o => o.Status == "ENTREGADO").Sum(o => o.TotalCop) });
    }

    public async Task<UseCaseResult> GetReportsOrdersCsv(DateOnly? date, CancellationToken ct)
    {
        if (!await HasStaffRole(user, db, ct, "administrator")) return UseCaseResult.Forbid();
        var day = date ?? DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, TimeZoneInfo.FindSystemTimeZoneById("America/Bogota")).DateTime); var from = BogotaDayStart(day); var to = BogotaDayStart(day.AddDays(1));
        var orders = await db.Orders.ReadOnly().Where(o => o.CreatedAt >= from && o.CreatedAt < to).OrderBy(o => o.CreatedAt).ToListAsync(ct);
        var csv = new StringBuilder("id,codigo,estado,alias,total_cop,creado_utc,items\n");
        foreach (var o in orders) csv.AppendLine(string.Join(',', new[] { o.Id.ToString(), o.PickupCode, o.Status, o.CustomerAlias, o.TotalCop.ToString(), o.CreatedAt.ToString("O"), string.Join("; ", o.Items.Select(i => $"{i.NameSnapshot} x{i.Quantity}")) }.Select(CsvCell)));
        return UseCaseResult.File(Encoding.UTF8.GetBytes(csv.ToString()), "text/csv; charset=utf-8", $"uniflow-orders-{day:yyyy-MM-dd}.csv");
    }
}
