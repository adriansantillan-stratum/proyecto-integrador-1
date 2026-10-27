import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'../..');
const archive=path.join(root,'backups/pre_correction_20261019_complete');
const evidence=path.join(root,'docs/correccion_integral/evidencias');
const manifest=JSON.parse(await fs.readFile(path.join(archive,'manifest.json'),'utf8'));
const restored=[];
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
function sql(query) {return execFileSync('docker',['exec','-i','ecoroute-db','psql','-U','user','-d','ecoroute','-At','-v','ON_ERROR_STOP=1'],{input:query,encoding:'utf8'}).trim();}
function store(key,bytes) {
  if(!/^(photos|signatures)\/[a-f0-9-]+\.(png|jpg)$/.test(key))throw new Error('Object key outside proof prefixes');
  sql(`INSERT INTO local_evidence_backups(object_key,content,media_type) VALUES('${key}',decode('${bytes.toString('base64')}','base64'),'${key.endsWith('.png')?'image/png':'image/jpeg'}') ON CONFLICT(object_key) DO NOTHING;`);
}
for(const entry of manifest) {
  const relative=entry.path.replaceAll('\\','/');if(!relative.startsWith('objects/'))continue;
  const bytes=await fs.readFile(path.join(archive,entry.path));
  if(digest(bytes)!==entry.sha256.toLowerCase())throw new Error('Backup hash mismatch');
  const key=relative.slice('objects/'.length);store(key,bytes);
  restored.push({key,sha256:digest(bytes),source:'Original pre-correction backup',bytes:bytes.length});
}
// Only known synthetic fixture bytes may be reconstructed. Never invent real POD content.
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKma1gAAAABJRU5ErkJggg==','base64');
const proofs=JSON.parse(sql(`SELECT COALESCE(json_agg(json_build_object('photo',p.image_url,'signature',p.signature_data_url,'photoHash',p.image_sha256,'signatureHash',p.signature_sha256)),'[]') FROM delivery_proofs p JOIN orders o ON o.id=p.order_id WHERE o.tracking_number LIKE 'FIX-%';`));
for(const proof of proofs)for(const asset of ['photo','signature']) {
  if(proof[`${asset}Hash`]!==digest(png))throw new Error('Synthetic evidence differs from fixture; refusing reconstruction');
  const key=proof[asset].replace('s3://ecoroute-proofs/','');store(key,png);
  restored.push({key,sha256:digest(png),source:'Known synthetic regression fixture with matching pre-recorded SHA256',bytes:png.length});
}
await fs.writeFile(path.join(evidence,'restauracion_evidencias_locales.json'),JSON.stringify({executedAt:new Date().toISOString(),realEvidenceInvented:false,objects:restored},null,2));
console.log(JSON.stringify({restored:restored.length,originalBackupObjects:restored.filter(o=>o.source.startsWith('Original')).length,syntheticFixtureObjects:restored.filter(o=>o.source.startsWith('Known')).length}));
