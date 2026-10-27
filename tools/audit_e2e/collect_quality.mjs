import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
const out=path.resolve('docs/auditoria_end_to_end_20261019/evidencias');
const summary={date:'2026-10-19',source:'Resultados observados durante la auditoría; no se reinterpretan como pruebas funcionales aprobadas.',checks:[
 {command:'.\\gradlew.bat test --no-daemon',result:'compileTestJava falla',errors:3,file:'OrderUseCasesImplTest.java',cause:'Constructor anterior de Order, 4 argumentos frente a 18 campos actuales'},
 {command:'npm run build',component:'web-admin',result:'Compila',bundleKb:715.36,warning:'Bundle mayor que el umbral de Vite'},
 {command:'npm run lint',component:'web-admin',result:'No aprueba',errors:34,warnings:4},
 {command:'flutter analyze --no-pub',component:'mobile-app',result:'Observaciones informativas',infos:52,errors:0,warnings:0},
 {command:'flutter build apk --debug --no-pub --target-platform android-x64',result:'Compila e instala',apkBytes:111451914},
 {command:'docker compose build ecoroute-backend ecoroute-web-admin',result:'Construye',caveat:'Dockerfile backend omite tests mediante -x test'}
]};
fs.writeFileSync(path.join(out,'calidad_compilacion.json'),JSON.stringify(summary,null,2));
const logs=execFileSync('docker',['logs','--tail','1500','ecoroute-backend'],{encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:16*1024*1024});
const selected=logs.split(/\r?\n/).filter(line=>/NoSuchMethodError|ControllerAdviceBean|NullPointerException|ImmutableCollections|ReportController\.java:56/.test(line)).slice(-35);
fs.writeFileSync(path.join(out,'errores_backend_sanitizados.json'),JSON.stringify({selection:'Solo tipos de excepción y ubicaciones de código; sin cabeceras ni cuerpos de petición',lines:selected},null,2));
// Compose emits JSON Lines in this version. Keep only runtime and health fields.
const runtime=execFileSync('docker',['compose','ps','--format','json'],{encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean).map(x=>JSON.parse(x)).map(x=>({service:x.Service,state:x.State,health:x.Health,ports:x.Publishers}));
fs.writeFileSync(path.join(out,'estado_final_servicios.json'),JSON.stringify(runtime,null,2));
console.log(JSON.stringify({errorsSelected:selected.length,services:runtime.map(x=>x.service+':'+x.state)}));
