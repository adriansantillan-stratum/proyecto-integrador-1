# Calidad técnica para entrega del 27 de octubre de 2026

Resultado: **234 pruebas aprobadas, 0 fallidas y 26 omitidas**, de 260 descubiertas en las ejecuciones finales. No constituye validación productiva ni aceptación empresarial.

| Componente | Aprobadas | Fallidas | Omitidas | Motivo de omisión |
|---|---:|---:|---:|---|
| Backend | 88 | 0 | 18 | Testcontainers: Docker Linux no disponible |
| Web | 62 | 0 | 0 | — |
| Flutter | 84 | 0 | 8 | Contrato con servicios vivos deshabilitado por opt-in |

Los comandos Gradle test, Node test, ESLint, TypeScript, Vite build, Flutter analyze y Flutter test terminaron con código 0. Flutter analyze: **No issues found**. Vite advirtió de un bundle JavaScript de 755,83 kB minificado / 241,82 kB gzip; no se aplicaron cambios al producto.

| Ejecución | Estado | Código | Inicio UTC | Fin UTC |
|---|---|---:|---|---|
| Backend Gradle test | PASS | 0 | 2026-10-27T13:08:54.914749+00:00 | 2026-10-27T13:09:18.975036+00:00 |
| Web Node test | PASS | 0 | 2026-10-27T13:10:17.259641+00:00 | 2026-10-27T13:10:17.710584+00:00 |
| Web ESLint | PASS | 0 | 2026-10-27T13:08:55.609749+00:00 | 2026-10-27T13:09:12.939788+00:00 |
| Web TypeScript | PASS | 0 | 2026-10-27T13:09:12.940795+00:00 | 2026-10-27T13:09:17.282808+00:00 |
| Web Vite build | PASS | 0 | 2026-10-27T13:09:17.284807+00:00 | 2026-10-27T13:09:25.101335+00:00 |
| Flutter analyze | PASS | 0 | 2026-10-27T13:09:32.789896+00:00 | 2026-10-27T13:10:06.716444+00:00 |
| Flutter test | PASS | 0 | 2026-10-27T13:10:06.717444+00:00 | 2026-10-27T13:10:22.055589+00:00 |

UTC corresponde a Lima +5 horas. La ejecución principal comenzó a las 13:08:25 UTC (08:08:25 Lima). Las horas exactas y duraciones están en cada JSON. La revisión de Docker solicitada después se realizó a las 13:12:06 UTC, con `sandbox_permissions=require_escalated`: `docker context show` devolvió `desktop-linux` (0); `docker ps` y `docker version` devolvieron 1 porque no existe el pipe `dockerDesktopLinuxEngine`. La consulta inicial y las pruebas también usaron ejecución escalada. El bloqueo se refiere al motor configurado, no se deduce de una denegación del sandbox. No se inició Docker Desktop ni se alteraron contenedores existentes. Las 18 integraciones quedan pendientes.

Las 18 omisiones del backend corresponden a OrderControllerIntegrationTest (1), R2dbcAnalyticsGpsQualityIntegrationTest (7) y R2dbcAnalyticsIntegrationTest (10), conservando sus anotaciones originales `disabledWithoutDocker=true`.

Se ejecutó backend en paralelo con web, con máximo dos suites; Flutter se inició después de terminar Gradle. Las compilaciones usaron copias en Temp verificadas por SHA-256; no se ejecutó la app ni un emulador, no se accedió a datos vivos, no se abrió `.env`, no se invocó Git y no se modificaron fuentes originales. El preflight solo recogió nombres/PID y puertos, sin argumentos de procesos. La ausencia de listeners solo se refiere a los puertos consultados y ese momento.

Herramientas: Temurin Java 17.0.17; Gradle wrapper 8.5; Node 24.22.1 y Python 3.12.14 bundled 26.1025.11240; Flutter 3.41.4 / Dart 3.11.1 mediante el SDK indicado. Las versiones instaladas de web están en dependency_versions.json. Gradle y Flutter resolvieron dependencias sin red. Los comandos web reproducen los scripts de package.json mediante Node bundled: `node --test tests/*.test.mjs`, `node node_modules/eslint/bin/eslint.js .`, y `node node_modules/typescript/bin/tsc -b` seguido de `node node_modules/vite/bin/vite.js build`.

| Fuentes de la copia ensayada | Archivos | SHA-256 agregado |
|---|---:|---|
| backend | 206 | `e276adbc402450796ac3881377859accaff5c5f64ed891c00a3686999954955d` |
| web-admin | 114 | `15f39947e31bbc0bda2449621c7ea731cd820e18b08619fa87ab4411ccf61ed7` |
| mobile-app | 195 | `c54345610b994329d652fd21f400c7a7a84855dbc8549a0397e5248ee85fa94c` |

El fixture compartido tools/control_actualizacion/analytics_gps_contract.json también se verificó: `7cccf3276bea2b54db2124131c28d87361e5f761a32a3d1082eda0facc15fc13`. Los hashes por archivo están en tested_sources.json; el algoritmo agregado está en quality_summary.json. source_integrity_after.json compara las fuentes originales después de las pruebas; tested_copy_integrity_after.json registra posibles cambios de metadatos generados en Temp.

El primer intento web falló por una omisión del verificador al copiar el fixture externo (46 pruebas aprobadas y un archivo de prueba sin cargar). Se conservan web_test_initial_copy_incomplete.json/log. Se completó la copia desde el fixture original, se verificaron de nuevo los hashes y se repitió la suite sin alterar código: 62/62. No se presenta ese intento incompleto como fallo del producto.

**QA anterior de la guía: pendiente de asignación.** Existen 113 PNG de páginas, pero faltan qa_pages_001_045.json y qa_pages_046_090.json en docs/guia_total_ide/_qa. No se realizó ni se afirma revisión visual de esas páginas. Se avisa para asignarla aparte y evitar duplicar trabajo.

No ejecutado: las 18 integraciones Docker, los 8 contratos móviles con servicios vivos, pruebas de dispositivo/emulador/UI end-to-end, aceptación empresarial, validación productiva y QA visual de la guía. Los reportes describen la instantánea verificada y no prueban un despliegue ni una sesión de IDE actual.

Evidencia principal: [quality_summary.json](quality_summary.json), [backend_test.json](backend_test.json), [web_test.json](web_test.json), [flutter_test.json](flutter_test.json), [docker_recheck.json](docker_recheck.json) y [previous_guide_qa.json](previous_guide_qa.json). Los logs están sanitizados; no se adjuntan los XML/HTML brutos de las herramientas.
