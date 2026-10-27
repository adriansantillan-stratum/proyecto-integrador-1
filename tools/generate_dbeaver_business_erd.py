"""Draw the physical EcoRoute business schema in a DBeaver-like overview.

The source is Flyway V1-V8. Only declared PostgreSQL foreign keys get links.
This script does not connect to or modify the running database.
"""

from __future__ import annotations

from collections import defaultdict
from html import escape
from pathlib import Path

from generate_erd_ecoroute import extract_schema


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "base_datos" / "modelo_erd_negocio"
WIDTH, HEIGHT = 3740, 2280
CARD_WIDTH, ROW_HEIGHT, HEADER_HEIGHT = 620, 29, 49
X = [64, 796, 1528, 2260, 2992]
PLACEMENT = {
    "drivers": (0, 142),
    "driver_contracts": (0, 615),
    "driver_shifts": (0, 982),
    "vehicles": (1, 142),
    "fuel_logs": (1, 615),
    "vehicle_maintenance_logs": (1, 1030),
    "routes": (2, 142),
    "vehicle_gps_history": (2, 695),
    "incidents": (2, 1090),
    "route_expenses": (2, 1520),
    "orders": (3, 142),
    "delivery_proofs": (3, 882),
    "order_status_history": (3, 1320),
    "notifications": (3, 1720),
    "products": (4, 142),
    "order_items": (4, 615),
    "hubs": (4, 1050),
    "purchases": (4, 1510),
}
GROUPS = ["PERSONAL", "FLOTA", "PLANIFICACIÓN", "PEDIDOS Y ENTREGA", "CATÁLOGOS Y SOPORTE"]
COLORS = ["#1F6E64", "#2B6681", "#674C85", "#1C527D", "#6C6840"]


def xml(value: object) -> str:
    return escape(str(value), quote=True)


def table_height(table) -> int:
    return HEADER_HEIGHT + 15 + ROW_HEIGHT * len(table.columns) + 12


def row_y(tables, name: str, column: str) -> float:
    _, y = PLACEMENT[name]
    index = next(i for i, field in enumerate(tables[name].columns) if field.name == column)
    return y + HEADER_HEIGHT + 12 + (index + 0.5) * ROW_HEIGHT


def field_type(field) -> str:
    return field.datatype.upper().replace("TIMESTAMP WITH TIME ZONE", "TIMESTAMPTZ")


def table_svg(name, table) -> list[str]:
    lane, y = PLACEMENT[name]
    x = X[lane]
    height = table_height(table)
    color = COLORS[lane]
    isolated = name in {"hubs", "purchases"}
    lines = [
        f'<g id="table-{xml(name)}">',
        f'<rect x="{x}" y="{y}" width="{CARD_WIDTH}" height="{height}" rx="5" fill="#FFFFFF" stroke="#AAB8C5" stroke-width="2"/>',
        f'<path d="M{x+5} {y} H{x+CARD_WIDTH-5} Q{x+CARD_WIDTH} {y} {x+CARD_WIDTH} {y+5} V{y+HEADER_HEIGHT} H{x} V{y+5} Q{x} {y} {x+5} {y}" fill="{color}"/>',
        f'<text x="{x+16}" y="{y+32}" class="table-title">{xml(name)}</text>',
        f'<text x="{x+CARD_WIDTH-14}" y="{y+31}" class="table-count" text-anchor="end">{len(table.columns)} campos</text>',
    ]
    for index, field in enumerate(table.columns):
        top = y + HEADER_HEIGHT + 12 + index * ROW_HEIGHT
        if field.primary_key:
            fill = "#E6F1FB"
        elif field.foreign_key:
            fill = "#E6F5EF"
        else:
            fill = "#FFFFFF" if index % 2 == 0 else "#F5F7FA"
        lines.append(f'<rect x="{x+2}" y="{top}" width="{CARD_WIDTH-4}" height="{ROW_HEIGHT}" fill="{fill}"/>')
        key = "PK" if field.primary_key else "FK·UQ" if field.foreign_key and field.unique else "FK" if field.foreign_key else "UQ" if field.unique else ""
        if key:
            lines.append(f'<text x="{x+12}" y="{top+20}" class="key">{key}</text>')
        nullable = "" if field.nullable else " NOT NULL"
        lines.append(f'<text x="{x+88}" y="{top+20}" class="field">{xml(field.name)}</text>')
        lines.append(f'<text x="{x+CARD_WIDTH-12}" y="{top+20}" class="type" text-anchor="end">{xml(field_type(field))}{nullable}</text>')
    lines.append("</g>")
    if isolated:
        lines.append(f'<text x="{x+CARD_WIDTH-8}" y="{y+height+23}" class="isolated" text-anchor="end">SIN FK FÍSICA</text>')
    return lines


