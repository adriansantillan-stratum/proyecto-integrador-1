"""Completa el capítulo 2 del informe a partir de entregables y migraciones reales.

Salida intermedia: docs/Integrador I_Grupo3_Capitulo2.docx.
El original se reemplaza solo después de la revisión visual de esta salida.
"""

from __future__ import annotations

import re
from collections import OrderedDict
from pathlib import Path
from xml.etree import ElementTree as ET

from PIL import Image, ImageDraw, ImageFont
from docx import Document
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor


ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
SOURCE = DOCS / "Integrador I_Grupo3.docx"
OUTPUT = DOCS / "Integrador I_Grupo3_Capitulo2_v6.docx"
ASSETS = DOCS / "capitulo2_diseno_assets"
MIGRATIONS = ROOT / "src/main/resources/db/migration"
PROCESS = DOCS / "entregables_procesos_ecoroute/negocio_revisado/imagenes"
WIREFRAMES = DOCS / "entregables_procesos_ecoroute/imagenes"
SCREENS = DOCS / "screenshots"
ASSETS.mkdir(exist_ok=True)


def split_columns(body: str) -> list[str]:
    pieces, buf, depth = [], [], 0
    for char in body:
        if char == "(":
            depth += 1
        elif char == ")":
            depth -= 1
        if char == "," and depth == 0:
            pieces.append("".join(buf).strip())
            buf = []
        else:
            buf.append(char)
    if buf:
        pieces.append("".join(buf).strip())
    return pieces


