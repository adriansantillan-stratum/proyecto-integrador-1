from pathlib import Path
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs' / 'entregables_procesos_ecoroute'
OUT.mkdir(parents=True, exist_ok=True)
PATH = OUT / 'Guion_Exposicion_Especificacion_Procesos_EcoRoute_MICOTRANS.docx'

BLUE = '103B66'
LIGHT_BLUE = 'EAF2F8'
LIGHT_GREY = 'F5F7FA'
DARK = '1D2A35'
MUTED = '526273'
ORANGE = 'C75A1D'

def shade(cell, color):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:fill'), color)
    tcPr.append(shd)

def set_cell(cell, text, bold=False, color=None):
    cell.text = ''
    cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
    p = cell.paragraphs[0]
    p.paragraph_format.space_after = Pt(0)
    r = p.add_run(text)
    r.bold = bold
    r.font.size = Pt(9)
    if color:
        r.font.color.rgb = RGBColor.from_string(color)

def table(doc, headers, rows, widths=None):
    t = doc.add_table(rows=1, cols=len(headers))
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    t.style = 'Table Grid'
    for i, h in enumerate(headers):
        shade(t.rows[0].cells[i], BLUE)
        set_cell(t.rows[0].cells[i], h, True, 'FFFFFF')
        if widths: t.rows[0].cells[i].width = Inches(widths[i])
    for n, row in enumerate(rows):
        cells = t.add_row().cells
        for i, value in enumerate(row):
            if n % 2: shade(cells[i], LIGHT_BLUE)
            set_cell(cells[i], str(value))
            if widths: cells[i].width = Inches(widths[i])
    doc.add_paragraph().paragraph_format.space_after = Pt(2)
    return t

def para(doc, text='', bold_lead=None):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(6)
    p.paragraph_format.line_spacing = 1.13
    if bold_lead:
        r = p.add_run(bold_lead)
        r.bold = True
        r.font.color.rgb = RGBColor.from_string(DARK)
    r = p.add_run(text)
    r.font.size = Pt(10.5)
    r.font.color.rgb = RGBColor.from_string(DARK)
    return p

def bullets(doc, entries):
    for entry in entries:
        p = doc.add_paragraph(style='List Bullet')
        p.paragraph_format.space_after = Pt(3)
        p.paragraph_format.line_spacing = 1.08
        r = p.add_run(entry)
        r.font.size = Pt(10)
        r.font.color.rgb = RGBColor.from_string(DARK)

def heading(doc, text, level=1):
    p = doc.add_heading(text, level=level)
    p.paragraph_format.space_before = Pt(12 if level == 1 else 8)
    p.paragraph_format.space_after = Pt(6)
    for r in p.runs:
        r.font.color.rgb = RGBColor(0, 0, 0)
    return p

def script_block(doc, text):
    p = doc.add_paragraph()
    p.paragraph_format.left_indent = Inches(.22)
    p.paragraph_format.right_indent = Inches(.16)
    p.paragraph_format.space_after = Pt(8)
    p.paragraph_format.line_spacing = 1.16
    r = p.add_run('“' + text + '”')
    r.italic = True
    r.font.size = Pt(10.5)
    r.font.color.rgb = RGBColor.from_string('253B53')

doc = Document()
sec = doc.sections[0]
sec.top_margin = Inches(.75); sec.bottom_margin = Inches(.75)
sec.left_margin = Inches(.8); sec.right_margin = Inches(.8)
styles = doc.styles
styles['Normal'].font.name = 'Aptos'
styles['Normal']._element.rPr.rFonts.set(qn('w:eastAsia'), 'Aptos')
for s in ['Title', 'Heading 1', 'Heading 2', 'Heading 3']:
    styles[s].font.name = 'Aptos Display'
    styles[s]._element.rPr.rFonts.set(qn('w:eastAsia'), 'Aptos Display')
    styles[s].font.color.rgb = RGBColor(0, 0, 0)