def relation_svg(fk, tables, slot: int) -> list[str]:
    parent_col, _ = PLACEMENT[fk.parent]
    child_col, _ = PLACEMENT[fk.child]
    py = row_y(tables, fk.parent, fk.parent_column)
    cy = row_y(tables, fk.child, fk.child_column)
    if parent_col == child_col:
        # Stay in the 112 px gutter to the right of the lane.
        side = X[parent_col] + CARD_WIDTH
        bus = side + 22 + (slot % 6) * 9
        path = f"M{side},{py:.1f} H{bus} V{cy:.1f} H{side}"
        sx, ex = side, side
    elif parent_col < child_col:
        sx, ex = X[parent_col] + CARD_WIDTH, X[child_col]
        bus = (sx + ex) / 2 + (slot % 5 - 2) * 8
        path = f"M{sx},{py:.1f} H{bus:.1f} V{cy:.1f} H{ex}"
    else:
        sx, ex = X[parent_col], X[child_col] + CARD_WIDTH
        bus = (sx + ex) / 2 + (slot % 5 - 2) * 8
        path = f"M{sx},{py:.1f} H{bus:.1f} V{cy:.1f} H{ex}"
    label = f"{fk.parent}.{fk.parent_column} → {fk.child}.{fk.child_column}"
    return [
        f'<path d="{path}" stroke="#137B70" stroke-width="2.3" fill="none" opacity=".74"><title>{xml(label)}</title></path>',
        f'<circle cx="{sx}" cy="{py:.1f}" r="4.2" fill="#12589A"/>',
        f'<circle cx="{ex}" cy="{cy:.1f}" r="4.2" fill="#138878"/>',
    ]


def main() -> None:
    tables, foreign_keys = extract_schema()
    selected = {name: tables[name] for name in PLACEMENT}
    links = [fk for fk in foreign_keys if fk.parent in selected and fk.child in selected]
    assert len(selected) == 18 and sum(len(t.columns) for t in selected.values()) == 159
    assert len(links) == 17
    lines = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{WIDTH}" height="{HEIGHT}" viewBox="0 0 {WIDTH} {HEIGHT}">',
        '<style>.title{font:700 38px Segoe UI,Arial,sans-serif;fill:#162C42}.subtitle{font:23px Segoe UI,Arial,sans-serif;fill:#53687D}.lane{font:700 18px Segoe UI,Arial,sans-serif;fill:#3B5269;letter-spacing:1px}.table-title{font:700 23px Segoe UI,Arial,sans-serif;fill:white}.table-count{font:17px Segoe UI,Arial,sans-serif;fill:#E7F1FA}.field{font:19px Consolas,monospace;fill:#1E3448}.type{font:17px Consolas,monospace;fill:#52677B}.key{font:700 16px Segoe UI,Arial,sans-serif;fill:#115A87}.foot{font:19px Segoe UI,Arial,sans-serif;fill:#3C5268}.isolated{font:700 15px Segoe UI,Arial,sans-serif;fill:#9B622C}</style>',
        f'<rect width="{WIDTH}" height="{HEIGHT}" fill="#F3F6FA"/>',
        '<text x="64" y="54" class="title">EcoRoute  |  ERD físico del negocio</text>',
        '<text x="64" y="88" class="subtitle">18 tablas · 159 columnas · 17 claves foráneas declaradas · PostgreSQL / Flyway V1–V8</text>',
    ]
    for i, group in enumerate(GROUPS):
        lines.append(f'<text x="{X[i]}" y="126" class="lane">{xml(group)}</text>')
    for i, fk in enumerate(links):
        lines.extend(relation_svg(fk, selected, i))
    for name, table in selected.items():
        lines.extend(table_svg(name, table))
    lines.extend([
        '<rect x="64" y="2135" width="3610" height="96" rx="4" fill="#E9EEF4"/>',
        '<text x="82" y="2171" class="foot">PK clave primaria  ·  FK clave foránea real  ·  UQ valor único  ·  NOT NULL campo obligatorio  ·  sin marca campo opcional</text>',
        '<text x="82" y="2205" class="foot">orders.driver_id NO tiene FK a drivers. Hubs y purchases están en la BD, pero aisladas. Keycloak, auth_* y corp_* no forman parte de este ERD del negocio.</text>',
        '</svg>',
    ])
    OUT.mkdir(parents=True, exist_ok=True)
    dest = OUT / "09_vista_completa_tipo_dbeaver.svg"
    dest.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"{dest}: {len(selected)} tablas, {sum(len(t.columns) for t in selected.values())} columnas, {len(links)} FK")


if __name__ == "__main__":
    main()
