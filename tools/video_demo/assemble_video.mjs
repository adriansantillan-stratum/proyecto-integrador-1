import { mkdir, readFile, writeFile, copyFile, stat, rename, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, createHash } from 'node:crypto';
import { DISCLOSURE, FPS, WIDTH, HEIGHT, run, discoverTools, sha256, inside, sourcePath,
  probe, decode, parseArgs, assertNew } from './video_common.mjs';
import { verifyVideo } from './verify_video.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const DEFAULT_MANIFEST = path.join(ROOT, 'docs/videos/ecoroute_e2e_20261022/segments.json');

function cleanText(value, name) {
  if (typeof value !== 'string' || !value.trim() || /[\x00-\x1f]/.test(value) || value.length > 500) {
    throw new Error(`${name}: texto no vacío, de una línea, máximo 500 caracteres`);
  }
  return value.trim();
}

function wrap(value, width) {
  const lines = [''];
  for (const word of value.split(/\s+/)) {
    const last = lines.length - 1;
    if (lines[last] && lines[last].length + word.length + 1 > width) lines.push(word);
    else lines[last] += `${lines[last] ? ' ' : ''}${word}`;
  }
  return lines.join('\n');
}

function draw(file, size, x, y, color = 'white') {
  // Only fixed ASCII relative filenames enter filters. Text lives in UTF-8 files;
  // expansion=none also preserves %, apostrophes, colons and backslashes literally.
  return `drawtext=fontfile=font.ttf:textfile=${file}:expansion=none:fontsize=${size}:fontcolor=${color}:x=${x}:y=${y}`;
}

const ENCODE = ['-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
  '-r', String(FPS), '-video_track_timescale', '24000', '-fps_mode', 'cfr', '-threads', '4', '-movflags', '+faststart'];

async function renderCard(tools, work, output, titleFile, seconds, initial) {
  const filter = [
    draw(titleFile, initial ? 66 : 48, '(w-text_w)/2', initial ? '400' : '430'),
    draw('disclosure.txt', 30, '(w-text_w)/2', '640', '0xb9c9d8'),
    draw('label.txt', 26, '(w-text_w)/2', '320', '0x65dfbc'),
  ].join(',');
  await run(tools.ffmpeg, ['-hide_banner', '-v', 'error', '-nostdin', '-n', '-f', 'lavfi',
    '-i', `color=c=0x101821:s=${WIDTH}x${HEIGHT}:r=${FPS}`, '-t', String(seconds), '-vf', filter,
    ...ENCODE, output], { cwd: work });
}

