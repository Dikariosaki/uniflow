using Npgsql;

namespace UniFlow.Infrastructure.Persistence;

public static class PostgresConnectionString
{
    // Supabase Connect can supply either a PostgreSQL URI or an Npgsql string.
    // Never include the input in exceptions: it contains the database password.
    public static string Normalize(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            throw new InvalidOperationException("Configura SUPABASE_DB_CONNECTION con la conexión PostgreSQL de Supabase (directa o session pooler).");

        try
        {
            if (!value.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase)
                && !value.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
                return new NpgsqlConnectionStringBuilder(value).ConnectionString;

            var uri = new Uri(value, UriKind.Absolute);
            var credentials = uri.GetComponents(UriComponents.UserInfo, UriFormat.UriEscaped).Split(':', 2);
            var database = Uri.UnescapeDataString(uri.AbsolutePath.TrimStart('/'));
            if (string.IsNullOrWhiteSpace(uri.Host) || credentials.Length != 2 || string.IsNullOrEmpty(database))
                throw new FormatException();
            var connection = new NpgsqlConnectionStringBuilder
            {
                Host = uri.Host.Trim('[', ']'),
                Port = uri.Port > 0 ? uri.Port : 5432,
                Database = database,
                Username = Uri.UnescapeDataString(credentials[0]),
                Password = Uri.UnescapeDataString(credentials[1]),
                SslMode = SslMode.Require
            };
            foreach (var pair in uri.Query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries))
            {
                var parts = pair.Split('=', 2);
                if (parts.Length != 2) throw new FormatException();
                var key = Uri.UnescapeDataString(parts[0]).ToLowerInvariant() switch
                {
                    "sslmode" => "SSL Mode", "connect_timeout" => "Timeout",
                    "command_timeout" => "Command Timeout", "application_name" => "Application Name",
                    "search_path" => "Search Path", "trust_server_certificate" => "Trust Server Certificate",
                    var name => name
                };
                connection[key] = Uri.UnescapeDataString(parts[1]);
            }
            return connection.ConnectionString;
        }
        catch (Exception exception) when (exception is ArgumentException or FormatException or OverflowException)
        {
            throw new InvalidOperationException("SUPABASE_DB_CONNECTION no tiene un formato válido. Usa Host=...;Port=5432;Database=postgres;Username=...;Password=...;SSL Mode=Require o una URI postgres:// con caracteres especiales codificados.");
        }
    }
}
