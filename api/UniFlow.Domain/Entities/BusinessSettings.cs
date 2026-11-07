namespace UniFlow.Domain.Entities;

public sealed class BusinessSettings
{
    public int Id { get; set; } = 1;
    public string Name { get; set; } = "Cafetería Bloque B";
    public string TimeZone { get; set; } = "America/Bogota";
    public bool OrdersPaused { get; set; }
    public int MinimumNoticeMinutes { get; set; }
}

