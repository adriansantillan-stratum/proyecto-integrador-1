param([string]$Image='osrm/osrm-backend')
$ErrorActionPreference='Stop'
$ecoRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$ecoData=[IO.Path]::GetFullPath((Join-Path $ecoRoot 'infra/osrm'))
if(-not $ecoData.StartsWith($ecoRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Directorio de mapas fuera del proyecto.'}
if($Image -notmatch '^[a-zA-Z0-9./:_-]+$'){throw 'Nombre de imagen no válido.'}
$null=New-Item -ItemType Directory -Force -Path $ecoData
$ecoPbf=Join-Path $ecoData 'peru-latest.osm.pbf'
$ecoReady=Join-Path $ecoData 'ecoroute-mld-ready.json'
if(Test-Path -LiteralPath $ecoReady){Write-Output 'Existe una preparación MLD. Se conserva; compruebe que la imagen coincide con docker-compose.yml.';exit 0}
if((Get-ChildItem -LiteralPath $ecoData -Filter 'peru-latest.osrm*' -File).Count -gt 0){throw 'Hay archivos OSRM previos. Se conservan. Revise su procedencia antes de regenerar en otro directorio.'}
if(-not (Test-Path -LiteralPath $ecoPbf)){
 $ecoDownload=$ecoPbf+'.part'
 if(Test-Path -LiteralPath $ecoDownload){throw 'Existe una descarga parcial; revísela antes de repetir.'}
 Invoke-WebRequest -Uri 'https://download.geofabrik.de/south-america/peru-latest.osm.pbf' -OutFile $ecoDownload
 Move-Item -LiteralPath $ecoDownload -Destination $ecoPbf
}
foreach($ecoOperation in @('extract','partition','customize')){
 if($ecoOperation -eq 'extract'){
  & docker run --rm -v "${ecoData}:/data" $Image osrm-extract -p /opt/car.lua /data/peru-latest.osm.pbf
 }else{
  & docker run --rm -v "${ecoData}:/data" $Image ("osrm-"+$ecoOperation) /data/peru-latest.osrm
 }
 if($LASTEXITCODE -ne 0){throw ("OSRM falló en "+$ecoOperation+". Se conservan los archivos para diagnóstico.")}
}
@{generatedAt=[DateTimeOffset]::UtcNow.ToString('o');image=$Image;source='https://download.geofabrik.de/south-america/peru.html';pbfSha256=(Get-FileHash -LiteralPath $ecoPbf -Algorithm SHA256).Hash;profile='car';algorithm='mld'} | ConvertTo-Json | Set-Content -LiteralPath $ecoReady
Write-Output 'Mapa preparado. Inicie osrm con la misma imagen. Los datos generados no forman parte del repositorio.'
