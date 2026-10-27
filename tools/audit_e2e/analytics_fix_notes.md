# Analítica H08 / H09 / H18 — registro de implementación y pruebas

Fecha de trabajo: 2026-10-19. Alcance exclusivo: DashboardService, DashboardController,
ReportController, modelos/puerto/adaptador analítico, V12 y pruebas analíticas.
Sin commits, delegaciones, Word/PPT ni modificaciones de base de datos operativa.

## Contrato para web

`tools/audit_e2e/analytics_api_contract.json` versión 2026-10-19.1 disponible.
BI expone kpis (cinco), trends diarios, byDriver, byDistrict, causes, efficiency,
goals, quality. Las rutas anteriores conservan sus nombres y campos JSON, excepto
route-efficiency, corregida para devolver filas por ruta según solicitud expresa.
Todos los filtros operativos comparten driverId/startDate/endDate inclusive.

## Fuentes revisadas y decisiones

Se leyó con `git show origin/master:` KpiRepository.java, KpiReportService.java y
las fichas CSV pretest IID, CHR, TDE. También se comprobaron encabezados y totales
de las tres fichas postest. No se importó código anterior.

* IID: pedidos con RUC P01 de 11 dígitos ASCII, receptor y dirección no vacíos,
  latitud/longitud dentro de rangos y ambas distintas de cero / todos los pedidos.
  `external_reference` nunca se considera RUC. P01 viene de V10 del principal.
* CHR: DELIVERED con route_id / todos los programados con route_id.
* TDE: programados con fotografía O firma no vacías / programados. Disponibilidad
  de metadatos, no comprobación remota de S3 ni validación de imagen/firma.
* SUCCESS: DELIVERED / todos los pedidos.
* ONTIME: DELIVERED con verified_at <= ventana final / DELIVERED con POD verified_at
  y ventana final presentes. Pedidos sin ventana no se presumen puntuales.
* Porcentaje: 100 * numerador / denominador, dos decimales HALF_UP. Denominador cero
  devuelve null y NO_DATA. Sin meta: target/gap null y NO_TARGET si hay datos.
* POD completo es una métrica de calidad separada: foto Y firma, receptor, DNI de
  8 dígitos, GPS válido no cero, dos hashes SHA256, captured_at y received_at.
  Se comprueba presencia/formato, no el contenido remoto ni su autenticidad.
* Fechas: COALESCE(routes.route_date, (orders.created_at AT TIME ZONE
  'America/Lima')::date). El conductor es el de ruta; sin éste, orders.driver_id.
* Calidad P01: no confirmado si customer_accepted no es true o confirmed_at falta;
  dirección/cobertura no verificadas si el flag respectivo no es true.
* Causas: eventos FAILED/CANCELLED de historial y eventos incidents, con fuente
  separada. El periodo/conductor es el de operación del pedido/ruta, no fecha de
  evento. Incidentes sin pedido se cuentan una vez por ruta; no se multiplican por
  las paradas. No sumar ambas fuentes como si fueran pedidos distintos.
* Eficiencia: una fila por ruta, incluso vacía. Distancia planificada separada de
  distancia GPS; Haversine (radio 6371.0088 km), LAG por vehículo/ruta, orden
  ping_time/id, solamente dentro de actual_start_time..actual_end_time (o ahora
  para IN_PROGRESS). Menos de dos muestras => null/UNAVAILABLE. La suma de segmentos
  GPS es una aproximación y depende de muestreo, no recorrido vial certificado.
  kmPerDelivery usa entregados; timePerStopMin usa minutos de operación de ruta /
  (DELIVERED + FAILED). Incluye viaje y esperas: NO es tiempo de servicio.
  Sin inicio/fin válido, minutos null. No se sustituye GPS por distancia planeada.

### Comparación con pretest

