using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging.Abstractions;
using Npgsql;
using UniFlow.Api.Realtime;
using UniFlow.Infrastructure.Persistence;

static void Require(bool condition, string label)
{
    if (!condition) throw new InvalidOperationException(label);
}

const string secret = "secret:@/;?#%+á";
var encoded = Uri.EscapeDataString(secret);
var uri = $"postgresql://postgres.project:{encoded}@pooler.example.test:6543/database%20name?sslmode=require&connect_timeout=9&application_name=UniFlow%20Test";
var parsed = new NpgsqlConnectionStringBuilder(PostgresConnectionString.Normalize(uri));
Require(parsed.Password == secret, "URI percent-encoded credentials must round trip.");
Require(parsed.Username == "postgres.project" && parsed.Host == "pooler.example.test" && parsed.Port == 6543, "Pooler host, user and port must be preserved.");
Require(parsed.Database == "database name" && parsed.SslMode == SslMode.Require && parsed.Timeout == 9 && parsed.ApplicationName == "UniFlow Test", "URI database, SSL and query options must be preserved.");
var keyValue = new NpgsqlConnectionStringBuilder { Host = "localhost", Username = "postgres", Password = secret, Database = "postgres", SslMode = SslMode.Disable };
Require(new NpgsqlConnectionStringBuilder(PostgresConnectionString.Normalize(keyValue.ConnectionString)).Password == secret, "Npgsql credentials must round trip.");
Require(new NpgsqlConnectionStringBuilder(PostgresConnectionString.Normalize("postgres://postgres:postgres@[::1]/postgres?sslmode=disable")).Host == "::1", "IPv6 URIs must be supported.");
Require(new NpgsqlConnectionStringBuilder(PostgresConnectionString.Normalize("postgres://postgres:postgres@localhost/postgres")).Port == 5432, "PostgreSQL default port must be 5432.");
foreach (var invalid in new[] { "", "Host=localhost;Password=do-not-log-me;InvalidOption=x", "postgres://postgres:do-not-log-me@localhost/postgres?invalid_option=x" })
{
    var rejected = false;
    try { PostgresConnectionString.Normalize(invalid); }
    catch (InvalidOperationException error)
    {
        rejected = true;
        Require(!error.ToString().Contains("do-not-log-me") && error.InnerException is null, "Configuration failures must not disclose credentials.");
    }
    Require(rejected, "Invalid database configuration must fail with an actionable message.");
}
Console.WriteLine("PASS PostgreSQL URI/Npgsql normalization: pooler, encoded credentials, IPv6, SSL/options and secret-safe errors.");

var clients = new FailingClients();
var notifier = new SignalROrderNotifier(new TestHub(clients), NullLogger<SignalROrderNotifier>.Instance);
await notifier.OrderChangedAsync(Guid.NewGuid(), "CONFIRMADO", false, CancellationToken.None);
await notifier.OrderChangedAsync(Guid.NewGuid(), "LISTO", true, new CancellationToken(canceled: true));
Require(clients.Attempts == 2, "Both staff-only and customer notifications must be attempted without failing the committed operation.");
Console.WriteLine("PASS A SignalR failure or canceled request after commit cannot turn a persisted operation into an HTTP failure.");

sealed class TestHub(FailingClients clients) : IHubContext<OrderHub>
{
    public IHubClients Clients => clients;
    public IGroupManager Groups => throw new NotSupportedException();
}

sealed class FailingClients : IHubClients, IClientProxy
{
    public int Attempts { get; private set; }
    public IClientProxy All => this;
    public IClientProxy AllExcept(IReadOnlyList<string> ids) => this;
    public IClientProxy Client(string id) => this;
    public IClientProxy Clients(IReadOnlyList<string> ids) => this;
    public IClientProxy Group(string name) => this;
    public IClientProxy GroupExcept(string name, IReadOnlyList<string> ids) => this;
    public IClientProxy Groups(IReadOnlyList<string> names) => this;
    public IClientProxy User(string id) => this;
    public IClientProxy Users(IReadOnlyList<string> ids) => this;
    public Task SendCoreAsync(string method, object?[] args, CancellationToken ct = default)
    {
        Attempts++;
        return ct.IsCancellationRequested ? Task.FromCanceled(ct) : Task.FromException(new IOException("Simulated disconnected transport."));
    }
}
