using UniFlow.Application.Common;

namespace UniFlow.Api.Http;

public static class UseCaseResultExtensions
{
    public static IResult ToHttpResult(this UseCaseResult result, HttpContext context)
    {
        var status = result.Kind switch { OutcomeKind.Success => 200, OutcomeKind.Created => 201, OutcomeKind.Accepted => 202, OutcomeKind.NotFound => 404, OutcomeKind.Forbidden => 403, OutcomeKind.InvalidRequest => 400, OutcomeKind.ValidationFailed => 422, OutcomeKind.Conflict => 409, OutcomeKind.Unavailable => 503, _ => 500 };
        if (status >= 400 && result.Detail is not null)
            context.RequestServices.GetRequiredService<ILoggerFactory>().CreateLogger("UniFlow.UseCases")
                .LogWarning("Request rejected by application. Method={Method}; Path={Path}; Status={StatusCode}; Reason={Reason}; Reference={TraceId}",
                    context.Request.Method, context.Request.Path, status, result.Detail, context.TraceIdentifier);
        if (result.TotalCount is not null) context.Response.Headers["X-Total-Count"] = result.TotalCount.Value.ToString();
        if (result.ResourceId is not null) context.Response.Headers.Location = $"{context.Request.Path}/{result.ResourceId}";
        if (result.Bytes is not null) return Results.File(result.Bytes, result.ContentType, result.DownloadName);
        if (result.Detail is not null)
            return Results.Problem(
                title: status >= 500 ? "No pudimos completar tu solicitud" : null,
                detail: result.Detail,
                statusCode: status,
                extensions: new Dictionary<string, object?> { ["traceId"] = context.TraceIdentifier });
        return result.Value is null ? Results.StatusCode(status) : Results.Json(result.Value, statusCode: status);
    }
}
