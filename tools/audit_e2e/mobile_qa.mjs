import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../..'),out=path.join(root,'docs/correccion_integral/capturas/mobile');
fs.mkdirSync(out,{recursive:true});
const adb='C:/Users/USUARIO/AppData/Local/Android/Sdk/platform-tools/adb.exe';
const [command,...args]=process.argv.slice(2);
const run=(...args)=>execFileSync(adb,['-s','emulator-5556',...args],{timeout:25000,maxBuffer:20*1024*1024});
if(command==='shot') {
  if(!/^[a-z0-9_-]+$/i.test(args[0]))throw new Error('Invalid screenshot filename');
  fs.writeFileSync(path.join(out,args[0]+'.png'),run('exec-out','screencap','-p'));console.log(path.join(out,args[0]+'.png'));
}else if(command==='dump') {
  let dumped=false;
  for(let attempt=0;attempt<3;attempt++){
    const result=run('shell','uiautomator','dump','/sdcard/ecoroute-qa-window.xml').toString();
    if(result.includes('UI hierchary dumped')||result.includes('UI hierarchy dumped')){dumped=true;break;}
    await new Promise(resolve=>setTimeout(resolve,700));
  }
  if(!dumped)throw new Error('No fresh Android hierarchy; refusing to reuse old XML');
  const xml=run('exec-out','cat','/sdcard/ecoroute-qa-window.xml').toString();
  fs.writeFileSync(path.join(out,'current-ui.xml'),xml);
  console.log((xml.match(/<node[^>]+>/g)||[]).filter(line=>!/text="".*content-desc=""/.test(line)).join('\n').slice(0,18000));
}else console.log(run(...process.argv.slice(2)).toString());