Las fichas pretest leídas totalizan IID 90/150=60.0%, CHR 101/150=67.3%,
TDE 77/150=51.3%. Son fuentes históricas, no resultados de la aplicación actual.
CHR dice puntos visitados, que no equivale necesariamente a DELIVERED. TDE dice
servicios ejecutados, mientras aquí el denominador solicitado son programados.
IID previo usaba external_reference no vacío y coordenadas no nulas, sin validar
RUC/GPS. Además agrupaba por creación/UTC en vez de fecha operativa Lima.
Los totales postest de las fuentes son IID 182/186=97.8%, CHR 174/186=93.5%,
TDE 175/186=94.1% (20/04/2026..31/05/2026). Tampoco son mediciones ejecutadas en
esta tarea; no se cargaron como resultados ni metas de la API.
No son comparaciones homogéneas ni evidencian mejora causal; se requiere armonizar
universo, instrumento, periodo y definiciones antes de comparar pre/post.

## Pruebas efectivamente ejecutadas (se actualizará)

* Lecturas de fuentes y diff: ejecutadas.
* `gradlew.bat compileJava compileTestJava --console=plain`: BUILD SUCCESSFUL,
  3 tareas, 11 s. Avisos preexistentes de unchecked SecurityConfig y MockBean.
* Consulta Docker: daemon 28.5.1 disponible al usar permisos ampliados del entorno;
  imagen postgres:14-alpine presente. Primer intento restringido: acceso denegado.
* Primer wrapper restringido: acceso denegado al lock de caché Gradle; reintento
  autorizado por revisión automática completó compilación.
* Primera ejecución focalizada: `gradlew.bat test --tests '*DashboardAnalyticsServiceTest'
  --tests '*AnalyticsControllerTest' --tests '*R2dbcAnalyticsIntegrationTest'
  --console=plain`: BUILD SUCCESSFUL, 13 s, 15 pruebas / 0 fallos / 0 omitidas.
  PostgreSQL 14.21 desechable: Flyway validó/aplicó 11 migraciones y llegó a v12.
  Se probaron los límites 04:59:59Z/05:00Z de Lima, conductor de ruta prevalece,
  filtros abiertos/cerrados, distrito nulo/vacío, conductores con nombres iguales,
  causas sin multiplicación, GPS dentro/fuera de intervalo, Haversine 1.1119508 km,
  ruta sin muestras suficientes, sin fin, vacía, metas/auditoría y permisos SQL.
* Segunda ejecución amplió a 21 casos: 16 pasan y 5 de AnalyticsSecurityTest
  fallan al iniciar contexto por filtro Redis sin bean en WebFluxTest. Se corrige
  únicamente la configuración de ese test deshabilitando rate-limit en el slice;
  no se modifica la seguridad de aplicación ni el filtro. La siguiente ejecución
  pasó: 21/21, BUILD SUCCESSFUL en 15 s.
* Ejecución final tras añadir PUT HTTP persistido y JWT simulado:
  `gradlew.bat test --tests '*Analytics*Test' --console=plain`: BUILD SUCCESSFUL en
  17 s, **22 pruebas / 0 fallos / 0 errores / 0 omitidas**. Ejecutó compileJava y
  compileTestJava. Incluye PostgreSQL Testcontainers real, no sustitución H2.
  La última ejecución comenzó 2026-10-20 02:07:26 UTC (2026-10-19 21:07:26 Lima).
  Resumen permanente con nombres/casos, tiempos y SHA256 de fuentes propias y
  dependencias V9/V10: `tools/audit_e2e/analytics_test_results.json`.
* Pruebas de permisos HTTP: anónimo 401; DRIVER/DISPATCHER 403; ADMIN consulta
  meta no configurada null y PUT toma subject del JWT simulado. No autentica con
  Keycloak real. En la prueba HTTP->SQL se inyecta principal de prueba explícito.
* Persistencia HTTP->SQL: PUT CHR 87.5 y GET conservan valor/actor; valores -0.01 y
  100.01 devuelven 400 sin cambiar la meta. SQL comprueba 0, 100, borrado a null,
  tres eventos de historial con actor/fecha y rechazo de modificación del historial.
* `git diff --check` en los tres archivos existentes editados: sin incidencias.
  Revisión estática de servicio/modelos/puerto: sin imports infrastructure,
  SpringData, ZoneOffset ni Map.of.
* JSON de contrato parseado con ConvertFrom-Json; sin errores.
* Script de aprovisionamiento parseado como PowerShell; no se ejecutó contra BD.

