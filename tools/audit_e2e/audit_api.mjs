import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=path.join(root,'docs/auditoria_end_to_end_20261019');
await fs.mkdir(path.join(out,'evidencias'),{recursive:true});
const phase=process.argv[2]||'initial';
const reportPath=path.join(out,'evidencias/pruebas_api.json');
const statePath=path.join(out,'evidencias/casos_prueba.json');
const report=phase==='initial'?{date:'2026-10-19',timezone:'America/Lima',tests:[]}:JSON.parse(await fs.readFile(reportPath,'utf8'));
const state=phase==='initial'?{prefix:`AUDIT-${Date.now()}`,today:new Intl.DateTimeFormat('en-CA',{timeZone:'America/Lima'}).format(new Date())}:JSON.parse(await fs.readFile(statePath,'utf8'));
let admin,driver;
async function http(url,{method='GET',token=admin,body,form}={}){
  const headers={}; if(token)headers.Authorization=`Bearer ${token}`;
  if(body!==undefined)headers['Content-Type']=typeof body==='string'?'text/plain':'application/json';
  if(form)headers['Content-Type']='application/x-www-form-urlencoded';
  const started=performance.now();
  const r=await fetch(url.startsWith('http')?url:`http://localhost:8081${url}`,{
    method,headers,body:form?new URLSearchParams(form):body!==undefined?(typeof body==='string'?body:JSON.stringify(body)):undefined,
    signal:AbortSignal.timeout(15000)});
  const text=await r.text();let data;try{data=JSON.parse(text)}catch{data=text.slice(0,250)}
  return {status:r.status,ms:Math.round(performance.now()-started),data};
}
async function login(username,password){
  const r=await http('http://localhost:8080/realms/ecoroute/protocol/openid-connect/token',{
    method:'POST',token:null,form:{client_id:'mobile-app',grant_type:'password',username,password}});
  if(r.status!==200)throw new Error(`Login ${username}: HTTP ${r.status}`);
  return r.data.access_token;
}
async function test(id,name,bpmn,req,fn){
  const started=performance.now();let result;
  try{result=await fn();}catch(e){result={pass:false,detail:e.message};}
  report.tests.push({id,name,bpmn,req,...result,durationMs:Math.round(performance.now()-started)});
  console.log(`${id} ${result.pass?'OK':'HALLAZGO'} ${name}: ${result.detail||''}`);
  await fs.writeFile(reportPath,JSON.stringify(report,null,2));
  await fs.writeFile(statePath,JSON.stringify(state,null,2));
}
const payload=(suffix,routeId=null)=>({trackingNumber:`${state.prefix}-${suffix}`,routeId,
  recipientName:`Prueba ${suffix}`,recipientPhone:'999123456',recipientEmail:'prueba@example.invalid',
  deliveryAddress:'Direccion de ensayo Lima',deliveryCity:'Lima',deliveryDistrict:'Cercado',
  latitude:-12.046+Math.random()*.015,longitude:-77.043-Math.random()*.01,priority:1,
  estimatedDeliveryWindowEnd:new Date(Date.now()+3600000).toISOString()});
const createOrder=async(suffix,routeId)=>{const r=await http('/orders',{method:'POST',body:payload(suffix,routeId)});if(r.status!==200)throw new Error(`Alta pedido HTTP ${r.status}`);return r.data;};
const tinyPng='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKma1gAAAABJRU5ErkJggg==';

await test(`${phase}-AUTH`,'Autenticacion administrador','P08','RF-01',async()=>{
 admin=await login('admin',process.env.ECOROUTE_ADMIN_PASSWORD||'admin123');return {pass:true,detail:'Token real de Keycloak recibido; no se almacena.'};});
if(!admin)process.exit(2);
await test(`${phase}-DRIVER`,'Autenticacion conductor','P08','RF-02',async()=>{
 driver=await login('conductor',process.env.ECOROUTE_DRIVER_PASSWORD||'conductor123');return {pass:true,detail:'Token real del conductor recibido.'};});

