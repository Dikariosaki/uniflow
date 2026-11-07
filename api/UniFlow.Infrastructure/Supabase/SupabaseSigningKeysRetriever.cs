using Microsoft.Extensions.Configuration;
using UniFlow.Application.Abstractions;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;

namespace UniFlow.Infrastructure.Supabase;

// Fetch Supabase's public signing keys directly, with the standard refresh/cache manager.
// InternalUrl may differ from the public issuer when Auth runs outside the Compose network.
public sealed class SupabaseSigningKeysRetriever(string issuer) : IConfigurationRetriever<OpenIdConnectConfiguration>
{
    public async Task<OpenIdConnectConfiguration> GetConfigurationAsync(string address, IDocumentRetriever retriever, CancellationToken cancel)
    {
        var configuration = new OpenIdConnectConfiguration { Issuer = issuer, JwksUri = address };
        var keys = new JsonWebKeySet(await retriever.GetDocumentAsync(address, cancel));
        foreach (var key in keys.GetSigningKeys()) configuration.SigningKeys.Add(key);
        return configuration;
    }
}
