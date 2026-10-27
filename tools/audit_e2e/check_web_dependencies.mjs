import {execFileSync} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../..');
const cli='C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js';
let output;
try{output=execFileSync(process.execPath,[cli,'audit','--json'],{cwd:path.join(root,'web-admin'),encoding:'utf8',maxBuffer:15*1024*1024});}
catch(error){output=error.stdout;if(!output)throw error;}
const result=JSON.parse(output);
try {await fs.copyFile(path.join(root,'docs/correccion_integral/evidencias/auditoria_dependencias_web.json'),path.join(root,`docs/correccion_integral/evidencias/auditoria_dependencias_web_${Date.now()}.json`));}catch(error){if(error.code!=='ENOENT')throw error;}
await fs.writeFile(path.join(root,'docs/correccion_integral/evidencias/auditoria_dependencias_web.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify({metadata:result.metadata,vulnerabilities:Object.entries(result.vulnerabilities||{}).map(([name,item])=>({name,severity:item.severity,isDirect:item.isDirect,range:item.range,fixAvailable:item.fixAvailable,via:item.via.filter(v=>typeof v==='object').map(v=>({title:v.title,url:v.url,range:v.range}))}))},null,2));
