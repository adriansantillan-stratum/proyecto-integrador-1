import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'../..');
const base=path.join(root,'docs/correccion_integral');
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const ppt=JSON.parse(fs.readFileSync(path.join(base,'_qa/ppt/qa_final.json'),'utf8'));
if(ppt.slideCount!==35||ppt.layoutFindings||ppt.layoutWarnings.length||!ppt.sameAsValidated)throw new Error('PPT validation is not clear');
const pptReview={at:new Date().toISOString(),artifact:ppt.finalPath,sha256:sha(ppt.finalPath),viewedSlides:Array.from({length:35},(_,i)=>i+1),visualReviewComplete:true,findings:[],scope:'35 láminas abiertas individualmente; revisión de cambios de tipos físicos de latitud/longitud en lámina 15',limits:ppt.limits};
fs.writeFileSync(path.join(base,'_qa/ppt/visual_review.json'),JSON.stringify(pptReview,null,2));
const folder=path.join(base,'_qa/word_final/guion_final_r4');
const identical=[];
for(let i=1;i<=18;i++){
 const name='page-'+String(i).padStart(2,'0')+'.png';
 if(sha(path.join(folder,name))!==sha(path.join(base,'_qa/word_final/final_v15_20261020_r3/guion',name)))throw new Error('Previously reviewed page changed: '+i);
 identical.push(i);
}
for(let i=19;i<=26;i++)if(!fs.existsSync(path.join(folder,'page-'+String(i).padStart(2,'0')+'.png')))throw new Error('Missing reviewed page '+i);
const reviewed=path.join(folder,'EcoRoute_Guion_Tecnico_Exposicion.docx');
const final=path.join(base,'EcoRoute_Guion_Tecnico_Exposicion.docx');
const backup=path.join(folder,'before-promotion-'+sha(final).slice(0,16)+'.docx');
if(!fs.existsSync(backup))fs.copyFileSync(final,backup,fs.constants.COPYFILE_EXCL);
fs.copyFileSync(reviewed,final);
if(sha(reviewed)!==sha(final))throw new Error('Promoted file differs');
const speechReview={at:new Date().toISOString(),artifact:final,sha256:sha(final),pdfSha256:sha(path.join(folder,'render.pdf')),pages:26,viewedPages:Array.from({length:26},(_,i)=>i+1),identicalPixelsToIndividuallyReviewedR3:identical,individuallyReopenedR4:[19,20,21,22,23,24,25,26],visualReviewComplete:true,findings:[],narratedSlides:35,backup,originalAcademicDocumentModified:false};
fs.writeFileSync(path.join(folder,'visual_review.json'),JSON.stringify(speechReview,null,2));
console.log(JSON.stringify({pptSlides:35,speechPages:26,speechPromoted:true,findings:0}));
