import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const folder=path.join(root,'docs/correccion_integral/evidencias');
await fs.mkdir(folder,{recursive:true});
try {
  const prior=JSON.parse(await fs.readFile(path.join(folder,'regresion_api.json'),'utf8'));
  if(prior.prefix) await fs.copyFile(path.join(folder,'regresion_api.json'),path.join(folder,`regresion_api_${prior.prefix}.json`));
} catch(error) {if(error.code!=='ENOENT')throw error;}
const prefix=`FIX-${Date.now()}`;
const evidence={executedAt:new Date().toISOString(),timezone:'America/Lima',prefix,environment:'local Docker; synthetic test data',humanAcceptance:'PENDING',tests:[]};
const state={prefix};let admin,driver;
async function http(endpoint,{method='GET',body,token=admin}={}) {
  const start=performance.now();
  const response=await fetch(`http://localhost:8081${endpoint}`,{method,headers:{...(token?{Authorization:`Bearer ${token}`} : {}),...(body===undefined?{}:{'Content-Type':typeof body==='string'?'text/plain':'application/json'})},
    body:body===undefined?undefined:typeof body==='string'?body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
  const text=await response.text();let data;try{data=JSON.parse(text);}catch{data=text;}
  return {status:response.status,data,ms:Math.round(performance.now()-start)};
}
async function login(username,password) {
  const response=await fetch('http://localhost:8080/realms/ecoroute/protocol/openid-connect/token',{method:'POST',body:new URLSearchParams({client_id:'mobile-app',grant_type:'password',username,password})});
  assert.equal(response.status,200,`Keycloak login ${username}`);return (await response.json()).access_token;
}
async function test(id,process,name,fn) {
  try {const detail=await fn();evidence.tests.push({id,process,name,result:'PASS',detail});console.log(`${id} PASS ${name}`);}
  catch(error){evidence.tests.push({id,process,name,result:'FAIL',detail:error.message});console.log(`${id} FAIL ${name}: ${error.message}`);}
  await fs.writeFile(path.join(folder,'regresion_api.json'),JSON.stringify(evidence,null,2));
  await fs.writeFile(path.join(folder,'datos_sinteticos.json'),JSON.stringify(state,null,2));
}
function ok(r,status=200){assert.equal(r.status,status,JSON.stringify(r.data).slice(0,500));return r.data;}
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Lima'}).format(new Date());
state.today=today;
const orderBody=suffix=>({trackingNumber:`${prefix}-${suffix}`,recipientName:`Cliente sintético ${suffix}`,recipientPhone:'999123456',deliveryAddress:'Av. Lima 100',deliveryCity:'Lima',deliveryDistrict:null,
  latitude:-12.04,longitude:-77.04,priority:1,estimatedDeliveryWindowEnd:new Date(Date.now()+3600000).toISOString()});
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKma1gAAAABJRU5ErkJggg==';
await test('C01','P08','Autenticación real de administrador',async()=>{admin=await login('admin',process.env.ECOROUTE_ADMIN_PASSWORD||'admin123');return 'JWT no almacenado';});
if(!admin)process.exit(2);
await test('C02','P08','Anónimo no lee pedidos',async()=>{ok(await http('/orders',{token:null}),401);});
await test('C03','P08','Cuenta de ensayo aislada vinculada sin modificar usuarios existentes',async()=>{
  const person=ok(await http('/drivers',{method:'POST',body:{firstName:'Prueba aislada',lastName:prefix,licenseNumber:`Q${String(Date.now()).slice(-8)}`,phoneNumber:'999123456',email:'qa@example.invalid',isActive:true}}));
  const env=await fs.readFile(path.join(root,'.env'),'utf8');
  const secret=env.match(/^KEYCLOAK_ADMIN_CLIENT_SECRET=(.+)$/m)?.[1].trim();assert.ok(secret,'Cliente local de administración requerido');
  const serviceResponse=await fetch('http://localhost:8080/realms/ecoroute/protocol/openid-connect/token',{method:'POST',body:new URLSearchParams({client_id:'ecoroute-operations-service',client_secret:secret,grant_type:'client_credentials'})});
  assert.equal(serviceResponse.status,200);const service=(await serviceResponse.json()).access_token;
  const username=prefix.toLowerCase(),password=createHash('sha256').update(`${prefix}-${Math.random()}-${performance.now()}`).digest('hex');
  const base='http://localhost:8080/admin/realms/ecoroute';
  const created=await fetch(`${base}/users`,{method:'POST',headers:{Authorization:`Bearer ${service}`,'Content-Type':'application/json'},body:JSON.stringify({username,enabled:true,firstName:'Ensayo',lastName:prefix,credentials:[{type:'password',value:password,temporary:false}]})});
  assert.equal(created.status,201,'Alta de identidad sintética');
  const subject=created.headers.get('location')?.split('/').at(-1);assert.ok(subject);state.driverId=person.id;state.driverSubject=subject;state.syntheticIdentity=true;
  ok(await http(`/users/identities/${subject}/roles`,{method:'PUT',body:{roles:['DRIVER'],driverId:person.id}}));
  await new Promise(resolve=>setTimeout(resolve,1200));
  driver=await login(username,password);
  const me=ok(await http('/session/me',{token:driver}));assert.equal(me.driverId,person.id);return {driverId:person.id,subject,existingAccountsChanged:false};
});
await test('C04','P06','Alta de vehículo sintético habilitado',async()=>{
  const suffix=String(Date.now()).slice(-6);const v=ok(await http('/vehicles',{method:'POST',body:{plateNumber:`${suffix.slice(0,3)}-${suffix.slice(3)}`,model:'Ensayo FIX',brand:'Pruebas',capacityKg:500,capacityM3:3,isActive:true}}));state.vehicleId=v.id;return {vehicleId:v.id};
});
await test('C05','P01','Registrar solicitud sin ruta',async()=>{state.order=ok(await http('/orders',{method:'POST',body:orderBody('POD')}));assert.equal(state.order.status,'PENDING');assert.equal(state.order.routeId,null);return {orderId:state.order.id};});
await test('C06','P01','Rechazar creación preasignada a una ruta',async()=>{ok(await http('/orders',{method:'POST',body:{...orderBody('PREASSIGNED'),routeId:1}}),409);});
await test('C07','P02','Crear jornada con recursos activos',async()=>{
  state.route=ok(await http('/routes',{method:'POST',body:{driverId:state.driverId,vehicleId:state.vehicleId,routeDate:today}}));return {routeId:state.route.id};
});
await test('C08','P02','Rechazar reserva duplicada de recursos',async()=>{ok(await http('/routes',{method:'POST',body:{driverId:state.driverId,vehicleId:state.vehicleId,routeDate:today}}),409);});
await test('C09','P01','No asignar antes de confirmar condiciones comerciales',async()=>{ok(await http(`/orders/${state.order.id}/route`,{method:'PATCH',body:{routeId:state.route.id}}),409);});
await test('C10','P01','Confirmar aceptación, cobertura y dirección',async()=>{const c=ok(await http(`/orders/${state.order.id}/business-data`,{method:'PATCH',body:{recipientRuc:'20123456789',customerAccepted:true,addressVerified:true,coverageVerified:true,agreementNote:'Acuerdo sintético para pruebas técnicas, no aceptación empresarial'}}));assert.ok(c.confirmedAt);});
await test('C11','P02','Asignar pedido existente sin duplicarlo',async()=>{const a=ok(await http(`/orders/${state.order.id}/route`,{method:'PATCH',body:{routeId:state.route.id}}));assert.equal(a.id,state.order.id);assert.equal(a.status,'ASSIGNED');});
await test('C12','P02','No despachar sin aprobación y aceptación',async()=>{ok(await http(`/routes/${state.route.id}/status?status=IN_PROGRESS`,{method:'PATCH'}),409);});
await test('C13','P02','Ruta preparada utiliza camino por calles OSRM',async()=>{const p=ok(await http(`/routes/${state.route.id}/path`));assert.ok(p.polyline.length>3);assert.equal(p.source,'osrm');assert.ok(p.orderedOrderIds.includes(state.order.id));return {source:p.source,stops:p.orderedOrderIds,distanceKm:p.distanceKm};});
await test('C14','P02','Jefatura aprueba plan con capacidad suficiente',async()=>{const r=ok(await http(`/routes/${state.route.id}/review`,{method:'POST',body:{capacityVerified:true,windowsVerified:true,vehicleChecked:true,loadWeightKg:25,note:'Ensayo de revisión por jefatura'}}));assert.equal(r.approved,true);assert.equal(r.accepted,false);});
await test('C15','P02','Conductor acepta su hoja de ruta',async()=>{const r=ok(await http(`/routes/${state.route.id}/acceptance`,{method:'POST',token:driver}));assert.equal(r.accepted,true);});
await test('C16','P02','Despacho cambia pedidos a EN TRÁNSITO',async()=>{const r=ok(await http(`/routes/${state.route.id}/status?status=IN_PROGRESS`,{method:'PATCH'}));assert.equal(r.status,'IN_PROGRESS');assert.equal(ok(await http(`/orders/${state.order.id}`)).status,'IN_TRANSIT');});
await test('C17','P03','No permitir entrega por cambio manual de estado',async()=>{ok(await http(`/orders/${state.order.id}/status`,{method:'PATCH',token:driver,body:{status:'DELIVERED',reason:'Intento sin evidencia'}}),409);});
await test('C18','P03','No permitir POD vacío o GPS cero',async()=>{ok(await http('/delivery-proofs',{method:'POST',token:driver,body:{orderId:state.order.id,imageUrl:png,signatureDataUrl:png,receiverName:'Receptor sintético',receiverDni:'12345678',latitude:0,longitude:0}}),400);});
await test('C19','P07','GPS se guarda con vehículo y conductor de la jornada',async()=>{const p=ok(await http('/gps/ping',{method:'POST',token:driver,body:{vehicleId:state.vehicleId,driverId:state.driverId,latitude:-12.041,longitude:-77.041,speedKmh:10,headingDegrees:90}}));assert.equal(p.vehicleId,state.vehicleId);return {gpsId:p.id};});
await test('C20','P08','WebSocket sin credenciales no recibe ubicaciones',async()=>{
  const ws=new WebSocket('ws://localhost:8081/ws/gps');
  const close=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{ws.close();reject(new Error('No cerró conexión anónima'));},7000);ws.onopen=()=>ws.send(String(state.vehicleId));ws.onmessage=()=>{clearTimeout(timer);reject(new Error('Se filtró GPS a conexión anónima'));};ws.onclose=e=>{clearTimeout(timer);resolve(e.code);};ws.onerror=()=>{};});
  assert.equal(close,1008);return {closeCode:close};
});
await test('C21','P07','WebSocket autenticado recibe GPS desde Redis',async()=>{
  const ws=new WebSocket('ws://localhost:8081/ws/gps');
  try {
    await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=()=>reject(new Error('WebSocket open failed'));});
    ws.send(JSON.stringify({vehicleId:state.vehicleId,accessToken:driver}));
    await new Promise(resolve=>setTimeout(resolve,350));
    const message=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('No recibió GPS autenticado')),5000);ws.onmessage=e=>{clearTimeout(timer);resolve(JSON.parse(e.data));};});
    message.catch(()=>{}); // Keep a failed ping from leaving an unhandled timer rejection.
    ok(await http('/gps/ping',{method:'POST',token:driver,body:{vehicleId:state.vehicleId,driverId:state.driverId,latitude:-12.042,longitude:-77.042,speedKmh:11,headingDegrees:100}}));
    const received=await message;assert.equal(received.vehicleId,state.vehicleId);return {vehicleId:received.vehicleId};
  } finally {ws.close();}
});
await test('C22','P03','POD completo guarda evidencia, receptor y GPS',async()=>{
  state.podRequest={orderId:state.order.id,imageUrl:png,signatureDataUrl:png,receiverName:'Receptor sintético',receiverDni:'12345678',verifiedAt:new Date().toISOString(),latitude:-12.042,longitude:-77.042};
  state.proof=ok(await http('/delivery-proofs',{method:'POST',token:driver,body:state.podRequest}));assert.ok(state.proof.id);assert.equal(state.proof.latitude,-12.042);return {proofId:state.proof.id};
});
await test('C23','P03','Reenvío de POD es idempotente',async()=>{const p=ok(await http('/delivery-proofs',{method:'POST',token:driver,body:state.podRequest}));assert.equal(p.id,state.proof.id);});
await test('C24','P03','Recuperar foto y firma privadas',async()=>{
  const details=[];for(const asset of ['photo','signature']){const r=await fetch(`http://localhost:8081/delivery-proofs/${state.order.id}/${asset}`,{headers:{Authorization:`Bearer ${driver}`}});assert.equal(r.status,200);const bytes=new Uint8Array(await r.arrayBuffer());assert.ok(bytes.length>30);details.push({asset,bytes:bytes.length,mime:r.headers.get('content-type')});}return details;
});
await test('C25','P03','PDF contiene comprobante y archivos',async()=>{const r=await fetch(`http://localhost:8081/delivery-proofs/${state.order.id}/pdf`,{headers:{Authorization:`Bearer ${admin}`}});assert.equal(r.status,200);const bytes=new Uint8Array(await r.arrayBuffer());assert.equal(new TextDecoder().decode(bytes.slice(0,4)),'%PDF');await fs.writeFile(path.join(folder,'comprobante_corregido.pdf'),bytes);return {bytes:bytes.length};});
await test('C26','P03','Cierre uniforme de la jornada',async()=>{const r=ok(await http('/routes'));assert.equal(r.find(x=>x.id===state.route.id).status,'COMPLETED');ok(await http(`/orders/${state.order.id}/status`,{method:'PATCH',body:{status:'PENDING',reason:'No reabrir histórico'}}),409);});
await test('C27','P05','Cinco indicadores usan filtros coherentes',async()=>{const bi=ok(await http(`/reports/bi?driverId=${state.driverId}&startDate=${today}&endDate=${today}`));assert.equal(bi.kpis.length,5);assert.ok(bi.byDistrict.some(d=>d.name==='Sin distrito'));assert.equal(bi.timezone,'America/Lima');return {kpis:bi.kpis,quality:bi.quality};});
await test('C28','P05','Conductor no accede a BI o notificaciones compartidas',async()=>{ok(await http('/reports/bi',{token:driver}),403);ok(await http('/notifications',{token:driver}),403);});
await test('C29','P01','CSV malformado rechaza todo con fila del error',async()=>{
  const csv=`trackingNumber,recipientName,deliveryAddress,latitude,longitude,externalReference,routeId,recipientPhone,recipientEmail,deliveryCity,deliveryDistrict\n${prefix}-CSV,Cliente,Lima,-12,-77,,,999123456,,,\nmalformada\n`;
  const r=await http('/orders/bulk-csv',{method:'POST',body:csv});ok(r,400);assert.match(r.data.message,/Fila 3/);
  assert.equal(ok(await http('/orders')).filter(o=>o.trackingNumber===`${prefix}-CSV`).length,0);
});
await test('C30','P05','Crear acción de mejora con responsable y meta',async()=>{state.action=ok(await http('/improvement-actions',{method:'POST',body:{title:'Reducir demoras de reparto',cause:'Asignación tardía de la jornada',ownerName:'Jefatura sintética',dueDate:today,metricCode:'ONTIME',baselineValue:60,targetValue:90}}));assert.equal(state.action.status,'OPEN');return {actionId:state.action.id};});
await test('C31','P05','Verificación no salta ejecución de la mejora',async()=>{ok(await http(`/improvement-actions/${state.action.id}`,{method:'PATCH',body:{status:'VERIFIED',resultValue:92,note:'No se ejecutó todavía'}}),409);});
await test('C32','P05','Ejecutar y verificar acción con medición',async()=>{ok(await http(`/improvement-actions/${state.action.id}`,{method:'PATCH',body:{status:'IN_PROGRESS',note:'Ajuste de planificación en ensayo'}}));const a=ok(await http(`/improvement-actions/${state.action.id}`,{method:'PATCH',body:{status:'VERIFIED',resultValue:92,note:'Resultado sintético para probar el flujo, no mejora real acreditada'}}));assert.equal(a.status,'VERIFIED');assert.ok(a.verifiedBy);});
await test('C33','P08','Conductor no consulta pedido ajeno no asignado',async()=>{const p=ok(await http('/orders',{method:'POST',body:orderBody('AJENO')}));state.unassignedId=p.id;ok(await http(`/orders/${p.id}`,{token:driver}),403);});
await test('C34','P05','Notificación generada una sola vez',async()=>{
  let found=[];for(let i=0;i<12;i++){found=ok(await http('/notifications')).filter(n=>n.type==='DELIVERY_CONFIRMED'&&n.orderId===state.order.id);if(found.length)break;await new Promise(resolve=>setTimeout(resolve,1000));}
  assert.equal(found.length,1);return {notificationId:found[0].id};
});
await test('C35','P04','Preparar jornada de ensayo de excepciones',async()=>{
  state.exceptionRoute=ok(await http('/routes',{method:'POST',body:{driverId:state.driverId,vehicleId:state.vehicleId,routeDate:today}}));
  state.exceptionOrders=[];
  for(const suffix of ['RETRY','REPLAN','RETURN']) {
    const o=ok(await http('/orders',{method:'POST',body:orderBody(suffix)}));state.exceptionOrders.push(o);
    ok(await http(`/orders/${o.id}/business-data`,{method:'PATCH',body:{recipientRuc:'20123456789',customerAccepted:true,addressVerified:true,coverageVerified:true,agreementNote:'Ensayo autorizado de excepciones'}}));
    ok(await http(`/orders/${o.id}/route`,{method:'PATCH',body:{routeId:state.exceptionRoute.id}}));
  }
  ok(await http(`/routes/${state.exceptionRoute.id}/review`,{method:'POST',body:{capacityVerified:true,windowsVerified:true,vehicleChecked:true,loadWeightKg:25,note:'Jornada sintética de incidencias'}}));
  ok(await http(`/routes/${state.exceptionRoute.id}/acceptance`,{method:'POST',token:driver}));
  ok(await http(`/routes/${state.exceptionRoute.id}/status?status=IN_PROGRESS`,{method:'PATCH'}));
  return {routeId:state.exceptionRoute.id,orderIds:state.exceptionOrders.map(o=>o.id)};
});
await test('C36','P04','Fallo sin motivo no cambia el pedido',async()=>{ok(await http(`/orders/${state.exceptionOrders[0].id}/status`,{method:'PATCH',token:driver,body:{status:'FAILED',reason:''}}),400);});
await test('C37','P04','Fallo genera incidencia e historial',async()=>{
  const id=state.exceptionOrders[0].id;
  ok(await http(`/orders/${id}/status`,{method:'PATCH',token:driver,body:{status:'FAILED',reason:'Cliente ausente durante el primer intento'}}));
  state.retryIncident=ok(await http('/incidents')).find(i=>i.orderId===id&&i.status==='OPEN');assert.ok(state.retryIncident);return {incidentId:state.retryIncident.id};
});
await test('C38','P04','Reintento crea otro pedido sin reabrir el anterior',async()=>{
  const r=ok(await http(`/incidents/${state.retryIncident.id}/resolution`,{method:'PATCH',body:{outcome:'RETRY',reason:'Cliente confirma disponibilidad dentro de la misma jornada'}}));
  assert.ok(r.retryOrderId);assert.notEqual(r.retryOrderId,state.exceptionOrders[0].id);state.retryOrderId=r.retryOrderId;
  assert.equal(ok(await http(`/orders/${state.exceptionOrders[0].id}`)).status,'FAILED');
  assert.equal(ok(await http(`/orders/${r.retryOrderId}`)).status,'IN_TRANSIT');return {retryOrderId:r.retryOrderId};
});
await test('C39','P04','Resolución repetida no duplica reintentos',async()=>{const r=ok(await http(`/incidents/${state.retryIncident.id}/resolution`,{method:'PATCH',body:{outcome:'RETRY',reason:'Reenvío de la misma decisión'}}));assert.equal(r.retryOrderId,state.retryOrderId);});
await test('C40','P04','Reprogramar conserva original y exige nuevo acuerdo comercial',async()=>{
  const id=state.exceptionOrders[1].id;
  ok(await http(`/orders/${id}/status`,{method:'PATCH',token:driver,body:{status:'FAILED',reason:'Cliente solicita otra fecha de entrega'}}));
  const incident=ok(await http('/incidents')).find(i=>i.orderId===id&&i.status==='OPEN');
  const existing=ok(await http('/routes'));let days=1,date;
  do {date=new Date(`${today}T12:00:00Z`);date.setUTCDate(date.getUTCDate()+days++);date=date.toISOString().slice(0,10);}
  while(existing.some(r=>r.driverId===state.driverId&&r.routeDate===date&&['PLANNED','IN_PROGRESS'].includes(r.status)));
  state.replanRoute=ok(await http('/routes',{method:'POST',body:{driverId:state.driverId,vehicleId:state.vehicleId,routeDate:date}}));
  const resolved=ok(await http(`/incidents/${incident.id}/resolution`,{method:'PATCH',body:{outcome:'REPLAN',reason:'Nueva jornada solicitada por el cliente',nextRouteId:state.replanRoute.id}}));
  assert.ok(resolved.retryOrderId);state.replanOrderId=resolved.retryOrderId;
  assert.equal(ok(await http(`/orders/${id}`)).status,'FAILED');
  const next=ok(await http(`/orders/${resolved.retryOrderId}`));assert.equal(next.status,'ASSIGNED');assert.equal(next.routeId,state.replanRoute.id);
  const confirmation=ok(await http(`/orders/${resolved.retryOrderId}/business-data`));assert.equal(confirmation.customerAccepted,false);
  ok(await http(`/routes/${state.replanRoute.id}/review`,{method:'POST',body:{capacityVerified:true,windowsVerified:true,vehicleChecked:true,loadWeightKg:10,note:'No se puede aprobar sin nuevo acuerdo'}}),409);
  return {newOrderId:resolved.retryOrderId,newRouteId:state.replanRoute.id};
});
await test('C41','P03 P04','FAILED y RETURNED cierran jornada de manera uniforme',async()=>{
  ok(await http(`/orders/${state.retryOrderId}/status`,{method:'PATCH',token:driver,body:{status:'FAILED',reason:'Segundo intento fallido requiere cierre definitivo'}}));
  ok(await http(`/orders/${state.exceptionOrders[2].id}/status`,{method:'PATCH',token:driver,body:{status:'RETURNED',reason:'Destinatario rechaza el paquete; retornar a origen'}}));
  const route=ok(await http('/routes')).find(r=>r.id===state.exceptionRoute.id);assert.equal(route.status,'COMPLETED');
});
await test('C42','P04','Jefatura cierra incidencia sin alterar resultado original',async()=>{
  const incident=ok(await http('/incidents')).find(i=>i.orderId===state.retryOrderId&&i.status==='OPEN');
  const resolved=ok(await http(`/incidents/${incident.id}/resolution`,{method:'PATCH',body:{outcome:'CLOSE_FAILED',reason:'Ensayo de cierre autorizado por jefatura'}}));assert.equal(resolved.status,'RESOLVED');
  assert.equal(ok(await http(`/orders/${state.retryOrderId}`)).status,'FAILED');
});
await test('C43','P08','Ocultar todas las rutas y pedidos ajenos al conductor',async()=>{
  const other=ok(await http('/drivers',{method:'POST',body:{firstName:'Prueba',lastName:'Aislamiento',licenseNumber:`Q${String(Date.now()).slice(-8)}`,phoneNumber:'999123456',isActive:true}}));
  const otherVehicle=ok(await http('/vehicles',{method:'POST',body:{plateNumber:`ZX${String(Date.now()).slice(-1)}-${String(Date.now()).slice(-3)}`,model:'Ensayo',brand:'Prueba',capacityKg:100,capacityM3:1,isActive:true}}));
  const otherRoute=ok(await http('/routes',{method:'POST',body:{driverId:other.id,vehicleId:otherVehicle.id,routeDate:today}}));state.otherRouteId=otherRoute.id;
  const otherOrder=ok(await http('/orders',{method:'POST',body:orderBody('OTRO')}));
  ok(await http(`/orders/${otherOrder.id}/business-data`,{method:'PATCH',body:{customerAccepted:true,addressVerified:true,coverageVerified:true,agreementNote:'Ensayo de aislamiento entre conductores'}}));
  ok(await http(`/orders/${otherOrder.id}/route`,{method:'PATCH',body:{routeId:otherRoute.id}}));
  ok(await http(`/orders/${otherOrder.id}`,{token:driver}),403);ok(await http(`/routes/${otherRoute.id}/path`,{token:driver}),403);
  const ownRoutes=ok(await http('/routes',{token:driver}));assert.ok(ownRoutes.every(r=>r.driverId===state.driverId));
  const ownOrders=ok(await http('/orders',{token:driver}));assert.ok(!ownOrders.some(o=>o.id===otherOrder.id));
  ok(await http('/gps/ping',{method:'POST',token:driver,body:{vehicleId:otherVehicle.id,driverId:other.id,latitude:-12,longitude:-77,speedKmh:0,headingDegrees:0}}),403);
});
await test('C44','P01','CSV con comas entrecomilladas importa teléfono y dirección',async()=>{
  const csv=`trackingNumber,recipientName,deliveryAddress,latitude,longitude,externalReference,routeId,recipientPhone,recipientEmail,deliveryCity,deliveryDistrict\r\n${prefix}-CSVOK,Cliente,"Av. Lima, local A",-12,-77,,,999123456,,,\r\n`;
  const imported=ok(await http('/orders/bulk-csv',{method:'POST',body:csv}));assert.equal(imported.length,1);assert.equal(imported[0].deliveryAddress,'Av. Lima, local A');assert.equal(imported[0].routeId,null);
});
await test('C45','P05','Filtros inválidos no producen analítica ambigua',async()=>{ok(await http('/reports/bi?startDate=2026-10-20&endDate=2026-10-01'),400);ok(await http('/reports/bi?driverId=-1'),400);});
await test('C46','P01 P04','Nueva ventana revoca aceptación previa y exige nuevo acuerdo',async()=>{
  const id=state.replanOrderId;
  ok(await http(`/orders/${id}/business-data`,{method:'PATCH',body:{recipientRuc:'20123456789',customerAccepted:true,addressVerified:true,coverageVerified:true,agreementNote:'Primera aceptación de reprogramación sintética'}}));
  const start=`${state.replanRoute.routeDate}T09:00:00-05:00`,end=`${state.replanRoute.routeDate}T12:00:00-05:00`;
  const saved=ok(await http(`/orders/${id}/delivery-window`,{method:'PATCH',body:{estimatedDeliveryWindowStart:start,estimatedDeliveryWindowEnd:end,reason:'Cliente solicita cambio de horario de reprogramación'}}));
  assert.equal(new Date(saved.estimatedDeliveryWindowEnd).toISOString(),new Date(end).toISOString());
  const business=ok(await http(`/orders/${id}/business-data`));assert.equal(business.customerAccepted,false);assert.equal(business.addressVerified,true);assert.equal(business.confirmedAt,null);
  ok(await http(`/routes/${state.replanRoute.id}/review`,{method:'POST',body:{capacityVerified:true,windowsVerified:true,vehicleChecked:true,loadWeightKg:10,note:'Debe bloquear hasta nueva aceptación'}}),409);
});
await test('C47','P01 P03','No cambiar ventana después del despacho o cierre',async()=>{ok(await http(`/orders/${state.order.id}/delivery-window`,{method:'PATCH',body:{estimatedDeliveryWindowStart:new Date(Date.now()+3600000).toISOString(),estimatedDeliveryWindowEnd:new Date(Date.now()+7200000).toISOString(),reason:'Intento de alterar la promesa histórica'}}),409);});
await test('C48','P03','Evidencias mantienen bytes tras reiniciar emulador S3',async()=>{
  const assets=[];
  const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
  for(const asset of ['photo','signature']) {
    const r=await fetch(`http://localhost:8081/delivery-proofs/${state.order.id}/${asset}`,{headers:{Authorization:`Bearer ${admin}`}});assert.equal(r.status,200);
    assets.push({asset,before:sha(Buffer.from(await r.arrayBuffer()))});
  }
  execFileSync('docker',['restart','ecoroute-localstack'],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
  for(const item of assets) {
    const r=await fetch(`http://localhost:8081/delivery-proofs/${state.order.id}/${item.asset}`,{headers:{Authorization:`Bearer ${admin}`}});assert.equal(r.status,200);
    item.after=sha(Buffer.from(await r.arrayBuffer()));assert.equal(item.after,item.before);
  }
  return {storage:'Original bytes backed up in PostgreSQL for local development; no S3 emulator durability assumed',assets};
});
if(state.syntheticIdentity)await test('C49','P08','Deshabilitar identidad efímera de pruebas al terminar',async()=>{
  ok(await http(`/users/identities/${state.driverSubject}/enabled`,{method:'PUT',body:{enabled:false}}));
  ok(await http('/session/me',{token:driver}),401);return {existingAccountsChanged:false,syntheticIdentityDisabled:true};
});
evidence.summary={total:evidence.tests.length,passed:evidence.tests.filter(t=>t.result==='PASS').length,failed:evidence.tests.filter(t=>t.result==='FAIL').length};
await fs.writeFile(path.join(folder,'regresion_api.json'),JSON.stringify(evidence,null,2));
console.log(JSON.stringify(evidence.summary));if(evidence.summary.failed)process.exitCode=1;
