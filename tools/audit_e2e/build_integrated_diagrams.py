"""Editable technical diagrams reflecting the corrected implementation, not business actors."""
from pathlib import Path
from html import escape
import textwrap
from PIL import ImageFont

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'docs/correccion_integral/diagramas'
OUT.mkdir(parents=True,exist_ok=True)

class Diagram:
    def __init__(self,title,width=1600,height=1000):
        self.width,self.height=width,height
        self.parts=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}"><defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="4" orient="auto"><path d="M0 0 L9 4 L0 8" fill="none" stroke="#315675" stroke-width="1.6"/></marker></defs><rect width="100%" height="100%" fill="white"/>']
        self.text(35,48,title,30,True)
    def text(self,x,y,text,size=21,bold=False,anchor='start'):
        self.parts.append(f'<text x="{x}" y="{y}" font-family="Arial" font-size="{size}" font-weight="{700 if bold else 400}" fill="#1c3448" text-anchor="{anchor}">{escape(str(text))}</text>')
    def box(self,x,y,w,h,title,lines):
        self.parts.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" fill="#eff4f8" stroke="#315675" stroke-width="2"/>')
        self.text(x+17,y+33,title,23,True)
        pos=y+66
        for paragraph in lines:
            for line in textwrap.wrap(paragraph,width=max(12,int((w-34)/11))):
                self.text(x+17,pos,line,20);pos+=26
        assert pos<=y+h+5,(title,pos,y+h)
    def arrow(self,points,label=None):
        self.parts.append(f'<polyline points="{" ".join(f"{x},{y}" for x,y in points)}" fill="none" stroke="#315675" stroke-width="2" marker-end="url(#arrow)"/>')
        if label:
            (x1,y1),(x2,y2)=points[-2:]
            if y1==y2:self.text((x1+x2)/2,y1-12,label,16,anchor='middle')
            else:self.text(x2+12,(y1+y2)/2-5,label,16)
    def save(self,name):
        (OUT/f'{name}.svg').write_text('\n'.join(self.parts)+"</svg>",encoding='utf8')

d=Diagram('Arquitectura implementada de EcoRoute',1800,1160)
d.box(40,105,430,185,'Consola web React 19',['TypeScript y Vite','Context de sesión, hooks, servicios HTTP','Nginx /api y /ws en Docker'])
d.box(40,360,430,225,'Aplicación Flutter',['BLoC y casos de uso','Dio con refresh de sesión','Caché y outbox local por cuenta','GPS, cámara y firma'])
d.box(620,105,500,185,'Identidad Keycloak',['OIDC y JWT firmados','PKCE web, credenciales en móvil','Realm ecoroute y roles de aplicación','H2 de desarrollo en volumen separado'])
d.box(620,360,500,365,'Backend modular Spring Boot',['Adaptadores REST y WebSocket','JWT, propiedad del conductor y RBAC','Servicios de aplicación y transacciones','Dominio, políticas y puertos','Adaptadores R2DBC, OSRM y AWS','Un servicio desplegable, no microservicios'])
d.box(1280,105,465,230,'PostgreSQL 14',['Pedidos, rutas, POD, historial e incidencias','Revisiones, intentos, acciones y metas','Outbox y notificaciones','Vistas de lectura analítica'])
d.box(1280,395,465,145,'Redis',['Límite de peticiones y revocación','PubSub de GPS entre conexiones'])
d.box(1280,600,465,145,'OSRM autohospedado',['Red vial del Perú','Orden y geometría, sin tráfico en vivo'])
d.box(620,870,500,210,'Evidencias S3 y eventos SQS',['LocalStack simula AWS en desarrollo','Respaldo local de bytes en PostgreSQL','Worker reenvía eventos no confirmados','Producción requiere servicios durables'])
d.box(1280,870,465,210,'Consumo analítico',['Paneles y reportes React','CSV operativo con filtros','Power BI puede consultar vistas','Conexión Power BI real aún pendiente'])
d.arrow([(470,170),(620,170)],'OIDC')
d.arrow([(470,225),(545,225),(545,420),(620,420)],'REST / WS')
d.arrow([(620,420),(545,420),(545,225),(470,225)])
d.arrow([(300,360),(300,320),(590,320),(590,250),(620,250)])
d.text(445,311,'OIDC móvil',16,anchor='middle')
d.arrow([(470,450),(620,450)],'REST y GPS')
d.arrow([(860,360),(860,290)],'JWKS y API Admin')
d.arrow([(1120,415),(1200,415),(1200,220),(1280,220)],'R2DBC')
d.arrow([(1120,485),(1280,485)],'Redis')
d.arrow([(1120,650),(1280,650)],'HTTP')
d.arrow([(870,725),(870,870)],'SDK AWS')
d.arrow([(1510,335),(1770,335),(1770,840),(1510,840),(1510,870)],'Vistas BI')
d.text(45,1125,'Los puestos del negocio se modelan en BPMN. Estos recuadros representan componentes técnicos, no actores del negocio.',21)
d.save('arquitectura_corregida')

