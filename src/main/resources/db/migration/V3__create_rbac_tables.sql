-- V3: RBAC Schema and Data Seeding

-- 1. Modules
CREATE TABLE auth_module (
    module_id BIGSERIAL PRIMARY KEY,
    module_name VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Resources
CREATE TABLE auth_resource (
    resource_id BIGSERIAL PRIMARY KEY,
    resource_name VARCHAR(50) NOT NULL,
    description VARCHAR(255),
    module_id BIGINT NOT NULL REFERENCES auth_module(module_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(module_id, resource_name)
);

-- 3. Actions
CREATE TABLE auth_action (
    action_id BIGSERIAL PRIMARY KEY,
    action_name VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Roles
CREATE TABLE auth_role (
    role_id BIGSERIAL PRIMARY KEY,
    role_name VARCHAR(50) NOT NULL,
    description VARCHAR(255),
    country_code VARCHAR(5) DEFAULT 'PE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(country_code, role_name)
);

-- 5. Permissions (Association Table)
CREATE TABLE auth_permission (
    permission_id BIGSERIAL PRIMARY KEY,
    role_id BIGINT NOT NULL REFERENCES auth_role(role_id),
    resource_id BIGINT NOT NULL REFERENCES auth_resource(resource_id),
    action_id BIGINT NOT NULL REFERENCES auth_action(action_id),
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(role_id, resource_id, action_id)
);

-- 6. User-Role Assignment (Linking Keycloak Users to Local Roles)
CREATE TABLE auth_user_role (
    id BIGSERIAL PRIMARY KEY,
    user_external_id VARCHAR(50) NOT NULL, -- Keycloak UUID
    role_id BIGINT NOT NULL REFERENCES auth_role(role_id),
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_external_id, role_id)
);

-- =============================================================================
-- SEED DATA (Initial Configuration)
-- =============================================================================

-- Modules
INSERT INTO auth_module (module_name, description) VALUES 
('SEGURIDAD', 'Gestión de Identidad y Accesos'),
('OPERACIONES', 'Gestión Logística y Despacho'),
('REPORTES', 'Inteligencia de Negocios');

-- Resources
INSERT INTO auth_resource (resource_name, description, module_id) VALUES 
('USERS', 'Gestión de Usuarios', (SELECT module_id FROM auth_module WHERE module_name = 'SEGURIDAD')),
('ROLES', 'Gestión de Roles', (SELECT module_id FROM auth_module WHERE module_name = 'SEGURIDAD')),
('ORDERS', 'Gestión de Pedidos', (SELECT module_id FROM auth_module WHERE module_name = 'OPERACIONES')),
('ROUTES', 'Gestión de Rutas', (SELECT module_id FROM auth_module WHERE module_name = 'OPERACIONES')),
('DASHBOARD', 'Visualización de Métricas', (SELECT module_id FROM auth_module WHERE module_name = 'REPORTES'));

-- Actions
INSERT INTO auth_action (action_name, description) VALUES 
('CREATE', 'Crear registros'),
('READ', 'Consultar información'),
('UPDATE', 'Modificar registros'),
('DELETE', 'Eliminar registros'),
('EXPORT', 'Exportar datos'),
('APPROVE', 'Aprobar transacciones');

-- Roles
INSERT INTO auth_role (role_name, description) VALUES 
('ADMIN', 'Administrador del Sistema'),
('DRIVER', 'Conductor'),
('DISPATCHER', 'Despachador/Operador Logístico');

-- Permissions Seeding (Example: Admin has full access)
INSERT INTO auth_permission (role_id, resource_id, action_id)
SELECT r.role_id, res.resource_id, a.action_id
FROM auth_role r
CROSS JOIN auth_resource res
CROSS JOIN auth_action a
WHERE r.role_name = 'ADMIN';

-- Permissions for Driver (Read Routes, Update Orders status)
INSERT INTO auth_permission (role_id, resource_id, action_id)
SELECT r.role_id, res.resource_id, a.action_id
FROM auth_role r
JOIN auth_resource res ON res.resource_name IN ('ROUTES', 'ORDERS')
JOIN auth_action a ON a.action_name IN ('READ', 'UPDATE')
WHERE r.role_name = 'DRIVER';
