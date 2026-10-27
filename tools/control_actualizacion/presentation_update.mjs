// Targeted updates only. Default mode validates anchors without changing a deck.
// --preview creates private previews/draft; --finalize also requires confirmed evidence.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const workspace = path.join(root, 'docs/control_actualizacion/presentacion');
const skill = 'C:/Users/USUARIO/.codex/plugins/cache/openai-primary-runtime/presentations/26.1020.11127/skills/presentations';
const runtime = 'C:/Users/USUARIO/.cache/codex-runtimes/codex-primary-runtime/dependencies';
const planPath = path.join(workspace, 'targeted_updates.json');
const hash = async file => createHash('sha256').update(await fs.readFile(file)).digest('hex');
const json = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const safe = (base, file) => {
  const resolved = path.resolve(base, file);
  const relative = path.relative(base, resolved);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`Path outside allowed directory: ${file}`);
  }
  return resolved;
};
const fresh = async file => {
  try { await fs.access(file); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
  throw new Error(`Existing output preserved: ${file}`);
};
const args = process.argv.slice(2);
if (args.some(arg => !['--check', '--preview', '--finalize'].includes(arg)) || args.length > 1) {
  throw new Error('Usage: presentation_update.mjs [--check|--preview|--finalize]');
}
const mode = args[0] ?? '--check';
const plan = await json(planPath);
const source = safe(root, plan.source);
if (await hash(source) !== plan.sourceSha256) throw new Error('Source PPTX differs from the inspected baseline');
if (plan.slideCount !== 35) throw new Error('Only the inspected 35-slide baseline is supported');
const releasePath = path.join(workspace, 'release_status.json');
const release = await json(releasePath);
const actions = structuredClone(plan.actions);
const releaseNotes = [];
const releaseEvidence = [];
if (mode === '--finalize') {
  if (release.principalConfirmed !== true) throw new Error('Finalization pending: principal confirmation required');
  for (const topic of ['map', 'gps']) {
    const state = release[topic];
    if (state?.confirmed !== true || !state.status || !Array.isArray(state.evidence) || !state.evidence.length) {
      throw new Error(`Finalization pending: current ${topic} evidence and confirmed observed status required`);
    }
    for (const item of state.evidence) {
      const evidenceFile = safe(path.join(root, 'docs/control_actualizacion'), item.file);
      if (!/^[a-f0-9]{64}$/i.test(item.sha256 ?? '') || await hash(evidenceFile) !== item.sha256.toLowerCase()) {
        throw new Error(`Invalid or changed ${topic} evidence: ${item.file}`);
      }
      releaseEvidence.push({ topic, file: evidenceFile, sha256: item.sha256 });
    }
    releaseNotes.push(`${topic.toUpperCase()}: ${state.status}`);
  }
  const overrides = release.overrides ?? [];
  for (const override of overrides) {
    const action = actions.find(item => item.type === 'text' && item.id === override.id);
    if (!action || typeof override.newText !== 'string' || !override.newText.trim()) {
      throw new Error(`Release override must identify an existing planned text action: ${override.id}`);
    }
    action.newText = override.newText;
  }
  if (plan.state !== 'READY_FOR_FINALIZATION' && (!overrides.some(item => item.id === 'sh/hwjy98rm') || !overrides.some(item => item.id === 'sh/947ipwje'))) {
    throw new Error('Finalization pending: reconcile map and GPS provisional text through release.overrides');
  }
  if (!release.visualReview?.confirmed || !release.visualReview.previewDirectory || !release.visualReview.planSha256) {
    throw new Error('Finalization pending: review the current preview and record visualReview in release_status.json');
  }
  if (release.visualReview.planSha256 !== await hash(planPath)) throw new Error('Visual review belongs to a different update plan');
  const reviewedDir = safe(workspace, release.visualReview.previewDirectory);
  const previewReceipt = await json(path.join(reviewedDir, 'preview_receipt.json'));
  if (previewReceipt.planSha256 !== await hash(planPath) || !previewReceipt.roundtripImportPassed) throw new Error('No matching reviewed preview receipt');
  const reviewedActions = JSON.stringify(previewReceipt.effectiveActions);
  if (reviewedActions !== JSON.stringify(actions)) throw new Error('Release text differs from reviewed preview. Render a fresh preview first.');
}
// Existing evidence is pinned. A changed source requires an intentional plan refresh.
for (const item of plan.evidence) {
  if (await hash(safe(root, item.file)) !== item.sha256) throw new Error(`Evidence changed; reconcile and refresh plan first: ${item.file}`);
}
const { FileBlob, PresentationFile } = await import(pathToFileURL(path.join(runtime, 'node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs')).href);
const deck = await PresentationFile.importPptx(await FileBlob.load(source));
const before = await deck.inspect({ select: '$.slides[*]', include: ['id', 'index', 'elements.id', 'elements.kind',
  'elements.text', 'elements.position', 'elements.style', 'elements.cells', 'notes.text'] });
if (deck.slides.items.length !== 35) throw new Error('Import changed the slide count');
const records = before.records;
const all = records.flatMap(slide => slide.elements);
for (const action of actions) {
  if (action.type === 'imageAdd') continue;
  const record = all.find(e => e.id === action.id);
  if (!record || records[action.slide - 1].id !== action.slideId) throw new Error(`Missing stable anchor: ${action.id}`);
  if (action.type === 'text' && record.text !== action.oldText) throw new Error(`Textbox changed: ${action.id}`);
  if (action.type === 'table') {
    const cell = deck.resolve(action.id).getCell(action.row, action.column);
    const text = String(cell.text);
    if (text !== action.oldText) throw new Error(`Table cell changed: ${action.id}[${action.row},${action.column}] = ${JSON.stringify(text)}`);
  }
}
if (mode === '--check') {
  console.log(JSON.stringify({ status: 'ANCHORS_AND_EVIDENCE_PASS', actions: actions.length, sourceUnchanged: true,
    slideCount: 35, finalizationAllowed: release.principalConfirmed === true,
    pending: plan.blockers }, null, 2));
  process.exit(0);
}
const build = path.join(workspace, '_qa', `preview-${Date.now()}`);
await fs.mkdir(build, { recursive: true });
// Preview may incorporate confirmed or still-provisional overrides for review,
// but only the finalization branch above can publish the requested output.
if (mode === '--preview') {
  for (const override of release.overrides ?? []) {
    const action = actions.find(item => item.type === 'text' && item.id === override.id);
    if (!action || typeof override.newText !== 'string') throw new Error('Invalid preview override');
    action.newText = override.newText;
  }
}
for (const action of actions) {
  if (action.type === 'imageAdd') {
    deck.resolve(action.slideId).images.add({ blob: await fs.readFile(safe(root, action.source)),
      contentType: 'image/png', alt: action.alt, fit: action.fit, frame: action.frame, crop: action.crop });
    continue;
  }
  const target = deck.resolve(action.id);
  if (action.type === 'text') target.text.replace(action.oldText, action.newText);
  else if (action.type === 'table') target.getCell(action.row, action.column).text.replace(action.oldText, action.newText);
  else if (action.type === 'image') {
    const state = { frame: target.frame, geometry: target.geometry, borderRadius: target.borderRadius,
      rotation: target.rotation, flipHorizontal: target.flipHorizontal, flipVertical: target.flipVertical,
      lockAspectRatio: target.lockAspectRatio };
    const blob = await fs.readFile(safe(root, action.source));
    target.replace({ blob, contentType: 'image/png', alt: action.alt, fit: action.fit });
    for (const [key, value] of Object.entries(state)) if (value !== undefined) target[key] = value;
    if (action.frame) target.frame = action.frame;
    target.crop = action.crop;
  }
}
for (const note of plan.notes) {
  const slide = deck.resolve(note.slideId);
  if (slide.speakerNotes.text !== note.oldText) throw new Error(`Speaker notes differ on slide ${note.slide}`);
  const existing = `Referencia preservada de la edición del 20/10/2026\n${note.oldText}`;
  slide.speakerNotes.text = `${existing}\n\nActualización del 22 de octubre de 2026\n${note.append}\nFuentes: ${note.sources.join('; ')}`;
  if ([21, 28].includes(note.slide) && releaseNotes.length) {
    slide.speakerNotes.text += `\nEstado final confirmado por el principal\n${releaseNotes.join('\n')}\nEvidencias: ${releaseEvidence.map(e => path.relative(root, e.file)).join('; ')}`;
  }
}
const after = await deck.inspect({ select: '$.slides[*]', include: ['id', 'index', 'elements.id', 'elements.kind',
  'elements.text', 'elements.position', 'elements.style', 'notes.text'] });
await fs.writeFile(path.join(build, 'after.ndjson'), after.ndjson);
const changedIds = new Set(actions.map(a => a.id));
const afterElements = after.records.flatMap(slide => slide.elements);
const violations = [];
for (const previous of all) {
  const current = afterElements.find(e => e.id === previous.id);
  if (!current) violations.push(`Deleted element ${previous.id}`);
  else {
    const approvedImageFrame = actions.find(a => a.type === 'image' && a.id === previous.id)?.frame;
    if (JSON.stringify(approvedImageFrame ?? previous.position) !== JSON.stringify(current.position)) violations.push(`Geometry changed ${previous.id}`);
    if (!changedIds.has(previous.id) && previous.text !== current.text) violations.push(`Unplanned text change ${previous.id}`);
    if (previous.kind === 'textbox' && JSON.stringify(previous.style) !== JSON.stringify(current.style)) violations.push(`Textbox style changed ${previous.id}`);
  }
}
if (violations.length) throw new Error(`Template preservation failed:\n${violations.join('\n')}`);
const changedSlides = [...new Set(actions.map(a => a.slide))];
for (const number of changedSlides) {
  const slide = deck.slides.items[number - 1];
  const stem = `slide-${String(number).padStart(2, '0')}`;
  const png = await deck.export({ slide, format: 'png', scale: 1 });
  await fs.writeFile(path.join(build, `${stem}.png`), new Uint8Array(await png.arrayBuffer()));
  await fs.writeFile(path.join(build, `${stem}.layout.json`), await (await slide.export({ format: 'layout', detail: 'full' })).text());
  console.log(`Preview ${number}/35`);
}
const candidate = path.join(build, 'candidate.pptx');
await (await PresentationFile.exportPptx(deck)).save(candidate);
const roundtrip = await PresentationFile.importPptx(await FileBlob.load(candidate));
if (roundtrip.slides.items.length !== 35) throw new Error('Roundtrip changed the slide count');
const receipt = { mode, candidate, planSha256: await hash(planPath), sourceSha256: plan.sourceSha256,
  changedSlides, effectiveActions: actions, roundtripImportPassed: true,
  geometryPreserved: true, textboxStylesPreserved: true, slideCount: 35,
  finalCreated: false, mapAndGpsReleasePending: !release.principalConfirmed };
await fs.writeFile(path.join(build, 'preview_receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`);
if (mode === '--preview') {
  console.log(JSON.stringify({ status: 'PRIVATE_DRAFT_ONLY', build, candidate, pending: plan.blockers }, null, 2));
  process.exit(0);
}
const final = safe(workspace, plan.output);
await fresh(final);
const { finalizePresentation } = await import(pathToFileURL(path.join(skill, 'container_tools/artifact_tool_utils.mjs')).href);
const result = await finalizePresentation({ workspaceDir: workspace, candidatePath: candidate, finalPath: final,
  pythonExecutable: path.join(runtime, 'python/python.exe'),
  integrityValidatorPath: path.join(skill, 'container_tools/inspect_presentation_package_integrity.py'),
  layoutValidatorPath: path.join(skill, 'container_tools/inspect_presentation_layout_geometry.py'),
  layoutArgs: ['--expected-slide-size-emu', `${plan.slideSizeEmu.cx},${plan.slideSizeEmu.cy}`,
    '--validate-bullet-geometry', '--validate-heading-fit'],
  explicitTotalSlideCount: 35,
  requiredNativeTableOwnerSlides: [3, 13, 15, 17, 20, 24, 30, 31, 32, 34],
  requiredNativeChartOwnerSlides: [], fontPolicy: plan.fontPolicy,
  verifyArtifactToolImport: true,
  receiptPath: path.join(build, 'finalization.validation.json') });
// Inspect every exported final slide at full size before actual delivery.
const finalDeck = await PresentationFile.importPptx(await FileBlob.load(final));
const finalRenders = path.join(build, 'final-slides');
await fs.mkdir(finalRenders);
for (const [index, slide] of finalDeck.slides.items.entries()) {
  const png = await finalDeck.export({ slide, format: 'png', scale: 1 });
  await fs.writeFile(path.join(finalRenders, `slide-${String(index + 1).padStart(2, '0')}.png`), new Uint8Array(await png.arrayBuffer()));
}
await fs.writeFile(path.join(build, 'delivery_receipt.json'), JSON.stringify({ final, sha256: await hash(final),
  slideCount: 35, finalizer: result, renderDirectory: finalRenders,
  visualReview: 'Review all final PNGs before delivering', releaseEvidence }, null, 2));
console.log(JSON.stringify({ final, sha256: await hash(final), finalRenders }, null, 2));
