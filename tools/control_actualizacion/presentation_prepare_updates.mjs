import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const output = path.join(root, 'docs/control_actualizacion/presentacion');
const baseline = path.join(output, '_qa/baseline');
const slides = (await fs.readFile(path.join(baseline, 'content.ndjson'), 'utf8')).trim().split('\n').map(JSON.parse);
const inventory = JSON.parse(await fs.readFile(path.join(baseline, 'source_ooxml.json'), 'utf8'));
const source = 'docs/correccion_integral/EcoRoute_Arquitectura_y_Flujos_Verificados.pptx';
const hash = async file => createHash('sha256').update(await fs.readFile(path.join(root, file))).digest('hex');
if (slides.length !== 35 || await hash(source) !== inventory.sha256) throw new Error('Baseline changed; inspect again before preparing updates');
const actions = [];
const notes = [];
function replace(slide, oldText, newText, reason, sources = []) {
  const matches = slides[slide - 1].elements.filter(e => e.text === oldText && e.kind === 'textbox');
  if (matches.length !== 1) throw new Error(`Slide ${slide}: expected one exact textbox: ${oldText}`);
  const element = matches[0];
  actions.push({ type: 'text', slide, slideId: slides[slide - 1].id, id: element.id,
    oldText, newText, position: element.position, style: element.style, reason, sources });
}
function footer(slide, value, reason, sources) {
  const element = slides[slide - 1].elements.find(e => e.name === 'source-caption');
  replace(slide, element.text, value, reason, sources);
}
function table(slide, row, column, oldText, newText, sources) {
  const matches = slides[slide - 1].elements.filter(e => e.kind === 'table');
  if (matches.length !== 1) throw new Error(`Slide ${slide}: ambiguous table`);
  actions.push({ type: 'table', slide, slideId: slides[slide - 1].id, id: matches[0].id,
    row, column, oldText, newText, sources, reason: 'Actualizar resultado localizado sin sumar ejecuciones ni alterar tabla' });
}
function note(slide, text, sources) {
  notes.push({ slide, slideId: slides[slide - 1].id,
    oldText: slides[slide - 1].notes.text, append: text, sources });
}

const session = 'docs/control_integral_20261022/e2e_cierre/session_diagnosis.md';
const native = 'docs/control_integral_20261022/e2e_cierre/native_session_navigation.json';
const mobileQuality = 'docs/control_integral_20261022/e2e_cierre/calidad_mobile_final.json';
const quality = 'docs/control_integral_20261022/calidad_actual.json';
const route20 = 'docs/control_integral_20261022/e2e_cierre/server_final.json';
const video = 'docs/videos/ecoroute_e2e_20261022';
const route21 = `${video}/server_final.json`;
const offline21 = `${video}/server_offline.json`;
const report = `${video}/EcoRoute_Demostracion_End_to_End.mp4.report.json`;
const review = `${video}/REVISION_VISUAL.md`;
const powerbi = 'docs/control_actualizacion/POWER_BI_LOCAL.md';
const sync = 'mobile-app/lib/core/sync/proof_sync.dart';
const auth = 'mobile-app/lib/core/network/auth_interceptor.dart';

replace(1, 'Arquitectura y flujos\nverificados', 'Arquitectura y flujos\nactualizados', 'Nueva edición sin sobrescribir la referencia');
replace(1, 'Revisión del 20 de octubre de 2026\nDesarrollo implementado. Aceptación empresarial pendiente.',
  'Actualización del 22 de octubre de 2026\nPruebas locales. Aceptación empresarial pendiente.', 'Actualizar fecha y alcance de la revisión', [route20, route21]);
replace(2, '49/49', '26/26', 'Destacar la verificación más reciente, conservando regresión histórica en notas', [route21]);
replace(2, 'casos API locales PASS', 'controles servidor, ruta 21', '26 controles por observación, no 26 escenarios empresariales', [route21]);
replace(2, '25/25', '7 clips', 'Mostrar el video nuevo de web y app', [report]);
replace(2, 'casos web PASS, 69 capturas', 'video real de web y app', 'No presentar las 69 capturas antiguas como nueva ejecución', [report]);
footer(2, 'E2E del 22/10: rutas 20 y 21. Regresión anterior conservada en notas.', 'Distinguir evidencia actual e histórica', [route20, route21]);
note(2, 'Actualización 22/10: ruta 20, pedidos 44/45, y ruta 21, pedidos 46/47. Cada reporte final de servidor acredita 26 PASS y cero FAIL. Son observaciones de casos sintéticos, no una suma de 52 escenarios de UAT. El video de ruta 21 contiene siete clips PASS. Los 49 casos API y 25 casos web/69 capturas de la revisión del 20/10 se conservan como ejecuciones históricas.', [route20, route21, report]);

replace(16, 'PostgreSQL guarda negocio. El enlace de identidad es lógico y no crea una FK entre bases.',
  'Móvil: un 401 renueva y reintenta. Un error de negocio tras renovar conserva la sesión.',
  'Incluir el defecto refresh/replay corregido, conservando separación de bases en notas', [session, auth]);
