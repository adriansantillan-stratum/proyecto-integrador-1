import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire('C:/Users/USUARIO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/package.json');
const {chromium}=require('playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=path.join(root,'docs/auditoria_end_to_end_20261019');
const screenshots=path.join(out,'pantallas');
await fs.mkdir(screenshots,{recursive:true});
const state=JSON.parse(await fs.readFile(path.join(out,'evidencias/casos_prueba.json'),'utf8'));
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1.5,timezoneId:'America/Lima',locale:'es-PE'});
const page=await context.newPage();
const evidence={date:'2026-10-19',screens:[],requests:[],consoleErrors:[],actions:[]};
evidence.webSockets=[];
page.on('websocket',socket=>{
 const record={url:socket.url(),sent:0,received:0};evidence.webSockets.push(record);
 socket.on('framesent',()=>record.sent++);socket.on('framereceived',()=>record.received++);
});
page.on('pageerror',e=>evidence.consoleErrors.push(e.message));
page.on('response',r=>{if(r.url().includes('/api/'))evidence.requests.push({path:new URL(r.url()).pathname,status:r.status()});});
page.on('dialog',async d=>{evidence.actions.push({dialog:d.type(),message:d.message()});await d.dismiss();});
const shot=async(name,label)=>{await page.screenshot({path:path.join(screenshots,name+'.png'),fullPage:true});evidence.screens.push({name,label,url:page.url()});};
try{
 await page.goto('http://localhost:3000',{waitUntil:'networkidle'});
 await shot('S01_login_web','Acceso web a EcoRoute');
 await page.getByRole('button').first().click();
 await page.locator('#username').waitFor();
 await shot('S01b_keycloak','Formulario real de Keycloak');
 await page.locator('#username').fill('admin');
 await page.locator('#password').fill(process.env.ECOROUTE_ADMIN_PASSWORD||'admin123');
 await page.locator('#kc-login').click();
 await page.waitForURL('http://localhost:3000/**',{timeout:20000});
 await page.waitForTimeout(1200);
 evidence.actions.push({action:'login PKCE',pass:!page.url().includes('8080')});
 for(const [url,name,label] of [
  ['/orders','S02_pedidos','Gestion de pedidos'],
  ['/routes','S03_despacho','Gestion de despacho'],
  ['/dashboard','S07_dashboard','Panel de control logistico'],
  ['/reports','S08_reportes','Reportes y analitica'],
  ['/drivers','apoyo_conductores','Conductores'],['/vehicles','apoyo_vehiculos','Vehiculos'],
  ['/purchases','apoyo_compras','Compras'],['/users','apoyo_usuarios','Asignaciones locales de rol']]){
   await page.goto('http://localhost:3000'+url,{waitUntil:'networkidle'});
   await page.waitForTimeout(800);
   if(url==='/orders'){
    const search=page.locator('input[type="text"]').first();
    if(await search.count())await search.fill('AUDIT-');
   }
   if(url==='/routes'){
    // La opcion de todas las fechas deja visible la jornada Lima cuando el filtro usa UTC.
    const buttons=await page.getByRole('button').allTextContents();
    evidence.actions.push({page:url,buttons});
    await shot('hallazgo_fecha_web','Filtro Hoy usa fecha UTC');
    await page.getByRole('button',{name:'Histórico',exact:true}).click();
    await page.waitForTimeout(500);
    const routeCard=page.locator('.card').filter({hasText:`Ruta #${state.route.id}`});
    if(await routeCard.count())await routeCard.first().click();
    await page.waitForTimeout(800);
   }
   await shot(name,label);
 }
 await page.goto('http://localhost:3000/orders',{waitUntil:'networkidle'});
 await page.getByRole('button',{name:/Nuevo Pedido/i}).click();
 const fields=await page.locator('input,select').evaluateAll(items=>items.map(x=>({tag:x.tagName,type:x.type,placeholder:x.placeholder,name:x.name,required:x.required,options:x.tagName==='SELECT'?[...x.options].map(o=>({text:o.text,value:o.value})):undefined})));
 evidence.actions.push({page:'alta-pedido',fields});
 await shot('S02b_alta_pedido','Formulario de alta con ruta opcional');
 await page.getByPlaceholder('Ej: ECO-12345').fill(`${state.prefix}-WEB`);
 await page.getByPlaceholder('Ej: Ana García').fill('Prueba interfaz web');
 await page.getByPlaceholder('Ej: Calle Los Pinos 450').fill('Direccion sintetica de auditoria');
 await page.getByPlaceholder('Ej: 912345678').fill('999123456');
 const responsePromise=page.waitForResponse(r=>r.url().endsWith('/api/orders')&&r.request().method()==='POST',{timeout:5000});
 await page.getByRole('button',{name:'Registrar',exact:true}).click();
 const response=await responsePromise;const created=await response.json();
 evidence.actions.push({action:'Alta pedido por formulario real',pass:response.status()===200&&created.status==='PENDING',status:response.status(),id:created.id,state:created.status});
 const search=page.locator('input[type="text"]').first();await search.fill(`${state.prefix}-WEB`);
 await page.waitForTimeout(500);await shot('S02c_pedido_creado','Pedido creado desde la interfaz');
 await page.goto('http://localhost:3000/reports',{waitUntil:'networkidle'});
 const exports=page.getByRole('button',{name:/Exportar CSV/i});
 if(await exports.count()){
   try{
    const downloaded=page.waitForEvent('download',{timeout:2500});await exports.first().click();
    const download=await downloaded;await download.saveAs(path.join(out,'evidencias/reporte_web.csv'));
    evidence.actions.push({action:'Exportar CSV desde Reportes',pass:true,file:download.suggestedFilename()});
   }catch{evidence.actions.push({action:'Exportar CSV desde Reportes',pass:false,detail:'Sin descarga: el endpoint de eficiencia falla y la tabla queda vacia.'});}
 }
}catch(e){evidence.fatal=e.message;console.error(e.message);}
finally{
 await fs.writeFile(path.join(out,'evidencias/pruebas_web.json'),JSON.stringify(evidence,null,2));
 await browser.close();
 console.log(JSON.stringify({screens:evidence.screens.length,actions:evidence.actions,fatal:evidence.fatal,consoleErrors:evidence.consoleErrors},null,2));
}
