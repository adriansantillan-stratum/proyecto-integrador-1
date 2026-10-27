# Correcciones web · 2026-10-19

## Alcance y evidencia

Implementación limitada a `web-admin/**`. Este informe se escribe en la ruta expresamente solicitada por el usuario. No se modificó backend, móvil, Word/PPT ni documentación de auditoría. Sin commits, borrado de datos, cambios de roles ni mutaciones operativas ejecutadas. No se delegó trabajo.

Se preservaron los cambios previos en nginx, mapa y servicios. El aprovisionamiento Keycloak y arranque backend son avisos del principal; no se presentan como pruebas ejecutadas por esta intervención. La UAT humana sigue pendiente.

## Archivos y cadenas funcionales

| Hallazgo / proceso | Archivos principales | Cadena implementada |
| --- | --- | --- |
| H01 / P01 | `web-admin/src/pages/Orders.tsx`, `services/orderService.ts` | Alta POST sin ruta → PATCH business-data sobre el ID creado → tres revisiones → PATCH route hacia PLANNED. Si falla el segundo paso, se conserva el ID y se reintenta sin recrear el pedido. |
| P01 comercial | `Orders.tsx`, `utils/operation.ts` | RUC opcional de once dígitos ASCII, separado de externalReference; aceptación, dirección y cobertura; nota de al menos cinco caracteres; actor/fecha del servidor. Borrador no asignable. Condiciones de despachados/cerrados de solo lectura. |
| Ciclo de pedido / H19 | `Orders.tsx`, `orderService.ts` | Catálogo de motivos y transiciones por estado; no hay cambio manual a DELIVERED ni simulación con receptor/DNI/firma ficticios; terminales de solo lectura. GET POD → GET photo/signature con Authorization y responseType blob → object URLs con limpieza. PDF autenticado del servidor. |
| P02 | `pages/Routes.tsx`, `services/routeService.ts` | Backlog PENDING paginado → asignación confirmada → revisión ADMIN con tres checks, peso positivo y nota → aceptación del conductor en móvil → despacho habilitado con ambas confirmaciones. Se informa invalidación por asignación. |
| H06 | `gpsService.ts`, `utils/gpsSubscription.ts`, `utils/gpsMessage.ts`, `Routes.tsx`, `vite.config.ts` | URL mismo origen /ws/gps → primer frame {vehicleId,accessToken} → validación de mensajes del vehículo. addEventListener conserva onopen del servicio. Polling comienza aun si nunca abre, se suprime al abrir, vuelve tras error/cierre y se limpia al desmontar. Proxy /ws también en Vite. |
| H13 | `utils/operation.ts`, `Routes.tsx`, `Dashboard.tsx` | Hoy/mañana con America/Lima; fecha/hora de ruta y ventanas de entrega con offset -05:00; fecha de CSV en Lima. |
| H14 | `Routes.tsx`, `TrackingMap.tsx` | GET path con origen GPS redondeado cuando existe → orderedOrderIds sin reordenamiento local → decodificación polyline5 → ajuste de viewport. Actualización del origen como máximo cada 15 s. Geometría alternativa etiquetada y sin promesa de tráfico. |
| H08/H09 | `Dashboard.tsx`, `Reports.tsx`, `hooks/useQuery.ts`, `services/dashboardService.ts`, `services/reportService.ts`, `components/EfficiencyTable.tsx` | Todas las fuentes analíticas reciben driverId/startDate/endDate; peticiones cancelables y errores por fuente; no mezcla resultados de filtros previos. Flota de hoy se etiqueta como sección operativa separada. Eficiencia es una fila por ruta. CSV conserva nulls, fuente y métricas. |
| BI P05/P06 | `pages/BusinessIntelligence.tsx`, `services/analyticsTypes.ts`, `utils/analytics.ts`, `components/AnalyticsChart.tsx` | GET reports/bi contrato 2026-10-19.1 → cinco vistas → KPI con numerador/denominador/meta/brecha/estado → CSV de período y tendencias. No se usa seed ni pretest como resultado live. |
| Metas | `BusinessIntelligence.tsx`, `reportService.ts` | GET/PUT reports/goals/IID, CHR, TDE, SUCCESS, ONTIME; 0..100 o null para eliminar. Se muestra actor/fecha del servidor. |
| P04 | `pages/Incidents.tsx`, `services/incidentService.ts` | GET/POST incidents; resolución RETRY/REPLAN para FAILED/RETURNED; CLOSE_FAILED solo ADMIN para esos estados; CLOSE_CASE solo ADMIN, incluido incidente general/disputa de entregado. Se muestra nuevo retryOrderId y ruta si los devuelve el servidor. Nunca se reabre el original. |
| P05 acciones | `components/ImprovementActions.tsx`, `services/improvementService.ts` | GET/POST improvement-actions → OPEN/IN_PROGRESS → VERIFIED con valor y nota por ADMIN, o DISCARDED por ADMIN. Cerradas de solo lectura. Base declarada de la acción separada de medición operativa. |
| H16 / P08 | `pages/Users.tsx`, `services/userService.ts`, `context/AuthContext.tsx`, `context/useAuth.ts`, `services/api.ts`, `ProtectedRoute.tsx` | Sesión GET session/me es fuente de roles/subject/driverId. UI espera resolución de sesión; reintento en error. GET identities; PUT roles/enabled; evita auto deshabilitación/retiro ADMIN. Registro /users anterior solo consulta con aviso de migración/410. No hay contraseñas hardcodeadas. |
| Notificaciones | `NotificationPanel.tsx`, `Sidebar.tsx` | Consultas solo para ADMIN/DISPATCHER; conteo y listado con errores visibles. No se afirma probado el worker/outbox/SQS desde web. |
| H17 | `tests/operation.test.mjs`, `tests/ui-readonly.mjs`, `package.json`, ajustes de Drivers/Vehicles/Purchases/Login/Charts | Tipos sin explicit any, sin desactivar reglas; errores reales de CRUD existentes; corrección de efectos/contexto; pruebas unitarias y QA visual aislada. |

