import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const sharp=require('C:/Users/USUARIO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const out=path.resolve(import.meta.dirname,'../../docs/correccion_integral/diagramas');
for(const file of (await fs.readdir(out)).filter(file=>file.endsWith('.svg'))) {
  await sharp(path.join(out,file)).png().toFile(path.join(out,file.replace('.svg','.png')));
}
console.log('Diagramas rasterizados desde sus fuentes editables.');
