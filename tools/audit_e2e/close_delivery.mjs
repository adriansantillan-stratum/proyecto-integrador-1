import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root=path.resolve(import.meta.dirname,'../..');
const base=path.join(root,'docs/correccion_integral');
const qa=path.join(base,'_qa');
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
const ensure=(ok,message)=>{if(!ok)throw new Error(message);};
const args=Object.fromEntries(process.argv.slice(2).map(arg=>arg.replace(/^--/,'').split('=')));
ensure(args.manual&&args.academic,'Supply --manual=QA_RUN --academic=QA_RUN');
for(const value of Object.values(args))ensure(/^[\w-]+(?:\/[\w-]+)?$/.test(value),'Unsafe QA run name');
const original=path.join(root,'docs/Integrador I_Grupo3.docx');
ensure(sha(original)==='0510d1041b955184bbed180ce9a96ef31f3e08863d8ef58f93d34916c18ecfb5','Original document changed');
const documents=[];
for(const [kind,run,relative] of [
 ['academic',args.academic,'../Integrador I_Grupo3_Correccion_Integral.docx'],
 ['manual',args.manual,'EcoRoute_Manual_Integral_Implementacion_y_Pruebas.docx'],
 ['speech','guion_final_r4','EcoRoute_Guion_Tecnico_Exposicion.docx'],
]){
 const folder=path.join(qa,'word_final',run),reviewFile=path.join(folder,'visual_review.json');
 const review=read(reviewFile),final=path.resolve(base,relative),reviewed=path.join(folder,path.basename(final));
 ensure(review.visualReviewComplete,`${kind}: visual review incomplete`);
 const open=[...(review.findings??[]),...(review.openLayoutFindings??[])].filter(f=>!['resolved','closed'].includes(String(f.status??'open').toLowerCase()));
 ensure(!open.length,`${kind}: ${open.length} open visual findings`);
 ensure(sha(final)===sha(reviewed),`${kind}: final differs from reviewed DOCX`);
 documents.push({kind,path:path.relative(root,final).replaceAll('\\','/'),sha256:sha(final),bytes:fs.statSync(final).size,
  pages:fs.readdirSync(folder).filter(n=>/^page-\d+\.png$/.test(n)).length,
  visualReview:path.relative(root,reviewFile).replaceAll('\\','/'),reviewSha256:sha(reviewFile)});
}
const pptFile=path.join(base,'EcoRoute_Arquitectura_y_Flujos_Verificados.pptx');
const ppt=read(path.join(qa,'ppt/qa_final.json')),pptVisual=read(path.join(qa,'ppt/visual_review.json'));
ensure(ppt.sameAsValidated&&ppt.importPassed&&!ppt.layoutFindings&&!ppt.outOfCanvas.length,'PPT package/layout gate failed');
ensure(pptVisual.visualReviewComplete&&!pptVisual.findings.length&&pptVisual.sha256===sha(pptFile),'PPT visual gate failed');
documents.push({kind:'presentation',path:path.relative(root,pptFile).replaceAll('\\','/'),sha256:sha(pptFile),slides:ppt.slideCount});
const evidence=name=>read(path.join(base,'evidencias',name+'.json'));
const api=evidence('regresion_api'),finalApi=evidence('comprobaciones_finales_api'),quality=evidence('calidad_final'),mobile=evidence('calidad_mobile');
const webUnitCount=Number([...quality.web.find(c=>c.name==='Web unit tests').stdout.matchAll(/(?:^|\n)[^\n]*\btests\s+(\d+)/g)].at(-1)?.[1]??0);
ensure(webUnitCount>0,'Missing web unit-test summary');
const offline=evidence('prueba_emulador_offline'),failed=evidence('prueba_emulador_no_entrega'),apk=evidence('instalacion_mobile_final');
ensure(api.summary.failed===0&&finalApi.summary.failed===0,'API evidence contains failures');
ensure(!quality.java.summary.failures&&!quality.java.summary.errors&&quality.web.every(c=>c.exitCode===0),'Quality gate failed');
ensure(mobile.status==='PASS'&&!offline.summary.failed&&!failed.summary.failed,'Mobile evidence contains failures');
ensure(apk.launchSucceeded&&apk.preservedAppData&&apk.uiVerification.failed===0,'APK verification failed');
ensure(sha(path.join(root,apk.apk))===apk.sha256,'APK bytes differ from installed build');
const screenshots=fs.readdirSync(path.join(base,'capturas')).filter(n=>n.startsWith('cierre_visual_')).map(n=>{
 const file=path.join(base,'capturas',n,'results.json'),result=read(file);ensure(result.result==='PASS',`Capture gate failed: ${n}`);
 return {manifest:path.relative(root,file).replaceAll('\\','/'),sha256:sha(file),replacementCount:result.replacements.length};
});
const result={at:new Date().toISOString(),status:'LOCAL_TECHNICAL_CLOSURE',documents,originalDocumentPreserved:true,
 tests:{api:api.summary,additionalApi:finalApi.summary,java:quality.java.summary,webUnitTests:webUnitCount,web:quality.web.map(c=>({name:c.name,exitCode:c.exitCode})),
  flutter:mobile.summary,androidOffline:offline.summary,androidFailedDelivery:failed.summary,installedApkUi:{passed:apk.uiVerification.passed,failed:apk.uiVerification.failed}},
 apk:{path:apk.apk,sha256:apk.sha256,avd:'EcoRoute_QA',versionCode:4003,preservedAppData:true},visualCaptureCorrections:screenshots,
 pending:[
  'Ejecución y firma de 96 casos UAT por personas de MICOTRANS.',
  'Pruebas de campo en dispositivos físicos, cobertura y precisión GPS.',
  'Despliegue productivo, TLS, servicios definitivos, copias y recuperación operativas.',
  'Conexión real de Power BI y validación empresarial de indicadores.'
 ],scope:'Evidencia local, sintética y fechada. No certifica cobertura exhaustiva, aceptación empresarial ni operación productiva.'};
