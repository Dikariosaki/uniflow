# Despliegue de pruebas en Render

El repositorio incluye [`render.yaml`](render.yaml), un Blueprint con dos servicios Docker gratuitos en Virginia: la API ASP.NET Core y el frontend Angular servido por Nginx. Cada servicio tiene su propio `onrender.com`; no necesitas comprar ni configurar un dominio. El frontend apunta directamente a la URL pública de la API y la API habilita CORS únicamente para la URL del frontend.

## Antes de desplegar

1. Sube esta rama a un repositorio Git que puedas conectar desde Render.
2. Confirma que el proyecto de Supabase tiene aplicados el esquema de `supabase/01_setup.sql`, el bootstrap del administrador y la configuración de Auth que necesitas. El Blueprint no ejecuta cambios destructivos ni inventa horarios o productos.
3. En Supabase, prepara la cadena PostgreSQL usando los datos de **Connect → Session pooler** si el host directo no es accesible desde Render. Formato para Npgsql:

   ```text
   Host=HOST_DEL_POOLER;Port=PUERTO;Database=postgres;Username=USUARIO_DEL_POOLER;Password=CONTRASEÑA;SSL Mode=Require
   ```

   Introduce los valores reales en el formulario de Render, nunca en `render.yaml` ni en el repositorio.

## Crear los servicios

1. En Render selecciona **New → Blueprint** y conecta el repositorio y rama.
2. Render detectará `render.yaml`. Verifica que la raíz seleccionada sea la raíz del repositorio para que las rutas Docker sean correctas.
3. Cuando Render lo solicite, completa estos valores secretos del servicio `uniflow-api`:
   - `ConnectionStrings__Supabase`: cadena Npgsql anterior.
   - `Supabase__Url`: URL `https://<project-ref>.supabase.co`.
   - `Supabase__AnonKey`: clave pública anon/publishable del proyecto.
   - `Supabase__ServiceRoleKey`: clave secreta de servidor (service role/secret key).
4. Aplica y espera que ambos servicios estén `Live`. Puedes desplegar otra vez desde el panel después de cambiar variables.

La API recibe su puerto público desde `PORT` de Render; Nginx también escucha en ese puerto. Los Dockerfiles están configurados para aceptar esos puertos y sus health checks consultan `/health` y `/`, respectivamente. El servicio web recibe la URL del API y las variables públicas de Supabase desde las referencias del Blueprint; el navegador nunca recibe la clave service role ni la cadena de base de datos.

## Terminar Auth y comprobar

Después del primer despliegue, copia la URL `https://...onrender.com` de `uniflow-web` y en Supabase abre **Authentication → URL Configuration**:

- `Site URL`: URL completa de `uniflow-web`.
- `Redirect URLs`: agrega la URL completa de `uniflow-web/personal`.

Comprueba la web en la URL `onrender.com` del servicio web; la API tiene su propia URL y Swagger en `/swagger/`. `/health` reporta disponibilidad de la base de datos. Para una prueba real, verifica inicio de sesión, catálogo, creación de pedido, cambios de estado y actualización de la cola. Los servicios gratuitos pueden entrar en reposo tras inactividad y demorar en la primera petición al reactivarse.

## Notas de prueba

- `Database__MigrateOnStartup=false`: se espera que el SQL/esquema ya se haya aplicado desde Supabase. Para migraciones futuras, aplícalas de forma controlada y mantén esta variable apagada en el servicio web público.
- `Storage__EnsureBucketOnStartup=true`: la API valida/crea el bucket `uniflow-images` con su clave de servicio.
- `Swagger__Enabled=true` facilita pruebas, pero deja la documentación accesible públicamente. Desactívalo desde las variables de entorno al cerrar la etapa de pruebas.
- Los horarios, capacidad, productos y stock se configuran desde el panel UniFlow; el despliegue no añade datos operativos de demostración a tu proyecto Supabase.
- La aplicación requiere conexión para confirmar pedidos. HTTPS lo proporciona Render en los dominios `onrender.com`.
