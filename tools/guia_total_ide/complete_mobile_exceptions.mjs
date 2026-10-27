import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'../..');
const out=path.join(root,'docs/guia_total_ide/ejecucion_20261026');
const helper=path.join(root,'tools/control_integral/emulator_session.mjs');
const env={...process.env,ECOROUTE_IDE_RUN:'ejecucion_20261026',ECOROUTE_E2E_NATIVE:'1'};
const call=(...args)=>execFileSync(process.execPath,[helper,...args],{env,timeout:40000,windowsHide:true,maxBuffer:2e6}).toString();
const snap=name=>{call('snapshot',name);return JSON.parse(fs.readFileSync(path.join(out,'mobile',name+'.json'),'utf8'));};
const tap=(s,label)=>{assert.ok(s.nodes.some(n=>(n.description||n.text)===label),'Observed label required');call('tap',label,s.name);};
const observe=name=>({...snap(name),name});
const report={at:new Date().toISOString(),scope:'Native QA emulator only; synthetic route22',steps:[],status:'RUNNING'};
try{
 const scenarios=[['IDE-20261026-FAILED','FAILED','fallo'],['IDE-20261026-PENDIENTE','RETURNED','devolucion']];
 for(const [tracking,status,name] of scenarios.filter(s=>!process.argv.includes('--returned-only')||s[1]==='RETURNED')){
  let s=observe('m03_'+name+'_inicio');
  if(s.nodes.some(n=>n.description==='Mis rutas')){const row=s.nodes.find(n=>n.description?.includes('#'+tracking+' · IN_TRANSIT'));assert.ok(row);tap(s,row.description);s=observe('m03_'+name+'_pedido');}
  assert.ok(s.nodes.some(n=>n.description==='Pedido #'+tracking));
  tap(s,'IN_TRANSIT');s=observe('m03_'+name+'_opciones');tap(s,status);s=observe('m03_'+name+'_formulario');
  call('fill-synthetic','Motivo de no entrega','SINTETICO IDE 26Oct '+(status==='FAILED'?'cliente ausente':'cliente rechaza paquete retorno a origen'));
  s=observe('m03_'+name+'_motivo');tap(s,'GUARDAR ESTADO');s=observe('m02_'+name+'_registrado');
  report.steps.push({tracking,status,submittedAt:new Date().toISOString(),capture:'mobile/m03_'+name+'_motivo.png'});
 }
 report.status='SUBMITTED';
}catch(e){report.status='FAIL';report.error=e.message;process.exitCode=1;}
fs.writeFileSync(path.join(out,'mobile_exceptions.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
