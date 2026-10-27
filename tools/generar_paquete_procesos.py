from pathlib import Path
from html import escape
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs' / 'entregables_procesos_ecoroute'
IMG = OUT / 'imagenes'
BPMN = OUT / 'bpmn'
OUT.mkdir(parents=True, exist_ok=True)
IMG.mkdir(exist_ok=True)
BPMN.mkdir(exist_ok=True)

BLUE = '#103B66'; TEAL = '#0B8F8C'; ORANGE = '#E96D28'; GREY = '#F3F6F9'; DARK = '#1D2A35'

processes = [
    {
        'id':'P01','title':'Gestión y confirmación de pedidos','goal':'Registrar, validar y confirmar solicitudes de transporte antes de ingresarlas al plan de distribución.',
        'actors':'Cliente o asistente comercial, Dispatcher, Sistema EcoRoute',
        'trigger':'Recepción de solicitud por formulario, CSV o integración.',
        'result':'Pedido confirmado y disponible para planificación, o solicitud observada.',
        'steps':['Registrar pedido','Validar campos y duplicidad','Geocodificar dirección','Verificar ventana horaria','Confirmar u observar pedido','Notificar resultado'],
        'screens':['Pedidos - listado y filtros','Nuevo pedido','Detalle y validación','Importación CSV','Bandeja de observaciones','Confirmación al cliente'],
        'rules':['RUC o documento, dirección, contacto y ventana horaria son obligatorios.','Una solicitud duplicada no se confirma sin revisión.','Una dirección no geocodificable queda observada y no pasa al despacho.']
    },
    {
        'id':'P02','title':'Planificación y optimización de rutas','goal':'Convertir pedidos confirmados en rutas factibles, priorizando capacidad, ubicación y ventana horaria.',
        'actors':'Dispatcher, Jefe de logística, Motor de ruteo OSRM, Sistema EcoRoute',
        'trigger':'Cierre parcial o total de pedidos confirmados para una fecha.',
        'result':'Ruta propuesta aprobada, con secuencia, distancia, ETA y conductor asignado.',
        'steps':['Seleccionar pedidos del día','Agrupar por zona y capacidad','Asignar vehículo y conductor','Calcular secuencia óptima','Revisar restricciones','Aprobar y publicar ruta'],
        'screens':['Planificador de rutas','Mapa y paradas','Panel de restricciones','Asignación de conductor','Comparación de alternativas','Confirmación de publicación'],
        'rules':['Cada vehículo respeta su capacidad disponible.','La ruta debe considerar ventanas horarias y tiempo de servicio.','El Dispatcher puede modificar la propuesta antes de publicarla.']
    },
    {
        'id':'P03','title':'Despacho y entrega de hoja de ruta','goal':'Entregar al conductor una ruta vigente y garantizar que el inicio de operación quede registrado.',
        'actors':'Dispatcher, Conductor, Sistema EcoRoute',
        'trigger':'Aprobación de la ruta planificada.',
        'result':'Ruta enviada, recibida y puesta en ejecución por el conductor.',
        'steps':['Publicar ruta','Enviar notificación','Conductor inicia sesión','Descargar hoja de ruta','Confirmar recepción','Registrar inicio de ruta'],
        'screens':['Panel de despacho','Notificación móvil','Mi ruta de hoy','Detalle de parada','Descarga offline','Confirmación de inicio'],
        'rules':['Solo el conductor asignado puede iniciar la ruta.','La hoja de ruta se conserva localmente para uso sin conectividad.','Una cancelación antes de inicio debe retirar la parada de la hoja publicada.']
    },
    {
        'id':'P04','title':'Ejecución de entrega y prueba de entrega POD','goal':'Registrar el resultado de cada parada con evidencia verificable y trazable.',
        'actors':'Conductor, Cliente receptor, Sistema EcoRoute',
        'trigger':'Llegada del conductor a una parada activa.',
        'result':'Entrega confirmada con POD o intento de entrega con causal registrada.',
        'steps':['Abrir siguiente parada','Navegar al destino','Registrar llegada','Capturar foto POD','Registrar firma del receptor','Obtener GPS y timestamp','Confirmar entrega y sincronizar'],
        'screens':['Lista de paradas','Navegación externa','Detalle de entrega','Cámara POD','Firma digital','Resumen de confirmación'],
        'rules':['Una entrega exige foto, ubicación, fecha y hora; la firma aplica cuando el receptor está disponible.','La app conserva pendientes sin conexión y sincroniza al recuperar red.','La evidencia no puede reemplazarse sin generar registro de auditoría.']
    },
    {
        'id':'P05','title':'Gestión de incidencias y reprogramación','goal':'Resolver entregas no completadas sin perder trazabilidad ni afectar el control de la jornada.',
        'actors':'Conductor, Dispatcher, Jefe de logística, Sistema EcoRoute',
        'trigger':'El conductor registra una incidencia o el Dispatcher detecta desviación o demora.',
        'result':'Incidencia resuelta, reprogramada, reasignada o cerrada con sustento.',
        'steps':['Registrar causal','Adjuntar evidencia','Notificar al Dispatcher','Evaluar impacto','Reasignar o reprogramar','Comunicar resolución'],
        'screens':['Formulario de incidencia','Bandeja de alertas','Detalle y evidencias','Reasignación de parada','Calendario de reprogramación','Historial de resolución'],
        'rules':['La causal debe provenir de un catálogo estandarizado.','Toda reasignación conserva el historial de responsable y hora.','Las incidencias críticas requieren comentario del Dispatcher.']
    },
    {
        'id':'P06','title':'Analítica y mejora de la operación','goal':'Transformar datos operativos en indicadores, hallazgos y decisiones de mejora para MICOTRANS.',
        'actors':'Jefe de logística, Analista, Dispatcher, Base analítica',
        'trigger':'Cierre de jornada, semana o mes.',
        'result':'Indicadores actualizados, desviaciones identificadas y acciones priorizadas.',
        'steps':['Consolidar datos operativos','Calcular indicadores','Comparar con meta','Analizar causas','Definir acción','Dar seguimiento a mejora'],
        'screens':['Dashboard ejecutivo','Cumplimiento de entregas','Eficiencia de rutas','Incidencias y POD','Rendimiento por conductor','Registro de acciones'],
        'rules':['Los indicadores deben tener periodo, fuente, fórmula y responsable.','Las decisiones deben asociarse a una desviación identificada.','El acceso a vistas de Power BI es solo lectura y usa datos consolidados.']
    },
]

# Responsable de cada tarea, en el mismo orden que la lista de pasos del proceso.
# Se usa tanto en los carriles BPMN visuales como en los archivos BPMN editables.
task_owners = {
    'P01':['Cliente o asistente comercial','Sistema EcoRoute','Sistema EcoRoute','Dispatcher','Dispatcher','Sistema EcoRoute'],
    'P02':['Dispatcher','Sistema EcoRoute','Dispatcher','Motor de ruteo OSRM','Jefe de logística','Dispatcher'],
    'P03':['Dispatcher','Sistema EcoRoute','Conductor','Conductor','Conductor','Sistema EcoRoute'],
    'P04':['Conductor','Conductor','Conductor','Conductor','Cliente receptor','Sistema EcoRoute','Sistema EcoRoute'],
    'P05':['Conductor','Conductor','Sistema EcoRoute','Dispatcher','Jefe de logística','Sistema EcoRoute'],
    'P06':['Base analítica','Base analítica','Analista','Analista','Jefe de logística','Dispatcher'],
}

