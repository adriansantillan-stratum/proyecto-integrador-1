# EcoRoute Guía total del recorrido de negocio y del IDE

EcoRoute acompaña la jornada de reparto de Grupo MICOTRANS desde la solicitud del cliente hasta la revisión de resultados. Esta guía permite exponer el negocio, demostrar las 13 pantallas web y las 6 móviles y seguir cada acción hasta el código y la persistencia. Conservar el mismo pedido, ruta y conductor permite comprobar el traspaso entre planificación, ejecución, incidencias y análisis.

Sesión ejecucion_20261026 · Registro 2026-10-26T20:15:55.309385+00:00 · Zona de negocio America/Lima

Enzo presenta Pedidos y Despacho; Luis, Mis rutas y POD; Renzo, Incidencias y Acciones; Adrian, Dashboard y BI. Las once pantallas de apoyo completan el recorrido. Las instrucciones indican qué demostrar y qué decir; las figuras y los checks permiten contrastarlo con lo que ocurrió en la sesión.

**Raíz de las rutas locales** C:\Users\USUARIO\OneDrive\Escritorio\Proyecto Integrador Desarrollo de Software 3

### Orden de lectura

Preparación e IDE → negocio y arquitectura → accesos y recursos → pedido y despacho → ejecución móvil → incidencias y análisis → acciones y evidencias de pruebas.

## Preparación de la demostración y del IDE

Docker proporciona PostgreSQL, Redis, Keycloak, LocalStack y OSRM. Los procesos de aplicación se arrancan desde sus fuentes mediante CLI: Java 17 y Gradle para backend, Vite para web y Flutter debug para el emulador. Abrir VS Code o pulsar F5 no acredita por sí solo que el proceso esté disponible.

| Componente | Ejecución y conexión | Comprobación |
| --- | --- | --- |
| Infraestructura | Docker Compose con docker-compose.yml y docker-compose.ide.yml; servicios postgres redis keycloak localstack osrm | PostgreSQL host 5433 → contenedor 5432; Redis 16379; Keycloak 8080; LocalStack 4566; OSRM 5000 |
| Backend | Java 17; Gradle bootRun; perfiles local,ide; HTTP 8081; JVM debug 127.0.0.1:5005 | Health y petición autorizada; adjuntar JVM y comprobar pausa |
| Web | Vite 127.0.0.1:3000; proxy /api → backend 8081 retirando el prefijo; /ws mediante proxy | Navegación y datos; depurador del navegador |
| Móvil | Flutter debug en emulator-5556; backend http://10.0.2.2:8081; OIDC http://10.0.2.2:8080 | Sesión efectiva, pantalla real y conexión Dart; no inferir éxito a partir de la compilación |

### Secuencia de arranque prevista

1. Desde la raíz, iniciar infraestructura: powershell -NoProfile -File tools/guia_total_ide/Start-EcoRouteIDE.ps1 -Component Infra. Confirmar los servicios y puertos antes de iniciar las aplicaciones.

2. En otra terminal, iniciar Java: powershell -NoProfile -File tools/guia_total_ide/Start-EcoRouteIDE.ps1 -Component Backend. El script selecciona Java 17 y ejecuta gradlew.bat bootRun con el init script de depuración y perfiles local,ide. HTTP usa 8081 y JDWP 5005.

3. En otra terminal, iniciar web: powershell -NoProfile -File tools/guia_total_ide/Start-EcoRouteIDE.ps1 -Component Web. Vite usa 3000 con strictPort. En este recorrido /api se reescribe en Vite; no es necesario atribuir esa petición a Nginx.

4. Desde la raíz, preparar la copia verificada: node tools/guia_total_ide/prepare_mobile_copy.mjs | Out-Null. Out-Null oculta la salida que contiene la ubicación temporal privada. El script conserva esa ubicación en .runtime/mobile_copy.json y publica la verificación de hashes sin exponer el destino.

5. En una terminal privada, iniciar el build aislado y la app debug: powershell -NoProfile -File tools/guia_total_ide/Start-EcoRouteIDE.ps1 -Component Flutter -Device emulator-5556 -IsolatedAndroidBuild. El script obtiene internamente la copia, comprueba los hashes de fuentes, compila el APK Android x64 y ejecuta ese binario en el emulador. Tee-Object conserva siempre la salida de flutter run en docs/guia_total_ide/.runtime/flutter_isolated.log; mantener esa salida privada porque puede contener la dirección autenticada del depurador.

6. Con la aplicación ya en ejecución, preparar su referencia de servicio: powershell -NoProfile -File tools/guia_total_ide/Prepare-FlutterDebugger.ps1. Este paso lee flutter_isolated.log y prepara la conexión de depuración; no arranca otra aplicación ni reinicia la sesión existente.

### Puertos y copia temporal de Flutter

El perfil IDE usa IDE_DB_PORT con valor 5433 para R2DBC y Flyway porque Docker publica 5433 hacia PostgreSQL 5432. El puerto 5432 de la configuración local anterior no describe el puerto host de este recorrido. application-ide.yml es el punto a revisar ante una conexión fallida; la configuración privada permanece fuera de la exposición.

OneDrive puede bloquear archivos generados de Flutter. prepare_mobile_copy.mjs prepara un directorio temporal y compara SHA256 de lib, fuentes Android y archivos de dependencias. La verificación pública queda en mobile/source_copy_verification.json. La sesión temporal usa una clave de depuración efímera gestionada localmente. No se expone material de firma ni se considera que compilar equivale a ejecutar. El check y la captura del emulador deben acreditar el resultado de la sesión concreta.

### Abrir los tres espacios de trabajo y depurar

[EcoRoute_Backend_IDE.code-workspace](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/EcoRoute_Backend_IDE.code-workspace)

[EcoRoute_Web_IDE.code-workspace](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/EcoRoute_Web_IDE.code-workspace)

[EcoRoute_Flutter_IDE.code-workspace](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/EcoRoute_Flutter_IDE.code-workspace)

Backend: abrir EcoRoute_Backend_IDE.code-workspace y seleccionar EcoRoute Backend conectar JVM 5005. Con el proceso CLI iniciado, F5 adjunta el depurador. Poner un breakpoint en el controlador o caso de uso, ejecutar una acción autorizada, inspeccionar datos ficticios y continuar.

Web: abrir EcoRoute_Web_IDE.code-workspace. Con Vite iniciado, F5 ejecuta la configuración EcoRoute Web depurar React y conecta la depuración del navegador a localhost:3000. La configuración es request launch para el navegador; el servidor Vite ya procede de CLI. Comprobar una pausa en el evento y seguir la llamada del servicio al endpoint.

Flutter: abrir EcoRoute_Flutter_IDE.code-workspace y ejecutar Prepare-FlutterDebugger.ps1 con la aplicación debug ya iniciada. El helper lee el evento app.debugPort y escribe docs/guia_total_ide/.runtime/flutter_service.json con una propiedad uri de tipo string: la base HTTP autenticada, terminada en barra y sin sufijo /ws. Ese archivo permanece privado y su dirección no se muestra en la exposición.

Seleccionar EcoRoute Flutter conectar aplicación en ejecución. La configuración usa type dart, request attach y debuggerType dart, con vmServiceInfoFile apuntando al archivo HTTP anterior y deleteServiceInfoFile false. F5 conecta el adaptador Dart directamente al servicio existente. Esta selección evita pasar la dirección del host por un nuevo flutter attach y otro reenvío de puerto hacia el emulador; tampoco se añade /ws al archivo.

Para comprobar control del depurador, usar F6 y observar Call Stack con Paused on pause; después usar Continue o F5 dentro de esa sesión y comprobar que la aplicación reanuda. La evidencia IDE se registra con flutter_debugger.jpg, sin URI autenticada ni secretos visibles. La toolbar por sí sola no sustituye la comprobación de pausa y continuación.

Si la app se ejecuta desde la copia temporal, la sesión usa las fuentes compiladas allí. Para inspeccionar o poner breakpoints, seguir los archivos cargados por Call Stack y conservar su correspondencia con los hashes de la copia. No ejecutar hot reload ni hot restart desde el árbol original mobile-app contra esta sesión: editar el original no actualiza la copia Temp. El attach Dart directo se demuestra con pausa, pila y continuación; no acredita los controles de hot reload del adaptador Flutter.

La sesión registra control de depuración Dart con resultado PASS. Contrastar su alcance en los checks finales y la figura flutter_debugger.jpg para comprobar la pausa y la continuación documentadas por el operador.

VS Code mostró Restricted Mode y el usuario habilitó manualmente la confianza. Las decisiones de seguridad se mantienen bajo control del usuario. Para la exposición, comprobar si el depurador está adjunto y si una acción produce la pausa esperada.

### Estado registrado de la ejecución

| Componente | Checks que acreditan su alcance |
| --- | --- |
| backend | BREAKPOINT_JAVA_LINE_41_ID49_STACK_MAIN_UI_OBSERVED: PASS; BACKEND_REJECTS_UNAUTHENTICATED_ORDERS: PASS |
| web | IDE_REACT_VITE_CONNECTED: PASS |
| mobile | FLUTTER_PENDING_QUEUE_FINAL: PASS; IDE_DART_PAUSE_AND_RESUME: PASS; MOBILE_TRANSIENT_RETRY: PASS |
| ide | NATIVE_THREE_APPS_IDE_PROCESS_NO_APP_CONTAINERS: PASS; IDE_DART_PAUSE_AND_RESUME: PASS; IDE_REACT_VITE_CONNECTED: PASS |

PASS acredita únicamente lo que nombra y detalla el check. Un FAIL, un caso previsto o una captura aislada no acreditan el funcionamiento completo de Flutter, IDE ni del flujo. La lista final conserva el estado de cada comprobación.

### Archivos para explicar el arranque

[tools/guia_total_ide/Start-EcoRouteIDE.ps1](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/tools/guia_total_ide/Start-EcoRouteIDE.ps1)

[tools/guia_total_ide/debug_backend.init.gradle](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/tools/guia_total_ide/debug_backend.init.gradle)

[tools/guia_total_ide/prepare_mobile_copy.mjs](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/tools/guia_total_ide/prepare_mobile_copy.mjs)

[tools/guia_total_ide/Prepare-FlutterDebugger.ps1](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/tools/guia_total_ide/Prepare-FlutterDebugger.ps1)

[docker-compose.yml](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docker-compose.yml)

[docker-compose.ide.yml](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docker-compose.ide.yml)

[src/main/resources/application-ide.yml](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/resources/application-ide.yml)

[src/main/java/com/ecoroute/backend/EcorouteBackendApplication.java](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/EcorouteBackendApplication.java)

[web-admin/vite.config.ts](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/web-admin/vite.config.ts)

[web-admin/src/pages/Login.tsx](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/web-admin/src/pages/Login.tsx)

EcorouteBackendApplication.main inicia Spring; init fija America/Lima. El banner local describe JWT Keycloak y permisos por rol. Login.tsx presenta la identidad MICOTRANS. Una marca visual o un banner no sustituyen la comprobación de autenticación y permisos.

## Recorrido del negocio y responsabilidades

El operador revisa el pedido y prepara la jornada; la jefatura autoriza y el conductor acepta antes del despacho. La ejecución produce resultados y evidencias. Las excepciones se resuelven con decisiones autorizadas; la evaluación compara registros y metas para proponer acciones. Los BPMN describen tareas humanas y del sistema: una tarea de negocio no implica que exista un botón o endpoint automático.

Las acciones y alternativas de cada pantalla indican qué demostrar. Los estados de las figuras identifican lo capturado; los checks finales distinguen prueba ejecutada y caso previsto. Conservar los identificadores ficticios permite contrastar una escritura con su consulta posterior, sin confundir captura local con confirmación remota.

| Proceso | Propósito | Pantallas y conexión |
| --- | --- | --- |
| P01 | Confirmar pedidos | W03 → pedido revisado |
| P02 | Preparar la jornada de reparto | W04 y M02 → ruta revisada y aceptada |
| P03 | Ejecutar entregas | M02 M03 M04 M06 y W03 → resultado y POD |
| P04 | Resolver incidencias | W05 → decisión y nuevo intento cuando corresponde |
| P05 | Evaluar resultados | W07 W12 W13 W06 → análisis y seguimiento |
| P06 | Habilitar recursos de reparto | W08 W09 M05 → recursos |
| P07 | Supervisar la jornada | W04 M02 W07 W12 → supervisión |
| P08 | Administrar accesos | W01 W02 W10 M01 M05 → acceso |
| P09 | Registrar compras operativas | W11 → compras operativas |

### Procesos BPMN para abrir

[P01 · docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P01_negocio.bpmn](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P01_negocio.bpmn)

[P02 · docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P02_negocio.bpmn](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P02_negocio.bpmn)

[P03 · docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P03_negocio.bpmn](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P03_negocio.bpmn)

[P04 · docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P04_negocio.bpmn](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P04_negocio.bpmn)

[P05 · docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P05_negocio.bpmn](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P05_negocio.bpmn)

[P06 · docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P06_negocio.bpmn](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P06_negocio.bpmn)

[P07 · docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P07_negocio.bpmn](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P07_negocio.bpmn)

[P08 · docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P08_negocio.bpmn](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P08_negocio.bpmn)

[P09 · docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P09_negocio.bpmn](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P09_negocio.bpmn)

### Traspasos de la jornada

P08 W10/W01/M01 habilitan sesión/vínculo; P06 W08/W09 recursos. P09 W11 solo ante necesidad, previa autorización humana.

Enzo P01 W03: PENDING sin ruta y comercial confirmada. Preservar orderId/tracking. P02 W04: PLANNED, asignación ASSIGNED y revisión ADMIN.

Luis M02 acepta hoja aprobada; Enzo W04 despacha IN_PROGRESS/pedidos IN_TRANSIT. Aceptar no despacha.

Luis P03 M02/M03 foto/firma/receptor/GPS; M06 si pendiente. Servidor confirma POD. W03 consulta metadata/foto/firma/PDF; M04 historial.

P07 W04/M02 seguimiento/actualidad GPS; paradas terminales permiten cierre sin implicar éxito total.

Adrian P05 W07/W12/W13 mismo conductor/rango, calidad/metas; Renzo W06 causa/acción/responsable/plazo/medición y ADMIN verifica. Gasto enlaza P09/P06.

### Alternativas y bloqueos

P01 datos/dirección/cobertura incompletos: corregir/desistir. No inventar CONFIRMED; CSV inválido no se importa parcialmente.

P02 recursos/carga/revisión/aceptación insuficientes: no despachar; composición nueva invalida autorizaciones.

P03 ausencia/rechazo/impedimento: motivo y terminal permitido → P04 W05. Cola local no confirma remoto; recuperar M06.

P04 RETRY nuevo intento misma ruta activa → P03; REPLAN nuevo intento otra PLANNED y comercial renovada → P02. CLOSE_FAILED/CLOSE_CASE solo ADMIN; original permanece.

P05 datos dudosos: corregir/cierre provisional; sin denominador/meta no inventar cumplimiento. Acción inefectiva: revisar hipótesis.

P06 recurso no apto/disponible: bloquear/esperar; P07 pérdida señal: contacto/escalamiento P04 humanos.

P08 rechazo/revocación: denegar/revocar sesiones. P09 existencia utilizable: sin compra; gasto rechazado/recepción observada: ajustar/cancelar/reclamar humanamente.

### Tres capas y límites del código

| Capa | Responsabilidad | Recorrido del dato |
| --- | --- | --- |
| Presentación | React y Flutter muestran estados, validan el formulario y recogen una acción | Componente o Page → hook o Bloc → servicio o repositorio cliente → HTTP |
| Aplicación y dominio | Los controladores adaptan REST; los casos de uso y servicios aplican reglas; los puertos separan dependencias | Controller → caso de uso → puerto del dominio |
| Persistencia e integración | Los adaptadores implementan los puertos mediante SQL reactivo e integraciones | R2DBC → PostgreSQL; Keycloak, Redis, S3 o backup según la operación |

En backend esta separación se organiza con puertos y adaptadores. El DTO de transporte, el modelo de dominio y la entidad SQL cumplen funciones distintas. Mono y Flux encadenan la operación reactiva; la respuesta HTTP y el refresco del cliente devuelven el resultado a la pantalla. La lectura de código explica la regla; su ejecución se acredita por separado.

### Reparto de la exposición

| Integrante | Dos pantallas principales | Traspaso |
| --- | --- | --- |
| Enzo | W03 Pedidos; W04 Gestión de despacho | Pedido y ruta a Luis |
| Luis | M02 Mis rutas y hoja de reparto; M03 Detalle de pedido y prueba de entrega POD | Resultado y excepción a Renzo |
| Renzo | W05 Incidencias y decisiones · P04; W06 Acciones de mejora · P05 | Decisiones y acciones para evaluación |
| Adrian | W07 Dashboard web: panel de control logístico; W13 Inteligencia de negocio | Resultados y desvíos para revisión |

Las otras once pantallas son de apoyo y forman parte de la demostración completa. Accesos, Inicio, recursos, usuarios, compras, reportes, historial, perfil y sincronización se muestran en el momento en que sostienen la jornada. El reparto de dos principales por integrante no reduce el alcance de 19 pantallas.

## W01 Acceso web y retorno OIDC

Web · Ruta /login · Procesos P08 · Pantalla de apoyo

**Actor y permiso** Público; identidad efectiva después de autenticar

**Qué decir** Login inicia Authorization Code con PKCE y procesa el retorno de Keycloak. AuthProvider consulta identidad efectiva al backend; decodificar un token no concede permisos. El formulario externo del proveedor forma parte del acceso, sin crear otra ruta React. Esta pantalla habilita sesión para tareas posteriores. P08 exige comprobar permisos permitidos y denegados; autorizar solicitud y elegir rol son tareas humanas previas.

**Qué demostrar** Presentar botón, seguir al proveedor y completar acceso de ensayo fuera de captura; volver al callback. Mostrar usuario/rol en Inicio, una ruta permitida y cierre de sesión desde Sidebar.

**Estados y alternativas previstos** Inicial, redirección, intercambio de código, carga de identidad y error recuperable. Sin sesión: ruta protegida devuelve a login. Con rol insuficiente se aplica ProtectedRoute. No mostrar credenciales/tokens.

### De la acción al código

Login → redirectToKeycloakLogin/exchangeCodeForTokens → OIDC auth/token → Keycloak mantiene identidad/sesión.

AuthProvider → useQuery → GET /api/session/me → SessionController.me → OperationalAccess → DriverRepository/drivers para vínculo; iniciar sesión no escribe pedidos.

### Código explicado paso a paso

[Fragmento 1 · web-admin/src/pages/Login.tsx · L21 a L25](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/web-admin/src/pages/Login.tsx)

```tsx
  21  const code = searchParams.get('code');
  22  if (code && !exchangeAttempted.current) {
  23    exchangeAttempted.current = true;
  24    exchangeCodeForTokens(code)
  25      .then((tokens) => {
```

**Lectura de las líneas** L21: Lee el código de retorno del proveedor. L22: El guard impide un segundo canje en este montaje. L24: Inicia el intercambio asíncrono; todavía debe completarse la identidad efectiva.

**Contrato y límite** Entrada: retorno OIDC. Salida: sesión de cliente o error recuperable. El canje no sustituye GET /session/me ni los permisos del servidor.

[Fragmento 2 · src/main/java/com/ecoroute/backend/infrastructure/input/rest/SessionController.java · L13 a L17](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/infrastructure/input/rest/SessionController.java)

```java
  13  public Mono<Map<String,Object>> me() {
  14      return access.authentication().flatMap(a -> access.managesOperation().flatMap(manager ->
  15          manager ? Mono.just(Map.of("subject",a.getName(),"roles",a.getAuthorities())) : access.driverId()
  16              .map(id -> Map.of("subject",a.getName(),"driverId",id,"roles",a.getAuthorities()))));
  17  }
```

**Lectura de las líneas** L14: Obtiene la autenticación y comprueba si administra la operación. L15: Para el gestor devuelve subject y authorities. L16: Para el conductor incorpora el driverId autorizado.

**Contrato y límite** GET /session/me devuelve una identidad efectiva reactiva. Los roles de pantalla proceden de esta respuesta; iniciar sesión no crea pedidos.

[Fragmento 3 · web-admin/src/context/verifiedSession.ts · L16 a L20](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/web-admin/src/context/verifiedSession.ts)

```typescript
  16  const sameSubject = previous.subject === subject;
  17  const rejected = !!query.error || (!!query.data && query.data.subject !== subject);
  18  const identity = !subject || rejected ? undefined
  19    : query.loading ? (sameSubject ? previous.identity : undefined) : query.data;
  20  return sameSubject && previous.identity === identity ? previous : { subject, identity };
```

**Lectura de las líneas** L16: Compara el subject actual con el de la última identidad validada. L17: Un error o una identidad de otro subject invalida la retención. L19: Durante carga conserva únicamente la identidad ya autorizada del mismo usuario. L20: La respuesta nueva reemplaza la identidad retenida y sus roles.

**Contrato y límite** AuthProvider sigue consultando /session/me por cada JWT. Solo evita desmontar la vista durante esa recarga si el subject coincide; cambiar de usuario, cerrar sesión o recibir un error obliga a validar de nuevo. No toma permisos de los roles del JWT.

**Puerto y SQL** Puertos referenciados: DriverRepository, OrderRepository, RouteRepository. Tablas identificadas: drivers.

### Archivos y métodos para abrir en el IDE

[web-admin/src/pages/Login.tsx](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/web-admin/src/pages/Login.tsx) — const Login L7

[web-admin/src/services/keycloak.ts](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/web-admin/src/services/keycloak.ts) — redirectToKeycloakLogin L38; exchangeCodeForTokens L54

[web-admin/src/context/AuthContext.tsx](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/web-admin/src/context/AuthContext.tsx) — AuthProvider L17

[src/main/java/com/ecoroute/backend/infrastructure/input/rest/SessionController.java](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/infrastructure/input/rest/SessionController.java) — SessionController L10; @GetMapping("/me") L12

[src/main/java/com/ecoroute/backend/infrastructure/security/OperationalAccess.java](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/infrastructure/security/OperationalAccess.java) — OperationalAccess L20

[web-admin/src/App.tsx](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/web-admin/src/App.tsx) — path="/login" L88

### Evidencia de esta pantalla

