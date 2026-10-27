"""Build editable physical business ERDs from exported PostgreSQL catalog JSON.

No migration parser, invented tables, inferred FKs or AI imagery. Uses bundled
Pillow for text measurement/QA and bundled Sharp for deterministic SVG rendering.
Run with the bundled Python. Use --verify-sql only with delegated Docker access;
it creates/removes one labeled, isolated disposable PostgreSQL container.
"""
from __future__ import annotations

import argparse
from collections import Counter
from datetime import datetime, timezone
import hashlib
import heapq
from html import escape
import json
import os
from pathlib import Path
import re
import subprocess
import time
import uuid
import xml.etree.ElementTree as ET

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SOURCE = ROOT / "docs/correccion_integral/evidencias/esquema_fisico_verificado.json"
DEFAULT_OUTPUT = ROOT / "docs/correccion_integral/diagramas"
RUNTIME = Path(os.environ.get("USERPROFILE", str(Path.home()))) / ".cache/codex-runtimes/codex-primary-runtime/dependencies"
SUPPORT = {"business_audit_events", "order_status_history", "delivery_outbox", "notifications",
           "analytics_goal_history", "analytics_goal_history_facts"}
EXCLUDE_SUPPORT = {"local_evidence_backups"}
COLORS = {"resource": "#176c67", "planning": "#35638d", "orders": "#225c9a",
          "incidents": "#a35929", "catalog": "#697235", "analytics": "#72569b", "support": "#606e7a"}
GROUPS = [
    ("RECURSOS", "resource", ["drivers", "driver_contracts", "driver_shifts", "vehicles", "vehicle_maintenance_logs"]),
    ("PLANIFICACIÓN", "planning", ["routes", "route_dispatch_reviews", "vehicle_gps_history", "fuel_logs", "route_expenses"]),
    ("PEDIDOS Y EVIDENCIAS", "orders", ["orders", "order_business_data", "delivery_proofs", "order_items", "products"]),
    ("INCIDENCIAS Y MEJORA", "incidents", ["incidents", "order_attempts", "improvement_actions", "business_audit_events"]),
    ("CATÁLOGOS Y SOPORTE", "catalog", ["hubs", "purchases", "order_status_history", "delivery_outbox", "notifications"]),
    ("ANALÍTICA / VISTAS", "analytics", ["analytics_goals", "analytics_goal_history", "analytics_order_facts", "analytics_route_facts", "analytics_goal_facts", "analytics_goal_history_facts"]),
]
DETAILS = [
    ("01_recursos_planificacion", "Recursos, planificación y despacho", [
        ["drivers", "driver_contracts", "driver_shifts"],
        ["routes", "route_dispatch_reviews", "route_expenses"],
        ["vehicles", "vehicle_maintenance_logs", "fuel_logs", "vehicle_gps_history"]]),
    ("02_pedidos_evidencias", "Pedidos, confirmación comercial y evidencia", [
        ["routes", "products", "order_items"],
        ["orders", "order_business_data"],
        ["delivery_proofs", "order_status_history", "delivery_outbox", "notifications"]]),
    ("03_incidencias_mejora", "Incidencias V13, reintentos y mejora", [
        ["routes", "analytics_goals", "analytics_goal_history"],
        ["orders", "improvement_actions"],
        ["incidents", "order_attempts", "business_audit_events"]]),
    ("04_analitica_catalogos", "Vistas analíticas, metas y catálogos", [
        ["analytics_order_facts"],
        ["analytics_route_facts", "analytics_goal_facts", "analytics_goal_history_facts"],
        ["analytics_goals", "analytics_goal_history", "improvement_actions", "purchases", "hubs"]]),
]
SELECTED = {
    "orders": ["id", "route_id", "tracking_number", "status", "driver_id", "recipient_name", "delivery_district"],
    "incidents": ["id", "route_id", "order_id", "next_route_id", "retry_order_id", "status", "outcome"],
    "analytics_order_facts": ["order_id", "operation_date", "recipient_ruc", "iid_valid", "digital_evidence", "on_time", "complete_pod"],
    "analytics_route_facts": ["route_id", "operation_date", "actual_gps_distance_km", "operation_minutes", "km_per_delivery", "time_per_stop_min", "distance_source"],
}


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def utc_now():
    return time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())