footer(16, 'AuthInterceptor y SessionRefresh. Diagnóstico de sesión del 22/10.', 'Añadir fuente del ajuste de autenticación', [session, auth]);
note(16, 'El enlace PostgreSQL/Keycloak sigue siendo lógico, sin FK entre bases. El defecto reproducido era: API 401, refresh exitoso y replay 400 causaban falso logout. El catch del replay ahora propaga 400/403/409/422/500 con su estado sin expirar la sesión. Un nuevo 401 conserva el manejo de sesión. Los rechazos 400/401 del endpoint de refresh siguen provocando cierre. El diagnóstico acredita 34 pruebas de auth/router y 6 de firma con transporte/captura simulados, incluidas en 81 host posteriores, no adicionales. La navegación nativa registra tres ciclos estables. Estos resultados no acreditan el mapa nativo de la build 4005.', [session, auth, native, mobileQuality]);

replace(19, 'Secuencia real del emulador. Pedido 27: IN_TRANSIT offline y DELIVERED tras reconectar.',
  'Capturas de referencia: pedido 27. Revalidación del 22/10: pedidos 44 y 46.',
  'Evitar presentar las capturas previas como si pertenecieran al fixture nuevo', [route20, route21, offline21]);
replace(19, 'Sincroniza con proceso activo o al reanudar. El sistema operativo puede detener la app.',
  'Reintenta con la app activa, al reanudar o recuperar cuenta. El SO puede detener el proceso.',
  'Precisar el alcance activo de ProofSync y la cuenta propietaria', [sync]);
footer(19, 'ProofSync y LocalCache. Referencia visual previa y E2E del 22/10.', 'Conservar procedencia de las capturas', [sync, route20, route21]);
note(19, 'Las cuatro imágenes conservadas muestran el pedido 27 de la prueba previa, no los pedidos nuevos. El 22/10 se revalidó el mismo mecanismo con 44 y 46. En ruta 21, offline: servidor IN_TRANSIT y sin POD; después del reintento: pedido 46 DELIVERED, un POD con foto/firma recuperables. LocalCache escribe bytes y metadatos por cuenta antes de HTTP. ProofSync reintenta periódicamente cada 30 s mientras el proceso ejecuta, al reanudar o recuperar cuenta. No promete servicio en background ni sincronización con la app terminada. Rechazos requieren reintento explícito según su clasificación.', [sync, route20, route21, offline21, `${video}/mobile_delivery_1792698885550.json`, `${video}/mobile_sync_failure_1792699082250.json`]);

replace(21, 'El mapa muestra muestra y tiempo.\nPérdida de señal exige contacto humano.\nUn punto aislado no confirma entrega\nni justifica por sí solo una sanción.',
  'Reconexión gris reproducida en 4004.\nCaché y reintento implementados.\nTres pruebas PASS, según principal.\nValidación nativa 4005 pendiente.',
  'Estado provisional comunicado por el principal; pendiente cierre documental de mapa/GPS', []);
replace(21, 'Distancia real: Haversine de muestras suficientes dentro del intervalo efectivo de la ruta.',
  'GPS simulado. Caché de teselas visibles hasta 7 días. Sin mapa offline de ciudad ni SLA de OSM.',
  'Retirar la lectura de distancia simulada como rendimiento de campo', [review]);
note(21, 'Estado comunicado por el principal durante esta actualización: en build 4004 OSM carga online al arrancar y queda gris después de reabrir offline y reconectar. Se implementaron caché HTTP solo de teselas visibles por 7 días respetando headers, banner de fallo con Reintentar, recreación solo de TileLayer, retry al reanudar y atribución siempre visible. El principal comunicó tres tests PASS. La suite completa estaba en curso y build 4005/validación nativa pendientes. No se afirma PASS nativo ni navegación real. Las capturas mapa_autenticado.png y mapa_reconexion_antes.png pertenecen al estado anterior, no prueban la corrección. Esta nota debe conciliarse con la evidencia final del mapa y del backend GPS antes de publicar.', ['docs/control_actualizacion/evidencias/mobile/mapa_autenticado.png', 'docs/control_actualizacion/evidencias/mobile/mapa_reconexion_antes.png']);

replace(25, 'Poblaciones del KPI', 'Indicadores del 22/10', 'Mostrar valores actuales del fixture diario', [route21]);
replace(25, 'IID usa todos los pedidos.\nCHR y TDE usan programados.\nSUCCESS usa todos los pedidos.\nONTIME usa entregas evaluables.',
  'IID 4/4: 100%\nCHR y TDE 2/4: 50%\nSUCCESS 2/4: 50%\nONTIME 2/2: 100%', 'Los cinco códigos vigentes, con numeradores y denominadores verificados', [route21]);
replace(25, 'Captura del backend local. Datos de prueba y registros del entorno, sin inferencia de mejora empresarial.',
  '22/10, conductor 1: pedidos 44/45 y 46/47. Datos sintéticos, sin UAT empresarial.',
  'Explicitar la población acumulada del día', [route20, route21]);
