import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=path.join(root,'docs/auditoria_end_to_end_20261019');
const adb='C:/Users/USUARIO/AppData/Local/Android/Sdk/platform-tools/adb.exe';
const [command,...args]=process.argv.slice(2);
const run=(...a)=>execFileSync(adb,a,{timeout:20000,maxBuffer:16*1024*1024});
if(command==='shot'){
 fs.mkdirSync(path.join(out,'pantallas'),{recursive:true});
 fs.writeFileSync(path.join(out,'pantallas',args[0]+'.png'),run('exec-out','screencap','-p'));
 console.log(args[0]);
}else if(command==='dump'){
 run('shell','uiautomator','dump','/sdcard/audit-window.xml');
 const xml=run('exec-out','cat','/sdcard/audit-window.xml').toString();
 fs.mkdirSync(path.join(out,'evidencias'),{recursive:true});fs.writeFileSync(path.join(out,'evidencias','mobile-ui.xml'),xml);
 const nodes=xml.match(/<node[^>]+>/g)||[];
 console.log(nodes.filter(n=>!/text="".*content-desc=""/.test(n)).join('\n').slice(0,16000));
}else console.log(run(...process.argv.slice(2)).toString());
