-- Primero crea el usuario con email/contraseña en Authentication > Users.
-- También puedes invitarlo desde Supabase Auth y completar la invitación.
-- Sustituye SOLO el correo de la siguiente variable. No escribas contraseñas aquí.
-- Ejecuta el archivo completo como postgres en el SQL Editor.

BEGIN;
SET LOCAL search_path = public;

DO $bootstrap$
DECLARE
    admin_email text := 'CAMBIA_POR_TU_CORREO';
    admin_id uuid;
    changed_id text;
BEGIN
    IF admin_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
        RAISE EXCEPTION 'Escribe un correo válido en admin_email y vuelve a ejecutar este archivo.';
    END IF;

    SELECT u.id INTO admin_id
    FROM auth.users AS u
    WHERE lower(u.email) = lower(btrim(admin_email));

    IF admin_id IS NULL THEN
        RAISE EXCEPTION 'No existe el usuario % en Supabase Auth. Créalo primero en Authentication > Users.', admin_email;
    END IF;

    INSERT INTO public.staff_roles ("UserId", "Role", "Active", "CreatedAt")
    VALUES (admin_id::text, 'administrator', true, now())
    ON CONFLICT ("UserId") DO UPDATE
    SET "Role" = 'administrator', "Active" = true
    WHERE staff_roles."Role" IS DISTINCT FROM 'administrator'
       OR staff_roles."Active" IS DISTINCT FROM true
    RETURNING "UserId" INTO changed_id;

    IF changed_id IS NOT NULL THEN
        INSERT INTO public.admin_audit_events
            ("Id", "ActorId", "Action", "EntityType", "EntityId", "Details", "CreatedAt")
        VALUES
            (gen_random_uuid(), 'sql-bootstrap', 'staff.bootstrap', 'staff_role',
             admin_id::text, 'Asignación inicial de administrador desde SQL Editor.', now());
    END IF;

    RAISE NOTICE 'Administrador activo: %. Puedes iniciar sesión en /personal.', admin_email;
END $bootstrap$;

COMMIT;

-- Las siguientes invitaciones y cambios de rol se realizan desde el panel.
