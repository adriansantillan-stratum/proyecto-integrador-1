# EcoRoute para Grupo MICOTRANS SAC

Entrega del capítulo 3: **27 de octubre de 2026**. La evidencia del recorrido
local corresponde al **26 de octubre**; los resultados de las suites técnicas
corresponden al **27 de octubre**. Son comprobaciones distintas.

## Documentación canónica

- [Informe académico canónico](docs/Integrador%20I_Grupo3.docx).
- [Revisión final del capítulo 3](docs/Integrador%20I_Grupo3_Capitulo3_Final.docx).
- [Guía total del recorrido y del IDE](docs/guia_total_ide/EcoRoute_Guia_Total_Recorrido_y_IDE.md)
  y [versión Word](docs/guia_total_ide/EcoRoute_Guia_Total_Recorrido_y_IDE.docx).
- [Contenido, restauración y revisión de publicación del paquete](docs/entrega_capitulo3/PAQUETE_CONTENIDO.md).
- [Resumen de calidad del 27 de octubre](docs/entrega_capitulo3/quality/quality_summary.md).
- [Diagramas del capítulo 3](docs/entrega_capitulo3/diagramas/),
  [BPMN editables vigentes](docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/)
  y [fuentes del ERD de negocio](docs/base_datos/modelo_erd_negocio/).

La revisión `_Final` y el informe canónico contienen la misma entrega. El [índice de documentación vigente](docs/README.md) reúne los materiales de consulta y exposición.

## Resultado técnico y evidencia

El [resumen de calidad](docs/entrega_capitulo3/quality/quality_summary.md) registra
**234 pruebas aprobadas, 0 fallidas y 26 omitidas**, de 260 descubiertas:

| Componente | Aprobadas | Omitidas | Alcance pendiente |
|---|---:|---:|---|
| Backend | 88 | 18 | Integraciones Testcontainers: motor Docker Linux no disponible |
| Web | 62 | 0 | — |
| Flutter | 84 | 8 | Contratos con servicios vivos deshabilitados por opt-in |

Gradle test, Node test, ESLint, TypeScript, Vite build, Flutter analyze y Flutter
test finalizaron con código 0. Los hashes de la instantánea ensayada están en
[tested_sources.json](docs/entrega_capitulo3/quality/tested_sources.json).
Las omisiones no equivalen a integraciones ejecutadas.

La [guía del recorrido](docs/guia_total_ide/EcoRoute_Guia_Total_Recorrido_y_IDE.md)
y su [manifiesto de evidencia del 26/10](docs/guia_total_ide/ejecucion_20261026/manifest.json)
conservan 71 capturas del ensayo local de éxito, excepción y depuración IDE.
Una captura no equivale a un caso automatizado distinto. Estos archivos no
prueban el estado actual de los servicios ni una instalación limpia completa.
Las capturas conservan la ventana completa y enlazan sus originales para ampliar los textos pequeños. La revisión visual identifica vistas parciales por desplazamiento y limitaciones de lectura a escala A4; el original debe consultarse para leer campos y gráficos en detalle. No se acredita aceptación empresarial ni operación productiva.

## Instalación local nueva

Requiere Java 17, Docker Engine/Compose activo, PowerShell, Node/npm compatibles
con las dependencias del panel, Flutter según `mobile-app/pubspec.yaml`, Android
SDK y un emulador. Las versiones efectivamente ensayadas se registran en
[dependency_versions.json](docs/entrega_capitulo3/quality/dependency_versions.json).
Los comandos siguientes describen el procedimiento; no forman parte de las
pruebas automatizadas ni se ejecutaron para actualizar este README.

1. Desde la raíz, crear únicamente la configuración local que aún no exista:

   ```powershell
   node tools/entrega_capitulo3/init_local_env.mjs
   ```

   El helper usa `.env.example`, genera aleatoriamente
   `KEYCLOAK_ADMIN_CLIENT_SECRET` y escribe `.env` sin mostrar el valor. Si `.env`
   ya existe, lo conserva. `.env.example` contiene defaults locales demo
   revisados por el agente para el ensayo local autorizado; `.env` real permanece
   excluido del repositorio y del paquete.

2. Preparar OSRM si no existe una preparación MLD compatible:

   ```powershell
   powershell -NoProfile -File tools/entrega_capitulo3/Prepare-OsrmPeru.ps1
   ```

   El preparador descarga el extracto de Perú y ejecuta `extract`, `partition`
   y `customize`, con perfil `car` e imagen `osrm/osrm-backend`, igual que Compose.
   Requiere red, Docker y espacio para los datos generados. Conserva mapas
   existentes y detiene la operación ante archivos previos o una descarga
   parcial; revisar ese estado antes de repetir. Registra imagen y SHA256 del
   extracto. Los mapas se regeneran fuera de la entrega de fuentes. El helper
   fue revisado como procedimiento, sin ejecutar aquí una instalación limpia.

3. Iniciar las dependencias del modo IDE y esperar su disponibilidad:

   ```powershell
   docker compose -f docker-compose.yml -f docker-compose.ide.yml up -d postgres redis keycloak localstack osrm
   docker compose -f docker-compose.yml -f docker-compose.ide.yml ps
   ```

   LocalStack inicializa bucket y colas mediante `infra/localstack/init-aws.sh`.
   Un contenedor iniciado no demuestra que el realm o el mapa estén listos.

