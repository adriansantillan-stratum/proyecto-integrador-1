# ERD del negocio de EcoRoute

Derivado de las migraciones Flyway V1–V8: **16 tablas, 141 columnas y 17 FK físicas**. La vista general y las ocho vistas de detalle muestran el núcleo de reparto; las tablas repetidas entre vistas son la misma entidad. `EcoRoute_ERD_Negocio.mmd` es la fuente editable.

En las vistas del núcleo conectado se excluyen `corp_*` (referencia heredada), `auth_*` (RBAC técnico), `hubs` y `purchases` (sin FK al grafo de entregas). Compras sigue siendo una función del proyecto; `hubs` y `purchases` sí aparecen, como entidades aisladas, en la nueva vista física integral. La base de Keycloak es externa.

## Vista física integral tipo DBeaver

`09_vista_completa_tipo_dbeaver.svg` es la vista ampliable de **las 18 tablas del dominio operativo, 159 columnas y 17 FK físicas**. Incluye `hubs` y `purchases` como tablas aisladas, porque sí existen en PostgreSQL aunque no tienen relación foránea declarada con el reparto. El PNG homónimo permite insertarla en Word y PowerPoint. Cada caja muestra todas sus columnas, tipo SQL, nulabilidad y marcas PK/FK/UQ; los conectores llegan a las filas de las claves físicas.

La vista se contrastó con la base en ejecución: Flyway V1–V8 aplicadas, **33 tablas, 239 columnas y 27 FK** en el esquema completo, sin contar `flyway_schema_history`. No es una captura de DBeaver ni un diseño futuro: representa el DDL actual. `corp_*`, `auth_*` y la base separada de Keycloak quedan fuera de este diagrama de negocio; el diccionario de datos del capítulo 2 los documenta por separado.

Regeneración: `python tools/generate_dbeaver_business_erd.py`. El SVG es la fuente vectorial para zoom y revisión de claves. Las decisiones pendientes (por ejemplo, `orders.driver_id` sin FK a `drivers`) se describen en el capítulo 2 y **no** se dibujan como relaciones existentes.

`orders.driver_id` figura como BIGINT en la tabla, pero **no tiene FK** a `drivers`. La asignación referencial declarada es `orders.route_id → routes.id → drivers.id`. Solo `delivery_proofs.order_id` es FK NOT NULL y UNIQUE: un pedido tiene cero o una POD. `driver_contracts.driver_id` es FK UNIQUE, pero nullable. Las demás cardinalidades proceden de la nulabilidad y unicidad de cada FK.

Convenciones de las láminas: PK = clave primaria; FK = clave foránea declarada; UQ = valor único (FK·UQ si aplica a una FK); `*` = NOT NULL; `||` = uno; `o|` = cero o uno; `o{` = cero a muchos. Los tipos se presentan en formato PostgreSQL (`TIMESTAMPTZ` abrevia `TIMESTAMP WITH TIME ZONE`).
