import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root=path.resolve(import.meta.dirname,'../..'),qa=path.join(root,'docs/correccion_integral/_qa/word_final');
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const run=process.argv[2];
if(!run||!/^[\w-]+$/.test(run))throw new Error('Use a validated QA run name');
const original=path.join(root,'docs/Integrador I_Grupo3.docx'),originalHash=sha(original);
if(originalHash!=='0510d1041b955184bbed180ce9a96ef31f3e08863d8ef58f93d34916c18ecfb5')throw new Error('Protected original differs');
for(const [key,relative] of [
 ['manual','docs/correccion_integral/EcoRoute_Manual_Integral_Implementacion_y_Pruebas.docx'],
 ['academico','docs/Integrador I_Grupo3_Correccion_Integral.docx'],
]){
 const folder=path.join(qa,run,key),reviewFile=path.join(folder,'visual_review.json');
 const review=JSON.parse(fs.readFileSync(reviewFile,'utf8').replace(/^\uFEFF/,''));
 if(!review.visualReviewComplete||/NOT_PASS|FAIL|PENDING/.test(String(review.status??'')+' '+String(review.qualityGate??'')))throw new Error(key+': review not complete');
 const findings=[...(review.findings??[]),...(review.openLayoutFindings??[])];
 if(findings.some(f=>!['closed','resolved'].includes(String(f.status??'open').toLowerCase())))throw new Error(key+': open findings');
 const final=path.join(root,relative),source=path.join(folder,path.basename(final)),reviewedHash=sha(source);
 const expected=review.qaDocxSha256??review.source?.sha256??review.sha256;
 if(expected&&expected.toLowerCase()!==reviewedHash)throw new Error(key+': reviewed hash differs');
 const before=sha(final),backup=path.join(folder,'before-promotion-'+before.slice(0,16)+'.docx');
 if(!fs.existsSync(backup))fs.copyFileSync(final,backup,fs.constants.COPYFILE_EXCL);
 if(sha(backup)!==before)throw new Error('Backup mismatch');
 const staging=path.join(folder,'promotion-stage-'+crypto.randomUUID()+'.docx');
 fs.copyFileSync(source,staging,fs.constants.COPYFILE_EXCL);
 if(sha(final)!==before||sha(source)!==reviewedHash||sha(staging)!==reviewedHash)throw new Error('Concurrent change before promotion');
 fs.renameSync(staging,final);
 if(sha(final)!==reviewedHash||sha(original)!==originalHash)throw new Error('Promotion/preservation mismatch');
 const promotion={at:new Date().toISOString(),status:'PROMOTED_VERIFIED',source,final,sha256:reviewedHash,backup,originalPreserved:true,humanAcceptance:'PENDING'};
 fs.writeFileSync(path.join(folder,'promotion.json'),JSON.stringify(promotion,null,2));
 console.log(JSON.stringify({key,status:promotion.status,sha256:reviewedHash}));
}
