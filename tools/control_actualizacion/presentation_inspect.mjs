import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const output = path.join(root, 'docs/control_actualizacion/presentacion/_qa/baseline');
const source = path.join(root, 'docs/correccion_integral/EcoRoute_Arquitectura_y_Flujos_Verificados.pptx');
await fs.mkdir(output, { recursive: true });
const { FileBlob, PresentationFile } = await import(pathToFileURL('C:/Users/USUARIO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs').href);
console.log('Importing original PPTX read-only');
const deck = await PresentationFile.importPptx(await FileBlob.load(source));
if (deck.slides.items.length !== 35) throw new Error(`Expected 35 slides, found ${deck.slides.items.length}`);
const content = await deck.inspect({ select: '$.slides[*]', include: ['id', 'index', 'layout', 'title',
  'elements.id', 'elements.kind', 'elements.name', 'elements.text', 'elements.position', 'elements.style', 'notes.text'] });
await fs.writeFile(path.join(output, 'content.ndjson'), content.ndjson);
const layouts = await deck.inspect({ kind: 'layout', maxChars: 1000000 });
await fs.writeFile(path.join(output, 'layouts.ndjson'), layouts.ndjson);
const masters = deck.masters.items.map(item => ({ id: item.id, name: item.name }));
const placeholders = deck.slides.items.map((slide, index) => ({ slide: index + 1,
  items: slide.placeholders.items.map(item => ({ id: item.id, name: item.name })) }));
await fs.writeFile(path.join(output, 'structure.json'), JSON.stringify({ masters, placeholders }, null, 2));
for (const [index, slide] of deck.slides.items.entries()) {
  const name = `slide-${String(index + 1).padStart(2, '0')}`;
  const image = await deck.export({ slide, format: 'png', scale: 1 });
  await fs.writeFile(path.join(output, `${name}.png`), new Uint8Array(await image.arrayBuffer()));
  const layout = await slide.export({ format: 'layout', detail: 'full' });
  await fs.writeFile(path.join(output, `${name}.layout.json`), await layout.text());
  console.log(`Rendered ${index + 1}/35`);
}
const montage = await deck.export({ format: 'webp', montage: true, scale: 0.4 });
await fs.writeFile(path.join(output, 'baseline-montage.webp'), new Uint8Array(await montage.arrayBuffer()));
const sha256 = createHash('sha256').update(await fs.readFile(source)).digest('hex');
await fs.writeFile(path.join(output, 'inspection_receipt.json'), JSON.stringify({ source, sha256,
  slideCount: 35, renderedSlides: 35, importedReadOnly: true, sourceModified: false,
  finalDeckCreated: false, pending: 'Current map/GPS evidence and explicit principal confirmation' }, null, 2));
console.log(JSON.stringify({ sha256, slideCount: 35, output }));
