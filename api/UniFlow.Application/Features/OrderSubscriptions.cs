using UniFlow.Application.Abstractions;
using static UniFlow.Application.Common.ApplicationRules;

namespace UniFlow.Application.Features;

public sealed class OrderSubscriptions(IApplicationStore db)
{
    public async Task<string?> ResolveGroupAsync(string? userId, string? token, CancellationToken ct)
    {
        if (userId is not null && await db.StaffRoles.AnyAsync(x => x.UserId == userId && x.Active, ct)) return "staff";
        if (string.IsNullOrWhiteSpace(token) || token.Length > 128) return null;
        var hash = HashToken(token);
        var id = await db.Orders.Where(x => x.TrackingTokenHash == hash).Select(x => (Guid?)x.Id).FirstOrDefaultAsync(ct);
        return id is null ? null : $"order-{id}";
    }
}
