# Notas finales de trazabilidad y UAT

Entrega de documentación del 19/10/2026 America/Lima. Última comprobación registrada: 20/10/2026 02:28:52 UTC (=19/10, 21:28:52 Lima). Alcance exclusivo: JSON, Markdown, generador y checks de este generador. No se modificaron fuentes de negocio/React/Flutter, BPMN originales, DOCX ni PPT; no se hicieron commits, borrados, despliegues, conexiones a producción ni falsas pruebas operativas.

## Archivos creados

- `tools/audit_e2e/trace_inventory.py`: generador con biblioteca estándar, rutas recursivas y snapshot por hash. Lee fuentes actuales sin ejecutar producto ni acceder a BD/API.
- `tools/audit_e2e/trace_manual.json`: asociaciones editoriales por proceso/tarea y motivo; resuelve selectores contra archivos/métodos/endpoints reales. Selectores ausentes quedan pendientes, no se inventan métodos.
- `tools/audit_e2e/trace_inventory_checks.py`: validación de referencias, campos UAT, file/line y descubrimiento de componentes/hooks/guards futuros mediante fuentes sintéticas en memoria.
- `docs/correccion_integral/inventario_trazabilidad.json`: inventario generado de XML, pantallas/componentes, estados/formularios, rutas, métodos, HTTP/WebSocket, dependencias, casos de uso/servicios de aplicación, tablas/cambios SQL, requisitos y pruebas. Todos los vínculos mantienen `verification: pending`.
- `docs/correccion_integral/Plan_Pruebas_Usuario.md`: 96 casos UAT001–UAT096 sin ejecutar, con actor, precondiciones, datos sintéticos, pasos, resultados UI/backend/BD, criterio, nodos, RF/RNF y Hxx. Nueve escenarios principales por proceso más quince de soporte. Todos los 81 RF tienen al menos una relación UAT; esto es cobertura documental, no cobertura probada.
- `docs/correccion_integral/Acta_UAT_Plantilla.md`: plantilla sin nombres/firmas ficticios, ejecución de agente separada de decisión humana y preguntas de satisfacción para cinco tareas.
- `docs/correccion_integral/README_tecnico.md`: instrucciones, límites, guion y glosario React/Flutter/BLoC/ports/adapters/DBO/OIDC/JWT/S3/SQS/outbox; explica contrato de cinco KPI y evita comparaciones históricas causales no sustentadas.
- `docs/correccion_integral/validacion_inventario.json`: informe generado de checks de documentación/generador con hashes y alcance explícito.
- Este archivo de notas.

Se respetaron los documentos y cambios ajenos existentes. `evidencias/regresion_api.json` y `analytics_api_contract.json` solo se leyeron y referenciaron; no fueron producidos ni modificados por este trabajo.

## Resultado de la última generación

| Elemento | Cantidad / estado |
|---|---|
| Procesos / nodos BPMN | 9 / 199 |
| Requisitos conservados | 81 RF + 54 RNF = 135 |
| Unidades de UI, incluidos componentes/shells | 33 |
| Rutas React/GoRouter | 21 |
| Métodos/declaraciones localizados | 758; no significa métodos funcionalmente probados |
| Endpoints | 66: 65 HTTP + WS `/ws/gps` |
| Llamadas cliente localizadas | 100; llamadas por importación/union tipada son candidatas explícitas |
| Tablas/vistas declaradas | 45; existencia en BD no consultada |
| Definiciones de tests automáticos encontradas | 96; ninguna ejecutada por este generador |
| Casos UAT escritos | 96; todos no ejecutados |
| Mapeo de nodos | 53 mapped, 35 manual, 2 external, 109 planned |
| Referencias distintas archivo/línea comprobadas | 3718 |
| Checks estructurales y descubrimiento sintético | Passed; snapshot consistente en ejecución registrada |

Los totales pueden variar en la siguiente ejecución porque los agentes web/móvil continúan editando. El generador detectó una edición concurrente durante una comprobación y la rechazó; el reintento posterior pasó. `snapshot.consistent` verifica cambios detectados en archivos leídos, no constituye bloqueo o transacción de todo el filesystem; se requiere regenerar después de integrar.

## Cambios recientes integrados por inspección

P01: BusinessWorkflow.Confirmation, tres checks independientes, RUC separado del DNI de POD, condiciones comerciales e invalidación de revisión. Se distingue declaración del operador de aceptación real/certificada del cliente.

P02: aprobación de peso positivo <= capacidad, recursos activos y pedidos confirmados; aceptación de hoja por Conductor propio; invalidación de aprobación y aceptación al reasignar o cambiar condiciones. Se conservan personas en las lanes; Jefatura no se convierte automáticamente en ADMIN sin acuerdo de negocio.

P03: `SyncPage`, `ProofSync`, caché/outbox vinculada a cuenta, estados pendientes/rechazados y reintentos. No se promete sincronización con app terminada por el SO. Los casos exigen recuperación de archivos, reinicio, conflictos, sesión vencida, idempotencia, GPS y diferencia entre guardado local y confirmación de servidor.

P04/P05: BusinessOperationsService, BusinessOperationsController, BusinessOperationsPort, R2dbcBusinessOperationsAdapter y BusinessOperations. Incidencias reportar/listar/resolver RETRY, REPLAN, CLOSE_FAILED y CLOSE_CASE; reintentos crean nuevo pedido vinculado por `order_attempts`, conservando resultado histórico. Acciones de mejora registran causa/responsable/plazo/base/meta/resultado y seguimiento/verificación con roles. No se inventa eliminación de mejora si el contrato usa estado de cierre.

