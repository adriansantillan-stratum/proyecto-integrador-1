import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
test('Efficiency chart describes all V15 terminal statuses',()=>{
 const source=fs.readFileSync(new URL('../src/pages/BusinessIntelligence.tsx',import.meta.url),'utf8');
 assert.ok(source.includes("label: 'Operación / (entregas + fallidos + devueltos)'"));
 assert.ok(source.includes('r.timePerStopMin'));
});
test('Efficiency table describes returned stops without claiming service time',()=>{
 const source=fs.readFileSync(new URL('../src/components/EfficiencyTable.tsx',import.meta.url),'utf8');
 assert.ok(source.includes('entregas + fallidos + devueltos; no mide tiempo de atención'));
});