def write_json(path, data):
    Path(path).write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def xml(value):
    return escape(str(value), quote=True)


def identifiers(value):
    return [p.strip().strip('"') for p in value.split(",")]


def physical_catalog(source):
    data = json.loads(Path(source).read_text(encoding="utf-8-sig"))
    all_objects = {t["name"]: t for t in data["tables"]}
    if len(all_objects) != len(data["tables"]):
        raise ValueError("Nombres duplicados en el catálogo")
    excluded = {n: "legacy / fuera del alcance" for n in all_objects if n.startswith(("corp_", "auth_", "flyway_"))}
    excluded.update({n: "soporte técnico de evidencia local; fuera del ERD de negocio" for n in all_objects if n in EXCLUDE_SUPPORT})
    objects = {n: t for n, t in all_objects.items() if n not in excluded}
    fks = []
    for name, table in objects.items():
        table["constraints"] = table.get("constraints") or []
        table["keys"] = {c["name"]: [] for c in table["columns"]}
        for con in table["constraints"]:
            definition = con["definition"]
            if con["type"] in ("p", "u"):
                fields = identifiers(re.search(r"\(([^)]+)\)", definition).group(1))
                key = "PK" if con["type"] == "p" else "UQ" if len(fields) == 1 else "UQ*"
                for field in fields:
                    table["keys"][field].append(key)
            elif con["type"] == "f":
                match = re.search(r'FOREIGN KEY \(([^)]+)\) REFERENCES (?:(?:"?public"?)\.)?"?([A-Za-z_][\w]*)"?\(([^)]+)\)', definition)
                if not match:
                    raise ValueError(f"FK no reconocida del catálogo: {name}.{con['name']}: {definition}")
                children, parent, parents = identifiers(match[1]), match[2], identifiers(match[3])
                if len(children) != len(parents):
                    raise ValueError("FK compuesta de cardinalidad inconsistente")
                for child in children:
                    table["keys"][child].append("FK")
                if parent not in all_objects:
                    raise ValueError(f"Tabla referenciada no exportada: {parent}")
                for parent_col in parents:
                    if parent_col not in {c['name'] for c in all_objects[parent]['columns']}:
                        raise ValueError(f"Columna referenciada ausente: {parent}.{parent_col}")
                fks.append({"name": con["name"], "child": name, "childColumns": children,
                            "parent": parent, "parentColumns": parents, "definition": definition})
    return data, objects, excluded, fks


def font(size, bold=False):
    filenames = (["consolab.ttf", "consola.ttf"] if bold else ["consola.ttf"]) + ["DejaVuSansMono.ttf"]
    for filename in filenames:
        for location in (Path("C:/Windows/Fonts") / filename, Path(filename)):
            try:
                return ImageFont.truetype(str(location), size)
            except OSError:
                pass
    raise RuntimeError("Se requiere fuente monoespaciada Consolas o DejaVu Sans Mono")


def compact_type(value):
    return (value.replace("timestamp with time zone", "timestamptz")
            .replace("timestamp without time zone", "timestamp")
            .replace("character varying", "varchar").replace("double precision", "float8"))


def rows(table, overview):
    if not overview:
        return table["columns"]
    preferred = SELECTED.get(table["name"], [])
    key_names = [n for n, k in table["keys"].items() if k]
    names = list(dict.fromkeys(key_names + preferred + [c["name"] for c in table["columns"]]))[:8]
    return [c for c in table["columns"] if c["name"] in names]


