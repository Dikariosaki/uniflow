using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.Logging;
using Npgsql;
using System.Net.Sockets;
using UniFlow.Application.Abstractions;
using UniFlow.Domain.Entities;

namespace UniFlow.Infrastructure.Persistence;

public sealed class EfApplicationStore(UniFlowDbContext db, ILogger<EfApplicationStore> logger) : IApplicationStore
{
    public IRepository<Category> Categories { get; } = new EfRepository<Category>(db);
    public IRepository<Product> Products { get; } = new EfRepository<Product>(db);
    public IRepository<StockReservation> StockReservations { get; } = new EfRepository<StockReservation>(db);
    public IRepository<BusinessSettings> BusinessSettings { get; } = new EfRepository<BusinessSettings>(db);
    public IRepository<OpeningHour> OpeningHours { get; } = new EfRepository<OpeningHour>(db);
    public IRepository<PickupSlot> PickupSlots { get; } = new EfRepository<PickupSlot>(db);
    public IRepository<Order> Orders { get; } = new EfRepository<Order>(db);
    public IRepository<OrderItem> OrderItems { get; } = new EfRepository<OrderItem>(db);
    public IRepository<OrderEvent> OrderEvents { get; } = new EfRepository<OrderEvent>(db);
    public IRepository<StaffRole> StaffRoles { get; } = new EfRepository<StaffRole>(db);
    public IRepository<AdminAuditEvent> AdminAuditEvents { get; } = new EfRepository<AdminAuditEvent>(db);
    public async Task<int> SaveChangesAsync(CancellationToken ct = default)
    {
        try { return await db.SaveChangesAsync(ct); }
        catch (DbUpdateException exception) when (exception.InnerException is PostgresException { SqlState: "23505" or "40001" or "40P01" })
        { throw new PersistenceConflictException(exception); }
    }
    public async Task<IAppTransaction> BeginTransactionAsync(CancellationToken ct) => new Transaction(await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.ReadCommitted, ct));
    public Task LockIdempotencyKeyAsync(string key, CancellationToken ct) => db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock(hashtextextended({key}, 0))", ct);
    public Task LockSlotAsync(Guid id, CancellationToken ct) => db.Database.ExecuteSqlInterpolatedAsync($"SELECT \"Id\" FROM pickup_slots WHERE \"Id\" = {id} FOR UPDATE", ct);
    public Task LockProductAsync(Guid id, CancellationToken ct) => db.Database.ExecuteSqlInterpolatedAsync($"SELECT \"Id\" FROM products WHERE \"Id\" = {id} FOR UPDATE", ct);
    public Task LockCartReservationKeyAsync(string token, CancellationToken ct) => db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock(hashtextextended({token}, 1))", ct);
    public Task LockCartReservationsAsync(string token, CancellationToken ct) => db.Database.ExecuteSqlInterpolatedAsync($"SELECT \"ProductId\" FROM stock_reservations WHERE \"CartToken\" = {token} FOR UPDATE", ct);
    public Task LockOrderAsync(Guid id, CancellationToken ct) => db.Database.ExecuteSqlInterpolatedAsync($"SELECT \"Id\" FROM orders WHERE \"Id\" = {id} FOR UPDATE", ct);
    public Task LockSlotAdministrationAsync(CancellationToken ct) => db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock(852194)", ct);
    public Task ReloadAsync<T>(T entity, CancellationToken ct) where T : class => db.Entry(entity).ReloadAsync(ct);
    public async Task<bool> CanConnectAsync(CancellationToken ct)
    {
        try
        {
            await db.Database.OpenConnectionAsync(ct);
            await db.Database.CloseConnectionAsync();
            return true;
        }
        catch (Exception exception) when (!ct.IsCancellationRequested)
        {
            var cause = exception.GetBaseException();
            logger.LogWarning(exception, "PostgreSQL connection check failed. ErrorType={ErrorType}; ErrorCode={ErrorCode}", cause.GetType().Name, cause is PostgresException postgres ? postgres.SqlState : cause is SocketException socket ? socket.SocketErrorCode.ToString() : "unavailable");
            return false;
        }
    }

    private sealed class Transaction(IDbContextTransaction transaction) : IAppTransaction
    {
        public Task CommitAsync(CancellationToken ct) => transaction.CommitAsync(ct);
        public Task RollbackAsync(CancellationToken ct) => transaction.RollbackAsync(ct);
        public ValueTask DisposeAsync() => transaction.DisposeAsync();
    }
}
