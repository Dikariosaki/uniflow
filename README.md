# UniFlow

UniFlow is an order-ahead and pickup application for the cafeteria at Universidad Libre, Bosque Popular. The repository contains an Angular PWA, an ASP.NET Core API, EF Core migrations for Supabase PostgreSQL, and a Docker Compose deployment for the web and API containers.

## Start locally

1. Create a Supabase project and copy `.env.backend.example` to `.env.backend` and `.env.frontend.example` to `.env.frontend`.
2. Put the database connection and service-role key only in `.env.backend`. Put the Supabase URL and public anon key in both files. The frontend file must never contain database credentials or the service-role key.
3. In `.env.backend`, set `Database__MigrateOnStartup=true` for the first start if you want the API to apply the checked-in EF migrations. Set it back to `false` after initialization. The API can also create the `uniflow-images` bucket when the service-role key is configured.
4. Run `docker compose up --build`; open <http://localhost:8080>.

Compose loads `.env.backend` into the API container and `.env.frontend` into the Angular/Nginx container. The database password and service-role key are passed only to the API. Do not commit either local file or publish the service-role key.

## Deploy test environment on Render

The [Render deployment guide](RENDER.md) explains how to create two separate Free Web Services manually. Add the backend variables to the API service and only public frontend variables to the web service. No custom domain is required.

## Swagger and Docker troubleshooting

With Compose running, open Swagger at <http://localhost:8081/swagger/> (API directly) or <http://localhost:8080/swagger/> (through the web proxy). Set `Swagger__Enabled=false` in `.env.backend` to disable the documentation. The OpenAPI document is `/swagger/v1/swagger.json`. Swagger's **Authorize** accepts a Supabase Auth access token; roles are still checked by the API. `POST /api/v1/orders` also requires an `Idempotency-Key` header, shown in Swagger. Reuse that key only for retries of the same order.

Building an image does not start its container: use `docker compose up --build -d`. Check `docker compose ps` and `docker compose logs --tail=80 api`. Compose waits for the API's PostgreSQL readiness check before starting the web container. A running but unhealthy API usually indicates a database connection problem; the API is still reachable directly on port 8081 for Swagger and health diagnostics. `/health` and `/api/v1/health` return 503 until PostgreSQL is reachable. Health logs report error types/codes without printing connection credentials.

`ConnectionStrings__Supabase` in `.env.backend` accepts an Npgsql string (`Host=...;Port=5432;Database=postgres;Username=...;Password=...;SSL Mode=Require`) or a PostgreSQL URI. Use the exact **Connect** values from your Supabase project. When the deployment has no IPv6 route to the direct database, select **Session pooler** and use its host, port, and username. Keep real credentials in `.env.backend` and apply the SQL/migrations before placing orders.

The checkout now shows API validation messages (closed cafeteria, paused orders, full slots, unavailable products) and connection/service failures while preserving the cart. A realtime notification failure after a database commit does not turn the persisted order into a failed confirmation; tracking retains its polling fallback.

For development without Docker, run the API with `dotnet run --project api/UniFlow.Api`, then run Angular with `cd web && npm start`. Angular proxies `/api` and `/hubs` to the default API development port (`5269`). Configure `public/config.js` and API user secrets/environment variables. The API does not simulate menu data or accepted orders when Supabase is unavailable.

For an isolated Supabase development project, set `Development__SeedDemoData=true` for the API while using the Development environment. This explicitly inserts fictional menu items, hours, and five-order demo slots. Never enable it against production data.

## First administrator

For manual setup through the Supabase SQL Editor, follow [the complete SQL setup guide](supabase/README.md). It includes the schema, Storage, security, administrator bootstrap, and verification queries.

There is intentionally no public staff-registration flow. Create the first staff user in Supabase Auth (or invite the first administrator from the Supabase dashboard), then run the SQL below in the Supabase SQL editor, replacing the email:

