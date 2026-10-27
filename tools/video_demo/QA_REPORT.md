# QA del ensamblador — 2026-10-22

Estado: listo para que el responsable invoque el montaje final. No se ejecutó el montaje final ni se modificó su manifiesto. No se usó ADB ni se consultaron datos de negocio. Los recorders `mobile_record` y `mobile_journey` no se modificaron.

## Prueba con fuente web real y configuración final

- Fuente original: `docs/videos/ecoroute_e2e_20261022/raw/web_prepare_1792698333038.webm`.
- Duración original: 40,280 s; VP8 WebM, 1600×900.
- SHA-256 original y copia de QA: `e90fea835443e9aa3e5183e0e6ba2ffd667eccc5a140623661506f76423aaec1`.
- Salida exclusiva de QA: `_qa/Web real veryfast Lima/QA_Web_Real_Veryfast_CRF20.mp4`.
- SHA-256 salida: `4468de705e488db79dd9038dcea13aa7b9df0a8019041acdbcf5c7452945ca06`.
- Duración final: 45,291667 s = portada 3 s + capítulo 2 s + clip 40,291667 s. Diferencia de contenido respecto de la fuente: 0,011667 s (menor de un fotograma de salida).
- H.264, preset `veryfast`, CRF 20, 1920×1080, 24 fps, yuv420p, SAR 1:1, sin audio.
- Decodificación completa de fuente y salida: PASS. `faststart` comprobado inspeccionando `moov` antes de `mdat`: PASS.
- Textos UTF-8 y rutas con espacios/tildes: PASS. Aviso visible: `Datos sintéticos · Entorno local Lima · GPS simulado`.
- 10 JPEG de resolución completa y una hoja de contacto: inspeccionada visualmente; encuadre y títulos legibles. La validación semántica del proceso completo sigue pendiente de revisión del responsable.

Reporte completo: `_qa/Web real veryfast Lima/QA_Web_Real_Veryfast_CRF20.mp4.report.json`.

Fotogramas y tiempos: `_qa/Web real veryfast Lima/.assembly-1792698768177-c2438591/qa/contact_frames.json`.

Hoja de contacto: `_qa/Web real veryfast Lima/.assembly-1792698768177-c2438591/qa/contact-000.jpg`.

## Otras comprobaciones

Sintaxis de los tres módulos: PASS. La ausencia de manifiesto detiene el proceso con error de prerrequisito: PASS. Verificación independiente del primer ensayo web con configuración medium/CRF 18: PASS. Prueba técnica vertical aislada 360×800, velocidad 2×: PASS (2 s de fuente → 1 s de contenido), con centrado, proporción y escapado de apóstrofos y `%` comprobados visualmente. Ese patrón está rotulado como prueba técnica y permanece únicamente en `_qa`; nunca se incorpora a la entrega.

## Selección de fuentes para el montaje final

Solo se montan las entradas explícitas de `segments.json`. El ensamblador no descubre clips por patrón ni enumera `raw`. El responsable selecciona `report.recording.file` de los reportes PASS.

PASS comunicados hasta esta entrega: `web_prepare_1792698333038.webm`, `mobile_02_aceptar_ruta_1792698654038.mp4` y `web_dispatch_1792698750280.webm`. Los dos últimos no fueron objeto de esta prueba de composición. Nunca seleccionar `mobile_02_aceptar_ruta.mp4` sin timestamp ni los intentos `mobile02_aceptacion*`.

El último título será `Panel del día incluye ensayos previos`. Las cifras esperadas 4/2/2 y 50% quedan sujetas a la comprobación SQL del responsable; esta QA no las certifica.

Para invocar el montaje final desde la raíz del repositorio:

```powershell
& 'C:/Users/USUARIO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' tools/video_demo/assemble_video.mjs
```
