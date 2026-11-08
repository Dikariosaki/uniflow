# Despliegue de UniFlow en Render

UniFlow se despliega como **dos Web Services Docker independientes** conectados al mismo repositorio:

| Servicio | Función | Dockerfile | Contexto Docker | Health check |
| --- | --- | --- | --- | --- |
| `uniflow-api` | API ASP.NET Core, Swagger y SignalR | `api/UniFlow.Api/Dockerfile` | `api` | `/health` |
| `uniflow-web` | Angular servido por Nginx | `web/Dockerfile` | `web` | `/` |

La base de datos y Storage siguen en Supabase. Render no ejecuta Supabase ni se debe desplegar aquí una base de datos local. Las rutas de Docker son relativas a la **raíz del repositorio**. Deja `Root Directory` vacío en ambos servicios.

## Crear dos Web Services Free manualmente

El despliegue se hará creando **dos servicios por separado desde `New → Web Service`**, seleccionando el plan `Free` en cada uno. No uses Blueprint para este despliegue. Primero crea `uniflow-api` y después `uniflow-web`, siguiendo las instrucciones de cada servicio más abajo. Ambos se conectan al mismo repositorio y rama, pero cada servicio construye su propio Dockerfile.

Las plantillas [`.env.backend.example`](.env.backend.example) y [`.env.frontend.example`](.env.frontend.example) separan las variables por servicio. En Render no se suben esos archivos: agrega cada variable desde **Environment** en el Web Service correspondiente y reemplaza los valores de ejemplo por los valores reales.

Antes de empezar, confirma que el repositorio GitHub está conectado a Render y que el proyecto Supabase ya tiene el esquema y los usuarios configurados. Ten a mano las credenciales actuales de Supabase; no las guardes en Git ni las envíes al servicio web.

## 1. Crear el Web Service de la API

En Render selecciona **New → Web Service**, conecta `Dikariosaki/uniflow` y configura:

| Campo en Render | Valor |
| --- | --- |
| Name | `uniflow-api` |
| Branch | `main` (o la rama que vas a desplegar) |
| Language / Runtime | `Docker` |
| Region | `Virginia`, para mantenerlo cerca de Supabase us-east-1 |
| Root Directory | Vacío, raíz del repositorio |
| Dockerfile Path | `api/UniFlow.Api/Dockerfile` |
| Docker Build Context Directory | `api` |
| Health Check Path | `/health` |
| Instance Type | `Free` para pruebas |

No configures un Docker Command que reemplace el `ENTRYPOINT` de la imagen. El contenedor toma el puerto de `PORT` y escucha en `0.0.0.0`.

En **Environment → Environment Variables** agrega estas variables al servicio API:

| Variable | Valor | Sensible |
| --- | --- | --- |
| `ASPNETCORE_ENVIRONMENT` | `Production` | No |
| `ConnectionStrings__Supabase` | Cadena Npgsql del Session Pooler de Supabase, ver abajo | **Sí** |
| `Supabase__Url` | `https://<project-ref>.supabase.co` | No |
| `Supabase__AnonKey` | Clave pública anon/publishable del proyecto | No |
| `Supabase__ServiceRoleKey` | Clave secreta de servidor (service role/secret key) | **Sí** |
| `Supabase__JwtAudience` | `authenticated` | No |
| `Supabase__ProductBucket` | `uniflow-images` | No |
| `Database__MigrateOnStartup` | `false` | No |
| `Storage__EnsureBucketOnStartup` | `true` | No |
| `Swagger__Enabled` | `true` durante pruebas | No |
| `RateLimiting__PublicRequestsPerMinute` | `30` | No |
| `AllowedOrigins` | URL final del frontend, por ejemplo `https://uniflow-web.onrender.com` | No |
| `App__PublicUrl` | La misma URL final del frontend | No |

En `ConnectionStrings__Supabase`, usa **Supabase → Connect → Session pooler** y coloca los valores reales en Render:

```text
Host=<host-del-pooler>;Port=<puerto>;Database=postgres;Username=<usuario-del-pooler>;Password=<contraseña-actual>;SSL Mode=Require
```

No compartas la contraseña ni la clave service role. No pongas ninguna de esas dos variables en el frontend. `AllowedOrigins` y `App__PublicUrl` deben ser el origen exacto del frontend: con `https://`, sin ruta y sin `/` final. Si aún no existe el frontend, crea primero la API con estos dos valores pendientes y complétalos después de crear el servicio web.

