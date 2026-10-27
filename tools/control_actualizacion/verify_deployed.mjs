import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'../..'),file=path.join(root,'docs/control_actualizacion/evidencias/api_v16.json');
if(fs.existsSync(file))throw Error('Evidence already exists');
const report={at:new Date().toISOString(),scope:'LOCAL_READ_ONLY_API_SQL',businessAcceptance:'NOT_ATTESTED',checks:[]};
const check=(name,fn)=>{fn();report.checks.push({name,result:'PASS'});};
let token;
async function get(url){const r=await fetch('http://localhost:8081'+url,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(20000)});assert.equal(r.status,200,url);return r.json();}
function sql(q){return JSON.parse(execFileSync('docker',['exec','-i','ecoroute-db','psql','-X','-qAt','-U','user','-d','ecoroute','-v','ON_ERROR_STOP=1'],{input:'BEGIN READ ONLY;\n'+q+'\nCOMMIT;',encoding:'utf8',windowsHide:true}));}
try{
 const r=await fetch('http://localhost:8080/realms/ecoroute/protocol/openid-connect/token',{method:'POST',body:new URLSearchParams({client_id:'mobile-app',grant_type:'password',username:'admin',password:process.env.ECOROUTE_ADMIN_PASSWORD||'admin123'})});
 assert.equal(r.status,200);token=(await r.json()).access_token;
 const data=await get('/reports/bi?driverId=1&startDate=2026-10-22&endDate=2026-10-22');
 report.kpis=data.kpis;report.efficiency=data.efficiency;
 const state=sql("SELECT json_build_object('version',(SELECT version FROM flyway_schema_history WHERE success ORDER BY installed_rank DESC LIMIT 1),'routes',(SELECT json_agg(t) FROM (SELECT route_id,actual_gps_distance_km,km_per_delivery,gps_quality,observed_distance_km FROM analytics_route_facts WHERE driver_id=1 AND operation_date=DATE '2026-10-22' ORDER BY route_id) t));");
 report.sql=state;
 check('Flyway V16 active',()=>assert.equal(state.version,'16'));
 check('Route20 impossible jump is not travelled distance',()=>{const row=data.efficiency.find(r=>r.routeId===20);assert.ok(row);assert.equal(row.actualGpsDistanceKm,null);assert.equal(row.kmPerDelivery,null);assert.equal(row.distanceSource,'UNAVAILABLE');assert.equal(row.gpsQuality.status,'IMPLAUSIBLE_SPEED');assert.ok(row.gpsQuality.observedDistanceKm>6000);});
 for(const row of state.routes)check('GPS API/SQL route '+row.route_id,()=>{const actual=data.efficiency.find(r=>r.routeId===row.route_id);assert.ok(actual);assert.equal(actual.gpsQuality.status,row.gps_quality);for(const [a,b] of [[actual.actualGpsDistanceKm,row.actual_gps_distance_km],[actual.kmPerDelivery,row.km_per_delivery],[actual.gpsQuality.observedDistanceKm,row.observed_distance_km]]){if(b===null)assert.equal(a,null);else assert.ok(Math.abs(a-b)<1e-8);}});
 for(const [code,n,d] of [['IID',4,4],['CHR',2,4],['TDE',2,4],['SUCCESS',2,4],['ONTIME',2,2]])check('KPI unchanged '+code,()=>{const k=data.kpis.find(k=>k.code===code);assert.ok(k);assert.equal(k.numerator,n);assert.equal(k.denominator,d);assert.equal(k.percentage,n*100/d);});
 report.result='PASS';
}catch(error){report.result='FAIL';report.error=String(error.message).replace(/eyJ[\w.-]+/g,'[REDACTED]');process.exitCode=1;}
finally{token=undefined;report.finishedAt=new Date().toISOString();fs.writeFileSync(file,JSON.stringify(report,null,2),{flag:'wx'});console.log(JSON.stringify({result:report.result,checks:report.checks.length,error:report.error}));}