fs.writeFileSync(path.join(base,'evidencias/cierre_tecnico_local.json'),JSON.stringify(result,null,2)+'\n');
const links=documents.map(d=>`- [${d.kind==='academic'?'Informe académico':d.kind==='manual'?'Manual integral':d.kind==='speech'?'Guion de exposición':'Presentación'}](${d.kind==='academic'?'../'+path.basename(d.path):path.basename(d.path)}) — ${d.pages?d.pages+' páginas':d.slides+' láminas'}.`).join('\n');
const text=`# Cierre técnico local de EcoRoute\n\nRevisión del 20 de octubre de 2026. El flujo local y los entregables se cierran con las evidencias indicadas; la aceptación empresarial permanece pendiente.\n\n## Entregables vigentes\n\n${links}\n- [Catálogo navegable con código y diagramas](index.html).\n- [Script completo PostgreSQL V1–V15](../base_datos/EcoRoute_BD_Completa_V1-V15.sql).\n\nEl documento original se conserva. La revisión académica integrada es una copia separada. Los hashes de las versiones revisadas constan en [el acta técnica de cierre](evidencias/cierre_tecnico_local.json).\n\n## Verificación ejecutada\n\nAPI: ${api.summary.passed}/${api.summary.total}; comprobaciones adicionales: ${finalApi.summary.passed}/${finalApi.summary.total}; Java: ${quality.java.summary.tests} sin fallos ni errores. TypeScript, ESLint y pruebas web finalizan con código cero. Flutter y sus contratos opt-in constan en su informe de calidad. Android acredita ${offline.summary.passed} controles offline, ${failed.summary.passed} de no entrega y ${apk.uiVerification.passed} tras actualizar la APK. Estas cifras son escenarios de suites distintas, no porcentajes de cobertura del producto.\n\nLa APK versión 4003 está instalada en EcoRoute_QA sin borrar sus datos; las AVD originales se conservan. Las capturas originales y los resultados históricos no se sobrescriben: los manifiestos de cierre visual identifican sus sustituciones documentales.\n\n## Fronteras pendientes\n\n${result.pending.map(s=>'- '+s).join('\n')}\n\nLa cola móvil se reintenta con la aplicación activa, al reabrir o reanudar; no se acredita ejecución nativa cuando el sistema operativo la mantiene cerrada. El POD con hashes no se presenta como firma digital certificada ni validez legal garantizada. No se realizó un despliegue productivo ni se incluye un commit como parte de este cierre.\n`;
fs.writeFileSync(path.join(base,'CIERRE_TECNICO.md'),text);
const ledgerFile=path.join(qa,'word_final/visual_review_ledger.json');
const ledger=read(ledgerFile);
ledger.currentDelivery={at:result.at,status:'PASS_PROMOTED_VERIFIED',humanMICOTRANSValidation:'PENDING',
 documents:documents.map(document=>({kind:document.kind,path:document.path,sha256:document.sha256,pages:document.pages,slides:document.slides,visualReview:document.visualReview})),
 note:'Current deliverables supersede historical pending states. Exact source observations and prior findings remain in their own immutable review reports.'};
for(const finding of ledger.open_findings??[]){
 if(['WF01','WF02','AC01','AC02'].includes(finding.id)){
  finding.historicalStatus??=finding.status;
  finding.status='CLOSED_VERIFIED_FINAL_R2';
  finding.resolutionReport=`${finding.document==='manual'?args.manual:args.academic}/visual_review.json`;
 }
}
ledger.currentOpenVisualFindings=[];
ledger.currentLimits=result.pending;
fs.writeFileSync(ledgerFile,JSON.stringify(ledger,null,2)+'\n');
console.log(JSON.stringify({status:result.status,documents:documents.map(d=>({kind:d.kind,pages:d.pages,slides:d.slides})),pendingHumanUat:96}));
