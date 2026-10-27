import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire('C:/Users/USUARIO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/package.json');
const {chromium}=require('playwright');
const root=path.resolve(import.meta.dirname,'../..'),out=path.join(root,'docs/control_actualizacion/evidencias/web/run_'+Date.now());
await fs.mkdir(out,{recursive:true});
const report={at:new Date().toISOString(),scope:'REAL_LOCAL_WEB_READ_ONLY',businessAcceptance:'NOT_ATTESTED',checks:[],pageErrors:[],blockedBusinessWrites:[]};
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({viewport:{width:1600,height:900},locale:'es-PE',timezoneId:'America/Lima'}),page=await context.newPage();
page.on('pageerror',e=>report.pageErrors.push(e.message));
async function shot(name){await page.waitForFunction(()=>!document.querySelector('main')?.innerText.includes('Cargando'));await page.waitForTimeout(1300);await page.screenshot({path:path.join(out,name+'.png'),fullPage:true});}
const check=name=>report.checks.push({name,result:'PASS'});
async function filters(){await page.getByLabel('Conductor',{exact:true}).selectOption('1');await page.getByLabel('Desde (Lima)',{exact:true}).fill('2026-10-22');await page.getByLabel('Hasta (Lima)',{exact:true}).fill('2026-10-22');await page.waitForLoadState('networkidle');}
try{
 await page.goto('http://localhost:3000/login');await page.getByRole('button',{name:/Iniciar|Ingresar|Keycloak/i}).click();
 await page.locator('#username').fill('admin');await page.locator('#password').fill(process.env.ECOROUTE_ADMIN_PASSWORD||'admin123');await page.locator('#kc-login').click();await page.waitForURL('http://localhost:3000/');
 await context.route('**/api/**',route=>{if(['GET','HEAD','OPTIONS'].includes(route.request().method()))return route.continue();report.blockedBusinessWrites.push(route.request().method()+' '+new URL(route.request().url()).pathname);return route.abort();});
 await page.goto('http://localhost:3000/dashboard',{waitUntil:'networkidle'});await filters();await shot('01_dashboard');check('Dashboard filtered by same date/driver');
 await page.goto('http://localhost:3000/bi',{waitUntil:'networkidle'});
 const pending=page.waitForResponse(r=>{const u=new URL(r.url());return u.pathname==='/api/reports/bi'&&u.searchParams.get('driverId')==='1'&&u.searchParams.get('startDate')==='2026-10-22'&&u.searchParams.get('endDate')==='2026-10-22'&&r.status()===200;});
 await filters();const bi=await(await pending).json();assert.equal(bi.kpis.find(k=>k.code==='SUCCESS').percentage,50);report.kpis=bi.kpis;
 await page.getByText('Población: conductor 1 · 2026-10-22 a 2026-10-22 · America/Lima. Fechas inclusivas.',{exact:true}).waitFor();await shot('02_indicadores');check('Five indicators use actual filtered response');
 await page.getByRole('navigation',{name:'Vistas de inteligencia de negocio'}).getByRole('button',{name:'Eficiencia',exact:true}).click();
 const row=page.locator('tbody tr').filter({has:page.getByRole('cell',{name:'Ruta 20',exact:true})});await row.waitFor();
 const cells=await row.locator('td').allTextContents();assert.equal(cells[3],'No evaluable');assert.equal(cells[5],'No evaluable');assert.match(cells[8],/velocidad/i);report.route20Cells=cells;
 await page.getByRole('heading',{name:'Eficiencia por ruta',exact:true}).scrollIntoViewIfNeeded();await shot('03_eficiencia_gps');check('Invalid GPS route is unavailable with reason; no plan/zero substitution');
 const csvEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar CSV de rutas',exact:true}).click();await(await csvEvent).saveAs(path.join(out,'eficiencia_v16.csv'));
 const csv=await fs.readFile(path.join(out,'eficiencia_v16.csv'),'utf8');const lines=csv.replace(/^\uFEFF/,'').split(/\r?\n/);const line=lines.find(l=>/^"?20"?,/.test(l));assert.ok(line,'Route20 CSV row');const unquote=s=>s.replace(/^"|"$/g,'');const fields=line.split(',').map(unquote);const record=Object.fromEntries(lines[0].split(',').map(unquote).map((h,i)=>[h,fields[i]]));assert.equal(record.actualGpsDistanceKm,'');assert.equal(record.kmPerDelivery,'');assert.ok(!line.includes('7433'));check('CSV preserves missing actual GPS metrics as empty');
 await page.goto('http://localhost:3000/orders',{waitUntil:'networkidle'});await page.getByPlaceholder('Tracking o destinatario').fill('VID-20261022194451-SUCCESS');await page.getByRole('button',{name:'Detalles / confirmar / asignar / POD',exact:true}).click();
 await page.waitForFunction(()=>{const imgs=[...document.querySelectorAll('.proof-images img')];return imgs.length===2&&imgs.every(i=>i.complete&&i.naturalWidth>0);});
 await page.getByRole('button',{name:'Descargar PDF con foto y firma',exact:true}).scrollIntoViewIfNeeded();await shot('04_pod_conservado');check('Previous journey photo/signature still accessible after update');
 assert.deepEqual(report.pageErrors,[]);assert.deepEqual(report.blockedBusinessWrites,[]);check('No page errors or business writes');report.result='PASS';
}catch(error){report.result='FAIL';report.failure=error.message;await page.screenshot({path:path.join(out,'error.png'),fullPage:true}).catch(()=>{});process.exitCode=1;}
finally{await context.close();await browser.close();report.finishedAt=new Date().toISOString();await fs.writeFile(path.join(out,'result_'+Date.now()+'.json'),JSON.stringify(report,null,2),{flag:'wx'});console.log(JSON.stringify({result:report.result,checks:report.checks.length,failure:report.failure}));}
