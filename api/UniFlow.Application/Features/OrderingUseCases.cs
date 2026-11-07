using System.Text;
using System.Security.Cryptography;
using UniFlow.Application.Abstractions;
using UniFlow.Application.Common;
using UniFlow.Application.Contracts;
using UniFlow.Domain.Entities;
using UniFlow.Domain.Orders;
using static UniFlow.Application.Common.ApplicationRules;

namespace UniFlow.Application.Features;

public sealed class OrderingUseCases(IApplicationStore db, IOrderNotifier notifier)
{
    public async Task<UseCaseResult> PostStockReservations(StockReservationRequest request, CancellationToken ct)
    {
        if (!Guid.TryParse(request.CartToken, out _) || request.CartToken.Length > 64 || request.Items is null || request.Items.Count > 50 || request.Items.Any(item => item is null || item.Quantity is < 1 or > 20) || request.Items.Select(item => item.ProductId).Distinct().Count() != request.Items.Count)
            return UseCaseResult.Failure("No pudimos reservar estos productos. Actualiza el carrito e inténtalo de nuevo.", kind: OutcomeKind.ValidationFailed);
        var cartToken = Guid.Parse(request.CartToken).ToString("D");

        await using var tx = await db.BeginTransactionAsync(ct);
        await db.LockCartReservationKeyAsync(cartToken, ct);
        await db.LockCartReservationsAsync(cartToken, ct);
        var existing = await db.StockReservations.Where(row => row.CartToken == cartToken).ToListAsync(ct);
        var now = DateTimeOffset.UtcNow;
        var active = existing.Where(row => row.ExpiresAt > now).ToList();
        var desiredIds = request.Items.Select(item => item.ProductId).ToHashSet();
        var lockIds = existing.Select(row => row.ProductId).Concat(desiredIds).Distinct().Order().ToList();
        foreach (var productId in lockIds) await db.LockProductAsync(productId, ct);

        if (request.Items.Count == 0)
        {
            db.StockReservations.RemoveRange(existing);
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            return UseCaseResult.Ok(new { expiresAt = (DateTimeOffset?)null, items = Array.Empty<object>() });
        }

        var ids = desiredIds.ToList();
        var products = await db.Products.Where(product => ids.Contains(product.Id) && product.Active && product.Available && product.Category!.Active).ToDictionaryAsync(product => product.Id, ct);
        if (products.Count != ids.Count) return UseCaseResult.Conflict(new { title = "Producto no disponible", detail = "Uno de los productos ya no está disponible. Actualiza el menú e inténtalo de nuevo." });

        var otherReservations = await db.StockReservations
            .Where(row => ids.Contains(row.ProductId) && row.CartToken != cartToken && row.ExpiresAt > now)
            .ToListAsync(ct);
        var reservedByOthers = otherReservations.GroupBy(row => row.ProductId).ToDictionary(group => group.Key, group => group.Sum(row => row.Quantity));
        var insufficient = request.Items.FirstOrDefault(item => products[item.ProductId].StockQuantity - reservedByOthers.GetValueOrDefault(item.ProductId) < item.Quantity);
        if (insufficient is not null)
        {
            var remaining = Math.Max(0, products[insufficient.ProductId].StockQuantity - reservedByOthers.GetValueOrDefault(insufficient.ProductId));
            return UseCaseResult.Conflict(new { title = "Inventario reservado", detail = $"Solo quedan {remaining} unidades disponibles de {products[insufficient.ProductId].Name}. Ajusta el carrito e inténtalo de nuevo.", productId = insufficient.ProductId, availableQuantity = remaining });
        }

        var expiresAt = active.Count == 0 ? now.AddMinutes(5) : active.Min(row => row.ExpiresAt);
        db.StockReservations.RemoveRange(existing.Where(row => !desiredIds.Contains(row.ProductId)));
        foreach (var item in request.Items)
        {
            var reservation = existing.FirstOrDefault(row => row.ProductId == item.ProductId);
            if (reservation is null)
                db.StockReservations.Add(new StockReservation { CartToken = cartToken, ProductId = item.ProductId, Quantity = item.Quantity, ExpiresAt = expiresAt });
            else
            {
                reservation.Quantity = item.Quantity;
                reservation.ExpiresAt = expiresAt;
            }
        }
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return UseCaseResult.Ok(new { expiresAt, items = request.Items.Select(item => new { item.ProductId, item.Quantity }) });
    }

