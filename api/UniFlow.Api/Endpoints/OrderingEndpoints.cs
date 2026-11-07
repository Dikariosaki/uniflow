using UniFlow.Application.Contracts;
using UniFlow.Application.Features;
using UniFlow.Api.Http;

namespace UniFlow.Api.Endpoints;

public static class OrderingEndpoints
{
    public static void MapOrderingEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1");
        group.MapPost("/orders/reservations", async (StockReservationRequest request, CancellationToken ct, OrderingUseCases useCases, HttpContext context) =>
            (await useCases.PostStockReservations(request, ct)).ToHttpResult(context)).RequireRateLimiting("public");
        group.MapPost("/orders", async (CreateOrderRequest request, CancellationToken ct, OrderingUseCases useCases, HttpContext context) =>
            (await useCases.PostOrders(request, context.Request.Headers["Idempotency-Key"].FirstOrDefault(), ct)).ToHttpResult(context)).RequireRateLimiting("public");
        group.MapPost("/orders/track", async (TrackRequest request, CancellationToken ct, OrderingUseCases useCases, HttpContext context) =>
            (await useCases.PostOrdersTrack(request, ct)).ToHttpResult(context)).RequireRateLimiting("public");
    }
}
