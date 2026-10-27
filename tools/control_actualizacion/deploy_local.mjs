import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'../..'),out=path.join(root,'docs/control_actualizacion/evidencias');
const action=process.argv[2];
if(!['before','backend','web','after'].includes(action))throw Error('Use before/backend/web/after');
fs.mkdirSync(out,{recursive:true});
const run=(args,options={})=>execFileSync('docker',args,{cwd:root,timeout:900000,maxBuffer:16e6,windowsHide:true,...options});
function sql(query){return JSON.parse(run(['exec','-i','ecoroute-db','psql','-X','-qAt','-U','user','-d','ecoroute','-v','ON_ERROR_STOP=1'],{input:'BEGIN READ ONLY;\n'+query+'\nCOMMIT;',encoding:'utf8'}).trim());}
const tables=['orders','routes','delivery_proofs','incidents','order_attempts','vehicle_gps_history','order_business_data','route_dispatch_reviews'];
function snapshot(){return sql(`SELECT json_build_object('migration',(SELECT version FROM flyway_schema_history WHERE success ORDER BY installed_rank DESC LIMIT 1), 'business',json_build_object(${tables.map(t=>`'${t}',(SELECT json_build_object('rows',COUNT(*),'md5',md5(COALESCE(string_agg(md5(t::text),'' ORDER BY md5(t::text)),''))) FROM ${t} t)`).join(',')}));`);}
function save(name,body){fs.writeFileSync(path.join(out,name),JSON.stringify(body,null,2),{flag:'wx'});}
if(action==='before'){
 const before=snapshot();if(before.migration!=='15')throw Error('Expected V15 before update');
 const backup=path.join(root,'backups/actualizacion_20261022_pre_v16.sql');
 fs.mkdirSync(path.dirname(backup),{recursive:true});
 if(fs.existsSync(backup))throw Error('Backup already exists');
 const data=run(['exec','ecoroute-db','pg_dump','-U','user','-d','ecoroute','--no-owner','--no-acl']);
 fs.writeFileSync(backup,data,{flag:'wx'});
 save('deploy_before.json',{at:new Date().toISOString(),...before,backup:{file:path.relative(root,backup),bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')},scope:'Local, no business writes'});
 console.log('V15 snapshot and ignored local backup saved.');
}else if(action==='backend'||action==='web'){
 if(!fs.existsSync(path.join(out,'deploy_before.json')))throw Error('Missing pre-update backup');
 const service=action==='backend'?'ecoroute-backend':'ecoroute-web-admin';
 run(['compose','build',service],{stdio:'inherit'});
 run(['compose','up','-d','--no-deps',service],{stdio:'inherit'});
 save('deploy_'+action+'.json',{at:new Date().toISOString(),service,buildSucceeded:true,recreatedWithoutDependencies:true,businessAcceptance:'NOT_ATTESTED'});
}else{
 const before=JSON.parse(fs.readFileSync(path.join(out,'deploy_before.json'),'utf8'));
 const after=snapshot();
 const unchanged=JSON.stringify(before.business)===JSON.stringify(after.business);
 save('deploy_after.json',{at:new Date().toISOString(),...after,businessRowsUnchanged:unchanged,result:after.migration==='16'&&unchanged?'PASS':'FAIL',businessAcceptance:'NOT_ATTESTED'});
 if(after.migration!=='16'||!unchanged)throw Error('Migration/version or business digest mismatch');
 console.log('V16 active; eight business-table digests unchanged.');
}
