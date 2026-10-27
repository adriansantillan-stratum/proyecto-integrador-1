# Captura las pantallas de la app movil EcoRoute Driver desde el emulador
# para material de presentacion (prototipos, tesis, pitch comercial).
#
# Requiere: emulador corriendo con la app instalada y el backend arriba.
# Uso:  .\tools\capture_mobile.ps1
# Salida: docs/screenshots/mobile-*.png

$ErrorActionPreference = "Stop"
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
$outDir = Join-Path $PSScriptRoot "..\docs\screenshots"
New-Item -ItemType Directory -Force $outDir | Out-Null

function Save-Screen([string]$name) {
    $path = Join-Path $outDir "$name.png"
    & $adb exec-out screencap -p > $path
    Write-Host "  $name.png"
}

Write-Host "Capturando pantallas de la app movil..." -ForegroundColor Cyan
Save-Screen "mobile-01-login"

# Login del conductor
& $adb shell input tap 671 1641; Start-Sleep -Milliseconds 700
& $adb shell input text "conductor"
& $adb shell input tap 671 1856; Start-Sleep -Milliseconds 700
& $adb shell input text "conductor123"
& $adb shell input keyevent 111   # ESC: cerrar teclado
Start-Sleep -Milliseconds 400
& $adb shell input tap 671 2112   # INGRESAR
Start-Sleep -Seconds 8

Save-Screen "mobile-02-rutas-mapa"

# Detalle de un pedido (primer item de la lista)
& $adb shell input tap 671 1640
Start-Sleep -Seconds 3
Save-Screen "mobile-03-detalle-pedido"

# Volver a la lista
& $adb shell input keyevent 4
Start-Sleep -Seconds 2

Write-Host "Listo: $outDir" -ForegroundColor Green
