# Verificación SQL de Supabase

Ejecutada en UTC: 2026-11-07T14:57:04.599Z.

Entorno: Supabase local aislado (PostgreSQL en 127.0.0.1:54322; Auth/Storage en 127.0.0.1:54321). No se accedió al proyecto hospedado.

- Esquema desde cero: cinco migraciones, once tablas con RLS; segunda ejecución conserva datos.
- Restricciones de precio/cupo y protección de pedidos, roles e historial frente a anon/authenticated.
- Instalador completo repetido sobre Supabase real; bootstrap validado, auditable e idempotente; seis controles correctos.
- Un bucket privado preexistente provoca error y conserva su visibilidad.
- Storage real: cargas directas anon/authenticated bloqueadas incluso con política permisiva; carga firmada e imagen pública funcionan.

La base temporal, el usuario Auth y el bucket de prueba se eliminan al terminar. Las comprobaciones transaccionales sobre tablas existentes se revierten.

| Archivo | SHA-256 |
| --- | --- |
| 01_setup.sql | e979b32d63c19c247c960ef47862ca41e8b1033ff0b4f1996a92ddff781c82c5 |
| 02_first_admin.sql | 68ad818b820201bc0191b6602c3a95a4a6ee39ed91b2cd0388de2455d27fd97b |
| 03_verify.sql | 7d05eff6c9d844648a61367ad99e9b2f8c7cfcdd0bc1f1e6f5403a4d98f8ee4a |

Repetir con `npm --prefix verification run check:sql` después de iniciar el Supabase local y preparar `verification/.env`.
