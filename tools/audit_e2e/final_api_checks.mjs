import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Local, bounded closure checks. Never reads .env, resets a limiter, or deletes data.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const output = path.join(root, 'docs/correccion_integral/evidencias/comprobaciones_finales_api.json');
const sha = value => createHash('sha256').update(value).digest('hex');
const read = file => fs.readFile(path.join(root, file), 'utf8');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const args = new Set(process.argv.slice(2));
assert.ok([...args].every(arg => ['--trace-only', '--create-own-purchase'].includes(arg)), 'Argumento desconocido');
assert.ok(!(args.has('--trace-only') && args.has('--create-own-purchase')), 'Modos incompatibles');
let evidence;
async function save() {
  await fs.writeFile(output, JSON.stringify(evidence, null, 2) + '\n');
}
async function receipt(file) {
  return {file, sha256: sha(await fs.readFile(path.join(root, file)))};
}

if (args.has('--trace-only')) {
  evidence = JSON.parse(await fs.readFile(output, 'utf8'));
  const python = process.env.ECOROUTE_AUDIT_PYTHON || 'C:/Users/USUARIO/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
  const closure = {executedAt: new Date().toISOString(), productTestsExecuted: false, humanAcceptance: 'PENDING', commands: []};
  evidence.traceability = closure;
  for (const command of [
    ['-B', '-X', 'utf8', 'tools/audit_e2e/trace_inventory.py'],
    ['-B', '-X', 'utf8', 'tools/audit_e2e/trace_inventory.py', '--check'],
    ['-B', '-X', 'utf8', 'tools/audit_e2e/trace_inventory_checks.py'],
  ]) {
    try {
      const stdout = execFileSync(python, command, {cwd: root, encoding: 'utf8', timeout: 120000,
        env: {...process.env, PYTHONDONTWRITEBYTECODE: '1'}, maxBuffer: 8 * 1024 * 1024});
      closure.commands.push({arguments: command, exitCode: 0, result: JSON.parse(stdout)});
    } catch (error) {
      closure.commands.push({arguments: command, exitCode: error.status ?? 1,
        diagnostic: String(error.stdout || error.stderr || error.message).slice(0, 6000)});
      closure.status = 'FAIL';
      await save();
      console.log('Trazabilidad FAIL; diagnóstico guardado. No se modifican métodos ni reglas.');
      process.exit(1);
    }
    await save();
  }
  const file = 'docs/correccion_integral/inventario_trazabilidad.json';
  const inventory = JSON.parse(await read(file));
  const changed = [];
  for (const input of [...inventory.snapshot.files, ...inventory.snapshot.documentationInputs]) {
    if ((await receipt(input.file)).sha256 !== input.sha256) changed.push(input.file);
  }
  closure.inventory = {...await receipt(file), generatedAt: inventory.generatedAt,
    summary: inventory.summary, snapshotConsistent: inventory.snapshot.consistent,
    changedSinceGeneration: changed,
    processes: inventory.processes.map(p => ({id: p.id, source: p.source, nodes: p.nodes.length})),
    technicalEvidence: inventory.technicalExecutionEvidence.map(s => ({file: s.file, sha256: s.sha256, countedResults: s.countedResults}))};
  closure.documentation = await Promise.all(['docs/plan_correccion_integral.md', 'docs/correccion_integral/README_tecnico.md'].map(receipt));
  closure.status = inventory.snapshot.consistent && !changed.length ? 'PASS' : 'FAIL';
  await save();
  console.log(JSON.stringify({traceability: closure.status, summary: inventory.summary, changedSinceGeneration: changed}));
  process.exitCode = closure.status === 'PASS' ? 0 : 1;
} else {
  const prefix = `FINAL-${Date.now()}`;
  evidence = {executedAt: new Date().toISOString(), timezone: 'America/Lima', prefix,
    environment: 'local Docker / localhost:8081; Keycloak localhost:8080 realm ecoroute',
    humanAcceptance: 'PENDING', tests: [], requests: [], limiterWaits: [],
    safety: {envFileRead: false, tokensStored: false, operationalDeletes: false,
      limiterReset: false, usersOrGoalsChanged: false, protectedOrderIds: [27, 28], protectedRouteIds: [11],
      protectedFixturesWritten: false, minimumRequestIntervalMs: 1100,
      optionalOwnPurchaseRequested: args.has('--create-own-purchase')},
    limits: ['Antes/después observa respuestas API, no una transacción ni auditoría SQL global.',
      'Cambios de actores concurrentes no se atribuyen a este script.',
      'No ejecuta UAT humana, offline en emulador, reinicios S3, WebSocket ni despliegue.',
      'La regresión de 49 casos y las otras evidencias son ejecuciones previas, no repetidas aquí.']};
  let token;
  let lastRequest = 0;
  async function http(endpoint, {method = 'GET', body, anonymous = false} = {}) {
    const allowed = method === 'GET' && ['/session/me', '/orders', '/purchases'].includes(endpoint)
      || method === 'POST' && ['/orders/bulk-csv/preview', '/purchases'].includes(endpoint)
      || method === 'PUT' && args.has('--create-own-purchase') && endpoint === `/purchases/${evidence.ownPurchaseId}`;
    assert.ok(allowed, 'Petición fuera del alcance autorizado');
    for (let attempt = 0; attempt < 3; attempt++) {
      await pause(Math.max(0, 1100 - (Date.now() - lastRequest)));
      lastRequest = Date.now();
      const response = await fetch(`http://localhost:8081${endpoint}`, {method,
        headers: {...(!anonymous && token ? {Authorization: `Bearer ${token}`} : {}),
          ...(body === undefined ? {} : {'Content-Type': typeof body === 'string' ? 'text/plain' : 'application/json'})},
        body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
        signal: AbortSignal.timeout(20000)});
      evidence.requests.push({method, endpoint, status: response.status, at: new Date().toISOString()});
      if (response.status === 429 && attempt < 2) {
        const seconds = Math.max(1, Math.min(120, Number(response.headers.get('retry-after')) || 60));
        evidence.limiterWaits.push({endpoint, seconds, attempt: attempt + 1});
        await response.arrayBuffer();
        await save();
        await pause(seconds * 1000 + 1100);
        continue;
      }
      const text = await response.text();
      let data; try { data = JSON.parse(text); } catch { data = null; }
      return {status: response.status, data};
    }
  }
  function status(response, expected = 200) {
    assert.equal(response.status, expected, `HTTP esperado ${expected}; recibido ${response.status}`);
    return response.data;
  }
  async function test(id, processId, name, action) {
    try {
      const detail = await action();
      evidence.tests.push({id, process: processId, name, result: 'PASS', ...(detail === undefined ? {} : {detail})});
    } catch (error) {
      // Assertions only contain statuses, synthetic inputs, or hashes; never login bodies/tokens.
      evidence.tests.push({id, process: processId, name, result: 'FAIL', detail: error.message});
    }
    await save();
    console.log(`${id} ${evidence.tests.at(-1).result} ${name}`);
    return evidence.tests.at(-1).result === 'PASS';
  }
  function snapshot(rows) {
    assert.ok(Array.isArray(rows), 'Se esperaba listado API');
    const ordered = [...rows].sort((a, b) => a.id - b.id);
    return {count: rows.length, sha256: sha(JSON.stringify(ordered)),
      ownRows: rows.filter(row => row.trackingNumber?.startsWith(prefix) || row.description?.startsWith(prefix)).map(row => row.id)};
  }
  try {
    evidence.sourceReceipts = await Promise.all([
      'tools/audit_e2e/final_api_checks.mjs',
      'src/main/java/com/ecoroute/backend/infrastructure/input/rest/OrderController.java',
      'src/main/java/com/ecoroute/backend/infrastructure/input/rest/OrderCsvParser.java',
      'src/main/java/com/ecoroute/backend/infrastructure/input/rest/PurchaseController.java',
      'src/main/java/com/ecoroute/backend/infrastructure/input/rest/PurchaseRequest.java',
    ].map(receipt));
    const loggedIn = await test('F01', 'P08', 'Autenticación real local y sesión ADMIN', async () => {
      const response = await fetch('http://localhost:8080/realms/ecoroute/protocol/openid-connect/token', {
        method: 'POST', body: new URLSearchParams({client_id: 'mobile-app', grant_type: 'password',
          username: 'admin', password: process.env.ECOROUTE_ADMIN_PASSWORD || 'admin123'}), signal: AbortSignal.timeout(20000)});
      assert.equal(response.status, 200, 'Autenticación local rechazada');
      token = (await response.json()).access_token;
      assert.ok(token, 'Falta access token');
      const me = status(await http('/session/me'));
      const roles = me.roles.map(role => (typeof role === 'string' ? role : role.authority).replace(/^ROLE_/, ''));
      assert.ok(roles.includes('ADMIN'), 'La sesión no contiene ADMIN');
      return {realm: 'ecoroute', role: 'ADMIN', tokenPersisted: false};
    });
    if (!loggedIn) throw new Error('Sin sesión ADMIN: comprobaciones dependientes detenidas');
    evidence.before = {orders: snapshot(status(await http('/orders'))), purchases: snapshot(status(await http('/purchases')))};
    const header = ['trackingNumber', 'recipientName', 'deliveryAddress', 'latitude', 'longitude', 'externalReference',
      'routeId', 'recipientPhone', 'recipientEmail', 'deliveryCity', 'deliveryDistrict'];
    const row = (suffix, columns = 11) => [`${prefix}-${suffix}`, 'Cliente sintético final', 'Av. Lima 100', '-12.04', '-77.04', '', '', '999123456', '', '', ''].slice(0, columns);
    const quote = value => /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
    const csv = (rows, columns = 11) => header.slice(0, columns).join(',') + '\r\n' + rows.map(r => r.map(quote).join(',')).join('\r\n') + '\r\n';
    const preview = body => http('/orders/bulk-csv/preview', {method: 'POST', body});
    for (const columns of [8, 9, 10, 11]) {
      await test(`F0${columns - 6}`, 'P01', `Preview acepta ${columns} columnas sin ID ni ruta`, async () => {
        const data = status(await preview(csv([row(`COL${columns}`, columns)], columns)));
        assert.equal(data.length, 1); assert.equal(data[0].trackingNumber, `${prefix}-COL${columns}`);
        assert.equal(data[0].id, null); assert.equal(data[0].routeId, null);
        assert.equal(data[0].recipientPhone, '999123456'); assert.equal(data[0].deliveryDistrict, null);
        return {columns, rows: data.length, id: data[0].id, routeId: data[0].routeId};
      });
    }
    await test('F06', 'P01', 'Preview preserva comas, comillas, CRLF y BOM', async () => {
      const r = row('QUOTED'); r[2] = 'Av. Lima, local "A"\r\nSegundo piso';
      const data = status(await preview('\uFEFF' + csv([r])));
      assert.equal(data[0].deliveryAddress, r[2]);
      return {rows: data.length, escapedQuotesAndMultilinePreserved: true};
    });
    const invalid = [
      ['F07', 'routeId informa fila y rechaza preasignación', () => {const r = row('ROUTE'); r[6] = '999999'; return csv([r]);}, /Fila 2.*routeId/],
      ['F08', 'Siete columnas son insuficientes', () => csv([row('SHORT', 7)]), /Fila 2.*8.*11/],
      ['F09', 'Doce columnas son excesivas', () => csv([[...row('LONG'), 'extra']]), /Fila 2.*8.*11/],
      ['F10', 'Lote con fila inválida rechaza todo y señala Fila 3', () => csv([row('BATCH'), ['malformada']]), /Fila 3/],
      ['F11', 'Teléfono inválido no evade validación', () => {const r = row('PHONE'); r[7] = '123'; return csv([r]);}, /Fila 2.*recipientPhone/],
      ['F12', 'Correo opcional suministrado exige formato válido', () => {const r = row('EMAIL'); r[8] = 'no-es-correo'; return csv([r]);}, /Fila 2.*recipientEmail/],
      ['F13', 'Tracking duplicado dentro del CSV se rechaza', () => {const r = row('DUP'); return csv([r, r]);}, /Fila 3.*duplicado/],
      ['F14', 'Comillas abiertas se rechazan', () => header.join(',') + '\n"sin cierre', /Comillas.*sin cerrar/],
    ];
    for (const [id, name, makeCsv, pattern] of invalid) {
      await test(id, 'P01', name, async () => {
        const response = await preview(makeCsv()); const data = status(response, 400);
        assert.match(data.message, pattern);
        return {status: response.status, message: data.message};
      });
    }
    await test('F15', 'P01', 'Preview válido no permite acceso anónimo', async () => {
      status(await http('/orders/bulk-csv/preview', {method: 'POST', body: csv([row('ANON')]), anonymous: true}), 401);
    });
    let invalidPurchaseUnexpectedlyAccepted = false;
    for (const [id, amount] of [['F16', 0], ['F17', -1]]) {
      if (invalidPurchaseUnexpectedlyAccepted) break;
      await test(id, 'P09', `Compra con importe ${amount} devuelve 400`, async () => {
        const response = await http('/purchases', {method: 'POST', body: {description: `${prefix}-INVALID-${amount}`,
          supplier: 'Proveedor sintético final', amount, status: 'PENDING', category: 'Auditoría', notes: 'Validación técnica local'}});
        invalidPurchaseUnexpectedlyAccepted = response.status >= 200 && response.status < 300;
        status(response, 400);
        return {amount, status: response.status};
      });
    }
    await test('F18', 'P01 P09', 'Preview y compras rechazadas no crean ni alteran registros observados', async () => {
      evidence.after = {orders: snapshot(status(await http('/orders'))), purchases: snapshot(status(await http('/purchases')))};
      assert.deepEqual(evidence.after, evidence.before, 'Listados cambiaron entre lecturas; revisar también concurrencia externa');
      assert.equal(evidence.after.orders.ownRows.length, 0); assert.equal(evidence.after.purchases.ownRows.length, 0);
      return {ordersUnchanged: true, purchasesUnchanged: true, syntheticRecordsPersisted: 0};
    });
    evidence.optionalValidPurchase = {status: 'NOT_RUN', reason: 'Opt-in --create-own-purchase; conservaría solo su propia compra sintética, sin borrado.'};
    if (args.has('--create-own-purchase') && !evidence.tests.some(t => t.result === 'FAIL')) {
      await test('F19', 'P09', 'Opt-in: crear y actualizar únicamente compra sintética propia', async () => {
        const body = {description: `${prefix}-OWN`, supplier: 'Proveedor sintético final', amount: 1.25,
          status: 'PENDING', category: 'Auditoría', notes: 'Registro propio conservado para trazabilidad'};
        const created = status(await http('/purchases', {method: 'POST', body}));
        assert.ok(Number.isInteger(created.id)); evidence.ownPurchaseId = created.id;
        await save();
        assert.equal(created.description, body.description);
        const updated = status(await http(`/purchases/${created.id}`, {method: 'PUT', body: {...body, amount: 1.50}}));
        assert.equal(updated.id, created.id); assert.equal(Number(updated.amount), 1.50);
        evidence.optionalValidPurchase = {status: 'PASS', ownId: created.id, deleted: false};
        return evidence.optionalValidPurchase;
      });
    }
  } catch (error) {
    evidence.fatal = error.message;
  } finally {
    token = undefined;
    evidence.finishedAt = new Date().toISOString();
    evidence.summary = {total: evidence.tests.length, passed: evidence.tests.filter(t => t.result === 'PASS').length,
      failed: evidence.tests.filter(t => t.result === 'FAIL').length, fatal: Boolean(evidence.fatal)};
    await save();
    console.log(JSON.stringify(evidence.summary));
    process.exitCode = evidence.summary.failed || evidence.summary.fatal ? 1 : 0;
  }
}
