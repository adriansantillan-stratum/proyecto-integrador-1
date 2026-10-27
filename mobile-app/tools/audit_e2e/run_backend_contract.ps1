$ErrorActionPreference = 'Stop'
# Read the existing local driver fixture without printing credentials or tokens.
# This launcher runs host Flutter tests only. No adb, device selection or APK.
$taskRepoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$taskMobileRoot = Join-Path $taskRepoRoot 'mobile-app'
$taskRealm = Get-Content -Raw -LiteralPath (Join-Path $taskRepoRoot 'ecoroute-realm.json') | ConvertFrom-Json
$taskDriver = $taskRealm.users | Where-Object { $_.realmRoles -contains 'DRIVER' } | Select-Object -First 1
if (-not $taskDriver) { throw 'No hay cuenta DRIVER en la configuración local de pruebas' }
$taskPassword = $taskDriver.credentials | Where-Object { $_.type -eq 'password' } | Select-Object -First 1
if (-not $taskPassword.value) {
  $taskReadme = Get-Content -Raw -LiteralPath (Join-Path $taskRepoRoot 'README.md')
  $taskMatch = [regex]::Match($taskReadme, 'Ingresa con `([^`]+)` / `([^`]+)`')
  if (-not $taskMatch.Success -or $taskMatch.Groups[1].Value -ne $taskDriver.username) {
    throw 'No se encontraron credenciales documentadas para la cuenta local DRIVER'
  }
  $taskPassword = @{ value = $taskMatch.Groups[2].Value }
}
$env:ECOROUTE_TEST_USER = $taskDriver.username
$env:ECOROUTE_TEST_PASSWORD = $taskPassword.value
Push-Location -LiteralPath $taskMobileRoot
try {
  flutter test --no-pub test/backend_contract_integration_test.dart --dart-define=RUN_BACKEND_CONTRACT=true --dart-define=API_BASE_URL=http://127.0.0.1:8081 --dart-define=KEYCLOAK_BASE_URL=http://127.0.0.1:8080
  $taskExit = $LASTEXITCODE
} finally {
  Pop-Location
  Remove-Item Env:ECOROUTE_TEST_USER -ErrorAction SilentlyContinue
  Remove-Item Env:ECOROUTE_TEST_PASSWORD -ErrorAction SilentlyContinue
}
exit $taskExit
