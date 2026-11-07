using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace UniFlow.Infrastructure.Persistence;

public sealed class UniFlowDbContextFactory : IDesignTimeDbContextFactory<UniFlowDbContext>
{
    public UniFlowDbContext CreateDbContext(string[] args)
    {
        var connection = Environment.GetEnvironmentVariable("ConnectionStrings__Supabase")
            ?? "Host=localhost;Database=uniflow;Username=postgres;Password=postgres";
        return new UniFlowDbContext(new DbContextOptionsBuilder<UniFlowDbContext>().UseNpgsql(PostgresConnectionString.Normalize(connection)).Options);
    }
}
