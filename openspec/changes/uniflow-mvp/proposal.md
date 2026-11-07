# UniFlow MVP

## Why

The cafeteria at Universidad Libre, Bosque Popular campus, needs a way for students to order ahead and for staff to organize preparation and pickup. The existing repository contains product requirements and eight visual references, but no running application. This change establishes the full first release, including the web client, API, persistent data, product image storage, and a repeatable container deployment.

## What changes

- Add a responsive, installable Angular PWA for browsing the menu, managing a cart, selecting pickup, confirming orders, and tracking progress with a private token.
- Add staff sign-in and role-protected operator and administrator views for the live queue, order history, catalog, opening hours, pickup slots, and basic reports.
- Audit administrator changes to catalog, schedule, capacity, settings, and staff access.
- Add a versioned ASP.NET Core REST API that owns pricing, availability, order state transitions, idempotency, and atomic slot capacity reservations.
- Use Supabase PostgreSQL for application data, Supabase Auth for staff identities, and Supabase Storage for public product photos with authorized uploads.
- Add Dockerfiles and Docker Compose for the Angular web server and .NET API. Supabase is configured as a hosted external dependency.
- Preserve the provided HTML, screenshots, and Campus Bento Modern design guide as implementation references.
- Separate the backend into Clean Architecture projects (Domain, Application, Infrastructure, API) and organize Angular into feature branches with independent pages/state, shared presentation, platform services, and lazy routes. Preserve the existing persistence and HTTP behavior while verifying it with the acceptance suite.

## Capabilities

- `student-ordering`: public menu, category browsing, product availability and images, cart, pickup mode, contact alias and phone, order confirmation and receipt.
- `order-tracking`: private-token tracking, permitted order lifecycle, operator cancellation with reason, pickup verification, and timestamped audit events.
- `capacity-and-hours`: configurable opening hours and exceptions, configurable pickup slots and per-slot order capacity, server-side atomic reservations, and ASAP assignment to the first viable slot.
- `staff-operations`: Supabase-authenticated staff access, operator queue, order details, quick status actions, history, and delivery records.
- `catalog-and-reports`: administrator-managed categories/products/photos, availability switches, schedule and capacity setup, daily operational metrics, and CSV export.
- `deployment`: environment-based configuration and local Docker Compose for web and API, connected to external Supabase services.

## Out of scope

- Online payment processing, delivery, student accounts, automatic customer cancellation, automatic no-show expiry, push notifications, multiple cafeterias, POS/ERP integration, and raw-material inventory.

## Decisions carried into this change

- Initial capacity is a configurable count of orders per pickup slot. ASAP orders occupy the first viable slot and consume its capacity.
- Students provide an alias and phone number. The MVP does not send SMS or email notifications.
- Payment is collected physically at the cafeteria. The order records payment as pending/in-person informational status only.
- Only staff can cancel a confirmed order; a reason and actor are required. No-show handling remains manual.
- The business timezone is `America/Bogota`; timestamps are stored in UTC and displayed in the business timezone. Currency is COP.
- Slot durations, schedules, minimum notice, and capacities are administrator configuration. No operational values are invented as production defaults.

## Acceptance criteria

- Students can complete the public menu-to-order flow and view their own order through a cryptographically unguessable tracking token.
- The server recalculates totals and revalidates active product availability, business hours, slot capacity, and idempotency before persisting an order.
- Concurrent requests cannot reserve more orders than a slot's configured capacity; retrying the same idempotency key returns the same order.
- Staff authentication and role checks protect operation and administration routes. Order changes persist audit events.
- Operators can move orders through allowed states, verify a pickup code, and record delivery.
- Administrators can maintain catalog entries and public product images, configure schedules/capacity, and view/export basic operational reports.
- Offline UI may render cached shell content but blocks order confirmation until connectivity returns.
- Docker Compose starts the Angular web service and ASP.NET Core API; runtime configuration points to Supabase without putting secrets in the repository.
- The eight supplied screen references inform responsive public and staff interfaces.

## Risks

- Slot capacity is an order count rather than a measure of kitchen effort. It must be tuned with cafeteria staff before a real pilot.
- Supabase project URL, database credentials, auth configuration, and storage bucket policies must be supplied in each deployment environment.
- Student contact data requires an approved privacy notice and retention policy before real customer use.
- Real-time delivery relies on SignalR between the API and browser; the client also needs a polling fallback for interrupted connections.
