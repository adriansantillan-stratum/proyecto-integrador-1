#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Build the NEW total guide from the inventory and the main agent's manifest.

This module has no import-time side effects. It never starts apps, uses COM,
installs packages, makes screenshots, invokes the artifact marker or renders.
Main must run the document skill's marker exactly once immediately before
authoring, then run this script with the bundled Python that has python-docx.
Main owns render_docx.py, visual QA of every page and final delivery.

    <bundled-python> tools/guia_total_ide/build_full_guide.py --validate-only
    <marker exactly once, owned by main>
    <bundled-python> tools/guia_total_ide/build_full_guide.py

Only the two fixed new output paths below can be written. PNG/JPEG bytes are passed
unchanged to python-docx; the script reads image header metadata, never rasterizes,
crops, resizes, repaints or substitutes an image. Physical display dimensions
preserve aspect ratio. It fails closed on missing inputs before authoring.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import re
import struct
import sys
import unicodedata
import zipfile
from collections import OrderedDict
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
INVENTORY = Path("tools/guia_total_ide/inventario_pantallas.json")
MANIFEST = Path("docs/guia_total_ide/ejecucion_20261026/manifest.json")
OUTPUT = Path("docs/guia_total_ide/EcoRoute_Guia_Total_Recorrido_y_IDE.docx")
EXPECTED_IDS = tuple([f"W{i:02d}" for i in range(1, 14)] + [f"M{i:02d}" for i in range(1, 7)])
ASSIGNMENT = OrderedDict(Enzo=("W03", "W04"), Luis=("M02", "M03"),
                         Renzo=("W05", "W06"), Adrian=("W07", "W13"))
OWNER = {sid: name for name, ids in ASSIGNMENT.items() for sid in ids}
WALK = ("W01", "W02", "W10", "W08", "W09", "W11", "W03", "W04",
        "M01", "M02", "M03", "M06", "M04", "M05", "W05", "W07", "W12", "W13", "W06")
STATUSES = {"PASS", "FAIL", "PLANNED", "PENDING", "SKIP", "SKIPPED", "BLOCKED",
            "NOT_RUN", "NOT_TESTED", "WARN", "WARNING", "ERROR"}
WORKSPACES = ("EcoRoute_Backend_IDE.code-workspace", "EcoRoute_Web_IDE.code-workspace",
              "EcoRoute_Flutter_IDE.code-workspace")
PREP_SOURCES = (*WORKSPACES, "tools/guia_total_ide/Start-EcoRouteIDE.ps1",
                "tools/guia_total_ide/debug_backend.init.gradle",
                "tools/guia_total_ide/prepare_mobile_copy.mjs",
                "tools/guia_total_ide/Prepare-FlutterDebugger.ps1", "docker-compose.yml",
                "docker-compose.ide.yml", "src/main/resources/application-ide.yml",
                "src/main/java/com/ecoroute/backend/EcorouteBackendApplication.java",
                "web-admin/vite.config.ts", "web-admin/src/pages/Login.tsx")
INTRO = ("EcoRoute acompaña la jornada de reparto de Grupo MICOTRANS desde la solicitud "
         "del cliente hasta la revisión de resultados. Esta guía permite exponer el negocio, "
         "demostrar las 13 pantallas web y las 6 móviles y seguir cada acción hasta el código "
         "y la persistencia. Conservar el mismo pedido, ruta y conductor permite comprobar "
         "el traspaso entre planificación, ejecución, incidencias y análisis.")
SPEECH = {
    "W03": "Recibimos la solicitud y registramos un pedido identificable sin ruta. La aceptación, la dirección y la cobertura forman la revisión comercial; no existe un estado CONFIRMED. El alta y la revisión son dos peticiones: si falla la segunda, conservamos el ID. Ese mismo pedido pasa a planificación y vuelve aquí para consultar su POD.",
    "W04": "Preparamos una ruta PLANNED con conductor, vehículo y pedidos revisados. La aprobación administrativa y la aceptación del conductor son controles distintos. Aceptar en el móvil no despacha. Después del despacho comprobamos IN_PROGRESS en la ruta e IN_TRANSIT en los pedidos; una modificación de la composición puede exigir renovar autorizaciones.",
    "M02": "Consulto la hoja del conductor autenticado, reviso los recursos y acepto la jornada aprobada. Enzo realiza el despacho web y después actualizo Mis rutas. El mapa ayuda a orientarse; una propuesta de trazado no acredita recorrido GPS. Abro una parada autorizada y mantengo el identificador para explicar la entrega.",
    "M03": "Registro foto, receptor, firma y GPS de la parada. Guardar evidencia local permite recuperarla, pero la entrega remota se confirma únicamente cuando el servidor acepta el POD. Si queda pendiente, lo reviso en Sincronización. Si no puedo entregar, declaro el motivo y paso la excepción a Incidencias sin convertirla en una entrega exitosa.",
    "W05": "Una excepción conserva su pedido original y su motivo. RETRY crea otro intento en la jornada activa; REPLAN dirige un nuevo intento a otra ruta PLANNED y renueva la revisión comercial. El cierre requiere la decisión y el permiso correspondientes. Resolver una incidencia no borra ni reabre el resultado terminal anterior.",
    "W06": "Convertimos una desviación revisada en una acción con causa, responsable, plazo e indicador. Registramos seguimiento y un resultado observado; la verificación corresponde al administrador. La base y la meta declaradas pertenecen a esta acción. VERIFIED documenta una verificación autorizada y no demuestra por sí solo que la acción causó una mejora empresarial.",
    "W07": "Leo los estados, la puntualidad evaluable, las entregas por conductor y los pedidos por distrito con el mismo rango. Cada fuente puede cargar o fallar por separado. Identifico la población antes de interpretar porcentajes. Un cierre con paradas terminales no significa que todas fueron entregadas; mantengo los filtros al pasar a Reportes y BI.",
    "W13": "BI pertenece a EcoRoute y calcula indicadores con poblaciones diferentes. Un denominador ausente produce NO_DATA y una meta ausente produce NO_TARGET. Reviso tendencias, causas registradas, calidad y eficiencia sin convertir GPS no evaluable en cero. La meta vigente orienta la comparación; Acciones P05 permite asignar responsable y seguimiento a lo que la jefatura decide revisar.",
}