# Portada
p = doc.add_paragraph(style='Title')
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
p.paragraph_format.space_before = Pt(100)
r = p.add_run('Guion de exposición de procesos y analítica')
r.font.size = Pt(27); r.font.color.rgb = RGBColor(0, 0, 0)
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run('EcoRoute para Grupo MICOTRANS S A C')
r.bold = True; r.font.size = Pt(17); r.font.color.rgb = RGBColor.from_string(BLUE)
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run('Apoyo para sustentar la especificación de procesos BPMN, wireframes, indicadores, dashboards y reportes operativos')
r.italic = True; r.font.size = Pt(11); r.font.color.rgb = RGBColor.from_string(MUTED)
doc.add_paragraph('')
para(doc, 'Este guion permite explicar el documento de manera ordenada, sin afirmar que la solución ya esté desplegada. La propuesta corresponde al diseño objetivo del piloto para MICOTRANS y orienta qué se implementará, medirá y controlará.')
doc.add_page_break()

heading(doc, '1. Uso del guion')
para(doc, 'Este material está organizado para acompañar el documento “Especificación de Procesos y Analítica EcoRoute MICOTRANS”. Cada bloque indica el mensaje central, el recorrido de la lámina o sección, las excepciones que deben explicarse y una respuesta breve ante preguntas frecuentes.')
table(doc, ['Elemento', 'Cómo usarlo durante la exposición'], [
    ('Texto sugerido', 'Es una redacción que puede leerse o adaptarse con naturalidad.'),
    ('Recorrido del BPMN', 'Sigue los carriles de arriba hacia abajo y de izquierda a derecha. Nombra al responsable antes de explicar la tarea.'),
    ('Excepción', 'Explica qué sucede cuando la respuesta de una compuerta es “No”. No omitas esta ruta porque demuestra control operativo.'),
    ('Wireframes y dashboards', 'Preséntalos como prototipos de la solución objetivo, no como pantallas ya desplegadas.'),
], [1.45, 5.7])
heading(doc, 'Tiempo sugerido', 2)
table(doc, ['Bloque', 'Tiempo'], [
    ('Apertura, cobertura y lectura BPMN', '2 min'),
    ('Procesos P01 a P06', '10 min'),
    ('Indicadores y dashboards', '4 min'),
    ('Reportes operativos y cierre', '2 min'),
    ('Preguntas', '2 min'),
], [5.6, 1.55])
doc.add_page_break()

heading(doc, '2. Apertura y alcance')
para(doc, 'Mensaje central: EcoRoute busca ordenar la operación de última milla de MICOTRANS, desde que se recibe un pedido hasta que la organización mide el resultado y decide mejoras.')
script_block(doc, 'Buenos días. Presentaremos la propuesta EcoRoute para Grupo MICOTRANS S. A. C. El problema que abordamos es la dificultad para controlar pedidos, rutas, entregas y evidencias de forma integrada. Por ello, hemos modelado seis procesos críticos, sus excepciones, las pantallas necesarias y los indicadores que permitirán tomar decisiones basadas en datos.')
heading(doc, 'Cobertura solicitada', 2)
bullets(doc, [
    'Seis procesos críticos de punta a punta: pedido, planificación, despacho, entrega POD, incidencias y analítica.',
    'Un BPMN detallado por proceso, con actores diferenciados por carriles y rutas de decisión.',
    'Wireframes que muestran las pantallas requeridas para ejecutar cada proceso.',
    'Cinco indicadores, cinco dashboards con filtros y cuatro visuales como mínimo por tablero.',
    'Dos reportes operativos: manifiesto diario y cierre de entregas con evidencia POD.'
])
heading(doc, 'Cómo leer los BPMN', 2)
script_block(doc, 'En los diagramas, cada carril identifica quién ejecuta una tarea: cliente, dispatcher, conductor, jefe de logística o sistema. Los rectángulos son actividades; los rombos son decisiones. La ruta verde o principal representa el “Sí”. La ruta naranja representa el “No”, es decir, una excepción que se trata, se registra y llega a un resultado alternativo, sin perder trazabilidad.')
doc.add_page_break()

