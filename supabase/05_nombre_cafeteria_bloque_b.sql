-- Actualiza el nombre de la sede UniFlow a Cafetería Bloque B.
-- Seguro de ejecutar varias veces y no modifica horarios ni otros ajustes.
BEGIN;

INSERT INTO public.business_settings
    ("Id", "Name", "TimeZone", "OrdersPaused", "MinimumNoticeMinutes")
VALUES
    (1, 'Cafetería Bloque B', 'America/Bogota', false, 0)
ON CONFLICT ("Id") DO UPDATE
SET "Name" = EXCLUDED."Name";

COMMIT;