def sequence(name,title,actors,events):
    width=1800; gap=(width-260)/(len(actors)-1); xs=[130+i*gap for i in range(len(actors))]
    height=210+105*len(events);s=Diagram(title,width,height)
    for actor,x in zip(actors,xs):
        for i,line in enumerate(textwrap.wrap(actor,19)):s.text(x,100+i*24,line,20,True,'middle')
        s.parts.append(f'<line x1="{x}" y1="150" x2="{x}" y2="{height-25}" stroke="#b1bdc8" stroke-dasharray="6 5"/>')
    for i,(source,target,text) in enumerate(events):
        y=210+i*105
        if source==target:
            s.arrow([(xs[source],y),(xs[source]+65,y),(xs[source]+65,y+30),(xs[source],y+30)])
            tx=xs[source]+80
        else:
            s.arrow([(xs[source],y),(xs[target],y)]);tx=min(xs[source],xs[target])+12
        lines=textwrap.wrap(f'{i+1}. {text}',72)
        # A message near the final lifeline may extend beyond the canvas even
        # when it wraps. Measure the rendered font and align that label inward.
        font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',20)
        label_width=max(font.getlength(line) for line in lines)
        tx=min(tx,width-40-label_width)
        assert tx>=35,(name,i+1,tx)
        for j,line in enumerate(lines):s.text(tx,y-18-(len(lines)-1-j)*25,line,20)
    s.save(name)

sequence('secuencia_pedido_despacho','Confirmación comercial y preparación de la jornada',
 ['Dispatcher web','REST y acceso','Aplicación','PostgreSQL','Conductor móvil'],[
 (0,1,'POST /orders sin routeId con datos válidos'),(1,2,'createOrder fuerza PENDING, sin asignación'),
 (2,3,'INSERT pedido e historial dentro de una transacción'),
 (0,1,'PATCH business-data registra aceptación, dirección y cobertura'),
 (2,3,'Guarda declaración del operador, actor y fecha'),
 (0,1,'PATCH route asigna el mismo ID a una ruta PLANNED'),
 (2,3,'Bloquea recurso, exige confirmación e invalida revisión anterior'),
 (0,1,'Jefatura autoriza la revisión con capacidad y carga'),
 (4,1,'DRIVER acepta su propia hoja de ruta'),
 (0,1,'PATCH status IN_PROGRESS solicita despacho'),
 (2,3,'Exige controles previos y pedidos; guarda recorrido y EN TRÁNSITO')])
sequence('secuencia_pod','Entrega con evidencia y sincronización idempotente',
 ['Conductor Flutter','Outbox local','Backend','PostgreSQL','S3 y SQS'],[
 (0,0,'Captura foto, firma, receptor, DNI, GPS y hora del dispositivo'),
 (0,1,'Persiste operación por cuenta y pedido antes de informar pendiente'),
 (1,2,'POST delivery-proofs al disponer de conexión y sesión válida'),
 (2,3,'Bloquea pedido, valida propiedad y estado IN_TRANSIT'),
 (2,4,'Sube archivos privados con claves únicas'),
 (2,3,'En Docker guarda respaldo durable de bytes para el emulador'),
 (2,3,'Guarda POD, hashes SHA256, hora de recepción y captura'),
 (2,3,'Cambia a DELIVERED, historial y outbox en la misma transacción'),
 (2,1,'Responde POD confirmado; el reenvío devuelve el mismo POD'),
 (2,4,'Worker publica con reintento y consume evento'),
 (2,3,'Notificación única; el emisor comprueba confirmación antes de dar por finalizado el evento')])
