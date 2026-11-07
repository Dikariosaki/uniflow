namespace UniFlow.Domain.Entities;

public sealed class OrderItem
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid OrderId { get; set; }
    public Guid ProductId { get; set; }
    public required string NameSnapshot { get; set; }
    public int Quantity { get; set; }
    public int UnitPriceCop { get; set; }
    public int SubtotalCop { get; set; }
}