processes = [
    {
        'id':'P01', 'title':'Gestión y confirmación de pedidos', 'time':'2 min',
        'goal':'Asegurar que cada solicitud llegue al plan de distribución con datos completos, dirección utilizable y ventana horaria válida.',
        'script':'El primer proceso comienza cuando MICOTRANS recibe una solicitud por formulario, archivo CSV o integración. El asistente comercial o cliente registra el pedido. El sistema valida campos obligatorios y duplicidad, geocodifica la dirección, y el dispatcher revisa la ventana horaria antes de confirmar u observar el pedido. El resultado esperado es un pedido disponible para planificar o una solicitud observada con motivo registrado.',
        'walk':['El cliente o asistente comercial registra el pedido.', 'El sistema valida datos, duplicidad y dirección.', 'El dispatcher verifica la ventana horaria y confirma u observa el pedido.', 'El sistema comunica el resultado para que no existan pedidos sin estado.'],
        'exceptions':[('¿Datos completos y sin duplicidad?', 'No: el Sistema EcoRoute registra el pedido observado y concluye en “Pedido observado”.'), ('¿Ventana disponible?', 'No: el Dispatcher propone una nueva ventana; el resultado queda como “Pedido pendiente de confirmación”.')],
        'wire':'En los wireframes se observan el listado de pedidos, formulario de nuevo pedido, importación CSV, detalle y bandeja de observaciones. Explica que estas pantallas hacen visible el dato faltante antes de que afecte la ruta.',
        'question':('¿Por qué no se planifica un pedido incompleto?', 'Porque una dirección, contacto o ventana inválida provoca reprocesos y fallas de entrega. La observación temprana protege toda la operación posterior.')
    },
    {
        'id':'P02', 'title':'Planificación y optimización de rutas', 'time':'2 min',
        'goal':'Convertir pedidos confirmados en rutas factibles considerando zona, capacidad, conductor, tiempo de servicio y ventana horaria.',
        'script':'Una vez confirmados los pedidos, el dispatcher selecciona los pedidos del día. El sistema los agrupa por zona y capacidad; luego se asignan vehículo y conductor. El motor de ruteo calcula una secuencia óptima y el jefe de logística revisa restricciones antes de aprobar y publicar la ruta. Así la planificación deja de depender solo de una decisión manual y se vuelve revisable.',
        'walk':['El Dispatcher selecciona pedidos y agrupa por zona y capacidad.', 'Se asignan vehículo y conductor.', 'El motor OSRM calcula la secuencia óptima.', 'El jefe de logística revisa restricciones; finalmente se aprueba y publica la ruta.'],
        'exceptions':[('¿Capacidad disponible?', 'No: el Dispatcher separa pedidos o cambia el vehículo. La ruta queda pendiente de ajuste.'), ('¿Restricciones atendidas?', 'No: el Dispatcher ajusta la secuencia y recalcula hasta obtener una ruta viable.')],
        'wire':'Muestra el planificador, mapa de paradas, panel de restricciones, asignación de conductor y comparación de alternativas. Señala que el mapa es un apoyo para decidir, no un simple visual.',
        'question':('¿Qué aporta el algoritmo de ruteo?', 'Propone una secuencia basada en la red vial y reduce el trabajo manual. La decisión final sigue bajo control del Dispatcher y del jefe de logística.')
    },
    {
        'id':'P03', 'title':'Despacho y entrega de hoja de ruta', 'time':'1.5 min',
        'goal':'Entregar una ruta vigente al conductor y registrar que la operación fue recibida e iniciada.',
        'script':'Después de aprobar la ruta, el dispatcher la publica. El sistema envía una notificación al conductor, quien descarga su hoja de ruta y confirma la recepción. Esta confirmación es importante porque separa una ruta planificada de una ruta realmente disponible para ser ejecutada. El resultado es una ruta enviada, recibida y puesta en operación.',
        'walk':['El Dispatcher publica la ruta.', 'El sistema envía la notificación.', 'El conductor inicia sesión, descarga la hoja de ruta y confirma la recepción.', 'El sistema registra la entrega de la hoja de ruta.'],
        'exceptions':[('¿Notificación recibida?', 'No: el sistema reintenta el envío o conserva la hoja de ruta para uso offline. El despacho queda pendiente.'), ('¿Conductor confirma?', 'No: el sistema notifica el rechazo al Dispatcher y la ruta queda por reasignar.')],
        'wire':'Aquí conviene contrastar la consola del Dispatcher con la vista móvil “Mi ruta de hoy”. Resalta que el conductor puede consultar información esencial aun si pierde conectividad.',
        'question':('¿Qué pasa si el conductor no tiene señal?', 'La hoja de ruta se conserva localmente; al recuperar conectividad se sincronizan confirmaciones y cambios pendientes.')
    },
    {
        'id':'P04', 'title':'Ejecución de entrega y prueba de entrega POD', 'time':'2 min',
        'goal':'Registrar el resultado de cada parada con evidencia verificable: foto, ubicación, fecha, hora y, cuando aplique, firma.',
        'script':'Este es el proceso principal de trazabilidad. El conductor abre la siguiente parada, navega al destino, registra la llegada y captura la evidencia. Si el receptor está disponible, registra la firma. El sistema obtiene GPS y timestamp y confirma la entrega o la incidencia. De esta forma, cada entrega deja una prueba consultable ante un reclamo.',
        'walk':['El conductor abre la parada, navega y registra la llegada.', 'Captura foto POD y, si corresponde, firma del receptor.', 'El sistema asocia ubicación GPS, fecha y hora.', 'El sistema confirma la entrega o conserva la evidencia pendiente para sincronizar.'],
        'exceptions':[('¿Receptor disponible?', 'No: el Conductor registra una causal de no entrega y el intento queda cerrado con sustento.'), ('¿POD completo?', 'No: el Sistema EcoRoute guarda la evidencia pendiente offline para sincronizarla cuando exista conexión.')],
        'wire':'Explica la secuencia móvil: lista de ruta, detalle del pedido y confirmación de entrega. La captura no se limita a un botón “Entregado”; incluye datos que permiten verificar la atención.',
        'question':('¿Por qué el POD necesita GPS y fecha?', 'Porque la foto aislada no es suficiente. La combinación de foto, firma cuando corresponda, ubicación y timestamp fortalece la trazabilidad.')
    },
    {
        'id':'P05', 'title':'Gestión de incidencias y reprogramación', 'time':'1.5 min',
        'goal':'Resolver entregas fallidas, demoras o incidencias sin perder el historial ni abandonar pedidos.',
        'script':'Cuando una entrega no puede completarse, el conductor registra una causal y adjunta evidencia. El sistema notifica al Dispatcher, quien evalúa el impacto. El jefe de logística decide si puede reasignar o reprogramar. Al final, la resolución queda comunicada y trazable; no se pierde el pedido ni se oculta el motivo de la desviación.',
        'walk':['El conductor registra la causal y adjunta evidencia.', 'El sistema notifica al Dispatcher.', 'El Dispatcher evalúa impacto y el jefe de logística decide reasignar o reprogramar.', 'El sistema comunica la resolución y conserva el historial.'],
        'exceptions':[('¿Evidencia suficiente?', 'No: el Conductor recibe una solicitud de complemento y la incidencia queda observada.'), ('¿Reasignación viable?', 'No: el Jefe de logística reprograma el pedido para un nuevo turno.')],
        'wire':'Muestra la pantalla de incidencia móvil y la bandeja de alertas de la web. La idea es que la incidencia se convierta en una tarea resoluble, no en un mensaje disperso por WhatsApp.',
        'question':('¿Qué mejora respecto al manejo informal de incidencias?', 'Estandariza causales, responsable, hora, evidencia y decisión tomada; esto permite luego medir causas recurrentes.')
    },
    {
        'id':'P06', 'title':'Analítica y mejora de la operación', 'time':'1.5 min',
        'goal':'Convertir datos de pedidos, rutas, entregas e incidencias en indicadores, hallazgos y acciones priorizadas.',
        'script':'El último proceso cierra el ciclo. La base analítica consolida los datos operativos y calcula indicadores. El analista compara resultados con las metas, identifica causas y presenta hallazgos. El jefe de logística define una acción y el Dispatcher da seguimiento. Por lo tanto, el tablero no es el final del proceso: es la fuente para decidir una mejora concreta y controlar si funcionó.',
        'walk':['La base analítica consolida datos y calcula indicadores.', 'El analista compara con metas y analiza causas.', 'El jefe de logística define una acción.', 'El Dispatcher da seguimiento hasta comprobar el resultado.'],
        'exceptions':[('¿Meta cumplida?', 'Sí: el Analista registra el hallazgo y la buena práctica para replicarla.'), ('¿Acción aprobada?', 'No: el Jefe de logística devuelve la acción para ajuste; no se ejecuta una medida sin validación.')],
        'wire':'Relaciona esta lámina con el panel de control logístico: los datos son útiles cuando permiten identificar una desviación, asignar una acción y medir el cambio.',
        'question':('¿El dashboard por sí solo resuelve el problema?', 'No. El dashboard muestra qué ocurre; el proceso de mejora define quién analiza, quién decide y quién verifica la acción.')
    },
]