footer(25, 'Captura del video ruta 21 y server_final.json. Metas sin configurar.', 'Trazar las cifras actuales a evidencia SQL/API', [route21, `${video}/24_indicadores_final.png`]);
const image25 = slides[24].elements.find(e => e.kind === 'image');
actions.push({ type: 'image', slide: 25, slideId: slides[24].id, id: image25.id,
  source: `${video}/24_indicadores_final.png`, fit: 'contain',
  crop: { left: 0.18, top: 0.44, right: 0.02, bottom: 0 },
  alt: 'Captura real del 22/10: cinco KPI de conductor 1, incluyendo ensayos de rutas 20 y 21',
  reason: 'Sustituir los porcentajes visuales del 20/10 por captura real de la población diaria actual', sources: [route21] });
note(25, 'La población diaria filtrada usa conductor 1, fecha 2026-10-22 y America/Lima: cuatro pedidos, dos DELIVERED y dos FAILED. Incluye el ensayo ruta 20 (44/45) y el video ruta 21 (46/47). El caso nuevo del video solo contiene dos pedidos. SQL BI and dashboard driver/date se contrasta con GET reports/bi y cada KPI con analytics_order_facts. IID 4/4=100%, CHR 2/4=50%, TDE 2/4=50%, SUCCESS 2/4=50%, ONTIME 2/2=100%. Metas null y NO_TARGET. Las poblaciones permanecen: IID/SUCCESS todos, CHR/TDE programados, ONTIME entregas evaluables. TDE exige foto o firma, POD completo exige ambos y metadatos.', [route21, route20]);
for (const n of [26, 27, 28, 29]) {
  footer(n, 'Captura histórica del 20/10. Contraste actualizado: video ruta 21 y SQL/API del 22/10.',
    'La imagen anterior queda identificada, sin atribuirle cifras actuales', [route21]);
}
replace(28, 'V15: 60 min / 3 terminales = 20 min/parada en prueba aislada. Captura anterior a V15.',
  'GPS simulado y pruebas previas. Ruta 20 con miles de km. Revisión de calidad GPS pendiente.',
  'No presentar valores de simulación como eficiencia real de MICOTRANS', [review]);
note(28, 'El video conserva el estado observado antes del ajuste GPS en curso. El principal documentó movimientos simulados y distancia de miles de kilómetros en ruta 20. No representan desempeño de MICOTRANS. La muestra visual es histórica y no acredita la fórmula ni el filtro GPS posterior. El cambio backend y su resultado actual quedan pendientes de evidencia en docs/control_actualizacion. Mantener las distinciones entre distancia planificada, distancia GPS válida y ausencia de dato. Min/parada terminal es duración operativa dividida entre DELIVERED/FAILED/RETURNED, no tiempo de atención domiciliaria.', [review, route21]);
note(26, 'La imagen conserva la ejecución anterior del 20/10. En el caso diario verificado del 22/10 los cinco KPI son 100/50/50/50/100, y las metas siguen null. La serie usa la meta vigente y no certifica mejora temporal ni causalidad.', [route21]);
note(27, 'La imagen conserva la ejecución anterior del 20/10. La evidencia del 22/10 incluye incidente 13 de pedido 47, RESOLVED con CLOSE_FAILED. STATUS_HISTORY e INCIDENT cuentan eventos distintos, que pueden corresponder al mismo pedido. No sumar eventos como pedidos únicos ni afirmar causa empresarial demostrada.', [route21]);
note(29, 'La imagen conserva la ejecución anterior del 20/10. El reporte final del video tiene completePodOrders=2 para cuatro pedidos diarios, e incluye un POD nuevo del pedido 46 recuperado con foto/firma y hashes verificados. La disponibilidad se verificó por lectura autorizada en este caso, no por el contador de metadatos. No prueba durabilidad comercial general.', [route21]);

table(32, 4, 1, 'P03. ProofSync, pendientes/rechazos\ny reintento de /delivery-proofs.',
  'P03. Cola privada y reintento activo.\n/delivery-proofs, con sesión propia.', [sync]);
note(32, 'La foto de referencia conserva el fixture anterior. Para el 22/10, los reportes del video acreditan captura de foto/firma del pedido 46, cola privada y reintento. El interceptor renovado conserva los errores de negocio del replay. La selección de mapa, caché/reconexión y calidad GPS tienen un cierre independiente pendiente.', [route21, session, sync]);

replace(33, '13 / 13 PASS', '13/13 previo', 'Conservar la prueba válida anterior sin presentarla como ejecución nueva');
replace(33, 'Un POD, GPS conservado y hashes de foto/firma coincidentes.\nPrueba técnica en emulador, sin reparto empresarial real.',
  '22/10: rutas 20 y 21, servidor 26/26 por caso.\nPruebas sintéticas, sin reparto empresarial real.', 'Añadir el cierre actual sin falsear las capturas históricas', [route20, route21]);
footer(33, 'Imágenes previas: pedido 27, ruta 11. Nuevos E2E: rutas 20 y 21, pedidos 44–47.',
  'Distinguir el caso anterior y los nuevos', [route20, route21]);
note(33, 'Las imágenes de historial y perfil continúan perteneciendo al ensayo anterior, pedido 27/ruta 11 y 13 comprobaciones. La revalidación del 22/10 usa ruta 20/pedidos 44 y 45 y ruta 21/pedidos 46 y 47. Ambos reportes finales de servidor son PASS 26/26 por caso, sin sumarlos ni afirmar que las imágenes antiguas muestran los pedidos nuevos. El video de ruta 21 contiene siete clips y su revisión visual informa 41 muestras más seis keyframes, sin UAT.', [route20, route21, report, review]);

