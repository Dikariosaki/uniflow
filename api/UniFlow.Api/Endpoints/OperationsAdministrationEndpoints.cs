using UniFlow.Application.Contracts;
using UniFlow.Application.Features;
using UniFlow.Api.Http;

namespace UniFlow.Api.Endpoints;

public static class OperationsAdministrationEndpoints
{
    public static void MapOperationsAdministrationEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/admin").RequireAuthorization();
        group.MapGet("/schedule", async (CancellationToken ct, OperationsAdministrationUseCases useCases, HttpContext context) =>
            (await useCases.GetSchedule(ct)).ToHttpResult(context));
        group.MapPut("/schedule", async (ScheduleInput input, CancellationToken ct, OperationsAdministrationUseCases useCases, HttpContext context) =>
            (await useCases.PutSchedule(input, ct)).ToHttpResult(context));
        group.MapPut("/settings", async (SettingsInput input, CancellationToken ct, OperationsAdministrationUseCases useCases, HttpContext context) =>
            (await useCases.PutSettings(input, ct)).ToHttpResult(context));
        group.MapGet("/pickup-slots", async (DateOnly date, CancellationToken ct, OperationsAdministrationUseCases useCases, HttpContext context) =>
            (await useCases.GetPickupSlots(date, ct)).ToHttpResult(context));
        group.MapPost("/pickup-slots", async (SlotInput input, CancellationToken ct, OperationsAdministrationUseCases useCases, HttpContext context) =>
            (await useCases.PostPickupSlots(input, ct)).ToHttpResult(context));
        group.MapPut("/pickup-slots/{id:guid}", async (Guid id, SlotInput input, CancellationToken ct, OperationsAdministrationUseCases useCases, HttpContext context) =>
            (await useCases.PutPickupSlotsById(id, input, ct)).ToHttpResult(context));
    }
}
