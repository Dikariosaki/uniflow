namespace UniFlow.Domain.Entities;

public sealed class StaffRole
{
    public string UserId { get; set; } = "";
    public required string Role { get; set; }
    public bool Active { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

