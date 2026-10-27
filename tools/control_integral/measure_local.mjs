import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'../..'),out=path.join(root,'docs/control_integral_20261022');
await fs.mkdir(out,{recursive:true});
const result={at:new Date().toISOString(),timezone:'America/Lima',scope:'LOCAL_READ_ONLY',businessAcceptance:'NOT_ATTESTED',checks:[],samples:[],safety:{businessWrites:0,tokensStored:false,personalRowsExported:false}};
function sql(query){return JSON.parse(execFileSync('docker',['exec','-i','ecoroute-db','psql','-X','-qAt','-U','user','-d','ecoroute','-v','ON_ERROR_STOP=1'],{input:'BEGIN READ ONLY;\n'+query+'\nCOMMIT;',encoding:'utf8',windowsHide:true}).trim());}
function check(name,ok,detail){result.checks.push({name,result:ok?'PASS':'FAIL',detail});}
function fingerprint(){return sql(`SELECT json_build_object(${['orders','routes','delivery_proofs','incidents','order_attempts','improvement_actions','analytics_goals'].map(t=>`'${t}',(SELECT json_build_object('rows',COUNT(*),'contentMd5',md5(COALESCE(string_agg(md5(t::text),'' ORDER BY md5(t::text)),''))) FROM ${t} t)`).join(',')});`);}
let token;
async function get(endpoint,authenticated=true){
 const response=await fetch('http://localhost:8081'+endpoint,{headers:authenticated?{Authorization:'Bearer '+token}:{},signal:AbortSignal.timeout(20000)});
 result.checks.push({name:'GET '+endpoint+(authenticated?'':' anonymous'),result:response.status===(authenticated?200:401)?'PASS':'FAIL',status:response.status});
 return response.ok?response.json():null;
}
try{
 result.before=fingerprint();
 const auth=await fetch('http://localhost:8080/realms/ecoroute/protocol/openid-connect/token',{method:'POST',body:new URLSearchParams({client_id:'mobile-app',grant_type:'password',username:'admin',password:process.env.ECOROUTE_ADMIN_PASSWORD||'admin123'}),signal:AbortSignal.timeout(20000)});
 assert.equal(auth.status,200,'Local authentication unavailable'); token=(await auth.json()).access_token;
 const session=await get('/session/me');check('ADMIN real',session.roles.some(r=>String(typeof r==='string'?r:r.authority).includes('ADMIN')));
 await get('/reports/bi',false);
 for(const [label,query,where] of [
  ['Todos los registros locales, incluidos ensayos','', 'TRUE'],
  ['Mes local hasta 22 octubre 2026','?startDate=2026-10-01&endDate=2026-10-22',"operation_date BETWEEN DATE '2026-10-01' AND DATE '2026-10-22'"],
  ['Día local 22 octubre 2026','?startDate=2026-10-22&endDate=2026-10-22',"operation_date=DATE '2026-10-22'"],
 ]){
  const body=await get('/reports/bi'+query);assert.ok(body?.kpis,'Missing BI response');
  const counts=sql(`SELECT json_build_object('total',COUNT(*),'valid',COUNT(*) FILTER(WHERE iid_valid),'scheduled',COUNT(*) FILTER(WHERE scheduled),'deliveredScheduled',COUNT(*) FILTER(WHERE scheduled AND delivered),'evidenceScheduled',COUNT(*) FILTER(WHERE scheduled AND digital_evidence),'delivered',COUNT(*) FILTER(WHERE delivered),'onTime',COUNT(*) FILTER(WHERE on_time),'evaluable',COUNT(*) FILTER(WHERE ontime_evaluable)) FROM analytics_order_facts WHERE ${where};`);
  const definitions={IID:['valid','total'],CHR:['deliveredScheduled','scheduled'],TDE:['evidenceScheduled','scheduled'],SUCCESS:['delivered','total'],ONTIME:['onTime','evaluable']};
  for(const kpi of body.kpis){
   const [n,d]=definitions[kpi.code];const expected=counts[d]===0?null:Math.round(counts[n]*10000/counts[d])/100;
   check(label+' '+kpi.code,kpi.numerator===counts[n]&&kpi.denominator===counts[d]&&(expected===null?kpi.percentage===null:Math.abs(kpi.percentage-expected)<0.0051),{sqlNumerator:counts[n],sqlDenominator:counts[d],apiPercentage:kpi.percentage,expected});
   const state=kpi.percentage===null?'NO_DATA':kpi.target===null?'NO_TARGET':kpi.percentage>=kpi.target?'MET':'BELOW_TARGET';
   check(label+' '+kpi.code+' estado/meta',kpi.status===state&& (kpi.gap===null?kpi.percentage===null||kpi.target===null:Math.abs(kpi.gap-(kpi.percentage-kpi.target))<0.0051));
  }
  result.samples.push({label,filters:{...body,byDriver:undefined,byDistrict:undefined,causes:undefined,efficiency:undefined,trends:undefined,quality:undefined,goals:undefined},counts,warning:'Datos locales con escenarios sintéticos. No representan eficacia empresarial ni mejora causal MICOTRANS.'});
 }
 for(const endpoint of ['/orders','/routes','/drivers','/vehicles','/incidents','/improvement-actions','/purchases'])await get(endpoint);
 result.after=fingerprint();check('Sin cambios observables de negocio',JSON.stringify(result.before)===JSON.stringify(result.after),{method:'Conteos y MD5 de contenido antes/después; no acredita aislamiento global frente a actores concurrentes.'});
}catch(error){result.fatal=String(error.message).replace(/eyJ[\w.-]+/g,'[REDACTED]');}
result.summary={passed:result.checks.filter(c=>c.result==='PASS').length,failed:result.checks.filter(c=>c.result==='FAIL').length,fatal:Boolean(result.fatal)};
result.result=!result.summary.failed&&!result.fatal?'PASS':'FAIL';result.finishedAt=new Date().toISOString();
await fs.writeFile(path.join(out,'medicion_local_ejecutada.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify({result:result.result,summary:result.summary,fatal:result.fatal}));if(result.result!=='PASS')process.exitCode=1;
