import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require=createRequire('C:/Users/USUARIO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/package.json');
const sharp=require('sharp');
const folder=path.resolve('docs/auditoria_end_to_end_20261019/diagramas');
for(const name of fs.readdirSync(folder).filter(n=>n.endsWith('.svg'))){
 await sharp(path.join(folder,name),{density:170}).png().toFile(path.join(folder,name.replace('.svg','.png')));
 console.log(name);
}
