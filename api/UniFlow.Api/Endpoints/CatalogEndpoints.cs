using UniFlow.Application.Contracts;
using UniFlow.Application.Features;
using UniFlow.Api.Http;

namespace UniFlow.Api.Endpoints;

public static class CatalogEndpoints
{
    public static void MapCatalogEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1");
        group.MapGet("/catalog/categories", async (CancellationToken ct, CatalogUseCases useCases, HttpContext context) =>
            (await useCases.GetCatalogCategories(ct)).ToHttpResult(context));
        group.MapGet("/status", async (CancellationToken ct, CatalogUseCases useCases, HttpContext context) =>
            (await useCases.GetStatus(ct)).ToHttpResult(context));
        group.MapGet("/catalog/products", async (CancellationToken ct, CatalogUseCases useCases, HttpContext context) =>
            (await useCases.GetCatalogProducts(ct)).ToHttpResult(context));
        group.MapGet("/pickup-slots", async (DateOnly date, CancellationToken ct, CatalogUseCases useCases, HttpContext context) =>
            (await useCases.GetPickupSlots(date, ct)).ToHttpResult(context));
    }
}
