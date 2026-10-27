import fs from 'node:fs/promises';
import path from 'node:path';
import {execFile} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'../..'),out=path.join(root,'docs/control_integral_20261022');
const commands=[];
for(const [name,args] of [
 ['TypeScript',['node_modules/typescript/bin/tsc','-b']],
 ['ESLint',['node_modules/eslint/bin/eslint.js','.','--max-warnings','0']],
 ['Tests web',['--test',...(await fs.readdir(path.join(root,'web-admin/tests'))).filter(n=>n.endsWith('.test.mjs')).map(n=>'tests/'+n)]],
]){
 const result=await new Promise(resolve=>execFile(process.execPath,args,{cwd:path.join(root,'web-admin'),encoding:'utf8',timeout:120000,windowsHide:true,maxBuffer:10e6},(error,stdout,stderr)=>resolve({name,at:new Date().toISOString(),exitCode:error?.code??0,stdout,stderr})));
 commands.push(result);
}
const java=[];
for(const name of await fs.readdir(path.join(root,'build/verification_20261022/test-results/test'))){
 if(!/^TEST-.*\.xml$/.test(name))continue;
 const xml=await fs.readFile(path.join(root,'build/verification_20261022/test-results/test',name),'utf8');
 const attrs=Object.fromEntries([...(xml.match(/<testsuite\s+([^>]+)/)?.[1]??'').matchAll(/([\w]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
 java.push({name:attrs.name,tests:+attrs.tests,failures:+attrs.failures,errors:+attrs.errors,skipped:+attrs.skipped,at:attrs.timestamp});
}
const summary=java.reduce((a,s)=>({tests:a.tests+s.tests,failures:a.failures+s.failures,errors:a.errors+s.errors,skipped:a.skipped+s.skipped}),{tests:0,failures:0,errors:0,skipped:0});
const result={at:new Date().toISOString(),scope:'LOCAL_TECHNICAL_TESTS_NOT_UAT',java:{summary,suites:java,outputDirectory:'build/verification_20261022',retryReason:'Initial in-place compile could not delete OneDrive-locked generated directories. Re-run in isolated generated output completed successfully.'},web:commands};
result.result=summary.tests>0&&!summary.failures&&!summary.errors&&!summary.skipped&&commands.every(c=>c.exitCode===0)?'PASS':'FAIL';
await fs.writeFile(path.join(out,'calidad_actual.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify({result:result.result,java:summary,web:commands.map(c=>({name:c.name,exitCode:c.exitCode}))}));
if(result.result!=='PASS')process.exitCode=1;