# Short, contiguous excerpts are read again from the real sources at build time.
# Schema: file, literal first-line anchor, line count, relative line explanations,
# and the input/output/failure contract. No pasted or reconstructed source code.
# Two excerpts per screen stay below the requested maximum of three.
CODE_WALKS = {
    "W01": [
        ("web-admin/src/pages/Login.tsx", "const code = searchParams.get('code');", 5,
         ((0, "Lee el código de retorno del proveedor."), (1, "El guard impide un segundo canje en este montaje."),
          (3, "Inicia el intercambio asíncrono; todavía debe completarse la identidad efectiva.")),
         "Entrada: retorno OIDC. Salida: sesión de cliente o error recuperable. El canje no sustituye GET /session/me ni los permisos del servidor."),
        ("src/main/java/com/ecoroute/backend/infrastructure/input/rest/SessionController.java", "public Mono<Map<String,Object>> me()", 5,
         ((1, "Obtiene la autenticación y comprueba si administra la operación."),
          (2, "Para el gestor devuelve subject y authorities."), (3, "Para el conductor incorpora el driverId autorizado.")),
         "GET /session/me devuelve una identidad efectiva reactiva. Los roles de pantalla proceden de esta respuesta; iniciar sesión no crea pedidos."),
        ("web-admin/src/context/verifiedSession.ts", "const sameSubject = previous.subject === subject;", 5,
         ((0, "Compara el subject actual con el de la última identidad validada."),
          (1, "Un error o una identidad de otro subject invalida la retención."),
          (3, "Durante carga conserva únicamente la identidad ya autorizada del mismo usuario."),
          (4, "La respuesta nueva reemplaza la identidad retenida y sus roles.")),
         "AuthProvider sigue consultando /session/me por cada JWT. Solo evita desmontar la vista durante esa recarga si el subject coincide; cambiar de usuario, cerrar sesión o recibir un error obliga a validar de nuevo. No toma permisos de los roles del JWT."),
    ],
    "W02": [
        ("web-admin/src/pages/Home.tsx", "const hasRole = (roles: string[]) =>", 3,
         ((1, "Compara los roles solicitados con los roles del usuario para mostrar accesos."),),
         "Entrada: identidad del contexto. Salida: visibilidad de una tarjeta. Es navegación local; no hay escritura SQL ni autorización definitiva aquí."),
        ("web-admin/src/components/ProtectedRoute.tsx", "if (!isAuthenticated)", 5,
         ((0, "Comprueba si existe autenticación de cliente."), (1, "Devuelve al login cuando falta sesión."),
          (4, "La identidad pendiente o fallida muestra carga, error y reintento.")),
         "La ruta protegida espera la identidad efectiva y después evalúa roles. La comprobación REST sigue perteneciendo al backend aunque se oculte el acceso."),
    ],
    "W03": [
        ("web-admin/src/pages/Orders.tsx", "const order = created ?? await createOrder", 4,
         ((0, "Reutiliza el pedido ya creado o envía el alta con routeId nulo."),
          (1, "Conserva el ID en memoria del formulario."), (2, "Guarda la revisión comercial en otra petición."),
          (3, "Si esa revisión falla, informa que el pedido existe y permite reintentar.")),
         "Entrada: borrador validado. Salida: pedido y revisión comercial. No hay una transacción única entre ambos HTTP ni idempotencia global por conservar created."),
        ("src/main/java/com/ecoroute/backend/application/usecases/OrderUseCasesImpl.java", "public Mono<Order> createOrder(Order order)", 3,
         ((1, "Rechaza un alta que ya traiga ruta."), (2, "Tras esa guarda, un alta válida solo puede nacer PENDING.")),
         "El caso de uso impone la regla aunque el cliente mande otros datos. OrderRepository persiste el dominio y el flujo registra historial; la asignación ocurre después."),
    ],
    "W04": [
        ("web-admin/src/pages/Routes.tsx", "async function dispatch()", 5,
         ((1, "El cliente exige revisión aprobada y aceptación recibida."), (2, "Bloquea la interacción mientras solicita el cambio."),
          (3, "Pide IN_PROGRESS y refresca al recibir éxito."), (4, "Un rechazo conserva un mensaje y vuelve a consultar revisión.")),
         "Entrada: ruta seleccionada y revisión. Salida: respuesta al cambio de estado; el servidor revalida recursos y autorizaciones antes de persistir el despacho."),
        ("src/main/java/com/ecoroute/backend/application/services/BusinessWorkflowService.java", "public Mono<Review> accept(Long id,Long driverId,String actor)", 6,
         ((1, "Carga la ruta dentro del contrato de planificación."), (2, "Rechaza la hoja de otro conductor."),
          (4, "Exige aprobación previa de jefatura."), (5, "Registra aceptación y auditoría mediante el puerto workflow.")),
         "Aceptar registra el control del conductor y devuelve la revisión. Este método no despacha; el cambio operativo posterior corresponde al caso de rutas."),
    ],
    "W05": [
        ("web-admin/src/pages/Incidents.tsx", "const failed = !!order", 4,
         ((0, "Distingue pedidos fallidos o devueltos."), (1, "Comprueba si la jornada original sigue activa."),
          (2, "Elige una propuesta de decisión según esas condiciones; el usuario y el servidor aún deben validarla.")),
         "El formulario propone RETRY o REPLAN y recoge justificación. Sus opciones no conceden permiso para cerrar un caso ni alteran el pedido original."),
        ("src/main/java/com/ecoroute/backend/application/services/BusinessOperationsService.java", "public Mono<Incident> resolve(Long id", 6,
         ((1, "Exige un motivo mínimo."), (2, "Limita las decisiones al contrato admitido."),
          (4, "Los cierres definitivos requieren manager."), (5, "Rechaza la operación sin ese permiso.")),
         "Entrada: incidencia, decisión, motivo, destino y actor. Los controles posteriores comprueban estado y ruta; un nuevo intento conserva la relación con el original."),
    ],
    "W06": [
        ("web-admin/src/components/ImprovementActions.tsx", "if (status === 'VERIFIED'", 3,
         ((0, "El cliente exige ADMIN y resultado para verificar."), (1, "Activa busy y limpia el mensaje anterior."),
          (2, "Envía estado, nota y resultado del mismo ID; refresca solo tras éxito.")),
         "El formulario declara una medición y una decisión. La meta de la acción no modifica automáticamente los KPI operativos ni acredita causalidad."),
        ("src/main/java/com/ecoroute/backend/application/services/BusinessOperationsService.java", "public Mono<Improvement> updateAction(Long id", 7,
         ((1, "Valida nota y número en el servidor."), (2, "Restringe el conjunto de estados."),
          (4, "Verificar o descartar exige permiso de jefatura."), (6, "VERIFIED necesita resultado medido.")),
         "Entrada: ID, estado, resultado, nota y actor. El puerto de operaciones conserva el cambio y su auditoría; los estados cerrados tienen controles adicionales."),
    ],
    "W07": [
        ("web-admin/src/pages/Dashboard.tsx", "const valid = !filters.startDate", 6,
         ((0, "Valida el orden de fechas."), (1, "Construye una consulta común."),
          (2, "La primera fuente recibe URL o null; null evita consultar."), (5, "La cuarta fuente conserva los mismos filtros.")),
         "Cuatro respuestas independientes alimentan estados, puntualidad, conductor y distrito. La presencia de una gráfica no confirma éxito de las otras fuentes."),
        ("src/main/java/com/ecoroute/backend/infrastructure/input/rest/DashboardController.java", '@GetMapping("/orders-by-status")', 4,
         ((0, "Declara la ruta relativa a /dashboard."), (1, "Recibe AnalyticsFilter desde parámetros."),
          (2, "Delega al servicio y devuelve Flux de conteos por estado.")),
         "GET /dashboard/orders-by-status es una lectura filtrada. DashboardService y AnalyticsQueryPort obtienen agregados; este endpoint no cambia pedidos."),
    ],
    "W08": [
        ("web-admin/src/pages/Drivers.tsx", "if (editingId) await updateDriver", 5,
         ((0, "Un ID de edición selecciona actualización."), (1, "Sin ID solicita creación."),
          (2, "Cierra el modal tras éxito."), (3, "Recarga el catálogo; el error se presenta en catch.")),
         "Entrada: datos declarados del conductor. Salida: listado actualizado. isActive es actividad registrada, no certificación física ni disponibilidad en otra ruta."),
        ("src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcDriverRepository.java", "public Mono<Driver> save(Driver driver)", 5,
         ((1, "Mapea el modelo de dominio a DriverEntity."), (2, "Spring Data realiza la persistencia reactiva."),
          (3, "Convierte la entidad resultante al contrato de dominio.")),
         "DriverRepository separa el caso de uso del SQL. La entidad corresponde a drivers; guardar el catálogo no vincula por sí solo una cuenta DRIVER."),
    ],
    "W09": [
        ("web-admin/src/pages/Vehicles.tsx", "if (editingId) await updateVehicle", 5,
         ((0, "Con ID se actualiza el mismo vehículo."), (1, "Sin ID se crea."),
          (2, "Cierra el modal tras la respuesta."), (3, "Vuelve a consultar los vehículos.")),
         "Entrada: placa, descripción, capacidades y actividad. Una respuesta de catálogo no significa que el vehículo esté disponible o aprobado para la jornada."),
        ("src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcVehicleRepository.java", "public Mono<Vehicle> save(Vehicle vehicle)", 5,
         ((1, "Transforma Vehicle en entidad."), (2, "Delega la escritura a Spring Data."),
          (3, "Mapea el resultado nuevamente a Vehicle.")),
         "VehicleRepository representa el puerto; vehicles conserva el recurso. El despacho comprueba por separado sus reglas de uso y carga."),
    ],
    "W10": [
        ("web-admin/src/pages/Users.tsx", "event.preventDefault(); if (!roles.length)", 5,
         ((0, "Exige al menos un rol antes de enviar."), (2, "Incluye driverId cuando corresponde al rol DRIVER."),
          (3, "Un rechazo del servidor queda visible.")),
         "Entrada: identidad existente, roles y vínculo. No es alta de cuentas; la sesión afectada debe renovarse para comprobar los permisos efectivos."),
        ("src/main/java/com/ecoroute/backend/infrastructure/input/rest/IdentityController.java", '@PutMapping("/{id}/roles")', 3,
         ((0, "El contrato usa el ID de identidad en la ruta y RolesRequest en el cuerpo."),
          (1, "Obtiene el actor autenticado y delega roles y driverId a KeycloakAdministration.")),
         "PUT /users/identities/{id}/roles opera sobre el proveedor de identidad. El actor no se acepta ciegamente de un campo del formulario."),
    ],
    "W11": [
        ("web-admin/src/pages/Purchases.tsx", "await createPurchase({", 5,
         ((1, "Toma los datos declarados del formulario."), (2, "Convierte el importe de texto a número."),
          (4, "Cierra el modal después de que createPurchase responde.")),
         "Entrada: compra declarada. Salida: registro persistido o error. Un estado del CRUD no prueba pago, autorización presupuestal ni recepción física."),
        ("src/main/java/com/ecoroute/backend/infrastructure/input/rest/PurchaseController.java", "public Mono<Purchase> createPurchase(", 5,
         ((0, "Valida el cuerpo PurchaseRequest recibido por POST /purchases."), (1, "Construye el modelo Purchase con ID nuevo."),
          (3, "Conserva descripción y proveedor del contrato.")),
         "El controlador adapta transporte a dominio; PurchaseUseCasesImpl y PurchaseRepository continúan hasta purchases. La respuesta reactiva no crea un vehículo automáticamente."),
    ],
    "W12": [
        ("web-admin/src/pages/Reports.tsx", "const summary = useQuery", 3,
         ((0, "Solicita resumen si las fechas son válidas."), (1, "Solicita rendimiento como fuente separada."),
          (2, "Solicita eficiencia con el mismo filtro, sin mezclar sus errores.")),
         "Entrada: conductor y rango. Salida: tres lecturas independientes. Una distancia GPS no evaluable debe conservar su ausencia y no convertirse en cero."),
        ("src/main/java/com/ecoroute/backend/infrastructure/input/rest/ReportController.java", '@GetMapping("/orders-summary")', 4,
         ((0, "Declara GET relativo a /reports."), (1, "Recibe AnalyticsFilter."),
          (2, "DashboardService devuelve Mono de resumen a partir del puerto analítico.")),
         "La consulta resume la población filtrada, sin aprobar informes ni editar estados. Para comparar con Dashboard y BI hay que conservar conductor, fechas y denominadores."),
    ],
    "W13": [
        ("web-admin/src/pages/BusinessIntelligence.tsx", "try { await saveGoal(code, value", 3,
         ((0, "Vacío envía null; un valor envía Number. Solo después de persistir recarga meta y reporte."),
          (1, "El fallo permanece como mensaje."), (2, "Libera busy incluso si falla la petición.")),
         "La meta vigente se guarda por código de indicador; no reconstruye automáticamente las metas históricas de cada día ni rellena denominadores ausentes."),
        ("src/main/java/com/ecoroute/backend/application/services/DashboardService.java", "public Mono<Goal> saveGoal(String code", 7,
         ((1, "Normaliza el código mediante Indicator."), (2, "Si hay valor exige el intervalo 0 a 100."),
          (4, "Comprueba la identidad del actor."), (6, "El puerto analytics persiste indicador, meta y actor.")),
         "Entrada: código, meta nullable y actor autenticado. Salida: Goal persistida o rechazo. Los agregados BI se calculan por otra lectura y conservan NO_DATA y NO_TARGET."),
    ],
    "M01": [
        ("mobile-app/lib/features/auth/presentation/bloc/auth_bloc.dart", "await loginUseCase.execute(event.username, event.password);", 6,
         ((0, "Espera el resultado del caso de uso de login."), (2, "fold distingue falla y usuario."),
          (3, "Una falla emite AuthError."), (4, "El usuario recuperado emite Authenticated y el router reacciona al estado.")),
         "El Bloc traduce resultado de dominio a estado visual. La autenticación remota y el vínculo efectivo se comprueban antes de tratar al usuario como conductor operativo."),
        ("src/main/java/com/ecoroute/backend/infrastructure/input/rest/SessionController.java", "public Mono<Map<String,Object>> me()", 5,
         ((1, "Usa la autenticación de la petición."), (3, "El driverId procede de OperationalAccess y su vínculo autorizado.")),
         "GET /session/me devuelve identidad efectiva y roles. La cuenta recordada localmente no reemplaza la validación de propiedad y permisos del servidor."),
    ],
    "M02": [
        ("mobile-app/lib/features/routes/data/datasources/route_remote_data_source.dart", "Future<void> accept(int routeId) async", 3,
         ((0, "Recibe el ID de la ruta elegida."), (1, "Espera POST /routes/{id}/acceptance sin inventar un estado de despacho.")),
         "La fuente de datos devuelve Future<void> o falla. Bloc y repositorio deben reflejar la respuesta; aceptar la hoja no cambia la ruta a IN_PROGRESS."),
        ("src/main/java/com/ecoroute/backend/application/services/BusinessWorkflowService.java", "public Mono<Review> accept(Long id,Long driverId,String actor)", 6,
         ((2, "La hoja debe pertenecer al conductor efectivo."), (4, "La revisión debe estar aprobada."),
          (5, "El puerto guarda aceptación y auditoría del actor.")),
         "Entrada: ruta, conductor y actor autenticados. Salida: revisión de planificación. Si falta aprobación o la ruta es ajena, el servidor rechaza aunque el botón sea visible."),
    ],
    "M03": [
        ("mobile-app/lib/core/sync/proof_sync.dart", "await cache.enqueue(", 7,
         ((0, "Inicia la escritura durable antes de cualquier envío HTTP."), (2, "Recarga la cola para presentarla."),
          (3, "Intenta sincronizar."), (6, "Solo la ausencia en la cola tras el intento produce confirmed en este método.")),
         "submit distingue confirmed, queued y rejected. La cola pertenece a una cuenta; el servidor sigue siendo la autoridad sobre el POD y el estado del pedido."),
        ("src/main/java/com/ecoroute/backend/application/usecases/CreateDeliveryProofUseCaseImpl.java", "if (order.status() == OrderStatus.DELIVERED)", 5,
         ((0, "Si ya está entregado busca la evidencia existente."), (2, "Un entregado sin prueba exige conciliación."),
          (3, "Una nueva confirmación requiere IN_TRANSIT."), (4, "Rechaza otros estados antes de continuar el guardado.")),
         "El caso valida GPS, receptor e imágenes antes de estas guardas. Persistencia, integridad e historial completan la confirmación; una imagen capturada en el teléfono todavía no es esa confirmación."),
    ],
    "M04": [
        ("mobile-app/lib/features/history/data/datasources/history_remote_data_source.dart", "if (!routeIds.contains(row['routeId'])", 4,
         ((0, "Exige que el pedido pertenezca a las rutas del conductor."), (1, "Admite únicamente DELIVERED, FAILED o RETURNED."),
          (2, "Los demás registros quedan fuera del historial terminal.")),
         "La lectura filtra propiedad y estado; después aplica el período por fecha local del dispositivo. No hay reapertura ni escritura por consultar el historial."),
        ("mobile-app/lib/features/history/data/datasources/history_remote_data_source.dart", "if (!at.isBefore(from)", 5,
         ((0, "Incluye desde el inicio y excluye el fin del período."), (2, "Ordena por fecha descendente."),
          (4, "Devuelve la lista filtrada al repositorio y Bloc.")),
         "El contrato devuelve terminales fechados o falla si no puede verificar la cuenta. Revisar la zona del dispositivo antes de equiparar este corte con America/Lima del backend."),
    ],
    "M05": [
        ("mobile-app/lib/features/profile/presentation/pages/profile_page.dart", "final response = await dio.get('/drivers/", 6,
         ((0, "Consulta el driverId de la identidad autenticada."), (1, "Comprueba mounted antes de actualizar la vista."),
          (2, "Exige respuesta 200 con datos."), (4, "Guarda los detalles en estado de presentación.")),
         "Es consulta de ficha, sin edición de licencia. Un fallo puede dejar campos no disponibles; alternar tema o mostrar el perfil no habilita recursos ni rutas."),
        ("src/main/java/com/ecoroute/backend/infrastructure/input/rest/DriverController.java", "public Mono<Driver> getDriverById(", 5,
         ((1, "Lee el conductor y evalúa acceso de gestión."), (2, "Si no es gestor, exige que el ID coincida con el conductor efectivo."),
          (3, "La falta de un resultado autorizado produce acceso denegado.")),
         "GET /drivers/{id} no confía solo en el identificador de Flutter. El puerto GetDriverByIdUseCase y DriverRepository aíslan la consulta de drivers."),
    ],
    "M06": [
        ("mobile-app/lib/core/sync/proof_sync.dart", "await client.post('/delivery-proofs'", 5,
         ((0, "Inicia el envío del payload sin metadatos internos de cola."), (2, "Asocia la petición con el propietario."),
          (3, "Usa orderId como Idempotency-Key."), (4, "Solo después del HTTP exitoso retira el elemento durable.")),
         "Un rechazo conserva la evidencia y su error; el reintento explícito puede incluir rechazados. La clave enviada no sustituye las guardas e integridad del servidor."),
        ("mobile-app/lib/core/cache/local_cache.dart", "Future<void> enqueue(String owner", 6,
         ((0, "El contrato recibe propietario y evidencia."), (1, "Modifica la cola mediante mutate."),
          (2, "Evita añadir dos entradas locales para el mismo orderId."), (3, "Añade la prueba nueva antes del envío.")),
         "La deduplicación local pertenece a la cola de esa cuenta. No crea otro pedido ni demuestra que el servidor haya confirmado; al cambiar de cuenta no debe drenarse evidencia ajena."),
    ],
}


