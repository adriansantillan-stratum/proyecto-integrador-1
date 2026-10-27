"""Actualiza el guion del capítulo 2 para los mockups ordenados por P01-P09."""

from pathlib import Path

import crear_guion_capitulo2 as base


def part(title: str, cue: str, speech: str, bridge: str) -> dict:
    return base.slide(0, title, cue, speech, bridge, 95, "Mockups y analítica")


MOCKUPS = [
    part("P01 Confirmar pedidos: recepción y registro", "Señalar primero la bandeja de pedidos y después el formulario ampliado de la derecha.", """
        Profesor, empezamos los mockups en el mismo orden de los BPMN. Estas dos capturas corresponden a P01. A la izquierda, la bandeja web permite localizar una solicitud por tracking, reconocer al cliente y ver el estado actual. A la derecha, el formulario de alta recoge el número, el nombre, la dirección y el contacto. Hemos ampliado el formulario para que se pueda leer durante la exposición. Ambas son pantallas reales de la interfaz, mostradas con datos de prueba.

        Este primer tramo equivale a recibir y registrar. Todavía no equivale a confirmar comercialmente el pedido. Según el BPMN, el responsable debe verificar completitud, cobertura y aceptación de condiciones. Si falta información, solicita subsanación; si el caso no es viable, lo cierra con motivo. Solo un pedido confirmado pasa a P02.
    """, "Veamos cómo se revisa cuando llega por carga masiva o se abre su detalle."),

    part("P01 Confirmar pedidos: importación y revisión", "Recorrer Importar CSV, luego el detalle del pedido; remarcar que ambos son pasos previos a confirmar.", """
        Aquí continuamos P01. La primera captura muestra el cuadro de importación de un archivo CSV. Esta entrada es útil cuando la jornada trae muchos pedidos, pero no debe saltarse las validaciones de negocio. La segunda captura muestra el detalle de un pedido específico: estado, cliente, dirección y datos de contacto. El operador puede comprobar que la fila importada tenga sentido antes de incorporarla a una ruta.

        La salida del proceso no aparece como una aprobación formal completa en estas pantallas. Esa es precisamente la diferencia entre la interfaz actual y el diseño objetivo: debemos registrar qué dato se corrigió, quién aceptó una alternativa y en qué momento se declaró el pedido confirmado. Cuando esa compuerta da Sí, el caso se transfiere a P02. Si da No definitivo, termina como solicitud no admitida, no viable o desistida.
    """, "Con pedidos admitidos, el Dispatcher prepara la jornada."),

    part("P02 Preparar la jornada: recursos y ruta", "A la izquierda, leer conductor, vehículo y fecha; a la derecha, seguir la ruta sobre el mapa.", """
        P02 comienza con una cartera de pedidos confirmados. El formulario de la izquierda permite escoger conductor, vehículo y fecha de ejecución. La vista derecha muestra la ruta propuesta sobre calles, con una tarjeta de jornada y seguimiento. Es la parte visible de la asignación y el cálculo: EcoRoute ofrece al Dispatcher información para decidir el plan.

        El BPMN incluye más controles que los campos de este formulario. Antes de aprobar, hay que verificar capacidad, ventanas horarias y disponibilidad real. Si la carga excede al vehículo o la secuencia no cumple horarios, el Dispatcher ajusta la asignación y vuelve a calcular. Si Jefatura observa el plan, vuelve a revisión. Una línea dibujada en el mapa no constituye autorización de salida.
    """, "La siguiente pareja muestra cómo llega la jornada al conductor."),

    part("P02 Preparar la jornada: transferencia al móvil", "Comparar la consola del Dispatcher con Mis rutas de hoy de la app móvil.", """
        Esta lámina representa la transferencia entre oficina y campo. A la izquierda está la ruta que observa el Dispatcher: conductor, estado y recorrido. A la derecha, el conductor ve las paradas del día numeradas y el camino resaltado en su teléfono. Las pantallas hacen comprensible el traspaso de una misma jornada entre dos actores.

        En el BPMN la frontera de P02 es más exigente: se emite la hoja de ruta, el conductor revisa carga y vehículo y confirma que puede salir. Si no puede hacerlo, se busca sustituto o se suspende el despacho y los pedidos regresan a cartera. La imagen móvil muestra recepción visual de la ruta, pero no demuestra por sí sola el acuse formal. Con la salida confirmada, comienza P03.
    """, "Una vez iniciada la ruta, seguimos una parada en el campo."),

    part("P03 Ejecutar entregas: parada y pedido", "Indicar el número de parada en la ruta y luego el detalle del pedido abierto.", """
        P03 se ejecuta por cada parada. Primero el conductor ve la lista ordenada sobre el mapa, elige la parada y se desplaza. Después abre el detalle del pedido. Allí identifica al cliente y la dirección, y encuentra la selección de estado. Estas dos capturas móviles corresponden a los primeros pasos operativos de la entrega.

        El BPMN pregunta si el conductor pudo acceder al destino y si encontró al receptor. Si la respuesta es No, no puede tratar la parada como entregada. Debe registrar la causa y pasarla a P04, mientras continúa con otras paradas cuando sea posible. Si el receptor está presente, aún falta validar aceptación de los bultos. El cambio de pantalla no equivale a una entrega aceptada.
    """, "Veamos cómo se documenta el resultado de esa visita."),

    part("P03 Ejecutar entregas: prueba de entrega", "Mostrar el estado en el detalle y la captura de foto, receptor y firma.", """
        Aquí se ve el segundo tramo de P03. En el detalle del pedido el conductor selecciona el resultado; al optar por entrega, la vista ampliada solicita respaldo: fotografía, identificación del receptor y firma. La app proporciona la estructura de una prueba de entrega, o POD, y permite volver después a la siguiente parada.

        Debemos explicar la compuerta de calidad de evidencia. Si falta foto, firma o identificación según la política aprobada, la prueba queda observada y el caso va a P04. Si los datos están completos, aún hay que asociar hora y ubicación y confirmar la sincronización. Un POD pendiente por falta de red no se presentará como verificado hasta que llegue y pueda revisarse. Solo entonces se cierra la parada y su resultado alimenta P05.
    """, "Cuando una parada no se puede cerrar, entra la gestión de incidencias."),

    part("P04 Resolver incidencias: motivo y decisión", "Señalar la evidencia móvil y luego el cambio de estado con motivo en web.", """
        En P04 mostramos la información que hoy puede aportar cada actor. El conductor dispone del formulario de evidencia de la parada. El Dispatcher, en la consola web, puede abrir un pedido fallido y cambiar su estado indicando un motivo; la interfaz advierte que la acción quedará en auditoría. La captura se tomó de la interfaz React con datos locales de prueba, no de un caso real de MICOTRANS.

        Ese formulario respalda un registro básico, pero el BPMN exige un expediente más completo. El Dispatcher debe decidir si procede reintentar hoy, reprogramar para otra fecha o cerrar fallido con autorización. Un reintento vuelve a P03, una nueva fecha vuelve a P02 y un cierre fallido alimenta P05. Si el sustento de la excepción es insuficiente, se solicita complemento antes de decidir; no basta con cambiar una etiqueta de estado.
    """, "Después del cierre operativo, los resultados se evalúan en conjunto."),

    part("P05 Evaluar resultados: panel y reporte", "Comparar el panel de control con el reporte exportable; detenerse en filtros y cifras.", """
        P05 reúne los resultados de pedidos, rutas e incidencias al cierre de una jornada o periodo. El panel de la izquierda muestra volumen y estados; el reporte de la derecha permite filtrar y exportar datos. Son pantallas existentes que dan una primera lectura operativa y facilitan encontrar dónde profundizar.

        El BPMN empieza preguntando si los datos consolidados son confiables. Si hay estados o pruebas incompletas, el corte debe quedar provisional y solicitar corrección. Solo después se calculan indicadores con fórmula y periodo definidos. Un desvío necesita análisis de causa, propuesta, responsable y verificación de efecto. Por eso la gráfica ayuda a Jefatura a decidir, pero no reemplaza la revisión del dato ni demuestra una mejora por sí misma. Más adelante veremos los cinco tableros analíticos propuestos.
    """, "Pasamos ahora a los procesos que habilitan la operación: primero los recursos."),

    part("P06 Habilitar recursos: conductores", "Recorrer el padrón de conductores y ampliar los campos del formulario de alta.", """
        En el proceso P06, la pantalla de la izquierda lista conductores y su estado administrativo. A la derecha se ve el alta con nombre, licencia, teléfono, correo y el interruptor Activo. La captura del formulario se realizó sobre el componente real de la web; los registros son de demostración.

        En el BPMN, registrar y marcar Activo no basta para liberar a una persona a la jornada. Administración debe reunir documentación, Jefatura verificar vigencia de licencia y aptitud, y el Dispatcher comprobar disponibilidad para esa fecha. Si faltan documentos, la solicitud se subsana o se archiva. Si el conductor no es apto, queda bloqueado. Solo un recurso habilitado llega a P02 como opción asignable.
    """, "La misma lógica se aplica al vehículo."),

    part("P06 Habilitar recursos: vehículos", "Señalar placa, capacidad y estado en el padrón; luego el formulario de alta.", """
        La vista de vehículos lista placa, marca, modelo, capacidad y estado. El formulario permite dar de alta una unidad o actualizar su ficha. Estos campos ayudan a que el Dispatcher no asigne una carga sin conocer el recurso disponible.

        Pero el proceso de negocio requiere comprobar más que el registro. Jefatura debe revisar condición técnica, documentación y disponibilidad; si la unidad está en mantenimiento o no cumple la capacidad necesaria, no debe quedar habilitada para la jornada. Si la unidad es apta pero no está libre hoy, se agenda para otra fecha. Esta es la diferencia entre alta de datos y habilitación operativa. Solo el resultado de P06 permite que P02 utilice ese vehículo en el plan.
    """, "Con recursos asignados y ruta iniciada, el Dispatcher supervisa el avance."),

    part("P07 Supervisar la jornada: web y campo", "Comparar el mapa de seguimiento web con la ruta activa que ve el conductor.", """
        P07 funciona mientras P03 ejecuta las entregas. La consola web muestra la ruta y su seguimiento; el conductor ve el recorrido y las paradas en la app. Esta comparación permite conversar sobre un mismo trayecto desde oficina y campo. La pantalla no se debe leer como una prueba de que todos los reportes GPS llegan siempre a tiempo.

        El BPMN distingue datos recientes de pérdida de señal. Cuando falta posición, el Dispatcher contacta al conductor y documenta la situación. Ante una demora, contrasta la causa antes de escalar a P04. Si la ruta acaba, su resultado pasa a P05; si sigue activa, continúa el monitoreo. Ninguna ubicación en el mapa sustituye el POD de cada parada. Los umbrales, la frecuencia y el manejo de desconexión requieren validación operativa.
    """, "El acceso a estas funciones depende de identidad y rol."),

    part("P08 Administrar accesos: identidad y usuarios", "Mostrar el login móvil y después el listado de asignaciones locales de la web.", """
        P08 comienza con una solicitud de alta, cambio o baja. La captura móvil muestra el ingreso del conductor mediante la identidad del proyecto. La web muestra asignaciones locales de usuario y rol. Es importante explicar la separación técnica: Keycloak emite los tokens de identidad, mientras las tablas auth de EcoRoute guardan un modelo local de permisos.

        En el BPMN, Jefatura autoriza la solicitud y determina el mínimo privilegio antes de activar una cuenta. Si la solicitud no está autorizada, termina denegada. Estas dos pantallas ilustran identidad y administración, pero no muestran que una asignación local se sincronice automáticamente con Keycloak. Esa integración y la prueba efectiva del rol forman parte del trabajo por validar antes de un piloto.
    """, "La siguiente lámina muestra la asignación y lo que ve el propio usuario."),

    part("P08 Administrar accesos: rol y perfil", "Indicar el formulario de rol local y el perfil visible en el teléfono.", """
        En la consola web aparece el formulario Asignar Rol a Usuario, con ID externo y selección de rol. En la app móvil, el conductor puede ver su perfil y cerrar sesión. La relación deseada es que el usuario trabaje solo con los permisos de su cargo y pueda comprobar con qué identidad está operando.

        El BPMN exige una verificación adicional: después del alta o cambio se prueba el acceso real; si el permiso no corresponde, Administración corrige y repite la prueba. En una baja, se revoca el acceso y las sesiones. El formulario local no modifica por sí mismo los roles del token de Keycloak. Por tanto, mostramos la interfaz existente y señalamos explícitamente que la sincronía de roles y la revocación efectiva todavía deben comprobarse.
    """, "El último proceso de apoyo es la compra operativa."),

    part("P09 Registrar compras: listado y alta", "Seguir la fila del listado y después los campos del formulario de compra.", """
        En P09 la pantalla web lista descripción, proveedor, monto, estado y categoría. El formulario de alta recoge esos datos y una nota. Ahora sí mostramos el módulo de compras que faltaba en la presentación anterior. Las capturas se tomaron de la interfaz real de React con una respuesta local de ejemplo, de modo que se pueda apreciar su diseño sin afirmar que son compras de MICOTRANS.

        El BPMN comienza antes del registro: primero se comprueba si ya existe un recurso útil. Si existe, la necesidad se cubre sin comprar. Si no, se evalúa costo y presupuesto y Jefatura autoriza o rechaza. Después de comprar, se verifica la recepción. Una compra observada se reclama; una recepción conforme se registra y, si incorpora un conductor o vehículo, puede iniciar P06. La tabla no demuestra por sí sola autorización ni recepción conforme.
    """, "Con las pantallas asociadas a los nueve BPMN, pasamos a la propuesta analítica."),
]


base.SLIDES = base.SLIDES[:21] + MOCKUPS + base.SLIDES[27:]
for index, item in enumerate(base.SLIDES, 1):
    item["n"] = index
base.OUT = Path(__file__).resolve().parents[1] / "docs" / "Guion_Detallado_Exposicion_Capitulo_2_EcoRoute_Mockups_por_Proceso.docx"
base.DECK = "EcoRoute_Capitulo_2_Diseno_Mockups_por_Proceso_v2.pptx"

if __name__ == "__main__":
    base.make_doc()
