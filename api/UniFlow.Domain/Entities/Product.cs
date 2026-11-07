namespace UniFlow.Domain.Entities;

public sealed class Product
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid CategoryId { get; set; }
    public Category? Category { get; set; }
    public required string Name { get; set; }
    public string Description { get; set; } = "";
    public int PriceCop { get; set; }
    public int StockQuantity { get; set; }
    public string? ImagePath { get; set; }
    public bool Available { get; set; } = true;
    public bool Active { get; set; } = true;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

