namespace UniFlow.Domain.Entities;

public sealed class PickupSlot
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public DateTimeOffset StartsAt { get; set; }
    public DateTimeOffset EndsAt { get; set; }
    public int Capacity { get; set; }
    public bool Active { get; set; } = true;
}

