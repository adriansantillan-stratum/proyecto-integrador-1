# Registro del subtrabajo ERD verificado y SQL V14

Fecha Lima: 2026-10-19. Sin delegaciones nuevas, commits, cambios backend,
Word/PPT ni alteraciones de bases operativas.

## Entradas reales

* Export físico V14: `docs/correccion_integral/evidencias/esquema_fisico_verificado.json`,
  46 tablas/vistas, PostgreSQL 14.21, 13 migraciones (sin V11).
* SQL completo del principal: `docs/base_datos/EcoRoute_BD_Completa_V1-V14.sql`.
* SHA256 JSON: `201a54d718c84ae1f7af2dc4fdfd353bbd57551af5b11766f8dcb72ac809b92d`.
* SHA256 SQL: `d7ba367e13ce2bdf1d26c2798a507ce785425e59bf76d6d2efa464d794fd88d8`.

Se inspeccionó un generador anterior sólo como referencia de estilo; el generador
nuevo no importa su parser ni deriva objetos desde migraciones V1–V8. Se leyó el
catálogo JSON, sus columnas y constraints reales. Se mantiene explícitamente la
ausencia de FK en orders.driver_id y códigos de mejora/auditoría.

## Implementación y resultados

Generador: `tools/audit_e2e/build_verified_erd.py`, creado con apply_patch.
Ejecutado con Python bundled; usa Pillow para métricas de fuentes/QA y Sharp
bundled para renderizar SVG a PNG. Crea cinco pares SVG/PNG bajo
`docs/correccion_integral/diagramas`, con manifiesto JSON y QA.

Resultado final: 30 objetos de negocio (26 tablas + cuatro vistas), 311 columnas
físicas en detalles y 27 constraints FK en el global. El historial, auditoría,
outbox y notificaciones se marcan SOPORTE. Keycloak es nodo conceptual externo y
única relación lógica discontinua; no se cuenta como objeto físico ni FK.

Se excluyen 16 objetos: nueve CORP, seis auth legacy y el respaldo local V14.
No se representa local_evidence_backups como negocio. La documentación explicita
que un volumen LocalStack por sí mismo no demuestra durabilidad del catálogo S3.

## Comprobaciones ejecutadas

1. Inventario JSON: todos los objetos se incluyen o figuran como excluidos;
   ningún objeto nuevo se omite sin clasificación explícita.
2. Cobertura de detalles: todos los objetos de negocio y sus columnas completos.
3. FKs parseadas únicamente desde pg_get_constraintdef exportado; referencias a
   tablas/columnas comprobadas. Global: 27/27; sólo dos referencias a recursos
   quedan fuera de los detalles 02/03 y se declaran expresamente.
4. SVG: cinco XML parseados, textos medidos sin solapamiento entre nombre y tipo;
   conectores ortogonales con rutas fuera de los rectángulos de tablas.
5. PNG: cinco imágenes renderizadas y dimensiones verificadas con Pillow.
6. Inspección visual: hoja de contacto completa, detalle 01 completo y recortes
   legibles de detalles 03/04. Los recortes son QA, no sustituyen los diagramas.
7. Docker 28.5.1 accesible con escalado delegado; imagen postgres:14-alpine
   existente. Ninguna llamada compose, puerto publicado, red externa ni URL real.
8. SQL V1–V14 cargado con psql ON_ERROR_STOP en PostgreSQL 14.21 nuevo: exit 0.
9. Comparación contra JSON físico: 46 esperados / 46 obtenidos; 0 ausentes,
   0 extras, 0 diferentes. Compara clase, comentarios, columnas ordenadas con
   nombre/tipo/null/default/comentario, y todos los constraints con definición.
10. Protección de base no vacía: segunda ejecución rechazada con exit 3 y mensaje
    `Database must be empty; use Flyway on existing database`.
11. Limpieza: etiqueta del contenedor propio verificada; docker rm --force del
    identificador exacto creado por el ensayo, exit 0. tmpfs eliminado junto con
    ese contenedor de prueba; ninguna base existente fue objetivo de limpieza.
12. Verificación final SHA256: JSON físico y SQL siguen siendo los ensayados;
    los cinco SVG y cinco PNG coinciden con sus hashes del manifiesto. Resultado
    PASS; el registro SQL conserva cleanup.removed=true. Sin incidencias de
    whitespace en los archivos del subtrabajo revisados con git diff --check.

Último ensayo SQL: 2026-10-20 02:35:37Z..02:35:40Z.
Resultado y catálogo temporal conservados en `docs/correccion_integral/evidencias/`
como `validacion_sql_completo_desechable*.json`.

Durante preparación se corrigió el manejo de constraints null de vistas en el
JSON y la resolución de rutas relativas del argumento SQL; esta última falla
ocurrió antes de crear contenedor. Las ejecuciones finales terminaron PASS.
Se normalizó el formato de timestamps a UTC explícito y se verificó limpieza.

## Límites

El esquema de los 46 objetos coincide; no se afirma validación exhaustiva de
índices, funciones, triggers, permisos o datos porque el JSON no los exporta.
No se volvió a ensayar recuperación S3 ni se atribuye esa prueba a este subtrabajo.
No se ejecutó UAT humano ni herramienta DBeaver: el estilo es similar y los
recursos son SVG editables propios. La vista global requiere zoom; los detalles
preservan todos los campos para lectura. Los cambios de dominio son los presentes
en el JSON recibido, sin tablas ni relaciones inventadas.
