# Preparar Supabase para UniFlow

La configuracion SQL instala el esquema base y protege las tablas del navegador; la tabla de reservas de stock se incorpora en una migracion posterior. No contiene credenciales ni datos de demostracion.

| Paso | Archivo | Resultado |
| --- | --- | --- |
| 1 | [01_setup.sql](01_setup.sql) | Diez tablas de aplicación, historial EF, claves foráneas, índices, restricciones, RLS, permisos y bucket de imágenes protegido. |
| 2 | [02_first_admin.sql](02_first_admin.sql) | Asigna el rol de administrador a un usuario existente de Supabase Auth y registra la asignación en auditoría. |
| 3 | [04_stock_reservations_rls.sql](04_stock_reservations_rls.sql) | Habilita RLS y bloquea el acceso directo a las reservas de stock creadas por la migracion mas reciente. |
| 4 | [03_verify.sql](03_verify.sql) | Comprueba las seis migraciones, las doce tablas con RLS, Storage y el administrador. |

## 1. Instalar el esquema y Storage

Abre `01_setup.sql`, copia todo su contenido y ejecútalo. El bucket se llama **`uniflow-images`**, igual que `SUPABASE_PRODUCT_BUCKET` en la plantilla `.env.example`. Si eliges otro nombre, cambia esa variable en tu `.env` y las referencias al bucket en `01_setup.sql` y `03_verify.sql`.

El script se puede repetir y aplica el esquema base de las cinco migraciones iniciales. La migracion mas reciente, `StockReservations`, se aplica por el flujo EF del backend; despues ejecuta `04_stock_reservations_rls.sql`. Toda la instalacion base se ejecuta en una transaccion. No ejecutes el instalador al mismo tiempo que una migracion.

Las diez tablas iniciales son `business_settings`, `categories`, `products`, `opening_hours`, `pickup_slots`, `orders`, `order_items`, `order_events`, `staff_roles` y `admin_audit_events`. La migracion `20261107182512_StockReservations` agrega `stock_reservations`; aplica su migracion y luego `04_stock_reservations_rls.sql`.

RLS y los permisos bloquean el acceso directo desde el navegador a las tablas de UniFlow, incluido el historial EF. La API accede mediante su conexión PostgreSQL del servidor como propietario (`postgres` en la configuración habitual de Supabase). Si utilizas un usuario de base de datos personalizado, debes configurar explícitamente sus permisos y acceso con RLS antes de desplegar.

El bucket admite **JPEG, PNG y WebP hasta 5.000.000 bytes**. Sus fotos se pueden leer por URL pública; la API autoriza al administrador y firma las cargas con su clave de servidor. Una política restrictiva impide listar, subir, reemplazar o borrar sus objetos directamente con los roles `anon` y `authenticated`, incluso si existen políticas permisivas amplias para otros buckets. No cambia las políticas de acceso de los demás buckets. Si ya existe un bucket privado con ese nombre, el script falla y revierte la instalación; elige un nombre nuevo para evitar publicar contenido privado.