class GuideError(ValueError):
    """An input cannot safely support the guide."""


def require(condition, message):
    if not condition:
        raise GuideError(message)


def normal(value):
    return " ".join(str(value).split())


def fold(value):
    return "".join(c for c in unicodedata.normalize("NFKD", str(value))
                   if not unicodedata.combining(c)).lower()


def heading(value):
    # Plain black Word headings, no punctuation or decorative rules.
    return normal(re.sub(r"[^\w\s]", " ", str(value), flags=re.UNICODE).replace("_", " "))


def local_path(root, value, label):
    require(isinstance(value, str) and value.strip(), f"{label}: falta ruta relativa a ROOT.")
    relative = Path(value.replace("\\", "/"))
    require(not relative.is_absolute() and not re.match(r"^[A-Za-z]:", value),
            f"{label}: debe ser relativa a ROOT.")
    resolved = (root / relative).resolve()
    require(resolved.is_relative_to(root), f"{label}: ruta fuera de ROOT.")
    require(resolved.is_file(), f"{label}: archivo inexistente: {relative.as_posix()}")
    return resolved


def read_json(path):
    require(path.is_file(), f"Falta el input requerido: {path}")
    try:
        return json.loads(path.read_text(encoding="utf-8-sig"))
    except (UnicodeError, json.JSONDecodeError) as exc:
        raise GuideError(f"JSON no válido: {path.name}: {exc}") from exc


SECRET_KEY = re.compile(r"password|passwd|secret|token|credential|authorization|private.?key|keystore", re.I)


class SafeText:
    """Never serialize raw runtime/fixture objects or environment contents."""
    def __init__(self, manifest):
        self.values = set()

        def visit(value):
            if isinstance(value, dict):
                for key, item in value.items():
                    if SECRET_KEY.search(str(key)) and isinstance(item, (str, int)) and len(str(item)) >= 4:
                        self.values.add(str(item))
                    else:
                        visit(item)
            elif isinstance(value, list):
                for item in value:
                    visit(item)
        visit(manifest)

    def __call__(self, value):
        text = str(value)
        for secret in sorted(self.values, key=len, reverse=True):
            text = text.replace(secret, "[dato reservado]")
        text = re.sub(r"-----BEGIN [^-]*(?:PRIVATE KEY|CERTIFICATE)-----.*?-----END [^-]+-----",
                      "[material reservado]", text, flags=re.S)
        text = re.sub(r"\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b", "[dato reservado]", text)
        text = re.sub(r"(?i)\bBearer\s+[^\s,;]+", "[autorización reservada]", text)
        text = re.sub(r"(?i)((?:password|passwd|client_secret|access_token|refresh_token|id_token|"
                      r"authorization|api_key|signing_key)\s*[=:]\s*)(?:\"[^\"]*\"|'[^']*'|[^\s,;}]+)",
                      r"\1[dato reservado]", text)
        text = re.sub(r"(?i)(https?://)[^/\s:@]+:[^/\s@]+@", r"\1", text)
        text = re.sub(r"(?i)(https?://[^\s?#]+)[?#][^\s]*", r"\1", text)
        # Never include diagnostics with local environment assignments / long opaque keys.
        text = re.sub(r"\b[A-Z][A-Z0-9_]{2,}\s*=\s*[^\s,;]+", "[configuración local reservada]", text)
        text = re.sub(r"(?<![\w/])[A-Za-z0-9_+-]{100,}={0,2}(?!\w)", "[dato reservado]", text)
        return text


