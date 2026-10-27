import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const work = path.join(root, 'docs/control_actualizacion/presentacion');
const runtime = 'C:/Users/USUARIO/.cache/codex-runtimes/codex-primary-runtime/dependencies';
const skill = 'C:/Users/USUARIO/.codex/plugins/cache/openai-primary-runtime/presentations/26.1024.11018/skills/presentations';
const {FileBlob, PresentationFile} = await import(pathToFileURL(path.join(runtime, 'node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs')).href);
const json = async p => JSON.parse(await fs.readFile(p, 'utf8'));
const sha = async p => createHash('sha256').update(await fs.readFile(p)).digest('hex');
const plan = await json(path.join(work, 'targeted_updates.json'));
const previous = path.join(work, '_qa/preview-1792719190508');
const build = path.join(work, '_qa/resume-20261026');
const source = path.join(root, plan.source);
const mode = process.argv[2] ?? 'inspect';
await fs.mkdir(build, {recursive:true});
if (await sha(source) !== plan.sourceSha256) throw new Error('Source changed');
if (mode === 'inspect') {
  const receipt = await json(path.join(previous, 'preview_receipt.json'));
  if (receipt.planSha256 !== await sha(path.join(work, 'targeted_updates.json'))) throw new Error('Latest candidate mismatches plan');
  const evidence = [];
  for (const e of plan.evidence) evidence.push({...e, currentSha256:await sha(path.join(root,e.file))});
  const changed = evidence.filter(e=>e.sha256!==e.currentSha256);
  const deck = await PresentationFile.importPptx(await FileBlob.load(path.join(previous,'candidate.pptx')));
  const content = await deck.inspect({select:'$.slides[*]',include:['id','index','elements.id','elements.kind','elements.name','elements.text','elements.position','elements.style','elements.cells','notes.text']});
  await fs.writeFile(path.join(build,'candidate-content.ndjson'),content.ndjson);
  for (let i=0;i<deck.slides.items.length;i++) {
    const s=deck.slides.items[i], stem=`slide-${String(i+1).padStart(2,'0')}`;
    await fs.writeFile(path.join(build,`${stem}.png`),new Uint8Array(await (await deck.export({slide:s,format:'png',scale:1})).arrayBuffer()));
    await fs.writeFile(path.join(build,`${stem}.layout.json`),await (await s.export({format:'layout',detail:'full'})).text());
    console.log(`Rendered ${i+1}/35`);
  }
  await fs.writeFile(path.join(build,'resume-audit.json'),JSON.stringify({candidate:path.join(previous,'candidate.pptx'),candidateSha256:await sha(path.join(previous,'candidate.pptx')),sourceSha256:await sha(source),slideCount:deck.slides.items.length,evidence,changedEvidence:changed},null,2));
  console.log(JSON.stringify({build,slideCount:deck.slides.items.length,changedEvidence:changed.map(e=>e.file)}));
} else if(mode === 'build') {
  const deck=await PresentationFile.importPptx(await FileBlob.load(path.join(previous,'candidate.pptx')));
  const text=(id,oldValue,newValue)=>{const t=deck.resolve(id);if(String(t.text)!==oldValue)throw new Error(`Anchor ${id}`);t.text.replace(oldValue,newValue);};
  text('sh/7qp4be9c','Actualización del 22 de octubre de 2026\nPruebas locales. Aceptación empresarial pendiente.','Edición del 26 de octubre de 2026\nEvidencias locales al 22/10. Aceptación pendiente.');
  text('sh/87ml836l','Mapa recuperado y caché nativa verificados.\nV16 y API local contrastados con SQL.\nDispositivos y red de campo por validar.\nPower BI Desktop sin conexión verificada.','Mapa recuperado y caché nativa verificados.\nV16 y API local contrastados con SQL.\nDispositivos y red de campo por validar.\nPower BI instalado. Conexión por acreditar.');
  const noteUpdates={
    1:'Edición documental del 26/10/2026. Los resultados técnicos y capturas corresponden al corte del 22/10/2026. No constituye nueva ejecución de pruebas ni UAT.',
    23:'Migraciones fuente: 15 archivos SQL versionados, V1 a V16 con V11 ausente. V16 añade la función analytics_route_gps_quality y actualiza la vista analítica de rutas, sin nuevas tablas ni FK. El ERD conserva 26 tablas, 4 vistas y 27 FK. Fuentes: src/main/resources/db/migration/; docs/control_actualizacion/evidencias/deploy_after.json.',
    24:'El rango de migraciones es V1 a V16, con 15 archivos fuente y sin V11. V16 añade función de calidad GPS y modifica analytics_route_facts. Se conservan las tablas, vistas y FK del ERD. Fuentes: src/main/resources/db/migration/V16__analytics_gps_quality.sql; docs/control_actualizacion/evidencias/deploy_after.json.',
    34:'Trazabilidad del corte: calidad_integrada_1792718833047.json, 106 Java y 53 web, sin fallos. Flutter 84 host PASS y 8 contratos opt-in PASS en ejecución separada. APK build 4005 / versionCode 8005, SHA-256 0b31648021805d87ee85d3e54120c6bc8e2128516547b788f2fc19ecf37bd6b9. apk_4005.json relaciona hashes de las fuentes compiladas e instaladas. Los MD5 de ocho tablas comparan la misma cohorte antes y después de V16. La cohorte KPI del 22/10, conductor 1, incluye pedidos 44/45 y 46/47. Los seis controles web y los nueve API/SQL tienen ejecución y alcance propios. Fuentes: docs/control_actualizacion/evidencias/apk_4005.json; deploy_before.json; deploy_after.json; calidad_integrada_1792718833047.json; api_v16.json; evidencias/web/run_1792719021669/result_1792719031028.json.',
    35:'Estado comunicado por el usuario el 26/10/2026: Power BI Desktop instalado y verificación de conexión en curso por el responsable principal. Conexión, carga, actualización y evaluación M permanecen sin acreditar hasta su reporte. POWER_BI_LOCAL.md documenta el estado histórico del 22/10. Esta edición no ejecuta UI ni DB y no modifica el video original de ruta 21 (5:20).'
  };
  for(const [n,t] of Object.entries(noteUpdates)) deck.slides.items[Number(n)-1].speakerNotes.text+='\n\nActualización documental del 26 de octubre de 2026\n'+t;
  await (await PresentationFile.exportPptx(deck)).save(path.join(build,'candidate-20261026.pptx'));
  const rt=await PresentationFile.importPptx(await FileBlob.load(path.join(build,'candidate-20261026.pptx')));
  const content=await rt.inspect({select:'$.slides[*]',include:['id','index','elements.id','elements.kind','elements.name','elements.text','elements.position','elements.style','elements.cells','notes.text']});
  await fs.writeFile(path.join(build,'updated-content.ndjson'),content.ndjson);
  for(let i=0;i<35;i++){
    const s=rt.slides.items[i],stem=`slide-${String(i+1).padStart(2,'0')}`;
    await fs.writeFile(path.join(build,`${stem}.png`),new Uint8Array(await(await rt.export({slide:s,format:'png',scale:1})).arrayBuffer()));
    await fs.writeFile(path.join(build,`${stem}.layout.json`),await(await s.export({format:'layout',detail:'full'})).text());
    console.log(`Updated render ${i+1}/35`);
  }
  console.log(JSON.stringify({build,candidateSha256:await sha(path.join(build,'candidate-20261026.pptx')),slideCount:rt.slides.items.length}));
} else if(mode==='finalize'){
  const candidate=path.join(build,'candidate-20261026.pptx');
  const out=path.join(work,'entrega');await fs.mkdir(out,{recursive:true});
  let final=path.join(out,'EcoRoute_Arquitectura_y_Flujos_Actualizados.pptx');
  if(await fs.access(final).then(()=>true).catch(()=>false)) final=path.join(out,`EcoRoute_Arquitectura_y_Flujos_Actualizados_20261026_${Date.now()}.pptx`);
  const {finalizePresentation}=await import(pathToFileURL(path.join(skill,'container_tools/artifact_tool_utils.mjs')).href);
  const result=await finalizePresentation({workspaceDir:work,candidatePath:candidate,finalPath:final,pythonExecutable:path.join(runtime,'python/python.exe'),integrityValidatorPath:path.join(skill,'container_tools/inspect_presentation_package_integrity.py'),layoutValidatorPath:path.join(skill,'container_tools/inspect_presentation_layout_geometry.py'),layoutArgs:['--expected-slide-size-emu',`${plan.slideSizeEmu.cx},${plan.slideSizeEmu.cy}`,'--validate-bullet-geometry','--validate-heading-fit'],explicitTotalSlideCount:35,requiredNativeTableOwnerSlides:[3,13,15,17,20,24,30,31,32,34],requiredNativeChartOwnerSlides:[],fontPolicy:plan.fontPolicy,verifyArtifactToolImport:true,receiptPath:path.join(build,`finalization-${Date.now()}.validation.json`)});
  await fs.writeFile(path.join(build,'delivery_receipt.json'),JSON.stringify({final,sha256:await sha(final),sourceUnchanged:await sha(source)===plan.sourceSha256,finalizer:result},null,2));
  console.log(JSON.stringify({final,sha256:await sha(final),receipt:result.receiptPath}));
} else throw new Error('Use inspect, build, finalize');