# Compuertas de decisión y rutas de excepción. La rama Sí continúa el flujo principal;
# la rama No registra el tratamiento operativo y cierra o devuelve la solicitud al actor responsable.
decision_specs = {
    'P01': {
        1: ('¿Datos completos y sin duplicidad?', 'Registrar pedido observado', 'Sistema EcoRoute', 'Pedido observado'),
        4: ('¿Ventana disponible?', 'Proponer nueva ventana', 'Dispatcher', 'Pedido pendiente de confirmación'),
    },
    'P02': {
        1: ('¿Capacidad disponible?', 'Separar pedidos o cambiar vehículo', 'Dispatcher', 'Plan pendiente de ajuste'),
        4: ('¿Restricciones atendidas?', 'Ajustar secuencia y recalcular', 'Dispatcher', 'Ruta en revisión'),
    },
    'P03': {
        1: ('¿Notificación recibida?', 'Reintentar envío o usar hoja offline', 'Sistema EcoRoute', 'Despacho pendiente'),
        4: ('¿Conductor confirma?', 'Notificar rechazo al Dispatcher', 'Sistema EcoRoute', 'Ruta por reasignar'),
    },
    'P04': {
        2: ('¿Receptor disponible?', 'Registrar causal de no entrega', 'Conductor', 'Intento de entrega cerrado'),
        4: ('¿POD completo?', 'Guardar evidencia pendiente offline', 'Sistema EcoRoute', 'POD pendiente de sincronización'),
    },
    'P05': {
        1: ('¿Evidencia suficiente?', 'Solicitar complemento al conductor', 'Conductor', 'Incidencia observada'),
        4: ('¿Reasignación viable?', 'Reprogramar para nuevo turno', 'Jefe de logística', 'Entrega reprogramada'),
    },
    'P06': {
        1: ('¿Meta cumplida?', 'Registrar hallazgo y buena práctica', 'Analista', 'Indicador dentro de meta'),
        4: ('¿Acción aprobada?', 'Devolver acción para ajuste', 'Jefe de logística', 'Acción pendiente'),
    },
}

indicators = [
 ('IID','Índice de información íntegra','Servicios con datos y evidencia digital completos / servicios totales x 100','51.3%','>= 85%','Diaria y semanal','Pedidos, POD y evidencias'),
 ('CHR','Cumplimiento de hoja de ruta','Entregas completadas / servicios programados x 100','67.3%','>= 90%','Diaria y semanal','Rutas y estados de parada'),
 ('TDE','Tasa de digitalización de evidencia','Entregas con POD digital / entregas completadas x 100','51.3%','>= 90%','Diaria y mensual','Foto, firma, GPS y timestamp'),
 ('OTIF','Entregas a tiempo y completas','Entregas dentro de ventana y sin incidencia / entregas programadas x 100','Por levantar en piloto','>= 90%','Semanal y mensual','Ventanas, estados e incidencias'),
 ('TNI','Tasa de no entrega e incidencia','Servicios fallidos o con incidencia / servicios programados x 100','23.3%','<= 10%','Diaria y semanal','Estados y catálogo de causales'),
]

dashboards = [
 ('D01','Resumen ejecutivo','Dirección logística','Periodo, sede, cliente, zona','IID vs meta|CHR por semana|TDE por tipo de evidencia|OTIF y TNI'),
 ('D02','Cumplimiento de entregas','Dispatcher y Jefe de logística','Fecha, conductor, zona, estado','Entregas por estado|Cumplimiento por semana|Entregas por zona|Ventanas cumplidas'),
 ('D03','Eficiencia de rutas','Jefe de logística','Fecha, vehículo, conductor, zona','Kilómetros por entrega|Tiempo por parada|Distancia planificada vs real|Rutas con demora'),
 ('D04','Incidencias y evidencia POD','Dispatcher y analista','Fecha, causal, conductor, cliente','Incidencias por causal|POD completo vs incompleto|Tendencia de fallas|Incidencias por zona'),
 ('D05','Rendimiento y mejora continua','Jefe de logística','Periodo, conductor, vehículo, cliente','Ranking de cumplimiento|Productividad por conductor|Acciones abiertas|Meta vs resultado'),
]

reports = [
 ('R01','Manifiesto diario de despacho','Dispatcher','Fecha, ruta, conductor, vehículo, estado','Ruta, secuencia, pedido, cliente, dirección, ventana, paquetes, estado, hora de salida'),
 ('R02','Listado de cierre de entregas y POD','Jefe de logística','Fecha, conductor, estado, cliente, causal','Pedido, cliente, resultado, foto, firma, GPS, timestamp, causal, observación'),
]

def font(size, bold=False):
    paths = [r'C:\\Windows\\Fonts\\arialbd.ttf' if bold else r'C:\\Windows\\Fonts\\arial.ttf', r'C:\\Windows\\Fonts\\calibri.ttf']
    for p in paths:
        try: return ImageFont.truetype(p, size)
        except: pass
    return ImageFont.load_default()

