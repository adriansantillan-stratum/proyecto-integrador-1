import fs from 'node:fs/promises';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = path.join(root,'tools/control_actualizacion');
const build = path.join(root,'build/analytics_actualizacion_20261022');
const now = () => new Date().toLocaleString('sv-SE',{timeZone:'America/Lima',hour12:false}).replace(' ','T')+'-05:00';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const fileHash = async file => sha(await fs.readFile(path.join(root,file)));
const javaHome = process.env.JAVA_HOME || 'C:/Program Files/Eclipse Adoptium/jdk-17.0.17.10-hotspot';
const migrationDir = 'src/main/resources/db/migration';
const protectedMigrations = (await fs.readdir(path.join(root,migrationDir))).filter(f => /^V(?:[1-9]|1[0-5])__/.test(f)).sort();
const hashes = async () => Object.fromEntries(await Promise.all(protectedMigrations.map(async f => [f,await fileHash(`${migrationDir}/${f}`)])));
const command = "& .\\gradlew.bat test --tests '*Analytics*Test' --rerun-tasks --no-daemon --console=plain -I tools/control_actualizacion/analytics_verification.init.gradle; exit $LASTEXITCODE";
const report = {startedAt:now(),timezone:'America/Lima',scope:'BACKEND_ANALYTICS_ONLY',businessAcceptance:'NOT_ATTESTED',
  syntheticTestData:true,productionEffectiveness:'NOT_MEASURED',realRoute20Remeasured:false,
  command,javaHome,buildDirectory:build,protectedMigrationsBefore:await hashes(),status:'RUNNING',
  isolation:'Testcontainers disposable PostgreSQL only. No compose/rebuild/deploy/migration commands against project services.'};
const destination = path.join(out,`analytics_verification_${now().replaceAll(':','')}.json`);
const handle = await fs.open(destination,'wx');
async function save() { const b=Buffer.from(JSON.stringify(report,null,2)+'\n'); await handle.truncate(0);await handle.write(b,0,b.length,0);await handle.sync(); }
await save();
try {
  console.log('Running focused analytics tests; disposable PostgreSQL, no project service changes.');
  const result = await new Promise(resolve => {
    const child = execFile('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-Command',command],
      {cwd:root,windowsHide:true,encoding:'utf8',timeout:600000,maxBuffer:16*1024*1024,
        env:{...process.env,JAVA_HOME:javaHome}},(error,stdout,stderr)=>resolve({error,stdout,stderr}));
    const heartbeat=setInterval(()=>console.log('Analytics tests still running.'),30000);
    child.once('close',()=>clearInterval(heartbeat));
  });
  report.exitCode=result.error?.code ?? 0; report.stdout=result.stdout;report.stderr=result.stderr;
  const xmlDir=path.join(build,'test-results/test');
  report.suites=[];
  const attrs = value => Object.fromEntries([...value.matchAll(/([\w]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
  for(const name of (await fs.readdir(xmlDir)).filter(n=>/^TEST-.*\.xml$/.test(n))) {
    const xml=await fs.readFile(path.join(xmlDir,name),'utf8');
    const h=attrs(xml.match(/<testsuite\b([^>]+)>/)[1]);
    report.suites.push({name:h.name,tests:Number(h.tests),failures:Number(h.failures),errors:Number(h.errors),skipped:Number(h.skipped),
      seconds:Number(h.time),xmlSha256:sha(xml),
      cases:[...xml.matchAll(/<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/g)].map(m=>({name:attrs(m[1]).name,
        result:/<(failure|error)\b/.test(m[2]||'')?'FAIL':/<skipped\b/.test(m[2]||'')?'SKIPPED':'PASS',
        ...(/<(failure|error)\b/.test(m[2]||'')?{failure:m[2]}:{})}))});
  }
  report.summary=report.suites.reduce((a,s)=>Object.fromEntries(['tests','failures','errors','skipped'].map(k=>[k,a[k]+s[k]])),{tests:0,failures:0,errors:0,skipped:0});
  report.protectedMigrationsAfter=await hashes();
  report.appliedMigrationSourcesUnchanged=JSON.stringify(report.protectedMigrationsBefore)===JSON.stringify(report.protectedMigrationsAfter);
  const files=[`${migrationDir}/V16__analytics_gps_quality.sql`,
    'src/main/java/com/ecoroute/backend/domain/model/analytics/AnalyticsModels.java',
    'src/main/java/com/ecoroute/backend/domain/model/analytics/GpsQualityPolicy.java',
    'src/main/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcAnalyticsAdapter.java',
    'src/test/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcAnalyticsIntegrationTest.java',
    'src/test/java/com/ecoroute/backend/infrastructure/output/persistence/R2dbcAnalyticsGpsQualityIntegrationTest.java'];
  report.sourceSha256=Object.fromEntries(await Promise.all(files.map(async f=>[f,await fileHash(f)])));
  report.status=report.exitCode===0&&report.summary.tests>0&&!report.summary.failures&&!report.summary.errors&&!report.summary.skipped&&report.appliedMigrationSourcesUnchanged?'PASS':'FAIL';
} catch(error) {report.status='FAIL';report.error=error.message;}
finally {report.finishedAt=now();await save();await handle.close();}
console.log(JSON.stringify({status:report.status,summary:report.summary,file:destination,error:report.error}));
if(report.status!=='PASS')process.exitCode=1;
