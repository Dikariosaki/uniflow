using UniFlow.Application.Contracts;
using UniFlow.Application.Features;
using UniFlow.Api.Http;

namespace UniFlow.Api.Endpoints;

public static class StaffAdministrationEndpoints
{
    public static void MapStaffAdministrationEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/admin").RequireAuthorization();
        group.MapPost("/staff/invitations", async (StaffInviteRequest input, CancellationToken ct, StaffAdministrationUseCases useCases, HttpContext context) =>
            (await useCases.PostStaffInvitations(input, ct)).ToHttpResult(context));
        group.MapGet("/staff", async (CancellationToken ct, StaffAdministrationUseCases useCases, HttpContext context) =>
            (await useCases.GetStaff(ct)).ToHttpResult(context));
        group.MapPut("/staff/{userId}/role", async (string userId, StaffRoleInput input, CancellationToken ct, StaffAdministrationUseCases useCases, HttpContext context) =>
            (await useCases.PutStaffByUserIdRole(userId, input, ct)).ToHttpResult(context));
    }
}
