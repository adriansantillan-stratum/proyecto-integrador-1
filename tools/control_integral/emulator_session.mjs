import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

// Native Android QA only. Never selects a physical phone or clears app data.
const root=path.resolve(import.meta.dirname,'../..');
const videoRun=process.env.ECOROUTE_VIDEO_RUN;
if(videoRun&&!/^ecoroute_[a-z0-9_]+$/.test(videoRun))throw Error('Invalid isolated video run');
const updateRun=process.env.ECOROUTE_UPDATE_RUN;
const ideRun=process.env.ECOROUTE_IDE_RUN;
if(ideRun&&ideRun!=='ejecucion_20261026')throw Error('Invalid isolated IDE evidence folder');
if(updateRun&&updateRun!=='control_actualizacion')throw Error('Invalid update evidence folder');
if(updateRun&&videoRun)throw Error('Select one evidence run');
const out=path.join(root,ideRun?'docs/guia_total_ide/'+ideRun+'/mobile':updateRun?'docs/control_actualizacion/evidencias/mobile':videoRun?'docs/videos/'+videoRun+'/mobile':process.env.ECOROUTE_E2E_NATIVE==='1'?'docs/control_integral_20261022/e2e_cierre/mobile':'docs/control_integral_20261022/emulador_revalidacion');
const adb='C:/Users/USUARIO/AppData/Local/Android/Sdk/platform-tools/adb.exe';
const run=(...args)=>execFileSync(adb,['-s','emulator-5556',...args],{timeout:30000,maxBuffer:20e6,windowsHide:true});
if(!run('emu','avd','name').toString().includes('EcoRoute_QA'))throw Error('Not the isolated EcoRoute QA AVD');
const [action,value]=process.argv.slice(2);
fs.mkdirSync(out,{recursive:true});
const decode=s=>s.replaceAll('&amp;','&').replaceAll('&quot;','"').replaceAll('&#10;','\n').replaceAll('&lt;','<').replaceAll('&gt;','>');
if(action==='network-off'||action==='network-restore'){
  if(process.env.ECOROUTE_E2E_NATIVE!=='1')throw Error('Synthetic E2E only');
  const file=path.join(out,'network_experiment.json');
  if(action==='network-off'){
    if(fs.existsSync(file))throw Error('Network experiment already recorded; inspect before retry');
    const before={wifi:run('shell','settings','get','global','wifi_on').toString().trim(),data:run('shell','settings','get','global','mobile_data').toString().trim()};
    if(before.wifi!=='1'||before.data!=='1')throw Error('Expected connected QA state');
    fs.writeFileSync(file,JSON.stringify({serial:'emulator-5556',before,at:new Date().toISOString()},null,2));
    run('shell','svc','wifi','disable');run('shell','svc','data','disable');
    console.log('Only QA emulator offline; previous state recorded.');
  }else{
    const record=JSON.parse(fs.readFileSync(file,'utf8'));
    if(record.serial!=='emulator-5556')throw Error('Wrong device record');
    run('shell','svc','wifi',record.before.wifi==='1'?'enable':'disable');run('shell','svc','data',record.before.data==='1'?'enable':'disable');
    record.restoredAt=new Date().toISOString();fs.writeFileSync(file,JSON.stringify(record,null,2));console.log('QA emulator network restored.');
  }
}else if(action==='fill-synthetic'){
  if(process.env.ECOROUTE_E2E_NATIVE!=='1')throw Error('Synthetic E2E only');
  const content=process.argv[4];
  if(!/^[A-Za-z0-9_ -]{1,150}$/.test(content??''))throw Error('Only synthetic ASCII fixture text');
  const dump=run('shell','uiautomator','dump','/sdcard/ecoroute-control-window.xml').toString();
  if(!/UI hier(?:archy|chary) dumped/.test(dump))throw Error('No fresh hierarchy; refuse stale input');
  const xml=run('exec-out','cat','/sdcard/ecoroute-control-window.xml').toString();
  const node=[...xml.matchAll(/<node\b[^>]*>/g)].map(m=>m[0]).find(n=>n.includes('class="android.widget.EditText"')&&[...n.matchAll(/(?:hint|text|content-desc)="([^"]*)"/g)].some(a=>decode(a[1])===value));
  const b=node?.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
  if(!b)throw Error('No native input matching the inspected fixture field');
  run('shell','input','tap',String(Math.floor((+b[1]+ +b[3])/2)),String(Math.floor((+b[2]+ +b[4])/2)));
  run('shell','input','text',content.replaceAll(' ','%s'));run('shell','input','keyevent','4');
  console.log('Synthetic field entered: '+value);
}else if(action==='offline-reopen'){
  const wifi=run('shell','settings','get','global','wifi_on').toString().trim();
  const data=run('shell','settings','get','global','mobile_data').toString().trim();
  if(!['0','1','2'].includes(wifi)||!['0','1'].includes(data))throw Error('Unknown network state; refuse experiment');
  const result={at:new Date().toISOString(),serial:'emulator-5556',wifiBefore:wifi,mobileDataBefore:data,scope:'Cached consultation only; no new POD or delivery transition'};
  try{
    run('shell','svc','wifi','disable');run('shell','svc','data','disable');
    result.offline={wifi:run('shell','settings','get','global','wifi_on').toString().trim(),mobileData:run('shell','settings','get','global','mobile_data').toString().trim()};
    run('shell','am','force-stop','com.example.ecoroute_driver_app');
    run('shell','monkey','-p','com.example.ecoroute_driver_app','-c','android.intent.category.LAUNCHER','1');
    await new Promise(r=>setTimeout(r,18000));
    execFileSync(process.execPath,[path.join(root,'tools/control_integral/emulator_session.mjs'),'snapshot','12_offline_reinicio'],{timeout:100000,windowsHide:true});
    result.snapshot='12_offline_reinicio';
  }finally{
    run('shell','svc','wifi',wifi==='1'||wifi==='2'?'enable':'disable');
    run('shell','svc','data',data==='1'?'enable':'disable');
    result.restoredAt=new Date().toISOString();
    result.after={wifi:run('shell','settings','get','global','wifi_on').toString().trim(),mobileData:run('shell','settings','get','global','mobile_data').toString().trim()};
    fs.writeFileSync(path.join(out,'red_offline.json'),JSON.stringify(result,null,2));
  }
  console.log(JSON.stringify(result));
}else if(action==='login-local'){
  const realm=JSON.parse(fs.readFileSync(path.join(root,'ecoroute-realm.json'),'utf8'));
  const driver=realm.users.find(u=>u.realmRoles?.includes('DRIVER'));
  let password=driver?.credentials?.find(c=>c.type==='password')?.value;
  if(!password){
    const match=fs.readFileSync(path.join(root,'README.md'),'utf8').match(/Ingresa con `([^`]+)` \/ `([^`]+)`/);
    if(match?.[1]===driver?.username)password=match[2];
  }
  if(!driver?.username||!password)throw Error('No documented local DRIVER credential');
  const fresh=()=>{run('shell','uiautomator','dump','/sdcard/ecoroute-control-window.xml');return run('exec-out','cat','/sdcard/ecoroute-control-window.xml').toString();};
  const tapNode=node=>{
    const b=node?.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
    if(!b)throw Error('No current native field');
    run('shell','input','tap',String(Math.floor((+b[1]+ +b[3])/2)),String(Math.floor((+b[2]+ +b[4])/2)));
  };
  for(const [hint,secret] of [['Usuario / Correo',driver.username],['Contraseña',password]]){
    if(!/^[\w@.+-]+$/.test(secret))throw Error('Credential needs another safe input method');
    const node=[...fresh().matchAll(/<node\b[^>]*>/g)].map(m=>m[0]).find(n=>n.includes('hint="'+hint+'"'));
    tapNode(node);run('shell','input','text',secret);run('shell','input','keyevent','4');
  }
  tapNode([...fresh().matchAll(/<node\b[^>]*>/g)].map(m=>m[0]).find(n=>n.includes('content-desc="INGRESAR"')));
  console.log('Local DRIVER login submitted; no credential recorded.');
}else if(action==='snapshot'){
  if(!/^[a-z0-9_-]+$/.test(value??''))throw Error('Invalid evidence label');
  let xml;
  for(let i=0;i<3;i++){
    try{
      const dump=run('shell','uiautomator','dump','/sdcard/ecoroute-control-window.xml').toString();
      if(!/UI hier(?:archy|chary) dumped/.test(dump))throw Error('No fresh hierarchy');
      xml=run('exec-out','cat','/sdcard/ecoroute-control-window.xml').toString();
      if(xml.includes('<hierarchy'))break;
    }catch(error){if(i===2)throw error;}
    await new Promise(r=>setTimeout(r,700));
  }
  if(!xml?.includes('<hierarchy'))throw Error('No fresh native hierarchy');
  fs.writeFileSync(path.join(out,value+'.xml'),xml);
  fs.writeFileSync(path.join(out,value+'.png'),run('exec-out','screencap','-p'));
  const nodes=[...xml.matchAll(/<node\b[^>]*>/g)].map(m=>{
    const attrs=Object.fromEntries([...m[0].matchAll(/([\w-]+)="([^"]*)"/g)].map(a=>[a[1],decode(a[2])]));
    return {text:attrs.text,description:attrs['content-desc'],clickable:attrs.clickable,bounds:attrs.bounds};
  }).filter(n=>n.text||n.description);
  fs.writeFileSync(path.join(out,value+'.json'),JSON.stringify({at:new Date().toISOString(),serial:'emulator-5556',avd:'EcoRoute_QA',nodes},null,2));
  console.log(JSON.stringify(nodes));
}else if(action==='tap'){
  // Require an inspected label, then refresh its bounds after navigation settles.
  const inspected=fs.readFileSync(path.join(out,process.argv[4]+'.xml'),'utf8');
  if(![...inspected.matchAll(/(?:text|content-desc)="([^"]*)"/g)].some(a=>decode(a[1])===value))throw Error('Label was not inspected');
  const dump=run('shell','uiautomator','dump','/sdcard/ecoroute-control-window.xml').toString();
  if(!/UI hier(?:archy|chary) dumped/.test(dump))throw Error('No fresh hierarchy; refuse stale tap');
  const current=run('exec-out','cat','/sdcard/ecoroute-control-window.xml').toString();
  const matches=[...current.matchAll(/<node\b[^>]*>/g)];
  const node=matches.find(m=>[...m[0].matchAll(/(?:text|content-desc|hint)="([^"]*)"/g)].some(a=>decode(a[1])===value));
  if(!node)throw Error('Observed label not found: '+value);
  const b=node[0].match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
  if(!b)throw Error('No observed bounds');
  run('shell','input','tap',String(Math.floor((+b[1]+ +b[3])/2)),String(Math.floor((+b[2]+ +b[4])/2)));
  console.log('Tapped observed native label: '+value);
}else throw Error('Use snapshot LABEL or tap LABEL SNAPSHOT');