Figura 1. Paso 62 · W01 · sin sesión. Acceso web real de EcoRoute para Grupo MICOTRANS, antes de redirigir al proveedor de identidad.

[Imagen completa · docs/guia_total_ide/ejecucion_20261026/web/v2_login_web.jpg](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_login_web.jpg)

![Figura 1. Paso 62 · W01 · sin sesión. Acceso web real de EcoRoute para Grupo MICOTRANS, antes de redirigir al proveedor de identidad.](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_login_web.jpg)

Figura 2. Paso 63 · W01 · proveedor de identidad. Formulario real de Keycloak sin credenciales visibles; OAuth2 Authorization Code con PKCE en web.

[Imagen completa · docs/guia_total_ide/ejecucion_20261026/web/v2_login_keycloak.jpg](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_login_keycloak.jpg)

![Figura 2. Paso 63 · W01 · proveedor de identidad. Formulario real de Keycloak sin credenciales visibles; OAuth2 Authorization Code con PKCE en web.](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_login_keycloak.jpg)

## W02 Inicio y navegación

Web · Ruta / · Procesos P08, P01, P02, P04, P05, P06, P09 · Pantalla de apoyo

**Actor y permiso** Cualquier sesión autenticada; tarjetas según rol

**Qué decir** Inicio presenta accesos según roles efectivos. Es una pantalla real del router aunque no figure entre las ocho principales. Home navega localmente: no calcula indicadores ni crea registros. Ubica recursos, accesos, compras y reportes. Sidebar ofrece Acciones de mejora independientemente y BI reutiliza su componente. Ocultar tarjetas no sustituye permisos. El reparto académico conserva dos pantallas por alumno; Inicio sirve como presentación común.

**Qué demostrar** Presentar tarjetas y menú expandido; entrar en Pedidos para comenzar P01. Mostrar menú colapsado y, en ventana estrecha, abrir/cerrar con botón, fondo o Escape. Comparar ADMIN/DISPATCHER, ubicar campana y terminar sesión.

### Recorrer todos los accesos de Inicio

Con ADMIN, recorrer las ocho tarjetas de Inicio y desplazarse hasta las últimas, Vehículos y Compras. Mostrar una captura superior y otra inferior de la ventana completa para comprobar que los accesos inferiores están visibles y se pueden utilizar. Con otros roles, recorrer todos los accesos autorizados para esa identidad.

**Qué explicar en el código** Home usa minHeight 0 y flex 1 para ajustarse al espacio disponible del contenedor; overflowY auto permite el desplazamiento vertical y overflowX hidden evita el desbordamiento horizontal. La corrección permite llegar a las tarjetas inferiores que antes quedaban recortadas. Es una mejora de navegación y disposición visual; no modifica Auth, los roles ni las reglas de autorización.

**Check de Inicio** Comprobación prevista de navegación completa: cuando el contenido exceda la altura visible, verificar en el DOM que scrollHeight sea mayor que clientHeight, que scrollTop cambie al desplazar y que las últimas tarjetas queden visibles y accionables. Registrar el resultado real y las capturas superior e inferior como W02 en el manifest; una captura inferior descartada no acredita este check. Mantenerlo previsto hasta completar la validación DOM.

**Estados y alternativas previstos** Inicio autenticado; menú expandido/colapsado; overlay móvil abierto/cerrado y foco recuperado. Ruta desconocida redirige a Inicio; no existe 404 independiente ni carga propia de resultados de negocio.

### De la acción al código

Home → useAuth → identidad AuthProvider /session/me; useNavigate cambia ruta sin persistir.

AppRoutes → AuthenticatedLayout → ProtectedRoute: consultas/escrituras pertenecen al destino. Inicio no posee endpoint, caso de uso o tabla propios.

### Código explicado paso a paso

[Fragmento 1 · web-admin/src/pages/Home.tsx · L18 a L20](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/web-admin/src/pages/Home.tsx)

```tsx
  18  const hasRole = (roles: string[]) => {
  19    return user?.roles.some(role => roles.includes(role));
  20  };
```

**Lectura de las líneas** L19: Compara los roles solicitados con los roles del usuario para mostrar accesos.

**Contrato y límite** Entrada: identidad del contexto. Salida: visibilidad de una tarjeta. Es navegación local; no hay escritura SQL ni autorización definitiva aquí.

[Fragmento 2 · web-admin/src/components/ProtectedRoute.tsx · L13 a L17](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/web-admin/src/components/ProtectedRoute.tsx)

```tsx
  13  if (!isAuthenticated) {
  14    return <Navigate to="/login" replace />;
  15  }
  16  
  17  if (sessionLoading || sessionError) return <main className="main-content"><SourceState loading={sessionLoading} error={sessionError} retry={retrySession} /></main>;
```

**Lectura de las líneas** L13: Comprueba si existe autenticación de cliente. L14: Devuelve al login cuando falta sesión. L17: La identidad pendiente o fallida muestra carga, error y reintento.

**Contrato y límite** La ruta protegida espera la identidad efectiva y después evalúa roles. La comprobación REST sigue perteneciendo al backend aunque se oculte el acceso.

**Puerto y SQL** Inicio navega hacia la funcionalidad elegida. No tiene puerto de persistencia ni tabla SQL propios.

### Archivos y métodos para abrir en el IDE

[web-admin/src/pages/Home.tsx](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/web-admin/src/pages/Home.tsx) — const Home L14

[web-admin/src/App.tsx](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/web-admin/src/App.tsx) — const AppRoutes L85; const AuthenticatedLayout L22; path="/" L59

[web-admin/src/components/Sidebar.tsx](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/web-admin/src/components/Sidebar.tsx) — const Sidebar L29

[web-admin/src/components/ProtectedRoute.tsx](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/web-admin/src/components/ProtectedRoute.tsx) — const ProtectedRoute L10

### Evidencia de esta pantalla

Figura 3. Paso 64 · W02 · inicio superior. Inicio corregido: accesos reales del usuario autenticado, con contenido desplazable.

[Imagen completa · docs/guia_total_ide/ejecucion_20261026/web/v2_final_inicio_superior.jpg](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_final_inicio_superior.jpg)

![Figura 3. Paso 64 · W02 · inicio superior. Inicio corregido: accesos reales del usuario autenticado, con contenido desplazable.](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_final_inicio_superior.jpg)

Figura 4. Paso 65 · W02 · inicio inferior. Inicio con desplazamiento real: accesos inferiores a Vehículos y Compras completamente visibles.

[Imagen completa · docs/guia_total_ide/ejecucion_20261026/web/v2_final_inicio_inferior.jpg](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_final_inicio_inferior.jpg)

![Figura 4. Paso 65 · W02 · inicio inferior. Inicio con desplazamiento real: accesos inferiores a Vehículos y Compras completamente visibles.](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_final_inicio_inferior.jpg)

## W10 Usuarios e identidades

Web · Ruta /users · Procesos P08, P06 · Pantalla de apoyo

**Actor y permiso** ADMIN

**Qué decir** Gestiona roles efectivos y vínculo de conductor. Keycloak consulta identidades existentes, edita ADMIN/DISPATCHER/DRIVER, vincula conductor activo y habilita/deshabilita. No ofrece alta de cuentas nuevas. El backend valida asociación y revoca sesiones afectadas. Registro local anterior queda para migración, sin permisos efectivos; sus escrituras antiguas responden 410. Autorizar solicitud y elegir rol mínimo son decisiones humanas P08 previas al formulario.

**Qué demostrar** Buscar usuario/subject y abrir editor; mostrar conductor requerido para DRIVER. Guardar sobre cuenta de ensayo y presentar nueva sesión; comprobar permiso efectivo. Mostrar confirmación de baja y pestaña anterior; señalar protección del ADMIN propio.

**Estados y alternativas previstos** KEYCLOAK/LEGACY; IdentityEditor; confirmación enabled; busy/error. Vínculo duplicado, conductor inactivo o privilegios propios inválidos: corregir según servidor. Legacy no equivale a acceso.

### De la acción al código

Users → useQuery/userService → GET /api/users/identities, PUT /{id}/roles o /enabled.

IdentityController → KeycloakAdministration.roles/enabled → API administrativa Keycloak; vínculo drivers, revocación Redis y business_audit_events.

GET /users → UserController → SpringDataUserRoleRepository → auth_user_role histórico.

### Código explicado paso a paso

[Fragmento 1 · web-admin/src/pages/Users.tsx · L18 a L22](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/web-admin/src/pages/Users.tsx)

```tsx
  18  event.preventDefault(); if (!roles.length) return;
  19  setBusy(true); setMessage('');
  20  try { await updateIdentityRoles(identity.id, roles, roles.includes('DRIVER') && driverId ? Number(driverId) : undefined); done(); }
  21  catch (cause) { setMessage(errorMessage(cause)); }
  22  finally { setBusy(false); }
```

**Lectura de las líneas** L18: Exige al menos un rol antes de enviar. L20: Incluye driverId cuando corresponde al rol DRIVER. L21: Un rechazo del servidor queda visible.

**Contrato y límite** Entrada: identidad existente, roles y vínculo. No es alta de cuentas; la sesión afectada debe renovarse para comprobar los permisos efectivos.

[Fragmento 2 · src/main/java/com/ecoroute/backend/infrastructure/input/rest/IdentityController.java · L15 a L17](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/infrastructure/input/rest/IdentityController.java)

```java
  15  @PutMapping("/{id}/roles") public Mono<Void> roles(@PathVariable String id,@RequestBody RolesRequest request) {
  16      return access.authentication().flatMap(actor -> identity.roles(id,request.roles(),request.driverId(),actor.getName()));
  17  }
```

**Lectura de las líneas** L15: El contrato usa el ID de identidad en la ruta y RolesRequest en el cuerpo. L16: Obtiene el actor autenticado y delega roles y driverId a KeycloakAdministration.

**Contrato y límite** PUT /users/identities/{id}/roles opera sobre el proveedor de identidad. El actor no se acepta ciegamente de un campo del formulario.

**Puerto y SQL** Puertos referenciados: BusinessWorkflowPort, DriverRepository. Tablas identificadas: auth_user_role, business_audit_events, drivers.

### Archivos y métodos para abrir en el IDE

[web-admin/src/pages/Users.tsx](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/web-admin/src/pages/Users.tsx) — Users L31; IdentityEditor L11

[web-admin/src/services/userService.ts](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/web-admin/src/services/userService.ts) — async() L9

