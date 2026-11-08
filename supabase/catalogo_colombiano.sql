-- Catálogo colombiano para la carta de Cafetería Bloque B de la Universidad Libre.
-- Incluye 50 productos, inventario inicial, horario y 14 días de franjas.
-- Reejecutable: los IDs deterministas actualizan estas mismas filas.
-- Precios, jornada y cupo son una propuesta realista para Bogotá; validar con la empresa antes de abrir pedidos.
-- Las fotos son URL públicas de Unsplash y no ocupan el bucket de Supabase.

BEGIN;
SET LOCAL search_path = public;
SET LOCAL lock_timeout = '15s';
SELECT pg_advisory_xact_lock(214731, 2);

INSERT INTO public.business_settings ("Id", "Name", "TimeZone", "OrdersPaused", "MinimumNoticeMinutes")
VALUES (1, 'Cafetería Bloque B', 'America/Bogota', false, 10)
ON CONFLICT ("Id") DO UPDATE SET
    "Name" = EXCLUDED."Name",
    "TimeZone" = EXCLUDED."TimeZone",
    "OrdersPaused" = EXCLUDED."OrdersPaused",
    "MinimumNoticeMinutes" = EXCLUDED."MinimumNoticeMinutes";

WITH categories (name, display_order) AS (
    VALUES
        ('Arepas y desayunos', 1),
        ('Platos típicos', 2),
        ('Amasijos y panadería', 3),
        ('Fritos y antojos', 4),
        ('Café y bebidas calientes', 5),
        ('Jugos y bebidas tradicionales', 6)
)
INSERT INTO public.categories ("Id", "Name", "DisplayOrder", "Active")
SELECT md5('uniflow:category:' || name)::uuid, name, display_order, true
FROM categories
ON CONFLICT ("Id") DO UPDATE SET
    "Name" = EXCLUDED."Name",
    "DisplayOrder" = EXCLUDED."DisplayOrder",
    "Active" = true;