heading(doc, '3. Procesos BPMN y wireframes')
para(doc, 'Antes de iniciar cada proceso, indica que el BPMN responde dos preguntas: qué actividad se realiza y quién es responsable. Luego usa la excepción para demostrar que el modelo contempla situaciones reales y no solo el flujo ideal.')
for index, proc in enumerate(processes):
    if index:
        doc.add_page_break()
    heading(doc, f"{proc['id']} {proc['title']}")
    para(doc, proc['time'] + ' de exposición. ', 'Tiempo sugerido: ')
    para(doc, proc['goal'], 'Objetivo: ')
    heading(doc, 'Texto sugerido', 2)
    script_block(doc, proc['script'])
    heading(doc, 'Cómo recorrer el BPMN', 2)
    bullets(doc, proc['walk'])
    heading(doc, 'Excepciones que debes explicar', 2)
    table(doc, ['Compuerta', 'Respuesta cuando es No'], proc['exceptions'], [2.2, 4.95])
    heading(doc, 'Cómo explicar los wireframes', 2)
    para(doc, proc['wire'])
    heading(doc, 'Pregunta probable', 2)
    para(doc, proc['question'][0], 'Pregunta: ')
    para(doc, proc['question'][1], 'Respuesta breve: ')

doc.add_page_break()
heading(doc, '4. Indicadores analíticos')
para(doc, 'Mensaje central: los indicadores no reemplazan la operación; permiten medirla con una regla clara, una fuente de datos y una meta. La línea base se calculó con 150 registros de MICOTRANS y sirve para dimensionar el piloto.')
table(doc, ['Indicador', 'Base inicial', 'Meta', 'Cómo explicarlo'], [
    ('IID - Índice de información íntegra', '51.3%', '>= 85%', 'Mide qué porcentaje de servicios tiene datos y evidencia digital completa. Una base baja revela brechas de registro.'),
    ('CHR - Cumplimiento de hoja de ruta', '67.3%', '>= 90%', 'Mide entregas completadas frente a servicios programados. Permite revisar disciplina de ejecución.'),
    ('TDE - Tasa de digitalización de evidencia', '51.3%', '>= 90%', 'Mide la proporción de entregas con foto o evidencia completa. Está vinculada al POD.'),
    ('OTIF - Entregas a tiempo y completas', 'Por levantar en piloto', '>= 90%', 'Mide el cumplimiento de la ventana horaria sin incidencia. Requiere capturar la hora planificada y la real.'),
    ('TNI - Tasa de no entrega e incidencia', '23.3%', '<= 10%', 'Mide pedidos fallidos o con incidencia. Debe disminuir cuando las causas se gestionan oportunamente.'),
], [1.45, 1.1, .75, 3.85])
script_block(doc, 'Estas cifras no son una promesa de resultado ni una medición definitiva de producción. Son una línea base de 150 registros que nos permite definir metas para el piloto. Por ejemplo, el IID de 51.3% muestra que todavía existe un espacio importante para completar evidencia y datos; por eso la propuesta prioriza el POD y el registro estructurado de incidencias.')
heading(doc, 'Idea de transición', 2)
para(doc, 'Luego de explicar los indicadores, conecta con los dashboards: “Ahora veremos cómo estos indicadores se convertirán en vistas que faciliten la decisión diaria, semanal y mensual”.')

