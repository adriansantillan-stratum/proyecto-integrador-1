"""ERD del flujo de reparto de EcoRoute a partir de Flyway V1–V8.

No altera el esquema. Solo dibuja las claves foráneas declaradas en SQL.
El SVG es vectorial y el Mermaid sirve como fuente editable.
"""

from __future__ import annotations

from html import escape
from pathlib import Path

from generate_erd_ecoroute import cardinality, extract_schema, mermaid


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "base_datos" / "modelo_erd_negocio"

BUSINESS = [
    "drivers", "vehicles", "routes", "orders", "delivery_proofs",
    "order_status_history", "notifications", "products", "order_items",
    "vehicle_gps_history", "incidents", "route_expenses", "fuel_logs",
    "vehicle_maintenance_logs", "driver_contracts", "driver_shifts",
]

VIEWS = [
    ("01_planificacion", "Asignación de recursos y ruta", {
        "drivers": (40, 70), "vehicles": (40, 430), "routes": (990, 240),
    }),
    ("02_pedidos", "Ruta y pedidos", {
        "routes": (40, 150), "orders": (990, 80),
    }),
    ("03_entrega", "Pedido, POD e historial", {
        "orders": (40, 70), "delivery_proofs": (990, 70),
        "order_status_history": (990, 430),
    }),
    ("04_detalle_pedido", "Líneas, producto y avisos", {
        "orders": (40, 70), "order_items": (655, 80),
        "products": (1270, 80), "notifications": (655, 430),
    }),
    ("05_gps", "Trazas de flota", {
        "drivers": (40, 70), "vehicles": (40, 430),
        "vehicle_gps_history": (990, 250),
    }),
    ("06_incidencias_costos", "Incidencias y gastos de ruta", {
        "routes": (40, 150), "incidents": (990, 70),
        "route_expenses": (990, 430),
    }),
    ("07_flota", "Combustible y mantenimiento", {
        "vehicles": (40, 70), "drivers": (40, 365),
        "fuel_logs": (990, 70), "vehicle_maintenance_logs": (990, 430),
    }),
    ("08_personal", "Contratos y turnos del conductor", {
        "drivers": (40, 195), "driver_contracts": (990, 70),
        "driver_shifts": (990, 430),
    }),
]

BG = "#F7F9FC"
INK = "#1C3148"
SUB = "#52677B"
BLUE = "#164B73"
TEAL = "#0D7A74"
STROKE = "#ABBCCC"
W, H = 1850, 770
CARD_W = 540
HEADER_H = 48
ROW_H = 29


def fk_label(fk, tables) -> str:
    p, c = cardinality(tables, fk)
    return f"{p}  ──  {c}"


def typ(col) -> str:
    return col.datatype.upper().replace("TIMESTAMP WITH TIME ZONE", "TIMESTAMPTZ")


def card_h(table) -> int:
    return HEADER_H + 6 + ROW_H * len(table.columns)


def row_center(tables, name: str, column: str, x: int, y: int) -> float:
    idx = next(i for i, c in enumerate(tables[name].columns) if c.name == column)
    return y + HEADER_H + 6 + idx * ROW_H + ROW_H / 2


def connection(fk, positions, tables) -> list[str]:
    px, py = positions[fk.parent]
    cx, cy = positions[fk.child]
    pcenter = px + CARD_W / 2
    ccenter = cx + CARD_W / 2
    p_row = row_center(tables, fk.parent, fk.parent_column, px, py)
    c_row = row_center(tables, fk.child, fk.child_column, cx, cy)
    if pcenter < ccenter:
        x1, x2 = px + CARD_W, cx
    else:
        x1, x2 = px, cx + CARD_W
    offset = 20 if p_row <= c_row else -20
    elbow = (x1 + x2) / 2 + offset
    path = f"M{x1},{p_row:.1f} H{elbow:.1f} V{c_row:.1f} H{x2}"
    label_x = x2 - 10 if x1 < x2 else x2 + 10
    label_y = c_row - 8
    anchor = "end" if x1 < x2 else "start"
    return [
        f'<path d="{path}" fill="none" stroke="{TEAL}" stroke-width="2.5"/>',
        f'<circle cx="{x1}" cy="{p_row:.1f}" r="4" fill="{TEAL}"/>',
        f'<circle cx="{x2}" cy="{c_row:.1f}" r="4" fill="{TEAL}"/>',
        f'<text x="{label_x:.1f}" y="{label_y:.1f}" text-anchor="{anchor}" '
        f'font-size="16" font-weight="700" fill="{TEAL}">{escape(fk_label(fk, tables))}</text>',
    ]


