using System.Text;
using System.Security.Cryptography;
using UniFlow.Application.Abstractions;
using UniFlow.Application.Common;
using UniFlow.Application.Contracts;
using UniFlow.Domain.Entities;
using UniFlow.Domain.Orders;
using static UniFlow.Application.Common.ApplicationRules;

namespace UniFlow.Application.Features;

public sealed class CatalogUseCases(IApplicationStore db, IProductImageStorage storage)
{
    public async Task<UseCaseResult> GetCatalogCategories(CancellationToken ct)
    { return UseCaseResult.Ok(await db.Categories.ReadOnly().Where(x => x.Active).OrderBy(x => x.DisplayOrder).Select(x => new { x.Id, x.Name, x.DisplayOrder }).ToListAsync(ct)); }

    public async Task<UseCaseResult> GetStatus(CancellationToken ct)
    {
        var settings = await db.BusinessSettings.ReadOnly().FirstOrDefaultAsync(x => x.Id == 1, ct);
        var now = DateTimeOffset.UtcNow;
        return UseCaseResult.Ok(new { name = settings?.Name ?? "Cafetería Bloque B", isOpen = !await db.BusinessSettings.ReadOnly().Where(x => x.Id == 1).Select(x => x.OrdersPaused).FirstOrDefaultAsync(ct) && await IsOpenAt(db, now, ct), ordersPaused = settings?.OrdersPaused ?? false, timeZone = "America/Bogota" });
    }

    public async Task<UseCaseResult> GetCatalogProducts(string? search, Guid? categoryId, int? page, int? pageSize, CancellationToken ct)
    {
        var query = db.Products.ReadOnly().Where(x => x.Active && x.Category!.Active);
        if (categoryId is not null) query = query.Where(x => x.CategoryId == categoryId);
        if (!string.IsNullOrWhiteSpace(search))
        {
            foreach (var term in search.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            {
                var normalizedTerm = term.ToLowerInvariant();
                query = query.Where(x => x.Name.ToLower().Contains(normalizedTerm) || x.Description.ToLower().Contains(normalizedTerm) || x.Category!.Name.ToLower().Contains(normalizedTerm));
            }
        }

        var totalCount = await query.CountAsync(ct);
        var currentPage = Math.Max(1, page ?? 1);
        var size = Math.Clamp(pageSize ?? 24, 1, 60);
        var products = await query.OrderBy(x => x.Name).ThenBy(x => x.Id)
            .Skip((currentPage - 1) * size).Take(size)
            .Select(x => new { x.Id, x.CategoryId, categoryName = x.Category!.Name, x.Name, x.Description, x.PriceCop, x.Available, x.StockQuantity, x.ImagePath })
            .ToListAsync(ct);
        return UseCaseResult.Ok(products.Select(x => new { x.Id, x.CategoryId, x.categoryName, x.Name, x.Description, x.PriceCop, available = x.Available && x.StockQuantity > 0, imageUrl = storage.PublicUrl(x.ImagePath) })).WithTotalCount(totalCount);
    }

    public async Task<UseCaseResult> GetPickupSlots(DateOnly date, CancellationToken ct)
    {
        var zone = TimeZoneInfo.FindSystemTimeZoneById("America/Bogota");
        var localStart = DateTime.SpecifyKind(date.ToDateTime(TimeOnly.MinValue), DateTimeKind.Unspecified);
        var from = new DateTimeOffset(TimeZoneInfo.ConvertTimeToUtc(localStart, zone));
        var to = from.AddDays(1);
        var minimumNotice = await db.BusinessSettings.ReadOnly().Where(x => x.Id == 1).Select(x => (int?)x.MinimumNoticeMinutes).FirstOrDefaultAsync(ct) ?? 0;
        var earliest = DateTimeOffset.UtcNow.AddMinutes(minimumNotice);
        var slots = await db.PickupSlots.ReadOnly().Where(s => s.Active && s.StartsAt > earliest && s.StartsAt >= from && s.StartsAt < to).OrderBy(s => s.StartsAt)
            .Select(s => new { s.Id, s.StartsAt, s.EndsAt, s.Capacity, reserved = db.Orders.Count(o => o.SlotId == s.Id && o.ConsumesCapacity) }).ToListAsync(ct);
        var openSlots = new List<object>();
        foreach (var s in slots)
            if (await IsSlotOpen(db, s.StartsAt, s.EndsAt, ct))
                openSlots.Add(new { s.Id, s.StartsAt, s.EndsAt, s.Capacity, available = Math.Max(0, s.Capacity - s.reserved) });
        return UseCaseResult.Ok(openSlots);
    }
}