## Nuevas pantallas, rutas y estados

* `/orders`: alta sin ruta, revisión comercial, asignación posterior, motivos/transiciones y POD de solo lectura. Ventana de entrega opcional en alta, capturada en Lima; si se registra un extremo, se exige el otro y orden temporal válido. CSV con plantilla de cabecera de once columnas; informa validación integral y rollback ante una fila inválida.
* `/routes`: hoy/mañana/histórico Lima, recursos activos/disponibles, revisión administrativa, aceptación móvil pendiente/aprobada, mapa y backlog paginado de diez pedidos.
* `/dashboard`: cuatro fuentes de gráficos y flota operativa actual, ADMIN acorde al backend.
* `/reports`: resumen, entregas por conductor y tabla/CSV por ruta.
* `/bi`: Tendencias (cinco gráficos), Causas (cuatro), Cumplimiento (cuatro), Calidad (cuatro), Eficiencia (cuatro y tabla), Metas y Acciones P05; ADMIN según /reports.
* `/incidents`: registro, pendientes/resueltas, catálogo de motivos, decisión y nuevo intento; ADMIN/DISPATCHER.
* `/improvement-actions`: acceso directo a acciones P05 para ADMIN/DISPATCHER; también se incluyen como pestaña de BI.
* `/users`: identidades Keycloak, habilitación, roles/conductor, error 503 visible y registro anterior para migración; ADMIN.

P09 se conserva como CRUD de compras. La revisión y aprobación presupuestaria es un control humano, no una aprobación automática implementada. No se declara P09 end-to-end cerrado.

## Contratos consumidos y límites

Se leyó íntegro `tools/audit_e2e/analytics_api_contract.json` y se tipó su respuesta exacta. Se revisaron los DTO/controladores Java de sesión, P01, P02, identidades y BusinessOperations para ajustar la UI al contrato realmente escrito.

