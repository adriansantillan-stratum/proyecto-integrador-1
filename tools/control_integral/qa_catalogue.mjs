import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const require=createRequire('C:/Users/USUARIO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/package.json');
const {chromium}=require('playwright');
const root=path.resolve(import.meta.dirname,'../..'),folder=path.join(root,'docs/control_integral_20261022');
const checks=[],errors=[],blockedWrites=[];
const browser=await chromium.launch({channel:'msedge',headless:true});
const result={at:new Date().toISOString(),scope:'LOCAL_READ_ONLY_NOT_HUMAN_ACCEPTANCE',checks,errors,blockedWrites};
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(pathToFileURL(path.join(folder,'index.html')).href);
 for(const [set,count] of [['requirements',135],['nodes',199],['uat',96],['screens',34],['endpoints',68],['metrics',5],['processes',9],['measurementControls',14],['nodeControlCases',199]]){
  await page.locator('#dataset').selectOption(set);assert.equal(await page.locator('#rows tr').count(),count);checks.push({name:'Catalogue '+set,result:'PASS',count});
 }
 await page.locator('#dataset').selectOption('requirements');await page.locator('#query').fill('RF-01');assert.equal(await page.locator('#rows tr').count(),1);checks.push({name:'Search exact requirement',result:'PASS'});
 await page.locator('#query').fill('');await page.locator('#process').selectOption('P08');assert.ok(await page.locator('#rows tr').count()>0);checks.push({name:'Process filter',result:'PASS'});
 const links=await page.locator('a').evaluateAll(links=>links.map(a=>a.getAttribute('href')));
 for(const link of links)await fs.access(path.resolve(folder,decodeURIComponent(link)));
 checks.push({name:'All catalogue links exist',result:'PASS',count:links.length});
 await context.route('**/api/**',async route=>{
  if(!['GET','HEAD','OPTIONS'].includes(route.request().method())){blockedWrites.push(new URL(route.request().url()).pathname);return route.abort('blockedbyclient');}
  return route.continue();
 });
 await page.goto('http://localhost:3000/login');await page.getByRole('button',{name:/Iniciar|Ingresar|Keycloak/i}).click();
 await page.locator('#username').fill('admin');await page.locator('#password').fill(process.env.ECOROUTE_ADMIN_PASSWORD||'admin123');await page.locator('#kc-login').click();await page.waitForURL('http://localhost:3000/');
 await page.goto('http://localhost:3000/bi');await page.getByRole('button',{name:'Eficiencia',exact:true}).click();
 await page.getByText(/Min\/parada: tiempo total de operación dividido entre entregas \+ fallidos \+ devueltos/).waitFor();
 checks.push({name:'Deployed local BI includes returned stops in explanatory text',result:'PASS'});
 assert.deepEqual(errors,[]);assert.deepEqual(blockedWrites,[]);result.result='PASS';
}catch(error){result.result='FAIL';result.failure=error.message;process.exitCode=1;}
finally{await browser.close();await fs.writeFile(path.join(folder,'qa_catalogo_y_web.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({result:result.result,checks:checks.length,failure:result.failure}));}