## Power BI / RF81

V12 crea vistas analytics_order_facts y analytics_route_facts con campos fuente,
fecha de operación, identificadores, fórmulas verificables y evidencia POD; vistas
analytics_goal_facts / analytics_goal_history_facts para metas efectivas y auditoría.
Rol ecoroute_bi_reader NOLOGIN; sólo USAGE public y SELECT de las cuatro vistas.
No se crea cuenta externa ni contraseña. La migración requiere CREATEROLE o rol
preaprovisionado por DBA; ejecutar en despliegue controlado, no en la BD existente
desde esta tarea. El lector puede ver datos personales presentes en las vistas;
otorgar sólo a analistas autorizados y usar conexión TLS.

Procedimiento reproducible: `tools/audit_e2e/provision_analytics_reader.ps1` con
parámetros DatabaseHost, DatabasePort, DatabaseName, Administrator y LoginRole.
Requiere psql oficial. Crea un LOGIN dedicado nuevo, CONNECT y membresía del rol;
default_transaction_read_only=on. Pide contraseña mediante psql `\password`, sin
incluirla en código, argumentos ni historial. No se ejecutó ni se creó una cuenta.
El DBA debe comprobar permisos heredados de PUBLIC (en particular CREATE en public
en PostgreSQL anteriores a 15), membresías y red del entorno destino. La migración
no revoca privilegios globales existentes que puedan necesitar otras aplicaciones.
El flag read_only es un valor por defecto; el control de tablas fuente lo imponen
los GRANT SELECT de vistas, comprobados en la prueba de rol SQL.

## Inventario de los 22 checks finales

| Suite | Casos aprobados | Qué verifica |
|---|---:|---|
| DashboardAnalyticsServiceTest | 5 | Fórmulas, universo de cada indicador, cero=>null, metas 0/100/null, validación, propagación de filtros y tendencias |
| AnalyticsControllerTest | 3 | Todos los endpoints previos, binding ISO y campos JSON, filtros ausentes y rango inválido |
| AnalyticsSecurityTest | 5 | 401, aislamiento ADMIN frente a DRIVER/DISPATCHER, subject JWT y meta no configurada |
| R2dbcAnalyticsIntegrationTest | 9 | Migraciones, SQL, fechas Lima, dueño de ruta, distrito nulo, nombres de conductor iguales, causas, Haversine, vacíos, calidad, BI y metas por HTTP, auditoría y rol SQL |

## Archivos implementados

* `application/services/DashboardService.java`: sólo usa puerto/modelos de dominio.
* `infrastructure/input/rest/DashboardController.java`, `ReportController.java`.
* `domain/model/analytics/AnalyticsFilter.java`, `AnalyticsModels.java`.
* `domain/ports/out/AnalyticsQueryPort.java`.
* `infrastructure/output/persistence/R2dbcAnalyticsAdapter.java`.
* `src/main/resources/db/migration/V12__analytics_views.sql`.
* Cuatro suites nuevas enumeradas arriba; contrato, script, registro y resultados
  permanentes bajo `tools/audit_e2e/`.
Las rutas Java anteriores son relativas a `src/main/java/com/ecoroute/backend/`;
las pruebas están bajo `src/test/java/com/ecoroute/backend/`.

## Pendientes y límites finales

No se afirma UAT humano ni validación de Power BI Desktop/Service. No se ha
desplegado V12 en la base operativa ni ejecutado el script que crea LOGIN real.
V10 del principal sí se aplicó y probó junto con V12 en la BD desechable.
No se ejecutó la suite global del backend, pruebas de carga ni arranque completo
del despliegue operativo. Los resultados citados corresponden a estas 22 pruebas.
No se ejecutó interfaz web, Power BI Desktop/Service, verificación remota S3 ni
validación estadística contra pre/post. Son tareas posteriores a la integración.
BI consulta varios read models por separado; no promete snapshot transaccional
único durante escrituras concurrentes. Las tendencias sólo contienen días con
pedidos observados y aplican las metas actuales, no metas históricas del día.
El historial de metas conserva cambios efectivos para análisis posterior.
