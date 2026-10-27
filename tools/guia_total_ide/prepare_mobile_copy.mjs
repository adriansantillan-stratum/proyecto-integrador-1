import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'../..');
const source=path.join(root,'mobile-app');
const target=path.join(os.tmpdir(),'ecoroute-ide-mobile-'+Date.now());
const excluded=new Set(['build','.dart_tool','.gradle','.git','.idea','.vscode','.env']);
fs.cpSync(source,target,{recursive:true,filter:p=>!path.relative(source,p).split(path.sep).some(x=>excluded.has(x))});
const hashes=[];
function verify(rel){
 const src=path.join(source,rel),dst=path.join(target,rel);
 if(fs.statSync(src).isDirectory()){for(const name of fs.readdirSync(src))verify(path.join(rel,name));return;}
 const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
 if(sha(src)!==sha(dst))throw Error('Fuente diferente: '+rel);
 hashes.push({file:rel.replaceAll('\\','/'),sha256:sha(src)});
}
for(const rel of ['lib','android/app/src','android/app/build.gradle.kts','pubspec.yaml','pubspec.lock'])verify(rel);
const manifest={at:new Date().toISOString(),source,target,reason:'Bloqueo de acceso en archivos generados de OneDrive; fuentes conservadas e idénticas.',hashes};
fs.mkdirSync(path.join(root,'docs/guia_total_ide/.runtime'),{recursive:true});
fs.writeFileSync(path.join(root,'docs/guia_total_ide/.runtime/mobile_copy.json'),JSON.stringify(manifest,null,2));
const publicManifest={...manifest,target:'Directorio temporal de compilación local'};
fs.writeFileSync(path.join(root,'docs/guia_total_ide/ejecucion_20261026/mobile/source_copy_verification.json'),JSON.stringify(publicManifest,null,2));
console.log(JSON.stringify({target,sourceFilesVerified:hashes.length}));
