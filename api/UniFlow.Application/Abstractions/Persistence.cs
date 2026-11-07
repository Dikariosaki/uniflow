using System.Linq.Expressions;
using UniFlow.Domain.Entities;

namespace UniFlow.Application.Abstractions;

// Queries use BCL LINQ expressions. Only Infrastructure knows how to execute them.
public interface IRepository<T> : IQueryable<T> where T : class
{
    IQueryable<T> ReadOnly();
    ValueTask<T?> FindAsync(object[] keys, CancellationToken ct = default);
    void Add(T entity);
    void AddRange(params T[] entities);
    void AddRange(IEnumerable<T> entities);
    void Update(T entity);
    void RemoveRange(IEnumerable<T> entities);
}

public interface IAsyncQueryExecutor
{
    Task<TResult> ExecuteAsync<TResult>(Expression expression, CancellationToken ct);
}

public interface IAppTransaction : IAsyncDisposable
{
    Task CommitAsync(CancellationToken ct);
    Task RollbackAsync(CancellationToken ct);
}

public interface IApplicationStore
{
    IRepository<Category> Categories { get; }
    IRepository<Product> Products { get; }
    IRepository<StockReservation> StockReservations { get; }
    IRepository<BusinessSettings> BusinessSettings { get; }
    IRepository<OpeningHour> OpeningHours { get; }
    IRepository<PickupSlot> PickupSlots { get; }
    IRepository<Order> Orders { get; }
    IRepository<OrderItem> OrderItems { get; }
    IRepository<OrderEvent> OrderEvents { get; }
    IRepository<StaffRole> StaffRoles { get; }
    IRepository<AdminAuditEvent> AdminAuditEvents { get; }
    Task<int> SaveChangesAsync(CancellationToken ct = default);
    Task<IAppTransaction> BeginTransactionAsync(CancellationToken ct);
    Task LockIdempotencyKeyAsync(string key, CancellationToken ct);
    Task LockSlotAsync(Guid id, CancellationToken ct);
    Task LockProductAsync(Guid id, CancellationToken ct);
    Task LockCartReservationKeyAsync(string token, CancellationToken ct);
    Task LockCartReservationsAsync(string token, CancellationToken ct);
    Task LockOrderAsync(Guid id, CancellationToken ct);
    Task LockSlotAdministrationAsync(CancellationToken ct);
    Task ReloadAsync<T>(T entity, CancellationToken ct) where T : class;
    Task<bool> CanConnectAsync(CancellationToken ct);
}

public sealed class PersistenceConflictException(Exception inner) : Exception("Persistence conflict.", inner);

public static class QueryExtensions
{
    public static async Task<List<T>> ToListAsync<T>(this IQueryable<T> query, CancellationToken ct = default)
    {
        var result = new List<T>();
        if (query is not IAsyncEnumerable<T> rows) throw new InvalidOperationException("The query provider must support asynchronous enumeration.");
        await foreach (var row in rows.WithCancellation(ct)) result.Add(row);
        return result;
    }
    public static Task<bool> AnyAsync<T>(this IQueryable<T> query, CancellationToken ct = default) => Execute<T, bool>(query, nameof(Queryable.Any), ct);
    public static Task<bool> AnyAsync<T>(this IQueryable<T> query, Expression<Func<T, bool>> predicate, CancellationToken ct = default) => query.Where(predicate).AnyAsync(ct);
    public static Task<int> CountAsync<T>(this IQueryable<T> query, CancellationToken ct = default) => Execute<T, int>(query, nameof(Queryable.Count), ct);
    public static Task<int> CountAsync<T>(this IQueryable<T> query, Expression<Func<T, bool>> predicate, CancellationToken ct = default) => query.Where(predicate).CountAsync(ct);
    public static Task<T?> FirstOrDefaultAsync<T>(this IQueryable<T> query, CancellationToken ct = default) => Execute<T, T?>(query, nameof(Queryable.FirstOrDefault), ct);
    public static Task<T?> FirstOrDefaultAsync<T>(this IQueryable<T> query, Expression<Func<T, bool>> predicate, CancellationToken ct = default) => query.Where(predicate).FirstOrDefaultAsync(ct);
    public static async Task<Dictionary<TKey, T>> ToDictionaryAsync<T, TKey>(this IQueryable<T> query, Func<T, TKey> key, CancellationToken ct = default) where TKey : notnull => (await query.ToListAsync(ct)).ToDictionary(key);
    private static Task<TResult> Execute<T, TResult>(IQueryable<T> query, string method, CancellationToken ct) =>
        ((IAsyncQueryExecutor)query.Provider).ExecuteAsync<TResult>(Expression.Call(typeof(Queryable), method, [typeof(T)], query.Expression), ct);
}
