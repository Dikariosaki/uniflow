using System.Text;
using System.Security.Cryptography;
using UniFlow.Application.Abstractions;
using UniFlow.Application.Common;
using UniFlow.Application.Contracts;
using UniFlow.Domain.Entities;
using UniFlow.Domain.Orders;
using static UniFlow.Application.Common.ApplicationRules;

namespace UniFlow.Application.Features;

public sealed class OperationsAdministrationUseCases(IApplicationStore db, ICurrentUser user)
{
    public async Task<UseCaseResult> GetSchedule(CancellationToken ct)
    { return !await HasStaffRole(user, db, ct, "administrator") ? UseCaseResult.Forbid() : UseCaseResult.Ok(new { settings = await db.BusinessSettings.FindAsync([1], ct), hours = await db.OpeningHours.OrderBy(h => h.Weekday).ThenBy(h => h.Date).ToListAsync(ct) }); }

    public async Task<UseCaseResult> PutSchedule(ScheduleInput input, CancellationToken ct)
    {
        if (!await HasStaffRole(user, db, ct, "administrator")) return UseCaseResult.Forbid();
        if (input.Hours is null || input.Hours.Count > 400 || input.Hours.Any(h => h is null || h.Weekday is < 0 or > 6 || (!h.Closed && h.ClosesAt <= h.OpensAt) || ((h.Weekday is null) == (h.Date is null))) || input.Hours.GroupBy(h => (h.Weekday, h.Date)).Any(g => g.Count() > 1)) return UseCaseResult.Failure("Revisa los días y horas de apertura; usa una entrada por día y por excepción.", kind: OutcomeKind.ValidationFailed);
        db.OpeningHours.RemoveRange(db.OpeningHours);
        db.OpeningHours.AddRange(input.Hours.Select(h => new OpeningHour { Weekday = h.Weekday, Date = h.Date, OpensAt = h.OpensAt, ClosesAt = h.ClosesAt, Closed = h.Closed }));
        AddAdminAudit(db, user, "schedule.updated", "schedule", null, $"entries={input.Hours.Count}");
        await db.SaveChangesAsync(ct); return UseCaseResult.Ok(new { saved = input.Hours.Count });
    }

    public async Task<UseCaseResult> PutSettings(SettingsInput input, CancellationToken ct)
    {
        if (!await HasStaffRole(user, db, ct, "administrator")) return UseCaseResult.Forbid();
        var settings = await db.BusinessSettings.FindAsync([1], ct);
        if (string.IsNullOrWhiteSpace(input.Name) || input.Name.Trim().Length > 120 || input.MinimumNoticeMinutes is < 0 or > 1440) return UseCaseResult.Failure("Revisa el nombre del punto (hasta 120 caracteres) y el aviso mínimo (0 a 1440 minutos).", kind: OutcomeKind.ValidationFailed);
        if (settings is null) { settings = new BusinessSettings(); db.BusinessSettings.Add(settings); }
        settings.Name = input.Name.Trim(); settings.OrdersPaused = input.OrdersPaused; settings.MinimumNoticeMinutes = Math.Clamp(input.MinimumNoticeMinutes, 0, 1440);
        AddAdminAudit(db, user, "business_settings.updated", "business_settings", "1", $"paused={settings.OrdersPaused}; notice_minutes={settings.MinimumNoticeMinutes}"); await db.SaveChangesAsync(ct); return UseCaseResult.Ok(settings);
    }

    public async Task<UseCaseResult> GetPickupSlots(DateOnly date, CancellationToken ct)
    {
        if (!await HasStaffRole(user, db, ct, "administrator")) return UseCaseResult.Forbid();
        var start = BogotaDayStart(date); var end = BogotaDayStart(date.AddDays(1));
        return UseCaseResult.Ok(await db.PickupSlots.Where(s => s.StartsAt >= start && s.StartsAt < end).OrderBy(s => s.StartsAt).ToListAsync(ct));
    }

    public async Task<UseCaseResult> GeneratePickupSlots(GeneratePickupSlotsInput input, CancellationToken ct)
    {
        if (!await HasStaffRole(user, db, ct, "administrator")) return UseCaseResult.Forbid();
        if (input.IntervalMinutes is < 5 or > 240 || input.Capacity is < 1 or > 10000)
            return UseCaseResult.Failure("La duración debe estar entre 5 y 240 minutos y la capacidad entre 1 y 10.000 pedidos.", kind: OutcomeKind.ValidationFailed);

        var exception = await db.OpeningHours.FirstOrDefaultAsync(h => h.Date == input.Date, ct);
        var weekday = (int)input.Date.ToDateTime(TimeOnly.MinValue).DayOfWeek;
        var opening = exception ?? await db.OpeningHours.FirstOrDefaultAsync(h => h.Date == null && h.Weekday == weekday, ct);
        if (opening is null || opening.Closed || opening.ClosesAt <= opening.OpensAt)
            return UseCaseResult.Failure("No hay un horario de atención abierto para esa fecha. Guarda primero el horario semanal o configura una excepción.", kind: OutcomeKind.ValidationFailed);

        var zone = TimeZoneInfo.FindSystemTimeZoneById("America/Bogota");
        var localStart = input.Date.ToDateTime(opening.OpensAt, DateTimeKind.Unspecified);
        var localEnd = input.Date.ToDateTime(opening.ClosesAt, DateTimeKind.Unspecified);
        var nowLocal = TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, zone).DateTime;
        var candidates = new List<PickupSlot>();
        var cursor = localStart;
        while (cursor < localEnd)
        {
            var next = cursor.AddMinutes(input.IntervalMinutes);
            if (next > localEnd) next = localEnd;
            if (cursor >= nowLocal)
            {
                var startsAt = new DateTimeOffset(TimeZoneInfo.ConvertTimeToUtc(cursor, zone));
                var endsAt = new DateTimeOffset(TimeZoneInfo.ConvertTimeToUtc(next, zone));
                candidates.Add(new PickupSlot { StartsAt = startsAt, EndsAt = endsAt, Capacity = input.Capacity });
            }
            cursor = next;
        }

