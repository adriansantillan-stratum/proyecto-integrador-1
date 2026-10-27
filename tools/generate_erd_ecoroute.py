"""Genera un ERD fiel a las migraciones Flyway V1-V8 de EcoRoute.

Salidas: inventario JSON, ERD Mermaid completo y vistas SVG/PNG por dominio.
No modifica la base de datos ni las migraciones.
"""

from __future__ import annotations

import json
import re
from collections import defaultdict
from dataclasses import asdict, dataclass, field
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src" / "main" / "resources" / "db" / "migration"
OUT = ROOT / "docs" / "base_datos" / "modelo_erd"
MIGRATIONS = sorted(SOURCE.glob("V*.sql"), key=lambda p: int(re.match(r"V(\d+)", p.name).group(1)))


@dataclass
class Column:
    name: str
    datatype: str
    nullable: bool = True
    primary_key: bool = False
    unique: bool = False
    foreign_key: bool = False
    default: str | None = None


@dataclass
class ForeignKey:
    child: str
    child_column: str
    parent: str
    parent_column: str
    on_delete: str | None = None


@dataclass
class Table:
    name: str
    migration: str
    columns: list[Column] = field(default_factory=list)
    unique_constraints: list[list[str]] = field(default_factory=list)


def clean_comments(sql: str) -> str:
    return re.sub(r"--[^\n]*", "", sql)


def split_top_level(text: str) -> list[str]:
    parts, current, depth, quoted = [], [], 0, False
    for ch in text:
        if ch == "'":
            quoted = not quoted
        if not quoted:
            if ch == "(":
                depth += 1
            elif ch == ")":
                depth -= 1
            elif ch == "," and depth == 0:
                parts.append("".join(current).strip())
                current = []
                continue
        current.append(ch)
    if current:
        parts.append("".join(current).strip())
    return parts


def find_matching_paren(text: str, start: int) -> int:
    depth, quoted = 0, False
    for pos in range(start, len(text)):
        ch = text[pos]
        if ch == "'":
            quoted = not quoted
        if not quoted:
            if ch == "(":
                depth += 1
            elif ch == ")":
                depth -= 1
                if depth == 0:
                    return pos
    raise ValueError("Unbalanced SQL parentheses")


def parse_column(raw: str) -> tuple[Column, ForeignKey | None]:
    match = re.match(r"^([a-zA-Z_][\w]*)\s+(.+)$", raw.strip(), re.S)
    if not match:
        raise ValueError(f"Not a column: {raw}")
    name, tail = match.groups()
    type_end = re.search(r"\b(?:NOT\s+NULL|NULL|PRIMARY\s+KEY|UNIQUE|DEFAULT|REFERENCES|CHECK)\b", tail, re.I)
    datatype = (tail[: type_end.start()] if type_end else tail).strip()
    primary_key = bool(re.search(r"\bPRIMARY\s+KEY\b", tail, re.I))
    nullable = not primary_key and not bool(re.search(r"\bNOT\s+NULL\b", tail, re.I))
    unique = primary_key or bool(re.search(r"\bUNIQUE\b", tail, re.I))
    default_match = re.search(r"\bDEFAULT\s+(.+?)(?=\s+(?:REFERENCES|NOT\s+NULL|UNIQUE|PRIMARY\s+KEY)\b|$)", tail, re.I | re.S)
    col = Column(name, " ".join(datatype.split()), nullable, primary_key, unique, False,
                 default_match.group(1).strip() if default_match else None)
    fk_match = re.search(r"\bREFERENCES\s+([\w]+)\s*\(\s*([\w]+)\s*\)(?:\s+ON\s+DELETE\s+(CASCADE|RESTRICT|SET\s+NULL))?", tail, re.I)
    fk = None
    if fk_match:
        col.foreign_key = True
        fk = ForeignKey("", name, fk_match.group(1), fk_match.group(2), fk_match.group(3))
    return col, fk


