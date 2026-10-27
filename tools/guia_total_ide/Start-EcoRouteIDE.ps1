param(
    [ValidateSet('Infra','Backend','Web','Flutter','Check')][string]$Component='Check',
    [string]$Device='emulator-5556',
    [switch]$IsolatedAndroidBuild
)
$ErrorActionPreference='Stop'
$ecoRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
Set-Location -LiteralPath $ecoRoot
# Load existing local configuration without evaluating shell expressions or printing secrets.
$ecoEnvFile=Join-Path $ecoRoot '.env'
if(Test-Path -LiteralPath $ecoEnvFile){
    foreach($ecoLine in [IO.File]::ReadAllLines($ecoEnvFile)){
        if($ecoLine -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$'){
            $ecoKey=$Matches[1]; $ecoValue=$Matches[2].Trim()
            if(($ecoValue.StartsWith('"') -and $ecoValue.EndsWith('"')) -or ($ecoValue.StartsWith("'") -and $ecoValue.EndsWith("'"))){$ecoValue=$ecoValue.Substring(1,$ecoValue.Length-2)}
            [Environment]::SetEnvironmentVariable($ecoKey,$ecoValue,'Process')
        }
    }
}
switch($Component){
    'Infra' {
        & docker compose -f docker-compose.yml -f docker-compose.ide.yml up -d postgres redis keycloak localstack osrm
        exit $LASTEXITCODE
    }
    'Backend' {
        $ecoJdk='C:/Program Files/Eclipse Adoptium/jdk-17.0.17.10-hotspot'
        if(Test-Path -LiteralPath $ecoJdk){$env:JAVA_HOME=$ecoJdk;$env:PATH=(Join-Path $ecoJdk 'bin')+';'+$env:PATH}
        & ./gradlew.bat bootRun --no-daemon --console=plain -I tools/guia_total_ide/debug_backend.init.gradle '--args=--spring.profiles.active=local,ide'
        exit $LASTEXITCODE
    }
    'Web' {
        Set-Location -LiteralPath (Join-Path $ecoRoot 'web-admin')
        & node ./node_modules/vite/bin/vite.js --host 127.0.0.1 --port 3000 --strictPort
        exit $LASTEXITCODE
    }
    'Flutter' {
        if($Device -notmatch '^emulator-\d+$'){throw 'Esta demostración se limita al emulador autorizado.'}
        $ecoMobile=Join-Path $ecoRoot 'mobile-app'
        if($IsolatedAndroidBuild){
            $ecoCopy=Get-Content (Join-Path $ecoRoot 'docs/guia_total_ide/.runtime/mobile_copy.json') -Raw | ConvertFrom-Json
            $ecoMobile=[IO.Path]::GetFullPath($ecoCopy.target)
            $ecoTemp=[IO.Path]::GetFullPath([IO.Path]::GetTempPath())
            if(-not $ecoMobile.StartsWith($ecoTemp,[StringComparison]::OrdinalIgnoreCase) -or -not ([IO.Path]::GetFileName($ecoMobile)).StartsWith('ecoroute-ide-mobile-')){throw 'La copia de compilación no pertenece al directorio temporal esperado.'}
            foreach($ecoSource in $ecoCopy.hashes){
                $ecoHash=(Get-FileHash -LiteralPath (Join-Path (Join-Path $ecoRoot 'mobile-app') $ecoSource.file) -Algorithm SHA256).Hash
                if($ecoHash -ne $ecoSource.sha256){throw ('Cambió un fuente; regenere la copia: '+$ecoSource.file)}
            }
        }
        Set-Location -LiteralPath $ecoMobile
        & flutter build apk --debug --target-platform android-x64 --build-number=9006 '--dart-define=API_BASE_URL=http://10.0.2.2:8081' '--dart-define=KEYCLOAK_BASE_URL=http://10.0.2.2:8080'
        if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
        $ecoApk=Join-Path $ecoMobile 'build/app/outputs/flutter-apk/app-debug.apk'
        $ecoRuntime=Join-Path $ecoRoot 'docs/guia_total_ide/.runtime'
        $null=New-Item -ItemType Directory -Force -Path $ecoRuntime
        & flutter run -d $Device --debug --machine --host-vmservice-port=8181 --dds-port=8182 "--use-application-binary=$ecoApk" '--dart-define=API_BASE_URL=http://10.0.2.2:8081' '--dart-define=KEYCLOAK_BASE_URL=http://10.0.2.2:8080' 2>&1 | Tee-Object -FilePath (Join-Path $ecoRuntime 'flutter_isolated.log')
        exit $LASTEXITCODE
    }
    'Check' {
        foreach($ecoPort in @(3000,8080,8081,5433,5000,4566,16379,5005)){
            $ecoListener=Get-NetTCPConnection -State Listen -LocalPort $ecoPort -ErrorAction SilentlyContinue
            [pscustomobject]@{Port=$ecoPort;Listening=[bool]$ecoListener}
        }
    }
}