dashboards = [
    ('D01 Resumen ejecutivo', 'Dirección logística', 'Integra IID, CHR, TDE, OTIF y TNI. Úsalo para mostrar el estado general y priorizar qué problema atacar primero.'),
    ('D02 Cumplimiento de entregas', 'Dispatcher y jefe de logística', 'Permite filtrar por fecha, conductor, zona y estado; responde si las entregas se completan y si se respetan ventanas.'),
    ('D03 Eficiencia de rutas', 'Jefe de logística', 'Relaciona kilómetros por entrega, tiempo por parada, distancia planificada versus real y rutas con demora.'),
    ('D04 Incidencias y evidencia POD', 'Dispatcher y analista', 'Muestra causales, evidencia completa o incompleta, tendencia de fallas y zonas con mayor recurrencia.'),
    ('D05 Rendimiento y mejora continua', 'Jefe de logística', 'Permite comparar productividad, cumplimiento y acciones de mejora abiertas o cerradas.'),
]
doc.add_page_break()
heading(doc, '5. Dashboards analíticos')
para(doc, 'Los cinco dashboards se presentan como diagramas tipo Power BI. Cada uno incorpora filtros y cuatro visuales. Es importante expresarlos como un diseño de inteligencia de negocios propuesto para el piloto, alimentado por vistas analíticas de solo lectura de PostgreSQL.')
for name, user, explanation in dashboards:
    heading(doc, name, 2)
    para(doc, user + '. ', 'Usuario principal: ')
    script_block(doc, explanation)
