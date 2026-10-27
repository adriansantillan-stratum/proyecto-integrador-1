import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const require=createRequire('C:/Users/USUARIO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/package.json');
const {chromium}=require('playwright');
const root=path.resolve(import.meta.dirname,'../..'),out=path.join(root,'docs/control_integral_20261022/e2e_cierre');
const read=async name=>JSON.parse(await fs.readFile(path.join(out,name),'utf8'));
const result={at:new Date().toISOString(),scope:'EVIDENCE_CATALOGUE_AND_FINAL_ARTEFACT_CHECK',checks:[],pageErrors:[]};
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>result.pageErrors.push(e.message));
 await page.goto(pathToFileURL(path.join(out,'index.html')).href);
 assert.equal(await page.locator('article').count(),13);
 await page.locator('img').evaluateAll(imgs=>imgs.forEach(i=>i.loading='eager'));
 await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));
 result.checks.push({name:'Thirteen journey steps and all screenshots load',result:'PASS'});
 const links=await page.locator('a').evaluateAll(a=>a.map(x=>x.getAttribute('href')));
 for(const url of links){assert.ok(!/^[a-z]+:/i.test(url));await fs.access(path.resolve(out,decodeURIComponent(url)));}
 result.checks.push({name:'Every catalogue file link resolves',result:'PASS',count:links.length});
 const manifest=await read('manifest.json');
 for(const entry of manifest.files){const bytes=await fs.readFile(path.resolve(out,entry.file));assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256,entry.file);}
 result.checks.push({name:'All manifested evidence hashes match',result:'PASS',count:manifest.files.length});
 const closure=await read('cierre_recorrido.json');const final=await read(closure.latestFinalServer);
 assert.equal(final.result,'PASS');assert.equal(final.summary.failed,0);assert.equal(final.incidents[0].outcome,'CLOSE_FAILED');assert.equal(final.incidents[0].status,'RESOLVED');
 assert.equal((await read('native_session_navigation.json')).checks.length,3);
 assert.equal((await read('calidad_mobile_final.json')).status,'PASS');
 result.checks.push({name:'Final API SQL, resolved exception, navigation and Flutter reports pass',result:'PASS'});
 assert.deepEqual(result.pageErrors,[]);result.result='PASS';
}catch(error){result.result='FAIL';result.failure=error.message;process.exitCode=1;}
finally{await browser.close();const latest=path.join(out,'qa_catalogue.json');try{await fs.copyFile(latest,path.join(out,'qa_catalogue_prior_'+Date.now()+'.json'));}catch(error){if(error.code!=='ENOENT')throw error;}await fs.writeFile(latest,JSON.stringify(result,null,2));console.log(JSON.stringify(result));}
