# Graph Report - uniflow  (2026-11-07)

## Corpus Check
- 166 files · ~166,376 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1158 nodes · 2003 edges · 95 communities (79 shown, 16 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 96 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- UseCaseResult
- UniFlow.Api.Http
- UniFlow.Infrastructure.Persistence.Migrations
- verification/README.md
- dependencies
- CatalogAdminPage
- CustomerOrderHistoryStore
- fixtures.mjs
- SupabaseStorage
- EfRepository
- scripts
- UniFlow.Infrastructure
- OrderDetailDialog
- Order
- UniFlowDbContext
- StockReservations
- OperationsAdminStore
- DESIGN.md
- StaffSession
- EfApplicationStore
- CatalogAdminStore
- check-supabase-sql.mjs
- schematics
- FormDialogComponent
- feature-store.ts
- StockReservationCleanupService
- ApiDocumentation
- UniFlow MVP technical design
- AppShell
- build
- check-architecture.mjs
- app-shell.component.ts
- http
- app.config.ts
- DisplayFormats
- UniFlow MVP
- uniflow-web
- .TryHandleAsync
- Category
- ordering.store.ts
- UniFlow.Domain.Entities
- UniFlow.Application.Abstractions
- FailingClients
- IApplicationStore
- .GetConfigurationAsync
- options
- angular.json
- serve
- FeatureStore
- StaffOrdersStore
- .AddInfrastructure
- ProductStock
- Migration
- EnableRowLevelSecurity
- prepare.mjs
- @schematics/angular:component
- AGENTS.md
- web/docker-entrypoint.sh
- Despliegue de pruebas en Render
- ProductIntegrity
- OrderingStore
- TestHub
- AdminAuditEvents
- AuthService
- ApiService
- .GetMe
- .ToHttpResult
- .ResolveGroupAsync
- .InitializeAsync
- UniFlowDbContextModelSnapshot.cs
- UniFlow
- OrderLifecycle
- MenuPage
- UniFlow MVP implementation tasks
- OpeningHour
- development
- Preparar Supabase para UniFlow
- ReceiptPage
- UniFlow.Api/docker-entrypoint.sh
- history-page.component.ts
- UniFlow: aceptación del MVP
- CartPage
- CheckoutPage
- AdminAuditEvent
- PickupSlot
- StockReservation
- Arquitectura de UniFlow
- Verificación de aceptación de UniFlow
- UniFlow web
- .DisposeAsync

## God Nodes (most connected - your core abstractions)
1. `UseCaseResult` - 45 edges
2. `OrderingStore` - 36 edges
3. `IApplicationStore` - 30 edges
4. `EfApplicationStore` - 26 edges
5. `UniFlow.Domain.Entities` - 25 edges
6. `FeatureStore` - 25 edges
7. `StaffOrdersStore` - 23 edges
8. `UniFlow.Application.Abstractions` - 21 edges
9. `CatalogAdminStore` - 21 edges
10. `StaffSession` - 20 edges

## Surprising Connections (you probably didn't know these)
- `TestHub` --references--> `OrderHub`  [EXTRACTED]
  verification/backend-checks/Program.cs → api/UniFlow.Api/Realtime/OrderHub.cs
- `HttpCurrentUser` --implements--> `ICurrentUser`  [EXTRACTED]
  api/UniFlow.Api/Http/HttpCurrentUser.cs → api/UniFlow.Application/Abstractions/ExternalServices.cs
- `SignalROrderNotifier` --implements--> `IOrderNotifier`  [EXTRACTED]
  api/UniFlow.Api/Realtime/SignalROrderNotifier.cs → api/UniFlow.Application/Abstractions/ExternalServices.cs
- `EfApplicationStore` --references--> `IRepository`  [EXTRACTED]
  api/UniFlow.Infrastructure/Persistence/EfApplicationStore.cs → api/UniFlow.Application/Abstractions/Persistence.cs
- `EfRepository` --implements--> `IRepository`  [EXTRACTED]
  api/UniFlow.Infrastructure/Persistence/EfRepository.cs → api/UniFlow.Application/Abstractions/Persistence.cs

## Import Cycles
- None detected.

## Communities (95 total, 16 thin omitted)

### Community 0 - "UseCaseResult"
Cohesion: 0.05
Nodes (61): IEndpointRouteBuilder, IEndpointRouteBuilder, IEndpointRouteBuilder, IEndpointRouteBuilder, IEndpointRouteBuilder, IEndpointRouteBuilder, StaffAdministrationEndpoints, IEndpointRouteBuilder (+53 more)

### Community 1 - "UniFlow.Api.Http"
Cohesion: 0.16
Nodes (9): CatalogAdministrationEndpoints, CatalogEndpoints, OperationsAdministrationEndpoints, OrderingEndpoints, ReportingEndpoints, StaffOrderEndpoints, HttpCurrentUser, UniFlow.Api.Http (+1 more)

### Community 2 - "UniFlow.Infrastructure.Persistence.Migrations"
Cohesion: 0.28
Nodes (4): MigrationBuilder, ModelBuilder, CapacityRelease, UniFlow.Infrastructure.Persistence.Migrations

### Community 4 - "dependencies"
Cohesion: 0.05
Nodes (42): @angular/build, @angular/cli, @angular/common, @angular/compiler, @angular/compiler-cli, @angular/core, @angular/forms, @angular/platform-browser (+34 more)

### Community 6 - "CustomerOrderHistoryStore"
Cohesion: 0.18
Nodes (4): CustomerOrderHistoryStore, Injectable, CustomerOrdersPage, Component

### Community 7 - "fixtures.mjs"
Cohesion: 0.11
Nodes (24): api(), appOrigin, auth(), base, createOrder(), displayIds, initialize(), orderBody() (+16 more)

### Community 8 - "SupabaseStorage"
Cohesion: 0.08
Nodes (21): CancellationToken, Email, Guid, Id, IEnumerable, IReadOnlyDictionary, Task, IOrderNotifier (+13 more)

### Community 9 - "EfRepository"
Cohesion: 0.10
Nodes (15): CancellationToken, Expression, IEnumerable, IQueryable, Task, ValueTask, EfRepository, QueryExecutor (+7 more)

### Community 10 - "scripts"
Cohesion: 0.09
Nodes (22): @axe-core/playwright, pg, @playwright/test, supabase, devDependencies, @axe-core/playwright, @microsoft/signalr, pg (+14 more)

### Community 11 - "UniFlow.Infrastructure"
Cohesion: 0.11
Nodes (20): net10.0, UniFlow.Application, net10.0, Microsoft.NET.Sdk, UniFlow.Domain, net10.0, Microsoft.NET.Sdk, UniFlow.Infrastructure (+12 more)

### Community 12 - "OrderDetailDialog"
Cohesion: 0.14
Nodes (7): ViewChild, OrderDetailDialog, Component, Input, Output, QueuePage, Component

### Community 13 - "Order"
Cohesion: 0.17
Nodes (9): DateTimeOffset, Guid, List, Order, DateTimeOffset, Guid, OrderEvent, Guid (+1 more)

### Community 14 - "UniFlowDbContext"
Cohesion: 0.15
Nodes (9): BusinessSettings, DateTimeOffset, StaffRole, ModelBuilder, UniFlowDbContext, UniFlowDbContextFactory, DbContext, DbSet (+1 more)

### Community 15 - "StockReservations"
Cohesion: 0.29
Nodes (3): MigrationBuilder, ModelBuilder, StockReservations

### Community 16 - "OperationsAdminStore"
Cohesion: 0.10
Nodes (5): OperationsAdminStore, Injectable, OperationsAdminPage, Component, Slot

### Community 17 - "DESIGN.md"
Cohesion: 0.11
Nodes (18): Bento Cards, Brand & Style, Buttons, Colors, Components, Design Movement & Aesthetic, Elevation & Depth, Elevation Levels (+10 more)

### Community 18 - "StaffSession"
Cohesion: 0.08
Nodes (9): ClientErrorLogger, StaffSession, Injectable, LoginPage, Component, TrackingStore, Injectable, TrackingPage (+1 more)

### Community 19 - "EfApplicationStore"
Cohesion: 0.28
Nodes (5): CancellationToken, Guid, Task, EfApplicationStore, Transaction

### Community 20 - "CatalogAdminStore"
Cohesion: 0.14
Nodes (8): CatalogAdminStore, convertProductImageToWebp(), ProductImageConversionError, Injectable, FormDialogConfig, FormDialogField, Category, Product

### Community 21 - "check-supabase-sql.mjs"
Cohesion: 0.12
Nodes (11): config, connection, control, evidence, fresh, headers, root, scripts (+3 more)

### Community 22 - "schematics"
Cohesion: 0.13
Nodes (15): skipTests, skipTests, skipTests, skipTests, skipTests, skipTests, skipTests, @schematics/angular:class (+7 more)

### Community 23 - "FormDialogComponent"
Cohesion: 0.22
Nodes (5): FormDialogComponent, Component, HostListener, Input, Output

### Community 24 - "feature-store.ts"
Cohesion: 0.26
Nodes (5): runtimeConfig, Window, OrderConfirmation, SavedCustomerOrder, Order

### Community 25 - "StockReservationCleanupService"
Cohesion: 0.33
Nodes (4): CancellationToken, Task, StockReservationCleanupService, BackgroundService

### Community 26 - "ApiDocumentation"
Cohesion: 0.17
Nodes (8): IServiceCollection, ApiDocumentation, OperationDocumentation, UniFlow.Api.OpenApi, IOperationFilter, OpenApiOperation, OperationFilterContext, WebApplication

### Community 27 - "UniFlow MVP technical design"
Cohesion: 0.17
Nodes (11): Applications and boundaries, Architecture refinement, Configuration and operations, Domain and persistence, HTTP and real-time interfaces, PWA and visual behavior, Reproducible acceptance environment, Security and privacy (+3 more)

### Community 28 - "AppShell"
Cohesion: 0.13
Nodes (4): appConfig, AppShell, Component, HostListener

### Community 29 - "build"
Cohesion: 0.22
Nodes (9): build, builder, configurations, defaultConfiguration, production, budgets, buildTarget, outputHashing (+1 more)

### Community 30 - "check-architecture.mjs"
Cohesion: 0.18
Nodes (7): expected, failures, featureDirectories, references, result, root, routes

### Community 31 - "app-shell.component.ts"
Cohesion: 0.19
Nodes (6): ConnectivityService, Injectable, PAGE_PATHS, pageFromUrl(), Injectable, UiState

### Community 32 - "http"
Cohesion: 0.20
Nodes (9): ASPNETCORE_ENVIRONMENT, applicationUrl, commandName, dotnetRunMessages, environmentVariables, launchBrowser, profiles, http (+1 more)

### Community 33 - "app.config.ts"
Cohesion: 0.23
Nodes (5): routes, authInterceptor(), ClientGlobalErrorHandler, Injectable, staffGuard()

### Community 34 - "DisplayFormats"
Cohesion: 0.15
Nodes (5): ProductCard, Component, Input, Output, DisplayFormats

### Community 35 - "UniFlow MVP"
Cohesion: 0.22
Nodes (8): Acceptance criteria, Capabilities, Decisions carried into this change, Out of scope, Risks, UniFlow MVP, What changes, Why

### Community 36 - "uniflow-web"
Cohesion: 0.40
Nodes (5): uniflow-web, prefix, projectType, root, sourceRoot

### Community 37 - ".TryHandleAsync"
Cohesion: 0.25
Nodes (6): CancellationToken, Exception, HttpContext, ValueTask, ApiExceptionHandler, IExceptionHandler

### Community 38 - "Category"
Cohesion: 0.25
Nodes (6): Guid, List, Category, DateTimeOffset, Guid, Product

### Community 39 - "ordering.store.ts"
Cohesion: 0.29
Nodes (3): CartSummary, Component, CartLine

### Community 40 - "UniFlow.Domain.Entities"
Cohesion: 0.46
Nodes (5): UniFlow.Domain.Orders, UniFlow.Application.Contracts, UniFlow.Application.Common, UniFlow.Domain.Entities, UniFlow.Application.Features

### Community 41 - "UniFlow.Application.Abstractions"
Cohesion: 0.27
Nodes (4): UniFlow.Infrastructure, UniFlow.Infrastructure.Persistence, UniFlow.Application.Abstractions, UniFlow.Infrastructure.Supabase

### Community 42 - "FailingClients"
Cohesion: 0.27
Nodes (5): IClientProxy, IReadOnlyList, CancellationToken, Task, FailingClients

### Community 43 - "IApplicationStore"
Cohesion: 0.10
Nodes (18): CancellationToken, Expression, Guid, IEnumerable, List, Task, ValueTask, IApplicationStore (+10 more)

### Community 44 - ".GetConfigurationAsync"
Cohesion: 0.33
Nodes (6): CancellationToken, Task, SupabaseSigningKeysRetriever, IConfigurationRetriever, IDocumentRetriever, OpenIdConnectConfiguration

### Community 45 - "options"
Cohesion: 0.29
Nodes (7): src/styles.scss, options, assets, browser, inlineStyleLanguage, styles, tsConfig

### Community 46 - "angular.json"
Cohesion: 0.29
Nodes (6): cli, packageManager, newProjectRoot, projects, $schema, version

### Community 47 - "serve"
Cohesion: 0.33
Nodes (6): serve, proxyConfig, builder, configurations, defaultConfiguration, options

### Community 48 - "FeatureStore"
Cohesion: 0.11
Nodes (3): FeatureStore, CatalogStore, Injectable

### Community 50 - ".AddInfrastructure"
Cohesion: 0.29
Nodes (4): IServiceCollection, DependencyInjection, PostgresConnectionString, IConfiguration

### Community 51 - "ProductStock"
Cohesion: 0.29
Nodes (3): MigrationBuilder, ModelBuilder, ProductStock

### Community 52 - "Migration"
Cohesion: 0.25
Nodes (4): MigrationBuilder, ModelBuilder, InitialCreate, Migration

### Community 53 - "EnableRowLevelSecurity"
Cohesion: 0.29
Nodes (3): MigrationBuilder, ModelBuilder, EnableRowLevelSecurity

### Community 54 - "prepare.mjs"
Cohesion: 0.50
Nodes (3): cli, root, state

### Community 55 - "@schematics/angular:component"
Cohesion: 0.67
Nodes (3): skipTests, style, @schematics/angular:component

### Community 63 - "Despliegue de pruebas en Render"
Cohesion: 0.33
Nodes (5): Antes de desplegar, Crear los servicios, Despliegue de pruebas en Render, Notas de prueba, Terminar Auth y comprobar

### Community 64 - "ProductIntegrity"
Cohesion: 0.29
Nodes (3): MigrationBuilder, ModelBuilder, ProductIntegrity

### Community 66 - "TestHub"
Cohesion: 0.12
Nodes (12): Task, OrderHub, CancellationToken, Guid, Task, SignalROrderNotifier, UniFlow.Api.Realtime, Hub (+4 more)

### Community 67 - "AdminAuditEvents"
Cohesion: 0.29
Nodes (3): MigrationBuilder, ModelBuilder, AdminAuditEvents

### Community 70 - ".GetMe"
Cohesion: 0.25
Nodes (5): IEndpointRouteBuilder, StaffAccessEndpoints, CancellationToken, Task, StaffAccessUseCases

### Community 71 - ".ToHttpResult"
Cohesion: 0.40
Nodes (3): HttpContext, UseCaseResultExtensions, IResult

### Community 72 - ".ResolveGroupAsync"
Cohesion: 0.40
Nodes (3): CancellationToken, Task, OrderSubscriptions

### Community 73 - ".InitializeAsync"
Cohesion: 0.60
Nodes (3): CancellationToken, Task, DatabaseInitializer

### Community 74 - "UniFlowDbContextModelSnapshot.cs"
Cohesion: 0.40
Nodes (3): ModelBuilder, UniFlowDbContextModelSnapshot, ModelSnapshot

### Community 75 - "UniFlow"
Cohesion: 0.22
Nodes (9): Acceptance verification, Deploy test environment on Render, First administrator, Operating the MVP, Project layout, Start locally, Supabase setup and security, Swagger and Docker troubleshooting (+1 more)

### Community 78 - "UniFlow MVP implementation tasks"
Cohesion: 0.29
Nodes (7): 1. Repository and local runtime, 2. Supabase persistence and identity, 3. Public ordering, 4. Staff operation and administration, 5. Finish and acceptance, 6. Architecture refactor, UniFlow MVP implementation tasks

### Community 79 - "OpeningHour"
Cohesion: 0.40
Nodes (4): DateOnly, Guid, OpeningHour, TimeOnly

### Community 80 - "development"
Cohesion: 0.40
Nodes (5): development, buildTarget, extractLicenses, optimization, sourceMap

### Community 81 - "Preparar Supabase para UniFlow"
Cohesion: 0.33
Nodes (5): 1. Instalar el esquema y Storage, 2. Crear el primer administrador, 3. Verificar y conectar la aplicación, Mantener el esquema, Preparar Supabase para UniFlow

### Community 85 - "UniFlow: aceptación del MVP"
Cohesion: 0.40
Nodes (5): Arquitectura comprobada, Despliegue alojado, Escenarios, Evidencia, UniFlow: aceptación del MVP

### Community 88 - "AdminAuditEvent"
Cohesion: 0.50
Nodes (3): DateTimeOffset, Guid, AdminAuditEvent

### Community 89 - "PickupSlot"
Cohesion: 0.50
Nodes (3): DateTimeOffset, Guid, PickupSlot

### Community 90 - "StockReservation"
Cohesion: 0.50
Nodes (3): DateTimeOffset, Guid, StockReservation

### Community 91 - "Arquitectura de UniFlow"
Cohesion: 0.50
Nodes (4): Arquitectura de UniFlow, Backend: Clean Architecture, Comprobación de límites y regresiones, Frontend: ramas por funcionalidad

### Community 92 - "Verificación de aceptación de UniFlow"
Cohesion: 0.50
Nodes (4): Detener el entorno, Ejecutar desde la raíz del repositorio, Evidencia y alcance, Verificación de aceptación de UniFlow

### Community 93 - "UniFlow web"
Cohesion: 0.50
Nodes (4): Compilación y despliegue, Desarrollo, UniFlow web, Verificación

## Knowledge Gaps
- **203 isolated node(s):** `$schema`, `commandName`, `dotnetRunMessages`, `launchBrowser`, `applicationUrl` (+198 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `UniFlow.Infrastructure.Persistence` connect `UniFlow.Application.Abstractions` to `ProductIntegrity`, `UniFlow.Infrastructure.Persistence.Migrations`, `AdminAuditEvents`, `TestHub`, `UniFlowDbContextModelSnapshot.cs`, `UniFlowDbContext`, `StockReservations`, `.AddInfrastructure`, `ProductStock`, `Migration`, `EnableRowLevelSecurity`, `StockReservationCleanupService`?**
  _High betweenness centrality (0.078) - this node is a cross-community bridge._
- **Why does `IApplicationStore` connect `IApplicationStore` to `UseCaseResult`, `Category`, `Order`, `UniFlowDbContext`, `OpeningHour`, `EfApplicationStore`, `AdminAuditEvent`, `PickupSlot`, `StockReservation`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **Why does `UniFlow.Application.Abstractions` connect `UniFlow.Application.Abstractions` to `UniFlow.Api.Http`, `TestHub`, `SupabaseStorage`, `UniFlow.Domain.Entities`, `.ResolveGroupAsync`, `IApplicationStore`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **What connects `$schema`, `commandName`, `dotnetRunMessages` to the rest of the system?**
  _203 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `UseCaseResult` be split into smaller, more focused modules?**
  _Cohesion score 0.053361344537815124 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.046511627906976744 - nodes in this community are weakly interconnected._
- **Should `fixtures.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.11182795698924732 - nodes in this community are weakly interconnected._