La creación de buckets mediante SQL está documentada por [Supabase](https://supabase.com/docs/guides/storage/buckets/creating-buckets). Los archivos se administran con la API de Storage; no insertes ni borres filas de `storage.objects` a mano. Las claves de servicio permiten a la API omitir RLS y deben permanecer exclusivamente en el servidor, según la [documentación de acceso de Storage](https://supabase.com/docs/guides/storage/security/access-control).

## 2. Crear el primer administrador

1. En **Authentication → Users**, crea el usuario con su email y contraseña, o invítalo y completa la invitación.
2. Abre `02_first_admin.sql` y cambia el correo solo en la línea `admin_email text := 'CAMBIA_POR_TU_CORREO';`. Por ejemplo: `admin_email text := 'lamouroux7@gmail.com';`. No uses “reemplazar todo”, porque cambiaría el mensaje de ejemplo junto con el correo.
3. Ejecuta el archivo completo. Si el usuario no existe, recibirás un error explícito.

El script asigna `administrator` y activa la cuenta dentro de UniFlow. Repetirlo no duplica el rol ni el evento de auditoría si la asignación ya estaba activa. No crea usuarios de Auth ni establece contraseñas por SQL. Después del primer acceso a `/personal`, invita al resto del equipo desde el panel.

## 3. Verificar y conectar la aplicación

Despues de aplicar la migracion `StockReservations` y ejecutar `04_stock_reservations_rls.sql`, ejecuta `03_verify.sql`. Todos los controles del primer resultado deben indicar `ok = true`. Los pendientes operativos pueden aparecer como `false` hasta que configures el panel; estas consultas no certifican una conexion de la API ni prueban el envio de correos.

Completa tu `.env` con los datos de **tu proyecto**:

```dotenv
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_ONLY_SERVICE_ROLE_KEY
SUPABASE_DB_CONNECTION="Host=YOUR_DATABASE_HOST;Port=5432;Database=postgres;Username=YOUR_DATABASE_USER;Password=YOUR_DATABASE_PASSWORD;SSL Mode=Require"
SUPABASE_PRODUCT_BUCKET=uniflow-images
MIGRATE_ON_STARTUP=false
ENSURE_STORAGE_BUCKET_ON_STARTUP=true
```

Obten el host, puerto y usuario de **Connect** en Supabase. Usa conexion directa o **session pooler** para migraciones; la contrasena es la de PostgreSQL del proyecto. La aplicacion utiliza el formato **Npgsql** mostrado arriba. `01_setup.sql` aplica las cinco migraciones base; la migracion `StockReservations` debe aplicarse una vez por el flujo EF elegido y protegerse con `04_stock_reservations_rls.sql`. No dejes las migraciones automaticas habilitadas sin un flujo de despliegue controlado. La API comprueba el bucket al iniciar.

Configura también desde el Dashboard; estos ajustes no los crean los scripts SQL:

- Una clave de firma de Auth activa **ES256 o RS256**, compatible con la validación JWKS de esta API. Consulta [Supabase Auth signing keys](https://supabase.com/docs/guides/auth/signing-keys).
- **Site URL** y la lista de redirecciones de Auth: tu origen de UniFlow y su ruta `/personal` (localmente, `http://localhost:8080/personal`). Configura `APP_PUBLIC_URL` y `ALLOWED_ORIGINS` con el mismo origen.
- Entrega de emails/SMTP para invitaciones. El primer usuario creado con contraseña puede iniciar sesión sin depender de una invitación pendiente.
- Un límite global de Storage igual o mayor que 5.000.000 bytes.

Después ejecuta `docker compose up --build -d` y comprueba `/api/v1/health` a través del servidor de UniFlow. Desde el panel configura el nombre del punto, anticipación mínima, horarios/excepciones, categorías/productos con precios COP y franjas con capacidades reales. Revisa la pausa de pedidos antes del piloto. El SQL no inventa estos valores ni inserta pedidos de prueba.

## Mantener el esquema

La sección marcada **INICIO EF / FIN EF** de `01_setup.sql` procede de:

```powershell
dotnet ef migrations script --idempotent --no-transactions --project api/UniFlow.Infrastructure --startup-project api/UniFlow.Api --output schema-generado.sql
```

Al añadir migraciones, regenera esa sección y conserva el envoltorio transaccional y las secciones de seguridad/Storage. No sobrescribas `01_setup.sql` directamente con ese comando: perderías esas secciones. Los cambios del modelo deben tener su correspondiente migración EF; no añadas columnas solo por SQL.

Durante esta preparación se encontraron credenciales reales en `.env.example` y se reemplazaron por marcadores. Rota la clave privilegiada y la contraseña PostgreSQL que estaban en esa plantilla y actualiza tu `.env`; las copias anteriores de la plantilla pueden seguir conteniéndolas. La plantilla pública debe conservar solo marcadores.


## Alerta RLS de stock_reservations

La migracion `20261107182512_StockReservations` crea `public.stock_reservations`. En bases existentes, cuando la tabla exista, ejecuta `04_stock_reservations_rls.sql` completo desde el SQL Editor de Supabase con el rol `postgres`. Esto habilita RLS, revoca permisos directos a `anon`, `authenticated` y `PUBLIC`, y agrega una politica restrictiva que deniega acceso desde PostgREST. La API continua operando mediante su conexion PostgreSQL de servidor; no agregues politicas publicas para esta tabla.

El `01_setup.sql` reejecutable tambien aplica esa proteccion cuando la tabla ya existe, y la migracion del backend la aplica al crearla en una instalacion nueva. `03_verify.sql` confirma las seis migraciones y que las doce tablas (incluido el historial EF) tengan RLS y acceso de navegador bloqueado.
