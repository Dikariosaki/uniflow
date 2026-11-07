# Verificación de aceptación de UniFlow

La suite usa Chromium con Playwright, axe y una instancia real y aislada de Supabase CLI. PostgreSQL, Auth, correo local y Storage se ejecutan fuera de los servicios web/API de Compose. No usa respuestas simuladas para aceptar pedidos, autenticar personal o subir fotos.

Antes de ejecutar Playwright, el comando `test` comprueba las dependencias de los cuatro proyectos del backend y los límites de las siete ramas del frontend. También puedes ejecutar esa comprobación por separado con `npm --prefix verification run check:architecture`; produce `artifacts/architecture-check.json`.

`npm --prefix verification run check:backend` comprueba la conversión de conexiones URI/Npgsql, el manejo de contraseñas codificadas y que un fallo de SignalR posterior al commit no invalide un pedido persistido. Requiere .NET 10 y también se ejecuta con `npm --prefix verification test`. La configuración de aceptación usa una URI de PostgreSQL contra Supabase local para probar ese formato en el contenedor real. Swagger está disponible en `http://localhost:8088/swagger/` y directamente en `http://localhost:8089/swagger/`.

La suite reinicia exclusivamente `uniflow-verification-api-1` antes de comenzar para limpiar el limitador de solicitudes que la última prueba agota deliberadamente. No reinicia la API principal ni modifica el Supabase hospedado. Espera a que termine una ejecución antes de iniciar la siguiente o reconstruir los contenedores de verificación.

## Ejecutar desde la raíz del repositorio

Requisitos: Docker Desktop activo, Node 26 y acceso a Internet para descargar las dependencias e imágenes la primera vez.

```powershell
npm --prefix verification ci
npm --prefix verification run supabase:start
npm --prefix verification run prepare:local
docker compose -p uniflow-verification --env-file verification/.env -f docker-compose.yml -f verification/compose.yml up --build -d --wait
npx --prefix verification playwright install chromium
npm --prefix verification test
```

La URL de la aplicación de verificación es <http://localhost:8088>. El proyecto Compose `uniflow-verification` tiene contenedores y red propios, sin reemplazar la aplicación principal del puerto 8080. Las credenciales del administrador ficticio de la última ejecución se guardan en `verification/artifacts/local-access.json`, excluido de Git. `verification/.env` también es generado y excluido de Git. La configuración principal para un proyecto alojado sigue siendo `.env.example`.

La suite reinicia los datos de aplicación del proyecto local `verification`, crea usuarios ficticios y configura precios, horarios y capacidades de prueba. Está restringida a Supabase en `127.0.0.1:54321` y PostgreSQL en `127.0.0.1:54322`. Usa este entorno exclusivamente para aceptación. El override de Compose habilita HTTP para las claves públicas de Auth local y amplía el límite de solicitudes durante la suite; la configuración principal mantiene el entorno Production.

## Evidencia y alcance

- `artifacts/results.json`: resultados completos de Playwright.
- `artifacts/*.png`: capturas de menú, carrito, recogida, seguimiento y paneles a distintos anchos.
- `playwright-report/index.html`: informe navegable.
- `test-results/`: trazas y capturas de los fallos, si los hay.
- `evidence.json` y `acceptance-report.md`: resumen reproducible y hashes de los archivos verificados; se generan con `npm --prefix verification run report` después de una ejecución completa satisfactoria.

Se revisan 360, 390, 768 y 1440 px para los flujos públicos y 360, 768 y 1440 px para los paneles. Las comprobaciones de axe y teclado cubren los estados incluidos en la suite; no sustituyen una auditoría manual completa de accesibilidad ni pruebas en dispositivos físicos. La conexión se verifica contra Supabase local real configurado como dependencia externa de Compose. Un proyecto alojado requiere sus propias credenciales y configuración de correo/orígenes.

Las invitaciones se entregan exclusivamente al servidor de correo local (Mailpit), disponible en <http://127.0.0.1:54324>.

## Detener el entorno

```powershell
docker compose -p uniflow-verification --env-file verification/.env -f docker-compose.yml -f verification/compose.yml down
npm --prefix verification run supabase:stop
```

Supabase CLI conserva una copia local de los datos al detenerse.
# Verify the Supabase SQL installer

After starting the isolated local Supabase stack and preparing `verification/.env`, run `npm --prefix verification run check:sql`. This creates a temporary database, Auth user, and Storage bucket; checks fresh installation, idempotency, permissions, administrator bootstrap, and real signed uploads; then cleans up its temporary resources. It never reads the root `.env` or contacts the hosted project. Results and script hashes are recorded in [supabase/verification.md](../supabase/verification.md).

