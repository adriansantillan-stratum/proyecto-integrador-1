$ErrorActionPreference='Stop'
$ecoRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$ecoRuntime=Join-Path $ecoRoot 'docs/guia_total_ide/.runtime'
$ecoEventLine=Get-Content -LiteralPath (Join-Path $ecoRuntime 'flutter_isolated.log') | Where-Object { $_ -match '"event":"app.debugPort"' } | Select-Object -Last 1
if(-not $ecoEventLine){throw 'La aplicación todavía no ha publicado el servicio de depuración.'}
$ecoEvent=($ecoEventLine | ConvertFrom-Json)[0]
$ecoUri=[Uri]$ecoEvent.params.wsUri
if($ecoUri.Host -ne '127.0.0.1'){throw 'Solo se admite el depurador local.'}
$ecoHttp=$ecoUri.AbsoluteUri -replace '^ws:','http:' -replace '/ws$','/'
@{uri=$ecoHttp} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $ecoRuntime 'flutter_service.json')
Write-Output 'Referencia privada de Flutter preparada. Conecte la configuración F5 del workspace Flutter.'
