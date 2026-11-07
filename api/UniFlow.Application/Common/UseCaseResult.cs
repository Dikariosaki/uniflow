namespace UniFlow.Application.Common;

// Transport-neutral result: the API adapter owns HTTP serialization and headers.
public enum OutcomeKind { Success, Created, Accepted, NotFound, Forbidden, InvalidRequest, ValidationFailed, Conflict, Unavailable }
public sealed record UseCaseResult(OutcomeKind Kind, object? Value = null, string? Detail = null, Guid? ResourceId = null, byte[]? Bytes = null, string? ContentType = null, string? DownloadName = null)
{
    public int? TotalCount { get; private set; }
    public UseCaseResult WithTotalCount(int count) { TotalCount = count; return this; }
    public static UseCaseResult Ok(object? value = null) => new(OutcomeKind.Success, value);
    public static UseCaseResult Created(object value, Guid resourceId) => new(OutcomeKind.Created, value, ResourceId: resourceId);
    public static UseCaseResult Accepted(object? value = null) => new(OutcomeKind.Accepted, value);
    public static UseCaseResult NotFound() => new(OutcomeKind.NotFound);
    public static UseCaseResult Forbid() => new(OutcomeKind.Forbidden);
    public static UseCaseResult Failure(string detail, OutcomeKind kind) => new(kind, Detail: detail);
    public static UseCaseResult Conflict(object value) => new(OutcomeKind.Conflict, value);
    public static UseCaseResult Unavailable(object value) => new(OutcomeKind.Unavailable, value);
    public static UseCaseResult File(byte[] bytes, string contentType, string downloadName) => new(OutcomeKind.Success, Bytes: bytes, ContentType: contentType, DownloadName: downloadName);
}
