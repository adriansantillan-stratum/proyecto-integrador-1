import fs from 'node:fs/promises';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const mobile = path.join(root, 'mobile-app');
const outputArgument=process.argv.find(arg=>arg.startsWith('--output='))?.slice('--output='.length);
const output = path.resolve(root, outputArgument || 'docs/correccion_integral/evidencias/calidad_mobile.json');
if(!output.startsWith(root+path.sep)||!output.endsWith('.json'))throw new Error('Evidence output must be a JSON inside workspace');
const pwsh = 'C:/Users/USUARIO/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/powershell/pwsh.exe';
const flutter = 'C:/Users/USUARIO/flutter/bin/flutter.bat';
const launcher = path.join(mobile, 'tools/audit_e2e/run_backend_contract.ps1');
const psQuote = value => "'" + value.replaceAll("'", "''") + "'";
const sha256 = value => createHash('sha256').update(value).digest('hex');
const report = {
  schemaVersion: '1.0', startedAt: new Date().toISOString(), timezone: 'America/Lima',
  environment: 'Windows host; Flutter SDK existente; API/Keycloak locales solo para opt-in',
  collector: 'tools/audit_e2e/collect_mobile_quality.mjs',
  runtime: {node: process.execPath, nodeVersion: process.version, pwsh, flutter},
  scope: 'Evidencia técnica de análisis, pruebas host y contrato real; contextual para documentación.',
  humanAcceptance: 'NOT_ASSESSED_BY_THIS_COLLECTOR',
  limits: [
    'Pruebas host unitarias/widgets y de contrato no equivalen a UAT humana ni validación en dispositivo.',
    'No instala APK, inicia/controla AVD, usa ADB, captura POD real ni modifica fuentes/recursos móviles.',
    'Flutter puede actualizar sus cachés y salidas de pruebas host habituales; no se ejecuta pub get.',
    'El contrato usa su propia sesión DRIVER: login, refresh y logout; no modifica campos de cuentas.',
    'El contrato consulta operación propia y prueba rechazo de POD inválido con orderId=-1; no despacha ni acepta rutas.',
    'No se leen ni registran .env o credenciales por el recolector; el launcher existente resuelve la cuenta local sin imprimir secretos.',
  ],
  commands: [],
};
const save = () => fs.writeFile(output, JSON.stringify(report, null, 2) + '\n');