def table_card(name, table, x: int, y: int) -> list[str]:
    h = card_h(table)
    out = [
        f'<rect x="{x}" y="{y}" width="{CARD_W}" height="{h}" rx="8" fill="white" stroke="{STROKE}" stroke-width="2"/>',
        f'<path d="M{x+8},{y} H{x+CARD_W-8} Q{x+CARD_W},{y} {x+CARD_W},{y+8} '
        f'V{y+HEADER_H} H{x} V{y+8} Q{x},{y} {x+8},{y}" fill="{BLUE}"/>',
        f'<text x="{x+18}" y="{y+32}" font-size="25" font-weight="700" fill="white">{escape(name)}</text>',
        f'<text x="{x+CARD_W-18}" y="{y+31}" font-size="15" text-anchor="end" fill="#CDE7F3">'
        f'{len(table.columns)} campos</text>',
    ]
    for i, col in enumerate(table.columns):
        top = y + HEADER_H + 6 + ROW_H * i
        if col.primary_key:
            out.append(f'<rect x="{x+4}" y="{top}" width="{CARD_W-8}" height="{ROW_H}" fill="#E3F1FF"/>')
        elif col.foreign_key:
            out.append(f'<rect x="{x+4}" y="{top}" width="{CARD_W-8}" height="{ROW_H}" fill="#E8F7F3"/>')
        elif i % 2:
            out.append(f'<rect x="{x+4}" y="{top}" width="{CARD_W-8}" height="{ROW_H}" fill="#F8FAFC"/>')
        flag = "PK" if col.primary_key else "FK·UQ" if col.foreign_key and col.unique else "FK" if col.foreign_key else "UQ" if col.unique else ""
        if flag:
            out.append(f'<text x="{x+13}" y="{top+21}" font-size="14" font-weight="700" fill="{TEAL if flag=="FK" else BLUE}">{flag}</text>')
        label = col.name + (" *" if not col.nullable else "")
        short = len(label) > 28
        label_x = x + (77 if flag == "FK·UQ" else 51)
        out.append(f'<text x="{label_x}" y="{top+21}" font-size="{16 if short else 18}" '
                   f'fill="{INK}">{escape(label)}</text>')
        out.append(f'<text x="{x+CARD_W-12}" y="{top+21}" font-size="16" '
                   f'text-anchor="end" fill="{SUB}">{escape(typ(col))}</text>')
    return out


def svg_for_view(tables, fks, title: str, positions: dict[str, tuple[int,int]]) -> str:
    local = [fk for fk in fks if fk.child in positions and fk.parent in positions]
    lines = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" font-family="Arial,sans-serif">',
        f'<rect width="{W}" height="{H}" fill="{BG}"/>',
        f'<text x="40" y="39" font-size="27" font-weight="700" fill="{INK}">{escape(title)}</text>',
    ]
    for fk in local:
        lines.extend(connection(fk, positions, tables))
    for name, (x,y) in positions.items():
        lines.extend(table_card(name, tables[name], x, y))
    lines.append(f'<text x="40" y="{H-22}" font-size="16" fill="{SUB}">'
                 'PK = clave primaria · FK = clave foránea física · UQ = único · * = NOT NULL · '
                 '|| = uno · o| = cero o uno · o{ = cero a muchos</text>')
    lines.append('</svg>')
    return "\n".join(lines) + "\n"