def extract_schema() -> tuple[dict[str, Table], list[ForeignKey]]:
    tables: dict[str, Table] = {}
    fks: list[ForeignKey] = []
    create_pattern = re.compile(r"\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([\w]+)\s*\(", re.I)
    alter_pattern = re.compile(r"\bALTER\s+TABLE\s+([\w]+)\s+ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?(.+?);", re.I | re.S)

    for migration in MIGRATIONS:
        sql = clean_comments(migration.read_text(encoding="utf-8-sig"))
        for match in create_pattern.finditer(sql):
            name = match.group(1)
            if name in tables:
                raise ValueError(f"Repeated table: {name}")
            end = find_matching_paren(sql, match.end() - 1)
            table = Table(name, migration.name)
            for item in split_top_level(sql[match.end() : end]):
                if not item:
                    continue
                fk_table = re.match(r"^FOREIGN\s+KEY\s*\(\s*(\w+)\s*\)\s+REFERENCES\s+(\w+)\s*\(\s*(\w+)\s*\)", item, re.I)
                if fk_table:
                    colname, parent, parent_col = fk_table.groups()
                    fks.append(ForeignKey(name, colname, parent, parent_col))
                    table.columns[[c.name for c in table.columns].index(colname)].foreign_key = True
                    continue
                unique_table = re.match(r"^UNIQUE\s*\((.+)\)$", item, re.I | re.S)
                if unique_table:
                    table.unique_constraints.append([v.strip() for v in unique_table.group(1).split(",")])
                    continue
                col, fk = parse_column(item)
                table.columns.append(col)
                if fk:
                    fk.child = name
                    fks.append(fk)
            tables[name] = table

        for match in alter_pattern.finditer(sql):
            name, definition = match.groups()
            if name not in tables:
                raise ValueError(f"ALTER before CREATE: {name}")
            col, fk = parse_column(definition)
            if any(c.name == col.name for c in tables[name].columns):
                raise ValueError(f"Repeated column: {name}.{col.name}")
            tables[name].columns.append(col)
            if fk:
                fk.child = name
                fks.append(fk)

    for fk in fks:
        if fk.parent not in tables:
            raise ValueError(f"Missing FK parent: {fk.parent}")
        if not any(c.name == fk.parent_column for c in tables[fk.parent].columns):
            raise ValueError(f"Missing FK parent column: {fk.parent}.{fk.parent_column}")
        if not any(c.name == fk.child_column for c in tables[fk.child].columns):
            raise ValueError(f"Missing FK child column: {fk.child}.{fk.child_column}")
    return tables, fks


GROUPS = {
    "01_operacion": ["drivers", "vehicles", "routes", "orders", "delivery_proofs", "order_status_history", "vehicle_gps_history", "products", "order_items", "notifications"],
    "02_flota_soporte": ["drivers", "vehicles", "routes", "hubs", "vehicle_maintenance_logs", "fuel_logs", "route_expenses", "incidents", "driver_contracts", "driver_shifts", "purchases"],
    "03_seguridad": ["auth_module", "auth_resource", "auth_action", "auth_role", "auth_permission", "auth_user_role"],
    "04_corporativo_referencia": ["corp_branches", "corp_departments", "corp_employees", "corp_warehouses", "corp_customers", "corp_contracts", "corp_invoices", "corp_fleet_types", "corp_maintenance_logs"],
}


def cardinality(tables: dict[str, Table], fk: ForeignKey) -> tuple[str, str]:
    col = next(c for c in tables[fk.child].columns if c.name == fk.child_column)
    parent_end = "||" if not col.nullable else "o|"
    unique_fk = col.unique or [col.name] in tables[fk.child].unique_constraints
    child_end = "o|" if unique_fk else "o{"
    return parent_end, child_end


def mermaid(tables: dict[str, Table], fks: list[ForeignKey], names: list[str]) -> str:
    chosen = set(names)
    lines = ["erDiagram"]
    for name in names:
        lines.append(f"    {name} {{")
        for col in tables[name].columns:
            typ = re.sub(r"[^A-Za-z0-9_]+", "_", col.datatype).strip("_").upper()
            tags = ",".join(tag for tag, flag in [("PK", col.primary_key), ("FK", col.foreign_key), ("UK", col.unique and not col.primary_key)] if flag)
            lines.append(f"        {typ} {col.name}{(' ' + tags) if tags else ''}")
        lines.append("    }")
    for fk in fks:
        if fk.child in chosen and fk.parent in chosen:
            p, c = cardinality(tables, fk)
            lines.append(f'    {fk.parent} {p}--{c} {fk.child} : "{fk.child_column} → {fk.parent_column}"')
    lines.append("")
    return "\n".join(lines)


COLORS = {
    "background": "#F8FAFC", "ink": "#102A43", "muted": "#496275", "line": "#8AA3B6",
    "operacion": "#166B8A", "flota": "#0B817B", "seguridad": "#6B50A1", "corporativo": "#A4611B",
    "card": "#FFFFFF", "border": "#CBD7E0", "pk": "#E6F1FA", "fk": "#EFF7F5", "warn": "#FFF3DC",
}


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = [
        Path("C:/Windows/Fonts") / ("arialbd.ttf" if bold else "arial.ttf"),
        Path("/usr/share/fonts/truetype/dejavu") / ("DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"),
    ]
    for path in candidates:
        if path.exists():
            return ImageFont.truetype(str(path), size)
    return ImageFont.load_default()