        if (candidates.Count == 0)
            return UseCaseResult.Failure("El horario de esa fecha ya terminó; elige una fecha futura.", kind: OutcomeKind.ValidationFailed);

        await using var tx = await db.BeginTransactionAsync(ct);
        await db.LockSlotAdministrationAsync(ct);
        var rangeStart = candidates[0].StartsAt;
        var rangeEnd = candidates[^1].EndsAt;
        var existing = await db.PickupSlots.ReadOnly()
            .Where(s => s.Active && s.StartsAt < rangeEnd && rangeStart < s.EndsAt)
            .ToListAsync(ct);
        var conflict = candidates.FirstOrDefault(candidate =>
            existing.Any(slot => slot.StartsAt < candidate.EndsAt && candidate.StartsAt < slot.EndsAt));
        if (conflict is not null)
        {
            var conflictStart = TimeZoneInfo.ConvertTime(conflict.StartsAt, zone);
            var conflictEnd = TimeZoneInfo.ConvertTime(conflict.EndsAt, zone);
            return UseCaseResult.Failure($"Ya existe una franja activa que se cruza con {conflictStart:HH:mm}–{conflictEnd:HH:mm} (hora de Bogotá). No se creó ninguna.", kind: OutcomeKind.Conflict);
        }

        db.PickupSlots.AddRange(candidates);
        AddAdminAudit(db, user, "pickup_slots.generated", "pickup_slot", input.Date.ToString("yyyy-MM-dd"),
            $"date={input.Date:yyyy-MM-dd}; slots={candidates.Count}; interval_minutes={input.IntervalMinutes}; capacity={input.Capacity}");
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return UseCaseResult.Ok(new { date = input.Date, createdCount = candidates.Count, slots = candidates });
    }

    public async Task<UseCaseResult> PostPickupSlots(SlotInput input, CancellationToken ct)
    {
        if (!await HasStaffRole(user, db, ct, "administrator")) return UseCaseResult.Forbid();
        var startsAt = input.StartsAt.ToUniversalTime(); var endsAt = input.EndsAt.ToUniversalTime();
        if (endsAt <= startsAt || startsAt <= DateTimeOffset.UtcNow || input.Capacity is < 0 or > 10000) return UseCaseResult.Failure("Revisa la fecha, las horas y la capacidad ingresadas.", kind: OutcomeKind.ValidationFailed);
        await using var tx = await db.BeginTransactionAsync(ct);
        await db.LockSlotAdministrationAsync(ct);
        if (input.Active && await db.PickupSlots.AnyAsync(s => s.Active && s.StartsAt < endsAt && startsAt < s.EndsAt, ct)) return UseCaseResult.Failure("Ese horario se cruza con otro que ya está activo.", kind: OutcomeKind.Conflict);
        var slot = new PickupSlot { StartsAt = startsAt, EndsAt = endsAt, Capacity = input.Capacity, Active = input.Active };
        db.PickupSlots.Add(slot); AddAdminAudit(db, user, "pickup_slot.created", "pickup_slot", slot.Id.ToString(), $"starts={startsAt:O}; ends={endsAt:O}; capacity={slot.Capacity}"); await db.SaveChangesAsync(ct); await tx.CommitAsync(ct); return UseCaseResult.Created(slot, slot.Id);
    }

    public async Task<UseCaseResult> PutPickupSlotsById(Guid id, SlotInput input, CancellationToken ct)
    {
        if (!await HasStaffRole(user, db, ct, "administrator")) return UseCaseResult.Forbid();
        await using var tx = await db.BeginTransactionAsync(ct);
        await db.LockSlotAdministrationAsync(ct);
        await db.LockSlotAsync(id, ct);
        var slot = await db.PickupSlots.FindAsync([id], ct); if (slot is null) return UseCaseResult.NotFound();
        var reserved = await db.Orders.CountAsync(o => o.SlotId == slot.Id && o.ConsumesCapacity, ct);
        var startsAt = input.StartsAt.ToUniversalTime(); var endsAt = input.EndsAt.ToUniversalTime();
        if (endsAt <= startsAt || input.Capacity is < 0 or > 10000 || input.Capacity < reserved || (reserved > 0 && (startsAt != slot.StartsAt || endsAt != slot.EndsAt || !input.Active))) return UseCaseResult.Failure("La capacidad no puede quedar bajo los pedidos reservados ni cambiarse una franja con pedidos activos.", kind: OutcomeKind.Conflict);
        if (input.Active && await db.PickupSlots.AnyAsync(s => s.Id != id && s.Active && s.StartsAt < endsAt && startsAt < s.EndsAt, ct)) return UseCaseResult.Failure("Ese horario se cruza con otro que ya está activo.", kind: OutcomeKind.Conflict);
        slot.StartsAt = startsAt; slot.EndsAt = endsAt; slot.Capacity = input.Capacity; slot.Active = input.Active;
        AddAdminAudit(db, user, "pickup_slot.updated", "pickup_slot", id.ToString(), $"starts={startsAt:O}; ends={endsAt:O}; capacity={slot.Capacity}; active={slot.Active}"); await db.SaveChangesAsync(ct); await tx.CommitAsync(ct); return UseCaseResult.Ok(slot);
    }
}
