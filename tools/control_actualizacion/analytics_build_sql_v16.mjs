// Generate a new, seed-free business schema installer and validate only in an isolated container.
// Never invokes export_verified_data, compose, or an existing database/container.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const migrationDir='src/main/resources/db/migration';
const installerPath='docs/base_datos/EcoRoute_BD_Completa_V1-V16.sql';
const evidencePath=path.join(root,'docs/control_actualizacion/evidencias/sql_v16.json');
const image='postgres:14-alpine', token=randomUUID().replaceAll('-','');
const label='ecoroute.sql-v16-audit', name='ecoroute-sql-v16-'+token.slice(0,12);
const now=()=>new Date().toLocaleString('sv-SE',{timeZone:'America/Lima',hour12:false}).replace(' ','T')+'-05:00';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const hashFile=async file=>sha(await fs.readFile(path.join(root,file)));
const normalized=text=>text.replaceAll('\r\n','\n').replace(/^\uFEFF/,'');
const sourceNames=(await fs.readdir(path.join(root,migrationDir))).filter(f=>/^V\d+__.*\.sql$/.test(f)&&Number(f.match(/^V(\d+)/)[1])<=16)
  .sort((a,b)=>Number(a.match(/^V(\d+)/)[1])-Number(b.match(/^V(\d+)/)[1]));