* P01: GET/PATCH `/orders/{id}/business-data` con RUC, tres checks, nota; confirmedBy/confirmedAt son respuesta del servidor. Alta sin routeId. Ningún actor de confirmación se fabrica en cliente.
* P02: POST review con capacityVerified/windowsVerified/vehicleChecked, loadWeightKg y note; GET review con estados, actores y fechas. La web no llama acceptance ni suplanta al conductor.
* P04: servidor crea nuevo pedido IN_TRANSIT al RETRY en ruta activa o ASSIGNED al REPLAN en PLANNED; respuesta incluye retryOrderId. Replanificación exige nueva aceptación comercial; original inmutable.
* P05: `GET/POST /improvement-actions`, `PATCH /improvement-actions/{id}`; se respeta la regla del código de que descartar también requiere ADMIN y verificar requiere pasar por IN_PROGRESS.
* P08: contrato identities exacto; fallos 503 no se sustituyen por roles locales.
* Eficiencia: GPS_HAVERSINE o UNAVAILABLE; kmPerDelivery es km GPS/entregados; timePerStopMin incluye desplazamiento/espera y no es tiempo de servicio. No se sustituye distancia real por planificada.
* KPI sin denominador → null/NO_DATA. TDE usa foto O firma y se diferencia de POD completo. Los controles de calidad se solapan; causas cuentan eventos, no pedidos distintos. No hay comparación causal pre/post.
* Pendiente de contrato: edición de ventana de entrega en un pedido existente/nuevo intento REPLAN. La creación acepta estimatedDeliveryWindowStart/End, pero la API P01 de revisión no permite actualizarlos. La UI muestra la ventana existente, permite registrarla en alta y no finge guardar una ventana de replanificación. Propuesta para principal: PATCH `/orders/{id}/delivery-window` con ambos timestamps y motivo, validación de estado/propiedad e invalidación de revisión de ruta.

## Pruebas realmente ejecutadas

Runtime: Node bundled `C:/Users/USUARIO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe`, v24.19.0. No se instalaron dependencias ni se generaron Word/PPT.

1. Línea base ESLint: 34 errores / 4 advertencias. Después de las correcciones, `node node_modules/typescript/bin/tsc -b` y `node node_modules/eslint/bin/eslint.js .`: exit 0, sin errores ni advertencias en las ejecuciones realizadas. No se desactivó ninguna regla.
2. `node --test tests/operation.test.mjs`: **15/15 aprobadas**, cero omitidas/fallos. Casos: 04:59:59Z/05:00Z de Lima; cambios mes/año y bisiesto; polyline estándar y malformada; RUC opcional/ASCII; tres checks independientes; asignación y terminales; filtros completos/rango inválido; motivo real HTTP y 503; CSV comillas/saltos/formulas/null; semántica de CSV por ruta/BI; mensajes GPS inválidos/ajenos; fallback WS antes de abrir, después de error/cierre, callback de autenticación preservado y cleanup.
3. Comprobación final conjunta: `node node_modules/typescript/bin/tsc -b` seguido de `node node_modules/vite/bin/vite.js build`: **exit 0**, 1882 módulos, JS 725.50 kB / gzip 232.33 kB, CSS 19.52 kB. Aviso de rendimiento por bundle superior a 500 kB; partición pendiente de optimización. `eslint . --max-warnings 0`: **exit 0**; sin errores ni advertencias. Repetición final de unitarios: **15/15**, 0 fallos/omitidas. `git diff --check -- web-admin`: exit 0, solamente avisos de normalización LF/CRLF de Git.
4. QA browser aislada: `tests/ui-readonly.mjs`, Edge headless y datos explícitamente sintéticos. Todas las rutas /api son simuladas y los métodos distintos de GET se bloquean con 405; se bloquea tráfico externo. No valida el backend, roles reales, S3 ni UAT humana. Capturas, CSV y resultado generado en `web-admin/tools/audit_e2e/readonly-ui/`.
5. Incidencias iniciales de QA: el navegador restringido no pudo crear perfil; reejecución permitida por revisión automática. El servidor restringido no respondía al navegador externo; se reinició localmente. Dos selectores de test requerían ajuste por nombres accesibles. Vite encontró EBUSY al observar un CSV generado dentro de OneDrive; se excluyó el directorio de evidencia del watcher. No se presentan esos intentos fallidos como pruebas aprobadas.

