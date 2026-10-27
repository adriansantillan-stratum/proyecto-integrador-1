import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
const require=createRequire('C:/Users/USUARIO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/package.json');
const {chromium}=require('playwright');
const out=path.resolve('docs/auditoria_end_to_end_20261019');
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(pathToFileURL(path.join(out,'index.html')).href);
 await page.locator('img').evaluateAll(images=>images.forEach(i=>i.loading='eager'));
 await page.waitForFunction(()=>[...document.images].every(i=>i.complete),null,{timeout:15000});
 const broken=await page.locator('img').evaluateAll(images=>images.filter(i=>!i.naturalWidth).map(i=>i.src));
 await page.screenshot({path:path.join(out,'_qa/manual_html.png')});
 const result={images:await page.locator('img').count(),broken,errors};
 fs.writeFileSync(path.join(out,'_qa/html.json'),JSON.stringify(result,null,2));
 console.log(JSON.stringify(result));if(broken.length||errors.length)process.exitCode=1;
}finally{await browser.close();}
