// Record the actual parent-assistant review of revision 05 slide 34.
// Transfer the other 34 observations only through identical complete PNG bytes.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const qa=path.resolve('docs/correccion_integral/_qa/ppt');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const prior=read(path.join(qa,'reviewed_revision04/visual_review.json'));
if(!prior.visualReviewComplete||prior.viewedSlides.length!==35||prior.findings.length)throw new Error('Prior review incomplete');
const unchanged=[];
for(let number=1;number<=35;number++){
 const file='slide-'+String(number).padStart(2,'0')+'.png';
 const same=sha(path.join(qa,'final-slides',file))===sha(path.join(qa,'reviewed_revision04',file));
 if(same)unchanged.push(number);else if(number!==34)throw new Error('Unreviewed slide changed: '+number);
}
const old=read(path.join(qa,'reviewed_revision04/deck_manifest.json')),current=read(path.join(qa,'deck_manifest.json'));
for(let i=0;i<35;i++){
 if(old.slides[i].notes.split('\n\nDetalle técnico y fuentes')[0]!==current.slides[i].notes.split('\n\nDetalle técnico y fuentes')[0])throw new Error('Speech narrative changed: '+(i+1));
}
const validation=read(path.join(qa,'qa_final.json'));
if(!validation.sameAsValidated||validation.layoutFindings||validation.outOfCanvas.length)throw new Error('Final validation failed');
fs.writeFileSync(path.join(qa,'visual_review.json'),JSON.stringify({at:new Date().toISOString(),artifact:current.pptx,sha256:sha(current.pptx),
 viewedSlides:Array.from({length:35},(_,i)=>i+1),visualReviewComplete:true,findings:[],
 individuallyOpenedRevision05:[34],priorReviewTransferredByIdenticalFullPngBytes:unchanged,
 spokenNarrationIdenticalToReviewedSpeech:true,priorReview:'reviewed_revision04/visual_review.json',
 limits:['Assistant visual QA is not human MICOTRANS acceptance.','Historical screenshot sources remain explicitly dated in the deck.']},null,2));
console.log(JSON.stringify({reviewedSlides:35,changedAndViewed:[34],identical:unchanged.length,spokenNarrationUnchanged:true}));
