// Main assistant opened all ten R2 pages and the two changed R3 pages at native resolution.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root=path.resolve(import.meta.dirname,'../..'),base=path.join(root,'docs/control_integral_20261022');
const qa=path.join(root,'docs/correccion_integral/_qa/control_20261022_final_r3'),prior=path.join(root,'docs/correccion_integral/_qa/control_20261022_final_r2');
const read=name=>JSON.parse(fs.readFileSync(path.join(base,name),'utf8'));
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const requireTrue=(value,message)=>{if(!value)throw new Error(message);};
const transferred=[];
for(let i=1;i<=10;i++){
 const file='page-'+String(i).padStart(2,'0')+'.png',same=sha(path.join(qa,file))===sha(path.join(prior,file));
 if(same)transferred.push(i);else requireTrue([5,6].includes(i),'Unreviewed change '+i);
}
const integrated=read('inventario_integrado.json');
for(const input of integrated.integrationInputs)requireTrue(sha(path.join(root,input.file))===input.sha256,'Mapping input changed '+input.file);
const checks=[read('validacion_integral.json'),read('calidad_actual.json'),read('calidad_mobile_actual.json'),read('medicion_local_ejecutada.json'),read('qa_catalogo_y_web.json')];
requireTrue(checks[0].structuralValidation==='PASS'&&checks.slice(1).every(c=>c.result==='PASS'||c.status==='PASS'),'A technical gate failed');
requireTrue(read('validacion_aceptacion.json').acceptanceRecorded===false,'Reconcile real acceptance before recording closure');
const name='EcoRoute_Control_Integral_y_Aceptacion.docx',source=path.join(qa,name),final=path.join(root,'docs/correccion_integral',name);
const original=path.join(root,'docs/Integrador I_Grupo3.docx'),originalHash=sha(original);
const backup=path.join(qa,'before-promotion-'+sha(final).slice(0,16)+'.docx');
if(!fs.existsSync(backup))fs.copyFileSync(final,backup,fs.constants.COPYFILE_EXCL);
fs.copyFileSync(source,final);
requireTrue(sha(final)===sha(source)&&sha(original)===originalHash,'Promotion/preservation mismatch');
const review={at:new Date().toISOString(),status:'PASS_ASSISTANT_VISUAL_QA',visualReviewComplete:true,artifact:final,sha256:sha(final),pages:10,baselineRevision2PagesIndividuallyViewed:[1,2,3,4,5,6,7,8,9,10],revision3PagesIndividuallyViewed:[5,6],revision3TransferredByIdenticalCompletePngBytes:transferred,findings:[],humanAcceptance:'NOT_ATTESTED',backup,originalPreservedDuringPromotion:true};
fs.writeFileSync(path.join(qa,'visual_review.json'),JSON.stringify(review,null,2));
const closure={at:review.at,status:'LOCAL_CONTROL_READY_NOT_BUSINESS_ACCEPTED',artifact:{path:path.relative(root,final),sha256:sha(final),pages:10},counts:checks[0],gates:{java:checks[1].java.summary,web:'32 PASS; TypeScript/ESLint exit 0',flutter:checks[2].summary,apiSql:checks[3].summary,catalogue:checks[4].result},originalPreserved:true,device:{reportedModel:'Redmi Note 14 Pro+ 5G',windowsPortableDeviceDetected:true,adbAuthorizedDevicesAtCheck:0,applicationUninstalled:false,proofOfProviderRelease:false},pending:['Identified MICOTRANS validator, decision date, cases and supporting evidence.','Physical test after normal device access or another authorized phone.','Power BI Desktop client session not verified. Public deployment is outside current scope.']};
fs.writeFileSync(path.join(base,'cierre_control.json'),JSON.stringify(closure,null,2));
fs.writeFileSync(path.join(base,'README.md'),`# Control integral local de EcoRoute\n\nRevisión del 22 de octubre de 2026.\n\n[Informe de control](../correccion_integral/EcoRoute_Control_Integral_y_Aceptacion.docx) · [Matrices completas](index.html) · [Inventario integrado](inventario_integrado.json).\n\n135 requisitos, 199 nodos de nueve procesos, 96 UAT y un plan complementario de 199 controles para 212 flujos. La asignación documental es completa; no acredita implementación, ejecución ni aceptación de todos los requisitos.\n\nPruebas actuales: 44 controles API/SQL, 58 Java, 32 web, 41 Flutter host y ocho contratos locales aprobados. Las suites tienen alcances distintos y no son porcentajes de cobertura. Los informes históricos se conservan.\n\nEl registro de aceptación no acredita una decisión de MICOTRANS sin validador, cargo, fecha y evidencia. El teléfono está detectado por Windows pero no autorizado en ADB: no se desinstaló Telecoms Client ni se ejecutó una prueba física. La sesión real de Power BI Desktop no está verificada. El despliegue público no forma parte del alcance local confirmado.\n\n[Estado verificable y hashes](cierre_control.json) · [Controles por nodo](plan_verificacion_completo.json) · [Registro de aceptación](aceptacion.json) · [Validación de aceptación](validacion_aceptacion.json).\n`);
console.log(JSON.stringify({status:closure.status,pages:10,transferredPages:transferred.length,reviewedChangedPages:[5,6],businessAcceptance:false}));