table(34, 1, 0, 'Regresión API', 'API y E2E', [route20, route21]);
table(34, 1, 1, '49 PASS / 49 casos', '49/49 previo. Rutas 20 y 21:\n26/26 por caso.', [route20, route21]);
table(34, 1, 2, 'Datos y recursos sintéticos aislados', 'Observaciones por etapa.\nDatos sintéticos, sin UAT.', [route20, route21]);
table(34, 2, 0, 'Java con V15', 'Java, ejecución del 22/10', [quality]);
table(34, 3, 1, 'TypeScript y ESLint exit 0.\n30 pruebas PASS', 'TypeScript y ESLint exit 0.\n32 pruebas PASS.', [quality]);
table(34, 4, 0, 'Web con backend real', 'Video de web y app', [report]);
table(34, 4, 1, '25 PASS / 25 casos, 69 capturas', '7 clips PASS, duración 5:20.\nRuta 21, pedidos 46 y 47.', [report, route21]);
table(34, 4, 2, 'Recorrido del manifiesto.\nNo es un piloto empresarial.', 'El panel diario incluye\nel ensayo previo, ruta 20.', [route20, route21]);
table(34, 5, 1, '41 host PASS + 8 contrato PASS.\nEmulador: 13 PASS / 13 casos.', '81 host PASS + 8 contrato PASS.\nTres ciclos nativos estables.', [mobileQuality, native]);
table(34, 5, 2, 'POD real, reinicio y reconexión.\nSincroniza con proceso activo.', 'Cola con proceso activo.\nMapa nativo 4005 pendiente.', [sync]);
footer(34, 'Calidad del 22/10, diagnóstico de sesión y reportes E2E. Conteos por ejecución.',
  'Mantener trazabilidad sin sumar skipped ni doblar pruebas', [quality, mobileQuality, route20, route21]);
note(34, 'Los 81 host incluyen las 40 pruebas nuevas del diagnóstico y las 41 existentes. Ocho opt-in omitidas en host se ejecutaron en una orden de contrato separada: ocho PASS, no dieciséis. Calidad del 22/10 acredita 58 Java sin fallos ni errores y 32 web, con TypeScript y ESLint exit 0. Las 25 web/69 capturas del 20/10 son histórico y no se suman a los siete clips. Cada snapshot de servidor final es 26/26 para su fixture, no 26 escenarios de negocio nuevos. Las tres pruebas de mapa comunicadas por el principal no se suman al total host congelado: suite completa y validación nativa 4005 pendientes.', [quality, mobileQuality, session, route20, route21, native]);

replace(35, 'Probar en dispositivos y red de campo.\nConfirmar POD tras reinicio y reenvío.\nUsar almacenamiento durable en producción.\nValidar conexión y refresco de Power BI.',
  'Validar mapa 4005 y GPS en campo.\nUsar almacenamiento durable en producción.\nSQL lector y consultas M preparados.\nPower BI Desktop sin conexión verificada.',
  'Distinguir preparación SQL/M, Desktop no acreditado y validación nativa pendiente', [powerbi]);
footer(35, 'Plan UAT pendiente, evidencia técnica del 22/10 y POWER_BI_LOCAL.md.', 'Conservar el límite empresarial y el alcance real Power BI', [powerbi]);
note(35, 'La preparación local de Power BI acredita conexión TCP de psql y consultas SQL bajo un rol lector dentro de una transacción de solo lectura. No acredita autenticación de un LOGIN BI separado, ejecución de M, conexión/refresh de Desktop ni archivo PBIX/PBIT/PBIP validado. Se conservan pendientes de privilegios del rol y del cliente. La UAT de 96 escenarios prescribe trabajo futuro y no acredita aceptación empresarial. El mapa 4005 y los cambios de calidad GPS requieren evidencia actual antes de cerrar esta edición. OSM no aporta una garantía SLA ni descarga offline de ciudad. Todo GPS del ensayo es simulado.', [powerbi]);