def source_refs(root, refs, cache):
    resolved = []
    for ref in refs:
        require(isinstance(ref, dict), "Referencia de fuente no válida.")
        path = local_path(root, ref.get("file"), "Fuente")
        text = cache.setdefault(path, path.read_text(encoding="utf-8-sig"))
        symbol = str(ref.get("symbol", "")).strip()
        require(symbol, f"Fuente sin símbolo: {ref['file']}")
        lines = text.splitlines()
        previous = ref.get("line", 0)
        hits = [i for i, line in enumerate(lines, 1) if normal(symbol) in normal(line)]
        # Some anchors deliberately span lines; retain a verified literal start.
        if not hits and normal(symbol) in normal(text):
            match = re.search(r"\s+".join(re.escape(p) for p in symbol.split()), text)
            if match:
                hits = [text[:match.start()].count("\n") + 1]
        require(hits, f"Fuente desactualizada: no existe el ancla {symbol!r} en {ref['file']}")
        line = previous if previous in hits else hits[0]
        resolved.append({"file": path.relative_to(root).as_posix(), "path": path,
                         "symbol": symbol, "line": line})
    return resolved


def png_info(path):
    # Header-only metadata: no pixel decoding, cropping or image emulation.
    with path.open("rb") as stream:
        header = stream.read(33)
    require(len(header) == 33 and header[:8] == b"\x89PNG\r\n\x1a\n" and header[12:16] == b"IHDR",
            f"La captura no es un PNG original válido: {path.name}")
    width, height = struct.unpack(">II", header[16:24])
    require(width > 0 and height > 0, f"PNG sin dimensiones: {path.name}")
    return width, height


def jpeg_info(path):
    # Read marker metadata only; preserve the original JPEG bytes for Word.
    with path.open("rb") as stream:
        require(stream.read(2) == b"\xff\xd8",
                f"La captura no es un JPEG original válido: {path.name}")
        while True:
            require(stream.read(1) == b"\xff", f"Cabecera JPEG no válida: {path.name}")
            marker = stream.read(1)
            while marker == b"\xff":
                marker = stream.read(1)
            require(bool(marker), f"JPEG truncado: {path.name}")
            code = marker[0]
            require(code not in (0x00, 0xD8, 0xD9, 0xDA),
                    f"JPEG sin dimensiones válidas: {path.name}")
            if code == 0x01 or 0xD0 <= code <= 0xD7:
                continue
            raw_length = stream.read(2)
            require(len(raw_length) == 2, f"JPEG truncado: {path.name}")
            length = struct.unpack(">H", raw_length)[0]
            require(length >= 2, f"Segmento JPEG no válido: {path.name}")
            payload = stream.read(length - 2)
            require(len(payload) == length - 2, f"JPEG truncado: {path.name}")
            if 0xC0 <= code <= 0xCF and code not in (0xC4, 0xC8, 0xCC):
                require(len(payload) >= 6, f"Dimensiones JPEG truncadas: {path.name}")
                height, width = struct.unpack(">HH", payload[1:5])
                components = payload[5]
                require(width > 0 and height > 0 and components > 0
                        and len(payload) == 6 + 3 * components,
                        f"Dimensiones JPEG no válidas: {path.name}")
                return width, height


def image_info(path):
    if path.suffix.lower() == ".png":
        return png_info(path)
    return jpeg_info(path)


def validate(root, inventory_path, manifest_path):
    inventory, manifest = read_json(inventory_path), read_json(manifest_path)
    require(isinstance(inventory, dict) and isinstance(manifest, dict), "Inputs deben ser objetos JSON.")
    require(len(inventory.get("web", [])) == 13 and len(inventory.get("mobile", [])) == 6,
            "El inventario debe contener 13 pantallas web y 6 móviles completas.")
    screens = inventory["web"] + inventory["mobile"]
    require(len({s.get("id") for s in screens}) == 19 and {s.get("id") for s in screens} == set(EXPECTED_IDS),
            "IDs requeridos: W01 a W13 y M01 a M06, sin duplicados.")
    if "assignment" in inventory:
        assigned = {r["student"]: tuple(r["mainScreens"]) for r in inventory["assignment"]}
        require(assigned == dict(ASSIGNMENT), "El reparto de dos pantallas principales por alumno cambió.")
    require(manifest.get("at") and manifest.get("runId"), "Manifest sin at o runId.")
    try:
        datetime.fromisoformat(str(manifest["at"]).replace("Z", "+00:00"))
    except ValueError as exc:
        raise GuideError("manifest.at debe ser una fecha ISO 8601.") from exc
    runtime = manifest.get("runtime")
    require(isinstance(runtime, dict) and all(k in runtime for k in ("backend", "web", "mobile", "ide")),
            "manifest.runtime requiere backend, web, mobile e ide.")
    require(isinstance(manifest.get("fixture"), dict), "manifest.fixture debe ser un objeto.")
    checks = manifest.get("checks")
    require(isinstance(checks, list) and checks, "Manifest sin checks: no se puede distinguir prueba real y prevista.")
    for check in checks:
        require(isinstance(check, dict) and check.get("name") and "details" in check,
                "Cada check requiere name, status y details.")
        require(str(check.get("status", "")).upper() in STATUSES,
                f"Estado no reconocido en check {check.get('name')!r}; utilizar PASS, FAIL o PLANNED.")
    cache = {}
    for source in PREP_SOURCES:
        local_path(root, source, "Preparación IDE")
    for screen in screens:
        for key in ("title", "route", "roles", "processes", "source", "actions", "states", "flow", "sources", "expectedEvidence"):
            require(screen.get(key), f"Inventario incompleto: {screen['id']}.{key}")
        prose = [screen["source"], *screen["actions"], *screen["states"], *screen["flow"], *screen["expectedEvidence"]]
        require(len(" ".join(prose).split()) >= 200, f"{screen['id']}: requiere al menos 200 palabras de inventario.")
        screen["_refs"] = source_refs(root, screen["sources"], cache)
    for section in inventory.get("sharedFlow", []):
        section["_refs"] = source_refs(root, section.get("sources", []), cache)
        for process in section.get("processes", {}).values():
            source_refs(root, [process["source"]], cache)
    captures = manifest.get("screens")
    require(isinstance(captures, list) and captures, "Faltan capturas reales en manifest.screens.")
    sequences, found, files = set(), set(), set()
    for capture in captures:
        require(isinstance(capture, dict) and all(k in capture for k in ("screenId", "file", "caption", "state", "sequence")),
                "Cada captura requiere screenId, file, caption, state y sequence.")
        require(all(isinstance(capture[k], str) and capture[k].strip() for k in ("screenId", "file", "caption", "state")),
                "Captura con identificador, ruta, pie o estado vacío.")
        seq = capture["sequence"]
        require(isinstance(seq, int) and not isinstance(seq, bool) and seq >= 0 and seq not in sequences,
                "sequence debe ser un entero único y no negativo por captura.")
        path = local_path(root, capture["file"], "Captura requerida")
        require(path.suffix.lower() in (".png", ".jpg", ".jpeg"),
                f"Captura debe ser PNG o JPEG: {capture['file']}")
        require(path not in files, f"Imagen repetida como dos evidencias: {capture['file']}")
        capture["_path"], capture["_size"] = path, image_info(path)
        capture["_sha256"] = hashlib.sha256(path.read_bytes()).hexdigest()
        sequences.add(seq)
        files.add(path)
        found.add(capture["screenId"])
    missing = set(EXPECTED_IDS) - found
    require(not missing, "Faltan capturas de pantallas requeridas: " + ", ".join(sorted(missing)) +
            ". Main debe producirlas y completar el manifest; no se crean sustitutos.")
    manifest["screens"] = sorted(captures, key=lambda c: c["sequence"])
    return inventory, manifest, cache


def method_label(symbol):
    if symbol.startswith("@") or symbol.startswith("path"):
        return symbol
    match = re.search(r"\b(?:class|interface|function)\s+(\w+)", symbol)
    if match:
        return match.group(1)
    match = re.search(r"(\w+)\s*\(", symbol)
    return match.group(1) + "()" if match else symbol.rstrip(" {;")


def persistence(screen, cache, root):
    ports, tables = set(), set()
    for ref in screen["_refs"]:
        if ref["path"].suffix != ".java":
            continue
        text = cache[ref["path"]]
        ports.update(re.findall(r"import com\.ecoroute\.backend\.domain\.ports\.(?:in|out)\.(\w+)\s*;", text))
        # SQL is read in the referenced persistence adapter, never executed.
        if "/persistence/" in ref["file"]:
            tables.update(re.findall(r"\b(?:FROM|JOIN|INTO|UPDATE)\s+([a-z][a-z_0-9]*)\b", text))
            entities = {root / "src/main/java" / (entity.replace(".", "/") + ".java")
                        for entity in re.findall(r"import ([\w.]+Entity)\s*;", text)}
            # Persistence entities frequently share the adapter's Java package,
            # so no import declaration is needed in the actual source.
            entities.update(ref["path"].parent / (entity + ".java")
                            for entity in re.findall(r"\b(\w+Entity)\b", text))
            for path in entities:
                if path.is_file():
                    body = path.read_text(encoding="utf-8-sig")
                    tables.update(re.findall(r'@Table\(\s*(?:value\s*=\s*)?"([\w.]+)"', body))
    if screen["id"] in ("W01", "M01"):
        tables.add("drivers")
    # These are identifiers found in the inventory's flow, not inferred queries.
    flow = " ".join(screen["flow"])
    for name in ("orders", "routes", "drivers", "vehicles", "purchases", "delivery_proofs",
                 "order_business_data", "order_status_history", "route_dispatch_reviews", "incidents",
                 "order_attempts", "improvement_actions", "analytics_goals", "vehicle_gps_history",
                 "auth_user_role", "business_audit_events"):
        if re.search(r"\b" + re.escape(name) + r"\b", flow):
            tables.add(name)
    return sorted(ports), sorted(tables)


