import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {constants as fsConstants} from 'node:fs';
import {composeSpeakerNotes} from './deck_speaker_notes.mjs';
import {pathToFileURL} from 'node:url';
import {Presentation,PresentationFile} from 'file:///C:/Users/USUARIO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs';
import {Canvas,loadImage} from 'file:///C:/Users/USUARIO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/node_modules/skia-canvas/lib/index.mjs';

// Authoring is deliberately confined to the requested PPT QA directory.
const root=process.cwd();
const base=path.join(root,'docs/correccion_integral');
const qa=path.join(base,'_qa/ppt');
const build=path.join(qa,'build');
const revision=process.argv.find(v=>v.startsWith('--revision='))?.split('=')[1]??'02';
const skill='C:/Users/USUARIO/.codex/plugins/cache/openai-primary-runtime/presentations/26.1015.12040/skills/presentations';
const runtime='C:/Users/USUARIO/.cache/codex-runtimes/codex-primary-runtime/dependencies';
process.env.RUNTIME_NODE=path.join(runtime,'node/bin/node.exe');
process.env.RUNTIME_NODE_MODULES=path.join(runtime,'node/node_modules');
process.env.RUNTIME_PYTHON=path.join(runtime,'python/python.exe');
process.env.RUNTIME_BIN_DIR=path.join(runtime,'bin/override');
const reference=path.join(root,'docs/presentacion_capitulo2/final/EcoRoute_Capitulo_2_Diseno_BPMN_Formal_v4.pptx');
const final=path.join(base,'EcoRoute_Arquitectura_y_Flujos_Verificados.pptx');
await fs.mkdir(build,{recursive:true});
await fs.mkdir(path.join(qa,'slides'),{recursive:true});
const read=async file=>fs.readFile(path.join(base,file),'utf8');
const manual=await read('Manual_Pantallas_y_Codigo.md');
const inv=JSON.parse(await read('inventario_trazabilidad.json'));
const erd=JSON.parse(await read('diagramas/erd_verificado_manifest.json'));
const api=JSON.parse(await read('evidencias/regresion_api.json'));
const quality=JSON.parse(await read('evidencias/calidad_final.json'));
const webTestOutput=quality.web.find(check=>check.name==='Web unit tests')?.stdout??'';
const webTestCount=Number([...webTestOutput.matchAll(/(?:^|\n)[^\n]*\btests\s+(\d+)/g)].at(-1)?.[1]??0);
if(!webTestCount)throw new Error('Missing web test summary');
const javaV15=JSON.parse(await read('evidencias/calidad_java_v15.json'));
const mobileQuality=JSON.parse(await read('evidencias/calidad_mobile.json'));
const testCount=name=>Number([...mobileQuality.commands.find(c=>c.name===name).stdout.matchAll(/\+(\d+)/g)].at(-1)?.[1]??0);
const hostTests=testCount('Flutter host tests'),contractTests=testCount('Flutter real backend contract');
const mobileRun=JSON.parse(await read('evidencias/prueba_emulador_offline.json'));
const webDir='capturas/web/WEB-1792482508091/';
const web=JSON.parse(await read(webDir+'results.json'));
const C={navy:'#112D45',teal:'#007F78',blue:'#2563A6',ink:'#173047',muted:'#58708A',bg:'#FBFBF8',line:'#D4DFE6',pale:'#EEF5F4',orange:'#A4512B'};
const p=Presentation.create({slideSize:{width:1280,height:720}});
p.theme.defaultFont='Arial';
const evidence=[],tables=[];
function text(s,value,x,y,w,h,size=24,color=C.ink,bold=false,name=''){
 const sh=s.shapes.add({geometry:'textbox',name:name||value.slice(0,40),position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});
 sh.text=value;sh.text.style={typeface:'Arial',fontSize:size,color,bold,verticalAlignment:'top',wrap:'square',insets:0};return sh;
}
function rule(s,x,y,w,color=C.line){s.shapes.add({geometry:'line',position:{left:x,top:y,width:w,height:0},line:{fill:color,width:1.2}});}
function slide(title,section,source='',note=''){
 const s=p.slides.add();s.background.fill=C.bg;
 text(s,section.toUpperCase(),74,34,1070,22,13,C.teal,true,'section');
 text(s,title,74,73,1135,66,36,C.navy,true,'slide-title');
 text(s,String(p.slides.items.length).padStart(2,'0'),1192,34,35,20,13,C.muted,true,'page');
 if(source)text(s,source,74,681,1135,24,13,C.muted,false,'source-caption');
 s.speakerNotes.text=`EcoRoute / MICOTRANS. Revisión técnica local al 20 de octubre de 2026. Aceptación empresarial pendiente.\n${note}\nFuentes: ${source}\nRaíz del repositorio: ${root}`;
 evidence.push({slide:p.slides.items.length,title,source});return s;
}
function block(s,title,body,x,y,w,h=160,size=24){const narrow=w<400;text(s,title,x,y,w,narrow?74:35,25,C.teal,true);text(s,body,x,y+(narrow?85:44),w,h,size);}
function table(s,headers,rows,widths,{top=164,height=430,size=22,left=74,width=1132}={}){
 const values=[headers,...rows];const t=s.tables.add({rows:values.length,columns:headers.length,left,top,width,height,values,columnWidths:widths});
 t.borders.assign({fill:C.line,width:.7,style:'solid'});
 t.cells.block({row:0,column:0,rowCount:values.length,columnCount:headers.length}).assign({textStyle:{typeface:'Arial',fontSize:size,color:C.ink},margins:{left:12,right:12,top:6,bottom:6},anchor:'center'});
 for(let r=0;r<values.length;r++){
  t.rows[r].height=r===0?48:(height-48)/(values.length-1);
  for(let c=0;c<headers.length;c++){
   const cell=t.getCell(r,c);cell.fill=r===0?C.navy:r%2===0?'#F1F5F5':'#FFFFFF';
   cell.text.style={typeface:'Arial',fontSize:size,color:r===0?'#FFFFFF':C.ink,bold:r===0,verticalAlignment:'middle'};
  }
 }
 tables.push(p.slides.items.length);return t;
}
function box(s,label,x,y,w,h,color=C.pale){
 const sh=s.shapes.add({geometry:'roundRect',position:{left:x,top:y,width:w,height:h},fill:color,line:{fill:C.teal,width:1.3},borderRadius:9,name:label.slice(0,35)});
 sh.text=label;sh.text.style={typeface:'Arial',fontSize:22,color:C.ink,bold:true,alignment:'center',verticalAlignment:'middle',insets:12};return sh;
}
function connect(s,a,b){return s.shapes.connect(a,b,{kind:'straight',fromSide:'right',toSide:'left',line:{fill:C.blue,width:2},tail:{type:'arrow',width:'med',length:'med'}});}
function flow(s,steps,{x=74,y=178,w=1132,h=92}={}){
 const gap=26,bw=(w-gap*(steps.length-1))/steps.length;let prev;
 steps.forEach((v,i)=>{const b=box(s,v,x+i*(bw+gap),y,bw,h);if(prev)connect(s,prev,b);prev=b;});
}
async function image(s,rel,x,y,w,h,crop){
 let bytes=await fs.readFile(path.join(base,rel));let src=await loadImage(bytes);
 if(crop){const canvas=new Canvas(crop.width,crop.height);canvas.getContext('2d').drawImage(src,crop.left,crop.top,crop.width,crop.height,0,0,crop.width,crop.height);bytes=await canvas.toBuffer('png');src=await loadImage(bytes);}
 const f=Math.min(w/src.width,h/src.height);const iw=src.width*f,ih=src.height*f;
 s.images.add({blob:bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),contentType:'image/png',alt:rel,fit:'contain',position:{left:x+(w-iw)/2,top:y+(h-ih)/2,width:iw,height:ih}});
}
const canonical=n=>`docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/${n}_negocio.bpmn`;
function processNotes(id){const start=manual.indexOf(`### 2.${Number(id.slice(1))}. ${id}:`);const end=manual.indexOf('\n### ',start+1);return manual.slice(start,end<0?manual.indexOf('\n## 3.',start):end);}
const processes=[
 {id:'P01',title:'Confirmar pedidos',actors:'Dispatcher y cliente solicitante',steps:['Recibir y revisar\nA1–A4','Validar ubicación\ny cobertura A5–A7','Comunicar y acordar\nA8, A8b, G7','Registrar pedido\nA9, E4 a P02'],cond:'G1–G2: corregir datos o no admitir.\nG3–G4: aclarar ubicación o declarar inviabilidad.\nG5–G7: proponer alternativa y obtener conformidad.',ends:'E1 No admitida. E2 No viable. E3 Desistimiento.\nE4 Pedido para P02. El borrador técnico PENDING conserva el mismo ID.',limit:'Confirmación comercial: dirección, cobertura y aceptación son tres declaraciones independientes. RUC opcional de 11 dígitos, sin validación SUNAT.'},
 {id:'P02',title:'Preparar la jornada de reparto',actors:'Dispatcher, Jefatura logística y Conductor',steps:['Demanda y recursos\nA1–A4','Asignación y revisión\nA5–A9','Autorización y hoja\nA10–A13','Inicio de reparto\nA14, E4 a P03'],cond:'G1–G2: ajustar recursos o conservar cartera.\nG3: corregir asignación sin despachar.\nG4–G5: revisar viabilidad y aprobación. G6–G7: sustituir o suspender.',ends:'E1 Otra fecha. E2 Asignación pendiente.\nE3 Jornada suspendida. E4 Ruta IN_PROGRESS. ADMIN aprueba y DRIVER acepta su propia hoja.',limit:'El peso declarado debe caber en capacityKg. Cambiar asignación o acuerdo invalida revisiones. OSRM calcula recorrido vial, sin tráfico ni óptimo global garantizado.'},
 {id:'P03',title:'Ejecutar entregas',actors:'Conductor, receptor y Dispatcher',steps:['Tomar parada\ny contactar A1–A5','Entregar y capturar\nA6–A10','Revisar y sincronizar\nA11–A13','Repetir o cerrar\nG7, E6 a P05'],cond:'G1–G3: acceso, receptor y aceptación.\nG4–G5: completar u observar el POD.\nG6: comprobar sincronización. G7: continuar con la siguiente parada.',ends:'E1 Impedimento. E2 Ausencia. E3 Rechazo.\nE4 POD observado. E5 Pendiente de sincronizar: retornos a P04. E6 Resultados para P05.',limit:'DELIVERED requiere POD válido en servidor. Captura local pendiente no confirma entrega. La revisión humana del Dispatcher no añade un segundo endpoint de aprobación.'},
 {id:'P04',title:'Resolver incidencias',actors:'Conductor, Dispatcher y Jefatura logística',steps:['Describir y sustentar\nA1–A4','Evaluar alternativas\nA5, G3','Coordinar solución\nA6–A7, G4–G5','Cerrar con autoridad\nA8 o retornar'],cond:'G1–G2: completar evidencia y evaluar lo disponible.\nG3–G4: recuperación hoy con acuerdo y recursos.\nG5: nueva fecha viable o cierre fallido autorizado.',ends:'E1 Recuperación en P03. E2 Nueva jornada en P02.\nE3 Cierre fallido en P05. RETRY/REPLAN crean un nuevo intento y conservan el original.',limit:'REPLAN deja ventana nula y aceptación retirada. CLOSE_FAILED exige ADMIN y pedido fallido/devuelto. CLOSE_CASE conserva el POD y no crea otro intento.'},
 {id:'P05',title:'Evaluar resultados',actors:'Dispatcher y Jefatura logística',steps:['Consolidar y validar\nA1–A3, G1–G2','Comparar metas\nA4–A6, G3','Proponer y ejecutar\nA7–A10, G4','Medir y estandarizar\nA11–A12, G5'],cond:'G1–G2: corregir fuente o emitir cierre provisional.\nG3: buena práctica o análisis de desvío.\nG4: aprobar acción. G5: revisar hipótesis si no resulta efectiva.',ends:'E1 Cierre provisional. E2 Buena práctica.\nE3 Cierre y estandarización. OPEN, IN_PROGRESS y VERIFIED conservan la decisión declarada.',limit:'VERIFIED exige ejecución previa, resultado, nota y ADMIN. BI calcula observaciones. Una cifra registrada en la acción no prueba causalidad empresarial.'},
 {id:'P06',title:'Habilitar recursos de reparto',actors:'Jefatura logística, Administrador y Dispatcher',steps:['Definir necesidad\ny documentos A1–A3','Verificar aptitud\nA4–A5, G3','Registrar y revisar\nA6–A8, G4','Liberar recurso\nA9, E4 a P02'],cond:'G1–G2: subsanar información o archivar.\nG3: aptitud documental y física.\nG4: disponibilidad del día o programación futura.',ends:'E1 Archivo. E2 Bloqueo informado.\nE3 Programación futura. E4 Recurso para P02. CRUD y reserva diaria apoyan la selección.',limit:'isActive representa estado. La UI no certifica vigencia de licencia, SOAT, mantenimiento ni expediente documental. Las tablas ampliadas no implican formularios operativos.'},
 {id:'P07',title:'Supervisar la jornada',actors:'Conductor, Dispatcher y Jefatura logística',steps:['Compartir avance\nA1–A3, G1–G2','Comparar ventana\nA4, G3','Confirmar y escalar\nA5–A7, G4','Continuar o cerrar\nG5, E3 a P05'],cond:'G1–G2: recuperar datos recientes o registrar pérdida.\nG3: confirmar causa de demora.\nG4: decidir intervención. G5: continuar mientras la ruta siga activa.',ends:'E1 Pérdida de seguimiento hacia P04.\nE2 Intervención hacia P04. E3 Fin de jornada para P05. El Dispatcher interpreta la evidencia.',limit:'GPS conserva muestras, no acredita llamadas ni decisiones. WebSocket requiere JWT y vehículo permitido. La consulta HTTP de respaldo debe distinguirse del canal en vivo.'},
 {id:'P08',title:'Administrar accesos',actors:'Jefatura logística, Administrador y solicitante',steps:['Justificar acceso\nA1, G1','Definir privilegio\nA3, G2','Crear o ajustar\ny comprobar A5–A7','Activar o revocar\nA4, A8'],cond:'G1: la Jefatura autoriza o rechaza.\nG2: baja o ajuste de acceso.\nG3: verificar permisos y corregir antes de comunicar activación.',ends:'E1 Solicitud rechazada. E2 Acceso revocado.\nE3 Activación comunicada. El cargo empresarial no asigna ADMIN automáticamente.',limit:'La pantalla modifica roles/habilitación de identidades existentes en Keycloak. El alta completa de personas queda fuera de ese panel. Escrituras legacy POST/DELETE retornan 410.'},
 {id:'P09',title:'Registrar compras operativas',actors:'Dispatcher, Administrador y Jefatura logística',steps:['Necesidad y stock\nA1–A3, G1','Costo y autorización\nA4–A6, G2–G3','Compra y recepción\nA7–A8, G4','Registrar compra\nA9, E4 a P06'],cond:'G1: existencia disponible evita compra.\nG2–G3: autorización o ajuste/cancelación.\nG4: conformidad física o reclamo/devolución.',ends:'E1 Entrega de recurso existente. E2 Cancelación.\nE3 Reclamo. E4 Registro para P06. Presupuesto y recepción requieren respaldo humano.',limit:'El CRUD conserva proveedor, monto, categoría, estado y notas. Seleccionar APPROVED registra un valor. No ejecuta aprobación presupuestaria, stock automático ni comprobante binario.'}
];

