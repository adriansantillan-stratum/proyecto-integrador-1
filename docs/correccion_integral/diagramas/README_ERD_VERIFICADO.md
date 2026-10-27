# ERD físico verificado — EcoRoute V15

Fuente exclusiva del dibujo: `../evidencias/esquema_fisico_verificado.json` exportado
del catálogo físico PostgreSQL 14.21. No se analizan ni reconstruyen V1–V8 para
dibujar el modelo. SHA256 de la fuente:
`de35e4f7b42ea6b89d5ea76bea424cac8c5aaff4a412f303a0ba4cfc4c5fbed3`.

El modelo de negocio contiene **26 tablas, cuatro vistas, 311 columnas y 27 FK
reales**. La vista global resume campos; las cuatro vistas de detalle contienen
todas las columnas. El manifiesto conserva los campos completos, tipos originales,
defaults, nulabilidad, comentarios y constraints.

| Vista | SVG editable | PNG | Dimensiones |
|---|---|---|---|
| Global: los 30 objetos y las 27 FK | [SVG](00_erd_negocio_global.svg) | [PNG](00_erd_negocio_global.png) | 4477 × 2468 |
| Recursos, flota, planificación y revisión de despacho | [SVG](01_recursos_planificacion.svg) | [PNG](01_recursos_planificacion.png) | 2236 × 1947 |
| Pedidos, datos comerciales, POD, items y avisos | [SVG](02_pedidos_evidencias.svg) | [PNG](02_pedidos_evidencias.png) | 2236 × 1997 |
| Incidencias V13, intentos, mejora, metas y auditoría | [SVG](03_incidencias_mejora.svg) | [PNG](03_incidencias_mejora.png) | 2236 × 1647 |
| Analítica, metas y catálogos sin FK | [SVG](04_analitica_catalogos.svg) | [PNG](04_analitica_catalogos.png) | 2236 × 2374 |

Los SVG tienen grupos por tabla, texto editable y tooltips con metadatos de cada
columna y definición real de cada FK. Son recursos explícitos; no se usaron
imágenes generadas por IA. PNG renderizado con Sharp bundled, tipografía medida y
QA con Pillow bundled. Abrir al 100% o ampliar para inspeccionar columnas; el
global no se diseñó para comprimirlo a una sola página A4.

## Lectura y límites

* Flecha sólida azul: columna de FK → clave referenciada, siempre tomada de un
  constraint real del JSON. No se infieren cardinalidades ni enlaces por nombre.
* PK = clave primaria; UQ = constraint UNIQUE; UQ* = participación en UNIQUE
  compuesta; ! = NOT NULL. Los índices únicos no exportados no se inventan.
* Cabeceras grises SOPORTE: historial, auditoría, outbox y notificaciones. Las
  vistas analíticas son VISTA; no se les atribuyen PK/FK de sus tablas fuente.
* Keycloak es externo. Su única conexión discontinua representa identidad lógica
  UUID `sub` ↔ `drivers.external_id` (varchar(50) local), **sin FK**. No aparece
  como tabla de la base ni se supone que el campo local tenga tipo UUID.
* `orders.driver_id` carece de FK física en el catálogo. También carecen de FK
  `improvement_actions.metric_code` y referencias polimórficas de auditoría; por
  eso no se dibujan relaciones para esos campos.
* Detalles 02 y 03 omiten dos enlaces de `routes` hacia `drivers`/`vehicles`, que
  están completos en la vista 01 y el global. Las omisiones se enumeran en el
  manifiesto y se avisan al pie. Ninguna FK falta en el global.
* Nulabilidad de vistas: metadato del catálogo, no garantía de nulabilidad del
  dato de origen. El JSON no contiene dependencias de vistas; no se dibuja linaje.
* Se excluyen nueve tablas `corp_*`, seis `auth_*` legacy y
  `local_evidence_backups` (soporte técnico V14). Flyway está fuera del ERD.
  El manifiesto enumera cada exclusión. No se oculta ninguna tabla de negocio.
* V14 respalda evidencia del emulador local; la mera existencia de un volumen
  LocalStack **no demuestra persistencia de su catálogo S3**. Esta tarea comprueba
  el esquema, no repite ni certifica el ensayo de recuperación de objetos S3.

## Verificación del SQL completo

**PASS** para `docs/base_datos/EcoRoute_BD_Completa_V1-V14.sql` en PostgreSQL 14.21
desechable. Coinciden **46/46 objetos** del export físico: nombres, tipo de objeto,
columnas en orden, tipos, nulabilidad, defaults, comentarios y todos los constraints.
El SQL incluye 13 migraciones, V1–V14 con salto V11. Incluye CORP/auth porque es
script completo, aunque esos objetos no pertenezcan al ERD de negocio.

El ensayo creó un contenedor sin red, sin puertos publicados ni montajes del
workspace, con datos en tmpfs; no se conectó a bases operativas. La segunda carga
fue rechazada por la protección para base no vacía (psql exit 3). Se verificó la
etiqueta de propiedad y se eliminó el contenedor temporal al terminar.

Evidencias:

* [Manifiesto, diccionario y relaciones](erd_verificado_manifest.json).
* [Resultado SQL y limpieza](../evidencias/validacion_sql_completo_desechable.json).
* [Catálogo reconstruido en el PostgreSQL temporal](../evidencias/validacion_sql_completo_desechable_catalogo_reconstruido.json).
* [Hoja de contacto de QA](_qa/erd_verificado_contacto.png).

La comprobación no demuestra equivalencia de funciones, triggers, índices o
privilegios frente al entorno operativo: el export recibido no contiene sus
definiciones. Sí demuestra que el SQL completo se ejecuta y que su catálogo de
tablas/vistas, columnas y constraints coincide con el export real.

## Regeneración

Generador propio: `tools/audit_e2e/build_verified_erd.py`.
Usar Python bundled de `codex-primary-runtime/dependencies/python/python.exe`:

```powershell
& $BundledPython tools/audit_e2e/build_verified_erd.py
```

Para repetir la comprobación aislada, ejecutar con acceso delegado a Docker:

```powershell
& $BundledPython tools/audit_e2e/build_verified_erd.py --verify-sql docs/base_datos/EcoRoute_BD_Completa_V1-V14.sql
```

No ejecutar el SQL completo en una base operativa. El generador sólo lo carga en
su propio contenedor desechable; no usa docker compose ni acepta URL de base real.
Si aparecen tablas de negocio no clasificadas, se detiene para revisión en vez
de omitirlas silenciosamente.