def prepare_code_walks(root, cache):
    """Read-only verification; no Document construction or image processing."""
    require(set(CODE_WALKS) == set(EXPECTED_IDS), "Falta explicación de código para una pantalla.")
    prepared = {}
    for sid, specs in CODE_WALKS.items():
        require(1 <= len(specs) <= 3, f"{sid}: se permiten de uno a tres fragmentos reales.")
        prepared[sid] = []
        for file, anchor, count, notes, contract in specs:
            path = local_path(root, file, "Fragmento de código")
            if path not in cache:
                cache[path] = path.read_text(encoding="utf-8-sig")
            lines = cache[path].splitlines()
            matches = [i for i, line in enumerate(lines) if normal(anchor) in normal(line)]
            require(len(matches) == 1, f"{sid}: ancla de fragmento ausente o ambigua en {file}: {anchor}")
            start = matches[0]
            require(1 <= count <= 8 and start + count <= len(lines), f"{sid}: fragmento fuera de rango.")
            require(all(0 <= offset < count for offset, _ in notes), f"{sid}: nota de línea fuera del fragmento.")
            selected = lines[start:start + count]
            # Remove only their common layout indentation; original statements,
            # whitespace within each line and real source numbers are preserved.
            indentation = min((len(line) - len(line.lstrip()) for line in selected if line.strip()), default=0)
            selected = [line[indentation:] if line.strip() else "" for line in selected]
            prepared[sid].append({"path": path, "file": file, "start": start + 1,
                                  "lines": selected, "notes": notes, "contract": contract})
    return prepared


def add_code_walk(guide, steps):
    guide.h("Código explicado paso a paso", 2)
    for index, step in enumerate(steps, 1):
        start = step["start"]
        end = start + len(step["lines"]) - 1
        paragraph = guide.file(step["path"], f"Fragmento {index} · {step['file']} · L{start} a L{end}")
        paragraph.paragraph_format.keep_with_next = True
        code = "\n".join(f"{start + offset:>4}  {line}" for offset, line in enumerate(step["lines"]))
        # Fail instead of silently showing a redacted approximation as real code.
        require(guide.safe(code) == code, f"Un fragmento de {step['file']} contiene material reservado; elegir otra ancla.")
        paragraph = guide.doc.add_paragraph()
        paragraph.paragraph_format.keep_together = True
        paragraph.paragraph_format.keep_with_next = True
        paragraph.paragraph_format.space_after = guide.Pt(4)
        paragraph.paragraph_format.line_spacing = 1.0
        run = paragraph.add_run(code)
        run.font.name = "Consolas"
        run.font.size = guide.Pt(9.5)
        fonts = run._element.get_or_add_rPr().rFonts
        fonts.set(guide.qn("w:ascii"), "Consolas")
        fonts.set(guide.qn("w:hAnsi"), "Consolas")
        language = {".java": "java", ".tsx": "tsx", ".ts": "typescript", ".dart": "dart"}.get(step["path"].suffix, "text")
        guide.md.append(f"```{language}\n{code}\n```\n")
        guide.p(" ".join(f"L{start + offset}: {text}" for offset, text in step["notes"]), "Lectura de las líneas")
        guide.p(step["contract"], "Contrato y límite")


class Guide:
    """A single content stream emits both Word and a matching Markdown guide."""
    def __init__(self, root, manifest):
        from docx import Document
        from docx.shared import Inches, Pt, RGBColor
        from docx.oxml import OxmlElement
        from docx.oxml.ns import qn
        self.root, self.safe = root, SafeText(manifest)
        self.Inches, self.Pt, self.RGBColor = Inches, Pt, RGBColor
        self.OxmlElement, self.qn = OxmlElement, qn
        self.doc, self.md, self.figure = Document(), [], 0
        section = self.doc.sections[0]
        section.page_width, section.page_height = Inches(8.5), Inches(11)
        section.left_margin = section.right_margin = Inches(.75)
        section.top_margin = section.bottom_margin = Inches(.65)
        section.header_distance = section.footer_distance = Inches(.25)
        for name, size in (("Normal", 11), ("Title", 23), ("Subtitle", 12),
                           ("Heading 1", 16), ("Heading 2", 13), ("Heading 3", 11),
                           ("Caption", 10)):
            style = self.doc.styles[name]
            style.font.name, style.font.size = "Calibri", Pt(size)
            style.font.color.rgb = RGBColor(0, 0, 0)
            style.font.underline = False
            style.paragraph_format.space_after = Pt(5)
            style.paragraph_format.line_spacing = 1.04
            if name.startswith("Heading"):
                style.paragraph_format.keep_with_next = True
                style.paragraph_format.space_before = Pt(9)
        self.doc.styles["Normal"].paragraph_format.widow_control = True
        self.doc.core_properties.title = "EcoRoute Guía total del recorrido de negocio y del IDE"
        self.doc.core_properties.subject = "Exposición de 19 pantallas y trazabilidad técnica"
        self.doc.core_properties.author = "Equipo EcoRoute"
        self.doc.core_properties.last_modified_by = "Equipo EcoRoute"
        self.doc.core_properties.comments = ""
        footer = section.footer.paragraphs[0]
        from docx.enum.text import WD_ALIGN_PARAGRAPH
        footer.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        footer.add_run("EcoRoute · ").font.size = Pt(10)
        field = OxmlElement("w:fldSimple")
        field.set(qn("w:instr"), "PAGE")
        footer._p.append(field)

    def p(self, text, lead=None, style=None):
        text = self.safe(text)
        paragraph = self.doc.add_paragraph(style=style)
        if lead:
            paragraph.add_run(self.safe(lead) + " ").bold = True
        paragraph.add_run(text)
        self.md.append((f"**{self.safe(lead)}** " if lead else "") + text + "\n")
        return paragraph

    def h(self, text, level=1, new_page=False):
        text = heading(self.safe(text))
        paragraph = self.doc.add_paragraph(text, style=f"Heading {level}")
        paragraph.paragraph_format.page_break_before = bool(new_page)
        self.md.append("#" * (level + 1) + " " + text + "\n")
        return paragraph

    def link(self, paragraph, label, path):
        from docx.opc.constants import RELATIONSHIP_TYPE as RT
        link = self.OxmlElement("w:hyperlink")
        link.set(self.qn("r:id"), paragraph.part.relate_to(path.as_uri(), RT.HYPERLINK, is_external=True))
        run, properties = self.OxmlElement("w:r"), self.OxmlElement("w:rPr")
        color = self.OxmlElement("w:color")
        color.set(self.qn("w:val"), "000000")
        underline = self.OxmlElement("w:u")
        underline.set(self.qn("w:val"), "single")
        properties.extend((color, underline))
        run.append(properties)
        text = self.OxmlElement("w:t")
        text.text = self.safe(label)
        run.append(text)
        link.append(run)
        paragraph._p.append(link)

    def file(self, path, label=None):
        label = label or path.relative_to(self.root).as_posix()
        paragraph = self.doc.add_paragraph()
        paragraph.paragraph_format.space_after = self.Pt(3)
        self.link(paragraph, label, path)
        self.md.append(f"[{self.safe(label)}]({path.as_uri()})\n")
        return paragraph

    def table(self, headers, rows, widths):
        from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
        from docx.enum.text import WD_ALIGN_PARAGRAPH
        require(abs(sum(widths) - 7.0) < .01, "La tabla debe caber en 7 pulgadas.")
        table = self.doc.add_table(rows=1, cols=len(headers))
        table.autofit, table.alignment = False, WD_TABLE_ALIGNMENT.CENTER
        table.rows[0]._tr.get_or_add_trPr().append(self.OxmlElement("w:tblHeader"))
        all_rows = [headers] + list(rows)
        first_row_fits = len(all_rows) > 1 and sum(len(str(v)) for v in all_rows[1]) < 1000
        for index, values in enumerate(all_rows):
            cells = table.rows[0].cells if index == 0 else table.add_row().cells
            for col, (cell, value) in enumerate(zip(cells, values)):
                cell.width = self.Inches(widths[col])
                cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
                cell.text = self.safe(value)
                props = cell._tc.get_or_add_tcPr()
                margins = self.OxmlElement("w:tcMar")
                for side in ("top", "left", "bottom", "right"):
                    item = self.OxmlElement("w:" + side)
                    item.set(self.qn("w:w"), "85")
                    item.set(self.qn("w:type"), "dxa")
                    margins.append(item)
                props.append(margins)
                shade = self.OxmlElement("w:shd")
                shade.set(self.qn("w:fill"), "E7E7E7" if index == 0 else "FFFFFF")
                props.append(shade)
                for paragraph in cell.paragraphs:
                    paragraph.paragraph_format.space_after = self.Pt(3)
                    paragraph.paragraph_format.keep_with_next = index == 0 and first_row_fits
                    paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER if col == 0 else WD_ALIGN_PARAGRAPH.LEFT
                    for run in paragraph.runs:
                        run.font.size, run.bold = self.Pt(10), index == 0
        for column, width in zip(table.columns, widths):
            column.width = self.Inches(width)
        borders = self.OxmlElement("w:tblBorders")
        for side in ("top", "left", "bottom", "right", "insideH", "insideV"):
            border = self.OxmlElement("w:" + side)
            for key, value in (("val", "single"), ("sz", "4"), ("color", "D9D9D9")):
                border.set(self.qn("w:" + key), value)
            borders.append(border)
        table._tbl.tblPr.append(borders)
        # No row heights or chained keep-with-next that force a long table to one page.
        def escape(value):
            return self.safe(value).replace("|", "\\|").replace("\n", "<br>")
        self.md.append("| " + " | ".join(map(escape, headers)) + " |")
        self.md.append("| " + " | ".join("---" for _ in headers) + " |")
        self.md.extend("| " + " | ".join(map(escape, row)) + " |" for row in all_rows[1:])
        self.md.append("")

    def sources(self, refs):
        grouped = OrderedDict()
        for ref in refs:
            grouped.setdefault(ref["path"], []).append(ref)
        for path, group in grouped.items():
            paragraph = self.doc.add_paragraph()
            paragraph.paragraph_format.space_after = self.Pt(2)
            self.link(paragraph, group[0]["file"], path)
            anchors = list(dict.fromkeys(f"{method_label(ref['symbol'])} L{ref['line']}" for ref in group))
            run = paragraph.add_run(" — " + "; ".join(anchors))
            run.font.size = self.Pt(10)
            self.md.append(f"[{group[0]['file']}]({path.as_uri()}) — " + "; ".join(anchors) + "\n")

    def image(self, capture):
        from docx.enum.text import WD_ALIGN_PARAGRAPH
        self.figure += 1
        width_px, height_px = capture["_size"]
        is_mobile = capture["screenId"].startswith("M") and capture["screenId"] in EXPECTED_IDS
        max_height = 5.6 if is_mobile else 4.4
        width = min(7.0, max_height * width_px / height_px)
        height = width * height_px / width_px
        paragraph = self.doc.add_paragraph()
        paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
        paragraph.paragraph_format.keep_with_next = True
        paragraph.paragraph_format.space_after = self.Pt(2)
        # Image bytes are stored intact; only the Word display extent is set.
        shape = paragraph.add_run().add_picture(str(capture["_path"]),
                                                width=self.Inches(width), height=self.Inches(height))
        shape._inline.docPr.set("descr", self.safe(capture["caption"]))
        shape._inline.docPr.set("title", self.safe(capture["screenId"] + " " + capture["state"]))
        caption = (f"Figura {self.figure}. Paso {capture['sequence']} · {capture['screenId']} · "
                   f"{capture['state']}. {capture['caption']}")
        self.p(caption, style="Caption").paragraph_format.keep_with_next = True
        self.file(capture["_path"], "Imagen completa · " + capture["file"].replace("\\", "/"))
        self.md.append(f"![{self.safe(caption)}]({capture['_path'].as_uri()})\n")

    def finish(self):
        # Remove paragraph borders even from unused built-in styles and overrides.
        trees = [self.doc.styles.element, self.doc.element]
        for tree in trees:
            for node in list(tree.iter(self.qn("w:pBdr"))):
                node.getparent().remove(node)
            for color in tree.iter(self.qn("w:color")):
                for attr in ("themeColor", "themeTint", "themeShade"):
                    color.attrib.pop(self.qn("w:" + attr), None)
                color.set(self.qn("w:val"), "000000")
        buffer = io.BytesIO()
        self.doc.save(buffer)
        return buffer.getvalue(), "\n".join(self.md).rstrip() + "\n"


