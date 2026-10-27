# get-token.ps1
# Obtiene un access token real de Keycloak vía password grant (cliente mobile-app).
# Uso:  $token = & .\get-token.ps1              (usuario admin por defecto)
#       $token = & .\get-token.ps1 -Username conductor -Password conductor123
param(
    [string]$Username = "admin",
    [string]$Password = "admin123",
    [string]$KeycloakUrl = "http://localhost:8080"
)

$body = @{
    client_id  = "mobile-app"
    grant_type = "password"
    username   = $Username
    password   = $Password
}

try {
    $response = Invoke-RestMethod -Uri "$KeycloakUrl/realms/ecoroute/protocol/openid-connect/token" `
        -Method Post -Body $body -ContentType "application/x-www-form-urlencoded"
    return $response.access_token
} catch {
    Write-Error "No se pudo obtener token de Keycloak ($KeycloakUrl) para '$Username'. ¿Está Keycloak corriendo y configurado? Ejecuta ./setup-keycloak.ps1"
    exit 1
}
