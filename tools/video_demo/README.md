# Montaje de grabaciones EcoRoute

No necesita paquetes npm, instalaciones, servicios, ADB ni datos de negocio. Solo Node y los FFmpeg/ffprobe instalados (descubiertos mediante Get-Command y el paquete WinGet Gyan.FFmpeg).

Desde la raíz del repositorio, cuando todas las grabaciones estén cerradas y el responsable autorice el montaje:

```powershell
& 'C:/Users/USUARIO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' tools/video_demo/assemble_video.mjs
```

El manifiesto predeterminado es `docs/videos/ecoroute_e2e_20261022/segments.json`:

```json
{
  "title": "EcoRoute",
  "segments": [
    {"file": "raw/web_prepare.webm", "title": "01 Preparación", "kind": "web", "speed": 1}
  ],
  "output": "EcoRoute_Demostracion_End_to_End.mp4"
}
```

Las rutas son relativas al directorio del manifiesto. El script rechaza fuentes inexistentes, rutas fuera del runfolder, imágenes, archivos sin duración de video válida, fallos de decodificación y fuentes que cambian durante el montaje. Conserva todos los originales y rechaza salidas existentes. El responsable selecciona únicamente las grabaciones nuevas y aprobadas, usando `report.recording.file` de los reportes PASS. El ensamblador solo lee las entradas explícitas del manifiesto: nunca enumera `raw` ni añade intentos fallidos automáticamente. No modifica los recorders `mobile_record` ni `mobile_journey`. No es posible determinar la fecha real de captura a partir de un nombre o metadato editable.

Portada de 3 segundos, cartas de capítulo de 2 segundos (opcional `--no-chapters`), banda de 96 px, fondo oscuro, proporción intacta y móvil vertical centrado. Se mantiene el aviso `Datos sintéticos · Entorno local Lima · GPS simulado` en portada, capítulos y banda. `speed` se respeta (por defecto 1). Salida silenciosa H.264, preset `veryfast`, CRF 20, 1920×1080, 24 fps, yuv420p, SAR 1:1, faststart y capítulos MP4. Los títulos se queman en imagen: no dependen del reproductor.

Para este proceso, el último segmento debe titularse `Panel del día incluye ensayos previos` (puede llevar número de capítulo). Los valores 4 pedidos, 2 entregados, 2 fallidos y 50% son expectativas que verificará el responsable mediante SQL; el ensamblador no los consulta ni los inserta como resultados confirmados.

Opciones: `--manifest <ruta>`, `--no-chapters`, `--contact-interval <segundos>` (30 por defecto). `VIDEO_DEMO_FONT` permite señalar otra fuente TrueType instalada. Los textos UTF-8 se cargan mediante archivos; ninguna ruta Windows ni texto del manifiesto se interpola en el lenguaje de filtros o en un shell.

Se genera `<salida>.report.json` con hashes SHA-256, tamaños, duración y formato de cada fuente, velocidades, línea de tiempo, herramientas, fuente tipográfica, duración y hash final, comprobación completa de decodificación y posición del átomo `moov` antes de `mdat`. La carpeta `.assembly-*/qa` conserva JPEG completos, hojas de contacto y `contact_frames.json` con tiempos y motivos de muestreo. Incluye intervalos regulares, inicio/centro/final de cada video, portada y capítulos. El estado queda `pending-human-review`: la revisión semántica y de legibilidad corresponde al responsable. Los intermedios se conservan para auditar y recuperar fallos.

Verificación independiente (incluye hashes de manifiesto y fuentes):

```powershell
& 'C:/Users/USUARIO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' tools/video_demo/verify_video.mjs --report 'docs/videos/ecoroute_e2e_20261022/EcoRoute_Demostracion_End_to_End.mp4.report.json'
```

QA aislada: copiar únicamente el clip de prueba a una subcarpeta de `tools/video_demo/_qa`, crear allí un manifiesto y ejecutar `--manifest <manifiesto QA> --qa`. La opción `--qa` exige ese directorio y lo marca en el reporte; el script rechaza montar esa carpeta sin la opción. Ningún manifiesto ni clip de QA se añade al montaje real.

QA ejecutada el 2026-10-22: el primer clip real `web_prepare_1792698333038.webm` (40,280 s) produjo una previsualización de 45,292 s, con 10 fotogramas y una hoja de contacto. La verificación independiente también pasó. El SHA-256 original y el de su copia de QA coinciden. Una segunda prueba técnica aislada, explícitamente rotulada como NO INCLUIR EN ENTREGA, comprobó encuadre vertical 360×800 y velocidad 2× (2 s de fuente → 1 s de contenido). Ambas probaron espacios, tildes y signos en rutas y textos; el clip real comprobó `%` y el patrón vertical añadió apóstrofos. Se inspeccionaron visualmente ambas hojas de contacto. Los materiales permanecen únicamente en `_qa/`, excluido de Git; la revisión final del proceso real queda a cargo del responsable.
