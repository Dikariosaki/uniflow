-- Assign roles to users that already exist in Supabase Auth.
-- Create/confirm the Auth users first in Authentication > Users.
-- Run as postgres in Supabase SQL Editor after demo_reset_data.sql.

BEGIN;
SET LOCAL search_path = public;

DO $demo_staff$
DECLARE
    admin_email text := 'lamouroux7@gmail.com';
    operator_email text := 'lamouroux007@gmail.com';
    admin_id uuid;
    operator_id uuid;
    changed_id text;
BEGIN
    SELECT id INTO admin_id FROM auth.users WHERE lower(email) = lower(btrim(admin_email));
    SELECT id INTO operator_id FROM auth.users WHERE lower(email) = lower(btrim(operator_email));

    IF admin_id IS NULL THEN
        RAISE EXCEPTION 'No existe % en Supabase Auth. Créalo primero en Authentication > Users.', admin_email;
    END IF;
    IF operator_id IS NULL THEN
        RAISE EXCEPTION 'No existe % en Supabase Auth. Créalo primero en Authentication > Users.', operator_email;
    END IF;
    IF admin_id = operator_id THEN
        RAISE EXCEPTION 'El administrador y el operario deben ser usuarios distintos.';
    END IF;

    INSERT INTO public.staff_roles AS existing ("UserId", "Role", "Active", "CreatedAt")
    VALUES (admin_id::text, 'administrator', true, now())
    ON CONFLICT ("UserId") DO UPDATE
    SET "Role" = EXCLUDED."Role", "Active" = true
    WHERE existing."Role" IS DISTINCT FROM EXCLUDED."Role"
       OR existing."Active" IS DISTINCT FROM true
    RETURNING "UserId" INTO changed_id;

    IF changed_id IS NOT NULL THEN
        INSERT INTO public.admin_audit_events
            ("Id", "ActorId", "Action", "EntityType", "EntityId", "Details", "CreatedAt")
        VALUES
            (gen_random_uuid(), 'demo-bootstrap', 'staff.bootstrap', 'staff_role',
             admin_id::text, 'Asignación de administrador para demo.', now());
    END IF;

    changed_id := NULL;
    INSERT INTO public.staff_roles AS existing ("UserId", "Role", "Active", "CreatedAt")
    VALUES (operator_id::text, 'operator', true, now())
    ON CONFLICT ("UserId") DO UPDATE
    SET "Role" = EXCLUDED."Role", "Active" = true
    WHERE existing."Role" IS DISTINCT FROM EXCLUDED."Role"
       OR existing."Active" IS DISTINCT FROM true
    RETURNING "UserId" INTO changed_id;

    IF changed_id IS NOT NULL THEN
        INSERT INTO public.admin_audit_events
            ("Id", "ActorId", "Action", "EntityType", "EntityId", "Details", "CreatedAt")
        VALUES
            (gen_random_uuid(), 'demo-bootstrap', 'staff.bootstrap', 'staff_role',
             operator_id::text, 'Asignación de operario para demo.', now());
    END IF;

    RAISE NOTICE 'Roles de demo activos: administrador %; operario %.', admin_email, operator_email;
END $demo_staff$;

COMMIT;
