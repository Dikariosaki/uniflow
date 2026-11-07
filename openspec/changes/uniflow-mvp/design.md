# UniFlow MVP technical design

## System shape

```text
Mobile/desktop browser (Angular PWA)
  ├── HTTPS REST /api/v1 ──> ASP.NET Core API ──> Supabase PostgreSQL
  ├── SignalR /hubs/orders <── ASP.NET Core API
  └── signed photo upload ──> Supabase Storage

Staff sign-in: Angular Supabase Auth client -> Supabase Auth -> bearer JWT -> API
```

The Angular client uses the REST API for application data. It never receives the Supabase service-role key or a database connection string. The API verifies Supabase access tokens and resolves staff roles from application-owned role records. The API broadcasts order changes over SignalR; the browser falls back to periodic REST refresh. Product image reads use the public bucket URL, while an authenticated administrator requests a signed upload URL from the API and uploads directly to Storage. The server stores only a tracking-token hash; retrying a committed idempotent request rotates the tracking token and returns the existing order.

Local development and deployment use separate containers for the Angular static site (served by Nginx) and ASP.NET Core API. Supabase is hosted externally and configured through environment variables. A health endpoint reports API health without exposing secrets.

## Applications and boundaries

### Architecture refinement

The backend is separated into `UniFlow.Domain`, `UniFlow.Application`, `UniFlow.Infrastructure`, and `UniFlow.Api` within `api/UniFlow.sln`. Domain has no project dependencies; Application references Domain; Infrastructure implements Application ports and references Domain; API composes Application and Infrastructure. HTTP endpoints delegate use cases and map outcome kinds to HTTP results. EF queries, transaction/row/advisory locks, migrations, database initialization, and Supabase adapters belong to Infrastructure. Application contains no ASP.NET, EF Core, Supabase SDK, or SQL dependencies. Existing migration identifiers and HTTP contracts are preserved.

Angular uses feature branches under `features/`: access, catalog, ordering, tracking, staff-orders, catalog-admin, and operations-admin. Each owns its pages and state/data access. Ten standalone pages use lazy routing. Core supplies platform services, Shared supplies common contracts/presentation, and Layout contains navigation and the application shell. Features use public entry points when collaborating and do not depend on Layout. Cart and checkout have explicit `/pedido` and `/recogida` routes; existing tracking and staff links are preserved. See the root `ARCHITECTURE.md` for responsibilities, dependency rules and tooling.

- **Web**: Angular standalone components and routes for public menu, cart/checkout, receipt/tracking, staff sign-in, order queue/history, catalog, schedules/capacity, and reports. Shared components implement the supplied Bento visual system and accessible state labels.
- **API**: ASP.NET Core REST API under `/api/v1`; domain logic and authorization live server-side. SignalR hub `/hubs/orders` sends authorized role-scoped updates. Use Problem Details and explicit validation/business conflict responses.
- **Persistence**: PostgreSQL via EF Core and Npgsql. API migrations own the application schema. Use database constraints and transactions for idempotency and slot capacity.
- **Identity**: Supabase Auth issues staff JWTs. A `staff_roles` table maps Auth user IDs to `operator` or `administrator`; role changes are administrator-only and audit logged. The first administrator is provisioned using a documented one-time bootstrap path, never a public signup endpoint.
- **Images**: Supabase bucket `product-images`, public reads, administrator-only signed upload creation. Persist object path, not client-supplied arbitrary URLs. Validate image MIME type and maximum size in the API before signing.

## Domain and persistence

- `categories`: id, name, display order, active flag.
- `products`: id, category ID, name, description, integer `price_cop`, image object path, available flag, active flag, timestamps.
- `business_settings`: single cafeteria name, IANA timezone, order pause flag, and operational settings.
- `opening_hours`: weekday schedule and dated exceptions/closures.
- `pickup_slots`: local operating interval represented with UTC start/end, configurable capacity, active/closed state, and concurrency-safe reservation count derived from active orders.
- `orders`: UUID, public short pickup code, unique tracking-token hash, idempotency key/scope, pickup mode, slot ID, lifecycle status, customer alias/phone, integer total, informational payment status, timestamps.
- `order_items`: product reference plus immutable product-name, unit-price, quantity, and subtotal snapshots.
- `order_events`: order ID, previous/new status, actor, reason, timestamp, and relevant audit metadata.
- `admin_audit_events`: actor, action, entity type/ID, compact change details, and timestamp for catalog, schedule, capacity, settings, and staff-role changes.
- `staff_roles`: Supabase Auth UUID, role, active flag, creation/update metadata.

Store money as integer COP pesos. Store timestamps as UTC `timestamptz`; render them in `America/Bogota`. Do not store raw tracking tokens; return the token once at creation and compare its hash on tracking requests. Codes are for pickup and are not authorization credentials.

Order creation runs in one database transaction: enforce the idempotency key, lock/check the target slot, load current active/available product prices, recalculate totals, verify opening/pause rules, reserve one order of capacity, insert order and snapshots, and write the initial event. On conflict, return a stable `409` response with current alternatives. `when-ready` selects the earliest open slot that meets minimum notice and has remaining capacity. Cancellation is staff-only and records a reason; configured policy determines whether its reservation is released, with MVP default to release only before preparation.

## HTTP and real-time interfaces

Public:

- `GET /api/v1/catalog/categories`
- `GET /api/v1/catalog/products`
- `GET /api/v1/pickup-slots?date=YYYY-MM-DD`
- `POST /api/v1/orders` with `Idempotency-Key`; request contains item IDs/quantities, pickup choice, alias, and phone, never trusted prices.
- `POST /api/v1/orders/track` with the tracking token in the JSON body so it is not written to access-log URLs.