def overview(tables, fks) -> str:
    # Two rows mirror the main business flow; satellite tables sit below their
    # owner. Connectors are intentionally limited to the primary chain.
    xmap = {
        "drivers": (40, 115), "vehicles": (475, 115), "routes": (910, 115), "orders": (1345, 115),
        "driver_contracts": (40, 390), "driver_shifts": (260, 390),
        "fuel_logs": (475, 390), "vehicle_maintenance_logs": (695, 390),
        "vehicle_gps_history": (910, 390), "incidents": (1130, 390),
        "route_expenses": (1350, 390), "delivery_proofs": (1570, 390),
        "products": (40, 580), "order_items": (260, 580),
        "order_status_history": (475, 580), "notifications": (695, 580),
    }
    colors = {"drivers":TEAL,"vehicles":TEAL,"routes":BLUE,"orders":BLUE}
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" font-family="Arial,sans-serif">',
           f'<rect width="{W}" height="{H}" fill="{BG}"/>',
           f'<text x="40" y="54" font-size="32" font-weight="700" fill="{INK}">EcoRoute · ERD del negocio</text>',
           f'<text x="40" y="88" font-size="19" fill="{SUB}">16 tablas · 141 campos · 17 FK físicas · migraciones PostgreSQL V1–V8</text>']
    for name,(x,y) in xmap.items():
        wide = name in ("drivers","vehicles","routes","orders")
        width = 390 if wide else 205
        height = 180 if wide else 130
        color = colors.get(name, "#315F83")
        out.append(f'<rect x="{x}" y="{y}" width="{width}" height="{height}" rx="10" fill="white" stroke="{STROKE}" stroke-width="2"/>')
        out.append(f'<rect x="{x}" y="{y}" width="{width}" height="{43 if wide else 37}" rx="9" fill="{color}"/>')
        head_size = 23 if wide else 14 if len(name) > 19 else 18
        out.append(f'<text x="{x+13}" y="{y+(29 if wide else 25)}" font-size="{head_size}" font-weight="700" fill="white">{escape(name)}</text>')
        key_cols = [c for c in tables[name].columns if c.primary_key or c.foreign_key]
        for i,col in enumerate(key_cols[:4]):
            out.append(f'<text x="{x+14}" y="{y+71+i*26}" font-size="{19 if wide else 16}" fill="{INK}">'
                       f'{"PK" if col.primary_key else "FK"}  {escape(col.name)}</text>')
        out.append(f'<text x="{x+width-12}" y="{y+height-12}" text-anchor="end" font-size="14" fill="{SUB}">{len(tables[name].columns)} columnas</text>')
    # Physical-FK paths run in the gap between core and satellite rows, so
    # they never cross an entity card.
    for start_x,end_x,level,label in [
        (235,1105,328,"drivers → routes"),
        (670,1105,350,"vehicles → routes"),
        (1105,1540,372,"routes → orders"),
    ]:
        out.append(f'<path d="M{start_x},295 V{level} H{end_x} V295" stroke="{TEAL}" stroke-width="2.5" fill="none"/>')
        out.append(f'<text x="{(start_x+end_x)/2}" y="{level-6}" text-anchor="middle" font-size="15" fill="{TEAL}">{escape(label)}</text>')
    out.append(f'<text x="40" y="{H-22}" font-size="17" fill="{SUB}">Las 17 FK se detallan en las ocho vistas siguientes. orders.driver_id no es FK física.</text>')
    out.append('</svg>')
    return "\n".join(out) + "\n"


def main() -> None:
    tables, fks = extract_schema()
    assert len(BUSINESS) == 16 and len(set(BUSINESS)) == 16
    selected_fks = [fk for fk in fks if fk.child in BUSINESS and fk.parent in BUSINESS]
    assert sum(len(tables[name].columns) for name in BUSINESS) == 141
    assert len(selected_fks) == 17
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "EcoRoute_ERD_Negocio.mmd").write_text(mermaid(tables, selected_fks, BUSINESS), encoding="utf-8")
    (OUT / "00_vista_general.svg").write_text(overview(tables, selected_fks), encoding="utf-8")
    for name,title,positions in VIEWS:
        (OUT / f"{name}.svg").write_text(svg_for_view(tables, selected_fks, title, positions), encoding="utf-8")
    (OUT / "README.md").write_text(
        "# ERD del negocio de EcoRoute\n\n"
        "Derivado de las migraciones Flyway V1–V8: **16 tablas, 141 columnas y 17 FK físicas**. "
        "La vista general y las ocho vistas de detalle muestran el núcleo de reparto; "
        "las tablas repetidas entre vistas son la misma entidad. `EcoRoute_ERD_Negocio.mmd` es la fuente editable.\n\n"
        "Se excluyen `corp_*` (referencia heredada), `auth_*` (RBAC técnico), `hubs` "
        "y `purchases` (sin FK al grafo de entregas). Compras sigue siendo una función del proyecto; "
        "esta exclusión se limita al ERD conectado de reparto. La base de Keycloak es externa.\n\n"
        "`orders.driver_id` figura como BIGINT en la tabla, pero **no tiene FK** a `drivers`. "
        "La asignación referencial declarada es `orders.route_id → routes.id → drivers.id`. "
        "Solo `delivery_proofs.order_id` es FK NOT NULL y UNIQUE: un pedido tiene cero o una POD. "
        "`driver_contracts.driver_id` es FK UNIQUE, pero nullable. Las demás cardinalidades "
        "proceden de la nulabilidad y unicidad de cada FK.\n\n"
        "Convenciones de las láminas: PK = clave primaria; FK = clave foránea declarada; "
        "UQ = valor único (FK·UQ si aplica a una FK); `*` = NOT NULL; `||` = uno; "
        "`o|` = cero o uno; `o{` = cero a muchos. "
        "Los tipos se presentan en formato PostgreSQL (`TIMESTAMPTZ` abrevia `TIMESTAMP WITH TIME ZONE`).\n",
        encoding="utf-8",
    )
    print(f"ERD negocio: {len(BUSINESS)} tablas, 141 columnas, {len(selected_fks)} FK; salida {OUT}")


if __name__ == "__main__":
    main()
