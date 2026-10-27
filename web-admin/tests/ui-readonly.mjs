/** Isolated browser QA. Every API is mocked; every mutation is blocked. Not human UAT. */
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { operationDate } from '../src/utils/operation.ts';
const require = createRequire('C:/Users/USUARIO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/package.json');
const { chromium } = require('playwright');
const out = path.resolve('tools/audit_e2e/readonly-ui');
await fs.mkdir(out, { recursive: true });
const origin = 'http://127.0.0.1:4317';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'America/Lima', locale: 'es-PE' });
const token = ['eyJhbGciOiJub25lIn0', Buffer.from(JSON.stringify({ sub: 'fixture-admin', preferred_username: 'Fixture QA' })).toString('base64url'), 'fixture'].join('.');
await context.addInitScript(value => { if (window.location.origin === 'http://127.0.0.1:4317') localStorage.setItem('token', value); }, token);
const evidence = { mode: 'ISOLATED_FIXTURES_NO_OPERATIONAL_WRITES', tests: [], screenshots: [], mutations: [], apiGets: [], pageErrors: [] };
let unavailableIdentity = true;
let accepted = false;
let noBiData = false;
const now = new Date().toISOString();
const date = operationDate();
const drivers = [{ id: 7, externalId: 'fixture-driver', firstName: 'Conductor', lastName: 'QA', licenseNumber: 'QA-7', isActive: true }];
const routes = [{ id: 10, driverId: 7, vehicleId: 12, routeDate: date, status: 'PLANNED', estimatedStartTime: now, totalDistanceKm: 12, createdAt: now }];
const order = { id: 1, trackingNumber: 'FIXTURE-PENDING', externalReference: 'REF-COMERCIAL', routeId: null, status: 'PENDING', recipientName: 'Destinatario QA', recipientPhone: '999999999', recipientEmail: '', deliveryAddress: 'Dirección QA', deliveryCity: 'Lima', deliveryDistrict: 'Centro', latitude: -12.1, longitude: -77.1, priority: 0, createdAt: now };
const orders = [order, { ...order, id: 2, trackingNumber: 'FIXTURE-DELIVERED', routeId: 10, status: 'DELIVERED' }, { ...order, id: 3, trackingNumber: 'FIXTURE-THIRD', routeId: 10, status: 'ASSIGNED' }, { ...order, id: 4, trackingNumber: 'FIXTURE-FOURTH', routeId: 10, status: 'PICKED_UP' }, { ...order, id: 5, trackingNumber: 'FIXTURE-FAILED', routeId: 10, status: 'FAILED' }];
const metrics = ['IID', 'CHR', 'TDE', 'SUCCESS', 'ONTIME'];
const kpis = metrics.map(code => ({ code, name: `Indicador ${code}`, numerator: 2, denominator: 4, percentage: 50, target: 90, gap: -40, status: 'BELOW_TARGET' }));
const efficiency = [{ routeId: 10, label: 'Ruta QA, Lima', orderCount: 4, plannedDistanceKm: 12, actualGpsDistanceKm: null, operationMinutes: 40, kmPerDelivery: null, timePerStopMin: 20, distanceSource: 'UNAVAILABLE' }];
const report = { driverId: null, startDate: null, endDate: null, timezone: 'America/Lima', kpis, trends: [{ date, kpis }], byDriver: [{ driverId: 7, name: 'Conductor QA', count: 1, total: 4, failed: 0 }], byDistrict: [{ name: 'Centro', count: 4 }], causes: [{ source: 'STATUS_HISTORY', reason: 'Cliente ausente', count: 2 }, { source: 'INCIDENT', reason: 'Tráfico', count: 1 }], efficiency: [{ ...efficiency[0], actualGpsDistanceKm: 11, kmPerDelivery: 5.5, distanceSource: 'GPS_HAVERSINE' }], goals: [], quality: { totalOrders: 4, scheduledOrders: 3, completePodOrders: 1, missingRucOrders: 2, invalidGpsOrders: 0, missingWindowOrders: 2, routesWithoutGps: 1, unconfirmedOrders: 1, unverifiedAddressOrders: 1, unverifiedCoverageOrders: 1 } };
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64');
await context.route('**/*', async route => {
  const req = route.request(); const url = new URL(req.url());
  if (url.origin !== origin) return route.abort();
  if (!url.pathname.startsWith('/api/')) return route.continue();
  const endpoint = url.pathname.slice(4);
  if (req.method() !== 'GET') { evidence.mutations.push({ method: req.method(), endpoint }); return route.fulfill({ status: 405, json: { message: 'Read-only QA: mutation blocked' } }); }
  evidence.apiGets.push({ endpoint, query: url.search });
  const json = value => route.fulfill({ json: value });
  if (endpoint === '/session/me') return json({ subject: 'fixture-admin', roles: [{ authority: 'ROLE_ADMIN' }] });
  if (endpoint === '/notifications/unread/count') return json({ count: 0 });
  if (endpoint === '/notifications/unread') return json([]);
  if (endpoint === '/drivers') return json(drivers);
  if (endpoint === '/vehicles') return json([{ id: 12, plateNumber: 'QA-012', isActive: true, capacityKg: 1000 }]);
  if (endpoint === '/routes') return json(routes);
  if (endpoint === '/orders') return json(orders);
  if (endpoint.endsWith('/business-data')) return json({ customerAccepted: false, addressVerified: false, coverageVerified: false, recipientRuc: null, agreementNote: 'Datos pendientes' });
  if (endpoint.endsWith('/review')) return json({ routeId: 10, approved: true, accepted, loadWeightKg: 100, approvedBy: 'fixture-admin', note: 'Revisión QA' });
  if (endpoint.endsWith('/path')) return json({ polyline: null, orderedOrderIds: [4, 3], distanceKm: 12, durationMin: 40, source: 'haversine' });
  if (endpoint.startsWith('/gps/history/')) return json([]);
  if (endpoint === '/delivery-proofs/2') return json({ id: 2, orderId: 2, receiverName: 'Receptor fixture QA', receiverDni: '12345678', verifiedAt: now, latitude: -12.1, longitude: -77.1 });
  if (endpoint === '/delivery-proofs/1') return route.fulfill({ status: 404, json: { message: 'Este pedido no tiene prueba de entrega' } });
  if (/\/delivery-proofs\/2\/(photo|signature)$/.test(endpoint)) {
    assert.match(req.headers().authorization, /^Bearer /, 'proof image uses authenticated API client');
    return route.fulfill({ contentType: 'image/png', body: png });
  }
  if (endpoint === '/dashboard/orders-by-status') return json([{ status: 'PENDING', count: 1 }, { status: 'DELIVERED', count: 1 }, { status: 'ASSIGNED', count: 2 }]);
  if (endpoint === '/dashboard/delivery-performance') return route.fulfill({ status: 503, json: { message: 'Fuente de puntualidad QA no disponible' } });
  if (endpoint === '/dashboard/deliveries-by-driver' || endpoint === '/reports/driver-performance') return json([{ name: 'Conductor QA', count: 1 }]);
  if (endpoint === '/dashboard/orders-by-district') return json([{ name: 'Centro', count: 4 }]);
  if (endpoint === '/reports/orders-summary') return json({ ordersByStatus: [{ status: 'PENDING', count: 4 }], onTimeDeliveries: 1, delayedDeliveries: 0 });
  if (endpoint === '/reports/route-efficiency') return json(efficiency);
  if (endpoint === '/reports/bi') return json(noBiData ? { ...report, kpis: kpis.map(k => ({ ...k, numerator: 0, denominator: 0, percentage: null, target: null, gap: null, status: 'NO_DATA' })), trends: [], causes: [], efficiency: [], byDriver: [] } : report);
  if (endpoint.startsWith('/reports/goals/')) return json({ code: endpoint.split('/').at(-1), target: 90, updatedBy: 'fixture-admin', updatedAt: now });
  if (endpoint === '/improvement-actions') return json([]);
  if (endpoint === '/incidents') return json([{ id: 5, routeId: 10, orderId: 5, incidentType: 'DELIVERY', severity: 'MEDIUM', description: 'Cliente ausente QA', status: 'OPEN', outcome: null }]);
  if (endpoint === '/users/identities') return unavailableIdentity ? route.fulfill({ status: 503, json: {} }) : json([{ id: 'fixture-admin', username: 'Fixture QA', enabled: true, firstName: 'QA', lastName: '', roles: ['ADMIN'], driverId: null }]);
  if (endpoint === '/users') return json([{ id: 1, userExternalId: 'legacy-fixture', roleId: 3 }]);
  return route.fulfill({ status: 404, json: { message: `Missing fixture: ${endpoint}` } });
});
const page = await context.newPage();
page.on('pageerror', error => evidence.pageErrors.push(error.message));
const check = async (name, run) => { await run(); evidence.tests.push({ name, pass: true }); console.log(`PASS ${name}`); };
const goto = async url => { await page.goto(origin + url); await page.getByRole('heading', { level: 2 }).waitFor(); };
const screenshot = async name => { await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: true }); evidence.screenshots.push(`${name}.png`); };
try {
  await check('P01 draft has three unchecked review boxes and no route field', async () => {
    await goto('/orders'); await page.getByRole('button', { name: 'Nuevo pedido', exact: true }).click();
    const modal = page.getByRole('dialog');
    assert.equal(await modal.getByRole('checkbox').count(), 3);
    for (const box of await modal.getByRole('checkbox').all()) assert.equal(await box.isChecked(), false);
    assert.equal(await modal.locator('select').count(), 0);
    const ruc = modal.getByLabel(/RUC del destinatario/); await ruc.fill('123'); assert.equal(await ruc.evaluate(el => el.checkValidity()), false);
    await screenshot('01_p01_draft_fixture'); await modal.getByRole('button', { name: 'Cerrar', exact: true }).click();
  });
  await check('P01 unconfirmed existing order cannot be assigned', async () => {
    await page.getByRole('row').filter({ hasText: 'FIXTURE-PENDING' }).getByRole('button', { name: /Detalles/ }).click();
    await page.getByText('Pendiente de datos / aceptación comercial, dirección o cobertura').waitFor();
    assert.equal(await page.getByRole('button', { name: 'Asignar', exact: true }).isDisabled(), true);
    assert.equal(await page.getByRole('button', { name: /Simular/ }).count(), 0);
    await screenshot('02_p01_blocked_assignment_fixture'); await page.getByRole('dialog').getByRole('button', { name: 'Cerrar', exact: true }).click();
  });
  await check('terminal order is readonly and POD images load as authenticated blobs', async () => {
    await page.getByRole('row').filter({ hasText: 'FIXTURE-DELIVERED' }).getByRole('button', { name: /Detalles/ }).click();
    await page.getByText(/Pedido cerrado/).waitFor();
    await page.getByAltText('Evidencia de entrega').waitFor(); await page.getByAltText('Firma registrada del receptor').waitFor();
    assert.match(await page.getByAltText('Evidencia de entrega').getAttribute('src'), /^blob:/);
    assert.equal(await page.getByRole('button', { name: 'Guardar estado' }).count(), 0);
    await screenshot('03_pod_readonly_fixture'); await page.getByRole('dialog').getByRole('button', { name: 'Cerrar', exact: true }).click();
  });
  await check('P02 dispatch requires driver acceptance and keeps backend order', async () => {
    await goto('/routes'); await page.getByRole('button', { name: 'Iniciar despacho' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Iniciar despacho' }).isDisabled(), true);
    await page.locator('ol li').first().waitFor(); assert.match(await page.locator('ol li').first().textContent(), /FOURTH/);
    await screenshot('04_p02_pending_acceptance_fixture');
    accepted = true; await page.reload(); await page.getByRole('button', { name: 'Iniciar despacho' }).waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent === 'Iniciar despacho' && !b.disabled));
    await screenshot('04b_p02_accepted_fixture');
    await page.getByRole('button', { name: 'Nueva ruta', exact: true }).click(); await page.getByRole('dialog').waitFor(); await screenshot('04c_p02_create_route_fixture'); await page.getByRole('dialog').getByRole('button', { name: 'Cerrar', exact: true }).click();
  });
  await check('dashboard partial failure retains other sources and forwards all filters', async () => {
    await goto('/dashboard'); await page.getByText('Fuente de puntualidad QA no disponible').waitFor();
    assert.ok(await page.locator('canvas').count() >= 3);
    await page.getByLabel('Conductor', { exact: true }).selectOption('7');
    await page.getByLabel('Desde (Lima)').fill(date);
    const filteredResponse = page.waitForResponse(r => r.url().includes('/dashboard/orders-by-district') && new URL(r.url()).searchParams.get('endDate') === date);
    await page.getByLabel('Hasta (Lima)').fill(date); await filteredResponse;
    for (const endpoint of ['/dashboard/orders-by-status', '/dashboard/delivery-performance', '/dashboard/deliveries-by-driver', '/dashboard/orders-by-district']) assert.ok(evidence.apiGets.some(item => item.endpoint === endpoint && ['driverId=7', `startDate=${date}`, `endDate=${date}`].every(value => item.query.includes(value))), endpoint);
    await screenshot('05_dashboard_partial_failure_fixture');
  });
  await check('route CSV preserves missing GPS and labels by route', async () => {
    await goto('/reports'); await page.getByRole('button', { name: 'Exportar CSV de rutas' }).waitFor();
    const downloadEvent = page.waitForEvent('download'); await page.getByRole('button', { name: 'Exportar CSV de rutas' }).click();
    const download = await downloadEvent; const file = path.join(out, 'route_efficiency_fixture.csv'); await download.saveAs(file);
    const csv = await fs.readFile(file, 'utf8'); assert.match(csv, /plannedDistanceKm.*actualGpsDistanceKm/); assert.match(csv, /UNAVAILABLE/); assert.equal(/Distrito/.test(csv), false);
    await screenshot('05b_reports_fixture');
  });
  await check('all five BI views display at least four charts', async () => {
    await goto('/bi');
    for (const view of ['Tendencias', 'Causas', 'Cumplimiento', 'Calidad de datos', 'Eficiencia']) {
      await page.getByRole('button', { name: view, exact: true }).click();
      await page.waitForFunction(() => document.querySelectorAll('canvas').length >= 4);
      assert.ok(await page.locator('canvas').count() >= 4); await page.locator('canvas').first().scrollIntoViewIfNeeded(); await screenshot(`bi_${view.replaceAll(' ', '_')}_fixture`);
    }
  });
  await check('goals are read from API and improvement actions expose human follow-up', async () => {
    await page.getByRole('button', { name: 'Metas', exact: true }).click(); await page.getByRole('button', { name: 'Guardar meta' }).first().waitFor();
    assert.equal(await page.getByRole('button', { name: 'Guardar meta' }).count(), 5);
    await page.getByRole('button', { name: 'Guardar meta' }).first().scrollIntoViewIfNeeded(); await screenshot('bi_goals_fixture');
    await page.getByRole('button', { name: 'Acciones P05', exact: true }).click(); await page.getByRole('button', { name: 'Nueva acción' }).click();
    await page.getByLabel('Responsable humano').waitFor(); await screenshot('bi_create_improvement_fixture'); await page.getByRole('dialog').getByRole('button', { name: 'Cerrar', exact: true }).click();
  });
  await check('zero denominators remain no-data and are not seeded from baseline', async () => {
    noBiData = true; await page.reload(); await page.getByRole('button', { name: 'Tendencias', exact: true }).click();
    await page.getByText('Sin datos evaluables', { exact: true }).first().waitFor();
    assert.equal(await page.getByText('Sin datos evaluables', { exact: true }).count(), 5);
    await screenshot('bi_no_data_fixture');
  });
  await check('identities handles 503 and legacy is marked migration, effective roles come from API', async () => {
    await goto('/users'); await page.getByText(/Servicio no disponible \(503\)/).waitFor();
    await screenshot('06_identity_503_fixture'); unavailableIdentity = false; await page.reload();
    await page.getByRole('button', { name: 'Editar roles / conductor' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Deshabilitar', exact: true }).isDisabled(), true);
    await screenshot('06b_identity_effective_fixture'); await page.getByRole('button', { name: 'Editar roles / conductor' }).click(); await page.getByRole('dialog').waitFor(); await screenshot('06c_identity_roles_fixture'); await page.getByRole('dialog').getByRole('button', { name: 'Cerrar', exact: true }).click();
    await page.getByRole('button', { name: 'Registro local anterior · migración' }).click(); await page.getByText(/no conceden acceso efectivo/).waitFor();
    await screenshot('06d_identity_legacy_fixture');
  });
  await check('incidents expose reasons, status and decision form without forged actor', async () => {
    await goto('/incidents'); await page.getByText('Cliente ausente QA', { exact: true }).waitFor();
    await screenshot('07a_incident_list_fixture'); await page.getByRole('button', { name: 'Registrar incidencia', exact: true }).click(); await page.getByRole('dialog').waitFor(); await screenshot('07b_incident_create_fixture'); await page.getByRole('dialog').getByRole('button', { name: 'Cerrar', exact: true }).click();
    await page.getByRole('button', { name: 'Resolver', exact: true }).click(); await page.getByLabel('Decisión', { exact: true }).selectOption('REPLAN');
    await page.getByLabel('Próxima ruta PLANNED').waitFor(); assert.equal(await page.getByLabel(/Actor/).count(), 0);
    await screenshot('07_incident_resolution_fixture'); await page.getByRole('dialog').getByRole('button', { name: 'Cerrar', exact: true }).click();
  });
  await check('standalone improvement screen and CSV instructions are reachable', async () => {
    await goto('/improvement-actions'); await page.getByText('Sin acciones registradas.').waitFor(); await screenshot('07c_improvements_empty_fixture');
    await goto('/orders'); await page.getByRole('button', { name: 'Importar CSV', exact: true }).click(); await page.getByRole('dialog').waitFor(); await screenshot('07d_csv_import_contract_fixture'); await page.getByRole('dialog').getByRole('button', { name: 'Cerrar', exact: true }).click();
  });
  await check('mobile create form fits viewport', async () => {
    await page.setViewportSize({ width: 390, height: 844 }); await goto('/orders'); await page.getByRole('button', { name: 'Nuevo pedido', exact: true }).click();
    const bounds = await page.getByRole('dialog').boundingBox(); assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 391);
    await screenshot('08_mobile_draft_fixture');
  });
  assert.deepEqual(evidence.mutations, [], 'no mutation requests were attempted');
  assert.deepEqual(evidence.pageErrors, [], 'no unhandled browser errors');
} catch (error) {
  evidence.tests.push({ name: 'failure', pass: false, message: error.stack });
  await screenshot('failure_fixture'); throw error;
} finally {
  await fs.writeFile(path.join(out, 'results.json'), JSON.stringify(evidence, null, 2));
  await browser.close();
}