def svg_escape(value: str) -> str:
    return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


def draw_svg(name: str, tables: dict[str, Table], fks: list[ForeignKey], selected: list[str], positions: dict[str, tuple[int, int]], title: str, subtitle: str, theme: str) -> str:
    col_width = 415
    row_h = 25
    header_h = 39
    card_h = {t: header_h + 10 + row_h * len(tables[t].columns) for t in selected}
    width = max(positions[t][0] + col_width for t in selected) + 60
    height = max(positions[t][1] + card_h[t] for t in selected) + 108
    lines = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img" aria-label="{svg_escape(title)}">',
             f'<rect width="{width}" height="{height}" fill="{COLORS["background"]}"/>',
             f'<text x="48" y="55" font-family="Arial,sans-serif" font-size="29" font-weight="700" fill="{COLORS["ink"]}">{svg_escape(title)}</text>',
             f'<text x="48" y="82" font-family="Arial,sans-serif" font-size="17" fill="{COLORS["muted"]}">{svg_escape(subtitle)}</text>']
    # Relations first, so entity cards remain on top of connectors.
    local_fks = [fk for fk in fks if fk.child in positions and fk.parent in positions]
    for fk in local_fks:
        px, py = positions[fk.parent]
        cx, cy = positions[fk.child]
        pw, ph, cw, ch = col_width, card_h[fk.parent], col_width, card_h[fk.child]
        if px < cx:
            x1, y1, x2, y2 = px + pw, py + ph / 2, cx, cy + ch / 2
        elif px > cx:
            x1, y1, x2, y2 = px, py + ph / 2, cx + cw, cy + ch / 2
        elif py < cy:
            x1, y1, x2, y2 = px + pw / 2, py + ph, cx + cw / 2, cy
        else:
            x1, y1, x2, y2 = px + pw / 2, py, cx + cw / 2, cy + ch
        midx = (x1 + x2) / 2
        path = f'M {x1:.0f} {y1:.0f} L {midx:.0f} {y1:.0f} L {midx:.0f} {y2:.0f} L {x2:.0f} {y2:.0f}' if px != cx else f'M {x1:.0f} {y1:.0f} L {x2:.0f} {y2:.0f}'
        lines.append(f'<path d="{path}" fill="none" stroke="{COLORS["line"]}" stroke-width="2"/>')
        p, c = cardinality(tables, fk)
        lines.append(f'<text x="{x1 + (10 if x1 < x2 else -32):.0f}" y="{y1 - 7:.0f}" font-family="Arial,sans-serif" font-size="13" fill="{COLORS["muted"]}">{p}</text>')
        lines.append(f'<text x="{x2 + (-33 if x1 < x2 else 8):.0f}" y="{y2 - 7:.0f}" font-family="Arial,sans-serif" font-size="13" fill="{COLORS["muted"]}">{c}</text>')
    for t in selected:
        x, y = positions[t]
        h = card_h[t]
        lines.extend([f'<rect x="{x}" y="{y}" width="{col_width}" height="{h}" rx="9" fill="{COLORS["card"]}" stroke="{COLORS["border"]}"/>',
                      f'<path d="M {x+9} {y} H {x+col_width-9} Q {x+col_width} {y} {x+col_width} {y+9} V {y+header_h} H {x} V {y+9} Q {x} {y} {x+9} {y}" fill="{COLORS[theme]}"/>',
                      f'<text x="{x+16}" y="{y+27}" font-family="Arial,sans-serif" font-size="19" font-weight="700" fill="#FFFFFF">{svg_escape(t)}</text>'])
        for i, col in enumerate(tables[t].columns):
            top = y + header_h + 4 + i * row_h
            if col.primary_key or col.foreign_key:
                bg = COLORS["pk"] if col.primary_key else COLORS["fk"]
                lines.append(f'<rect x="{x+5}" y="{top}" width="{col_width-10}" height="{row_h}" fill="{bg}"/>')
            flags = ",".join(tag for tag, enabled in (("PK", col.primary_key), ("FK", col.foreign_key), ("UQ", col.unique and not col.primary_key)) if enabled)
            datatype = col.datatype.upper().replace("TIMESTAMP WITH TIME ZONE", "TIMESTAMPTZ")
            if len(datatype) > 24:
                datatype = datatype[:22] + "…"
            lines.append(f'<text x="{x+16}" y="{top+18}" font-family="Arial,sans-serif" font-size="15" fill="{COLORS["ink"]}">{svg_escape(col.name)}</text>')
            lines.append(f'<text x="{x+col_width-145}" y="{top+18}" font-family="Arial,sans-serif" font-size="13" fill="{COLORS["muted"]}">{svg_escape(datatype)}</text>')
            if flags:
                lines.append(f'<text x="{x+col_width-14}" y="{top+18}" text-anchor="end" font-family="Arial,sans-serif" font-size="12" font-weight="700" fill="{COLORS[theme]}">{flags}</text>')
    legend_y = height - 47
    lines.append(f'<text x="48" y="{legend_y}" font-family="Arial,sans-serif" font-size="14" fill="{COLORS["muted"]}">FK físicas: {len(local_fks)}   ·   Cardinalidad: || exactamente uno, o| cero o uno, o{{ cero a muchos   ·   Fuente: Flyway V1–V8</text>')
    lines.append('</svg>')
    return "\n".join(lines) + "\n"


