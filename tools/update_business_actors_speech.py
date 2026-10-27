"""Alinea el guion del capítulo 2 con BPMN centrados en responsables de negocio."""
from pathlib import Path
from docx import Document


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'docs/Guion_Detallado_Exposicion_Capitulo_2_EcoRoute_Flujo_Corregido.docx'
DEST = ROOT / 'docs/Guion_Detallado_Exposicion_Capitulo_2_EcoRoute_BPMN_Negocio.docx'

doc = Document(SOURCE)
p = doc.paragraphs
updates = {
    4: 'Criterio de rigor  Separar aceptación del servicio por el cliente, estado PENDING del pedido, ruta PLANNED y despacho IN_PROGRESS. Los carriles de los nueve BPMN de negocio identifican responsables internos de MICOTRANS: Dispatcher, Jefatura logística, Conductor y Administrador. P01 muestra al cliente como participante externo. EcoRoute y Keycloak son herramientas de soporte, no actores del negocio; la asignación posterior de PENDING sigue pendiente de desarrollo.',
    33: 'Aquí distinguimos dos niveles. PMBOK ayuda a dirigir el proyecto de desarrollo: definir alcance, planificar, ejecutar, hacer seguimiento y cerrar entregables. En el capítulo 1 eso se refleja en el acta de constitución, la EDT o WBS y el cronograma. BPMN describe la operación objetivo de MICOTRANS. En estos diagramas los carriles muestran quién responde por la tarea o decisión; la aplicación EcoRoute y Keycloak apoyan esas actividades, pero no actúan como trabajadores del negocio. En P01 el cliente solicitante figura en un pool externo de caja negra, sin inventar su procedimiento interno.',
    39: 'En pantalla  Mostrar primero el pool MICOTRANS y su carril Dispatcher. Arriba está el pool externo Cliente solicitante. Las líneas punteadas representan el envío de condiciones y la respuesta. Después seguir las compuertas de validación y aceptación.',
    43: 'Antes del alta hay una última compuerta: ¿el cliente confirma las condiciones finales? El Dispatcher presenta las condiciones, recibe la respuesta desde el participante externo y decide. Si el cliente dice No, el caso termina desistido. Solo si dice Sí el Dispatcher registra el pedido usando “-- Sin Ruta --” y el backend lo deja PENDING. Ese resultado habilita P02 en el diseño de negocio. No existe estado CONFIRMED, pantalla de confirmación comercial ni evidencia automática de aceptación. Los finales negativos no generan ruta; el mecanismo para conservar motivo y conversación debe acordarse con MICOTRANS.',
    47: 'En pantalla  Recorrer solo los carriles internos Dispatcher, Jefatura logística y Conductor. Señalar que la revisión del recorrido se hace con apoyo de EcoRoute y que la vinculación posterior de PENDING es objetivo pendiente.',
    55: 'En pantalla  Seguir una parada en el carril Conductor y luego el control de POD en el carril Dispatcher. Marcar salidas por acceso, ausencia, rechazo, evidencia insuficiente y sincronización pendiente.',
    58: 'Cuando la recepción es aceptada, el conductor captura foto, firma y datos del receptor. La compuerta pregunta si la prueba de entrega o POD es suficiente. Si falta información, intenta completarla; si no puede, deja la prueba observada y deriva el caso a P04. Con evidencia suficiente, la aplicación intenta guardar y sincronizar hora, ubicación y prueba; el Dispatcher revisa el resultado disponible. Si no se confirma la sincronización, el caso queda pendiente de control y pasa a P04. Este es un proceso objetivo: la cola offline fiable y el GPS obligatorio todavía requieren prueba operativa.',
    79: 'En pantalla  Seguir Jefatura logística, Administrador y Dispatcher. El Administrador registra el recurso usando EcoRoute; la decisión sobre aptitud y disponibilidad sigue bajo responsabilidad humana.',
    89: 'P07 empieza con una ruta en ejecución. El Conductor comparte avance mediante la aplicación, que transmite posición y estado. El Dispatcher verifica si recibe datos recientes; si no, contacta al conductor y registra pérdida de señal cuando no se recupera el seguimiento. Una ausencia de GPS no demuestra por sí sola una parada no autorizada. Jefatura interviene cuando el caso requiere escalamiento.',
    95: 'En pantalla  Seguir los carriles Jefatura logística y Administrador. Mostrar autorización, rol mínimo, baja y comprobación de permisos. Keycloak se utiliza para identidad, pero no aparece como actor del negocio.',
    98: 'La siguiente compuerta separa baja de alta o cambio. En una baja, el Administrador revoca el acceso mediante Keycloak y verifica sesiones según la política aprobada; la desactivación completa debe probarse. En un alta o cambio, configura identidad y rol y comprueba con el usuario que el acceso permitido sea correcto. Si los permisos no corresponden, corrige antes de activar.',
    99: 'En este proyecto Keycloak administra la identidad y los roles del token. Es soporte técnico del proceso P08, no trabajador ni participante externo de la operación de reparto. PostgreSQL contiene además tablas auth_* para permisos locales, pero esas asignaciones no actualizan por sí solas Keycloak. Al exponer este BPMN hablamos de una política objetivo de administración y de integración por completar, no de un flujo totalmente automatizado. El resultado correcto exige aprobación, mínimo privilegio, revocación y prueba del acceso efectivo.',
}
for index, text in updates.items():
    p[index].text = text
doc.save(DEST)
print(DEST)
