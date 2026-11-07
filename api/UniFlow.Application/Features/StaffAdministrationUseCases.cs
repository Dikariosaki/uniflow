using System.Text;
using System.Security.Cryptography;
using UniFlow.Application.Abstractions;
using UniFlow.Application.Common;
using UniFlow.Application.Contracts;
using UniFlow.Domain.Entities;
using UniFlow.Domain.Orders;
using static UniFlow.Application.Common.ApplicationRules;

namespace UniFlow.Application.Features;

public sealed class StaffAdministrationUseCases(IApplicationStore db, ICurrentUser user, IStaffIdentityAdmin supabase)
{
    public async Task<UseCaseResult> PostStaffInvitations(StaffInviteRequest input, CancellationToken ct)
    {
        if (!await HasStaffRole(user, db, ct, "administrator")) return UseCaseResult.Forbid();
        if (input.Role is not ("operator" or "administrator") || !System.Net.Mail.MailAddress.TryCreate(input.Email, out _)) return UseCaseResult.Failure("Correo o rol no válido.", kind: OutcomeKind.ValidationFailed);
        try
        {
            var invited = await supabase.InviteAsync(input.Email.Trim(), ct);
            var existingRole = await db.StaffRoles.FindAsync([invited.Id], ct);
            if (existingRole is null)
            {
                db.StaffRoles.Add(new StaffRole { UserId = invited.Id, Role = input.Role });
            }
            else
            {
                var previousRole = existingRole.Role;
                existingRole.Role = input.Role;
                existingRole.Active = true;
                db.StaffRoles.Update(existingRole);
                AddAdminAudit(db, user, "staff_role.updated", "staff_role", invited.Id, $"from={previousRole}; to={input.Role}; active=true; source=invitation");
            }
            if (existingRole is null)
                AddAdminAudit(db, user, "staff.invited", "staff_role", invited.Id, $"role={input.Role}");
            await db.SaveChangesAsync(ct);
            return UseCaseResult.Accepted(value: new { invited.Email, Role = input.Role, UpdatedExistingAccess = existingRole is not null });
        }
        catch (InvalidOperationException) { return UseCaseResult.Failure("No pudimos enviar la invitación ahora. Inténtalo de nuevo más tarde.", kind: OutcomeKind.Unavailable); }
    }

    public async Task<UseCaseResult> GetStaff(CancellationToken ct)
    {
        if (!await HasStaffRole(user, db, ct, "administrator")) return UseCaseResult.Forbid();
        var roles = await db.StaffRoles.ReadOnly().OrderBy(r => r.Role).ThenBy(r => r.UserId).ToListAsync(ct);
        var emails = await supabase.GetEmailsByUserIdsAsync(roles.Select(role => role.UserId), ct);
        return UseCaseResult.Ok(roles.Select(role => new
        {
            role.UserId,
            Email = emails.GetValueOrDefault(role.UserId),
            role.Role,
            role.Active,
            role.CreatedAt,
        }).ToList());
    }

    public async Task<UseCaseResult> PutStaffByUserIdRole(string userId, StaffRoleInput input, CancellationToken ct)
    {
        if (!await HasStaffRole(user, db, ct, "administrator")) return UseCaseResult.Forbid();
        if (input.Role is not ("operator" or "administrator")) return UseCaseResult.Failure("Rol no válido.", kind: OutcomeKind.ValidationFailed);
        var role = await db.StaffRoles.FindAsync([userId], ct); if (role is null) return UseCaseResult.NotFound();
        if (userId == user.UserId && role.Role == "administrator" && (input.Role != "administrator" || !input.Active) && await db.StaffRoles.CountAsync(r => r.Role == "administrator" && r.Active, ct) <= 1) return UseCaseResult.Failure("No puedes desactivar el último acceso administrativo.", kind: OutcomeKind.Conflict);
        var previous = role.Role; role.Role = input.Role; role.Active = input.Active; AddAdminAudit(db, user, "staff_role.updated", "staff_role", userId, $"from={previous}; to={role.Role}; active={role.Active}"); await db.SaveChangesAsync(ct); return UseCaseResult.Ok(new { role.UserId, role.Role, role.Active });
    }
}
