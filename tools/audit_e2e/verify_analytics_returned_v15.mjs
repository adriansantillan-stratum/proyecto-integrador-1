import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const folder = 'docs/correccion_integral/evidencias';
const reportFile = path.join(root, folder, 'calidad_java_v15.json');
const dependencies = 'C:/Users/USUARIO/.cache/codex-runtimes/codex-primary-runtime/dependencies';
const pwsh = `${dependencies}/native/powershell/pwsh.exe`;
const python = `${dependencies}/python/python.exe`;
const docker = 'C:/Program Files/Docker/Docker/resources/bin/docker.exe';
const javaHome = 'C:/Program Files/Eclipse Adoptium/jdk-17.0.17.10-hotspot';
const targetTest = 'returnedOrdersCountAsTerminalStopsWithoutChangingSharedSeed';
const migrationDir = 'src/main/resources/db/migration';
const newMigration = 'V15__analytics_returned_terminal.sql';
const mode = process.argv[2];
assert.ok(['--red', '--close'].includes(mode) && process.argv.length === 3, 'Use --red o --close');
const sha256 = data => createHash('sha256').update(data).digest('hex');
const read = file => fs.readFile(path.join(root, file), 'utf8');
const hash = async file => sha256(await fs.readFile(path.join(root, file)));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const psQuote = value => "'" + value.replaceAll("'", "''") + "'";
const redact = value => value.replace(/\bBearer\s+[^\s"'<>]+/gi, '[REDACTED]')
  .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[REDACTED_JWT]');
let report;
try { report = JSON.parse(await fs.readFile(reportFile, 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
report ||= {startedAt: new Date().toISOString(), environment: 'Local Docker / PostgreSQL 14 / JDK17',
  humanAcceptance: 'NOT_ASSESSED', commands: [],
  scope: 'Una prueba Java y V15; Flyway sin reset, exportador existente, validación SQL en contenedor desechable. Sin edición de documentación/ERD/Word/PPT.',
  baseline: {migrations: {}, sqlV14Sha256: await hash('docs/base_datos/EcoRoute_BD_Completa_V1-V14.sql')}};
const save = () => fs.writeFile(reportFile, JSON.stringify(report, null, 2) + '\n');
async function migrationHashes() {
  const result = {};
  for (const file of (await fs.readdir(path.join(root, migrationDir))).filter(file => /^V\d+__.*\.sql$/.test(file))) {
    result[file] = await hash(`${migrationDir}/${file}`);
  }
  return result;
}
async function run(name, executable, args, {input, allowFailure = false, timeout = 15 * 60 * 1000} = {}) {
  const started = Date.now();
  const entry = {name, startedAt: new Date().toISOString(), executable, arguments: args, status: 'RUNNING'};
  report.commands.push(entry); await save();
  console.log(`START ${name}`);
  const heartbeat = setInterval(() => console.log(`RUNNING ${name} (${Math.round((Date.now() - started) / 1000)} s)`), 30000);
  const result = await new Promise(resolve => {
    const child = execFile(executable, args, {cwd: root, encoding: 'utf8', shell: false, windowsHide: true,
      timeout, maxBuffer: 32 * 1024 * 1024,
      env: {...process.env, JAVA_HOME: javaHome, PYTHONDONTWRITEBYTECODE: '1',
        PATH: path.join(javaHome, 'bin') + path.delimiter + process.env.PATH}},
    (error, stdout, stderr) => resolve({error, stdout, stderr}));
    if (input !== undefined) child.stdin.end(input);
  });
  clearInterval(heartbeat);
  Object.assign(entry, {finishedAt: new Date().toISOString(), durationMs: Date.now() - started,
    exitCode: result.error ? typeof result.error.code === 'number' ? result.error.code : null : 0,
    spawnError: typeof result.error?.code === 'string' ? result.error.code : null,
    signal: result.error?.signal || null, stdout: redact(result.stdout || ''), stderr: redact(result.stderr || '')});
  entry.status = entry.exitCode === 0 ? 'PASS' : 'FAIL';
  await save(); console.log(`${entry.status} ${name} (exit ${entry.exitCode})`);
  if (!allowFailure) assert.equal(entry.exitCode, 0, `${name} falló; revisar stdout/stderr guardados`);
  return entry;
}
async function javaResults() {
  const directory = path.join(root, 'build/test-results/test');
  const suites = [];
  for (const file of (await fs.readdir(directory)).filter(file => /^TEST-.*\.xml$/.test(file))) {
    const xml = await fs.readFile(path.join(directory, file), 'utf8');
    const attributes = value => Object.fromEntries([...value.matchAll(/([\w]+)="([^"]*)"/g)].map(match => [match[1], match[2]]));
    const header = attributes(xml.match(/<testsuite\b([^>]+)>/)[1]);
    const cases = [...xml.matchAll(/<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/g)].map(match => ({
      name: attributes(match[1]).name, result: /<(failure|error)\b/.test(match[2] || '') ? 'FAIL' : /<skipped\b/.test(match[2] || '') ? 'SKIPPED' : 'PASS',
      ...(/<(failure|error)\b/.test(match[2] || '') ? {failure: redact(match[2])} : {}),
    }));
    suites.push({suite: header.name, tests: Number(header.tests), failures: Number(header.failures), errors: Number(header.errors),
      skipped: Number(header.skipped), timestamp: header.timestamp, cases, xmlSha256: sha256(xml)});
  }
  const summary = suites.reduce((total, suite) => Object.fromEntries(['tests', 'failures', 'errors', 'skipped'].map(key => [key, total[key] + suite[key]])),
    {tests: 0, failures: 0, errors: 0, skipped: 0});
  return {capturedAt: new Date().toISOString(), summary, suites};
}
async function sql(query) {
  // Read-only queries only, never prints credentials or database rows.
  const result = await run('Lectura SQL de verificación', docker,
    ['exec', 'ecoroute-db', 'psql', '-X', '-U', 'user', '-d', 'ecoroute', '-At', '-c', query], {timeout: 30000});
  return JSON.parse(result.stdout);
}
const databaseSnapshotQuery = `SELECT json_build_object(
  'migrations',(SELECT json_agg(json_build_object('version',version,'checksum',checksum,'success',success) ORDER BY installed_rank) FROM flyway_schema_history),
  'objects',(SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','v') AND c.relname<>'flyway_schema_history'),
  'view',(SELECT json_build_object('oid',c.oid::text,'owner',c.relowner::text,'acl',c.relacl::text,
    'columns',(SELECT json_agg(json_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod)) ORDER BY a.attnum) FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped),
    'definition',pg_get_viewdef(c.oid,true),'comment',obj_description(c.oid)) FROM pg_class c WHERE c.oid='analytics_route_facts'::regclass),
  'protectedRecords',json_build_object(
    'orders',(SELECT json_build_object('count',count(*),'digest',md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id)::text,''))) FROM orders t),
    'routes',(SELECT json_build_object('count',count(*),'digest',md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id)::text,''))) FROM routes t),
    'drivers',(SELECT json_build_object('count',count(*),'digest',md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id)::text,''))) FROM drivers t),
    'vehicles',(SELECT json_build_object('count',count(*),'digest',md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id)::text,''))) FROM vehicles t),
    'goals',(SELECT json_build_object('count',count(*),'digest',md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.code)::text,''))) FROM analytics_goals t),
    'goalHistory',(SELECT json_build_object('count',count(*),'digest',md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id)::text,''))) FROM analytics_goal_history t)))`;

try {
  if (mode === '--red') {
    report.baseline.migrations = await migrationHashes();
    assert.ok(!report.baseline.migrations[newMigration], 'La fase roja debe ejecutarse antes de añadir V15');
    const command = `& ${psQuote(path.join(root, 'gradlew.bat'))} test --tests '*R2dbcAnalyticsIntegrationTest.${targetTest}' --no-daemon --console=plain; exit $LASTEXITCODE`;
    const result = await run('Regresión nueva contra V14 (fallo esperado)', pwsh, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', command], {allowFailure: true});
    report.redRegression = await javaResults();
    assert.equal(result.exitCode, 1); assert.equal(report.redRegression.summary.tests, 1);
    assert.equal(report.redRegression.summary.failures, 1); assert.equal(report.redRegression.summary.skipped, 0);
    assert.ok(report.redRegression.suites.flatMap(s => s.cases).some(test => test.name.startsWith(targetTest) && test.failure?.includes('but was: 2L')));
    report.redRegression.expectedFailureConfirmed = true;
  } else {
    if (!Object.keys(report.baseline.migrations).length) report.baseline.migrations = Object.fromEntries(Object.entries(await migrationHashes()).filter(([name]) => name !== newMigration));
    report.collectorSha256 = await hash('tools/audit_e2e/verify_analytics_returned_v15.mjs');
    report.closeStartedAt = new Date().toISOString();
    report.databaseBefore = await sql(databaseSnapshotQuery);
    assert.equal(report.databaseBefore.objects, 46);
    const command = `& ${psQuote(path.join(root, 'gradlew.bat'))} test --rerun-tasks --no-daemon --console=plain; exit $LASTEXITCODE`;
    await run('Toda la suite Java con V15', pwsh, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', command]);
    report.java = await javaResults(); await save();
    assert.ok(report.java.summary.tests >= 58); assert.equal(report.java.summary.failures, 0);
    assert.equal(report.java.summary.errors, 0); assert.equal(report.java.summary.skipped, 0);
    assert.ok(report.java.suites.flatMap(s => s.cases).some(test => test.name.startsWith(targetTest) && test.result === 'PASS'));
    await run('Rebuild Docker del backend', docker, ['compose', 'build', 'ecoroute-backend']);
    await run('Recrear solo backend y aplicar Flyway (sin reset)', docker, ['compose', 'up', '-d', '--no-deps', 'ecoroute-backend']);
    let ready = false;
    for (let attempt = 0; attempt < 45; attempt++) {
      await pause(2000);
      try { const response = await fetch('http://127.0.0.1:8081/actuator/health', {signal: AbortSignal.timeout(2000)}); ready = response.status === 200; await response.arrayBuffer(); }
      catch { /* Backend may be restarting; no writes or limiter resets. */ }
      if (ready) break;
    }
    assert.ok(ready, 'Backend no quedó saludable; no se continúa con exportación');
    report.databaseAfter = await sql(databaseSnapshotQuery);
    assert.equal(report.databaseAfter.objects, 46);
    assert.ok(report.databaseAfter.migrations.some(m => m.version === '15' && m.success));
    assert.deepEqual(report.databaseAfter.migrations.filter(m => m.version !== '15'), report.databaseBefore.migrations.filter(m => m.version !== '15'));
    for (const field of ['oid', 'owner', 'acl', 'columns']) assert.deepEqual(report.databaseAfter.view[field], report.databaseBefore.view[field]);
    assert.match(report.databaseAfter.view.definition, /RETURNED/);
    report.operationalRowsUnchanged = JSON.stringify(report.databaseBefore.protectedRecords) === JSON.stringify(report.databaseAfter.protectedRecords);
    assert.ok(report.operationalRowsUnchanged, 'Registros cambiaron durante la ventana; revisar también actores concurrentes');
    await run('Exportación existente de esquema y SQL completo V1-V15', process.execPath, ['tools/audit_e2e/export_verified_data.mjs']);
    const schemaFile = `${folder}/esquema_fisico_verificado.json`;
    const schema = JSON.parse(await read(schemaFile));
    assert.equal(schema.tables.length, 46); assert.ok(schema.migrations.some(m => m.version === '15' && m.success));
    const validationFile = `${folder}/validacion_sql_completo_v15_desechable.json`;
    const code = `import sys,json; sys.path.insert(0,'tools/audit_e2e'); from build_verified_erd import verify_sql,ROOT; result=verify_sql(ROOT/'docs/base_datos/EcoRoute_BD_Completa_V1-V15.sql',ROOT/'${schemaFile}',ROOT/'${validationFile}'); print(json.dumps(result)); sys.exit(0 if result['status']=='PASS' else 1)`;
    await run('SQL V1-V15 en PostgreSQL desechable (función existente, sin generar ERD)', python, ['-B', '-X', 'utf8', '-c', code]);
    report.sqlValidation = {file: validationFile, sha256: await hash(validationFile), result: JSON.parse(await read(validationFile))};
    report.exportedSchema = {file: schemaFile, sha256: await hash(schemaFile), objects: schema.tables.length, migrations: schema.migrations};
    report.sqlV15 = {file: 'docs/base_datos/EcoRoute_BD_Completa_V1-V15.sql', sha256: await hash('docs/base_datos/EcoRoute_BD_Completa_V1-V15.sql')};
    const current = await migrationHashes();
    assert.ok(Object.entries(report.baseline.migrations).every(([file, digest]) => current[file] === digest), 'Se alteró una migración anterior');
    assert.equal(await hash('docs/base_datos/EcoRoute_BD_Completa_V1-V14.sql'), report.baseline.sqlV14Sha256);
    report.sourceReceipts = {...current, integrationTest: await hash('src/test/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcAnalyticsIntegrationTest.java')};
    report.status = 'PASS';
  }
} catch (error) {
  report.status = 'FAIL'; report.fatal = redact(error.message); process.exitCode = 1;
} finally {
  report.finishedAt = new Date().toISOString(); await save();
  console.log(JSON.stringify({mode, status: mode === '--red' && report.redRegression?.expectedFailureConfirmed ? 'EXPECTED_RED_CONFIRMED' : report.status,
    java: report.java?.summary, sql: report.sqlValidation?.result.status, fatal: report.fatal || null}));
}
