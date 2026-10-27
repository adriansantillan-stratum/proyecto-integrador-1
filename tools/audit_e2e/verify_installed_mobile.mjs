import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'../..');
const node=process.execPath;
execFileSync(node,[path.join(root,'tools/audit_e2e/mobile_qa.mjs'),'dump'],{encoding:'utf8',timeout:40000});
const xml=fs.readFileSync(path.join(root,'docs/correccion_integral/capturas/mobile/current-ui.xml'),'utf8');
const tests=[
 {name:'Inicio de sesión y lectura de Mis rutas',result:xml.includes('Mis rutas')&&xml.includes('Cerrar sesión')?'PASS':'FAIL'},
 {name:'La ruta sintética muestra el cierre real COMPLETED',result:/Ruta #11[^<]*COMPLETED/.test(xml)?'PASS':'FAIL'},
 {name:'Sin POD pendiente después de la actualización',result:xml.includes('content-desc="0"')?'PASS':'FAIL'},
];
const evidencePath=path.join(root,'docs/correccion_integral/evidencias/instalacion_mobile_final.json');
const result=JSON.parse(fs.readFileSync(evidencePath,'utf8'));
const screenshot='docs/correccion_integral/_qa/mobile_final_version4003.png';
const bytes=execFileSync('C:/Users/USUARIO/AppData/Local/Android/Sdk/platform-tools/adb.exe',['-s','emulator-5556','exec-out','screencap','-p'],{timeout:20000,maxBuffer:15*1024*1024});
fs.writeFileSync(path.join(root,screenshot),bytes);
result.uiVerification={at:new Date().toISOString(),tests,screenshot,passed:tests.filter(t=>t.result==='PASS').length,failed:tests.filter(t=>t.result==='FAIL').length};
fs.writeFileSync(evidencePath,JSON.stringify(result,null,2));
console.log(JSON.stringify(result.uiVerification));
if(result.uiVerification.failed)process.exitCode=1;