class Router:
    """Compressed Manhattan grid, routing strictly outside all table rectangles."""
    def __init__(self, cards, width, height):
        self.obstacles = [(c['x']-8,c['y']-8,c['x']+c['w']+8,c['y']+c['h']+8) for c in cards.values()]
        self.xs = sorted(set([26, width-26] + [p for c in cards.values() for p in (c['x']-23,c['x']+c['w']+23)]))
        self.ys = sorted(set([174, height-40] + [p for c in cards.values() for p in (c['y']-23,c['y']+c['h']+23)]
                             + [y for c in cards.values() for y in c['anchors'].values()]))
        self.xi, self.yi = {x:i for i,x in enumerate(self.xs)}, {y:i for i,y in enumerate(self.ys)}
        self.cache, self.used = {}, Counter()

    def clear(self, a, b):
        key = tuple(sorted((a,b)))
        if key not in self.cache:
            x1,y1,x2,y2 = *a,*b
            blocked = any((x1 == x2 and l < x1 < r and max(min(y1,y2),t) < min(max(y1,y2),bt))
                          or (y1 == y2 and t < y1 < bt and max(min(x1,x2),l) < min(max(x1,x2),r))
                          for l,t,r,bt in self.obstacles)
            self.cache[key] = not blocked
        return self.cache[key]

    def path(self, start, end):
        first, target = (self.xi[start[0]],self.yi[start[1]]), (self.xi[end[0]],self.yi[end[1]])
        queue, costs, previous = [(0,0,first,0)], {(first,0):0}, {}
        end_state = None
        while queue:
            _, cost, node, direction = heapq.heappop(queue)
            state = (node,direction)
            if cost != costs.get(state):
                continue
            if node == target:
                end_state = state
                break
            for dx,dy,heading in ((1,0,1),(-1,0,1),(0,1,2),(0,-1,2)):
                neighbor = node[0]+dx,node[1]+dy
                if not (0 <= neighbor[0] < len(self.xs) and 0 <= neighbor[1] < len(self.ys)):
                    continue
                a,b = (self.xs[node[0]],self.ys[node[1]]),(self.xs[neighbor[0]],self.ys[neighbor[1]])
                if not self.clear(a,b):
                    continue
                edge = tuple(sorted((a,b)))
                next_cost = cost + abs(a[0]-b[0])+abs(a[1]-b[1]) + (24 if direction and direction != heading else 0) + self.used[edge]*17
                next_state = (neighbor,heading)
                if next_cost < costs.get(next_state,float('inf')):
                    costs[next_state],previous[next_state] = next_cost,state
                    heuristic = abs(b[0]-end[0])+abs(b[1]-end[1])
                    heapq.heappush(queue,(next_cost+heuristic,next_cost,neighbor,heading))
        if end_state is None:
            raise RuntimeError(f"Sin corredor libre para FK {start} -> {end}")
        points = []
        while True:
            node,_ = end_state
            points.append((self.xs[node[0]],self.ys[node[1]]))
            if end_state not in previous:
                break
            end_state = previous[end_state]
        points.reverse()
        for a,b in zip(points,points[1:]):
            self.used[tuple(sorted((a,b)))] += 1
        simple = []
        for point in points:
            if len(simple) >= 2 and ((simple[-2][0] == simple[-1][0] == point[0]) or (simple[-2][1] == simple[-1][1] == point[1])):
                simple.pop()
            simple.append(point)
        return simple