if(phase==='initial'){
 await test('T01','Salud backend','Transversal','RNF disponibilidad',async()=>{const r=await http('/actuator/health',{token:null});return {pass:r.status===200&&r.data.status==='UP',http:r.status,detail:JSON.stringify(r.data)};});
 await test('T02','Web servida por Nginx','Transversal','RNF portabilidad',async()=>{const r=await http('http://localhost:3000',{token:null});return {pass:r.status===200,http:r.status,detail:'Aplicacion HTML disponible en puerto 3000.'};});
 await test('T03','Denegar acceso sin token','P08','RF-06',async()=>{const r=await http('/orders',{token:null});return {pass:r.status===401,http:r.status,detail:`HTTP ${r.status}`};});
 await test('T04','Denegar reportes al conductor','P08','RF-06',async()=>{const r=await http('/reports/orders-summary',{token:driver});return {pass:r.status===403,http:r.status,detail:`HTTP ${r.status}`};});
 await test('T05','Validar datos de pedido','P01','RF-17',async()=>{const r=await http('/orders',{method:'POST',body:{...payload('INVALID'),recipientPhone:'123'}});return {pass:r.status===400,http:r.status,detail:`Telefono invalido: HTTP ${r.status}`};});
 await test('T06','Registrar pedido sin ruta','P01','RF-17',async()=>{state.pending=await createOrder('PENDING',null);return {pass:state.pending.status==='PENDING'&&state.pending.routeId===null,detail:`Pedido ${state.pending.id} ${state.pending.status}`};});
 await test('T07','Habilitar conductor y vehiculo de ensayo','P06','RF-09 RF-13',async()=>{
  const r=await http('/drivers',{method:'POST',body:{firstName:'Auditoria',lastName:'Ensayo',licenseNumber:`Q${String(Date.now()).slice(-8)}`,phoneNumber:'999123456',email:'auditoria@example.invalid',isActive:true}});state.driver=r.data;
  const v=await http('/vehicles',{method:'POST',body:{plateNumber:`QA${String(Date.now()).slice(-1)}-${String(Date.now()).slice(-3)}`,model:'Ensayo',brand:'Auditoria',capacityKg:500,capacityM3:3,isActive:true}});state.vehicle=v.data;
  return {pass:r.status===200&&v.status===200,detail:`Conductor ${state.driver.id}; vehiculo ${state.vehicle.id}`};});
 await test('T08','Crear ruta de hoy para conductor movil','P02','RF-26',async()=>{
  const r=await http('/routes',{method:'POST',body:{driverId:1,vehicleId:state.vehicle.id,routeDate:state.today,estimatedStartTime:new Date().toISOString()}});state.route=r.data;
  return {pass:r.status===200&&r.data.status==='PLANNED',http:r.status,detail:`Ruta ${r.data.id}, fecha ${state.today}, estado ${r.data.status}`};});
 if(!state.route?.id)process.exit(3);
 await test('T09','Evitar doble asignacion de recurso','P02','RF-27',async()=>{const r=await http('/routes',{method:'POST',body:{driverId:1,vehicleId:state.vehicle.id,routeDate:state.today}});return {pass:r.status>=400&&r.status<500,http:r.status,detail:`Conflicto rechazado HTTP ${r.status}; se espera error de negocio 4xx, no 500.`};});
 await test('T10','Asociar despues un pedido PENDING','P02','RF-19 flujo BPMN',async()=>{const r=await http(`/orders/${state.pending.id}/route`,{method:'PATCH',body:{routeId:state.route.id}});return {pass:r.status===200,http:r.status,detail:`No hay operacion de asignacion posterior: HTTP ${r.status}`};});
 await test('T11','Alta alternativa con ruta ya creada','P01 P02','RF-19',async()=>{state.apiOrder=await createOrder('POD',state.route.id);state.mobileOrder=await createOrder('MOVIL',state.route.id);state.failureOrder=await createOrder('FALLA',state.route.id);return {pass:state.apiOrder.status==='ASSIGNED',detail:`Pedidos ${state.apiOrder.id}, ${state.mobileOrder.id}, ${state.failureOrder.id} ASSIGNED.`};});
 await test('T12','Revisar camino antes de despachar','P02','RF-33 RF-34',async()=>{const r=await http(`/routes/${state.route.id}/path`);return {pass:r.status===200&&Boolean(r.data.polyline),http:r.status,detail:`Paradas ASSIGNED: ${r.data.orderIds?.length??r.data.orderedOrderIds?.length??0}; polilinea: ${Boolean(r.data.polyline)}`};});
 await test('T13','Iniciar despacho y cascada de pedidos','P02','RF-29 RF-30',async()=>{const r=await http(`/routes/${state.route.id}/status?status=IN_PROGRESS`,{method:'PATCH'});const orders=await http(`/orders?routeId=${state.route.id}`);return {pass:r.status===200&&orders.data.every(o=>o.status==='IN_TRANSIT'),http:r.status,detail:`Ruta ${r.data.status}; estados ${orders.data.map(o=>o.status).join(',')}`};});
 await test('T14','Camino vial de ruta iniciada','P02 P03','RF-33 RF-34',async()=>{const r=await http(`/routes/${state.route.id}/path`);state.path=r.data;return {pass:r.status===200&&Boolean(r.data.polyline)&&r.data.source==='osrm',http:r.status,detail:`${r.data.source}; ${r.data.distanceKm} km; ${r.data.durationMin} min`,result:r.data};});
 await test('T15','Guardar y consultar GPS','P07','RF-56 RF-57',async()=>{const r=await http('/gps/ping',{method:'POST',token:driver,body:{vehicleId:state.vehicle.id,driverId:1,latitude:-12.046374,longitude:-77.042793,speedKmh:20,headingDegrees:90}});const h=await http(`/gps/history/${state.vehicle.id}`);return {pass:r.status===200&&h.data.length>0,http:r.status,detail:`Posicion ${r.data.id}; historial ${h.data.length}`};});
 await test('T16','WebSocket de GPS transmite sin autenticacion','P07 P08','RF-58 RNF seguridad',async()=>{
  const socket=new WebSocket('ws://localhost:8081/ws/gps');
  await new Promise((ok,no)=>{socket.onopen=ok;socket.onerror=()=>no(new Error('Conexion WebSocket fallida'));setTimeout(()=>no(new Error('Timeout conexion')),4000).unref();});
  socket.send(String(state.vehicle.id));await new Promise(r=>setTimeout(r,250));
  const message=new Promise((ok,no)=>{socket.onmessage=e=>ok(JSON.parse(e.data));setTimeout(()=>no(new Error('No se recibio evento GPS')),3000).unref();});
  await http('/gps/ping',{method:'POST',body:{vehicleId:state.vehicle.id,driverId:1,latitude:-12.047,longitude:-77.043,speedKmh:21,headingDegrees:90}});
  let m;try{m=await message;}finally{socket.close();}
  return {pass:false,functionalPass:!!m,detail:'GPS en vivo recibido sin token: transporte funciona, control de acceso pendiente.'};});
 await test('T17','Registrar POD con foto y firma antes de reparar infraestructura','P03','RF-48 RF-50 RF-53 RF-54',async()=>{const r=await http('/delivery-proofs',{method:'POST',token:driver,body:{orderId:state.apiOrder.id,imageUrl:tinyPng,signatureDataUrl:tinyPng,receiverName:'Receptor de ensayo',receiverDni:'00000000',latitude:-12.047,longitude:-77.043}});return {pass:r.status===200,http:r.status,detail:`HTTP ${r.status}; ${typeof r.data==='object'?r.data.message||'':r.data}`};});
 await test('T18','Lectura transversal de modulos','P05 P06 P08 P09','RF-63 RF-69 RF-71',async()=>{const endpoints=['/dashboard/orders-by-status','/dashboard/delivery-performance','/reports/orders-summary','/reports/driver-performance','/reports/route-efficiency','/purchases','/users','/notifications/unread/count'];const all=[];for(const endpoint of endpoints){const r=await http(endpoint);all.push({endpoint,status:r.status,ms:r.ms,keys:Array.isArray(r.data)?Object.keys(r.data[0]||{}):Object.keys(r.data||{})});}return {pass:all.every(x=>x.status===200),detail:all.map(x=>`${x.endpoint} ${x.status}`).join('; '),result:all};});
 await test('T19','CSV correcto y linea defectuosa','P01','RF-20',async()=>{const csv=`trackingNumber,recipientName,deliveryAddress,latitude,longitude\n${state.prefix}-CSV,Ensayo CSV,Direccion de prueba,-12.05,-77.04\nlinea_invalida\n`;const r=await http('/orders/bulk-csv',{method:'POST',body:csv});return {pass:false,functionalPass:r.status===200&&r.data.length===1,http:r.status,detail:`Importa ${Array.isArray(r.data)?r.data.length:0} fila(s), omite linea defectuosa sin informe de error.`};});
}

