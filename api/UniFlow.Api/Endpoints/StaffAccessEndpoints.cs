using UniFlow.Application.Contracts;
using UniFlow.Application.Features;
using UniFlow.Api.Http;

namespace UniFlow.Api.Endpoints;

public static class StaffAccessEndpoints
{
    public static void MapStaffAccessEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/staff").RequireAuthorization();
        group.MapGet("/me", async (CancellationToken ct, StaffAccessUseCases useCases, HttpContext context) =>
            (await useCases.GetMe(ct)).ToHttpResult(context));
    }
}
