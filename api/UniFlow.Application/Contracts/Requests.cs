namespace UniFlow.Application.Contracts;

public sealed record CreateOrderRequest(string Alias, string Phone, string PickupMode, Guid? SlotId, List<OrderLineRequest> Items, string CartToken);
public sealed record OrderLineRequest(Guid ProductId, int Quantity, int? ExpectedPriceCop = null);
public sealed record StockReservationRequest(string CartToken, List<OrderLineRequest> Items);
public sealed record ChangeStatusRequest(string Status, string? Reason);
public sealed record DeliverRequest(string Code);
public sealed record CategoryInput(string Name, int DisplayOrder, bool Active = true);
public sealed record ProductInput(Guid CategoryId, string Name, string? Description, int PriceCop, bool Available, int StockQuantity, bool Active = true);
public sealed record ImageUploadRequest(string ContentType, long SizeBytes);
public sealed record ProductImageInput(string Path);
public sealed record SettingsInput(string Name, bool OrdersPaused, int MinimumNoticeMinutes);
public sealed record SlotInput(DateTimeOffset StartsAt, DateTimeOffset EndsAt, int Capacity, bool Active = true);
public sealed record GeneratePickupSlotsInput(DateOnly Date, int IntervalMinutes, int Capacity);
public sealed record OpeningHourInput(int? Weekday, DateOnly? Date, TimeOnly OpensAt, TimeOnly ClosesAt, bool Closed);
public sealed record ScheduleInput(List<OpeningHourInput> Hours);
public sealed record StaffInviteRequest(string Email, string Role);
public sealed record StaffRoleInput(string Role, bool Active);
public sealed record TrackRequest(string Token);
