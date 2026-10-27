// Genera un instalador SQL único a partir de las migraciones que usa Flyway.
// No modifica las migraciones ni la base de datos en ejecución.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const migrationsDir = join(root, 'src', 'main', 'resources', 'db', 'migration');
const outputDir = join(root, 'docs', 'base_datos');
const outputFile = join(outputDir, 'EcoRoute_BD_Completa_V1-V8.sql');
const migrations = [
  'V1__create_orders_table.sql',
  'V2__create_additional_tables.sql',
  'V3__create_rbac_tables.sql',
  'V4__corporate_erp_schema.sql',
  'V5__fix_schema_and_add_routes.sql',
  'V6__enterprise_logistics_expansion.sql',
  'V7__feature_expansion.sql',
  'V8__route_geometry_and_stop_sequence.sql',
];

const parts = [
  `-- ============================================================================
-- ECOROUTE: BASE DE DATOS POSTGRESQL COMPLETA (MIGRACIONES V1 A V8)
-- Generado desde src/main/resources/db/migration. PostgreSQL 14+.
--
-- USO: solo en una base de datos VACIA ya creada (docker-compose crea ecoroute).
--   psql -v ON_ERROR_STOP=1 -U user -d ecoroute -f EcoRoute_BD_Completa_V1-V8.sql
-- Si la app inicia con Flyway habilitado, use preferentemente las migraciones
-- originales. Este instalador NO registra flyway_schema_history y NO debe
-- ejecutarse sobre una base ya migrada: fallaria o duplicaria los datos semilla.
--
-- INCLUYE: tablas, PK/FK, restricciones, indices, comentarios y datos semilla
-- de RBAC (V3). V4 tambien contiene datos corporativos FICTICIOS heredados;
-- NO son datos reales de MICOTRANS. NO incluye los scripts populate*.sql.
-- Keycloak usa una base de identidad separada y no forma parte de este SQL.
-- ============================================================================

BEGIN;

DO $$
BEGIN
    IF to_regclass('public.orders') IS NOT NULL
       OR to_regclass('public.auth_module') IS NOT NULL
       OR to_regclass('public.corp_branches') IS NOT NULL THEN
        RAISE EXCEPTION 'EcoRoute: el esquema ya existe. Use Flyway o una base vacia; no aplique este instalador encima.';
    END IF;
END
$$;
`,
];

for (const name of migrations) {
  const sql = (await readFile(join(migrationsDir, name), 'utf8')).trimEnd();
  parts.push(`\n-- ============================================================================\n-- ${name}\n-- ============================================================================\n${sql}\n`);
}
parts.push('\nCOMMIT;\n');

await mkdir(outputDir, { recursive: true });
await writeFile(outputFile, parts.join('\n'), { encoding: 'utf8' });
console.log(outputFile);
