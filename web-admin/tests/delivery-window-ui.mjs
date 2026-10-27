/** All API calls are intercepted. PATCHes change in-memory fixtures only; never forwarded. */
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { operationDate } from '../src/utils/operation.ts';
const require = createRequire('C:/Users/USUARIO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/package.json');
const { chromium } = require('playwright');
const origin = 'http://127.0.0.1:4317';
const out = path.resolve('tools/audit_e2e/delivery-window-ui');
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'Asia/Tokyo', locale: 'es-PE' });
const token = ['eyJhbGciOiJub25lIn0', Buffer.from(JSON.stringify({ sub: 'fixture-admin' })).toString('base64url'), 'fixture'].join('.');
await context.addInitScript(value => { if (location.origin === 'http://127.0.0.1:4317') localStorage.setItem('token', value); }, token);
let role = 'ADMIN', routeStatus = 'PLANNED', rejectWindow = false;
const order = { id: 31, trackingNumber: 'FIXTURE-REPLAN', externalReference: 'REF-ORIGINAL', status: 'ASSIGNED', routeId: 10, recipientName: 'Destinatario fixture', recipientPhone: '999999999', recipientEmail: '', deliveryAddress: 'Dirección fixture', deliveryCity: 'Lima', deliveryDistrict: 'Centro', latitude: -12.1, longitude: -77.1, priority: 0, estimatedDeliveryWindowStart: '2099-10-20T13:00:00Z', estimatedDeliveryWindowEnd: '2099-10-20T15:00:00Z', createdAt: new Date().toISOString() };
const business = { recipientRuc: '20123456789', customerAccepted: true, addressVerified: true, coverageVerified: true, agreementNote: 'Condiciones originales del cliente', confirmedBy: 'fixture-admin', confirmedAt: new Date().toISOString() };
const evidence = { mode: 'IN_MEMORY_FIXTURES_ONLY', scenarios: [], fixtureWrites: [], forwardedOperationalWrites: 0, realPodRequests: 0, screenshots: [], pageErrors: [] };
await context.route('**/*', async route => {
  const req = route.request(), url = new URL(req.url());
  if (url.origin !== origin) return route.abort();
  if (!url.pathname.startsWith('/api/')) return route.continue();
  const endpoint = url.pathname.slice(4), json = data => route.fulfill({ json: data });
  if (req.method() === 'PATCH' && endpoint === '/orders/31/delivery-window') {
    const body = req.postDataJSON(); evidence.fixtureWrites.push({ endpoint, body });
    if (rejectWindow) return route.fulfill({ status: 409, json: { message: 'La ruta ya no está en planificación (fixture)' } });
    Object.assign(order, { estimatedDeliveryWindowStart: body.estimatedDeliveryWindowStart, estimatedDeliveryWindowEnd: body.estimatedDeliveryWindowEnd });
    business.customerAccepted = false;
    return json(order);
  }
  if (req.method() === 'PATCH' && endpoint === '/orders/31/business-data') {
    const body = req.postDataJSON(); evidence.fixtureWrites.push({ endpoint, body }); Object.assign(business, body); return json(business);
  }
  if (req.method() !== 'GET') return route.fulfill({ status: 405, json: { message: 'Fixture: unapproved write blocked' } });
  if (endpoint === '/session/me') return json({ subject: 'fixture-admin', roles: [{ authority: `ROLE_${role}` }] });
  if (endpoint === '/notifications/unread/count') return json({ count: 0 });
  if (endpoint === '/orders') return json([order]);
  if (endpoint === '/routes') return json([{ id: 10, status: routeStatus, routeDate: operationDate(), driverId: 7, vehicleId: 12 }]);
  if (endpoint === '/orders/31/business-data') return json(business);
  if (endpoint.startsWith('/delivery-proofs/')) return route.fulfill({ status: 404, json: { message: 'POD fixture no registrado; sin acceso a S3 real' } });
  return route.fulfill({ status: 404, json: { message: 'Fixture no definido' } });
});
const page = await context.newPage(); page.on('pageerror', error => evidence.pageErrors.push(error.message));
const check = async (name, run) => { await run(); evidence.scenarios.push({ name, pass: true }); console.log(`PASS ${name}`); };
const screenshot = async name => { await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: true }); evidence.screenshots.push(`${name}.png`); };
async function openOrder() { await page.goto(origin + '/orders'); await page.getByRole('button', { name: /Detalles/ }).click(); await page.getByRole('dialog').waitFor(); }
try {
  await check('ASSIGNED replan opens current window in Lima even when browser is in Tokyo', async () => {
    await openOrder(); assert.match(await page.getByLabel('Nuevo inicio (Lima)').inputValue(), /^2099-10-20T08:00(:00)?$/);
    assert.match(await page.getByLabel('Nuevo fin (Lima)').inputValue(), /^2099-10-20T10:00(:00)?$/);
  });
  await check('unsaved window blocks commercial confirmation; discard restores it', async () => {
    await page.getByLabel('Nuevo fin (Lima)').fill('2099-10-20T11:00');
    assert.equal(await page.getByRole('button', { name: 'Guardar revisión comercial' }).isDisabled(), true);
    await page.getByRole('button', { name: 'Descartar edición de ventana' }).click();
    assert.match(await page.getByLabel('Nuevo fin (Lima)').inputValue(), /^2099-10-20T10:00(:00)?$/);
  });
  await check('window PATCH sends offsets/reason only and clears stale acceptance while preserving RUC/address/coverage', async () => {
    await page.getByLabel('Nuevo fin (Lima)').fill('2099-10-20T11:00');
    await page.getByLabel('Motivo del cambio de ventana').fill('Cliente solicitó reprogramación');
    await page.getByRole('button', { name: 'Guardar nueva ventana' }).click();
    await page.getByText(/Ventana guardada\. Aceptación comercial pendiente/).waitFor();
    assert.equal(await page.getByLabel('Cliente aceptó las condiciones').isChecked(), false);
    assert.equal(await page.getByLabel('Dirección verificada', { exact: true }).isChecked(), true);
    assert.equal(await page.getByLabel('Cobertura verificada', { exact: true }).isChecked(), true);
    assert.equal(await page.getByLabel(/RUC del destinatario/).inputValue(), '20123456789');
    assert.deepEqual(evidence.fixtureWrites[0].body, { estimatedDeliveryWindowStart: '2099-10-20T08:00:00-05:00', estimatedDeliveryWindowEnd: '2099-10-20T11:00:00-05:00', reason: 'Cliente solicitó reprogramación' });
    await screenshot('01_window_saved_acceptance_pending_fixture');
  });
  await check('commercial agreement is explicitly reconfirmed separately on the same ID', async () => {
    assert.equal(evidence.fixtureWrites.length, 1, 'window never implicitly reconfirms agreement');
    await page.getByLabel('Cliente aceptó las condiciones').check();
    await page.getByLabel('Condiciones acordadas / nota de revisión').fill('Cliente aceptó la nueva ventana hasta las 11:00 Lima');
    await page.getByRole('button', { name: 'Guardar revisión comercial' }).click(); await page.getByText('Confirmación guardada.').waitFor();
    assert.equal(evidence.fixtureWrites[1].endpoint, '/orders/31/business-data'); assert.equal(evidence.fixtureWrites[1].body.customerAccepted, true);
    await screenshot('02_agreement_reconfirmed_fixture');
  });
  await check('409 preserves the edited window and server reason without resetting agreement', async () => {
    rejectWindow = true;
    await page.getByLabel('Nuevo fin (Lima)').fill('2099-10-20T12:00'); await page.getByLabel('Motivo del cambio de ventana').fill('Segundo cambio solicitado');
    await page.getByRole('button', { name: 'Guardar nueva ventana' }).click(); await page.getByText('La ruta ya no está en planificación (fixture)', { exact: true }).waitFor();
    assert.equal(await page.getByLabel('Nuevo fin (Lima)').inputValue(), '2099-10-20T12:00'); assert.equal(business.customerAccepted, true);
    await screenshot('03_conflict_preserves_draft_fixture');
  });
  await check('past end is rejected locally without an API request', async () => {
    const count = evidence.fixtureWrites.length;
    await page.getByLabel('Nuevo inicio (Lima)').fill('2020-01-01T08:00'); await page.getByLabel('Nuevo fin (Lima)').fill('2020-01-01T10:00');
    await page.getByRole('button', { name: 'Guardar nueva ventana' }).click(); await page.getByText('El fin de la ventana debe estar en el futuro.', { exact: true }).waitFor();
    assert.equal(evidence.fixtureWrites.length, count);
  });
  await check('DISPATCHER can edit planned PENDING, but IN_PROGRESS or terminal orders stay readonly', async () => {
    role = 'DISPATCHER'; order.status = 'PENDING'; order.routeId = null; rejectWindow = false;
    await openOrder(); await page.getByLabel('Nuevo inicio (Lima)').waitFor();
    order.routeId = 10; routeStatus = 'IN_PROGRESS'; await openOrder(); await page.getByText(/Ventana de solo lectura/).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Guardar nueva ventana' }).count(), 0);
    routeStatus = 'PLANNED'; order.status = 'FAILED'; await openOrder(); await page.getByText(/Ventana de solo lectura/).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Guardar nueva ventana' }).count(), 0);
    await screenshot('04_terminal_window_readonly_fixture');
  });
  assert.deepEqual(evidence.pageErrors, []);
} catch (error) { evidence.scenarios.push({ name: 'failure', pass: false, message: error.stack }); await screenshot('failure_fixture'); throw error; }
finally { await fs.writeFile(path.join(out, 'results.json'), JSON.stringify(evidence, null, 2)); await browser.close(); }