```sql
insert into public.staff_roles ("UserId", "Role", "Active", "CreatedAt")
select id::text, 'administrator', true, now()
from auth.users
where lower(email) = lower('admin@example.org')
on conflict ("UserId") do update
set "Role" = 'administrator', "Active" = true;
```

After this bootstrap, administrators can invite operators and administrators from **Reportes y cupos → Invitar personal**. Set `APP_PUBLIC_URL` to the deployed UniFlow origin and allow the resulting `/personal` URL in Supabase Auth's redirect URL allowlist. Configure email delivery before sending invitations.

## Supabase setup and security

- EF migrations create the application tables in `public` and enable row level security without public policies. The API uses its server-side PostgreSQL connection; the browser talks to application endpoints instead of querying tables directly.
- The API uses Supabase Auth JWTs and the `staff_roles` mapping table to authorize staff actions. Invite and Storage administration use the service-role key only on the API.
- Configure an active asymmetric Auth signing key (ES256 or RS256). The API validates issuer, audience, expiry and signature against Supabase's cached public JWKS. See [Supabase signing keys](https://supabase.com/docs/guides/auth/signing-keys).
- The product image bucket is created as public for reads when the API starts with the service-role key. Upload URLs are issued only after administrator authorization and are scoped to a product object path. Storage enforces JPEG, PNG, or WebP images up to 5 MB.
- Product images are attached after the upload completes and the API confirms the object exists. An interrupted upload preserves the previous photo.
- Configure HTTPS, Supabase Auth email delivery, and the production web origin before inviting real staff. The API CORS allowlist is `ALLOWED_ORIGINS`.
- The MVP collects a student alias and phone number for pickup. Add the institution's approved privacy notice and retention period before a real pilot; this repository does not define legal retention policy.
- Put the Compose web service behind an HTTPS reverse proxy for deployment. Local development at `http://localhost:8080` is not an HTTPS deployment.
- Confirm the Supabase project's backup/PITR plan and retention window, and document a restore procedure before the pilot. Application code does not select a Supabase plan or purge order/contact records automatically.

## Operating the MVP

1. Sign in as the bootstrapped administrator.
2. Create categories and products with real COP prices; set product availability and upload optional photos.
3. Configure weekly opening hours and date exceptions.
4. Create pickup slots with capacities agreed with cafeteria staff. The application deliberately ships without invented production hours or capacity values.
5. Invite operators. Operators update the queue; a pickup code is required to record handoff.

“Lo antes posible” is assigned to the earliest open slot with capacity. Capacity counts orders, and confirmed orders reserve one place. A cancellation before preparation releases the place; cancellation after preparation does not. Payment is recorded as pending physical payment. No-show cases remain manual.

## Project layout

- `openspec/changes/uniflow-mvp/`: proposal, technical design, and implementation checklist.
- `web/`: Angular PWA and responsive customer/staff interfaces.
- `api/UniFlow.sln`: Clean Architecture solution with Domain, Application, Infrastructure and API projects.
- `api/UniFlow.Infrastructure/Persistence/Migrations/`: EF Core migrations and relational mappings, isolated from HTTP endpoints.
- `stitch_bento_grid_responsive_dashboard/`: supplied HTML and screenshot references.

The operational acceptance scenarios and system design are maintained in `openspec/changes/uniflow-mvp/design.md`.

## Acceptance verification

The repository includes a reproducible integration environment with a real, isolated local Supabase project. It runs outside the web/API Compose services and exercises real PostgreSQL migrations, Auth, Storage, browser flows, concurrency, idempotency, privacy, authorization, offline behavior, and responsive accessibility states.

Follow [verification/README.md](verification/README.md) to start it and run the acceptance suite. The resulting [acceptance report](verification/acceptance-report.md) records the scope and evidence. Its development data and credentials are separate from the hosted project configured through `.env`.

The [architecture guide](ARCHITECTURE.md) documents the backend dependency rules, frontend feature branches, route boundaries, and migration tooling. `npm --prefix verification run check:architecture` verifies those boundaries; the acceptance command runs that check before the existing browser/API suite.
