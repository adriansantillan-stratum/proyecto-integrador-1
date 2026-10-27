// Renderiza los SVG vectoriales del ERD a PNG de alta resolución para Word/PPT.
import { readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sharp = require('C:/Users/USUARIO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');

const dir = resolve(import.meta.dirname, '..', 'docs', 'base_datos', 'modelo_erd');
const files = (await readdir(dir)).filter((name) => name.endsWith('.svg'));
for (const name of files) {
  const input = join(dir, name);
  const output = join(dir, name.replace(/\.svg$/i, '.png'));
  await sharp(input, { density: 150 }).png().toFile(output);
  console.log(output);
}
