using Microsoft.AspNetCore.SignalR;
using System.Security.Claims;
using UniFlow.Application.Features;

namespace UniFlow.Api.Realtime;

public sealed class OrderHub(OrderSubscriptions subscriptions) : Hub
{
    public override async Task OnConnectedAsync()
    {
        var token = Context.GetHttpContext()?.Request.Headers["X-Tracking-Token"].FirstOrDefault();
        var group = await subscriptions.ResolveGroupAsync(Context.User?.FindFirstValue("sub"), token, Context.ConnectionAborted);
        if (group is not null) await Groups.AddToGroupAsync(Context.ConnectionId, group);
        await base.OnConnectedAsync();
    }
}
