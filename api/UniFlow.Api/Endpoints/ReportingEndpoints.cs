using UniFlow.Application.Contracts;
using UniFlow.Application.Features;
using UniFlow.Api.Http;

namespace UniFlow.Api.Endpoints;

public static class ReportingEndpoints
{
    public static void MapReportingEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/admin").RequireAuthorization();
        group.MapGet("/audit", async (CancellationToken ct, ReportingUseCases useCases, HttpContext context) =>
            (await useCases.GetAudit(ct)).ToHttpResult(context));
        group.MapGet("/reports/daily", async (DateOnly? date, CancellationToken ct, ReportingUseCases useCases, HttpContext context) =>
            (await useCases.GetReportsDaily(date, ct)).ToHttpResult(context));
        group.MapGet("/reports/orders.csv", async (DateOnly? date, CancellationToken ct, ReportingUseCases useCases, HttpContext context) =>
            (await useCases.GetReportsOrdersCsv(date, ct)).ToHttpResult(context));
    }
}
