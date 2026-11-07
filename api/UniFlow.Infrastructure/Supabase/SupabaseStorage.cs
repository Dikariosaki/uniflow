using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using UniFlow.Application.Abstractions;

namespace UniFlow.Infrastructure.Supabase;

public sealed class SupabaseStorage(HttpClient http, IConfiguration config, ILogger<SupabaseStorage> logger) : IProductImageStorage
{
    public async Task EnsureBucketAsync(CancellationToken cancellationToken)
    {
        var baseUrl = (config["Supabase:InternalUrl"] ?? config["Supabase:Url"])?.TrimEnd('/');
        var key = config["Supabase:ServiceRoleKey"];
        var bucket = config["Supabase:ProductBucket"] ?? "product-images";
        if (string.IsNullOrWhiteSpace(baseUrl) || string.IsNullOrWhiteSpace(key)) return;

        using var check = new HttpRequestMessage(HttpMethod.Get, $"{baseUrl}/storage/v1/bucket/{bucket}");
        AddCredentials(check, key);
        using var checkedResponse = await http.SendAsync(check, cancellationToken);
        if (checkedResponse.IsSuccessStatusCode)
        {
            using var existing = await JsonDocument.ParseAsync(await checkedResponse.Content.ReadAsStreamAsync(cancellationToken), cancellationToken: cancellationToken);
            if (!existing.RootElement.TryGetProperty("public", out var isPublic) || isPublic.ValueKind != JsonValueKind.True)
            {
                logger.LogCritical("Configured product image bucket is private. Bucket={Bucket}", bucket);
                throw new InvalidOperationException("Product image bucket must be public.");
            }
            using var update = new HttpRequestMessage(HttpMethod.Put, $"{baseUrl}/storage/v1/bucket/{bucket}")
            {
                Content = JsonContent.Create(new { @public = true, file_size_limit = 5_000_000, allowed_mime_types = new[] { "image/jpeg", "image/png", "image/webp" } })
            };
            AddCredentials(update, key);
            using var updated = await http.SendAsync(update, cancellationToken);
            if (!updated.IsSuccessStatusCode)
            {
                logger.LogError("Could not apply product image bucket settings. Status={StatusCode}; Bucket={Bucket}", (int)updated.StatusCode, bucket);
                throw new InvalidOperationException("Product image bucket settings could not be updated.");
            }
            return;
        }

        var errorBody = await checkedResponse.Content.ReadAsStringAsync(cancellationToken);
        var missing = checkedResponse.StatusCode == System.Net.HttpStatusCode.NotFound ||
            checkedResponse.StatusCode == System.Net.HttpStatusCode.BadRequest && ProviderErrorCode(errorBody) == "NoSuchBucket";
        if (!missing)
        {
            logger.LogError("Could not check product image bucket. Status={StatusCode}; ProviderCode={ProviderCode}; Bucket={Bucket}",
                (int)checkedResponse.StatusCode, ProviderErrorCode(errorBody), bucket);
            throw new InvalidOperationException("Product image bucket could not be checked.");
        }

        using var create = new HttpRequestMessage(HttpMethod.Post, $"{baseUrl}/storage/v1/bucket")
        {
            Content = JsonContent.Create(new { id = bucket, name = bucket, @public = true, file_size_limit = 5_000_000, allowed_mime_types = new[] { "image/jpeg", "image/png", "image/webp" } })
        };
        AddCredentials(create, key);
        using var created = await http.SendAsync(create, cancellationToken);
        if (!created.IsSuccessStatusCode && created.StatusCode != System.Net.HttpStatusCode.Conflict)
        {
            var body = await created.Content.ReadAsStringAsync(cancellationToken);
            logger.LogError("Could not create product image bucket. Status={StatusCode}; ProviderCode={ProviderCode}; Bucket={Bucket}",
                (int)created.StatusCode, ProviderErrorCode(body), bucket);
            throw new InvalidOperationException("Product image bucket could not be created.");
        }
    }

    public async Task<object> CreateUploadAsync(string path, string contentType, CancellationToken cancellationToken)
    {
        var baseUrl = (config["Supabase:InternalUrl"] ?? config["Supabase:Url"])?.TrimEnd('/');
        var key = config["Supabase:ServiceRoleKey"];
        var bucket = config["Supabase:ProductBucket"] ?? "product-images";
        if (string.IsNullOrWhiteSpace(baseUrl) || string.IsNullOrWhiteSpace(key))
        {
            logger.LogError("Product image storage is not configured.");
            throw new InvalidOperationException("Product image storage is unavailable.");
        }
        using var request = new HttpRequestMessage(HttpMethod.Post, $"{baseUrl}/storage/v1/object/upload/sign/{bucket}/{Uri.EscapeDataString(path)}");
        AddCredentials(request, key);
        request.Content = JsonContent.Create(new { upsert = true, contentType });
        using var response = await http.SendAsync(request, cancellationToken);
        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            logger.LogWarning("Product image upload link request failed. Status={StatusCode}; ProviderCode={ProviderCode}",
                (int)response.StatusCode, ProviderErrorCode(body));
            throw new InvalidOperationException("Product image upload link could not be created.");
        }
        using var document = JsonDocument.Parse(body);
        return new { path, upload = document.RootElement.Clone(), publicUrl = $"{config["Supabase:Url"]!.TrimEnd('/')}/storage/v1/object/public/{bucket}/{path}" };
    }

    public async Task<bool> ImageExistsAsync(string path, CancellationToken cancellationToken)
    {
        var baseUrl = (config["Supabase:InternalUrl"] ?? config["Supabase:Url"])?.TrimEnd('/');
        var bucket = config["Supabase:ProductBucket"] ?? "product-images";
        using var request = new HttpRequestMessage(HttpMethod.Head, $"{baseUrl}/storage/v1/object/public/{bucket}/{path}");
        using var response = await http.SendAsync(request, cancellationToken);
        return response.IsSuccessStatusCode && response.Content.Headers.ContentType?.MediaType is "image/jpeg" or "image/png" or "image/webp"
            && response.Content.Headers.ContentLength is > 0 and <= 5_000_000;
    }

    public string? PublicUrl(string? path)
    {
        if (string.IsNullOrWhiteSpace(path)) return null;
        if (Uri.TryCreate(path, UriKind.Absolute, out var uri)
            && (uri.Scheme == Uri.UriSchemeHttps || uri.Scheme == Uri.UriSchemeHttp))
            return uri.AbsoluteUri;
        if (string.IsNullOrWhiteSpace(config["Supabase:Url"])) return null;
        return $"{config["Supabase:Url"]!.TrimEnd('/')}/storage/v1/object/public/{config["Supabase:ProductBucket"] ?? "product-images"}/{path}";
    }

    private static void AddCredentials(HttpRequestMessage request, string key)
    {
        request.Headers.Add("apikey", key);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", key);
    }

    private static string ProviderErrorCode(string body)
    {
        try
        {
            using var document = JsonDocument.Parse(body);
            if (document.RootElement.TryGetProperty("code", out var code) && code.ValueKind == JsonValueKind.String)
                return code.GetString() ?? "unspecified";
        }
        catch (JsonException) { }
        return "unspecified";
    }
}