def check_details(value, safe):
    if isinstance(value, str):
        return safe(value)
    if isinstance(value, list):
        return "; ".join(check_details(item, safe) for item in value)
    if isinstance(value, dict):
        return "; ".join(f"{safe(k)}: {check_details(v, safe)}" for k, v in value.items()
                         if not SECRET_KEY.search(str(k)) and fold(k) not in ("env", "environment", "command", "cmd"))
    return safe(value)


def component_checks(manifest, component):
    aliases = {"backend": ("backend", "java", "jvm", "8081"),
               "web": ("web", "react", "vite", "3000"),
               "mobile": ("mobile", "flutter", "dart", "emulator"),
               "ide": ("ide", "vscode", "vs code", "debug", "depurador", "attach")}
    def matches(name, alias):
        value = fold(name)
        if alias == "ide":
            return bool(re.search(r"(?<![a-z])ide(?![a-z])", value))
        return alias in value
    return [c for c in manifest["checks"] if any(matches(c["name"], alias) for alias in aliases[component])]


def add_preparation(guide, manifest):
    guide.h("Preparación de la demostración y del IDE", new_page=True)
    guide.p("Docker proporciona PostgreSQL, Redis, Keycloak, LocalStack y OSRM. Los procesos de "
            "aplicación se arrancan desde sus fuentes mediante CLI: Java 17 y Gradle para backend, "
            "Vite para web y Flutter debug para el emulador. Abrir VS Code o pulsar F5 no acredita "
            "por sí solo que el proceso esté disponible.")
    guide.table(("Componente", "Ejecución y conexión", "Comprobación"), [
        ("Infraestructura", "Docker Compose con docker-compose.yml y docker-compose.ide.yml; servicios postgres redis keycloak localstack osrm", "PostgreSQL host 5433 → contenedor 5432; Redis 16379; Keycloak 8080; LocalStack 4566; OSRM 5000"),
        ("Backend", "Java 17; Gradle bootRun; perfiles local,ide; HTTP 8081; JVM debug 127.0.0.1:5005", "Health y petición autorizada; adjuntar JVM y comprobar pausa"),
        ("Web", "Vite 127.0.0.1:3000; proxy /api → backend 8081 retirando el prefijo; /ws mediante proxy", "Navegación y datos; depurador del navegador"),
        ("Móvil", "Flutter debug en emulator-5556; backend http://10.0.2.2:8081; OIDC http://10.0.2.2:8080", "Sesión efectiva, pantalla real y conexión Dart; no inferir éxito a partir de la compilación"),
    ], (1.0, 3.25, 2.75))
    guide.h("Secuencia de arranque prevista", 2)
    steps = [
        "1. Desde la raíz, iniciar infraestructura: powershell -NoProfile -File tools/guia_total_ide/Start-EcoRouteIDE.ps1 -Component Infra. Confirmar los servicios y puertos antes de iniciar las aplicaciones.",
        "2. En otra terminal, iniciar Java: powershell -NoProfile -File tools/guia_total_ide/Start-EcoRouteIDE.ps1 -Component Backend. El script selecciona Java 17 y ejecuta gradlew.bat bootRun con el init script de depuración y perfiles local,ide. HTTP usa 8081 y JDWP 5005.",
        "3. En otra terminal, iniciar web: powershell -NoProfile -File tools/guia_total_ide/Start-EcoRouteIDE.ps1 -Component Web. Vite usa 3000 con strictPort. En este recorrido /api se reescribe en Vite; no es necesario atribuir esa petición a Nginx.",
        "4. Desde la raíz, preparar la copia verificada: node tools/guia_total_ide/prepare_mobile_copy.mjs | Out-Null. Out-Null oculta la salida que contiene la ubicación temporal privada. El script conserva esa ubicación en .runtime/mobile_copy.json y publica la verificación de hashes sin exponer el destino.",
        "5. En una terminal privada, iniciar el build aislado y la app debug: powershell -NoProfile -File tools/guia_total_ide/Start-EcoRouteIDE.ps1 -Component Flutter -Device emulator-5556 -IsolatedAndroidBuild. El script obtiene internamente la copia, comprueba los hashes de fuentes, compila el APK Android x64 y ejecuta ese binario en el emulador. Tee-Object conserva siempre la salida de flutter run en docs/guia_total_ide/.runtime/flutter_isolated.log; mantener esa salida privada porque puede contener la dirección autenticada del depurador.",
        "6. Con la aplicación ya en ejecución, preparar su referencia de servicio: powershell -NoProfile -File tools/guia_total_ide/Prepare-FlutterDebugger.ps1. Este paso lee flutter_isolated.log y prepara la conexión de depuración; no arranca otra aplicación ni reinicia la sesión existente.",
    ]
    for step in steps:
        guide.p(step)
    guide.h("Puertos y copia temporal de Flutter", 2)
    guide.p("El perfil IDE usa IDE_DB_PORT con valor 5433 para R2DBC y Flyway porque Docker publica "
            "5433 hacia PostgreSQL 5432. El puerto 5432 de la configuración local anterior no describe "
            "el puerto host de este recorrido. application-ide.yml es el punto a revisar ante una "
            "conexión fallida; la configuración privada permanece fuera de la exposición.")
    guide.p("OneDrive puede bloquear archivos generados de Flutter. prepare_mobile_copy.mjs prepara "
            "un directorio temporal y compara SHA256 de lib, fuentes Android y archivos de dependencias. "
            "La verificación pública queda en mobile/source_copy_verification.json. La sesión temporal "
            "usa una clave de depuración efímera gestionada localmente. No se expone material de firma "
            "ni se considera que compilar equivale a ejecutar. El check y la captura del emulador "
            "deben acreditar el resultado de la sesión concreta.")
    guide.h("Abrir los tres espacios de trabajo y depurar", 2)
    for file in WORKSPACES:
        guide.file(guide.root / file)
    guide.p("Backend: abrir EcoRoute_Backend_IDE.code-workspace y seleccionar EcoRoute Backend conectar "
            "JVM 5005. Con el proceso CLI iniciado, F5 adjunta el depurador. Poner un breakpoint en el "
            "controlador o caso de uso, ejecutar una acción autorizada, inspeccionar datos ficticios y continuar.")
    guide.p("Web: abrir EcoRoute_Web_IDE.code-workspace. Con Vite iniciado, F5 ejecuta la configuración "
            "EcoRoute Web depurar React y conecta la depuración del navegador a localhost:3000. "
            "La configuración es request launch para el navegador; el servidor Vite ya procede de CLI. "
            "Comprobar una pausa en el evento y seguir la llamada del servicio al endpoint.")
    guide.p("Flutter: abrir EcoRoute_Flutter_IDE.code-workspace y ejecutar Prepare-FlutterDebugger.ps1 "
            "con la aplicación debug ya iniciada. El helper lee el evento app.debugPort y escribe "
            "docs/guia_total_ide/.runtime/flutter_service.json con una propiedad uri de tipo string: "
            "la base HTTP autenticada, terminada en barra y sin sufijo /ws. Ese archivo permanece "
            "privado y su dirección no se muestra en la exposición.")
    guide.p("Seleccionar EcoRoute Flutter conectar aplicación en ejecución. La configuración usa "
            "type dart, request attach y debuggerType dart, con vmServiceInfoFile apuntando al archivo "
            "HTTP anterior y deleteServiceInfoFile false. F5 conecta el adaptador Dart directamente "
            "al servicio existente. Esta selección evita pasar la dirección del host por un nuevo "
            "flutter attach y otro reenvío de puerto hacia el emulador; tampoco se añade /ws al archivo.")
    guide.p("Para comprobar control del depurador, usar F6 y observar Call Stack con Paused on pause; "
            "después usar Continue o F5 dentro de esa sesión y comprobar que la aplicación reanuda. "
            "La evidencia IDE se registra con flutter_debugger.jpg, sin URI autenticada ni secretos "
            "visibles. La toolbar por sí sola no sustituye la comprobación de pausa y continuación.")
    guide.p("Si la app se ejecuta desde la copia temporal, la sesión usa las fuentes compiladas allí. "
            "Para inspeccionar o poner breakpoints, seguir los archivos cargados por Call Stack y "
            "conservar su correspondencia con los hashes de la copia. No ejecutar hot reload ni hot "
            "restart desde el árbol original mobile-app contra esta sesión: editar el original no "
            "actualiza la copia Temp. El attach Dart directo se demuestra con pausa, pila y continuación; "
            "no acredita los controles de hot reload del adaptador Flutter.")
    flutter_control = [check for check in component_checks(manifest, "mobile")
                       if str(check["status"]).upper() == "PASS"
                       and any(word in fold(check["name"]) for word in ("attach", "debug", "depur", "f6", "pause", "pausa"))]
    flutter_evidence = [capture for capture in manifest["screens"]
                        if capture["_path"].name == "flutter_debugger.jpg"]
    if flutter_control and flutter_evidence:
        guide.p("La sesión registra control de depuración Dart con resultado PASS. Contrastar su "
                "alcance en los checks finales y la figura flutter_debugger.jpg para comprobar la "
                "pausa y la continuación documentadas por el operador.")
    guide.p("VS Code mostró Restricted Mode y el usuario habilitó manualmente la confianza. "
            "Las decisiones de seguridad se mantienen bajo control del usuario. Para la exposición, "
            "comprobar si el depurador está adjunto y si una acción produce la pausa esperada.")
    guide.h("Estado registrado de la ejecución", 2)
    rows = []
    for component in ("backend", "web", "mobile", "ide"):
        checks = component_checks(manifest, component)
        if checks:
            result = "; ".join(f"{c['name']}: {str(c['status']).upper()}" for c in checks)
        else:
            result = "Sin check específico; funcionamiento no acreditado"
        rows.append((component, result))
    guide.table(("Componente", "Checks que acreditan su alcance"), rows, (1.2, 5.8))
    guide.p("PASS acredita únicamente lo que nombra y detalla el check. Un FAIL, un caso previsto o "
            "una captura aislada no acreditan el funcionamiento completo de Flutter, IDE ni del flujo. "
            "La lista final conserva el estado de cada comprobación.")
    guide.h("Archivos para explicar el arranque", 2)
    for source in PREP_SOURCES[3:]:
        guide.file(guide.root / source)
    guide.p("EcorouteBackendApplication.main inicia Spring; init fija America/Lima. El banner local "
            "describe JWT Keycloak y permisos por rol. Login.tsx presenta la identidad MICOTRANS. "
            "Una marca visual o un banner no sustituyen la comprobación de autenticación y permisos.")


