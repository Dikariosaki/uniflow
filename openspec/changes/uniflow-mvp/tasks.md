# UniFlow MVP implementation tasks

## 1. Repository and local runtime

- [x] 1.1 Create Angular PWA workspace and ASP.NET Core API solution with clear web/API boundaries.
- [x] 1.2 Add Dockerfiles, Nginx SPA routing, Docker Compose, API health check, and environment template.
- [x] 1.3 Document local startup and required Supabase project setup without committing secrets.

## 2. Supabase persistence and identity

- [x] 2.1 Configure EF Core/Npgsql and migrations for catalog, schedule, slots, orders, snapshots, events, settings, staff roles, and row level security.
- [x] 2.2 Implement Supabase JWT validation, role authorization, administrator invitation, and initial administrator bootstrap.
- [x] 2.3 Add storage signed-upload integration, image validation, and bucket setup guidance.
- [x] 2.4 Seed only non-production development examples behind an explicit development configuration; do not assume real prices, hours, or capacity.

## 3. Public ordering

- [x] 3.1 Implement category/product/slot read endpoints and Angular responsive menu.
- [x] 3.2 Implement cart with quantity editing, COP totals, availability states, and checkout alias/phone inputs.
- [x] 3.3 Implement transactional order confirmation, server-side total calculation, idempotency, capacity reservation, ASAP slot choice, and useful conflicts.
- [x] 3.4 Implement receipt and private-token tracking; keep pickup code separate from tracking token.
- [x] 3.5 Implement PWA manifest/service worker, static shell caching, offline notice, and checkout blocking while offline.

## 4. Staff operation and administration

- [x] 4.1 Implement Supabase Auth sign-in and responsive staff navigation.
- [x] 4.2 Implement live queue, order detail, permitted status transitions, reasoned cancellation, pickup-code verification, and delivery events.
- [x] 4.3 Implement SignalR broadcasts with access-scoped groups and browser polling fallback.
- [x] 4.4 Implement category/product administration, availability, image upload, schedule exceptions, slot creation/capacity editing, and order-pause control.
- [x] 4.5 Implement daily metrics, order history, incidence/event visibility, and permission-protected CSV export.

## 5. Finish and acceptance

- [x] 5.1 Apply the supplied design references to student and staff flows and verify responsive layouts/accessibility states.
- [x] 5.2 Verify all design verification scenarios in `design.md`, including concurrency, idempotency, privacy, offline, and authorization.
- [x] 5.3 Build container images and confirm Docker Compose startup with external Supabase configuration.
- [x] 5.4 Update setup and operational documentation with migration, storage, Auth, backup, retention, and first-pilot configuration steps.

## 6. Architecture refactor

- [x] 6.1 Split the backend into Domain, Application, Infrastructure and API projects with dependencies pointing inward.
- [x] 6.2 Move business rules and use cases out of HTTP endpoints, define application ports, and isolate EF Core, Supabase integrations and migrations in Infrastructure.
- [x] 6.3 Organize Angular by feature branches, with independent pages, feature state/data access, shared presentation and core platform services.
- [x] 6.4 Update Docker builds, solution configuration and architecture documentation while preserving the existing API contracts and database migrations.
- [x] 6.5 Build both applications, start Docker Compose and run the existing acceptance tests against the refactored implementation; record fresh evidence.

Architecture refactor verification: four projects compile without warnings/errors, the dependency checks pass for all four layers and seven feature branches, and EF reports no pending model changes. All 18 acceptance scenarios pass: the original 16 plus two regressions proving that leaving queue/tracking pages cancels pending connection startup. The isolated Compose project `uniflow-verification` serves the acceptance application on port 8088 and keeps its containers/network separate from the main runtime. Fresh architecture checks, container health, applied migrations, test results and source hashes are recorded in the linked evidence.

Acceptance was completed on 2026-11-07 with 16 passing integration scenarios against a real isolated Supabase CLI project (PostgreSQL, Auth, and Storage), configured outside the application's web/API Compose services. Both images build and both services are healthy; backend migrations were applied successfully. Public screens were checked at 360/390/768/1440 px and staff screens at 360/768/1440 px, with keyboard checks, axe scans, screenshots, and PWA installability verification. Polling fallback was verified in both the student tracking screen and the operator queue after disabling SignalR.

See [the acceptance report](../../../verification/acceptance-report.md), [recorded evidence and source hashes](../../../verification/evidence.json), and [reproduction steps](../../../verification/README.md). This proves local integration through external Supabase configuration; no hosted Supabase project was configured or modified. Hosted credentials, email/domain setup, actual operating values, and institutional privacy/retention policy remain deployment configuration. Accessibility checks cover the documented browser states and do not claim a full manual WCAG certification or physical-device testing.
