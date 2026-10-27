import { mkdir, readFile, writeFile, stat, open } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverTools, run, probe, decode, sha256, sourcePath, parseArgs, FPS } from './video_common.mjs';

async function mp4Atoms(file) {
  const handle = await open(file, 'r');
  const atoms = [];
  try {
    const size = (await handle.stat()).size;
    let offset = 0;
    while (offset + 8 <= size) {
      const buffer = Buffer.alloc(16);
      await handle.read(buffer, 0, Math.min(16, size - offset), offset);
      let length = buffer.readUInt32BE(0);
      const type = buffer.toString('ascii', 4, 8);
      if (length === 1) length = Number(buffer.readBigUInt64BE(8));
      if (length === 0) length = size - offset;
      if (length < 8 || offset + length > size) throw new Error('MP4 truncado o átomo inválido');
      atoms.push({ type, offset, bytes: length });
      offset += length;
    }
    if (offset !== size) throw new Error('MP4 contiene bytes finales inválidos');
  } finally { await handle.close(); }
  return atoms;
}

export async function verifyVideo({ file, report, tools, qaDirectory, interval = 30, verifySources = true }) {
  if (!Number.isFinite(interval) || interval < 1) throw new Error('El intervalo de QA debe ser >= 1 segundo');
  const info = await probe(tools, file);
  const [num, den] = info.fps.split('/').map(Number);
  if (info.codec !== 'h264' || info.width !== 1920 || info.height !== 1080 || info.pixelFormat !== 'yuv420p' || Math.abs(num / den - FPS) > 0.001 || info.audioStreams !== 0 || info.sampleAspectRatio !== '1:1') {
    throw new Error(`Formato final inesperado: ${JSON.stringify(info)}`);
  }
  const tolerance = Math.max(0.15, report.sources.length / FPS);
  if (Math.abs(info.duration - report.expectedDuration) > tolerance) throw new Error(`Duración final ${info.duration} difiere de ${report.expectedDuration}`);
  const atoms = await mp4Atoms(file);
  const moov = atoms.find(atom => atom.type === 'moov');
  const mdat = atoms.find(atom => atom.type === 'mdat');
  if (!moov || !mdat || moov.offset > mdat.offset) throw new Error('MP4 sin faststart verificable');
  console.log(`Verificando decodificación completa: ${path.basename(file)}`);
  await decode(tools, file);
  const hash = await sha256(file);
  if (report.outputSha256 && report.outputSha256 !== hash) throw new Error('El hash final difiere del reporte');
  if (verifySources) {
    const root = path.dirname(file);
    if (await sha256(await sourcePath(root, report.manifest.file)) !== report.manifest.sha256) throw new Error('El manifiesto difiere del reporte');
    for (const source of report.sources) {
      const original = await sourcePath(root, source.file);
      if (await sha256(original) !== source.sha256) throw new Error(`Hash de fuente distinto: ${source.file}`);
      await probe(tools, original);
    }
  }
  await mkdir(qaDirectory, { recursive: false });
  const samples = new Map();
  function sample(time, reason) {
    const frame = Math.min(Math.max(0, Math.floor(time * FPS)), Math.max(0, Math.floor(info.duration * FPS) - 1));
    const previous = samples.get(frame);
    if (previous) previous.reasons.push(reason);
    else samples.set(frame, { seconds: frame / FPS, reasons: [reason] });
  }
  for (let time = 0; time < info.duration; time += interval) sample(time, 'interval');
  sample(info.duration - 1 / FPS, 'final');
  for (const entry of report.timeline) {
    sample((entry.start + entry.end) / 2, `${entry.type}: ${entry.title}`);
    if (entry.type === 'video') {
      sample(entry.start + Math.min(0.5, entry.duration / 4), `inicio: ${entry.title}`);
      sample(entry.end - Math.min(0.5, entry.duration / 4), `fin: ${entry.title}`);
    }
  }
  const frames = [...samples.values()].sort((a, b) => a.seconds - b.seconds);
  for (const [index, frame] of frames.entries()) {
    frame.file = `frame-${String(index).padStart(4, '0')}.jpg`;
    await run(tools.ffmpeg, ['-hide_banner', '-v', 'error', '-nostdin', '-n', '-ss', String(frame.seconds),
      '-i', file, '-map', '0:v:0', '-frames:v', '1', '-q:v', '2', '-update', '1', path.join(qaDirectory, frame.file)]);
    if ((await stat(path.join(qaDirectory, frame.file))).size === 0) throw new Error('Fotograma vacío');
  }
  const sheets = [];
  for (let offset = 0; offset < frames.length; offset += 12) {
    const count = Math.min(12, frames.length - offset);
    const sheet = `contact-${String(sheets.length).padStart(3, '0')}.jpg`;
    await run(tools.ffmpeg, ['-hide_banner', '-v', 'error', '-nostdin', '-n', '-framerate', '1', '-start_number', String(offset),
      '-i', 'frame-%04d.jpg', '-vf', `scale=480:270,tile=3x${Math.ceil(count / 3)}:nb_frames=${count}:padding=8:margin=8:color=0x101821`,
      '-frames:v', '1', '-q:v', '2', '-update', '1', sheet], { cwd: qaDirectory });
    sheets.push({ file: sheet, firstFrame: offset, count });
  }
  const contact = { interval, output: report.output, frames, sheets,
    reviewStatus: 'pending-human-review', note: 'Cada JPEG conserva la resolución final; las hojas de contacto son miniaturas.' };
  await writeFile(path.join(qaDirectory, 'contact_frames.json'), `${JSON.stringify(contact, null, 2)}\n`, 'utf8');
  return { verifiedAt: new Date().toISOString(), probe: info, sha256: hash,
    bytes: (await stat(file)).size, fullDecode: true, faststart: true, atoms,
    durationDifference: info.duration - report.expectedDuration, frameCount: frames.length, sheetCount: sheets.length,
    qaDirectory, visualReview: 'pending-human-review' };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  (async () => {
    const options = parseArgs(process.argv.slice(2));
    for (const key of Object.keys(options)) if (!['--report', '--contact-interval'].includes(key)) throw new Error(`Opción desconocida: ${key}`);
    if (!options['--report']) throw new Error('Uso: verify_video.mjs --report <video.mp4.report.json>');
    const reportFile = path.resolve(options['--report']);
    const report = JSON.parse(await readFile(reportFile, 'utf8'));
    const file = await sourcePath(path.dirname(reportFile), report.output);
    const verification = await verifyVideo({ file, report, tools: await discoverTools(),
      qaDirectory: path.join(path.dirname(file), `qa-verification-${Date.now()}`), interval: Number(options['--contact-interval'] ?? 30) });
    const destination = `${file}.verification-${Date.now()}.json`;
    await writeFile(destination, `${JSON.stringify(verification, null, 2)}\n`, { flag: 'wx' });
    console.log(`Verificación completa: ${destination}`);
  })().catch(error => { console.error(`Verificación detenida: ${error.message}`); process.exitCode = 1; });
}