heading(doc, 'Texto de cierre para esta sección', 2)
script_block(doc, 'La utilidad del módulo de inteligencia de negocios no es únicamente mostrar gráficos. Su valor está en conectar los datos del proceso con una decisión. Si se detecta una zona con incidencias recurrentes, el proceso P06 establece que se analiza la causa, se aprueba una acción y luego se controla su resultado.')

doc.add_page_break()
heading(doc, '6. Reportes operativos')
para(doc, 'Los reportes operativos son distintos de los dashboards. Un dashboard resume y compara; un reporte lista el detalle necesario para ejecutar, coordinar o auditar una jornada.')
heading(doc, 'R01 Manifiesto diario de despacho', 2)
script_block(doc, 'El manifiesto diario permite al Dispatcher revisar las paradas programadas por ruta. Incluye ruta, secuencia, pedido, cliente, dirección, ventana horaria, paquetes, estado y hora de salida. Los filtros facilitan encontrar una ruta o conductor específico y la exportación permite compartir el listado cuando se requiere coordinación de campo.')
heading(doc, 'R02 Listado de cierre de entregas y POD', 2)
script_block(doc, 'El reporte de cierre permite al jefe de logística revisar cómo terminó cada entrega. Además del pedido y cliente, se consulta resultado, foto, firma, GPS, fecha y hora, causal y observación. Es el reporte que respalda una revisión operativa o un reclamo, porque organiza la evidencia de cada parada.')
heading(doc, 'Diferencia que debes enfatizar', 2)
table(doc, ['Dashboard', 'Reporte operativo'], [
    ('Responde tendencias, comparación con metas y prioridades.', 'Responde qué pasó con cada pedido, ruta o evidencia.'),
    ('Usuario: dirección, analista o jefe de logística.', 'Usuario: Dispatcher o jefe de logística en la coordinación diaria.'),
    ('Visuales agregados y filtros analíticos.', 'Listado detallado, filtros, paginación y exportación.')
], [3.3, 3.3])

doc.add_page_break()
heading(doc, '7. Cierre de la exposición')
script_block(doc, 'Para cerrar, EcoRoute propone una operación integrada: primero se valida el pedido, luego se planifica y despacha la ruta, el conductor registra el resultado con prueba de entrega, las incidencias se gestionan sin perder trazabilidad y, finalmente, la información se convierte en indicadores y decisiones. La propuesta para MICOTRANS no se limita a digitalizar un formulario; busca crear un ciclo de control y mejora continua para la última milla.')
heading(doc, 'Preguntas frecuentes y respuestas de apoyo', 2)
table(doc, ['Pregunta', 'Respuesta sugerida'], [
    ('¿La solución ya está desplegada?', 'No. El documento muestra el diseño objetivo y los prototipos del piloto. Las pantallas y flujos sirven para acordar qué debe construirse y validarse con MICOTRANS.'),
    ('¿Por qué se modelaron excepciones?', 'Porque una operación real tiene datos incompletos, capacidad limitada, falta de señal, receptor ausente e incidencias. El BPMN define cómo atender esas situaciones sin perder el registro.'),
    ('¿Por qué usar Power BI?', 'Power BI permite conectar vistas analíticas de solo lectura de PostgreSQL y explorar filtros sin depender de exportaciones manuales de CSV.'),
    ('¿Qué sería un primer piloto?', 'Iniciar con una sede, un grupo acotado de conductores y rutas, registrar pedidos y POD, y medir los cinco indicadores durante un periodo definido.'),
    ('¿Qué valor recibe MICOTRANS?', 'Mayor trazabilidad de pedidos y entregas, evidencia ante reclamos, control de incidencias y datos para priorizar mejoras operativas.')
], [2.1, 4.5])
para(doc, 'Recomendación final: no memorices cada frase. Memoriza el hilo conductor: pedido válido, ruta viable, ejecución trazable, incidencia gestionada y mejora medida. Ese hilo permite responder con seguridad aun si cambian el orden de las preguntas.')

doc.save(PATH)
print(PATH)
