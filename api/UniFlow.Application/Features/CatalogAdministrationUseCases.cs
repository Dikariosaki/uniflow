using System.Text;
using System.Security.Cryptography;
using UniFlow.Application.Abstractions;
using UniFlow.Application.Common;
using UniFlow.Application.Contracts;
using UniFlow.Domain.Entities;
using UniFlow.Domain.Orders;
using static UniFlow.Application.Common.ApplicationRules;

namespace UniFlow.Application.Features;

public sealed class CatalogAdministrationUseCases(IApplicationStore db, ICurrentUser user, IProductImageStorage storage)
{
    public async Task<UseCaseResult> GetCategories(CancellationToken ct)
    { return !await HasStaffRole(user, db, ct, "administrator") ? UseCaseResult.Forbid() : UseCaseResult.Ok(await db.Categories.OrderBy(c => c.DisplayOrder).ToListAsync(ct)); }

    public async Task<UseCaseResult> PostCategories(CategoryInput input, CancellationToken ct)
    {
        if (!await HasStaffRole(user, db, ct, "administrator")) return UseCaseResult.Forbid();
        if (string.IsNullOrWhiteSpace(input.Name) || input.Name.Trim().Length > 100) return UseCaseResult.Failure("El nombre de categoría debe tener hasta 100 caracteres.", kind: OutcomeKind.ValidationFailed);
        var category = new Category { Name = input.Name.Trim(), DisplayOrder = input.DisplayOrder, Active = input.Active };
        db.Categories.Add(category); AddAdminAudit(db, user, "category.created", "category", category.Id.ToString(), category.Name); await db.SaveChangesAsync(ct); return UseCaseResult.Created(category, category.Id);
    }

    public async Task<UseCaseResult> PutCategoriesById(Guid id, CategoryInput input, CancellationToken ct)
    {
        if (!await HasStaffRole(user, db, ct, "administrator")) return UseCaseResult.Forbid();
        var category = await db.Categories.FindAsync([id], ct); if (category is null) return UseCaseResult.NotFound();
        if (string.IsNullOrWhiteSpace(input.Name) || input.Name.Trim().Length > 100) return UseCaseResult.Failure("El nombre de categoría debe tener hasta 100 caracteres.", kind: OutcomeKind.ValidationFailed);
        category.Name = input.Name.Trim(); category.DisplayOrder = input.DisplayOrder; category.Active = input.Active;
        if (!input.Active) foreach (var product in await db.Products.Where(p => p.CategoryId == id).ToListAsync(ct)) product.Active = false;
        AddAdminAudit(db, user, "category.updated", "category", id.ToString(), $"active={category.Active}; order={category.DisplayOrder}"); await db.SaveChangesAsync(ct); return UseCaseResult.Ok(category);
    }

    public async Task<UseCaseResult> GetProducts(CancellationToken ct)
    {
        if (!await HasStaffRole(user, db, ct, "administrator")) return UseCaseResult.Forbid();
        var products = await db.Products.ReadOnly().OrderBy(p => p.Name).ToListAsync(ct);
        var now = DateTimeOffset.UtcNow;
        var reservations = await db.StockReservations.ReadOnly().Where(row => row.ExpiresAt > now).ToListAsync(ct);
        var reservedByProduct = reservations.GroupBy(row => row.ProductId).ToDictionary(group => group.Key, group => group.Sum(row => row.Quantity));
        return UseCaseResult.Ok(products.Select(p => new { p.Id, p.CategoryId, categoryName = p.Category!.Name, p.Name, p.Description, p.PriceCop, p.StockQuantity, reservedQuantity = reservedByProduct.GetValueOrDefault(p.Id), availableQuantity = Math.Max(0, p.StockQuantity - reservedByProduct.GetValueOrDefault(p.Id)), p.Available, p.Active, imageUrl = storage.PublicUrl(p.ImagePath) }));
    }

    public async Task<UseCaseResult> PostProducts(ProductInput input, CancellationToken ct)
    {
        if (!await HasStaffRole(user, db, ct, "administrator")) return UseCaseResult.Forbid();
        if (string.IsNullOrWhiteSpace(input.Name) || input.Name.Trim().Length > 160 || (input.Description?.Length ?? 0) > 1000 || input.PriceCop < 0 || input.PriceCop > 2_000_000 || !await db.Categories.AnyAsync(c => c.Id == input.CategoryId && c.Active, ct)) return UseCaseResult.Failure("Revisa la categoría, el nombre, la descripción y el precio del producto.", kind: OutcomeKind.ValidationFailed);
        if (input.StockQuantity is < 0 or > 1_000_000) return UseCaseResult.Failure("La cantidad en inventario debe estar entre 0 y 1.000.000.", kind: OutcomeKind.ValidationFailed);
        var product = new Product { CategoryId = input.CategoryId, Name = input.Name.Trim(), Description = input.Description?.Trim() ?? "", PriceCop = input.PriceCop, StockQuantity = input.StockQuantity, Available = input.Available, Active = input.Active };
        db.Products.Add(product); AddAdminAudit(db, user, "product.created", "product", product.Id.ToString(), $"category={product.CategoryId}; price_cop={product.PriceCop}"); await db.SaveChangesAsync(ct); return UseCaseResult.Created(product, product.Id);
    }

