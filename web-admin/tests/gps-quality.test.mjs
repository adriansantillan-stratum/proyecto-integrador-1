import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import * as analytics from '../src/utils/analytics.ts';
import * as operation from '../src/utils/operation.ts';

const { routeGpsMetrics, gpsQualityMessages, efficiencyCsv, biCsv, metricCodes } = analytics;
const contract = JSON.parse(fs.readFileSync(new URL('../../tools/control_actualizacion/analytics_gps_contract.json', import.meta.url), 'utf8'));
const quality = {
  status: 'AVAILABLE', sampleCount: 3, validSampleCount: 3, invalidSampleCount: 0,
  segmentCount: 2, rejectedSegmentCount: 0, implausibleSpeedSegmentCount: 0,
  nonPositiveTimeSegmentCount: 0, excessiveGapSegmentCount: 0,
  observedDistanceKm: 6543.21, maxSpeedKmh: 80, maxGapSeconds: 60,
};
const route = {
  routeId: 20, label: 'Ruta de prueba', orderCount: 3, plannedDistanceKm: 15,
  actualGpsDistanceKm: 2, operationMinutes: 60, kmPerDelivery: 1,
  timePerStopMin: 20, distanceSource: 'GPS_HAVERSINE', gpsQuality: quality,
};

// Render the actual TSX table in memory, without a browser, server or generated JS files.
const require = createRequire(import.meta.url);
const tableSource = fs.readFileSync(new URL('../src/components/EfficiencyTable.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(tableSource, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
const tableExports = {};
runInNewContext(compiled.outputText, { exports: tableExports, require: specifier => {
  if (specifier === '../utils/analytics') return analytics;
  if (specifier === '../utils/operation') return operation;
  return require(specifier);
} });
const table = rows => renderToStaticMarkup(React.createElement(tableExports.EfficiencyTable, { rows }));
const cells = row => [...table([row]).matchAll(/<td>([\s\S]*?)<\/td>/g)].map(m => m[1]);
const csvCells = row => efficiencyCsv([row]).split('\r\n')[1].split(',');

test('AVAILABLE uses only the API operational values and never the observed audit sum', () => {
  assert.deepEqual(routeGpsMetrics(route), { actualGpsDistanceKm: 2, kmPerDelivery: 1, distanceSource: 'GPS_HAVERSINE' });
  assert.equal(cells(route)[3], '2');
  assert.equal(cells(route)[5], '1');
  assert.match(table([route]), /no acredita movimiento real/);
  assert.match(gpsQualityMessages(route).join(' '), /80 km\/h.*60 s/);
  assert.equal(table([route]).includes('6543'), false);
});

const reasons = {
  INVALID_CONFIGURATION: /[Cc]onfiguración.*inválida/,
  INSUFFICIENT_SAMPLES: /[Mm]uestras insuficientes/,
  INVALID_COORDINATES: /[Cc]oordenadas GPS inválidas/,
  NON_POSITIVE_TIME: /[Tt]imestamps.*nulo o negativo/,
  IMPLAUSIBLE_SPEED: /[Vv]elocidad inverosímil/,
  EXCESSIVE_GAP: /[Ii]ntervalo excesivo.*gap/,
};
assert.deepEqual(Object.keys(reasons).concat('AVAILABLE'), contract.quality.statusPrecedence);
for (const [status, message] of Object.entries(reasons)) {
  test(`${status} hides even stale non-null operational fields in UI and CSV`, () => {
    const rejected = { ...route, actualGpsDistanceKm: 7000, kmPerDelivery: 3500, gpsQuality: { ...quality, status } };
    const before = structuredClone(rejected);
    assert.deepEqual(routeGpsMetrics(rejected), { actualGpsDistanceKm: null, kmPerDelivery: null, distanceSource: 'UNAVAILABLE' });
    assert.equal(cells(rejected)[3], 'No evaluable');
    assert.equal(cells(rejected)[5], 'No evaluable');
    assert.equal(csvCells(rejected)[4], '""');
    assert.equal(csvCells(rejected)[6], '""');
    assert.equal(csvCells(rejected)[8], '"UNAVAILABLE"');
    assert.match(table([rejected]), message);
    assert.deepEqual(rejected, before, 'presentation must not mutate API data');
  });
}

test('null actual distance never falls back to planned, raw observed or zero', () => {
  const absent = { ...route, actualGpsDistanceKm: null, kmPerDelivery: 17 };
  assert.equal(routeGpsMetrics(absent).actualGpsDistanceKm, null);
  assert.equal(routeGpsMetrics(absent).kmPerDelivery, null);
  assert.equal(cells(absent)[2], '15', 'the plan remains a separate column');
  assert.equal(cells(absent)[3], 'No evaluable');
  assert.equal(cells(absent)[5], 'No evaluable');
  assert.equal(csvCells(absent)[4], '""');
});

test('valid stationary zero remains zero in table and CSV', () => {
  const stationary = { ...route, actualGpsDistanceKm: 0, kmPerDelivery: 0, gpsQuality: { ...quality, observedDistanceKm: 0 } };
  assert.deepEqual(routeGpsMetrics(stationary), { actualGpsDistanceKm: 0, kmPerDelivery: 0, distanceSource: 'GPS_HAVERSINE' });
  assert.equal(cells(stationary)[3], '0');
  assert.equal(cells(stationary)[5], '0');
  assert.equal(csvCells(stationary)[4], '"0"');
  assert.equal(csvCells(stationary)[6], '"0"');
});

test('absent or null optional quality supports older APIs without claiming passed controls', () => {
  for (const gpsQuality of [undefined, null]) {
    const legacy = { ...route, gpsQuality };
    assert.equal(routeGpsMetrics(legacy).actualGpsDistanceKm, null);
    assert.equal(cells(legacy)[3], 'No evaluable');
    assert.match(table([legacy]), /Calidad GPS no informada por la API/);
    assert.equal(csvCells(legacy)[4], '""');
  }
});

test('unknown quality or UNAVAILABLE source cannot become operational GPS', () => {
  assert.equal(routeGpsMetrics({ ...route, gpsQuality: { ...quality, status: 'FUTURE_STATUS' } }).actualGpsDistanceKm, null);
  assert.match(gpsQualityMessages({ ...route, gpsQuality: { ...quality, status: 'FUTURE_STATUS' } }).join(' '), /no reconocida/);
  assert.equal(routeGpsMetrics({ ...route, distanceSource: 'UNAVAILABLE' }).actualGpsDistanceKm, null);
});

test('non-finite or negative operational values never leak to the chart/table/CSV projection', () => {
  for (const value of [NaN, Infinity, -Infinity, -1]) {
    assert.equal(routeGpsMetrics({ ...route, actualGpsDistanceKm: value }).actualGpsDistanceKm, null);
    assert.equal(routeGpsMetrics({ ...route, kmPerDelivery: value }).kmPerDelivery, null);
  }
});

test('all rejection counters remain visible despite precedence of one status', () => {
  const mixed = { ...route, gpsQuality: { ...quality, status: 'INVALID_COORDINATES',
    sampleCount: 8, validSampleCount: 7, invalidSampleCount: 1, segmentCount: 7,
    rejectedSegmentCount: 4, implausibleSpeedSegmentCount: 2, nonPositiveTimeSegmentCount: 1, excessiveGapSegmentCount: 1 } };
  const html = table([mixed]);
  assert.match(html, /8 totales, 7 válidas y 1 inválidas/);
  assert.match(html, /rechazados: 4/);
  assert.match(html, /velocidad inverosímil: 2/);
  assert.match(html, /timestamp sin avance.*: 1/);
  assert.match(html, /intervalo excesivo \(gap\): 1/);
});

test('efficiency CSV keeps its nine-column schema and excludes raw audit distance', () => {
  const csv = efficiencyCsv([route]);
  assert.equal(csv.split('\r\n')[0], '\ufeff"routeId","label","orderCount","plannedDistanceKm","actualGpsDistanceKm","operationMinutes","kmPerDelivery","timePerStopMin","distanceSource"');
  assert.equal(csv.includes('observedDistanceKm'), false);
  assert.equal(csv.includes('6543.21'), false);
});

test('GPS quality does not change five KPI period/day exports, driver or Lima dates', () => {
  assert.deepEqual(metricCodes, ['IID', 'CHR', 'TDE', 'SUCCESS', 'ONTIME']);
  const kpis = metricCodes.map(code => ({ code, numerator: 0, denominator: 0, percentage: null, target: null, gap: null, status: 'NO_DATA' }));
  const report = { driverId: 7, startDate: '2026-10-01', endDate: '2026-10-22', timezone: 'America/Lima',
    kpis, trends: [{ date: '2026-10-22', kpis }], efficiency: [route] };
  const csv = biCsv(report);
  assert.equal(csv, biCsv({ ...report, efficiency: [{ ...route, gpsQuality: { ...quality, status: 'IMPLAUSIBLE_SPEED' } }] }));
  assert.equal(csv.split('\r\n').length, 11);
  for (const code of metricCodes) {
    assert.ok(csv.includes(`"PERIOD","","7","2026-10-01","2026-10-22","America/Lima","${code}","0","0","","","","NO_DATA"`));
    assert.ok(csv.includes(`"DAY","2026-10-22","7","2026-10-01","2026-10-22","America/Lima","${code}","0","0","","","","NO_DATA"`));
  }
});

test('efficiency charts consume the same guarded GPS projection as table and CSV', () => {
  const source = fs.readFileSync(new URL('../src/pages/BusinessIntelligence.tsx', import.meta.url), 'utf8');
  assert.match(source, /const gpsEfficiency = report\.efficiency\.map\(routeGpsMetrics\)/);
  assert.match(source, /values: gpsEfficiency\.map\(r => r\.actualGpsDistanceKm\)/);
  assert.match(source, /values: gpsEfficiency\.map\(r => r\.kmPerDelivery\)/);
  assert.equal(source.includes('observedDistanceKm'), false);
  assert.ok(source.includes('<SourceState {...report} retry={report.reload} />'));
});
