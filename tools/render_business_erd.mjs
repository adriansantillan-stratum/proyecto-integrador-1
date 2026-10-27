// Renderiza las vistas SVG del ERD del negocio para insertarlas en PowerPoint.
import { readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sharp = require('C:/Users/USUARIO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const dir = resolve(import.meta.dirname, '..', 'docs', 'base_datos', 'modelo_erd_negocio');
for (const name of (await readdir(dir)).filter(x => x.endsWith('.svg'))) {
  const target = join(dir, name.replace(/\.svg$/i, '.png'));
  await sharp(join(dir, name), { density: 150 }).png().toFile(target);
  console.log(target);
}