Pulsa **Create Web Service** y revisa los logs hasta que el despliegue quede `Live`. Después verifica `https://<url-api>/health` y `https://<url-api>/swagger/`.

## 2. Crear el Web Service del frontend

En Render selecciona **New → Web Service**, conecta el mismo repositorio y configura:

| Campo en Render | Valor |
| --- | --- |
| Name | `uniflow-web` |
| Branch | La misma rama de la API |
| Language / Runtime | `Docker` |
| Region | `Virginia` |
| Root Directory | Vacío, raíz del repositorio |
| Dockerfile Path | `web/Dockerfile` |
| Docker Build Context Directory | `web` |
| Health Check Path | `/` |
| Instance Type | `Free` para pruebas |

Agrega estas variables al servicio web:

| Variable | Valor |
| --- | --- |
| `APP_PUBLIC_URL` | URL pública del frontend, por ejemplo `https://uniflow-web.onrender.com` |
| `API_BASE_URL` | Origen público de la API, por ejemplo `https://uniflow-api.onrender.com`; no agregues `/api` |
| `SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `SUPABASE_ANON_KEY` | Clave pública anon/publishable |

El entrypoint de Nginx agrega `/api` al `API_BASE_URL` cuando hace falta. El frontend no necesita la cadena de conexión de PostgreSQL ni `Supabase__ServiceRoleKey`. Si Render asigna URLs distintas a los ejemplos, usa las URLs reales que muestra el panel.

Pulsa **Create Web Service** y espera a que quede `Live`. Abre la URL pública del frontend y confirma que carga el menú.

## 3. CORS y Supabase Auth

Una vez conocidas las dos URLs definitivas:

1. En `uniflow-api`, configura `AllowedOrigins` con la URL raíz de `uniflow-web`, y `App__PublicUrl` con esa misma URL. Guarda los cambios y despliega de nuevo la API.
2. En Supabase abre **Authentication → URL Configuration**. Configura `Site URL` con la URL raíz de `uniflow-web`.
3. En `Redirect URLs`, agrega `https://<url-frontend>/personal` y cualquier otra ruta de retorno usada por el flujo de autenticación. Mantén solo URLs de confianza.
4. Comprueba que el servicio web tenga `SUPABASE_URL` y `SUPABASE_ANON_KEY`, y que el backend tenga las credenciales privadas.

Si cambias el nombre o dominio de un servicio, actualiza las URLs correspondientes en ambos servicios, CORS y Supabase Auth.

## 4. Verificación del despliegue

- `https://<url-api>/health` responde correctamente y la API puede conectarse a Supabase.
- `https://<url-api>/swagger/` muestra Swagger mientras `Swagger__Enabled=true`.
- `https://<url-frontend>/` carga Angular sin errores de configuración.
- El personal puede iniciar sesión y abrir el panel administrativo.
- Se puede consultar el catálogo, crear un pedido, recibir cambios de estado por SignalR y recuperar el seguimiento mediante consulta periódica.
- Una imagen pública de producto carga desde Supabase Storage; la carga administrativa de imágenes pasa por el endpoint protegido.
- En la consola del navegador, las llamadas API usan la URL de `uniflow-api` y no presentan errores CORS.

## Consideraciones de prueba

- `Database__MigrateOnStartup=false` asume que ya ejecutaste el SQL/migraciones requeridos en Supabase. El arranque público no modifica destructivamente la base.
- `Storage__EnsureBucketOnStartup=true` permite a la API validar o crear el bucket `uniflow-images` usando la clave de servicio.
- Swagger público ayuda durante la prueba. Pon `Swagger__Enabled=false` cuando no quieras exponer la documentación del API.
- Los servicios Free se suspenden tras 15 minutos sin tráfico y pueden tardar alrededor de un minuto en reactivarse. Son adecuados para pruebas, no para una experiencia de producción siempre disponible. [Limitaciones de Free en Render](https://render.com/docs/free)
- Render requiere que cada Web Service escuche en `0.0.0.0` y en el puerto definido por `PORT`; ambos Docker entrypoints del proyecto ya usan ese puerto. [Docker en Render](https://render.com/docs/docker) y [variables de entorno de Render](https://render.com/docs/environment-variables)
- Render hace solicitudes al health check para validar el estado del servicio. Si el API falla en `/health`, revisa primero la conexión y credenciales de Supabase. [Health checks de Render](https://render.com/docs/health-checks)
