using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using UniFlow.Application.Abstractions;

namespace UniFlow.Infrastructure.Supabase;

public sealed class SupabaseAdmin(HttpClient http, IConfiguration config, ILogger<SupabaseAdmin> logger) : IStaffIdentityAdmin
{
    public async Task<(string Id, string Email)> InviteAsync(string email, CancellationToken cancellationToken)
    {
        var baseUrl = (config["Supabase:InternalUrl"] ?? config["Supabase:Url"])?.TrimEnd('/');
        var key = config["Supabase:ServiceRoleKey"];
        var redirectTo = config["App:PublicUrl"]?.TrimEnd('/') + "/personal";
        if (string.IsNullOrWhiteSpace(baseUrl) || string.IsNullOrWhiteSpace(key))
        {
            logger.LogError("Staff invitation failed because the identity provider is not configured.");
            throw new InvalidOperationException("Staff invitation service is unavailable.");
        }

        using var request = new HttpRequestMessage(HttpMethod.Post, $"{baseUrl}/auth/v1/invite?redirect_to={Uri.EscapeDataString(redirectTo)}");
        request.Headers.Add("apikey", key);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", key);
        request.Content = JsonContent.Create(new { email });

        HttpResponseMessage response;
        try { response = await http.SendAsync(request, cancellationToken); }
        catch (HttpRequestException exception)
        {
            logger.LogError(exception, "Staff invitation provider could not be reached.");
            throw;
        }
        using (response)
        {
            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("Staff invitation provider rejected the request. Status={StatusCode}; ProviderCode={ProviderCode}",
                    (int)response.StatusCode, ProviderErrorCode(body));
                throw new InvalidOperationException("Staff invitation could not be sent.");
            }

            try
            {
                using var document = JsonDocument.Parse(body);
                var id = document.RootElement.GetProperty("id").GetString()
                    ?? throw new JsonException("Provider response did not contain a user identifier.");
                var returnedEmail = document.RootElement.TryGetProperty("email", out var value) ? value.GetString() ?? email : email;
                return (id, returnedEmail);
            }
            catch (JsonException exception)
            {
                logger.LogError(exception, "Staff invitation provider returned an invalid response.");
                throw new InvalidOperationException("Staff invitation provider returned an invalid response.");
            }
        }
    }

    public async Task<IReadOnlyDictionary<string, string>> GetEmailsByUserIdsAsync(IEnumerable<string> userIds, CancellationToken cancellationToken)
    {
        var remainingIds = new HashSet<string>(userIds, StringComparer.OrdinalIgnoreCase);
        var emails = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        if (remainingIds.Count == 0) return emails;

        var baseUrl = (config["Supabase:InternalUrl"] ?? config["Supabase:Url"])?.TrimEnd('/');
        var key = config["Supabase:ServiceRoleKey"];
        if (string.IsNullOrWhiteSpace(baseUrl) || string.IsNullOrWhiteSpace(key))
        {
            logger.LogError("Staff email lookup failed because the identity provider is not configured.");
            throw new InvalidOperationException("Staff email lookup is unavailable.");
        }

        const int pageSize = 1000;
        for (var page = 1; remainingIds.Count > 0 && page <= 1000; page++)
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, $"{baseUrl}/auth/v1/admin/users?page={page}&per_page={pageSize}");
            request.Headers.Add("apikey", key);
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", key);
            HttpResponseMessage response;
            try { response = await http.SendAsync(request, cancellationToken); }
            catch (HttpRequestException exception)
            {
                logger.LogError(exception, "Staff email lookup provider could not be reached.");
                throw;
            }

            using (response)
            {
                var body = await response.Content.ReadAsStringAsync(cancellationToken);
                if (!response.IsSuccessStatusCode)
                {
                    logger.LogWarning("Staff email lookup provider rejected the request. Status={StatusCode}; ProviderCode={ProviderCode}",
                        (int)response.StatusCode, ProviderErrorCode(body));
                    throw new InvalidOperationException("Staff email lookup could not be completed.");
                }

                try
                {
                    using var document = JsonDocument.Parse(body);
                    var users = document.RootElement.GetProperty("users");
                    if (users.ValueKind != JsonValueKind.Array)
                        throw new JsonException("Provider users response was not an array.");
                    foreach (var user in users.EnumerateArray())
                    {
                        if (!user.TryGetProperty("id", out var idValue) || idValue.ValueKind != JsonValueKind.String)
                            continue;
                        var id = idValue.GetString();
                        if (id is null || !remainingIds.Contains(id) || !user.TryGetProperty("email", out var emailValue) || emailValue.ValueKind != JsonValueKind.String)
                            continue;
                        var email = emailValue.GetString();
                        if (string.IsNullOrWhiteSpace(email)) continue;
                        emails[id] = email;
                        remainingIds.Remove(id);
                    }
                    if (users.GetArrayLength() < pageSize) break;
                }
                catch (JsonException exception)
                {
                    logger.LogError(exception, "Staff email lookup provider returned an invalid response.");
                    throw new InvalidOperationException("Staff email lookup returned an invalid response.");
                }
            }
        }
        return emails;
    }

    private static string ProviderErrorCode(string body)
    {
        try
        {
            using var document = JsonDocument.Parse(body);
            foreach (var name in new[] { "code", "error_code" })
                if (document.RootElement.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String)
                    return value.GetString() ?? "unspecified";
        }
        catch (JsonException) { }
        return "unspecified";
    }
}
