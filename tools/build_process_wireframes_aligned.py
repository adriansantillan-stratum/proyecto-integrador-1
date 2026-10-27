"""Wireframes vectoriales de P01/P02 basados en las pantallas reales de EcoRoute."""
from __future__ import annotations

from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs/entregables_procesos_ecoroute/imagenes"
OUT.mkdir(parents=True, exist_ok=True)


def rect(x, y, w, h, fill="white", stroke="#CFD8E3", r=8):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}" stroke="{stroke}"/>'


def txt(x, y, value, size=16, color="#1E293B", weight=400):
    return f'<text x="{x}" y="{y}" fill="{color}" font-family="Arial, sans-serif" font-size="{size}" font-weight="{weight}">{escape(value)}</text>'


def chrome(x, y, title, active="Pedidos"):
    out = [rect(x, y, 736, 322, "#F8FAFC", "#B8C9D9", 12), rect(x, y, 128, 322, "#1E293B", "none", 12),
           txt(x+17, y+31, "EcoRoute", 18, "#60A5FA", 700)]
    for n, item in enumerate(("Dashboard", "Pedidos", "Rutas", "Conductores", "Vehículos", "Reportes")):
        yy = y + 70 + n*34
        if item == active:
            out.append(rect(x+9, yy-18, 110, 27, "#253C69", "none", 4))
        out.append(txt(x+20, yy, item, 13, "#FFFFFF" if item == active else "#B8C4D3"))
    out.append(txt(x+151, y+36, title, 22, "#0F172A", 700))
    return out


def label_field(x, y, label, value, width=246):
    return [txt(x, y, label, 13, "#334155", 700), rect(x, y+10, width, 29),
            txt(x+9, y+30, value, 13, "#64748B")]


def panel_label(x, y, number, title, note):
    return [txt(x+4, y-16, f"{number}  {title}", 19, "#12395F", 700),
            txt(x+4, y+341, note, 13, "#53677C")]


def order_panels():
    out = []
    x, y = 40, 115
    out += panel_label(x,y,"01","Bandeja de pedidos","La columna Ruta distingue Sin asignar de Ruta #N.")
    out += chrome(x,y,"Gestión de Pedidos")
    out += [rect(x+149,y+54,540,35), txt(x+162,y+77,"Buscar tracking...",13,"#94A3B8"),
            rect(x+150,y+104,555,157),txt(x+166,y+128,"TRACKING       CLIENTE                 RUTA                 ESTADO",13,"#64748B",700),
            txt(x+166,y+165,"ECO-12345      Ana García              Sin asignar          PENDING",13),
            txt(x+166,y+202,"ECO-12346      Luis Torres               Ruta #8              ASSIGNED",13),
            rect(x+505,y+269,190,31,"#2563EB","none",5),txt(x+533,y+291,"Nuevo Pedido",14,"#FFFFFF",700)]
    x, y = 824, 115
    out += panel_label(x,y,"02","Alta actual","La opción -- Sin Ruta -- está disponible y es la opción inicial.")
    out += chrome(x,y,"Registrar Nuevo Pedido")
    out += label_field(x+153,y+78,"N° Tracking","Ej: ECO-12345")
    out += label_field(x+426,y+78,"Vincular a Ruta","-- Sin Ruta --")
    out += label_field(x+153,y+140,"Nombre Cliente","Ej: Ana García")
    out += label_field(x+426,y+140,"Dirección","Ej: Calle Los Pinos 450")
    out += label_field(x+153,y+202,"Teléfono Cliente","Ej: 912345678")
    out += label_field(x+426,y+202,"Email Cliente","ejemplo@correo.com")
    out += [rect(x+565,y+274,121,31,"#2563EB","none",5),txt(x+589,y+295,"Registrar",14,"#FFFFFF",700)]
    x, y = 40, 520
    out += panel_label(x,y,"03","Importación CSV","routeId puede quedar vacío; no sustituye una confirmación comercial.")
    out += chrome(x,y,"Importar pedidos CSV")
    out += [rect(x+164,y+83,517,111,"#F8FAFC","#93C5FD",10),txt(x+235,y+127,"Seleccionar archivo CSV",17,"#2563EB",700),
            txt(x+235,y+158,"tracking, receptor, dirección, latitud, longitud, ...",13,"#64748B"),
            rect(x+519,y+253,162,31,"#10B981","none",5),txt(x+539,y+275,"Importar",14,"#FFFFFF",700)]
    x, y = 824, 520
    out += panel_label(x,y,"04","Consulta posterior","PENDING significa sin ruta; no existe estado CONFIRMED.")
    out += chrome(x,y,"Detalle de pedido")
    out += [rect(x+150,y+64,548,221), txt(x+170,y+98,"Tracking: ECO-12345",15,"#1E293B",700),
            txt(x+170,y+134,"Cliente: Ana García",15),txt(x+170,y+170,"Dirección: Calle Los Pinos 450",15),
            txt(x+170,y+206,"Ruta: Sin asignar",15,"#B45309",700),
            txt(x+170,y+242,"Estado: PENDING",15,"#475569",700)]
    return out


