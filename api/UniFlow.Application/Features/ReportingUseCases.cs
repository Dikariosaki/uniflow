using System.Text;
using System.Globalization;
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
        var zone = TimeZoneInfo.FindSystemTimeZoneById("America/Bogota");
        var csv = new StringBuilder();
        AppendCsvRow(csv, "ID del pedido", "Código de recogida", "Estado", "Cliente", "Total (COP)", "Fecha de creación (Bogotá)", "Detalle de productos");
        foreach (var order in orders)
        {
            var createdAt = TimeZoneInfo.ConvertTime(order.CreatedAt, zone).ToString("dd/MM/yyyy HH:mm:ss", CultureInfo.InvariantCulture);
            var items = string.Join(" | ", order.Items.Select(item =>
                $"{item.NameSnapshot} × {item.Quantity} × {item.UnitPriceCop.ToString(CultureInfo.InvariantCulture)} COP = {item.SubtotalCop.ToString(CultureInfo.InvariantCulture)} COP"));
            AppendCsvRow(csv,
                order.Id.ToString(),
                order.PickupCode,
                order.Status,
                order.CustomerAlias,
                order.TotalCop.ToString(CultureInfo.InvariantCulture),
                createdAt,
                items);
        }

        var utf8 = new UTF8Encoding(encoderShouldEmitUTF8Identifier: true);
        var file = utf8.GetPreamble().Concat(utf8.GetBytes(csv.ToString())).ToArray();
        return UseCaseResult.File(file, "text/csv; charset=utf-8; header=present", $"uniflow-pedidos-{day:yyyy-MM-dd}.csv");
    }

    private static void AppendCsvRow(StringBuilder csv, params string[] values) =>
        csv.AppendJoin(';', values.Select(CsvCell)).Append("\r\n");
}