Authenticated staff:

- `GET /api/v1/staff/orders` with status/date/slot filters and pagination; `GET /api/v1/staff/orders/{id}`
- `PATCH /api/v1/staff/orders/{id}/status` with target status and reason where required
- `POST /api/v1/staff/orders/{id}/deliver` with pickup code
- `GET/POST /api/v1/admin/categories` and `/api/v1/admin/products`; `PUT /api/v1/admin/categories/{id}` and `/api/v1/admin/products/{id}` replace editable fields.
- `POST /api/v1/admin/products/{id}/image-upload` to create a signed upload
- `POST /api/v1/admin/products/{id}/image` attaches an uploaded object after server validation; issuing an upload URL preserves the existing product photo.
- `GET/PUT /api/v1/admin/schedule`; `PUT /api/v1/admin/settings`; `GET/POST /api/v1/admin/pickup-slots`; `PUT /api/v1/admin/pickup-slots/{id}`.
- `GET /api/v1/admin/reports/daily`; `GET /api/v1/admin/reports/orders.csv`; `GET /api/v1/admin/audit`
- `POST /api/v1/admin/staff/invitations` for administrator-managed Supabase Auth invites

The SignalR hub publishes order-created and order-updated events only to authorized staff groups and the matching tracking-token connection. Customers join with a tracking-token header over long polling; staff use long polling with the Supabase JWT in the Authorization header, keeping credentials out of access-log URLs. Do not publish customer phone, token, or other private data in broadcasts. All state changes also remain retrievable by REST. Public order and tracking endpoints are rate limited per client address, with a configurable default of 30 requests/minute. Nginx replaces incoming forwarded client-address headers.

Use `400` for malformed input, `401/403` for identity/permission failures, `404` for missing resources, `409` for capacity/idempotency/state conflicts, `422` for business validation, and `5xx` for unexpected failures. Paginate staff lists and never expose token hashes.

## Security and privacy

- Validate JWT issuer, audience, signature, expiry, and role on every protected request.
- Keep database password, Supabase service-role key, and Auth admin credentials in server-side environment secrets only.
- Restrict CORS to configured web origins; use HTTPS in deployed environments.
- Validate lengths, quantities, price bounds, image content type/size, and all state transitions server-side.
- Rate-limit public order and token lookup endpoints. Use random high-entropy tracking tokens and store only hashes.
- Collect only alias and phone for pickup, show a privacy notice, and configure retention before production pilot.
- Keep secrets and unnecessary personal data out of logs, errors, analytics, and SignalR events.

## PWA and visual behavior

Use the provided Campus Bento Modern colors, Plus Jakarta Sans typography, rounded cards, indigo primary actions, and distinct state chips. Rebuild the designs as Angular components rather than shipping the reference HTML, which depends on Tailwind CDN scripts and static placeholder data. At narrow widths use a single-column menu and thumb-sized actions; staff dashboards collapse navigation and columns into stacked cards. Meet keyboard navigation, visible focus, semantic headings, and WCAG 2.2 AA contrast goals.

Cache only the app shell and static assets. Do not cache authoritative prices, availability, slots, or order data. An offline indicator disables checkout and explains the connection requirement. On reconnection refresh catalog and slots before enabling confirmation.

## Configuration and operations

Required API configuration includes `ConnectionStrings__Supabase`, `Supabase__Url`, `Supabase__AnonKey`, `Supabase__ServiceRoleKey`, `Supabase__JwtAudience`, `Supabase__ProductBucket`, `AllowedOrigins`, and `ASPNETCORE_URLS`. The web build receives only the public Supabase URL/anon key and API base URL. Supply `.env.example` with placeholders only. Provide Docker Compose health checks and document first-admin provisioning, applying EF migrations, creating the storage bucket/policies, and connecting a Supabase project.

## Verification scenarios

- Two simultaneous submissions contend for the last slot capacity; only one is created.
- Repeating the same idempotency key returns the existing order; a different key cannot exceed capacity.
- A price or availability change between menu load and submit is reflected or rejected before confirmation.
- Closed/paused schedules and exhausted slots reject orders with useful alternatives.
- Alias/phone, order snapshots, timestamps, and audit events persist; public tracking requires the secret token.
- Invalid role or state transition is rejected; authorized delivery records actor and time.
- Image upload URL requires administrator role and the object is rendered through its public URL.
- Offline state blocks order submit; reconnection refreshes current catalog and slots.
- Docker Compose starts web/API and the API can connect when Supabase configuration is supplied.

## Reproducible acceptance environment

`verification/` contains Playwright/axe acceptance scenarios and an isolated real Supabase CLI project. PostgreSQL/Auth/Storage are external to the application's two Compose services and are configured through the same environment boundary used for a hosted project. A development-only Compose override permits local HTTP JWKS and a larger public-request limit for the suite. No hosted account or credentials are required to repeat this verification.

The suite checks the public and staff browser flows, concurrent reservation/idempotency/status transitions, immutable snapshots, closed/paused operations, JWT claims and roles, private REST/SignalR scopes, protected image upload, first configuration on an empty settings table, pagination/reports/audit, offline confirmation blocking, refresh failure on reconnection, PWA installability, and responsive/keyboard/axe states. Results and checked source hashes are recorded in `verification/evidence.json` and summarized in `verification/acceptance-report.md`. Hosted credentials, real operational settings, institutional privacy/retention choices, and email/domain setup remain deployment configuration as described in the root README.
