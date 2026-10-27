"""Build a dated control dossier without changing historical deliverables."""
import json,html,hashlib,sys
from pathlib import Path
from datetime import datetime,timezone
from collections import Counter
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'docs/control_integral_20261022'
sys.path.insert(0,str(ROOT/'tools/audit_e2e'))
from build_integrated_documents import setup,heading,para,table,NARRATIVE
from docx import Document

def read(name):return json.loads((OUT/name).read_text(encoding='utf-8-sig'))
def plain(value):
    if isinstance(value,dict):return value.get('description') or value.get('definition') or value.get('status') or json.dumps(value,ensure_ascii=False)
    if isinstance(value,list):return '; '.join(plain(x) for x in value)
    return str(value) if value is not None else 'Sin dato acreditado'
def build(catalogue_only=False):
    inv=read('inventario_base.json'); req=read('mapeo_requisitos.json');proc=read('control_procesos.json');met=read('medicion_controles.json')
    live=read('medicion_local_ejecutada.json');quality=read('calidad_actual.json');mobile=read('calidad_mobile_actual.json');acceptance=read('validacion_aceptacion.json');control_plan=read('plan_verificacion_completo.json')
    requirements=req['requirements'];nodes=proc['nodes'];uat=proc['uat']
    assert {x['id'] for x in requirements}=={x['id'] for x in inv['requirements']},'Requirement set differs'
    assert len(requirements)==135 and len({x['id'] for x in requirements})==135
    assert {x['id'] for x in nodes}=={n['id'] for p in inv['processes'] for n in p['nodes']},'Node set differs'
    assert len(nodes)==199 and len({x['id'] for x in nodes})==199
    assert {x['nodeId'] for x in control_plan['cases']}=={n['id'] for n in nodes}
    for node in nodes:node['supplementaryControlCaseId']='VCB-'+node['id']
    assert {x['id'] for x in uat}=={x['id'] for x in inv['uatTests']},'UAT set differs'
    assert len(met['metrics'])==5 and {m['code'] for m in met['metrics']}=={'IID','CHR','TDE','SUCCESS','ONTIME'}
    assert all(r.get('processIds') for r in requirements),'Requirement without process or transversal mapping'
    valid_procs={p['id'] for p in inv['processes']};valid_nodes={x['id'] for x in nodes};valid_uat={x['id'] for x in uat}
    errors=[]
    for r in requirements:
        for field,allowed in [('processIds',valid_procs),('nodeIds',valid_nodes),('uatIds',valid_uat)]:
            for item in r.get(field,[]):
                if item not in allowed:errors.append(f'{r["id"]}: unknown {field} {item}')
    for r in requirements+nodes+met['metrics']:
        for source in r.get('sourceFiles',[]):
            if not isinstance(source,dict):continue
            name=source.get('file');line=source.get('line')
            if not name:continue
            file=ROOT/name
            if not file.exists():errors.append(f'Unknown file {name}')
            elif line and not 1<=int(line)<=len(file.read_text(encoding='utf-8-sig').splitlines()):errors.append(f'Unknown line {name}:{line}')
    assert not errors,errors[:20]
    status={'at':datetime.now(timezone.utc).isoformat(),'scope':'LOCAL','structuralValidation':'PASS','requirements':len(requirements),'nodes':len(nodes),'uatCases':len(uat),'supplementaryNodeControlCases':199,'sequenceFlowsWithScenario':control_plan['summary']['sequenceFlowsWithScenario'],'screensAndComponents':len(inv['screens']),'endpoints':len(inv['endpoints']),'metrics':len(met['metrics']),'acceptanceRecorded':acceptance['acceptanceRecorded'],'businessAcceptedCases':acceptance['acceptedCases'],'limits':['Structural completeness is not implementation coverage or human acceptance.','Technical evidence references retain original dates and scenario scope.']}
    (OUT/'validacion_integral.json').write_text(json.dumps(status,ensure_ascii=False,indent=2),encoding='utf8')
    by_id={r['id']:r for r in requirements}
    for requirement in inv['requirements']:
        requirement['editorialBusinessMapping']=by_id[requirement['id']]
        requirement['editorialMappingSource']='docs/control_integral_20261022/mapeo_requisitos.json'
    resolved=[g for g in inv['gaps'] if g['kind']=='requirement_without_process_assignment' and by_id[g['requirementId']]['processIds']]
    inv['gaps']=[g for g in inv['gaps'] if g not in resolved]
    inv['resolvedEditorialMappingGaps']=resolved
    inv['summary']['gaps']=dict(Counter(g['kind'] for g in inv['gaps']))
    inv['summary']['editoriallyMappedRequirements']=len(requirements)
    inv['policy']['editorialMappingIsNotTechnicalAcceptance']=True
    inv['integrationInputs']=[{'file':'docs/control_integral_20261022/'+name,'sha256':hashlib.sha256((OUT/name).read_bytes()).hexdigest()} for name in ['mapeo_requisitos.json','control_procesos.json','medicion_controles.json','plan_verificacion_completo.json']]
    (OUT/'inventario_integrado.json').write_text(json.dumps(inv,ensure_ascii=False,indent=2),encoding='utf8')
    doc=Document();setup(doc)
    doc.add_paragraph('Control integral de EcoRoute','Title')
    para(doc,'Procesos trazabilidad medición y aceptación en entorno local','Subtitle')
    para(doc,'Grupo MICOTRANS SAC. Revisión del 22 de octubre de 2026, zona horaria America/Lima.')
    para(doc,'El expediente integra los nueve procesos del negocio con sus requisitos, pantallas, contratos, controles y casos de aceptación. La comprobación actual contrasta los indicadores con PostgreSQL y verifica el desarrollo local. Los vínculos permiten localizar el soporte de cada registro; no convierten una asociación estática en una prueba ejecutada.')
    para(doc,'La aceptación empresarial no está acreditada en este expediente: faltan la persona responsable, su cargo, la fecha y evidencia de la decisión. La solicitud de completar la aceptación se conserva, pero no se han precargado resultados ni firmas. El despliegue público queda fuera del alcance local confirmado.')
    para(doc,'El inventario integrado incorpora el mapeo editorial de los 26 requisitos antes sin asignación de proceso. Conserva el inventario del analizador como fuente y mantiene pendientes sus verificaciones técnicas: asignar un requisito a un proceso no demuestra que esté implementado o aceptado.')
    heading(doc,'Estado de control del proyecto',1)
    table(doc,['Elemento','Registros revisados','Criterio'],[
        ('Procesos y nodos BPMN',f'9 procesos y {len(nodes)} nodos','Cada nodo conserva actor, condiciones, final o continuidad y control.'),
        ('Requerimientos',f'{len(requirements)}: 81 RF y 54 RNF','Alcance específico o transversal y justificación trazable.'),
        ('Interfaz y API',f'{len(inv["screens"])} pantallas/componentes y {len(inv["endpoints"])} endpoints','Inventario de fuentes; no prueba automática de todos sus estados.'),
        ('Indicadores','IID CHR TDE SUCCESS ONTIME','Definición, población, filtro, fuente, meta y límites.'),
        ('Aceptación',f'{len(uat)} casos prescritos; {acceptance["acceptedCases"]} aceptaciones acreditadas','Exige una decisión empresarial identificada y respaldada.')],[1.35,1.9,3.4])
    heading(doc,'Estados que no deben confundirse',2)
    para(doc,'Trazado significa que existe una relación documentada entre IDs y fuentes. No acredita la ejecución de la rama ni la satisfacción de la empresa.')
    para(doc,'Una prueba técnica aprobada acredita el resultado del escenario citado en su entorno y fecha, no los casos UAT sin observar ni el uso en campo.')
    para(doc,'Un control humano definido identifica la decisión, la responsabilidad y la evidencia requerida. No demuestra que la decisión o comunicación ya haya ocurrido.')
    para(doc,'Una aceptación acreditada identifica la decisión de una persona sobre casos y evidencias concretos. El registro no certifica su firma ni verifica automáticamente sus facultades de representación.')
    heading(doc,'Comprobaciones ejecutadas el 22 de octubre',1)
    webout=next(c['stdout'] for c in quality['web'] if c['name']=='Tests web')
    import re
    webcount=re.findall(r'\btests\s+(\d+)',webout)[-1]
    table(doc,['Comprobación','Resultado','Alcance'],[
        ('API y SQL',f'{live["summary"]["passed"]} PASS; {live["summary"]["failed"]} FAIL','Tres poblaciones, fórmulas, estados y lecturas autorizadas. Sin escrituras de negocio.'),
        ('Java',str(quality['java']['summary']['tests'])+' pruebas; sin fallos, errores u omitidas','Incluye integración en PostgreSQL desechable.'),
        ('Consola web',webcount+' pruebas PASS; TypeScript y ESLint exit 0','Reglas del cliente y posición del panel de notificaciones.'),
        ('Flutter','Analyze PASS; 41 host PASS y 8 contratos PASS','Los ocho contratos omitidos en host se ejecutaron mediante una orden independiente.'),
        ('Teléfono físico','No ejecutado','Windows detecta Redmi Note 14 Pro+ 5G, pero ADB no tiene un dispositivo autorizado.')],[1.3,2.1,3.25])
    para(doc,'La compilación inicial encontró directorios generados bloqueados por OneDrive. Se repitió en build/verification_20261022, sin eliminar los archivos anteriores ni alterar las fuentes. El motor Docker estaba detenido; se arrancó el entorno vigente y se detuvo el backend antiguo autoarrancado que ocupaba el puerto 8081. No se eliminaron contenedores, datos ni volúmenes.')
    para(doc,'Las pruebas end to end, cámara, firma, recuperación offline y APK del 20 de octubre se conservan como evidencia histórica con su fecha y escenario. No se presentan como nuevas pruebas del 22 ni como aceptación de MICOTRANS.')
    heading(doc,'Medición conciliada con el origen de datos',1)
    for sample in live['samples']:
        heading(doc,sample['label'],2)
        table(doc,['KPI','Numerador','Denominador','Resultado %','Meta local','Estado'],[(k['code'],k['numerator'],k['denominator'],'Sin datos' if k['percentage'] is None else k['percentage'],'Sin meta' if k['target'] is None else k['target'],k['status']) for k in sample['filters']['kpis']],[.85,.9,1.1,1.2,1.0,1.6])
    para(doc,'Estas muestras incluyen registros y ensayos del entorno local. No son una línea base empresarial ni prueban mejora de MICOTRANS. Los numeradores y denominadores coinciden con las consultas SQL bajo los mismos filtros. Un denominador cero produce null y NO_DATA, no un cumplimiento de cero ni de cien por ciento.')
    heading(doc,'Ficha técnica de los cinco indicadores',1)
    for metric in met['metrics']:
        heading(doc,metric['code']+' '+metric['name'],2)
        para(doc,'Fórmula: '+plain(metric['formula']))
        para(doc,'Numerador: '+plain(metric['numerator']))
        para(doc,'Denominador: '+plain(metric['denominator']))
        para(doc,'Población y restricciones: '+plain(metric.get('exclusionsAndNulls',metric.get('limitations'))))
        para(doc,'Responsabilidad propuesta: '+plain(metric.get('ownerProposed')).rstrip('.')+'. Frecuencia propuesta: '+plain(metric.get('frequencyProposed')).rstrip('.')+'. Su configuración debe acordarse con la empresa.')
        para(doc,'Fuentes: '+', '.join(metric.get('sourceViews',metric.get('sourceTables',[]))))
    heading(doc,'Controles de calidad de la medición',2)
    para(doc,'Los controles siguientes definen qué contrastar y qué evidencia conservar. Su definición no acredita que cada condición haya sido ejecutada. El JSON distingue el informe técnico actual de las condiciones específicas todavía no ensayadas y de la aprobación empresarial.')
    table(doc,['ID','Regla','Criterio verificable'],[(c.get('code',c.get('id')),c['name'],c.get('acceptanceCriterion','Consultar ficha completa.')) for c in met['controls']],[.55,1.65,4.45])
    heading(doc,'Control de los nueve procesos del negocio',1)
    for process in inv['processes']:
        pid=process['id'];macro,actors,flow,exceptions=NARRATIVE[pid]
        heading(doc,pid+' '+process['name'],2)
        para(doc,'Agrupación: '+macro+'. Responsabilidades funcionales: '+actors+'. No se crean nuevos puestos ni se presume equivalencia entre jefatura y rol ADMIN.')
        para(doc,flow);para(doc,exceptions)
        related=[n for n in nodes if n['processId']==pid]
        related_req=[r for r in requirements if pid in r['processIds']]
        related_uat=[u for u in inv['uatTests'] if pid in u.get('processIds',[])]
        para(doc,f'Control de trazabilidad: {len(related)} nodos y {len(related_req)} requisitos relacionados. El detalle de cada condición, pantalla, función, contrato, registro y prueba está en el catálogo de control. La vinculación por proceso no acredita cada nodo individual.')
    heading(doc,'Control de aceptación y decisiones pendientes',1)
    para(doc,'El registro aceptacion.json separa solicitud, ejecutor, decisión, casos y archivos de soporte. check_acceptance.mjs valida identidad declarada, cargo, organización, fecha, IDs conocidos, reservas y hashes de adjuntos. Para una decisión global ACCEPTED exige identificar los 96 casos. Sin esos datos mantiene la aceptación no acreditada; el validador no certifica una firma ni autentica facultades empresariales.')
    para(doc,'Para registrar la aceptación se requiere la decisión real de MICOTRANS, no solamente aprobar el cierre técnico. Una aceptación con reservas debe identificar las reservas y el responsable de levantarlas. Los casos de documentación física, contacto con cliente, presupuesto, recepción y aptitud de recursos necesitan observación o registro humano aunque no exista una pantalla exclusiva.')
    para(doc,'El plan complementario define 199 controles por nodo y escenarios para los 212 flujos de secuencia. Cubre también las ramas y finales sin caso explícito en el listado de 96 UAT. Las rutas candidatas se derivan del grafo; su factibilidad de negocio debe revisarse antes de ejecutarlas. El generador no registra ninguna ejecución ni aceptación.')
    heading(doc,'Prueba física y conexión de Power BI',2)
    para(doc,'El usuario informa que Telecoms Client impide habilitar el modo desarrollador pese a haber completado el pago. La PC detecta el modelo por USB, pero no dispone de ADB autorizado. No se desinstaló ninguna aplicación, no se ejecutó root ni se restableció el dispositivo. La prueba de campo sigue sin ejecutarse hasta obtener acceso normal o utilizar otro equipo autorizado.')
    para(doc,'La FAQ oficial de Xiaomi sobre equipos con contrato describe restricciones de opciones de desarrollador y ADB y señala que las configuraciones del operador no se eliminan con un restablecimiento. Es orientación del fabricante, no una verificación del contrato concreto del usuario. Fuente: https://www.mi.com/my/support/faqs/xiaomi-operator-contract-devices/ consultada el 22 de octubre de 2026.')
    para(doc,'La consola web dispone de su módulo de inteligencia de negocio. Las vistas analíticas PostgreSQL y el script de lector dedicado permiten preparar un cliente externo. No se detectó Power BI Desktop en la ruta estándar comprobada y no se ha verificado una sesión real de ese cliente. La existencia de las vistas o un CSV no acredita un informe PBIX publicado. El despliegue público no se exige para este cierre local.')
    heading(doc,'Uso y ubicación del expediente completo',1)
    para(doc,'El catálogo docs/control_integral_20261022/index.html contiene las matrices completas de 135 requisitos, 199 nodos, 96 casos UAT, 34 pantallas/componentes y 68 endpoints. Permite buscar y filtrar sin enviar información a servicios externos. Los JSON conservan los campos completos y los informes históricos no se sobrescriben.')
    para(doc,'El manual integral, el informe académico, el guion y la presentación del cierre anterior siguen disponibles. Este documento complementa el control y la medición local del 22 de octubre; no reescribe resultados históricos ni convierte automáticamente sus estados pendientes en aprobaciones.')
    target=ROOT/'docs/correccion_integral/EcoRoute_Control_Integral_y_Aceptacion.docx'
    if not catalogue_only:doc.save(target)
    datasets={'requirements':requirements,'nodes':nodes,'uat':uat,'screens':inv['screens'],'endpoints':inv['endpoints'],'metrics':met['metrics'],'processes':proc['processes'],'measurementControls':met['controls'],'nodeControlCases':control_plan['cases']}
    serial=json.dumps(datasets,ensure_ascii=False).replace('<','\\u003c')
    page='''<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Control integral EcoRoute MICOTRANS</title><style>body{font:16px/1.55 Arial;margin:35px auto;max-width:1300px;padding:0 20px;color:#153047}h1,h2{color:#112d45}a{color:#185a86}nav{display:flex;gap:18px;flex-wrap:wrap;margin:20px 0}label{display:inline-flex;gap:10px;margin:10px 20px 10px 0}input,select,button{font:inherit;padding:8px}table{border-collapse:collapse;width:100%;margin:20px 0}td,th{border:1px solid #d9d9d9;padding:10px;vertical-align:top;text-align:left}th{background:#eaf1f5}details{margin:8px 0}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.5 Consolas,monospace}.controls{position:sticky;top:0;background:white;border-bottom:1px solid #d9d9d9;padding:8px 0}#count{font-weight:bold}</style><body><h1>Control integral de EcoRoute para MICOTRANS</h1><p>Revisión local del 22 de octubre de 2026. Trazabilidad completa no equivale a ejecución completa ni aceptación empresarial. La decisión de MICOTRANS no está acreditada en el expediente.</p><nav><a href="../correccion_integral/EcoRoute_Control_Integral_y_Aceptacion.docx">Informe de control</a><a href="../correccion_integral/index.html">Arquitectura y código completo</a><a href="medicion_local_ejecutada.json">44 controles API y SQL</a><a href="calidad_actual.json">Calidad actual</a><a href="calidad_mobile_actual.json">Flutter</a><a href="aceptacion.json">Registro de aceptación</a><a href="validacion_aceptacion.json">Validación de aceptación</a><a href="validacion_integral.json">Validación de matrices</a></nav><p>9 procesos · 199 nodos · 135 requisitos · 96 casos UAT · 34 pantallas/componentes · 68 endpoints · 5 KPI. Los valores de la BD incluyen ensayos y no demuestran resultados empresariales.</p><div class="controls"><label>Conjunto<select id="dataset"><option value="requirements">Requisitos</option><option value="nodes">Nodos BPMN</option><option value="uat">Casos UAT</option><option value="screens">Pantallas</option><option value="endpoints">API</option><option value="metrics">KPI</option></select></label><label>Buscar<input id="query" type="search" placeholder="ID proceso control función estado"></label><label>Proceso<select id="process"><option value="">Todos</option>'''+''.join(f'<option>{p["id"]}</option>' for p in inv['processes'])+'''</select></label><p id="count"></p></div><table><thead><tr><th>Identificador</th><th>Descripción y relación completa</th></tr></thead><tbody id="rows"></tbody></table><script id="data" type="application/json">'''+serial+'''</script><script>const data=JSON.parse(document.getElementById('data').textContent);const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));function render(){const key=document.getElementById('dataset').value,q=document.getElementById('query').value.toLowerCase(),p=document.getElementById('process').value;const rows=data[key].filter(r=>{const text=JSON.stringify(r).toLowerCase();return(!q||text.includes(q))&&(!p||text.includes(p.toLowerCase()))});document.getElementById('count').textContent=rows.length+' de '+data[key].length+' registros. Asociaciones y resultados se leen con su alcance individual.';document.getElementById('rows').innerHTML=rows.map(r=>'<tr><td>'+esc(r.id||r.code||r.name||'Registro')+'</td><td><strong>'+esc(r.name||r.title||r.actor||'Detalle')+'</strong><details><summary>Ver condiciones controles código evidencia y límites</summary><pre>'+esc(JSON.stringify(r,null,2))+'</pre></details></td></tr>').join('')}document.querySelectorAll('input,select').forEach(e=>e.addEventListener('input',render));render();</script></body></html>'''
    page=page.replace('<option value="requirements">Requisitos</option>','<option value="requirements">Requisitos</option><option value="processes">Procesos y controles de negocio</option><option value="measurementControls">Controles de medición</option>')
    page=page.replace('<option value="uat">Casos UAT</option>','<option value="uat">Casos UAT</option><option value="nodeControlCases">Plan complementario por nodo</option>')
    page=page.replace('<a href="validacion_integral.json">Validación de matrices</a>','<a href="validacion_integral.json">Validación de matrices</a><a href="inventario_integrado.json">Inventario integrado</a><a href="plan_verificacion_completo.json">199 controles y 212 flujos</a>')
    (OUT/'index.html').write_text(page,encoding='utf8')
    print(json.dumps({'docx':str(target),'validation':status},ensure_ascii=False))
if __name__=='__main__':build(catalogue_only='--catalogue-only' in sys.argv)
