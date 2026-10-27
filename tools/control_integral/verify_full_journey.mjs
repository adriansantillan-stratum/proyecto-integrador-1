/**
 * Local, read-only journey verifier. Node >= 20; docker/psql from documented local setup.
 * node tools/control_integral/verify_full_journey.mjs --stage dispatched
 * node tools/control_integral/verify_full_journey.mjs --verdicts-only (existing files only; no HTTP/SQL)
 * Stages: baseline, assigned, dispatched, offline, final. No implicit stage.
 * Optional: --fixture <path> --api <loopback URL> --keycloak <loopback URL>
 *   --container <name> --db <name> --db-user <name> --timeout-ms <milliseconds>
 * Credentials: parse documented get-token.ps1 defaults; optional ECOROUTE_ADMIN_PASSWORD.
 * Never reads .env. Only POST is a new Keycloak login; all business HTTP requests are GET.
 * SQL uses REPEATABLE READ READ ONLY. Snapshots are never reused across invocations.
 * fixture.expectedStages[stage] may override routeStatus, orderStatuses (id -> status),
 * approved and accepted. Final statuses must agree with scenario SUCCESS/FAILED.
 * Offline defaults to dispatched server state: pending mobile evidence is not observable here.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {createHash, randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const videoRun=process.env.ECOROUTE_VIDEO_RUN;
if(videoRun&&!/^ecoroute_[a-z0-9_]+$/.test(videoRun))throw Error('Invalid isolated video run');
const updateRun=process.env.ECOROUTE_UPDATE_RUN;
if(updateRun&&updateRun!=='control_actualizacion')throw Error('Invalid update evidence folder');
if(updateRun&&videoRun)throw Error('Select one evidence run');
const outputDir = path.join(root, updateRun?'docs/control_actualizacion/evidencias/e2e_post_update':videoRun?'docs/videos/'+videoRun:'docs/control_integral_20261022/e2e_cierre');
const stages = ['baseline', 'assigned', 'dispatched', 'offline', 'final'];
const verdictsOnly = process.argv.length === 3 && process.argv[2] === '--verdicts-only';
const options = {fixture: path.join(outputDir, 'fixture.json'), api: 'http://localhost:8081',
  keycloak: 'http://localhost:8080', container: 'ecoroute-db', db: 'ecoroute', 'db-user': 'user', 'timeout-ms': '20000'};
for (let i = 2; !verdictsOnly && i < process.argv.length; i += 2) {
  const key = process.argv[i]?.slice(2), value = process.argv[i + 1];
  if (!process.argv[i]?.startsWith('--') || !['stage', ...Object.keys(options)].includes(key) || !value) {
    console.error('Uso: node tools/control_integral/verify_full_journey.mjs --stage baseline|assigned|dispatched|offline|final');
    process.exit(2);
  }
  options[key] = value;
}
assert.ok(verdictsOnly || stages.includes(options.stage), 'Indique --stage baseline|assigned|dispatched|offline|final o --verdicts-only');
for (const key of ['api', 'keycloak']) {
  const u = new URL(options[key]);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(u.hostname) && ['http:', 'https:'].includes(u.protocol)
    && !u.username && !u.password && !u.search && !u.hash && u.pathname === '/', 'Solo URLs locales sin credenciales');
  options[key] = u.origin;
}
for (const key of ['container', 'db', 'db-user']) assert.match(options[key], /^[a-zA-Z0-9_][a-zA-Z0-9_.-]*$/);
const timeout = Number(options['timeout-ms']);
assert.ok(Number.isInteger(timeout) && timeout >= 1000 && timeout <= 60000);
assert.ok(!/(^|[\\/])\.env(?:[.\\/]|$)/i.test(options.fixture), 'No se admite .env como fixture');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const now = () => new Date().toLocaleString('sv-SE', {timeZone: 'America/Lima', hour12: false}).replace(' ', 'T') + '-05:00';
let secrets = [], token, file, report;
const safe = text => secrets.reduce((s, secret) => secret ? s.replaceAll(secret, '[REDACTED]') : s,
  String(text).replace(/\bBearer\s+[^\s"<>]+/gi, '[REDACTED]').replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[REDACTED_JWT]'));
const save = async () => {
  const bytes = Buffer.from(safe(JSON.stringify(report, null, 2)) + '\n');
  await file.truncate(0); await file.write(bytes, 0, bytes.length, 0); await file.sync();
};
async function step(name, fn) {
  const entry = {name, startedAt: now(), result: 'RUNNING'};
  report.steps.push(entry); await save();
  try { entry.evidence = await fn(); entry.result = 'PASS'; }
  catch (e) { entry.result = 'FAIL'; entry.error = safe(e.message); }
  entry.finishedAt = now(); await save();
  return entry.result === 'PASS' ? entry.evidence : undefined;
}
async function get(endpoint, {status = 200, binary = false} = {}) {
  assert.ok(token, 'Sesion admin no disponible');
  const response = await fetch(options.api + endpoint, {headers: {Authorization: `Bearer ${token}`},
    redirect: 'error', signal: AbortSignal.timeout(timeout)});
  report.http.push({method: 'GET', endpoint, status: response.status, at: now()});
  assert.equal(response.status, status, `GET ${endpoint}: HTTP ${response.status}, esperado ${status}`);
  if (status === 404) { await response.body?.cancel(); return {status}; }
  return binary ? {bytes: Buffer.from(await response.arrayBuffer()), contentType: response.headers.get('content-type')}
    : response.json();
}
async function sql(query) {
  const input = `BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;\nSET LOCAL TIME ZONE 'America/Lima';\nSET LOCAL statement_timeout = '${timeout}ms';\n${query}\nCOMMIT;\n`;
  const stdout = await new Promise((resolve, reject) => {
    const child = execFile('docker', ['exec', '-i', options.container, 'psql', '-X', '-qAt', '-U', options['db-user'],
      '-d', options.db, '-v', 'ON_ERROR_STOP=1'], {cwd: root, windowsHide: true, encoding: 'utf8',
      timeout: timeout + 5000, maxBuffer: 8 * 1024 * 1024}, (error, out, err) =>
      error ? reject(new Error(`SQL read failed (${error.code ?? 'unknown'}): ${safe(err || 'docker/psql unavailable')}`)) : resolve(out));
    child.stdin.on('error', () => {}); child.stdin.end(input);
  });
  return JSON.parse(stdout.trim());
}
const arrayQuery = (query) => `(SELECT COALESCE(json_agg(x),'[]'::json) FROM (${query}) x)`;
const same = (actual, expected, message) => assert.deepEqual(actual, expected, message);
const select = (obj, keys) => Object.fromEntries(keys.map(k => [k, obj?.[k] ?? null]));
const canonical = rows => [...rows].map(x => JSON.stringify(x)).sort();

async function writeStageVerdicts() {
  const currentFixtureSha256 = sha(await fs.readFile(path.resolve(root, options.fixture)));
  const attempts = [], unreadable = [];
  const pattern = /^server_(baseline|assigned|dispatched|offline|final)(?:_[\w-]+)?\.json$/;
  for (const name of (await fs.readdir(outputDir)).filter(n => pattern.test(n)).sort()) {
    try {
      const bytes = await fs.readFile(path.join(outputDir, name));
      const snapshot = JSON.parse(bytes.toString('utf8'));
      assert.equal(snapshot.stage, name.match(pattern)[1], 'Stage/filename mismatch');
      assert.ok(['PASS', 'FAIL', 'RUNNING'].includes(snapshot.result), 'Invalid snapshot result');
      attempts.push({file: name, sha256: sha(bytes), stage: snapshot.stage, fixtureSha256: snapshot.fixtureSha256 ?? null,
        currentFixture: snapshot.fixtureSha256 === currentFixtureSha256, startedAt: snapshot.startedAt,
        finishedAt: snapshot.finishedAt ?? null, result: snapshot.result, summary: snapshot.summary ?? null,
        failedSteps: snapshot.steps.filter(s => s.result === 'FAIL').map(s => ({name: s.name, error: s.error ?? null}))});
    } catch (error) { unreadable.push({file: name, error: safe(error.message)}); }
  }
  attempts.sort((a,b) => Date.parse(a.startedAt) - Date.parse(b.startedAt) || a.file.localeCompare(b.file));
  const verdicts = Object.fromEntries(stages.map(stage => {
    const matching = attempts.filter(a => a.stage === stage && a.currentFixture);
    const latest = matching.at(-1), failures = matching.filter(a => a.result === 'FAIL');
    return [stage, {verdict: !latest ? 'NOT_CAPTURED' : latest.result === 'PASS' && failures.length ? 'PASS_WITH_PRIOR_FAILURES' : latest.result,
      latestResult: latest?.result ?? null, latestAttempt: latest?.file ?? null,
      attemptCount: matching.length, failedAttemptCount: failures.length, attempts: matching.map(a => a.file)}];
  }));
  const index = {schemaVersion: 1, generatedAt: now(), timezone: 'America/Lima', currentFixtureSha256,
    policy: 'Latest observation determines current result; every prior FAIL and its errors remain visible. No retrospective stages reconstructed.',
    journeyFinal: verdicts.final.latestResult ?? 'NOT_CAPTURED', stages: verdicts, attempts, unreadable,
    provenance: {baselineSql: 'NOT_CAPTURED; principal reports prior screenshots 01/02 only. No historical SQL inferred.',
      assignedSql: 'NOT_CAPTURED before dispatch.',
      mobileQueue: 'Separate UI evidence from principal; server snapshots do not attest native durability or capture.'}};
  const destination = path.join(outputDir, 'server_stage_verdicts.json');
  await fs.writeFile(destination, safe(JSON.stringify(index, null, 2)) + '\n');
  return {file: destination, stages: Object.fromEntries(stages.map(s => [s, verdicts[s].verdict])), unreadableCount: unreadable.length};
}

await fs.mkdir(outputDir, {recursive: true});
if (verdictsOnly) {
  console.log(JSON.stringify(await writeStageVerdicts()));
  process.exit(0);
}
let outputPath = path.join(outputDir, `server_${options.stage}.json`);
try { file = await fs.open(outputPath, 'wx'); }
catch (e) {
  if (e.code !== 'EEXIST') throw e;
  outputPath = path.join(outputDir, `server_${options.stage}_${now().replace(/[:]/g, '')}_${randomUUID().slice(0, 8)}.json`);
  file = await fs.open(outputPath, 'wx');
}
report = {schemaVersion: 1, stage: options.stage, startedAt: now(), timezone: 'America/Lima', result: 'RUNNING',
  scope: 'LOCAL_READ_ONLY', businessAcceptance: 'NOT_ATTESTED', steps: [], http: [],
  limits: ['Synthetic fixture; no business effectiveness inferred.', 'Mobile queue/native capture requires separate UI evidence.',
    'No historical SQL reconstructed. A baseline stage only observes its execution time.',
    'Concurrent actors can change data between HTTP and SQL reads. No automatic business retries.'],
  safety: {businessHttpMethods: ['GET'], sqlTransaction: 'REPEATABLE READ READ ONLY',
    auth: 'Own Keycloak password-grant session; token held only in memory', envFilesRead: false, mediaBytesStored: false}};
await save();
try {
  const fixture = await step('fixture', async () => {
    const bytes = await fs.readFile(path.resolve(root, options.fixture));
    const f = JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
    for (const key of ['routeId', 'driverId', 'vehicleId']) assert.ok(Number.isSafeInteger(f[key]) && f[key] > 0, key);
    assert.match(f.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(new Date(f.date + 'T00:00:00Z').toISOString().slice(0, 10), f.date, 'Invalid date');
    assert.ok(Array.isArray(f.orders) && f.orders.length > 0);
    for (const o of f.orders) {
      assert.ok(Number.isSafeInteger(o.id) && o.id > 0 && typeof o.trackingNumber === 'string' && o.trackingNumber.trim());
      assert.ok(['SUCCESS', 'DELIVERED', 'FAILED'].includes(o.scenario), `Scenario no soportado: pedido ${o.id}`);
    }
    same(new Set(f.orders.map(o => o.id)).size, f.orders.length, 'Duplicate IDs');
    same(new Set(f.orders.map(o => o.trackingNumber)).size, f.orders.length, 'Duplicate tracking numbers');
    report.fixtureSha256 = sha(bytes);
    report.fixture = select(f, ['routeId', 'driverId', 'vehicleId', 'date', 'orders']);
    report.connection = {api: options.api, keycloak: options.keycloak, container: options.container, database: options.db,
      dbUser: options['db-user'], configSources: ['README.md', 'GUIA_COMPLETA.md', 'get-token.ps1'], timeoutMs: timeout};
    return f;
  });
  assert.ok(fixture, 'Fixture no disponible o invalido; no se inicia conexion');
  const {routeId, driverId, vehicleId, date, orders} = fixture;
  const ids = orders.map(o => o.id).join(',');
  const stage = options.stage;
  const expected = {routeStatus: ['baseline', 'assigned'].includes(stage) ? 'PLANNED' : stage === 'final' ? 'COMPLETED' : 'IN_PROGRESS',
    approved: stage !== 'baseline', accepted: ['dispatched', 'offline', 'final'].includes(stage),
    orderStatuses: Object.fromEntries(orders.map(o => [o.id, stage === 'baseline' ? 'PENDING' : stage === 'assigned' ? 'ASSIGNED'
      : stage === 'final' ? (o.scenario === 'FAILED' ? 'FAILED' : 'DELIVERED') : 'IN_TRANSIT']))};
  const override = fixture.expectedStages?.[stage];
  if (override) {
    for (const k of Object.keys(override)) assert.ok(['routeStatus', 'approved', 'accepted', 'orderStatuses'].includes(k), 'Unknown expectation');
    Object.assign(expected, override, {orderStatuses: {...expected.orderStatuses, ...override.orderStatuses}});
  }
  for (const o of orders) {
    assert.ok(['PENDING', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'FAILED'].includes(expected.orderStatuses[o.id]));
    if (stage === 'final') same(expected.orderStatuses[o.id], o.scenario === 'FAILED' ? 'FAILED' : 'DELIVERED');
  }
  if (stage === 'final') same(expected.routeStatus, 'COMPLETED');
  report.expected = expected;
  const where = `driver_id=${driverId} AND operation_date=DATE '${date}'`;
  const fixtureQuery = `SELECT json_build_object(
    'transactionReadOnly',current_setting('transaction_read_only'),
    'route',(SELECT row_to_json(r) FROM (SELECT id,driver_id,vehicle_id,route_date,status,actual_start_time,actual_end_time FROM routes WHERE id=${routeId}) r),
    'resources',json_build_object('driverActive',(SELECT is_active FROM drivers WHERE id=${driverId}),
      'vehicleActive',(SELECT is_active FROM vehicles WHERE id=${vehicleId})),
    'review',(SELECT row_to_json(r) FROM (SELECT route_id,approved_by,approved_at,accepted_by,accepted_at FROM route_dispatch_reviews WHERE route_id=${routeId}) r),
    'orders',${arrayQuery(`SELECT id,tracking_number,route_id,status FROM orders WHERE id IN (${ids}) ORDER BY id`)},
    'routeOrderIds',${arrayQuery(`SELECT id FROM orders WHERE route_id=${routeId} ORDER BY id`)},
    'proofs',${arrayQuery(`SELECT id,order_id,image_sha256,signature_sha256,verified_at,captured_at,received_at,latitude,longitude,receiver_name,receiver_dni,
      NULLIF(BTRIM(image_url),'') IS NOT NULL AS has_photo,NULLIF(BTRIM(signature_data_url),'') IS NOT NULL AS has_signature
      FROM delivery_proofs WHERE order_id IN (${ids}) ORDER BY id`)},
    'history',${arrayQuery(`SELECT id,order_id,status,reason,changed_by,created_at FROM order_status_history WHERE order_id IN (${ids}) ORDER BY id`)},
    'incidents',${arrayQuery(`SELECT id,route_id,order_id,incident_type,description,status,outcome,resolution_reason,reported_by,resolved_by,reported_at,resolved_at FROM incidents WHERE order_id IN (${ids}) ORDER BY id`)},
    'facts',${arrayQuery(`SELECT order_id,status,driver_id,operation_date,complete_pod FROM analytics_order_facts WHERE order_id IN (${ids}) ORDER BY order_id`)});`;
  const sqlState = await step('SQL fixture snapshot', () => sql(fixtureQuery));
  await step('Own admin session', async () => {
    const config = await fs.readFile(path.join(root, 'get-token.ps1'), 'utf8');
    const username = config.match(/\[string\]\$Username\s*=\s*"([^"]+)"/)?.[1];
    const password = process.env.ECOROUTE_ADMIN_PASSWORD || config.match(/\[string\]\$Password\s*=\s*"([^"]+)"/)?.[1];
    const client = config.match(/client_id\s*=\s*"([^"]+)"/)?.[1];
    assert.ok(username && password && client, 'No se encontro configuracion documentada'); secrets.push(password);
    const response = await fetch(options.keycloak + '/realms/ecoroute/protocol/openid-connect/token', {method: 'POST',
      redirect: 'error', body: new URLSearchParams({client_id: client, grant_type: 'password', username, password}), signal: AbortSignal.timeout(timeout)});
    assert.equal(response.status, 200, `Keycloak HTTP ${response.status}`);
    const body = await response.json(); token = body.access_token; assert.ok(typeof token === 'string'); secrets.push(token);
    const session = await get('/session/me');
    const roles = session.roles.map(r => typeof r === 'string' ? r : r.authority);
    assert.ok(roles.includes('ROLE_ADMIN') || roles.includes('ADMIN'), 'Sesion sin rol ADMIN');
    return {roles, ownSession: true};
  });
  await step('SQL stage expectations', async () => {
    assert.ok(sqlState, 'SQL snapshot unavailable'); same(sqlState.transactionReadOnly, 'on');
    assert.ok(sqlState.route, 'Route missing');
    same(select(sqlState.route, ['id', 'driver_id', 'vehicle_id', 'route_date', 'status']),
      {id: routeId, driver_id: driverId, vehicle_id: vehicleId, route_date: date, status: expected.routeStatus});
    same(sqlState.resources, {driverActive: true, vehicleActive: true});
    same(sqlState.orders.length, orders.length);
    for (const o of orders) {
      const actual = sqlState.orders.find(r => r.id === o.id);
      same(actual, {id: o.id, tracking_number: o.trackingNumber, route_id: stage === 'baseline' ? null : routeId, status: expected.orderStatuses[o.id]});
    }
    same(sqlState.routeOrderIds.map(r => r.id).sort((a,b) => a-b), stage === 'baseline' ? [] : orders.map(o => o.id).sort((a,b) => a-b));
    if (['dispatched','offline','final'].includes(stage)) assert.ok(sqlState.route.actual_start_time);
    if (stage === 'final') assert.ok(sqlState.route.actual_end_time && Date.parse(sqlState.route.actual_end_time) >= Date.parse(sqlState.route.actual_start_time));
    return {validated: true};
  });
  await step('GET route and review vs SQL', async () => {
    const routes = await get('/routes?date=' + date);
    const route = routes.find(r => r.id === routeId); assert.ok(route);
    same(select(route, ['driverId','vehicleId','routeDate','status']),
      {driverId, vehicleId, routeDate: date, status: sqlState?.route?.status});
    const review = await get(`/routes/${routeId}/review`);
    report.review = select(review, ['routeId','approved','accepted','approvedBy','approvedAt','acceptedBy','acceptedAt']);
    same(review.approved, expected.approved); same(review.accepted, expected.accepted);
    same(review.approved, Boolean(sqlState?.review?.approved_at)); same(review.accepted, Boolean(sqlState?.review?.accepted_at));
    return {route: select(route, ['id','status','driverId','vehicleId','routeDate']), review: report.review};
  });
  // Hash operational records around GET /path only. No dispatch endpoint is called.
  const pathFingerprint = `SELECT json_build_object('route',(SELECT md5(to_jsonb(r)::text) FROM routes r WHERE id=${routeId}),
    'orders',${arrayQuery(`SELECT id,md5(to_jsonb(o)::text) AS digest FROM orders o WHERE route_id=${routeId} ORDER BY id`)});`;
  await step('GET route path side effects', async () => {
    const before = await sql(pathFingerprint);
    let failure, response;
    try { response = await get(`/routes/${routeId}/path`); } catch (e) { failure = e; }
    const after = await sql(pathFingerprint);
    report.routePath = {before, after, unchanged: JSON.stringify(before) === JSON.stringify(after),
      source: response?.source ?? null, codeFinding: 'RouteController.getRoutePath -> RoutePlannerService.plan -> RoutingPort.optimizePath; no repository saves. Writes occur in dispatch calculateRouteDistance.'};
    if (failure) throw failure;
    same(after, before, 'Route/orders changed during GET path window; inspect concurrent actors');
    return report.routePath;
  });
  for (const order of orders) {
    await step(`GET order ${order.id} vs SQL`, async () => {
      const actual = await get(`/orders/${order.id}`);
      const db = sqlState?.orders.find(r => r.id === order.id); assert.ok(db);
      const projection = select(actual, ['id','trackingNumber','routeId','status']);
      same(projection, {id: db.id, trackingNumber: db.tracking_number, routeId: db.route_id, status: db.status}); return projection;
    });
    await step(`POD ${order.id}`, async () => {
      assert.ok(sqlState, 'SQL unavailable');
      const proofs = sqlState.proofs.filter(p => p.order_id === order.id);
      if (expected.orderStatuses[order.id] !== 'DELIVERED') {
        same(proofs.length, 0, 'POD inesperado en pedido no entregado');
        await get(`/delivery-proofs/${order.id}`, {status: 404});
        await get(`/delivery-proofs/${order.id}/photo`, {status: 404});
        await get(`/delivery-proofs/${order.id}/signature`, {status: 404});
        return {sqlCount: 0, adminProofPhotoSignature: '404'};
      }
      same(proofs.length, 1, 'POD debe ser unico');
      const proof = proofs[0], api = await get(`/delivery-proofs/${order.id}`);
      same(api.id, proof.id); same(api.orderId, order.id);
      assert.ok(Number.isFinite(proof.latitude) && Number.isFinite(proof.longitude) && Math.abs(proof.latitude)<=90 && Math.abs(proof.longitude)<=180 && proof.latitude!==0 && proof.longitude!==0, 'Invalid POD GPS');
      same(api.latitude,proof.latitude); same(api.longitude,proof.longitude);
      same(api.receiverName,proof.receiver_name); same(api.receiverDni,proof.receiver_dni);
      assert.ok(proof.receiver_name?.trim() && /^[0-9]{8}$/.test(proof.receiver_dni), 'Missing synthetic receiver');
      assert.ok(proof.has_photo && proof.has_signature && proof.captured_at && proof.received_at && proof.verified_at);
      assert.ok(sqlState.facts.find(f => f.order_id === order.id)?.complete_pod, 'complete_pod SQL falso');
      const media = {};
      for (const [kind, key] of [['photo','image_sha256'], ['signature','signature_sha256']]) {
        assert.match(proof[key] || '', /^[0-9a-fA-F]{64}$/);
        const {bytes, contentType} = await get(`/delivery-proofs/${order.id}/${kind}`, {binary: true});
        const png = bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
        const jpeg = bytes.length > 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
        assert.ok(png || jpeg, 'Contenido no es PNG/JPEG');
        assert.equal(contentType?.split(';')[0], png ? 'image/png' : 'image/jpeg');
        same(sha(bytes), proof[key].toLowerCase(), `SHA256 ${kind}`);
        media[kind] = {bytes: bytes.length, sha256: sha(bytes), contentType};
      }
      return {proofId: proof.id, sqlCount: 1, coordinates:{latitude:proof.latitude,longitude:proof.longitude},receiverMatchesSql:true,timestamps:{capturedAt:proof.captured_at,receivedAt:proof.received_at,verifiedAt:proof.verified_at},media};
    });
    await step(`History ${order.id} actor/reason`, async () => {
      const rows = sqlState?.history.filter(h => h.order_id === order.id); assert.ok(rows?.length);
      const current = rows.at(-1); same(current.status, expected.orderStatuses[order.id]);
      for (const row of rows) assert.ok(row.changed_by?.trim() && row.reason?.trim() && row.created_at, 'History actor/reason/date missing');
      return rows;
    });
  }
  await step('Incidents API vs SQL, actor/reason', async () => {
    assert.ok(sqlState, 'SQL unavailable');
    const all = await get('/incidents'), scoped = all.filter(i => orders.some(o => o.id === i.orderId));
    report.incidents = scoped.map(i => select(i, ['id','orderId','routeId','incidentType','description','status','outcome','resolutionReason','reportedBy','resolvedBy']));
    same(scoped.length, sqlState.incidents.length);
    for (const incident of sqlState.incidents) {
      const api = scoped.find(i => i.id === incident.id); assert.ok(api);
      same(select(api, ['orderId','routeId','incidentType','description','status','reportedBy','resolutionReason','resolvedBy','outcome']),
        {orderId: incident.order_id, routeId: incident.route_id, incidentType: incident.incident_type, description: incident.description,
          status: incident.status, reportedBy: incident.reported_by, resolutionReason: incident.resolution_reason, resolvedBy: incident.resolved_by, outcome: incident.outcome});
      assert.ok(incident.reported_by?.trim() && incident.description?.trim() && incident.reported_at);
      if (incident.status === 'RESOLVED') assert.ok(incident.resolved_by?.trim() && incident.resolution_reason?.trim() && incident.resolved_at);
    }
    for (const o of orders.filter(o => expected.orderStatuses[o.id] === 'FAILED')) {
      const history = sqlState.history.filter(h => h.order_id === o.id && h.status === 'FAILED');
      assert.ok(history.some(h => sqlState.incidents.some(i => i.order_id === o.id && i.route_id === routeId
        && i.incident_type === 'DELIVERY_FAILED' && i.reported_by === h.changed_by && i.description?.trim() === h.reason?.trim())), 'FAILED sin incidente/historial correlacionado');
    }
    return report.incidents;
  });
  const aggregate = await step('SQL BI and dashboard driver/date', () => sql(`WITH scoped AS (SELECT * FROM analytics_order_facts WHERE ${where})
    SELECT json_build_object('total',(SELECT count(*) FROM scoped),
    'counts',(SELECT json_build_object('valid',count(*) FILTER(WHERE iid_valid),'scheduled',count(*) FILTER(WHERE scheduled),
      'deliveredScheduled',count(*) FILTER(WHERE scheduled AND delivered),'evidenceScheduled',count(*) FILTER(WHERE scheduled AND digital_evidence),
      'delivered',count(*) FILTER(WHERE delivered),'onTime',count(*) FILTER(WHERE on_time),'delayed',count(*) FILTER(WHERE delayed),
      'evaluable',count(*) FILTER(WHERE ontime_evaluable)) FROM scoped),
    'status',${arrayQuery('SELECT status,count(*) AS count FROM scoped GROUP BY status ORDER BY status')},
    'drivers',${arrayQuery('SELECT driver_name AS name,count(*) FILTER(WHERE delivered) AS count FROM scoped GROUP BY driver_id,driver_name ORDER BY driver_id')},
    'districts',${arrayQuery('SELECT district AS name,count(*) AS count FROM scoped GROUP BY district ORDER BY district')},
    'goals',${arrayQuery('SELECT code,target FROM analytics_goal_facts ORDER BY code')});`));
  const query = '?' + new URLSearchParams({driverId: String(driverId), startDate: date, endDate: date});
  const bi = await step('GET reports/bi', async () => {
    const body = await get('/reports/bi' + query);
    report.bi = select(body, ['driverId','startDate','endDate','timezone','kpis','quality']);
    same(select(body, ['driverId','startDate','endDate','timezone']), {driverId, startDate: date, endDate: date, timezone: 'America/Lima'});
    return body;
  });
  const definitions = {IID: ['valid','total'], CHR: ['deliveredScheduled','scheduled'], TDE: ['evidenceScheduled','scheduled'],
    SUCCESS: ['delivered','total'], ONTIME: ['onTime','evaluable']};
  await step('BI exactly five indicator codes', async () => {
    assert.ok(bi); same(bi.kpis.map(k => k.code).sort(), Object.keys(definitions).sort()); return {codes: Object.keys(definitions)};
  });
  for (const [code, [n,d]] of Object.entries(definitions)) await step(`KPI ${code} vs analytics_order_facts`, async () => {
    assert.ok(aggregate && bi, 'SQL/API unavailable');
    const counts = {...aggregate.counts, total: aggregate.total};
    const numerator = counts[n], denominator = counts[d];
    const percentage = denominator === 0 ? null : Number((BigInt(numerator) * 20000n / BigInt(denominator) + 1n) / 2n) / 100;
    const k = bi.kpis.find(k => k.code === code); assert.ok(k);
    same(select(k, ['numerator','denominator','percentage']), {numerator, denominator, percentage});
    const target = aggregate.goals.find(g => g.code === code)?.target ?? null; same(k.target, target);
    const gap = percentage === null || target === null ? null : percentage - target;
    if (gap === null) same(k.gap, null); else assert.ok(Math.abs(k.gap - gap) < 0.000001);
    same(k.status, percentage === null ? 'NO_DATA' : target === null ? 'NO_TARGET' : gap >= 0 ? 'MET' : 'BELOW_TARGET');
    return {code, numerator, denominator, percentage, target, status: k.status};
  });
  for (const [endpoint, expectedValue] of [
    ['/dashboard/orders-by-status', aggregate?.status], ['/dashboard/deliveries-by-driver', aggregate?.drivers],
    ['/dashboard/orders-by-district', aggregate?.districts],
    ['/dashboard/delivery-performance', aggregate ? {onTime: aggregate.counts.onTime, delayed: aggregate.counts.delayed} : undefined],
  ]) await step(endpoint + ' vs SQL', async () => {
    const body = await get(endpoint + query); assert.ok(expectedValue, 'SQL unavailable');
    if (Array.isArray(expectedValue)) same(canonical(body), canonical(expectedValue)); else same(body, expectedValue);
    return body;
  });
  await step('Stable fixture during verification', async () => {
    const after = await sql(fixtureQuery); assert.ok(sqlState);
    report.sqlAfter = after; same(after, sqlState, 'Fixture changed during verification; concurrent activity possible');
    return {unchanged: true};
  });
} catch (e) {
  report.steps.push({name: 'Execution prerequisites', result: 'FAIL', at: now(), error: safe(e.message)});
} finally {
  report.finishedAt = now();
  report.summary = {passed: report.steps.filter(s => s.result === 'PASS').length, failed: report.steps.filter(s => s.result === 'FAIL').length};
  report.result = report.summary.failed === 0 ? 'PASS' : 'FAIL';
  await save(); await file.close();
  let verdicts;
  try { verdicts = await writeStageVerdicts(); }
  catch (e) { console.error('Stage verdict index failed: ' + safe(e.message)); process.exitCode = 1; }
  token = undefined; secrets = [];
  console.log(JSON.stringify({stage: options.stage, result: report.result, ...report.summary, file: outputPath, verdicts}));
  if (report.result !== 'PASS') process.exitCode = 1;
}
