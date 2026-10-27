import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=path.join(root,'docs/auditoria_end_to_end_20261019/evidencias');
const s=JSON.parse(await fs.readFile(path.join(out,'casos_prueba.json'),'utf8'));
const sql=`SELECT json_build_object(
 'migrations',(SELECT json_agg(row_to_json(f)) FROM (SELECT version,description,success FROM flyway_schema_history ORDER BY installed_rank) f),
 'orders',(SELECT json_agg(row_to_json(o)) FROM (SELECT id,tracking_number,status,route_id,stop_sequence FROM orders WHERE tracking_number LIKE '${s.prefix}%' ORDER BY id) o),
 'proofs',(SELECT json_agg(row_to_json(p)) FROM (SELECT id,order_id,image_url,signature_data_url,latitude,longitude,verified_at FROM delivery_proofs WHERE order_id IN (SELECT id FROM orders WHERE tracking_number LIKE '${s.prefix}%')) p),
 'history',(SELECT json_agg(row_to_json(h)) FROM (SELECT order_id,status,reason,created_at FROM order_status_history WHERE order_id IN (SELECT id FROM orders WHERE tracking_number LIKE '${s.prefix}%')) h),
 'route',(SELECT row_to_json(r) FROM (SELECT id,status,route_date,driver_id,vehicle_id,geometry IS NOT NULL AS has_geometry,total_duration_min,total_distance_km FROM routes WHERE id=${s.route.id}) r),
 'gps_vehicles',(SELECT json_agg(row_to_json(g)) FROM (SELECT vehicle_id,driver_id,count(*) AS samples,max(ping_time) AS latest FROM vehicle_gps_history WHERE ping_time>now()-interval '1 hour' GROUP BY vehicle_id,driver_id) g),
 'notifications',(SELECT count(*) FROM notifications WHERE order_id IN (SELECT id FROM orders WHERE tracking_number LIKE '${s.prefix}%')),
 'foreign_keys',(SELECT count(*) FROM information_schema.table_constraints WHERE constraint_schema='public' AND constraint_type='FOREIGN KEY'),
 'tables',(SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name<>'flyway_schema_history')
);`;
const raw=execFileSync('docker',['exec','ecoroute-db','psql','-U','user','-d','ecoroute','-t','-A','-c',sql],{encoding:'utf8'});
const data=JSON.parse(raw);await fs.writeFile(path.join(out,'verificacion_base_datos.json'),JSON.stringify(data,null,2));
const inspect=execFileSync('docker',['inspect','ecoroute-backend','ecoroute-web-admin','ecoroute-keycloak','ecoroute-db','ecoroute-osrm'],{encoding:'utf8'});
const containers=JSON.parse(inspect).map(c=>({name:c.Name,image:c.Image,status:c.State.Status,created:c.Created,mounts:c.Mounts.map(m=>({destination:m.Destination,type:m.Type})),ports:c.NetworkSettings.Ports}));
await fs.writeFile(path.join(out,'contenedores.json'),JSON.stringify(containers,null,2));
console.log(JSON.stringify({route:data.route,history:data.history,proofs:data.proofs,gps:data.gps_vehicles,notifications:data.notifications,tables:data.tables,foreignKeys:data.foreign_keys},null,2));