// Final reconciliation authorized by the principal after native map and API V16 evidence.
const latestMobile = 'docs/control_actualizacion/evidencias/calidad_mobile_final.json';
const mapDoc = 'docs/control_actualizacion/MAPA_MOVIL.md';
const mapNative = 'docs/control_actualizacion/evidencias/mapa_native.json';
const apk = 'docs/control_actualizacion/evidencias/apk_4005.json';
const mapScreenshot = 'docs/control_actualizacion/evidencias/mobile/mapa_4005_reintento.png';
const mapCached = 'docs/control_actualizacion/evidencias/mobile/mapa_4005_cache_offline.png';
const api = 'docs/control_actualizacion/evidencias/api_v16.json';
const deploy = 'docs/control_actualizacion/evidencias/deploy_after.json';
const postFinal = 'docs/control_actualizacion/evidencias/e2e_post_update/server_final.json';
const webQuality = 'tools/control_actualizacion/web_quality_2026-10-22T202320-0500.json';
const gpsDoc = 'docs/control_actualizacion/WEB_CALIDAD_GPS.md';
const gpsContract = 'tools/control_actualizacion/analytics_gps_contract.json';
const gpsTests = 'tools/control_actualizacion/analytics_verification_2026-10-22T201133-0500.json';
function reviseText(id, text, sources) {
  const action = actions.find(a => a.type === 'text' && a.id === id);
  if (!action) throw new Error(`Missing planned textbox ${id}`);
  action.newText = text;
  action.sources = sources;
}
function reviseCell(row, column, text, sources) {
  const action = actions.find(a => a.type === 'table' && a.slide === 34 && a.row === row && a.column === column);
  if (!action) throw new Error(`Missing planned cell 34[${row},${column}]`);
  action.newText = text;
  action.sources = sources;
}
function reviseNote(slide, text, sources) {
  const item = notes.find(n => n.slide === slide);
  item.append = text;
  item.sources = sources;
}
reviseText('sh/hwjy98rm', 'Versión Android 8005: 6/6 nativas.\nReintento y calles visibles.\nReapertura offline con caché visible.\nGPS simulado, sin navegación real.', [mapDoc, mapNative, apk]);
reviseText('sh/utsfyt8v', 'Caché según headers, 7 días por defecto. Sin descarga de ciudad ni SLA OSM. GPS simulado.', [mapDoc]);
replace(21, 'Recorrido', 'Mapa nativo Android 8005', 'Incluir la captura actual revisada por el principal', [mapDoc, apk]);
replace(21, 'GET /routes/{id}/path usa OSRM.\nLa geometría distingue fuente vial\ny alternativa por segmentos.\nNo promete hora exacta de llegada.', '', 'Conservar el contrato OSRM en notas y dedicar el área a la evidencia real del mapa', [mapDoc]);
footer(21, 'MAPA_MOVIL.md y mapa_native.json. Captura actual: mapa_4005_reintento.png.', 'Evidencia nativa actual y atribución visible', [mapDoc, mapNative, mapScreenshot]);
actions.push({ type: 'imageAdd', slide: 21, slideId: slides[20].id, id: 'new-map-native-8005',
  source: mapScreenshot, frame: { left: 74, top: 355, width: 520, height: 236.89 },
  fit: 'contain', crop: { left: 0, top: 0.22, right: 0, bottom: 0.575 },
  alt: 'Mapa OSM real de la app Android 8005 tras Reintentar, con calles de Lima y atribución visible',
  reason: 'Añadir evidencia actual del mapa sin rediseñar el resto de la lámina', sources: [mapDoc, mapNative, apk] });
const kpiImage = actions.find(a => a.type === 'image' && a.slide === 25);
kpiImage.frame = { left: 74, top: 234.53, width: 744, height: 292.95 };
kpiImage.reason += '. El marco respeta la proporción exacta del recorte y queda dentro del área de imagen original.';
reviseText('sh/947ipwje', 'IMPLAUSIBLE_SPEED:\nGPS y km/entrega = null.\nBruto solo para auditoría.', [api, deploy]);
replace(28, 'GPS exige muestras suficientes.\nKm por entrega usa DELIVERED.\nMin/parada usa terminales:\nDELIVERED, FAILED y RETURNED.',
  'V16 valida la calidad de la traza.\nRuta 20: GPS no evaluable.\nRuta 21: 0 km, traza estacionaria.\nPlan, operación y GPS separados.', 'Describir exactamente API y SQL desplegados', [api, deploy]);