def add_business(guide, inventory):
    guide.h("Recorrido del negocio y responsabilidades", new_page=True)
    guide.p("El operador revisa el pedido y prepara la jornada; la jefatura autoriza y el conductor "
            "acepta antes del despacho. La ejecución produce resultados y evidencias. Las excepciones "
            "se resuelven con decisiones autorizadas; la evaluación compara registros y metas para "
            "proponer acciones. Los BPMN describen tareas humanas y del sistema: una tarea de negocio "
            "no implica que exista un botón o endpoint automático.")
    guide.p("Las acciones y alternativas de cada pantalla indican qué demostrar. Los estados "
            "de las figuras identifican lo capturado; los checks finales distinguen prueba ejecutada "
            "y caso previsto. Conservar los identificadores ficticios permite contrastar una escritura "
            "con su consulta posterior, sin confundir captura local con confirmación remota.")
    business = next((s for s in inventory.get("sharedFlow", []) if s.get("id") == "S01"), {})
    guide.table(("Proceso", "Propósito", "Pantallas y conexión"), [
        (pid, process["name"], {"P01": "W03 → pedido revisado", "P02": "W04 y M02 → ruta revisada y aceptada",
         "P03": "M02 M03 M04 M06 y W03 → resultado y POD", "P04": "W05 → decisión y nuevo intento cuando corresponde",
         "P05": "W07 W12 W13 W06 → análisis y seguimiento", "P06": "W08 W09 M05 → recursos",
         "P07": "W04 M02 W07 W12 → supervisión", "P08": "W01 W02 W10 M01 M05 → acceso",
         "P09": "W11 → compras operativas"}.get(pid, "Ver recorrido"))
        for pid, process in business.get("processes", {}).items()
    ], (.65, 2.35, 4.0))
    guide.h("Procesos BPMN para abrir", 2)
    for pid, process in business.get("processes", {}).items():
        ref = process["source"]
        guide.file(guide.root / ref["file"], f"{pid} · " + ref["file"])
    for section_id, title in (("S02", "Traspasos de la jornada"), ("S03", "Alternativas y bloqueos")):
        guide.h(title, 2)
        section = next((s for s in inventory.get("sharedFlow", []) if s.get("id") == section_id), {})
        for step in section.get("steps", []):
            guide.p(step)
    guide.h("Tres capas y límites del código", 2)
    guide.table(("Capa", "Responsabilidad", "Recorrido del dato"), [
        ("Presentación", "React y Flutter muestran estados, validan el formulario y recogen una acción", "Componente o Page → hook o Bloc → servicio o repositorio cliente → HTTP"),
        ("Aplicación y dominio", "Los controladores adaptan REST; los casos de uso y servicios aplican reglas; los puertos separan dependencias", "Controller → caso de uso → puerto del dominio"),
        ("Persistencia e integración", "Los adaptadores implementan los puertos mediante SQL reactivo e integraciones", "R2DBC → PostgreSQL; Keycloak, Redis, S3 o backup según la operación"),
    ], (1.2, 3.0, 2.8))
    guide.p("En backend esta separación se organiza con puertos y adaptadores. El DTO de transporte, "
            "el modelo de dominio y la entidad SQL cumplen funciones distintas. Mono y Flux encadenan "
            "la operación reactiva; la respuesta HTTP y el refresco del cliente devuelven el resultado "
            "a la pantalla. La lectura de código explica la regla; su ejecución se acredita por separado.")
    guide.h("Reparto de la exposición", 2)
    titles = {s["id"]: s["title"] for s in inventory["web"] + inventory["mobile"]}
    guide.table(("Integrante", "Dos pantallas principales", "Traspaso"), [
        (name, "; ".join(f"{sid} {titles[sid]}" for sid in ids),
         {"Enzo": "Pedido y ruta a Luis", "Luis": "Resultado y excepción a Renzo",
          "Renzo": "Decisiones y acciones para evaluación", "Adrian": "Resultados y desvíos para revisión"}[name])
        for name, ids in ASSIGNMENT.items()
    ], (.9, 3.65, 2.45))
    guide.p("Las otras once pantallas son de apoyo y forman parte de la demostración completa. "
            "Accesos, Inicio, recursos, usuarios, compras, reportes, historial, perfil y sincronización "
            "se muestran en el momento en que sostienen la jornada. El reparto de dos principales "
            "por integrante no reduce el alcance de 19 pantallas.")


def add_route_metrics_explanation(guide, sid):
    if sid == "W04":
        guide.h("Cómo explicar las distancias del mapa y del despacho", 2)
        guide.p("RouteTracking consulta GET /routes/{id}/path con fromLat y fromLng cuando dispone "
                "del último origen GPS. Actualiza ese origen periódicamente y usa los IDs y estados "
                "de pedidos como clave de recarga. RouteController.getRoutePath filtra paradas no "
                "terminales con coordenadas y calcula una propuesta desde ese origen; si no se "
                "informa origen, usa el inicio configurado. Esta consulta no reemplaza la distancia "
                "persistida al despachar.")
        guide.p("En el caso de exposición de la ruta 22, el mapa actual muestra 3,19 km y la "
                "routeDistance persistida al despacho es 8,53 km. El reporte conserva 8,53 km como "
                "plan. Son objetos calculados con distintos puntos de origen y conjuntos de paradas: "
                "propuesta actual desde GPS y pendientes frente al plan de despacho desde el inicio "
                "configurado. Ni los 3,19 km ni los 8,53 km constituyen distancia GPS validada del "
                "recorrido real. Explicar esta diferencia antes de comparar mapa y reporte.", "Qué decir")
    elif sid == "W12":
        guide.h("Cómo interpretar la ruta 22 en eficiencia", 2)
        guide.p("Km plan conserva los 8,53 km persistidos al despacho. Los 3,19 km visibles después "
                "en Gestión de despacho proceden de GET /routes/{id}/path, recalculado desde el "
                "origen GPS actual y las paradas pendientes. El reporte no tiene que sustituir su "
                "plan histórico por esa propuesta actual; comparar ambos números como si midieran "
                "el mismo recorrido produciría una conclusión incorrecta.")
        guide.p("En la prueba de exposición de la ruta 22, la pausa prolongada de la demostración "
                "deja un intervalo entre muestras GPS mayor de 900 s. "
                "La distancia GPS y sus métricas derivadas quedan No evaluable; conservar el valor "
                "ausente y no convertirlo en 0 ni rellenarlo con el plan. Los 90 minutos de operación "
                "incluyen esa pausa larga de la exposición. Representan tiempo transcurrido de esa sesión "
                "local, no una entrega real ni minutos de atención al destinatario. Al explicar "
                "Min/parada terminal, recordar que reparte el tiempo total entre paradas terminales "
                "y no elimina automáticamente las pausas de la demostración.", "Qué decir")