Resultado final de QA visual aislada: **13/13 escenarios aprobados**, **0 solicitudes de mutación**, **0 errores JavaScript no controlados**. El archivo `web-admin/tools/audit_e2e/readonly-ui/results.json` contiene escenarios, GET observados y manifiesto de capturas de la última ejecución. Incluye alta P01 sin ruta/checkboxes, bloqueo de asignación, POD terminal/blob con Authorization, revisión P02 pendiente y aceptada, creación de ruta, fallo parcial de dashboard con los tres filtros en las cuatro fuentes, CSV descargado, cinco vistas BI con al menos cuatro canvas cada una cuando hay datos evaluables, metas, acción P05, ausencia de datos sin seed, identidades 503/efectivas/roles/legacy, registro/resolución de incidencia, página independiente P05, instrucciones CSV y viewport móvil 390 px. Las capturas usan datos etiquetados fixture. `failure_fixture.png` se conserva como diagnóstico de un intento anterior y no pertenece a una ejecución aprobada. Se inspeccionaron visualmente alta, gráficos de eficiencia y formulario móvil; no se afirma una inspección humana de todas las imágenes.

Evidencia externa aportada por el principal: se leyó `docs/correccion_integral/evidencias/regresion_api.json`, con entorno Docker local/datos sintéticos y humanAcceptance PENDING; el principal comunica **45/45 PASS**. También comunica WS autenticado Redis probado y anónimo cerrado 1008. Esta intervención no repitió esas mutaciones ni se atribuye esos resultados. El contrato path usado es `orderedOrderIds`, nunca `stopOrderIds`.

Conteo final leído del resultado generado: **13 aprobadas, 26 capturas vigentes en el manifiesto, 0 mutaciones, 0 errores de página**. El servidor Vite temporal de QA (4317) se detuvo al terminar. Las capturas no son evidencia de operación sobre datos reales.

## UAT / integración pendiente (diseño, no ejecución humana)

| Escenario | Verificación automatizada disponible | Pendiente real |
| --- | --- | --- |
| Alta PENDING → revisión → asignación del mismo ID | Helpers y lectura visual con fixtures | Ejecutar POST/PATCH coordinados, observar BD y rechazo sin checks. |
| Reasignar carga invalida aprobación/aceptación | Texto y gating UI; contrato revisado | Nueva aceptación real desde móvil y despacho con revisión renovada. |
| POD autenticado y PDF con foto/firma | Lectura de blob con Authorization en fixtures | Leer POD/S3/PDF real; no se prueba integridad de objeto ni contenido por esta intervención. |
| Revisión ADMIN, aceptación DRIVER | UI bloquea con accepted=false en fixture | JWT reales de ambos actores, rechazo cruzado y aceptación móvil. |
| GPS primer frame, fallback y ruta OSRM | Unitario de suscripción/parser y orden del servidor en fixture | Canal real, eventos Redis, expiración JWT, OSRM real y comparación con móvil. |
| Filtros consistentes / errores parciales | Helper y solicitudes observadas con fixtures | Comparación con SQL de población real y resultados actuales del backend. |
| BI y metas | Fórmulas/CSV y lectura visual de vistas con fixtures | API live, persistencia y auditoría de cambio de meta. |
| RETRY/REPLAN/CLOSE_CASE | Formulario y reglas de opciones | Mutaciones coordinadas, nuevo intento y original intacto en BD. |
| P05 OPEN→IN_PROGRESS→VERIFIED | Formulario/tipos y reglas de rol/estado | Valor observado, auditoría de ADMIN y revisión humana de eficacia. |
| P08 identidades y revocación | Error 503 y bloqueo de auto acciones en fixtures | Lectura actual del servicio aprovisionado, cambios autorizados y revocación real. |

Los escenarios pendientes no están aprobados por un usuario humano ni se sustituyen por los fixtures de QA.
