using System.Threading.RateLimiting;
using System.Diagnostics;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.IdentityModel.Tokens;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using UniFlow.Application.Abstractions;
using UniFlow.Application.Features;
using UniFlow.Application.Common;
using UniFlow.Api.Endpoints;
using UniFlow.Api.Http;
using UniFlow.Api.Realtime;
using UniFlow.Api.OpenApi;
using UniFlow.Infrastructure;
using UniFlow.Infrastructure.Persistence;
using UniFlow.Infrastructure.Supabase;

var builder = WebApplication.CreateBuilder(args);
var supabaseUrl = builder.Configuration["Supabase:Url"]?.TrimEnd('/');
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddSignalR();
builder.Services.AddApiDocumentation();
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<ApiExceptionHandler>();
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownIPNetworks.Clear();
    options.KnownProxies.Clear();
});
builder.Services.AddCors(options => options.AddDefaultPolicy(policy =>
{
    var origins = builder.Configuration["AllowedOrigins"]?.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries) ?? ["http://localhost:4200"];
    policy.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod().AllowCredentials().WithExposedHeaders("X-Total-Count");
}));
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(options =>
{
    options.MapInboundClaims = false;
    if (!string.IsNullOrWhiteSpace(supabaseUrl))
    {
        options.Authority = $"{supabaseUrl}/auth/v1";
        options.Audience = builder.Configuration["Supabase:JwtAudience"] ?? "authenticated";
        options.RequireHttpsMetadata = !builder.Environment.IsDevelopment();
        options.TokenValidationParameters = new TokenValidationParameters { ValidateIssuer = true, ValidIssuer = $"{supabaseUrl}/auth/v1" };
        var internalUrl = (builder.Configuration["Supabase:InternalUrl"] ?? supabaseUrl).TrimEnd('/');
        options.ConfigurationManager = new ConfigurationManager<OpenIdConnectConfiguration>(
            $"{internalUrl}/auth/v1/.well-known/jwks.json", new SupabaseSigningKeysRetriever($"{supabaseUrl}/auth/v1"),
            new HttpDocumentRetriever { RequireHttps = options.RequireHttpsMetadata });
    }
});
builder.Services.AddAuthorization();
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("public", context => RateLimitPartition.GetFixedWindowLimiter(
    context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
    _ => new FixedWindowRateLimiterOptions { PermitLimit = Math.Clamp(builder.Configuration.GetValue("RateLimiting:PublicRequestsPerMinute", 30), 1, 10000), Window = TimeSpan.FromMinutes(1), QueueLimit = 0, AutoReplenishment = true }));
});


builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUser, HttpCurrentUser>();
builder.Services.AddScoped<IOrderNotifier, SignalROrderNotifier>();
builder.Services.AddScoped<OrderSubscriptions>();
builder.Services.AddScoped<CatalogUseCases>();
builder.Services.AddScoped<OrderingUseCases>();
builder.Services.AddScoped<StaffAccessUseCases>();
builder.Services.AddScoped<StaffOrderUseCases>();
builder.Services.AddScoped<CatalogAdministrationUseCases>();
builder.Services.AddScoped<OperationsAdministrationUseCases>();
builder.Services.AddScoped<StaffAdministrationUseCases>();
builder.Services.AddScoped<ReportingUseCases>();

var app = builder.Build();
await using (var scope = app.Services.CreateAsyncScope())
{
    await scope.ServiceProvider.GetRequiredService<DatabaseInitializer>().InitializeAsync(
        app.Configuration.GetValue<bool>("Database:MigrateOnStartup"),
        app.Environment.IsDevelopment() && app.Configuration.GetValue<bool>("Development:SeedDemoData"),
        app.Configuration.GetValue("Storage:EnsureBucketOnStartup", true));
}
app.Use(async (context, next) =>
{
    var timer = Stopwatch.StartNew();
    var traceId = context.TraceIdentifier;
    var logger = context.RequestServices.GetRequiredService<ILoggerFactory>().CreateLogger("UniFlow.Requests");
    using var scope = logger.BeginScope("TraceId={TraceId}", traceId);
    context.Response.OnStarting(() =>
    {
        context.Response.Headers["X-Request-ID"] = traceId;
        return Task.CompletedTask;
    });
    try
    {
        await next();
    }
    finally
    {
        timer.Stop();
        if (context.Response.StatusCode >= StatusCodes.Status400BadRequest)
        {
            var log = "Request completed. Method={Method}; Path={Path}; Status={StatusCode}; ElapsedMs={ElapsedMs}; Reference={TraceId}";
            if (context.Response.StatusCode >= StatusCodes.Status500InternalServerError)
                logger.LogError(log, context.Request.Method, context.Request.Path, context.Response.StatusCode, timer.ElapsedMilliseconds, traceId);
            else
                logger.LogWarning(log, context.Request.Method, context.Request.Path, context.Response.StatusCode, timer.ElapsedMilliseconds, traceId);
        }
    }
});
app.UseExceptionHandler();
app.UseApiDocumentation();
app.UseCors();
app.UseForwardedHeaders();
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();
app.MapGet("/health", async (IApplicationStore db, HttpContext context, CancellationToken ct) => (await ApplicationRules.CheckHealth(db, ct)).ToHttpResult(context));
app.MapGet("/api/v1/health", async (IApplicationStore db, HttpContext context, CancellationToken ct) => (await ApplicationRules.CheckHealth(db, ct)).ToHttpResult(context));
app.MapCatalogEndpoints();
app.MapOrderingEndpoints();
app.MapStaffAccessEndpoints();
app.MapStaffOrderEndpoints();
app.MapCatalogAdministrationEndpoints();
app.MapOperationsAdministrationEndpoints();
app.MapStaffAdministrationEndpoints();
app.MapReportingEndpoints();
app.MapHub<OrderHub>("/hubs/orders");
app.Run();
