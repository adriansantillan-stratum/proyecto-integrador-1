// Evaluate proposed V16 SELECT on local historical data without installing any DB objects.
// Usage: node tools/control_actualizacion/analytics_audit_local.mjs [--route-id 20]
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
assert.ok(process.argv.length===2 || (process.argv.length===4 && process.argv[2]==='--route-id'), 'Use --route-id <positive integer>');
const routeId=Number(process.argv[3] ?? 20);assert.ok(Number.isSafeInteger(routeId)&&routeId>0);
const now=()=>new Date().toLocaleString('sv-SE',{timeZone:'America/Lima',hour12:false}).replace(' ','T')+'-05:00';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const migration=await fs.readFile(path.join(root,'src/main/resources/db/migration/V16__analytics_gps_quality.sql'),'utf8');
const body=migration.match(/AS \$\$\s*([\s\S]*?)\s*\$\$;/)?.[1];
assert.ok(body?.startsWith('WITH samples AS ('),'Expected static V16 read query');
assert.ok(!/\b(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE|COPY|CALL)\b/i.test(body),'Not a SELECT-only body');
const proposed=body.replace(/;\s*$/,'').replace(/\bmax_speed_kmh\b/g,'160::double precision')
  .replace(/\bmax_gap_seconds\b/g,'900::double precision');
const query=`BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL TIME ZONE 'America/Lima';
SET LOCAL statement_timeout='20000ms';
WITH proposed(route_id,gps_sample_count,valid_gps_sample_count,invalid_gps_sample_count,gps_segment_count,
 rejected_gps_segment_count,implausible_speed_segment_count,nonpositive_time_segment_count,
 excessive_gap_segment_count,first_gps_at,last_gps_at,observed_distance_km,actual_gps_distance_km,gps_quality)
 AS (${proposed}), scoped AS (
 SELECT f.* FROM analytics_order_facts f JOIN routes r ON r.id=${routeId}
 WHERE f.driver_id=r.driver_id AND f.operation_date=r.route_date
)
SELECT json_build_object('transactionReadOnly',current_setting('transaction_read_only'),
 'installedMigrations',(SELECT json_agg(version ORDER BY installed_rank) FROM flyway_schema_history WHERE success),
 'route',(SELECT json_build_object('id',r.id,'driverId',r.driver_id,'vehicleId',r.vehicle_id,'date',r.route_date,'status',r.status,
   'actualStartTime',r.actual_start_time,'actualEndTime',r.actual_end_time) FROM routes r WHERE id=${routeId}),
 'currentView',(SELECT json_build_object('actualGpsDistanceKm',actual_gps_distance_km,'kmPerDelivery',km_per_delivery,
   'timePerStopMin',time_per_stop_min,'plannedDistanceKm',planned_distance_km,'gpsSampleCount',gps_sample_count,'distanceSource',distance_source)
   FROM analytics_route_facts WHERE route_id=${routeId}),
 'proposedV16',(SELECT row_to_json(p) FROM proposed p WHERE route_id=${routeId}),
 'driverDateCounts',(SELECT json_build_object('total',count(*),'valid',count(*) FILTER(WHERE iid_valid),
   'scheduled',count(*) FILTER(WHERE scheduled),'deliveredScheduled',count(*) FILTER(WHERE scheduled AND delivered),
   'evidenceScheduled',count(*) FILTER(WHERE scheduled AND digital_evidence),'delivered',count(*) FILTER(WHERE delivered),
   'onTime',count(*) FILTER(WHERE on_time),'evaluable',count(*) FILTER(WHERE ontime_evaluable)) FROM scoped),
 'driverDateStatusCounts',(SELECT json_object_agg(status,n) FROM (SELECT status,count(*) n FROM scoped GROUP BY status) s));
COMMIT;`;
const report={startedAt:now(),timezone:'America/Lima',scope:'LOCAL_READ_ONLY_SQL',businessAcceptance:'NOT_ATTESTED',routeId,
  method:'Proposed V16 function body evaluated as SELECT only, with 160 km/h and 900 s. No migration installed.',
  connection:{container:'ecoroute-db',db:'ecoroute',dbUser:'user',documentedIn:['README.md','GUIA_COMPLETA.md']},
  migrationSourceSha256:sha(migration),querySha256:sha(query),status:'RUNNING'};
const file=path.join(root,'tools/control_actualizacion',`analytics_route_${routeId}_${now().replaceAll(':','')}.json`);
const handle=await fs.open(file,'wx');
const save=async()=>{const b=Buffer.from(JSON.stringify(report,null,2)+'\n');await handle.truncate(0);await handle.write(b,0,b.length,0);await handle.sync();};
await save();
try {
  const stdout=await new Promise((resolve,reject)=>{
    const child=execFile('docker',['exec','-i','ecoroute-db','psql','-X','-qAt','-U','user','-d','ecoroute','-v','ON_ERROR_STOP=1'],
      {windowsHide:true,encoding:'utf8',timeout:30000,maxBuffer:1024*1024},(error,out,err)=>error?reject(new Error(err||error.code)):resolve(out));
    child.stdin.on('error',()=>{});child.stdin.end(query);
  });
  report.observation=JSON.parse(stdout.trim());
  assert.equal(report.observation.transactionReadOnly,'on');assert.ok(report.observation.route,'Route missing');
  const counts=report.observation.driverDateCounts;
  report.sqlKpis=Object.entries({IID:['valid','total'],CHR:['deliveredScheduled','scheduled'],TDE:['evidenceScheduled','scheduled'],
    SUCCESS:['delivered','total'],ONTIME:['onTime','evaluable']}).map(([code,[n,d]])=>({code,numerator:counts[n],denominator:counts[d],
      percentage:counts[d]===0?null:Number((BigInt(counts[n])*20000n/BigInt(counts[d])+1n)/2n)/100}));
  report.status='PASS';
  report.interpretation='Actual observation of existing rows, not proof of physical travel. Proposed V16 output is not a deployed API response. KPI SQL values are scoped to route owner/date; API contract validated separately in disposable integration tests.';
}catch(error){report.status='FAIL';report.error=error.message;}
finally{report.finishedAt=now();await save();await handle.close();}
console.log(JSON.stringify({status:report.status,file,route:report.observation?.route,
  current:report.observation?.currentView,proposed:report.observation?.proposedV16,error:report.error}));
if(report.status!=='PASS')process.exitCode=1;