const versions=sourceNames.map(f=>Number(f.match(/^V(\d+)/)[1]));
assert.deepEqual(versions,[1,2,3,4,5,6,7,8,9,10,12,13,14,15,16],'Unexpected migration inventory; do not invent V11');
const sources=await Promise.all(sourceNames.map(async file=>{
  const bytes=await fs.readFile(path.join(root,migrationDir,file));
  return {file,sha256:sha(bytes),body:normalized(bytes.toString('utf8'))};
}));
const historical=(await fs.readdir(path.join(root,'docs/base_datos'))).filter(f=>/^EcoRoute_BD_Completa_V1-V\d+\.sql$/.test(f)&&f!=='EcoRoute_BD_Completa_V1-V16.sql');
const protectedHashes=async()=>Object.fromEntries(await Promise.all(historical.map(async f=>[f,await hashFile('docs/base_datos/'+f)])));
const oldHashes=await protectedHashes();
const omitted=[];
const parts=[`-- ECOROUTE complete application schema V1 to V16. PostgreSQL 14+.
-- ONLY for an EMPTY public schema. Prefer Flyway for the existing application.
-- Fifteen existing migration files: V1-V10,V12-V16. No V11 source exists.
-- Preserves original DDL and technical RBAC configuration; V4 synthetic business seeds omitted.
-- No business rows, operational exports, Keycloak, passwords or Flyway migration history.
-- V16 adds a GPS-quality FUNCTION, its permissions/comments and a replacement read VIEW only.
-- Business tables, columns and FKs are unchanged by V16; no business ERD redesign is required.
BEGIN;
SET LOCAL search_path = public, pg_catalog;
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public')
       OR EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public')
       OR EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public') THEN
        RAISE EXCEPTION 'Database must be empty; public schema contains objects; use Flyway on existing database';
    END IF;
END $$;
`];
for(const source of sources){
  let body=source.body;
  if(source.file.startsWith('V4__')){
    const marker=body.indexOf('-- DATA SEEDING (Making it look "Real")');
    assert.ok(marker>0,'V4 seed boundary missing');
    const boundary=body.lastIndexOf('-- =============================================================================',marker);
    assert.ok(boundary>=0);
    const tail=body.slice(boundary);
    assert.ok(!/^\s*(CREATE|ALTER|DROP|GRANT|REVOKE)\b/im.test(tail),'DDL after V4 seed boundary must not be removed');
    const tables=[...tail.matchAll(/^INSERT INTO (corp_\w+)/gm)].map(m=>m[1]);
    assert.deepEqual(tables,['corp_branches','corp_departments','corp_customers','corp_employees']);
    omitted.push({migration:source.file,reason:'No business data in new installer',tables,
      omittedSectionSha256:sha(tail),sourceFileUnmodified:true});
    body=body.slice(0,boundary)+'-- Original V4 corporate business sample INSERTs intentionally omitted from this installer.\n';
  }
  parts.push(`\n-- ${source.file}\n${body}\n`);
}
parts.push('\nCOMMIT;\n');
const installer=parts.join('');
await fs.mkdir(path.dirname(evidencePath),{recursive:true});
let prior;
try{prior=JSON.parse(await fs.readFile(evidencePath,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
const report={schemaVersion:1,timezone:'America/Lima',businessAcceptance:'NOT_ATTESTED',
  artifact:installerPath,artifactSha256:sha(installer),sourceMigrationCount:sources.length,versions,
  missingVersionExplanation:'V11 is absent from source; no migration or history record fabricated.',
  sourceMigrations:sources.map(({body,...rest})=>rest),businessSeedOmissions:omitted,
  historicalInstallersBefore:oldHashes,attempts:prior?.attempts||[],status:'RUNNING',
  documentation:{v16:'FUNCTION analytics_route_gps_quality, controlled EXECUTE permissions, CREATE OR REPLACE read VIEW and comments only.',
    businessTablesAndFks:'No business-table, column or FK changes in V16. Verified by catalogue comparison.',
    erd:'Existing physical business ERD remains valid; document GPS function/view quality fields, do not invent new business entities.',
    installer:'Transaction + empty-public-schema guard + source-ordered migration sections + COMMIT. Unlike historical V15, corporate example business rows are deliberately omitted; technical RBAC configuration retained.'}};
const attempt={startedAt:now(),status:'RUNNING',containerName:name,image,isolation:'--network none; no published ports; tmpfs PostgreSQL data; no host bind mounts; docker exec Unix socket only',
  operationalDatabaseAccessed:false,commands:[],checks:[]};
report.attempts.push(attempt);
const save=()=>fs.writeFile(evidencePath,JSON.stringify(report,null,2)+'\n');
await save();
let containerId;
async function run(args,{input,allowFailure=false,timeout=45000}={}){
  const entry={command:['docker',...args],at:now(),...(input!==undefined?{stdinSha256:sha(input)}:{})};
  attempt.commands.push(entry);await save();
  const result=await new Promise(resolve=>{
    const child=execFile('docker',args,{windowsHide:true,encoding:'utf8',timeout,maxBuffer:8*1024*1024},
      (error,stdout,stderr)=>resolve({exitCode:error?.code??0,stdout,stderr}));
    if(input!==undefined){child.stdin.on('error',()=>{});child.stdin.end(input);}
  });
  Object.assign(entry,result);await save();
  if(!allowFailure)assert.equal(result.exitCode,0,'Docker command failed; see evidence command output');
  return result;
}
async function check(name,fn){
  const entry={name,result:'RUNNING'};attempt.checks.push(entry);await save();
  try{entry.evidence=await fn();entry.result='PASS';}catch(e){entry.result='FAIL';entry.error=e.message;await save();throw e;}
  await save();return entry.evidence;
}
function psqlArgs(db){assert.match(containerId||'',/^[0-9a-f]{64}$/);return ['exec','-i',containerId,'psql','-X','-q','-U','postgres','-d',db,'-v','ON_ERROR_STOP=1'];}
async function sql(db,input,{json=false,allowFailure=false}={}){
  const result=await run([...psqlArgs(db),...(json?['-At']:[])],{input,allowFailure});
  return json?JSON.parse(result.stdout.trim()):result;
}
const catalogueQuery=`SELECT json_build_object('serverVersion',current_setting('server_version'),
 'tables',(SELECT json_agg(x ORDER BY x.name) FROM (
  SELECT c.relname AS name,c.relkind AS kind,
   (SELECT json_agg(json_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'nullable',NOT a.attnotnull,
    'default',pg_get_expr(d.adbin,d.adrelid),'comment',col_description(c.oid,a.attnum)) ORDER BY a.attnum)
    FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
    WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped) AS columns,
   (SELECT json_agg(json_build_object('name',k.conname,'type',k.contype,'definition',pg_get_constraintdef(k.oid)) ORDER BY k.conname)
    FROM pg_constraint k WHERE k.conrelid=c.oid) AS constraints
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p')) x),
 'foreignKeys',(SELECT json_agg(json_build_object('table',c.relname,'name',k.conname,'definition',pg_get_constraintdef(k.oid)) ORDER BY c.relname,k.conname)
  FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND k.contype='f'),
 'views',(SELECT json_agg(json_build_object('name',c.relname,'definition',pg_get_viewdef(c.oid,true),'acl',c.relacl::text,
   'columns',(SELECT json_agg(json_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod)) ORDER BY a.attnum)
   FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped)) ORDER BY c.relname)
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='v'),
 'functions',(SELECT json_agg(json_build_object('name',p.proname,'args',pg_get_function_identity_arguments(p.oid),'definition',pg_get_functiondef(p.oid),
   'securityDefiner',p.prosecdef,'config',p.proconfig,'acl',p.proacl::text) ORDER BY p.proname)
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'));
`;
async function rows(db,catalogue){
  const unions=catalogue.tables.map(t=>{
    assert.match(t.name,/^[a-z_][a-z0-9_]*$/);
    return `SELECT '${t.name}' AS table_name,count(*) AS rows,md5(COALESCE(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) AS digest FROM public."${t.name}" t`;
  });
  return sql(db,`SELECT json_agg(x ORDER BY table_name) FROM (${unions.join('\nUNION ALL\n')}) x;`,{json:true});
}
try{
  await check('Generate only new V1-V16 installer',async()=>{
    try{await fs.writeFile(path.join(root,installerPath),installer,{flag:'wx'});}
    catch(e){if(e.code!=='EEXIST')throw e;assert.equal(await hashFile(installerPath),sha(installer),'Existing V16 artifact differs; refusing overwrite');}
    return {sha256:await hashFile(installerPath),sourceSections:sources.length,noBusinessSeedExport:true};
  });
  const created=await run(['run','--detach','--pull=never','--name',name,'--label',`${label}=${token}`,'--network','none',
    '--tmpfs','/var/lib/postgresql/data','-e','POSTGRES_HOST_AUTH_METHOD=trust','-e','POSTGRES_DB=v16_installer',image]);
  containerId=created.stdout.trim();assert.match(containerId,/^[0-9a-f]{64}$/);attempt.containerId=containerId;
  await check('Isolation: no network/ports/host mounts',async()=>{
    const info=JSON.parse((await run(['inspect',containerId])).stdout)[0];
    assert.equal(info.HostConfig.NetworkMode,'none');assert.equal(Object.keys(info.HostConfig.PortBindings||{}).length,0);
    assert.ok(Object.values(info.NetworkSettings.Ports||{}).every(p=>p===null));
    assert.ok(info.Mounts.every(m=>m.Type==='tmpfs'));assert.equal(info.Config.Labels[label],token);
    return {network:info.HostConfig.NetworkMode,portBindings:info.HostConfig.PortBindings,publishedPorts:info.NetworkSettings.Ports,mounts:info.Mounts};
  });
  let ready=false;
  for(let i=0;i<50;i++){
    if((await run(['exec',containerId,'pg_isready','-U','postgres','-d','v16_installer'],{allowFailure:true,timeout:10000})).exitCode===0){ready=true;break;}
    await new Promise(resolve=>setTimeout(resolve,400));
  }
  assert.ok(ready,'Disposable PostgreSQL not ready');
  await check('Apply full V1-V16 in empty schema',()=>sql('v16_installer',installer));
  const fresh=await sql('v16_installer',catalogueQuery,{json:true});
  const freshRows=await rows('v16_installer',fresh);
  await check('No business rows; technical RBAC only',async()=>{
    const technical=new Set(['auth_module','auth_resource','auth_action','auth_role','auth_permission']);
    assert.ok(freshRows.filter(t=>!technical.has(t.table_name)).every(t=>t.rows===0));
    assert.ok(freshRows.some(t=>technical.has(t.table_name)&&t.rows>0));
    return {rows:freshRows,businessRows:0,flywayHistoryIncluded:fresh.tables.some(t=>t.name==='flyway_schema_history')};
  });
  await check('Repeat rejected without changing schema or rows',async()=>{
    const repeated=await sql('v16_installer',installer,{allowFailure:true});
    assert.notEqual(repeated.exitCode,0);assert.ok(repeated.stderr.includes('Database must be empty'));
    assert.deepEqual(await sql('v16_installer',catalogueQuery,{json:true}),fresh);
    assert.deepEqual(await rows('v16_installer',fresh),freshRows);
    return {exitCode:repeated.exitCode,error:repeated.stderr,unchanged:true};
  });
  await run(['exec',containerId,'createdb','-U','postgres','v15_reference']);
  const historicalV15=await fs.readFile(path.join(root,'docs/base_datos/EcoRoute_BD_Completa_V1-V15.sql'),'utf8');
  await sql('v15_reference',historicalV15);
  const old=await sql('v15_reference',catalogueQuery,{json:true});const oldRows=await rows('v15_reference',old);
  await check('V16 changes no business tables/columns/FKs or existing rows',async()=>{
    await sql('v15_reference','BEGIN;\n'+sources.find(s=>s.file.startsWith('V16__')).body+'\nCOMMIT;');
    const upgraded=await sql('v15_reference',catalogueQuery,{json:true});
    assert.deepEqual(upgraded.tables,old.tables);assert.deepEqual(upgraded.foreignKeys,old.foreignKeys);
    assert.deepEqual(await rows('v15_reference',upgraded),oldRows);
    assert.deepEqual(fresh.tables,upgraded.tables);assert.deepEqual(fresh.foreignKeys,upgraded.foreignKeys);
    const changedViews=upgraded.views.filter(v=>JSON.stringify(v)!==JSON.stringify(old.views.find(o=>o.name===v.name))).map(v=>v.name);
    assert.deepEqual(changedViews,['analytics_route_facts']);
    const addedFunctions=upgraded.functions.filter(f=>!old.functions.some(o=>o.name===f.name));
    assert.deepEqual(addedFunctions.map(f=>f.name),['analytics_route_gps_quality']);
    for(const f of old.functions)assert.deepEqual(upgraded.functions.find(n=>n.name===f.name),f);
    const previousView=old.views.find(v=>v.name==='analytics_route_facts'),newView=upgraded.views.find(v=>v.name==='analytics_route_facts');
    assert.deepEqual(newView.columns.slice(0,previousView.columns.length),previousView.columns);assert.equal(newView.acl,previousView.acl);
    return {tableCount:old.tables.length,foreignKeyCount:old.foreignKeys.length,oldTableCatalogueSha256:sha(JSON.stringify(old.tables)),
      upgradedTableCatalogueSha256:sha(JSON.stringify(upgraded.tables)),freshTableCatalogueSha256:sha(JSON.stringify(fresh.tables)),
      oldForeignKeysSha256:sha(JSON.stringify(old.foreignKeys)),upgradedForeignKeysSha256:sha(JSON.stringify(upgraded.foreignKeys)),
      existingRowsUnchanged:true,changedViews,addedFunctions,existingRouteViewColumnsPreserved:true,erdBusinessStructureUnchanged:true};
  });
  await check('Guard rejects unrelated table even without orders',async()=>{
    await run(['exec',containerId,'createdb','-U','postgres','guard_sentinel']);
    await sql('guard_sentinel','CREATE TABLE public.sentinel_only(id integer); INSERT INTO public.sentinel_only VALUES(7);');
    const rejected=await sql('guard_sentinel',installer,{allowFailure:true});
    assert.notEqual(rejected.exitCode,0);assert.ok(rejected.stderr.includes('Database must be empty'));
    const state=await sql('guard_sentinel',"SELECT json_build_object('ordersAbsent',to_regclass('public.orders') IS NULL,'sentinel', (SELECT json_agg(id) FROM public.sentinel_only));",{json:true});
    assert.deepEqual(state,{ordersAbsent:true,sentinel:[7]});return {exitCode:rejected.exitCode,state};
  });
  await check('BI view access still works without base table access',async()=>{
    const response=await sql('v16_installer','SET ROLE ecoroute_bi_reader; SELECT count(*) FROM analytics_route_facts;');
    const denied=await sql('v16_installer','SET ROLE ecoroute_bi_reader; SELECT * FROM public.routes;',{allowFailure:true});
    assert.notEqual(denied.exitCode,0);assert.ok(denied.stderr.includes('permission denied'));
    return {viewExitCode:response.exitCode,baseTableDenied:true};
  });
  attempt.status='PASS';
}catch(error){attempt.status='FAIL';attempt.error=error.message;}
finally{
  if(containerId&&/^[0-9a-f]{64}$/.test(containerId)){
    try{
      const actual=(await run(['inspect','--format',`{{ index .Config.Labels "${label}" }}`,containerId])).stdout.trim();
      assert.equal(actual,token,'Container ownership label mismatch; refusing cleanup');
      await run(['rm','--force',containerId]);attempt.containerRemoved=true;
    }catch(error){attempt.cleanupError=error.message;attempt.status='FAIL';}
  }
  report.historicalInstallersAfter=await protectedHashes();
  report.historicalInstallersUnchanged=JSON.stringify(oldHashes)===JSON.stringify(report.historicalInstallersAfter);
  report.sourceMigrationsUnchanged=(await Promise.all(sources.map(async s=>(await hashFile(`${migrationDir}/${s.file}`))===s.sha256))).every(Boolean);
  if(!report.historicalInstallersUnchanged||!report.sourceMigrationsUnchanged)attempt.status='FAIL';
  attempt.finishedAt=now();report.status=attempt.status;report.finishedAt=attempt.finishedAt;await save();
}
console.log(JSON.stringify({status:report.status,installer:installerPath,sha256:report.artifactSha256,migrations:sources.length,
  evidence:evidencePath,checks:attempt.checks.map(c=>({name:c.name,result:c.result})),containerRemoved:attempt.containerRemoved,error:attempt.error}));
if(report.status!=='PASS')process.exitCode=1;