export async function assemble(options = {}) {
  const manifestPath = path.resolve(options['--manifest'] ?? DEFAULT_MANIFEST);
  let raw;
  try { raw = await readFile(manifestPath, 'utf8'); }
  catch (error) { throw new Error(`Falta prerrequisito o manifiesto ilegible: ${manifestPath}\n${error.message}`); }
  const manifest = JSON.parse(raw.replace(/^\uFEFF/, ''));
  const runfolder = await realpath(path.dirname(manifestPath));
  const qaRoot = path.join(HERE, '_qa');
  const qaOnly = Boolean(options['--qa']);
  if (qaOnly && !inside(qaRoot, runfolder)) throw new Error('--qa requiere un manifiesto dentro de tools/video_demo/_qa');
  if (!qaOnly && inside(qaRoot, runfolder)) throw new Error('El material de QA requiere --qa; no se puede montar como entrega');
  const title = cleanText(manifest.title, 'title');
  if (!Array.isArray(manifest.segments) || !manifest.segments.length) throw new Error('Falta prerrequisito: segments debe contener clips reales');
  const filename = manifest.output;
  if (typeof filename !== 'string' || path.basename(filename) !== filename || !/\.mp4$/i.test(filename) || /[:\\/]/.test(filename)) {
    throw new Error('output debe ser un nombre MP4 simple dentro del runfolder');
  }
  const output = path.join(runfolder, filename);
  const reportPath = `${output}.report.json`;
  await assertNew(output);
  await assertNew(reportPath);
  const prepared = [];
  for (const [index, segment] of manifest.segments.entries()) {
    const file = await sourcePath(runfolder, segment.file);
    if (!/\.(webm|mp4|mov|mkv)$/i.test(file)) throw new Error(`Se requiere una grabación de video: ${segment.file}`);
    if (file === output) throw new Error('La salida no puede ser una fuente');
    if (!['web', 'mobile'].includes(segment.kind)) throw new Error(`kind inválido en segmento ${index + 1}`);
    const speed = segment.speed ?? 1;
    if (typeof speed !== 'number' || !Number.isFinite(speed) || speed < 0.25 || speed > 8) throw new Error(`speed inválido: ${index + 1}`);
    prepared.push({ file: segment.file, absolutePath: file, title: cleanText(segment.title, `segments[${index}].title`), kind: segment.kind, speed });
  }
  // Validate every prerequisite before creating render artifacts.
  const tools = await discoverTools();
  console.log(`FFmpeg: ${tools.ffmpegVersion}\nValidando ${prepared.length} grabaciones; QA=${qaOnly}`);
  for (const segment of prepared) {
    console.log(`Validando y decodificando: ${segment.file}`);
    const before = await stat(segment.absolutePath);
    segment.probe = await probe(tools, segment.absolutePath);
    await decode(tools, segment.absolutePath);
    segment.sha256 = await sha256(segment.absolutePath);
    const after = await stat(segment.absolutePath);
    if (before.size !== after.size || before.mtimeMs !== after.mtimeMs) throw new Error(`Fuente aún en grabación o modificada: ${segment.file}`);
    segment.bytes = after.size;
    segment.mtimeMs = after.mtimeMs;
    segment.decodeValidated = true;
  }
  const work = path.join(runfolder, `.assembly-${Date.now()}-${randomUUID().slice(0, 8)}`);
  await mkdir(work);
  const font = process.env.VIDEO_DEMO_FONT ?? 'C:/Windows/Fonts/segoeui.ttf';
  await copyFile(font, path.join(work, 'font.ttf'));
  await writeFile(path.join(work, 'disclosure.txt'), DISCLOSURE, 'utf8');
  await writeFile(path.join(work, 'label.txt'), 'EcoRoute · Demostración end-to-end', 'utf8');
  await writeFile(path.join(work, 'initial.txt'), wrap(title, 42), 'utf8');
  const parts = [], timeline = [];
  let cursor = 0;
  const append = async (name, type, segmentIndex, displayTitle) => {
    const info = await probe(tools, path.join(work, name));
    parts.push(name);
    timeline.push({ type, segmentIndex, title: displayTitle, start: cursor, end: cursor + info.duration, duration: info.duration, renderedFile: path.relative(runfolder, path.join(work, name)).replaceAll('\\', '/') });
    cursor += info.duration;
    return info.duration;
  };
  await renderCard(tools, work, 'part-0000.mp4', 'initial.txt', 3, true);
  await append('part-0000.mp4', 'title', null, title);
  const chapters = !options['--no-chapters'];
  for (const [index, segment] of prepared.entries()) {
    console.log(`Componiendo ${index + 1}/${prepared.length}: ${segment.title}`);
    const textfile = `title-${index}.txt`;
    const cardfile = `card-${index}.txt`;
    const bandTitle = segment.title.length > 105 ? `${segment.title.slice(0, 102)}…` : segment.title;
    await writeFile(path.join(work, textfile), bandTitle, 'utf8');
    await writeFile(path.join(work, cardfile), wrap(segment.title, 57), 'utf8');
    if (chapters) {
      const name = `part-${String(parts.length).padStart(4, '0')}.mp4`;
      await renderCard(tools, work, name, cardfile, 2, false);
      await append(name, 'chapter', index, segment.title);
    }
    const name = `part-${String(parts.length).padStart(4, '0')}.mp4`;
    const filter = [
      `setpts=(PTS-STARTPTS)/${segment.speed}`, `fps=${FPS}`,
      'scale=1920:984:force_original_aspect_ratio=decrease:force_divisible_by=2:reset_sar=1',
      'pad=1920:1080:(ow-iw)/2:96+(984-ih)/2:color=0x101821',
      'drawbox=x=0:y=0:w=iw:h=96:color=0x182635:t=fill',
      draw(textfile, segment.title.length > 80 ? 28 : 32, '40', '10'),
      draw('disclosure.txt', 24, '40', '58', '0xb9c9d8'),
      'setsar=1', 'format=yuv420p',
    ].join(',');
    await run(tools.ffmpeg, ['-hide_banner', '-v', 'error', '-nostdin', '-n', '-i', segment.absolutePath,
      '-map', '0:v:0', '-vf', filter, ...ENCODE, name], { cwd: work });
    segment.renderedDuration = await append(name, 'video', index, segment.title);
    segment.expectedDuration = segment.probe.duration / segment.speed;
    segment.durationDifference = segment.renderedDuration - segment.expectedDuration;
    if (Math.abs(segment.durationDifference) > 0.15) {
      throw new Error(`Duración inesperada tras aplicar speed en ${segment.file}: ${segment.renderedDuration} frente a ${segment.expectedDuration}`);
    }
  }
  const escapeMeta = text => text.replace(/[\\=;#\n]/g, char => `\\${char}`);
  const metadata = [';FFMETADATA1', `title=${escapeMeta(title)}`, `comment=${escapeMeta(DISCLOSURE)}`];
  for (const entry of timeline.filter(item => item.type !== 'chapter')) {
    metadata.push('[CHAPTER]', 'TIMEBASE=1/1000', `START=${Math.round(entry.start * 1000)}`, `END=${Math.round(entry.end * 1000)}`, `title=${escapeMeta(entry.title)}`);
  }
  await writeFile(path.join(work, 'chapters.ffmeta'), `${metadata.join('\n')}\n`, 'utf8');
  await writeFile(path.join(work, 'concat.txt'), parts.map(name => `file '${name}'`).join('\n'), 'utf8');
  await run(tools.ffmpeg, ['-hide_banner', '-v', 'error', '-nostdin', '-n', '-f', 'concat', '-safe', '1',
    '-i', 'concat.txt', '-f', 'ffmetadata', '-i', 'chapters.ffmeta', '-map', '0:v:0', '-map_metadata', '1',
    '-map_chapters', '1', '-c', 'copy', '-an', '-movflags', '+faststart', 'assembled.partial.mp4'], { cwd: work });
  for (const segment of prepared) {
    const now = await stat(segment.absolutePath);
    if (now.size !== segment.bytes || now.mtimeMs !== segment.mtimeMs || await sha256(segment.absolutePath) !== segment.sha256) {
      throw new Error(`La fuente cambió durante el montaje: ${segment.file}`);
    }
  }
  if (await sha256(manifestPath) !== createHash('sha256').update(raw).digest('hex')) throw new Error('El manifiesto cambió durante el montaje');
  const report = { schemaVersion: 1, createdAt: new Date().toISOString(), qaOnly, title, disclosure: DISCLOSURE,
    manifest: { file: path.basename(manifestPath), sha256: await sha256(manifestPath) }, output: filename,
    settings: { width: WIDTH, height: HEIGHT, fps: FPS, codec: 'h264', pixelFormat: 'yuv420p', preset: 'veryfast', crf: 20,
      titleSeconds: 3, chapterSeconds: chapters ? 2 : 0, audio: false, faststart: true },
    tools, font: { path: font, sha256: await sha256(path.join(work, 'font.ttf')) },
    workDirectory: path.relative(runfolder, work).replaceAll('\\', '/'),
    sources: prepared.map(({ absolutePath, ...rest }) => rest), timeline, expectedDuration: cursor };
  const verification = await verifyVideo({ file: path.join(work, 'assembled.partial.mp4'), report, tools,
    qaDirectory: path.join(work, 'qa'), interval: Number(options['--contact-interval'] ?? 30), verifySources: false });
  report.verification = verification;
  report.outputSha256 = verification.sha256;
  report.outputDuration = verification.probe.duration;
  report.visualReview = { status: 'pending-human-review', contactFrames: path.relative(runfolder, path.join(work, 'qa/contact_frames.json')).replaceAll('\\', '/'),
    note: 'Fotogramas extraídos; el responsable debe revisar legibilidad, acciones y resultado del proceso.' };
  await assertNew(output);
  await rename(path.join(work, 'assembled.partial.mp4'), output);
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
  console.log(`Listo: ${output}\nReporte: ${reportPath}\nQA: ${path.join(work, 'qa')}\nRevisión visual pendiente.`);
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = parseArgs(process.argv.slice(2), ['--qa', '--no-chapters']);
  const allowed = ['--manifest', '--qa', '--no-chapters', '--contact-interval'];
  for (const key of Object.keys(options)) if (!allowed.includes(key)) throw new Error(`Opción desconocida: ${key}`);
  assemble(options).catch(error => { console.error(`Montaje detenido: ${error.message}`); process.exitCode = 1; });
}