    public async Task<UseCaseResult> PostOrders(CreateOrderRequest request, string? key, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(key) || key.Length > 128 || !Guid.TryParse(request.CartToken, out _)) return UseCaseResult.Failure("No pudimos confirmar el pedido. Actualiza el carrito e inténtalo de nuevo.", kind: OutcomeKind.InvalidRequest);
        var cartToken = Guid.Parse(request.CartToken).ToString("D");
        if (request.PickupMode is not ("ready" or "scheduled") || string.IsNullOrWhiteSpace(request.Alias) || request.Alias.Length > 80 || string.IsNullOrWhiteSpace(request.Phone) || request.Phone.Length > 32 || request.Items is null || request.Items.Count is < 1 or > 50 || request.Items.Any(i => i is null || i.Quantity is < 1 or > 20) || request.Items.Select(i => i.ProductId).Distinct().Count() != request.Items.Count)
            return UseCaseResult.Failure("Revisa el alias, teléfono y cantidades del pedido.", kind: OutcomeKind.ValidationFailed);
        if (request.PickupMode == "scheduled" && request.SlotId is null) return UseCaseResult.Failure("Selecciona una franja de recogida.", kind: OutcomeKind.ValidationFailed);
        await using var tx = await db.BeginTransactionAsync(ct);
        // Serialize retries before checking capacity, including simultaneous submissions with one key.
        await db.LockIdempotencyKeyAsync(key, ct);
        var previous = await db.Orders.FirstOrDefaultAsync(o => o.IdempotencyKey == key, ct);
        if (previous is not null)
        {
            if (previous.CustomerAlias != request.Alias.Trim() || previous.CustomerPhone != request.Phone.Trim() || previous.PickupMode != request.PickupMode || (request.PickupMode == "scheduled" && previous.SlotId != request.SlotId) || previous.Items.Count != request.Items.Count || request.Items.Any(i => !previous.Items.Any(p => p.ProductId == i.ProductId && p.Quantity == i.Quantity)))
                return UseCaseResult.Failure("No pudimos confirmar este pedido. Revisa tus datos e inténtalo de nuevo.", kind: OutcomeKind.Conflict);
            var retryToken = CreateTrackingToken(); previous.TrackingTokenHash = HashToken(retryToken); await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            return UseCaseResult.Ok(new { orderId = previous.Id, code = previous.PickupCode, status = previous.Status, totalCop = previous.TotalCop, token = retryToken, slot = previous.Slot?.StartsAt });
        }

        await db.LockCartReservationKeyAsync(cartToken, ct);
        await db.LockCartReservationsAsync(cartToken, ct);

