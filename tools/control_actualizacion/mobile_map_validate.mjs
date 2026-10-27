import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'../..'),out=path.join(root,'docs/control_actualizacion/evidencias');
const file=path.join(out,'mapa_native.json');if(fs.existsSync(file))throw Error('Evidence already exists');
const adb='C:/Users/USUARIO/AppData/Local/Android/Sdk/platform-tools/adb.exe';
const run=(...args)=>execFileSync(adb,['-s','emulator-5556',...args],{timeout:30000,maxBuffer:2e6,windowsHide:true}).toString();
assert.ok(run('emu','avd','name').includes('EcoRoute_QA'));
const helper=path.join(root,'tools/control_integral/emulator_session.mjs');
const env={...process.env,ECOROUTE_UPDATE_RUN:'control_actualizacion'};
function call(...args){return execFileSync(process.execPath,[helper,...args],{env,timeout:90000,maxBuffer:3e6,windowsHide:true}).toString();}
const read=name=>JSON.parse(fs.readFileSync(path.join(out,'mobile',name+'.json'),'utf8'));
const labels=s=>s.nodes.map(n=>n.text+'\n'+n.description).join('\n');
const report={at:new Date().toISOString(),scope:'LOCAL_EMULATOR_CACHED_CONSULTATION_NO_BUSINESS_WRITES',checks:[],businessAcceptance:'NOT_ATTESTED'};
const check=(name,condition)=>{report.checks.push({name,result:condition?'PASS':'FAIL'});assert.ok(condition,name);};
const before={wifi:run('shell','settings','get','global','wifi_on').trim(),data:run('shell','settings','get','global','mobile_data').trim()};
assert.equal(before.wifi,'1');assert.equal(before.data,'1');report.networkBefore=before;
try{
 check('APK 8005 installed',run('shell','dumpsys','package','com.example.ecoroute_driver_app').includes('versionCode=8005'));
 check('Actual native failure exposes retry',labels(read('mapa_4005_estado')).includes('Reintentar mapa'));
 check('Actual retry removes failure banner',!labels(read('mapa_4005_reintento')).includes('Reintentar mapa'));
 call('tap','Actualizar rutas','mapa_4005_reintento');
 await new Promise(r=>setTimeout(r,2500));call('snapshot','mapa_4005_online');
 const online=labels(read('mapa_4005_online'));check('Terminal orders and empty proof queue remain',online.includes('1 entregados · 1 fallidos')&&read('mapa_4005_online').nodes.some(n=>n.description==='0'));
 run('shell','svc','wifi','disable');run('shell','svc','data','disable');
 run('shell','am','force-stop','com.example.ecoroute_driver_app');run('shell','monkey','-p','com.example.ecoroute_driver_app','-c','android.intent.category.LAUNCHER','1');
 await new Promise(r=>setTimeout(r,14000));call('snapshot','mapa_4005_cache_offline');
 const offline=labels(read('mapa_4005_cache_offline'));
 check('Cached consultation survives offline restart',offline.includes('Datos guardados sin conexión')&&offline.includes('1 entregados · 1 fallidos'));
 check('Cached map has attribution and no native failure',offline.includes('© OpenStreetMap contributors')&&!offline.includes('Reintentar mapa'));
 report.result='PASS';
}catch(error){report.result='FAIL';report.failure=error.message;process.exitCode=1;}
finally{
 run('shell','svc','wifi',before.wifi==='1'?'enable':'disable');run('shell','svc','data',before.data==='1'?'enable':'disable');
 report.networkAfter={wifi:run('shell','settings','get','global','wifi_on').trim(),data:run('shell','settings','get','global','mobile_data').trim()};
 report.networkRestored=JSON.stringify(report.networkAfter)===JSON.stringify(before);if(!report.networkRestored){report.result='FAIL';process.exitCode=1;}
 report.visualReview='Pending inspection of native screenshots; absence of an error label alone does not prove basemap pixels.';
 report.finishedAt=new Date().toISOString();fs.writeFileSync(file,JSON.stringify(report,null,2),{flag:'wx'});console.log(JSON.stringify(report));
}
