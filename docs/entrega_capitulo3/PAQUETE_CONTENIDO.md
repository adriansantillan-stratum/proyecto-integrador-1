# Preparación de la entrega EcoRoute

Fecha de entrega: **27 de octubre de 2026**. La evidencia técnica de referencia
corresponde al **26 de octubre de 2026**; estas fechas tienen propósitos distintos.
El empaquetador toma los bytes del workspace actual, incluidos los cambios sin
commit. Registra las versiones de `build.gradle`, `web-admin/package.json` y
`mobile-app/pubspec.yaml`, junto con el commit base. No modifica Git ni servicios.

## Contenido canónico

- Backend `src/`, pruebas y migraciones Flyway; configuración y wrappers Gradle.
- `web-admin/`: fuentes, pruebas, assets, configuración y locks; sin dependencias
  descargadas ni resultados de compilación.
- `mobile-app/`: fuentes, pruebas, herramientas, Android/iOS y demás plataformas
  presentes; `pubspec.yaml` y lock. Se excluyen las configuraciones locales generadas.
- `infra/`, compose y scripts que superen la revisión de contenido.
- `.env.example` con los defaults demo exactos revisados por el agente para el ensayo local autorizado. `.env`
  real y cualquier otra variante de entorno quedan excluidos.
- `ecoroute-realm.json` solo si está saneado: sin claves privadas, hashes ni
  secretos de clientes; permite la credencial sintética autorizada del conductor.
  No incluye el respaldo privado dentro de `.runtime` ni altera el realm vivo.
- `schema.sql` como referencia, las migraciones originales y un seed generado
  dentro del ZIP con un centro ficticio. Los `populate.sql` antiguos no acreditan
  procedencia sintética y se excluyen. No se copian datos empresariales ni dumps.
- `docs/Integrador I_Grupo3.docx`,
  `docs/Integrador I_Grupo3_Capitulo3_Final.docx` y toda
  `docs/entrega_capitulo3/` que supere los filtros, la guía `docs/guia_total_ide/`
  y los BPMN/ERD canónicos. El documento final puede seguir en preparación: la
  ausencia de un documento obligatorio bloquea la creación del ZIP.
  `_Capitulo3_Completo.docx` es una revisión intermedia y queda fuera de Git/ZIP.

Las fuentes BPMN vigentes están en
`docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/`. Los ERD vigentes
están en `docs/base_datos/modelo_erd/`, `docs/base_datos/modelo_erd_negocio/` y
`docs/correccion_integral/diagramas/`. Se incluyen las capturas enlazadas por
la guía actual y cuatro resúmenes de evidencia; se excluyen volcados XML del
dispositivo, capturas no seleccionadas, archivos históricos duplicados de
capítulos anteriores y directorios u hojas de contacto de QA.

Las dos excepciones a la exclusión general de `*.jar` son
`gradle/wrapper/gradle-wrapper.jar` y
`mobile-app/android/gradle/wrapper/gradle-wrapper.jar`: se detectan incluso si
Git los ignora. El script no modifica `.gitignore` ni agrega archivos a staging.

## Exclusiones y auditoría

Se excluyen `.git`, `.claude`, `.codex`, `.runtime`, `_qa*`, caches,
`node_modules`, `build`, `.dart_tool`, `.gradle`, volúmenes de bases de datos,
claves privadas, service accounts, credenciales reales, logs, datos OSRM,
backups, dumps, vídeos, APK/AAB/IPA y archivos comprimidos. Los ZIP propios
nunca se vuelven a incluir.

El inventario **local** `tools/entrega_capitulo3/audit_json.json` queda fuera
de Git y ZIP por regla explícita, aunque exista sin trackear. Contiene rutas,
tamaños, hashes y reglas de rechazo; no guarda valores de secretos. Puede
regenerarse o reubicarse fuera del repositorio. No es un entregable público.

La detección distingue parámetros, referencias a variables de entorno,
`grant_type`, nombres de campos y fixtures de pruebas de credenciales emitidas.
Las excepciones demo se aplican a combinaciones exactas de ruta/campo/valor;
no desactivan la detección de JWT, tokens de proveedor ni claves privadas.
Un hallazgo o archivo obligatorio faltante bloquea el ZIP y queda en la auditoría.
El análisis por patrones no certifica la ausencia de toda información personal:
imágenes, PDF y documentos con capturas requieren revisión visual antes de publicar.