def draw_diagram(stem, title, columns, objects, fks, out, source_hash, overview=False, keycloak=False):
    regular, small, strong = font(15), font(13), font(17,True)
    row_h, card_header = 27, 62
    cards, lane_widths, row_data = {}, [], {}
    for lane in columns:
        widths = [590]
        for name in lane:
            table = objects[name]
            row_data[name] = rows(table,overview)
            for c in row_data[name]:
                widths.append(104+regular.getlength(c['name'])+small.getlength(compact_type(c['type']))+54)
            widths.append(strong.getlength(name)+195)
        lane_widths.append(int(max(widths))+12)
    x, start_y = 70, 244 if keycloak else 213
    for index,lane in enumerate(columns):
        y = start_y
        for name in lane:
            table, visible = objects[name],row_data[name]
            hidden = len(table['columns'])-len(visible)
            h = card_header+row_h*len(visible)+(32 if hidden else 0)+34
            anchors = {c['name']:y+card_header+row_h*(i+0.5) for i,c in enumerate(visible)}
            cards[name] = dict(x=x,y=y,w=lane_widths[index],h=h,anchors=anchors,lane=index)
            y += h+92
        x += lane_widths[index]+145
    width, height = x-75, max(c['y']+c['h'] for c in cards.values())+152
    external = None
    if keycloak:
        external = dict(x=70,y=174,w=lane_widths[0],h=48,anchors={'sub':198},lane=0)
    routing_cards = dict(cards)
    if external:
        routing_cards['external-keycloak'] = external
    router = Router(routing_cards,width,height)
    paths, visible_fks, off_page = [], [], []

    def connect(child, child_col, parent, parent_col, logical=False):
        source,target = routing_cards[child],routing_cards[parent]
        if source['lane'] < target['lane']:
            source_side,target_side = 1,-1
        elif source['lane'] > target['lane']:
            source_side,target_side = -1,1
        else:
            source_side = target_side = -1
        sy,ty = source['anchors'][child_col],target['anchors'][parent_col]
        sx = source['x']+source['w'] if source_side == 1 else source['x']
        tx = target['x']+target['w'] if target_side == 1 else target['x']
        points = [(sx,sy)]+router.path((sx+source_side*23,sy),(tx+target_side*23,ty))+[(tx,ty)]
        d = 'M'+' L'.join(f'{px:.1f},{py:.1f}' for px,py in points)
        color = '#9d53a0' if logical else '#497693'
        attrs = 'stroke-dasharray="8 6"' if logical else ''
        return f'<path d="{d}" fill="none" stroke="{color}" stroke-width="2" {attrs} marker-end="url(#arrow{1 if logical else 0})"/>'

    for fk in fks:
        if fk['child'] in cards and fk['parent'] in cards:
            for child_col,parent_col in zip(fk['childColumns'],fk['parentColumns']):
                if child_col not in cards[fk['child']]['anchors'] or parent_col not in cards[fk['parent']]['anchors']:
                    raise ValueError(f"Campo FK oculto en {stem}: {fk}")
                paths.append('<g><title>'+xml(fk['definition'])+'</title>'+connect(fk['child'],child_col,fk['parent'],parent_col)+'</g>')
            visible_fks.append(fk['name'])
        elif fk['child'] in cards:
            off_page.append(f"{fk['child']}.{','.join(fk['childColumns'])} → {fk['parent']}.{','.join(fk['parentColumns'])}")
    if external:
        paths.append('<g><title>Relación lógica de identidad: drivers.external_id ↔ Keycloak sub UUID. No existe FK ni tabla local Keycloak.</title>'
                     +connect('drivers','external_id','external-keycloak','sub',True)+'</g>')
    doc = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
           '<title>'+xml(title)+'</title>',
           '<desc>ERD de negocio desde catálogo físico PostgreSQL. Sólo constraints FK reales; Keycloak es relación lógica externa.</desc>',
           '<defs><pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="0.8" fill="#d4dce6"/></pattern>',
           '<marker id="arrow0" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="#497693"/></marker>',
           '<marker id="arrow1" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="#9d53a0"/></marker></defs>',
           '<style>text{font-family:Consolas,"DejaVu Sans Mono",monospace;fill:#25374b}.title{font-size:29px;font-weight:bold}.sub{font-size:15px;fill:#536579}.field{font-size:15px}.dtype{font-size:13px;fill:#5e6b78}.key{font-size:12px;font-weight:bold;fill:#175570}.table{font-size:17px;font-weight:bold;fill:white}.tag{font-size:12px;fill:white}.note{font-size:13px;fill:#536579}.lane{font-size:17px;font-weight:bold;fill:#415870}</style>',
           f'<rect width="{width}" height="{height}" fill="#f1f4f8"/><rect width="{width}" height="{height}" fill="url(#grid)"/>',
           '<text x="36" y="46" class="title">'+xml(title)+'</text>',
           f'<text x="36" y="75" class="sub">EcoRoute · catálogo físico verificado · {len(cards)} objetos · {len(visible_fks)} constraints FK visibles · '+('resumen; todos los campos en detalles' if overview else 'todos los campos físicos')+'</text>',
           '<text x="36" y="104" class="sub">PK clave primaria · FK real → clave referenciada · UQ UNIQUE · UQ* UNIQUE compuesta · ! NOT NULL · VISTA sin PK/FK inferidas</text>',
           '<text x="36" y="131" class="sub">SOPORTE = auditoría / eventos / avisos · discontinua violeta = identidad lógica Keycloak, sin FK · gris = catálogo relacional</text>',
           f'<text x="36" y="157" class="note">Fuente SHA256 {source_hash[:24]}… · no incluye CORP, auth legacy, Flyway ni respaldo local de evidencia</text>']
    if overview:
        for i,(label,_,_) in enumerate(GROUPS):
            if i < len(columns):
                card = cards[columns[i][0]]
                doc.append(f'<text x="{card["x"]}" y="{start_y-15}" class="lane">{xml(label)}</text>')
    doc.extend(paths)
    if external:
        e = external
        doc.extend([f'<g id="external-keycloak"><rect x="{e["x"]}" y="{e["y"]}" width="{e["w"]}" height="{e["h"]}" rx="6" fill="#f6eefa" stroke="#9d53a0" stroke-dasharray="8 5"/>',
                    f'<text x="{e["x"]+14}" y="{e["y"]+20}" class="field">KEYCLOAK EXTERNO · sub UUID lógico</text>',
                    f'<text x="{e["x"]+14}" y="{e["y"]+38}" class="note">No es tabla local; external_id local es varchar(50)</text></g>'])
    for name,c in cards.items():
        t,visible = objects[name],row_data[name]
        group = next((g for g in GROUPS if name in g[2]),('','support',[]))
        kind = 'VISTA' if t['kind'] == 'v' else 'SOPORTE' if name in SUPPORT else 'TABLA'
        color = COLORS['support'] if name in SUPPORT else COLORS[group[1]]
        doc.append(f'<g id="table-{xml(name)}"><title>{xml(t.get("comment") or name)}</title>')
        doc.append(f'<rect x="{c["x"]}" y="{c["y"]+3}" width="{c["w"]}" height="{c["h"]}" rx="6" fill="#d8dfe9"/>')
        doc.append(f'<rect x="{c["x"]}" y="{c["y"]}" width="{c["w"]}" height="{c["h"]}" rx="6" fill="white" stroke="#a7b5c6" stroke-width="1.5"/>')
        doc.append(f'<path d="M{c["x"]+6},{c["y"]} h{c["w"]-12} q6,0 6,6 v{card_header-6} h-{c["w"]} v-{card_header-6} q0,-6 6,-6" fill="{color}"/>')
        doc.append(f'<text x="{c["x"]+14}" y="{c["y"]+26}" class="table">{xml(name)}</text>')
        doc.append(f'<text x="{c["x"]+14}" y="{c["y"]+48}" class="tag">{kind} · {len(t["columns"])} columnas físicas</text>')
        for index,column in enumerate(visible):
            cy = c['y']+card_header+row_h*index
            keys = t['keys'][column['name']]
            fill = '#e8f2fb' if 'PK' in keys else '#e9f6f0' if 'FK' in keys else '#f6f8fb' if index%2 else '#ffffff'
            datatype = compact_type(column['type'])
            left_end = c['x']+97+regular.getlength(column['name'])
            right_start = c['x']+c['w']-35-small.getlength(datatype)
            if left_end+15 > right_start:
                raise ValueError(f"Texto solapado: {stem}/{name}/{column['name']}")
            tooltip = {k:column.get(k) for k in ('name','type','nullable','default','comment')}
            doc.append(f'<g><title>{xml(json.dumps(tooltip,ensure_ascii=False))}</title><rect x="{c["x"]+1}" y="{cy}" width="{c["w"]-2}" height="{row_h}" fill="{fill}"/>')
            doc.append(f'<text x="{c["x"]+9}" y="{cy+19}" class="key">{xml("/".join(keys))}</text>')
            doc.append(f'<text x="{c["x"]+97}" y="{cy+19}" class="field">{xml(column["name"])}</text>')
            doc.append(f'<text x="{c["x"]+c["w"]-35}" y="{cy+19}" class="dtype" text-anchor="end">{xml(datatype)}</text>')
            doc.append(f'<text x="{c["x"]+c["w"]-15}" y="{cy+19}" class="key">{"!" if not column["nullable"] else ""}</text></g>')
        hidden = len(t['columns'])-len(visible)
        foot_y = c['y']+card_header+row_h*len(visible)+21
        if hidden:
            doc.append(f'<text x="{c["x"]+14}" y="{foot_y}" class="note">+ {hidden} campos · ver vistas de detalle / diccionario JSON</text>')
            foot_y += 32
        counts = Counter(k['type'] for k in t['constraints'])
        footer = f"PK {counts['p']} · FK {counts['f']} · UQ {counts['u']} · CHECK {counts['c']}"
        doc.append(f'<text x="{c["x"]+14}" y="{foot_y}" class="note">{footer}</text></g>')
    doc.append(f'<text x="36" y="{height-73}" class="note">Las vistas muestran nulabilidad del catálogo; no se infieren restricciones de tablas fuente. No se dibujan dependencias de vistas no exportadas.</text>')
    doc.append(f'<text x="36" y="{height-48}" class="note">orders.driver_id, improvement_actions.metric_code y referencias polimórficas de auditoría carecen de FK: no se inventan enlaces.</text>')
    doc.append(f'<text x="36" y="{height-23}" class="note">{len(off_page)} FK hacia objetos fuera de esta vista; consultar manifiesto y ERD global. Fuente: esquema_fisico_verificado.json.</text></svg>')
    path = out/(stem+'.svg')
    path.write_text('\n'.join(doc)+'\n',encoding='utf-8')
    ET.parse(path)
    return dict(file=path.name,width=width,height=height,objects=list(cards),fkConstraints=visible_fks,
                outsideView=off_page,allColumns=not overview,logicalKeycloak=keycloak,
                textOverlapChecks='PASS',connectorTableCollisionChecks='PASS',sha256=sha(path))


