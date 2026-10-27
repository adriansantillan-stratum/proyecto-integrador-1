/** Real local backend + normal browser PKCE. Never mock /api or persist tokens.
 * Writes are limited to resources created by this run. No driver acceptance,
 * identity/goal writes, notification acknowledgement, POD or mobile operations.
 */
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { operationDate } from '../src/utils/operation.ts';
const require = createRequire('C:/Users/USUARIO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/package.json');
const { chromium } = require('playwright');
const origin = 'http://localhost:3000';
const prefix = `WEB-${Date.now()}`;
const out = path.resolve('../docs/correccion_integral/capturas/web', prefix);
await fs.mkdir(out, { recursive: true });
const evidence = { mode: 'REAL_BACKEND_NO_API_FIXTURES', executedAt: new Date().toISOString(), prefix,
  origin, backend: 'http://localhost:8081', humanAcceptance: 'PENDING',
  restrictions: ['No existing resource writes', 'No conductor1 use', 'No driver acceptance or dispatch', 'Goals and identities read only', 'No POD reads'],
  tests: [], screenshots: [], requests: [], pageErrors: [], resources: {} };
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, locale: 'es-PE', timezoneId: 'America/Lima' });
// Real transport, paced below the shared backend limit. No response is mocked.
let transportQueue = Promise.resolve();
await context.route(origin + '/api/**', async route => {
  transportQueue = transportQueue.then(() => new Promise(resolve => setTimeout(resolve, 1000)));
  await transportQueue;
  await route.continue();
});
const page = await context.newPage();
page.setDefaultTimeout(40000);
page.on('pageerror', error => evidence.pageErrors.push(error.message));
page.on('response', response => {
  const url = new URL(response.url());
  if (url.origin === origin && url.pathname.startsWith('/api/')) evidence.requests.push({ method: response.request().method(), endpoint: url.pathname.slice(4) + url.search, status: response.status() });
});
const save = () => fs.writeFile(path.join(out, 'results.json'), JSON.stringify(evidence, null, 2));
async function test(name, run) {
  try { await run(); evidence.tests.push({ name, result: 'PASS' }); console.log(`PASS ${name}`); }
  catch (error) { evidence.tests.push({ name, result: 'FAIL', detail: String(error.message).replace(/eyJ[\w.-]+/g, '[REDACTED]').slice(0, 1000) }); console.log(`FAIL ${name}: ${evidence.tests.at(-1).detail}`); }
  await save();
}
async function shot(name) {
  // Redact data rows, identity cards, free text, input values, and map labels.
  // This only affects the screenshot, never API data or assertions.
  const stamp = await page.evaluate(() => {
    const node = document.createElement('div'); node.id = 'live-evidence-stamp';
    node.textContent = 'BACKEND LOCAL REAL · Datos personales ocultos · UAT humana pendiente';
    Object.assign(node.style, { position: 'fixed', bottom: '0', right: '0', background: '#102a43', color: '#fff', padding: '8px', zIndex: '2147483647', font: '12px sans-serif' });
    document.body.append(node); return node.id;
  });
  const nameSafe = name.replace(/[^a-zA-Z0-9_-]/g, '_') + '.png';
  const options = { fullPage: true, animations: 'disabled', maskColor: '#cbd5e1',
    mask: [page.locator('tbody td:not(:has(button))'), page.locator('input:not([type="checkbox"]):not([type="radio"]), textarea'),
      page.locator('.operation-modal p:not(.source-error), .leaflet-popup-content, .leaflet-tooltip, aside p, aside small'), page.locator('select'),
      page.locator('section, div').filter({ has: page.locator(':scope > h3', { hasText: /conductor|distrito/i }) }).locator('canvas')] };
  await page.screenshot({ ...options, path: path.join(out, nameSafe) });
  evidence.screenshots.push(nameSafe);
  const scroller = page.locator('.operation-modal').first().or(page.locator('.main-content').first()).first();
  if (await scroller.count()) {
    const metrics = await scroller.evaluate(node => ({ height: node.clientHeight, total: node.scrollHeight, top: node.scrollTop }));
    for (let offset = metrics.height; offset < metrics.total - 30; offset += metrics.height) {
      await scroller.evaluate((node, top) => { node.scrollTop = top; }, offset); await page.waitForTimeout(100);
      const more = nameSafe.replace('.png', `_scroll${offset}.png`); await page.screenshot({ ...options, path: path.join(out, more) }); evidence.screenshots.push(more);
    }
    await scroller.evaluate((node, top) => { node.scrollTop = top; }, metrics.top);
  }
  await page.locator(`#${stamp}`).evaluate(node => node.remove());
  await save();
}
async function settle() { await page.waitForFunction(() => ![...document.querySelectorAll('[role="status"]')].some(n => n.textContent === 'Cargando…')); await page.waitForTimeout(450); }
async function goto(route) { await page.goto(origin + route); await page.locator('.main-container').waitFor(); await settle(); }
async function api(endpoint, method = 'GET', body) {
  // Tokens remain in the browser. Do not return headers or storage in evidence.
  return page.evaluate(async ({ endpoint, method, body }) => {
    const response = await fetch('/api' + endpoint, { method, headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await response.text(); let data; try { data = JSON.parse(text); } catch { data = null; }
    return { status: response.status, data };
  }, { endpoint, method, body });
}
function ok(response) { assert.equal(response.status, 200, `API HTTP ${response.status}: ${JSON.stringify(response.data)?.slice(0, 250)}`); return response.data; }
const waitWrite = (endpoint, method) => page.waitForResponse(r => new URL(r.url()).pathname === '/api' + endpoint && r.request().method() === method);
async function close() { await page.getByRole('button', { name: 'Cerrar', exact: true }).click(); }
let order, driver, vehicle, route;
const today = operationDate();
const tomorrow = operationDate(new Date(), 1);
try {
  await test('Login PKCE real y sesión ADMIN validada por backend', async () => {
    await page.goto(origin + '/login'); await shot('00_login');
    await page.getByRole('button', { name: /Iniciar|Ingresar|Keycloak/i }).click();
    await page.locator('#username').fill(process.env.ECOROUTE_ADMIN_USER || 'admin');
    await page.locator('#password').fill(process.env.ECOROUTE_ADMIN_PASSWORD || 'admin123');
    await page.locator('#kc-login').click();
    await page.waitForURL(origin + '/'); await page.locator('.main-container').waitFor(); await settle();
    const identity = ok(await api('/session/me')); assert.ok(identity.roles.some(r => (typeof r === 'string' ? r : r.authority).includes('ADMIN')));
    await shot('01_home');
  });
  if (!await page.evaluate(() => !!localStorage.getItem('token'))) throw new Error('PKCE failed; dependent tests cannot run');
  for (const [routePath, endpoint] of [['/dashboard', '/dashboard/orders-by-status'], ['/orders', '/orders'], ['/routes', '/routes'], ['/drivers', '/drivers'], ['/vehicles', '/vehicles'], ['/purchases', '/purchases'], ['/reports', '/reports/orders-summary'], ['/bi', '/reports/bi'], ['/incidents', '/incidents'], ['/improvement-actions', '/improvement-actions'], ['/users', '/users/identities']]) {
    await test(`Pantalla real ${routePath}`, async () => {
      const before = evidence.requests.length; await goto(routePath);
      // Legacy resource pages mount their data requests after /session/me and do not use useQuery's status node.
      // Wait for the actual response instead of asserting while only the session request has completed.
      for(let attempt=0;attempt<200&&!evidence.requests.slice(before).some(r=>r.method==='GET'&&r.endpoint.split('?')[0]===endpoint);attempt++)await page.waitForTimeout(100);
      const reads = evidence.requests.slice(before).filter(r => r.method === 'GET');
      assert.ok(reads.length > 0); assert.ok(reads.some(r => r.endpoint.split('?')[0] === endpoint && r.status === 200), `Missing successful ${endpoint}: ${JSON.stringify(reads)}`);
      assert.equal(await page.locator('main, .main-content').first().isVisible(), true);
      await shot('screen' + routePath.replaceAll('/', '_'));
    });
  }
  await test('Notificaciones reales solo lectura', async () => { await goto('/'); await page.getByTitle('Notificaciones', { exact: true }).click(); await settle(); assert.ok(evidence.requests.some(r => r.endpoint === '/notifications/unread' && r.status === 200)); await shot('02_notifications'); });
  await test('Cinco vistas BI, metas y acciones con GET reales', async () => {
    await goto('/bi');
    for (const view of ['Tendencias', 'Causas', 'Cumplimiento', 'Calidad de datos', 'Eficiencia', 'Metas', 'Acciones P05']) {
      await page.getByRole('button', { name: view, exact: true }).click(); await settle();
      if (view === 'Metas') assert.equal(await page.getByRole('button', { name: 'Guardar meta', exact: true }).count(), 5);
      await shot('bi_' + view);
    }
    for (const metric of ['IID', 'CHR', 'TDE', 'SUCCESS', 'ONTIME']) assert.ok(evidence.requests.some(r => r.endpoint === `/reports/goals/${metric}` && r.status === 200));
  });
  await test('Identidades y registro anterior se consultan sin escribir roles', async () => {
    await goto('/users'); await page.getByRole('button', { name: 'Editar roles / conductor' }).first().click(); await shot('users_roles_readonly'); await close();
    await page.getByRole('button', { name: /Registro local anterior/ }).click(); await settle(); await shot('users_legacy_readonly');
    assert.equal(evidence.requests.filter(r => r.endpoint.startsWith('/users/') && r.method !== 'GET').length, 0);
  });
  await test('Formularios existentes de conductores, vehículos, compras y CSV con datos reales de lectura', async () => {
    for (const [url, button, name] of [['/drivers', 'Nuevo Conductor', 'driver_form'], ['/vehicles', 'Nuevo Vehículo', 'vehicle_form'], ['/purchases', 'Nueva Compra', 'purchase_form'], ['/orders', 'Importar CSV', 'csv_form']]) {
      await goto(url); await page.getByRole('button', { name: button, exact: true }).click(); await shot(name);
    }
  });
  await test('Preparar recursos sintéticos exclusivos; conductor diferente de 1', async () => {
    driver = ok(await api('/drivers', 'POST', { firstName: 'WEB Sintético', lastName: prefix, licenseNumber: `W${String(Date.now()).slice(-8)}`, phoneNumber: '999000000', email: `${prefix.toLowerCase()}@example.invalid`, isActive: true }));
    assert.notEqual(driver.id, 1); evidence.resources.driverId = driver.id;
    const suffix = String(Date.now()).slice(-6);
    vehicle = ok(await api('/vehicles', 'POST', { plateNumber: `${suffix.slice(0, 3)}-${suffix.slice(3)}`, model: prefix, brand: 'Prueba WEB', capacityKg: 500, capacityM3: 3, isActive: true }));
    evidence.resources.vehicleId = vehicle.id;
  });
  await test('P02 crear ruta desde UI con recursos exclusivos y fecha de Lima', async () => {
    assert.ok(driver && vehicle); await goto('/routes'); await page.getByRole('button', { name: 'Nueva ruta', exact: true }).click();
    await page.getByLabel('Fecha operativa (Lima)', { exact: true }).fill(today); await page.getByLabel('Conductor disponible').selectOption(String(driver.id)); await page.getByLabel('Vehículo disponible').selectOption(String(vehicle.id));
    await shot('p02_new_route_synthetic'); const response = waitWrite('/routes', 'POST'); await page.getByRole('button', { name: 'Crear ruta PLANNED' }).click();
    const result = await response; assert.equal(result.status(), 200); route = await result.json(); evidence.resources.routeId = route.id;
  });
  await test('P01 alta UI sin ruta y revisión sobre el mismo ID', async () => {
    await goto('/orders'); await page.getByRole('button', { name: 'Nuevo pedido', exact: true }).click();
    for (const [label, value] of [['Tracking', prefix], ['Referencia externa (separada del RUC)', prefix], ['Destinatario', 'Cliente sintético WEB'], ['Teléfono', '999000000'], ['Dirección', 'Av. Sintética 100'], ['Ciudad', 'Lima'], ['Distrito', 'Centro'], ['Latitud', '-12.04'], ['Longitud', '-77.04']]) await page.getByLabel(label, { exact: true }).fill(value);
    await page.getByLabel('Ventana de entrega: inicio (Lima, opcional)').fill(`${tomorrow}T08:00`); await page.getByLabel('Ventana de entrega: fin (Lima, opcional)').fill(`${tomorrow}T10:00`);
    await page.getByLabel('Condiciones acordadas / nota de revisión').fill('Prueba sintética WEB; aceptación pendiente, sin operación comercial');
    await shot('p01_draft_synthetic'); const response = waitWrite('/orders', 'POST'); await page.getByRole('button', { name: 'Guardar pedido sin ruta' }).click();
    const result = await response; assert.equal(result.status(), 200); order = await result.json(); evidence.resources.orderId = order.id; assert.equal(order.status, 'PENDING'); assert.equal(order.routeId, null);
    await page.getByRole('dialog', { name: `Pedido ${prefix}` }).waitFor(); await settle();
    assert.equal(await page.getByLabel(`Ruta para ${prefix}`).isDisabled(), true); await shot('p01_unconfirmed_blocks_assignment');
    for (const label of ['Cliente aceptó las condiciones', 'Dirección verificada', 'Cobertura verificada']) await page.getByLabel(label, { exact: true }).check();
    await page.getByLabel('Condiciones acordadas / nota de revisión').fill('Acuerdo sintético para probar integración WEB; no aceptación humana UAT');
    await page.getByRole('button', { name: 'Guardar revisión comercial' }).click(); await page.getByText('Confirmación guardada.', { exact: true }).waitFor();
    const business = ok(await api(`/orders/${order.id}/business-data`)); assert.equal(business.customerAccepted, true); assert.ok(business.confirmedBy && business.confirmedAt); await shot('p01_confirmed_synthetic');
  });
  await test('P02 asignar mismo pedido desde UI e impedir despacho sin aceptación móvil', async () => {
    assert.ok(route && order); await page.getByLabel(`Ruta para ${prefix}`).selectOption(String(route.id));
    const response = waitWrite(`/orders/${order.id}/route`, 'PATCH'); await page.getByRole('button', { name: 'Asignar', exact: true }).click(); const result = await response; assert.equal(result.status(), 200);
    const assigned = await result.json(); assert.equal(assigned.id, order.id); assert.equal(assigned.status, 'ASSIGNED');
    await goto('/routes'); await page.getByRole('button', { name: new RegExp(`^#${route.id} ·`) }).click(); await settle();
    for (const label of ['Capacidad de carga verificada', 'Ventanas de atención verificadas', 'Vehículo inspeccionado']) await page.getByLabel(label, { exact: true }).check();
    await page.getByLabel('Peso de carga (kg)').fill('20'); await page.getByLabel('Nota de revisión', { exact: true }).fill('Revisión sintética WEB; recursos exclusivos de auditoría');
    const reviewResponse = waitWrite(`/routes/${route.id}/review`, 'POST'); await page.getByRole('button', { name: 'Guardar aprobación ADMIN' }).click(); assert.equal((await reviewResponse).status(), 200); await settle();
    const review = ok(await api(`/routes/${route.id}/review`)); assert.equal(review.approved, true); assert.equal(review.accepted, false); assert.equal(await page.getByRole('button', { name: 'Iniciar despacho' }).isDisabled(), true); await shot('p02_approved_mobile_pending');
  });
  await test('Ventana real invalida aceptación y revisión; reconfirmación explícita conserva pedido', async () => {
    assert.ok(order && route); await goto('/orders'); await page.getByLabel('Buscar', { exact: true }).fill(prefix); await page.getByRole('button', { name: /Detalles/ }).click(); await settle();
    await page.getByLabel('Nuevo fin (Lima)').fill(`${tomorrow}T11:00`); await page.getByLabel('Motivo del cambio de ventana').fill('Cambio sintético coordinado; nueva ventana WEB');
    assert.equal(await page.getByRole('button', { name: 'Guardar revisión comercial' }).isDisabled(), true);
    const response = waitWrite(`/orders/${order.id}/delivery-window`, 'PATCH'); await page.getByRole('button', { name: 'Guardar nueva ventana' }).click(); assert.equal((await response).status(), 200);
    await page.getByText(/Ventana guardada\. Aceptación comercial pendiente/).waitFor(); assert.equal(await page.getByLabel('Cliente aceptó las condiciones').isChecked(), false);
    const business = ok(await api(`/orders/${order.id}/business-data`)); assert.equal(business.customerAccepted, false); assert.equal(business.addressVerified, true); assert.equal(business.coverageVerified, true);
    const review = ok(await api(`/routes/${route.id}/review`)); assert.equal(review.approved, false); assert.equal(review.accepted, false); await shot('window_real_invalidated');
    await page.getByLabel('Cliente aceptó las condiciones').check(); await page.getByLabel('Condiciones acordadas / nota de revisión').fill('Reconfirmación sintética explícita tras cambiar ventana WEB');
    await page.getByRole('button', { name: 'Guardar revisión comercial' }).click(); await page.getByText('Confirmación guardada.', { exact: true }).waitFor();
    assert.equal(ok(await api(`/orders/${order.id}/business-data`)).customerAccepted, true); assert.equal(ok(await api(`/orders/${order.id}`)).id, order.id); await shot('window_real_reconfirmed');
  });
  await test('P04 incidencia sintética y cierre desde UI sin alterar pedido', async () => {
    assert.ok(route && order); await goto('/incidents'); await page.getByRole('button', { name: 'Registrar incidencia', exact: true }).click();
    await page.getByLabel('Ruta', { exact: true }).selectOption(String(route.id)); await page.getByLabel('Pedido afectado (opcional)').selectOption(String(order.id));
    await page.getByLabel('Descripción y evidencia observada').fill(`${prefix} incidencia sintética de prueba UI`); await shot('incident_create_real');
    const response = waitWrite('/incidents', 'POST'); await page.getByRole('dialog').getByRole('button', { name: 'Registrar incidencia', exact: true }).click(); const result = await response; assert.equal(result.status(), 200); const incident = await result.json(); evidence.resources.incidentId = incident.id;
    await page.getByLabel('Buscar', { exact: true }).fill(prefix); await page.getByRole('button', { name: 'Resolver', exact: true }).click(); await page.getByLabel('Decisión', { exact: true }).selectOption('CLOSE_CASE');
    await page.getByLabel('Motivo', { exact: true }).selectOption({ index: 1 }); await page.getByLabel('Justificación de la decisión').fill('Cierre de caso sintético sin modificar la orden'); await shot('incident_resolution_real');
    const resolution = waitWrite(`/incidents/${incident.id}/resolution`, 'PATCH'); await page.getByRole('button', { name: 'Guardar resolución' }).click(); assert.equal((await resolution).status(), 200);
    assert.equal(ok(await api(`/orders/${order.id}`)).status, 'ASSIGNED'); await settle(); await shot('incident_closed_real');
  });
  await test('P05 acción sintética OPEN → IN_PROGRESS → VERIFIED desde UI', async () => {
    await goto('/improvement-actions'); await page.getByRole('button', { name: 'Nueva acción', exact: true }).click();
    await page.getByLabel('Título', { exact: true }).fill(`${prefix} mejora sintética`); await page.getByLabel('Responsable humano').fill('Responsable sintético WEB'); await page.getByLabel('Causa que se busca atender').fill('Ensayo técnico de integración UI con backend real'); await page.getByLabel('Fecha compromiso (Lima)').fill(tomorrow);
    await page.getByLabel('Línea base declarada (opcional)').fill('60'); await page.getByLabel('Meta de la acción (opcional)').fill('90'); await shot('action_create_real');
    const response = waitWrite('/improvement-actions', 'POST'); await page.getByRole('button', { name: 'Crear acción', exact: true }).click(); const result = await response; assert.equal(result.status(), 200); const action = await result.json(); evidence.resources.actionId = action.id;
    const row = page.getByRole('row').filter({ hasText: prefix }); await row.getByRole('button', { name: 'Registrar seguimiento' }).click();
    await page.getByLabel('Nota de seguimiento / evidencia').fill('Ejecución sintética para validar persistencia técnica'); const progress = waitWrite(`/improvement-actions/${action.id}`, 'PATCH'); await page.getByRole('button', { name: 'Guardar seguimiento' }).click(); assert.equal((await progress).status(), 200);
    await row.filter({ hasText: 'IN_PROGRESS' }).waitFor();
    await row.getByRole('button', { name: 'Registrar seguimiento' }).click(); await page.getByRole('dialog').getByLabel('Estado', { exact: true }).selectOption('VERIFIED'); await page.getByLabel('Resultado observado').fill('92'); await page.getByLabel('Nota de seguimiento / evidencia').fill('Resultado sintético; no acredita eficacia ni aceptación humana'); await shot('action_verify_real');
    const verified = waitWrite(`/improvement-actions/${action.id}`, 'PATCH'); await page.getByRole('button', { name: 'Guardar seguimiento' }).click(); const final = await verified; assert.equal(final.status(), 200); assert.ok((await final.json()).verifiedBy); await settle(); await shot('action_verified_real');
  });
  await test('Responsive 390px en pedidos y BI con backend real', async () => { await page.setViewportSize({ width: 390, height: 844 }); for (const url of ['/orders', '/bi']) { await goto(url); await shot('responsive' + url.replace('/', '_')); } await page.setViewportSize({ width: 1440, height: 1100 }); });
  await test('Sin errores JS ni escrituras sobre cuentas, metas, móvil o datos ajenos', async () => {
    assert.deepEqual(evidence.pageErrors, []);
    const writes = evidence.requests.filter(r => r.method !== 'GET');
    for (const write of writes) {
      assert.ok(['/drivers', '/vehicles', '/routes', '/orders', '/incidents', '/improvement-actions'].includes(write.endpoint) ||
        [new RegExp(`^/orders/${order?.id}/(business-data|route|delivery-window)$`), new RegExp(`^/routes/${route?.id}/review$`), new RegExp(`^/incidents/${evidence.resources.incidentId}/resolution$`), new RegExp(`^/improvement-actions/${evidence.resources.actionId}$`)].some(pattern => pattern.test(write.endpoint)), `Unexpected write ${write.endpoint}`);
    }
  });
} catch (error) { evidence.fatal = String(error.message).replace(/eyJ[\w.-]+/g, '[REDACTED]').slice(0, 700); console.log(evidence.fatal); }
finally {
  evidence.finishedAt = new Date().toISOString(); evidence.summary = { passed: evidence.tests.filter(t => t.result === 'PASS').length, failed: evidence.tests.filter(t => t.result === 'FAIL').length, screenshots: evidence.screenshots.length };
  await save(); await browser.close(); console.log(JSON.stringify({ folder: out, ...evidence.summary }));
}
if (evidence.fatal || evidence.summary.failed) process.exitCode = 1;