// 01
{
const s=p.slides.add();s.background.fill=C.navy;
text(s,'ECOROUTE  /  MICOTRANS',82,67,1030,30,18,'#B8D4E4',true);
text(s,'Arquitectura y flujos\nverificados',82,159,1120,196,58,'#FFFFFF',true,'cover-title');
text(s,'Corrección integral del capítulo 2\ny del recorrido de extremo a extremo',85,432,1040,90,29,'#DCE8EF');
text(s,'Revisión del 20 de octubre de 2026\nDesarrollo implementado. Aceptación empresarial pendiente.',85,606,1100,64,20,'#B8D4E4');
s.speakerNotes.text='Revisión nueva basada en el diseño de EcoRoute_Capitulo_2_Diseno_BPMN_Formal_v4.pptx, 56 láminas. Arial, 1280×720, portada azul marino, páginas claras, acento verde. Fuentes del repositorio vigentes, no demostración de UAT empresarial aprobada.';
evidence.push({slide:1,title:'Arquitectura y flujos verificados',source:reference});
}
// 02
{
const s=slide('Alcance y estado de la revisión','Panorama','Manual de pantallas, inventario y manifiestos de ejecución',`Inventario generado: ${inv.generatedAt}. Snapshot consistente: ${inv.snapshot.consistent}. ${JSON.stringify(inv.summary)}. Las asociaciones estáticas no equivalen a ejecuciones. Evidencia API: ${api.executedAt}. Evidencia web: ${web.executedAt}.`);
block(s,'Diseño de negocio','9 procesos BPMN en 6 gestiones.\n81 RF y 54 RNF en el inventario.\nLas personas deciden y EcoRoute registra.',74,170,520,166);
block(s,'Implementación actual','Web React, móvil Flutter y un backend modular.\nReglas de confirmación, despacho, POD,\nexcepciones, identidad y analítica.',675,170,530,166);
rule(s,74,408,1132);
text(s,'49/49',74,438,300,70,53,C.teal,true);text(s,'casos API locales PASS',74,516,340,50,24);
text(s,'25/25',480,438,300,70,53,C.teal,true);text(s,'casos web PASS, 69 capturas',480,516,350,70,24);
text(s,'Pendiente',900,445,300,62,42,C.orange,true);text(s,'UAT real de MICOTRANS\ny piloto en campo',900,516,300,82,24);
}
// 03
{
const s=slide('Seis gestiones, nueve procesos BPMN','2.1 Negocio','Agrupación de capítulo 2 y NARRATIVE de build_integrated_documents.py','La agrupación de seis gestiones se toma de NARRATIVE y de la referencia. El manual desarrolla nueve fichas de trabajo, que no sustituyen esta agrupación expositiva. Las lanes corresponden a personas. PMBOK gobierna el proyecto y BPMN describe la operación.');
const rows=[['Gestión de pedidos','P01','Confirmación comercial'],['Gestión de recursos logísticos','P06','Recursos habilitados para planificar'],['Gestión de operaciones de reparto','P02, P03, P04, P07','Planificación, entrega, excepciones y supervisión'],['Gestión del desempeño logístico','P05','Evaluación y acciones'],['Gestión de seguridad de acceso','P08','Accesos efectivos'],['Gestión de compras','P09','Registro de compras operativas']];
table(s,['Gestión','BPMN','Resultado / soporte'],rows,[440,200,492],{height:440,size:23});
text(s,'Dispatcher prepara. Conductor ejecuta. Administrador mantiene. Jefatura autoriza y evalúa.',74,625,1130,38,23,C.teal,true);
}
// 04–12 One readable summary per canonical BPMN, with complete branches in notes.
for(const d of processes){
const s=slide(`${d.id}  ${d.title}`,'2.1 Procesos BPMN',`${canonical(d.id)}  ·  Síntesis por etapas, condiciones y finales`,processNotes(d.id)+'\nNARRATIVE: tools/audit_e2e/build_integrated_documents.py');
text(s,d.actors,74,143,1130,34,22,C.muted);
flow(s,d.steps,{y:198,h:88});
block(s,'Condiciones y retornos',d.cond,74,322,550,155,23);
block(s,'Finales y continuidad',d.ends,675,322,530,155,23);
rule(s,74,533,1132);
text(s,d.limit,74,557,1132,96,24,C.ink);
}
// 13
{
const s=slide('Pedido, confirmación y despacho','Reglas transversales','Manual §§6–7 · BusinessWorkflowService · OrderUseCasesImpl · RouteUseCasesImpl','Endpoints: POST /orders; PATCH /orders/{id}/business-data; PATCH /orders/{id}/route; POST /routes/{id}/review; POST /routes/{id}/acceptance; PATCH /routes/{id}/status; PATCH /orders/{id}/delivery-window. Cambiar ventana retira customerAccepted y revisión, preservando RUC y verificaciones de dirección/cobertura.');
flow(s,['PENDING\nsin ruta','Confirmación\ncompleta','ASSIGNED\nen PLANNED','Revisión ADMIN\ny aceptación DRIVER','IN_PROGRESS\nIN_TRANSIT'],{y:168,h:103});
table(s,['Control','Regla real'],[['Alta y confirmación','Dos peticiones. Un fallo de confirmación conserva el ID del alta.'],['Asignación','Pedido confirmado, recursos activos y reserva diaria sin conflicto.'],['Salida','Ruta no vacía, peso dentro de capacidad y controles vigentes.'],['Cambio de ventana','PENDING/ASSIGNED y ruta PLANNED. Renueva aceptación y revisiones.'],['Entrega','PATCH manual no admite DELIVERED. La entrega requiere POD válido.']],[260,872],{top:311,height:325,size:22});
}
// 14
{
const s=slide('Arquitectura hexagonal y modular real','Arquitectura','arquitectura_corregida.svg · src/main/java/com/ecoroute/backend/','Un servicio backend desplegable con separación dominio/aplicación/adaptadores, no microservicios por módulo. Arquitectura canónica: docs/correccion_integral/diagramas/arquitectura_corregida.svg y PNG. React 19, TypeScript/Vite, Nginx; Flutter BLoC/Dio; Spring Boot WebFlux; R2DBC/PostgreSQL 14; Redis; OSRM; SDK AWS para S3 y SQS.');
const a=box(s,'React\nREST y WebSocket',74,167,293,105);
const b=box(s,'Flutter\nREST, GPS y cola por cuenta',74,302,293,105);
const c=box(s,'Adaptadores de entrada\nREST, WebSocket y seguridad',429,167,350,92);
const d=box(s,'Aplicación y dominio\nCasos de uso, servicios,\npolíticas y puertos',429,298,350,130);
const e=box(s,'Adaptadores de salida\nR2DBC, Redis, OSRM, AWS',429,467,350,92);
const f=box(s,'PostgreSQL 14\nNegocio y vistas BI',854,167,352,100);
const g=box(s,'Redis y OSRM\nGPS, revocación y recorrido',854,307,352,100);
const h=box(s,'S3 y SQS\nEvidencias y eventos',854,447,352,100);
connect(s,a,c);connect(s,b,c);s.shapes.connect(c,d,{fromSide:'bottom',toSide:'top',line:{fill:C.blue,width:2},tail:{type:'arrow'}});s.shapes.connect(d,e,{fromSide:'bottom',toSide:'top',line:{fill:C.blue,width:2},tail:{type:'arrow'}});connect(s,e,h);for(const to of [f,g])s.shapes.connect(e,to,{kind:'elbow',fromSide:'right',toSide:'left',line:{fill:C.blue,width:2},tail:{type:'arrow'}});
text(s,'Un backend modular desplegable. Keycloak proporciona identidad a web y móvil.\nEl backend valida JWT, rol y pertenencia del recurso.',74,591,1130,70,24,C.teal,true);
}
// 15
{
const s=slide('Detalle de datos: pedido y POD','Persistencia real','02_pedidos_evidencias.svg · catálogo físico · selección legible de campos','Detalle editable seleccionado desde esquema_fisico_verificado.json y erd_verificado_manifest.json. El diagrama canónico conserva todos los campos. orders y delivery_proofs son dos objetos de los 30. delivery_proofs.order_id es FK y UNIQUE. Arquitectura modular: OrderUseCasesImpl, RouteUseCasesImpl, BusinessWorkflowService, CreateDeliveryProofUseCaseImpl, BusinessOperationsService, DashboardService, OperationalAccess y DeliveryEventWorker. R2dbcBusinessWorkflowAdapter, R2dbcBusinessOperationsAdapter y R2dbcAnalyticsAdapter implementan puertos. No son microservicios independientes.');
text(s,'delivery_proofs.order_id referencia orders.id y limita el POD a uno por pedido.',74,143,1132,36,25,C.teal,true);
table(s,['orders','Tipo / clave'],[['id','bigint · PK'],['route_id','bigint · FK'],['tracking_number','varchar(255)'],['status','varchar(50)'],['delivery_address','text'],['latitude / longitude','numeric(10,8)/(11,8)'],['stop_sequence','integer']],[300,242],{left:74,width:542,top:204,height:387,size:21});
table(s,['delivery_proofs','Tipo / clave'],[['id','bigint · PK'],['order_id','bigint · FK, UNIQUE'],['image_url / signature_data_url','text'],['receiver_name / receiver_dni','varchar(255) / (20)'],['image_sha256 / signature_sha256','varchar(64)'],['captured_at / received_at','timestamptz'],['latitude / longitude','numeric(10,8)/(11,8)']],[320,222],{left:664,width:542,top:204,height:387,size:18});
text(s,'El POD conserva captura y recepción. El historial de estados y el outbox registran efectos separados.',74,620,1132,44,24,C.muted);
}
// 16
{
const s=slide('Identidad efectiva y separación de datos','Keycloak','secuencia_identidad.svg · Manual §§4,13,18 · drivers.external_id','Fuente canónica: docs/correccion_integral/diagramas/secuencia_identidad.svg. Web: Authorization Code + PKCE. Móvil actual: password grant configurado. Backend valida firma, issuer, expiración, revocación, roles y vínculo del subject. H2 local de Keycloak en volumen keycloak_data separado. auth_* legacy no gobierna permisos.');
flow(s,['Web PKCE\nMóvil credenciales','Keycloak\nrealm ecoroute','JWT validado\ny /session/me','Rol + pertenencia\ndel recurso'],{y:178,h:94});
s.shapes.add({geometry:'connector',kind:'straight',position:{left:496,top:306,width:292,height:0},line:{fill:C.blue,width:1.5},head:{type:'arrow'}});
text(s,'Backend: JWKS y API Admin',500,278,375,25,18,C.blue,true);
block(s,'Identidad','Keycloak guarda cuentas y roles.\nH2 local en keycloak_data.\nEl backend usa sub validado y\nlo enlaza a drivers.external_id.',74,317,535,210);
block(s,'Administración','Usuarios ajusta identidades existentes.\nCambio de rol/habilitación revoca sesiones\ny deja auditoría. Las cuentas técnicas\ny el auto retiro de ADMIN se protegen.',675,317,530,210);
text(s,'PostgreSQL guarda negocio. El enlace de identidad es lógico y no crea una FK entre bases.',74,588,1132,64,26,C.teal,true);
}
// 17
{
const s=slide('Secuencia de preparación y salida','P01 y P02','secuencia_pedido_despacho.svg · endpoints de pedido y revisión de ruta','Fuente canónica: docs/correccion_integral/diagramas/secuencia_pedido_despacho.svg y PNG. La secuencia original de once mensajes se resume aquí en seis interacciones. No son once transacciones independientes ni una única transacción distribuida.');
table(s,['Paso','Petición / responsable','Efecto comprobable'],[['1','POST /orders · Dispatcher','PENDING e historia, sin asignación'],['2','PATCH /orders/{id}/business-data','Aceptación, dirección, cobertura y actor'],['3','PATCH /orders/{id}/route','Mismo pedido ASSIGNED en ruta PLANNED'],['4','POST /routes/{id}/review · ADMIN','Controles, peso y aprobación vigentes'],['5','POST /routes/{id}/acceptance · DRIVER','Aceptación del dueño de la ruta'],['6','PATCH /routes/{id}/status','IN_PROGRESS, actual_start_time,\norden vial y pedidos IN_TRANSIT']],[90,530,512],{height:452,size:22});
}
// 18
{
const s=slide('POD: captura, integridad y confirmación','P03','secuencia_pod.svg · CreateDeliveryProofUseCaseImpl · V9/V14','Fuente canónica: docs/correccion_integral/diagramas/secuencia_pod.svg. CreateDeliveryProofUseCaseImpl valida PNG/JPEG, GPS válido no cero, nombre, DNI, captura no futura y estado IN_TRANSIT. S3Service sube archivos privados. ProofIntegrityPort conserva hashes SHA256 y hora de captura/recepción. Bloqueo de pedido y restricciones únicas resuelven reenvíos.');
flow(s,['Captura completa\nen Flutter','Cola durable\npor cuenta','POST\n/delivery-proofs','POD y DELIVERED\nen PostgreSQL'],{y:175,h:92});
block(s,'Datos exigidos','Foto y firma confirmada.\nNombre y DNI válido de 8 dígitos.\nGPS reciente y hora de captura.\nServidor conserva hashes y recepción.',74,317,530,205);
block(s,'Efecto único','El servidor bloquea el pedido.\nUn reenvío devuelve el POD existente.\nDELIVERED, historia y outbox forman\nparte de la operación de negocio.',675,317,530,205);
text(s,'S3 queda fuera de la transacción PostgreSQL. El flujo no garantiza rollback distribuido de objetos.',74,590,1130,65,24,C.orange,true);
}
// 19
{
const s=slide('Offline e idempotencia del POD','Móvil','ProofSync · LocalCache · Manual §§20–21','LocalCache usa FlutterSecureStorage, claves v2_ por subject y JSON. Copia bytes Base64, no solo rutas temporales. mutate serializa escrituras y enqueue evita otro pendiente del pedido. ProofSync usa una ejecución por cuenta, reintenta con proceso activo, al reanudar y al restablecer sesión. El header Idempotency-Key del cliente no es por sí solo el mecanismo del servidor.');
text(s,'Secuencia real del emulador. Pedido 27: IN_TRANSIT offline y DELIVERED tras reconectar.',74,145,1132,40,24,C.teal,true);
const frames=[['1  Guardado offline','m06_offline_pendiente.png',{left:0,top:1200,width:1080,height:900},'Los bytes y la captura\npermanecen en la cuenta.'],['2  Cola privada','m07_cola_offline.png',{left:0,top:0,width:1080,height:900},'El servidor aún conserva\nIN_TRANSIT y ningún POD.'],['3  Tras force-stop','m08_cola_tras_reinicio.png',{left:0,top:0,width:1080,height:900},'Reabrir conserva\nel pendiente completo.'],['4  Reconexión','m09_sincronizada.png',{left:0,top:0,width:1080,height:650},'Cero pendientes y un\nPOD confirmado en BD.']];
for(const [i,[label,file,crop,caption]] of frames.entries()){const x=74+i*290;text(s,label,x,208,266,36,22,C.teal,true);await image(s,'capturas/mobile/'+file,x,255,266,275,crop);text(s,caption,x,549,266,62,20);}
text(s,'Sincroniza con proceso activo o al reanudar. El sistema operativo puede detener la app.',74,628,1132,35,23,C.orange,true);
s.speakerNotes.text+='\nEjecución real: evidencias/prueba_emulador_offline.json, 13 PASS y 0 FAIL. Las capturas m06/m07/m08/m09 corresponden al mismo fixture sintético. 4xx permanentes salvo 401,408,429. No existe la misma cola para PATCH de no entrega ni GPS. Force-stop no prueba trabajo en background.';
}
// 20
{
const s=slide('Excepciones sin reabrir la historia','P04','secuencia_excepciones.svg · BusinessOperationsService.resolve · V10/V13','Fuente canónica: docs/correccion_integral/diagramas/secuencia_excepciones.svg. El servicio bloquea incidencia, pedido y ruta. Repetir mismo outcome conserva resultado, outcome diferente causa conflicto. RETRY y REPLAN enlazan order_attempts; el original FAILED/RETURNED permanece. REPLAN deja ventanas nulas y customerAccepted=false.');
table(s,['Resolución','Precondición','Resultado'],[['RETRY','Original FAILED/RETURNED\ny jornada IN_PROGRESS','Nuevo pedido IN_TRANSIT\nen la misma jornada'],['REPLAN','Ruta destino PLANNED','Nuevo ASSIGNED. Nueva ventana,\nreconfirmación y revisión de salida'],['CLOSE_FAILED','ADMIN y original fallido/devuelto','Cierre definitivo autorizado,\nsin transformar un DELIVERED'],['CLOSE_CASE','ADMIN y caso general/disputa','Cierra incidencia conservando\npedido/POD, sin crear intento']],[210,435,487],{height:390,size:24});
text(s,'order_attempts enlaza original, incidencia e intento. La auditoría identifica al actor de la resolución.',74,591,1132,64,25,C.teal,true);
}
// 21
{
const s=slide('GPS, recorrido y supervisión','P07','secuencia_gps.svg · GpsBloc · GpsController · RoutePlannerService','Fuente canónica: docs/correccion_integral/diagramas/secuencia_gps.svg. Flutter envía con contexto de ruta IN_PROGRESS y GPS válido/reciente. Backend verifica conductor y vehículo. Redis PubSub y WebSocket distribuyen puntos. /ws/gps usa primer frame con vehicleId y accessToken. Polling web de respaldo cada cinco segundos. OSRM no incorpora tráfico en vivo ni garantiza óptimo global.');
flow(s,['Sensor Flutter\n+ ruta activa','POST /gps/ping\nidentidad y vehículo','Historial PostgreSQL\ny Redis PubSub','WebSocket con JWT\no respaldo HTTP'],{y:175,h:98});
block(s,'Recorrido','GET /routes/{id}/path usa OSRM.\nLa geometría distingue fuente vial\ny alternativa por segmentos.\nNo promete hora exacta de llegada.',74,321,535,205);
block(s,'Supervisión','El mapa muestra muestra y tiempo.\nPérdida de señal exige contacto humano.\nUn punto aislado no confirma entrega\nni justifica por sí solo una sanción.',675,321,530,205);
text(s,'Distancia real: Haversine de muestras suficientes dentro del intervalo efectivo de la ruta.',74,594,1132,58,24,C.teal,true);
}
// 22
{
const s=slide('Eventos y recuperación de evidencias','Durabilidad','Manual §24 · DeliveryEventWorker · S3Service · V14','LocalStack pierde contenido S3 tras restart pese a volumen. application-docker.yml habilita aws.s3.local-durable-backup:true. Default/producción false. EvidenceBackupPort y R2dbcEvidenceBackupAdapter conservan bytes en local_evidence_backups después de upload S3 exitoso. Lectura intenta S3 y solo ante error recupera copia local. No genera evidencia ni admite primera carga si S3 falló. Worker publica SQS, reenvía sin notificación y consume con unicidad.');
block(s,'Entrega y notificación','La transacción registra delivery_outbox.\nEl worker publica a SQS y reintenta\nhasta observar notificación persistida.\nConsumo idempotente en notifications.',74,173,535,190);
block(s,'Archivos en desarrollo','LocalStack pierde objetos al reiniciar.\nV14 respalda bytes en PostgreSQL\ntras una carga S3 exitosa. La lectura\nusa el respaldo si S3 falla.',675,173,530,190);
rule(s,74,427,1132);
text(s,'Docker local: true',74,461,530,56,32,C.teal,true);text(s,'Producción por defecto: false',675,461,530,56,32,C.orange,true);
text(s,'No sustituye un servicio S3 durable.\nNo rescata una primera carga rechazada.',74,527,530,84,24);
text(s,'Publicado no significa consumido.\nConsumido no significa leído por una persona.',675,527,530,84,24);
}
// 23
{
const s=slide('Núcleo del ERD y alcance vigente','2.4 Datos','erd_verificado_manifest.json · 00_erd_negocio_global.svg · detalle en cuatro dominios','ERD de negocio con 30 objetos: 26 tablas y 4 vistas, 27 FK exportadas desde catálogo PostgreSQL 14.21. Exportación física tiene 46 objetos. 16 excluidos: 15 legacy/corporativos y local_evidence_backups de soporte técnico. Keycloak usa H2 separado en entorno Docker local y vínculo lógico vía drivers.external_id. No se dibujan FK inferidas por coincidencia de nombres. Se muestra un subconjunto editable de siete objetos, no se afirma dibujar aquí las 27 FK. Cardinalidad padre a hijo. route_dispatch_reviews y delivery_proofs únicos por route_id/order_id. Diagrama canónico 00_erd_negocio_global.svg y cuatro dominios detallados.');
text(s,'30 objetos de negocio: 26 tablas y 4 vistas. El catálogo acredita 27 FK físicas.',74,142,1132,36,25,C.teal,true);
const dr=box(s,'drivers\nPK id',74,211,230,85);
const ve=box(s,'vehicles\nPK id',74,372,230,85);
const ro=box(s,'routes\nPK id\nFK driver_id, vehicle_id',421,211,300,111);
const od=box(s,'orders\nPK id\nFK route_id',421,435,300,111);
const rr=box(s,'route_dispatch_reviews\nFK / UNIQUE route_id',839,211,367,85);
const dp=box(s,'delivery_proofs\nFK / UNIQUE order_id',839,390,367,85);
const bd=box(s,'order_business_data\nPK / FK order_id',839,527,367,85);
connect(s,dr,ro);s.shapes.connect(ve,ro,{kind:'elbow',fromSide:'right',toSide:'left',line:{fill:C.blue,width:2},tail:{type:'arrow'}});
s.shapes.connect(ro,od,{kind:'straight',fromSide:'bottom',toSide:'top',line:{fill:C.blue,width:2},tail:{type:'arrow'}});
connect(s,ro,rr);s.shapes.connect(od,dp,{kind:'elbow',fromSide:'right',toSide:'left',line:{fill:C.blue,width:2},tail:{type:'arrow'}});s.shapes.connect(od,bd,{kind:'elbow',fromSide:'right',toSide:'left',line:{fill:C.blue,width:2},tail:{type:'arrow'}});
text(s,'1 : N',333,224,75,28,19,C.blue,true);text(s,'1 : N',333,390,75,28,19,C.blue,true);text(s,'1 : N',595,360,75,28,19,C.blue,true);
text(s,'1 : 0..1',738,224,100,28,19,C.blue,true);text(s,'1 : 0..1',738,395,100,28,19,C.blue,true);text(s,'1 : 0..1',738,568,100,28,19,C.blue,true);
text(s,'Keycloak H2 separado. drivers.external_id es un vínculo lógico de identidad, sin FK entre bases.',74,632,1132,36,23,C.muted);
}
// 24
{
const s=slide('Los 30 objetos del ERD de negocio','2.4 Datos','Manifiesto ERD: 26 tablas + 4 vistas · 27 FK · desglose canónico por dominios',`Objetos completos: ${Object.keys(erd.objects).join(', ')}. FK físicas: ${JSON.stringify(erd.foreignKeys)}. Diagramas detallados: 01_recursos_planificacion.svg, 02_pedidos_evidencias.svg, 03_incidencias_mejora.svg, 04_analitica_catalogos.svg. Existencia de tabla no acredita interfaz ni proceso documental implementado.`);
table(s,['Dominio','Objetos físicos (sin repetir)'],[['Recursos y planificación · 10','drivers, driver_contracts, driver_shifts, vehicles, vehicle_maintenance_logs,\nfuel_logs, vehicle_gps_history, routes, route_dispatch_reviews, route_expenses'],['Pedido y evidencia · 8','orders, order_business_data, order_items, products, delivery_proofs,\norder_status_history, delivery_outbox, notifications'],['Excepción y decisión · 4','incidents, order_attempts, improvement_actions, business_audit_events'],['Catálogos y metas · 4','hubs, purchases, analytics_goals, analytics_goal_history'],['Vistas de lectura · 4','analytics_order_facts, analytics_route_facts,\nanalytics_goal_facts, analytics_goal_history_facts']],[325,807],{height:440,size:20});
s.speakerNotes.text+='\nLos vínculos lógicos y las dependencias de vistas no se cuentan como nuevas FK. El espacio inferior queda libre para el margen de expansión de tabla nativa.';
}
// 25–29 Five actual analytical views, each given a full readable slide.
const dashboards=[
 {name:'Cumplimiento',image:'bi_Cumplimiento.png',crop:{left:286,top:425,width:1130,height:675},heading:'Poblaciones del KPI',body:'IID usa todos los pedidos.\nCHR y TDE usan programados.\nSUCCESS usa todos los pedidos.\nONTIME usa entregas evaluables.',limit:'TDE exige foto O firma. POD completo exige ambos y metadatos. Denominador cero = null.'},
 {name:'Tendencias',image:'bi_Tendencias_scroll1100.png',crop:{left:287,top:146,width:1126,height:452},heading:'Serie diaria y metas',body:'Conductor y fechas inclusivas.\nFecha operativa en America/Lima.\nLos huecos permanecen sin dato.\nLa serie usa la meta vigente.',limit:'El historial de metas existe. La tendencia no reconstruye la meta histórica de cada día.'},
 {name:'Causas',image:'bi_Causas_scroll1100.png',crop:{left:665,top:294,width:370,height:391},heading:'Eventos registrados',body:'Separa STATUS_HISTORY e INCIDENT.\nCuenta eventos registrados.\nEl análisis humano determina\nrelevancia y causa del desvío.',limit:'Un evento no equivale a un pedido distinto ni prueba causalidad. La decisión continúa en P05.'},
 {name:'Eficiencia',image:'bi_Eficiencia_scroll1100.png',crop:{left:287,top:15,width:1127,height:389},heading:'Plan, GPS y operación',body:'GPS exige muestras suficientes.\nKm por entrega usa DELIVERED.\nMin/parada usa terminales:\nDELIVERED, FAILED y RETURNED.',limit:'V15: 60 min / 3 terminales = 20 min/parada en prueba aislada. Captura anterior a V15.'},
 {name:'Calidad de datos',image:'bi_Calidad_de_datos_scroll1100.png',crop:{left:287,top:143,width:1127,height:452},heading:'Controles de calidad',body:'Revisión de identificación,\nubicación y metadatos del POD.\nLas observaciones pueden compartir\nel mismo pedido de origen.',limit:'POD completo en metadatos no prueba disponibilidad del objeto S3. Las cifras son del entorno local.'}
];
for(const d of dashboards){
 const s=slide(`BI  ${d.name}`,'2.3 Cinco vistas analíticas',`Captura web real WEB-1792482508091 · /bi · GET /reports/bi`, `Captura: ${webDir+d.image}. No son resultados empresariales MICOTRANS. Fuente de cálculo: tools/audit_e2e/analytics_api_contract.json, DashboardService, R2dbcAnalyticsAdapter y V12__analytics_views.sql. ${d.limit} Secuencia canónica: docs/correccion_integral/diagramas/secuencia_bi.svg. Metas y Acciones P05 son dos pestañas de gestión adicionales, no otras dos vistas analíticas.`);
 await image(s,webDir+d.image,74,157,744,448,d.crop);
 block(s,d.heading,d.body,857,168,350,190,23);
 rule(s,857,461,350);
 text(s,d.limit,857,483,350,165,22,C.orange);
 text(s,'Captura del backend local. Datos de prueba y registros del entorno, sin inferencia de mejora empresarial.',74,620,745,45,17,C.muted);
 if(d.name==='Eficiencia'){s.speakerNotes.text+='\nV15__analytics_returned_terminal.sql reemplaza la definición de analytics_route_facts e incluye RETURNED. calidad_java_v15.json acredita PASS de toda la suite y de returnedOrdersCountAsTerminalStopsWithoutChangingSharedSeed. No añade tablas ni cambia las 27 FK. La captura anterior se mantiene como evidencia de interfaz. La fórmula vigente es V15.';}
}
// 30
{
const s=slide('Pantallas web: operación y decisiones','2.2 y 2.3 Interfaces','web-admin/src/App.tsx · Manual W01–W06 · Inventario de trazabilidad','Cada pantalla conserva código editable en su aplicación, fuera del alcance de esta presentación. W01 Login.tsx / Keycloak; W02 Home.tsx; W03 Orders.tsx / CreateOrder, BusinessEditor, DeliveryWindowEditor, OrderAssignment, OrderDetail, ProofImage y CSV preview/import; W04 Routes.tsx / CreateRouteForm, ReviewPanel, RouteTracking; W05 Incidents.tsx / IncidentForm, ResolutionForm; W06 components/ImprovementActions.tsx / ActionForm y ActionUpdate. Capturas reales 25/25 PASS y 69 imágenes en WEB-1792482508091.');
table(s,['Pantalla / ruta','BPMN y controles principales','Contrato servidor'],[['W01 Login · /login','P08. PKCE, callback y sesión efectiva','Keycloak y GET /session/me'],['W02 Inicio · /','Navegación según rol','/session/me, rutas del cliente'],['W03 Pedidos · /orders','P01/P02/P03/P04. Alta, CSV, acuerdo,\nventana, asignación, estado, POD y PDF','/orders, /orders/*,\n/delivery-proofs/*'],['W04 Rutas · /routes','P02/P07. Crear, aprobar, despachar,\nhoja, mapa y seguimiento','/routes, /routes/*,\n/gps/history/*, /ws/gps'],['W05 Incidencias · /incidents','P04. Reportar y resolver con autoridad','/incidents, /*/resolution'],['W06 Acciones · /improvement-actions','P05. Causa, responsable, resultado\ny verificación autorizada','/improvement-actions']],[295,490,347],{height:456,size:21});
}
// 31
{
const s=slide('Pantallas web: recursos, accesos y análisis','2.2 y 2.3 Interfaces','Manual W07–W14 · App.tsx · servicios REST y componentes comunes','W07 pages/Dashboard.tsx; W08 pages/Drivers.tsx; W09 pages/Vehicles.tsx; W10 pages/Users.tsx; W11 pages/Purchases.tsx; W12 pages/Reports.tsx; W13 pages/BusinessIntelligence.tsx; W14 AuthenticatedLayout, ProtectedRoute, Sidebar y NotificationPanel. Trece páginas concretas y un contenedor, no catorce páginas de negocio. Dashboard/Reports/BI solo ADMIN en UI. Compras UI ADMIN y filtro backend ADMIN/DISPATCHER: diferencia explícita.');
table(s,['Pantalla / ruta','Soporte y endpoint principal'],[['W07 Dashboard · /dashboard','P05/P06. Resumen y flota. GET /dashboard/*'],['W08 Conductores · /drivers','P06. CRUD /drivers. La habilitación documental sigue siendo humana.'],['W09 Vehículos · /vehicles','P06. CRUD /vehicles. Capacidad e isActive no certifican SOAT.'],['W10 Usuarios · /users','P08. /users/identities y roles Keycloak. Legacy solo consulta.'],['W11 Compras · /purchases','P09. CRUD /purchases. Registro de estado sin circuito presupuestario.'],['W12 Reportes · /reports','P05. /reports/orders-summary, driver-performance, route-efficiency.'],['W13 BI · /bi','P05. /reports/bi, /reports/goals/* y acciones. Cinco vistas y dos gestiones.'],['W14 Contenedor · /* y *','P08 transversal. Guardas, menú y /notifications/*.']],[345,787],{height:468,size:21});
}
// 32
{
const s=slide('Seis pantallas principales del Conductor','2.2 y 2.3 Móvil','app_router.dart · router_route_refresh_test.dart · Manual M01–M06','Las seis rutas requieren sesión excepto login. Detalle valida state.extra y coincidencia de ID. Enlace incompleto muestra un mensaje y retorno a Mis rutas sin hard cast que lance excepción, sin afirmar carga autónoma por ID. El refresco de rutas retira selección, revisión y GPS de una ruta ya cerrada. router_route_refresh_test.dart comprueba guardas y refresco. La captura móvil documenta la misma UI. Historial no usa endpoint dedicado ni caché equivalente a POD.');
await image(s,'capturas/mobile/m05_pod_firma.png',74,156,245,464);
table(s,['Pantalla','Proceso, función y API'],[['M01 /login','P08. AuthBloc, Keycloak y /session/me.'],['M02 /routes','P02/P03/P07. Rutas propias, aceptación,\npedidos, /routes/{id}/path y /gps/ping.'],['M03 /orders/:id','P03/P04. Captura POD, firma, receptor, GPS.\n/delivery-proofs o PATCH de no entrega.'],['M04 /sync','P03. ProofSync, pendientes/rechazos\ny reintento de /delivery-proofs.'],['M05 /history','P03/P05. GET /routes y /orders propios,\nperiodos 7/30/90 días.'],['M06 /profile','P06/P08. Datos del conductor,\nGET /drivers/{id}, tema y logout.']],[220,619],{left:367,width:839,top:165,height:456,size:21});
text(s,'Captura real de cámara y firma del fixture sintético. La UAT empresarial sigue pendiente.',74,630,1132,36,20,C.muted);
}
// 33 Mobile evidence and two remaining main screens, with readable detail crops.
{
const s=slide('Móvil: cierre verificable e identidad propia','Evidencia del emulador','prueba_emulador_offline.json · m10_historial.png · m11_perfil.png',`Fixture sintético en ${mobileRun.device}. ${JSON.stringify(mobileRun.summary)}. Pedido 27 y ruta 11. Offline y reinicio: servidor IN_TRANSIT y POD 404. Reconexión: DELIVERED, cola vacía, POD autorizado 200, count=1, GPS -12.046304/-77.0427024 y hashes de foto/firma coincidentes con PostgreSQL. ${mobileRun.verifierCorrection}. El archivo previo con dos fallos pertenece al verificador que pidió campos no expuestos por DTO, no acredita un fallo de producto. Historial y perfil son capturas visuales y no añaden casos a los 13 PASS. Fuentes de arquitectura, seis secuencias y BPMN canónicos se conservan en notas por lámina.`);
text(s,'Historial: resultado del mismo pedido',74,164,560,36,24,C.teal,true);
await image(s,'capturas/mobile/m10_historial.png',74,212,530,354,{left:0,top:0,width:1080,height:840});
text(s,'Perfil: identidad y recurso vinculado',655,164,550,36,24,C.teal,true);
await image(s,'capturas/mobile/m11_perfil.png',655,212,550,354,{left:0,top:555,width:1080,height:1160});
text(s,'13 / 13 PASS',74,587,340,52,34,C.teal,true);
text(s,'Un POD, GPS conservado y hashes de foto/firma coincidentes.\nPrueba técnica en emulador, sin reparto empresarial real.',430,586,776,76,24);
}
// 34
{
const s=slide('Pruebas técnicas y alcance de la evidencia','Verificación','regresion_api.json · calidad_final.json · resultados web y prueba_emulador_offline.json',`API ${JSON.stringify(api.summary)} ejecutada ${api.executedAt}. Java ${JSON.stringify(quality.java.summary)}. Web checks ${JSON.stringify(quality.web.map(c=>({name:c.name,exitCode:c.exitCode})))}. Web real ${JSON.stringify(web.summary)}. 25 Flutter comunicadas en la tarea: sin manifiesto actual localizado al construir el deck. No se suma un supuesto +8 de integración sin archivo de ejecución. Los tests de integración que sí constan en calidad_final forman parte del total Java 57, no se duplican. Evidencia histórica del 19/10 conserva fallos y no se presenta como validación vigente. No se ejecutan nuevas pruebas de aplicación durante esta tarea de presentación.`);
table(s,['Evidencia','Resultado localizado','Límite'],[['Regresión API','49 PASS / 49 casos','Datos y recursos sintéticos aislados'],['Java con V15',`${javaV15.java.summary.tests} pruebas, 0 fallos / errores`,'Integración incluida en el total.\nLa UAT se valida por separado.'],['Web estática y unitarias',`TypeScript y ESLint exit 0.\n${webTestCount} pruebas PASS`,'Contratos y lógica localizada'],['Web con backend real','25 PASS / 25 casos, 69 capturas','Recorrido del manifiesto.\nNo es un piloto empresarial.'],['Móvil / Flutter',`${hostTests} host PASS + ${contractTests} contrato PASS.\nEmulador: 13 PASS / 13 casos.`,'POD real, reinicio y reconexión.\nSincroniza con proceso activo.'],['UAT empresarial','96 escenarios prescritos','PENDIENTE de ejecución y acta real']],[275,397,460],{height:455,size:20});
s.speakerNotes.text=s.speakerNotes.text.split('25 Flutter comunicadas')[0]+`Cierre vigente: calidad_java_v15.json ${javaV15.java.summary.tests} pruebas Java sin fallos ni errores. calidad_mobile.json acredita analyze PASS, ${hostTests} pruebas host PASS y ${contractTests} pruebas opt-in de contrato con backend real PASS. La ejecución host omite las opt-in y la siguiente orden las ejecuta, sin sumar skipped como PASS. No se duplica integración Java. No equivale a UAT empresarial.`;
s.speakerNotes.text+='\nActualización de cierre: evidencias/prueba_emulador_offline.json acredita 13 PASS y 0 FAIL. Los dos fallos del verificador anterior se conservan en archivo y fueron corregidos comparando hashes de BD. No se suman a fallos del producto. Referencia de ejecución móvil distinta de Flutter unitarias.';
}
// 35
{
const s=slide('Validación humana y límites pendientes','Cierre','Plan_Pruebas_Usuario.md · Acta_UAT_Plantilla.md · Manual §§23–25','Pendientes empresariales: acuerdos comerciales reales, inspección de carga y documentos, recepción física y conformidad, protocolos de pérdida GPS, prueba en teléfonos objetivo, durabilidad de almacenamiento, redes intermitentes y revocación. Power BI requiere conexión, refresco y publicación verificados. La base histórica CSV y contrato actual tienen diferencias de población y fórmulas. No hay evidencia para afirmar mejora causal ni UAT aprobada.');
block(s,'MICOTRANS','Ejecutar 96 escenarios con responsables.\nGuardar IDs, estados, respuesta y captura.\nAcordar metas y protocolos de excepción.\nFirmar acta solo con usuarios reales.',74,170,535,210);
block(s,'Operación y plataforma','Probar en dispositivos y red de campo.\nConfirmar POD tras reinicio y reenvío.\nUsar almacenamiento durable en producción.\nValidar conexión y refresco de Power BI.',675,170,530,210);
rule(s,74,440,1132);
text(s,'Desarrollo implementado y evidencias locales disponibles',74,475,1132,62,32,C.teal,true);
text(s,'La aceptación empresarial y la atribución de resultados requieren el piloto.\nLos registros de recursos y compras conservan decisiones y comprobaciones humanas.',74,555,1132,87,25);
}