WITH products (category, name, description, price_cop, stock, image_url) AS (
    VALUES
    ('Arepas y desayunos', 'Arepa de choclo con queso', 'Arepa dulce de maíz tierno a la plancha, servida con queso campesino.', 9500, 24, 'https://images.unsplash.com/photo-1644753787071-8933b5daed2d?auto=format&fit=crop&w=900&q=80'),
    ('Arepas y desayunos', 'Arepa boyacense', 'Amasijo de maíz y cuajada con un toque dulce, horneado hasta dorar.', 5500, 30, 'https://images.unsplash.com/photo-1644753787067-d62ae70f303d?auto=format&fit=crop&w=900&q=80'),
    ('Arepas y desayunos', 'Arepa de maíz pelao', 'Arepa de maíz amarillo pelado, asada al momento y acompañada de suero.', 6500, 25, 'https://images.unsplash.com/photo-1644753787071-8933b5daed2d?auto=format&fit=crop&w=900&q=80'),
    ('Arepas y desayunos', 'Arepa con queso campesino', 'Arepa de maíz blanco con queso campesino fundido.', 7500, 24, 'https://images.unsplash.com/photo-1644753787067-d62ae70f303d?auto=format&fit=crop&w=900&q=80'),
    ('Arepas y desayunos', 'Arepa de huevo costeña', 'Arepa de maíz frita y rellena con huevo, preparada al estilo de la costa Caribe.', 8000, 18, 'https://images.unsplash.com/photo-1644753787071-8933b5daed2d?auto=format&fit=crop&w=900&q=80'),
    ('Arepas y desayunos', 'Calentado paisa con huevo', 'Fríjoles y arroz del día salteados con hogao, huevo frito y arepa.', 16500, 14, 'https://images.unsplash.com/photo-1723693407562-bb4fcae76797?auto=format&fit=crop&w=900&q=80'),
    ('Arepas y desayunos', 'Changua santafereña', 'Caldo de leche y agua con huevo, cilantro y calado, servida caliente.', 13500, 12, 'https://images.unsplash.com/photo-1723693407562-bb4fcae76797?auto=format&fit=crop&w=900&q=80'),
    ('Arepas y desayunos', 'Tamal tolimense', 'Tamal de arroz, pollo, cerdo, arveja y zanahoria envuelto en hoja de plátano.', 19000, 12, 'https://images.unsplash.com/photo-1723693407562-bb4fcae76797?auto=format&fit=crop&w=900&q=80'),
    ('Arepas y desayunos', 'Caldo de costilla', 'Caldo de res con papa, cilantro y cebolla larga, acompañado de arepa.', 15500, 12, 'https://images.unsplash.com/photo-1723693407562-bb4fcae76797?auto=format&fit=crop&w=900&q=80'),

    ('Platos típicos', 'Bandeja paisa', 'Fríjoles, arroz, carne molida, chicharrón, chorizo, huevo, plátano maduro, aguacate y arepa.', 28900, 12, 'https://images.unsplash.com/photo-1723693407562-bb4fcae76797?auto=format&fit=crop&w=900&q=80'),
    ('Platos típicos', 'Ajiaco santafereño', 'Sopa bogotana de pollo y papas con guascas, mazorca, crema, alcaparras y arroz.', 23900, 14, 'https://images.unsplash.com/photo-1644753787071-8933b5daed2d?auto=format&fit=crop&w=900&q=80'),
    ('Platos típicos', 'Sancocho de gallina', 'Sancocho con gallina, yuca, plátano, mazorca y papa, servido con arroz y cilantro.', 24900, 12, 'https://images.unsplash.com/photo-1644753787071-8933b5daed2d?auto=format&fit=crop&w=900&q=80'),
    ('Platos típicos', 'Arroz atollado valluno', 'Arroz meloso del Valle del Cauca con pollo, cerdo, papa amarilla y hogao.', 22900, 12, 'https://images.unsplash.com/photo-1723693407562-bb4fcae76797?auto=format&fit=crop&w=900&q=80'),
    ('Platos típicos', 'Sobrebarriga en salsa criolla', 'Sobrebarriga de res cocida lentamente en salsa criolla con papa y arroz.', 26900, 10, 'https://images.unsplash.com/photo-1723693407562-bb4fcae76797?auto=format&fit=crop&w=900&q=80'),
    ('Platos típicos', 'Posta cartagenera', 'Posta de res en salsa caribeña ligeramente dulce, con arroz con coco y patacón.', 28900, 10, 'https://images.unsplash.com/photo-1723693407562-bb4fcae76797?auto=format&fit=crop&w=900&q=80'),
    ('Platos típicos', 'Mojarra frita con patacón', 'Mojarra dorada con patacón, arroz, ensalada fresca y limón.', 29900, 10, 'https://images.unsplash.com/photo-1723693407562-bb4fcae76797?auto=format&fit=crop&w=900&q=80'),
    ('Platos típicos', 'Fríjoles antioqueños con chicharrón', 'Fríjoles cargamanto con hogao, arroz, chicharrón y tajada de maduro.', 22900, 12, 'https://images.unsplash.com/photo-1723693407562-bb4fcae76797?auto=format&fit=crop&w=900&q=80'),
    ('Platos típicos', 'Carne a la llanera', 'Carne de res asada, papa salada, yuca y guacamole con hierbas frescas.', 29900, 10, 'https://images.unsplash.com/photo-1723693407562-bb4fcae76797?auto=format&fit=crop&w=900&q=80'),
    ('Platos típicos', 'Arroz con pollo criollo', 'Arroz preparado con pollo, verduras, hogao y papa a la francesa.', 19900, 14, 'https://images.unsplash.com/photo-1723693407562-bb4fcae76797?auto=format&fit=crop&w=900&q=80'),

    ('Amasijos y panadería', 'Pandebono valluno', 'Panecillo horneado de almidón de yuca, queso y almidón de maíz.', 3500, 36, 'https://images.unsplash.com/photo-1559054663-e8d23213f55c?auto=format&fit=crop&w=900&q=80'),
    ('Amasijos y panadería', 'Almojábana boyacense', 'Amasijo horneado de harina de maíz y queso fresco.', 3500, 36, 'https://images.unsplash.com/photo-1559054663-e8d23213f55c?auto=format&fit=crop&w=900&q=80'),
    ('Amasijos y panadería', 'Pan de yuca', 'Panecillo de almidón de yuca y queso, de corteza dorada y centro suave.', 3200, 36, 'https://images.unsplash.com/photo-1559054663-e8d23213f55c?auto=format&fit=crop&w=900&q=80'),
    ('Amasijos y panadería', 'Buñuelo', 'Buñuelo colombiano de queso y almidón, frito hasta quedar dorado.', 3500, 36, 'https://images.unsplash.com/photo-1559054663-e8d23213f55c?auto=format&fit=crop&w=900&q=80'),
    ('Amasijos y panadería', 'Mantecada boyacense', 'Bizcocho tradicional de maíz, mantequilla y queso, horneado en porción individual.', 4500, 22, 'https://images.unsplash.com/photo-1559054663-e8d23213f55c?auto=format&fit=crop&w=900&q=80'),
    ('Amasijos y panadería', 'Garulla de Soacha', 'Amasijo de maíz, cuajada y mantequilla, tradicional de Cundinamarca.', 4500, 22, 'https://images.unsplash.com/photo-1559054663-e8d23213f55c?auto=format&fit=crop&w=900&q=80'),
    ('Amasijos y panadería', 'Envuelto de mazorca', 'Masa de mazorca tierna con queso, cocida en su propia hoja.', 6000, 18, 'https://images.unsplash.com/photo-1644753787067-d62ae70f303d?auto=format&fit=crop&w=900&q=80'),
    ('Amasijos y panadería', 'Roscón de bocadillo', 'Pan dulce horneado relleno de bocadillo de guayaba.', 5000, 22, 'https://images.unsplash.com/photo-1559054663-e8d23213f55c?auto=format&fit=crop&w=900&q=80'),
    ('Amasijos y panadería', 'Torta de almojábana', 'Torta horneada de queso y harina de maíz, suave por dentro.', 6500, 16, 'https://images.unsplash.com/photo-1559054663-e8d23213f55c?auto=format&fit=crop&w=900&q=80'),

    ('Fritos y antojos', 'Empanada de carne', 'Empanada de maíz amarillo rellena de carne y papa, acompañada de ají de la casa.', 4500, 30, 'https://images.unsplash.com/photo-1767065626217-5c0fc1c1c9b3?auto=format&fit=crop&w=900&q=80'),
    ('Fritos y antojos', 'Empanada de pollo', 'Empanada de maíz rellena de pollo desmechado y papa con hogao.', 4500, 30, 'https://images.unsplash.com/photo-1767065626217-5c0fc1c1c9b3?auto=format&fit=crop&w=900&q=80'),
    ('Fritos y antojos', 'Papa rellena', 'Papa criolla y pastusa prensadas con guiso de carne y huevo, apanadas y fritas.', 6000, 24, 'https://images.unsplash.com/photo-1767065626217-5c0fc1c1c9b3?auto=format&fit=crop&w=900&q=80'),
    ('Fritos y antojos', 'Carimañola costeña de queso', 'Masa de yuca frita, rellena de queso costeño.', 5500, 22, 'https://images.unsplash.com/photo-1767065626217-5c0fc1c1c9b3?auto=format&fit=crop&w=900&q=80'),
    ('Fritos y antojos', 'Aborrajado valluno', 'Plátano maduro relleno de queso, apanado y frito al estilo del Valle.', 8500, 18, 'https://images.unsplash.com/photo-1767065626217-5c0fc1c1c9b3?auto=format&fit=crop&w=900&q=80'),
    ('Fritos y antojos', 'Patacón con hogao y queso', 'Patacón de plátano verde con hogao casero y queso campesino.', 8500, 20, 'https://images.unsplash.com/photo-1644753787067-d62ae70f303d?auto=format&fit=crop&w=900&q=80'),
    ('Fritos y antojos', 'Chorizo antioqueño con arepa', 'Chorizo a la plancha con arepa pequeña y limón.', 9500, 16, 'https://images.unsplash.com/photo-1723693407562-bb4fcae76797?auto=format&fit=crop&w=900&q=80'),

    ('Café y bebidas calientes', 'Tinto campesino', 'Café colombiano filtrado, servido negro en taza.', 3000, 60, 'https://images.unsplash.com/photo-1772141024300-76468f1ea34b?auto=format&fit=crop&w=900&q=80'),
    ('Café y bebidas calientes', 'Perico', 'Café colombiano con leche caliente, preparado al momento.', 4500, 50, 'https://images.unsplash.com/photo-1772141024300-76468f1ea34b?auto=format&fit=crop&w=900&q=80'),
    ('Café y bebidas calientes', 'Café filtrado de origen', 'Café de origen colombiano preparado por filtrado.', 6500, 35, 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=900&q=80'),
    ('Café y bebidas calientes', 'Chocolate santafereño con queso', 'Chocolate caliente en leche, servido con queso campesino y calado.', 7500, 30, 'https://images.unsplash.com/photo-1772141024300-76468f1ea34b?auto=format&fit=crop&w=900&q=80'),
    ('Café y bebidas calientes', 'Aguapanela caliente con limón', 'Bebida de panela disuelta en agua caliente con limón.', 4500, 30, 'https://images.unsplash.com/photo-1772141024300-76468f1ea34b?auto=format&fit=crop&w=900&q=80'),
    ('Café y bebidas calientes', 'Avena caliente de canela', 'Avena cocida en leche con canela, servida caliente.', 6000, 25, 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=900&q=80'),

    ('Jugos y bebidas tradicionales', 'Jugo de lulo en agua', 'Jugo natural de lulo preparado en agua y endulzado al gusto.', 6500, 30, 'https://images.unsplash.com/photo-1577680716097-9a565ddc2007?auto=format&fit=crop&w=900&q=80'),
    ('Jugos y bebidas tradicionales', 'Jugo de maracuyá en agua', 'Jugo de maracuyá colombiano, licuado en agua y colado.', 6500, 30, 'https://images.unsplash.com/photo-1577680716097-9a565ddc2007?auto=format&fit=crop&w=900&q=80'),
    ('Jugos y bebidas tradicionales', 'Jugo de mora en leche', 'Moras licuadas con leche fría.', 7500, 24, 'https://images.unsplash.com/photo-1577680716097-9a565ddc2007?auto=format&fit=crop&w=900&q=80'),
    ('Jugos y bebidas tradicionales', 'Jugo de guanábana en leche', 'Guanábana licuada en leche fría y endulzada al gusto.', 8000, 22, 'https://images.unsplash.com/photo-1577680716097-9a565ddc2007?auto=format&fit=crop&w=900&q=80'),
    ('Jugos y bebidas tradicionales', 'Jugo de mango biche', 'Mango biche licuado con agua y un toque de limón.', 6500, 22, 'https://images.unsplash.com/photo-1577680716097-9a565ddc2007?auto=format&fit=crop&w=900&q=80'),
    ('Jugos y bebidas tradicionales', 'Lulada valluna', 'Bebida fría de lulo macerado con limón y hielo.', 9000, 18, 'https://images.unsplash.com/photo-1577680716097-9a565ddc2007?auto=format&fit=crop&w=900&q=80'),
    ('Jugos y bebidas tradicionales', 'Cholado valluno', 'Hielo raspado con frutas, jarabe y leche condensada.', 12000, 16, 'https://images.unsplash.com/photo-1577680716097-9a565ddc2007?auto=format&fit=crop&w=900&q=80'),
    ('Jugos y bebidas tradicionales', 'Masato de arroz', 'Bebida fermentada suave de arroz con canela.', 5000, 20, 'https://images.unsplash.com/photo-1577680716097-9a565ddc2007?auto=format&fit=crop&w=900&q=80'),
    ('Jugos y bebidas tradicionales', 'Avena casera fría', 'Bebida fría de avena con leche, canela y vainilla.', 6000, 24, 'https://images.unsplash.com/photo-1577680716097-9a565ddc2007?auto=format&fit=crop&w=900&q=80')
), product_rows AS (
    SELECT md5('uniflow:product:' || p.name)::uuid AS id,
           c."Id" AS category_id, p.name, p.description, p.price_cop, p.stock, p.image_url
    FROM products AS p
    JOIN public.categories AS c ON c."Name" = p.category
)
INSERT INTO public.products
    ("Id", "CategoryId", "Name", "Description", "PriceCop", "StockQuantity", "ImagePath", "Available", "Active", "UpdatedAt")
SELECT id, category_id, name, description, price_cop, stock, image_url, true, true, now()
FROM product_rows
ON CONFLICT ("Id") DO UPDATE SET
    "CategoryId" = EXCLUDED."CategoryId",
    "Name" = EXCLUDED."Name",
    "Description" = EXCLUDED."Description",
    "PriceCop" = EXCLUDED."PriceCop",
    "StockQuantity" = EXCLUDED."StockQuantity",
    "ImagePath" = EXCLUDED."ImagePath",
    "Available" = true,
    "Active" = true,
    "UpdatedAt" = now();

WITH hours (weekday, opens_at, closes_at, closed) AS (
    VALUES
        (0, time '00:00', time '00:00', true),
        (1, time '07:00', time '19:30', false),
        (2, time '07:00', time '19:30', false),
        (3, time '07:00', time '19:30', false),
        (4, time '07:00', time '19:30', false),
        (5, time '07:00', time '19:30', false),
        (6, time '08:00', time '13:00', false)
)
INSERT INTO public.opening_hours ("Id", "Weekday", "Date", "OpensAt", "ClosesAt", "Closed")
SELECT md5('uniflow:opening-hours:' || weekday::text)::uuid, weekday, NULL, opens_at, closes_at, closed
FROM hours
ON CONFLICT ("Id") DO UPDATE SET
    "Weekday" = EXCLUDED."Weekday", "Date" = NULL,
    "OpensAt" = EXCLUDED."OpensAt", "ClosesAt" = EXCLUDED."ClosesAt", "Closed" = EXCLUDED."Closed";

WITH local_days AS (
    SELECT day_value::date AS local_day
    FROM generate_series(
        (now() AT TIME ZONE 'America/Bogota')::date::timestamp,
        ((now() AT TIME ZONE 'America/Bogota')::date + 13)::timestamp,
        interval '1 day'
    ) AS days(day_value)
), slot_times AS (
    SELECT slot_local
    FROM local_days AS d
    CROSS JOIN LATERAL generate_series(
        (d.local_day + CASE WHEN EXTRACT(ISODOW FROM d.local_day) = 6 THEN time '08:00' ELSE time '07:00' END)::timestamp,
        (d.local_day + CASE WHEN EXTRACT(ISODOW FROM d.local_day) = 6 THEN time '12:30' ELSE time '19:00' END)::timestamp,
        interval '30 minutes'
    ) AS slots(slot_local)
    WHERE EXTRACT(ISODOW FROM d.local_day) BETWEEN 1 AND 6
)
INSERT INTO public.pickup_slots ("Id", "StartsAt", "EndsAt", "Capacity", "Active")
SELECT md5('uniflow:pickup-slot:' || to_char(slot_local, 'YYYYMMDDHH24MI'))::uuid,
       slot_local AT TIME ZONE 'America/Bogota',
       (slot_local + interval '30 minutes') AT TIME ZONE 'America/Bogota',
       10, true
FROM slot_times
ON CONFLICT ("Id") DO UPDATE SET
    "StartsAt" = EXCLUDED."StartsAt",
    "EndsAt" = EXCLUDED."EndsAt",
    "Capacity" = EXCLUDED."Capacity",
    "Active" = true;

COMMIT;

