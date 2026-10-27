import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=path.join(root,'docs/auditoria_end_to_end_20261019/evidencias');
const s=JSON.parse(await fs.readFile(path.join(out,'casos_prueba.json'),'utf8'));
const results=[];
const auth=await fetch('http://localhost:8080/realms/ecoroute/protocol/openid-connect/token',{
 method:'POST',body:new URLSearchParams({client_id:'mobile-app',grant_type:'password',username:'admin',password:process.env.ECOROUTE_ADMIN_PASSWORD||'admin123'})});
const tokens=await auth.json();if(!tokens.access_token)throw new Error('Autenticacion fallida');
const payload=JSON.parse(Buffer.from(tokens.access_token.split('.')[1],'base64url'));
results.push({id:'X01',name:'Vigencia real de token',pass:true,detail:`${payload.exp-payload.iat} segundos`,seconds:payload.exp-payload.iat});
const headers={Authorization:`Bearer ${tokens.access_token}`};
async function get(url,options={}){const begin=performance.now();try{const r=await fetch(`http://localhost:8081${url}`,{headers,...options,signal:AbortSignal.timeout(12000)});let data;try{data=await r.json()}catch{data={}}return {status:r.status,data,ms:Math.round(performance.now()-begin)};}catch(e){console.log(`Timeout/error ${url}: ${e.message}`);return {status:0,data:{error:e.message},ms:Math.round(performance.now()-begin)};}}
const invalid=await get('/orders',{headers:{Authorization:'Bearer mock_ADMIN'}});results.push({id:'X02',name:'Token ficticio rechazado',pass:invalid.status===401,http:invalid.status});
for(const url of ['/orders','/routes']){
 const samples=[];for(let i=0;i<15;i++){const r=await get(url);samples.push(r.ms);}
 samples.sort((a,b)=>a-b);const p95=samples[Math.ceil(samples.length*.95)-1];
 results.push({id:url==='/orders'?'X03':'X04',name:`Latencia ${url}`,pass:p95<=50,detail:`15 muestras secuenciales locales, p95 ${p95} ms; no es prueba de carga.`,p95,samples});
 await fs.writeFile(path.join(out,'pruebas_adicionales.json'),JSON.stringify(results,null,2));
}
const start=await get(`/routes/${s.otherRoute.id}/status?status=IN_PROGRESS`,{method:'PATCH'});
results.push({id:'X05',name:'Preparar ruta ficticia de resiliencia',pass:start.status===200,http:start.status});
console.log(`Inicio de ruta auxiliar: ${start.status}`);
await fs.writeFile(path.join(out,'pruebas_adicionales.json'),JSON.stringify(results,null,2));
try{
 execFileSync('docker',['stop','ecoroute-osrm'],{timeout:30000,stdio:'pipe'});
 const fallback=await get(`/routes/${s.otherRoute.id}/path`);
 results.push({id:'X06',name:'Fallback con OSRM detenido',pass:fallback.status===200&&fallback.data.source==='haversine',result:fallback});
}finally{execFileSync('docker',['start','ecoroute-osrm'],{timeout:30000,stdio:'pipe'});}
const metrics=await get('/actuator/metrics');results.push({id:'X07',name:'Actuator protegido disponible',pass:metrics.status===200,http:metrics.status,metricCount:metrics.data.names?.length});
const spec=await get('/v3/api-docs');results.push({id:'X08',name:'OpenAPI disponible',pass:spec.status===200&&!!spec.data.paths,pathCount:Object.keys(spec.data.paths||{}).length});
const profile=await get('/reports/route-efficiency');results.push({id:'X09',name:'Detalle del fallo de reporte',pass:profile.status===200,result:profile});
await fs.writeFile(path.join(out,'pruebas_adicionales.json'),JSON.stringify(results,null,2));
console.log(JSON.stringify(results,null,2));