reviseText('sh/0zehcr2x', 'Captura histórica 20/10. Estado actual V16: api_v16.json, GPS/SQL 9/9 PASS.', [api, deploy]);
reviseCell(2, 0, 'Backend y GPS V16', [deploy, api, gpsTests]);
table(34, 2, 1, '58 pruebas, 0 fallos / errores', '30 pruebas V16 PASS.\nAPI/SQL desplegada: 9/9 PASS.', [gpsTests, api, deploy]);
table(34, 2, 2, 'Integración incluida en el total.\nLa UAT se valida por separado.', '8 tablas sin cambios de MD5.\nRegresión previa: 58 Java PASS.', [deploy, quality]);
reviseCell(3, 1, 'TypeScript y ESLint exit 0.\n53 pruebas web PASS.', [webQuality, gpsDoc]);
reviseCell(5, 1, '84 host PASS + 8 contrato PASS.\nMapa nativo: 6/6 PASS.', [latestMobile, mapNative]);
reviseCell(5, 2, 'Cola con proceso activo.\nCaché y reintento visibles.', [mapDoc, mapNative, latestMobile]);
reviseText('sh/87ml836l', 'Mapa recuperado y caché nativa verificados.\nV16 y API local contrastados con SQL.\nDispositivos y red de campo por validar.\nPower BI Desktop sin conexión verificada.', [mapDoc, api, deploy, powerbi]);
reviseText('sh/byh43utc', 'Calidad móvil, mapa nativo, V16 y API/SQL del 22/10. Conteos por ejecución.', [latestMobile, mapNative, api, deploy, gpsTests, webQuality]);
reviseNote(16, 'Se conserva el enlace lógico de identidad, sin FK entre bases. El defecto API 401, refresh exitoso y replay 400 causaba falso logout. El catch del replay ahora conserva respuesta/estado de 400/403/409/422/500 sin expirar sesión. Otro 401 mantiene el tratamiento de sesión, y rechazos 400/401 del refresh siguen cerrándola. Los 40 casos del diagnóstico ya estaban incluidos en 81 host y el total final con mapa es 84, no 124. Ocho opt-in omitidas en host se ejecutan aparte con ocho PASS. APK build 4005/versionCode 8005 relaciona el hash de este interceptor con las fuentes compiladas e instaladas. Tres ciclos nativos estables tienen su reporte independiente.', [session, auth, native, latestMobile, apk]);
reviseNote(21, 'Validación actual: build Flutter 4005, Android versionCode 8005 instalada sin borrar datos, fuentes y configuración contrastadas por hash. mapa_native.json acredita seis controles PASS y MAPA_MOVIL.md registra inspección visual del principal de calles/atribución tras Reintentar y reapertura offline. La captura mostrada es mapa_4005_reintento.png, del caso ruta 21 ya COMPLETED y consulta guardada: no acredita recorrido físico ni seguimiento en vivo. El mapa base es independiente de polilínea y marcadores. Caché HTTP de teselas visibles respeta Cache-Control/ETag y usa siete días por defecto si no recibe Cache-Control. Banner y Reintentar recrean solo TileLayer; también hay retry al reanudar. OSM best effort sin SLA, sin descarga de ciudad ni promesa de navegación offline general. GET /routes/{id}/path usa el contrato OSRM y fallback declarado, sin ETA exacta garantizada. GPS del ensayo simulado. El video previo conservó el fallo gris en 8004; las imágenes anteriores siguen como historia, no como evidencia de la corrección.', [mapDoc, mapNative, apk, latestMobile, mapScreenshot, mapCached]);
reviseNote(25, 'Estado después del despliegue V16, conductor 1, 2026-10-22 y America/Lima: cuatro pedidos del día, 44/45 del ensayo ruta 20 más 46/47 del video ruta 21. Dos DELIVERED y dos FAILED. El caso nuevo del video tiene dos pedidos. API y SQL confirman IID 4/4=100%, CHR 2/4=50%, TDE 2/4=50%, SUCCESS 2/4=50%, ONTIME 2/2=100%. Metas null y NO_TARGET. Las cinco fórmulas y sus poblaciones no cambiaron con V16. TDE exige foto o firma y POD completo requiere ambos y metadatos. La captura procede del video anterior al ajuste GPS, pero sus cinco KPI coinciden con la lectura posterior. El snapshot post-update es 26/26 PASS.', [api, postFinal, route20, `${video}/24_indicadores_final.png`]);
reviseNote(28, 'V16 está desplegada localmente según deploy_after.json, con ocho tablas operativas de MD5 y conteos intactos. api_v16.json registra nueve controles PASS y contrasta API/SQL: ruta 20 actualGpsDistanceKm=null, kmPerDelivery=null, distanceSource=UNAVAILABLE y calidad IMPLAUSIBLE_SPEED. observedDistanceKm=7433.283426462645 permanece solo para auditoría, nunca se usa como distancia operativa ni sustituto de KPI. Ruta 21 AVAILABLE con dos muestras estacionarias y 0 km válidos, sin acreditar desplazamiento físico. Límites de esta ejecución: maxSpeedKmh 160 y maxGapSeconds 900, según respuesta, no metas de MICOTRANS. La tabla, los gráficos y el CSV web usan el dato operativo solo con calidad AVAILABLE y fuente GPS_HAVERSINE; los nulos se mantienen vacíos. El CSV de eficiencia no exporta el bruto de auditoría. Plan y operación permanecen separados. Min/parada terminal utiliza DELIVERED/FAILED/RETURNED, no tiempo de atención domiciliaria. La imagen conservada es histórica del 20/10 y no presenta resultados de V16. GPS simulado, sin rendimiento empresarial real.', [api, deploy, gpsDoc, gpsContract, gpsTests]);
reviseNote(29, 'La imagen continúa como referencia histórica del 20/10. La lectura post-deploy del 22/10 tiene cuatro pedidos diarios y dos completePodOrders. Las cinco métricas de pedidos conservan sus valores y denominadores. El pedido 46 aporta un POD recuperado con foto/firma, contrastado con SQL y hashes. El cambio V16 introduce control de calidad de las muestras de ruta, sin convertir metadatos de POD en prueba general de disponibilidad S3 ni GPS válido en sensor de campo certificado.', [postFinal, api, route21]);
reviseNote(34, 'Ejecuciones separadas: calidad móvil actual acredita analyze exit 0, 84 host PASS y 8 skipped opt-in; otra orden acredita ocho contratos PASS. No sumar skipped ni los 40 nuevos del diagnóstico ni las tres pruebas de mapa de nuevo. La verificación de V16 acredita 30 pruebas técnicas PASS y la auditoría API/SQL desplegada nueve controles PASS. El snapshot posterior al despliegue acredita 26/26 PASS y ocho tablas conservan MD5/conteos. Suite web actual 53/53 PASS con TypeScript y ESLint correctos. La regresión Java anterior de 58 se conserva como histórico y no se suma a la suite focalizada V16. Mapa nativo seis controles PASS e inspección de calles/atribución por el principal. Video ruta 21 siete clips, no siete escenarios UAT. Las rutas 20 y 21 son fixtures sintéticos, no operación comercial de MICOTRANS.', [latestMobile, mapNative, mapDoc, gpsTests, api, deploy, postFinal, webQuality, quality]);
reviseNote(35, 'Mapa Android 8005: seis comprobaciones nativas PASS y calles/atribución revisadas tras reintento y reapertura offline. V16 y nueve controles API/SQL están acreditados en el backend local y se conservan los datos operativos, sin atribuir rendimiento de simulación a MICOTRANS. Power BI dispone de preparación SQL/M y consultas psql bajo rol, pero Desktop, conexión/refresco nativos, evaluación M y PBIX/PBIT/PBIP siguen sin acreditar. La UAT empresarial, los dispositivos/red de campo y atribución causal requieren el piloto real. Mantener OSM best effort sin SLA y caché solo de vistas consultadas. No quedan pendientes técnicos de mapa/GPS de esta ejecución local; los límites de campo y empresa se conservan.', [mapDoc, mapNative, api, deploy, postFinal, powerbi]);
for (const n of [23, 24]) note(n, 'V16 modifica la vista analítica de rutas y añade resultados de calidad GPS sin añadir tablas ni FK. Se conserva el alcance físico de 26 tablas, cuatro vistas y 27 FK de la base. Los cambios de definición y datos operativos se contrastan en las evidencias del despliegue, no en una nueva enumeración DB ejecutada por este worker.', [deploy, gpsContract]);
const integrated = 'docs/control_actualizacion/evidencias/calidad_integrada_1792718833047.json';
const integratedData = JSON.parse(await fs.readFile(path.join(root, integrated), 'utf8'));
if (integratedData.result !== 'PASS' || integratedData.javaSummary.tests !== 106 || integratedData.javaSummary.failures || integratedData.javaSummary.errors || integratedData.javaSummary.skipped) throw new Error('Latest integrated regression is not the verified 106/0/0/0 cut');
reviseCell(2, 0, 'Java, V16 y API', [integrated, api, deploy]);
reviseCell(2, 1, '106 pruebas, 0 fallos / errores.\nAPI/SQL desplegada: 9/9 PASS.', [integrated, api]);
reviseCell(2, 2, '106 incluye los casos V16.\n8 tablas sin cambios de MD5.', [integrated, deploy]);
reviseCell(3, 1, 'TypeScript y ESLint exit 0.\n53 pruebas web PASS.', [integrated, webQuality]);
const summary34 = notes.find(n => n.slide === 34);
summary34.append = 'Último corte integrado: 106 pruebas Java, cero fallos, errores u omitidas, TypeScript/ESLint exit 0 y 53 pruebas web PASS. Los 30 casos focalizados V16 forman parte de la regresión integrada, no se suman a 106. Flutter: 84 host PASS y ocho opt-in omitidas en esa ejecución, con otra orden de ocho contratos PASS. No contar skipped como aprobados ni duplicar los 40 casos de diagnóstico o tres de mapa. API/SQL desplegada nueve controles PASS, snapshot posterior 26/26 PASS y ocho tablas operativas sin cambios de MD5/conteos. Mapa nativo seis controles PASS y calles/atribución revisadas por el principal. Video ruta 21 siete clips reales, no siete escenarios UAT. Las cifras 58 Java y 32 web pertenecen al corte histórico anterior, reemplazado por 106/53 como estado actual. El primer archivo sin timestamp FAIL corresponde al harness route guard; se conserva para auditoría y no se presenta como fallo de producto. La regresión aprobada está en el archivo integrado con timestamp citado.';
summary34.sources = [integrated, latestMobile, mapNative, mapDoc, gpsTests, api, deploy, postFinal, webQuality, quality];
const webRun = 'docs/control_actualizacion/evidencias/web/run_1792719021669';
const webResult = `${webRun}/result_1792719031028.json`;
const webRunData = JSON.parse(await fs.readFile(path.join(root, webResult), 'utf8'));
if (webRunData.result !== 'PASS' || webRunData.checks.length !== 6 || webRunData.checks.some(c => c.result !== 'PASS')) throw new Error('Latest browser QA is not 6/6 PASS');
const currentKpiScreenshot = `${webRun}/02_indicadores.png`;
try {
  await fs.access(path.join(root, currentKpiScreenshot));
  kpiImage.source = currentKpiScreenshot;
  kpiImage.alt = 'Captura web actual después del despliegue V16: cinco KPI diarios del conductor 1';
  kpiImage.sources = [api, postFinal, webResult];
  reviseText('sh/napsr6x0', 'Captura actual post-V16: 02_indicadores.png y API/SQL del 22/10.', [currentKpiScreenshot, api, postFinal, webResult]);
} catch (error) { if (error.code !== 'ENOENT') throw error; }
actions.push({ type: 'image', slide: 28, slideId: slides[27].id,
  id: slides[27].elements.find(e => e.kind === 'image').id,
  source: `${webRun}/03_eficiencia_gps.png`, fit: 'contain',
  frame: { left: 74, top: 242.37, width: 744, height: 277.26 },
  crop: { left: 0.18, top: 0.45, right: 0.02, bottom: 0.02 },
  alt: 'Captura actual V16, ruta 20: GPS y km/entrega No evaluable por velocidad inverosímil',
  reason: 'Sustituir el gráfico histórico por evidencia actual de calidad GPS, conservando proporción del recorte',
  sources: [webResult, api, deploy] });
