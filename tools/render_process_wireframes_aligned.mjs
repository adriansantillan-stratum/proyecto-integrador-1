import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(path.join(process.env.RUNTIME_NODE_MODULES, 'package.json'));
const sharp = require('sharp');

const root = process.cwd();
const dir = path.join(root, 'docs', 'entregables_procesos_ecoroute', 'imagenes');
for (const stem of ['P01_wireframes_flujo_alineado', 'P02_wireframes_flujo_alineado']) {
  const svg = await fs.readFile(path.join(dir, `${stem}.svg`));
  await sharp(svg, { density: 144 }).png().toFile(path.join(dir, `${stem}.png`));
}
