import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'../..'),out=path.join(root,'docs/correccion_integral/evidencias');
const checks=[];
function run(name,args,cwd) {
  const start=new Date().toISOString();let status=0,stdout='';
  try {stdout=execFileSync(process.execPath,args,{cwd,encoding:'utf8',maxBuffer:12*1024*1024});}
  catch(error){status=error.status??-1;stdout=String(error.stdout||'')+String(error.stderr||'');}
  checks.push({name,startedAt:start,exitCode:status,stdout});
}
run('TypeScript',['node_modules/typescript/bin/tsc','-b'],path.join(root,'web-admin'));
run('ESLint',['node_modules/eslint/bin/eslint.js','.','--max-warnings','0'],path.join(root,'web-admin'));
const webTests=(await fs.readdir(path.join(root,'web-admin/tests'))).filter(file=>file.endsWith('.test.mjs')).map(file=>'tests/'+file);
run('Web unit tests',['--test',...webTests],path.join(root,'web-admin'));
const results=path.join(root,'build/test-results/test');
const java=[];
for(const file of (await fs.readdir(results)).filter(file=>file.startsWith('TEST-')&&file.endsWith('.xml'))) {
  const xml=await fs.readFile(path.join(results,file),'utf8'),header=xml.match(/<testsuite\s+([^>]+)/)?.[1];
  if(!header)continue;
  const attr=Object.fromEntries([...header.matchAll(/([\w]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
  java.push({suite:attr.name,tests:Number(attr.tests),failures:Number(attr.failures),errors:Number(attr.errors),skipped:Number(attr.skipped),timestamp:attr.timestamp});
}
const summary=java.reduce((a,s)=>({tests:a.tests+s.tests,failures:a.failures+s.failures,errors:a.errors+s.errors,skipped:a.skipped+s.skipped}),{tests:0,failures:0,errors:0,skipped:0});
await fs.writeFile(path.join(out,'calidad_final.json'),JSON.stringify({capturedAt:new Date().toISOString(),environment:'Local workspace',java:{summary,suites:java},web:checks,humanAcceptance:'PENDING'},null,2));
console.log(JSON.stringify({java:summary,web:checks.map(c=>({name:c.name,exitCode:c.exitCode}))}));
if(checks.some(c=>c.exitCode!==0)||summary.failures||summary.errors)process.exitCode=1;
