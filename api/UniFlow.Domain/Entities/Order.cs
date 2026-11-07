namespace UniFlow.Domain.Entities;

public sealed class Order
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public required string PickupCode { get; set; }
    public required string TrackingTokenHash { get; set; }
    public required string IdempotencyKey { get; set; }
    public required string CustomerAlias { get; set; }
    public required string CustomerPhone { get; set; }
    public required string PickupMode { get; set; }
    public Guid SlotId { get; set; }
    public PickupSlot? Slot { get; set; }
    public string Status { get; set; } = "CONFIRMADO";
    public string PaymentStatus { get; set; } = "PENDIENTE_EN_CAFETERIA";
    public bool ConsumesCapacity { get; set; } = true;
    public int TotalCop { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset ConfirmedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? ReadyAt { get; set; }
    public DateTimeOffset? DeliveredAt { get; set; }
    public List<OrderItem> Items { get; set; } = [];
    public List<OrderEvent> Events { get; set; } = [];
}

