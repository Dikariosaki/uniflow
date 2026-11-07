namespace UniFlow.Domain.Entities;

public sealed class Category
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public required string Name { get; set; }
    public int DisplayOrder { get; set; }
    public bool Active { get; set; } = true;
    public List<Product> Products { get; set; } = [];
}

