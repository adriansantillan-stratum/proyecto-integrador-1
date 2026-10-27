# EcoRoute Keycloak Setup Script
# Configura el realm, clientes, roles y usuarios de desarrollo.
# Idempotente a nivel práctico: los "create" fallan silenciosamente si ya existen.

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Iniciando Configuración de Keycloak para EcoRoute" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$KC_CONTAINER = "ecoroute-keycloak"
$KCADM = "/opt/keycloak/bin/kcadm.sh"

# 1. Autenticación
Write-Host "[1/8] Autenticando como administrador..." -ForegroundColor Yellow
docker exec $KC_CONTAINER $KCADM config credentials --server http://localhost:8080 --realm master --user admin --password admin

# 2. Crear Realm
Write-Host "[2/8] Creando Realm 'ecoroute'..." -ForegroundColor Yellow
docker exec $KC_CONTAINER $KCADM create realms -s realm=ecoroute -s enabled=true

# 3. Cliente 'mobile-app': app Flutter del conductor.
#    Direct access grants local. Token de 10 min y renovación segura en móvil.
Write-Host "[3/8] Creando Cliente 'mobile-app'..." -ForegroundColor Yellow
docker exec $KC_CONTAINER $KCADM create clients -r ecoroute `
    -s clientId=mobile-app `
    -s publicClient=true `
    -s directAccessGrantsEnabled=true `
    -s standardFlowEnabled=false `
    -s 'attributes."access.token.lifespan"=600'

# 4. Cliente 'web-admin': panel React.
#    Authorization Code + PKCE obligatorio, sin password grant.
Write-Host "[4/8] Creando Cliente 'web-admin'..." -ForegroundColor Yellow
docker exec $KC_CONTAINER $KCADM create clients -r ecoroute `
    -s clientId=web-admin `
    -s publicClient=true `
    -s standardFlowEnabled=true `
    -s directAccessGrantsEnabled=false `
    -s 'redirectUris=["http://localhost:3000/*","http://localhost:5173/*"]' `
    -s 'webOrigins=["http://localhost:3000","http://localhost:5173"]' `
    -s 'attributes."pkce.code.challenge.method"=S256'

# 5. Roles del realm
Write-Host "[5/8] Creando Roles DRIVER / ADMIN / DISPATCHER..." -ForegroundColor Yellow
docker exec $KC_CONTAINER $KCADM create roles -r ecoroute -s name=DRIVER
docker exec $KC_CONTAINER $KCADM create roles -r ecoroute -s name=ADMIN
docker exec $KC_CONTAINER $KCADM create roles -r ecoroute -s name=DISPATCHER

# 6. Usuario conductor (app móvil)
Write-Host "[6/8] Creando Usuario 'conductor'..." -ForegroundColor Yellow
docker exec $KC_CONTAINER $KCADM create users -r ecoroute -s username=conductor -s enabled=true -s firstName=Juan -s lastName=Perez
docker exec $KC_CONTAINER $KCADM set-password -r ecoroute --username conductor --new-password conductor123 --temporary=$false
docker exec $KC_CONTAINER $KCADM add-roles -r ecoroute --uusername conductor --rolename DRIVER

# 7. Usuario admin (panel web) — SOLO PARA DESARROLLO
Write-Host "[7/8] Creando Usuario 'admin' (panel web)..." -ForegroundColor Yellow
docker exec $KC_CONTAINER $KCADM create users -r ecoroute -s username=admin -s enabled=true -s firstName=Admin -s lastName=EcoRoute
docker exec $KC_CONTAINER $KCADM set-password -r ecoroute --username admin --new-password admin123 --temporary=$false
docker exec $KC_CONTAINER $KCADM add-roles -r ecoroute --uusername admin --rolename ADMIN

# 8. Resumen
Write-Host "[8/8] Listo." -ForegroundColor Yellow
Write-Host ""
Write-Host "Configuración completada con éxito." -ForegroundColor Green
Write-Host "  App móvil:  conductor / conductor123  (rol DRIVER)" -ForegroundColor Green
Write-Host "  Panel web:  admin / admin123          (rol ADMIN)" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
