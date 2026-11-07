FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY UniFlow.Domain/UniFlow.Domain.csproj UniFlow.Domain/
COPY UniFlow.Application/UniFlow.Application.csproj UniFlow.Application/
COPY UniFlow.Infrastructure/UniFlow.Infrastructure.csproj UniFlow.Infrastructure/
COPY UniFlow.Api/UniFlow.Api.csproj UniFlow.Api/
RUN dotnet restore UniFlow.Api/UniFlow.Api.csproj
COPY . ./
RUN dotnet publish UniFlow.Api/UniFlow.Api.csproj -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app/publish ./
COPY UniFlow.Api/docker-entrypoint.sh /usr/local/bin/uniflow-entrypoint.sh
RUN chmod +x /usr/local/bin/uniflow-entrypoint.sh
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD curl -fsS "http://localhost:${PORT:-8080}/health" || exit 1
ENTRYPOINT ["/usr/local/bin/uniflow-entrypoint.sh"]
