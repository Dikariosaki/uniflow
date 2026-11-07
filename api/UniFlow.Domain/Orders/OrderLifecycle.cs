namespace UniFlow.Domain.Orders;

public static class OrderLifecycle
{
    private static readonly IReadOnlyDictionary<string, string[]> Transitions = new Dictionary<string, string[]>
    {
        ["CONFIRMADO"] = ["EN_PREPARACION", "CANCELADO", "RECHAZADO"],
        ["EN_PREPARACION"] = ["LISTO", "CANCELADO"],
        ["LISTO"] = ["CANCELADO"]
    };
    public static bool CanTransition(string current, string next) => Transitions.TryGetValue(current, out var allowed) && allowed.Contains(next);
    public static bool ReleasesCapacity(string current, string next) => current == "CONFIRMADO" && next is "CANCELADO" or "RECHAZADO";
}
