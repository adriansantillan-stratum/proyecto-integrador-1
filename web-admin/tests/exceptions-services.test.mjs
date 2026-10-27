import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { errorMessage } from '../src/utils/operation.ts';

// Execute the actual service functions with an in-memory transport. No Axios,
// browser session, authentication provider or running API is loaded/contacted.
const key = Symbol.for('ecoroute.exceptions.test.transport');
const calls = [];
let response;
let rejection;
globalThis[key] = Object.fromEntries(['patch', 'post', 'get', 'delete'].map(method => [method, async (...args) => {
  calls.push({ method, args });
  if (rejection) throw rejection;
  return { data: response };
}]));
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === './api' && /\/src\/services\/(orderService|routeService|incidentService)\.ts$/.test(context.parentURL ?? '')) {
      return { url: 'exceptions-test:transport', shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === 'exceptions-test:transport') return {
      format: 'module', shortCircuit: true,
      source: 'export default globalThis[Symbol.for("ecoroute.exceptions.test.transport")];',
    };
    return nextLoad(url, context);
  },
});
const orderService = await import('../src/services/orderService.ts');
const routeService = await import('../src/services/routeService.ts');
const incidentService = await import('../src/services/incidentService.ts');
hooks.deregister();
function prepare(data) { calls.length = 0; response = data; rejection = undefined; }

test('EXC-W01 assignment uses existing order PATCH and propagates commercial conflict', async () => {
  prepare(undefined);
  rejection = { response: { status: 409, data: { message: 'Falta renovar la aceptación comercial' } } };
  await assert.rejects(orderService.assignOrder(11, 22), error => error === rejection);
  assert.deepEqual(calls, [{ method: 'patch', args: ['/orders/11/route', { routeId: 22 }] }]);
  assert.equal(errorMessage(rejection), 'Falta renovar la aceptación comercial');
});
test('EXC-W02 RETRY transports decision and reason without recreating the original order', async () => {
  prepare({ id: 51, outcome: 'RETRY', retryOrderId: 12 });
  assert.equal((await incidentService.resolveIncident(51, 'RETRY', 'Cliente disponible para reintento')).retryOrderId, 12);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'patch');
  assert.equal(calls[0].args[0], '/incidents/51/resolution');
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0].args[1])), { outcome: 'RETRY', reason: 'Cliente disponible para reintento' });
});
test('EXC-W03 REPLAN sends target route and preserves linked attempt returned by server', async () => {
  prepare({ id: 51, outcome: 'REPLAN', nextRouteId: 22, retryOrderId: 12 });
  const resolved = await incidentService.resolveIncident(51, 'REPLAN', 'Nueva fecha aceptada en prueba', 22);
  assert.deepEqual(calls, [{ method: 'patch', args: ['/incidents/51/resolution', { outcome: 'REPLAN', reason: 'Nueva fecha aceptada en prueba', nextRouteId: 22 }] }]);
  assert.equal(resolved.retryOrderId, 12);
  assert.equal(resolved.nextRouteId, 22);
});
test('EXC-W04 cancellation rejection remains an error and never falls back to changing orders', async () => {
  prepare(undefined);
  rejection = { response: { status: 409, data: { message: 'Reasigne los pedidos antes de cancelar' } } };
  await assert.rejects(routeService.updateRouteStatus(21, 'CANCELLED'), error => error === rejection);
  assert.deepEqual(calls, [{ method: 'patch', args: ['/routes/21/status?status=CANCELLED'] }]);
  assert.equal(errorMessage(rejection), 'Reasigne los pedidos antes de cancelar');
});
test('EXC-W05 definitive closure permission error is propagated without a second request', async () => {
  prepare(undefined);
  rejection = { response: { status: 403, data: { message: 'El cierre definitivo requiere jefatura' } } };
  await assert.rejects(incidentService.resolveIncident(51, 'CLOSE_CASE', 'Caso de prueba revisado'), error => error === rejection);
  assert.equal(calls.length, 1);
  assert.equal(errorMessage(rejection), 'El cierre definitivo requiere jefatura');
});
