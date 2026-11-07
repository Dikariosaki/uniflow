-- Comprobaciones de solo lectura. Ejecutar como postgres tras los otros archivos.
-- El primer resultado debe tener todos los controles con ok = true.
-- Si cambiaste el bucket, cambia también aquí 'uniflow-images'.

WITH expected_tables (table_name) AS (
    VALUES ('business_settings'), ('categories'), ('products'), ('opening_hours'),
           ('pickup_slots'), ('orders'), ('order_items'), ('order_events'),
           ('staff_roles'), ('admin_audit_events'), ('stock_reservations'), ('__EFMigrationsHistory')
), table_security AS (
    SELECT e.table_name, c.relrowsecurity,
           NOT has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
           AND NOT has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS browser_denied,
           EXISTS (SELECT 1 FROM pg_policies AS p
                   WHERE p.schemaname = 'public' AND p.tablename = e.table_name
                     AND p.policyname = 'uniflow_api_only' AND p.permissive = 'RESTRICTIVE'
                     AND p.cmd = 'ALL' AND p.roles @> ARRAY['anon', 'authenticated']::name[]
                     AND p.qual = 'false' AND p.with_check = 'false') AS api_only
    FROM expected_tables AS e
    LEFT JOIN pg_namespace AS n ON n.nspname = 'public'
    LEFT JOIN pg_class AS c ON c.relnamespace = n.oid AND c.relname = e.table_name AND c.relkind = 'r'
), expected_migrations (id) AS (
    VALUES ('20261107074638_InitialCreate'), ('20261107075102_CapacityRelease'),
           ('20261107075342_EnableRowLevelSecurity'), ('20261107080801_ProductIntegrity'),
           ('20261107080831_AdminAuditEvents'), ('20261107182512_StockReservations')
)
SELECT 'Tablas esperadas y RLS (12, incluido historial EF)' AS control,
       count(*) = 12 AND count(*) FILTER (WHERE relrowsecurity IS TRUE) = 12 AS ok
FROM table_security
UNION ALL
SELECT 'Tablas sin permisos de navegador ni acceso directo por políticas',
       count(*) FILTER (WHERE browser_denied IS TRUE AND api_only IS TRUE) = 12
FROM table_security
UNION ALL
SELECT 'Seis migraciones del backend registradas', count(*) = 6
FROM expected_migrations AS e
JOIN public."__EFMigrationsHistory" AS h ON h."MigrationId" = e.id
UNION ALL
SELECT 'Bucket público: JPEG/PNG/WebP, límite de 5.000.000 bytes', EXISTS (
    SELECT 1 FROM storage.buckets
    WHERE id = 'uniflow-images' AND public IS TRUE AND file_size_limit = 5000000
      AND allowed_mime_types @> ARRAY['image/jpeg', 'image/png', 'image/webp']
      AND allowed_mime_types <@ ARRAY['image/jpeg', 'image/png', 'image/webp']
)
UNION ALL
SELECT 'Storage: RLS activo y política restrictiva de acceso por API', EXISTS (
    SELECT 1 FROM pg_policies AS p
    JOIN pg_class AS c ON c.relname = p.tablename
    JOIN pg_namespace AS n ON n.oid = c.relnamespace AND n.nspname = p.schemaname
    WHERE p.schemaname = 'storage' AND p.tablename = 'objects'
      AND p.policyname = 'uniflow_api_only_uniflow-images'
      AND p.permissive = 'RESTRICTIVE' AND p.cmd = 'ALL' AND c.relrowsecurity
      AND p.roles @> ARRAY['anon', 'authenticated']::name[]
      AND p.qual = '(bucket_id <> ''uniflow-images''::text)'
      AND p.with_check = '(bucket_id <> ''uniflow-images''::text)'
)
UNION ALL
SELECT 'Existe al menos un administrador activo vinculado a Auth', EXISTS (
    SELECT 1 FROM public.staff_roles AS r
    JOIN auth.users AS u ON u.id::text = r."UserId"
    WHERE r."Active" AND r."Role" = 'administrator'
);

-- Pendientes operativos: un resultado false es normal antes de configurar el panel.
SELECT 'Configuración del punto creada' AS pendiente,
       EXISTS (SELECT 1 FROM public.business_settings WHERE "Id" = 1 AND "TimeZone" = 'America/Bogota') AS configurado
UNION ALL
SELECT 'Horario de atención configurado', EXISTS (SELECT 1 FROM public.opening_hours WHERE NOT "Closed")
UNION ALL
SELECT 'Productos y categorías activos', EXISTS (
    SELECT 1 FROM public.products AS p JOIN public.categories AS c ON c."Id" = p."CategoryId"
    WHERE p."Active" AND p."Available" AND c."Active"
)
UNION ALL
SELECT 'Franjas futuras activas con cupo', EXISTS (
    SELECT 1 FROM public.pickup_slots AS s
    WHERE s."Active" AND s."StartsAt" > now() AND s."Capacity" > (
        SELECT count(*) FROM public.orders AS o WHERE o."SlotId" = s."Id" AND o."ConsumesCapacity"
    )
);

-- Revisa la pausa antes de abrir pedidos. Horas absolutas se guardan en UTC.
SELECT "Name", "TimeZone", "OrdersPaused", "MinimumNoticeMinutes"
FROM public.business_settings WHERE "Id" = 1;