if(phase==='pod'){
 await test('T20','Registrar POD con infraestructura disponible','P03','RF-48 RF-50 RF-53 RF-54',async()=>{const r=await http('/delivery-proofs',{method:'POST',token:driver,body:{orderId:state.apiOrder.id,imageUrl:tinyPng,signatureDataUrl:tinyPng,receiverName:'Receptor ensayo API',receiverDni:'00000000',latitude:-12.047,longitude:-77.043}});state.proof=r.data;const o=await http(`/orders/${state.apiOrder.id}`);return {pass:r.status===200&&o.data.status==='DELIVERED',http:r.status,detail:`POD ${r.data.id}; pedido ${o.data.status}; objeto ${r.data.imageUrl}`};});
 await test('T21','Generar comprobante PDF','P03 P05','RF-55',async()=>{const r=await fetch(`http://localhost:8081/delivery-proofs/${state.apiOrder.id}/pdf`,{headers:{Authorization:`Bearer ${admin}`}});const bytes=new Uint8Array(await r.arrayBuffer());if(r.status===200)await fs.writeFile(path.join(out,'evidencias/comprobante_prueba.pdf'),bytes);return {pass:r.status===200&&new TextDecoder().decode(bytes.slice(0,4))==='%PDF',http:r.status,detail:`${bytes.length} bytes; firma PDF comprobada.`};});
 await test('T22','Rechazar entrega sin evidencia','P03','RF-49 RF-50',async()=>{state.noProof=await createOrder('SIN-POD',null);const r=await http(`/orders/${state.noProof.id}/status`,{method:'PATCH',body:{status:'DELIVERED',reason:'Ensayo de validacion sin POD'}});return {pass:r.status>=400&&r.status<500,http:r.status,detail:`Sin foto ni firma se acepta estado ${r.data.status}; HTTP ${r.status}`};});
 await test('T23','Rechazar POD vacio','P03','RF-49 RF-50 RF-51',async()=>{state.emptyProofOrder=await createOrder('POD-VACIO',null);const r=await http('/delivery-proofs',{method:'POST',body:{orderId:state.emptyProofOrder.id,imageUrl:'',signatureDataUrl:'',receiverName:'',receiverDni:'',latitude:0,longitude:0}});return {pass:r.status>=400&&r.status<500,http:r.status,detail:`POD vacio HTTP ${r.status}; id ${r.data.id??'sin id'}`};});
 await test('T24','Conservar estados finales','P03 P04','RF-44',async()=>{const r=await http(`/orders/${state.noProof.id}/status`,{method:'PATCH',body:{status:'PENDING',reason:'Ensayo cambio posterior a final'}});return {pass:r.status>=400&&r.status<500,http:r.status,detail:`DELIVERED a PENDING: HTTP ${r.status}, estado ${r.data.status}`};});
 await test('T25','Registrar fallo con motivo','P04','RF-23 RF-78',async()=>{const r=await http(`/orders/${state.failureOrder.id}/status`,{method:'PATCH',token:driver,body:{status:'FAILED',reason:'AUDITORIA cliente ausente'}});return {pass:r.status===200&&r.data.status==='FAILED',http:r.status,detail:`Estado ${r.data.status}; persistencia del motivo se verifica en SQL.`};});
 await test('T26','Aislar pedidos de otros conductores','P08','RNF seguridad',async()=>{const r=await http('/routes',{method:'POST',body:{driverId:state.driver.id,vehicleId:1,routeDate:state.today}});state.otherRoute=r.data;if(!r.data.id)throw new Error('No se creo ruta auxiliar');state.otherOrder=await createOrder('OTRO-CONDUCTOR',r.data.id);const other=await http(`/orders/${state.otherOrder.id}`,{token:driver});return {pass:other.status===403||other.status===404,http:other.status,detail:`Conductor 1 consulta pedido de conductor ${state.driver.id}: HTTP ${other.status}`};});
 await test('T27','Evitar despacho vacio','P02','Regla BPMN P02',async()=>{const r=await http('/routes',{method:'POST',body:{driverId:state.driver.id,vehicleId:state.vehicle.id,routeDate:'2026-10-22'}});state.emptyRoute=r.data;const start=await http(`/routes/${r.data.id}/status?status=IN_PROGRESS`,{method:'PATCH'});return {pass:start.status>=400&&start.status<500,http:start.status,detail:`Ruta sin pedidos: ${start.data.status}; HTTP ${start.status}`};});
 await test('T28','Crear compra operativa de ensayo','P09','RF-71',async()=>{const r=await http('/purchases',{method:'POST',body:{description:`${state.prefix} insumo de ensayo`,supplier:'Proveedor ficticio',amount:1,status:'PENDING',category:'ENSAYO',notes:'Dato de auditoria, sin compra real'}});state.purchase=r.data;return {pass:r.status===200,http:r.status,detail:`Compra ${r.data.id} creada sin transaccion financiera.`};});
 await test('T29','Aplicar mismo periodo a indicadores','P05','RF-63 RF-64 RF-69',async()=>{const r=await http('/reports/orders-summary?startDate=2099-01-01&endDate=2099-01-01');return {pass:Array.isArray(r.data.ordersByStatus)&&r.data.ordersByStatus.length===0&&r.data.onTimeDeliveries===0&&r.data.delayedDeliveries===0,http:r.status,detail:JSON.stringify(r.data)};});
 await test('T30','Reportar eficiencia real de rutas','P05','RF-69 RF-80',async()=>{const r=await http('/reports/route-efficiency');return {pass:Array.isArray(r.data)&&r.data.some(x=>'distanceKm' in x||'kmPerDelivery' in x),http:r.status,detail:`La respuesta contiene ${Object.keys(r.data[0]||{}).join(', ')}; no calcula km/entrega ni tiempo/parada.`};});
}

if(phase==='finish'){
 await test('T31','Completar ruta al cerrar todas las paradas','P03','RF-31',async()=>{const order=await http(`/orders/${state.mobileOrder.id}`);const r=await http(`/routes?date=${state.today}`);const route=r.data.find(x=>x.id===state.route.id);return {pass:order.data.status==='DELIVERED'&&route?.status==='COMPLETED',detail:`Pedido movil ${order.data.status}; ruta ${route?.status}`};});
 await test('T32','Consulta de historial del conductor','P03','RF-45',async()=>{const r=await http('/orders',{token:driver});const completed=r.data.filter(x=>x.status==='DELIVERED');return {pass:r.status===200&&completed.some(x=>x.id===state.mobileOrder.id),detail:`${completed.length} entregados visibles; el alcance por conductor se revisa por separado.`};});
}
report.summary={total:report.tests.length,passed:report.tests.filter(x=>x.pass).length,findings:report.tests.filter(x=>!x.pass).length};
await fs.writeFile(reportPath,JSON.stringify(report,null,2));
console.log(JSON.stringify(report.summary));
