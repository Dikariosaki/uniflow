using System.Security.Claims;
using UniFlow.Application.Abstractions;

namespace UniFlow.Api.Http;

public sealed class HttpCurrentUser(IHttpContextAccessor context) : ICurrentUser
{
    public string? UserId => context.HttpContext?.User.FindFirstValue("sub");
    public string? Email => context.HttpContext?.User.FindFirstValue("email");
}
