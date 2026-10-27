import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'../..');
const copy='C:/Users/USUARIO/AppData/Local/Temp/ecoroute-mobile-build-20261022-4005';
const out=path.join(root,'docs/control_actualizacion/evidencias/apk_4005.json');
if(fs.existsSync(out))throw Error('Installation evidence already exists');
const adb='C:/Users/USUARIO/AppData/Local/Android/Sdk/platform-tools/adb.exe';
const run=(...args)=>execFileSync(adb,['-s','emulator-5556',...args],{timeout:120000,maxBuffer:2e6,windowsHide:true}).toString();
if(!run('emu','avd','name').includes('EcoRoute_QA'))throw Error('Only the QA emulator is authorized');
const sha=b=>createHash('sha256').update(b).digest('hex'), compared=[];
function compare(rel){
 const file=path.join(root,'mobile-app',rel);
 if(fs.statSync(file).isDirectory())for(const name of fs.readdirSync(file))compare(path.join(rel,name));
 else{const hash=sha(fs.readFileSync(file));if(hash!==sha(fs.readFileSync(path.join(copy,rel))))throw Error('Build copy differs: '+rel);compared.push({file:rel.replaceAll('\\','/'),sha256:hash});}
}
for(const rel of ['lib','android/app/src','pubspec.yaml','pubspec.lock'])compare(rel);
const apk=path.join(copy,'build/app/outputs/flutter-apk/app-x86_64-debug.apk');
const metadata=JSON.parse(fs.readFileSync(path.join(copy,'build/app/outputs/apk/debug/output-metadata.json'),'utf8'));
const versionCode=metadata.elements.find(e=>e.filters.some(f=>f.value==='x86_64'))?.versionCode;
if(versionCode!==8005)throw Error('Unexpected Android version metadata');
const target=path.join(root,'mobile-app/build/qa4005/app-x86_64-debug.apk');
fs.mkdirSync(path.dirname(target),{recursive:true});
if(fs.existsSync(target))throw Error('APK target already exists');
fs.copyFileSync(apk,target);
const before=run('shell','dumpsys','package','com.example.ecoroute_driver_app').split('\n').filter(l=>/versionCode=|versionName=|lastUpdateTime=/.test(l));
if(!run('install','-r','-t',target).includes('Success'))throw Error('Installation failed');
const after=run('shell','dumpsys','package','com.example.ecoroute_driver_app').split('\n').filter(l=>/versionCode=|versionName=|lastUpdateTime=/.test(l));
if(!after.some(l=>l.includes('versionCode='+versionCode)))throw Error('Installed package does not match build');
run('shell','monkey','-p','com.example.ecoroute_driver_app','-c','android.intent.category.LAUNCHER','1');
const result={at:new Date().toISOString(),serial:'emulator-5556',avd:'EcoRoute_QA',buildNumber:4005,versionCode,before,after,installReplaceWithoutClearData:true,sourceFilesCompared:compared,apk:path.relative(root,target).replaceAll('\\','/'),sha256:sha(fs.readFileSync(target)),bytes:fs.statSync(target).size,buildDirectory:copy,businessAcceptance:'NOT_ATTESTED'};
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(result,null,2),{flag:'wx'});
console.log(JSON.stringify({versionCode,sourceFilesCompared:compared.length,sha256:result.sha256,result:'PASS'}));
