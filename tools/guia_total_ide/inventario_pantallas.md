# Inventario total de pantallas EcoRoute

Lectura estática del código y BPMN vigente. Todas las capturas y comprobaciones de ejecución descritas son evidencia nueva esperada, pendiente de la tarea principal. No se ejecutaron pruebas ni servicios en esta subtarea.

## Reparto conservado

| Alumno | Pantalla principal 1 | Pantalla principal 2 |
|---|---|---|
| Enzo | W03 Pedidos | W04 Gestión de despacho |
| Luis | M02 Mis rutas y hoja de reparto | M03 Detalle de pedido y prueba de entrega POD |
| Renzo | W05 Incidencias y decisiones · P04 | W06 Acciones de mejora · P05 |
| Adrian | W07 Dashboard web: panel de control logístico | W13 Inteligencia de negocio |

## Web: 13 pantallas

### W01 · Acceso web y retorno OIDC

Ruta: `/login`. Roles: Público; identidad efectiva después de autenticar. Procesos: P08 Administrar accesos.

Login inicia Authorization Code con PKCE y procesa el retorno de Keycloak. AuthProvider consulta identidad efectiva al backend; decodificar un token no concede permisos. El formulario externo del proveedor forma parte del acceso, sin crear otra ruta React. Esta pantalla habilita sesión para tareas posteriores. P08 exige comprobar permisos permitidos y denegados; autorizar solicitud y elegir rol son tareas humanas previas.

**Acciones**

- Presentar botón, seguir al proveedor y completar acceso de ensayo fuera de captura; volver al callback.
- Mostrar usuario/rol en Inicio, una ruta permitida y cierre de sesión desde Sidebar.

**Estados, modales y alternativas**

- Inicial, redirección, intercambio de código, carga de identidad y error recuperable.
- Sin sesión: ruta protegida devuelve a login. Con rol insuficiente se aplica ProtectedRoute. No mostrar credenciales/tokens.

**Trazabilidad del flujo**

- Login → redirectToKeycloakLogin/exchangeCodeForTokens → OIDC auth/token → Keycloak mantiene identidad/sesión.
- AuthProvider → useQuery → GET /api/session/me → SessionController.me → OperationalAccess → DriverRepository/drivers para vínculo; iniciar sesión no escribe pedidos.

**Evidencia nueva esperada: pendiente**

- Capturas nuevas esperadas: login completo, proveedor sin secretos, Inicio con identidad, negativa por rol y regreso tras logout. Abrir los símbolos relacionados en IDE permite explicar dónde se comprueba sesión y autorización.
- Conservar título, sesión e identificadores ficticios; añadir tomas inferiores cuando el contenido exceda la ventana. Si una negativa no puede prepararse, documentarla como esperada y no observada. La lectura del código no acredita ejecución actual ni éxito de una operación remota.

**Fuentes comprobadas: líneas uno basadas**

