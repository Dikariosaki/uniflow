using Microsoft.AspNetCore.SignalR;
using UniFlow.Application.Abstractions;

namespace UniFlow.Api.Realtime;

public sealed class SignalROrderNotifier(IHubContext<OrderHub> hub, ILogger<SignalROrderNotifier> logger) : IOrderNotifier
{
    public async Task OrderChangedAsync(Guid orderId, string status, bool includeCustomer, CancellationToken ct)
    {
        try
        {
            var client = includeCustomer ? hub.Clients.Groups(["staff", $"order-{orderId}"]) : hub.Clients.Group("staff");
            await client.SendAsync("orderChanged", new { orderId, status }, ct);
        }
        catch (Exception exception)
        {
            // The transaction has committed. A transient realtime failure must not
            // turn a persisted confirmation into an HTTP error; clients also poll.
            logger.LogWarning("No se pudo enviar la actualización en tiempo real del pedido {OrderId}. Tipo={ErrorType}. Se conserva el resultado confirmado; los clientes consultarán por HTTP.", orderId, exception.GetType().Name);
        }
    }
}
