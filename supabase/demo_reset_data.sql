-- DEMO ONLY: removes UniFlow application data but preserves schema/migrations,
-- Supabase Auth users and Storage objects. Run as postgres in Supabase SQL Editor.
-- To authorize the reset, uncomment the SET LOCAL line below before running.

BEGIN;
SET LOCAL lock_timeout = '15s';
-- SET LOCAL uniflow.confirm_demo_reset = 'WIPE_DEMO_DATA';

DO $confirmation$
BEGIN
    IF current_setting('uniflow.confirm_demo_reset', true) IS DISTINCT FROM 'WIPE_DEMO_DATA' THEN
        RAISE EXCEPTION 'Reset cancelled. Review this script and uncomment SET LOCAL uniflow.confirm_demo_reset.';
    END IF;
END $confirmation$;

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
