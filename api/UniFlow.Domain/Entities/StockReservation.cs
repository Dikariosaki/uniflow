namespace UniFlow.Domain.Entities;

public sealed class StockReservation
{
    public required string CartToken { get; set; }
    public Guid ProductId { get; set; }
    public int Quantity { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
}