V10 y `V13__incident_resolution.sql`: definiciones de flujo, enlaces next_route_id/retry_order_id, restricciones de resolución/verificación y preservación de cierres históricos como LEGACY_UNATTRIBUTED. Las referencias ALTER aparecen en `tables.schemaChanges` con archivo/línea. Esto documenta SQL, no acredita que se aplicó una migración en este trabajo.

BI: contrato `analytics_api_contract.json`, cinco códigos IID/CHR/TDE/SUCCESS/ONTIME, fórmulas, filtros America/Lima, metas, tendencias, causas, calidad, eficiencia y vistas de lectura. El inventario localiza código y el plan prescribe su verificación, sin derivar aceptación del contrato.

P08: IdentityController/KeycloakAdministration, roles efectivos/vinculación/habilitación y legacy local de consulta. POST/DELETE anteriores de roles devuelven 410 en la versión inspeccionada; no se presentan como flujo válido de otorgamiento de acceso. Revocación real de sesión requiere prueba con proveedor.

## Regresión API suministrada y límites de aceptación

Se leyó `docs/correccion_integral/evidencias/regresion_api.json`: fecha reportada 20/10/2026 02:26:21.605Z, entorno Docker local con datos sintéticos, 45 casos C01–C45 y resumen 45 PASS / 0 fallidos. Se conserva como `technicalExecutionEvidence`, con IDs API:Cxx y evidencia de línea; la relación a trazas es por proceso reportado y se etiqueta como tal.

No se volvió a ejecutar esa suite aquí, no se transforma en UAT PASS y no modifica `verification: pending`. La fuente no fija hash/revisión de todo el código probado: cambios posteriores de UI/backend requieren reevaluar alcance. El generador no validó el contenido del PDF ni el esquema real de la BD. La aceptación humana de MICOTRANS permanece pendiente en inventario, plan y acta. Las ejecuciones de agentes deben registrarse separadas de decisiones de personas reales.

## Brechas de mapeo observadas

1. **35 tareas humanas sin enlace técnico específico**: recepción/solicitud de corrección/aclaración comercial, sustitución física, contacto/confirmación de causa, revisión documental, presupuesto/proveedor/autorización de gasto/recepción/devolución y otras decisiones humanas. No se concluye que deban automatizarse; requieren registro humano o asociación más específica. `gaps` identifica cada nodeId.
2. **Dos comunicaciones P01 externas**: P01_A8 y P01_A8b tienen soporte de declaración comercial, pero registro de checks no acredita envío/recepción real ni firma del cliente. Se mantienen external y pendientes.
3. **Siete asociaciones tarea–endpoint sin llamada de pantalla localizada**: GET `/drivers/{id}` y GET `/vehicles/{id}` en P06_A6/A7/A9 (seis asociaciones, dos endpoints); GET `/notifications` en P07_A7 (una). La UI de recursos usa listados/edición y el panel de notificaciones consulta no leídas; estos siete vínculos faltantes no equivalen a siete funciones rotas.
4. **18 endpoints sin caso de uso/servicio de aplicación resuelto por el analizador**: varias consultas directas a repositorio/seguridad, operación de identidad mediante servicio de infraestructura y handlers legacy que devuelven 410. No se inventa una clase UseCase para rellenarlos ni se declara defecto funcional automáticamente. Revisar evidencia del handler y límites de resolución de herencia Spring Data.
5. **26 RNF transversales sin asignación editorial a un proceso**: RNF-01, 08, 09, 10, 16, 17, 21, 22, 23, 26, 27, 28, 30, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54. Permanecen en el inventario; algunos están relacionados con UAT de soporte, pero arquitectura/infraestructura/calidad requieren evidencia y asignación transversales específicas. No se interpreta como implementación ausente de todos ellos.
6. **109 nodos planned** son fundamentalmente controles BPMN (inicios, gateways, finales), sin ejecución asociada explícita; no representan 109 pantallas faltantes. Se conservan condiciones rotuladas, finales y handoffs del XML sin inventar un motor BPMN ejecutado.

Además, el analizador es léxico: imports, tipos receptores, uniones literales y mención de clase en test son evidencia candidata, no llamada/aserción ejecutada. Selección de bean, overloads, métodos heredados/dinámicos, visibilidad real de modal, permisos efectivos y existencia de objetos S3 requieren inspección/prueba. `mapped` siempre significa asociación estática, nunca estado implementado/aceptado por existir archivo.

## Repetición e integración

Desde la raíz del proyecto:

```powershell
& 'C:/Users/USUARIO/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' -X utf8 tools/audit_e2e/trace_inventory.py
& 'C:/Users/USUARIO/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' -X utf8 tools/audit_e2e/trace_inventory_checks.py --report docs/correccion_integral/validacion_inventario.json
```

No se usa Python global. `--check` permite validar inventario en memoria sin escribir. Cada nueva funcionalidad se descubre en carpetas de fuentes; su nueva asociación de negocio requiere revisar `trace_manual.json`. Regenerar tras finalizar los agentes y antes de integración documental. Luego ejecutar UAT en entorno aislado y completar acta con personas reales. Los BPMN originales se mantienen para la integración posterior autorizada.