def load_schema() -> OrderedDict:
    tables: OrderedDict[str, list[dict]] = OrderedDict()
    for sql_file in sorted(MIGRATIONS.glob("V*.sql"), key=lambda p: int(re.match(r"V(\d+)", p.name).group(1))):
        sql = sql_file.read_text(encoding="utf-8")
        sql = re.sub(r"--[^\n]*", "", sql)
        for match in re.finditer(r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s*\((.*?)\)\s*;", sql, re.I | re.S):
            name, body = match.group(1), match.group(2)
            cols, table_fks = [], []
            for item in split_columns(body):
                item = " ".join(item.split())
                fk = re.match(r"FOREIGN\s+KEY\s*\((\w+)\)\s+REFERENCES\s+(\w+)\s*\((\w+)\)", item, re.I)
                if fk:
                    table_fks.append((fk.group(1), fk.group(2), fk.group(3)))
                    continue
                if item.upper().startswith(("UNIQUE", "CONSTRAINT", "PRIMARY", "CHECK")):
                    continue
                col = re.match(r"(\w+)\s+(TIMESTAMP\s+WITH\s+TIME\s+ZONE|DOUBLE\s+PRECISION|[A-Z]+(?:\s*\([^)]*\))?)\s*(.*)", item, re.I)
                if not col:
                    raise ValueError(f"Columna no reconocida: {name}: {item}")
                col_name, dtype, rules = col.groups()
                cols.append(dict(name=col_name, dtype=" ".join(dtype.upper().split()), rules=rules, version=sql_file.name[:2]))
            for fk_name, ref_table, ref_col in table_fks:
                for col in cols:
                    if col["name"] == fk_name:
                        col["rules"] += f" REFERENCES {ref_table}({ref_col})"
            tables[name] = cols
        for match in re.finditer(r"ALTER\s+TABLE\s+(\w+)\s+ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s+(.*?)\s*;", sql, re.I | re.S):
            table_name, col_name, definition = match.groups()
            definition = " ".join(definition.split())
            parsed = re.match(r"(TIMESTAMP\s+WITH\s+TIME\s+ZONE|DOUBLE\s+PRECISION|[A-Z]+(?:\s*\([^)]*\))?)\s*(.*)", definition, re.I)
            if not parsed:
                raise ValueError(f"ALTER no reconocido: {table_name}.{col_name}")
            dtype, rules = parsed.groups()
            tables[table_name].append(dict(name=col_name, dtype=" ".join(dtype.upper().split()), rules=rules, version=sql_file.name[:2]))
    return tables


TABLE_DESC = {
    "orders": "Pedidos y datos de entrega", "drivers": "Conductores", "vehicles": "Vehículos",
    "routes": "Jornadas y recorridos", "delivery_proofs": "Prueba de entrega",
    "order_status_history": "Historial de estados", "vehicle_gps_history": "Posiciones GPS",
    "products": "Catálogo de productos", "order_items": "Contenido de pedidos",
    "incidents": "Incidencias de ruta", "hubs": "Centros de operación",
    "notifications": "Avisos internos", "purchases": "Compras",
    "route_expenses": "Gastos de ruta", "fuel_logs": "Combustible",
    "vehicle_maintenance_logs": "Mantenimiento de flota", "driver_contracts": "Contratos de conductores",
    "driver_shifts": "Turnos de conductores",
    "auth_module": "Módulos de autorización", "auth_resource": "Recursos de autorización",
    "auth_action": "Acciones permitidas", "auth_role": "Roles de acceso",
    "auth_permission": "Permisos por rol", "auth_user_role": "Vinculación usuario rol",
    "corp_branches": "Sedes corporativas", "corp_departments": "Departamentos corporativos",
    "corp_employees": "Empleados corporativos", "corp_fleet_types": "Tipos corporativos de flota",
    "corp_maintenance_logs": "Mantenimiento corporativo de referencia",
    "corp_customers": "Clientes corporativos de referencia", "corp_contracts": "Contratos corporativos",
    "corp_warehouses": "Almacenes corporativos", "corp_invoices": "Facturas corporativas",
}

FIELD_DESC = {
    "id": "Identificador interno", "order_id": "Pedido relacionado", "route_id": "Ruta relacionada",
    "driver_id": "Conductor relacionado", "vehicle_id": "Vehículo relacionado",
    "product_id": "Producto relacionado", "tracking_number": "Código de seguimiento del pedido",
    "external_reference": "Referencia externa de origen", "stop_sequence": "Orden de visita calculado",
    "geometry": "Polilínea del recorrido vial", "total_duration_min": "Duración estimada en minutos",
    "total_distance_km": "Distancia estimada en kilómetros", "route_date": "Fecha programada de la ruta",
    "estimated_start_time": "Inicio previsto", "actual_start_time": "Inicio registrado",
    "actual_end_time": "Fin registrado", "estimated_delivery_window_start": "Inicio de ventana prometida",
    "estimated_delivery_window_end": "Fin de ventana prometida", "image_url": "Referencia a fotografía del POD",
    "signature_data_url": "Firma capturada", "receiver_name": "Nombre de quien recibe",
    "receiver_dni": "Documento de quien recibe", "verified_at": "Fecha y hora de verificación",
    "status": "Estado operativo", "reason": "Motivo del cambio", "changed_by": "Identidad de quien cambió el estado",
    "latitude": "Latitud", "longitude": "Longitud", "location_lat": "Latitud registrada",
    "location_lon": "Longitud registrada", "ping_time": "Momento de posición GPS",
    "created_at": "Fecha y hora de creación", "updated_at": "Fecha y hora de actualización",
    "is_active": "Vigencia del registro", "is_read": "Indicador de lectura",
    "granted_at": "Fecha y hora de concesión", "assigned_at": "Fecha y hora de asignación",
    "reported_at": "Momento del reporte", "resolved_at": "Momento de resolución",
}

FIELD_DESC.update({
    "action_id":"Acción de autorización", "action_name":"Nombre de acción", "address":"Dirección",
    "amount":"Importe", "base_salary":"Remuneración base", "billing_address":"Dirección de facturación",
    "branch_id":"Sede relacionada", "brand":"Marca", "capacity_kg":"Capacidad en kilogramos",
    "capacity_m3":"Capacidad en metros cúbicos", "category":"Categoría", "city":"Ciudad",
    "code":"Código", "company_name":"Razón social", "contact_email":"Correo de contacto",
    "contact_person":"Persona de contacto", "contract_id":"Contrato relacionado", "contract_type":"Tipo de contrato",
    "cost":"Costo", "country_code":"Código de país", "customer_id":"Cliente relacionado",
    "delivery_address":"Dirección de entrega", "delivery_city":"Ciudad de entrega",
    "delivery_district":"Distrito de entrega", "dept_id":"Departamento relacionado",
    "description":"Descripción", "dni":"Documento de identidad", "due_date":"Fecha de vencimiento",
    "email":"Correo electrónico", "emp_id":"Empleado relacionado", "end_date":"Fecha de fin",
    "expense_type":"Tipo de gasto", "external_id":"Identificador externo",
    "first_name":"Nombres", "fuel_date":"Momento de carga de combustible",
    "gas_station":"Estación de combustible", "heading_degrees":"Rumbo en grados",
    "hire_date":"Fecha de contratación", "incident_type":"Tipo de incidencia",
    "invoice_id":"Factura relacionada", "invoice_number":"Número de factura",
    "issue_date":"Fecha de emisión", "last_name":"Apellidos",
    "license_number":"Número de licencia", "liters":"Litros abastecidos", "log_id":"Registro relacionado",
    "maintenance_date":"Fecha de mantenimiento", "message":"Texto del aviso", "model":"Modelo",
    "module_id":"Módulo relacionado", "module_name":"Nombre del módulo", "name":"Nombre",
    "next_service_date":"Próximo servicio", "notes":"Notas", "odometer_reading":"Lectura del odómetro",
    "payment_status":"Estado de pago", "permission_id":"Permiso relacionado",
    "phone_number":"Número telefónico", "plate_number":"Placa vehicular", "price":"Precio",
    "pricing_model":"Modelo tarifario", "priority":"Prioridad del pedido",
    "provider_name":"Proveedor del servicio", "quantity":"Cantidad", "receipt_url":"Referencia al comprobante",
    "recipient_email":"Correo del destinatario", "recipient_name":"Nombre del destinatario",
    "recipient_phone":"Teléfono del destinatario", "resource_id":"Recurso de autorización",
    "resource_name":"Nombre del recurso", "role_id":"Rol relacionado", "role_name":"Nombre del rol",
    "ruc":"RUC del cliente", "salary":"Remuneración", "security_level":"Nivel de seguridad",
    "segment":"Segmento comercial", "service_date":"Fecha del servicio",
    "service_type":"Tipo de servicio", "severity":"Severidad de incidencia",
    "shift_end":"Fin de turno", "shift_start":"Inicio de turno", "sku":"Código de producto",
    "speed_kmh":"Velocidad en km/h", "start_date":"Fecha de inicio", "supplier":"Proveedor",
    "tax":"Impuesto", "title":"Título del aviso", "total_capacity_m3":"Capacidad total en metros cúbicos",
    "total_cost":"Costo total", "total_price":"Precio total", "type":"Tipo",
    "type_id":"Tipo de flota relacionado", "unit_price":"Precio unitario",
    "unit_volume_m3":"Volumen unitario en metros cúbicos", "unit_weight_kg":"Peso unitario en kilogramos",
    "user_external_id":"Identificador externo de usuario", "warehouse_id":"Almacén relacionado",
    "workshop_name":"Nombre del taller",
})


def field_desc(name: str) -> str:
    return FIELD_DESC.get(name, name.replace("_", " ").capitalize())


def format_rule(col: dict) -> str:
    rules = col["rules"]
    tags = []
    if re.search(r"PRIMARY\s+KEY", rules, re.I):
        tags.append("PK")
    ref = re.search(r"REFERENCES\s+(\w+)\s*\((\w+)\)", rules, re.I)
    if ref:
        tags.append(f"FK → {ref.group(1)}.{ref.group(2)}")
    if re.search(r"NOT\s+NULL", rules, re.I):
        tags.append("Obligatorio")
    if re.search(r"\bUNIQUE\b", rules, re.I):
        tags.append("Único")
    default = re.search(r"\bDEFAULT\s+(.+?)(?:\s+REFERENCES\b|$)", rules, re.I)
    if default:
        tags.append("Def. " + default.group(1).strip())
    return "; ".join(tags) or "Opcional"


def set_repeat_header(row):
    tr_pr = row._tr.get_or_add_trPr()
    el = OxmlElement("w:tblHeader")
    el.set(qn("w:val"), "true")
    tr_pr.append(el)


def set_cell_shading(cell, fill: str):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:fill"), fill)
    tc_pr.append(shd)


def set_cell_border(cell):
    tc_pr = cell._tc.get_or_add_tcPr()
    borders = OxmlElement("w:tcBorders")
    for edge in ("top", "left", "bottom", "right"):
        child = OxmlElement(f"w:{edge}")
        child.set(qn("w:val"), "single")
        child.set(qn("w:sz"), "4")
        child.set(qn("w:color"), "D9D9D9")
        borders.append(child)
    tc_pr.append(borders)


def add_table(doc, headers, rows, widths=None, size=8.4, keep_all=False):
    table = doc.add_table(rows=1, cols=len(headers))
    table.autofit = False
    for j, h in enumerate(headers):
        table.rows[0].cells[j].text = h
    set_repeat_header(table.rows[0])
    for i, values in enumerate(rows):
        row = table.add_row()
        for j, value in enumerate(values):
            row.cells[j].text = str(value)
            if i % 2:
                set_cell_shading(row.cells[j], "F2F6FA")
    for i, row in enumerate(table.rows):
        for j, cell in enumerate(row.cells):
            if widths:
                cell.width = Inches(widths[j])
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            set_cell_border(cell)
            if i == 0:
                set_cell_shading(cell, "17365D")
            for p in cell.paragraphs:
                p.paragraph_format.space_after = Pt(1)
                p.paragraph_format.space_before = Pt(1)
                if i <= 2 or (keep_all and i < len(table.rows) - 1):
                    p.paragraph_format.keep_with_next = True
                for r in p.runs:
                    r.font.size = Pt(size)
                    r.font.name = "Calibri"
                    if i == 0:
                        r.font.bold = True
                        r.font.color.rgb = RGBColor(255, 255, 255)
    doc.add_paragraph().paragraph_format.space_after = Pt(2)
    return table


def para(doc, text, *, bold_label=None):
    p = doc.add_paragraph(style="Normal")
    p.paragraph_format.space_after = Pt(6)
    p.paragraph_format.keep_together = True
    if bold_label:
        p.add_run(bold_label).bold = True
    p.add_run(text)
    return p


def figure(doc, path: Path, caption: str, width=5.75, max_height=7.2):
    with Image.open(path) as im:
        w, h = im.size
    fitted_width = min(width, max_height * w / h)
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.keep_with_next = True
    p.add_run().add_picture(str(path), width=Inches(fitted_width))
    c = doc.add_paragraph(caption)
    c.alignment = WD_ALIGN_PARAGRAPH.CENTER
    c.paragraph_format.space_after = Pt(8)
    for run in c.runs:
        run.italic = True
        run.font.size = Pt(8.5)


def gateway_rows(process_id: str):
    path = DOCS / f"entregables_procesos_ecoroute/negocio_revisado/bpmn/{process_id}_negocio.bpmn"
    root = ET.parse(path).getroot()
    ns = {"b": "http://www.omg.org/spec/BPMN/20100524/MODEL"}
    nodes = {n.get("id"): n.get("name", "") for n in root.findall(".//*[@id]") if n.get("id", "").startswith(process_id + "_")}
    owners = {}
    for lane in root.findall(".//b:lane", ns):
        for ref in lane.findall("b:flowNodeRef", ns):
            owners[ref.text] = lane.get("name", "")
    outgoing = {}
    for flow in root.findall(".//b:sequenceFlow", ns):
        outgoing.setdefault(flow.get("sourceRef"), {})[flow.get("name", "")] = nodes.get(flow.get("targetRef"), "")
    return [(gate.get("name", ""), owners.get(gate.get("id"), ""), outgoing.get(gate.get("id"), {}).get("Sí", ""), outgoing.get(gate.get("id"), {}).get("No", "")) for gate in root.findall(".//b:exclusiveGateway", ns)]


def font(size, bold=False):
    path = Path("C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf")
    return ImageFont.truetype(str(path), size)


def make_erd(path: Path):
    im = Image.new("RGB", (1800, 1080), "#FFFFFF")
    d = ImageDraw.Draw(im)
    d.text((42, 28), "Modelo lógico operativo", fill="#17365D", font=font(44, True))
    boxes = {
        "drivers": (45, 150, 375, 305), "vehicles": (45, 415, 375, 570),
        "routes": (660, 250, 1050, 405), "orders": (1285, 250, 1715, 405),
        "vehicle_gps_history": (45, 745, 500, 900),
        "delivery_proofs": (1190, 535, 1715, 690),
        "order_status_history": (1190, 770, 1715, 925),
        "order_items": (680, 770, 1030, 925),
        "products": (680, 535, 1030, 690),
    }
    fields = {
        "drivers": "id PK  ·  license_number", "vehicles": "id PK  ·  plate_number",
        "routes": "id PK  ·  driver_id FK  ·  vehicle_id FK",
        "orders": "id PK  ·  route_id FK  ·  stop_sequence",
        "vehicle_gps_history": "vehicle_id FK  ·  driver_id FK",
        "delivery_proofs": "order_id FK  ·  imagen  ·  firma",
        "order_status_history": "order_id FK  ·  estado  ·  motivo",
        "order_items": "order_id FK  ·  product_id FK",
        "products": "id PK  ·  sku",
    }
    rels = [
        ((375, 225), (660, 290), "1:N"), ((375, 490), (660, 365), "1:N"),
        ((1050, 330), (1285, 330), "1:N"),
        ((1450, 405), (1450, 535), "1:0..1"),
        ((1600, 405), (1600, 770), "1:N"),
        ((1285, 380), (1030, 835), "1:N"),
        ((855, 690), (855, 770), "1:N"),
        ((220, 570), (220, 745), "1:N"),
    ]
    for (x1, y1), (x2, y2), label in rels:
        d.line((x1, y1, x2, y2), fill="#53759A", width=5)
        d.text(((x1 + x2) / 2 + 8, (y1 + y2) / 2 - 35), label, fill="#1B4B77", font=font(23, True))
    for name, (x1, y1, x2, y2) in boxes.items():
        d.rounded_rectangle((x1, y1, x2, y2), radius=18, fill="#F3F7FB", outline="#17365D", width=4)
        d.rounded_rectangle((x1, y1, x2, y1 + 58), radius=18, fill="#17365D")
        d.rectangle((x1, y1 + 40, x2, y1 + 58), fill="#17365D")
        d.text((x1 + 16, y1 + 12), name, fill="white", font=font(25, True))
        d.text((x1 + 16, y1 + 78), fields[name], fill="#15263A", font=font(19))
    d.text((43, 1015), "Cardinalidades a partir de FK declaradas. orders.driver_id es asociación lógica sin FK en V1–V8.", fill="#53677D", font=font(21))
    im.save(path)


def main():
    schema = load_schema()
    assert len(schema) == 33, f"Se esperaban 33 tablas, hay {len(schema)}"
    erd_path = ASSETS / "modelo_datos_operativo.png"
    make_erd(erd_path)
    doc = Document(SOURCE)
    chapter2 = next(p for p in doc.paragraphs if p.text.startswith("CAPÍTULO 2"))
    chapter3 = next(p for p in doc.paragraphs if p.text.startswith("CAPÍTULO 3"))
    chapter_paragraphs = doc.paragraphs[doc.paragraphs.index(chapter2) + 1:doc.paragraphs.index(chapter3)]
    if any(p.text.strip() and p.style.name != "Heading 2" for p in chapter_paragraphs):
        raise RuntimeError("El capítulo 2 ya contiene contenido. Use la versión previa del informe como fuente para regenerarlo.")
    original_headings = {p.text: p for p in doc.paragraphs if p.style.name == "Heading 2" and p.text in (
        "Diagramas BPWN", "Prototipos – Wireframes", "Prototipos – Mockups", "Modelo de Datos", "Diccionario de Datos")}
    assert len(original_headings) == 5
    original_headings["Diagramas BPWN"].runs[0].text = "Diagramas BPMN"
    for p in original_headings.values():
        p._element.getparent().remove(p._element)
    chapter2.paragraph_format.page_break_before = True
    chapter3.paragraph_format.page_break_before = True
    before = set(doc._body._body)

    def section_heading(original_name):
        paragraph = original_headings[original_name]
        doc._body._body[-1].addprevious(paragraph._element)
        return paragraph

    para(doc, "Este capítulo define la operación de última milla de Grupo MICOTRANS S. A. C. en cinco procesos, traduce esos recorridos en interfaces web y móviles y documenta el modelo persistente de EcoRoute. Los diagramas se basan en la operación objetivo; las capturas representan el estado de la interfaz y las migraciones V1–V8 sustentan el modelo físico. Las políticas comerciales y las reglas de autorización requieren validación con la empresa.")

    section_heading("Diagramas BPWN")
    para(doc, "La unidad de análisis es el pedido. P01 admite y confirma la solicitud; P02 prepara la jornada de reparto; P03 ejecuta cada parada y registra la prueba de entrega; P04 resuelve excepciones; P05 evalúa resultados por jornada o período. Los finales de un diagrama indican la condición que habilita el siguiente proceso, no un flujo de secuencia que atraviesa diagramas independientes.")
    add_table(doc, ["Proceso", "Disparador", "Resultado principal", "Responsable"], [
        ("P01 Confirmar pedido", "Solicitud recibida", "Pedido confirmado para planificar", "Coordinación de pedidos"),
        ("P02 Preparar jornada", "Pedidos confirmados", "Ruta aprobada, entregada e iniciada", "Dispatcher y jefatura"),
        ("P03 Ejecutar entrega", "Parada de ruta activa", "Parada cerrada con POD o excepción", "Conductor"),
        ("P04 Resolver incidencia", "Excepción registrada", "Reintento, nueva fecha o cierre fallido", "Dispatcher y jefatura"),
        ("P05 Evaluar resultados", "Cierre de jornada o período", "Acción verificada o cierre documentado", "Jefatura y analista"),
    ], [1.3, 1.35, 1.8, 1.45], 8.2)
    p_data = [
        ("P01 Confirmar pedidos", "La solicitud se revisa por integridad, ubicación, cobertura y ventana. Si faltan datos, el cliente recibe un plazo de corrección; si la dirección o el servicio no son viables, se ofrece aclaración o alternativa. Solo la confirmación habilita P02; rechazo, desistimiento o falta de corrección terminan con motivo.", "P01_negocio.png"),
        ("P02 Preparar la jornada de reparto", "Contiene dos subprocesos de gestión: planificar rutas y despachar rutas. Se comprueban capacidad, conductor, vehículo, recorrido, aprobación y disponibilidad de salida. Un plan observado se corrige dentro de P02; si no hay recurso o sustituto, los pedidos retornan a P01 para acordar fecha. P03 empieza solo cuando el conductor confirma el inicio.", "P02_negocio.png"),
        ("P03 Ejecutar la entrega", "El proceso se repite por parada. El conductor comprueba acceso, receptor y aceptación; captura foto, firma y datos del receptor, y confirma la sincronización del POD. Ausencia, rechazo, impedimento, evidencia insuficiente o pendiente de sincronización abren P04 para esa parada. Si quedan paradas, la ruta continúa; al cierre de jornada sus resultados alimentan P05.", "P03_negocio.png"),
        ("P04 Resolver incidencias", "El Dispatcher revisa causa, sustento y urgencia. Un reintento aceptado devuelve la parada a P03; una nueva fecha aceptada la devuelve a P02. Si no existe alternativa viable, jefatura autoriza el cierre fallido con motivo. El caso permanece trazable para P05.", "P04_negocio.png"),
        ("P05 Evaluar resultados", "En cada corte se reconcilian pedidos, rutas y POD antes de calcular indicadores. Si la información no es confiable se solicita corrección o se cierra provisionalmente. Las desviaciones relevantes originan una acción con dueño y plazo; el proceso termina cuando se verifica su efecto o se documenta el resultado del período.", "P05_negocio.png"),
    ]
    for idx, (heading, description, img) in enumerate(p_data, 1):
        h = doc.add_heading(heading, level=3)
        h.paragraph_format.keep_with_next = True
        lead = para(doc, description)
        lead.paragraph_format.keep_together = True
        lead.paragraph_format.keep_with_next = True
        figure(doc, PROCESS / img, f"Figura 2.{idx}. BPMN de {heading}. Fuente: elaboración propia con la operación objetivo y la aplicación EcoRoute.", max_height=6.6)
        para(doc, "Para leer el diagrama a tamaño de página, la tabla siguiente resume cada compuerta exclusiva y sus dos salidas. Los eventos finales y retornos están rotulados en el BPMN editable.")
        add_table(doc, ["Decisión", "Responsable", "Sí", "No"], gateway_rows(f"P{idx:02d}"), [1.42, 1.08, 1.7, 1.7], 7.6, keep_all=True)
    para(doc, "Los cinco diagramas BPMN 2.0 editables y sus imágenes a resolución completa se conservan en docs/entregables_procesos_ecoroute/negocio_revisado. El documento de procesos revisados detalla todas las salidas Sí/No y los acuerdos empresariales pendientes.")

    section_heading("Prototipos – Wireframes")
    para(doc, "Los wireframes describen composición, navegación y datos requeridos antes del detalle visual. Se conservaron las láminas construidas a partir de pantallas web y móvil. La numeración original de esas láminas refleja seis procesos preliminares: los wireframes antiguos P02 y P03 corresponden juntos al P02 actual.")
    wire = [
        ("P01_wireframes.png", "Admisión, consulta y confirmación del pedido"),
        ("P02_wireframes.png", "Planificación de ruta"),
        ("P03_wireframes.png", "Despacho y entrega de hoja de ruta"),
        ("P04_wireframes.png", "Ejecución de entrega y POD"),
        ("P05_wireframes.png", "Tratamiento de incidencia"),
        ("P06_wireframes.png", "Panel analítico y revisión de resultados"),
    ]
    for i, (filename, label) in enumerate(wire, 1):
        figure(doc, WIREFRAMES / filename, f"Figura 2.{i+5}. Wireframes de {label.lower()}. Fuente: elaboración propia a partir de EcoRoute.", max_height=5.8)
    para(doc, "Para el siguiente ciclo de diseño, el wireframe de P02 debe distinguir la aprobación del plan del acuse de salida; P03 debe mostrar claramente la condición de POD pendiente sin red. Esas decisiones de negocio no se consideran demostradas por la maqueta visual.")

    section_heading("Prototipos – Mockups")
    para(doc, "Se usan capturas de las interfaces existentes como referencia visual de alta fidelidad, con datos de prueba. No constituyen evidencia de resultados reales de MICOTRANS ni certifican que las reglas de negocio del BPMN estén automatizadas. Las pantallas permiten evaluar la jerarquía de información, las acciones principales y la continuidad entre web y móvil.")
    shots = [
        ("web-03-pedidos.png", "Consola web de pedidos", "P01: alta, estado, búsqueda y consulta del pedido"),
        ("web-04-rutas.png", "Consola web de rutas", "P02: jornada, conductor, vehículo, mapa y recorrido"),
        ("mobile-02-rutas-mapa.png", "Ruta del conductor", "P02–P03: secuencia y desplazamiento a la parada"),
        ("mobile-04-evidencia-entrega.png", "Formulario de prueba de entrega", "P03: foto, receptor y firma; la captura muestra un formulario aún sin prueba completa"),
        ("web-02-dashboard.png", "Panel de control", "P05: seguimiento operativo e indicadores visibles"),
        ("web-07-reportes.png", "Reportes web", "P05: consulta y exportación de resultados"),
    ]
    for i, (filename, title, relevance) in enumerate(shots, 12):
        h = doc.add_heading(title, level=3)
        h.paragraph_format.keep_with_next = True
        lead = para(doc, relevance)
        lead.paragraph_format.keep_with_next = True
        figure(doc, SCREENS / filename, f"Figura 2.{i}. Mockup de referencia basado en captura de EcoRoute: {title.lower()}. Fuente: repositorio del proyecto.", width=5.75, max_height=6.7)
    para(doc, "El conjunto completo de capturas se encuentra en docs/screenshots e incluye inicio de sesión móvil, detalle de pedido, perfil, conductores y vehículos. A continuación se presentan propuestas visuales para el módulo de inteligencia de negocios y dos listados operativos. Sus cifras y filas ilustran el diseño; antes de usarlas en producción deben reconciliarse las fórmulas de KPI, los filtros y las fuentes con MICOTRANS.")
    doc.add_heading("Diseños analíticos y listados operativos", level=3)
    analytic_figures = [
        ("D01_dashboard.png", "Resumen ejecutivo con IID, CHR, TDE y tendencia"),
        ("D02_dashboard.png", "Cumplimiento de entregas y ventanas horarias"),
        ("D03_dashboard.png", "Eficiencia de rutas por distancia y tiempo"),
        ("D04_dashboard.png", "Incidencias y calidad de la prueba de entrega"),
        ("D05_dashboard.png", "Rendimiento y mejora continua"),
        ("R01_reporte.png", "Manifiesto diario de despacho"),
        ("R02_reporte.png", "Listado de cierre de entregas y POD"),
    ]
    for i, (filename, title) in enumerate(analytic_figures, 18):
        figure(doc, WIREFRAMES / filename, f"Figura 2.{i}. Diseño propuesto de {title.lower()}. Fuente: elaboración propia; valores ilustrativos.", max_height=5.4)

    section_heading("Modelo de Datos")
    para(doc, "PostgreSQL almacena el estado transaccional. El diagrama siguiente representa el núcleo operativo definido en Flyway V1, V2, V5, V6 y V8: rutas, pedidos, conductores, vehículos, posiciones, historial de estados, prueba de entrega y detalle de productos. Las flechas describen relaciones declaradas por claves foráneas, salvo las asociaciones lógicas indicadas expresamente.")
    figure(doc, erd_path, "Figura 2.25. Modelo lógico del núcleo operativo de EcoRoute. Fuente: migraciones Flyway V1–V8.", max_height=5.5)
    add_table(doc, ["Relación", "Cardinalidad", "Regla de diseño"], [
        ("drivers → routes", "1 a N", "Un conductor puede recibir varias rutas en distintas fechas."),
        ("vehicles → routes", "1 a N", "Un vehículo puede participar en varias rutas."),
        ("routes → orders", "1 a N", "Un pedido puede quedar sin ruta mientras espera planificación."),
        ("orders → delivery_proofs", "1 a 0..1", "La restricción UNIQUE(order_id) permite como máximo un POD."),
        ("orders → order_status_history", "1 a N", "Cada cambio conserva estado, motivo, lugar y momento."),
        ("orders → order_items → products", "N a M", "Los renglones relacionan pedidos y productos."),
        ("vehicles/drivers → vehicle_gps_history", "1 a N", "Cada posición puede referir vehículo y conductor."),
    ], [1.8, 0.8, 3.3], 8.0)
    para(doc, "No se debe inferir integridad referencial donde no está declarada: orders.driver_id y corp_maintenance_logs.vehicle_id no tienen FK en las migraciones revisadas. El esquema corporativo corp_* de V4 contiene datos de demostración de otra empresa y no está enlazado por FK a los pedidos; no se presenta como padrón de MICOTRANS. Keycloak administra identidad externa, mientras auth_* conserva módulos, recursos, acciones y asignaciones locales.")
    para(doc, "La geometría vial se guarda en routes.geometry; routes.total_duration_min conserva la duración estimada y orders.stop_sequence el orden de parada. Los datos analíticos deben derivarse de pedidos, rutas, POD e historial, con definiciones de KPI aprobadas antes de su uso para decisiones.")

    section_heading("Diccionario de Datos")
    para(doc, f"El diccionario reproduce los {len(schema)} objetos de tabla y sus {sum(map(len,schema.values()))} campos definidos en las migraciones Flyway V1–V8. ‘Opcional’ significa que el DDL no declara NOT NULL; no implica que la interfaz permita omitir el dato. PK identifica clave primaria y FK relación referencial explícita. Las expresiones ‘Def.’ corresponden a DEFAULT del DDL.")
    groups = [
        ("Núcleo de reparto", ["orders", "routes", "drivers", "vehicles", "delivery_proofs", "order_status_history", "vehicle_gps_history"]),
        ("Catálogos y operación extendida", ["hubs", "products", "order_items", "vehicle_maintenance_logs", "fuel_logs", "route_expenses", "incidents", "driver_contracts", "driver_shifts", "purchases", "notifications"]),
        ("Autorización local", ["auth_module", "auth_resource", "auth_action", "auth_role", "auth_permission", "auth_user_role"]),
        ("Contexto corporativo de referencia", ["corp_branches", "corp_departments", "corp_employees", "corp_fleet_types", "corp_maintenance_logs", "corp_customers", "corp_contracts", "corp_warehouses", "corp_invoices"]),
    ]
    seen = set()
    for group_name, names in groups:
        doc.add_heading(group_name, level=3)
        if group_name == "Contexto corporativo de referencia":
            para(doc, "Las tablas corp_* provienen de V4 y contienen registros de prueba de una empresa ficticia. Se documentan por existir en el esquema, pero su adopción operativa para MICOTRANS requiere depuración, vinculación y autorización.")
        for name in names:
            seen.add(name)
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(8)
            p.paragraph_format.space_after = Pt(3)
            p.paragraph_format.keep_with_next = True
            run = p.add_run(f"{name}  ·  {TABLE_DESC[name]}")
            run.bold = True
            run.font.size = Pt(10)
            add_table(doc, ["Campo", "Tipo SQL", "Restricción", "Significado"], [
                (c["name"], c["dtype"], format_rule(c), field_desc(c["name"])) for c in schema[name]
            ], [1.35, 1.25, 1.62, 1.68], 7.5, keep_all=len(schema[name]) <= 8)
    assert seen == set(schema), f"Tablas no clasificadas: {set(schema)-seen}"
    para(doc, "Fuente del diccionario: src/main/resources/db/migration/V1__create_orders_table.sql a V8__route_geometry_and_stop_sequence.sql. Los índices de búsqueda, datos sembrados y reglas de aplicación se revisan por separado del campo físico.")

    new_elements = [node for node in doc._body._body if node not in before and node.tag != qn("w:sectPr")]
    body = doc._body._body
    target = chapter3._element
    for node in new_elements:
        body.remove(node)
        target.addprevious(node)
    doc.save(OUTPUT)
    print(f"Salida: {OUTPUT}")
    print(f"Tablas: {len(schema)}; campos: {sum(map(len,schema.values()))}; figuras: 25")


if __name__ == "__main__":
    main()
