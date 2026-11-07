namespace UniFlow.Application.Abstractions;

public interface ICurrentUser
{
    string? UserId { get; }
    string? Email { get; }
}

public interface IOrderNotifier
{
    Task OrderChangedAsync(Guid orderId, string status, bool includeCustomer, CancellationToken ct);
}

public interface IProductImageStorage
{
    string? PublicUrl(string? path);
    Task<object> CreateUploadAsync(string path, string contentType, CancellationToken ct);
    Task<bool> ImageExistsAsync(string path, CancellationToken ct);
}

public interface IStaffIdentityAdmin
{
    Task<(string Id, string Email)> InviteAsync(string email, CancellationToken ct);
    Task<IReadOnlyDictionary<string, string>> GetEmailsByUserIdsAsync(IEnumerable<string> userIds, CancellationToken ct);
}