## Uso desde PowerShell

Desde la raíz del proyecto:

```powershell
$packagePython = 'C:/Users/USUARIO/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'
$packageScript = 'tools/entrega_capitulo3/package_project.py'
& $packagePython -B $packageScript --help
& $packagePython -B $packageScript --audit-json tools/entrega_capitulo3/audit_json.json
& $packagePython -B $packageScript --public-repo
```

Estos comandos no crean ZIP. La lista `--public-repo` es una selección para
revisión, no un comando de publicación ni staging. Para integrarla con la
curación de Git, importar `explicit_allowlist(path, publicRepo=True, size=bytes)`
y aplicar también `scan_content(path, data)`. La función recibe rutas relativas
POSIX canónicas; los resultados que requieren revisión visual no quedan
automáticamente autorizados para publicar. La lista contempla fuentes, scripts, documentos actuales, el SQL de estructura, las matrices RF/RNF y las 71 capturas sintéticas enlazadas por el manifiesto. Se revisaron las capturas y sus documentos para esta entrega. Se incluyen únicamente cuatro resúmenes seleccionados de ejecución; los demás registros privados permanecen excluidos. La revisión no equivale a una certificación exhaustiva de privacidad.

Cuando el documento final esté listo y la auditoría no registre bloqueos,
la creación debe solicitarse explícitamente:

```powershell
# Ejemplo para ejecutar después: el directorio padre debe existir.
& $packagePython -B $packageScript --zip 'C:/ruta/externa/EcoRoute_20261027.zip' --audit-json tools/entrega_capitulo3/audit_json.json
& $packagePython -B $packageScript --verify 'C:/ruta/externa/EcoRoute_20261027.zip'
```

Dentro del repositorio solo se permite una salida bajo `entregas/` cuando
`git check-ignore` confirma que está ignorada. El script rechaza sobrescribir
un ZIP existente. También dispone de `--root`, `--max-file-mib` (privado,
predeterminado 100), `--inspect-apk RUTA` y `--private-apk RUTA` (solo con
`--zip`). El paquete recomendado contiene **fuentes y documentos, sin APK**.
El APK x86_64 asociado al emulador/puerto 9006 no es un APK universal para
celular; inspeccionar tamaño/hash no demuestra qué binario ejecutó el dispositivo.
La variante opcional se coloca en `private/` y nunca forma parte de `publicRepo`.

## Integridad y límites

El ZIP contendrá `MANIFEST.json`, `MANIFEST.sha256`, `PACKAGE_METADATA.json` y
`README_RESTORE.md`. Los manifiestos cubren cada otro archivo, incluido el README;
no se autorreferencian. La creación vuelve a leer y comparar los hashes con
la auditoría, verifica el ZIP antes de finalizarlo y devuelve su SHA256 externo.
El verificador no extrae archivos y rechaza rutas inseguras, duplicados, extras,
tamaños y hashes incorrectos. La restauración usa un directorio nuevo,
dependencias descargadas desde sus gestores, Flyway y configuración local propia.

GitHub avisa por archivos mayores de 50 MiB y bloquea los mayores de 100 MiB.
La selección pública adopta un límite conservador de **menos de 100 MiB por
archivo**, y excluye todos los ZIP/APK independientemente de su tamaño.
El JSON local enumera los tamaños de los documentos actuales. Fuente:
[límites oficiales de archivos de GitHub](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github).
El tamaño total del proyecto no equivale al límite de un archivo individual.

## Selección de documentación para GitHub

El perfil `publicRepo` publica los documentos vigentes del [índice de consulta](../README.md). Excluye las versiones sustituidas de informes, guiones, presentaciones y capturas, además de archivos de referencia ajenos al proyecto. Los originales permanecen en el equipo local y pueden conservarse en un archivo privado. Esta selección no modifica fechas, resultados ni el historial de Git. Los archivos privados del equipo no deben volver a agregarse con un `git add -f` general.
