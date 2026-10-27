import test from 'node:test';
import assert from 'node:assert/strict';
import { operationDate, decodePolyline, errorMessage, filterQuery, validRuc, businessConfirmed, canAssign, manualTransitions, isTerminal, csvContent } from '../src/utils/operation.ts';
import { efficiencyCsv, biCsv } from '../src/utils/analytics.ts';
import { parseGpsMessage } from '../src/utils/gpsMessage.ts';
import { watchGpsConnection } from '../src/utils/gpsSubscription.ts';

test('Lima stays on previous date until 05:00 UTC', () => {
  assert.equal(operationDate(new Date('2026-10-20T04:59:59Z')), '2026-10-19');
  assert.equal(operationDate(new Date('2026-10-20T05:00:00Z')), '2026-10-20');
});
test('tomorrow handles month, leap year and year boundaries', () => {
  assert.equal(operationDate(new Date('2024-03-01T04:30:00Z'), 1), '2024-03-01');
  assert.equal(operationDate(new Date('2027-01-01T04:30:00Z'), 1), '2027-01-01');
  assert.equal(operationDate(new Date('2026-03-01T05:00:00Z'), -1), '2026-02-28');
});
test('polyline5 decodes official example, including negative longitude', () => {
  assert.deepEqual(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@'), [[38.5, -120.2], [40.7, -120.95], [43.252, -126.453]]);
});
test('empty geometry is empty and truncated / invalid geometry fails explicitly', () => {
  assert.deepEqual(decodePolyline(''), []);
  for (const value of ['_', '?', '????_', '\u0000', '~~~~~~~~~~~~~~~']) assert.throws(() => decodePolyline(value), /inválida/);
});
test('RUC is optional but strictly eleven ASCII digits when supplied', () => {
  assert.ok(validRuc('')); assert.ok(validRuc('20123456789'));
  for (const value of ['2012345678', '201234567890', '2012345678A', ' 20123456789', '２０１２３４５６７８９']) assert.equal(validRuc(value), false);
});
test('all three P01 checks are required independently', () => {
  assert.equal(businessConfirmed(), false);
  const complete = { customerAccepted: true, addressVerified: true, coverageVerified: true };
  assert.equal(businessConfirmed(complete), true);
  for (const key of Object.keys(complete)) assert.equal(businessConfirmed({ ...complete, [key]: false }), false);
});
test('assignment only allows confirmed PENDING into PLANNED', () => {
  assert.equal(canAssign('PENDING', true, 'PLANNED'), true);
  for (const status of ['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'FAILED', 'RETURNED']) assert.equal(canAssign(status, true, 'PLANNED'), false);
  assert.equal(canAssign('PENDING', false, 'PLANNED'), false);
  assert.equal(canAssign('PENDING', true, 'IN_PROGRESS'), false);
});
test('manual lifecycle never permits DELIVERED and all terminal states are readonly', () => {
  for (const status of ['PENDING', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'FAILED', 'RETURNED']) assert.equal(manualTransitions(status).includes('DELIVERED'), false);
  assert.deepEqual(manualTransitions('ASSIGNED'), ['PICKED_UP']);
  assert.deepEqual(manualTransitions('IN_TRANSIT'), ['FAILED', 'RETURNED']);
  for (const status of ['DELIVERED', 'FAILED', 'RETURNED']) { assert.equal(isTerminal(status), true); assert.deepEqual(manualTransitions(status), []); }
});
test('every analytics filter survives encoding, empty filters are omitted, invalid range rejected', () => {
  const params = new URLSearchParams(filterQuery({ driverId: '27', startDate: '2026-10-01', endDate: '2026-10-19' }));
  assert.equal(params.get('driverId'), '27'); assert.equal(params.get('startDate'), '2026-10-01'); assert.equal(params.get('endDate'), '2026-10-19');
  assert.equal(filterQuery({ driverId: '', startDate: '', endDate: '' }), '');
  assert.throws(() => filterQuery({ driverId: '', startDate: '2026-10-20', endDate: '2026-10-19' }), /inválido/);
});
test('error helper preserves business reasons and shows unavailable/configuration status', () => {
  assert.equal(errorMessage({ response: { status: 409, data: { message: 'Falta aceptación del conductor' } } }), 'Falta aceptación del conductor');
  assert.equal(errorMessage({ response: { data: { detail: 'Sin prueba' } } }), 'Sin prueba');
  assert.match(errorMessage({ response: { status: 503, data: {} } }), /503.*configuración/);
  assert.match(errorMessage({ response: { status: 403, data: '<html>Forbidden</html>' } }), /403/);
  assert.equal(errorMessage(new Error('Conexión perdida')), 'Conexión perdida');
});
test('CSV quotes commas, embedded quotes and multiline fields, neutralizes spreadsheet formulas', () => {
  const text = csvContent([['a,b', '"firma"', 'línea\nsiguiente', '=1+1', -2, null]]);
  assert.equal(text, '\ufeff"a,b","""firma""","línea\nsiguiente","\'=1+1","-2",""');
});
test('efficiency CSV is one row per route, preserves nulls and separates GPS from plan', () => {
  const text = efficiencyCsv([{ routeId: 7, label: 'Ruta, norte', orderCount: 3, plannedDistanceKm: 10, actualGpsDistanceKm: null, operationMinutes: 60, kmPerDelivery: null, timePerStopMin: 20, distanceSource: 'UNAVAILABLE' }]);
  const [header, row] = text.split('\r\n');
  assert.match(header, /plannedDistanceKm.*actualGpsDistanceKm/);
  assert.equal(row, '"7","Ruta, norte","3","10","","60","","20","UNAVAILABLE"');
  assert.equal(/district/i.test(header), false);
});
test('BI export preserves zero denominator as missing, with scope, filters and formula', () => {
  const text = biCsv({ driverId: 7, startDate: '2026-10-01', endDate: null, timezone: 'America/Lima', kpis: [{ code: 'TDE', numerator: 0, denominator: 0, percentage: null, target: null, gap: null, status: 'NO_DATA' }], trends: [] });
  assert.match(text, /"PERIOD","","7","2026-10-01","","America\/Lima","TDE","0","0","","","","NO_DATA"/);
  assert.match(text, /foto O firma/);
});
test('GPS parser rejects wrong vehicle, zero coordinate pair, invalid dates and malformed frames', () => {
  const valid = { vehicleId: 12, latitude: -12.1, longitude: -77.1, speedKmh: 20, timestamp: 1792454400000 };
  assert.deepEqual(parseGpsMessage(JSON.stringify(valid), 12), valid);
  for (const value of [{ ...valid, vehicleId: 8 }, { ...valid, latitude: 91 }, { ...valid, latitude: 0, longitude: 0 }, { ...valid, timestamp: 'today' }, { ...valid, timestamp: 1e20 }, null]) assert.throws(() => parseGpsMessage(JSON.stringify(value), 12), /GPS/);
});
test('WebSocket fallback preserves authentication callback, polls after error/close and cleans up', async () => {
  class FakeSocket extends EventTarget {
    onopen = () => { this.authFrames++; };
    authFrames = 0; closed = false;
    emit(type) { if (type === 'open') this.onopen(); this.dispatchEvent(new Event(type)); }
    close() { this.closed = true; this.emit('close'); }
  }
  const socket = new FakeSocket();
  const states = []; let polls = 0;
  const stop = watchGpsConnection(socket, () => polls++, value => states.push(value), 5);
  await new Promise(resolve => setTimeout(resolve, 18)); assert.ok(polls > 0, 'pending connection polls');
  socket.emit('open'); assert.equal(socket.authFrames, 1);
  const connectedPolls = polls;
  await new Promise(resolve => setTimeout(resolve, 15)); assert.equal(polls, connectedPolls, 'open connection suppresses GPS polling');
  socket.emit('error'); await new Promise(resolve => setTimeout(resolve, 15)); assert.ok(polls > connectedPolls);
  socket.emit('open'); socket.emit('close'); await new Promise(resolve => setTimeout(resolve, 15)); assert.ok(polls > connectedPolls);
  stop(); const stoppedPolls = polls;
  await new Promise(resolve => setTimeout(resolve, 15)); assert.equal(polls, stoppedPolls); assert.equal(socket.closed, true);
  assert.deepEqual(states, [true, false, true, false]);
});