- [web-admin/src/pages/Login.tsx:7](../../web-admin/src/pages/Login.tsx#L7) · `const Login`.
- [web-admin/src/services/keycloak.ts:38](../../web-admin/src/services/keycloak.ts#L38) · `export async function redirectToKeycloakLogin`.
- [web-admin/src/services/keycloak.ts:54](../../web-admin/src/services/keycloak.ts#L54) · `export async function exchangeCodeForTokens`.
- [web-admin/src/context/AuthContext.tsx:15](../../web-admin/src/context/AuthContext.tsx#L15) · `export function AuthProvider`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/SessionController.java:10](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/SessionController.java#L10) · `class SessionController`.
- [src/main/java/com/ecoroute/backend/infrastructure/security/OperationalAccess.java:20](../../src/main/java/com/ecoroute/backend/infrastructure/security/OperationalAccess.java#L20) · `class OperationalAccess`.
- [docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P08_negocio.bpmn:3](../../docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P08_negocio.bpmn#L3) · `<bpmn:process`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/SessionController.java:12](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/SessionController.java#L12) · `@GetMapping("/me")`.
- [web-admin/src/App.tsx:88](../../web-admin/src/App.tsx#L88) · `path="/login"`.

Texto de pantalla: 219 palabras, sin contar referencias.

### W02 · Inicio y navegación

Ruta: `/`. Roles: Cualquier sesión autenticada; tarjetas según rol. Procesos: P08 Administrar accesos, P01 Confirmar pedidos, P02 Preparar la jornada de reparto, P04 Resolver incidencias, P05 Evaluar resultados, P06 Habilitar recursos de reparto, P09 Registrar compras operativas.

Inicio presenta accesos según roles efectivos. Es una pantalla real del router aunque no figure entre las ocho principales. Home navega localmente: no calcula indicadores ni crea registros. Ubica recursos, accesos, compras y reportes. Sidebar ofrece Acciones de mejora independientemente y BI reutiliza su componente. Ocultar tarjetas no sustituye permisos. El reparto académico conserva dos pantallas por alumno; Inicio sirve como presentación común.

**Acciones**

- Presentar tarjetas y menú expandido; entrar en Pedidos para comenzar P01.
- Mostrar menú colapsado y, en ventana estrecha, abrir/cerrar con botón, fondo o Escape.
- Comparar ADMIN/DISPATCHER, ubicar campana y terminar sesión.

**Estados, modales y alternativas**

- Inicio autenticado; menú expandido/colapsado; overlay móvil abierto/cerrado y foco recuperado.
- Ruta desconocida redirige a Inicio; no existe 404 independiente ni carga propia de resultados de negocio.

**Trazabilidad del flujo**

- Home → useAuth → identidad AuthProvider /session/me; useNavigate cambia ruta sin persistir.
- AppRoutes → AuthenticatedLayout → ProtectedRoute: consultas/escrituras pertenecen al destino. Inicio no posee endpoint, caso de uso o tabla propios.

**Evidencia nueva esperada: pendiente**

- Capturas nuevas esperadas: Inicio completo con ambos roles, menú estrecho abierto y navegación al destino. Conservar encabezado, usuario y accesos visibles para justificar permisos y ubicar el siguiente paso del negocio.
- Conservar título, sesión e identificadores ficticios; añadir tomas inferiores cuando el contenido exceda la ventana. Si una negativa no puede prepararse, documentarla como esperada y no observada. La lectura del código no acredita ejecución actual ni éxito de una operación remota.

**Fuentes comprobadas: líneas uno basadas**

- [web-admin/src/pages/Home.tsx:14](../../web-admin/src/pages/Home.tsx#L14) · `const Home`.
- [web-admin/src/App.tsx:85](../../web-admin/src/App.tsx#L85) · `const AppRoutes`.
- [web-admin/src/App.tsx:22](../../web-admin/src/App.tsx#L22) · `const AuthenticatedLayout`.
- [web-admin/src/components/Sidebar.tsx:29](../../web-admin/src/components/Sidebar.tsx#L29) · `const Sidebar`.
- [web-admin/src/components/ProtectedRoute.tsx:10](../../web-admin/src/components/ProtectedRoute.tsx#L10) · `const ProtectedRoute`.
- [docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P08_negocio.bpmn:3](../../docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P08_negocio.bpmn#L3) · `<bpmn:process`.
- [docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P01_negocio.bpmn:5](../../docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P01_negocio.bpmn#L5) · `<bpmn:process`.
- [docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P02_negocio.bpmn:3](../../docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P02_negocio.bpmn#L3) · `<bpmn:process`.
- [docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P04_negocio.bpmn:3](../../docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P04_negocio.bpmn#L3) · `<bpmn:process`.
- [docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P05_negocio.bpmn:3](../../docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P05_negocio.bpmn#L3) · `<bpmn:process`.
- [docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P06_negocio.bpmn:3](../../docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P06_negocio.bpmn#L3) · `<bpmn:process`.
- [docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P09_negocio.bpmn:3](../../docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P09_negocio.bpmn#L3) · `<bpmn:process`.
- [web-admin/src/App.tsx:59](../../web-admin/src/App.tsx#L59) · `path="/"`.

Texto de pantalla: 223 palabras, sin contar referencias.

### W03 · Pedidos

Ruta: `/orders`. Roles: Dispatcher u operador logístico autorizado; perfil técnico ADMIN o DISPATCHER. Procesos: P01 Confirmar pedidos, P02 Preparar la jornada de reparto, P03 Ejecutar entregas.

Convertir una solicitud del cliente en un pedido identificable y revisar el acuerdo comercial antes de comprometer su reparto. El pedido nace sin ruta y conserva su ID durante la posterior asignación. Las validaciones de interfaz ayudan al operador; las reglas del servidor deciden si se acepta cada solicitud.

**Acciones**

- Mostrar listado y Nuevo pedido: tracking único, destinatario, teléfono, dirección, coordenadas y ventana cuando corresponda.
- Registrar aceptación, dirección/cobertura verificadas y nota; guardar PENDING sin ruta y conservar ID.
- Abrir detalle/comercial/ventana/asignación; validar y confirmar CSV; tras entrega consultar foto/firma/PDF del mismo tracking.

**Estados, modales y alternativas**

- Listado y búsqueda; modales Nuevo pedido, Detalle y CSV: validación, vista previa y confirmación. Detalle: comercial, ventana, asignación y POD.
- Revisión parcial bloquea asignación; cambiar ventana invalida aceptación; alta y confirmación son dos HTTP: conservar ID ante fallo parcial.

**Trazabilidad del flujo**

- CreateOrder → orderService → POST /orders → OrderController → OrderUseCasesImpl → R2dbcOrderRepository → orders e historial.
- BusinessEditor → PATCH /orders/{id}/business-data → BusinessWorkflowController → BusinessWorkflowService.confirm → R2dbcBusinessWorkflowAdapter → order_business_data/auditoría.
- CSV preview/import → OrderCsvParser/OrderImportService; POD metadata/foto/firma/PDF → DeliveryProofController.

**Evidencia nueva esperada: pendiente**

- Capturas NUEVAS pendientes: pantalla completa, formulario o detalle abierto, resultado persistido y alternativa relevante. Correlacionar ID, tracking, fecha, rol y vínculo con la siguiente pantalla.
- Comprobar respuesta del servidor y el mismo identificador al recargar antes de anunciar éxito; conservar contexto del siguiente paso de negocio.

**Fuentes comprobadas: líneas uno basadas**

- [web-admin/src/pages/Orders.tsx:203](../../web-admin/src/pages/Orders.tsx#L203) · `export default function Orders`.
- [web-admin/src/services/orderService.ts:4](../../web-admin/src/services/orderService.ts#L4) · `export const OrderStatus = {`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/OrderController.java:20](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/OrderController.java#L20) · `class OrderController`.
- [src/main/java/com/ecoroute/backend/application/usecases/OrderUseCasesImpl.java:28](../../src/main/java/com/ecoroute/backend/application/usecases/OrderUseCasesImpl.java#L28) · `class OrderUseCasesImpl`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcOrderRepository.java:10](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcOrderRepository.java#L10) · `class R2dbcOrderRepository`.
- [web-admin/src/pages/Orders.tsx:148](../../web-admin/src/pages/Orders.tsx#L148) · `function CreateOrder`.
- [web-admin/src/pages/Orders.tsx:100](../../web-admin/src/pages/Orders.tsx#L100) · `function OrderDetail`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/BusinessWorkflowController.java:15](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/BusinessWorkflowController.java#L15) · `class BusinessWorkflowController`.
- [src/main/java/com/ecoroute/backend/application/services/BusinessWorkflowService.java:14](../../src/main/java/com/ecoroute/backend/application/services/BusinessWorkflowService.java#L14) · `class BusinessWorkflowService`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessWorkflowAdapter.java:13](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessWorkflowAdapter.java#L13) · `class R2dbcBusinessWorkflowAdapter`.
- [src/main/java/com/ecoroute/backend/application/services/OrderImportService.java:11](../../src/main/java/com/ecoroute/backend/application/services/OrderImportService.java#L11) · `class OrderImportService`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/DeliveryProofController.java:25](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/DeliveryProofController.java#L25) · `class DeliveryProofController`.
- [docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P01_negocio.bpmn:5](../../docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P01_negocio.bpmn#L5) · `<bpmn:process`.
- [docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P02_negocio.bpmn:3](../../docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P02_negocio.bpmn#L3) · `<bpmn:process`.
- [docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P03_negocio.bpmn:3](../../docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P03_negocio.bpmn#L3) · `<bpmn:process`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/OrderController.java:33](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/OrderController.java#L33) · `@PostMapping`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/OrderController.java:39](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/OrderController.java#L39) · `@GetMapping("/{id}")`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/OrderController.java:44](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/OrderController.java#L44) · `@GetMapping`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/OrderController.java:53](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/OrderController.java#L53) · `@DeleteMapping("/{id}")`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/OrderController.java:58](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/OrderController.java#L58) · `@PatchMapping("/{id}/status")`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/OrderController.java:63](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/OrderController.java#L63) · `@PatchMapping("/{id}/route")`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/OrderController.java:68](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/OrderController.java#L68) · `@PatchMapping("/{id}/delivery-window")`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/OrderController.java:77](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/OrderController.java#L77) · `@PostMapping("/bulk-csv")`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/OrderController.java:81](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/OrderController.java#L81) · `@PostMapping("/bulk-csv/preview")`.
- [src/main/java/com/ecoroute/backend/application/usecases/OrderUseCasesImpl.java:51](../../src/main/java/com/ecoroute/backend/application/usecases/OrderUseCasesImpl.java#L51) · `public Mono<Order> createOrder(Order order) {`.
- [src/main/java/com/ecoroute/backend/application/usecases/OrderUseCasesImpl.java:74](../../src/main/java/com/ecoroute/backend/application/usecases/OrderUseCasesImpl.java#L74) · `public Mono<Order> assignOrder(Long orderId, Long routeId) {`.
- [src/main/java/com/ecoroute/backend/application/usecases/OrderUseCasesImpl.java:99](../../src/main/java/com/ecoroute/backend/application/usecases/OrderUseCasesImpl.java#L99) · `public Mono<Order> getOrderById(Long id) {`.
- [src/main/java/com/ecoroute/backend/application/usecases/OrderUseCasesImpl.java:105](../../src/main/java/com/ecoroute/backend/application/usecases/OrderUseCasesImpl.java#L105) · `public Mono<Order> changeDeliveryWindow(Long id,OffsetDateTime start,OffsetDateTime end,String reason,String actor) {`.
- [src/main/java/com/ecoroute/backend/application/usecases/OrderUseCasesImpl.java:128](../../src/main/java/com/ecoroute/backend/application/usecases/OrderUseCasesImpl.java#L128) · `public Flux<Order> getAllOrders() {`.
- [src/main/java/com/ecoroute/backend/application/usecases/OrderUseCasesImpl.java:134](../../src/main/java/com/ecoroute/backend/application/usecases/OrderUseCasesImpl.java#L134) · `public Mono<Order> updateStatusManual(Long id, OrderStatus status, String reason) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcOrderRepository.java:19](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcOrderRepository.java#L19) · `public Mono<Order> save(Order order) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcOrderRepository.java:26](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcOrderRepository.java#L26) · `public Flux<Order> findAll() {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcOrderRepository.java:32](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcOrderRepository.java#L32) · `public Mono<Order> findById(Long id) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcOrderRepository.java:38](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcOrderRepository.java#L38) · `public Mono<Order> lockById(Long id) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcOrderRepository.java:43](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcOrderRepository.java#L43) · `public Mono<Order> findByTrackingNumber(String trackingNumber) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcOrderRepository.java:49](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcOrderRepository.java#L49) · `public Flux<Order> findByRouteId(Long routeId) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcOrderRepository.java:55](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcOrderRepository.java#L55) · `public Mono<Void> deleteById(Long id) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcOrderRepository.java:60](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcOrderRepository.java#L60) · `public Mono<Integer> updateStopSequence(Long id, Integer sequence) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/BusinessWorkflowController.java:19](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/BusinessWorkflowController.java#L19) · `@GetMapping("/orders/{id}/business-data")`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/BusinessWorkflowController.java:23](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/BusinessWorkflowController.java#L23) · `@PatchMapping("/orders/{id}/business-data")`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/BusinessWorkflowController.java:29](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/BusinessWorkflowController.java#L29) · `@GetMapping("/routes/{id}/review")`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/BusinessWorkflowController.java:33](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/BusinessWorkflowController.java#L33) · `@PostMapping("/routes/{id}/review")`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/BusinessWorkflowController.java:38](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/BusinessWorkflowController.java#L38) · `@PostMapping("/routes/{id}/acceptance")`.
- [src/main/java/com/ecoroute/backend/application/services/BusinessWorkflowService.java:23](../../src/main/java/com/ecoroute/backend/application/services/BusinessWorkflowService.java#L23) · `public Mono<Confirmation> confirm(Confirmation input) {`.
- [src/main/java/com/ecoroute/backend/application/services/BusinessWorkflowService.java:43](../../src/main/java/com/ecoroute/backend/application/services/BusinessWorkflowService.java#L43) · `public Mono<Review> approve(Long id,Double weight,String note,String actor) {`.
- [src/main/java/com/ecoroute/backend/application/services/BusinessWorkflowService.java:63](../../src/main/java/com/ecoroute/backend/application/services/BusinessWorkflowService.java#L63) · `public Mono<Review> accept(Long id,Long driverId,String actor) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessWorkflowAdapter.java:15](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessWorkflowAdapter.java#L15) · `public Mono<Confirmation> confirmation(Long id) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessWorkflowAdapter.java:22](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessWorkflowAdapter.java#L22) · `public Mono<Confirmation> saveConfirmation(Confirmation c) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessWorkflowAdapter.java:34](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessWorkflowAdapter.java#L34) · `public Mono<Review> review(Long id) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessWorkflowAdapter.java:40](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessWorkflowAdapter.java#L40) · `public Mono<Void> approve(Long id,Double weight,String actor,String note) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessWorkflowAdapter.java:47](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessWorkflowAdapter.java#L47) · `public Mono<Void> accept(Long id,String actor) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessWorkflowAdapter.java:51](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessWorkflowAdapter.java#L51) · `public Mono<Void> invalidate(Long id) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessWorkflowAdapter.java:55](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessWorkflowAdapter.java#L55) · `public Mono<Void> requireConfirmed(Long id) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessWorkflowAdapter.java:58](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessWorkflowAdapter.java#L58) · `public Mono<Void> requireDispatchReview(Long id) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessWorkflowAdapter.java:62](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessWorkflowAdapter.java#L62) · `public Mono<Void> audit(String process,String entity,Long id,String action,String actor,String details) {`.
- [src/main/java/com/ecoroute/backend/application/services/OrderImportService.java:15](../../src/main/java/com/ecoroute/backend/application/services/OrderImportService.java#L15) · `public Flux<Order> importOrders(List<Order> validated) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/DeliveryProofController.java:34](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/DeliveryProofController.java#L34) · `@PostMapping`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/DeliveryProofController.java:50](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/DeliveryProofController.java#L50) · `@GetMapping("/{orderId}")`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/DeliveryProofController.java:56](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/DeliveryProofController.java#L56) · `@GetMapping("/{orderId}/photo")`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/DeliveryProofController.java:60](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/DeliveryProofController.java#L60) · `@GetMapping("/{orderId}/signature")`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/DeliveryProofController.java:69](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/DeliveryProofController.java#L69) · `@GetMapping("/{orderId}/pdf")`.
- [web-admin/src/App.tsx:61](../../web-admin/src/App.tsx#L61) · `path="/orders"`.

Texto de pantalla: 211 palabras, sin contar referencias.

### W04 · Gestión de despacho

Ruta: `/routes`. Roles: Dispatcher planifica y despacha; Jefatura revisa usando un perfil ADMIN autorizado; Conductor acepta en móvil. Procesos: P02 Preparar la jornada de reparto, P03 Ejecutar entregas, P07 Supervisar la jornada.

Preparar una jornada viable con conductor, vehículo y pedidos confirmados, obtener aprobación administrativa y aceptación del conductor antes de iniciar el reparto.

**Acciones**

- Crear ruta PLANNED con fecha y recursos disponibles; mostrar filtro Hoy/histórico y backlog.
- Asignar pedido confirmado; ADMIN revisa carga, capacidad, ventanas y vehículo con nota.
- Luis acepta en móvil; actualizar web y despachar. Verificar IN_PROGRESS/IN_TRANSIT, mapa, paradas y fuente del trazado.

**Estados, modales y alternativas**

- Hoy/fecha/histórico; modal Planificar; backlog; revisión ADMIN; aceptación móvil pendiente/recibida; mapa y fuente GPS.
- Recursos ocupados/inactivos, carga excesiva, pedidos sin confirmar o autorización invalidada bloquean despacho; rutas terminales no se reabren.

**Trazabilidad del flujo**

- RoutesPage → routeService → POST /routes → RouteController → RouteUseCasesImpl → R2dbcRouteRepository → routes.
- ReviewPanel → POST /routes/{id}/review y móvil /acceptance → BusinessWorkflowService → route_dispatch_reviews.
- PATCH /routes/{id}/status?status=IN_PROGRESS → requireDispatchReview → planificador → IN_TRANSIT/IN_PROGRESS/historial; GET /path y GPS alimentan mapa.

**Evidencia nueva esperada: pendiente**

- Capturas NUEVAS pendientes: pantalla completa, formulario o detalle abierto, resultado persistido y alternativa relevante. Correlacionar ID, tracking, fecha, rol y vínculo con la siguiente pantalla.
- Conservar título, sesión e identificadores ficticios; añadir tomas inferiores cuando el contenido exceda la ventana. Si una negativa no puede prepararse, documentarla como esperada y no observada. La lectura del código no acredita ejecución actual ni éxito de una operación remota.
- Comprobar respuesta del servidor y el mismo identificador al recargar antes de anunciar éxito; conservar contexto del siguiente paso de negocio.

**Fuentes comprobadas: líneas uno basadas**

- [web-admin/src/pages/Routes.tsx:152](../../web-admin/src/pages/Routes.tsx#L152) · `export default function RoutesPage`.
- [web-admin/src/services/routeService.ts:3](../../web-admin/src/services/routeService.ts#L3) · `export const RouteStatus = {`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/RouteController.java:25](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/RouteController.java#L25) · `class RouteController`.
- [src/main/java/com/ecoroute/backend/application/usecases/RouteUseCasesImpl.java:31](../../src/main/java/com/ecoroute/backend/application/usecases/RouteUseCasesImpl.java#L31) · `class RouteUseCasesImpl`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcRouteRepository.java:12](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcRouteRepository.java#L12) · `class R2dbcRouteRepository`.
- [web-admin/src/pages/Routes.tsx:87](../../web-admin/src/pages/Routes.tsx#L87) · `function ReviewPanel`.
- [web-admin/src/pages/Routes.tsx:19](../../web-admin/src/pages/Routes.tsx#L19) · `function RouteTracking`.
- [src/main/java/com/ecoroute/backend/application/services/BusinessWorkflowService.java:14](../../src/main/java/com/ecoroute/backend/application/services/BusinessWorkflowService.java#L14) · `class BusinessWorkflowService`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessWorkflowAdapter.java:13](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessWorkflowAdapter.java#L13) · `class R2dbcBusinessWorkflowAdapter`.
- [docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P02_negocio.bpmn:3](../../docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P02_negocio.bpmn#L3) · `<bpmn:process`.
- [docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P03_negocio.bpmn:3](../../docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P03_negocio.bpmn#L3) · `<bpmn:process`.
- [docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P07_negocio.bpmn:3](../../docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P07_negocio.bpmn#L3) · `<bpmn:process`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/RouteController.java:35](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/RouteController.java#L35) · `@PostMapping`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/RouteController.java:52](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/RouteController.java#L52) · `@PatchMapping("/{id}/status")`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/RouteController.java:57](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/RouteController.java#L57) · `@GetMapping`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/RouteController.java:67](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/RouteController.java#L67) · `@DeleteMapping("/{id}")`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/RouteController.java:77](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/RouteController.java#L77) · `@GetMapping("/{id}/path")`.
- [src/main/java/com/ecoroute/backend/application/usecases/RouteUseCasesImpl.java:43](../../src/main/java/com/ecoroute/backend/application/usecases/RouteUseCasesImpl.java#L43) · `public Mono<Route> createRoute(Route route) {`.
- [src/main/java/com/ecoroute/backend/application/usecases/RouteUseCasesImpl.java:61](../../src/main/java/com/ecoroute/backend/application/usecases/RouteUseCasesImpl.java#L61) · `public Mono<Route> updateRouteStatus(Long id, RouteStatus status) {`.
- [src/main/java/com/ecoroute/backend/application/usecases/RouteUseCasesImpl.java:153](../../src/main/java/com/ecoroute/backend/application/usecases/RouteUseCasesImpl.java#L153) · `public Mono<Void> updateRouteStatusOnly(Long id, RouteStatus status) {`.
- [src/main/java/com/ecoroute/backend/application/usecases/RouteUseCasesImpl.java:189](../../src/main/java/com/ecoroute/backend/application/usecases/RouteUseCasesImpl.java#L189) · `public Flux<Route> getAllRoutes() {`.
- [src/main/java/com/ecoroute/backend/application/usecases/RouteUseCasesImpl.java:194](../../src/main/java/com/ecoroute/backend/application/usecases/RouteUseCasesImpl.java#L194) · `public Flux<Route> getRoutesByFilters(java.time.LocalDate date, RouteStatus status) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcRouteRepository.java:21](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcRouteRepository.java#L21) · `public Mono<Route> save(Route route) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcRouteRepository.java:28](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcRouteRepository.java#L28) · `public Mono<Route> findById(Long id) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcRouteRepository.java:34](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcRouteRepository.java#L34) · `public Mono<Route> lockById(Long id) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcRouteRepository.java:39](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcRouteRepository.java#L39) · `public Flux<Route> findByDriverIdAndDate(Long driverId, LocalDate date) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcRouteRepository.java:45](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcRouteRepository.java#L45) · `public Flux<Route> findAll() {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcRouteRepository.java:51](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcRouteRepository.java#L51) · `public Flux<Route> findByFilters(LocalDate date, com.ecoroute.backend.domain.model.RouteStatus status) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcRouteRepository.java:57](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcRouteRepository.java#L57) · `public Mono<Void> deleteById(Long id) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcRouteRepository.java:62](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcRouteRepository.java#L62) · `public Mono<Integer> updatePathInfo(Long id, String geometry, Double durationMin) {`.
- [src/main/java/com/ecoroute/backend/application/services/BusinessWorkflowService.java:23](../../src/main/java/com/ecoroute/backend/application/services/BusinessWorkflowService.java#L23) · `public Mono<Confirmation> confirm(Confirmation input) {`.
- [src/main/java/com/ecoroute/backend/application/services/BusinessWorkflowService.java:43](../../src/main/java/com/ecoroute/backend/application/services/BusinessWorkflowService.java#L43) · `public Mono<Review> approve(Long id,Double weight,String note,String actor) {`.
- [src/main/java/com/ecoroute/backend/application/services/BusinessWorkflowService.java:63](../../src/main/java/com/ecoroute/backend/application/services/BusinessWorkflowService.java#L63) · `public Mono<Review> accept(Long id,Long driverId,String actor) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessWorkflowAdapter.java:15](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessWorkflowAdapter.java#L15) · `public Mono<Confirmation> confirmation(Long id) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessWorkflowAdapter.java:22](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessWorkflowAdapter.java#L22) · `public Mono<Confirmation> saveConfirmation(Confirmation c) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessWorkflowAdapter.java:34](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessWorkflowAdapter.java#L34) · `public Mono<Review> review(Long id) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessWorkflowAdapter.java:40](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessWorkflowAdapter.java#L40) · `public Mono<Void> approve(Long id,Double weight,String actor,String note) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessWorkflowAdapter.java:47](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessWorkflowAdapter.java#L47) · `public Mono<Void> accept(Long id,String actor) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessWorkflowAdapter.java:51](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessWorkflowAdapter.java#L51) · `public Mono<Void> invalidate(Long id) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessWorkflowAdapter.java:55](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessWorkflowAdapter.java#L55) · `public Mono<Void> requireConfirmed(Long id) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessWorkflowAdapter.java:58](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessWorkflowAdapter.java#L58) · `public Mono<Void> requireDispatchReview(Long id) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessWorkflowAdapter.java:62](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessWorkflowAdapter.java#L62) · `public Mono<Void> audit(String process,String entity,Long id,String action,String actor,String details) {`.
- [web-admin/src/App.tsx:62](../../web-admin/src/App.tsx#L62) · `path="/routes"`.

Texto de pantalla: 219 palabras, sin contar referencias.

### W05 · Incidencias y decisiones · P04

Ruta: `/incidents`. Roles: Dispatcher para registrar y coordinar RETRY/REPLAN; ADMIN para CLOSE_FAILED/CLOSE_CASE. La Jefatura logística del BPMN es una responsabilidad empresarial; el servidor exige el rol técnico ADMIN para el cierre definitivo (BusinessOperationsController.java:27-31 y BusinessOperationsService.java:48-53).. Procesos: P04 Resolver incidencias, P02 Preparar la jornada de reparto, P03 Ejecutar entregas.

Guía de exposición del 26/10/2026. En Grupo MICOTRANS, conservar el motivo de una excepción de reparto y documentar una solución autorizada sin borrar el resultado anterior. El registro identifica ruta, pedido, informante, resolución y, cuando corresponde, otro intento. La captura del 22/10 es evidencia histórica de un ensayo sintético, no. Las validaciones de interfaz ayudan al operador; las reglas del servidor deciden si se acepta cada solicitud.

**Acciones**

- Registrar incidencia general o de pedido con ruta, tipo, severidad y descripción sustentada.
- Resolver con motivo/justificación y decisión permitida; elegir destino PLANNED si REPLAN.
- Identificar original, nuevo intento y actores; volver a P03 o P02 sin reabrir el pedido terminal.

**Estados, modales y alternativas**

- Registrar: ruta/pedido opcional/tipo/severidad/descripción. Resolver: motivo/justificación; OPEN/RESOLVED.
- RETRY exige jornada activa; REPLAN destino PLANNED distinto; CLOSE_FAILED/CLOSE_CASE solo ADMIN. CLOSE_CASE no altera entregado.

**Trazabilidad del flujo**

- Incidents → useQuery/incidentService → GET/POST /incidents, PATCH /{id}/resolution → BusinessOperationsController → BusinessOperationsService.report/resolve.
- R2dbcBusinessOperationsAdapter → incidents/order_attempts; RETRY crea nuevo IN_TRANSIT misma jornada activa; REPLAN nuevo ASSIGNED otra PLANNED y renueva comercial; original terminal permanece.

**Evidencia nueva esperada: pendiente**

- Capturas NUEVAS pendientes: pantalla completa, formulario o detalle abierto, resultado persistido y alternativa relevante. Correlacionar ID, tracking, fecha, rol y vínculo con la siguiente pantalla.
- Comprobar respuesta del servidor y el mismo identificador al recargar antes de anunciar éxito; conservar contexto del siguiente paso de negocio.

**Fuentes comprobadas: líneas uno basadas**

- [web-admin/src/pages/Incidents.tsx:59](../../web-admin/src/pages/Incidents.tsx#L59) · `export default function Incidents`.
- [web-admin/src/services/incidentService.ts:8](../../web-admin/src/services/incidentService.ts#L8) · `export async function createIncident(request: IncidentRequest) { return (await api.post<Incident>('/incidents', request)).data; }`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/BusinessOperationsController.java:14](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/BusinessOperationsController.java#L14) · `class BusinessOperationsController`.
- [src/main/java/com/ecoroute/backend/application/services/BusinessOperationsService.java:21](../../src/main/java/com/ecoroute/backend/application/services/BusinessOperationsService.java#L21) · `class BusinessOperationsService`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessOperationsAdapter.java:16](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessOperationsAdapter.java#L16) · `class R2dbcBusinessOperationsAdapter`.
- [web-admin/src/pages/Incidents.tsx:12](../../web-admin/src/pages/Incidents.tsx#L12) · `function IncidentForm`.
- [web-admin/src/pages/Incidents.tsx:33](../../web-admin/src/pages/Incidents.tsx#L33) · `function ResolutionForm`.
- [docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P04_negocio.bpmn:3](../../docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P04_negocio.bpmn#L3) · `<bpmn:process`.
- [docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P02_negocio.bpmn:3](../../docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P02_negocio.bpmn#L3) · `<bpmn:process`.
- [docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P03_negocio.bpmn:3](../../docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P03_negocio.bpmn#L3) · `<bpmn:process`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/BusinessOperationsController.java:17](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/BusinessOperationsController.java#L17) · `@GetMapping("/incidents")`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/BusinessOperationsController.java:22](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/BusinessOperationsController.java#L22) · `@PostMapping("/incidents")`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/BusinessOperationsController.java:27](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/BusinessOperationsController.java#L27) · `@PatchMapping("/incidents/{id}/resolution")`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/BusinessOperationsController.java:34](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/BusinessOperationsController.java#L34) · `@GetMapping("/improvement-actions")`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/BusinessOperationsController.java:37](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/BusinessOperationsController.java#L37) · `@PostMapping("/improvement-actions")`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/BusinessOperationsController.java:42](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/BusinessOperationsController.java#L42) · `@PatchMapping("/improvement-actions/{id}")`.
- [src/main/java/com/ecoroute/backend/application/services/BusinessOperationsService.java:27](../../src/main/java/com/ecoroute/backend/application/services/BusinessOperationsService.java#L27) · `public Flux<Incident> incidents() { return operations.incidents(); }`.
- [src/main/java/com/ecoroute/backend/application/services/BusinessOperationsService.java:28](../../src/main/java/com/ecoroute/backend/application/services/BusinessOperationsService.java#L28) · `public Mono<Incident> incident(Long id) {`.
- [src/main/java/com/ecoroute/backend/application/services/BusinessOperationsService.java:32](../../src/main/java/com/ecoroute/backend/application/services/BusinessOperationsService.java#L32) · `public Mono<Incident> report(Incident i,String actor) {`.
- [src/main/java/com/ecoroute/backend/application/services/BusinessOperationsService.java:48](../../src/main/java/com/ecoroute/backend/application/services/BusinessOperationsService.java#L48) · `public Mono<Incident> resolve(Long id,String outcome,String reason,Long nextRoute,String actor,boolean manager) {`.
- [src/main/java/com/ecoroute/backend/application/services/BusinessOperationsService.java:103](../../src/main/java/com/ecoroute/backend/application/services/BusinessOperationsService.java#L103) · `public Flux<Improvement> improvements() { return operations.improvements(); }`.
- [src/main/java/com/ecoroute/backend/application/services/BusinessOperationsService.java:105](../../src/main/java/com/ecoroute/backend/application/services/BusinessOperationsService.java#L105) · `public Mono<Improvement> createAction(Improvement i,String actor) {`.
- [src/main/java/com/ecoroute/backend/application/services/BusinessOperationsService.java:116](../../src/main/java/com/ecoroute/backend/application/services/BusinessOperationsService.java#L116) · `public Mono<Improvement> updateAction(Long id,String status,Double result,String note,String actor,boolean manager) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessOperationsAdapter.java:34](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessOperationsAdapter.java#L34) · `public Flux<Incident> incidents() {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessOperationsAdapter.java:37](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessOperationsAdapter.java#L37) · `public Mono<Incident> incident(Long id,boolean lock) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessOperationsAdapter.java:40](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessOperationsAdapter.java#L40) · `public Mono<Incident> createIncident(Incident i) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessOperationsAdapter.java:50](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessOperationsAdapter.java#L50) · `public Mono<Incident> resolve(Long id,String outcome,String reason,String actor,Long nextRouteId,Long retryOrderId) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessOperationsAdapter.java:58](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessOperationsAdapter.java#L58) · `public Mono<Void> linkAttempt(Long originalId,Long retryId,Long incidentId) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessOperationsAdapter.java:62](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessOperationsAdapter.java#L62) · `public Flux<Improvement> improvements() {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessOperationsAdapter.java:65](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessOperationsAdapter.java#L65) · `public Mono<Improvement> improvement(Long id,boolean lock) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessOperationsAdapter.java:68](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessOperationsAdapter.java#L68) · `public Mono<Improvement> createImprovement(Improvement i) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessOperationsAdapter.java:77](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessOperationsAdapter.java#L77) · `public Mono<Improvement> updateImprovement(Long id,String status,Double result,String note,String verifier) {`.
- [web-admin/src/App.tsx:63](../../web-admin/src/App.tsx#L63) · `path="/incidents"`.

Texto de pantalla: 207 palabras, sin contar referencias.

### W06 · Acciones de mejora · P05

Ruta: `/improvement-actions`. Roles: ADMIN o DISPATCHER registran y dan seguimiento. Solo ADMIN verifica o descarta. ownerName identifica al responsable humano declarado; no constituye una asignación automática a una cuenta ni una regla de acceso por propietario (BusinessOperationsController.java:34-48; BusinessOperationsService.java:105-130).. Procesos: P05 Evaluar resultados, P09 Registrar compras operativas.

Guía del 26/10/2026 para Grupo MICOTRANS. Explicar cómo convertir una desviación revisada por las personas en una acción con causa, responsable, fecha, indicador, medición y verificación autorizada. Los valores son declarados para esa acción; el estado VERIFIED no demuestra causalidad ni reducción real de costos o demoras. Las evidencias técnicas.

**Acciones**

- Crear acción con título, causa, responsable humano, compromiso e indicador; base/meta opcionales sustentadas.
- Registrar nota de seguimiento y pasar a IN_PROGRESS; ADMIN verifica con resultado observado o descarta.
- Abrir el mismo ID desde Acciones P05 de BI; explicar diferencia entre valores declarados y resultados operativos.

**Estados, modales y alternativas**

- Modal Nueva acción: causa/título/responsable/plazo/indicador/base/meta. Seguimiento: nota/resultado.
- IN_PROGRESS → VERIFIED requiere ADMIN y valor observado; VERIFIED/DISCARDED quedan consulta. No atribuir causalidad automática.

**Trazabilidad del flujo**

- ImprovementActions → useQuery/improvementService → GET/POST /improvement-actions, PATCH /{id} → BusinessOperationsController → BusinessOperationsService.createAction/updateAction.
- R2dbcBusinessOperationsAdapter → improvement_actions/auditoría; base/meta declaradas son de la acción, diferentes de KPI operativos.

**Evidencia nueva esperada: pendiente**

- Capturas NUEVAS pendientes: pantalla completa, formulario o detalle abierto, resultado persistido y alternativa relevante. Correlacionar ID, tracking, fecha, rol y vínculo con la siguiente pantalla.
- Conservar título, sesión e identificadores ficticios; añadir tomas inferiores cuando el contenido exceda la ventana. Si una negativa no puede prepararse, documentarla como esperada y no observada. La lectura del código no acredita ejecución actual ni éxito de una operación remota.

**Fuentes comprobadas: líneas uno basadas**

- [web-admin/src/components/ImprovementActions.tsx:58](../../web-admin/src/components/ImprovementActions.tsx#L58) · `export function ImprovementActions`.
- [web-admin/src/services/improvementService.ts:6](../../web-admin/src/services/improvementService.ts#L6) · `export async function createImprovement(request: ImprovementRequest) { return (await api.post<ImprovementAction>('/improvement-actions', request)).data; }`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/BusinessOperationsController.java:14](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/BusinessOperationsController.java#L14) · `class BusinessOperationsController`.
- [src/main/java/com/ecoroute/backend/application/services/BusinessOperationsService.java:21](../../src/main/java/com/ecoroute/backend/application/services/BusinessOperationsService.java#L21) · `class BusinessOperationsService`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessOperationsAdapter.java:16](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessOperationsAdapter.java#L16) · `class R2dbcBusinessOperationsAdapter`.
- [web-admin/src/components/ImprovementActions.tsx:12](../../web-admin/src/components/ImprovementActions.tsx#L12) · `function ActionForm`.
- [web-admin/src/components/ImprovementActions.tsx:35](../../web-admin/src/components/ImprovementActions.tsx#L35) · `function ActionUpdate`.
- [docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P05_negocio.bpmn:3](../../docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P05_negocio.bpmn#L3) · `<bpmn:process`.
- [docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P09_negocio.bpmn:3](../../docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P09_negocio.bpmn#L3) · `<bpmn:process`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/BusinessOperationsController.java:17](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/BusinessOperationsController.java#L17) · `@GetMapping("/incidents")`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/BusinessOperationsController.java:22](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/BusinessOperationsController.java#L22) · `@PostMapping("/incidents")`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/BusinessOperationsController.java:27](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/BusinessOperationsController.java#L27) · `@PatchMapping("/incidents/{id}/resolution")`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/BusinessOperationsController.java:34](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/BusinessOperationsController.java#L34) · `@GetMapping("/improvement-actions")`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/BusinessOperationsController.java:37](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/BusinessOperationsController.java#L37) · `@PostMapping("/improvement-actions")`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/BusinessOperationsController.java:42](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/BusinessOperationsController.java#L42) · `@PatchMapping("/improvement-actions/{id}")`.
- [src/main/java/com/ecoroute/backend/application/services/BusinessOperationsService.java:27](../../src/main/java/com/ecoroute/backend/application/services/BusinessOperationsService.java#L27) · `public Flux<Incident> incidents() { return operations.incidents(); }`.
- [src/main/java/com/ecoroute/backend/application/services/BusinessOperationsService.java:28](../../src/main/java/com/ecoroute/backend/application/services/BusinessOperationsService.java#L28) · `public Mono<Incident> incident(Long id) {`.
- [src/main/java/com/ecoroute/backend/application/services/BusinessOperationsService.java:32](../../src/main/java/com/ecoroute/backend/application/services/BusinessOperationsService.java#L32) · `public Mono<Incident> report(Incident i,String actor) {`.
- [src/main/java/com/ecoroute/backend/application/services/BusinessOperationsService.java:48](../../src/main/java/com/ecoroute/backend/application/services/BusinessOperationsService.java#L48) · `public Mono<Incident> resolve(Long id,String outcome,String reason,Long nextRoute,String actor,boolean manager) {`.
- [src/main/java/com/ecoroute/backend/application/services/BusinessOperationsService.java:103](../../src/main/java/com/ecoroute/backend/application/services/BusinessOperationsService.java#L103) · `public Flux<Improvement> improvements() { return operations.improvements(); }`.
- [src/main/java/com/ecoroute/backend/application/services/BusinessOperationsService.java:105](../../src/main/java/com/ecoroute/backend/application/services/BusinessOperationsService.java#L105) · `public Mono<Improvement> createAction(Improvement i,String actor) {`.
- [src/main/java/com/ecoroute/backend/application/services/BusinessOperationsService.java:116](../../src/main/java/com/ecoroute/backend/application/services/BusinessOperationsService.java#L116) · `public Mono<Improvement> updateAction(Long id,String status,Double result,String note,String actor,boolean manager) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessOperationsAdapter.java:34](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessOperationsAdapter.java#L34) · `public Flux<Incident> incidents() {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessOperationsAdapter.java:37](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessOperationsAdapter.java#L37) · `public Mono<Incident> incident(Long id,boolean lock) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessOperationsAdapter.java:40](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessOperationsAdapter.java#L40) · `public Mono<Incident> createIncident(Incident i) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessOperationsAdapter.java:50](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessOperationsAdapter.java#L50) · `public Mono<Incident> resolve(Long id,String outcome,String reason,String actor,Long nextRouteId,Long retryOrderId) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessOperationsAdapter.java:58](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessOperationsAdapter.java#L58) · `public Mono<Void> linkAttempt(Long originalId,Long retryId,Long incidentId) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessOperationsAdapter.java:62](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessOperationsAdapter.java#L62) · `public Flux<Improvement> improvements() {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessOperationsAdapter.java:65](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessOperationsAdapter.java#L65) · `public Mono<Improvement> improvement(Long id,boolean lock) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessOperationsAdapter.java:68](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessOperationsAdapter.java#L68) · `public Mono<Improvement> createImprovement(Improvement i) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessOperationsAdapter.java:77](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessOperationsAdapter.java#L77) · `public Mono<Improvement> updateImprovement(Long id,String status,Double result,String note,String verifier) {`.
- [web-admin/src/App.tsx:64](../../web-admin/src/App.tsx#L64) · `path="/improvement-actions"`.

Texto de pantalla: 207 palabras, sin contar referencias.

### W07 · Dashboard web: panel de control logístico

Ruta: `/dashboard`. Roles: Administrador del sistema, como soporte a la jefatura logística de Grupo MICOTRANS. El rol técnico exigido por esta ruta es ADMIN; no basta con representar verbalmente al dispatcher.. Procesos: P05 Evaluar resultados, P07 Supervisar la jornada.

Guía de exposición revisada el 26/10/2026. Explicar cómo EcoRoute transforma los registros de reparto de Grupo MICOTRANS en cuatro perspectivas comparables: estados, puntualidad evaluable, entregas por conductor y pedidos por distrito. La captura y el resultado local conservados corresponden al 22/10/2026 en Lima; esta preparación documental no ejecutó pruebas nuevas.

**Acciones**

- Aplicar conductor y fechas inclusivas válidas; presentar población, estados y puntualidad evaluable.
- Mostrar gráficas por conductor/distrito y tarjetas operativas; contrastar pedido del flujo.
- Reintentar fuente fallida y trasladar desvíos a BI con el mismo rango, sin confundir paradas terminales con entregas exitosas.

**Estados, modales y alternativas**

- Un rango invertido impide las cuatro solicitudes analíticas; el backend también valida filtros mediante AnalyticsFilter. No demostrarlo ejecutando una petición inválida como si…
- Un error de una fuente se muestra con SourceState y reintento propio; no borra por diseño las otras fuentes. No interpretar un gráfico…

**Trazabilidad del flujo**

- El cambio de filtros actualiza useState y genera una query común; si el rango es inválido, las cuatro URL analíticas se vuelven null. Dashboard.tsx:13-19.
- useQuery ejecuta GET con Axios, conserva datos/error por clave y cancela la petición anterior mediante AbortController al cambiar dependencias. useQuery.ts:6-24.
- Axios utiliza baseURL /api y agrega el token de la sesión; el controlador recibe AnalyticsFilter y delega en DashboardService. api.ts:5-19; DashboardController.java:17-34.

**Evidencia nueva esperada: pendiente**

- Capturas NUEVAS pendientes: pantalla completa, formulario o detalle abierto, resultado persistido y alternativa relevante. Correlacionar ID, tracking, fecha, rol y vínculo con la siguiente pantalla.

**Fuentes comprobadas: líneas uno basadas**

- [web-admin/src/pages/Dashboard.tsx:12](../../web-admin/src/pages/Dashboard.tsx#L12) · `export default function Dashboard`.
- [web-admin/src/hooks/useQuery.ts:6](../../web-admin/src/hooks/useQuery.ts#L6) · `export function useQuery`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/DashboardController.java:14](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/DashboardController.java#L14) · `class DashboardController`.
- [src/main/java/com/ecoroute/backend/application/services/DashboardService.java:17](../../src/main/java/com/ecoroute/backend/application/services/DashboardService.java#L17) · `class DashboardService`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcAnalyticsAdapter.java:19](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcAnalyticsAdapter.java#L19) · `class R2dbcAnalyticsAdapter`.
- [docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P05_negocio.bpmn:3](../../docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P05_negocio.bpmn#L3) · `<bpmn:process`.
- [docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P07_negocio.bpmn:3](../../docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P07_negocio.bpmn#L3) · `<bpmn:process`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/DashboardController.java:17](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/DashboardController.java#L17) · `@GetMapping("/orders-by-status")`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/DashboardController.java:22](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/DashboardController.java#L22) · `@GetMapping("/delivery-performance")`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/DashboardController.java:27](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/DashboardController.java#L27) · `@GetMapping("/deliveries-by-driver")`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/DashboardController.java:32](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/DashboardController.java#L32) · `@GetMapping("/orders-by-district")`.
- [src/main/java/com/ecoroute/backend/application/services/DashboardService.java:21](../../src/main/java/com/ecoroute/backend/application/services/DashboardService.java#L21) · `public Flux<StatusCount> getOrderStats(Long driverId, LocalDate start, LocalDate end) {`.
- [src/main/java/com/ecoroute/backend/application/services/DashboardService.java:24](../../src/main/java/com/ecoroute/backend/application/services/DashboardService.java#L24) · `public Mono<DeliveryPerformance> getDeliveryPerformance(AnalyticsFilter filter) {`.
- [src/main/java/com/ecoroute/backend/application/services/DashboardService.java:27](../../src/main/java/com/ecoroute/backend/application/services/DashboardService.java#L27) · `public Flux<NameCount> getDeliveriesByDriver(AnalyticsFilter filter) {`.
- [src/main/java/com/ecoroute/backend/application/services/DashboardService.java:30](../../src/main/java/com/ecoroute/backend/application/services/DashboardService.java#L30) · `public Flux<NameCount> getOrdersByDistrict(AnalyticsFilter filter) { return analytics.byDistrict(filter); }`.
- [src/main/java/com/ecoroute/backend/application/services/DashboardService.java:31](../../src/main/java/com/ecoroute/backend/application/services/DashboardService.java#L31) · `public Flux<RouteEfficiency> getRouteEfficiency(AnalyticsFilter filter) { return analytics.efficiency(filter); }`.
- [src/main/java/com/ecoroute/backend/application/services/DashboardService.java:32](../../src/main/java/com/ecoroute/backend/application/services/DashboardService.java#L32) · `public Mono<OrderSummary> getSummary(AnalyticsFilter filter) {`.
- [src/main/java/com/ecoroute/backend/application/services/DashboardService.java:36](../../src/main/java/com/ecoroute/backend/application/services/DashboardService.java#L36) · `public Mono<Goal> getGoal(String code) {`.
- [src/main/java/com/ecoroute/backend/application/services/DashboardService.java:40](../../src/main/java/com/ecoroute/backend/application/services/DashboardService.java#L40) · `public Mono<Goal> saveGoal(String code, BigDecimal target, String actor) {`.
- [src/main/java/com/ecoroute/backend/application/services/DashboardService.java:48](../../src/main/java/com/ecoroute/backend/application/services/DashboardService.java#L48) · `public Mono<BiReport> getBi(AnalyticsFilter filter) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcAnalyticsAdapter.java:66](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcAnalyticsAdapter.java#L66) · `public Flux<StatusCount> ordersByStatus(AnalyticsFilter f) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcAnalyticsAdapter.java:71](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcAnalyticsAdapter.java#L71) · `public Mono<Totals> totals(AnalyticsFilter f) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcAnalyticsAdapter.java:76](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcAnalyticsAdapter.java#L76) · `public Flux<DailyTotals> daily(AnalyticsFilter f) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcAnalyticsAdapter.java:82](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcAnalyticsAdapter.java#L82) · `public Flux<DriverCount> byDriver(AnalyticsFilter f) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcAnalyticsAdapter.java:92](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcAnalyticsAdapter.java#L92) · `public Flux<NameCount> byDistrict(AnalyticsFilter f) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcAnalyticsAdapter.java:98](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcAnalyticsAdapter.java#L98) · `public Flux<Cause> causes(AnalyticsFilter f) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcAnalyticsAdapter.java:118](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcAnalyticsAdapter.java#L118) · `public Flux<RouteEfficiency> efficiency(AnalyticsFilter f) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcAnalyticsAdapter.java:149](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcAnalyticsAdapter.java#L149) · `public Flux<Goal> goals() {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcAnalyticsAdapter.java:153](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcAnalyticsAdapter.java#L153) · `public Mono<Goal> saveGoal(Indicator code, BigDecimal target, String actor) {`.
- [web-admin/src/App.tsx:69](../../web-admin/src/App.tsx#L69) · `path="/dashboard"`.

Texto de pantalla: 228 palabras, sin contar referencias.

### W08 · Conductores

Ruta: `/drivers`. Roles: ADMIN. Procesos: P06 Habilitar recursos de reparto, P02 Preparar la jornada de reparto, P08 Administrar accesos.

Catálogo que habilita recursos P06. Registra nombres, apellido, licencia, correo, teléfono y actividad. El BPMN exige documentación, aptitud y disponibilidad; el formulario conserva información declarada, sin inspección física automática. Un recurso activo puede estar ocupado en otra ruta y despacho vuelve a validar fecha. Editar conductor no concede acceso: Usuarios vincula subject y rol DRIVER.

**Acciones**

- Buscar por nombre o licencia y recorrer páginas de diez; abrir alta ficticia.
- Editar el mismo ID/actividad, recargar y comprobar resultado.
- Mostrar recurso en Nueva ruta; explicar activo frente a disponible.

**Estados, modales y alternativas**

- Carga/error con reintento, búsqueda vacía, páginas y modal alta/edición.
- Confirmación nativa al eliminar; duplicidad, relación con rutas o integridad pueden impedir operación. No asegurar borrado antes de respuesta.

**Trazabilidad del flujo**

- Drivers.fetchDrivers/handleSubmit → driverService → GET/POST /api/drivers y PUT/DELETE /{id}.
- DriverController → DriverUseCasesImpl → R2dbcDriverRepository/Spring Data → drivers. Respuesta recarga listado; planificación aplica otra validación de recursos.

**Evidencia nueva esperada: pendiente**

- Capturas nuevas esperadas: catálogo, formulario completo, edición/actividad y selección en despacho. Solo ensayar borrado sobre un registro prescindible; conservar IDs y explicar aptitud documental como revisión humana.
- Conservar título, sesión e identificadores ficticios; añadir tomas inferiores cuando el contenido exceda la ventana. Si una negativa no puede prepararse, documentarla como esperada y no observada. La lectura del código no acredita ejecución actual ni éxito de una operación remota.

**Fuentes comprobadas: líneas uno basadas**

- [web-admin/src/pages/Drivers.tsx:9](../../web-admin/src/pages/Drivers.tsx#L9) · `const Drivers`.
- [web-admin/src/services/driverService.ts:15](../../web-admin/src/services/driverService.ts#L15) · `export const getAllDrivers = async (): Promise<Driver[]> => {`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/DriverController.java:17](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/DriverController.java#L17) · `class DriverController`.
- [src/main/java/com/ecoroute/backend/application/usecases/DriverUseCasesImpl.java:14](../../src/main/java/com/ecoroute/backend/application/usecases/DriverUseCasesImpl.java#L14) · `class DriverUseCasesImpl`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcDriverRepository.java:10](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcDriverRepository.java#L10) · `class R2dbcDriverRepository`.
- [docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P06_negocio.bpmn:3](../../docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P06_negocio.bpmn#L3) · `<bpmn:process`.
- [docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P02_negocio.bpmn:3](../../docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P02_negocio.bpmn#L3) · `<bpmn:process`.
- [docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P08_negocio.bpmn:3](../../docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P08_negocio.bpmn#L3) · `<bpmn:process`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/DriverController.java:26](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/DriverController.java#L26) · `@PostMapping`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/DriverController.java:43](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/DriverController.java#L43) · `@GetMapping("/{id}")`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/DriverController.java:50](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/DriverController.java#L50) · `@GetMapping`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/DriverController.java:56](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/DriverController.java#L56) · `@PutMapping("/{id}")`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/DriverController.java:73](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/DriverController.java#L73) · `@DeleteMapping("/{id}")`.
- [src/main/java/com/ecoroute/backend/application/usecases/DriverUseCasesImpl.java:21](../../src/main/java/com/ecoroute/backend/application/usecases/DriverUseCasesImpl.java#L21) · `public Mono<Driver> createDriver(Driver driver) {`.
- [src/main/java/com/ecoroute/backend/application/usecases/DriverUseCasesImpl.java:26](../../src/main/java/com/ecoroute/backend/application/usecases/DriverUseCasesImpl.java#L26) · `public Mono<Driver> getDriverById(Long id) {`.
- [src/main/java/com/ecoroute/backend/application/usecases/DriverUseCasesImpl.java:32](../../src/main/java/com/ecoroute/backend/application/usecases/DriverUseCasesImpl.java#L32) · `public Flux<Driver> getAllDrivers() {`.
- [src/main/java/com/ecoroute/backend/application/usecases/DriverUseCasesImpl.java:37](../../src/main/java/com/ecoroute/backend/application/usecases/DriverUseCasesImpl.java#L37) · `public Mono<Driver> updateDriver(Long id, Driver driver) {`.
- [src/main/java/com/ecoroute/backend/application/usecases/DriverUseCasesImpl.java:58](../../src/main/java/com/ecoroute/backend/application/usecases/DriverUseCasesImpl.java#L58) · `public Mono<Void> deleteDriver(Long id) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcDriverRepository.java:19](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcDriverRepository.java#L19) · `public Mono<Driver> save(Driver driver) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcDriverRepository.java:26](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcDriverRepository.java#L26) · `public Flux<Driver> findAll() {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcDriverRepository.java:32](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcDriverRepository.java#L32) · `public Mono<Driver> findById(Long id) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcDriverRepository.java:38](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcDriverRepository.java#L38) · `public Mono<Void> deleteById(Long id) {`.
- [web-admin/src/App.tsx:70](../../web-admin/src/App.tsx#L70) · `path="/drivers"`.

Texto de pantalla: 208 palabras, sin contar referencias.

### W09 · Vehículos

Ruta: `/vehicles`. Roles: ADMIN. Procesos: P06 Habilitar recursos de reparto, P02 Preparar la jornada de reparto, P09 Registrar compras operativas.

Catálogo que habilita recursos P06. Registra placa, marca, modelo, capacidad kg/m³ y actividad. El BPMN exige documentación, aptitud y disponibilidad; el formulario conserva información declarada, sin inspección física automática. Un recurso activo puede estar ocupado en otra ruta y despacho vuelve a validar fecha. La capacidad se contrasta con carga al aprobar; una compra no crea automáticamente el vehículo.

**Acciones**

- Buscar por placa o modelo y recorrer páginas de diez; abrir alta ficticia.
- Editar el mismo ID/actividad, recargar y comprobar resultado.
- Mostrar recurso en Nueva ruta; explicar activo frente a disponible.

**Estados, modales y alternativas**

- Carga/error con reintento, búsqueda vacía, páginas y modal alta/edición.
- Confirmación nativa al eliminar; duplicidad, relación con rutas o integridad pueden impedir operación. No asegurar borrado antes de respuesta.

**Trazabilidad del flujo**

- Vehicles.fetchVehicles/handleSubmit → vehicleService → GET/POST /api/vehicles y PUT/DELETE /{id}.
- VehicleController → VehicleUseCasesImpl → R2dbcVehicleRepository/Spring Data → vehicles. Respuesta recarga listado; planificación aplica otra validación de recursos.

**Evidencia nueva esperada: pendiente**

- Capturas nuevas esperadas: catálogo, formulario completo, edición/actividad y selección en despacho. Solo ensayar borrado sobre un registro prescindible; conservar IDs y explicar aptitud documental como revisión humana.
- Conservar título, sesión e identificadores ficticios; añadir tomas inferiores cuando el contenido exceda la ventana. Si una negativa no puede prepararse, documentarla como esperada y no observada. La lectura del código no acredita ejecución actual ni éxito de una operación remota.

**Fuentes comprobadas: líneas uno basadas**

- [web-admin/src/pages/Vehicles.tsx:9](../../web-admin/src/pages/Vehicles.tsx#L9) · `const Vehicles`.
- [web-admin/src/services/vehicleService.ts:14](../../web-admin/src/services/vehicleService.ts#L14) · `export const getAllVehicles = async (): Promise<Vehicle[]> => {`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/VehicleController.java:16](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/VehicleController.java#L16) · `class VehicleController`.
- [src/main/java/com/ecoroute/backend/application/usecases/VehicleUseCasesImpl.java:14](../../src/main/java/com/ecoroute/backend/application/usecases/VehicleUseCasesImpl.java#L14) · `class VehicleUseCasesImpl`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcVehicleRepository.java:10](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcVehicleRepository.java#L10) · `class R2dbcVehicleRepository`.
- [docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P06_negocio.bpmn:3](../../docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P06_negocio.bpmn#L3) · `<bpmn:process`.
- [docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P02_negocio.bpmn:3](../../docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P02_negocio.bpmn#L3) · `<bpmn:process`.
- [docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P09_negocio.bpmn:3](../../docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P09_negocio.bpmn#L3) · `<bpmn:process`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/VehicleController.java:25](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/VehicleController.java#L25) · `@PostMapping`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/VehicleController.java:40](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/VehicleController.java#L40) · `@GetMapping("/{id}")`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/VehicleController.java:45](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/VehicleController.java#L45) · `@GetMapping`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/VehicleController.java:51](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/VehicleController.java#L51) · `@PutMapping("/{id}")`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/VehicleController.java:66](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/VehicleController.java#L66) · `@DeleteMapping("/{id}")`.
- [src/main/java/com/ecoroute/backend/application/usecases/VehicleUseCasesImpl.java:21](../../src/main/java/com/ecoroute/backend/application/usecases/VehicleUseCasesImpl.java#L21) · `public Mono<Vehicle> createVehicle(Vehicle vehicle) {`.
- [src/main/java/com/ecoroute/backend/application/usecases/VehicleUseCasesImpl.java:26](../../src/main/java/com/ecoroute/backend/application/usecases/VehicleUseCasesImpl.java#L26) · `public Mono<Vehicle> getVehicleById(Long id) {`.
- [src/main/java/com/ecoroute/backend/application/usecases/VehicleUseCasesImpl.java:32](../../src/main/java/com/ecoroute/backend/application/usecases/VehicleUseCasesImpl.java#L32) · `public Flux<Vehicle> getAllVehicles() {`.
- [src/main/java/com/ecoroute/backend/application/usecases/VehicleUseCasesImpl.java:37](../../src/main/java/com/ecoroute/backend/application/usecases/VehicleUseCasesImpl.java#L37) · `public Mono<Vehicle> updateVehicle(Long id, Vehicle vehicle) {`.
- [src/main/java/com/ecoroute/backend/application/usecases/VehicleUseCasesImpl.java:56](../../src/main/java/com/ecoroute/backend/application/usecases/VehicleUseCasesImpl.java#L56) · `public Mono<Void> deleteVehicle(Long id) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcVehicleRepository.java:19](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcVehicleRepository.java#L19) · `public Mono<Vehicle> save(Vehicle vehicle) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcVehicleRepository.java:26](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcVehicleRepository.java#L26) · `public Flux<Vehicle> findAll() {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcVehicleRepository.java:32](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcVehicleRepository.java#L32) · `public Mono<Vehicle> findById(Long id) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcVehicleRepository.java:38](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcVehicleRepository.java#L38) · `public Mono<Void> deleteById(Long id) {`.
- [web-admin/src/App.tsx:71](../../web-admin/src/App.tsx#L71) · `path="/vehicles"`.

Texto de pantalla: 212 palabras, sin contar referencias.

### W10 · Usuarios e identidades

Ruta: `/users`. Roles: ADMIN. Procesos: P08 Administrar accesos, P06 Habilitar recursos de reparto.

Gestiona roles efectivos y vínculo de conductor. Keycloak consulta identidades existentes, edita ADMIN/DISPATCHER/DRIVER, vincula conductor activo y habilita/deshabilita. No ofrece alta de cuentas nuevas. El backend valida asociación y revoca sesiones afectadas. Registro local anterior queda para migración, sin permisos efectivos; sus escrituras antiguas responden 410. Autorizar solicitud y elegir rol mínimo son decisiones humanas P08 previas al formulario.

**Acciones**

- Buscar usuario/subject y abrir editor; mostrar conductor requerido para DRIVER.
- Guardar sobre cuenta de ensayo y presentar nueva sesión; comprobar permiso efectivo.
- Mostrar confirmación de baja y pestaña anterior; señalar protección del ADMIN propio.

**Estados, modales y alternativas**

- KEYCLOAK/LEGACY; IdentityEditor; confirmación enabled; busy/error.
- Vínculo duplicado, conductor inactivo o privilegios propios inválidos: corregir según servidor. Legacy no equivale a acceso.

**Trazabilidad del flujo**

- Users → useQuery/userService → GET /api/users/identities, PUT /{id}/roles o /enabled.
- IdentityController → KeycloakAdministration.roles/enabled → API administrativa Keycloak; vínculo drivers, revocación Redis y business_audit_events.
- GET /users → UserController → SpringDataUserRoleRepository → auth_user_role histórico.

**Evidencia nueva esperada: pendiente**

- Capturas nuevas esperadas: identidades, editor/vínculo, mensaje de nueva sesión y legacy rotulado. Conservar rol/subject ficticios, sin deshabilitar al expositor ni mostrar credenciales; comprobar autorización con la cuenta afectada.
- Conservar título, sesión e identificadores ficticios; añadir tomas inferiores cuando el contenido exceda la ventana. Si una negativa no puede prepararse, documentarla como esperada y no observada. La lectura del código no acredita ejecución actual ni éxito de una operación remota.

**Fuentes comprobadas: líneas uno basadas**

- [web-admin/src/pages/Users.tsx:31](../../web-admin/src/pages/Users.tsx#L31) · `export default function Users`.
- [web-admin/src/pages/Users.tsx:11](../../web-admin/src/pages/Users.tsx#L11) · `function IdentityEditor`.
- [web-admin/src/services/userService.ts:9](../../web-admin/src/services/userService.ts#L9) · `export const getAllUsers = async (): Promise<UserRole[]> => {`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/IdentityController.java:11](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/IdentityController.java#L11) · `class IdentityController`.
- [src/main/java/com/ecoroute/backend/infrastructure/security/KeycloakAdministration.java:27](../../src/main/java/com/ecoroute/backend/infrastructure/security/KeycloakAdministration.java#L27) · `class KeycloakAdministration`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/UserController.java:13](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/UserController.java#L13) · `class UserController`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/SpringDataUserRoleRepository.java:8](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/SpringDataUserRoleRepository.java#L8) · `interface SpringDataUserRoleRepository`.
- [docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P08_negocio.bpmn:3](../../docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P08_negocio.bpmn#L3) · `<bpmn:process`.
- [docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P06_negocio.bpmn:3](../../docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P06_negocio.bpmn#L3) · `<bpmn:process`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/IdentityController.java:14](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/IdentityController.java#L14) · `@GetMapping public Flux<Map<String,Object>> list() { return identity.identities(); }`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/IdentityController.java:15](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/IdentityController.java#L15) · `@PutMapping("/{id}/roles") public Mono<Void> roles(@PathVariable String id,@RequestBody RolesRequest request) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/IdentityController.java:18](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/IdentityController.java#L18) · `@PutMapping("/{id}/enabled") public Mono<Void> enabled(@PathVariable String id,@RequestBody EnabledRequest request) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/UserController.java:17](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/UserController.java#L17) · `@GetMapping`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/UserController.java:22](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/UserController.java#L22) · `@PostMapping`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/UserController.java:27](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/UserController.java#L27) · `@DeleteMapping("/{id}")`.
- [web-admin/src/App.tsx:72](../../web-admin/src/App.tsx#L72) · `path="/users"`.

Texto de pantalla: 215 palabras, sin contar referencias.

### W11 · Compras operativas

Ruta: `/purchases`. Roles: ADMIN. Procesos: P09 Registrar compras operativas, P06 Habilitar recursos de reparto, P05 Evaluar resultados.

Registra compras para recursos y mejoras: descripción, proveedor, importe, estado, categoría y notas. P09 evalúa existencia, presupuesto, proveedor, autorización y recepción conforme: decisiones humanas, sin motor automático de aprobación en este CRUD. Cambiar estado no prueba pago ni recepción física. Recurso existente puede cubrir necesidad sin compra; recepción observada exige reclamo/devolución. No hay adjuntador de comprobante evidenciado en este formulario.

**Acciones**

- Mostrar búsqueda/paginación y Nueva compra con importe válido.
- Editar mismo ID, estado/notas sustentados y recargar listado.
- Relacionar necesidad con recurso/mejora sin inventar vínculo automático; confirmar borrado solo de compra prescindible.

**Estados, modales y alternativas**

- Carga/error con reintento; lista vacía/filtrada; modales separados alta/edición.
- Confirmación nativa de borrado, importe inválido y mensaje servidor; no existe pantalla de autorización de gasto.

**Trazabilidad del flujo**

- Purchases.fetchData/handleCreateSubmit/handleEditSubmit → purchaseService → GET/POST /api/purchases, PUT/DELETE /{id}.
- PurchaseController → PurchaseUseCasesImpl → R2dbcPurchaseRepository/SpringDataPurchaseRepository → purchases. Respuesta recarga catálogo; compra→recurso/acción es narrativa si falta relación persistida.

**Evidencia nueva esperada: pendiente**

- Capturas nuevas esperadas: lista, alta/edición completas con importe/estado/notas. Explicar revisión humana presupuestaria y recepción; estado no equivale a comprobante de pago. Mantener un registro ficticio trazable y comprobar respuesta antes de anunciar éxito.
- Conservar título, sesión e identificadores ficticios; añadir tomas inferiores cuando el contenido exceda la ventana. Si una negativa no puede prepararse, documentarla como esperada y no observada. La lectura del código no acredita ejecución actual ni éxito de una operación remota.

**Fuentes comprobadas: líneas uno basadas**

- [web-admin/src/pages/Purchases.tsx:9](../../web-admin/src/pages/Purchases.tsx#L9) · `const Purchases`.
- [web-admin/src/services/purchaseService.ts:15](../../web-admin/src/services/purchaseService.ts#L15) · `export const getAllPurchases = async (): Promise<Purchase[]> => {`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/PurchaseController.java:18](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/PurchaseController.java#L18) · `class PurchaseController`.
- [src/main/java/com/ecoroute/backend/application/usecases/PurchaseUseCasesImpl.java:18](../../src/main/java/com/ecoroute/backend/application/usecases/PurchaseUseCasesImpl.java#L18) · `class PurchaseUseCasesImpl`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcPurchaseRepository.java:10](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcPurchaseRepository.java#L10) · `class R2dbcPurchaseRepository`.
- [docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P09_negocio.bpmn:3](../../docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P09_negocio.bpmn#L3) · `<bpmn:process`.
- [docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P06_negocio.bpmn:3](../../docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P06_negocio.bpmn#L3) · `<bpmn:process`.
- [docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P05_negocio.bpmn:3](../../docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P05_negocio.bpmn#L3) · `<bpmn:process`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/PurchaseController.java:25](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/PurchaseController.java#L25) · `@PostMapping`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/PurchaseController.java:41](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/PurchaseController.java#L41) · `@GetMapping`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/PurchaseController.java:46](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/PurchaseController.java#L46) · `@PutMapping("/{id}")`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/PurchaseController.java:62](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/PurchaseController.java#L62) · `@DeleteMapping("/{id}")`.
- [src/main/java/com/ecoroute/backend/application/usecases/PurchaseUseCasesImpl.java:23](../../src/main/java/com/ecoroute/backend/application/usecases/PurchaseUseCasesImpl.java#L23) · `public Mono<Purchase> createPurchase(Purchase purchase) {`.
- [src/main/java/com/ecoroute/backend/application/usecases/PurchaseUseCasesImpl.java:28](../../src/main/java/com/ecoroute/backend/application/usecases/PurchaseUseCasesImpl.java#L28) · `public Flux<Purchase> getAllPurchases() {`.
- [src/main/java/com/ecoroute/backend/application/usecases/PurchaseUseCasesImpl.java:33](../../src/main/java/com/ecoroute/backend/application/usecases/PurchaseUseCasesImpl.java#L33) · `public Mono<Purchase> updatePurchase(Long id, Purchase purchase) {`.
- [src/main/java/com/ecoroute/backend/application/usecases/PurchaseUseCasesImpl.java:52](../../src/main/java/com/ecoroute/backend/application/usecases/PurchaseUseCasesImpl.java#L52) · `public Mono<Void> deletePurchase(Long id) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcPurchaseRepository.java:19](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcPurchaseRepository.java#L19) · `public Mono<Purchase> save(Purchase purchase) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcPurchaseRepository.java:26](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcPurchaseRepository.java#L26) · `public Flux<Purchase> findAll() {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcPurchaseRepository.java:32](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcPurchaseRepository.java#L32) · `public Mono<Purchase> findById(Long id) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcPurchaseRepository.java:38](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcPurchaseRepository.java#L38) · `public Mono<Void> deleteById(Long id) {`.
- [web-admin/src/App.tsx:73](../../web-admin/src/App.tsx#L73) · `path="/purchases"`.

Texto de pantalla: 213 palabras, sin contar referencias.

### W12 · Reportes operativos

Ruta: `/reports`. Roles: ADMIN. Procesos: P05 Evaluar resultados, P07 Supervisar la jornada.

Consolida resumen, entregas por conductor y eficiencia. Usa fechas inclusivas America/Lima y conductor. Las tres fuentes cargan/fallan independientemente: sección visible no acredita todas. Puntualidad exige POD y fin de ventana. Eficiencia distingue plan de GPS evaluable y duración operacional de servicio en domicilio. Contrasta Dashboard/BI conservando población e IDs. No incorpora edición ni aprobación de informes.

**Acciones**

- Aplicar mismo conductor/rango de Dashboard/BI; leer población de puntualidad.
- Mostrar gráficas y tabla inferior con todas las columnas.
- Reintentar fuente fallida y trasladar desvíos al análisis P05.

**Estados, modales y alternativas**

- Summary/performance/efficiency independientes; rango inválido sin consulta; vacío y error parcial.
- GPS no evaluable es nulo; ausencia no equivale a cero ni plan a observación. Cierre terminal no implica éxito total.

**Trazabilidad del flujo**

- Reports → useQuery → GET /api/reports/orders-summary, /driver-performance y /route-efficiency con filterQuery.
- ReportController → DashboardService → AnalyticsQueryPort → R2dbcAnalyticsAdapter → orders/routes/delivery_proofs/telemetría, sin alterar estados.
- EfficiencyTable presenta calidad GPS y métricas; no convierte fallos/devoluciones en entregas.

**Evidencia nueva esperada: pendiente**

- Capturas nuevas esperadas: filtros, resumen, gráficas y tabla inferior sin recortes; contrastar cifras del flujo actual, conservar población y cabecera. Si una fuente falla, capturar mensaje y resultado de reintento antes de presentar el reporte como completo.
- Conservar título, sesión e identificadores ficticios; añadir tomas inferiores cuando el contenido exceda la ventana. Si una negativa no puede prepararse, documentarla como esperada y no observada. La lectura del código no acredita ejecución actual ni éxito de una operación remota.

**Fuentes comprobadas: líneas uno basadas**

- [web-admin/src/pages/Reports.tsx:11](../../web-admin/src/pages/Reports.tsx#L11) · `export default function Reports`.
- [web-admin/src/hooks/useQuery.ts:6](../../web-admin/src/hooks/useQuery.ts#L6) · `export function useQuery`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/ReportController.java:18](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/ReportController.java#L18) · `class ReportController`.
- [src/main/java/com/ecoroute/backend/application/services/DashboardService.java:17](../../src/main/java/com/ecoroute/backend/application/services/DashboardService.java#L17) · `class DashboardService`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcAnalyticsAdapter.java:19](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcAnalyticsAdapter.java#L19) · `class R2dbcAnalyticsAdapter`.
- [web-admin/src/components/EfficiencyTable.tsx:4](../../web-admin/src/components/EfficiencyTable.tsx#L4) · `export function EfficiencyTable`.
- [docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P05_negocio.bpmn:3](../../docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P05_negocio.bpmn#L3) · `<bpmn:process`.
- [docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P07_negocio.bpmn:3](../../docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P07_negocio.bpmn#L3) · `<bpmn:process`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/ReportController.java:21](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/ReportController.java#L21) · `@GetMapping("/orders-summary")`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/ReportController.java:26](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/ReportController.java#L26) · `@GetMapping("/driver-performance")`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/ReportController.java:31](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/ReportController.java#L31) · `@GetMapping("/route-efficiency")`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/ReportController.java:36](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/ReportController.java#L36) · `@GetMapping("/bi")`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/ReportController.java:41](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/ReportController.java#L41) · `@GetMapping("/goals/{code}")`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/ReportController.java:46](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/ReportController.java#L46) · `@PutMapping("/goals/{code}")`.
- [src/main/java/com/ecoroute/backend/application/services/DashboardService.java:21](../../src/main/java/com/ecoroute/backend/application/services/DashboardService.java#L21) · `public Flux<StatusCount> getOrderStats(Long driverId, LocalDate start, LocalDate end) {`.
- [src/main/java/com/ecoroute/backend/application/services/DashboardService.java:24](../../src/main/java/com/ecoroute/backend/application/services/DashboardService.java#L24) · `public Mono<DeliveryPerformance> getDeliveryPerformance(AnalyticsFilter filter) {`.
- [src/main/java/com/ecoroute/backend/application/services/DashboardService.java:27](../../src/main/java/com/ecoroute/backend/application/services/DashboardService.java#L27) · `public Flux<NameCount> getDeliveriesByDriver(AnalyticsFilter filter) {`.
- [src/main/java/com/ecoroute/backend/application/services/DashboardService.java:30](../../src/main/java/com/ecoroute/backend/application/services/DashboardService.java#L30) · `public Flux<NameCount> getOrdersByDistrict(AnalyticsFilter filter) { return analytics.byDistrict(filter); }`.
- [src/main/java/com/ecoroute/backend/application/services/DashboardService.java:31](../../src/main/java/com/ecoroute/backend/application/services/DashboardService.java#L31) · `public Flux<RouteEfficiency> getRouteEfficiency(AnalyticsFilter filter) { return analytics.efficiency(filter); }`.
- [src/main/java/com/ecoroute/backend/application/services/DashboardService.java:32](../../src/main/java/com/ecoroute/backend/application/services/DashboardService.java#L32) · `public Mono<OrderSummary> getSummary(AnalyticsFilter filter) {`.
- [src/main/java/com/ecoroute/backend/application/services/DashboardService.java:36](../../src/main/java/com/ecoroute/backend/application/services/DashboardService.java#L36) · `public Mono<Goal> getGoal(String code) {`.
- [src/main/java/com/ecoroute/backend/application/services/DashboardService.java:40](../../src/main/java/com/ecoroute/backend/application/services/DashboardService.java#L40) · `public Mono<Goal> saveGoal(String code, BigDecimal target, String actor) {`.
- [src/main/java/com/ecoroute/backend/application/services/DashboardService.java:48](../../src/main/java/com/ecoroute/backend/application/services/DashboardService.java#L48) · `public Mono<BiReport> getBi(AnalyticsFilter filter) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcAnalyticsAdapter.java:66](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcAnalyticsAdapter.java#L66) · `public Flux<StatusCount> ordersByStatus(AnalyticsFilter f) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcAnalyticsAdapter.java:71](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcAnalyticsAdapter.java#L71) · `public Mono<Totals> totals(AnalyticsFilter f) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcAnalyticsAdapter.java:76](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcAnalyticsAdapter.java#L76) · `public Flux<DailyTotals> daily(AnalyticsFilter f) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcAnalyticsAdapter.java:82](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcAnalyticsAdapter.java#L82) · `public Flux<DriverCount> byDriver(AnalyticsFilter f) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcAnalyticsAdapter.java:92](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcAnalyticsAdapter.java#L92) · `public Flux<NameCount> byDistrict(AnalyticsFilter f) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcAnalyticsAdapter.java:98](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcAnalyticsAdapter.java#L98) · `public Flux<Cause> causes(AnalyticsFilter f) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcAnalyticsAdapter.java:118](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcAnalyticsAdapter.java#L118) · `public Flux<RouteEfficiency> efficiency(AnalyticsFilter f) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcAnalyticsAdapter.java:149](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcAnalyticsAdapter.java#L149) · `public Flux<Goal> goals() {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcAnalyticsAdapter.java:153](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcAnalyticsAdapter.java#L153) · `public Mono<Goal> saveGoal(Indicator code, BigDecimal target, String actor) {`.
- [web-admin/src/App.tsx:74](../../web-admin/src/App.tsx#L74) · `path="/reports"`.

Texto de pantalla: 225 palabras, sin contar referencias.

### W13 · Inteligencia de negocio

Ruta: `/bi`. Roles: Administrador como soporte de la jefatura logística de Grupo MICOTRANS. La pantalla global requiere ADMIN; no equivale a una aprobación empresarial de los indicadores.. Procesos: P05 Evaluar resultados, P06 Habilitar recursos de reparto, P07 Supervisar la jornada.

Guía del 26/10/2026 para explicar fórmulas, alcance de filtros, ausencia de datos y calidad de distancia. La aplicación entrega BI propia mediante /reports/bi; no se presenta como Power BI conectado. El corte ilustrativo del 22/10/2026 conserva IID=4/4, CHR=2/4, TDE=2/4, SUCCESS=2/4 y ONTIME=2/2. Son datos de comprobación local, no resultados comerciales.

**Acciones**

- Aplicar conductor/rango y recorrer las siete vistas con gráficas/tablas completas.
- Metas: guardar valor 0–100 o vacío, comprobar actor/fecha y recarga de indicadores.
- Exportar CSV de indicadores/tendencias y abrir Acciones P05 para vincular causa, responsable y medición.

**Estados, modales y alternativas**

- Siete vistas: Tendencias, Causas, Cumplimiento, Calidad de datos, Eficiencia, Metas y Acciones P05.
- NO_DATA/NO_TARGET/MET/BELOW_TARGET; GPS nulo no es cero ni plan; causas son eventos; RUC opcional ausente afecta IID; POD metadata no prueba imágenes remotas.

**Trazabilidad del flujo**

- BusinessIntelligence → useQuery → GET /reports/bi → ReportController → DashboardService.getBi → R2dbcAnalyticsAdapter → agregados operativos.
- GoalEditor → reportService.saveGoal → PUT /reports/goals/{code} → DashboardService.saveGoal → R2dbcAnalyticsAdapter.saveGoal → analytics_goals e historial con actor.
- Acciones P05 reutiliza ImprovementActions; biCsv exporta reporte recibido, tendencias comparan meta vigente.

**Evidencia nueva esperada: pendiente**

- Capturas NUEVAS pendientes: pantalla completa, formulario o detalle abierto, resultado persistido y alternativa relevante. Correlacionar ID, tracking, fecha, rol y vínculo con la siguiente pantalla.
- Comprobar respuesta del servidor y el mismo identificador al recargar antes de anunciar éxito; conservar contexto del siguiente paso de negocio.

**Fuentes comprobadas: líneas uno basadas**

- [web-admin/src/pages/BusinessIntelligence.tsx:76](../../web-admin/src/pages/BusinessIntelligence.tsx#L76) · `export default function BusinessIntelligence`.
- [web-admin/src/services/reportService.ts:7](../../web-admin/src/services/reportService.ts#L7) · `export const emptyFilters: ReportFilters = { driverId: '', startDate: '', endDate: '' };`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/ReportController.java:18](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/ReportController.java#L18) · `class ReportController`.
- [src/main/java/com/ecoroute/backend/application/services/DashboardService.java:17](../../src/main/java/com/ecoroute/backend/application/services/DashboardService.java#L17) · `class DashboardService`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcAnalyticsAdapter.java:19](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcAnalyticsAdapter.java#L19) · `class R2dbcAnalyticsAdapter`.
- [web-admin/src/pages/BusinessIntelligence.tsx:18](../../web-admin/src/pages/BusinessIntelligence.tsx#L18) · `function GoalEditor`.
- [web-admin/src/pages/BusinessIntelligence.tsx:36](../../web-admin/src/pages/BusinessIntelligence.tsx#L36) · `function BiCharts`.
- [docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P05_negocio.bpmn:3](../../docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P05_negocio.bpmn#L3) · `<bpmn:process`.
- [docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P06_negocio.bpmn:3](../../docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P06_negocio.bpmn#L3) · `<bpmn:process`.
- [docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P07_negocio.bpmn:3](../../docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P07_negocio.bpmn#L3) · `<bpmn:process`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/ReportController.java:21](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/ReportController.java#L21) · `@GetMapping("/orders-summary")`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/ReportController.java:26](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/ReportController.java#L26) · `@GetMapping("/driver-performance")`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/ReportController.java:31](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/ReportController.java#L31) · `@GetMapping("/route-efficiency")`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/ReportController.java:36](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/ReportController.java#L36) · `@GetMapping("/bi")`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/ReportController.java:41](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/ReportController.java#L41) · `@GetMapping("/goals/{code}")`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/ReportController.java:46](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/ReportController.java#L46) · `@PutMapping("/goals/{code}")`.
- [src/main/java/com/ecoroute/backend/application/services/DashboardService.java:21](../../src/main/java/com/ecoroute/backend/application/services/DashboardService.java#L21) · `public Flux<StatusCount> getOrderStats(Long driverId, LocalDate start, LocalDate end) {`.
- [src/main/java/com/ecoroute/backend/application/services/DashboardService.java:24](../../src/main/java/com/ecoroute/backend/application/services/DashboardService.java#L24) · `public Mono<DeliveryPerformance> getDeliveryPerformance(AnalyticsFilter filter) {`.
- [src/main/java/com/ecoroute/backend/application/services/DashboardService.java:27](../../src/main/java/com/ecoroute/backend/application/services/DashboardService.java#L27) · `public Flux<NameCount> getDeliveriesByDriver(AnalyticsFilter filter) {`.
- [src/main/java/com/ecoroute/backend/application/services/DashboardService.java:30](../../src/main/java/com/ecoroute/backend/application/services/DashboardService.java#L30) · `public Flux<NameCount> getOrdersByDistrict(AnalyticsFilter filter) { return analytics.byDistrict(filter); }`.
- [src/main/java/com/ecoroute/backend/application/services/DashboardService.java:31](../../src/main/java/com/ecoroute/backend/application/services/DashboardService.java#L31) · `public Flux<RouteEfficiency> getRouteEfficiency(AnalyticsFilter filter) { return analytics.efficiency(filter); }`.
- [src/main/java/com/ecoroute/backend/application/services/DashboardService.java:32](../../src/main/java/com/ecoroute/backend/application/services/DashboardService.java#L32) · `public Mono<OrderSummary> getSummary(AnalyticsFilter filter) {`.
- [src/main/java/com/ecoroute/backend/application/services/DashboardService.java:36](../../src/main/java/com/ecoroute/backend/application/services/DashboardService.java#L36) · `public Mono<Goal> getGoal(String code) {`.
- [src/main/java/com/ecoroute/backend/application/services/DashboardService.java:40](../../src/main/java/com/ecoroute/backend/application/services/DashboardService.java#L40) · `public Mono<Goal> saveGoal(String code, BigDecimal target, String actor) {`.
- [src/main/java/com/ecoroute/backend/application/services/DashboardService.java:48](../../src/main/java/com/ecoroute/backend/application/services/DashboardService.java#L48) · `public Mono<BiReport> getBi(AnalyticsFilter filter) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcAnalyticsAdapter.java:66](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcAnalyticsAdapter.java#L66) · `public Flux<StatusCount> ordersByStatus(AnalyticsFilter f) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcAnalyticsAdapter.java:71](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcAnalyticsAdapter.java#L71) · `public Mono<Totals> totals(AnalyticsFilter f) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcAnalyticsAdapter.java:76](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcAnalyticsAdapter.java#L76) · `public Flux<DailyTotals> daily(AnalyticsFilter f) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcAnalyticsAdapter.java:82](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcAnalyticsAdapter.java#L82) · `public Flux<DriverCount> byDriver(AnalyticsFilter f) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcAnalyticsAdapter.java:92](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcAnalyticsAdapter.java#L92) · `public Flux<NameCount> byDistrict(AnalyticsFilter f) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcAnalyticsAdapter.java:98](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcAnalyticsAdapter.java#L98) · `public Flux<Cause> causes(AnalyticsFilter f) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcAnalyticsAdapter.java:118](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcAnalyticsAdapter.java#L118) · `public Flux<RouteEfficiency> efficiency(AnalyticsFilter f) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcAnalyticsAdapter.java:149](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcAnalyticsAdapter.java#L149) · `public Flux<Goal> goals() {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcAnalyticsAdapter.java:153](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcAnalyticsAdapter.java#L153) · `public Mono<Goal> saveGoal(Indicator code, BigDecimal target, String actor) {`.
- [web-admin/src/App.tsx:75](../../web-admin/src/App.tsx#L75) · `path="/bi"`.

Texto de pantalla: 210 palabras, sin contar referencias.


## Flutter: 6 pantallas

### M01 · Acceso del conductor

Ruta: `/login`. Roles: DRIVER autenticado; login público antes de sesión. Procesos: P08 Administrar accesos.

Entrada Flutter y retorno cuando falta sesión. Despacha LoginRequested, obtiene tokens y consulta /session/me para identidad/vínculo efectivos. Requiere cuenta habilitada y conductor asociado desde Usuarios. El router escucha AuthBloc: autenticado va a Mis rutas; sin sesión vuelve a login. Inicia comprobación P08 antes de aceptar/entregar. Recuperación local no equivale a verificar nuevamente permisos remotos; completar credenciales fuera de captura.

**Acciones**

- Presentar formulario vacío, autenticar y mostrar Mis rutas con usuario correcto.
- Comprobar ID/vínculo en Perfil; preparar error y reintento.
- Cerrar sesión al final y comprobar retorno a login.

**Estados, modales y alternativas**

- Inicial, carga, Authenticated/error y redirección del router.
- Cuenta sin vínculo/permiso o conectividad fallida no acredita acceso válido.
- Sesión expirada pasa por refresh/interceptor o retorna a login según resultado.

**Trazabilidad del flujo**

- LoginPage → AuthBloc → LoginUseCase → AuthRepositoryImpl → AuthRemoteDataSourceImpl.login → POST OIDC /token y GET /session/me.
- SessionController → OperationalAccess.driverId → DriverRepository → drivers; proveedor mantiene identidad/sesión, AuthLocalDataSource/LocalCache conservan contexto por cuenta.

**Evidencia nueva esperada: pendiente**

- Capturas nuevas esperadas: formulario sin secretos, error controlado, transición y conductor correcto. No mostrar tokens ni payloads; conservar prueba del destino autorizado y explicar que la consulta de sesión determina vínculo efectivo antes de operar.
- Conservar título, sesión e identificadores ficticios; añadir tomas inferiores cuando el contenido exceda la ventana. Si una negativa no puede prepararse, documentarla como esperada y no observada. La lectura del código no acredita ejecución actual ni éxito de una operación remota.

**Fuentes comprobadas: líneas uno basadas**

- [mobile-app/lib/features/auth/presentation/pages/login_page.dart:8](../../mobile-app/lib/features/auth/presentation/pages/login_page.dart#L8) · `class LoginPage`.
- [mobile-app/lib/features/auth/presentation/bloc/auth_bloc.dart:7](../../mobile-app/lib/features/auth/presentation/bloc/auth_bloc.dart#L7) · `class AuthBloc`.
- [mobile-app/lib/features/auth/domain/usecases/login_usecase.dart:6](../../mobile-app/lib/features/auth/domain/usecases/login_usecase.dart#L6) · `class LoginUseCase`.
- [mobile-app/lib/features/auth/data/repositories/auth_repository_impl.dart:12](../../mobile-app/lib/features/auth/data/repositories/auth_repository_impl.dart#L12) · `class AuthRepositoryImpl`.
- [mobile-app/lib/features/auth/data/datasources/auth_remote_data_source.dart:11](../../mobile-app/lib/features/auth/data/datasources/auth_remote_data_source.dart#L11) · `class AuthRemoteDataSourceImpl`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/SessionController.java:10](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/SessionController.java#L10) · `class SessionController`.
- [src/main/java/com/ecoroute/backend/infrastructure/security/OperationalAccess.java:20](../../src/main/java/com/ecoroute/backend/infrastructure/security/OperationalAccess.java#L20) · `class OperationalAccess`.
- [docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P08_negocio.bpmn:3](../../docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P08_negocio.bpmn#L3) · `<bpmn:process`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/SessionController.java:12](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/SessionController.java#L12) · `@GetMapping("/me")`.
- [mobile-app/lib/core/router/app_router.dart:36](../../mobile-app/lib/core/router/app_router.dart#L36) · `path: '/login'`.

Texto de pantalla: 222 palabras, sin contar referencias.

### M02 · Mis rutas y hoja de reparto

Ruta: `/routes`. Roles: Conductor de Grupo MICOTRANS SAC con rol DRIVER y cuenta vinculada a un conductor activo. El Dispatcher prepara y despacha; la Jefatura aprueba. El alumno explica esas responsabilidades sin atribuirlas al botón móvil.. Procesos: P02 Preparar la jornada de reparto, P03 Ejecutar entregas, P07 Supervisar la jornada.

Guía de exposición preparada el 26 de octubre de 2026 para el bloque del alumno 2, pantallas 03 y 04 de ocho pantallas distribuidas entre cuatro alumnos. Esta pantalla enlaza la planificación de MICOTRANS con el trabajo del Conductor: identifica su ruta y vehículo, consulta aprobación y aceptación, presenta paradas. Las validaciones de interfaz ayudan al operador; las reglas del servidor deciden si se acepta cada solicitud.

**Acciones**

- Seleccionar ruta propia PLANNED aprobada; revisar hoja/carga/vehículo y aceptar con confirmación servidor.
- Ceder a web para despacho; actualizar y comprobar ruta IN_PROGRESS y pedidos IN_TRANSIT.
- Mostrar mapa/listado, abrir siguiente parada y regresar desde detalle/perfil/historial/sync conservando selección.

**Estados, modales y alternativas**

- Sin rutas; selección; revisión/aceptación; PLANNED frente IN_PROGRESS; caché explícita; error/reintento; GPS/teselas sin disponibilidad.
- Aceptar no despacha: volver a web. Detalle operativo exige ruta/estado permitidos; regreso desde detalle/perfil/history/sync conserva contexto.

**Trazabilidad del flujo**

- RoutesPage → RouteBloc/GetDriverRoutes → RouteRepositoryImpl/RouteRemoteDataSourceImpl → GET /routes, GET /{id}/review, POST /{id}/acceptance.
- RouteController/BusinessWorkflowController → BusinessWorkflowService.accept → R2dbcBusinessWorkflowAdapter → route_dispatch_reviews.
- GpsBloc → GPS /ping → GpsController → GpsUseCasesImpl → R2dbcVehicleGpsHistoryRepository → vehicle_gps_history; GET /path devuelve propuesta.

**Evidencia nueva esperada: pendiente**

- Capturas NUEVAS pendientes: pantalla completa, formulario o detalle abierto, resultado persistido y alternativa relevante. Correlacionar ID, tracking, fecha, rol y vínculo con la siguiente pantalla.
- Comprobar respuesta del servidor y el mismo identificador al recargar antes de anunciar éxito; conservar contexto del siguiente paso de negocio.

**Fuentes comprobadas: líneas uno basadas**

- [mobile-app/lib/features/routes/presentation/pages/routes_page.dart:29](../../mobile-app/lib/features/routes/presentation/pages/routes_page.dart#L29) · `class RoutesPage`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/RouteController.java:25](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/RouteController.java#L25) · `class RouteController`.
- [src/main/java/com/ecoroute/backend/application/services/BusinessWorkflowService.java:14](../../src/main/java/com/ecoroute/backend/application/services/BusinessWorkflowService.java#L14) · `class BusinessWorkflowService`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessWorkflowAdapter.java:13](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessWorkflowAdapter.java#L13) · `class R2dbcBusinessWorkflowAdapter`.
- [mobile-app/lib/features/routes/presentation/bloc/route_bloc.dart:6](../../mobile-app/lib/features/routes/presentation/bloc/route_bloc.dart#L6) · `class RouteBloc`.
- [mobile-app/lib/features/routes/domain/usecases/get_driver_routes.dart:6](../../mobile-app/lib/features/routes/domain/usecases/get_driver_routes.dart#L6) · `class GetDriverRoutes`.
- [mobile-app/lib/features/routes/data/repositories/route_repository_impl.dart:8](../../mobile-app/lib/features/routes/data/repositories/route_repository_impl.dart#L8) · `class RouteRepositoryImpl`.
- [mobile-app/lib/features/routes/data/datasources/route_remote_data_source.dart:14](../../mobile-app/lib/features/routes/data/datasources/route_remote_data_source.dart#L14) · `class RouteRemoteDataSourceImpl`.
- [mobile-app/lib/features/gps/presentation/bloc/gps_bloc.dart:10](../../mobile-app/lib/features/gps/presentation/bloc/gps_bloc.dart#L10) · `class GpsBloc`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/BusinessWorkflowController.java:15](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/BusinessWorkflowController.java#L15) · `class BusinessWorkflowController`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/GpsController.java:21](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/GpsController.java#L21) · `class GpsController`.
- [src/main/java/com/ecoroute/backend/application/usecases/GpsUseCasesImpl.java:14](../../src/main/java/com/ecoroute/backend/application/usecases/GpsUseCasesImpl.java#L14) · `class GpsUseCasesImpl`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcVehicleGpsHistoryRepository.java:10](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcVehicleGpsHistoryRepository.java#L10) · `class R2dbcVehicleGpsHistoryRepository`.
- [docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P02_negocio.bpmn:3](../../docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P02_negocio.bpmn#L3) · `<bpmn:process`.
- [docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P03_negocio.bpmn:3](../../docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P03_negocio.bpmn#L3) · `<bpmn:process`.
- [docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P07_negocio.bpmn:3](../../docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P07_negocio.bpmn#L3) · `<bpmn:process`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/RouteController.java:35](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/RouteController.java#L35) · `@PostMapping`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/RouteController.java:52](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/RouteController.java#L52) · `@PatchMapping("/{id}/status")`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/RouteController.java:57](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/RouteController.java#L57) · `@GetMapping`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/RouteController.java:67](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/RouteController.java#L67) · `@DeleteMapping("/{id}")`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/RouteController.java:77](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/RouteController.java#L77) · `@GetMapping("/{id}/path")`.
- [src/main/java/com/ecoroute/backend/application/services/BusinessWorkflowService.java:23](../../src/main/java/com/ecoroute/backend/application/services/BusinessWorkflowService.java#L23) · `public Mono<Confirmation> confirm(Confirmation input) {`.
- [src/main/java/com/ecoroute/backend/application/services/BusinessWorkflowService.java:43](../../src/main/java/com/ecoroute/backend/application/services/BusinessWorkflowService.java#L43) · `public Mono<Review> approve(Long id,Double weight,String note,String actor) {`.
- [src/main/java/com/ecoroute/backend/application/services/BusinessWorkflowService.java:63](../../src/main/java/com/ecoroute/backend/application/services/BusinessWorkflowService.java#L63) · `public Mono<Review> accept(Long id,Long driverId,String actor) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessWorkflowAdapter.java:15](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessWorkflowAdapter.java#L15) · `public Mono<Confirmation> confirmation(Long id) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessWorkflowAdapter.java:22](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessWorkflowAdapter.java#L22) · `public Mono<Confirmation> saveConfirmation(Confirmation c) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessWorkflowAdapter.java:34](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessWorkflowAdapter.java#L34) · `public Mono<Review> review(Long id) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessWorkflowAdapter.java:40](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessWorkflowAdapter.java#L40) · `public Mono<Void> approve(Long id,Double weight,String actor,String note) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessWorkflowAdapter.java:47](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessWorkflowAdapter.java#L47) · `public Mono<Void> accept(Long id,String actor) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessWorkflowAdapter.java:51](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessWorkflowAdapter.java#L51) · `public Mono<Void> invalidate(Long id) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessWorkflowAdapter.java:55](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessWorkflowAdapter.java#L55) · `public Mono<Void> requireConfirmed(Long id) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessWorkflowAdapter.java:58](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessWorkflowAdapter.java#L58) · `public Mono<Void> requireDispatchReview(Long id) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessWorkflowAdapter.java:62](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcBusinessWorkflowAdapter.java#L62) · `public Mono<Void> audit(String process,String entity,Long id,String action,String actor,String details) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/BusinessWorkflowController.java:19](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/BusinessWorkflowController.java#L19) · `@GetMapping("/orders/{id}/business-data")`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/BusinessWorkflowController.java:23](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/BusinessWorkflowController.java#L23) · `@PatchMapping("/orders/{id}/business-data")`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/BusinessWorkflowController.java:29](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/BusinessWorkflowController.java#L29) · `@GetMapping("/routes/{id}/review")`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/BusinessWorkflowController.java:33](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/BusinessWorkflowController.java#L33) · `@PostMapping("/routes/{id}/review")`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/BusinessWorkflowController.java:38](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/BusinessWorkflowController.java#L38) · `@PostMapping("/routes/{id}/acceptance")`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/GpsController.java:29](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/GpsController.java#L29) · `@PostMapping("/ping")`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/GpsController.java:54](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/GpsController.java#L54) · `@GetMapping("/history/{vehicleId}")`.
- [src/main/java/com/ecoroute/backend/application/usecases/GpsUseCasesImpl.java:19](../../src/main/java/com/ecoroute/backend/application/usecases/GpsUseCasesImpl.java#L19) · `public Mono<VehicleGpsHistory> addGpsLocation(VehicleGpsHistory history) {`.
- [src/main/java/com/ecoroute/backend/application/usecases/GpsUseCasesImpl.java:24](../../src/main/java/com/ecoroute/backend/application/usecases/GpsUseCasesImpl.java#L24) · `public Flux<VehicleGpsHistory> getGpsHistory(Long vehicleId) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcVehicleGpsHistoryRepository.java:19](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcVehicleGpsHistoryRepository.java#L19) · `public Mono<VehicleGpsHistory> save(VehicleGpsHistory history) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcVehicleGpsHistoryRepository.java:26](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcVehicleGpsHistoryRepository.java#L26) · `public Flux<VehicleGpsHistory> findByVehicleIdOrderByPingTimeDesc(Long vehicleId) {`.
- [mobile-app/lib/core/router/app_router.dart:41](../../mobile-app/lib/core/router/app_router.dart#L41) · `path: '/routes'`.

Texto de pantalla: 213 palabras, sin contar referencias.

### M03 · Detalle de pedido y prueba de entrega POD

Ruta: `/orders/:id`. Roles: Conductor de Grupo MICOTRANS SAC. Captura el resultado de su parada y la evidencia declarada por el receptor; el backend controla propiedad del pedido y reglas de estado. El Dispatcher y la Jefatura atienden las decisiones posteriores de incidencias.. Procesos: P03 Ejecutar entregas, P04 Resolver incidencias.

Segunda pantalla del alumno Luis, número 04 de la guía de ocho pantallas. Redacción del 26 de octubre de 2026, con evidencia histórica del 22 de octubre en America/Lima. Explica cómo MICOTRANS conserva foto, firma, receptor y GPS antes del envío; cómo el servidor convierte una operación válida en DELIVERED;.

**Acciones**

- Abrir desde Mis rutas y avanzar estado permitido; histórico/terminal permanece en consulta.
- Capturar foto, receptor/DNI, firma y GPS actual; enviar POD y distinguir confirmado, pendiente o rechazado.
- Para no entrega registrar motivo suficiente y pasar incidencia a web; después consultar mismo POD desde Pedidos.

**Estados, modales y alternativas**

- Detalle operativo/consulta; cámara, firma, receptor/DNI, GPS actual y envío confirmado/pendiente/rechazado.
- Enlace sin extra OrderEntity/canOperate o ID discordante: recuperación a Mis rutas. No entrega exige motivo; pendiente local bloquea duplicación.

**Trazabilidad del flujo**

- OrderDetailPage → OrderBloc/UpdateOrderStatus → OrderRepositoryImpl/OrderRemoteDataSourceImpl → PATCH /orders/{id}/status → OrderController/OrderUseCasesImpl → orders/historial.
- POD → ProofSync.submit → LocalCache.enqueue → POST /delivery-proofs → DeliveryProofController → CreateDeliveryProofUseCaseImpl → R2dbcDeliveryProofRepository/S3/integridad/backup → delivery_proofs, estado e historial.

**Evidencia nueva esperada: pendiente**

- Capturas NUEVAS pendientes: pantalla completa, formulario o detalle abierto, resultado persistido y alternativa relevante. Correlacionar ID, tracking, fecha, rol y vínculo con la siguiente pantalla.
- Comprobar respuesta del servidor y el mismo identificador al recargar antes de anunciar éxito; conservar contexto del siguiente paso de negocio.

**Fuentes comprobadas: líneas uno basadas**

- [mobile-app/lib/features/orders/presentation/pages/order_detail_page.dart:16](../../mobile-app/lib/features/orders/presentation/pages/order_detail_page.dart#L16) · `class OrderDetailPage`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/DeliveryProofController.java:25](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/DeliveryProofController.java#L25) · `class DeliveryProofController`.
- [src/main/java/com/ecoroute/backend/application/usecases/CreateDeliveryProofUseCaseImpl.java:29](../../src/main/java/com/ecoroute/backend/application/usecases/CreateDeliveryProofUseCaseImpl.java#L29) · `class CreateDeliveryProofUseCaseImpl`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcDeliveryProofRepository.java:9](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcDeliveryProofRepository.java#L9) · `class R2dbcDeliveryProofRepository`.
- [mobile-app/lib/features/orders/presentation/bloc/order_bloc.dart:7](../../mobile-app/lib/features/orders/presentation/bloc/order_bloc.dart#L7) · `class OrderBloc`.
- [mobile-app/lib/features/orders/domain/usecases/update_order_status.dart:6](../../mobile-app/lib/features/orders/domain/usecases/update_order_status.dart#L6) · `class UpdateOrderStatus`.
- [mobile-app/lib/features/orders/data/repositories/order_repository_impl.dart:15](../../mobile-app/lib/features/orders/data/repositories/order_repository_impl.dart#L15) · `class OrderRepositoryImpl`.
- [mobile-app/lib/features/orders/data/datasources/order_remote_data_source.dart:10](../../mobile-app/lib/features/orders/data/datasources/order_remote_data_source.dart#L10) · `class OrderRemoteDataSourceImpl`.
- [mobile-app/lib/features/orders/presentation/widgets/signature_pad.dart:7](../../mobile-app/lib/features/orders/presentation/widgets/signature_pad.dart#L7) · `class SignaturePad`.
- [mobile-app/lib/core/sync/proof_sync.dart:10](../../mobile-app/lib/core/sync/proof_sync.dart#L10) · `class ProofSync`.
- [mobile-app/lib/core/cache/local_cache.dart:6](../../mobile-app/lib/core/cache/local_cache.dart#L6) · `class LocalCache`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/OrderController.java:20](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/OrderController.java#L20) · `class OrderController`.
- [src/main/java/com/ecoroute/backend/application/usecases/OrderUseCasesImpl.java:28](../../src/main/java/com/ecoroute/backend/application/usecases/OrderUseCasesImpl.java#L28) · `class OrderUseCasesImpl`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcProofIntegrityAdapter.java:10](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcProofIntegrityAdapter.java#L10) · `class R2dbcProofIntegrityAdapter`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcEvidenceBackupAdapter.java:9](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcEvidenceBackupAdapter.java#L9) · `class R2dbcEvidenceBackupAdapter`.
- [docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P03_negocio.bpmn:3](../../docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P03_negocio.bpmn#L3) · `<bpmn:process`.
- [docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P04_negocio.bpmn:3](../../docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P04_negocio.bpmn#L3) · `<bpmn:process`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/DeliveryProofController.java:34](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/DeliveryProofController.java#L34) · `@PostMapping`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/DeliveryProofController.java:50](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/DeliveryProofController.java#L50) · `@GetMapping("/{orderId}")`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/DeliveryProofController.java:56](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/DeliveryProofController.java#L56) · `@GetMapping("/{orderId}/photo")`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/DeliveryProofController.java:60](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/DeliveryProofController.java#L60) · `@GetMapping("/{orderId}/signature")`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/DeliveryProofController.java:69](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/DeliveryProofController.java#L69) · `@GetMapping("/{orderId}/pdf")`.
- [src/main/java/com/ecoroute/backend/application/usecases/CreateDeliveryProofUseCaseImpl.java:41](../../src/main/java/com/ecoroute/backend/application/usecases/CreateDeliveryProofUseCaseImpl.java#L41) · `public Mono<DeliveryProof> createDeliveryProof(DeliveryProof deliveryProof) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcDeliveryProofRepository.java:18](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcDeliveryProofRepository.java#L18) · `public Mono<DeliveryProof> save(DeliveryProof deliveryProof) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcDeliveryProofRepository.java:25](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcDeliveryProofRepository.java#L25) · `public Mono<DeliveryProof> findByOrderId(Long orderId) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/OrderController.java:33](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/OrderController.java#L33) · `@PostMapping`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/OrderController.java:39](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/OrderController.java#L39) · `@GetMapping("/{id}")`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/OrderController.java:44](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/OrderController.java#L44) · `@GetMapping`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/OrderController.java:53](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/OrderController.java#L53) · `@DeleteMapping("/{id}")`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/OrderController.java:58](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/OrderController.java#L58) · `@PatchMapping("/{id}/status")`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/OrderController.java:63](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/OrderController.java#L63) · `@PatchMapping("/{id}/route")`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/OrderController.java:68](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/OrderController.java#L68) · `@PatchMapping("/{id}/delivery-window")`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/OrderController.java:77](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/OrderController.java#L77) · `@PostMapping("/bulk-csv")`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/OrderController.java:81](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/OrderController.java#L81) · `@PostMapping("/bulk-csv/preview")`.
- [src/main/java/com/ecoroute/backend/application/usecases/OrderUseCasesImpl.java:51](../../src/main/java/com/ecoroute/backend/application/usecases/OrderUseCasesImpl.java#L51) · `public Mono<Order> createOrder(Order order) {`.
- [src/main/java/com/ecoroute/backend/application/usecases/OrderUseCasesImpl.java:74](../../src/main/java/com/ecoroute/backend/application/usecases/OrderUseCasesImpl.java#L74) · `public Mono<Order> assignOrder(Long orderId, Long routeId) {`.
- [src/main/java/com/ecoroute/backend/application/usecases/OrderUseCasesImpl.java:99](../../src/main/java/com/ecoroute/backend/application/usecases/OrderUseCasesImpl.java#L99) · `public Mono<Order> getOrderById(Long id) {`.
- [src/main/java/com/ecoroute/backend/application/usecases/OrderUseCasesImpl.java:105](../../src/main/java/com/ecoroute/backend/application/usecases/OrderUseCasesImpl.java#L105) · `public Mono<Order> changeDeliveryWindow(Long id,OffsetDateTime start,OffsetDateTime end,String reason,String actor) {`.
- [src/main/java/com/ecoroute/backend/application/usecases/OrderUseCasesImpl.java:128](../../src/main/java/com/ecoroute/backend/application/usecases/OrderUseCasesImpl.java#L128) · `public Flux<Order> getAllOrders() {`.
- [src/main/java/com/ecoroute/backend/application/usecases/OrderUseCasesImpl.java:134](../../src/main/java/com/ecoroute/backend/application/usecases/OrderUseCasesImpl.java#L134) · `public Mono<Order> updateStatusManual(Long id, OrderStatus status, String reason) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcProofIntegrityAdapter.java:12](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcProofIntegrityAdapter.java#L12) · `public Mono<Void> record(Long id,String photo,String signature,OffsetDateTime capturedAt) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcEvidenceBackupAdapter.java:11](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcEvidenceBackupAdapter.java#L11) · `public Mono<Void> store(String key,byte[] content,String mediaType) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcEvidenceBackupAdapter.java:15](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcEvidenceBackupAdapter.java#L15) · `public Mono<byte[]> read(String key) {`.
- [mobile-app/lib/core/router/app_router.dart:46](../../mobile-app/lib/core/router/app_router.dart#L46) · `path: '/orders/:id'`.

Texto de pantalla: 200 palabras, sin contar referencias.

### M04 · Historial de entregas

Ruta: `/history`. Roles: DRIVER autenticado; login público antes de sesión. Procesos: P03 Ejecutar entregas, P05 Evaluar resultados.

Consulta terminales propios con selector de período y actualización; no reabre fallos. La fuente obtiene rutas/pedidos autorizados, comprueba cuenta y filtra conductor y DELIVERED/FAILED/RETURNED. El intervalo usa fecha local del dispositivo; no afirmar equivalencia exacta con filtros Lima del backend sin revisar zona horaria. Comprueba continuidad del tracking y apoya P05, sin fórmulas BI ni POD completo. Respaldo local no convierte información histórica en entrega recién confirmada.

**Acciones**

- Abrir desde Mis rutas y cambiar período de últimos días.
- Identificar tracking, destinatario, dirección, fecha y estado del pedido demostrado.
- Actualizar/reintentar y regresar conservando contexto.

**Estados, modales y alternativas**

- Carga, error con Reintentar, vacío y terminales por período.
- Respaldo local cuando la fuente lo usa; identificar procedencia/cuenta.
- Sin alta, resolución de incidencia o transición propia de estado.

**Trazabilidad del flujo**

- HistoryPage → HistoryBloc → HistoryRepositoryImpl → HistoryRemoteDataSourceImpl.getDeliveryHistory → GET /routes y /orders.
- RouteController/OrderController → lectura y OperationalAccess → R2dbcRouteRepository/R2dbcOrderRepository → routes/orders.
- LocalCache conserva historial por propietario; fecha/estado se filtran en fuente móvil, sin nueva tabla history.

**Evidencia nueva esperada: pendiente**

- Capturas nuevas esperadas: selector, historial con tracking del flujo, vacío y error recuperable preparado. Mantener contexto temporal y no presentar datos antiguos como confirmación de una entrega nueva; comprobar la misma cuenta utilizada durante la jornada.
- Conservar título, sesión e identificadores ficticios; añadir tomas inferiores cuando el contenido exceda la ventana. Si una negativa no puede prepararse, documentarla como esperada y no observada. La lectura del código no acredita ejecución actual ni éxito de una operación remota.

**Fuentes comprobadas: líneas uno basadas**

- [mobile-app/lib/features/history/presentation/pages/history_page.dart:8](../../mobile-app/lib/features/history/presentation/pages/history_page.dart#L8) · `class HistoryPage`.
- [mobile-app/lib/features/history/presentation/bloc/history_bloc.dart:6](../../mobile-app/lib/features/history/presentation/bloc/history_bloc.dart#L6) · `class HistoryBloc`.
- [mobile-app/lib/features/history/data/repositories/history_repository_impl.dart:8](../../mobile-app/lib/features/history/data/repositories/history_repository_impl.dart#L8) · `class HistoryRepositoryImpl`.
- [mobile-app/lib/features/history/data/datasources/history_remote_data_source.dart:11](../../mobile-app/lib/features/history/data/datasources/history_remote_data_source.dart#L11) · `class HistoryRemoteDataSourceImpl`.
- [mobile-app/lib/core/cache/local_cache.dart:6](../../mobile-app/lib/core/cache/local_cache.dart#L6) · `class LocalCache`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/OrderController.java:20](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/OrderController.java#L20) · `class OrderController`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/RouteController.java:25](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/RouteController.java#L25) · `class RouteController`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcOrderRepository.java:10](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcOrderRepository.java#L10) · `class R2dbcOrderRepository`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcRouteRepository.java:12](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcRouteRepository.java#L12) · `class R2dbcRouteRepository`.
- [docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P03_negocio.bpmn:3](../../docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P03_negocio.bpmn#L3) · `<bpmn:process`.
- [docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P05_negocio.bpmn:3](../../docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P05_negocio.bpmn#L3) · `<bpmn:process`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/OrderController.java:33](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/OrderController.java#L33) · `@PostMapping`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/OrderController.java:39](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/OrderController.java#L39) · `@GetMapping("/{id}")`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/OrderController.java:44](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/OrderController.java#L44) · `@GetMapping`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/OrderController.java:53](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/OrderController.java#L53) · `@DeleteMapping("/{id}")`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/OrderController.java:58](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/OrderController.java#L58) · `@PatchMapping("/{id}/status")`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/OrderController.java:63](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/OrderController.java#L63) · `@PatchMapping("/{id}/route")`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/OrderController.java:68](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/OrderController.java#L68) · `@PatchMapping("/{id}/delivery-window")`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/OrderController.java:77](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/OrderController.java#L77) · `@PostMapping("/bulk-csv")`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/OrderController.java:81](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/OrderController.java#L81) · `@PostMapping("/bulk-csv/preview")`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/RouteController.java:35](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/RouteController.java#L35) · `@PostMapping`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/RouteController.java:52](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/RouteController.java#L52) · `@PatchMapping("/{id}/status")`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/RouteController.java:57](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/RouteController.java#L57) · `@GetMapping`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/RouteController.java:67](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/RouteController.java#L67) · `@DeleteMapping("/{id}")`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/RouteController.java:77](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/RouteController.java#L77) · `@GetMapping("/{id}/path")`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcOrderRepository.java:19](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcOrderRepository.java#L19) · `public Mono<Order> save(Order order) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcOrderRepository.java:26](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcOrderRepository.java#L26) · `public Flux<Order> findAll() {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcOrderRepository.java:32](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcOrderRepository.java#L32) · `public Mono<Order> findById(Long id) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcOrderRepository.java:38](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcOrderRepository.java#L38) · `public Mono<Order> lockById(Long id) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcOrderRepository.java:43](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcOrderRepository.java#L43) · `public Mono<Order> findByTrackingNumber(String trackingNumber) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcOrderRepository.java:49](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcOrderRepository.java#L49) · `public Flux<Order> findByRouteId(Long routeId) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcOrderRepository.java:55](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcOrderRepository.java#L55) · `public Mono<Void> deleteById(Long id) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcOrderRepository.java:60](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcOrderRepository.java#L60) · `public Mono<Integer> updateStopSequence(Long id, Integer sequence) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcRouteRepository.java:21](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcRouteRepository.java#L21) · `public Mono<Route> save(Route route) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcRouteRepository.java:28](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcRouteRepository.java#L28) · `public Mono<Route> findById(Long id) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcRouteRepository.java:34](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcRouteRepository.java#L34) · `public Mono<Route> lockById(Long id) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcRouteRepository.java:39](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcRouteRepository.java#L39) · `public Flux<Route> findByDriverIdAndDate(Long driverId, LocalDate date) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcRouteRepository.java:45](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcRouteRepository.java#L45) · `public Flux<Route> findAll() {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcRouteRepository.java:51](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcRouteRepository.java#L51) · `public Flux<Route> findByFilters(LocalDate date, com.ecoroute.backend.domain.model.RouteStatus status) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcRouteRepository.java:57](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcRouteRepository.java#L57) · `public Mono<Void> deleteById(Long id) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcRouteRepository.java:62](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcRouteRepository.java#L62) · `public Mono<Integer> updatePathInfo(Long id, String geometry, Double durationMin) {`.
- [mobile-app/lib/core/router/app_router.dart:74](../../mobile-app/lib/core/router/app_router.dart#L74) · `path: '/history'`.

Texto de pantalla: 233 palabras, sin contar referencias.

### M05 · Perfil del conductor

Ruta: `/profile`. Roles: DRIVER autenticado; login público antes de sesión. Procesos: P08 Administrar accesos, P06 Habilitar recursos de reparto, P03 Ejecutar entregas.

Reúne identidad y conductor: nombre, correo, roles, licencia y teléfono. Consulta con ID de sesión; muestra progreso y, ante fallo, conserva valores de identidad/campos no disponibles con mensaje. No edita licencia ni catálogo: corresponde a web P06. El tema pertenece a presentación local. Abre Sincronización y permite cerrar sesión; explica conservación de pendientes por cuenta y final de acceso P08. Ver ficha no habilita automáticamente una ruta.

**Acciones**

- Abrir y comparar ID/nombre con conductor de jornada web.
- Mostrar información ficticia/rol y alternar tema oscuro/claro.
- Abrir sync, volver y cerrar sesión; usar misma cuenta al recuperar pendientes.

**Estados, modales y alternativas**

- No autenticado, carga, detalle recuperado y error/campos no disponibles.
- Tema claro/oscuro, /sync y LogoutRequested hacia login.
- Sin alta ni modal de edición de licencia desde esta pantalla.

**Trazabilidad del flujo**

- ProfilePage._fetchDriverDetails → Dio inyectado → GET /drivers/{authState.user.id} → DriverController.getDriverById → DriverUseCasesImpl → R2dbcDriverRepository → drivers.
- AuthBloc aporta identidad; ThemeBloc gestiona tema. LogoutRequested → AuthRepositoryImpl/AuthRemoteDataSourceImpl → OIDC /logout y contexto local; tema no escribe maestros.

**Evidencia nueva esperada: pendiente**

- Capturas nuevas esperadas: ficha completa ficticia, tema alternativo, entrada sync y regreso a login. Conservar rol visible sin documentación personal ni secretos; comparar nombre con ruta asignada para justificar que se ejecuta el flujo del conductor correcto.
- Conservar título, sesión e identificadores ficticios; añadir tomas inferiores cuando el contenido exceda la ventana. Si una negativa no puede prepararse, documentarla como esperada y no observada. La lectura del código no acredita ejecución actual ni éxito de una operación remota.

**Fuentes comprobadas: líneas uno basadas**

- [mobile-app/lib/features/profile/presentation/pages/profile_page.dart:12](../../mobile-app/lib/features/profile/presentation/pages/profile_page.dart#L12) · `class ProfilePage`.
- [mobile-app/lib/features/profile/presentation/pages/profile_page.dart:30](../../mobile-app/lib/features/profile/presentation/pages/profile_page.dart#L30) · `Future<void> _fetchDriverDetails(`.
- [mobile-app/lib/core/theme/theme_bloc.dart:35](../../mobile-app/lib/core/theme/theme_bloc.dart#L35) · `class ThemeBloc`.
- [mobile-app/lib/features/auth/presentation/bloc/auth_bloc.dart:7](../../mobile-app/lib/features/auth/presentation/bloc/auth_bloc.dart#L7) · `class AuthBloc`.
- [mobile-app/lib/features/auth/data/datasources/auth_remote_data_source.dart:11](../../mobile-app/lib/features/auth/data/datasources/auth_remote_data_source.dart#L11) · `class AuthRemoteDataSourceImpl`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/DriverController.java:17](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/DriverController.java#L17) · `class DriverController`.
- [src/main/java/com/ecoroute/backend/application/usecases/DriverUseCasesImpl.java:14](../../src/main/java/com/ecoroute/backend/application/usecases/DriverUseCasesImpl.java#L14) · `class DriverUseCasesImpl`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcDriverRepository.java:10](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcDriverRepository.java#L10) · `class R2dbcDriverRepository`.
- [docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P08_negocio.bpmn:3](../../docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P08_negocio.bpmn#L3) · `<bpmn:process`.
- [docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P06_negocio.bpmn:3](../../docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P06_negocio.bpmn#L3) · `<bpmn:process`.
- [docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P03_negocio.bpmn:3](../../docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P03_negocio.bpmn#L3) · `<bpmn:process`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/DriverController.java:26](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/DriverController.java#L26) · `@PostMapping`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/DriverController.java:43](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/DriverController.java#L43) · `@GetMapping("/{id}")`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/DriverController.java:50](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/DriverController.java#L50) · `@GetMapping`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/DriverController.java:56](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/DriverController.java#L56) · `@PutMapping("/{id}")`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/DriverController.java:73](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/DriverController.java#L73) · `@DeleteMapping("/{id}")`.
- [src/main/java/com/ecoroute/backend/application/usecases/DriverUseCasesImpl.java:21](../../src/main/java/com/ecoroute/backend/application/usecases/DriverUseCasesImpl.java#L21) · `public Mono<Driver> createDriver(Driver driver) {`.
- [src/main/java/com/ecoroute/backend/application/usecases/DriverUseCasesImpl.java:26](../../src/main/java/com/ecoroute/backend/application/usecases/DriverUseCasesImpl.java#L26) · `public Mono<Driver> getDriverById(Long id) {`.
- [src/main/java/com/ecoroute/backend/application/usecases/DriverUseCasesImpl.java:32](../../src/main/java/com/ecoroute/backend/application/usecases/DriverUseCasesImpl.java#L32) · `public Flux<Driver> getAllDrivers() {`.
- [src/main/java/com/ecoroute/backend/application/usecases/DriverUseCasesImpl.java:37](../../src/main/java/com/ecoroute/backend/application/usecases/DriverUseCasesImpl.java#L37) · `public Mono<Driver> updateDriver(Long id, Driver driver) {`.
- [src/main/java/com/ecoroute/backend/application/usecases/DriverUseCasesImpl.java:58](../../src/main/java/com/ecoroute/backend/application/usecases/DriverUseCasesImpl.java#L58) · `public Mono<Void> deleteDriver(Long id) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcDriverRepository.java:19](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcDriverRepository.java#L19) · `public Mono<Driver> save(Driver driver) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcDriverRepository.java:26](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcDriverRepository.java#L26) · `public Flux<Driver> findAll() {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcDriverRepository.java:32](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcDriverRepository.java#L32) · `public Mono<Driver> findById(Long id) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcDriverRepository.java:38](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcDriverRepository.java#L38) · `public Mono<Void> deleteById(Long id) {`.
- [mobile-app/lib/core/router/app_router.dart:79](../../mobile-app/lib/core/router/app_router.dart#L79) · `path: '/profile'`.

Texto de pantalla: 234 palabras, sin contar referencias.

### M06 · Sincronización de evidencias

Ruta: `/sync`. Roles: DRIVER autenticado; login público antes de sesión. Procesos: P03 Ejecutar entregas, P04 Resolver incidencias.

Distingue captura local de entrega remota. Presenta pendientes/rechazadas, error y reintento; las confirmadas salen de la cola. ProofSync escribe durable antes de HTTP y evita vuelos simultáneos por propietario. Envía Idempotency-Key con orderId y retira cola tras éxito. Errores 4xx de negocio quedan bloqueados salvo sesión/timeout/límite; reintento explícito incluye rechazados. Cambiar cuenta no debe enviar ni mostrar cola ajena. La clave no reemplaza integridad del servidor; observaciones pueden escalar a P04.

**Acciones**

- Abrir desde Perfil/Mis rutas y presentar cola vacía tras confirmación.
- Caso preparado sin conexión: guardar POD pendiente, recuperar red y reintentar.
- Mostrar último error/rechazo y correlacionar orderId con POD web confirmado.

**Estados, modales y alternativas**

- Vacía, pendientes, sincronizando, rechazadas bloqueadas y fallo de procesamiento.
- Cambio de cuenta detiene drenado ajeno; reanudación/reintento manual.
- No crea otro pedido ni sustituye resolver incidencias de negocio.

**Trazabilidad del flujo**

- SyncPage → ProofSync.reload/sync/_drain → LocalCache.pending/enqueue/remove/mutate → almacenamiento local por cuenta.
- Dio POST /delivery-proofs → DeliveryProofController → CreateDeliveryProofUseCaseImpl → R2dbcDeliveryProofRepository/integridad/S3/backup → delivery_proofs y estado/historial.
- Éxito retira cola; rechazo conserva evidencia/error. Confirmación depende del servidor, no del botón.

**Evidencia nueva esperada: pendiente**

- Capturas nuevas esperadas: vacía, pendiente, rechazo y confirmación tras reintento con mismo orderId. Son casos pendientes de la tarea principal; no afirmar prueba offline ejecutada en esta subtarea.
- Conservar título, sesión e identificadores ficticios; añadir tomas inferiores cuando el contenido exceda la ventana. Si una negativa no puede prepararse, documentarla como esperada y no observada. La lectura del código no acredita ejecución actual ni éxito de una operación remota.

**Fuentes comprobadas: líneas uno basadas**

- [mobile-app/lib/core/sync/sync_page.dart:5](../../mobile-app/lib/core/sync/sync_page.dart#L5) · `class SyncPage`.
- [mobile-app/lib/core/sync/proof_sync.dart:56](../../mobile-app/lib/core/sync/proof_sync.dart#L56) · `Future<SubmissionResult> submit(`.
- [mobile-app/lib/core/sync/proof_sync.dart:70](../../mobile-app/lib/core/sync/proof_sync.dart#L70) · `Future<void> sync(`.
- [mobile-app/lib/core/sync/proof_sync.dart:88](../../mobile-app/lib/core/sync/proof_sync.dart#L88) · `Future<void> _drain(`.
- [mobile-app/lib/core/cache/local_cache.dart:6](../../mobile-app/lib/core/cache/local_cache.dart#L6) · `class LocalCache`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/DeliveryProofController.java:25](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/DeliveryProofController.java#L25) · `class DeliveryProofController`.
- [src/main/java/com/ecoroute/backend/application/usecases/CreateDeliveryProofUseCaseImpl.java:29](../../src/main/java/com/ecoroute/backend/application/usecases/CreateDeliveryProofUseCaseImpl.java#L29) · `class CreateDeliveryProofUseCaseImpl`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcDeliveryProofRepository.java:9](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcDeliveryProofRepository.java#L9) · `class R2dbcDeliveryProofRepository`.
- [docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P03_negocio.bpmn:3](../../docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P03_negocio.bpmn#L3) · `<bpmn:process`.
- [docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P04_negocio.bpmn:3](../../docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P04_negocio.bpmn#L3) · `<bpmn:process`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/DeliveryProofController.java:34](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/DeliveryProofController.java#L34) · `@PostMapping`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/DeliveryProofController.java:50](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/DeliveryProofController.java#L50) · `@GetMapping("/{orderId}")`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/DeliveryProofController.java:56](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/DeliveryProofController.java#L56) · `@GetMapping("/{orderId}/photo")`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/DeliveryProofController.java:60](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/DeliveryProofController.java#L60) · `@GetMapping("/{orderId}/signature")`.
- [src/main/java/com/ecoroute/backend/infrastructure/input/rest/DeliveryProofController.java:69](../../src/main/java/com/ecoroute/backend/infrastructure/input/rest/DeliveryProofController.java#L69) · `@GetMapping("/{orderId}/pdf")`.
- [src/main/java/com/ecoroute/backend/application/usecases/CreateDeliveryProofUseCaseImpl.java:41](../../src/main/java/com/ecoroute/backend/application/usecases/CreateDeliveryProofUseCaseImpl.java#L41) · `public Mono<DeliveryProof> createDeliveryProof(DeliveryProof deliveryProof) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcDeliveryProofRepository.java:18](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcDeliveryProofRepository.java#L18) · `public Mono<DeliveryProof> save(DeliveryProof deliveryProof) {`.
- [src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcDeliveryProofRepository.java:25](../../src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcDeliveryProofRepository.java#L25) · `public Mono<DeliveryProof> findByOrderId(Long orderId) {`.
- [mobile-app/lib/core/router/app_router.dart:34](../../mobile-app/lib/core/router/app_router.dart#L34) · `path: '/sync'`.

Texto de pantalla: 234 palabras, sin contar referencias.

## Flujo compartido y criterios de evidencia

### S00 · Alcance y evidencia

- Inventario estático del cwd compartido: no se ejecutaron app, pruebas, Docker, ADB, IDE ni capturas. expectedEvidence está pendiente.
- Main ejecuta visiblemente en IDE, toma capturas NUEVAS completas y hace documento. Evidencia antigua no es prueba actual. Ocho principales conservadas; once auxiliares completan guía.
- Líneas uno basadas comprobadas en lectura actual; revalidar ante modificaciones concurrentes.


### S01 · BPMN vigente

- P01 Confirmar pedidos · `docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P01_negocio.bpmn:5`.
- P02 Preparar la jornada de reparto · `docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P02_negocio.bpmn:3`.
- P03 Ejecutar entregas · `docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P03_negocio.bpmn:3`.
- P04 Resolver incidencias · `docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P04_negocio.bpmn:3`.
- P05 Evaluar resultados · `docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P05_negocio.bpmn:3`.
- P06 Habilitar recursos de reparto · `docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P06_negocio.bpmn:3`.
- P07 Supervisar la jornada · `docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P07_negocio.bpmn:3`.
- P08 Administrar accesos · `docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P08_negocio.bpmn:3`.
- P09 Registrar compras operativas · `docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P09_negocio.bpmn:3`.

- P01–P09 son negocio isExecutable=false. Tareas humanas no implican automatización o endpoint. Mapeos incluyen soporte y enlaces de entrada/salida.


### S02 · Flujo feliz y traspasos

- P08 W10/W01/M01 habilitan sesión/vínculo; P06 W08/W09 recursos. P09 W11 solo ante necesidad, previa autorización humana.
- Enzo P01 W03: PENDING sin ruta y comercial confirmada. Preservar orderId/tracking. P02 W04: PLANNED, asignación ASSIGNED y revisión ADMIN.
- Luis M02 acepta hoja aprobada; Enzo W04 despacha IN_PROGRESS/pedidos IN_TRANSIT. Aceptar no despacha.
- Luis P03 M02/M03 foto/firma/receptor/GPS; M06 si pendiente. Servidor confirma POD. W03 consulta metadata/foto/firma/PDF; M04 historial.
- P07 W04/M02 seguimiento/actualidad GPS; paradas terminales permiten cierre sin implicar éxito total.
- Adrian P05 W07/W12/W13 mismo conductor/rango, calidad/metas; Renzo W06 causa/acción/responsable/plazo/medición y ADMIN verifica. Gasto enlaza P09/P06.


### S03 · Alternativas end to end

- P01 datos/dirección/cobertura incompletos: corregir/desistir. No inventar CONFIRMED; CSV inválido no se importa parcialmente.
- P02 recursos/carga/revisión/aceptación insuficientes: no despachar; composición nueva invalida autorizaciones.
- P03 ausencia/rechazo/impedimento: motivo y terminal permitido → P04 W05. Cola local no confirma remoto; recuperar M06.
- P04 RETRY nuevo intento misma ruta activa → P03; REPLAN nuevo intento otra PLANNED y comercial renovada → P02. CLOSE_FAILED/CLOSE_CASE solo ADMIN; original permanece.
- P05 datos dudosos: corregir/cierre provisional; sin denominador/meta no inventar cumplimiento. Acción inefectiva: revisar hipótesis.
- P06 recurso no apto/disponible: bloquear/esperar; P07 pérdida señal: contacto/escalamiento P04 humanos.
- P08 rechazo/revocación: denegar/revocar sesiones. P09 existencia utilizable: sin compra; gasto rechazado/recepción observada: ajustar/cancelar/reclamar humanamente.


### S04 · Notificaciones y navegación compartidas

- Campana ADMIN/DISPATCHER: conteo/lista no leída, abrir/marcar leída. Estados cerrado/abierto, carga, vacío, error/reintento.
- NotificationPanel → useQuery/notificationService → GET /notifications/unread/count y /unread, PATCH /{id}/read → NotificationController → NotificationRepository/R2dbcNotificationRepository → notifications.
- Sidebar expandido/colapsado, overlay móvil, foco/Escape/logout. Web wildcard → Inicio; móvil sin sesión → login; detalle extra inválido → recuperación Mis rutas.

- Fuente: `web-admin/src/components/NotificationPanel.tsx:15` · `const NotificationPanel`.
- Fuente: `src/main/java/com/ecoroute/backend/infrastructure/input/rest/NotificationController.java:16` · `class NotificationController`.
- Fuente: `src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcNotificationRepository.java:10` · `class R2dbcNotificationRepository`.
- Fuente: `web-admin/src/components/Sidebar.tsx:29` · `const Sidebar`.
- Fuente: `mobile-app/lib/core/router/app_router.dart:14` · `GoRouter createAppRouter`.
- Evidencia pendiente: Nuevas tomas del panel, conteo antes/después, menú estrecho y recuperación de enlaces; pendientes.

### S05 · Convenciones IDE y evidencia

- Web usa /api; backend declara sin prefijo. Flutter API_BASE_URL y proveedor OIDC aparte; no copiar credenciales.
- sources indica archivo relativo, ancla literal y línea uno basada: abrir IDE y seguir UI → hook/servicio → endpoint → controller/caso → persistencia.
- Capturas completas: título, controles y columnas; añadir tomas inferiores al desplazarse. Modales abiertos y resultado posterior.
- Correlacionar fecha/hora, rol, driverId/routeId/orderId/tracking ficticios. Caso no ejecutado = esperado/no observado; no reutilizar capturas antiguas como nuevas.
- Antecedentes resumidos tools/exposicion_8_pantallas/alumno1.json a alumno4.json y docs/exposicion_8_pantallas; no son prueba actual.