reviseText('sh/0zehcr2x', 'Captura actual V16: 03_eficiencia_gps.png. Web 6/6 y API/SQL 9/9 PASS.', [webResult, api, deploy]);
const gpsNote = notes.find(n => n.slide === 28);
gpsNote.append = gpsNote.append.replace('La imagen conservada es histórica del 20/10 y no presenta resultados de V16.', 'La imagen actual 03_eficiencia_gps.png del run web PASS muestra ruta 20 con No evaluable y el motivo de calidad. Sustituye el gráfico anterior a V16. La captura conserva por separado plan, tiempo de operación y minutos por parada.');
gpsNote.sources.push(webResult, `${webRun}/03_eficiencia_gps.png`);
const kpiNote = notes.find(n => n.slide === 25);
kpiNote.append = kpiNote.append.replace('La captura procede del video anterior al ajuste GPS, pero sus cinco KPI coinciden con la lectura posterior.', 'La captura actual 02_indicadores.png procede del run web post-V16 PASS con los cinco KPI filtrados.');
kpiNote.sources.push(webResult, currentKpiScreenshot);
summary34.append += ' La ejecución web real posterior acredita seis controles PASS: filtros de dashboard, cinco indicadores, calidad GPS no evaluable, nulos de CSV, POD foto/firma conservados y ausencia de errores de página/escrituras de negocio. No es una nueva suite de 53 unitarias ni se suma a ella.';
summary34.sources.push(webResult);
reviseNote(32, 'Las seis pantallas principales y sus relaciones BPMN se conservan. La foto de cámara/firma de la lámina es referencia histórica del fixture anterior. Para el 22/10, los reportes del video acreditan captura del pedido 46, persistencia offline y sincronización con sesión propia. El interceptor renovado conserva el error de negocio del replay. Mapa Android 8005 tiene seis controles nativos PASS con calles/atribución verificadas tras Reintentar y reapertura offline. La lectura post-V16 confirma cinco KPI y control de calidad GPS sin interpretar la simulación como recorrido real. La consulta actual de POD conservado tras el despliegue figura en la ejecución web seis controles PASS.', [session, sync, mapDoc, mapNative, api, postFinal, webResult, `${webRun}/04_pod_conservado.png`]);

