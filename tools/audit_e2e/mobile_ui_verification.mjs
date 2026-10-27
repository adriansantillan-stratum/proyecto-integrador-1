import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'../..');
const out=path.join(root,'docs/correccion_integral/evidencias/prueba_emulador_offline.json');
const stage=process.argv[2];
if(!['offline','restart','online'].includes(stage))throw new Error('Expected offline, restart or online');
const setup=fs.readFileSync(path.join(root,'setup-keycloak.ps1'),'utf8');
const password=setup.match(/--username admin --new-password ([^\s]+)/)?.[1];
if(!password)throw new Error('Local QA credential not found');
const tokenResponse=await fetch('http://localhost:8080/realms/ecoroute/protocol/openid-connect/token',{method:'POST',body:new URLSearchParams({client_id:'mobile-app',grant_type:'password',username:'admin',password})});
if(!tokenResponse.ok)throw new Error('QA login failed');
const token=(await tokenResponse.json()).access_token;
const request=url=>fetch('http://localhost:8081'+url,{headers:{Authorization:'Bearer '+token}});
const orderResponse=await request('/orders/27');
if(!orderResponse.ok)throw new Error('Cannot read own synthetic fixture');
const order=await orderResponse.json();
if(order.trackingNumber!=='MOB-E2E-20261019212853-OFFLINE')throw new Error('Unexpected fixture: refuse verification');
const adb='C:/Users/USUARIO/AppData/Local/Android/Sdk/platform-tools/adb.exe';
const run=(...args)=>execFileSync(adb,['-s','emulator-5556',...args],{timeout:25000,maxBuffer:10*1024*1024}).toString();
run('shell','uiautomator','dump','/sdcard/ecoroute-qa-window.xml');
const xml=run('exec-out','cat','/sdcard/ecoroute-qa-window.xml');
const observation={stage,at:new Date().toISOString(),orderId:27,routeId:11,serverStatus:order.status,tests:[]};
const check=(name,condition,detail)=>{observation.tests.push({name,result:condition?'PASS':'FAIL',detail});};
if(stage!=='online'){
 check('La cola visible conserva la evidencia del pedido 27',xml.includes('Pedido #27')&&xml.includes('Pendiente'),'UI nativa de Sincronización');
 check('El servidor no declara entrega mientras falta confirmación',order.status==='IN_TRANSIT',order.status);
 const proof=await request('/delivery-proofs/27');
 check('El servidor todavía no tiene un POD',proof.status===404,'HTTP '+proof.status);
}else{
 check('El servidor confirma la entrega tras reconexión',order.status==='DELIVERED',order.status);
 check('La cola ya no contiene el POD pendiente',xml.includes('0 pendientes')&&!xml.includes('Pedido #27'),'UI nativa de Sincronización');
 const proofResponse=await request('/delivery-proofs/27');
 check('POD recuperable con autorización',proofResponse.ok,'HTTP '+proofResponse.status);
 if(proofResponse.ok){
  const proof=await proofResponse.json();
  observation.proof=proof;
  const stored=JSON.parse(execFileSync('docker',['exec','ecoroute-db','psql','-U','user','-d','ecoroute','-At','-c',"SELECT json_build_object('count',(SELECT count(*) FROM delivery_proofs WHERE order_id=27),'imageSha256',image_sha256,'signatureSha256',signature_sha256,'capturedAt',captured_at,'receivedAt',received_at) FROM delivery_proofs WHERE order_id=27"],{encoding:'utf8'}).trim());
  observation.database=stored;
  check('Un solo POD persistido por pedido',stored.count===1,stored.count);
  const lat=proof.latitude??proof.lat,lng=proof.longitude??proof.lng;
  check('GPS de Lima conservado en el POD',Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat+12.0463)<.01&&Math.abs(lng+77.0427)<.01,{lat,lng});
  observation.assets=[];
  for(const kind of ['photo','signature']){
   const asset=await request('/delivery-proofs/27/'+kind);
   const bytes=Buffer.from(await asset.arrayBuffer());
   const sha256=createHash('sha256').update(bytes).digest('hex');
   const expected=stored[kind==='photo'?'imageSha256':'signatureSha256'];
   observation.assets.push({kind,status:asset.status,bytes:bytes.length,sha256,expected});
   check(kind+': bytes privados coinciden con el hash registrado',asset.ok&&expected===sha256,{bytes:bytes.length,sha256,expected});
  }
 }
}
const result=fs.existsSync(out)?JSON.parse(fs.readFileSync(out,'utf8')):{fixture:'SINTETICO MOBILE E2E, sin reparto real',device:'EcoRoute_QA emulator-5556',humanAcceptance:'PENDING',observations:[]};
if(stage==='online'&&result.observations.some(o=>o.stage==='online')){
 const archive=out.replace('.json','_verificador_anterior.json');
 if(!fs.existsSync(archive))fs.copyFileSync(out,archive);
 result.verifierCorrection='La primera versión consultó hashes no expuestos por el DTO. La comparación final lee los hashes persistidos en PostgreSQL y conserva el resultado previo en el archivo de auditoría.';
 result.observations=result.observations.filter(o=>o.stage!=='online');
}
result.observations.push(observation);
result.summary={passed:result.observations.flatMap(o=>o.tests).filter(t=>t.result==='PASS').length,failed:result.observations.flatMap(o=>o.tests).filter(t=>t.result==='FAIL').length};
fs.writeFileSync(out,JSON.stringify(result,null,2));
console.log(JSON.stringify({stage,tests:observation.tests,summary:result.summary}));
if(observation.tests.some(t=>t.result==='FAIL'))process.exitCode=1;
