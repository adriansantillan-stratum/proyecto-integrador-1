import fs from 'node:fs/promises';
import path from 'node:path';
import {PresentationFile,FileBlob} from 'file:///C:/Users/USUARIO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs';
const root=process.cwd(), out=path.join(root,'docs/correccion_integral/_qa/ppt/reference');
await fs.mkdir(out,{recursive:true});
const p=await PresentationFile.importPptx(await FileBlob.load(path.join(root,'docs/presentacion_capitulo2/final/EcoRoute_Capitulo_2_Diseno_BPMN_Formal_v4.pptx')));
const q=await p.inspect({select:'$.slides[*]',include:['id','index','title','elements.text','elements.style','elements.position']});
await fs.writeFile(path.join(out,'reference-inspect.ndjson'),q.ndjson);
for(const n of [1,3,5,21,36,43,56]){
 const png=await p.export({slide:p.slides.items[n-1],format:'png',scale:1});
 await fs.writeFile(path.join(out,`reference-${n}.png`),new Uint8Array(await png.arrayBuffer()));
 console.log('rendered',n);
}
console.log('slides',p.slides.items.length);