if(p.slides.items.length!==35)throw new Error('Expected exactly 35 slides');
for(const [index,s] of p.slides.items.entries())s.speakerNotes.text=composeSpeakerNotes(index+1,s.speakerNotes.text);
const candidate=path.join(build,`candidate-${revision}.pptx`);
await (await PresentationFile.exportPptx(p)).save(candidate);
console.log('CANDIDATE',candidate);
for(const [i,s] of p.slides.items.entries()){
 const stem=`slide-${String(i+1).padStart(2,'0')}`;
 await fs.writeFile(path.join(qa,'slides',stem+'.png'),new Uint8Array(await (await p.export({slide:s,format:'png',scale:1})).arrayBuffer()));
 await fs.writeFile(path.join(qa,'slides',stem+'.layout.json'),await (await s.export({format:'layout'})).text());
 console.log('RENDER',i+1);
}
await fs.writeFile(path.join(qa,'coverage.json'),JSON.stringify({slideCount:35,slides:evidence,requiredNativeTableOwnerSlides:[...new Set(tables)],limits:['Artifact previews, not PowerPoint application validation','BI screenshots predate V15; corrected formula is documented with integration evidence','Enterprise UAT pending'],sourceSnapshot:{inventory:inv.generatedAt,api:api.executedAt,web:web.executedAt,quality:quality.capturedAt,javaV15:{status:javaV15.status,...javaV15.java.summary},flutter:{hostTests,contractTests,finishedAt:mobileQuality.finishedAt},erd:erd.generatedAtUtc,mobile:mobileRun.summary},mobileEvidence:'evidencias/prueba_emulador_offline.json',mobileVerifierCorrection:mobileRun.verifierCorrection},null,2));
const montage=await p.export({format:'webp',montage:true});
await fs.writeFile(path.join(qa,'montage.webp'),new Uint8Array(await montage.arrayBuffer()));
if(!process.argv.includes('--final')){console.log('DRAFT_READY: use --final after visual review');process.exit(0);}
const {finalizePresentation}=await import(pathToFileURL(path.join(skill,'container_tools/artifact_tool_utils.mjs')).href);
const referenceSha256=crypto.createHash('sha256').update(await fs.readFile(reference)).digest('hex');
const validatedDir=path.join(qa,'validated');await fs.mkdir(validatedDir,{recursive:true});
const validated=path.join(validatedDir,`revision-${revision}.pptx`);
const tableOwners=[...new Set(tables)];
// OneDrive on this host rejects hard links. Preserve the finalizer's exclusive
// publication and hash checks, falling back to an exclusive copy only here.
const originalLink=fs.link;let usedCopyFallback=false;
fs.link=async(source,destination)=>{
 try{return await originalLink(source,destination);}
 catch(error){if(error.code!=='EPERM'||path.dirname(source)!==validatedDir||destination!==validated)throw error;usedCopyFallback=true;return fs.copyFile(source,destination,fsConstants.COPYFILE_EXCL);}
};
let finalResult;
try{finalResult=await finalizePresentation({workspaceDir:root,candidatePath:candidate,finalPath:validated,pythonExecutable:path.join(runtime,'python/python.exe'),integrityValidatorPath:path.join(skill,'container_tools/inspect_presentation_package_integrity.py'),layoutValidatorPath:path.join(skill,'container_tools/inspect_presentation_layout_geometry.py'),layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-bullet-geometry','--validate-heading-fit',...tableOwners.flatMap(n=>['--require-native-table-slide',String(n)])],explicitTotalSlideCount:35,requiredNativeTableOwnerSlides:tableOwners,requiredNativeChartOwnerSlides:[],fontPolicy:{basis:'reference',families:['Arial'],referencePath:reference,referenceSha256},verifyArtifactToolImport:true,receiptPath:path.join(qa,`validation-${revision}.json`)});}
finally{fs.link=originalLink;}
const previous=JSON.parse(await fs.readFile(path.join(qa,'delivery.json'),'utf8'));
if(crypto.createHash('sha256').update(await fs.readFile(final)).digest('hex')!==previous.sha256)throw new Error('Final file changed outside this authoring task');
await fs.copyFile(validated,final);
await fs.writeFile(path.join(qa,'delivery.json'),JSON.stringify({finalPath:final,slideCount:35,sha256:crypto.createHash('sha256').update(await fs.readFile(final)).digest('hex'),bytes:(await fs.stat(final)).size,validationReceipt:path.join(qa,`validation-${revision}.json`),sameBytesAsValidated:true,publication:usedCopyFallback?'exclusive copy with finalizer SHA256 check':'hard link'},null,2));
console.log(JSON.stringify({final,slides:35,layout:finalResult.presentationLayout,font:finalResult.fontSelection.passed,import:finalResult.firstPartyImport.passed,integrity:finalResult.packageIntegrity.exitCode,usedCopyFallback}));
