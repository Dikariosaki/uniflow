using System.Data.Common;
using System.Net.Http;
using Microsoft.AspNetCore.Diagnostics;

namespace UniFlow.Api.Http;

public sealed class ApiExceptionHandler(ILogger<ApiExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken ct)
    {
        if (exception is OperationCanceledException && context.RequestAborted.IsCancellationRequested)
            return false;

        var unavailable = false;
        for (Exception? cause = exception; cause is not null; cause = cause.InnerException)
            unavailable |= cause is DbException or TimeoutException or HttpRequestException;
        var invalidRequest = exception is BadHttpRequestException;
        var statusCode = invalidRequest ? StatusCodes.Status400BadRequest
            : unavailable ? StatusCodes.Status503ServiceUnavailable
            : StatusCodes.Status500InternalServerError;

        // Server logs retain the stack and inner exception for diagnosis. Request bodies, query strings and tokens are never logged.
        logger.LogError(exception,
            "Unhandled request failure. Method={Method}; Path={Path}; Status={StatusCode}; Reference={TraceId}",
            context.Request.Method, context.Request.Path, statusCode, context.TraceIdentifier);

        await Results.Problem(
            title: "No pudimos completar tu solicitud",
            detail: invalidRequest
                ? "Revisa los datos e inténtalo de nuevo."
                : "Inténtalo de nuevo. Si el problema continúa, comparte el código de referencia con el equipo de la cafetería.",
            statusCode: statusCode,
            extensions: new Dictionary<string, object?> { ["traceId"] = context.TraceIdentifier }
        ).ExecuteAsync(context);
        return true;
    }
}
