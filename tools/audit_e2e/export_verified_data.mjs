import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'../..'),out=path.join(root,'docs/correccion_integral/evidencias');
const state=JSON.parse(await fs.readFile(path.join(out,'datos_sinteticos.json'),'utf8'));
if(!/^FIX-[0-9]+$/.test(state.prefix))throw new Error('Synthetic prefix invalid');
function sql(query) {
  const result=execFileSync('docker',['exec','ecoroute-db','psql','-U','user','-d','ecoroute','-At','-c',query],{encoding:'utf8'}).trim();
  return JSON.parse(result);
}
const schema=sql(`SELECT json_build_object(
  'database',current_database(),'serverVersion',current_setting('server_version'),
  'tables',(SELECT json_agg(json_build_object('name',c.relname,'kind',c.relkind,'comment',obj_description(c.oid),
    'columns',(SELECT json_agg(json_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),
      'nullable',NOT a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid),'comment',col_description(c.oid,a.attnum)) ORDER BY a.attnum)
      FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped),
    'constraints',(SELECT json_agg(json_build_object('name',k.conname,'type',k.contype,'definition',pg_get_constraintdef(k.oid))) FROM pg_constraint k WHERE k.conrelid=c.oid)))
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','v') AND c.relname<>'flyway_schema_history'),
  'migrations',(SELECT json_agg(json_build_object('version',version,'description',description,'success',success) ORDER BY installed_rank) FROM flyway_schema_history))`);
await fs.writeFile(path.join(out,'esquema_fisico_verificado.json'),JSON.stringify(schema,null,2));
const checks=sql(`SELECT json_build_object(
 'prefix','${state.prefix}',
 'proofs',(SELECT json_agg(json_build_object('id',p.id,'orderId',p.order_id,'imageSha256',p.image_sha256,'signatureSha256',p.signature_sha256,'capturedAt',p.captured_at,'receivedAt',p.received_at,'latitude',p.latitude,'longitude',p.longitude)) FROM delivery_proofs p JOIN orders o ON o.id=p.order_id WHERE o.tracking_number LIKE '${state.prefix}%'),
 'audit',(SELECT json_agg(json_build_object('orderId',h.order_id,'status',h.status,'reason',h.reason,'actor',h.changed_by)) FROM order_status_history h JOIN orders o ON o.id=h.order_id WHERE o.tracking_number LIKE '${state.prefix}%'),
 'outbox',(SELECT json_agg(json_build_object('orderId',e.order_id,'sentAt',e.sent_at,'attempts',e.attempts)) FROM delivery_outbox e JOIN orders o ON o.id=e.order_id WHERE o.tracking_number LIKE '${state.prefix}%'),
 'notifications',(SELECT json_agg(json_build_object('orderId',n.order_id,'type',n.type)) FROM notifications n JOIN orders o ON o.id=n.order_id WHERE o.tracking_number LIKE '${state.prefix}%'),
 'attempts',(SELECT json_agg(json_build_object('originalOrderId',a.original_order_id,'retryOrderId',a.retry_order_id,'incidentId',a.incident_id)) FROM order_attempts a JOIN orders o ON o.id=a.original_order_id WHERE o.tracking_number LIKE '${state.prefix}%'),
 'businessAudit',(SELECT json_agg(json_build_object('process',b.process_id,'entity',b.entity_type,'id',b.entity_id,'action',b.action,'actor',b.actor)) FROM business_audit_events b WHERE (b.entity_type='ORDER' AND b.entity_id IN (SELECT id FROM orders WHERE tracking_number LIKE '${state.prefix}%')) OR (b.entity_type='ROUTE' AND b.entity_id IN (${Number(state.route.id)},${Number(state.exceptionRoute.id)})) OR (b.entity_type='IMPROVEMENT' AND b.entity_id=${Number(state.action.id)})))`);
const tokenResponse=await fetch('http://localhost:8080/realms/ecoroute/protocol/openid-connect/token',{method:'POST',body:new URLSearchParams({client_id:'mobile-app',grant_type:'password',username:'admin',password:process.env.ECOROUTE_ADMIN_PASSWORD||'admin123'})});
if(tokenResponse.status!==200)throw new Error('No verified local admin session');
const {access_token:token}=await tokenResponse.json();
checks.objectIntegrity=[];
for(const proof of checks.proofs||[])for(const asset of ['photo','signature']) {
  const response=await fetch(`http://localhost:8081/delivery-proofs/${proof.orderId}/${asset}`,{headers:{Authorization:`Bearer ${token}`}});
  if(response.status!==200)throw new Error('Proof asset inaccessible');
  const bytes=Buffer.from(await response.arrayBuffer()),hash=createHash('sha256').update(bytes).digest('hex');
  const expected=asset==='photo'?proof.imageSha256:proof.signatureSha256;
  checks.objectIntegrity.push({proofId:proof.id,asset,bytes:bytes.length,sha256:hash,dbHashMatches:hash===expected});
}
checks.executedAt=new Date().toISOString();checks.humanAcceptance='PENDING';
await fs.writeFile(path.join(out,'verificacion_base_y_objetos.json'),JSON.stringify(checks,null,2));
if(checks.objectIntegrity.some(c=>!c.dbHashMatches))throw new Error('Stored object digest differs from DB');
console.log(JSON.stringify({tablesAndViews:schema.tables.length,migrations:schema.migrations.length,proofs:checks.proofs?.length,verifiedObjects:checks.objectIntegrity.length,attempts:checks.attempts?.length,auditRows:checks.audit?.length}));
// New installation script, without application data or identity database.
const migrationDir=path.join(root,'src/main/resources/db/migration');
const files=(await fs.readdir(migrationDir)).filter(f=>/^V\d+__.+\.sql$/.test(f)).sort((a,b)=>Number(a.match(/^V(\d+)/)[1])-Number(b.match(/^V(\d+)/)[1]));
const lastVersion=files.at(-1).match(/^V(\d+)/)[1];
const parts=[`-- ECOROUTE complete application schema V1 to V${lastVersion}. PostgreSQL 14+.\n-- ONLY for an EMPTY database. Prefer Flyway for the existing application.\n-- Includes legacy corporate schema and original synthetic seeds, never real operating data.\n-- Does not include Keycloak, passwords or Flyway migration history.\nBEGIN;\nDO $$ BEGIN IF to_regclass('public.orders') IS NOT NULL THEN RAISE EXCEPTION 'Database must be empty; use Flyway on existing database'; END IF; END $$;\n`];
for(const file of files)parts.push(`\n-- ${file}\n${await fs.readFile(path.join(migrationDir,file),'utf8')}\n`);
parts.push('\nCOMMIT;\n');
await fs.writeFile(path.join(root,`docs/base_datos/EcoRoute_BD_Completa_V1-V${lastVersion}.sql`),parts.join(''));
