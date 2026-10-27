import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { access, realpath, stat } from 'node:fs/promises';
import path from 'node:path';

export const DISCLOSURE = 'Datos sintéticos · Entorno local Lima · GPS simulado';
export const FPS = 24;
export const WIDTH = 1920;
export const HEIGHT = 1080;

export function run(executable, args, { cwd, capture = true } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { cwd, shell: false, windowsHide: true,
      stdio: ['ignore', capture ? 'pipe' : 'inherit', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout?.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-24000); });
    child.once('error', reject);
    child.once('close', code => code === 0 ? resolve(stdout) : reject(new Error(
      `${path.basename(executable)} terminó con código ${code}:\n${stderr}`)));
  });
}

export async function discoverTools() {
  // Get-Command resolves WinGet's actual binaries without installing anything.
  const command = "$ErrorActionPreference='Stop'; $result=@{}; foreach ($name in @('ffmpeg','ffprobe')) { $found=Get-Command $name -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1; if (-not $found) { $pkg=Join-Path $env:LOCALAPPDATA 'Microsoft/WinGet/Packages'; $candidate=Get-ChildItem -LiteralPath $pkg -Directory -Filter 'Gyan.FFmpeg*' | ForEach-Object { Get-ChildItem -LiteralPath $_.FullName -Recurse -File -Filter ($name+'.exe') } | Select-Object -First 1; if ($candidate) { $found=Get-Command -Name $candidate.FullName -CommandType Application } }; if (-not $found) { throw ($name+' no está instalado o no es accesible') }; $result[$name]=$found.Source }; $result | ConvertTo-Json -Compress";
  const result = JSON.parse(await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command]));
  for (const name of ['ffmpeg', 'ffprobe']) {
    await access(result[name]);
    result[`${name}Version`] = (await run(result[name], ['-version'])).split(/\r?\n/)[0];
  }
  return result;
}

export async function sha256(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

export function inside(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

export async function sourcePath(root, relative) {
  if (typeof relative !== 'string' || !relative || path.isAbsolute(relative) || /^[a-z]+:/i.test(relative)) {
    throw new Error(`La fuente debe ser una ruta local relativa: ${relative}`);
  }
  const target = path.resolve(root, relative);
  if (!inside(root, target)) throw new Error(`La fuente sale del runfolder: ${relative}`);
  let resolved;
  try { resolved = await realpath(target); } catch { throw new Error(`Falta prerrequisito: ${target}`); }
  if (!inside(await realpath(root), resolved)) throw new Error(`Enlace fuera del runfolder: ${relative}`);
  if (!(await stat(resolved)).isFile()) throw new Error(`No es archivo: ${relative}`);
  return resolved;
}

export async function probe(tools, file) {
  const info = JSON.parse(await run(tools.ffprobe, ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', file]));
  const video = info.streams.find(s => s.codec_type === 'video' && !s.disposition?.attached_pic);
  const duration = Number(video?.duration ?? info.format?.duration);
  if (!video || !video.width || !video.height || !Number.isFinite(duration) || duration <= 0) {
    throw new Error(`Fuente sin video o duración válida: ${file}`);
  }
  return { duration, codec: video.codec_name, width: video.width, height: video.height,
    pixelFormat: video.pix_fmt, fps: video.avg_frame_rate, sampleAspectRatio: video.sample_aspect_ratio,
    rotation: video.side_data_list?.find(s => s.rotation !== undefined)?.rotation ?? 0,
    audioStreams: info.streams.filter(s => s.codec_type === 'audio').length };
}

export async function decode(tools, file) {
  await run(tools.ffmpeg, ['-hide_banner', '-v', 'error', '-xerror', '-err_detect', 'explode',
    '-i', file, '-map', '0:v:0', '-an', '-sn', '-f', 'null', '-']);
}

export function parseArgs(args, booleans = []) {
  const parsed = {};
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (!key.startsWith('--')) throw new Error(`Argumento inesperado: ${key}`);
    if (booleans.includes(key)) parsed[key] = true;
    else {
      if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`Falta valor: ${key}`);
      parsed[key] = args[++i];
    }
  }
  return parsed;
}

export async function assertNew(file) {
  try { await access(file); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
  throw new Error(`El destino ya existe; se conserva sin sobrescribir: ${file}`);
}
