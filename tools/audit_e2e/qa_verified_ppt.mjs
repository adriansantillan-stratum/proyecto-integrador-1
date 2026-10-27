import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {PresentationFile,FileBlob} from 'file:///C:/Users/USUARIO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs';
const root=process.cwd(),base=path.join(root,'docs/correccion_integral');
const qa=path.join(base,'_qa/ppt');
const file=path.join(base,'EcoRoute_Arquitectura_y_Flujos_Verificados.pptx');
const p=await PresentationFile.importPptx(await FileBlob.load(file));
const dir=path.join(qa,'final-slides');await fs.mkdir(dir,{recursive:true});
const bounds=[];
for(const [i,s] of p.slides.items.entries()){
 const name=`slide-${String(i+1).padStart(2,'0')}`;
 const png=await p.export({slide:s,format:'png',scale:1});
 await fs.writeFile(path.join(dir,name+'.png'),new Uint8Array(await png.arrayBuffer()));
 const layout=JSON.parse(await (await s.export({format:'layout'})).text());
 await fs.writeFile(path.join(dir,name+'.layout.json'),JSON.stringify(layout));
 for(const e of layout.elements??[]){const f=e.position;if(f&&(f.left<-.5||f.top<-.5||f.left+f.width>1280.5||f.top+f.height>720.5))bounds.push({slide:i+1,id:e.id,position:f});}
}
const delivery=JSON.parse(await fs.readFile(path.join(qa,'delivery.json'),'utf8'));
const receipt=JSON.parse(await fs.readFile(delivery.validationReceipt,'utf8'));
const inspect=await p.inspect({select:'$.slides[*]',include:['index','elements.name','elements.text','notes.text']});
const slides=inspect.records.map((s,i)=>({number:i+1,title:s.elements.find(e=>e.name==='slide-title'||e.name==='cover-title')?.text??`Lámina ${i+1}`,notes:s.notes.text}));
if(slides.some(s=>!s.notes||s.notes.length<100))throw new Error('Missing readable speaker notes');
const hash=crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex');
const report={finalPath:file,slideCount:p.slides.items.length,finalSha256:hash,sameAsValidated:hash===receipt.finalSha256&&hash===delivery.sha256,importPassed:true,renderedSlides:35,outOfCanvas:bounds,packageFindings:receipt.packageIntegrity.findingCount,layoutFindings:receipt.presentationLayout.findingCount,fontPolicyPassed:receipt.fontSelection.passed,layoutWarnings:receipt.presentationLayout.warnings,limits:['PowerPoint and LibreOffice applications were not used.','Enterprise UAT pending.','BI screenshots predate V15 and document UI, not corrected formula execution.']};
await fs.writeFile(path.join(qa,'deck_manifest.json'),JSON.stringify({schemaVersion:'ecoroute.deck.v1',pptx:file,sha256:hash,slideCount:slides.length,notesSource:'Exact notes reimported from the final PPTX. Paragraphs are intended for the Word exposition.',slides},null,2));
await fs.writeFile(path.join(qa,'qa_final.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({slides:report.slideCount,hashMatches:report.sameAsValidated,rendered:report.renderedSlides,outOfCanvas:bounds.length,layoutFindings:report.layoutFindings,layoutWarnings:report.layoutWarnings.length}));
if(report.slideCount!==35||!report.sameAsValidated||bounds.length||report.layoutFindings)process.exitCode=1;