def add_screen(guide, screen, captures, cache, code_steps):
    sid = screen["id"]
    guide.h(f"{sid} {screen['title']}", new_page=True)
    guide.p(f"{'Web' if sid.startswith('W') else 'Flutter'} · Ruta {screen['route']} · "
            f"Procesos {', '.join(screen['processes'])} · "
            + (f"Principal de {OWNER[sid]}" if sid in OWNER else "Pantalla de apoyo"))
    guide.p("; ".join(screen["roles"]), "Actor y permiso")
    # Eight old cards contain historical/fragmented introductions. Reuse their
    # business meaning through short current speeches, never their screenshots.
    guide.p(SPEECH.get(sid, screen["source"]), "Qué decir")
    guide.p(" ".join(screen["actions"]), "Qué demostrar")
    if sid == "W02":
        guide.h("Recorrer todos los accesos de Inicio", 2)
        guide.p("Con ADMIN, recorrer las ocho tarjetas de Inicio y desplazarse hasta las últimas, "
                "Vehículos y Compras. Mostrar una captura superior y otra inferior de la ventana "
                "completa para comprobar que los accesos inferiores están visibles y se pueden "
                "utilizar. Con otros roles, recorrer todos los accesos autorizados para esa identidad.")
        guide.p("Home usa minHeight 0 y flex 1 para ajustarse al espacio disponible del contenedor; "
                "overflowY auto permite el desplazamiento vertical y overflowX hidden evita el "
                "desbordamiento horizontal. La corrección permite llegar a las tarjetas inferiores "
                "que antes quedaban recortadas. Es una mejora de navegación y disposición visual; "
                "no modifica Auth, los roles ni las reglas de autorización.", "Qué explicar en el código")
        guide.p("Comprobación prevista de navegación completa: cuando el contenido exceda la altura "
                "visible, verificar en el DOM que scrollHeight sea mayor que clientHeight, que "
                "scrollTop cambie al desplazar y que las últimas tarjetas queden visibles y "
                "accionables. Registrar el resultado real y las capturas superior e inferior "
                "como W02 en el manifest; una captura inferior descartada no acredita este check. "
                "Mantenerlo previsto hasta completar la validación DOM.", "Check de Inicio")
    states = screen["states"]
    if sid == "W07":
        states = ["Un rango invertido impide las cuatro consultas analíticas y también se valida en AnalyticsFilter.",
                  "Cada fuente tiene carga, vacío, error y reintento propios mediante SourceState; el fallo de una no acredita ni invalida por sí solo las otras."]
    guide.p(" ".join(states), "Estados y alternativas previstos")
    guide.h("De la acción al código", 2)
    for flow in screen["flow"]:
        guide.p(flow)
    add_route_metrics_explanation(guide, sid)
    add_code_walk(guide, code_steps)
    ports, tables = persistence(screen, cache, guide.root)
    if sid == "W02":
        guide.p("Inicio navega hacia la funcionalidad elegida. No tiene puerto de persistencia ni tabla SQL propios.", "Puerto y SQL")
    else:
        guide.p(("Puertos referenciados: " + ", ".join(ports) + ". " if ports else
                 "Seguir el repositorio o servicio indicado en el flujo. ") +
                ("Tablas identificadas: " + ", ".join(tables) + "." if tables else
                 "La integración externa indicada en el flujo no implica una tabla nueva por pantalla."), "Puerto y SQL")
    guide.h("Archivos y métodos para abrir en el IDE", 2)
    guide.sources([ref for ref in screen["_refs"] if not ref["file"].endswith(".bpmn")])
    guide.h("Evidencia de esta pantalla", 2)
    for capture in captures:
        guide.image(capture)


def add_evidence(guide, inventory, manifest):
    guide.h("Evidencias de navegación y de depuración", new_page=True)
    shared = next((s for s in inventory.get("sharedFlow", []) if s.get("id") == "S04"), {})
    for step in shared.get("steps", []):
        guide.p(step)
    guide.sources(shared.get("_refs", []))
    extra = [c for c in manifest["screens"] if c["screenId"] not in EXPECTED_IDS]
    if extra:
        for capture in extra:
            guide.image(capture)
    else:
        guide.p("La navegación compartida y las pausas del depurador se comprueban según los checks "
                "registrados. No hay una figura adicional de IDE o panel compartido en esta sesión.")
    guide.h("Registro de pasos y estados capturados", 2)
    guide.p("El número de paso conserva la secuencia de la sesión. Cada figura incluye el estado, "
            "el pie y un enlace a la imagen completa para ampliar textos y columnas. En las tomas con "
            "desplazamiento, cada imagen corresponde a una vista completa de su ventana.")
    guide.table(("Paso", "Pantalla", "Estado y evidencia"), [
        (str(c["sequence"]), c["screenId"], c["state"] + ". " + c["caption"])
        for c in manifest["screens"]
    ], (.5, .8, 5.7))
    guide.h("Pruebas reales y casos previstos", new_page=True)
    guide.p("Un check PASS es una comprobación ejecutada con el alcance indicado en su detalle. "
            "FAIL o ERROR indican un resultado fallido. PLANNED, PENDING, NOT_RUN, NOT_TESTED, "
            "SKIP o BLOCKED conservan trabajo no acreditado; WARN exige leer su detalle. "
            "Las alternativas de cada pantalla permanecen previstas si no existe un check que las acredite.")
    for check in manifest["checks"]:
        guide.p(check_details(check["details"], guide.safe),
                f"{str(check['status']).upper()} · {check['name']}")
    guide.h("Correlación de la jornada", 2)
    # Keep only explicitly innocuous fixture identifiers and counts. Do not dump
    # fixture, runtime, environment, login or debugger connection objects.
    allowed = {"orderid", "orderids", "routeid", "routeids", "driverid", "vehicleid", "tracking",
               "trackings", "date", "startdate", "enddate", "timezone", "incidentid", "actionid",
               "orderscount", "routescount", "rucficticio", "synthetic", "fictitious"}
    emitted = False
    for key, value in manifest["fixture"].items():
        if fold(key).replace("_", "") in allowed and isinstance(value, (str, int, float, bool, list)):
            if isinstance(value, list) and not all(isinstance(v, (str, int, float, bool)) for v in value):
                continue
            guide.p(check_details(value, guide.safe), key)
            emitted = True
    if not emitted:
        guide.p("Correlacionar los identificadores ficticios visibles en las figuras y los detalles "
                "de los checks para seguir la misma jornada.")
    guide.p("Los indicadores locales describen la población y la fecha de la demostración. "
            "No acreditan por sí solos aceptación empresarial ni mejora causal de costos, puntualidad o servicio.")


def verify_package(blob, manifest):
    # Structural integrity only; main must still render and inspect every page.
    with zipfile.ZipFile(io.BytesIO(blob)) as archive:
        media = [hashlib.sha256(archive.read(name)).hexdigest() for name in archive.namelist()
                 if name.startswith("word/media/")]
        require(set(media) == {c["_sha256"] for c in manifest["screens"]},
                "La colección de imágenes DOCX no coincide con los PNG/JPEG originales del manifest.")
        xml = archive.read("word/document.xml").decode("utf-8")
        styles = archive.read("word/styles.xml").decode("utf-8")
        require("<w:pBdr" not in xml + styles, "Se detectó un borde de párrafo no permitido.")
        require('w:type="page"' not in xml, "Se detectó un salto de página vacío no permitido.")
        require(xml.count("<wp:inline") == len(manifest["screens"]), "No se incluyeron todas las capturas.")


def build(root, inventory, manifest, cache):
    code_walks = prepare_code_walks(root, cache)
    guide = Guide(root, manifest)
    title = "EcoRoute Guía total del recorrido de negocio y del IDE"
    guide.doc.add_paragraph(title, style="Title")
    guide.md.append("# " + title + "\n")
    guide.p(INTRO)
    guide.p(f"Sesión {manifest['runId']} · Registro {manifest['at']} · Zona de negocio America/Lima")
    guide.p("Enzo presenta Pedidos y Despacho; Luis, Mis rutas y POD; Renzo, Incidencias y Acciones; "
            "Adrian, Dashboard y BI. Las once pantallas de apoyo completan el recorrido. "
            "Las instrucciones indican qué demostrar y qué decir; las figuras y los checks "
            "permiten contrastarlo con lo que ocurrió en la sesión.")
    guide.p(str(root), "Raíz de las rutas locales")
    guide.h("Orden de lectura", 2)
    guide.p("Preparación e IDE → negocio y arquitectura → accesos y recursos → pedido y despacho → "
            "ejecución móvil → incidencias y análisis → acciones y evidencias de pruebas.")
    add_preparation(guide, manifest)
    add_business(guide, inventory)
    screens = {s["id"]: s for s in inventory["web"] + inventory["mobile"]}
    for sid in WALK:
        add_screen(guide, screens[sid], [c for c in manifest["screens"] if c["screenId"] == sid], cache, code_walks[sid])
    add_evidence(guide, inventory, manifest)
    blob, markdown = guide.finish()
    verify_package(blob, manifest)
    output = root / OUTPUT
    output.parent.mkdir(parents=True, exist_ok=True)
    # Both payloads are complete and checked before the first output write.
    output.with_suffix(".md").write_text(markdown, encoding="utf-8")
    output.write_bytes(blob)
    return output


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--inventory", type=Path, default=INVENTORY, help="Ruta relativa a ROOT")
    parser.add_argument("--manifest", type=Path, default=MANIFEST, help="Ruta relativa a ROOT")
    parser.add_argument("--validate-only", action="store_true", help="Solo lectura; no importa python-docx ni escribe archivos")
    args = parser.parse_args(argv)
    root = args.root.resolve()
    try:
        inv_path = local_path(root, str(args.inventory), "Inventario requerido")
        manifest_path = local_path(root, str(args.manifest), "Manifest requerido")
        inventory, manifest, cache = validate(root, inv_path, manifest_path)
        if args.validate_only:
            prepare_code_walks(root, cache)
            print(f"VALIDADO: 19 pantallas; {len(manifest['screens'])} PNG/JPEG originales; fuentes existentes. No se generaron documentos.")
            return 0
        output = build(root, inventory, manifest, cache)
        print(f"Generados: {output.name} y {output.with_suffix('.md').name}. Pendiente render y QA visual por main.")
        return 0
    except (GuideError, OSError, ImportError, zipfile.BadZipFile) as exc:
        # Error messages never dump raw manifest/runtime/environment payloads.
        print("ERROR: " + str(exc), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
