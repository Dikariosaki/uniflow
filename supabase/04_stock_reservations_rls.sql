-- Corrección para proyectos donde stock_reservations ya existe sin RLS.
-- Ejecutar completo desde Supabase SQL Editor con el rol postgres.
-- Deniega el acceso desde anon/authenticated; la API usa su conexión PostgreSQL de servidor.

BEGIN;

ALTER TABLE public.stock_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.stock_reservations FROM anon, authenticated, PUBLIC;
DROP POLICY IF EXISTS uniflow_api_only ON public.stock_reservations;
CREATE POLICY uniflow_api_only ON public.stock_reservations
    AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

COMMIT;