        try
        {
            var settings = await db.BusinessSettings.FindAsync([1], ct);
            if (settings?.OrdersPaused == true) return UseCaseResult.Failure("La cafetería pausó temporalmente los pedidos.", kind: OutcomeKind.ValidationFailed);
            var now = DateTimeOffset.UtcNow;
            if (!await IsOpenAt(db, now, ct)) return UseCaseResult.Failure("La cafetería está cerrada en este momento.", kind: OutcomeKind.ValidationFailed);
            var candidates = request.PickupMode == "scheduled" && request.SlotId is not null
                ? await db.PickupSlots.Where(s => s.Id == request.SlotId && s.Active && s.StartsAt > now).OrderBy(s => s.StartsAt).ToListAsync(ct)
                : await db.PickupSlots.Where(s => s.Active && s.StartsAt > now).OrderBy(s => s.StartsAt).ToListAsync(ct);
            PickupSlot? slot = null;
            foreach (var candidate in candidates)
            {
                await db.LockSlotAsync(candidate.Id, ct);
                await db.ReloadAsync(candidate, ct);
                if (!candidate.Active || candidate.EndsAt <= candidate.StartsAt || candidate.StartsAt < now.AddMinutes(settings?.MinimumNoticeMinutes ?? 0) || !await IsSlotOpen(db, candidate.StartsAt, candidate.EndsAt, ct)) continue;
                var reserved = await db.Orders.CountAsync(o => o.SlotId == candidate.Id && o.ConsumesCapacity, ct);
                if (reserved < candidate.Capacity) { slot = candidate; break; }
            }
            if (slot is null) return UseCaseResult.Failure("No hay cupos disponibles en el horario seleccionado.", kind: OutcomeKind.Conflict);
            var ids = request.Items.Select(i => i.ProductId).Distinct().ToList();
            foreach (var productId in ids.Order()) await db.LockProductAsync(productId, ct);
            var reservations = await db.StockReservations.Where(row => row.CartToken == cartToken && row.ExpiresAt > DateTimeOffset.UtcNow).ToListAsync(ct);
            if (reservations.Count != request.Items.Count || request.Items.Any(item => !reservations.Any(row => row.ProductId == item.ProductId && row.Quantity == item.Quantity)))
                return UseCaseResult.Conflict(new { title = "La reserva venció", detail = "Se venció la reserva de tu carrito. Vuelve al menú y reserva los productos nuevamente." });
            var products = await db.Products.Where(p => ids.Contains(p.Id) && p.Active && p.Available && p.Category!.Active).ToDictionaryAsync(p => p.Id, ct);
            if (products.Count != ids.Count) return UseCaseResult.Failure("Uno o más productos ya no están disponibles.", kind: OutcomeKind.Conflict);
            var insufficient = request.Items.FirstOrDefault(i => products.TryGetValue(i.ProductId, out var product) && product.StockQuantity < i.Quantity);
            if (insufficient is not null) return UseCaseResult.Conflict(new { title = "Inventario insuficiente", detail = $"Solo quedan {products[insufficient.ProductId].StockQuantity} unidades de {products[insufficient.ProductId].Name}. Ajusta la cantidad e inténtalo de nuevo.", productId = insufficient.ProductId, availableQuantity = products[insufficient.ProductId].StockQuantity });
            var priceChanges = request.Items.Where(i => i.ExpectedPriceCop is not null && products[i.ProductId].PriceCop != i.ExpectedPriceCop).Select(i => new { productId = i.ProductId, currentPriceCop = products[i.ProductId].PriceCop }).ToList();
            if (priceChanges.Count > 0) return UseCaseResult.Conflict(new { title = "Los precios cambiaron", detail = "Revisa el total actualizado y vuelve a confirmar el pedido.", priceChanged = true, currentPrices = priceChanges });
            var items = request.Items.Select(i =>
            {
                var product = products[i.ProductId];
                return new OrderItem { ProductId = product.Id, NameSnapshot = product.Name, Quantity = i.Quantity, UnitPriceCop = product.PriceCop, SubtotalCop = checked(product.PriceCop * i.Quantity) };
            }).ToList();
            foreach (var line in request.Items)
            {
                var product = products[line.ProductId];
                product.StockQuantity -= line.Quantity;
                product.UpdatedAt = DateTimeOffset.UtcNow;
            }
            db.StockReservations.RemoveRange(await db.StockReservations.Where(row => row.CartToken == cartToken).ToListAsync(ct));
            var token = CreateTrackingToken();
            var order = new Order
            {
                PickupCode = RandomNumberGenerator.GetInt32(100000, 999999).ToString(),
                TrackingTokenHash = HashToken(token),
                IdempotencyKey = key,
                CustomerAlias = request.Alias.Trim(),
                CustomerPhone = request.Phone.Trim(),
                PickupMode = request.PickupMode,
                SlotId = slot.Id,
                TotalCop = items.Sum(i => i.SubtotalCop),
                Items = items,
                Events = [new OrderEvent { NewStatus = "CONFIRMADO", ActorId = "customer" }]
            };
            db.Orders.Add(order);
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            await notifier.OrderChangedAsync(order.Id, order.Status, false, ct);
            return UseCaseResult.Created(new { orderId = order.Id, code = order.PickupCode, status = order.Status, totalCop = order.TotalCop, token, slot = slot.StartsAt }, order.Id);
        }
        catch (PersistenceConflictException)
        {
            await tx.RollbackAsync(ct);
            return UseCaseResult.Failure("El horario cambió mientras confirmábamos. Elige otra hora e inténtalo de nuevo.", kind: OutcomeKind.Conflict);
        }
    }

    public async Task<UseCaseResult> PostOrdersTrack(TrackRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Token) || request.Token.Length > 128) return UseCaseResult.NotFound();
        var hash = HashToken(request.Token);
        var order = await db.Orders.ReadOnly().FirstOrDefaultAsync(x => x.TrackingTokenHash == hash, ct);
        return order is null ? UseCaseResult.NotFound() : UseCaseResult.Ok(new { order.Id, order.PickupCode, order.Status, order.TotalCop, order.PickupMode, order.CreatedAt, order.ReadyAt, order.DeliveredAt, slot = order.Slot!.StartsAt, items = order.Items.Select(i => new { i.NameSnapshot, i.Quantity, i.UnitPriceCop, i.SubtotalCop }) });
    }
}
