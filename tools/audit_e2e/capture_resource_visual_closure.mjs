/** MV05/MV06 only. Real PKCE/backend; block ALL application writes.
 * Existing E2E screenshots and records are never overwritten.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const require=createRequire('C:/Users/USUARIO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/package.json');
const {chromium}=require('playwright');
const root=path.resolve(import.meta.dirname,'../..');
const out=path.join(root,'docs/correccion_integral/capturas/cierre_visual_recursos');
const origin=process.env.ECOROUTE_CAPTURE_ORIGIN || 'http://localhost:3000';
const diagnose=process.argv.includes('--diagnose');
await fs.mkdir(out,{recursive:true});
const evidence={result:'IN_PROGRESS',at:new Date().toISOString(),origin,mode:'REAL_PKCE_REAL_LOCAL_BACKEND_READ_ONLY',
  replacements:[],checks:[],limitations:['Human MICOTRANS acceptance remains PENDING.','No record creation/update/delete or notification acknowledgement is executed.'],
  requests:[],blockedWrites:[],pageErrors:[],screenshots:[],geometry:[]};
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1100},locale:'es-PE',timezoneId:'America/Lima'});
await context.route(origin+'/api/**',async route=>{
  const r=route.request();
  if(!['GET','HEAD','OPTIONS'].includes(r.method())){
    evidence.blockedWrites.push({method:r.method(),path:new URL(r.url()).pathname});
    return route.abort('blockedbyclient');
  }
  return route.continue();
});
const page=await context.newPage();
page.setDefaultTimeout(30000);
page.on('pageerror',e=>evidence.pageErrors.push(e.message));
page.on('response',r=>{const u=new URL(r.url());if(u.origin===origin&&u.pathname.startsWith('/api/'))evidence.requests.push({method:r.request().method(),path:u.pathname,status:r.status()});});
const check=(name,detail)=>evidence.checks.push({name,result:'PASS',...detail});
const originalHashes=[];
const webRoot=path.join(root,'docs/correccion_integral/capturas/web');
for(const dir of await fs.readdir(webRoot,{withFileTypes:true})){
  if(!dir.isDirectory())continue;
  for(const file of ['driver_form.png','vehicle_form.png','02_notifications.png']){
    const filePath=path.join(webRoot,dir.name,file);
    try{originalHashes.push({file:filePath,sha256:createHash('sha256').update(await fs.readFile(filePath)).digest('hex')});}
    catch(error){if(error.code!=='ENOENT')throw error;}
  }
}
async function shot(name,extraMasks=[]){
  const target=path.join(out,name);
  // Playwright masks are top-layer rectangles: masking the background table also
  // masks a foreground modal. Redact background paint in-place for screenshots
  // instead; preserve DOM geometry and normal stacking of the visible form.
  const style=`tbody td:not(:has(button)) { color:transparent !important; background:#cbd5e1 !important; }
    tbody td:not(:has(button)) * { visibility:hidden !important; }
    aside p, aside small { visibility:hidden !important; }
    #notification-panel p, #notification-panel span[style*="0.65rem"] { color:transparent !important; background:#cbd5e1 !important; }`;
  await page.screenshot({path:target,animations:'disabled',style,mask:extraMasks,maskColor:'#cbd5e1'});
  const bytes=await fs.readFile(target);
  evidence.screenshots.push({file:name,sha256:createHash('sha256').update(bytes).digest('hex')});
}
async function geometry(locator,label){
  return locator.evaluate((el,label)=>{
    const r=el.getBoundingClientRect();
    const center=document.elementFromPoint(Math.max(0,Math.min(innerWidth-1,r.x+r.width/2)),Math.max(0,Math.min(innerHeight-1,r.y+r.height/2)));
    const ancestors=[];for(let p=el;p;p=p.parentElement){const s=getComputedStyle(p);if(s.overflow!=='visible'||s.transform!=='none')ancestors.push({tag:p.tagName,className:p.className,overflow:s.overflow,transform:s.transform});}
    return {label,x:r.x,y:r.y,width:r.width,height:r.height,viewport:{width:innerWidth,height:innerHeight},withinViewport:r.x>=0&&r.y>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,centerHitInside:!!center&&el.contains(center),ancestors};
  },label);
}
try{
  await page.goto(origin+'/login');
  await page.getByRole('button',{name:/Iniciar|Ingresar|Keycloak/i}).click();
  await page.locator('#username').fill(process.env.ECOROUTE_ADMIN_USER||'admin');
  await page.locator('#password').fill(process.env.ECOROUTE_ADMIN_PASSWORD||'admin123');
  await page.locator('#kc-login').click();
  await page.waitForURL(origin+'/');
  await page.locator('.main-container').waitFor();
  const me=await page.evaluate(async()=>{const r=await fetch('/api/session/me',{headers:{Authorization:`Bearer ${localStorage.getItem('token')}`}});const d=await r.json();return {status:r.status,admin:d.roles?.some(x=>(typeof x==='string'?x:x.authority).includes('ADMIN'))};});
  assert.equal(me.status,200);assert.equal(me.admin,true);check('Real ADMIN PKCE/session',{});
  for(const [route,button,title,name] of [['/drivers','Nuevo Conductor','Nuevo Conductor','driver_form.png'],['/vehicles','Nuevo Vehículo','Nuevo Vehículo','vehicle_form.png']]){
    const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/api'+route&&r.request().method()==='GET'&&r.status()===200);
    await page.goto(origin+route);await response;
    await page.getByRole('button',{name:button,exact:true}).click();
    await page.getByRole('heading',{name:title,exact:true}).waitFor();
    const form=page.locator('form').first();
    const card=form.locator('..');
    const g=await geometry(card,title);evidence.geometry.push(g);
    const controls=await form.locator('input:not([type=checkbox]), button').all();
    assert.equal(await form.locator('input:not([type=checkbox])').count(),5);
    for(const input of await form.locator('input:not([type=checkbox])').all()){
      assert.ok(['','0'].includes(await input.inputValue()),'New form must not contain personal values');
      assert.ok((await input.getAttribute('placeholder'))?.length>0);
    }
    for(const control of controls){const rect=await geometry(control,'control');assert.ok(rect.withinViewport&&rect.centerHitInside,'Form control clipped or occluded');}
    await shot((diagnose?'diagnostic_':'')+name,[page.locator('input[placeholder="Buscar..."]')]);
    if(!diagnose){
      assert.ok(g.withinViewport&&g.centerHitInside,`${title} outside viewport/occluded`);check(title+' visible fields and controls without value masks',g);
      await page.setViewportSize({width:390,height:844});
      const mobile=await geometry(card,title+' 390px');assert.ok(mobile.withinViewport&&mobile.centerHitInside);check(title+' fits 390px',mobile);
      await page.setViewportSize({width:1440,height:1100});
      await form.getByRole('button',{name:'Cancelar',exact:true}).click();
      await form.waitFor({state:'hidden'});check(title+' cancel closes without submit',{});
    }
  }
  await page.goto(origin+'/');
  const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/notifications/unread'&&r.status()===200);
  await page.getByTitle('Notificaciones',{exact:true}).click();await response;
  const panel=diagnose?page.locator('div').filter({has:page.locator(':scope > div > span',{hasText:/^Notificaciones$/})}).last():page.getByRole('region',{name:'Notificaciones',exact:true});
  const g=await geometry(panel,'Notificaciones');evidence.geometry.push(g);
  // CSS redaction stays clipped by the scrolling surface. Top-layer masks would
  // paint offscreen notification rows across the sidebar below the panel.
  await shot((diagnose?'diagnostic_':'')+'02_notifications.png');
  if(!diagnose){
    assert.ok(g.withinViewport&&g.centerHitInside,'Notifications outside viewport/occluded');check('Notifications full panel inside viewport',g);
    assert.equal(await panel.evaluate(el=>el.parentElement===document.body),true);check('Notification portal outside sidebar clipping',{});
    await panel.getByRole('button',{name:'Cerrar notificaciones'}).click();await panel.waitFor({state:'hidden'});
    await page.getByTitle('Notificaciones',{exact:true}).click();await panel.waitFor();
    await page.keyboard.press('Escape');await panel.waitFor({state:'hidden'});check('Notifications explicit close and Escape',{});
    await page.getByTitle('Colapsar',{exact:true}).click();
    await page.getByTitle('Notificaciones',{exact:true}).click();
    const collapsed=await geometry(panel,'Notifications collapsed');assert.ok(collapsed.withinViewport&&collapsed.centerHitInside);check('Collapsed notification panel fits viewport',collapsed);
    await page.getByRole('heading',{name:/Bienvenido/}).click();await panel.waitFor({state:'hidden'});check('Outside click closes portal',{});
    for(const width of [390,320]){
      await page.setViewportSize({width,height:844});
      await page.getByRole('button',{name:'Abrir navegación',exact:true}).click();
      await page.getByTitle('Notificaciones',{exact:true}).click();await panel.waitFor();
      const mobile=await geometry(panel,'Notifications '+width+'px');assert.ok(mobile.withinViewport&&mobile.centerHitInside);check('Notifications '+width+'px viewport',mobile);
      await panel.getByRole('button',{name:'Cerrar notificaciones'}).click();
      await page.getByRole('button',{name:'Cerrar navegación',exact:true}).click();
    }
  }
  assert.deepEqual(evidence.blockedWrites,[]);assert.deepEqual(evidence.pageErrors,[]);
  check('No application writes or JavaScript errors',{});
  for(const item of originalHashes)assert.equal(createHash('sha256').update(await fs.readFile(item.file)).digest('hex'),item.sha256,'Original E2E capture changed');
  evidence.originalE2EFilesPreserved=originalHashes;check('Original E2E screenshots preserved',{count:originalHashes.length});
  evidence.result=diagnose?'DIAGNOSTIC':'PASS';
  if(!diagnose)evidence.replacements=[{original:'driver_form.png',replacement:'driver_form.png'},{original:'vehicle_form.png',replacement:'vehicle_form.png'},{original:'02_notifications.png',replacement:'02_notifications.png'}];
}catch(e){evidence.result='FAIL';evidence.failure=String(e.message).replace(/eyJ[\w.-]+/g,'[REDACTED]').slice(0,900);console.log(evidence.failure);process.exitCode=1;}
finally{
  evidence.finishedAt=new Date().toISOString();
  await fs.writeFile(path.join(out,diagnose?'diagnostic.json':'results.json'),JSON.stringify(evidence,null,2));
  await browser.close();
  console.log(JSON.stringify({result:evidence.result,out,geometry:evidence.geometry,checks:evidence.checks.length,blockedWrites:evidence.blockedWrites.length}));
}
