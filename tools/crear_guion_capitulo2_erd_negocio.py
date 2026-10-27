"""Guion de las 56 láminas de Capítulo 2, con explicación oral del ERD."""

from pathlib import Path

import crear_guion_capitulo2_mockups as prior


base = prior.base


def erd(title: str, cue: str, speech: str, bridge: str, seconds: int = 110) -> dict:
    return base.slide(0, title, cue, speech, bridge, seconds, "Modelo y diccionario")


ERD_SLIDES = [
    erd("El modelo de datos del negocio conecta 16 tablas",
        "Señalar la cadena superior drivers, vehicles, routes y orders; después recorrer las entidades inferiores. No intentar leer todas las columnas de la vista general.", """
        Profesor, entramos al modelo de datos. Esta primera lámina ofrece una vista de conjunto, no un reemplazo de los diagramas de detalle. Hemos delimitado el ERD al negocio de reparto: dieciséis tablas, ciento cuarenta y una columnas y diecisiete claves foráneas físicas, tomadas de las migraciones V1 a V8. Una clave foránea física significa que PostgreSQL puede comprobar la referencia al guardar la fila; no la deducimos porque dos columnas tengan nombres parecidos.

        Leamos la cadena superior de izquierda a derecha. Drivers guarda al conductor y vehicles al vehículo. Routes relaciona ambos recursos con una jornada; orders vincula cada pedido con una ruta cuando se asigna. A partir de orders aparecen la prueba de entrega, el historial de estados, las líneas de producto y las notificaciones. A partir de routes y de los recursos se desprenden GPS, incidencias, gastos, combustible, mantenimiento, contratos y turnos.

        Las tarjetas inferiores muestran qué información soporta cada fase de los BPMN: planificar, ejecutar, supervisar y analizar. Algunas tablas se repiten en las láminas siguientes para que cada relación pueda leerse con sus columnas completas; no son copias físicas. El conteo de dieciséis es de tablas distintas.
    """, "Ahora explicamos cómo se asignan los recursos a una ruta.", 125),

    erd("Recursos y ruta claves de asignación",
        "Apuntar a drivers.id y vehicles.id, seguir las líneas verdes hasta routes.driver_id y routes.vehicle_id; leer los tipos y la leyenda inferior.", """
        En esta vista, cada tarjeta se parece al diseñador de tablas de PostgreSQL. El encabezado identifica la tabla; cada renglón muestra el nombre de la columna y su tipo SQL. PK significa clave primaria, FK clave foránea declarada, UQ valor único y el asterisco indica NOT NULL. TIMESTAMPTZ es la abreviatura de TIMESTAMP WITH TIME ZONE. Las líneas conectan la columna padre con la hija; la notación junto al extremo expresa si la relación es obligatoria, opcional, única o de muchos registros.

        Drivers tiene identificadores y datos del conductor, incluida una licencia única. Vehicles guarda placa única y capacidad en peso y volumen. La tabla routes contiene dos FK reales: driver_id hacia drivers.id y vehicle_id hacia vehicles.id. Con ellas se puede conocer el recurso asignado a cada ruta. Ambas columnas admiten NULL en las migraciones: la base permite crear una ruta todavía sin recurso. Si el proceso P02 exige que nadie salga sin conductor o vehículo, esa regla debe validarse antes del despacho; el ERD por sí solo no la garantiza.

        Routes también conserva fecha, estado, horas de inicio y fin, distancia, geometría y duración estimada. Estos campos separan el plan de la ejecución y ayudan a explicar por qué un recorrido aparece dibujado en el mapa.
    """, "Una vez definida la ruta, asociamos los pedidos y su secuencia.", 135),

    erd("Pedidos la ruta organiza la secuencia de paradas",
        "Mostrar routes.id y orders.route_id; luego orders.stop_sequence y routes.geometry. Detenerse en orders.driver_id para aclarar el límite referencial.", """
        Aquí unimos la jornada con cada pedido. Orders.route_id es una FK a routes.id. Como la columna puede ser nula, un pedido puede existir antes de ser asignado a una ruta. Una ruta puede reunir muchos pedidos, pero la base no exige que una ruta ya creada tenga alguno. Esta diferencia entre capacidad del esquema y política operativa es importante en P01 y P02: confirmar el pedido no equivale a despacharlo.

        Orders contiene el tracking, estado, referencia externa, destinatario, dirección, coordenadas, prioridad y ventana estimada de entrega. En la migración V8 se añadió orders.stop_sequence: es la posición planeada de esa parada en su ruta. No existe una tabla llamada order_stop_sequence. La secuencia puede compararse con el orden real de visita. Routes.geometry conserva el camino sobre calles y total_duration_min la duración calculada; son atributos de la ruta, no entidades adicionales.

        Quiero subrayar una limitación de integridad. Orders.driver_id aparece como BIGINT, pero no lleva REFERENCES drivers(id). Por tanto, en el diagrama queda como campo ordinario y no dibujamos una línea hacia drivers. Si se consulta quién conduce la ruta, la relación físicamente garantizada pasa por orders.route_id, routes.id y routes.driver_id. Antes de añadir otra FK habría que decidir si orders.driver_id es redundante, histórico o una reasignación por pedido.
    """, "Con el pedido localizado, vemos cómo se conserva su resultado.", 145),

    erd("Entrega evidencia única e historial de cambios",
        "Señalar la FK y la marca de unicidad en delivery_proofs.order_id; contrastarla con order_status_history.order_id.", """
        Esta lámina explica dos tipos de trazabilidad. Delivery_proofs.order_id referencia orders.id y además es NOT NULL y UNIQUE. Una fila de POD siempre corresponde a un pedido válido y no pueden existir dos filas de POD para el mismo pedido. Del otro lado, la base permite que un pedido todavía no tenga POD; por eso la cardinalidad desde orders hacia delivery_proofs es cero o una. La prueba guarda URL de imagen, firma, nombre y DNI del receptor, fecha de verificación y coordenadas. El modelo físico admite nulos en varios de esos campos; el requisito de una fotografía obligatoria, si la empresa lo aprueba, se debe imponer en el flujo de confirmación y probarse.

        Order_status_history es diferente. Cada fila registra un estado, motivo, ubicación, autor del cambio y momento. Un pedido puede acumular varios eventos: admitido, en ruta, intento fallido o entregado. La FK order_id de este historial admite NULL en la migración; eso no es ideal para auditoría, pero es el estado real del script. Podemos proponer endurecerla tras revisar los datos existentes.

        Para el BPMN P03, la conclusión es clara: cambiar el estado a Entregado no demuestra por sí solo que exista una POD suficiente. El proceso debe verificar ambos elementos antes de cerrar la entrega como probada.
    """, "El pedido también puede contener productos y originar avisos.", 145),

    erd("Detalle de pedido productos y notificaciones",
        "Recorrer orders.id a order_items.order_id; desde products.id hacia order_items.product_id; terminar en notifications.order_id.", """
        Un pedido puede tener varias líneas de detalle en order_items. Cada línea puede referenciar un producto del catálogo mediante product_id. Así, order_items resuelve la relación de muchos a muchos: un pedido reúne productos y un producto puede aparecer en muchos pedidos. La línea guarda cantidad, precio unitario y total, mientras products conserva SKU único, nombre, categoría, peso, volumen y precio de catálogo. El precio de la línea permite conservar lo cobrado o declarado en el pedido aunque el precio de catálogo cambie después.

        A la derecha también aparecen notifications. Su order_id es una FK a orders.id, pero nullable, por lo que el sistema puede guardar avisos generales no vinculados a un pedido. El campo is_read permite saber si el aviso se ha marcado como leído. La existencia de esta tabla no prueba que cada evento del BPMN dispare una notificación push real; esa automatización debe validarse aparte.

        La tarjeta orders se repite completa para que se vea de dónde salen ambas relaciones. No se suma otra vez en el inventario de dieciséis tablas. En la presentación el trazo une solo las tres FK declaradas en SQL.
    """, "Pasemos al seguimiento del vehículo durante la jornada.", 130),

    erd("Seguimiento posiciones vinculadas a flota",
        "Mostrar las dos FK de vehicle_gps_history y después señalar ping_time, latitude, longitude, speed_kmh y heading_degrees.", """
        Vehicle_gps_history almacena cada reporte de ubicación con latitud, longitud, velocidad, rumbo y hora de recepción. Tiene dos FK físicas: vehicle_id hacia vehicles.id y driver_id hacia drivers.id. Ambas admiten NULL. Esta estructura permite conocer el rastro de la unidad y, cuando está informado, del conductor que la operaba. Una misma unidad y un mismo conductor pueden generar muchas posiciones a lo largo del tiempo.

        Para P07 Supervisar la jornada, el valor está en ordenar esos registros por ping_time y compararlos con la ruta prevista. Eso ayudaría a detectar falta de señal, desvíos o una parada prolongada, siempre que existan umbrales operativos acordados. No debemos decir que el GPS demuestra una entrega: una coordenada cercana al cliente no contiene foto, firma ni identificación del receptor. Es la POD la que respalda la confirmación.

        También debemos distinguir diseño físico y funcionamiento del dispositivo. La tabla puede almacenar pings, pero el intervalo de envío, la precisión y la recuperación tras desconexión dependen de la app móvil y de pruebas en campo. El ERD muestra dónde queda el dato, no certifica que siempre llegue.
    """, "La siguiente vista relaciona incidencias y costos con cada ruta.", 130),

    erd("Ruta incidentes y gastos trazables",
        "Seguir routes.id hacia incidents.route_id y route_expenses.route_id; señalar las columnas de estado y monto.", """
        Esta lámina cubre dos hechos distintos de la ejecución. Incidents registra tipo, severidad, descripción, posición, fecha de reporte y fecha de resolución. Route_expenses registra el tipo de gasto, monto, descripción, comprobante y fecha. En ambos casos route_id es una FK real hacia routes.id, aunque nullable. Una ruta puede tener cero o muchos incidentes y cero o muchos gastos.

        En los BPMN, un incidente relevante puede pasar de P07 Supervisar a P04 Resolver incidencias y volver a la ejecución o terminar con una reprogramación. La tabla de incidentes ayuda a documentar el motivo, pero la rama del proceso determina quién decide y cuándo se cierra. Un gasto puede asociarse al mismo episodio, como un peaje o una reparación de emergencia, pero no existe una FK directa entre incidents y route_expenses. Si el proyecto necesita imputar el costo de un incidente concreto, habría que diseñar esa relación de forma explícita.

        Para inteligencia de negocios, estas tablas permiten calcular costos por ruta y analizar causas recurrentes. No son indicadores ya calculados. Las definiciones, el corte temporal y las exclusiones deben aprobarse antes de presentar resultados a MICOTRANS.
    """, "Además del costo de la ruta, debemos mantener los recursos de flota.", 135),

    erd("Flota combustible y mantenimiento",
        "Mostrar fuel_logs.vehicle_id y fuel_logs.driver_id; luego vehicle_maintenance_logs.vehicle_id y las columnas de fecha, odómetro y costo.", """
        Fuel_logs vincula una carga de combustible con un vehículo y, si se informa, con un conductor. Almacena fecha, litros, costo total, lectura de odómetro y grifo. Sus dos FK son físicas y nullable. Vehicle_maintenance_logs vincula el servicio con vehicles.id mediante otra FK; conserva fecha, tipo, descripción, odómetro, costo, taller y fecha prevista para la próxima intervención.

        Las tarjetas drivers y vehicles no son nuevas; se repiten para mostrar las dependencias. En P06, estos datos ayudan a decidir si una unidad está apta para la jornada. El hecho de que el vehículo tenga una fila en vehicles no basta para declararlo disponible: se necesita contrastar mantenimiento, capacidad y estado. La tabla de combustible también puede alimentar un indicador de costo por kilómetro, pero hay que conciliar litros, importes y kilometraje con el período correcto.

        Aquí no hemos incluido la tabla purchases, aunque existe en el proyecto. Purchases carece de una FK hacia vehicles o estas bitácoras en las migraciones actuales. Incluirla con una línea dibujada inventaría integridad que PostgreSQL no tiene. El proceso de compras se explica en P09, fuera de este grafo conectado de reparto.
    """, "Por último, revisamos la capacidad humana asociada al conductor.", 135),

    erd("Conductor contrato y turnos",
        "Señalar la doble marca FK UQ de driver_contracts.driver_id y contrastarla con la FK simple de driver_shifts.driver_id.", """
        Driver_contracts.driver_id es una clave foránea y además única. Eso limita la tabla a un contrato asociado por conductor en el esquema actual, pero el campo admite NULL: podrían existir filas de contrato todavía sin conductor vinculado. La notación cero o uno del lado del contrato refleja esa combinación de nulabilidad y unicidad. La tabla guarda tipo de contrato, inicio, fin y salario base.

        Driver_shifts.driver_id es una FK sin unicidad. Un conductor puede tener muchos turnos, cada uno con inicio, fin y estado. Como también es nullable, el script permite registrar un turno sin conductor. En el proceso P02, la disponibilidad se debe validar antes de asignar una ruta; el ERD muestra qué tablas podrían aportar la información, pero no impone por sí solo que los horarios no se solapen.

        Esta vista deja una pregunta de diseño para el piloto: ¿debe conservarse solo el contrato vigente o el historial de renovaciones? La restricción UNIQUE actual impide varios contratos ligados al mismo conductor. Si MICOTRANS necesita historial, el modelo deberá cambiar; no corresponde afirmar que ya está resuelto.
    """, "Cerremos el ERD delimitando qué garantiza y qué queda fuera.", 130),

    erd("Alcance del ERD e integridad referencial",
        "Leer las dos columnas de la lámina y detenerse en orders.driver_id. Aclarar que las omisiones son del ERD de reparto, no de todos los módulos del sistema.", """
        El alcance final del ERD es el grafo conectado directamente al reparto: dieciséis tablas, ciento cuarenta y una columnas y diecisiete claves foráneas declaradas. Solo esas relaciones se dibujaron. Una FK protege que el identificador referenciado exista; no garantiza por sí sola que el pedido esté aprobado, que la foto sea suficiente o que el vehículo esté disponible. Esas condiciones pertenecen también a los BPMN, las validaciones de aplicación y las pruebas de operación.

        Orders.driver_id sigue siendo un BIGINT sin FK a drivers; debemos resolver la regla de asignación antes de reforzar el esquema. Hubs y purchases existen, pero no tienen FK con el grafo de entregas. Las tablas auth de permisos son soporte técnico; Keycloak conserva identidad y credenciales en su propia base. El bloque corp es un conjunto heredado de referencia y no representa automáticamente a MICOTRANS. Ninguno de esos objetos aparece como entidad conectada en estas diez láminas.

        El ERD editable en Mermaid y los SVG permiten examinar cada campo y ampliar las relaciones. Lo importante para el profesor es nuestra disciplina de diseño: partimos del SQL verdadero, declaramos las limitaciones y distinguimos lo que la base protege de lo que el negocio todavía debe aprobar y validar. Ahora resumimos los campos críticos en el diccionario.
    """, "Veamos el diccionario para los datos que determinan la jornada.", 135),
]