    public async Task<UseCaseResult> PutProductsById(Guid id, ProductInput input, CancellationToken ct)
    {
        if (!await HasStaffRole(user, db, ct, "administrator")) return UseCaseResult.Forbid();
        await using var tx = await db.BeginTransactionAsync(ct);
        await db.LockProductAsync(id, ct);
        var product = await db.Products.FindAsync([id], ct); if (product is null) return UseCaseResult.NotFound();
        if (string.IsNullOrWhiteSpace(input.Name) || input.Name.Trim().Length > 160 || (input.Description?.Length ?? 0) > 1000 || input.PriceCop < 0 || input.PriceCop > 2_000_000 || !await db.Categories.AnyAsync(c => c.Id == input.CategoryId && c.Active, ct)) return UseCaseResult.Failure("Revisa la categoría, el nombre, la descripción y el precio del producto.", kind: OutcomeKind.ValidationFailed);
        if (input.StockQuantity is < 0 or > 1_000_000) return UseCaseResult.Failure("La cantidad en inventario debe estar entre 0 y 1.000.000.", kind: OutcomeKind.ValidationFailed);
        var reservedQuantity = (await db.StockReservations.Where(row => row.ProductId == id && row.ExpiresAt > DateTimeOffset.UtcNow).ToListAsync(ct)).Sum(row => row.Quantity);
        if (input.StockQuantity < reservedQuantity) return UseCaseResult.Conflict(new { title = "Unidades reservadas", detail = $"No puedes dejar el inventario por debajo de las {reservedQuantity} unidades que están reservadas en carritos." });
        product.CategoryId = input.CategoryId; product.Name = input.Name.Trim(); product.Description = input.Description?.Trim() ?? ""; product.PriceCop = input.PriceCop; product.StockQuantity = input.StockQuantity; product.Available = input.Available; product.Active = input.Active; product.UpdatedAt = DateTimeOffset.UtcNow;
        AddAdminAudit(db, user, "product.updated", "product", id.ToString(), $"category={product.CategoryId}; price_cop={product.PriceCop}; stock={product.StockQuantity}; active={product.Active}; available={product.Available}"); await db.SaveChangesAsync(ct); await tx.CommitAsync(ct); return UseCaseResult.Ok(product);
    }

    public async Task<UseCaseResult> PostProductsByIdImageUpload(Guid id, ImageUploadRequest input, CancellationToken ct)
    {
        if (!await HasStaffRole(user, db, ct, "administrator")) return UseCaseResult.Forbid();
        var product = await db.Products.FindAsync([id], ct); if (product is null) return UseCaseResult.NotFound();
        if (input.ContentType is not ("image/jpeg" or "image/png" or "image/webp") || input.SizeBytes is <= 0 or > 5_000_000) return UseCaseResult.Failure("Usa una imagen JPG, PNG o WebP de hasta 5 MB.", kind: OutcomeKind.ValidationFailed);
        var extension = input.ContentType == "image/png" ? "png" : input.ContentType == "image/webp" ? "webp" : "jpg";
        var path = $"{id}/{Guid.NewGuid():N}.{extension}";
        try { var upload = await storage.CreateUploadAsync(path, input.ContentType, ct); AddAdminAudit(db, user, "product.image_upload_issued", "product", id.ToString(), $"object={path}; type={input.ContentType}; bytes={input.SizeBytes}"); await db.SaveChangesAsync(ct); return UseCaseResult.Ok(upload); }
        catch (InvalidOperationException) { return UseCaseResult.Failure("No pudimos preparar la carga de la imagen. Inténtalo de nuevo más tarde.", kind: OutcomeKind.Unavailable); }
    }

    public async Task<UseCaseResult> PostProductsByIdImage(Guid id, ProductImageInput input, CancellationToken ct)
    {
        if (!await HasStaffRole(user, db, ct, "administrator")) return UseCaseResult.Forbid();
        var product = await db.Products.FindAsync([id], ct); if (product is null) return UseCaseResult.NotFound();
        if (input.Path is null || !System.Text.RegularExpressions.Regex.IsMatch(input.Path, $"\\A{id}/[a-f0-9]{{32}}\\.(png|jpg|webp)\\z") || !await storage.ImageExistsAsync(input.Path, ct))
            return UseCaseResult.Failure("Carga una imagen válida de este producto antes de guardarla.", kind: OutcomeKind.ValidationFailed);
        product.ImagePath = input.Path; product.UpdatedAt = DateTimeOffset.UtcNow;
        AddAdminAudit(db, user, "product.image_updated", "product", id.ToString(), $"object={input.Path}");
        await db.SaveChangesAsync(ct); return UseCaseResult.Ok(new { imageUrl = storage.PublicUrl(product.ImagePath) });
    }
}
