using Microsoft.AspNetCore.Authorization;
using Microsoft.OpenApi;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace UniFlow.Api.OpenApi;

public static class ApiDocumentation
{
    public static IServiceCollection AddApiDocumentation(this IServiceCollection services)
    {
        services.AddEndpointsApiExplorer();
        services.AddSwaggerGen(options =>
        {
            options.SwaggerDoc("v1", new OpenApiInfo
            {
                Title = "UniFlow API", Version = "v1",
                Description = "Pedidos y operación de la cafetería. Usa un access_token de Supabase Auth en Authorize para las rutas del personal. Confirmar pedidos requiere Idempotency-Key."
            });
            options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
            {
                Type = SecuritySchemeType.Http, Scheme = "bearer", BearerFormat = "JWT",
                Description = "Access token de Supabase Auth. Pega únicamente el token, sin el prefijo Bearer."
            });
            options.TagActionsBy(description => [description.RelativePath switch
            {
                var path when path?.StartsWith("api/v1/admin/staff") == true => "Administración de personal",
                var path when path?.StartsWith("api/v1/admin/products") == true || path?.StartsWith("api/v1/admin/categories") == true => "Administración de catálogo",
                var path when path?.StartsWith("api/v1/admin") == true => "Horarios, cupos y reportes",
                var path when path?.StartsWith("api/v1/staff") == true => "Operación del personal",
                var path when path?.StartsWith("api/v1/orders") == true => "Pedidos y seguimiento",
                var path when path?.EndsWith("health") == true => "Salud del servicio",
                _ => "Catálogo y disponibilidad"
            }]);
            options.OperationFilter<OperationDocumentation>();
        });
        return services;
    }

    public static void UseApiDocumentation(this WebApplication app)
    {
        if (!app.Configuration.GetValue("Swagger:Enabled", true)) return;
        app.UseSwagger();
        app.UseSwaggerUI(options =>
        {
            options.SwaggerEndpoint("./v1/swagger.json", "UniFlow API v1");
            options.DocumentTitle = "UniFlow · Swagger";
            options.EnableTryItOutByDefault();
        });
    }

    private sealed class OperationDocumentation : IOperationFilter
    {
        public void Apply(OpenApiOperation operation, OperationFilterContext context)
        {
            var metadata = context.ApiDescription.ActionDescriptor.EndpointMetadata;
            if (metadata.OfType<IAuthorizeData>().Any() && !metadata.OfType<IAllowAnonymous>().Any())
                operation.Security = [new OpenApiSecurityRequirement { [new OpenApiSecuritySchemeReference("Bearer", context.Document)] = [] }];
            if (context.ApiDescription.HttpMethod == "POST" && context.ApiDescription.RelativePath == "api/v1/orders")
            {
                operation.Parameters ??= [];
                operation.Parameters.Add(new OpenApiParameter
                {
                    Name = "Idempotency-Key", In = ParameterLocation.Header, Required = true,
                    Description = "UUID nuevo por pedido. Reutilízalo solo al reintentar la misma confirmación.",
                    Schema = new OpenApiSchema { Type = JsonSchemaType.String, MaxLength = 128 }
                });
            }
        }
    }
}
