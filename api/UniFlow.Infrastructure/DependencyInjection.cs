using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using UniFlow.Application.Abstractions;
using UniFlow.Infrastructure.Persistence;
using UniFlow.Infrastructure.Supabase;

namespace UniFlow.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connection = PostgresConnectionString.Normalize(configuration.GetConnectionString("Supabase"));
        services.AddDbContext<UniFlowDbContext>(options => options.UseNpgsql(connection));
        services.AddScoped<IApplicationStore, EfApplicationStore>();
        services.AddHttpClient<SupabaseStorage>();
        services.AddHttpClient<SupabaseAdmin>();
        services.AddScoped<IProductImageStorage>(provider => provider.GetRequiredService<SupabaseStorage>());
        services.AddScoped<IStaffIdentityAdmin>(provider => provider.GetRequiredService<SupabaseAdmin>());
        services.AddScoped<DatabaseInitializer>();
        services.AddHostedService<StockReservationCleanupService>();
        return services;
    }
}
