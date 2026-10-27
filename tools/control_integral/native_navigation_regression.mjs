import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'../..'),out=path.join(root,'docs/control_integral_20261022/e2e_cierre');
const helper=path.join(root,'tools/control_integral/emulator_session.mjs');
const env={...process.env,ECOROUTE_E2E_NATIVE:'1'};
const run=(...args)=>execFileSync(process.execPath,[helper,...args],{env,timeout:90000,maxBuffer:5e6,windowsHide:true});
const snapshot=name=>{run('snapshot',name);return JSON.parse(fs.readFileSync(path.join(out,'mobile',name+'.json'),'utf8')).nodes.map(n=>n.text+'\n'+n.description).join('\n');};
const report={at:new Date().toISOString(),scope:'NATIVE_APK8004_FRESH_UI_NAVIGATION',checks:[],businessWrites:0};
try{
  let current='nav_00_routes';assert.ok(snapshot(current).includes('Mis rutas'));
  for(let i=1;i<=3;i++){
    run('tap','0',current);const sync=`nav_${i}_sync`;assert.ok(snapshot(sync).includes('Sin evidencias pendientes'));
    run('tap','Back',sync);current=`nav_${i}_routes_back`;assert.ok(snapshot(current).includes('Mis rutas'));
    run('tap','Historial',current);const history=`nav_${i}_history`;let text=snapshot(history);
    if(!text.includes('E2E-20261022182547-SUCCESS'))text=snapshot(history+'_loaded');
    assert.ok(text.includes('Historial de Entregas')&&text.includes('E2E-20261022182547-SUCCESS')&&text.includes('E2E-20261022182547-FAILED'));
    run('tap','Back',text.includes('E2E-20261022182547-SUCCESS')&&fs.existsSync(path.join(out,'mobile',history+'_loaded.xml'))?history+'_loaded':history);
    current=`nav_${i}_routes_final`;assert.ok(snapshot(current).includes('Cerrar sesión'));
    report.checks.push({name:`Cycle ${i}: Sync → Back → History → Back`,result:'PASS',evidence:[sync,history,current]});
  }
  report.result='PASS';
}catch(error){report.result='FAIL';report.failure=error.message;process.exitCode=1;}
report.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(out,'native_session_navigation.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
