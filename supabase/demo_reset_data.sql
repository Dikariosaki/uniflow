-- DEMO ONLY: removes UniFlow application data but preserves schema/migrations,
-- Supabase Auth users and Storage objects. Run as postgres in Supabase SQL Editor.
-- Destructive: every execution clears the listed operational tables.

BEGIN;
SET LOCAL lock_timeout = '15s';
-- Every UniFlow table with foreign-key dependencies is included explicitly.
-- Keep __EFMigrationsHistory so EF Core does not try to recreate the schema.
TRUNCATE TABLE
    public.stock_reservations,
    public.order_events,
    public.order_items,
    public.orders,
    public.pickup_slots,
    public.opening_hours,
    public.products,
    public.categories,
    public.admin_audit_events,
    public.staff_roles,
    public.business_settings
RESTART IDENTITY;

COMMIT;
