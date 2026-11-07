using System.Collections;
using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using UniFlow.Application.Abstractions;
using UniFlow.Domain.Entities;

namespace UniFlow.Infrastructure.Persistence;

internal class QuerySource<T>(IQueryable<T> query) : IOrderedQueryable<T>, IAsyncEnumerable<T>
{
    public Type ElementType => typeof(T);
    public Expression Expression => query.Expression;
    public IQueryProvider Provider { get; } = new QueryExecutor(query.Provider);
    public IEnumerator<T> GetEnumerator() => query.GetEnumerator();
    IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
    public IAsyncEnumerator<T> GetAsyncEnumerator(CancellationToken ct = default) => query.AsAsyncEnumerable().GetAsyncEnumerator(ct);
}

internal sealed class QueryExecutor(IQueryProvider provider) : IQueryProvider, IAsyncQueryExecutor
{
    public IQueryable CreateQuery(Expression expression)
    {
        var inner = provider.CreateQuery(expression);
        return (IQueryable)Activator.CreateInstance(typeof(QuerySource<>).MakeGenericType(inner.ElementType), inner)!;
    }
    public IQueryable<T> CreateQuery<T>(Expression expression) => new QuerySource<T>(provider.CreateQuery<T>(expression));
    public object? Execute(Expression expression) => provider.Execute(expression);
    public TResult Execute<TResult>(Expression expression) => provider.Execute<TResult>(expression);
    public Task<TResult> ExecuteAsync<TResult>(Expression expression, CancellationToken ct) =>
        ((Microsoft.EntityFrameworkCore.Query.IAsyncQueryProvider)provider).ExecuteAsync<Task<TResult>>(expression, ct);
}

internal sealed class EfRepository<T>(UniFlowDbContext db) : QuerySource<T>(AggregateQuery(db)), IRepository<T> where T : class
{
    public IQueryable<T> ReadOnly() => new QuerySource<T>(AggregateQuery(db).AsNoTracking());
    private static IQueryable<T> AggregateQuery(UniFlowDbContext db)
    {
        if (typeof(T) == typeof(Order)) return (IQueryable<T>)db.Orders.Include(o => o.Items).Include(o => o.Slot).Include(o => o.Events).AsSplitQuery();
        if (typeof(T) == typeof(Product)) return (IQueryable<T>)db.Products.Include(p => p.Category);
        return db.Set<T>();
    }
    public ValueTask<T?> FindAsync(object[] keys, CancellationToken ct = default) => db.Set<T>().FindAsync(keys, ct);
    public void Add(T entity) => db.Set<T>().Add(entity);
    public void AddRange(params T[] entities) => db.Set<T>().AddRange(entities);
    public void AddRange(IEnumerable<T> entities) => db.Set<T>().AddRange(entities);
    public void Update(T entity) => db.Set<T>().Update(entity);
    public void RemoveRange(IEnumerable<T> entities) => db.Set<T>().RemoveRange(entities.ToArray());
}
