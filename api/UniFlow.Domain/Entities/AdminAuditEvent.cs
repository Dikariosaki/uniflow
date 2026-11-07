namespace UniFlow.Domain.Entities;

public sealed class AdminAuditEvent
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public required string ActorId { get; set; }
    public required string Action { get; set; }
    public required string EntityType { get; set; }
    public string? EntityId { get; set; }
    public string? Details { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