def route_panels():
    out=[]
    x,y=40,115
    out += panel_label(x,y,"01","Crear ruta","La ruta nace PLANNED con conductor, vehículo y fecha.")
    out += chrome(x,y,"Planificar Despacho","Rutas")
    out += label_field(x+172,y+75,"Conductor Asignado","Buscar por nombre o licencia...",480)
    out += label_field(x+172,y+137,"Vehículo de Flota","Buscar por placa o marca...",480)
    out += label_field(x+172,y+199,"Fecha de Ejecución","01/10/2026",480)
    out += [rect(x+371,y+273,282,31,"#2563EB","none",5),txt(x+393,y+294,"Confirmar y Crear Ruta",14,"#FFFFFF",700)]
    x,y=824,115
    out += panel_label(x,y,"02","Ruta planificada","La ruta puede existir sin pedidos vinculados.")
    out += chrome(x,y,"Rutas de Despacho","Rutas")
    out += [rect(x+151,y+66,250,208),txt(x+172,y+99,"Ruta #8",18,"#1E293B",700),
            txt(x+172,y+132,"Estado: PLANNED",14,"#2563EB",700),
            txt(x+172,y+163,"Conductor: Juan Pérez",14),
            txt(x+172,y+194,"Vehículo: ABC-123",14),
            txt(x+172,y+225,"Pedidos: 0",14,"#B45309",700),
            rect(x+416,y+66,280,208,"#ECEDE9","#CFD8E3"),txt(x+463,y+166,"Mapa de seguimiento",14,"#64748B")]
    x,y=40,520
    out += panel_label(x,y,"03","Asignación posterior","OBJETIVO: no existe hoy pantalla ni endpoint para asignar PENDING.")
    out += chrome(x,y,"Asignar pedidos a ruta","Rutas")
    out += [rect(x+150,y+64,548,221),txt(x+170,y+95,"Ruta #8   |   PLANNED",16,"#1E293B",700),
            txt(x+170,y+131,"ECO-12345   Ana García   PENDING",14),
            txt(x+170,y+163,"ECO-12347   Marta Ruiz    PENDING",14),
            rect(x+461,y+229,218,34,"#FFFFFF","#B45309",5),
            txt(x+473,y+251,"PENDIENTE DE DESARROLLO",11,"#B45309",700)]
    x,y=824,520
    out += panel_label(x,y,"04","Despacho con pedidos","El botón actual inicia la ruta; los vinculados pasan a IN_TRANSIT.")
    out += chrome(x,y,"Seguimiento en Vivo - #8","Rutas")
    out += [rect(x+151,y+65,548,215),txt(x+171,y+100,"Estado: PLANNED   |   Pedidos: 2",15,"#1E293B",700),
            txt(x+171,y+139,"ECO-12346   Ruta #8   ASSIGNED",14),
            txt(x+171,y+170,"ECO-12348   Ruta #8   ASSIGNED",14),
            rect(x+453,y+218,219,37,"#22C55E","none",5),
            txt(x+473,y+243,"Iniciar Despacho",14,"#FFFFFF",700)]
    return out


def write(name, title, subtitle, contents):
    svg=[f'<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="890" viewBox="0 0 1600 890">',
         rect(0,0,1600,890,"#F2F6FA","none",0),txt(40,53,title,30,"#12395F",700),
         txt(40,78,subtitle,16,"#53677C")]
    svg.extend(contents)
    svg.append('</svg>')
    p=OUT/name
    p.write_text(''.join(svg),encoding='utf-8')
    print(p)


write('P01_wireframes_flujo_alineado.svg','P01  Confirmar pedidos',
      'Pantallas actuales. La aceptación del servicio por el cliente es una decisión de negocio, no una pantalla ni un estado implementado.',order_panels())
write('P02_wireframes_flujo_alineado.svg','P02  Preparar la jornada de reparto',
      'Tres vistas existentes y una vista objetivo identificada como pendiente. No se confunde planificación con despacho iniciado.',route_panels())
