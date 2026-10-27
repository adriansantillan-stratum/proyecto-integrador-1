# Modelo de datos y ERD de EcoRoute (estado físico V1–V8)

Fuente de verdad: `src/main/resources/db/migration/V1__...sql` hasta `V8__...sql`.
El archivo `../EcoRoute_BD_Completa_V1-V8.sql` reúne esas mismas migraciones.
No se infieren relaciones a partir del nombre de una columna: solo se dibujan
como FK físicas las declaradas en SQL.

## Entregables

| Archivo | Contenido |
|---|---|
| `00_vista_general.svg` / `.png` | Inventario de las 33 entidades por dominio y registro de relaciones. |
| `01_operacion.svg` / `.png` | Núcleo operativo: rutas, pedidos, pruebas, GPS, productos y notificaciones. |
| `02_flota_soporte.svg` / `.png` | Flota, contratos, turnos, combustible, mantenimiento, gastos, incidentes, hubs y compras. |
| `03_seguridad.svg` / `.png` | RBAC local `auth_*`; Keycloak queda fuera por usar otra base. |
| `04_corporativo_referencia.svg` / `.png` | Bloque corporativo `corp_*` de referencia. |
| `EcoRoute_ERD_Completo.mmd` | ERD único editable en Mermaid: **todos** los campos y las 27 FK. |
| `01_...mmd` a `04_...mmd` | Mermaid editable por dominio. |
| `inventario_modelo.json` | Inventario verificable de tipos, nulabilidad, PK, FK, unicidad y valores por defecto. |

Se contabilizaron **33 tablas, 239 columnas y 27 claves foráneas físicas**.
Los diagramas SVG son vectoriales y admiten ampliación sin pérdida. Las
entidades `drivers`, `vehicles` y `routes` se repiten visualmente entre las
vistas 1 y 2; son las mismas tablas, no tablas adicionales.

## Cardinalidades y restricciones

- `||`: un padre obligatorio para cada fila hija (`FK NOT NULL`).
- `o|`: cero o un padre (`FK NULL`) o, en el extremo hijo, cero o una fila
  hija si la FK es única.
- `o{`: cero o muchas filas hijas; la BD no obliga al padre a tener hijas.
- Solo `delivery_proofs.order_id` es `NOT NULL UNIQUE` entre las relaciones
  operativas: una prueba de entrega corresponde a exactamente un pedido y
  cada pedido puede tener cero o una prueba.
- `driver_contracts.driver_id` es `UNIQUE` pero admite `NULL`.
- `order_items.order_id` tiene `ON DELETE CASCADE`; las demás FK no declaran
  explícitamente cascada en estas migraciones.

Restricciones compuestas existentes que no caben visualmente en las cajas:

- `auth_resource`: `UNIQUE(module_id, resource_name)`.
- `auth_role`: `UNIQUE(country_code, role_name)`.
- `auth_permission`: `UNIQUE(role_id, resource_id, action_id)`.
- `auth_user_role`: `UNIQUE(user_external_id, role_id)`.

## Relaciones no materializadas: no son FK

| Campo o entidad | Estado en V1–V8 | Implicación para diseño |
|---|---|---|
| `orders.driver_id` | `BIGINT` sin `REFERENCES drivers(id)` | La BD no garantiza un conductor válido; el conductor también puede derivarse de `orders.route_id → routes.driver_id`. Definir regla de negocio antes de añadir FK. |
| `corp_maintenance_logs.vehicle_id` | `BIGINT` sin FK | No protege integridad con `vehicles`; existe otra tabla física `vehicle_maintenance_logs` que sí tiene FK. |
| `auth_user_role.user_external_id` | ID externo sin FK | Es un identificador de Keycloak, cuya base es independiente. La vinculación requiere lógica de aplicación/API, no FK entre bases. |
| `hubs`, `purchases`, `corp_fleet_types` | Tablas sin FK | No existe enlace físico al flujo de rutas, proveedores o vehículos. |
| `corp_*` ↔ núcleo operativo | Sin FK entre bloques | No presentar el módulo corporativo como integración ERP ya conectada. Los registros semilla V4 son ficticios, no de MICOTRANS. |

Además, el código `UserRoleEntity` declara una columna `user_role_id` para
`auth_user_role`, pero V3 crea la PK con nombre `id`. El ERD sigue el SQL, no
el mapeo Java. Es una inconsistencia a corregir por separado.

## Cómo regenerar

Desde la raíz del repositorio:

```powershell
python tools/generate_erd_ecoroute.py
node tools/render_erd_ecoroute.mjs
```

El renderizador usa la dependencia `sharp` del runtime de trabajo de Codex;
los `.svg` y `.mmd` se generan sin esa dependencia. No ejecutar el script SQL
consolidado sobre una base en la que Flyway ya haya aplicado V1–V8.
