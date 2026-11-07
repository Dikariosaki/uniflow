using System.Text;
using System.Security.Cryptography;
using UniFlow.Application.Abstractions;
using UniFlow.Application.Common;
using UniFlow.Application.Contracts;
using UniFlow.Domain.Entities;
using UniFlow.Domain.Orders;
using static UniFlow.Application.Common.ApplicationRules;

namespace UniFlow.Application.Features;

public sealed class StaffAccessUseCases(IApplicationStore db, ICurrentUser user)
{
    public async Task<UseCaseResult> GetMe(CancellationToken ct)
    {
        var id = user.UserId;
        var role = id is null ? null : await db.StaffRoles.Where(r => r.UserId == id && r.Active).Select(r => r.Role).FirstOrDefaultAsync(ct);
        return role is null ? UseCaseResult.Forbid() : UseCaseResult.Ok(new { id, role, name = user.Email });
    }
}
