import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire('C:/Users/USUARIO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/package.json');
const {chromium}=require('playwright');
const root=path.resolve(import.meta.dirname,'../..');
const videoRun=process.env.ECOROUTE_VIDEO_RUN;
if(videoRun&&!/^ecoroute_[a-z0-9_]+$/.test(videoRun))throw Error('Invalid isolated video run');
const out=path.join(root,videoRun?'docs/videos/'+videoRun:'docs/control_integral_20261022/e2e_cierre');
await fs.mkdir(out,{recursive:true});
const stage=process.argv[2];
assert.ok(['prepare','dispatch','resolve','final','capture','inspect'].includes(stage));
const fixturePath=path.join(out,'fixture.json');
let fixture;
try{fixture=JSON.parse(await fs.readFile(fixturePath,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
if(!fixture){
  assert.equal(stage,'prepare');
  fixture={prefix:(videoRun?'VID-':'E2E-')+new Date().toISOString().replace(/\D/g,'').slice(0,14),date:new Intl.DateTimeFormat('en-CA',{timeZone:'America/Lima'}).format(new Date()),driverId:1,vehicleId:1,orders:[],synthetic:true,businessAcceptance:'NOT_ATTESTED'};
  await fs.writeFile(fixturePath,JSON.stringify(fixture,null,2));
}
const evidence={at:new Date().toISOString(),stage,mode:'REAL_LOCAL_WEB_UI_PKCE',checks:[],requests:[],pageErrors:[],screens:[]};
const browser=await chromium.launch({channel:'msedge',headless:true,slowMo:videoRun?100:0});
const contextOptions={viewport:{width:1600,height:videoRun?900:1100},locale:'es-PE',timezoneId:'America/Lima'};
let context=await browser.newContext(contextOptions),page=await context.newPage(),recordedPage;
function observe(){page.setDefaultTimeout(30000);page.on('pageerror',e=>evidence.pageErrors.push(e.message));page.on('response',r=>{const u=new URL(r.url());if(u.origin==='http://localhost:3000'&&u.pathname.startsWith('/api/'))evidence.requests.push({at:new Date().toISOString(),method:r.request().method(),path:u.pathname+u.search,status:r.status()});});}
observe();
const save=()=>fs.writeFile(fixturePath,JSON.stringify(fixture,null,2));
const check=(name,detail)=>evidence.checks.push({name,result:'PASS',detail});
async function shot(name){if(videoRun){await page.waitForFunction(()=>!document.querySelector('main')?.innerText.includes('Cargando'),null,{timeout:12000}).catch(()=>{});await page.waitForTimeout(2300);}let file=name+'.png';try{await fs.access(path.join(out,file));file=name+'_'+Date.now()+'.png';}catch{}await page.screenshot({path:path.join(out,file),fullPage:true,animations:'disabled'});evidence.screens.push(file);}
async function response(method,pathname,action){
  const promise=page.waitForResponse(r=>new URL(r.url()).pathname===pathname&&r.request().method()===method);
  await action();const r=await promise;let body;try{body=await r.json();}catch{body=null;}
  assert.equal(r.status(),200,`${method} ${pathname}: ${JSON.stringify(body)}`);return body;
}
async function goto(url){await page.goto('http://localhost:3000'+url,{waitUntil:'networkidle'});}
async function filters(){
  await page.getByLabel('Conductor',{exact:true}).selectOption(String(fixture.driverId));
  await page.getByLabel('Desde (Lima)',{exact:true}).fill(fixture.date);
  await page.getByLabel('Hasta (Lima)',{exact:true}).fill(fixture.date);
  await page.waitForLoadState('networkidle');
}
async function selectOwnRoute(){
  await goto('/routes');
  const button=page.getByRole('button',{name:`#${fixture.routeId} · ${fixture.date} · ${stage==='final'?'COMPLETED':'PLANNED'}`,exact:true});
  await button.click();
  await page.getByRole('heading',{name:`Ruta #${fixture.routeId} · ${stage==='final'?'COMPLETED':'PLANNED'}`,exact:true}).waitFor();
}
try{
  await goto('/login');await page.getByRole('button',{name:/Iniciar|Ingresar|Keycloak/i}).click();
  await page.locator('#username').fill('admin');await page.locator('#password').fill(process.env.ECOROUTE_ADMIN_PASSWORD||'admin123');await page.locator('#kc-login').click();await page.waitForURL('http://localhost:3000/');
  check('Autenticación web real con Keycloak PKCE');
  if(videoRun){
    const state=await context.storageState();await context.close();
    context=await browser.newContext({...contextOptions,storageState:state,recordVideo:{dir:path.join(out,'raw'),size:{width:1600,height:900}}});
    page=await context.newPage();recordedPage=page;observe();
    evidence.recording={loginExcluded:true,source:'Playwright real browser recording',viewport:contextOptions.viewport};
  }
  if(stage==='inspect'){
    await goto('/orders');console.log((await page.locator('main').innerText()).slice(0,2000));
  }
  if(stage==='prepare'){
    await goto('/dashboard');await filters();await shot('01_dashboard_antes');check('Dashboard inicial con fecha y conductor del ensayo');
    await goto('/bi');await filters();await shot('02_indicadores_antes');
    for(const [scenario,lat,lon] of [['SUCCESS',-12.0464,-77.0428],['FAILED',-12.0525,-77.0347]]){
      if(fixture.orders.some(o=>o.scenario===scenario))continue;
      await goto('/orders');await page.getByRole('button',{name:'Nuevo pedido',exact:true}).click();
      const form=page.getByRole('dialog',{name:'Nuevo pedido sin ruta',exact:true});
      const trackingNumber=fixture.prefix+'-'+scenario;
      for(const [label,value] of [['Tracking',trackingNumber],['Referencia externa (separada del RUC)','SINTETICO E2E - NO SERVICIO REAL'],['Destinatario','ENSAYO '+scenario],['Teléfono','999123456'],['Correo','ensayo@example.invalid'],['Dirección',scenario==='SUCCESS'?'SINTETICO - Plaza Mayor de Lima':'SINTETICO - Parque Universitario Lima'],['Ciudad','Lima'],['Distrito','Lima'],['Latitud',String(lat)],['Longitud',String(lon)],['Prioridad','1'],['Ventana de entrega: inicio (Lima, opcional)',fixture.date+'T00:01'],['Ventana de entrega: fin (Lima, opcional)',fixture.date+'T23:59'],['RUC del destinatario (opcional, 11 dígitos)','20123456789'],['Condiciones acordadas / nota de revisión','SINTETICO '+fixture.prefix+'; revisión técnica, no aceptación empresarial']])await form.getByLabel(label,{exact:true}).fill(value);
      for(const label of ['Cliente aceptó las condiciones','Dirección verificada','Cobertura verificada'])await form.getByLabel(label,{exact:true}).check();
      await shot('03_formulario_'+scenario.toLowerCase());
      const order=await response('POST','/api/orders',()=>form.getByRole('button',{name:'Guardar pedido sin ruta',exact:true}).click());
      fixture.orders.push({id:order.id,trackingNumber,scenario});await save();
      assert.equal(order.status,'PENDING');assert.equal(order.routeId,null);
      const detail=page.getByRole('dialog',{name:'Pedido '+trackingNumber,exact:true});await detail.waitFor();
      await detail.getByText('Datos comerciales confirmados',{exact:true}).waitFor();
      await shot('04_pedido_pendiente_'+scenario.toLowerCase());
      check('Alta sin ruta y confirmación comercial desde web: '+scenario,{orderId:order.id,status:order.status});
      await detail.getByRole('button',{name:'Cerrar',exact:true}).click();
    }
    if(!fixture.routeId){
      await goto('/routes');await page.getByRole('button',{name:'Nueva ruta',exact:true}).click();
      const form=page.getByRole('dialog',{name:'Planificar ruta',exact:true});
      await form.getByLabel('Fecha operativa (Lima)',{exact:true}).fill(fixture.date);
      await form.getByLabel('Hora prevista (Lima)',{exact:true}).fill('08:00');
      await form.getByLabel('Conductor disponible',{exact:false}).selectOption(String(fixture.driverId));
      await form.getByLabel('Vehículo disponible',{exact:false}).selectOption(String(fixture.vehicleId));
      await shot('05_planificar_ruta');
      const route=await response('POST','/api/routes',()=>form.getByRole('button',{name:'Crear ruta PLANNED',exact:true}).click());
      fixture.routeId=route.id;await save();check('Planificación web de ruta de hoy',{routeId:route.id});
    }
    for(const order of fixture.orders){
      await goto('/orders');await page.getByPlaceholder('Tracking o destinatario').fill(order.trackingNumber);
      await page.getByRole('button',{name:'Detalles / confirmar / asignar / POD',exact:true}).click();
      const detail=page.getByRole('dialog',{name:'Pedido '+order.trackingNumber,exact:true});
      const select=detail.getByLabel('Ruta para '+order.trackingNumber,{exact:true});
      if(await select.count()){
        await select.selectOption(String(fixture.routeId));
        const assigned=await response('PATCH',`/api/orders/${order.id}/route`,()=>detail.getByRole('button',{name:'Asignar',exact:true}).click());
        assert.equal(assigned.id,order.id);assert.equal(assigned.status,'ASSIGNED');
        check('Asignación conserva el pedido '+order.scenario,{id:assigned.id,routeId:assigned.routeId});
      }
      await shot('06_asignado_'+order.scenario.toLowerCase());
    }
    await selectOwnRoute();
    await page.getByLabel('Capacidad de carga verificada',{exact:true}).check();await page.getByLabel('Ventanas de atención verificadas',{exact:true}).check();await page.getByLabel('Vehículo inspeccionado',{exact:true}).check();
    await page.getByLabel('Peso de carga (kg)',{exact:false}).fill('2');await page.getByLabel('Nota de revisión',{exact:true}).fill('SINTETICO '+fixture.prefix+' aprobación técnica local');
    const review=await response('POST',`/api/routes/${fixture.routeId}/review`,()=>page.getByRole('button',{name:'Guardar aprobación ADMIN',exact:true}).click());assert.equal(review.approved,true);assert.equal(review.accepted,false);
    await shot('07_aprobacion_web_espera_conductor');
    assert.equal(await page.getByRole('button',{name:'Iniciar despacho',exact:true}).isDisabled(),true);
    check('Aprobación ADMIN; despacho bloqueado hasta aceptación móvil');
  }
  if(stage==='dispatch'){
    await selectOwnRoute();
    await page.getByText(/Aceptación del conductor: Aceptada/).waitFor();
    await shot('09_aceptacion_movil_visible_web');
    const route=await response('PATCH',`/api/routes/${fixture.routeId}/status`,()=>page.getByRole('button',{name:'Iniciar despacho',exact:true}).click());assert.equal(route.status,'IN_PROGRESS');
    check('Despacho web después de aceptación móvil',{routeId:route.id});await page.getByRole('heading',{name:`Ruta #${fixture.routeId} · IN_PROGRESS`,exact:true}).waitFor();await shot('10_despacho_y_recorrido');
    await goto('/dashboard');await filters();await shot('11_dashboard_en_transito');
  }
  if(stage==='resolve'){
    await goto('/incidents');
    const failed=fixture.orders.find(o=>o.scenario==='FAILED');
    const row=page.getByRole('row').filter({hasText:new RegExp('Pedido '+failed.id+'(?:\\D|$)')});
    await row.getByRole('button',{name:'Resolver',exact:true}).click();
    const dialog=page.getByRole('dialog');
    await dialog.getByLabel('Decisión',{exact:true}).selectOption('CLOSE_FAILED');
    await dialog.getByLabel('Motivo',{exact:true}).selectOption({label:'Cliente ausente'});
    await dialog.getByLabel('Justificación de la decisión',{exact:true}).fill('SINTETICO '+fixture.prefix+' cierre administrativo del ensayo de ausencia, sin reabrir pedido ni crear nuevo intento.');
    await shot('25_resolver_excepcion');
    const incidentId=Number((await dialog.getAttribute('aria-label')).match(/#(\d+)/)[1]);
    const incident=await response('PATCH',`/api/incidents/${incidentId}/resolution`,()=>dialog.getByRole('button',{name:'Guardar resolución',exact:true}).click());
    assert.equal(incident.outcome,'CLOSE_FAILED');assert.ok(incident.resolvedBy);
    await page.getByRole('dialog').waitFor({state:'hidden'});await page.getByRole('row').filter({hasText:new RegExp('Pedido '+failed.id+'(?:\\D|$)')}).getByText(/RESOLVED/).waitFor();await shot('26_excepcion_resuelta');
    check('Jefatura cierra incidencia sintética sin reabrir pedido',{incidentId,outcome:incident.outcome,status:incident.status});
  }
  if(stage==='capture'){
    await context.route('**/api/**',route=>['GET','HEAD','OPTIONS'].includes(route.request().method())?route.continue():route.abort('blockedbyclient'));
    await goto('/dashboard');await filters();
    await page.waitForFunction(()=>!document.querySelector('main').innerText.includes('Cargando'));
    await page.waitForTimeout(1300);await shot('23_dashboard_final_ready');
    await goto('/bi');
    const biReady=page.waitForResponse(r=>{const u=new URL(r.url());return u.pathname==='/api/reports/bi'&&u.searchParams.get('driverId')==='1'&&u.searchParams.get('startDate')===fixture.date&&u.searchParams.get('endDate')===fixture.date&&r.status()===200;});
    await filters();const bi=await(await biReady).json();assert.equal(bi.kpis.find(k=>k.code==='SUCCESS').percentage,50);
    await page.getByText(`Población: conductor 1 · ${fixture.date} a ${fixture.date} · America/Lima. Fechas inclusivas.`,{exact:true}).waitFor();
    await page.getByRole('heading',{name:'IID · Integridad de Datos Registrados',exact:true}).waitFor();
    await page.waitForFunction(()=>!document.querySelector('main').innerText.includes('Cargando'));await page.waitForTimeout(1300);await shot('24_indicadores_final_ready');
    await goto('/incidents');await page.getByLabel('Buscar',{exact:true}).fill('SINTETICO cliente ausente E2E cierre tecnico');
    const row=page.getByRole('row').filter({hasText:'Pedido 45'});await row.waitFor();assert.match(await row.innerText(),/RESOLVED\s*·\s*CLOSE_FAILED/);assert.equal(await row.getByRole('button',{name:'Resolver',exact:true}).count(),0);
    await page.waitForFunction(()=>!document.querySelector('main').innerText.includes('Cargando'));await shot('26_excepcion_resuelta_ready');
    check('Read-only final screenshots wait for resolved incident, exact KPI population and completed chart animations');
  }
  if(stage==='final'){
    await selectOwnRoute();await shot('20_ruta_cerrada_web');check('Ruta COMPLETED visible en web');
    for(const order of fixture.orders){
      await goto('/orders');await page.getByPlaceholder('Tracking o destinatario').fill(order.trackingNumber);await page.getByRole('button',{name:'Detalles / confirmar / asignar / POD',exact:true}).click();
      const detail=page.getByRole('dialog',{name:'Pedido '+order.trackingNumber,exact:true});await detail.getByText('Pedido cerrado. Estado y evidencia son de solo lectura. Un nuevo intento se gestiona desde Incidencias.',{exact:true}).waitFor();
      if(order.scenario==='SUCCESS'){
        await detail.getByRole('button',{name:'Descargar PDF con foto y firma',exact:true}).waitFor();
        const imgs=detail.locator('.proof-images img');assert.equal(await imgs.count(),2);
        await page.waitForFunction(()=>[...document.querySelectorAll('.proof-images img')].every(i=>i.complete&&i.naturalWidth>0));
        const download=page.waitForEvent('download');await detail.getByRole('button',{name:'Descargar PDF con foto y firma',exact:true}).click();await(await download).saveAs(path.join(out,'comprobante_nuevo_ensayo.pdf'));
        check('Foto, firma y PDF del nuevo POD recuperables desde web',{orderId:order.id});
      }
      await shot('21_resultado_'+order.scenario.toLowerCase());
    }
    await goto('/incidents');if(videoRun)await page.getByLabel('Buscar',{exact:true}).fill(fixture.prefix);await shot('22_incidencia_web');
    await goto('/dashboard');await filters();await shot('23_dashboard_final');
    if(videoRun){await page.getByText('Pedidos por distrito',{exact:true}).scrollIntoViewIfNeeded();await shot('23b_dashboard_graficos');}
    await goto('/bi');await filters();await page.getByRole('button',{name:'Actualizar indicadores',exact:true}).click();await page.waitForLoadState('networkidle');await shot('24_indicadores_final');
    const download=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar indicadores y tendencias CSV',exact:true}).click();await(await download).saveAs(path.join(out,'indicadores_nuevo_ensayo.csv'));
    if(videoRun){
      await page.locator('main .operation-grid > section.card').last().scrollIntoViewIfNeeded();await shot('24b_cinco_indicadores');
      await page.getByText('Evolución diaria · ONTIME',{exact:true}).scrollIntoViewIfNeeded();await shot('24c_tendencias');
      for(const [view,name] of [['Causas','24d_causas'],['Cumplimiento','24e_cumplimiento'],['Eficiencia','24f_eficiencia']]){
        await page.getByRole('navigation',{name:'Vistas de inteligencia de negocio'}).getByRole('button',{name:view,exact:true}).click();
        await page.locator('main canvas').last().scrollIntoViewIfNeeded();await shot(name);
      }
      await page.getByRole('heading',{name:'Inteligencia de negocio · P05 / P06',exact:true}).scrollIntoViewIfNeeded();await shot('24g_cierre');
    }
    check('Dashboard e indicadores finales con misma fecha y conductor; CSV descargado');
  }
  assert.deepEqual(evidence.pageErrors,[]);evidence.result='PASS';
}catch(error){evidence.result='FAIL';evidence.failure=error.message;await shot('error_web_'+stage).catch(()=>{});process.exitCode=1;}
finally{evidence.finishedAt=new Date().toISOString();await context.close();if(recordedPage){const source=await recordedPage.video().path();const file='raw/web_'+stage+'_'+Date.now()+'.webm';await fs.rename(source,path.join(out,file));evidence.recording.file=file;}await fs.writeFile(path.join(out,'web_'+stage+'_'+Date.now()+'.json'),JSON.stringify(evidence,null,2));await browser.close();console.log(JSON.stringify({stage,result:evidence.result,checks:evidence.checks.length,failure:evidence.failure,fixture,recording:evidence.recording}));}
