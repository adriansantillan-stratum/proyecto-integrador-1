import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const require=createRequire('C:/Users/USUARIO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/package.json');
const {chromium}=require('playwright');
const base=path.resolve('docs/correccion_integral');
const html=await fs.readFile(path.join(base,'index.html'),'utf8');
const references=[...html.matchAll(/(?:href|src)="([^"]+)"/g)].map(m=>m[1]).filter(s=>!s.startsWith('#')&&!/^[a-z]+:/i.test(s));
const missing=[];
for(const reference of references){
 try{await fs.access(path.resolve(base,decodeURIComponent(reference.split('#')[0])));}catch{missing.push(reference);}
}
const browser=await chromium.launch({channel:'msedge',headless:true});
let result;
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto(pathToFileURL(path.join(base,'index.html')).href);
 await page.locator('img').evaluateAll(images=>images.forEach(image=>image.loading='eager'));
 await page.waitForFunction(()=>[...document.images].every(image=>image.complete),null,{timeout:60000});
 const broken=await page.locator('img').evaluateAll(images=>images.filter(image=>!image.naturalWidth).map(image=>image.getAttribute('src')));
 result={at:new Date().toISOString(),result:missing.length||broken.length||errors.length?'FAIL':'PASS',references:references.length,images:await page.locator('img').count(),missing,broken,errors,humanAcceptance:'PENDING'};
 await fs.writeFile(path.join(base,'evidencias/catalogo_html_final.json'),JSON.stringify(result,null,2));
 console.log(JSON.stringify(result));
}finally{await browser.close();}
if(result.result!=='PASS')process.exitCode=1;
