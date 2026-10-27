import fs from 'node:fs/promises';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'../..'),out=path.join(root,'docs/control_actualizacion/evidencias/calidad_integrada_'+Date.now()+'.json');
const report={at:new Date().toISOString(),scope:'LOCAL_AUTOMATED_NOT_BUSINESS_UAT',businessAcceptance:'NOT_ATTESTED',commands:[]};
const handle=await fs.open(out,'wx');
const save=async()=>{const b=Buffer.from(JSON.stringify(report,null,2));await handle.truncate(0);await handle.write(b,0,b.length,0);};
async function command(name,exe,args,cwd){
 console.log('START '+name);const at=new Date().toISOString();
 const result=await new Promise(resolve=>execFile(exe,args,{cwd,windowsHide:true,encoding:'utf8',timeout:600000,maxBuffer:16e6,env:{...process.env,JAVA_HOME:process.env.JAVA_HOME||'C:/Program Files/Eclipse Adoptium/jdk-17.0.17.10-hotspot'}},(error,stdout,stderr)=>resolve({name,at,exitCode:error?.code??0,stdout,stderr,finishedAt:new Date().toISOString()})));
 report.commands.push(result);await save();console.log(name+' exit '+result.exitCode);return result;
}
try{
 await command('Java full suite','powershell.exe',['-NoProfile','-NonInteractive','-Command',"$ErrorActionPreference='Stop'; & ./gradlew.bat test --rerun-tasks --no-daemon --console=plain -I tools/control_actualizacion/full_verification.init.gradle; exit $LASTEXITCODE"],root);
 const dir=path.join(root,'build/full_actualizacion_20261022/test-results/test');
 report.javaSuites=[];
 for(const name of (await fs.readdir(dir)).filter(n=>/^TEST-.*\.xml$/.test(n))){const xml=await fs.readFile(path.join(dir,name),'utf8');const attrs=Object.fromEntries([...xml.match(/<testsuite\s+([^>]+)/)[1].matchAll(/([\w]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));report.javaSuites.push({name:attrs.name,tests:+attrs.tests,failures:+attrs.failures,errors:+attrs.errors,skipped:+attrs.skipped,xmlSha256:createHash('sha256').update(xml).digest('hex')});}
 report.javaSummary=report.javaSuites.reduce((a,s)=>Object.fromEntries(['tests','failures','errors','skipped'].map(k=>[k,a[k]+s[k]])),{tests:0,failures:0,errors:0,skipped:0});await save();
 const web=path.join(root,'web-admin');
 await command('TypeScript',process.execPath,['node_modules/typescript/bin/tsc','-b'],web);
 await command('ESLint',process.execPath,['node_modules/eslint/bin/eslint.js','.','--max-warnings','0'],web);
 await command('Web full suite',process.execPath,['--test',...(await fs.readdir(path.join(web,'tests'))).filter(n=>n.endsWith('.test.mjs')).map(n=>'tests/'+n)],web);
 report.result=report.commands.every(c=>c.exitCode===0)&&report.javaSummary.tests>0&&!report.javaSummary.failures&&!report.javaSummary.errors&&!report.javaSummary.skipped?'PASS':'FAIL';
}catch(error){report.result='FAIL';report.error=error.message;}
finally{report.finishedAt=new Date().toISOString();await save();await handle.close();console.log(JSON.stringify({result:report.result,java:report.javaSummary,commands:report.commands.map(c=>({name:c.name,exitCode:c.exitCode})),error:report.error}));if(report.result!=='PASS')process.exitCode=1;}