base.SLIDES = base.SLIDES[:42] + ERD_SLIDES + base.SLIDES[44:]
for number, item in enumerate(base.SLIDES, 1):
    item["n"] = number

# Las tres láminas de diccionario se mantienen pero ajustan su lectura a la
# presentación con ERD de negocio y al nombre físico real stop_sequence.
base.SLIDES[52].update(
    title="Pedidos rutas y secuencia",
    cue="Leer orders, routes y order_status_history; cerrar señalando orders.stop_sequence.",
    speech="""Profesor, el diccionario traduce las tarjetas del ERD a reglas de interpretación. Orders guarda estado, destinatario, dirección y ventana horaria; su route_id es una FK opcional hasta que se planifica la jornada. Routes guarda fecha, recursos, geometría y tiempos. Order_status_history conserva cada transición con su momento y motivo, por lo que permite reconstruir lo ocurrido, no solo leer el estado actual.\n\nLa cuarta línea es orders.stop_sequence: una columna de orders, no una tabla distinta. Representa el orden planeado de visita dentro de la ruta. Para evaluar eficiencia y cumplimiento, debemos conservar tanto esa secuencia como la hora y el resultado real de cada parada. En el documento técnico, el diccionario registra tipo SQL, nulabilidad, clave y valor por defecto cuando existe.""",
    bridge="El siguiente conjunto de campos conserva la evidencia y los eventos de campo.",
)
base.SLIDES[54].update(
    title="Flota y soporte operativo",
    cue="Señalar drivers y vehicles, luego fuel_logs, vehicle_maintenance_logs y driver_shifts.",
    speech="""Estas cuatro entradas del diccionario sustentan la disponibilidad y el costo de la flota. Drivers y vehicles identifican conductor, placa y capacidades que P02 necesita al planificar. Fuel_logs conserva litros, costo y odómetro; vehicle_maintenance_logs documenta servicios, taller, costo y próxima intervención. Driver_shifts permite revisar cuándo está programado cada conductor.\n\nLa decisión de habilitar un recurso para una ruta no nace automáticamente de una fila existente. Debe comprobarse que el vehículo esté apto, que la capacidad alcance y que el conductor tenga disponibilidad. Para reportes de costo por entrega o por kilómetro, también debemos conciliar períodos, montos y kilometraje. Esos cálculos pertenecen a la capa analítica; el diccionario señala qué datos físicos los pueden alimentar.""",
    bridge="Con procesos, pantallas y datos relacionados, cerramos el capítulo.",
)

