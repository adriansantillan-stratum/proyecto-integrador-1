import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDeliveryWindowRequest, canEditDeliveryWindow, limaDateTime } from '../src/utils/deliveryWindow.ts';

test('existing offset windows display in Lima, independent of browser timezone', () => {
  assert.equal(limaDateTime('2026-10-20T02:30:15Z'), '2026-10-19T21:30:15');
  assert.equal(limaDateTime('2026-10-20T08:00:00+02:00'), '2026-10-20T01:00:00');
  assert.equal(limaDateTime(null), ''); assert.equal(limaDateTime('invalid'), '');
});
test('delivery window request includes ISO offsets and a trimmed reason, without business fields', () => {
  assert.deepEqual(buildDeliveryWindowRequest('2026-10-20T08:00', '2026-10-20T10:30:15', '  Nueva promesa acordada  ', new Date('2026-10-20T12:00:00Z')), {
    estimatedDeliveryWindowStart: '2026-10-20T08:00:00-05:00', estimatedDeliveryWindowEnd: '2026-10-20T10:30:15-05:00', reason: 'Nueva promesa acordada',
  });
});
test('start may be past, but end must be strictly future at Lima midnight boundary', () => {
  const now = new Date('2026-10-20T05:00:00Z');
  assert.ok(buildDeliveryWindowRequest('2026-10-19T23:00', '2026-10-20T00:01', 'Nuevo acuerdo', now));
  for (const end of ['2026-10-20T00:00', '2026-10-19T23:59']) assert.throws(() => buildDeliveryWindowRequest('2026-10-19T20:00', end, 'Nuevo acuerdo', now), /futuro/);
});
test('equal or inverted windows are rejected', () => {
  for (const end of ['2026-10-20T08:00', '2026-10-20T07:00']) assert.throws(() => buildDeliveryWindowRequest('2026-10-20T08:00', end, 'Nuevo acuerdo'), /posterior/);
});
test('invalid dates, missing endpoints and whitespace-only or short reasons are rejected', () => {
  for (const start of ['', '2026-02-30T10:00', '2026-10-20T25:00', '2026-10-20T08:00Z']) assert.throws(() => buildDeliveryWindowRequest(start, '2099-10-20T12:00', 'Cambio acordado'));
  assert.throws(() => buildDeliveryWindowRequest('2099-10-20T08:00', '', 'Cambio acordado'));
  for (const reason of ['', '     ', ' abcd ']) assert.throws(() => buildDeliveryWindowRequest('2099-10-20T08:00', '2099-10-20T12:00', reason), /cinco/);
});
test('only PENDING or ASSIGNED with no route or a verified PLANNED route can edit', () => {
  for (const status of ['PENDING', 'ASSIGNED']) {
    assert.equal(canEditDeliveryWindow(status, null), true);
    assert.equal(canEditDeliveryWindow(status, 10, 'PLANNED'), true);
    for (const routeStatus of [undefined, 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']) assert.equal(canEditDeliveryWindow(status, 10, routeStatus), false);
  }
  for (const status of ['PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'FAILED', 'RETURNED']) assert.equal(canEditDeliveryWindow(status, null), false);
});
