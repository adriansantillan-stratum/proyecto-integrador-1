/** Initialize only a new ignored local environment; never overwrite credentials. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'../..');
const target=path.join(root,'.env');
if(fs.existsSync(target)){
 console.log('Se conserva .env existente. No se modificaron credenciales.');
 process.exit(0);
}
try{execFileSync('git',['check-ignore','--quiet','.env'],{cwd:root,stdio:'pipe'});}
catch{if(fs.existsSync(path.join(root,'.git')))throw Error('.env debe estar ignorado por Git antes de generarse.');}
const template=fs.readFileSync(path.join(root,'.env.example'),'utf8');
const content=template.replace(/^KEYCLOAK_ADMIN_CLIENT_SECRET=$/m,'KEYCLOAK_ADMIN_CLIENT_SECRET='+crypto.randomBytes(32).toString('hex'));
fs.writeFileSync(target,content,{encoding:'utf8',flag:'wx',mode:0o600});
console.log('Entorno local generado en .env sin mostrar su secreto. Continúe con la configuración local documentada.');