4. **Solo para una instalación nueva de identidad**, crear realm, clientes,
   roles y cuentas demo; después configurar la cuenta técnica con el secreto local:

   ```powershell
   powershell -NoProfile -File setup-keycloak.ps1
   node tools/setup_identity_service.mjs
   ```

   `setup-keycloak.ps1` restablece contraseñas incluso si los usuarios ya existen:
   omitirlo en un entorno configurado. El segundo script configura
   `ecoroute-operations-service` con el secreto de `.env`, conserva las
   contraseñas de usuarios y concede los roles técnicos de administración
   documentados en el capítulo 3. No reemplazar el secreto por un valor del informe.

5. Preparar las dependencias del panel y del móvil:

   ```powershell
   Push-Location web-admin
   npm ci
   Pop-Location
   Push-Location mobile-app
   flutter pub get
   flutter devices
   Pop-Location
   ```

6. En terminales separadas, iniciar backend y panel:

   ```powershell
   powershell -NoProfile -File tools/guia_total_ide/Start-EcoRouteIDE.ps1 -Component Backend
   ```

   ```powershell
   powershell -NoProfile -File tools/guia_total_ide/Start-EcoRouteIDE.ps1 -Component Web
   ```

   El backend carga `.env` mediante el helper y aplica Flyway al arrancar.
   Para Flutter, desde `mobile-app`, usar el identificador real mostrado por
   `flutter devices`:

   ```powershell
   flutter run -d emulator-5556 --dart-define=API_BASE_URL=http://10.0.2.2:8081 --dart-define=KEYCLOAK_BASE_URL=http://10.0.2.2:8080
   ```

   La [guía del IDE](docs/guia_total_ide/EcoRoute_Guia_Total_Recorrido_y_IDE.md)
   explica la copia temporal verificada para OneDrive y los tres espacios de
   trabajo. El APK debug x86_64 del ensayo con emulador/build 9006 no es un APK
   universal para celular ni se incluye por defecto en la entrega.

## Entorno ya configurado

Conservar `.env`, usuarios, contraseñas, volúmenes y POD pendientes. Elegir un
solo modo de aplicación para los puertos 8081/3000. En modo Docker, después de
configurar identidad y mapas, iniciar las aplicaciones con:

```powershell
docker compose up -d --build ecoroute-backend ecoroute-web-admin
docker compose ps
```

En modo IDE, usar las terminales del apartado anterior con las dependencias
activas. Panel: [localhost:3000](http://localhost:3000); backend:
[localhost:8081](http://localhost:8081); Keycloak:
[localhost:8080](http://localhost:8080). PostgreSQL usa el puerto host **5433**;
OSRM, **5000**; LocalStack, **4566**; Redis, **16379** solo con el override IDE.

Las migraciones están en `src/main/resources/db/migration/`. **No ejecutar
`schema.sql`, scripts `populate` ni reconstrucciones SQL además de Flyway sobre
una base existente; no usar `docker compose down -v` para reiniciar.** Una base
nueva migrada no contiene automáticamente el fixture de exposición: crear
recursos sintéticos desde los flujos de la aplicación. Los ID de la evidencia
del 26 de octubre pertenecen únicamente a esa sesión.

Cuentas locales de ensayo: EcoRoute `admin` / `admin123`; móvil `conductor` /
`conductor123`. La consola de Keycloak usa otra sesión. Son defaults demo,
no credenciales productivas. El [reporte de saneamiento del export](docs/entrega_capitulo3/keycloak_export_sanitization.json)
documenta la eliminación de claves/hashes del ejemplo sin cambiar el realm vivo.

## Operación y límites comprobados

Crear pedido sin ruta (`PENDING`), registrar conformidad comercial y dirección,
planificar (`PLANNED`), asignar conservando el ID, revisar salida, obtener
aceptación del conductor y despachar. `DELIVERED` requiere foto, firma confirmada,
receptor/DNI y GPS actual. Sin red, el POD queda pendiente hasta la confirmación
remota. Los reintentos crean intentos vinculados sin borrar el resultado anterior.

La recuperación local de originales POD desde PostgreSQL no demuestra
persistencia nativa de S3. FAILED/RETURNED manuales no comparten la cola offline
del POD. TLS, despliegue productivo, SLA y Power BI publicado no están certificados.

## Entrega y publicación

El empaquetador se prepara desde
[package_project.py](tools/entrega_capitulo3/package_project.py); no genera ZIP
salvo solicitud explícita con `--zip`. El inventario bruto
`tools/entrega_capitulo3/audit_json.json` es local y permanece fuera de la
selección de Git y ZIP. Consultar [PAQUETE_CONTENIDO.md](docs/entrega_capitulo3/PAQUETE_CONTENIDO.md)
para la lista de inclusión, SHA256 y documentos con revisión de privacidad pendiente.
Un archivo sin secretos detectados no queda automáticamente apto para publicación:
los informes académicos, la carta empresarial y las capturas pueden contener
identificadores personales o información del negocio.