[src/main/java/com/ecoroute/backend/infrastructure/input/rest/IdentityController.java](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/infrastructure/input/rest/IdentityController.java) — IdentityController L11; @GetMapping public Flux<Map<String,Object>> list() { return identity.identities(); } L14; @PutMapping("/{id}/roles") public Mono<Void> roles(@PathVariable String id,@RequestBody RolesRequest request) { L15; @PutMapping("/{id}/enabled") public Mono<Void> enabled(@PathVariable String id,@RequestBody EnabledRequest request) { L18

[src/main/java/com/ecoroute/backend/infrastructure/security/KeycloakAdministration.java](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/infrastructure/security/KeycloakAdministration.java) — KeycloakAdministration L27

[src/main/java/com/ecoroute/backend/infrastructure/input/rest/UserController.java](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/infrastructure/input/rest/UserController.java) — UserController L13; @GetMapping L17; @PostMapping L22; @DeleteMapping("/{id}") L27

[src/main/java/com/ecoroute/backend/infrastructure/output/persistence/SpringDataUserRoleRepository.java](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/infrastructure/output/persistence/SpringDataUserRoleRepository.java) — SpringDataUserRoleRepository L8

[web-admin/src/App.tsx](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/web-admin/src/App.tsx) — path="/users" L72

### Evidencia de esta pantalla

Figura 5. Paso 27 · W10 · consulta. Usuarios e identidades efectivas del Keycloak local.

[Imagen completa · docs/guia_total_ide/ejecucion_20261026/web/v2_usuarios.jpg](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_usuarios.jpg)

![Figura 5. Paso 27 · W10 · consulta. Usuarios e identidades efectivas del Keycloak local.](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_usuarios.jpg)

Figura 6. Paso 28 · W10 · detalle. Roles efectivos y relación subject–conductor; consulta sin ampliar permisos.

[Imagen completa · docs/guia_total_ide/ejecucion_20261026/web/v2_usuario_vinculo.jpg](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_usuario_vinculo.jpg)

![Figura 6. Paso 28 · W10 · detalle. Roles efectivos y relación subject–conductor; consulta sin ampliar permisos.](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_usuario_vinculo.jpg)

## W08 Conductores

Web · Ruta /drivers · Procesos P06, P02, P08 · Pantalla de apoyo

**Actor y permiso** ADMIN

**Qué decir** Catálogo que habilita recursos P06. Registra nombres, apellido, licencia, correo, teléfono y actividad. El BPMN exige documentación, aptitud y disponibilidad; el formulario conserva información declarada, sin inspección física automática. Un recurso activo puede estar ocupado en otra ruta y despacho vuelve a validar fecha. Editar conductor no concede acceso: Usuarios vincula subject y rol DRIVER.

**Qué demostrar** Buscar por nombre o licencia y recorrer páginas de diez; abrir alta ficticia. Editar el mismo ID/actividad, recargar y comprobar resultado. Mostrar recurso en Nueva ruta; explicar activo frente a disponible.

**Estados y alternativas previstos** Carga/error con reintento, búsqueda vacía, páginas y modal alta/edición. Confirmación nativa al eliminar; duplicidad, relación con rutas o integridad pueden impedir operación. No asegurar borrado antes de respuesta.

### De la acción al código

Drivers.fetchDrivers/handleSubmit → driverService → GET/POST /api/drivers y PUT/DELETE /{id}.

DriverController → DriverUseCasesImpl → R2dbcDriverRepository/Spring Data → drivers. Respuesta recarga listado; planificación aplica otra validación de recursos.

### Código explicado paso a paso

[Fragmento 1 · web-admin/src/pages/Drivers.tsx · L38 a L42](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/web-admin/src/pages/Drivers.tsx)

```tsx
  38    if (editingId) await updateDriver(editingId, formData);
  39    else await createDriver(formData);
  40    setIsModalOpen(false);
  41    fetchDrivers();
  42  } catch (error) { alert(errorMessage(error)); }
```

**Lectura de las líneas** L38: Un ID de edición selecciona actualización. L39: Sin ID solicita creación. L40: Cierra el modal tras éxito. L41: Recarga el catálogo; el error se presenta en catch.

**Contrato y límite** Entrada: datos declarados del conductor. Salida: listado actualizado. isActive es actividad registrada, no certificación física ni disponibilidad en otra ruta.

[Fragmento 2 · src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcDriverRepository.java · L19 a L23](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcDriverRepository.java)

```java
  19  public Mono<Driver> save(Driver driver) {
  20      DriverEntity driverEntity = DriverPersistenceMapper.toEntity(driver);
  21      return springDataDriverRepository.save(driverEntity)
  22              .map(DriverPersistenceMapper::toDomain);
  23  }
```

**Lectura de las líneas** L20: Mapea el modelo de dominio a DriverEntity. L21: Spring Data realiza la persistencia reactiva. L22: Convierte la entidad resultante al contrato de dominio.

**Contrato y límite** DriverRepository separa el caso de uso del SQL. La entidad corresponde a drivers; guardar el catálogo no vincula por sí solo una cuenta DRIVER.

**Puerto y SQL** Puertos referenciados: DriverRepository. Tablas identificadas: drivers.

### Archivos y métodos para abrir en el IDE

[web-admin/src/pages/Drivers.tsx](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/web-admin/src/pages/Drivers.tsx) — const Drivers L9

[web-admin/src/services/driverService.ts](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/web-admin/src/services/driverService.ts) — async() L15

[src/main/java/com/ecoroute/backend/infrastructure/input/rest/DriverController.java](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/infrastructure/input/rest/DriverController.java) — DriverController L17; @PostMapping L26; @GetMapping("/{id}") L43; @GetMapping L50; @PutMapping("/{id}") L56; @DeleteMapping("/{id}") L73

[src/main/java/com/ecoroute/backend/application/usecases/DriverUseCasesImpl.java](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/application/usecases/DriverUseCasesImpl.java) — DriverUseCasesImpl L14; createDriver() L21; getDriverById() L26; getAllDrivers() L32; updateDriver() L37; deleteDriver() L58

[src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcDriverRepository.java](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcDriverRepository.java) — R2dbcDriverRepository L10; save() L19; findAll() L26; findById() L32; deleteById() L38

[web-admin/src/App.tsx](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/web-admin/src/App.tsx) — path="/drivers" L70

### Evidencia de esta pantalla

Figura 7. Paso 21 · W08 · consulta. Catálogo real de conductores y sus datos operativos.

[Imagen completa · docs/guia_total_ide/ejecucion_20261026/web/v2_conductores.jpg](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_conductores.jpg)

![Figura 7. Paso 21 · W08 · consulta. Catálogo real de conductores y sus datos operativos.](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_conductores.jpg)

Figura 8. Paso 22 · W08 · formulario. Formulario de conductor con identidad, licencia, contacto y estado; consulta sin guardar.

[Imagen completa · docs/guia_total_ide/ejecucion_20261026/web/v2_conductor_formulario.jpg](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_conductor_formulario.jpg)

![Figura 8. Paso 22 · W08 · formulario. Formulario de conductor con identidad, licencia, contacto y estado; consulta sin guardar.](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_conductor_formulario.jpg)

## W09 Vehículos

Web · Ruta /vehicles · Procesos P06, P02, P09 · Pantalla de apoyo

**Actor y permiso** ADMIN

**Qué decir** Catálogo que habilita recursos P06. Registra placa, marca, modelo, capacidad kg/m³ y actividad. El BPMN exige documentación, aptitud y disponibilidad; el formulario conserva información declarada, sin inspección física automática. Un recurso activo puede estar ocupado en otra ruta y despacho vuelve a validar fecha. La capacidad se contrasta con carga al aprobar; una compra no crea automáticamente el vehículo.

**Qué demostrar** Buscar por placa o modelo y recorrer páginas de diez; abrir alta ficticia. Editar el mismo ID/actividad, recargar y comprobar resultado. Mostrar recurso en Nueva ruta; explicar activo frente a disponible.

**Estados y alternativas previstos** Carga/error con reintento, búsqueda vacía, páginas y modal alta/edición. Confirmación nativa al eliminar; duplicidad, relación con rutas o integridad pueden impedir operación. No asegurar borrado antes de respuesta.

### De la acción al código

Vehicles.fetchVehicles/handleSubmit → vehicleService → GET/POST /api/vehicles y PUT/DELETE /{id}.

VehicleController → VehicleUseCasesImpl → R2dbcVehicleRepository/Spring Data → vehicles. Respuesta recarga listado; planificación aplica otra validación de recursos.

### Código explicado paso a paso

[Fragmento 1 · web-admin/src/pages/Vehicles.tsx · L37 a L41](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/web-admin/src/pages/Vehicles.tsx)

```tsx
  37    if (editingId) await updateVehicle(editingId, formData);
  38    else await createVehicle(formData);
  39    setIsModalOpen(false);
  40    fetchVehicles();
  41  } catch (error) { alert(errorMessage(error)); }
```

**Lectura de las líneas** L37: Con ID se actualiza el mismo vehículo. L38: Sin ID se crea. L39: Cierra el modal tras la respuesta. L40: Vuelve a consultar los vehículos.

**Contrato y límite** Entrada: placa, descripción, capacidades y actividad. Una respuesta de catálogo no significa que el vehículo esté disponible o aprobado para la jornada.

[Fragmento 2 · src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcVehicleRepository.java · L19 a L23](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcVehicleRepository.java)

```java
  19  public Mono<Vehicle> save(Vehicle vehicle) {
  20      VehicleEntity vehicleEntity = VehiclePersistenceMapper.toEntity(vehicle);
  21      return springDataVehicleRepository.save(vehicleEntity)
  22              .map(VehiclePersistenceMapper::toDomain);
  23  }
```

**Lectura de las líneas** L20: Transforma Vehicle en entidad. L21: Delega la escritura a Spring Data. L22: Mapea el resultado nuevamente a Vehicle.

**Contrato y límite** VehicleRepository representa el puerto; vehicles conserva el recurso. El despacho comprueba por separado sus reglas de uso y carga.

**Puerto y SQL** Puertos referenciados: VehicleRepository. Tablas identificadas: vehicles.

### Archivos y métodos para abrir en el IDE

[web-admin/src/pages/Vehicles.tsx](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/web-admin/src/pages/Vehicles.tsx) — const Vehicles L9

[web-admin/src/services/vehicleService.ts](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/web-admin/src/services/vehicleService.ts) — async() L14

[src/main/java/com/ecoroute/backend/infrastructure/input/rest/VehicleController.java](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/infrastructure/input/rest/VehicleController.java) — VehicleController L16; @PostMapping L25; @GetMapping("/{id}") L40; @GetMapping L45; @PutMapping("/{id}") L51; @DeleteMapping("/{id}") L66

[src/main/java/com/ecoroute/backend/application/usecases/VehicleUseCasesImpl.java](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/application/usecases/VehicleUseCasesImpl.java) — VehicleUseCasesImpl L14; createVehicle() L21; getVehicleById() L26; getAllVehicles() L32; updateVehicle() L37; deleteVehicle() L56

[src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcVehicleRepository.java](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcVehicleRepository.java) — R2dbcVehicleRepository L10; save() L19; findAll() L26; findById() L32; deleteById() L38

[web-admin/src/App.tsx](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/web-admin/src/App.tsx) — path="/vehicles" L71

### Evidencia de esta pantalla

Figura 9. Paso 25 · W09 · consulta. Catálogo real de flota, capacidad y operatividad.

[Imagen completa · docs/guia_total_ide/ejecucion_20261026/web/v2_vehiculos.jpg](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_vehiculos.jpg)

![Figura 9. Paso 25 · W09 · consulta. Catálogo real de flota, capacidad y operatividad.](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_vehiculos.jpg)

Figura 10. Paso 26 · W09 · formulario. Formulario de vehículo completo; consulta sin modificar la flota.

[Imagen completa · docs/guia_total_ide/ejecucion_20261026/web/v2_vehiculo_formulario.jpg](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_vehiculo_formulario.jpg)

![Figura 10. Paso 26 · W09 · formulario. Formulario de vehículo completo; consulta sin modificar la flota.](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_vehiculo_formulario.jpg)

## W11 Compras operativas

Web · Ruta /purchases · Procesos P09, P06, P05 · Pantalla de apoyo

**Actor y permiso** ADMIN

**Qué decir** Registra compras para recursos y mejoras: descripción, proveedor, importe, estado, categoría y notas. P09 evalúa existencia, presupuesto, proveedor, autorización y recepción conforme: decisiones humanas, sin motor automático de aprobación en este CRUD. Cambiar estado no prueba pago ni recepción física. Recurso existente puede cubrir necesidad sin compra; recepción observada exige reclamo/devolución. No hay adjuntador de comprobante evidenciado en este formulario.

**Qué demostrar** Mostrar búsqueda/paginación y Nueva compra con importe válido. Editar mismo ID, estado/notas sustentados y recargar listado. Relacionar necesidad con recurso/mejora sin inventar vínculo automático; confirmar borrado solo de compra prescindible.

**Estados y alternativas previstos** Carga/error con reintento; lista vacía/filtrada; modales separados alta/edición. Confirmación nativa de borrado, importe inválido y mensaje servidor; no existe pantalla de autorización de gasto.

### De la acción al código

Purchases.fetchData/handleCreateSubmit/handleEditSubmit → purchaseService → GET/POST /api/purchases, PUT/DELETE /{id}.

PurchaseController → PurchaseUseCasesImpl → R2dbcPurchaseRepository/SpringDataPurchaseRepository → purchases. Respuesta recarga catálogo; compra→recurso/acción es narrativa si falta relación persistida.

### Código explicado paso a paso

[Fragmento 1 · web-admin/src/pages/Purchases.tsx · L51 a L55](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/web-admin/src/pages/Purchases.tsx)

```tsx
  51  await createPurchase({
  52    ...formData,
  53    amount: parseFloat(formData.amount)
  54  });
  55  setIsCreateModalOpen(false);
```

**Lectura de las líneas** L52: Toma los datos declarados del formulario. L53: Convierte el importe de texto a número. L55: Cierra el modal después de que createPurchase responde.

**Contrato y límite** Entrada: compra declarada. Salida: registro persistido o error. Un estado del CRUD no prueba pago, autorización presupuestal ni recepción física.

[Fragmento 2 · src/main/java/com/ecoroute/backend/infrastructure/input/rest/PurchaseController.java · L26 a L30](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/infrastructure/input/rest/PurchaseController.java)

```java
  26  public Mono<Purchase> createPurchase(@jakarta.validation.Valid @RequestBody PurchaseRequest request) {
  27      Purchase purchase = new Purchase(
  28              null,
  29              request.description(),
  30              request.supplier(),
```

**Lectura de las líneas** L26: Valida el cuerpo PurchaseRequest recibido por POST /purchases. L27: Construye el modelo Purchase con ID nuevo. L29: Conserva descripción y proveedor del contrato.

**Contrato y límite** El controlador adapta transporte a dominio; PurchaseUseCasesImpl y PurchaseRepository continúan hasta purchases. La respuesta reactiva no crea un vehículo automáticamente.

**Puerto y SQL** Puertos referenciados: CreatePurchaseUseCase, DeletePurchaseUseCase, GetAllPurchasesUseCase, PurchaseRepository, UpdatePurchaseUseCase. Tablas identificadas: purchases.

### Archivos y métodos para abrir en el IDE

[web-admin/src/pages/Purchases.tsx](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/web-admin/src/pages/Purchases.tsx) — const Purchases L9

[web-admin/src/services/purchaseService.ts](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/web-admin/src/services/purchaseService.ts) — async() L15

[src/main/java/com/ecoroute/backend/infrastructure/input/rest/PurchaseController.java](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/infrastructure/input/rest/PurchaseController.java) — PurchaseController L18; @PostMapping L25; @GetMapping L41; @PutMapping("/{id}") L46; @DeleteMapping("/{id}") L62

[src/main/java/com/ecoroute/backend/application/usecases/PurchaseUseCasesImpl.java](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/application/usecases/PurchaseUseCasesImpl.java) — PurchaseUseCasesImpl L18; createPurchase() L23; getAllPurchases() L28; updatePurchase() L33; deletePurchase() L52

[src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcPurchaseRepository.java](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcPurchaseRepository.java) — R2dbcPurchaseRepository L10; save() L19; findAll() L26; findById() L32; deleteById() L38

[web-admin/src/App.tsx](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/web-admin/src/App.tsx) — path="/purchases" L73

### Evidencia de esta pantalla

Figura 11. Paso 29 · W11 · consulta. Compras operativas con proveedor, categoría, monto y estado.

[Imagen completa · docs/guia_total_ide/ejecucion_20261026/web/v2_compras.jpg](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_compras.jpg)

![Figura 11. Paso 29 · W11 · consulta. Compras operativas con proveedor, categoría, monto y estado.](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_compras.jpg)

Figura 12. Paso 30 · W11 · formulario. Formulario real de compra; cancelado sin registrar movimientos adicionales.

[Imagen completa · docs/guia_total_ide/ejecucion_20261026/web/v2_compra_formulario.jpg](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_compra_formulario.jpg)

![Figura 12. Paso 30 · W11 · formulario. Formulario real de compra; cancelado sin registrar movimientos adicionales.](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_compra_formulario.jpg)

## W03 Pedidos

Web · Ruta /orders · Procesos P01, P02, P03 · Principal de Enzo

**Actor y permiso** Dispatcher u operador logístico autorizado; perfil técnico ADMIN o DISPATCHER

**Qué decir** Recibimos la solicitud y registramos un pedido identificable sin ruta. La aceptación, la dirección y la cobertura forman la revisión comercial; no existe un estado CONFIRMED. El alta y la revisión son dos peticiones: si falla la segunda, conservamos el ID. Ese mismo pedido pasa a planificación y vuelve aquí para consultar su POD.

**Qué demostrar** Mostrar listado y Nuevo pedido: tracking único, destinatario, teléfono, dirección, coordenadas y ventana cuando corresponda. Registrar aceptación, dirección/cobertura verificadas y nota; guardar PENDING sin ruta y conservar ID. Abrir detalle/comercial/ventana/asignación; validar y confirmar CSV; tras entrega consultar foto/firma/PDF del mismo tracking.

**Estados y alternativas previstos** Listado y búsqueda; modales Nuevo pedido, Detalle y CSV: validación, vista previa y confirmación. Detalle: comercial, ventana, asignación y POD. Revisión parcial bloquea asignación; cambiar ventana invalida aceptación; alta y confirmación son dos HTTP: conservar ID ante fallo parcial.

### De la acción al código

CreateOrder → orderService → POST /orders → OrderController → OrderUseCasesImpl → R2dbcOrderRepository → orders e historial.

BusinessEditor → PATCH /orders/{id}/business-data → BusinessWorkflowController → BusinessWorkflowService.confirm → R2dbcBusinessWorkflowAdapter → order_business_data/auditoría.

CSV preview/import → OrderCsvParser/OrderImportService; POD metadata/foto/firma/PDF → DeliveryProofController.

### Código explicado paso a paso

[Fragmento 1 · web-admin/src/pages/Orders.tsx · L164 a L167](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/web-admin/src/pages/Orders.tsx)

```tsx
 164  const order = created ?? await createOrder({ ...form, latitude, longitude, routeId: null, estimatedDeliveryWindowStart: windowStart ? `${windowStart}:00-05:00` : undefined, estimatedDeliveryWindowEnd: windowEnd ? `${windowEnd}:00-05:00` : undefined });
 165  setCreated(order);
 166  try { await saveBusinessData(order.id, business); done(order); }
 167  catch (cause) { setMessage(`Pedido #${order.id} creado sin ruta. Falta guardar los datos comerciales: ${errorMessage(cause)}. Reintentar guarda sobre el mismo pedido.`); }
```

**Lectura de las líneas** L164: Reutiliza el pedido ya creado o envía el alta con routeId nulo. L165: Conserva el ID en memoria del formulario. L166: Guarda la revisión comercial en otra petición. L167: Si esa revisión falla, informa que el pedido existe y permite reintentar.

**Contrato y límite** Entrada: borrador validado. Salida: pedido y revisión comercial. No hay una transacción única entre ambos HTTP ni idempotencia global por conservar created.

[Fragmento 2 · src/main/java/com/ecoroute/backend/application/usecases/OrderUseCasesImpl.java · L51 a L53](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/application/usecases/OrderUseCasesImpl.java)

```java
  51  public Mono<Order> createOrder(Order order) {
  52      if(order.routeId()!=null) return Mono.error(new BusinessRuleException("Registre y confirme primero el pedido; asigne la ruta en planificación"));
  53      OrderStatus initialStatus = (order.routeId() != null) ? OrderStatus.ASSIGNED : OrderStatus.PENDING;
```

**Lectura de las líneas** L52: Rechaza un alta que ya traiga ruta. L53: Tras esa guarda, un alta válida solo puede nacer PENDING.

**Contrato y límite** El caso de uso impone la regla aunque el cliente mande otros datos. OrderRepository persiste el dominio y el flujo registra historial; la asignación ocurre después.

**Puerto y SQL** Puertos referenciados: AssignOrderUseCase, BusinessWorkflowPort, CreateDeliveryProofUseCase, CreateOrderUseCase, DeliveryProofRepository, GetAllOrdersUseCase, GetOrderByIdUseCase, OrderAuditPort, OrderRepository, RouteRepository, UpdateOrderStatusUseCase, UpdateRouteStatusUseCase. Tablas identificadas: business_audit_events, order_business_data, orders, route_dispatch_reviews.

### Archivos y métodos para abrir en el IDE

[web-admin/src/pages/Orders.tsx](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/web-admin/src/pages/Orders.tsx) — Orders L203; CreateOrder L148; OrderDetail L100

[web-admin/src/services/orderService.ts](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/web-admin/src/services/orderService.ts) — export const OrderStatus = L4

[src/main/java/com/ecoroute/backend/infrastructure/input/rest/OrderController.java](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/infrastructure/input/rest/OrderController.java) — OrderController L20; @PostMapping L33; @GetMapping("/{id}") L39; @GetMapping L44; @DeleteMapping("/{id}") L53; @PatchMapping("/{id}/status") L58; @PatchMapping("/{id}/route") L63; @PatchMapping("/{id}/delivery-window") L68; @PostMapping("/bulk-csv") L77; @PostMapping("/bulk-csv/preview") L81

[src/main/java/com/ecoroute/backend/application/usecases/OrderUseCasesImpl.java](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/application/usecases/OrderUseCasesImpl.java) — OrderUseCasesImpl L28; createOrder() L51; assignOrder() L74; getOrderById() L99; changeDeliveryWindow() L105; getAllOrders() L128; updateStatusManual() L134

[src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcOrderRepository.java](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcOrderRepository.java) — R2dbcOrderRepository L10; save() L19; findAll() L26; findById() L32; lockById() L38; findByTrackingNumber() L43; findByRouteId() L49; deleteById() L55; updateStopSequence() L60

[src/main/java/com/ecoroute/backend/infrastructure/input/rest/BusinessWorkflowController.java](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/infrastructure/input/rest/BusinessWorkflowController.java) — BusinessWorkflowController L15; @GetMapping("/orders/{id}/business-data") L19; @PatchMapping("/orders/{id}/business-data") L23; @GetMapping("/routes/{id}/review") L29; @PostMapping("/routes/{id}/review") L33; @PostMapping("/routes/{id}/acceptance") L38

[src/main/java/com/ecoroute/backend/application/services/BusinessWorkflowService.java](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/application/services/BusinessWorkflowService.java) — BusinessWorkflowService L14; confirm() L23; approve() L43; accept() L63

[src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessWorkflowAdapter.java](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessWorkflowAdapter.java) — R2dbcBusinessWorkflowAdapter L13; confirmation() L15; saveConfirmation() L22; review() L34; approve() L40; accept() L47; invalidate() L51; requireConfirmed() L55; requireDispatchReview() L58; audit() L62

[src/main/java/com/ecoroute/backend/application/services/OrderImportService.java](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/application/services/OrderImportService.java) — OrderImportService L11; importOrders() L15

[src/main/java/com/ecoroute/backend/infrastructure/input/rest/DeliveryProofController.java](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/infrastructure/input/rest/DeliveryProofController.java) — DeliveryProofController L25; @PostMapping L34; @GetMapping("/{orderId}") L50; @GetMapping("/{orderId}/photo") L56; @GetMapping("/{orderId}/signature") L60; @GetMapping("/{orderId}/pdf") L69

[web-admin/src/App.tsx](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/web-admin/src/App.tsx) — path="/orders" L61

### Evidencia de esta pantalla

Figura 13. Paso 14 · W03 · consulta. Los mismos tres pedidos del ensayo, asignados a ruta 22 y en tránsito.

[Imagen completa · docs/guia_total_ide/ejecucion_20261026/web/v2_pedidos_recorrido.jpg](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_pedidos_recorrido.jpg)

![Figura 13. Paso 14 · W03 · consulta. Los mismos tres pedidos del ensayo, asignados a ruta 22 y en tránsito.](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_pedidos_recorrido.jpg)

Figura 14. Paso 19 · W03 · inicio de importación. Formulario inicial de importación CSV: plantilla y botón de validación, sin archivo seleccionado ni importación confirmada.

[Imagen completa · docs/guia_total_ide/ejecucion_20261026/web/v2_pedido_importacion.jpg](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_pedido_importacion.jpg)

![Figura 14. Paso 19 · W03 · inicio de importación. Formulario inicial de importación CSV: plantilla y botón de validación, sin archivo seleccionado ni importación confirmada.](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_pedido_importacion.jpg)

Figura 15. Paso 32 · W03 · detalle entregado. Pedido 48 DELIVERED tras recuperar su evidencia offline: ventana, receptor y datos POD verificados en web.

[Imagen completa · docs/guia_total_ide/ejecucion_20261026/web/v2_pedido_pod_detalle.jpg](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_pedido_pod_detalle.jpg)

![Figura 15. Paso 32 · W03 · detalle entregado. Pedido 48 DELIVERED tras recuperar su evidencia offline: ventana, receptor y datos POD verificados en web.](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_pedido_pod_detalle.jpg)

Figura 16. Paso 34 · W03 · evidencias POD. Foto de cámara virtual y firma de ensayo del POD48, con descarga PDF disponible en web.

[Imagen completa · docs/guia_total_ide/ejecucion_20261026/web/v2_pedido_pod_imagenes.jpg](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_pedido_pod_imagenes.jpg)

![Figura 16. Paso 34 · W03 · evidencias POD. Foto de cámara virtual y firma de ensayo del POD48, con descarga PDF disponible en web.](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_pedido_pod_imagenes.jpg)

Figura 17. Paso 60 · W03 · formulario de alta. Formulario real de alta sin ruta: datos de pedido, ventana y confirmación comercial, cancelado sin guardar.

[Imagen completa · docs/guia_total_ide/ejecucion_20261026/web/v2_final_pedido_alta.jpg](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_final_pedido_alta.jpg)

![Figura 17. Paso 60 · W03 · formulario de alta. Formulario real de alta sin ruta: datos de pedido, ventana y confirmación comercial, cancelado sin guardar.](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_final_pedido_alta.jpg)

Figura 18. Paso 61 · W03 · formulario continuación. Continuación del alta: declaración comercial y botón para guardar el pedido sin ruta.

[Imagen completa · docs/guia_total_ide/ejecucion_20261026/web/v2_final_pedido_alta_inferior.jpg](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_final_pedido_alta_inferior.jpg)

![Figura 18. Paso 61 · W03 · formulario continuación. Continuación del alta: declaración comercial y botón para guardar el pedido sin ruta.](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_final_pedido_alta_inferior.jpg)

## W04 Gestión de despacho

Web · Ruta /routes · Procesos P02, P03, P07 · Principal de Enzo

**Actor y permiso** Dispatcher planifica y despacha; Jefatura revisa usando un perfil ADMIN autorizado; Conductor acepta en móvil

**Qué decir** Preparamos una ruta PLANNED con conductor, vehículo y pedidos revisados. La aprobación administrativa y la aceptación del conductor son controles distintos. Aceptar en el móvil no despacha. Después del despacho comprobamos IN_PROGRESS en la ruta e IN_TRANSIT en los pedidos; una modificación de la composición puede exigir renovar autorizaciones.

**Qué demostrar** Crear ruta PLANNED con fecha y recursos disponibles; mostrar filtro Hoy/histórico y backlog. Asignar pedido confirmado; ADMIN revisa carga, capacidad, ventanas y vehículo con nota. Luis acepta en móvil; actualizar web y despachar. Verificar IN_PROGRESS/IN_TRANSIT, mapa, paradas y fuente del trazado.

**Estados y alternativas previstos** Hoy/fecha/histórico; modal Planificar; backlog; revisión ADMIN; aceptación móvil pendiente/recibida; mapa y fuente GPS. Recursos ocupados/inactivos, carga excesiva, pedidos sin confirmar o autorización invalidada bloquean despacho; rutas terminales no se reabren.

### De la acción al código

RoutesPage → routeService → POST /routes → RouteController → RouteUseCasesImpl → R2dbcRouteRepository → routes.

ReviewPanel → POST /routes/{id}/review y móvil /acceptance → BusinessWorkflowService → route_dispatch_reviews.

PATCH /routes/{id}/status?status=IN_PROGRESS → requireDispatchReview → planificador → IN_TRANSIT/IN_PROGRESS/historial; GET /path y GPS alimentan mapa.

### Cómo explicar las distancias del mapa y del despacho

RouteTracking consulta GET /routes/{id}/path con fromLat y fromLng cuando dispone del último origen GPS. Actualiza ese origen periódicamente y usa los IDs y estados de pedidos como clave de recarga. RouteController.getRoutePath filtra paradas no terminales con coordenadas y calcula una propuesta desde ese origen; si no se informa origen, usa el inicio configurado. Esta consulta no reemplaza la distancia persistida al despachar.

**Qué decir** En el caso de exposición de la ruta 22, el mapa actual muestra 3,19 km y la routeDistance persistida al despacho es 8,53 km. El reporte conserva 8,53 km como plan. Son objetos calculados con distintos puntos de origen y conjuntos de paradas: propuesta actual desde GPS y pendientes frente al plan de despacho desde el inicio configurado. Ni los 3,19 km ni los 8,53 km constituyen distancia GPS validada del recorrido real. Explicar esta diferencia antes de comparar mapa y reporte.

### Código explicado paso a paso

[Fragmento 1 · web-admin/src/pages/Routes.tsx · L103 a L107](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/web-admin/src/pages/Routes.tsx)

```tsx
 103  async function dispatch() {
 104    if (!review.data?.approved || !review.data.accepted) return;
 105    setBusy(true); setMessage('');
 106    try { await updateRouteStatus(route.id, 'IN_PROGRESS'); done(); }
 107    catch (cause) { setMessage(errorMessage(cause)); review.reload(); }
```

**Lectura de las líneas** L104: El cliente exige revisión aprobada y aceptación recibida. L105: Bloquea la interacción mientras solicita el cambio. L106: Pide IN_PROGRESS y refresca al recibir éxito. L107: Un rechazo conserva un mensaje y vuelve a consultar revisión.

**Contrato y límite** Entrada: ruta seleccionada y revisión. Salida: respuesta al cambio de estado; el servidor revalida recursos y autorizaciones antes de persistir el despacho.

[Fragmento 2 · src/main/java/com/ecoroute/backend/application/services/BusinessWorkflowService.java · L63 a L68](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/application/services/BusinessWorkflowService.java)

```java
  63  public Mono<Review> accept(Long id,Long driverId,String actor) {
  64      return plannedRoute(id).flatMap(route -> {
  65          if(!route.driverId().equals(driverId)) return Mono.error(new BusinessRuleException("La hoja no corresponde al conductor"));
  66          return workflow.review(id).flatMap(review -> {
  67              if(!review.approved()) return Mono.error(new BusinessRuleException("La jefatura debe aprobar primero el plan"));
  68              return workflow.accept(id,actor).then(workflow.audit("P02","ROUTE",id,"DRIVER_ACCEPTED",actor,"El conductor revisó hoja, carga y vehículo"))
```

**Lectura de las líneas** L64: Carga la ruta dentro del contrato de planificación. L65: Rechaza la hoja de otro conductor. L67: Exige aprobación previa de jefatura. L68: Registra aceptación y auditoría mediante el puerto workflow.

**Contrato y límite** Aceptar registra el control del conductor y devuelve la revisión. Este método no despacha; el cambio operativo posterior corresponde al caso de rutas.

**Puerto y SQL** Puertos referenciados: BusinessWorkflowPort, CreateRouteUseCase, DriverRepository, GetAllRoutesUseCase, OrderAuditPort, OrderRepository, RouteRepository, UpdateRouteStatusUseCase, VehicleRepository. Tablas identificadas: business_audit_events, order_business_data, route_dispatch_reviews, routes.

### Archivos y métodos para abrir en el IDE

[web-admin/src/pages/Routes.tsx](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/web-admin/src/pages/Routes.tsx) — RoutesPage L152; ReviewPanel L87; RouteTracking L19

[web-admin/src/services/routeService.ts](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/web-admin/src/services/routeService.ts) — export const RouteStatus = L3

[src/main/java/com/ecoroute/backend/infrastructure/input/rest/RouteController.java](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/infrastructure/input/rest/RouteController.java) — RouteController L25; @PostMapping L35; @PatchMapping("/{id}/status") L52; @GetMapping L57; @DeleteMapping("/{id}") L67; @GetMapping("/{id}/path") L77

[src/main/java/com/ecoroute/backend/application/usecases/RouteUseCasesImpl.java](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/application/usecases/RouteUseCasesImpl.java) — RouteUseCasesImpl L31; createRoute() L43; updateRouteStatus() L61; updateRouteStatusOnly() L153; getAllRoutes() L189; getRoutesByFilters() L194

[src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcRouteRepository.java](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcRouteRepository.java) — R2dbcRouteRepository L12; save() L21; findById() L28; lockById() L34; findByDriverIdAndDate() L39; findAll() L45; findByFilters() L51; deleteById() L57; updatePathInfo() L62

[src/main/java/com/ecoroute/backend/application/services/BusinessWorkflowService.java](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/application/services/BusinessWorkflowService.java) — BusinessWorkflowService L14; confirm() L23; approve() L43; accept() L63

[src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessWorkflowAdapter.java](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessWorkflowAdapter.java) — R2dbcBusinessWorkflowAdapter L13; confirmation() L15; saveConfirmation() L22; review() L34; approve() L40; accept() L47; invalidate() L51; requireConfirmed() L55; requireDispatchReview() L58; audit() L62

[web-admin/src/App.tsx](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/web-admin/src/App.tsx) — path="/routes" L62

### Evidencia de esta pantalla

Figura 19. Paso 7 · W04 · aprobada y aceptada. Ruta 22 de hoy: aprobación administrativa y aceptación del conductor verificadas antes del despacho.

[Imagen completa · docs/guia_total_ide/ejecucion_20261026/web/v2_despacho_aprobado.jpg](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_despacho_aprobado.jpg)

![Figura 19. Paso 7 · W04 · aprobada y aceptada. Ruta 22 de hoy: aprobación administrativa y aceptación del conductor verificadas antes del despacho.](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_despacho_aprobado.jpg)

Figura 20. Paso 8 · W04 · mapa durante la ejecución. Revisión aprobada y aceptada, geometría OSRM y paradas IN_TRANSIT tras iniciar el despacho de la ruta22.

[Imagen completa · docs/guia_total_ide/ejecucion_20261026/web/v2_despacho_iniciado.jpg](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_despacho_iniciado.jpg)

![Figura 20. Paso 8 · W04 · mapa durante la ejecución. Revisión aprobada y aceptada, geometría OSRM y paradas IN_TRANSIT tras iniciar el despacho de la ruta22.](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_despacho_iniciado.jpg)

Figura 21. Paso 10 · W04 · backlog y asignación. Backlog de pedidos pendientes con revisión comercial y selectores de ruta; no se realiza una asignación adicional.

[Imagen completa · docs/guia_total_ide/ejecucion_20261026/web/v2_despacho_mapa.jpg](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_despacho_mapa.jpg)

![Figura 21. Paso 10 · W04 · backlog y asignación. Backlog de pedidos pendientes con revisión comercial y selectores de ruta; no se realiza una asignación adicional.](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_despacho_mapa.jpg)

Figura 22. Paso 12 · W04 · formulario. Planificar ruta: fecha, hora y recursos disponibles; Juan y ABC-123 ya no están disponibles durante el reparto.

[Imagen completa · docs/guia_total_ide/ejecucion_20261026/web/v2_planificar_formulario.jpg](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_planificar_formulario.jpg)

![Figura 22. Paso 12 · W04 · formulario. Planificar ruta: fecha, hora y recursos disponibles; Juan y ABC-123 ya no están disponibles durante el reparto.](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_planificar_formulario.jpg)

## M01 Acceso del conductor

Flutter · Ruta /login · Procesos P08 · Pantalla de apoyo

**Actor y permiso** DRIVER autenticado; login público antes de sesión

**Qué decir** Entrada Flutter y retorno cuando falta sesión. Despacha LoginRequested, obtiene tokens y consulta /session/me para identidad/vínculo efectivos. Requiere cuenta habilitada y conductor asociado desde Usuarios. El router escucha AuthBloc: autenticado va a Mis rutas; sin sesión vuelve a login. Inicia comprobación P08 antes de aceptar/entregar. Recuperación local no equivale a verificar nuevamente permisos remotos; completar credenciales fuera de captura.

**Qué demostrar** Presentar formulario vacío, autenticar y mostrar Mis rutas con usuario correcto. Comprobar ID/vínculo en Perfil; preparar error y reintento. Cerrar sesión al final y comprobar retorno a login.

**Estados y alternativas previstos** Inicial, carga, Authenticated/error y redirección del router. Cuenta sin vínculo/permiso o conectividad fallida no acredita acceso válido. Sesión expirada pasa por refresh/interceptor o retorna a login según resultado.

### De la acción al código

LoginPage → AuthBloc → LoginUseCase → AuthRepositoryImpl → AuthRemoteDataSourceImpl.login → POST OIDC /token y GET /session/me.

SessionController → OperationalAccess.driverId → DriverRepository → drivers; proveedor mantiene identidad/sesión, AuthLocalDataSource/LocalCache conservan contexto por cuenta.

### Código explicado paso a paso

[Fragmento 1 · mobile-app/lib/features/auth/presentation/bloc/auth_bloc.dart · L24 a L29](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/mobile-app/lib/features/auth/presentation/bloc/auth_bloc.dart)

```dart
  24      await loginUseCase.execute(event.username, event.password);
  25  
  26  failureOrUser.fold(
  27    (failure) => emit(AuthError(message: failure.message)),
  28    (user) => emit(Authenticated(user: user)),
  29  );
```

**Lectura de las líneas** L24: Espera el resultado del caso de uso de login. L26: fold distingue falla y usuario. L27: Una falla emite AuthError. L28: El usuario recuperado emite Authenticated y el router reacciona al estado.

**Contrato y límite** El Bloc traduce resultado de dominio a estado visual. La autenticación remota y el vínculo efectivo se comprueban antes de tratar al usuario como conductor operativo.

[Fragmento 2 · src/main/java/com/ecoroute/backend/infrastructure/input/rest/SessionController.java · L13 a L17](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/infrastructure/input/rest/SessionController.java)

```java
  13  public Mono<Map<String,Object>> me() {
  14      return access.authentication().flatMap(a -> access.managesOperation().flatMap(manager ->
  15          manager ? Mono.just(Map.of("subject",a.getName(),"roles",a.getAuthorities())) : access.driverId()
  16              .map(id -> Map.of("subject",a.getName(),"driverId",id,"roles",a.getAuthorities()))));
  17  }
```

**Lectura de las líneas** L14: Usa la autenticación de la petición. L16: El driverId procede de OperationalAccess y su vínculo autorizado.

**Contrato y límite** GET /session/me devuelve identidad efectiva y roles. La cuenta recordada localmente no reemplaza la validación de propiedad y permisos del servidor.

**Puerto y SQL** Puertos referenciados: DriverRepository, OrderRepository, RouteRepository. Tablas identificadas: drivers.

### Archivos y métodos para abrir en el IDE

[mobile-app/lib/features/auth/presentation/pages/login_page.dart](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/mobile-app/lib/features/auth/presentation/pages/login_page.dart) — LoginPage L8

[mobile-app/lib/features/auth/presentation/bloc/auth_bloc.dart](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/mobile-app/lib/features/auth/presentation/bloc/auth_bloc.dart) — AuthBloc L7

[mobile-app/lib/features/auth/domain/usecases/login_usecase.dart](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/mobile-app/lib/features/auth/domain/usecases/login_usecase.dart) — LoginUseCase L6

[mobile-app/lib/features/auth/data/repositories/auth_repository_impl.dart](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/mobile-app/lib/features/auth/data/repositories/auth_repository_impl.dart) — AuthRepositoryImpl L12

[mobile-app/lib/features/auth/data/datasources/auth_remote_data_source.dart](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/mobile-app/lib/features/auth/data/datasources/auth_remote_data_source.dart) — AuthRemoteDataSourceImpl L11

[src/main/java/com/ecoroute/backend/infrastructure/input/rest/SessionController.java](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/infrastructure/input/rest/SessionController.java) — SessionController L10; @GetMapping("/me") L12

[src/main/java/com/ecoroute/backend/infrastructure/security/OperationalAccess.java](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/infrastructure/security/OperationalAccess.java) — OperationalAccess L20

[mobile-app/lib/core/router/app_router.dart](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/mobile-app/lib/core/router/app_router.dart) — path: '/login' L36

### Evidencia de esta pantalla

Figura 23. Paso 1 · M01 · sin sesión. Acceso móvil real sin credenciales visibles.

[Imagen completa · docs/guia_total_ide/ejecucion_20261026/mobile/m01_actual.png](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/mobile/m01_actual.png)

![Figura 23. Paso 1 · M01 · sin sesión. Acceso móvil real sin credenciales visibles.](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/mobile/m01_actual.png)

## M02 Mis rutas y hoja de reparto

Flutter · Ruta /routes · Procesos P02, P03, P07 · Principal de Luis

**Actor y permiso** Conductor de Grupo MICOTRANS SAC con rol DRIVER y cuenta vinculada a un conductor activo. El Dispatcher prepara y despacha; la Jefatura aprueba. El alumno explica esas responsabilidades sin atribuirlas al botón móvil.

**Qué decir** Consulto la hoja del conductor autenticado, reviso los recursos y acepto la jornada aprobada. Enzo realiza el despacho web y después actualizo Mis rutas. El mapa ayuda a orientarse; una propuesta de trazado no acredita recorrido GPS. Abro una parada autorizada y mantengo el identificador para explicar la entrega.

**Qué demostrar** Seleccionar ruta propia PLANNED aprobada; revisar hoja/carga/vehículo y aceptar con confirmación servidor. Ceder a web para despacho; actualizar y comprobar ruta IN_PROGRESS y pedidos IN_TRANSIT. Mostrar mapa/listado, abrir siguiente parada y regresar desde detalle/perfil/historial/sync conservando selección.

**Estados y alternativas previstos** Sin rutas; selección; revisión/aceptación; PLANNED frente IN_PROGRESS; caché explícita; error/reintento; GPS/teselas sin disponibilidad. Aceptar no despacha: volver a web. Detalle operativo exige ruta/estado permitidos; regreso desde detalle/perfil/history/sync conserva contexto.

### De la acción al código

RoutesPage → RouteBloc/GetDriverRoutes → RouteRepositoryImpl/RouteRemoteDataSourceImpl → GET /routes, GET /{id}/review, POST /{id}/acceptance.

RouteController/BusinessWorkflowController → BusinessWorkflowService.accept → R2dbcBusinessWorkflowAdapter → route_dispatch_reviews.

GpsBloc → GPS /ping → GpsController → GpsUseCasesImpl → R2dbcVehicleGpsHistoryRepository → vehicle_gps_history; GET /path devuelve propuesta.

### Código explicado paso a paso

[Fragmento 1 · mobile-app/lib/features/routes/data/datasources/route_remote_data_source.dart · L62 a L64](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/mobile-app/lib/features/routes/data/datasources/route_remote_data_source.dart)

```dart
  62  Future<void> accept(int routeId) async {
  63    await client.post('/routes/$routeId/acceptance', data: {});
  64  }
```

**Lectura de las líneas** L62: Recibe el ID de la ruta elegida. L63: Espera POST /routes/{id}/acceptance sin inventar un estado de despacho.

**Contrato y límite** La fuente de datos devuelve Future<void> o falla. Bloc y repositorio deben reflejar la respuesta; aceptar la hoja no cambia la ruta a IN_PROGRESS.

[Fragmento 2 · src/main/java/com/ecoroute/backend/application/services/BusinessWorkflowService.java · L63 a L68](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/application/services/BusinessWorkflowService.java)

```java
  63  public Mono<Review> accept(Long id,Long driverId,String actor) {
  64      return plannedRoute(id).flatMap(route -> {
  65          if(!route.driverId().equals(driverId)) return Mono.error(new BusinessRuleException("La hoja no corresponde al conductor"));
  66          return workflow.review(id).flatMap(review -> {
  67              if(!review.approved()) return Mono.error(new BusinessRuleException("La jefatura debe aprobar primero el plan"));
  68              return workflow.accept(id,actor).then(workflow.audit("P02","ROUTE",id,"DRIVER_ACCEPTED",actor,"El conductor revisó hoja, carga y vehículo"))
```

**Lectura de las líneas** L65: La hoja debe pertenecer al conductor efectivo. L67: La revisión debe estar aprobada. L68: El puerto guarda aceptación y auditoría del actor.

**Contrato y límite** Entrada: ruta, conductor y actor autenticados. Salida: revisión de planificación. Si falta aprobación o la ruta es ajena, el servidor rechaza aunque el botón sea visible.

**Puerto y SQL** Puertos referenciados: AddGpsLocationUseCase, BusinessWorkflowPort, CreateRouteUseCase, GetAllRoutesUseCase, GetGpsHistoryByVehicleUseCase, OrderRepository, RouteRepository, UpdateRouteStatusUseCase, VehicleGpsHistoryRepository. Tablas identificadas: business_audit_events, order_business_data, route_dispatch_reviews, routes, vehicle_gps_history.

### Archivos y métodos para abrir en el IDE

[mobile-app/lib/features/routes/presentation/pages/routes_page.dart](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/mobile-app/lib/features/routes/presentation/pages/routes_page.dart) — RoutesPage L29

[src/main/java/com/ecoroute/backend/infrastructure/input/rest/RouteController.java](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/infrastructure/input/rest/RouteController.java) — RouteController L25; @PostMapping L35; @PatchMapping("/{id}/status") L52; @GetMapping L57; @DeleteMapping("/{id}") L67; @GetMapping("/{id}/path") L77

[src/main/java/com/ecoroute/backend/application/services/BusinessWorkflowService.java](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/application/services/BusinessWorkflowService.java) — BusinessWorkflowService L14; confirm() L23; approve() L43; accept() L63

[src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessWorkflowAdapter.java](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessWorkflowAdapter.java) — R2dbcBusinessWorkflowAdapter L13; confirmation() L15; saveConfirmation() L22; review() L34; approve() L40; accept() L47; invalidate() L51; requireConfirmed() L55; requireDispatchReview() L58; audit() L62

[mobile-app/lib/features/routes/presentation/bloc/route_bloc.dart](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/mobile-app/lib/features/routes/presentation/bloc/route_bloc.dart) — RouteBloc L6

[mobile-app/lib/features/routes/domain/usecases/get_driver_routes.dart](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/mobile-app/lib/features/routes/domain/usecases/get_driver_routes.dart) — GetDriverRoutes L6

[mobile-app/lib/features/routes/data/repositories/route_repository_impl.dart](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/mobile-app/lib/features/routes/data/repositories/route_repository_impl.dart) — RouteRepositoryImpl L8

[mobile-app/lib/features/routes/data/datasources/route_remote_data_source.dart](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/mobile-app/lib/features/routes/data/datasources/route_remote_data_source.dart) — RouteRemoteDataSourceImpl L14

[mobile-app/lib/features/gps/presentation/bloc/gps_bloc.dart](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/mobile-app/lib/features/gps/presentation/bloc/gps_bloc.dart) — GpsBloc L10

[src/main/java/com/ecoroute/backend/infrastructure/input/rest/BusinessWorkflowController.java](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/infrastructure/input/rest/BusinessWorkflowController.java) — BusinessWorkflowController L15; @GetMapping("/orders/{id}/business-data") L19; @PatchMapping("/orders/{id}/business-data") L23; @GetMapping("/routes/{id}/review") L29; @PostMapping("/routes/{id}/review") L33; @PostMapping("/routes/{id}/acceptance") L38

[src/main/java/com/ecoroute/backend/infrastructure/input/rest/GpsController.java](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/infrastructure/input/rest/GpsController.java) — GpsController L21; @PostMapping("/ping") L29; @GetMapping("/history/{vehicleId}") L54

[src/main/java/com/ecoroute/backend/application/usecases/GpsUseCasesImpl.java](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/application/usecases/GpsUseCasesImpl.java) — GpsUseCasesImpl L14; addGpsLocation() L19; getGpsHistory() L24

[src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcVehicleGpsHistoryRepository.java](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcVehicleGpsHistoryRepository.java) — R2dbcVehicleGpsHistoryRepository L10; save() L19; findByVehicleIdOrderByPingTimeDesc() L26

[mobile-app/lib/core/router/app_router.dart](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/mobile-app/lib/core/router/app_router.dart) — path: '/routes' L41

### Evidencia de esta pantalla

Figura 24. Paso 3 · M02 · planificada. Ruta22 de hoy con tres paradas y propuesta por calles OSRM.

[Imagen completa · docs/guia_total_ide/ejecucion_20261026/mobile/m02_hoy.png](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/mobile/m02_hoy.png)

![Figura 24. Paso 3 · M02 · planificada. Ruta22 de hoy con tres paradas y propuesta por calles OSRM.](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/mobile/m02_hoy.png)

Figura 25. Paso 4 · M02 · revisión superior. Hoja aprobada por administración, antes de la aceptación del conductor.

[Imagen completa · docs/guia_total_ide/ejecucion_20261026/mobile/m02_revision_hoy.png](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/mobile/m02_revision_hoy.png)

![Figura 25. Paso 4 · M02 · revisión superior. Hoja aprobada por administración, antes de la aceptación del conductor.](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/mobile/m02_revision_hoy.png)

Figura 26. Paso 5 · M02 · control de aceptación. Continuación de la revisión con observaciones y botón de aceptación.

[Imagen completa · docs/guia_total_ide/ejecucion_20261026/mobile/m02_aceptacion_control.png](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/mobile/m02_aceptacion_control.png)

![Figura 26. Paso 5 · M02 · control de aceptación. Continuación de la revisión con observaciones y botón de aceptación.](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/mobile/m02_aceptacion_control.png)

Figura 27. Paso 6 · M02 · aceptada. Aceptación registrada por el servidor desde la cuenta del conductor.

[Imagen completa · docs/guia_total_ide/ejecucion_20261026/mobile/m02_aceptada.png](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/mobile/m02_aceptada.png)

![Figura 27. Paso 6 · M02 · aceptada. Aceptación registrada por el servidor desde la cuenta del conductor.](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/mobile/m02_aceptada.png)

Figura 28. Paso 9 · M02 · en ejecución. Los mismos pedidos48,49,50 en tránsito después del despacho web.

[Imagen completa · docs/guia_total_ide/ejecucion_20261026/mobile/m02_en_curso.png](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/mobile/m02_en_curso.png)

![Figura 28. Paso 9 · M02 · en ejecución. Los mismos pedidos48,49,50 en tránsito después del despacho web.](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/mobile/m02_en_curso.png)

Figura 29. Paso 31 · M02 · sincronizado. Tras recuperar red y reautenticar al mismo conductor, pedido48 aparece entregado.

[Imagen completa · docs/guia_total_ide/ejecucion_20261026/mobile/m02_tras_sincronizar.png](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/mobile/m02_tras_sincronizar.png)

![Figura 29. Paso 31 · M02 · sincronizado. Tras recuperar red y reautenticar al mismo conductor, pedido48 aparece entregado.](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/mobile/m02_tras_sincronizar.png)

Figura 30. Paso 38 · M02 · resultado final. Ruta22 COMPLETED: un entregado, un fallido y un devuelto; no equivale a tres entregas exitosas.

[Imagen completa · docs/guia_total_ide/ejecucion_20261026/mobile/m02_final_recorrido.png](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/mobile/m02_final_recorrido.png)

![Figura 30. Paso 38 · M02 · resultado final. Ruta22 COMPLETED: un entregado, un fallido y un devuelto; no equivale a tres entregas exitosas.](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/mobile/m02_final_recorrido.png)

## M03 Detalle de pedido y prueba de entrega POD

Flutter · Ruta /orders/:id · Procesos P03, P04 · Principal de Luis

**Actor y permiso** Conductor de Grupo MICOTRANS SAC. Captura el resultado de su parada y la evidencia declarada por el receptor; el backend controla propiedad del pedido y reglas de estado. El Dispatcher y la Jefatura atienden las decisiones posteriores de incidencias.

**Qué decir** Registro foto, receptor, firma y GPS de la parada. Guardar evidencia local permite recuperarla, pero la entrega remota se confirma únicamente cuando el servidor acepta el POD. Si queda pendiente, lo reviso en Sincronización. Si no puedo entregar, declaro el motivo y paso la excepción a Incidencias sin convertirla en una entrega exitosa.

**Qué demostrar** Abrir desde Mis rutas y avanzar estado permitido; histórico/terminal permanece en consulta. Capturar foto, receptor/DNI, firma y GPS actual; enviar POD y distinguir confirmado, pendiente o rechazado. Para no entrega registrar motivo suficiente y pasar incidencia a web; después consultar mismo POD desde Pedidos.

**Estados y alternativas previstos** Detalle operativo/consulta; cámara, firma, receptor/DNI, GPS actual y envío confirmado/pendiente/rechazado. Enlace sin extra OrderEntity/canOperate o ID discordante: recuperación a Mis rutas. No entrega exige motivo; pendiente local bloquea duplicación.

### De la acción al código

OrderDetailPage → OrderBloc/UpdateOrderStatus → OrderRepositoryImpl/OrderRemoteDataSourceImpl → PATCH /orders/{id}/status → OrderController/OrderUseCasesImpl → orders/historial.

POD → ProofSync.submit → LocalCache.enqueue → POST /delivery-proofs → DeliveryProofController → CreateDeliveryProofUseCaseImpl → R2dbcDeliveryProofRepository/S3/integridad/backup → delivery_proofs, estado e historial.

### Código explicado paso a paso

[Fragmento 1 · mobile-app/lib/core/sync/proof_sync.dart · L58 a L64](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/mobile-app/lib/core/sync/proof_sync.dart)

```dart
  58  await cache.enqueue(
  59      owner, proof); // Durable write MUST finish before any HTTP.
  60  await reload();
  61  await sync();
  62  final pending = await cache.pending(owner);
  63  final match = pending.where((p) => p['orderId'] == proof['orderId']);
  64  if (match.isEmpty) return SubmissionResult.confirmed;
```

**Lectura de las líneas** L58: Inicia la escritura durable antes de cualquier envío HTTP. L60: Recarga la cola para presentarla. L61: Intenta sincronizar. L64: Solo la ausencia en la cola tras el intento produce confirmed en este método.

**Contrato y límite** submit distingue confirmed, queued y rejected. La cola pertenece a una cuenta; el servidor sigue siendo la autoridad sobre el POD y el estado del pedido.

[Fragmento 2 · src/main/java/com/ecoroute/backend/application/usecases/CreateDeliveryProofUseCaseImpl.java · L57 a L61](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/application/usecases/CreateDeliveryProofUseCaseImpl.java)

```java
  57  if (order.status() == OrderStatus.DELIVERED)
  58      return deliveryProofRepository.findByOrderId(order.id())
  59              .switchIfEmpty(Mono.error(new BusinessRuleException("El pedido figura entregado sin prueba; requiere conciliación")));
  60  if (order.status()!=OrderStatus.IN_TRANSIT)
  61      return Mono.error(new BusinessRuleException("Solo se confirma una entrega de un pedido en tránsito"));
```

**Lectura de las líneas** L57: Si ya está entregado busca la evidencia existente. L59: Un entregado sin prueba exige conciliación. L60: Una nueva confirmación requiere IN_TRANSIT. L61: Rechaza otros estados antes de continuar el guardado.

**Contrato y límite** El caso valida GPS, receptor e imágenes antes de estas guardas. Persistencia, integridad e historial completan la confirmación; una imagen capturada en el teléfono todavía no es esa confirmación.

**Puerto y SQL** Puertos referenciados: AssignOrderUseCase, BusinessWorkflowPort, CreateDeliveryProofUseCase, CreateOrderUseCase, DeliveryProofRepository, EvidenceBackupPort, GetAllOrdersUseCase, GetOrderByIdUseCase, OrderAuditPort, OrderRepository, ProofIntegrityPort, RouteRepository, UpdateOrderStatusUseCase, UpdateRouteStatusUseCase. Tablas identificadas: delivery_proofs, local_evidence_backups, orders.

### Archivos y métodos para abrir en el IDE

[mobile-app/lib/features/orders/presentation/pages/order_detail_page.dart](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/mobile-app/lib/features/orders/presentation/pages/order_detail_page.dart) — OrderDetailPage L16

[src/main/java/com/ecoroute/backend/infrastructure/input/rest/DeliveryProofController.java](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/infrastructure/input/rest/DeliveryProofController.java) — DeliveryProofController L25; @PostMapping L34; @GetMapping("/{orderId}") L50; @GetMapping("/{orderId}/photo") L56; @GetMapping("/{orderId}/signature") L60; @GetMapping("/{orderId}/pdf") L69

[src/main/java/com/ecoroute/backend/application/usecases/CreateDeliveryProofUseCaseImpl.java](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/application/usecases/CreateDeliveryProofUseCaseImpl.java) — CreateDeliveryProofUseCaseImpl L29; createDeliveryProof() L41

[src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcDeliveryProofRepository.java](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcDeliveryProofRepository.java) — R2dbcDeliveryProofRepository L9; save() L18; findByOrderId() L25

[mobile-app/lib/features/orders/presentation/bloc/order_bloc.dart](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/mobile-app/lib/features/orders/presentation/bloc/order_bloc.dart) — OrderBloc L7

[mobile-app/lib/features/orders/domain/usecases/update_order_status.dart](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/mobile-app/lib/features/orders/domain/usecases/update_order_status.dart) — UpdateOrderStatus L6

[mobile-app/lib/features/orders/data/repositories/order_repository_impl.dart](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/mobile-app/lib/features/orders/data/repositories/order_repository_impl.dart) — OrderRepositoryImpl L15

[mobile-app/lib/features/orders/data/datasources/order_remote_data_source.dart](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/mobile-app/lib/features/orders/data/datasources/order_remote_data_source.dart) — OrderRemoteDataSourceImpl L10

[mobile-app/lib/features/orders/presentation/widgets/signature_pad.dart](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/mobile-app/lib/features/orders/presentation/widgets/signature_pad.dart) — SignaturePad L7

[mobile-app/lib/core/sync/proof_sync.dart](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/mobile-app/lib/core/sync/proof_sync.dart) — ProofSync L10

[mobile-app/lib/core/cache/local_cache.dart](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/mobile-app/lib/core/cache/local_cache.dart) — LocalCache L6

[src/main/java/com/ecoroute/backend/infrastructure/input/rest/OrderController.java](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/infrastructure/input/rest/OrderController.java) — OrderController L20; @PostMapping L33; @GetMapping("/{id}") L39; @GetMapping L44; @DeleteMapping("/{id}") L53; @PatchMapping("/{id}/status") L58; @PatchMapping("/{id}/route") L63; @PatchMapping("/{id}/delivery-window") L68; @PostMapping("/bulk-csv") L77; @PostMapping("/bulk-csv/preview") L81

[src/main/java/com/ecoroute/backend/application/usecases/OrderUseCasesImpl.java](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/application/usecases/OrderUseCasesImpl.java) — OrderUseCasesImpl L28; createOrder() L51; assignOrder() L74; getOrderById() L99; changeDeliveryWindow() L105; getAllOrders() L128; updateStatusManual() L134

[src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcProofIntegrityAdapter.java](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcProofIntegrityAdapter.java) — R2dbcProofIntegrityAdapter L10; record() L12

[src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcEvidenceBackupAdapter.java](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcEvidenceBackupAdapter.java) — R2dbcEvidenceBackupAdapter L9; store() L11; read() L15

[mobile-app/lib/core/router/app_router.dart](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/mobile-app/lib/core/router/app_router.dart) — path: '/orders/:id' L46

### Evidencia de esta pantalla

Figura 31. Paso 11 · M03 · detalle. Detalle móvil de pedido48 antes de confirmar el POD.

[Imagen completa · docs/guia_total_ide/ejecucion_20261026/mobile/m03_detalle.png](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/mobile/m03_detalle.png)

![Figura 31. Paso 11 · M03 · detalle. Detalle móvil de pedido48 antes de confirmar el POD.](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/mobile/m03_detalle.png)

Figura 32. Paso 13 · M03 · alternativas. Estados disponibles para la parada en tránsito.

[Imagen completa · docs/guia_total_ide/ejecucion_20261026/mobile/m03_estados.png](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/mobile/m03_estados.png)

![Figura 32. Paso 13 · M03 · alternativas. Estados disponibles para la parada en tránsito.](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/mobile/m03_estados.png)

Figura 33. Paso 15 · M03 · POD superior. Formulario POD superior: entrega seleccionada y foto obligatoria.

[Imagen completa · docs/guia_total_ide/ejecucion_20261026/mobile/m03_formulario_pod.png](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/mobile/m03_formulario_pod.png)

![Figura 33. Paso 15 · M03 · POD superior. Formulario POD superior: entrega seleccionada y foto obligatoria.](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/mobile/m03_formulario_pod.png)

Figura 34. Paso 16 · M03 · cámara. Cámara virtual del emulador usada para evidencia sintética.

[Imagen completa · docs/guia_total_ide/ejecucion_20261026/mobile/m03_camara.png](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/mobile/m03_camara.png)

![Figura 34. Paso 16 · M03 · cámara. Cámara virtual del emulador usada para evidencia sintética.](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/mobile/m03_camara.png)

Figura 35. Paso 17 · M03 · foto adjunta. Foto de ensayo adjunta al pedido, todavía sin envío al servidor.

[Imagen completa · docs/guia_total_ide/ejecucion_20261026/mobile/m03_foto_adjunta.png](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/mobile/m03_foto_adjunta.png)

![Figura 35. Paso 17 · M03 · foto adjunta. Foto de ensayo adjunta al pedido, todavía sin envío al servidor.](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/mobile/m03_foto_adjunta.png)

Figura 36. Paso 18 · M03 · receptor y firma. Receptor y firma sintéticos antes de confirmar su captura.

[Imagen completa · docs/guia_total_ide/ejecucion_20261026/mobile/m03_firma_trazo.png](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/mobile/m03_firma_trazo.png)

![Figura 36. Paso 18 · M03 · receptor y firma. Receptor y firma sintéticos antes de confirmar su captura.](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/mobile/m03_firma_trazo.png)

Figura 37. Paso 20 · M03 · POD preparado. Firma guardada y datos preparados; todavía falta confirmar remotamente.

[Imagen completa · docs/guia_total_ide/ejecucion_20261026/mobile/m03_pod_listo.png](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/mobile/m03_pod_listo.png)

![Figura 37. Paso 20 · M03 · POD preparado. Firma guardada y datos preparados; todavía falta confirmar remotamente.](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/mobile/m03_pod_listo.png)

Figura 38. Paso 23 · M03 · offline pendiente. Evidencia de pedido48 guardada sin conexión; el estado remoto aún no está confirmado.

[Imagen completa · docs/guia_total_ide/ejecucion_20261026/mobile/m03_offline_guardado.png](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/mobile/m03_offline_guardado.png)

![Figura 38. Paso 23 · M03 · offline pendiente. Evidencia de pedido48 guardada sin conexión; el estado remoto aún no está confirmado.](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/mobile/m03_offline_guardado.png)

Figura 39. Paso 33 · M03 · excepción ausencia. No entrega de pedido49 con motivo sintético de ausencia; debe enviarse con conexión.

[Imagen completa · docs/guia_total_ide/ejecucion_20261026/mobile/m03_fallo_motivo.png](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/mobile/m03_fallo_motivo.png)

![Figura 39. Paso 33 · M03 · excepción ausencia. No entrega de pedido49 con motivo sintético de ausencia; debe enviarse con conexión.](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/mobile/m03_fallo_motivo.png)

Figura 40. Paso 35 · M03 · excepción devolución. Devolución de pedido50 por rechazo del destinatario, con motivo registrado.

[Imagen completa · docs/guia_total_ide/ejecucion_20261026/mobile/m03_devolucion_motivo.png](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/mobile/m03_devolucion_motivo.png)

![Figura 40. Paso 35 · M03 · excepción devolución. Devolución de pedido50 por rechazo del destinatario, con motivo registrado.](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/mobile/m03_devolucion_motivo.png)

## M06 Sincronización de evidencias

Flutter · Ruta /sync · Procesos P03, P04 · Pantalla de apoyo

**Actor y permiso** DRIVER autenticado; login público antes de sesión

**Qué decir** Distingue captura local de entrega remota. Presenta pendientes/rechazadas, error y reintento; las confirmadas salen de la cola. ProofSync escribe durable antes de HTTP y evita vuelos simultáneos por propietario. Envía Idempotency-Key con orderId y retira cola tras éxito. Errores 4xx de negocio quedan bloqueados salvo sesión/timeout/límite; reintento explícito incluye rechazados. Cambiar cuenta no debe enviar ni mostrar cola ajena. La clave no reemplaza integridad del servidor; observaciones pueden escalar a P04.

**Qué demostrar** Abrir desde Perfil/Mis rutas y presentar cola vacía tras confirmación. Caso preparado sin conexión: guardar POD pendiente, recuperar red y reintentar. Mostrar último error/rechazo y correlacionar orderId con POD web confirmado.

**Estados y alternativas previstos** Vacía, pendientes, sincronizando, rechazadas bloqueadas y fallo de procesamiento. Cambio de cuenta detiene drenado ajeno; reanudación/reintento manual. No crea otro pedido ni sustituye resolver incidencias de negocio.

### De la acción al código

SyncPage → ProofSync.reload/sync/_drain → LocalCache.pending/enqueue/remove/mutate → almacenamiento local por cuenta.

Dio POST /delivery-proofs → DeliveryProofController → CreateDeliveryProofUseCaseImpl → R2dbcDeliveryProofRepository/integridad/S3/backup → delivery_proofs y estado/historial.

Éxito retira cola; rechazo conserva evidencia/error. Confirmación depende del servidor, no del botón.

### Código explicado paso a paso

[Fragmento 1 · mobile-app/lib/core/sync/proof_sync.dart · L101 a L105](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/mobile-app/lib/core/sync/proof_sync.dart)

```dart
 101  await client.post('/delivery-proofs',
 102      data: payload,
 103      options: Options(
 104          extra: {'account': owner},
 105          headers: {'Idempotency-Key': '${proof['orderId']}'}));
```

**Lectura de las líneas** L101: Inicia el envío del payload sin metadatos internos de cola. L103: Asocia la petición con el propietario. L104: Usa orderId como Idempotency-Key. L105: Solo después del HTTP exitoso retira el elemento durable.

**Contrato y límite** Un rechazo conserva la evidencia y su error; el reintento explícito puede incluir rechazados. La clave enviada no sustituye las guardas e integridad del servidor.

[Fragmento 2 · mobile-app/lib/core/cache/local_cache.dart · L41 a L46](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/mobile-app/lib/core/cache/local_cache.dart)

```dart
  41  Future<void> enqueue(String owner, Map<String, dynamic> proof) =>
  42      mutate(owner, (items) {
  43        if (!items.any((p) => p['orderId'] == proof['orderId'])) {
  44          items.add(proof);
  45        }
  46      });
```

**Lectura de las líneas** L41: El contrato recibe propietario y evidencia. L42: Modifica la cola mediante mutate. L43: Evita añadir dos entradas locales para el mismo orderId. L44: Añade la prueba nueva antes del envío.

**Contrato y límite** La deduplicación local pertenece a la cola de esa cuenta. No crea otro pedido ni demuestra que el servidor haya confirmado; al cambiar de cuenta no debe drenarse evidencia ajena.

**Puerto y SQL** Puertos referenciados: CreateDeliveryProofUseCase, DeliveryProofRepository, OrderAuditPort, OrderRepository, ProofIntegrityPort, UpdateRouteStatusUseCase. Tablas identificadas: delivery_proofs.

### Archivos y métodos para abrir en el IDE

[mobile-app/lib/core/sync/sync_page.dart](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/mobile-app/lib/core/sync/sync_page.dart) — SyncPage L5

[mobile-app/lib/core/sync/proof_sync.dart](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/mobile-app/lib/core/sync/proof_sync.dart) — submit() L56; sync() L70; _drain() L88

[mobile-app/lib/core/cache/local_cache.dart](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/mobile-app/lib/core/cache/local_cache.dart) — LocalCache L6

[src/main/java/com/ecoroute/backend/infrastructure/input/rest/DeliveryProofController.java](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/infrastructure/input/rest/DeliveryProofController.java) — DeliveryProofController L25; @PostMapping L34; @GetMapping("/{orderId}") L50; @GetMapping("/{orderId}/photo") L56; @GetMapping("/{orderId}/signature") L60; @GetMapping("/{orderId}/pdf") L69

[src/main/java/com/ecoroute/backend/application/usecases/CreateDeliveryProofUseCaseImpl.java](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/application/usecases/CreateDeliveryProofUseCaseImpl.java) — CreateDeliveryProofUseCaseImpl L29; createDeliveryProof() L41

[src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcDeliveryProofRepository.java](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcDeliveryProofRepository.java) — R2dbcDeliveryProofRepository L9; save() L18; findByOrderId() L25

[mobile-app/lib/core/router/app_router.dart](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/mobile-app/lib/core/router/app_router.dart) — path: '/sync' L34

### Evidencia de esta pantalla

Figura 41. Paso 24 · M06 · pendiente. Cola privada con el POD48 pendiente de confirmación del servidor.

[Imagen completa · docs/guia_total_ide/ejecucion_20261026/mobile/m06_pendiente.png](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/mobile/m06_pendiente.png)

![Figura 41. Paso 24 · M06 · pendiente. Cola privada con el POD48 pendiente de confirmación del servidor.](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/mobile/m06_pendiente.png)

Figura 42. Paso 51 · M06 · cola final vacía. Comprobación final de cero evidencias pendientes tras sincronizar el POD.

[Imagen completa · docs/guia_total_ide/ejecucion_20261026/mobile/m06_final_sin_pendientes.png](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/mobile/m06_final_sin_pendientes.png)

![Figura 42. Paso 51 · M06 · cola final vacía. Comprobación final de cero evidencias pendientes tras sincronizar el POD.](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/mobile/m06_final_sin_pendientes.png)

## M04 Historial de entregas

Flutter · Ruta /history · Procesos P03, P05 · Pantalla de apoyo

**Actor y permiso** DRIVER autenticado; login público antes de sesión

**Qué decir** Consulta terminales propios con selector de período y actualización; no reabre fallos. La fuente obtiene rutas/pedidos autorizados, comprueba cuenta y filtra conductor y DELIVERED/FAILED/RETURNED. El intervalo usa fecha local del dispositivo; no afirmar equivalencia exacta con filtros Lima del backend sin revisar zona horaria. Comprueba continuidad del tracking y apoya P05, sin fórmulas BI ni POD completo. Respaldo local no convierte información histórica en entrega recién confirmada.

**Qué demostrar** Abrir desde Mis rutas y cambiar período de últimos días. Identificar tracking, destinatario, dirección, fecha y estado del pedido demostrado. Actualizar/reintentar y regresar conservando contexto.

**Estados y alternativas previstos** Carga, error con Reintentar, vacío y terminales por período. Respaldo local cuando la fuente lo usa; identificar procedencia/cuenta. Sin alta, resolución de incidencia o transición propia de estado.

### De la acción al código

HistoryPage → HistoryBloc → HistoryRepositoryImpl → HistoryRemoteDataSourceImpl.getDeliveryHistory → GET /routes y /orders.

RouteController/OrderController → lectura y OperationalAccess → R2dbcRouteRepository/R2dbcOrderRepository → routes/orders.

LocalCache conserva historial por propietario; fecha/estado se filtran en fuente móvil, sin nueva tabla history.

### Código explicado paso a paso

[Fragmento 1 · mobile-app/lib/features/history/data/datasources/history_remote_data_source.dart · L38 a L41](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/mobile-app/lib/features/history/data/datasources/history_remote_data_source.dart)

```dart
  38  if (!routeIds.contains(row['routeId']) ||
  39      !['DELIVERED', 'FAILED', 'RETURNED'].contains(row['status'])) {
  40    continue;
  41  }
```

**Lectura de las líneas** L38: Exige que el pedido pertenezca a las rutas del conductor. L39: Admite únicamente DELIVERED, FAILED o RETURNED. L40: Los demás registros quedan fuera del historial terminal.

**Contrato y límite** La lectura filtra propiedad y estado; después aplica el período por fecha local del dispositivo. No hay reapertura ni escritura por consultar el historial.

[Fragmento 2 · mobile-app/lib/features/history/data/datasources/history_remote_data_source.dart · L49 a L53](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/mobile-app/lib/features/history/data/datasources/history_remote_data_source.dart)

```dart
  49    if (!at.isBefore(from) && at.isBefore(end)) result.add(item);
  50  }
  51  result.sort((a, b) => DateTime.parse(b.deliveredAt!)
  52      .compareTo(DateTime.parse(a.deliveredAt!)));
  53  return result;
```

**Lectura de las líneas** L49: Incluye desde el inicio y excluye el fin del período. L51: Ordena por fecha descendente. L53: Devuelve la lista filtrada al repositorio y Bloc.

**Contrato y límite** El contrato devuelve terminales fechados o falla si no puede verificar la cuenta. Revisar la zona del dispositivo antes de equiparar este corte con America/Lima del backend.

**Puerto y SQL** Puertos referenciados: AssignOrderUseCase, CreateOrderUseCase, CreateRouteUseCase, GetAllOrdersUseCase, GetAllRoutesUseCase, GetOrderByIdUseCase, OrderRepository, RouteRepository, UpdateOrderStatusUseCase, UpdateRouteStatusUseCase. Tablas identificadas: orders, routes.

### Archivos y métodos para abrir en el IDE

[mobile-app/lib/features/history/presentation/pages/history_page.dart](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/mobile-app/lib/features/history/presentation/pages/history_page.dart) — HistoryPage L8

[mobile-app/lib/features/history/presentation/bloc/history_bloc.dart](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/mobile-app/lib/features/history/presentation/bloc/history_bloc.dart) — HistoryBloc L6

[mobile-app/lib/features/history/data/repositories/history_repository_impl.dart](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/mobile-app/lib/features/history/data/repositories/history_repository_impl.dart) — HistoryRepositoryImpl L8

[mobile-app/lib/features/history/data/datasources/history_remote_data_source.dart](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/mobile-app/lib/features/history/data/datasources/history_remote_data_source.dart) — HistoryRemoteDataSourceImpl L11

[mobile-app/lib/core/cache/local_cache.dart](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/mobile-app/lib/core/cache/local_cache.dart) — LocalCache L6

[src/main/java/com/ecoroute/backend/infrastructure/input/rest/OrderController.java](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/infrastructure/input/rest/OrderController.java) — OrderController L20; @PostMapping L33; @GetMapping("/{id}") L39; @GetMapping L44; @DeleteMapping("/{id}") L53; @PatchMapping("/{id}/status") L58; @PatchMapping("/{id}/route") L63; @PatchMapping("/{id}/delivery-window") L68; @PostMapping("/bulk-csv") L77; @PostMapping("/bulk-csv/preview") L81

[src/main/java/com/ecoroute/backend/infrastructure/input/rest/RouteController.java](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/infrastructure/input/rest/RouteController.java) — RouteController L25; @PostMapping L35; @PatchMapping("/{id}/status") L52; @GetMapping L57; @DeleteMapping("/{id}") L67; @GetMapping("/{id}/path") L77

[src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcOrderRepository.java](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcOrderRepository.java) — R2dbcOrderRepository L10; save() L19; findAll() L26; findById() L32; lockById() L38; findByTrackingNumber() L43; findByRouteId() L49; deleteById() L55; updateStopSequence() L60

[src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcRouteRepository.java](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcRouteRepository.java) — R2dbcRouteRepository L12; save() L21; findById() L28; lockById() L34; findByDriverIdAndDate() L39; findAll() L45; findByFilters() L51; deleteById() L57; updatePathInfo() L62

[mobile-app/lib/core/router/app_router.dart](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/mobile-app/lib/core/router/app_router.dart) — path: '/history' L74

### Evidencia de esta pantalla

Figura 43. Paso 48 · M04 · historial final. Historial real con los tres resultados de la jornada del 26/10/2026.

[Imagen completa · docs/guia_total_ide/ejecucion_20261026/mobile/m04_historial_jornada.png](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/mobile/m04_historial_jornada.png)

![Figura 43. Paso 48 · M04 · historial final. Historial real con los tres resultados de la jornada del 26/10/2026.](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/mobile/m04_historial_jornada.png)

## M05 Perfil del conductor

Flutter · Ruta /profile · Procesos P08, P06, P03 · Pantalla de apoyo

**Actor y permiso** DRIVER autenticado; login público antes de sesión

**Qué decir** Reúne identidad y conductor: nombre, correo, roles, licencia y teléfono. Consulta con ID de sesión; muestra progreso y, ante fallo, conserva valores de identidad/campos no disponibles con mensaje. No edita licencia ni catálogo: corresponde a web P06. El tema pertenece a presentación local. Abre Sincronización y permite cerrar sesión; explica conservación de pendientes por cuenta y final de acceso P08. Ver ficha no habilita automáticamente una ruta.

**Qué demostrar** Abrir y comparar ID/nombre con conductor de jornada web. Mostrar información ficticia/rol y alternar tema oscuro/claro. Abrir sync, volver y cerrar sesión; usar misma cuenta al recuperar pendientes.

**Estados y alternativas previstos** No autenticado, carga, detalle recuperado y error/campos no disponibles. Tema claro/oscuro, /sync y LogoutRequested hacia login. Sin alta ni modal de edición de licencia desde esta pantalla.

### De la acción al código

ProfilePage._fetchDriverDetails → Dio inyectado → GET /drivers/{authState.user.id} → DriverController.getDriverById → DriverUseCasesImpl → R2dbcDriverRepository → drivers.

AuthBloc aporta identidad; ThemeBloc gestiona tema. LogoutRequested → AuthRepositoryImpl/AuthRemoteDataSourceImpl → OIDC /logout y contexto local; tema no escribe maestros.

### Código explicado paso a paso

[Fragmento 1 · mobile-app/lib/features/profile/presentation/pages/profile_page.dart · L38 a L43](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/mobile-app/lib/features/profile/presentation/pages/profile_page.dart)

```dart
  38  final response = await dio.get('/drivers/${authState.user.id}');
  39  if (!mounted) return;
  40  if (response.statusCode == 200 && response.data != null) {
  41    setState(() {
  42      _driverDetails = response.data as Map<String, dynamic>;
  43      _loadingDetails = false;
```

**Lectura de las líneas** L38: Consulta el driverId de la identidad autenticada. L39: Comprueba mounted antes de actualizar la vista. L40: Exige respuesta 200 con datos. L42: Guarda los detalles en estado de presentación.

**Contrato y límite** Es consulta de ficha, sin edición de licencia. Un fallo puede dejar campos no disponibles; alternar tema o mostrar el perfil no habilita recursos ni rutas.

[Fragmento 2 · src/main/java/com/ecoroute/backend/infrastructure/input/rest/DriverController.java · L44 a L48](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/infrastructure/input/rest/DriverController.java)

```java
  44  public Mono<Driver> getDriverById(@PathVariable Long id) {
  45      return getDriverByIdUseCase.getDriverById(id).filterWhen(driver -> access.managesOperation()
  46              .flatMap(manager -> manager ? Mono.just(true) : access.driverId().map(id::equals)))
  47              .switchIfEmpty(Mono.error(new org.springframework.security.access.AccessDeniedException("Conductor ajeno")));
  48  }
```

**Lectura de las líneas** L45: Lee el conductor y evalúa acceso de gestión. L46: Si no es gestor, exige que el ID coincida con el conductor efectivo. L47: La falta de un resultado autorizado produce acceso denegado.

**Contrato y límite** GET /drivers/{id} no confía solo en el identificador de Flutter. El puerto GetDriverByIdUseCase y DriverRepository aíslan la consulta de drivers.

**Puerto y SQL** Puertos referenciados: DriverRepository. Tablas identificadas: drivers.

### Archivos y métodos para abrir en el IDE

[mobile-app/lib/features/profile/presentation/pages/profile_page.dart](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/mobile-app/lib/features/profile/presentation/pages/profile_page.dart) — ProfilePage L12; _fetchDriverDetails() L30

[mobile-app/lib/core/theme/theme_bloc.dart](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/mobile-app/lib/core/theme/theme_bloc.dart) — ThemeBloc L35

[mobile-app/lib/features/auth/presentation/bloc/auth_bloc.dart](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/mobile-app/lib/features/auth/presentation/bloc/auth_bloc.dart) — AuthBloc L7

[mobile-app/lib/features/auth/data/datasources/auth_remote_data_source.dart](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/mobile-app/lib/features/auth/data/datasources/auth_remote_data_source.dart) — AuthRemoteDataSourceImpl L11

[src/main/java/com/ecoroute/backend/infrastructure/input/rest/DriverController.java](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/infrastructure/input/rest/DriverController.java) — DriverController L17; @PostMapping L26; @GetMapping("/{id}") L43; @GetMapping L50; @PutMapping("/{id}") L56; @DeleteMapping("/{id}") L73

[src/main/java/com/ecoroute/backend/application/usecases/DriverUseCasesImpl.java](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/application/usecases/DriverUseCasesImpl.java) — DriverUseCasesImpl L14; createDriver() L21; getDriverById() L26; getAllDrivers() L32; updateDriver() L37; deleteDriver() L58

[src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcDriverRepository.java](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcDriverRepository.java) — R2dbcDriverRepository L10; save() L19; findAll() L26; findById() L32; deleteById() L38

[mobile-app/lib/core/router/app_router.dart](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/mobile-app/lib/core/router/app_router.dart) — path: '/profile' L79

### Evidencia de esta pantalla

Figura 44. Paso 2 · M05 · perfil cargado. Perfil cargado del conductor efectivo, vínculo1, licencia y contacto local de ensayo.

[Imagen completa · docs/guia_total_ide/ejecucion_20261026/mobile/m05_retorno.png](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/mobile/m05_retorno.png)

![Figura 44. Paso 2 · M05 · perfil cargado. Perfil cargado del conductor efectivo, vínculo1, licencia y contacto local de ensayo.](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/mobile/m05_retorno.png)

## W05 Incidencias y decisiones P04

Web · Ruta /incidents · Procesos P04, P02, P03 · Principal de Renzo

**Actor y permiso** Dispatcher para registrar y coordinar RETRY/REPLAN; ADMIN para CLOSE_FAILED/CLOSE_CASE. La Jefatura logística del BPMN es una responsabilidad empresarial; el servidor exige el rol técnico ADMIN para el cierre definitivo (BusinessOperationsController.java:27-31 y BusinessOperationsService.java:48-53).

**Qué decir** Una excepción conserva su pedido original y su motivo. RETRY crea otro intento en la jornada activa; REPLAN dirige un nuevo intento a otra ruta PLANNED y renueva la revisión comercial. El cierre requiere la decisión y el permiso correspondientes. Resolver una incidencia no borra ni reabre el resultado terminal anterior.

**Qué demostrar** Registrar incidencia general o de pedido con ruta, tipo, severidad y descripción sustentada. Resolver con motivo/justificación y decisión permitida; elegir destino PLANNED si REPLAN. Identificar original, nuevo intento y actores; volver a P03 o P02 sin reabrir el pedido terminal.

**Estados y alternativas previstos** Registrar: ruta/pedido opcional/tipo/severidad/descripción. Resolver: motivo/justificación; OPEN/RESOLVED. RETRY exige jornada activa; REPLAN destino PLANNED distinto; CLOSE_FAILED/CLOSE_CASE solo ADMIN. CLOSE_CASE no altera entregado.

### De la acción al código

Incidents → useQuery/incidentService → GET/POST /incidents, PATCH /{id}/resolution → BusinessOperationsController → BusinessOperationsService.report/resolve.

R2dbcBusinessOperationsAdapter → incidents/order_attempts; RETRY crea nuevo IN_TRANSIT misma jornada activa; REPLAN nuevo ASSIGNED otra PLANNED y renueva comercial; original terminal permanece.

### Código explicado paso a paso

[Fragmento 1 · web-admin/src/pages/Incidents.tsx · L35 a L38](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/web-admin/src/pages/Incidents.tsx)

```tsx
  35  const failed = !!order && ['FAILED', 'RETURNED'].includes(order.status);
  36  const sameJourney = routes.some(r => r.id === incident.routeId && r.status === 'IN_PROGRESS');
  37  const [outcome, setOutcome] = useState<IncidentOutcome>(failed ? sameJourney ? 'RETRY' : 'REPLAN' : 'CLOSE_CASE');
  38  const [reason, setReason] = useState('');
```

**Lectura de las líneas** L35: Distingue pedidos fallidos o devueltos. L36: Comprueba si la jornada original sigue activa. L37: Elige una propuesta de decisión según esas condiciones; el usuario y el servidor aún deben validarla.

**Contrato y límite** El formulario propone RETRY o REPLAN y recoge justificación. Sus opciones no conceden permiso para cerrar un caso ni alteran el pedido original.

[Fragmento 2 · src/main/java/com/ecoroute/backend/application/services/BusinessOperationsService.java · L48 a L53](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/application/services/BusinessOperationsService.java)

```java
  48  public Mono<Incident> resolve(Long id,String outcome,String reason,Long nextRoute,String actor,boolean manager) {
  49      requireText(reason,5,"Indique el motivo de resolución");
  50      if(outcome==null || !Set.of("RETRY","REPLAN","CLOSE_FAILED","CLOSE_CASE").contains(outcome))
  51          return Mono.error(new IllegalArgumentException("Resolución inválida"));
  52      if((outcome.equals("CLOSE_FAILED") || outcome.equals("CLOSE_CASE")) && !manager)
  53          return Mono.error(new org.springframework.security.access.AccessDeniedException("El cierre definitivo requiere jefatura"));
```

**Lectura de las líneas** L49: Exige un motivo mínimo. L50: Limita las decisiones al contrato admitido. L52: Los cierres definitivos requieren manager. L53: Rechaza la operación sin ese permiso.

**Contrato y límite** Entrada: incidencia, decisión, motivo, destino y actor. Los controles posteriores comprueban estado y ruta; un nuevo intento conserva la relación con el original.

**Puerto y SQL** Puertos referenciados: BusinessOperationsPort. Tablas identificadas: improvement_actions, incidents, order_attempts.

### Archivos y métodos para abrir en el IDE

[web-admin/src/pages/Incidents.tsx](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/web-admin/src/pages/Incidents.tsx) — Incidents L59; IncidentForm L12; ResolutionForm L33

[web-admin/src/services/incidentService.ts](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/web-admin/src/services/incidentService.ts) — createIncident L8

[src/main/java/com/ecoroute/backend/infrastructure/input/rest/BusinessOperationsController.java](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/infrastructure/input/rest/BusinessOperationsController.java) — BusinessOperationsController L14; @GetMapping("/incidents") L17; @PostMapping("/incidents") L22; @PatchMapping("/incidents/{id}/resolution") L27; @GetMapping("/improvement-actions") L34; @PostMapping("/improvement-actions") L37; @PatchMapping("/improvement-actions/{id}") L42

[src/main/java/com/ecoroute/backend/application/services/BusinessOperationsService.java](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/application/services/BusinessOperationsService.java) — BusinessOperationsService L21; incidents() L27; incident() L28; report() L32; resolve() L48; improvements() L103; createAction() L105; updateAction() L116

[src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessOperationsAdapter.java](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessOperationsAdapter.java) — R2dbcBusinessOperationsAdapter L16; incidents() L34; incident() L37; createIncident() L40; resolve() L50; linkAttempt() L58; improvements() L62; improvement() L65; createImprovement() L68; updateImprovement() L77

[web-admin/src/App.tsx](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/web-admin/src/App.tsx) — path="/incidents" L63

### Evidencia de esta pantalla

Figura 45. Paso 36 · W05 · abierta. Incidencia generada desde la no entrega móvil del pedido49, con actor registrado por el servidor.

[Imagen completa · docs/guia_total_ide/ejecucion_20261026/web/v2_incidencia_generada.jpg](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_incidencia_generada.jpg)

![Figura 45. Paso 36 · W05 · abierta. Incidencia generada desde la no entrega móvil del pedido49, con actor registrado por el servidor.](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_incidencia_generada.jpg)

Figura 46. Paso 37 · W05 · formulario de resolución. Resolución administrativa de la incidencia14, justificando el cierre del intento fallido.

[Imagen completa · docs/guia_total_ide/ejecucion_20261026/web/v2_incidencia_resolucion.jpg](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_incidencia_resolucion.jpg)

![Figura 46. Paso 37 · W05 · formulario de resolución. Resolución administrativa de la incidencia14, justificando el cierre del intento fallido.](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_incidencia_resolucion.jpg)

Figura 47. Paso 39 · W05 · seguimiento. Casos de la ruta22: ausencia resuelta y devolución registrada, conservando el pedido original.

[Imagen completa · docs/guia_total_ide/ejecucion_20261026/web/v2_incidencias_estado.jpg](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_incidencias_estado.jpg)

![Figura 47. Paso 39 · W05 · seguimiento. Casos de la ruta22: ausencia resuelta y devolución registrada, conservando el pedido original.](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_incidencias_estado.jpg)

Figura 48. Paso 40 · W05 · formulario. Registro real de incidente de ruta o pedido, tipo, severidad y motivo; sin guardar.

[Imagen completa · docs/guia_total_ide/ejecucion_20261026/web/v2_incidencia_formulario.jpg](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_incidencia_formulario.jpg)

![Figura 48. Paso 40 · W05 · formulario. Registro real de incidente de ruta o pedido, tipo, severidad y motivo; sin guardar.](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_incidencia_formulario.jpg)

## W07 Dashboard web panel de control logístico

Web · Ruta /dashboard · Procesos P05, P07 · Principal de Adrian

**Actor y permiso** Administrador del sistema, como soporte a la jefatura logística de Grupo MICOTRANS. El rol técnico exigido por esta ruta es ADMIN; no basta con representar verbalmente al dispatcher.

**Qué decir** Leo los estados, la puntualidad evaluable, las entregas por conductor y los pedidos por distrito con el mismo rango. Cada fuente puede cargar o fallar por separado. Identifico la población antes de interpretar porcentajes. Un cierre con paradas terminales no significa que todas fueron entregadas; mantengo los filtros al pasar a Reportes y BI.

**Qué demostrar** Aplicar conductor y fechas inclusivas válidas; presentar población, estados y puntualidad evaluable. Mostrar gráficas por conductor/distrito y tarjetas operativas; contrastar pedido del flujo. Reintentar fuente fallida y trasladar desvíos a BI con el mismo rango, sin confundir paradas terminales con entregas exitosas.

**Estados y alternativas previstos** Un rango invertido impide las cuatro consultas analíticas y también se valida en AnalyticsFilter. Cada fuente tiene carga, vacío, error y reintento propios mediante SourceState; el fallo de una no acredita ni invalida por sí solo las otras.

### De la acción al código

El cambio de filtros actualiza useState y genera una query común; si el rango es inválido, las cuatro URL analíticas se vuelven null. Dashboard.tsx:13-19.

useQuery ejecuta GET con Axios, conserva datos/error por clave y cancela la petición anterior mediante AbortController al cambiar dependencias. useQuery.ts:6-24.

Axios utiliza baseURL /api y agrega el token de la sesión; el controlador recibe AnalyticsFilter y delega en DashboardService. api.ts:5-19; DashboardController.java:17-34.

### Código explicado paso a paso

[Fragmento 1 · web-admin/src/pages/Dashboard.tsx · L14 a L19](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/web-admin/src/pages/Dashboard.tsx)

```tsx
  14  const valid = !filters.startDate || !filters.endDate || filters.startDate <= filters.endDate;
  15  const query = valid ? filterQuery(filters) : '';
  16  const stats = useQuery<StatusCount[]>(valid ? `/dashboard/orders-by-status?${query}` : null);
  17  const timing = useQuery<DeliveryPerformance>(valid ? `/dashboard/delivery-performance?${query}` : null);
  18  const byDriver = useQuery<NameCount[]>(valid ? `/dashboard/deliveries-by-driver?${query}` : null);
  19  const district = useQuery<NameCount[]>(valid ? `/dashboard/orders-by-district?${query}` : null);
```

**Lectura de las líneas** L14: Valida el orden de fechas. L15: Construye una consulta común. L16: La primera fuente recibe URL o null; null evita consultar. L19: La cuarta fuente conserva los mismos filtros.

**Contrato y límite** Cuatro respuestas independientes alimentan estados, puntualidad, conductor y distrito. La presencia de una gráfica no confirma éxito de las otras fuentes.

[Fragmento 2 · src/main/java/com/ecoroute/backend/infrastructure/input/rest/DashboardController.java · L17 a L20](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/infrastructure/input/rest/DashboardController.java)

```java
  17  @GetMapping("/orders-by-status")
  18  public Flux<StatusCount> getOrderStats(@ModelAttribute AnalyticsFilter filter) {
  19      return dashboardService.getOrderStats(filter.driverId(), filter.startDate(), filter.endDate());
  20  }
```

**Lectura de las líneas** L17: Declara la ruta relativa a /dashboard. L18: Recibe AnalyticsFilter desde parámetros. L19: Delega al servicio y devuelve Flux de conteos por estado.

**Contrato y límite** GET /dashboard/orders-by-status es una lectura filtrada. DashboardService y AnalyticsQueryPort obtienen agregados; este endpoint no cambia pedidos.

**Puerto y SQL** Puertos referenciados: AnalyticsQueryPort. Tablas identificadas: analytics_goal_facts, analytics_goals, analytics_order_facts, analytics_route_facts, analytics_route_gps_quality, events, incidents, order_status_history, scoped_orders, scoped_routes.

### Archivos y métodos para abrir en el IDE

[web-admin/src/pages/Dashboard.tsx](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/web-admin/src/pages/Dashboard.tsx) — Dashboard L12

[web-admin/src/hooks/useQuery.ts](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/web-admin/src/hooks/useQuery.ts) — useQuery L6

[src/main/java/com/ecoroute/backend/infrastructure/input/rest/DashboardController.java](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/infrastructure/input/rest/DashboardController.java) — DashboardController L14; @GetMapping("/orders-by-status") L17; @GetMapping("/delivery-performance") L22; @GetMapping("/deliveries-by-driver") L27; @GetMapping("/orders-by-district") L32

[src/main/java/com/ecoroute/backend/application/services/DashboardService.java](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/application/services/DashboardService.java) — DashboardService L17; getOrderStats() L21; getDeliveryPerformance() L24; getDeliveriesByDriver() L27; getOrdersByDistrict() L30; getRouteEfficiency() L31; getSummary() L32; getGoal() L36; saveGoal() L40; getBi() L48

[src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcAnalyticsAdapter.java](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcAnalyticsAdapter.java) — R2dbcAnalyticsAdapter L19; ordersByStatus() L66; totals() L71; daily() L76; byDriver() L82; byDistrict() L92; causes() L98; efficiency() L118; goals() L149; saveGoal() L153

[web-admin/src/App.tsx](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/web-admin/src/App.tsx) — path="/dashboard" L69

### Evidencia de esta pantalla

Figura 49. Paso 46 · W07 · resultado final superior. Dashboard final del 26/10/2026, conductor Juan Pérez: tres pedidos, uno entregado y ninguno en tránsito.

[Imagen completa · docs/guia_total_ide/ejecucion_20261026/web/v2_dashboard_final_superior.jpg](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_dashboard_final_superior.jpg)

![Figura 49. Paso 46 · W07 · resultado final superior. Dashboard final del 26/10/2026, conductor Juan Pérez: tres pedidos, uno entregado y ninguno en tránsito.](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_dashboard_final_superior.jpg)

Figura 50. Paso 47 · W07 · resultado final inferior. Gráficos finales de la jornada y disponibilidad de flota liberada tras completar la ruta22.

[Imagen completa · docs/guia_total_ide/ejecucion_20261026/web/v2_dashboard_final_inferior.jpg](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_dashboard_final_inferior.jpg)

![Figura 50. Paso 47 · W07 · resultado final inferior. Gráficos finales de la jornada y disponibilidad de flota liberada tras completar la ruta22.](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_dashboard_final_inferior.jpg)

## W12 Reportes operativos

Web · Ruta /reports · Procesos P05, P07 · Pantalla de apoyo

**Actor y permiso** ADMIN

**Qué decir** Consolida resumen, entregas por conductor y eficiencia. Usa fechas inclusivas America/Lima y conductor. Las tres fuentes cargan/fallan independientemente: sección visible no acredita todas. Puntualidad exige POD y fin de ventana. Eficiencia distingue plan de GPS evaluable y duración operacional de servicio en domicilio. Contrasta Dashboard/BI conservando población e IDs. No incorpora edición ni aprobación de informes.

**Qué demostrar** Aplicar mismo conductor/rango de Dashboard/BI; leer población de puntualidad. Mostrar gráficas y tabla inferior con todas las columnas. Reintentar fuente fallida y trasladar desvíos al análisis P05.

**Estados y alternativas previstos** Summary/performance/efficiency independientes; rango inválido sin consulta; vacío y error parcial. GPS no evaluable es nulo; ausencia no equivale a cero ni plan a observación. Cierre terminal no implica éxito total.

### De la acción al código

Reports → useQuery → GET /api/reports/orders-summary, /driver-performance y /route-efficiency con filterQuery.

ReportController → DashboardService → AnalyticsQueryPort → R2dbcAnalyticsAdapter → orders/routes/delivery_proofs/telemetría, sin alterar estados.

EfficiencyTable presenta calidad GPS y métricas; no convierte fallos/devoluciones en entregas.

### Cómo interpretar la ruta 22 en eficiencia

Km plan conserva los 8,53 km persistidos al despacho. Los 3,19 km visibles después en Gestión de despacho proceden de GET /routes/{id}/path, recalculado desde el origen GPS actual y las paradas pendientes. El reporte no tiene que sustituir su plan histórico por esa propuesta actual; comparar ambos números como si midieran el mismo recorrido produciría una conclusión incorrecta.

**Qué decir** En la prueba de exposición de la ruta 22, la pausa prolongada de la demostración deja un intervalo entre muestras GPS mayor de 900 s. La distancia GPS y sus métricas derivadas quedan No evaluable; conservar el valor ausente y no convertirlo en 0 ni rellenarlo con el plan. Los 90 minutos de operación incluyen esa pausa larga de la exposición. Representan tiempo transcurrido de esa sesión local, no una entrega real ni minutos de atención al destinatario. Al explicar Min/parada terminal, recordar que reparte el tiempo total entre paradas terminales y no elimina automáticamente las pausas de la demostración.

### Código explicado paso a paso

[Fragmento 1 · web-admin/src/pages/Reports.tsx · L15 a L17](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/web-admin/src/pages/Reports.tsx)

```tsx
  15  const summary = useQuery<OrdersSummary>(valid ? `/reports/orders-summary?${query}` : null);
  16  const performance = useQuery<NameCount[]>(valid ? `/reports/driver-performance?${query}` : null);
  17  const efficiency = useQuery<RouteEfficiency[]>(valid ? `/reports/route-efficiency?${query}` : null);
```

**Lectura de las líneas** L15: Solicita resumen si las fechas son válidas. L16: Solicita rendimiento como fuente separada. L17: Solicita eficiencia con el mismo filtro, sin mezclar sus errores.

**Contrato y límite** Entrada: conductor y rango. Salida: tres lecturas independientes. Una distancia GPS no evaluable debe conservar su ausencia y no convertirse en cero.

[Fragmento 2 · src/main/java/com/ecoroute/backend/infrastructure/input/rest/ReportController.java · L21 a L24](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/infrastructure/input/rest/ReportController.java)

```java
  21  @GetMapping("/orders-summary")
  22  public Mono<OrderSummary> getOrdersSummary(@ModelAttribute AnalyticsFilter filter) {
  23      return dashboardService.getSummary(filter);
  24  }
```

**Lectura de las líneas** L21: Declara GET relativo a /reports. L22: Recibe AnalyticsFilter. L23: DashboardService devuelve Mono de resumen a partir del puerto analítico.

**Contrato y límite** La consulta resume la población filtrada, sin aprobar informes ni editar estados. Para comparar con Dashboard y BI hay que conservar conductor, fechas y denominadores.

**Puerto y SQL** Puertos referenciados: AnalyticsQueryPort. Tablas identificadas: analytics_goal_facts, analytics_goals, analytics_order_facts, analytics_route_facts, analytics_route_gps_quality, delivery_proofs, events, incidents, order_status_history, orders, routes, scoped_orders, scoped_routes.

### Archivos y métodos para abrir en el IDE

[web-admin/src/pages/Reports.tsx](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/web-admin/src/pages/Reports.tsx) — Reports L11

[web-admin/src/hooks/useQuery.ts](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/web-admin/src/hooks/useQuery.ts) — useQuery L6

[src/main/java/com/ecoroute/backend/infrastructure/input/rest/ReportController.java](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/infrastructure/input/rest/ReportController.java) — ReportController L18; @GetMapping("/orders-summary") L21; @GetMapping("/driver-performance") L26; @GetMapping("/route-efficiency") L31; @GetMapping("/bi") L36; @GetMapping("/goals/{code}") L41; @PutMapping("/goals/{code}") L46

[src/main/java/com/ecoroute/backend/application/services/DashboardService.java](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/application/services/DashboardService.java) — DashboardService L17; getOrderStats() L21; getDeliveryPerformance() L24; getDeliveriesByDriver() L27; getOrdersByDistrict() L30; getRouteEfficiency() L31; getSummary() L32; getGoal() L36; saveGoal() L40; getBi() L48

[src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcAnalyticsAdapter.java](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcAnalyticsAdapter.java) — R2dbcAnalyticsAdapter L19; ordersByStatus() L66; totals() L71; daily() L76; byDriver() L82; byDistrict() L92; causes() L98; efficiency() L118; goals() L149; saveGoal() L153

[web-admin/src/components/EfficiencyTable.tsx](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/web-admin/src/components/EfficiencyTable.tsx) — EfficiencyTable L4

[web-admin/src/App.tsx](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/web-admin/src/App.tsx) — path="/reports" L74

### Evidencia de esta pantalla

Figura 51. Paso 49 · W12 · final superior. Reportes finales filtrados: tres pedidos y una entrega a tiempo evaluable con POD y ventana.

[Imagen completa · docs/guia_total_ide/ejecucion_20261026/web/v2_reportes_final_superior.jpg](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_reportes_final_superior.jpg)

![Figura 51. Paso 49 · W12 · final superior. Reportes finales filtrados: tres pedidos y una entrega a tiempo evaluable con POD y ventana.](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_reportes_final_superior.jpg)

Figura 52. Paso 50 · W12 · eficiencia final. Ruta22: plan registrado8.53km, tiempo de operación de ensayo y GPS no evaluable por intervalo excesivo entre muestras.

[Imagen completa · docs/guia_total_ide/ejecucion_20261026/web/v2_reportes_final_tabla.jpg](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_reportes_final_tabla.jpg)

![Figura 52. Paso 50 · W12 · eficiencia final. Ruta22: plan registrado8.53km, tiempo de operación de ensayo y GPS no evaluable por intervalo excesivo entre muestras.](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_reportes_final_tabla.jpg)

## W13 Inteligencia de negocio

Web · Ruta /bi · Procesos P05, P06, P07 · Principal de Adrian

**Actor y permiso** Administrador como soporte de la jefatura logística de Grupo MICOTRANS. La pantalla global requiere ADMIN; no equivale a una aprobación empresarial de los indicadores.

**Qué decir** BI pertenece a EcoRoute y calcula indicadores con poblaciones diferentes. Un denominador ausente produce NO_DATA y una meta ausente produce NO_TARGET. Reviso tendencias, causas registradas, calidad y eficiencia sin convertir GPS no evaluable en cero. La meta vigente orienta la comparación; Acciones P05 permite asignar responsable y seguimiento a lo que la jefatura decide revisar.

**Qué demostrar** Aplicar conductor/rango y recorrer las siete vistas con gráficas/tablas completas. Metas: guardar valor 0–100 o vacío, comprobar actor/fecha y recarga de indicadores. Exportar CSV de indicadores/tendencias y abrir Acciones P05 para vincular causa, responsable y medición.

**Estados y alternativas previstos** Siete vistas: Tendencias, Causas, Cumplimiento, Calidad de datos, Eficiencia, Metas y Acciones P05. NO_DATA/NO_TARGET/MET/BELOW_TARGET; GPS nulo no es cero ni plan; causas son eventos; RUC opcional ausente afecta IID; POD metadata no prueba imágenes remotas.

### De la acción al código

BusinessIntelligence → useQuery → GET /reports/bi → ReportController → DashboardService.getBi → R2dbcAnalyticsAdapter → agregados operativos.

GoalEditor → reportService.saveGoal → PUT /reports/goals/{code} → DashboardService.saveGoal → R2dbcAnalyticsAdapter.saveGoal → analytics_goals e historial con actor.

Acciones P05 reutiliza ImprovementActions; biCsv exporta reporte recibido, tendencias comparan meta vigente.

### Código explicado paso a paso

[Fragmento 1 · web-admin/src/pages/BusinessIntelligence.tsx · L26 a L28](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/web-admin/src/pages/BusinessIntelligence.tsx)

```tsx
  26  try { await saveGoal(code, value === '' ? null : Number(value)); goal.reload(); setDraft(null); done(); setMessage('Meta persistida.'); }
  27  catch (cause) { setMessage(errorMessage(cause)); }
  28  finally { setBusy(false); }
```

**Lectura de las líneas** L26: Vacío envía null; un valor envía Number. Solo después de persistir recarga meta y reporte. L27: El fallo permanece como mensaje. L28: Libera busy incluso si falla la petición.

**Contrato y límite** La meta vigente se guarda por código de indicador; no reconstruye automáticamente las metas históricas de cada día ni rellena denominadores ausentes.

[Fragmento 2 · src/main/java/com/ecoroute/backend/application/services/DashboardService.java · L40 a L46](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/application/services/DashboardService.java)

```java
  40  public Mono<Goal> saveGoal(String code, BigDecimal target, String actor) {
  41      Indicator indicator = Indicator.parse(code);
  42      if (target != null && (target.signum() < 0 || target.compareTo(BigDecimal.valueOf(100)) > 0))
  43          throw new IllegalArgumentException("La meta debe estar entre 0 y 100");
  44      if (actor == null || actor.isBlank() || actor.length() > 100)
  45          throw new IllegalArgumentException("Actor de meta ausente o inválido");
  46      return analytics.saveGoal(indicator, target, actor);
```

**Lectura de las líneas** L41: Normaliza el código mediante Indicator. L42: Si hay valor exige el intervalo 0 a 100. L44: Comprueba la identidad del actor. L46: El puerto analytics persiste indicador, meta y actor.

**Contrato y límite** Entrada: código, meta nullable y actor autenticado. Salida: Goal persistida o rechazo. Los agregados BI se calculan por otra lectura y conservan NO_DATA y NO_TARGET.

**Puerto y SQL** Puertos referenciados: AnalyticsQueryPort. Tablas identificadas: analytics_goal_facts, analytics_goals, analytics_order_facts, analytics_route_facts, analytics_route_gps_quality, events, incidents, order_status_history, scoped_orders, scoped_routes.

### Archivos y métodos para abrir en el IDE

[web-admin/src/pages/BusinessIntelligence.tsx](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/web-admin/src/pages/BusinessIntelligence.tsx) — BusinessIntelligence L76; GoalEditor L18; BiCharts L36

[web-admin/src/services/reportService.ts](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/web-admin/src/services/reportService.ts) — export const emptyFilters: ReportFilters = { driverId: '', startDate: '', endDate: '' } L7

[src/main/java/com/ecoroute/backend/infrastructure/input/rest/ReportController.java](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/infrastructure/input/rest/ReportController.java) — ReportController L18; @GetMapping("/orders-summary") L21; @GetMapping("/driver-performance") L26; @GetMapping("/route-efficiency") L31; @GetMapping("/bi") L36; @GetMapping("/goals/{code}") L41; @PutMapping("/goals/{code}") L46

[src/main/java/com/ecoroute/backend/application/services/DashboardService.java](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/application/services/DashboardService.java) — DashboardService L17; getOrderStats() L21; getDeliveryPerformance() L24; getDeliveriesByDriver() L27; getOrdersByDistrict() L30; getRouteEfficiency() L31; getSummary() L32; getGoal() L36; saveGoal() L40; getBi() L48

[src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcAnalyticsAdapter.java](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcAnalyticsAdapter.java) — R2dbcAnalyticsAdapter L19; ordersByStatus() L66; totals() L71; daily() L76; byDriver() L82; byDistrict() L92; causes() L98; efficiency() L118; goals() L149; saveGoal() L153

[web-admin/src/App.tsx](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/web-admin/src/App.tsx) — path="/bi" L75

### Evidencia de esta pantalla

Figura 53. Paso 52 · W13 · indicadores finales. BI final del 26/10/2026: IID66.67% (2/3), CHR/TDE/SUCCESS33.33% (1/3) y ONTIME100% (1/1). Las metas administrativas no están configuradas.

[Imagen completa · docs/guia_total_ide/ejecucion_20261026/web/v2_final_bi_kpis.jpg](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_final_bi_kpis.jpg)

![Figura 53. Paso 52 · W13 · indicadores finales. BI final del 26/10/2026: IID66.67% (2/3), CHR/TDE/SUCCESS33.33% (1/3) y ONTIME100% (1/1). Las metas administrativas no están configuradas.](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_final_bi_kpis.jpg)

Figura 54. Paso 53 · W13 · tendencias finales. Evolución diaria real del ensayo, sin atribuir mejora causal a una única jornada.

[Imagen completa · docs/guia_total_ide/ejecucion_20261026/web/v2_final_bi_tendencias.jpg](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_final_bi_tendencias.jpg)

![Figura 54. Paso 53 · W13 · tendencias finales. Evolución diaria real del ensayo, sin atribuir mejora causal a una única jornada.](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_final_bi_tendencias.jpg)

Figura 55. Paso 54 · W13 · causas continuación. Continuación de Causas: motivos de incidencias y eventos por fuente; complementa los gráficos superiores de la misma vista.

[Imagen completa · docs/guia_total_ide/ejecucion_20261026/web/v2_final_bi_causas.jpg](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_final_bi_causas.jpg)

![Figura 55. Paso 54 · W13 · causas continuación. Continuación de Causas: motivos de incidencias y eventos por fuente; complementa los gráficos superiores de la misma vista.](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_final_bi_causas.jpg)

Figura 56. Paso 55 · W13 · cumplimiento final. Cumplimiento del ensayo: población y resultados por conductor; sin meta vigente no se calcula brecha.

[Imagen completa · docs/guia_total_ide/ejecucion_20261026/web/v2_final_bi_cumplimiento.jpg](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_final_bi_cumplimiento.jpg)

![Figura 56. Paso 55 · W13 · cumplimiento final. Cumplimiento del ensayo: población y resultados por conductor; sin meta vigente no se calcula brecha.](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_final_bi_cumplimiento.jpg)

Figura 57. Paso 56 · W13 · calidad final. Calidad de la jornada: integridad comercial y de ubicación, un POD completo y telemetría no evaluable.

[Imagen completa · docs/guia_total_ide/ejecucion_20261026/web/v2_final_bi_calidad.jpg](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_final_bi_calidad.jpg)

![Figura 57. Paso 56 · W13 · calidad final. Calidad de la jornada: integridad comercial y de ubicación, un POD completo y telemetría no evaluable.](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_final_bi_calidad.jpg)

Figura 58. Paso 57 · W13 · eficiencia continuación. Continuación de Eficiencia: minutos por parada terminal y tabla de calidad GPS; complementa los gráficos superiores.

[Imagen completa · docs/guia_total_ide/ejecucion_20261026/web/v2_final_bi_eficiencia.jpg](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_final_bi_eficiencia.jpg)

![Figura 58. Paso 57 · W13 · eficiencia continuación. Continuación de Eficiencia: minutos por parada terminal y tabla de calidad GPS; complementa los gráficos superiores.](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_final_bi_eficiencia.jpg)

Figura 59. Paso 58 · W13 · eficiencia tabla final. Calidad GPS detallada: intervalo excesivo entre muestras, plan8.53km y duración de la sesión de ensayo.

[Imagen completa · docs/guia_total_ide/ejecucion_20261026/web/v2_final_bi_eficiencia_tabla.jpg](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_final_bi_eficiencia_tabla.jpg)

![Figura 59. Paso 58 · W13 · eficiencia tabla final. Calidad GPS detallada: intervalo excesivo entre muestras, plan8.53km y duración de la sesión de ensayo.](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_final_bi_eficiencia_tabla.jpg)

Figura 60. Paso 59 · W13 · metas finales. Editores reales de metas administrativas de los cinco indicadores; consulta sin cambiar valores.

[Imagen completa · docs/guia_total_ide/ejecucion_20261026/web/v2_final_bi_metas.jpg](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_final_bi_metas.jpg)

![Figura 60. Paso 59 · W13 · metas finales. Editores reales de metas administrativas de los cinco indicadores; consulta sin cambiar valores.](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_final_bi_metas.jpg)

Figura 61. Paso 66 · W13 · causas gráfico global. Causas, gráfico global completo de los motivos registrados y comienzo del historial de estados.

[Imagen completa · docs/guia_total_ide/ejecucion_20261026/web/v2_final_bi_causas_global.jpg](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_final_bi_causas_global.jpg)

![Figura 61. Paso 66 · W13 · causas gráfico global. Causas, gráfico global completo de los motivos registrados y comienzo del historial de estados.](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_final_bi_causas_global.jpg)

Figura 62. Paso 67 · W13 · causas historial. Causas, gráfico del historial de estados completo y continuidad de los motivos de incidencias.

[Imagen completa · docs/guia_total_ide/ejecucion_20261026/web/v2_final_bi_causas_historial.jpg](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_final_bi_causas_historial.jpg)

![Figura 62. Paso 67 · W13 · causas historial. Causas, gráfico del historial de estados completo y continuidad de los motivos de incidencias.](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_final_bi_causas_historial.jpg)

Figura 63. Paso 68 · W13 · eficiencia tres gráficos. Primeros tres gráficos de eficiencia completos: plan frente a GPS, tiempo de operación y km por entrega. La cuarta gráfica y la tabla están en la continuación.

[Imagen completa · docs/guia_total_ide/ejecucion_20261026/web/v2_final_bi_eficiencia_tres_graficos.jpg](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_final_bi_eficiencia_tres_graficos.jpg)

![Figura 63. Paso 68 · W13 · eficiencia tres gráficos. Primeros tres gráficos de eficiencia completos: plan frente a GPS, tiempo de operación y km por entrega. La cuarta gráfica y la tabla están en la continuación.](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_final_bi_eficiencia_tres_graficos.jpg)

## W06 Acciones de mejora P05

Web · Ruta /improvement-actions · Procesos P05, P09 · Principal de Renzo

**Actor y permiso** ADMIN o DISPATCHER registran y dan seguimiento. Solo ADMIN verifica o descarta. ownerName identifica al responsable humano declarado; no constituye una asignación automática a una cuenta ni una regla de acceso por propietario (BusinessOperationsController.java:34-48; BusinessOperationsService.java:105-130).

**Qué decir** Convertimos una desviación revisada en una acción con causa, responsable, plazo e indicador. Registramos seguimiento y un resultado observado; la verificación corresponde al administrador. La base y la meta declaradas pertenecen a esta acción. VERIFIED documenta una verificación autorizada y no demuestra por sí solo que la acción causó una mejora empresarial.

**Qué demostrar** Crear acción con título, causa, responsable humano, compromiso e indicador; base/meta opcionales sustentadas. Registrar nota de seguimiento y pasar a IN_PROGRESS; ADMIN verifica con resultado observado o descarta. Abrir el mismo ID desde Acciones P05 de BI; explicar diferencia entre valores declarados y resultados operativos.

**Estados y alternativas previstos** Modal Nueva acción: causa/título/responsable/plazo/indicador/base/meta. Seguimiento: nota/resultado. IN_PROGRESS → VERIFIED requiere ADMIN y valor observado; VERIFIED/DISCARDED quedan consulta. No atribuir causalidad automática.

### De la acción al código

ImprovementActions → useQuery/improvementService → GET/POST /improvement-actions, PATCH /{id} → BusinessOperationsController → BusinessOperationsService.createAction/updateAction.

R2dbcBusinessOperationsAdapter → improvement_actions/auditoría; base/meta declaradas son de la acción, diferentes de KPI operativos.

### Código explicado paso a paso

[Fragmento 1 · web-admin/src/components/ImprovementActions.tsx · L44 a L46](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/web-admin/src/components/ImprovementActions.tsx)

```tsx
  44  if (status === 'VERIFIED' && (!hasRole(['ADMIN']) || result === '')) return;
  45  setBusy(true); setMessage('');
  46  try { await updateImprovement(action.id, status, note.trim(), result === '' ? undefined : Number(result)); done(); }
```

**Lectura de las líneas** L44: El cliente exige ADMIN y resultado para verificar. L45: Activa busy y limpia el mensaje anterior. L46: Envía estado, nota y resultado del mismo ID; refresca solo tras éxito.

**Contrato y límite** El formulario declara una medición y una decisión. La meta de la acción no modifica automáticamente los KPI operativos ni acredita causalidad.

[Fragmento 2 · src/main/java/com/ecoroute/backend/application/services/BusinessOperationsService.java · L116 a L122](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/application/services/BusinessOperationsService.java)

```java
 116  public Mono<Improvement> updateAction(Long id,String status,Double result,String note,String actor,boolean manager) {
 117      requireText(note,5,"Documente la evidencia o motivo");validateNumber(result);
 118      if(status==null || !Set.of("IN_PROGRESS","VERIFIED","DISCARDED").contains(status))
 119          return Mono.error(new IllegalArgumentException("Estado inválido"));
 120      if((status.equals("VERIFIED") || status.equals("DISCARDED")) && !manager)
 121          return Mono.error(new org.springframework.security.access.AccessDeniedException("Jefatura verifica o descarta la acción"));
 122      if(status.equals("VERIFIED") && result==null) return Mono.error(new IllegalArgumentException("Registre el resultado medido"));
```

**Lectura de las líneas** L117: Valida nota y número en el servidor. L118: Restringe el conjunto de estados. L120: Verificar o descartar exige permiso de jefatura. L122: VERIFIED necesita resultado medido.

**Contrato y límite** Entrada: ID, estado, resultado, nota y actor. El puerto de operaciones conserva el cambio y su auditoría; los estados cerrados tienen controles adicionales.

**Puerto y SQL** Puertos referenciados: BusinessOperationsPort. Tablas identificadas: improvement_actions, incidents, order_attempts.

### Archivos y métodos para abrir en el IDE

[web-admin/src/components/ImprovementActions.tsx](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/web-admin/src/components/ImprovementActions.tsx) — ImprovementActions L58; ActionForm L12; ActionUpdate L35

[web-admin/src/services/improvementService.ts](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/web-admin/src/services/improvementService.ts) — createImprovement L6

[src/main/java/com/ecoroute/backend/infrastructure/input/rest/BusinessOperationsController.java](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/infrastructure/input/rest/BusinessOperationsController.java) — BusinessOperationsController L14; @GetMapping("/incidents") L17; @PostMapping("/incidents") L22; @PatchMapping("/incidents/{id}/resolution") L27; @GetMapping("/improvement-actions") L34; @PostMapping("/improvement-actions") L37; @PatchMapping("/improvement-actions/{id}") L42

[src/main/java/com/ecoroute/backend/application/services/BusinessOperationsService.java](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/application/services/BusinessOperationsService.java) — BusinessOperationsService L21; incidents() L27; incident() L28; report() L32; resolve() L48; improvements() L103; createAction() L105; updateAction() L116

[src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessOperationsAdapter.java](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessOperationsAdapter.java) — R2dbcBusinessOperationsAdapter L16; incidents() L34; incident() L37; createIncident() L40; resolve() L50; linkAttempt() L58; improvements() L62; improvement() L65; createImprovement() L68; updateImprovement() L77

[web-admin/src/App.tsx](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/web-admin/src/App.tsx) — path="/improvement-actions" L64

### Evidencia de esta pantalla

Figura 64. Paso 41 · W06 · formulario. Acción de ensayo vinculada a CHR y causas observadas en ruta22; base y meta declaradas.

[Imagen completa · docs/guia_total_ide/ejecucion_20261026/web/v2_accion_formulario.jpg](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_accion_formulario.jpg)

![Figura 64. Paso 41 · W06 · formulario. Acción de ensayo vinculada a CHR y causas observadas en ruta22; base y meta declaradas.](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_accion_formulario.jpg)

Figura 65. Paso 42 · W06 · consulta. Acción de ensayo creada a partir de la ausencia y devolución de ruta22, con responsable, plazo y CHR.

[Imagen completa · docs/guia_total_ide/ejecucion_20261026/web/v2_acciones_listado.jpg](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_acciones_listado.jpg)

![Figura 65. Paso 42 · W06 · consulta. Acción de ensayo creada a partir de la ausencia y devolución de ruta22, con responsable, plazo y CHR.](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_acciones_listado.jpg)

Figura 66. Paso 43 · W06 · en progreso. Seguimiento de acción8: asignación de trabajo y nota de ensayo; no acredita mejora empresarial.

[Imagen completa · docs/guia_total_ide/ejecucion_20261026/web/v2_accion_seguimiento.jpg](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_accion_seguimiento.jpg)

![Figura 66. Paso 43 · W06 · en progreso. Seguimiento de acción8: asignación de trabajo y nota de ensayo; no acredita mejora empresarial.](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_accion_seguimiento.jpg)

Figura 67. Paso 44 · W06 · verificación. Revisión ADMIN de la acción8 con resultado observado de ensayo y meta no alcanzada; no acredita mejora real.

[Imagen completa · docs/guia_total_ide/ejecucion_20261026/web/v2_accion_verificacion.jpg](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_accion_verificacion.jpg)

![Figura 67. Paso 44 · W06 · verificación. Revisión ADMIN de la acción8 con resultado observado de ensayo y meta no alcanzada; no acredita mejora real.](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_accion_verificacion.jpg)

Figura 68. Paso 45 · W06 · cerrada. Acción8 VERIFIED: resultado de ensayo33.33 frente a meta90, con justificación y verificador; no hay mejora causal acreditada.

[Imagen completa · docs/guia_total_ide/ejecucion_20261026/web/v2_accion_cerrada.jpg](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_accion_cerrada.jpg)

![Figura 68. Paso 45 · W06 · cerrada. Acción8 VERIFIED: resultado de ensayo33.33 frente a meta90, con justificación y verificador; no hay mejora causal acreditada.](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/web/v2_accion_cerrada.jpg)

## Evidencias de navegación y de depuración

Campana ADMIN/DISPATCHER: conteo/lista no leída, abrir/marcar leída. Estados cerrado/abierto, carga, vacío, error/reintento.

NotificationPanel → useQuery/notificationService → GET /notifications/unread/count y /unread, PATCH /{id}/read → NotificationController → NotificationRepository/R2dbcNotificationRepository → notifications.

Sidebar expandido/colapsado, overlay móvil, foco/Escape/logout. Web wildcard → Inicio; móvil sin sesión → login; detalle extra inválido → recuperación Mis rutas.

[web-admin/src/components/NotificationPanel.tsx](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/web-admin/src/components/NotificationPanel.tsx) — const NotificationPanel L15

[src/main/java/com/ecoroute/backend/infrastructure/input/rest/NotificationController.java](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/infrastructure/input/rest/NotificationController.java) — NotificationController L16

[src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcNotificationRepository.java](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcNotificationRepository.java) — R2dbcNotificationRepository L10

[web-admin/src/components/Sidebar.tsx](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/web-admin/src/components/Sidebar.tsx) — const Sidebar L29

[mobile-app/lib/core/router/app_router.dart](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/mobile-app/lib/core/router/app_router.dart) — GoRouter createAppRouter L14

Figura 69. Paso 69 · IDE · depuración real. VS Code Java: pausa real en OrderController.java línea41 con id49 recibido; después se retiró el breakpoint y se reanudó.

[Imagen completa · docs/guia_total_ide/ejecucion_20261026/ide/backend_breakpoint.jpg](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/ide/backend_breakpoint.jpg)

![Figura 69. Paso 69 · IDE · depuración real. VS Code Java: pausa real en OrderController.java línea41 con id49 recibido; después se retiró el breakpoint y se reanudó.](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/ide/backend_breakpoint.jpg)

Figura 70. Paso 70 · IDE · depuración real. VS Code React: Orders.tsx abierto, depurador del navegador conectado y consola Vite conectada.

[Imagen completa · docs/guia_total_ide/ejecucion_20261026/ide/react_debugger.jpg](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/ide/react_debugger.jpg)

![Figura 70. Paso 70 · IDE · depuración real. VS Code React: Orders.tsx abierto, depurador del navegador conectado y consola Vite conectada.](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/ide/react_debugger.jpg)

Figura 71. Paso 71 · IDE · depuración real. VS Code Dart: fuente routes_page.dart y Call Stack pausada desde F6; posteriormente F5 reanudó la aplicación.

[Imagen completa · docs/guia_total_ide/ejecucion_20261026/ide/flutter_debugger.jpg](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/ide/flutter_debugger.jpg)

![Figura 71. Paso 71 · IDE · depuración real. VS Code Dart: fuente routes_page.dart y Call Stack pausada desde F6; posteriormente F5 reanudó la aplicación.](file:///C:/Users/USUARIO/OneDrive/Escritorio/Proyecto%20Integrador%20Desarrollo%20de%20Software%203/docs/guia_total_ide/ejecucion_20261026/ide/flutter_debugger.jpg)

### Registro de pasos y estados capturados

El número de paso conserva la secuencia de la sesión. Cada figura incluye el estado, el pie y un enlace a la imagen completa para ampliar textos y columnas. En las tomas con desplazamiento, cada imagen corresponde a una vista completa de su ventana.

| Paso | Pantalla | Estado y evidencia |
| --- | --- | --- |
| 1 | M01 | sin sesión. Acceso móvil real sin credenciales visibles. |
| 2 | M05 | perfil cargado. Perfil cargado del conductor efectivo, vínculo1, licencia y contacto local de ensayo. |
| 3 | M02 | planificada. Ruta22 de hoy con tres paradas y propuesta por calles OSRM. |
| 4 | M02 | revisión superior. Hoja aprobada por administración, antes de la aceptación del conductor. |
| 5 | M02 | control de aceptación. Continuación de la revisión con observaciones y botón de aceptación. |
| 6 | M02 | aceptada. Aceptación registrada por el servidor desde la cuenta del conductor. |
| 7 | W04 | aprobada y aceptada. Ruta 22 de hoy: aprobación administrativa y aceptación del conductor verificadas antes del despacho. |
| 8 | W04 | mapa durante la ejecución. Revisión aprobada y aceptada, geometría OSRM y paradas IN_TRANSIT tras iniciar el despacho de la ruta22. |
| 9 | M02 | en ejecución. Los mismos pedidos48,49,50 en tránsito después del despacho web. |
| 10 | W04 | backlog y asignación. Backlog de pedidos pendientes con revisión comercial y selectores de ruta; no se realiza una asignación adicional. |
| 11 | M03 | detalle. Detalle móvil de pedido48 antes de confirmar el POD. |
| 12 | W04 | formulario. Planificar ruta: fecha, hora y recursos disponibles; Juan y ABC-123 ya no están disponibles durante el reparto. |
| 13 | M03 | alternativas. Estados disponibles para la parada en tránsito. |
| 14 | W03 | consulta. Los mismos tres pedidos del ensayo, asignados a ruta 22 y en tránsito. |
| 15 | M03 | POD superior. Formulario POD superior: entrega seleccionada y foto obligatoria. |
| 16 | M03 | cámara. Cámara virtual del emulador usada para evidencia sintética. |
| 17 | M03 | foto adjunta. Foto de ensayo adjunta al pedido, todavía sin envío al servidor. |
| 18 | M03 | receptor y firma. Receptor y firma sintéticos antes de confirmar su captura. |
| 19 | W03 | inicio de importación. Formulario inicial de importación CSV: plantilla y botón de validación, sin archivo seleccionado ni importación confirmada. |
| 20 | M03 | POD preparado. Firma guardada y datos preparados; todavía falta confirmar remotamente. |
| 21 | W08 | consulta. Catálogo real de conductores y sus datos operativos. |
| 22 | W08 | formulario. Formulario de conductor con identidad, licencia, contacto y estado; consulta sin guardar. |
| 23 | M03 | offline pendiente. Evidencia de pedido48 guardada sin conexión; el estado remoto aún no está confirmado. |
| 24 | M06 | pendiente. Cola privada con el POD48 pendiente de confirmación del servidor. |
| 25 | W09 | consulta. Catálogo real de flota, capacidad y operatividad. |
| 26 | W09 | formulario. Formulario de vehículo completo; consulta sin modificar la flota. |
| 27 | W10 | consulta. Usuarios e identidades efectivas del Keycloak local. |
| 28 | W10 | detalle. Roles efectivos y relación subject–conductor; consulta sin ampliar permisos. |
| 29 | W11 | consulta. Compras operativas con proveedor, categoría, monto y estado. |
| 30 | W11 | formulario. Formulario real de compra; cancelado sin registrar movimientos adicionales. |
| 31 | M02 | sincronizado. Tras recuperar red y reautenticar al mismo conductor, pedido48 aparece entregado. |
| 32 | W03 | detalle entregado. Pedido 48 DELIVERED tras recuperar su evidencia offline: ventana, receptor y datos POD verificados en web. |
| 33 | M03 | excepción ausencia. No entrega de pedido49 con motivo sintético de ausencia; debe enviarse con conexión. |
| 34 | W03 | evidencias POD. Foto de cámara virtual y firma de ensayo del POD48, con descarga PDF disponible en web. |
| 35 | M03 | excepción devolución. Devolución de pedido50 por rechazo del destinatario, con motivo registrado. |
| 36 | W05 | abierta. Incidencia generada desde la no entrega móvil del pedido49, con actor registrado por el servidor. |
| 37 | W05 | formulario de resolución. Resolución administrativa de la incidencia14, justificando el cierre del intento fallido. |
| 38 | M02 | resultado final. Ruta22 COMPLETED: un entregado, un fallido y un devuelto; no equivale a tres entregas exitosas. |
| 39 | W05 | seguimiento. Casos de la ruta22: ausencia resuelta y devolución registrada, conservando el pedido original. |
| 40 | W05 | formulario. Registro real de incidente de ruta o pedido, tipo, severidad y motivo; sin guardar. |
| 41 | W06 | formulario. Acción de ensayo vinculada a CHR y causas observadas en ruta22; base y meta declaradas. |
| 42 | W06 | consulta. Acción de ensayo creada a partir de la ausencia y devolución de ruta22, con responsable, plazo y CHR. |
| 43 | W06 | en progreso. Seguimiento de acción8: asignación de trabajo y nota de ensayo; no acredita mejora empresarial. |
| 44 | W06 | verificación. Revisión ADMIN de la acción8 con resultado observado de ensayo y meta no alcanzada; no acredita mejora real. |
| 45 | W06 | cerrada. Acción8 VERIFIED: resultado de ensayo33.33 frente a meta90, con justificación y verificador; no hay mejora causal acreditada. |
| 46 | W07 | resultado final superior. Dashboard final del 26/10/2026, conductor Juan Pérez: tres pedidos, uno entregado y ninguno en tránsito. |
| 47 | W07 | resultado final inferior. Gráficos finales de la jornada y disponibilidad de flota liberada tras completar la ruta22. |
| 48 | M04 | historial final. Historial real con los tres resultados de la jornada del 26/10/2026. |
| 49 | W12 | final superior. Reportes finales filtrados: tres pedidos y una entrega a tiempo evaluable con POD y ventana. |
| 50 | W12 | eficiencia final. Ruta22: plan registrado8.53km, tiempo de operación de ensayo y GPS no evaluable por intervalo excesivo entre muestras. |
| 51 | M06 | cola final vacía. Comprobación final de cero evidencias pendientes tras sincronizar el POD. |
| 52 | W13 | indicadores finales. BI final del 26/10/2026: IID66.67% (2/3), CHR/TDE/SUCCESS33.33% (1/3) y ONTIME100% (1/1). Las metas administrativas no están configuradas. |
| 53 | W13 | tendencias finales. Evolución diaria real del ensayo, sin atribuir mejora causal a una única jornada. |
| 54 | W13 | causas continuación. Continuación de Causas: motivos de incidencias y eventos por fuente; complementa los gráficos superiores de la misma vista. |
| 55 | W13 | cumplimiento final. Cumplimiento del ensayo: población y resultados por conductor; sin meta vigente no se calcula brecha. |
| 56 | W13 | calidad final. Calidad de la jornada: integridad comercial y de ubicación, un POD completo y telemetría no evaluable. |
| 57 | W13 | eficiencia continuación. Continuación de Eficiencia: minutos por parada terminal y tabla de calidad GPS; complementa los gráficos superiores. |
| 58 | W13 | eficiencia tabla final. Calidad GPS detallada: intervalo excesivo entre muestras, plan8.53km y duración de la sesión de ensayo. |
| 59 | W13 | metas finales. Editores reales de metas administrativas de los cinco indicadores; consulta sin cambiar valores. |
| 60 | W03 | formulario de alta. Formulario real de alta sin ruta: datos de pedido, ventana y confirmación comercial, cancelado sin guardar. |
| 61 | W03 | formulario continuación. Continuación del alta: declaración comercial y botón para guardar el pedido sin ruta. |
| 62 | W01 | sin sesión. Acceso web real de EcoRoute para Grupo MICOTRANS, antes de redirigir al proveedor de identidad. |
| 63 | W01 | proveedor de identidad. Formulario real de Keycloak sin credenciales visibles; OAuth2 Authorization Code con PKCE en web. |
| 64 | W02 | inicio superior. Inicio corregido: accesos reales del usuario autenticado, con contenido desplazable. |
| 65 | W02 | inicio inferior. Inicio con desplazamiento real: accesos inferiores a Vehículos y Compras completamente visibles. |
| 66 | W13 | causas gráfico global. Causas, gráfico global completo de los motivos registrados y comienzo del historial de estados. |
| 67 | W13 | causas historial. Causas, gráfico del historial de estados completo y continuidad de los motivos de incidencias. |
| 68 | W13 | eficiencia tres gráficos. Primeros tres gráficos de eficiencia completos: plan frente a GPS, tiempo de operación y km por entrega. La cuarta gráfica y la tabla están en la continuación. |
| 69 | IDE | depuración real. VS Code Java: pausa real en OrderController.java línea41 con id49 recibido; después se retiró el breakpoint y se reanudó. |
| 70 | IDE | depuración real. VS Code React: Orders.tsx abierto, depurador del navegador conectado y consola Vite conectada. |
| 71 | IDE | depuración real. VS Code Dart: fuente routes_page.dart y Call Stack pausada desde F6; posteriormente F5 reanudó la aplicación. |

## Pruebas reales y casos previstos

Un check PASS es una comprobación ejecutada con el alcance indicado en su detalle. FAIL o ERROR indican un resultado fallido. PLANNED, PENDING, NOT_RUN, NOT_TESTED, SKIP o BLOCKED conservan trabajo no acreditado; WARN exige leer su detalle. Las alternativas de cada pantalla permanecen previstas si no existe un check que las acredite.

**PASS · ORDER_48_DELIVERED** Comprobación GET/SQL de solo lectura registrada en business_final.json para ruta22 y pedidos48–50.

**PASS · ORDER_49_FAILED** Comprobación GET/SQL de solo lectura registrada en business_final.json para ruta22 y pedidos48–50.

**PASS · ORDER_50_RETURNED** Comprobación GET/SQL de solo lectura registrada en business_final.json para ruta22 y pedidos48–50.

**PASS · ROUTE_EXACT_THREE_ORDERS** Comprobación GET/SQL de solo lectura registrada en business_final.json para ruta22 y pedidos48–50.

**PASS · ROUTE_22_COMPLETED** Comprobación GET/SQL de solo lectura registrada en business_final.json para ruta22 y pedidos48–50.

**PASS · ROUTE_START_END_RECORDED** Comprobación GET/SQL de solo lectura registrada en business_final.json para ruta22 y pedidos48–50.

**PASS · ROUTE_PLANNED_DISTANCE_NONZERO** Comprobación GET/SQL de solo lectura registrada en business_final.json para ruta22 y pedidos48–50.

**PASS · REVIEW_APPROVED_AND_ACCEPTED** Comprobación GET/SQL de solo lectura registrada en business_final.json para ruta22 y pedidos48–50.

**PASS · POD_48_REMOTE_METADATA_COMPLETE** Comprobación GET/SQL de solo lectura registrada en business_final.json para ruta22 y pedidos48–50.

**PASS · NO_POD_FOR_49** Comprobación GET/SQL de solo lectura registrada en business_final.json para ruta22 y pedidos48–50.

**PASS · NO_POD_FOR_50** Comprobación GET/SQL de solo lectura registrada en business_final.json para ruta22 y pedidos48–50.

**PASS · POD_48_PHOTO_AVAILABLE** Comprobación GET/SQL de solo lectura registrada en business_final.json para ruta22 y pedidos48–50.

**PASS · POD_48_SIGNATURE_AVAILABLE** Comprobación GET/SQL de solo lectura registrada en business_final.json para ruta22 y pedidos48–50.

**PASS · POD_48_PDF_AVAILABLE** Comprobación GET/SQL de solo lectura registrada en business_final.json para ruta22 y pedidos48–50.

**PASS · UNIQUE_INCIDENT_FOR_49** Comprobación GET/SQL de solo lectura registrada en business_final.json para ruta22 y pedidos48–50.

**PASS · UNIQUE_INCIDENT_FOR_50** Comprobación GET/SQL de solo lectura registrada en business_final.json para ruta22 y pedidos48–50.

**PASS · INCIDENT_14_CLOSE_FAILED** Comprobación GET/SQL de solo lectura registrada en business_final.json para ruta22 y pedidos48–50.

**PASS · RETURNED_50_INCIDENT_15_CLOSED_FAILED** Comprobación GET/SQL de solo lectura registrada en business_final.json para ruta22 y pedidos48–50.

**PASS · ACTION_8_VERIFIED_RESULT_33_33_TARGET_90** Comprobación GET/SQL de solo lectura registrada en business_final.json para ruta22 y pedidos48–50.

**PASS · ACTION_8_CAUSAL_LIMITATION_RECORDED** Comprobación GET/SQL de solo lectura registrada en business_final.json para ruta22 y pedidos48–50.

**PASS · SQL_TRANSACTION_READ_ONLY** Comprobación GET/SQL de solo lectura registrada en business_final.json para ruta22 y pedidos48–50.

**PASS · UNIQUE_PROOF_48** Comprobación GET/SQL de solo lectura registrada en business_final.json para ruta22 y pedidos48–50.

**PASS · UNIQUE_DELIVERY_OUTBOX_48** Comprobación GET/SQL de solo lectura registrada en business_final.json para ruta22 y pedidos48–50.

**PASS · UNIQUE_DELIVERY_NOTIFICATION_48** Comprobación GET/SQL de solo lectura registrada en business_final.json para ruta22 y pedidos48–50.

**PASS · POD_48_PHOTO_SHA256_MATCH** Comprobación GET/SQL de solo lectura registrada en business_final.json para ruta22 y pedidos48–50.

**PASS · POD_48_SIGNATURE_SHA256_MATCH** Comprobación GET/SQL de solo lectura registrada en business_final.json para ruta22 y pedidos48–50.

**PASS · POD_48_CAPTURE_AND_RECEIVE_TIMESTAMPS** Comprobación GET/SQL de solo lectura registrada en business_final.json para ruta22 y pedidos48–50.

**PASS · UNIQUE_EXPECTED_TRANSITIONS_ONLY** Comprobación GET/SQL de solo lectura registrada en business_final.json para ruta22 y pedidos48–50.

**PASS · UNIQUE_DRIVER_ACCEPTANCE** Comprobación GET/SQL de solo lectura registrada en business_final.json para ruta22 y pedidos48–50.

**PASS · UNIQUE_CLOSE_FAILED_14_EVENT** Comprobación GET/SQL de solo lectura registrada en business_final.json para ruta22 y pedidos48–50.

**PASS · UNIQUE_CLOSE_FAILED_15_EVENT** Comprobación GET/SQL de solo lectura registrada en business_final.json para ruta22 y pedidos48–50.

**PASS · BREAKPOINT_JAVA_LINE_41_ID49_STACK_MAIN_UI_OBSERVED** Comprobación GET/SQL de solo lectura registrada en business_final.json para ruta22 y pedidos48–50.

**PASS · NATIVE_THREE_APPS_IDE_PROCESS_NO_APP_CONTAINERS** Comprobación GET/SQL de solo lectura registrada en business_final.json para ruta22 y pedidos48–50.

**PASS · OFFLINE_BEFORE_SYNC** business_offline.json: pedido48 IN_TRANSIT, POD404 y ruta22 IN_PROGRESS mientras m06_pendiente muestra evidencia local pendiente.

**PASS · FLUTTER_PENDING_QUEUE_FINAL** m06_final_sin_pendientes.json y captura: cero pendientes. La sesión larga requirió reautenticar al mismo conductor; su evidencia privada se conservó.

**PASS · IDE_DART_PAUSE_AND_RESUME** Main comprobó F6, Call Stack Paused on pause y ContinueF5 en VS Code; después F5 devolvió PauseF6 y la app continuó. Fuente temporal SHA256 verificada; sin hot reload desde original.

**PASS · IDE_REACT_VITE_CONNECTED** react_debugger.jpg muestra componente React y consola Vite connected con depurador de Chrome. No se acredita aquí una pausa en breakpoint JavaScript.

**PASS · AUTH_REFRESH_REGRESSION** Revisión delegada de Aquinas:9/9 pruebas de auth-session.test.mjs, TypeScript y lint correctos. Identidad conservada solo durante revalidación del mismo subject; errores/cambio de usuario invalidan.

**PASS · HOME_FULL_SCREEN_SCROLL** DOM real después de corregir overflow: contenido1363px, área1000px y scrollTop363; capturas superior e inferior muestran todos los accesos.

**WARN · GPS_DISTANCE_LIMITATION** La ruta22 tiene un intervalo GPS superior a900s durante la sesión larga: distanciaGPS no evaluable. El tiempo de operación incluye pausas de exposición y no acredita productividad real.

**WARN · PLAN_AND_PREVIEW_ORIGIN** El plan guardado al despacho es8.53km. La propuesta recalculada desde otro origen GPS se mostró3.19km; es GET/path de consulta, no modificación del plan histórico.

**PASS · MOBILE_TRANSIENT_RETRY** Primer envío de FAILED mostró interrupción de conexión. Se reintentó y se verificó un único cambio de estado e incidente14; no se oculta esta recuperación ni se asume que todo envío inicial funcionó.

**NOT_RUN · PHYSICAL_FIELD_TEST** Se utilizó EcoRoute_QA emulator-5556 con foto, firma y GPS sintéticos. No se acredita piloto de campo, sensores de teléfono físico ni aceptación empresarial.

**PASS · BACKEND_REJECTS_UNAUTHENTICATED_ORDERS** GET /orders sin credenciales respondió HTTP401 en el backend desde fuentes.

### Correlación de la jornada

**date** 2026-10-26

**timezone** America/Lima

**synthetic** True

**routeId** 22

**driverId** 1

**vehicleId** 1

**orderIds** 48; 49; 50

**tracking** IDE-20261026-POD; IDE-20261026-FAILED; IDE-20261026-PENDIENTE

**incidentId** 14; 15

**actionId** 8

Los indicadores locales describen la población y la fecha de la demostración. No acreditan por sí solos aceptación empresarial ni mejora causal de costos, puntualidad o servicio.