base.QUESTIONS = [
    ("Qué alcance tiene el ERD que aparece en la presentación",
     "El ERD de negocio selecciona 16 tablas, 141 columnas y las 17 FK físicas que conectan el reparto. El esquema PostgreSQL completo tiene más tablas. Se excluyen corp_* y auth_* por no ser entidades directas de reparto; hubs y purchases no están conectadas por FK a este grafo. Compras sigue siendo un proceso del proyecto."),
    ("Por qué orders.driver_id no tiene línea hacia drivers",
     "La columna BIGINT existe, pero ninguna migración V1–V8 declara REFERENCES drivers(id) para ella. La relación garantizada es orders.route_id hacia routes.id y routes.driver_id hacia drivers.id. Dibujar una FK adicional sería engañoso."),
    ("Qué significan PK FK UQ y el asterisco",
     "PK es clave primaria; FK es clave foránea declarada en PostgreSQL; UQ indica unicidad y el asterisco marca NOT NULL. TIMESTAMPTZ abrevia TIMESTAMP WITH TIME ZONE. La cardinalidad se calcula a partir de nulabilidad y unicidad de la FK, no de una política supuesta."),
    ("Por qué un pedido puede tener una sola POD",
     "delivery_proofs.order_id es FK, NOT NULL y UNIQUE. Cada fila de POD necesita un pedido válido y un pedido admite como máximo una fila de POD. Un pedido aún no entregado puede tener cero. La obligatoriedad de foto o firma no queda garantizada por esa FK porque las columnas de evidencia admiten nulos."),
    ("Por qué el contrato es cero o uno por conductor",
     "driver_contracts.driver_id es FK UNIQUE pero nullable. UNIQUE limita a un contrato ligado por conductor; NULL permite filas todavía no vinculadas. Si se requiere historial de contratos, se debe revisar esta restricción."),
] + [qa for qa in base.QUESTIONS if qa[0] != "Qué representa el ERD completo y qué relaciones faltan"]

base.OUT = Path(__file__).resolve().parents[1] / "docs" / "Guion_Detallado_Exposicion_Capitulo_2_EcoRoute_ERD_Negocio.docx"
base.DECK = "EcoRoute_Capitulo_2_Diseno_ERD_Negocio_v2.pptx"


if __name__ == "__main__":
    base.make_doc()