function redact(value) {
  let count = 0;
  const replace = pattern => {
    value = value.replace(pattern, () => { count++; return '[REDACTED_SECRET]'; });
  };
  replace(/\bBearer\s+[^\s"'<>]+/gi);
  replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g);
  replace(/\b(?:access_token|refresh_token|id_token|client_secret|password|ECOROUTE_TEST_PASSWORD)["']?\s*[:=]\s*(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s,}&\r\n]+)/gi);
  return {text: value, redactions: count};
}

async function snapshot() {
  const files = [path.relative(root, launcher), 'mobile-app/pubspec.yaml', 'mobile-app/pubspec.lock'];
  async function walk(directory) {
    for (const entry of await fs.readdir(directory, {withFileTypes: true})) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(file);
      else if (entry.isFile()) files.push(path.relative(root, file));
    }
  }
  for (const directory of ['lib', 'test', 'android/app/src', 'ios/Runner/Assets.xcassets']) {
    await walk(path.join(mobile, directory));
  }
  files.push('mobile-app/ios/Runner/Info.plist');
  const result = [];
  for (const file of files.sort()) {
    result.push({file: file.replaceAll('\\', '/'), sha256: sha256(await fs.readFile(path.join(root, file)))});
  }
  return result;
}

function parseTestCounts(stdout) {
  const plain = stdout.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');
  const progress = [...plain.matchAll(/\+(\d+)(?:\s+~(\d+))?(?:\s+-(\d+))?:/g)].at(-1);
  return progress ? {passed: Number(progress[1]), skipped: Number(progress[2] || 0),
    failed: Number(progress[3] || 0), allTestsPassedMessage: plain.includes('All tests passed!')} : null;
}

async function run(name, command, args, {expectedTests = null} = {}) {
  const startedAt = new Date().toISOString();
  const started = Date.now();
  const entry = {name, executable: pwsh, arguments: args, command,
    cwd: mobile, startedAt, expectedExecutedTests: expectedTests, status: 'RUNNING'};
  report.commands.push(entry);
  await save();
  console.log(`START ${name}`);
  const heartbeat = setInterval(() => console.log(`RUNNING ${name} (${Math.round((Date.now() - started) / 1000)} s)`), 30000);
  const result = await new Promise(resolve => {
    execFile(pwsh, args, {
      cwd: mobile, encoding: 'utf8', timeout: 10 * 60 * 1000,
      maxBuffer: 16 * 1024 * 1024, windowsHide: true, shell: false,
      env: {...process.env, PATH: path.dirname(flutter) + path.delimiter + process.env.PATH,
        CI: 'true', FLUTTER_SUPPRESS_ANALYTICS: 'true', DART_SUPPRESS_ANALYTICS: 'true'},
    }, (error, stdout, stderr) => resolve({error, stdout, stderr}));
  });
  clearInterval(heartbeat);
  const stdout = redact(result.stdout || '');
  const stderr = redact(result.stderr || '');
  Object.assign(entry, {finishedAt: new Date().toISOString(), durationMs: Date.now() - started,
    exitCode: result.error ? (typeof result.error.code === 'number' ? result.error.code : null) : 0,
    signal: result.error?.signal || null, killed: result.error?.killed || false,
    stdout: stdout.text, stderr: stderr.text, secretRedactions: stdout.redactions + stderr.redactions,
    spawnErrorCode: typeof result.error?.code === 'string' ? result.error.code : null});
  if (name !== 'Flutter analyze') entry.reportedTestCounts = parseTestCounts(entry.stdout);
  const complete = expectedTests === null || entry.reportedTestCounts?.passed === expectedTests
    && entry.reportedTestCounts.skipped === 0 && entry.reportedTestCounts.failed === 0
    && entry.reportedTestCounts.allTestsPassedMessage;
  entry.status = entry.exitCode !== 0 ? 'FAIL' : complete ? 'PASS' : 'INCOMPLETE';
  await save();
  console.log(JSON.stringify({name, status: entry.status, exitCode: entry.exitCode,
    ...(entry.reportedTestCounts ? {testCounts: entry.reportedTestCounts} : {})}));
}

try {
  await Promise.all([fs.access(pwsh), fs.access(flutter), fs.access(launcher)]);
  report.collectorSha256 = sha256(await fs.readFile(fileURLToPath(import.meta.url)));
  report.sourceSnapshotBefore = await snapshot();
  const common = ['-NoLogo', '-NoProfile', '-NonInteractive'];
  for (const subcommand of ['analyze', 'test']) {
    const command = `& ${psQuote(flutter)} ${subcommand} --no-pub; exit $LASTEXITCODE`;
    await run(subcommand === 'analyze' ? 'Flutter analyze' : 'Flutter host tests',
      `flutter ${subcommand} --no-pub`, [...common, '-Command', command]);
  }
  await run('Flutter real backend contract', 'mobile-app/tools/audit_e2e/run_backend_contract.ps1',
    [...common, '-File', launcher], {expectedTests: 8});
  const after = await snapshot();
  const beforeHashes = new Map(report.sourceSnapshotBefore.map(file => [file.file, file.sha256]));
  const afterHashes = new Map(after.map(file => [file.file, file.sha256]));
  report.sourceIntegrity = {
    filesChecked: after.length,
    changed: [...new Set([...beforeHashes.keys(), ...afterHashes.keys()])]
      .filter(file => beforeHashes.get(file) !== afterHashes.get(file)),
    scope: 'Launcher, lib/test, pubspec, Android app/src, iOS assets e Info.plist; no atribuye cambios de otros actores.',
  };
} catch (error) {
  report.fatal = redact(error.message).text;
} finally {
  report.finishedAt = new Date().toISOString();
  report.summary = {
    totalCommands: report.commands.length,
    passed: report.commands.filter(command => command.status === 'PASS').length,
    failed: report.commands.filter(command => command.status === 'FAIL').length,
    incomplete: report.commands.filter(command => command.status === 'INCOMPLETE').length,
    sourceFilesUnchanged: report.sourceIntegrity ? report.sourceIntegrity.changed.length === 0 : null,
    fatal: Boolean(report.fatal),
  };
  report.status = report.summary.totalCommands === 3 && report.summary.passed === 3
    && report.summary.sourceFilesUnchanged && !report.summary.fatal ? 'PASS' : 'FAIL';
  await save();
  console.log(JSON.stringify({status: report.status, summary: report.summary,
    evidence: path.relative(root,output)}));
  process.exitCode = report.status === 'PASS' ? 0 : 1;
}
