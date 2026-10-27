"""Curate original screenshots and observed checks for the exposition guide."""
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
RUN=ROOT/'docs/guia_total_ide/ejecucion_20261026'
def read(name): return json.loads((RUN/name).read_text(encoding='utf-8-sig'))
web=read('web/captures.json')
qa=read('capture_qa.json')
drop=set(qa['DROP'])
relabel={
 'v2_pedido_importacion.jpg':('Formulario inicial de importación CSV: plantilla y botón de validación, sin archivo seleccionado ni importación confirmada.','inicio de importación'),
 'v2_despacho_mapa.jpg':('Backlog de pedidos pendientes con revisión comercial y selectores de ruta; no se realiza una asignación adicional.','backlog y asignación'),
 'v2_final_bi_kpis.jpg':('BI final del 26/10/2026: IID66.67% (2/3), CHR/TDE/SUCCESS33.33% (1/3) y ONTIME100% (1/1). Las metas administrativas no están configuradas.','indicadores finales'),
 'v2_final_bi_causas.jpg':('Continuación de Causas: motivos de incidencias y eventos por fuente; complementa los gráficos superiores de la misma vista.','causas continuación'),
 'v2_final_bi_eficiencia.jpg':('Continuación de Eficiencia: minutos por parada terminal y tabla de calidad GPS; complementa los gráficos superiores.','eficiencia continuación'),
 'v2_despacho_iniciado.jpg':('Revisión aprobada y aceptada, geometría OSRM y paradas IN_TRANSIT tras iniciar el despacho de la ruta22.','mapa durante la ejecución'),
}
selected=[]
seen=set()
def add(item):
 p=ROOT/item['file']
 if not p.is_file(): raise ValueError('Missing original: '+str(p))
 digest=hashlib.sha256(p.read_bytes()).hexdigest()
 if digest in seen: return
 seen.add(digest)
 selected.append({**item,'sha256':digest})
for row in web:
 name=Path(row['file']).name
 if row['screenId']=='W13' and not name.startswith('v2_final_bi_'): continue
 if row['screenId']=='W02' and not name.startswith('v2_final_inicio_'): continue
 if name in ('v2_final_bi_acciones.jpg','v2_final_bi_metas_inferior.jpg','v2_final_bi_eficiencia_superior.jpg','v2_final_bi_causas_superior.jpg'): continue
 if row['file'] in drop and name not in relabel: continue
 if name in relabel:
  row={**row,'caption':relabel[name][0],'state':relabel[name][1]}
 add(row)
mobile=[
 ('M01','m01_actual','Acceso móvil real sin credenciales visibles.','sin sesión'),
 ('M02','m02_hoy','Ruta22 de hoy con tres paradas y propuesta por calles OSRM.','planificada'),
 ('M02','m02_revision_hoy','Hoja aprobada por administración, antes de la aceptación del conductor.','revisión superior'),
 ('M02','m02_aceptacion_control','Continuación de la revisión con observaciones y botón de aceptación.','control de aceptación'),
 ('M02','m02_aceptada','Aceptación registrada por el servidor desde la cuenta del conductor.','aceptada'),
 ('M02','m02_en_curso','Los mismos pedidos48,49,50 en tránsito después del despacho web.','en ejecución'),
 ('M03','m03_detalle','Detalle móvil de pedido48 antes de confirmar el POD.','detalle'),
 ('M03','m03_estados','Estados disponibles para la parada en tránsito.','alternativas'),
 ('M03','m03_formulario_pod','Formulario POD superior: entrega seleccionada y foto obligatoria.','POD superior'),
 ('M03','m03_camara','Cámara virtual del emulador usada para evidencia sintética.','cámara'),
 ('M03','m03_foto_adjunta','Foto de ensayo adjunta al pedido, todavía sin envío al servidor.','foto adjunta'),
 ('M03','m03_firma_trazo','Receptor y firma sintéticos antes de confirmar su captura.','receptor y firma'),
 ('M03','m03_pod_listo','Firma guardada y datos preparados; todavía falta confirmar remotamente.','POD preparado'),
 ('M03','m03_offline_guardado','Evidencia de pedido48 guardada sin conexión; el estado remoto aún no está confirmado.','offline pendiente'),
 ('M06','m06_pendiente','Cola privada con el POD48 pendiente de confirmación del servidor.','pendiente'),
 ('M02','m02_tras_sincronizar','Tras recuperar red y reautenticar al mismo conductor, pedido48 aparece entregado.','sincronizado'),
 ('M03','m03_fallo_motivo','No entrega de pedido49 con motivo sintético de ausencia; debe enviarse con conexión.','excepción ausencia'),
 ('M03','m03_devolucion_motivo','Devolución de pedido50 por rechazo del destinatario, con motivo registrado.','excepción devolución'),
 ('M02','m02_final_recorrido','Ruta22 COMPLETED: un entregado, un fallido y un devuelto; no equivale a tres entregas exitosas.','resultado final'),
 ('M04','m04_historial_jornada','Historial real con los tres resultados de la jornada del 26/10/2026.','historial final'),
 ('M05','m05_retorno','Perfil cargado del conductor efectivo, vínculo1, licencia y contacto local de ensayo.','perfil cargado'),
 ('M06','m06_final_sin_pendientes','Comprobación final de cero evidencias pendientes tras sincronizar el POD.','cola final vacía'),
]
for sid,name,caption,state in mobile:
 add({'screenId':sid,'file':f'docs/guia_total_ide/ejecucion_20261026/mobile/{name}.png','caption':caption,'state':state,'at':read(f'mobile/{name}.json')['at']})
