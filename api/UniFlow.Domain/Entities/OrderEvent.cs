namespace UniFlow.Domain.Entities;

public sealed class OrderEvent
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid OrderId { get; set; }
    public string? PreviousStatus { get; set; }
    public required string NewStatus { get; set; }
    public string? ActorId { get; set; }
    public string? Reason { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

