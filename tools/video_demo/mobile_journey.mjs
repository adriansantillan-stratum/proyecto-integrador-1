import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'../..'),runName=process.env.ECOROUTE_VIDEO_RUN;
if(!/^ecoroute_[a-z0-9_]+$/.test(runName??''))throw Error('Video run required');
const out=path.join(root,'docs/videos',runName),mobile=path.join(out,'mobile');
const fixture=JSON.parse(fs.readFileSync(path.join(out,'fixture.json'),'utf8'));
const helper=path.join(root,'tools/control_integral/emulator_session.mjs'),recorder=path.join(root,'tools/video_demo/mobile_record.mjs');
const env={...process.env,ECOROUTE_E2E_NATIVE:'1'};
const call=(script,...args)=>execFileSync(process.execPath,[script,...args],{env,timeout:120000,maxBuffer:5e6,windowsHide:true}).toString();
const adb='C:/Users/USUARIO/AppData/Local/Android/Sdk/platform-tools/adb.exe';
const device=(...args)=>execFileSync(adb,['-s','emulator-5556',...args],{timeout:30000,maxBuffer:2e6,windowsHide:true}).toString();
const stage=process.argv[2];assert.ok(['accept','delivery','sync_failure'].includes(stage));
const report={at:new Date().toISOString(),stage,fixture:fixture.prefix,steps:[],result:'RUNNING'};
let clip;
const pause=ms=>new Promise(r=>setTimeout(r,ms));
function snap(name){call(helper,'snapshot',name);const data=JSON.parse(fs.readFileSync(path.join(mobile,name+'.json'),'utf8'));data.name=name;return data;}
function label(state,pattern){const n=state.nodes.find(n=>pattern.test(n.description||n.text));assert.ok(n,'Expected observed native label '+pattern);return n.description||n.text;}
function tap(state,text){call(helper,'tap',text,state.name);report.steps.push({at:new Date().toISOString(),screen:state.name,action:'Tap '+text});}
function text(state){return state.nodes.map(n=>n.text+'\n'+n.description).join('\n');}
async function routeState(name){let s=snap(name);assert.ok(text(s).includes('Mis rutas'),'Mobile session required before recording');return s;}
try{
 clip='mobile_'+({accept:'02_aceptar_ruta',delivery:'04_entrega_offline',sync_failure:'05_sincronizacion_y_no_entrega'}[stage])+'_'+Date.now();
 call(recorder,'start',clip);await pause(1200);
 if(stage==='accept'){
   let s=await routeState('a01_mis_rutas');tap(s,'Actualizar rutas');await pause(1200);s=snap('a02_recuperar_ruta');
   const selected=label(s,/^Ruta #\d+ ·/);
   if(!selected.startsWith('Ruta #'+fixture.routeId+' ·')){tap(s,selected);s=snap('a03_selector');tap(s,label(s,new RegExp('^Ruta #'+fixture.routeId+' ·')));s=snap('a04_seleccionada');}
   tap(s,label(s,/^Hoja #[\s\S]*Collapsed$/));s=snap('a05_revision');
   for(let i=0;i<3;i++)device('shell','input','swipe','550','1030','550','560','400');
   s=snap('a06_aceptar');tap(s,'Aceptar hoja de ruta');await pause(1800);s=snap('a07_aceptada');assert.ok(text(s).includes('Aceptada por conductor\nSí'));await pause(1800);
 }
 if(stage==='delivery'){
   device('emu','geo','fix','-77.0428','-12.0464');let s=await routeState('d01_mis_rutas');
   const expanded=s.nodes.find(n=>/^Hoja #[\s\S]*Expanded$/.test(n.description));if(expanded){tap(s,expanded.description);s=snap('d02_hoja_colapsada');}
   tap(s,'Actualizar rutas');await pause(1600);s=snap('d03_despachada');assert.ok(text(s).includes('IN_PROGRESS'));
   const order=fixture.orders.find(o=>o.scenario==='SUCCESS');tap(s,label(s,new RegExp('#'+order.trackingNumber+' · IN_TRANSIT')));s=snap('d04_pedido');
   tap(s,'IN_TRANSIT');s=snap('d05_estados');tap(s,'DELIVERED');s=snap('d06_formulario');tap(s,'Tocar para abrir la cámara');await pause(1500);s=snap('d07_camara');tap(s,'Shutter');await pause(1500);s=snap('d08_foto');tap(s,'Done');await pause(1000);
   call(helper,'fill-synthetic','DNI del Receptor','12345678');device('shell','input','swipe','1040','2110','1040','1040','600');s=snap('d09_firma');
   const heading=s.nodes.find(n=>n.description==='Firma del Receptor'),clear=s.nodes.find(n=>n.description==='Limpiar');assert.ok(heading&&clear);
   const hb=heading.bounds.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/).slice(1).map(Number),cb=clear.bounds.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/).slice(1).map(Number);
   const y=Math.round((hb[3]+cb[1])/2);assert.ok(cb[1]-hb[3]>180);
   device('shell','input','swipe','200',String(y),'780',String(y+50),'650');await pause(1000);s=snap('d10_trazo');tap(s,'Confirmar Firma');await pause(1600);s=snap('d11_firma_guardada');assert.ok(text(s).includes('Firma guardada'));
   device('shell','input','swipe','1040','2130','1040','1400','500');s=snap('d12_pod_completo');await pause(1800);
   call(helper,'network-off');device('emu','geo','fix','-77.0428','-12.0464');tap(s,'GUARDAR ESTADO');await pause(13000);s=snap('d13_offline');
   assert.ok(text(s).includes('Evidencia pendiente de confirmación'));tap(s,'1');s=snap('d14_cola');assert.ok(text(s).includes('Pedido #'+order.id+' · Pendiente'));await pause(2500);
 }
 if(stage==='sync_failure'){
   device('shell','am','force-stop','com.example.ecoroute_driver_app');device('shell','monkey','-p','com.example.ecoroute_driver_app','-c','android.intent.category.LAUNCHER','1');await pause(12000);
   let s=await routeState('s01_persistencia_offline');assert.ok(text(s).includes('Evidencia pendiente de confirmación'));tap(s,'1');s=snap('s02_cola_persistente');await pause(1800);
   call(helper,'network-restore');device('emu','geo','fix','-77.0428','-12.0464');await pause(2500);tap(s,'Reintentar pendientes y rechazados');await pause(3500);s=snap('s03_sincronizacion');
   if(!text(s).includes('Sin evidencias pendientes')){await pause(10000);s=snap('s04_sincronizado');}
   assert.ok(text(s).includes('Sin evidencias pendientes'));await pause(2000);tap(s,'Back');s=snap('s05_primera_entregada');
   const failed=fixture.orders.find(o=>o.scenario==='FAILED');tap(s,label(s,new RegExp('#'+failed.trackingNumber+' · IN_TRANSIT')));s=snap('s06_segundo_pedido');tap(s,'IN_TRANSIT');s=snap('s07_estados');tap(s,'FAILED');
   call(helper,'fill-synthetic','Motivo de no entrega','SINTETICO cliente ausente video '+fixture.prefix);s=snap('s08_motivo');await pause(1800);tap(s,'GUARDAR ESTADO');await pause(2500);s=snap('s09_ruta_finalizada');assert.ok(text(s).includes('COMPLETED')&&text(s).includes('1 entregados · 1 fallidos'));await pause(2200);
 }
 report.result='PASS';
}catch(error){report.result='FAIL';report.failure=error.message;process.exitCode=1;}
finally{
 try{if(clip)report.recording=JSON.parse(call(recorder,'stop').trim().split('\n').at(-1));}catch(error){report.recordingError=error.message;report.result='FAIL';process.exitCode=1;}
 report.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(out,'mobile_'+stage+'_'+Date.now()+'.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