for name,caption in [
 ('backend_breakpoint','VS Code Java: pausa real en OrderController.java línea41 con id49 recibido; después se retiró el breakpoint y se reanudó.'),
 ('react_debugger','VS Code React: Orders.tsx abierto, depurador del navegador conectado y consola Vite conectada.'),
 ('flutter_debugger','VS Code Dart: fuente routes_page.dart y Call Stack pausada desde F6; posteriormente F5 reanudó la aplicación.')]:
 add({'screenId':'IDE','file':f'docs/guia_total_ide/ejecucion_20261026/ide/{name}.jpg','caption':caption,'state':'depuración real'})
selected.sort(key=lambda r:r.get('at','9999'))
for i,row in enumerate(selected,1): row['sequence']=i
final=read('business_final.json')
if final['status']!='PASS': raise ValueError('Business verification must pass before authoring.')
checks=[{'name':c['name'],'status':c['status'],'details':'Comprobación GET/SQL de solo lectura registrada en business_final.json para ruta22 y pedidos48–50.'} for c in final['checks']]
checks.extend([
 {'name':'OFFLINE_BEFORE_SYNC','status':'PASS','details':'business_offline.json: pedido48 IN_TRANSIT, POD404 y ruta22 IN_PROGRESS mientras m06_pendiente muestra evidencia local pendiente.'},
 {'name':'FLUTTER_PENDING_QUEUE_FINAL','status':'PASS','details':'m06_final_sin_pendientes.json y captura: cero pendientes. La sesión larga requirió reautenticar al mismo conductor; su evidencia privada se conservó.'},
 {'name':'IDE_DART_PAUSE_AND_RESUME','status':'PASS','details':'Main comprobó F6, Call Stack Paused on pause y ContinueF5 en VS Code; después F5 devolvió PauseF6 y la app continuó. Fuente temporal SHA256 verificada; sin hot reload desde original.'},
 {'name':'IDE_REACT_VITE_CONNECTED','status':'PASS','details':'react_debugger.jpg muestra componente React y consola Vite connected con depurador de Chrome. No se acredita aquí una pausa en breakpoint JavaScript.'},
 {'name':'AUTH_REFRESH_REGRESSION','status':'PASS','details':'Revisión delegada de Aquinas:9/9 pruebas de auth-session.test.mjs, TypeScript y lint correctos. Identidad conservada solo durante revalidación del mismo subject; errores/cambio de usuario invalidan.'},
 {'name':'HOME_FULL_SCREEN_SCROLL','status':'PASS','details':'DOM real después de corregir overflow: contenido1363px, área1000px y scrollTop363; capturas superior e inferior muestran todos los accesos.'},
 {'name':'GPS_DISTANCE_LIMITATION','status':'WARN','details':'La ruta22 tiene un intervalo GPS superior a900s durante la sesión larga: distanciaGPS no evaluable. El tiempo de operación incluye pausas de exposición y no acredita productividad real.'},
 {'name':'PLAN_AND_PREVIEW_ORIGIN','status':'WARN','details':'El plan guardado al despacho es8.53km. La propuesta recalculada desde otro origen GPS se mostró3.19km; es GET/path de consulta, no modificación del plan histórico.'},
 {'name':'MOBILE_TRANSIENT_RETRY','status':'PASS','details':'Primer envío de FAILED mostró interrupción de conexión. Se reintentó y se verificó un único cambio de estado e incidente14; no se oculta esta recuperación ni se asume que todo envío inicial funcionó.'},
 {'name':'PHYSICAL_FIELD_TEST','status':'NOT_RUN','details':'Se utilizó EcoRoute_QA emulator-5556 con foto, firma y GPS sintéticos. No se acredita piloto de campo, sensores de teléfono físico ni aceptación empresarial.'},
])
security=read('security_check.json')
checks.append({'name':security['name'],'status':security['status'],'details':f"GET /orders sin credenciales respondió HTTP{security['httpStatus']} en el backend desde fuentes."})
fixture={k:read('fixture.json')[k] for k in ('date','timezone','synthetic','routeId','driverId','vehicleId','orderIds','tracking')}
fixture.update({'incidentId':[14,15],'actionId':8})
manifest={
 'at':datetime.now(timezone.utc).isoformat(),'runId':'ejecucion_20261026','fixture':fixture,
 'runtime':{'backend':'Java17 Gradle bootRun, profiles local,ide, HTTP8081, JDWP5005','web':'Vite3000 desde web-admin con proxyAPI8081','mobile':'APK debug9006 desde copia fuente SHA256 verificada en EcoRoute_QA emulator-5556; adaptadorDart directo','ide':'Tres workspacesVSCode con Java,React/Chrome yDart. InfraestructuraDocker separada; contenedoresappdetenidos.'},
 'screens':selected,'checks':checks,
 'proofFiles':['runtime_verification.json','business_offline.json','business_final.json','security_check.json','mobile/source_copy_verification.json'],
 'scope':'Prueba académica local sintética. No constituye UAT empresarial, validación legal del POD ni prueba de campo.',
}
(RUN/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'screens':len(selected),'screenIds':len({r['screenId'] for r in selected if r['screenId']!='IDE'}),'checks':len(checks),'businessStatus':final['status']},ensure_ascii=False))
