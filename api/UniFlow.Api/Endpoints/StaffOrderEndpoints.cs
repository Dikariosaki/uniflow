using UniFlow.Application.Contracts;
using UniFlow.Application.Features;
using UniFlow.Api.Http;

namespace UniFlow.Api.Endpoints;

public static class StaffOrderEndpoints
{
    public static void MapStaffOrderEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/staff").RequireAuthorization();
        group.MapGet("/orders", async (string? status, DateOnly? date, Guid? slotId, int? page, int? pageSize, bool? activeOnly, CancellationToken ct, StaffOrderUseCases useCases, HttpContext context) =>
            (await useCases.GetOrders(status, date, slotId, page, pageSize, activeOnly, ct)).ToHttpResult(context));
        group.MapGet("/orders/{id:guid}", async (Guid id, CancellationToken ct, StaffOrderUseCases useCases, HttpContext context) =>
            (await useCases.GetOrdersById(id, ct)).ToHttpResult(context));
        group.MapPatch("/orders/{id:guid}/status", async (Guid id, ChangeStatusRequest request, CancellationToken ct, StaffOrderUseCases useCases, HttpContext context) =>
            (await useCases.PatchOrdersByIdStatus(id, request, ct)).ToHttpResult(context));
        group.MapPost("/orders/{id:guid}/deliver", async (Guid id, DeliverRequest request, CancellationToken ct, StaffOrderUseCases useCases, HttpContext context) =>
            (await useCases.PostOrdersByIdDeliver(id, request, ct)).ToHttpResult(context));
    }
}
