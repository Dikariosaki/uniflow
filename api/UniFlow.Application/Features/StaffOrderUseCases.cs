using System.Text;
using System.Security.Cryptography;
using UniFlow.Application.Abstractions;
using UniFlow.Application.Common;
using UniFlow.Application.Contracts;
using UniFlow.Domain.Entities;
using UniFlow.Domain.Orders;
using static UniFlow.Application.Common.ApplicationRules;

namespace UniFlow.Application.Features;

public sealed class StaffOrderUseCases(IApplicationStore db, ICurrentUser user, IOrderNotifier notifier, IStaffIdentityAdmin identities)
{
    public async Task<UseCaseResult> GetOrders(string? status, DateOnly? date, Guid? slotId, int? page, int? pageSize, bool? activeOnly, CancellationToken ct)
    {
        if (!await HasStaffRole(user, db, ct, "operator", "administrator")) return UseCaseResult.Forbid();
        var query = db.Orders.ReadOnly().AsQueryable();
        if (!string.IsNullOrWhiteSpace(status)) query = query.Where(o => o.Status == status);
        if (activeOnly == true) query = query.Where(o => o.Status == "CONFIRMADO" || o.Status == "EN_PREPARACION" || o.Status == "LISTO");
        if (slotId is not null) query = query.Where(o => o.SlotId == slotId);
        if (date is not null) { var from = BogotaDayStart(date.Value); var to = BogotaDayStart(date.Value.AddDays(1)); query = query.Where(o => o.CreatedAt >= from && o.CreatedAt < to); }
        var currentPage = Math.Max(1, page ?? 1); var size = Math.Clamp(pageSize ?? 50, 1, 150);
        var totalCount = await query.CountAsync(ct);
        var orders = await query.OrderByDescending(o => o.CreatedAt).ThenBy(o => o.Id).Skip((currentPage - 1) * size).Take(size).ToListAsync(ct);
        return UseCaseResult.Ok(orders.Select(o => new { o.Id, o.CustomerAlias, o.CustomerPhone, o.Status, o.PickupMode, o.TotalCop, o.CreatedAt, slot = o.Slot!.StartsAt, items = o.Items.Select(i => new { i.NameSnapshot, i.Quantity }) })).WithTotalCount(totalCount);
    }

    public async Task<UseCaseResult> GetOrdersById(Guid id, CancellationToken ct)
    {
        if (!await HasStaffRole(user, db, ct, "operator", "administrator")) return UseCaseResult.Forbid();
        var order = await db.Orders.ReadOnly().FirstOrDefaultAsync(o => o.Id == id, ct);
        if (order is null) return UseCaseResult.NotFound();

        var events = order.Events.OrderBy(e => e.CreatedAt).ToList();
        var staffIds = events
            .Select(e => e.ActorId)
            .OfType<string>()
            .Where(id => Guid.TryParse(id, out _))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
        var emails = await identities.GetEmailsByUserIdsAsync(staffIds, ct);

        return UseCaseResult.Ok(new
        {
            order.Id,
            order.CustomerAlias,
            order.CustomerPhone,
            order.Status,
            order.PickupMode,
            order.TotalCop,
            order.PaymentStatus,
            order.CreatedAt,
            order.ConfirmedAt,
            order.ReadyAt,
            order.DeliveredAt,
            slot = order.Slot!.StartsAt,
            items = order.Items.Select(i => new { i.NameSnapshot, i.Quantity, i.UnitPriceCop, i.SubtotalCop }),
            events = events.Select(e => new
            {
                e.PreviousStatus,
                e.NewStatus,
                actorLabel = e.ActorId == "customer"
                    ? "Cliente"
                    : e.ActorId is null
                        ? "Sistema"
                        : Guid.TryParse(e.ActorId, out _)
                            ? emails.GetValueOrDefault(e.ActorId) ?? "Personal"
                            : "Sistema",
                e.Reason,
                e.CreatedAt,
            }),
        });
    }

    public async Task<UseCaseResult> PatchOrdersByIdStatus(Guid id, ChangeStatusRequest request, CancellationToken ct)
    {
        if (!await HasStaffRole(user, db, ct, "operator", "administrator")) return UseCaseResult.Forbid();
        await using var tx = await db.BeginTransactionAsync(ct);
        await db.LockOrderAsync(id, ct);
        var order = await db.Orders.FirstOrDefaultAsync(o => o.Id == id, ct);
        if (order is null) return UseCaseResult.NotFound();

        if (!OrderLifecycle.CanTransition(order.Status, request.Status)) return UseCaseResult.Failure("No puedes cambiar el pedido a ese estado.", kind: OutcomeKind.Conflict);
        if (request.Status is "CANCELADO" or "RECHAZADO" && (string.IsNullOrWhiteSpace(request.Reason) || request.Reason.Length > 500)) return UseCaseResult.Failure("Indica el motivo de cancelación o rechazo (hasta 500 caracteres).", kind: OutcomeKind.ValidationFailed);
        var old = order.Status;
        if (request.Status is "CANCELADO" or "RECHAZADO")
        {
            var productIds = order.Items.Select(item => item.ProductId).Distinct().Order().ToList();
            foreach (var productId in productIds) await db.LockProductAsync(productId, ct);
            var products = await db.Products.Where(product => productIds.Contains(product.Id)).ToDictionaryAsync(product => product.Id, ct);
            foreach (var item in order.Items)
                if (products.TryGetValue(item.ProductId, out var product))
                {
                    product.StockQuantity = checked(product.StockQuantity + item.Quantity);
                    product.UpdatedAt = DateTimeOffset.UtcNow;
                }
        }
        order.Status = request.Status;
        if (OrderLifecycle.ReleasesCapacity(old, request.Status)) order.ConsumesCapacity = false;
        if (request.Status == "LISTO") order.ReadyAt = DateTimeOffset.UtcNow;
        db.OrderEvents.Add(new OrderEvent { OrderId = order.Id, PreviousStatus = old, NewStatus = request.Status, Reason = request.Reason, ActorId = user.UserId });
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        await notifier.OrderChangedAsync(order.Id, order.Status, true, ct);
        return UseCaseResult.Ok(new { order.Id, order.Status });
    }

    public async Task<UseCaseResult> PostOrdersByIdDeliver(Guid id, DeliverRequest request, CancellationToken ct)
    {
        if (!await HasStaffRole(user, db, ct, "operator", "administrator")) return UseCaseResult.Forbid();
        if (string.IsNullOrWhiteSpace(request.Code) || request.Code.Length > 12) return UseCaseResult.Failure("Indica un código de recogida válido.", kind: OutcomeKind.ValidationFailed);
        await using var tx = await db.BeginTransactionAsync(ct);
        await db.LockOrderAsync(id, ct);
        var order = await db.Orders.FirstOrDefaultAsync(o => o.Id == id && o.Status == "LISTO", ct);
        if (order is null || !CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(order.PickupCode), Encoding.UTF8.GetBytes(request.Code))) return UseCaseResult.Failure("Pedido o código de recogida no válido.", kind: OutcomeKind.ValidationFailed);
        order.Status = "ENTREGADO"; order.DeliveredAt = DateTimeOffset.UtcNow;
        db.OrderEvents.Add(new OrderEvent { OrderId = order.Id, PreviousStatus = "LISTO", NewStatus = "ENTREGADO", ActorId = user.UserId });
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        await notifier.OrderChangedAsync(order.Id, order.Status, true, ct);
        return UseCaseResult.Ok(new { order.Id, order.Status, order.DeliveredAt });
    }
}