sequence('secuencia_gps','Seguimiento GPS autenticado y distribuido',
 ['Flutter GPS','REST GPS','PostgreSQL','Redis','WebSocket web'],[
 (0,1,'Ping usa driverId y vehicleId reales de la ruta en ejecución'),
 (1,1,'JWT, conductor propietario, vehículo y ruta activa'),
 (1,2,'Persiste coordenadas, velocidad y fecha de la muestra'),
 (1,3,'Publica ecoroute:gps con el identificador del vehículo'),
 (4,1,'Primer mensaje WebSocket con accessToken y vehicleId'),
 (1,1,'Valida JWT y autorización; anónimo se cierra con código 1008'),
 (3,4,'PubSub entrega puntos solo a suscripciones autorizadas'),
 (4,4,'Mapa actualiza marcador y mantiene alternativa de polling al fallar el canal')])
sequence('secuencia_excepciones','Resolución de incidencias conservando el resultado histórico',
 ['Conductor','Dispatcher','Servicio P04','PostgreSQL','Jefatura'],[
 (0,2,'Registra FAILED o RETURNED con motivo obligatorio'),
 (2,3,'Historial y una incidencia abierta por pedido'),
 (1,2,'Evalúa el caso y acuerda recuperación con el cliente'),
 (2,3,'RETRY requiere jornada activa y crea un nuevo intento IN_TRANSIT'),
 (2,3,'REPLAN requiere otra ruta PLANNED y crea un intento ASSIGNED'),
 (2,3,'En reprogramación deja pendiente la nueva aceptación comercial'),
 (1,2,'Nueva ventana vigente y confirmación de condiciones antes de aprobar'),
 (4,2,'CLOSE_FAILED o CLOSE_CASE exige autorización de jefatura'),
 (2,3,'Vínculo order_attempts y auditoría; el pedido original no se reabre')])
sequence('secuencia_bi','Inteligencia de negocios y seguimiento de decisiones',
 ['Jefatura web','ReportController','Servicio analítico','Vistas PostgreSQL','Acción P05'],[
 (0,1,'Solicita fecha inicial, final y conductor'),
 (1,2,'Valida filtros y propaga el mismo alcance'),
 (2,3,'Lee pedidos por fecha operativa America/Lima'),
 (3,2,'Devuelve población, evidencias, ventanas, causas y muestras GPS'),
 (2,0,'Calcula IID, CHR, TDE, SUCCESS y ONTIME con denominadores explícitos'),
 (0,4,'Documenta causa, responsable, fecha y meta de la acción'),
 (4,3,'Persiste OPEN y luego IN_PROGRESS con nota'),
 (0,4,'Verifica resultado declarado y evidencia de la decisión'),
 (4,3,'VERIFIED exige valor, actor y nota; la causalidad se valida fuera del registro')])
sequence('secuencia_identidad','Sesión efectiva y administración de acceso',
 ['Web o móvil','Keycloak','Backend','Redis','PostgreSQL'],[
 (0,1,'Autentica usuario y obtiene JWT más refresh token'),
 (0,2,'Authorization Bearer en solicitudes protegidas'),
 (2,1,'Valida firma mediante JWK, issuer y expiración'),
 (2,3,'Comprueba revocación por subject antes de autorizar'),
 (2,4,'Conductor se resuelve por drivers.external_id igual al sub validado'),
 (2,0,'session/me devuelve identidad efectiva y driverId vinculado'),
 (0,2,'Administrador solicita cambio de roles o habilitación'),
 (2,1,'Cliente técnico local gestiona solo identidades humanas'),
 (2,3,'Revoca JWT anterior y cierra sesiones en Keycloak'),
 (2,4,'Audita el cambio sin guardar contraseñas ni tokens')])
print(f'{len(list(OUT.glob("*.svg")))} SVG editables en {OUT}')
