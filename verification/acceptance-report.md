# UniFlow: aceptación del MVP

Verificado: 2026-11-07T14:32:05.533Z.

18 escenarios aprobados contra PostgreSQL, Supabase Auth y Supabase Storage reales en un proyecto CLI local aislado. Web y API están construidos con Docker y saludables; la API confirma conexión con la base de datos.

## Arquitectura comprobada

Cuatro proyectos de backend con dependencias hacia las capas internas; Domain y Application sin paquetes de web o persistencia. Siete ramas de frontend, diez páginas con carga diferida y entradas públicas entre funcionalidades. La comprobación ejecutable se encuentra en [check-architecture.mjs](check-architecture.mjs), y las responsabilidades en [ARCHITECTURE.md](../ARCHITECTURE.md).

## Escenarios

| Escenario | Resultado |
| --- | --- |
| order snapshots, COP totals, private receipt, UTC dates and audit persist | Aprobado |
| sold out, inactive category and changed price reject stale carts | Aprobado |
| last capacity is atomic under simultaneous requests and ASAP chooses next viable slot | Aprobado |
| concurrent and repeated idempotency keys return one order, mismatched payload conflicts | Aprobado |
| closed, paused, minimum notice, missing scheduled slot and dated exceptions are enforced | Aprobado |
| privacy, JWT signature/issuer/audience/expiry and staff roles protect all surfaces | Aprobado |
| status transition locking, code verification, delivery actor/time and cancellation capacity | Aprobado |
| protected real Storage upload, public product image, MIME and size limits | Aprobado |
| administration, schedule validation, overlapping capacity, reporting, pagination and audit | Aprobado |
| administrator UI persists catalog, availability, photo, schedule and Bogotá pickup slots | Aprobado |
| staff invitation uses real local Auth and role changes revoke operation access | Aprobado |
| real browser menu → cart → pickup → receipt, SignalR update and polling fallback | Aprobado |
| offline PWA shell blocks confirmation and refreshes catalog and slots on reconnect | Aprobado |
| responsive student and staff screens, keyboard focus, modal and WCAG 2.2 AA states | Aprobado |
| SignalR groups isolate customer orders and reject broadcasts to unknown staff | Aprobado |
| leaving the operator queue cancels pending connection startup | Aprobado |
| leaving tracking cancels pending connection startup | Aprobado |
| public rate limit rejects excess traffic and cannot be bypassed through forwarded headers | Aprobado |

## Evidencia

- [Suite ejecutable](tests/acceptance.spec.mjs), [configuración](playwright.config.mjs) y [comandos para repetirla](README.md).
- [Estado de contenedores, migraciones aplicadas, RLS y hashes de fuentes](evidence.json).
- [Resultado completo de Playwright](artifacts/results.json), capturas en `artifacts/` e informe en `playwright-report/index.html` (generados localmente y excluidos de Git).
- Menú, carrito y selección de recogida: 360, 390, 768 y 1440 px. Paneles: 360, 768 y 1440 px.
- Comprobaciones automáticas de contraste, etiquetas y teclado, además de revisión de capturas con el diseño de referencia. Las pruebas no certifican cumplimiento integral de WCAG ni representan dispositivos físicos.
- Las claves y contraseñas del entorno se mantienen fuera de este informe.

## Despliegue alojado

La verificación usa Supabase local como dependencia externa de Compose. No se configuró ni modificó un proyecto alojado. Sus credenciales, correo, dominio HTTPS, horarios y capacidades reales corresponden a la configuración de cada despliegue descrita en el [README principal](../README.md).
