namespace UniFlow.Domain.Entities;

public sealed class OpeningHour
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public int? Weekday { get; set; }
    public DateOnly? Date { get; set; }
    public TimeOnly OpensAt { get; set; }
    public TimeOnly ClosesAt { get; set; }
    public bool Closed { get; set; }
}

