using UniFlow.Application.Contracts;
using UniFlow.Application.Features;
using UniFlow.Api.Http;

namespace UniFlow.Api.Endpoints;

public static class CatalogAdministrationEndpoints
{
    public static void MapCatalogAdministrationEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/admin").RequireAuthorization();
        group.MapGet("/categories", async (CancellationToken ct, CatalogAdministrationUseCases useCases, HttpContext context) =>
            (await useCases.GetCategories(ct)).ToHttpResult(context));
        group.MapPost("/categories", async (CategoryInput input, CancellationToken ct, CatalogAdministrationUseCases useCases, HttpContext context) =>
            (await useCases.PostCategories(input, ct)).ToHttpResult(context));
        group.MapPut("/categories/{id:guid}", async (Guid id, CategoryInput input, CancellationToken ct, CatalogAdministrationUseCases useCases, HttpContext context) =>
            (await useCases.PutCategoriesById(id, input, ct)).ToHttpResult(context));
        group.MapGet("/products", async (CancellationToken ct, CatalogAdministrationUseCases useCases, HttpContext context) =>
            (await useCases.GetProducts(ct)).ToHttpResult(context));
        group.MapPost("/products", async (ProductInput input, CancellationToken ct, CatalogAdministrationUseCases useCases, HttpContext context) =>
            (await useCases.PostProducts(input, ct)).ToHttpResult(context));
        group.MapPut("/products/{id:guid}", async (Guid id, ProductInput input, CancellationToken ct, CatalogAdministrationUseCases useCases, HttpContext context) =>
            (await useCases.PutProductsById(id, input, ct)).ToHttpResult(context));
        group.MapPost("/products/{id:guid}/image-upload", async (Guid id, ImageUploadRequest input, CancellationToken ct, CatalogAdministrationUseCases useCases, HttpContext context) =>
            (await useCases.PostProductsByIdImageUpload(id, input, ct)).ToHttpResult(context));
        group.MapPost("/products/{id:guid}/image", async (Guid id, ProductImageInput input, CancellationToken ct, CatalogAdministrationUseCases useCases, HttpContext context) =>
            (await useCases.PostProductsByIdImage(id, input, ct)).ToHttpResult(context));
    }
}