def render_pngs(out, diagrams):
    node = RUNTIME/'node/bin/node.exe'
    sharp = RUNTIME/'node/node_modules/sharp'
    script = "const sharp=require(process.argv[1]); (async()=>{for(const f of process.argv.slice(2)){await sharp(f,{limitInputPixels:false}).png().toFile(f.replace(/\\.svg$/,'.png'));}})().catch(e=>{console.error(e);process.exit(1)});"
    subprocess.run([str(node),'-e',script,str(sharp)]+[str(out/d['file']) for d in diagrams],check=True,capture_output=True,text=True)
    qa = out/'_qa'
    qa.mkdir(exist_ok=True)
    thumbs = []
    for d in diagrams:
        path = out/Path(d['file']).with_suffix('.png')
        with Image.open(path) as im:
            if im.size != (d['width'],d['height']):
                raise ValueError(f"Dimensiones PNG incorrectas: {path}")
            d['png'] = dict(file=path.name,width=im.width,height=im.height,sha256=sha(path))
            rgb = im.convert('RGB')
            rgb.thumbnail((1100,850))
            panel = Image.new('RGB',(1140,900),'#edf1f6')
            ImageDraw.Draw(panel).text((20,12),d['file'],font=font(17,True),fill='#25374b')
            panel.paste(rgb,(20,45))
            thumbs.append(panel)
            if d['allColumns']:
                im.crop((40,190,min(im.width,1550),min(im.height,1090))).save(qa/(path.stem+'_zoom.png'))
    contact = Image.new('RGB',(2280,900*3),'#dbe3ed')
    for i,panel in enumerate(thumbs):
        contact.paste(panel,((i%2)*1140,(i//2)*900))
    contact.save(qa/'erd_verificado_contacto.png')


CATALOG_SQL = """
SELECT json_build_object('serverVersion',current_setting('server_version'),'tables',(
 SELECT json_agg(json_build_object('name',c.relname,'kind',c.relkind,'comment',obj_description(c.oid,'pg_class'),
 'columns',(SELECT json_agg(json_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),
 'nullable',NOT a.attnotnull,'default',pg_get_expr(ad.adbin,ad.adrelid),'comment',col_description(c.oid,a.attnum)) ORDER BY a.attnum)
 FROM pg_attribute a LEFT JOIN pg_attrdef ad ON ad.adrelid=a.attrelid AND ad.adnum=a.attnum
 WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped),
 'constraints',(SELECT COALESCE(json_agg(json_build_object('name',con.conname,'type',con.contype,
 'definition',pg_get_constraintdef(con.oid)) ORDER BY con.conname),'[]'::json)
 FROM pg_constraint con WHERE con.conrelid=c.oid)) ORDER BY c.relname)
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind IN ('r','p','v') AND c.relname<>'flyway_schema_history'));
"""


def canonical_table(table):
    return dict(name=table['name'],kind=table['kind'],comment=table.get('comment'),
                columns=[{k:c.get(k) for k in ('name','type','nullable','default','comment')} for c in table['columns']],
                constraints=sorted(table.get('constraints') or [],key=lambda c:c['name']))


def verify_sql(sql, source, output):
    """No host mounts, published ports, compose, or connections to existing DBs."""
    report = dict(startedAtUtc=utc_now(),sql=str(sql.relative_to(ROOT)),
                  sqlSha256=sha(sql),physicalJsonSha256=sha(source),image='postgres:14-alpine',
                  isolation='new disposable container; network none; no ports; tmpfs data; no operational database access',
                  operationalDatabaseModified=False,status='RUNNING')
    container_id = None
    label = 'ecoroute.verified-erd-audit'
    token = uuid.uuid4().hex[:12]
    def run(args,**kwargs):
        return subprocess.run(['docker']+args,capture_output=True,text=True,encoding='utf-8',errors='replace',**kwargs)
    try:
        created = run(['run','--detach','--name','ecoroute-erd-sql-audit-'+token,'--label',label+'='+token,
                       '--network','none','--tmpfs','/var/lib/postgresql/data','-e','POSTGRES_HOST_AUTH_METHOD=trust',
                       '-e','POSTGRES_DB=ecoroute_audit','postgres:14-alpine'],timeout=45)
        if created.returncode:
            raise RuntimeError(created.stderr.strip())
        container_id = created.stdout.strip()
        if not re.fullmatch(r'[0-9a-f]{64}',container_id):
            raise RuntimeError('Docker devolvió identificador inesperado')
        report['containerId'] = container_id
        ready = False
        for _ in range(50):
            check = run(['exec',container_id,'pg_isready','-U','postgres','-d','ecoroute_audit'],timeout=10)
            if check.returncode == 0:
                ready = True
                break
            time.sleep(0.4)
        if not ready:
            raise RuntimeError('PostgreSQL no respondió al readiness del contenedor desechable')
        command = ['exec','-i',container_id,'psql','-X','-U','postgres','-d','ecoroute_audit','-v','ON_ERROR_STOP=1']
        applied = run(command,input=sql.read_text(encoding='utf-8-sig'),timeout=45)
        report['apply'] = dict(exitCode=applied.returncode,stdout=applied.stdout,stderr=applied.stderr)
        if applied.returncode:
            raise RuntimeError('El SQL completo falló en PostgreSQL desechable')
        snapshot = run(command+['-At','-c',CATALOG_SQL],timeout=20)
        if snapshot.returncode:
            raise RuntimeError(snapshot.stderr.strip())
        rebuilt = json.loads(snapshot.stdout)
        expected = json.loads(source.read_text(encoding='utf-8-sig'))
        left = {t['name']:canonical_table(t) for t in expected['tables'] if t['name']!='flyway_schema_history'}
        right = {t['name']:canonical_table(t) for t in rebuilt['tables']}
        differing = [n for n in sorted(left.keys()&right.keys()) if left[n] != right[n]]
        report['comparison'] = dict(expectedObjects=len(left),actualObjects=len(right),
                                   missingObjects=sorted(left.keys()-right.keys()),extraObjects=sorted(right.keys()-left.keys()),
                                   differingObjects=differing,fieldsCompared=['name','kind','comment','columns(name,type,nullable,default,comment)','constraints(name,type,definition)'])
        report['serverVersion'] = rebuilt['serverVersion']
        write_json(output.with_name(output.stem+'_catalogo_reconstruido.json'),rebuilt)
        repeated = run(command,input=sql.read_text(encoding='utf-8-sig'),timeout=45)
        report['nonEmptyGuard'] = dict(exitCode=repeated.returncode,rejected=repeated.returncode!=0 and 'Database must be empty' in repeated.stderr,
                                       stderr=repeated.stderr)
        report['status'] = 'PASS' if not differing and left.keys()==right.keys() and report['nonEmptyGuard']['rejected'] else 'FAIL'
        if report['status'] != 'PASS':
            report['differenceDetails'] = {n:dict(expected=left[n],actual=right[n]) for n in differing}
    except Exception as error:
        report['status'],report['error'] = 'FAIL',str(error)
    finally:
        if container_id and re.fullmatch(r'[0-9a-f]{64}',container_id):
            inspect = run(['inspect','--format','{{ index .Config.Labels "'+label+'" }}',container_id],timeout=10)
            if inspect.returncode == 0 and inspect.stdout.strip() == token:
                removed = run(['rm','--force',container_id],timeout=20)
                report['cleanup'] = dict(verifiedOwnLabel=True,exitCode=removed.returncode,removed=removed.returncode==0)
                if removed.returncode != 0:
                    report['status'] = 'FAIL'
            else:
                report['cleanup'] = dict(removed=False,error='No se elimina sin verificar etiqueta de propiedad')
                report['status'] = 'FAIL'
        report['completedAtUtc'] = utc_now()
        output.parent.mkdir(parents=True,exist_ok=True)
        write_json(output,report)
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source',type=Path,default=DEFAULT_SOURCE)
    parser.add_argument('--out',type=Path,default=DEFAULT_OUTPUT)
    parser.add_argument('--svg-only',action='store_true')
    parser.add_argument('--verify-sql',type=Path)
    args = parser.parse_args()
    args.source, args.out = args.source.resolve(), args.out.resolve()
    if args.verify_sql:
        args.verify_sql = args.verify_sql.resolve()
    data,objects,excluded,fks = physical_catalog(args.source)
    args.out.mkdir(parents=True,exist_ok=True)
    known = {n for _,_,names in GROUPS for n in names}
    if set(objects)-known:
        raise ValueError('Objetos físicos nuevos sin clasificación; revisar antes de omitir: '+str(sorted(set(objects)-known)))
    source_hash = sha(args.source)
    columns = [[n for n in names if n in objects] for _,_,names in GROUPS]
    diagrams = [draw_diagram('00_erd_negocio_global','Modelo físico de negocio · vista global',columns,objects,fks,args.out,source_hash,True,True)]
    for stem,title,cols in DETAILS:
        cols = [[n for n in lane if n in objects] for lane in cols]
        diagrams.append(draw_diagram(stem,title,cols,objects,fks,args.out,source_hash,keycloak=stem.startswith('01_')))
    covered = {n for d in diagrams[1:] for n in d['objects']}
    if covered != set(objects):
        raise ValueError('Cobertura incompleta de los detalles: '+str(set(objects)-covered))
    if not args.svg_only:
        render_pngs(args.out,diagrams)
    manifest = dict(generatedAtUtc=utc_now(),source=str(args.source.relative_to(ROOT)),
                    sourceSha256=source_hash,database=data.get('database'),serverVersion=data.get('serverVersion'),
                    migrations=data.get('migrations',[]),sourceObjectCount=len(data['tables']),businessObjectCount=len(objects),
                    tableCount=sum(t['kind']!='v' for t in objects.values()),viewCount=sum(t['kind']=='v' for t in objects.values()),
                    objects=objects,excluded=excluded,foreignKeys=fks,
                    logicalIdentity=dict(external='Keycloak sub UUID',local='drivers.external_id varchar(50)',physicalForeignKey=False),
                    diagrams=diagrams,checks=dict(allPhysicalObjectsAccountedFor=True,allBusinessColumnsInDetails=True,
                    foreignKeysOnlyFromExportedConstraints=True,svgXmlParsed=True,textFitsChecked=True,connectorsAvoidTableRectangles=True),
                    limits=['No se infieren FK por nombres de columnas ni dependencias de vistas.',
                            'No se exportaron índices; UQ sólo identifica constraints UNIQUE del JSON.',
                            'Nulabilidad de vistas es la del catálogo, no garantía sobre sus tablas fuente.',
                            'Keycloak es externo, no tabla local; conexión discontinua es lógica.',
                            'Respaldo local de evidencia excluido del negocio; volumen LocalStack no demuestra durabilidad.'])
    write_json(args.out/'erd_verificado_manifest.json',manifest)
    if args.verify_sql:
        result = verify_sql(args.verify_sql,args.source,ROOT/'docs/correccion_integral/evidencias/validacion_sql_completo_desechable.json')
        if result['status'] != 'PASS':
            raise SystemExit('Validación SQL: FAIL; revisar evidencia guardada')
    print(json.dumps(dict(diagrams=len(diagrams),objects=len(objects),foreignKeys=len(fks),sourceSha256=source_hash,
                          output=str(args.out)),ensure_ascii=False))


if __name__ == '__main__':
    main()
