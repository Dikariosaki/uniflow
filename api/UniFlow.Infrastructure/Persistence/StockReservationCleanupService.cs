using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace UniFlow.Infrastructure.Persistence;

internal sealed class StockReservationCleanupService(
    IServiceScopeFactory scopes,
    ILogger<StockReservationCleanupService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(30));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                var db = scope.ServiceProvider.GetRequiredService<UniFlowDbContext>();
                await db.Database.ExecuteSqlInterpolatedAsync($"""
                    WITH expired AS (
                        SELECT "CartToken", "ProductId"
                        FROM stock_reservations
                        WHERE "ExpiresAt" <= {DateTimeOffset.UtcNow}
                        ORDER BY "ExpiresAt"
                        LIMIT 500
                        FOR UPDATE SKIP LOCKED
                    )
                    DELETE FROM stock_reservations AS reservations
                    USING expired
                    WHERE reservations."CartToken" = expired."CartToken"
                      AND reservations."ProductId" = expired."ProductId"
                    """, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception error)
            {
                logger.LogWarning(error, "Expired stock reservations cleanup failed.");
            }
        }
    }
}
