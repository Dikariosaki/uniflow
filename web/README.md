# UniFlow web

Cliente Angular de UniFlow: menú y pedidos para estudiantes, seguimiento privado y paneles del personal. El sistema visual se basa en las referencias Campus Bento Modern incluidas en el repositorio.

El código está organizado por ramas funcionales bajo `src/app/features/`: acceso, catálogo, pedidos, seguimiento, operación de pedidos, administración de catálogo y administración operativa. Cada rama contiene sus páginas y estado/acceso a datos; `core`, `shared` y `layout` concentran el soporte común. Las diez páginas usan rutas con carga diferida. La estructura y sus límites están documentados en [ARCHITECTURE.md](../ARCHITECTURE.md).

## Desarrollo

Desde esta carpeta:

```powershell
npm ci
npm start
```

La aplicación abre en <http://localhost:4200>. `proxy.conf.json` dirige `/api` y `/hubs` a la API local en el puerto `5269`. Configura en `public/config.js` únicamente la URL y clave pública de Supabase y la ruta de la API. La base de datos y la clave privilegiada se configuran en el servidor; consulta el [README principal](../README.md).

## Compilación y despliegue

`npm run build` genera `dist/uniflow-web/browser/`. El Dockerfile usa esa compilación con Nginx y genera la configuración pública al arrancar el contenedor. Docker Compose, Supabase y el alta del primer administrador están documentados en el README principal.

## Verificación

La [suite de aceptación](../verification/README.md) ejecuta los flujos de navegador y las comprobaciones de accesibilidad contra una API y Supabase reales en un entorno local aislado. Incluye los estados de conexión, confirmación, carrito, seguimiento y paneles en distintos anchos.