const evidenceFiles = [...new Set([...actions.flatMap(a => a.sources ?? []), ...notes.flatMap(a => a.sources ?? []),
  ...actions.filter(a => ['image', 'imageAdd'].includes(a.type)).map(a => a.source)])].sort();
const evidence = [];
for (const file of evidenceFiles) evidence.push({ file, sha256: await hash(file) });
const plan = { schemaVersion: 1, state: 'READY_FOR_FINALIZATION', createdAt: new Date().toISOString(),
  source, sourceSha256: inventory.sha256, slideCount: 35, slideSizeEmu: inventory.sizeEmu,
  fontPolicy: { basis: 'reference', families: ['Arial'], referencePath: path.join(root, source), referenceSha256: inventory.sha256 },
  output: 'EcoRoute_Arquitectura_y_Flujos_Actualizados.pptx',
  preserve: { slides: 35, businessProcesses: 'P01–P09, actores y orden sin cambios', masters: true, layouts: true, geometry: true },
  currentMapStatus: '8005 nativa 6/6 PASS, calles/atribución verificadas tras reintento y reapertura offline. Calidad móvil 84 host + 8 contrato PASS.',
  blockers: [],
  actions, notes, evidence };
await fs.writeFile(path.join(output, 'targeted_updates.json'), `${JSON.stringify(plan, null, 2)}\n`);
const relativeEvidence = async file => ({ file: path.relative(path.join(root, 'docs/control_actualizacion'), path.join(root, file)).replaceAll('\\', '/'), sha256: await hash(file) });
const release = { schemaVersion: 1, principalConfirmed: true,
  principalInstruction: 'FINALIZA deck ahora, conservar 35, confirmación expresa recibida en este chat después de API V16 y mapa nativo.',
  map: { confirmed: true, status: 'Android 8005, 6/6 nativas y calles/atribución visibles tras reintento y caché offline.', evidence: await Promise.all([mapDoc, mapNative, apk, mapScreenshot, mapCached].map(relativeEvidence)) },
  gps: { confirmed: true, status: 'V16 local, API/SQL 9/9 PASS y snapshot post-deploy 26/26. Ruta20 null/IMPLAUSIBLE_SPEED, bruto solo auditoría.', evidence: await Promise.all([deploy, api, postFinal].map(relativeEvidence)) },
  overrides: [], visualReview: { confirmed: false, previewDirectory: null, planSha256: null } };
await fs.writeFile(path.join(output, 'release_status.json'), `${JSON.stringify(release, null, 2)}\n`);
console.log(JSON.stringify({ slideCount: 35, changedSlides: [...new Set(actions.map(a => a.slide))],
  actions: actions.length, notes: notes.length, evidenceFiles: evidence.length, finalDeckCreated: false }, null, 2));