def render_png_from_svg(svg: str, path: Path) -> bool:
    try:
        import cairosvg
        cairosvg.svg2png(bytestring=svg.encode("utf-8"), write_to=str(path))
        return True
    except ImportError:
        return False


def overview_svg(tables: dict[str, Table], fks: list[ForeignKey]) -> str:
    # Full physical inventory, positioned by domain. Fields live in detail sheets.
    themes = [("Operación / entrega", "operacion", GROUPS["01_operacion"]),
              ("Flota / soporte", "flota", [t for t in GROUPS["02_flota_soporte"] if t not in GROUPS["01_operacion"]]),
              ("Seguridad local", "seguridad", GROUPS["03_seguridad"]),
              ("Corporativo de referencia", "corporativo", GROUPS["04_corporativo_referencia"]) ]
    width, height = 1930, 1450
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img" aria-label="EcoRoute ERD completo: 33 tablas">',
           f'<rect width="{width}" height="{height}" fill="{COLORS["background"]}"/>',
           f'<text x="50" y="62" font-family="Arial,sans-serif" font-size="36" font-weight="700" fill="{COLORS["ink"]}">EcoRoute · modelo físico completo</text>',
           f'<text x="50" y="94" font-family="Arial,sans-serif" font-size="18" fill="{COLORS["muted"]}">{len(tables)} tablas · {sum(len(t.columns) for t in tables.values())} columnas · {len(fks)} claves foráneas físicas · migraciones V1–V8</text>']
    widths = [910, 910]
    xstarts = [50, 990]
    ystarts = [128, 128, 800, 800]
    entity_positions = {}
    for group_index, (label, theme, members) in enumerate(themes):
        col = group_index % 2
        x, y = xstarts[col], ystarts[group_index]
        card_width = widths[col]
        rows = (len(members) + 2) // 3
        panel_height = 78 + rows * 104
        out.append(f'<rect x="{x}" y="{y}" width="{card_width}" height="{panel_height}" rx="14" fill="{COLORS["card"]}" stroke="{COLORS["border"]}"/>')
        out.append(f'<text x="{x+24}" y="{y+39}" font-family="Arial,sans-serif" font-size="23" font-weight="700" fill="{COLORS[theme]}">{svg_escape(label)} · {len(members)}</text>')
        for i, table in enumerate(members):
            tx = x + 24 + (i % 3) * 292
            ty = y + 63 + (i // 3) * 104
            entity_positions[table] = (tx, ty)
            out.append(f'<rect x="{tx}" y="{ty}" width="275" height="76" rx="8" fill="{COLORS["background"]}" stroke="{COLORS["border"]}"/>')
            out.append(f'<text x="{tx+12}" y="{ty+29}" font-family="Arial,sans-serif" font-size="17" font-weight="700" fill="{COLORS["ink"]}">{svg_escape(table)}</text>')
            out.append(f'<text x="{tx+12}" y="{ty+54}" font-family="Arial,sans-serif" font-size="13" fill="{COLORS["muted"]}">{len(tables[table].columns)} campos</text>')
    # A compact relationship register ensures every declared FK is visible without
    # unreadable connector crossings at 33-entity scale.
    by_parent = defaultdict(list)
    for fk in fks:
        by_parent[fk.parent].append(fk.child)
    rels = [f"{parent} → {', '.join(dict.fromkeys(children))}" for parent, children in by_parent.items()]
    start_y = 1180
    out.append(f'<text x="50" y="{start_y}" font-family="Arial,sans-serif" font-size="20" font-weight="700" fill="{COLORS["ink"]}">Relaciones declaradas en la BD</text>')
    for i, item in enumerate(rels):
        col, row = i % 3, i // 3
        out.append(f'<text x="{50+col*620}" y="{start_y+34+row*27}" font-family="Arial,sans-serif" font-size="14" fill="{COLORS["muted"]}">{svg_escape(item)}</text>')
    out.append(f'<text x="50" y="1405" font-family="Arial,sans-serif" font-size="15" fill="{COLORS["corporativo"]}">Sin FK física: orders.driver_id, corp_maintenance_logs.vehicle_id, auth_user_role.user_external_id; hubs, purchases y corp_fleet_types aisladas.</text>')
    out.append('</svg>')
    return "\n".join(out) + "\n"


def main() -> None:
    tables, fks = extract_schema()
    OUT.mkdir(parents=True, exist_ok=True)
    all_names = list(tables)
    inventory = {"source": [p.name for p in MIGRATIONS], "table_count": len(tables),
                 "column_count": sum(len(t.columns) for t in tables.values()), "foreign_key_count": len(fks),
                 "tables": {name: asdict(table) for name, table in tables.items()},
                 "foreign_keys": [asdict(fk) for fk in fks]}
    (OUT / "inventario_modelo.json").write_text(json.dumps(inventory, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (OUT / "EcoRoute_ERD_Completo.mmd").write_text(mermaid(tables, fks, all_names), encoding="utf-8")
    for label, names in GROUPS.items():
        (OUT / f"{label}.mmd").write_text(mermaid(tables, fks, names), encoding="utf-8")

    # Coordinates for detailed field-by-field plates. Some shared parent tables
    # intentionally repeat across plates to keep physical relationships local.
    layouts = {
        "01_operacion": {
            "drivers": (50, 135), "vehicles": (50, 550), "routes": (540, 135),
            "orders": (1030, 135), "delivery_proofs": (1520, 135),
            "order_status_history": (1520, 545), "notifications": (1520, 840),
            "vehicle_gps_history": (540, 590), "products": (1030, 825), "order_items": (1030, 1160),
        },
        "02_flota_soporte": {
            "drivers": (50, 135), "vehicles": (50, 550), "routes": (540, 135),
            "hubs": (50, 990), "driver_contracts": (540, 570), "driver_shifts": (540, 840),
            "vehicle_maintenance_logs": (1030, 135), "fuel_logs": (1030, 490),
            "route_expenses": (1520, 135), "incidents": (1520, 430), "purchases": (1520, 810),
        },
        "03_seguridad": {
            "auth_module": (50, 135), "auth_resource": (540, 135), "auth_action": (50, 485),
            "auth_role": (540, 485), "auth_permission": (1030, 220), "auth_user_role": (1030, 650),
        },
        "04_corporativo_referencia": {
            "corp_branches": (50, 135), "corp_departments": (540, 135),
            "corp_employees": (1030, 135), "corp_warehouses": (540, 570),
            "corp_customers": (50, 820), "corp_contracts": (540, 820), "corp_invoices": (1030, 820),
            "corp_fleet_types": (1520, 135), "corp_maintenance_logs": (1520, 490),
        },
    }
    titles = {
        "01_operacion": ("ERD 1 · Operación de entrega", "Pedidos, rutas, conductor, vehículo, evidencia y seguimiento", "operacion"),
        "02_flota_soporte": ("ERD 2 · Flota y soporte", "Recursos, costos e incidencias; purchases y hubs aparecen aislados", "flota"),
        "03_seguridad": ("ERD 3 · RBAC local", "Tablas auth_* de EcoRoute; Keycloak conserva su propia base", "seguridad"),
        "04_corporativo_referencia": ("ERD 4 · Corporativo de referencia", "Tablas corp_* de datos ficticios heredados; no representan el padrón MICOTRANS", "corporativo"),
    }
    for label, selected in GROUPS.items():
        title, subtitle, theme = titles[label]
        svg = draw_svg(label, tables, fks, selected, layouts[label], title, subtitle, theme)
        (OUT / f"{label}.svg").write_text(svg, encoding="utf-8")
        render_png_from_svg(svg, OUT / f"{label}.png")
    overview = overview_svg(tables, fks)
    (OUT / "00_vista_general.svg").write_text(overview, encoding="utf-8")
    render_png_from_svg(overview, OUT / "00_vista_general.png")
    print(json.dumps({"tables": len(tables), "columns": sum(len(t.columns) for t in tables.values()),
                      "physical_fks": len(fks), "output": str(OUT)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
