"""Publish a navigation index and combine the bounded document checks."""
from pathlib import Path
import json,hashlib

ROOT=Path(__file__).resolve().parents[2]
HERE=Path(__file__).resolve().parent
OUT=ROOT/'docs/exposicion_8_pantallas'
QA=OUT/'_qa'
checks=json.loads((QA/'checks.json').read_text(encoding='utf-8'))
comparison=json.loads((QA/'render_comparison.json').read_text(encoding='utf-8'))
last_comparison=json.loads((QA/'final_render_comparison.json').read_text(encoding='utf-8'))
assert checks['status']=='PASS'
assert comparison['compared_pages']==102
assert last_comparison['compared_pages']==checks['pages']

main=json.loads((HERE/'qa_main.json').read_text(encoding='utf-8'))
baseline=set(main['baseline_reviewed_pages'])
final=set(main['final_reviewed_pages'])
reports=[]
for n in (2,3,4):
    for prefix in ('qa_alumno','qa_final_alumno'):
        p=HERE/f'{prefix}{n}.json'
        value=json.loads(p.read_text(encoding='utf-8'))
        page_numbers={int(x['page']) if isinstance(x,dict) else int(x) for x in value['pages']}
        if prefix=='qa_alumno':baseline |= page_numbers
        else:
            assert not value.get('issues'),(p,value['issues'])
            final |= page_numbers
        reports.append(str(p.relative_to(ROOT)))
assert baseline==set(range(1,103)),sorted(set(range(1,103))-baseline)
assert set(comparison['changed_pages'])<=final,sorted(set(comparison['changed_pages'])-final)
last_qa=json.loads((HERE/'qa_last_delta.json').read_text(encoding='utf-8'))
assert not last_qa['issues']
assert set(last_comparison['changed_pages'])<=set(last_qa['pages'])

files=['EcoRoute_Guia_8_Pantallas_4_Integrantes.docx','EcoRoute_Guia_8_Pantallas_4_Integrantes.md']
manifest={'status':'PASS','date':'2026-10-26','pages':checks['pages'],'screens':8,'students':4,'code_excerpts':checks['code_excerpts'],
          'baseline_pages_viewed':sorted(baseline),'updated_pages_viewed':sorted(final),
          'unchanged_body_pages':[x['page'] for x in comparison['pages'] if not x['requires_new_visual_review']],
          'method':'Cada página base revisada visualmente; cuerpos idénticos transferidos por hash de píxeles y todas las páginas modificadas reabiertas; folios y límites verificados sobre PDF final.',
          'pending_layout_issues':[],'reports':reports,
          'last_revision_pages_viewed':last_qa['pages'],
          'files':{f:hashlib.sha256((OUT/f).read_bytes()).hexdigest() for f in files},
          'scope':'Revisión documental y de código; sin ejecución nueva de la app ni UAT empresarial.'}
(QA/'release.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')

def link(label,p):return f'[{label}](<{(ROOT/p).as_posix()}>)'
inventory=json.loads((QA/'render_page_inventory.json').read_text(encoding='utf-8'))
starts=[p['page'] for p in inventory if p['screen_headings']]
import pdfplumber
with pdfplumber.open(QA/'EcoRoute_Guia_8_Pantallas_4_Integrantes.pdf') as pdf:
    closing=next(i+1 for i in range(len(pdf.pages)-5,len(pdf.pages)) if 'Ensayo integrado del grupo' in (pdf.pages[i].extract_text() or ''))
ranges=[f'{a}–{b-1}' for a,b in zip(starts,starts[1:]+[closing])]
rows=[('Enzo Coronel','01 Pedidos',ranges[0],'02 Gestión de despacho',ranges[1]),
      ('Luis Espinoza','03 Mis rutas móvil',ranges[2],'04 Detalle y POD móvil',ranges[3]),
      ('Renzo Namuche','05 Incidencias',ranges[4],'06 Acciones de mejora',ranges[5]),
      ('Adrian Santillan','07 Dashboard logístico',ranges[6],'08 Inteligencia de negocio',ranges[7])]
text=['# Guía de exposición de ocho pantallas de EcoRoute\n',
      link('Documento Word completo','docs/exposicion_8_pantallas/'+files[0])+' · '+link('Versión para consultar en VS Code','docs/exposicion_8_pantallas/'+files[1])+'\n',
      f'Distribución propuesta del Grupo 3. Cada integrante explica dos pantallas reales del mismo recorrido de MICOTRANS. La numeración corresponde al render de {checks["pages"]} páginas de esta edición.\n',
      '| Integrante | Primera pantalla | Páginas | Segunda pantalla | Páginas |\n| --- | --- | --- | --- | --- |']
for r in rows:text.append('| '+' | '.join(r)+' |')
text += [f'\nLas páginas 1–{starts[0]-1} presentan la preparación, el flujo de negocio y la arquitectura compartida. Las páginas {closing}–{checks["pages"]} contienen el ensayo integrado y el glosario.\n',
         'Para cada pantalla se incluyen condiciones de entrada, demostración paso a paso, diagrama técnico, peticiones HTTP, explicación del frontend, reglas del backend, persistencia, archivos para abrir en VS Code, fragmentos con líneas reales, excepciones, guion oral, preguntas probables y pruebas para localizar.\n',
         'Secuencia común: pedido sin ruta → acuerdo comercial → planificación y asignación → aprobación → aceptación móvil → despacho → ejecución y POD → incidencia o cierre → evaluación y mejora. La aceptación móvil ocurre antes del despacho web.\n',
         'En la defensa conviene seguir una petición desde el botón hasta el SQL y regresar a la pantalla. Distinguir el estado de interfaz de la persistencia, la cola offline de la confirmación del servidor y la distancia planificada de la distancia GPS aceptada.\n',
         'La guía se elaboró el 26 de octubre de 2026 con código del workspace y capturas históricas identificadas. La revisión del documento no representa una nueva ejecución del sistema ni aceptación empresarial. El apartado final precisa el alcance de la evidencia.\n']
(OUT/'README.md').write_text('\n'.join(text),encoding='utf-8')
print(json.dumps({k:v for k,v in manifest.items() if k not in ['baseline_pages_viewed','updated_pages_viewed','unchanged_body_pages','files','reports']},ensure_ascii=False))