def diagram(proc, path):
    """BPMN con carriles: cada actividad se ubica en el responsable real."""
    w,h=1800,760; im=Image.new('RGB',(w,h),'white'); d=ImageDraw.Draw(im)
    d.rounded_rectangle((18,18,w-18,h-18),18,fill='#F7FAFC',outline='#C9D5E2',width=2)
    d.text((45,40),f"{proc['id']}  {proc['title']}",font=font(27,True),fill=BLUE)
    d.text((45,76),'BPMN con carriles de responsabilidad',font=font(17),fill='#5D7083')
    actors=proc['actors'].split(', '); owners=task_owners[proc['id']]
    lane_x=220; top=116; bottom=658; lane_h=(bottom-top)/len(actors)
    # Pool / lanes
    d.rectangle((45,top,w-45,bottom),fill='white',outline='#9EB2C4',width=2)
    for i,actor in enumerate(actors):
        y1=int(top+i*lane_h); y2=int(top+(i+1)*lane_h)
        d.rectangle((45,y1,lane_x,y2),fill='#E7F0F7',outline='#AFC1D0')
        d.line((lane_x,y1,w-45,y1),fill='#C6D4E0',width=2)
        label=actor.replace(' o ','\n').replace(' de ',' de\n') if len(actor)>19 else actor
        d.multiline_text((65,y1+(y2-y1)//2-18),label,font=font(18,True),fill=BLUE,spacing=2,align='center')
    d.line((lane_x,bottom,w-45,bottom),fill='#C6D4E0',width=2)
    def center(owner):
        i=actors.index(owner); return int(top+i*lane_h+lane_h/2)
    def arrow(x1,y1,x2,y2,label=None,label_color='#466F90'):
        d.line((x1,y1,x2,y2),fill='#466F90',width=3)
        import math
        angle=math.atan2(y2-y1,x2-x1); size=11
        p1=(x2-size*math.cos(angle-0.45),y2-size*math.sin(angle-0.45))
        p2=(x2-size*math.cos(angle+0.45),y2-size*math.sin(angle+0.45))
        d.polygon([(x2,y2),p1,p2],fill='#466F90')
        if label:
            mx,my=(x1+x2)//2,(y1+y2)//2
            d.rounded_rectangle((mx-13,my-10,mx+13,my+8),4,fill='white')
            d.text((mx-7,my-8),label,font=font(11,True),fill=label_color)
    start_x=262; first_y=center(owners[0]); d.ellipse((start_x,first_y-18,start_x+36,first_y+18),fill=TEAL,outline=TEAL)
    d.text((start_x-2,first_y-45),'Inicio',font=font(13,True),fill=DARK)
    task_w,task_h=145,58
    max_task_x=1530; first_task_x=340; count=len(proc['steps'])
    step_gap=(max_task_x-first_task_x)//max(1,count-1)
    task_xs=[first_task_x+i*step_gap for i in range(count)]
    previous=(start_x+36,first_y); previous_label=None
    for idx,(step,owner) in enumerate(zip(proc['steps'],owners)):
        bx=task_xs[idx]; by=center(owner)-task_h//2
        arrow(previous[0],previous[1],bx,by+task_h//2,previous_label,'#237A3B')
        previous_label=None
        d.rounded_rectangle((bx,by,bx+task_w,by+task_h),10,fill='#FFFFFF',outline='#4C83AD',width=2)
        # task text kept short and centered inside its responsible lane
        words=step.split(); lines=[]; current=''
        for word in words:
            proposal=(current+' '+word).strip()
            if len(proposal)>18 and current: lines.append(current); current=word
            else: current=proposal
        if current: lines.append(current)
        line_h=14; text_y=by+(task_h-len(lines)*line_h)//2
        for ln in lines: 
            bb=d.textbbox((0,0),ln,font=font(13,True)); d.text((bx+(task_w-(bb[2]-bb[0]))//2,text_y),ln,font=font(13,True),fill=DARK); text_y+=line_h
        # Cada compuerta tiene dos resultados explícitos: Sí continúa; No trata la excepción.
        if idx in decision_specs[proc['id']]:
            gx=bx+task_w+36; gy=by+task_h//2
            d.polygon([(gx,gy-20),(gx+20,gy),(gx,gy+20),(gx-20,gy)],fill='#FFF2E8',outline=ORANGE)
            d.text((gx-4,gy-8),'?',font=font(14,True),fill=ORANGE)
            question,no_task,no_owner,no_end=decision_specs[proc['id']][idx]
            qwords=question.replace('¿','').replace('?','').split(); qlines=[]; cur=''
            for word in qwords:
                if len((cur+' '+word).strip())>20 and cur: qlines.append(cur); cur=word
                else: cur=(cur+' '+word).strip()
            if cur: qlines.append(cur)
            qy=gy-42-len(qlines)*9
            for line in qlines:
                bb=d.textbbox((0,0),line,font=font(10,True)); d.text((gx-(bb[2]-bb[0])//2,qy),line,font=font(10,True),fill=ORANGE); qy+=11
            # Ruta No: actividad de excepción en su carril y final alterno.
            ex_w,ex_h=120,46; ex_x=gx-60
            # Si la excepción pertenece al mismo actor de la compuerta, se baja dentro
            # del carril para no superponerse con la continuidad de la ruta Sí.
            exception_y=center(no_owner)
            if no_owner==owner:
                exception_y+=int(lane_h*0.25)
            ex_y=exception_y-ex_h//2
            arrow(gx,gy,ex_x,ex_y+ex_h//2,'No',ORANGE)
            d.rounded_rectangle((ex_x,ex_y,ex_x+ex_w,ex_y+ex_h),8,fill='#FFF8F1',outline=ORANGE,width=2)
            ew=[]; cur=''
            for word in no_task.split():
                if len((cur+' '+word).strip())>15 and cur: ew.append(cur); cur=word
                else: cur=(cur+' '+word).strip()
            if cur: ew.append(cur)
            ty=ex_y+(ex_h-len(ew)*10)//2
            for line in ew:
                bb=d.textbbox((0,0),line,font=font(9,True)); d.text((ex_x+(ex_w-(bb[2]-bb[0]))//2,ty),line,font=font(9,True),fill='#7B4A24'); ty+=10
            ex_end_x=ex_x+ex_w+28; ex_end_y=ex_y+ex_h//2
            arrow(ex_x+ex_w,ex_end_y,ex_end_x,ex_end_y)
            d.ellipse((ex_end_x,ex_end_y-11,ex_end_x+22,ex_end_y+11),fill='#D85B45',outline='#D85B45')
            d.text((ex_x-2,ex_y+ex_h+8),no_end,font=font(9),fill='#A44B36')
            previous=(gx+20,gy)
            previous_label='Sí'
        else:
            previous=(bx+task_w,by+task_h//2)
    end_x=1720; last_y=center(owners[-1]); arrow(previous[0],previous[1],end_x,last_y)
    d.ellipse((end_x,last_y-18,end_x+36,last_y+18),fill=ORANGE,outline=ORANGE)
    d.text((end_x-8,last_y-47),'Fin',font=font(13,True),fill=DARK)
    d.text((55,692),'Leyenda: los carriles identifican quién ejecuta cada tarea; los rombos representan decisiones o controles de regla.',font=font(16),fill='#526575')
    im.save(path)

def _web_shell(d, box, label, variant):
    x,y,w,h=box
    d.rounded_rectangle((x,y,x+w,y+h),16,fill='#F6F8FB',outline='#B8C7D6',width=2)
    # Sidebar faithful to web-admin screenshots
    d.rounded_rectangle((x,y,x+92,y+h),16,fill='#1E2C41')
    d.rectangle((x+78,y,x+92,y+h),fill='#1E2C41')
    d.text((x+13,y+17),'Eco',font=font(17,True),fill='#3B82F6'); d.text((x+47,y+17),'Route',font=font(17,True),fill='#3B82F6')
    for n, item in enumerate(['Inicio','Dashboard','Pedidos','Rutas','Conductores','Vehículos','Reportes']):
        iy=y+62+n*32
        if (variant in ['orders','new','import','detail'] and item=='Pedidos') or (variant=='map' and item=='Rutas') or (variant=='dashboard' and item in ['Dashboard','Reportes']) or (variant=='alerts' and item=='Rutas'):
            d.rounded_rectangle((x+5,iy-4,x+87,iy+22),4,fill='#26205B')
        d.text((x+14,iy),item,font=font(9,True if item in ['Pedidos','Rutas','Dashboard'] else False),fill='#3B82F6' if item in ['Pedidos','Rutas','Dashboard'] else '#A9B9CD')
    mx=x+112; my=y+22; mw=w-132
    headings={'orders':'Gestión de Pedidos','new':'Nuevo Pedido','import':'Importar pedidos CSV','detail':'Detalle del pedido','map':'Rutas de Despacho','dashboard':'Panel de Control Logístico','alerts':'Alertas e incidencias'}
    d.text((mx,my),headings.get(variant,label),font=font(18,True),fill='#12203A')
    if variant in ['orders','alerts']:
        d.rounded_rectangle((mx+150,my-4,mx+315,my+23),6,fill='white',outline='#D7E0EA')
        d.text((mx+164,my+3),'⌕  Buscar...',font=font(10),fill='#7A8A9D')
        d.rounded_rectangle((mx+330,my-4,mx+420,my+23),6,fill='#2563EB')
        d.text((mx+344,my+3),'+ Nuevo',font=font(10,True),fill='white')
    if variant=='orders':
        d.rounded_rectangle((mx,my+43,x+w-18,y+h-18),8,fill='white',outline='#DCE5EE')
        cols=['TRACKING','CLIENTE','RUTA','ESTADO','ACCIONES']; pos=[mx+12,mx+120,mx+235,mx+320,mx+402]
        for a,b in zip(pos,cols): d.text((a,my+57),b,font=font(8,True),fill='#71829A')
        rows=[('TRK-002','Beto Ortiz','Ruta #1','PENDING'),('TRK-003','Carla Bruni','Ruta #1','PENDING'),('TRK-001','Ana García','Ruta #2','DELIVERED')]
        for i,row in enumerate(rows):
            yy=my+82+i*37; d.line((mx+8,yy-6,x+w-24,yy-6),fill='#E8EEF4')
            for a,t in zip(pos,row): d.text((a,yy),t,font=font(9, t.startswith('TRK')),fill='#18263A')
            d.rounded_rectangle((mx+318,yy-3,mx+382,yy+15),9,fill='#E8F7EE' if row[3]=='DELIVERED' else '#EFF3F7')
            d.text((mx+327,yy+1),row[3],font=font(7,True),fill='#237A3B' if row[3]=='DELIVERED' else '#607084')
    elif variant in ['new','detail']:
        d.rounded_rectangle((mx,my+42,x+w-24,y+h-22),8,fill='white',outline='#DCE5EE')
        fields=['Cliente / razón social','Dirección de entrega','Ventana horaria','Contacto y teléfono'] if variant=='new' else ['Cliente: Beto Ortiz','Av. Javier Prado Este 1234','Estado: PENDING','Ruta asignada: Ruta #1']
        for i,t in enumerate(fields):
            yy=my+60+i*35; d.text((mx+16,yy),t,font=font(9,True if variant=='detail' else False),fill='#4C5D70')
            d.rounded_rectangle((mx+16,yy+14,mx+260,yy+31),4,fill='#F8FAFC',outline='#CBD7E2')
        d.rounded_rectangle((mx+275,my+178,mx+385,my+203),5,fill='#2563EB')
        d.text((mx+293,my+185),'Guardar',font=font(9,True),fill='white')
    elif variant=='import':
        d.rounded_rectangle((mx,my+44,x+w-22,y+h-24),8,fill='white',outline='#DCE5EE')
        d.rounded_rectangle((mx+35,my+76,mx+350,my+167),8,fill='#F7FAFC',outline='#6FA1E8',width=2)
        d.text((mx+115,my+98),'↑  Arrastra tu archivo CSV',font=font(12,True),fill='#2563EB')
        d.text((mx+111,my+121),'o selecciónalo desde tu equipo',font=font(9),fill='#71829A')
        d.rounded_rectangle((mx+112,my+140,mx+262,my+163),5,fill='#10B981')
        d.text((mx+136,my+146),'Seleccionar archivo',font=font(8,True),fill='white')
    elif variant=='map':
        d.rounded_rectangle((mx,my+40,x+w-20,y+h-18),8,fill='white',outline='#DCE5EE')
        d.rounded_rectangle((mx+12,my+55,mx+142,y+h-32),7,fill='#F1F6FC',outline='#D9E3EC')
        d.text((mx+24,my+68),'Ruta #1',font=font(11,True),fill='#13233A'); d.text((mx+24,my+91),'IN PROGRESS',font=font(8,True),fill='#D97706')
        d.text((mx+24,my+118),'Juan Pérez',font=font(8),fill='#65778A'); d.text((mx+24,my+137),'40.07 km',font=font(8),fill='#65778A')
        mapx=mx+154; mapy=my+55; mapw=w-302; maph=h-87
        d.rectangle((mapx,mapy,mapx+mapw,mapy+maph),fill='#E8E6DD',outline='#C8D5DF')
        for off in range(0,mapw,35): d.line((mapx+off,mapy,mapx+off-35,mapy+maph),fill='#D8D6CF',width=2)
        d.line((mapx+15,mapy+maph-20,mapx+mapw//2,mapy+70,mapx+mapw-18,mapy+30),fill='#2563EB',width=5)
        for px,py,n in [(mapx+15,mapy+maph-20,'1'),(mapx+mapw//2,mapy+70,'2'),(mapx+mapw-18,mapy+30,'3')]:
            d.ellipse((px-9,py-9,px+9,py+9),fill='#1D9BF0'); d.text((px-3,py-6),n,font=font(8,True),fill='white')
    elif variant=='dashboard':
        d.rounded_rectangle((mx,my+42,x+w-22,my+72),7,fill='white',outline='#DCE5EE')
        d.text((mx+12,my+51),'Filtros:   Todos los conductores     Desde   dd/mm/aaaa     Hasta   dd/mm/aaaa',font=font(8),fill='#5E7184')
        for i,(lab,val,col) in enumerate([('Total Pedidos','150','#3B82F6'),('Entregados','101','#22C55E'),('Pendientes','35','#EF4444')]):
            bx=mx+i*132; d.rounded_rectangle((bx,my+88,bx+120,my+139),8,fill='white',outline='#DCE5EE'); d.rectangle((bx,my+88,bx+4,my+139),fill=col); d.text((bx+14,my+101),lab,font=font(8),fill='#65778A'); d.text((bx+14,my+116),val,font=font(15,True),fill='#12203A')
        d.rounded_rectangle((mx,my+152,x+w-22,y+h-22),8,fill='white',outline='#DCE5EE'); d.text((mx+14,my+164),'Rendimiento de entregas',font=font(10,True),fill='#12203A')
        for i,v in enumerate([38,60,47,73,55]): d.rectangle((mx+28+i*42,my+216-v,mx+48+i*42,my+216),fill='#5B8EF0')
    else:
        d.rounded_rectangle((mx,my+44,x+w-22,y+h-24),8,fill='white',outline='#DCE5EE')
        for i,t in enumerate(['Cliente ausente','Dirección no encontrada','Demora por tráfico']):
            yy=my+63+i*42; d.rounded_rectangle((mx+12,yy,mx+390,yy+31),5,fill='#FFF7ED' if i==0 else '#F8FAFC',outline='#E0E7EF'); d.text((mx+24,yy+10),t,font=font(9,True),fill='#334155'); d.text((mx+292,yy+10),'Revisar  ›',font=font(8,True),fill='#2563EB')
    d.text((x+10,y+h-17),label,font=font(9,True),fill='#53697C')

def _mobile_shell(d, box, label, variant):
    x,y,w,h=box; green='#2E7D32'; bg='#FBFFF6'
    d.rounded_rectangle((x,y,x+w,y+h),22,fill='#151B21')
    d.rounded_rectangle((x+7,y+9,x+w-7,y+h-9),17,fill=bg)
    d.rounded_rectangle((x+7,y+9,x+w-7,y+58),17,fill=green); d.rectangle((x+7,y+42,x+w-7,y+58),fill=green)
    titles={'routes':'Mis Rutas de Hoy','detail':'Pedido #TRK-002','pod':'Confirmar entrega','incident':'Registrar incidencia','profile':'Perfil del Conductor'}
    d.text((x+20,y+23),'‹',font=font(21,True),fill='white'); d.text((x+56,y+25),titles.get(variant,'EcoRoute Driver'),font=font(11,True),fill='white')
    ix=x+18; iy=y+70; iw=w-36
    if variant=='routes':
        d.rectangle((ix,iy,ix+iw,iy+110),fill='#E5E2D9'); d.line((ix+8,iy+95,ix+iw//2,iy+28,ix+iw-11,iy+74),fill='#2877D4',width=4)
        d.rounded_rectangle((ix+9,iy+10,ix+122,iy+31),12,fill='white'); d.text((ix+18,iy+16),'17.4 km · 29 min',font=font(7,True),fill='#1C2834')
        d.text((ix,iy+124),'Entregas pendientes (3)',font=font(10,True),fill='#15231B')
        for i,(n,c,a) in enumerate([('1','Beto Ortiz','Av. Javier Prado Este'),('2','Carla Bruni','Jr. Batallón Callao'),('3','Ana García','Calle Alcanfores')]):
            yy=iy+142+i*47; d.ellipse((ix,yy,ix+23,yy+23),fill='#D9F0DC'); d.text((ix+8,yy+6),n,font=font(8,True),fill=green); d.text((ix+31,yy),f'Pedido TRK-00{i+1}',font=font(8,True),fill='#202A23'); d.text((ix+31,yy+13),c+' · '+a,font=font(7),fill='#5D6C61')
    elif variant=='detail':
        d.rounded_rectangle((ix,iy,ix+iw,iy+57),8,fill='#F2F5EC',outline='#D7DED3'); d.text((ix+10,iy+11),'Cliente: Beto Ortiz',font=font(10,True),fill='#1F2821'); d.text((ix+10,iy+31),'Av. Javier Prado Este 1234',font=font(7),fill='#546057')
        d.text((ix,iy+72),'Estado del pedido',font=font(9,True),fill='#202A23'); d.rounded_rectangle((ix,iy+89,ix+iw,iy+120),6,fill='white',outline='#839082'); d.text((ix+10,iy+99),'PENDING     ˅',font=font(9,True),fill='#26312A')
        d.rounded_rectangle((ix,iy+136,ix+iw,iy+213),7,fill='#F2F2F2',outline='#9BA49A'); d.text((ix+46,iy+165),'▣  Tocar para abrir la cámara',font=font(8),fill='#737B73')
        d.rounded_rectangle((ix,iy+228,ix+iw,iy+253),5,fill=green); d.text((ix+57,iy+236),'GUARDAR ESTADO',font=font(8,True),fill='white')
    elif variant=='pod':
        d.rounded_rectangle((ix,iy,ix+iw,iy+28),5,fill='white',outline=green,width=2); d.text((ix+10,iy+8),'DELIVERED',font=font(9,True),fill='#1C2A1E')
        d.text((ix,iy+44),'Datos del receptor',font=font(9,True),fill='#202A23')
        for j,t in enumerate(['Beto Ortiz','DNI del receptor']): d.rounded_rectangle((ix,iy+61+j*37,ix+iw,iy+91+j*37),5,fill='white',outline='#859082'); d.text((ix+10,iy+71+j*37),t,font=font(8),fill='#556158')
        d.text((ix,iy+143),'Firma del receptor',font=font(9,True),fill='#202A23'); d.rounded_rectangle((ix,iy+160,ix+iw,iy+236),7,fill='white',outline='#859082'); d.line((ix+28,iy+211,ix+83,iy+183,ix+130,iy+218),fill='#67746A',width=2)
    elif variant=='incident':
        d.text((ix,iy),'Selecciona la causal',font=font(9,True),fill='#202A23'); d.rounded_rectangle((ix,iy+18,ix+iw,iy+48),5,fill='white',outline='#879281'); d.text((ix+10,iy+28),'Cliente ausente     ˅',font=font(8),fill='#48564A')
        d.text((ix,iy+64),'Observación',font=font(9,True),fill='#202A23'); d.rounded_rectangle((ix,iy+82,ix+iw,iy+140),5,fill='white',outline='#879281'); d.text((ix+10,iy+93),'Describa lo ocurrido...',font=font(7),fill='#748073')
        d.rounded_rectangle((ix,iy+156,ix+iw,iy+218),7,fill='#F2F2F2',outline='#A1AAA1'); d.text((ix+42,iy+180),'▣ Adjuntar evidencia',font=font(8),fill='#657065'); d.rounded_rectangle((ix,iy+233,ix+iw,iy+257),5,fill=green); d.text((ix+63,iy+240),'ENVIAR ALERTA',font=font(8,True),fill='white')
    else:
        d.ellipse((x+w//2-32,iy,x+w//2+32,iy+64),fill='#D5E9D3'); d.text((x+w//2-9,iy+21),'C',font=font(24,True),fill=green); d.text((x+w//2-34,iy+77),'conductor',font=font(11,True),fill='#202A23')
        for j,t in enumerate(['conductor@ecoroute.com','DRIVER','LIC-001']): d.rounded_rectangle((ix,iy+102+j*40,ix+iw,iy+136+j*40),7,fill='#F2F5EC',outline='#DCE3D8'); d.text((ix+14,iy+115+j*40),t,font=font(8),fill='#526054')
    d.text((x+16,y+h-23),label,font=font(7,True),fill='#5B6A5D')

def wireframe(proc,path):
    w,h=1600,920; im=Image.new('RGB',(w,h),'#F2F6FA'); d=ImageDraw.Draw(im)
    d.text((48,28),f"Wireframes de alta fidelidad - {proc['id']} {proc['title']}",font=font(30,True),fill=BLUE)
    d.text((48,68),'Diseñados a partir de la estructura, colores y componentes observados en EcoRoute Web y EcoRoute Driver.',font=font(16),fill='#5D7083')
    variants={
        'P01':['orders','new','import','detail','orders','detail'],
        'P02':['map','map','detail','orders','map','detail'],
        'P03':['map','routes','routes','detail','detail','profile'],
        'P04':['routes','detail','detail','pod','pod','routes'],
        'P05':['incident','alerts','incident','alerts','alerts','detail'],
        'P06':['dashboard','dashboard','dashboard','dashboard','alerts','orders']
    }[proc['id']]
    mobile={'P03','P04'}
    for i,(screen,var) in enumerate(zip(proc['screens'],variants)):
        col=i%3; row=i//3; x=45+col*520; y=110+row*390
        if proc['id']=='P05' and i in [0,2]: _mobile_shell(d,(x+125,y,235,330),screen,var)
        elif proc['id']=='P04': _mobile_shell(d,(x+125,y,235,330),screen,var)
        elif proc['id'] in mobile and i>0: _mobile_shell(d,(x+125,y,235,330),screen,var)
        else: _web_shell(d,(x,y,470,330),screen,var)
    im.save(path)

def powerbi_dashboard(code, name, path):
    """Mockup de tablero analítico con jerarquía visual similar a Power BI."""
    w,h=1600,900; im=Image.new('RGB',(w,h),'#F4F6F9'); d=ImageDraw.Draw(im)
    nav_w=178
    d.rectangle((0,0,nav_w,h),fill='#1F2937')
    d.text((28,38),'EcoRoute',font=font(26,True),fill='#60A5FA')
    d.text((28,70),'Business Intelligence',font=font(12),fill='#AAB8C8')
    for i,item in enumerate(['Resumen','Entregas','Rutas','Incidencias','Conductores']):
        yy=145+i*52
        if i==int(code[-1])-1: d.rounded_rectangle((15,yy-8,nav_w-13,yy+26),6,fill='#263B59')
        d.text((30,yy),item,font=font(14,True if i==int(code[-1])-1 else False),fill='#60A5FA' if i==int(code[-1])-1 else '#C7D2DF')
    d.text((28,h-55),'MICOTRANS',font=font(13,True),fill='#D9E5F0')
    x0=nav_w+32; d.text((x0,34),name,font=font(27,True),fill='#14233B')
    d.text((x0,70),'Reporte analítico | EcoRoute para MICOTRANS',font=font(13),fill='#64748B')
    d.text((1415,40),'Actualizado hoy',font=font(12),fill='#64748B')
    # Segmentadores
    filters=['Periodo: Mar-Abr 2026','Sede: Todas','Conductor: Todos','Zona: Todas']
    for i,fl in enumerate(filters):
        fx=x0+i*310; d.rounded_rectangle((fx,98,fx+285,137),7,fill='white',outline='#D8E2EC')
        d.text((fx+13,111),fl+'  ▾',font=font(11),fill='#475569')
    # KPI cards
    sets={
      'D01':[('IID','51.3%','#3B82F6'),('CHR','67.3%','#22C55E'),('TDE','51.3%','#F59E0B'),('TNI','23.3%','#EF4444')],
      'D02':[('Programados','150','#3B82F6'),('Entregados','101','#22C55E'),('A tiempo','77','#10B981'),('Pendientes','35','#EF4444')],
      'D03':[('Km por entrega','17.4','#3B82F6'),('Tiempo/parada','29 min','#22C55E'),('Rutas activas','5','#8B5CF6'),('Desvíos','8','#EF4444')],
      'D04':[('Incidencias','35','#EF4444'),('POD completos','77','#22C55E'),('Sin evidencia','35','#F59E0B'),('Reprogramados','14','#8B5CF6')],
      'D05':[('Productividad','6.7','#3B82F6'),('Meta CHR','90%','#22C55E'),('Acciones abiertas','9','#F59E0B'),('Mejoras cerradas','12','#8B5CF6')],
    }[code]
    for i,(label,val,col) in enumerate(sets):
        bx=x0+i*300; d.rounded_rectangle((bx,157,bx+270,238),9,fill='white',outline='#D8E2EC')
        d.rectangle((bx,157,bx+5,238),fill=col); d.text((bx+18,175),label,font=font(12),fill='#64748B'); d.text((bx+18,197),val,font=font(22,True),fill='#12203A')
    # Panels
    panels=[(x0,260,680,545),(x0+705,260,1415,545),(x0,570,680,855),(x0+705,570,1415,855)]
    chart_titles={
      'D01':['Indicadores vs meta','Cumplimiento por semana','Evidencia digital','Estado de servicios'],
      'D02':['Entregas por estado','Cumplimiento semanal','Entregas por zona','Ventanas horarias'],
      'D03':['Km por entrega','Tiempo por parada','Planificado vs real','Rutas con demora'],
      'D04':['Incidencias por causal','POD completo e incompleto','Tendencia de fallas','Incidencias por zona'],
      'D05':['Ranking de cumplimiento','Productividad por conductor','Acciones de mejora','Meta vs resultado'],
    }[code]
    for k,(x1,y1,x2,y2) in enumerate(panels):
        d.rounded_rectangle((x1,y1,x2,y2),9,fill='white',outline='#D8E2EC')
        d.text((x1+16,y1+14),chart_titles[k],font=font(14,True),fill='#22324B')
        cx,cy=(x1+x2)//2,(y1+y2)//2+20
        if k==0: # bar / clustered
            vals=[45,68,52,79,61]; colors=['#3B82F6','#60A5FA','#3B82F6','#60A5FA','#3B82F6']
            d.line((x1+45,y2-42,x2-25,y2-42),fill='#C9D6E2')
            for j,v in enumerate(vals):
                bx=x1+75+j*92; d.rectangle((bx,y2-42-v*1.5,bx+38,y2-42),fill=colors[j]); d.text((bx+5,y2-29),str(j+1),font=font(10),fill='#64748B')
        elif k==1: # line
            pts=[]
            for j,v in enumerate([75,58,67,61,78,73]): pts.append((x1+55+j*98,y2-55-v))
            d.line(pts,fill='#3B82F6',width=4)
            for px,py in pts: d.ellipse((px-5,py-5,px+5,py+5),fill='#3B82F6')
            d.line((x1+45,y2-38,x2-25,y2-38),fill='#C9D6E2')
        elif k==2: # donut
            d.arc((cx-85,cy-85,cx+85,cy+85),0,220,fill='#22C55E',width=26); d.arc((cx-85,cy-85,cx+85,cy+85),222,325,fill='#F59E0B',width=26); d.arc((cx-85,cy-85,cx+85,cy+85),327,358,fill='#EF4444',width=26)
            d.text((cx-26,cy-11),'67.3%',font=font(20,True),fill='#14233B'); d.text((cx-36,cy+15),'cumplimiento',font=font(10),fill='#64748B')
            d.text((x1+35,y2-38),'● Entregado   ● Pendiente   ● Incidencia',font=font(10),fill='#64748B')
        else: # horizontal bars / table
            for j,(lab,v) in enumerate([('Callao',78),('Santa Anita',64),('Ate',56),('Comas',43)]):
                yy=y1+67+j*43; d.text((x1+22,yy),lab,font=font(11),fill='#475569'); d.rounded_rectangle((x1+115,yy,x1+115+v*4,yy+16),4,fill='#93C5FD'); d.text((x1+115+v*4+7,yy+1),str(v),font=font(10),fill='#64748B')
    d.text((x0,875),'Fuente: pedidos, rutas, entregas, incidencias y POD. Vista propuesta para integración de Power BI.',font=font(11),fill='#64748B')
    im.save(path)

def operational_report(code, name, path):
    """Pantalla diagramada de un listado operativo para el piloto."""
    w,h=1600,900; im=Image.new('RGB',(w,h),'#F4F6F9'); d=ImageDraw.Draw(im)
    nav_w=178
    d.rectangle((0,0,nav_w,h),fill='#1F2937')
    d.text((28,38),'EcoRoute',font=font(26,True),fill='#60A5FA')
    d.text((28,70),'Operación logística',font=font(12),fill='#AAB8C8')
    for i,item in enumerate(['Inicio','Pedidos','Rutas','Incidencias','Reportes']):
        yy=145+i*52
        if item=='Reportes': d.rounded_rectangle((15,yy-8,nav_w-13,yy+26),6,fill='#263B59')
        d.text((30,yy),item,font=font(14,True if item=='Reportes' else False),fill='#60A5FA' if item=='Reportes' else '#C7D2DF')
    d.text((28,h-55),'MICOTRANS',font=font(13,True),fill='#D9E5F0')
    x0=nav_w+32
    d.text((x0,34),name,font=font(27,True),fill='#14233B')
    d.text((x0,70),'Reporte operativo | Consulta, control y exportación',font=font(13),fill='#64748B')
    d.rounded_rectangle((1307,28,1418,68),7,fill='#2563EB')
    d.text((1324,40),'Exportar  ▾',font=font(12,True),fill='white')
    d.rounded_rectangle((1430,28,1568,68),7,fill='white',outline='#D8E2EC')
    d.text((1445,40),'Imprimir',font=font(12,True),fill='#334155')
    # Filtros
    filters = (['Fecha: 20/09/2026','Ruta: Todas','Conductor: Todos','Estado: Todos'] if code=='R01'
               else ['Fecha: 20/09/2026','Conductor: Todos','Estado: Todos','Causal: Todas'])
    for i, fl in enumerate(filters):
        fx=x0+i*300
        d.rounded_rectangle((fx,103,fx+274,145),7,fill='white',outline='#D8E2EC')
        d.text((fx+13,116),fl+'  ▾',font=font(11),fill='#475569')
    d.rounded_rectangle((x0+1218,103,x0+1390,145),7,fill='#0B8F8C')
    d.text((x0+1250,116),'Aplicar filtros',font=font(11,True),fill='white')
    # Resumen de consulta
    total = '28 paradas en 4 rutas' if code=='R01' else '101 entregas cerradas'
    d.text((x0,174),total,font=font(16,True),fill='#22324B')
    d.text((x0,200),'Mostrando datos del día seleccionado',font=font(11),fill='#64748B')
    if code=='R01':
        headers=['Ruta','Seq.','Pedido','Cliente','Dirección','Ventana','Paquetes','Estado','Salida']
        rows=[
            ['R-018','1','PED-1024','Distribuidora Norte','Av. Argentina 245','08:00 - 10:00','4','En ruta','08:12'],
            ['R-018','2','PED-1025','Comercial Anita','Jr. Puno 528','09:00 - 11:00','2','Pendiente','--'],
            ['R-021','1','PED-1026','Bodega Central','Av. La Marina 880','10:00 - 12:00','6','En ruta','08:28'],
            ['R-021','2','PED-1027','Mercado Lima','Calle Los Olivos 421','10:30 - 12:30','3','Pendiente','--'],
            ['R-025','1','PED-1028','Cliente Sur','Av. Próceres 1250','11:00 - 13:00','1','Despachado','08:41'],
        ]
    else:
        headers=['Pedido','Cliente','Resultado','Foto','Firma','GPS','Fecha y hora','Causal','Observación']
        rows=[
            ['PED-1024','Distribuidora Norte','Entregado','Sí','Sí','Sí','20/09 10:16','--','POD completo'],
            ['PED-1025','Comercial Anita','Ausente','Sí','No','Sí','20/09 10:41','Cliente ausente','Reprogramar'],
            ['PED-1026','Bodega Central','Entregado','Sí','Sí','Sí','20/09 11:02','--','POD completo'],
            ['PED-1027','Mercado Lima','Incidencia','Sí','No','Sí','20/09 11:20','Dirección errada','Validar contacto'],
            ['PED-1028','Cliente Sur','Entregado','Sí','Sí','Sí','20/09 11:47','--','POD completo'],
        ]
    tx,ty=x0,236; tw=1390; row_h=66
    weights=[.10,.06,.11,.14,.19,.13,.09,.11,.07] if code=='R01' else [.11,.15,.12,.07,.07,.07,.13,.15,.13]
    xs=[tx]
    for weight in weights: xs.append(xs[-1]+int(tw*weight))
    d.rounded_rectangle((tx,ty,tx+tw,ty+row_h),8,fill='#12395F')
    for i, header in enumerate(headers): d.text((xs[i]+10,ty+24),header,font=font(11,True),fill='white')
    for r_i,row in enumerate(rows):
        yy=ty+row_h*(r_i+1)
        d.rectangle((tx,yy,tx+tw,yy+row_h),fill='white' if r_i%2==0 else '#F8FAFC',outline='#E0E7EF')
        for i,val in enumerate(row):
            color='#334155'
            if (code=='R01' and i==7) or (code=='R02' and i==2):
                chip={'Entregado':'#16A34A','En ruta':'#2563EB','Pendiente':'#F59E0B','Despachado':'#0B8F8C','Ausente':'#F59E0B','Incidencia':'#DC2626'}.get(val,'#334155')
                d.rounded_rectangle((xs[i]+8,yy+20,min(xs[i+1]-7,xs[i]+8+max(55,len(val)*8)),yy+46),6,fill=chip)
                d.text((xs[i]+15,yy+27),val,font=font(9,True),fill='white')
            elif (code=='R02' and i in [3,4,5]):
                color='#16A34A' if val=='Sí' else '#94A3B8'
                d.text((xs[i]+15,yy+26),('● '+val),font=font(10,True),fill=color)
            else:
                d.text((xs[i]+10,yy+26),val,font=font(10),fill=color)
    # Pie de listado y paginación
    bottom=ty+row_h*6+24
    d.text((tx,bottom),'Mostrando 1 - 5 de '+('28 registros' if code=='R01' else '101 registros'),font=font(11),fill='#64748B')
    for i,label in enumerate(['‹','1','2','3','›']):
        bx=tx+1110+i*47
        d.rounded_rectangle((bx,bottom-12,bx+35,bottom+23),5,fill='#2563EB' if label=='1' else 'white',outline='#D8E2EC')
        d.text((bx+13,bottom-2),label,font=font(12,True),fill='white' if label=='1' else '#475569')
    d.text((x0,842),'Fuente: pedidos, rutas y evidencia POD. Diseño propuesto para el piloto EcoRoute MICOTRANS.',font=font(11),fill='#64748B')
    im.save(path)

def bpmn_xml(proc):
    pid=proc['id'].lower()
    tasks=''.join(f'<bpmn:task id="Task_{i}" name="{escape(s)}" />' for i,s in enumerate(proc['steps'],1))
    actors=proc['actors'].split(', '); owners=task_owners[proc['id']]
    lane_xml=[]
    for i, actor in enumerate(actors):
        refs=[]
        if owners[0]==actor: refs.append('<bpmn:flowNodeRef>StartEvent_1</bpmn:flowNodeRef>')
        refs.extend(f'<bpmn:flowNodeRef>Task_{n}</bpmn:flowNodeRef>' for n,owner in enumerate(owners,1) if owner==actor)
        if owners[-1]==actor: refs.append('<bpmn:flowNodeRef>EndEvent_1</bpmn:flowNodeRef>')
        lane_xml.append(f'<bpmn:lane id="Lane_{i+1}" name="{escape(actor)}">{"".join(refs)}</bpmn:lane>')
    flows=[]
    flows.append('<bpmn:sequenceFlow id="Flow_start" sourceRef="StartEvent_1" targetRef="Task_1" />')
    for i in range(1,len(proc['steps'])):
        flows.append(f'<bpmn:sequenceFlow id="Flow_{i}" sourceRef="Task_{i}" targetRef="Task_{i+1}" />')
    flows.append(f'<bpmn:sequenceFlow id="Flow_end" sourceRef="Task_{len(proc["steps"])}" targetRef="EndEvent_1" />')
    return f'''<?xml version="1.0" encoding="UTF-8"?>\n<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="Definitions_{pid}" targetNamespace="https://ecoroute.pe/bpmn">\n  <bpmn:process id="{pid}" name="{escape(proc['title'])}" isExecutable="false">\n    <bpmn:documentation>Objetivo: {escape(proc['goal'])}</bpmn:documentation>\n    <bpmn:laneSet id="LaneSet_1">{"".join(lane_xml)}</bpmn:laneSet>\n    <bpmn:startEvent id="StartEvent_1" name="{escape(proc['trigger'])}" />\n    {tasks}\n    <bpmn:endEvent id="EndEvent_1" name="{escape(proc['result'])}" />\n    {''.join(flows)}\n  </bpmn:process>\n</bpmn:definitions>'''

for p in processes:
    diagram(p,IMG/f"{p['id']}_bpmn.png")
    wireframe(p,IMG/f"{p['id']}_wireframes.png")
    (BPMN/f"{p['id']}_{p['title'].replace(' ','_').replace('/','_')}.bpmn").write_text(bpmn_xml(p),encoding='utf-8')
for code,name,*_ in dashboards:
    powerbi_dashboard(code,name,IMG/f"{code}_dashboard.png")
for code,name,*_ in reports:
    operational_report(code,name,IMG/f"{code}_reporte.png")

def shade(cell, color):
    tcPr=cell._tc.get_or_add_tcPr(); shd=OxmlElement('w:shd'); shd.set(qn('w:fill'),color); tcPr.append(shd)
def set_cell(cell, text, bold=False, color=None):
    cell.text=''; p=cell.paragraphs[0]; p.paragraph_format.space_after=Pt(0); r=p.add_run(str(text)); r.bold=bold; r.font.size=Pt(8.5); 
    if color: r.font.color.rgb=RGBColor.from_string(color)
    cell.vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.CENTER
def header(table, labels):
    for c,l in zip(table.rows[0].cells,labels): shade(c,'103B66'); set_cell(c,l,True,'FFFFFF')
def add_table(doc, labels, rows):
    t=doc.add_table(rows=1, cols=len(labels)); t.alignment=WD_TABLE_ALIGNMENT.CENTER; t.style='Table Grid'; header(t,labels)
    for ri,row in enumerate(rows):
        cells=t.add_row().cells
        for c,v in zip(cells,row):
            if ri%2==1: shade(c,'EEF4F8')
            set_cell(c,v)
    doc.add_paragraph().paragraph_format.space_after=Pt(6)
    return t

doc=Document(); sec=doc.sections[0]; sec.top_margin=Inches(.65); sec.bottom_margin=Inches(.65); sec.left_margin=Inches(.7); sec.right_margin=Inches(.7)
styles=doc.styles; styles['Normal'].font.name='Arial'; styles['Normal']._element.rPr.rFonts.set(qn('w:eastAsia'),'Arial'); styles['Normal'].font.size=Pt(10)
for st in ['Title','Heading 1','Heading 2','Heading 3']:
    styles[st].font.name='Arial'; styles[st]._element.rPr.rFonts.set(qn('w:eastAsia'),'Arial'); styles[st].font.color.rgb=RGBColor(0,0,0)
styles['Heading 1'].font.size=Pt(17); styles['Heading 2'].font.size=Pt(13); styles['Heading 3'].font.size=Pt(11)
p=doc.add_paragraph(style='Title'); p.alignment=WD_ALIGN_PARAGRAPH.CENTER; p.add_run('Especificación de Procesos y Analítica EcoRoute MICOTRANS')
p=doc.add_paragraph(); p.alignment=WD_ALIGN_PARAGRAPH.CENTER; r=p.add_run('Procesos BPMN, wireframes, indicadores, tableros y reportes operativos'); r.italic=True; r.font.size=Pt(12)
doc.add_paragraph('Este paquete organiza los entregables funcionales prioritarios para la propuesta EcoRoute dirigida a Grupo MICOTRANS S.A.C. Los procesos se presentan como diseño objetivo para el piloto: permiten pasar del registro disperso de pedidos y evidencias a una operación trazable y medible.')
doc.add_heading('1. Cobertura solicitada',level=1)
add_table(doc,['Entregable','Cobertura'],[
 ('Lista de procesos','6 procesos críticos de punta a punta.'),('BPMN detallado','6 diagramas con eventos, tareas, compuertas y reglas; archivos BPMN editables.'),('Wireframes','6 láminas con seis pantallas propuestas por proceso.'),('Reportes analíticos','5 indicadores y 5 dashboards; cuatro gráficos y filtros mínimos por tablero.'),('Reportes operativos','2 listados: manifiesto diario y cierre de entregas POD.')])
doc.add_heading('2. Catálogo de procesos',level=1)
add_table(doc,['Código','Proceso','Inicio','Resultado'],[(p['id'],p['title'],p['trigger'],p['result']) for p in processes])
doc.add_heading('3. Procesos BPMN y wireframes',level=1)
for p in processes:
    doc.add_heading(f"{p['id']} {p['title']}",level=2)
    doc.add_paragraph(p['goal'])
    doc.add_paragraph(f"Participantes: {p['actors']}.\nInicio: {p['trigger']}\nFin: {p['result']}")
    doc.add_heading('Reglas de negocio',level=3)
    for rule in p['rules']: doc.add_paragraph(rule,style='List Bullet')
    doc.add_paragraph('Diagrama BPMN propuesto',style='Heading 3'); doc.add_picture(str(IMG/f"{p['id']}_bpmn.png"),width=Inches(6.45))
    doc.paragraphs[-1].alignment=WD_ALIGN_PARAGRAPH.CENTER
    doc.add_page_break()
    doc.add_heading(f"{p['id']} Wireframes de pantallas propuestas",level=2)
    doc.add_paragraph('Las seis pantallas siguientes representan el flujo mínimo que deberá ofrecer el prototipo para este proceso.')
    doc.add_picture(str(IMG/f"{p['id']}_wireframes.png"),width=Inches(6.45)); doc.paragraphs[-1].alignment=WD_ALIGN_PARAGRAPH.CENTER
    doc.add_page_break()
doc.add_heading('4. Indicadores analíticos',level=1)
doc.add_paragraph('Línea base de MICOTRANS: 150 registros revisados. Los valores iniciales permiten definir el piloto y no constituyen una medición definitiva hasta que el dato sea capturado íntegramente en EcoRoute.')
add_table(doc,['Código','Indicador','Fórmula','Base','Meta','Frecuencia'],[x[:6] for x in indicators])
doc.add_heading('5. Diseño de dashboards analíticos',level=1)
doc.add_paragraph('Cada dashboard incorpora filtros mínimos y cuatro visualizaciones. La siguiente matriz define el alcance y luego se presentan los diagramas visuales tipo Power BI. El origen previsto es la vista analítica de solo lectura de PostgreSQL, conectable a Power BI sin requerir exportación manual de CSV.')
add_table(doc,['Código','Dashboard','Usuario','Filtros','Gráficos mínimos'],dashboards)
for code,name,user,filters,charts in dashboards:
    doc.add_page_break()
    doc.add_heading(f'{code} {name}',level=2)
    doc.add_paragraph(f'Usuario principal: {user}. Filtros: {filters}. Los cuatro visuales planteados son: {charts.replace("|", "; ")}.')
    doc.add_picture(str(IMG/f"{code}_dashboard.png"),width=Inches(6.45))
    doc.paragraphs[-1].alignment=WD_ALIGN_PARAGRAPH.CENTER
doc.add_page_break()
doc.add_heading('6. Reportes operativos',level=1)
add_table(doc,['Código','Listado','Usuario','Filtros','Columnas principales'],reports)
doc.add_paragraph('Los dos listados se diagraman a continuación como pantallas de consulta operativa. Ambos permiten filtrar, revisar el detalle por fila, paginar resultados y exportar la información para coordinación y auditoría.')
for code,name,user,filters,cols in reports:
    doc.add_page_break()
    doc.add_heading(f'{code} {name}',level=2)
    doc.add_paragraph(f'Usuario principal: {user}. Filtros: {filters}. Columnas de control: {cols}.')
    doc.add_picture(str(IMG/f"{code}_reporte.png"),width=Inches(6.45))
    doc.paragraphs[-1].alignment=WD_ALIGN_PARAGRAPH.CENTER
doc.add_page_break()
doc.add_heading('7. Archivos complementarios',level=1)
doc.add_paragraph('La carpeta entregables_procesos_ecoroute contiene los seis archivos BPMN editables y el archivo Visualizador_Procesos_EcoRoute_MICOTRANS.html. Este último reúne los BPMN visuales, wireframes, los cinco dashboards diagramados y los dos reportes operativos diagramados en formato navegable.')
doc_path=OUT/'Especificacion_Procesos_EcoRoute_MICOTRANS_actualizado.docx'; doc.save(doc_path)

def chart(title,typ,i):
    vals=[42,66,55,78,63] if i%2==0 else [65,58,74,51,69]
    bars=''.join(f'<div class="bar" style="height:{v*1.2}px"><span>{v}</span></div>' for v in vals)
    return f'<div class="chart"><h4>{title}</h4><div class="chart-body {typ}">{bars}</div><small>Fuente: rutas, pedidos, POD e incidencias</small></div>'
sections=[]
for p in processes:
    rules=''.join(f'<li>{escape(r)}</li>' for r in p['rules'])
    sections.append(f'''<section id="{p['id']}"><h2>{p['id']} · {p['title']}</h2><p>{p['goal']}</p><div class="meta"><b>Inicio:</b> {p['trigger']} &nbsp; <b>Resultado:</b> {p['result']}</div><h3>BPMN detallado con carriles</h3><img class="bpmn-img" src="imagenes/{p['id']}_bpmn.png" alt="BPMN por actor de {escape(p['title'])}"><ul>{rules}</ul><h3>Wireframes de pantallas</h3><img class="wireframe-img" src="imagenes/{p['id']}_wireframes.png" alt="Wireframes de {escape(p['title'])}"></section>''')
dash_html=[]
for code,name,user,filters,charts in dashboards:
    dash_html.append(f'''<section class="dash" id="{code}"><h2>{code} · {name}</h2><p>Usuario principal: {user}. Filtros: {filters}. Incluye: {charts.replace("|", "; ")}.</p><img class="dashboard-img" src="imagenes/{code}_dashboard.png" alt="Dashboard tipo Power BI {escape(name)}"></section>''')
rep_html=[]
for code,name,user,filters,cols in reports:
    rep_html.append(f'''<section class="report" id="{code}"><h2>{code} · {name}</h2><p>Usuario: {user}. Filtros: {filters}. Columnas: {cols}.</p><img class="dashboard-img" src="imagenes/{code}_reporte.png" alt="Diagrama del reporte operativo {escape(name)}"></section>''')
nav=''.join(f'<a href="#{p["id"]}">{p["id"]}</a>' for p in processes)
html=f'''<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>EcoRoute MICOTRANS Procesos y Analítica</title><style>
*{{box-sizing:border-box}} body{{margin:0;font-family:Arial,sans-serif;color:#1d2a35;background:#f5f7fa;line-height:1.45}} header{{background:#103b66;color:#fff;padding:34px max(6vw,28px)}} header h1{{margin:0;font-size:30px}} header p{{margin:7px 0 0;color:#dceaf6}} nav{{position:sticky;top:0;background:#fff;padding:10px 6vw;box-shadow:0 2px 9px #0015;z-index:2}} nav a{{margin-right:15px;color:#103b66;text-decoration:none;font-weight:bold}} main{{max-width:1280px;margin:auto;padding:28px}} section{{background:white;border:1px solid #dae2ea;border-radius:14px;padding:25px;margin:22px 0}} h2{{color:#103b66;margin-top:0}} h3{{margin:22px 0 10px;color:#0b8f8c}} .meta{{background:#edf5fa;border-left:4px solid #0b8f8c;padding:10px 14px}} .bpmn-img,.wireframe-img,.dashboard-img{{width:100%;border:1px solid #d8e2eb;border-radius:10px;background:#f2f6fa;display:block}} table{{width:100%;border-collapse:collapse;margin-top:14px;font-size:13px}} th{{background:#103b66;color:#fff}} th,td{{padding:9px;border:1px solid #d8e1e8;text-align:left}} td{{background:#f8fbfd}}
</style></head><body><header><h1>EcoRoute para MICOTRANS</h1><p>Procesos objetivo, BPMN, wireframes, analítica y reportes operativos</p></header><nav>{nav}<a href="#D01">Dashboards</a><a href="#R01">Reportes</a></nav><main><section><h2>Lista de procesos priorizados</h2><p>Se cubre el ciclo operativo completo: desde el pedido hasta la decisión de mejora. Los BPMN y wireframes son propuestas para el piloto, no una afirmación de que la solución ya se encuentre desplegada.</p><ol>{''.join(f'<li><b>{p["id"]}</b> {p["title"]}</li>' for p in processes)}</ol></section>{''.join(sections)}<section><h2>Definición de cinco indicadores</h2><table><thead><tr><th>Código</th><th>Indicador</th><th>Fórmula</th><th>Base</th><th>Meta</th><th>Frecuencia</th></tr></thead><tbody>{''.join(f'<tr>{"".join(f"<td>{escape(str(v))}</td>" for v in x[:6])}</tr>' for x in indicators)}</tbody></table></section>{''.join(dash_html)}{''.join(rep_html)}</main></body></html>'''
(OUT/'Visualizador_Procesos_EcoRoute_MICOTRANS.html').write_text(html,encoding='utf-8')
print(doc_path)
print(OUT/'Visualizador_Procesos_EcoRoute_MICOTRANS.html')
