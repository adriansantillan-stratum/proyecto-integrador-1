#requires -Version 7.0
<#
Read-only local runtime verification. The only persistent write is the fixed
sanitized JSON report. Never reads config files, environment dumps, command
lines, logs, HTTP bodies, Docker inspect data, or Dart VM service URIs.
Does not start/restart/build/install/forward anything or interact with UI.
#>
[CmdletBinding()]
param(
    [ValidatePattern('^(emulator-[0-9]+|[A-Za-z0-9._:-]+)?$')]
    [string]$DeviceSerial = '',
    [ValidateRange(1, 15)]
    [int]$TimeoutSeconds = 5
)

$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$reportPath = Join-Path $projectRoot 'docs/guia_total_ide/ejecucion_20261026/runtime_verification.json'
$package = 'com.example.ecoroute_driver_app'

function Invoke-ReadOnlyQuery {
    param([string]$Executable, [string[]]$Arguments)
    $process = $null
    try {
        $start = [Diagnostics.ProcessStartInfo]::new()
        $start.FileName = $Executable
        $start.UseShellExecute = $false
        $start.CreateNoWindow = $true
        $start.RedirectStandardOutput = $true
        $start.RedirectStandardError = $true
        foreach ($argument in $Arguments) { $start.ArgumentList.Add($argument) }
        $process = [Diagnostics.Process]::new()
        $process.StartInfo = $start
        [void]$process.Start()
        $outputTask = $process.StandardOutput.ReadToEndAsync()
        # Discard diagnostics without retaining/printing possible private data.
        $discardTask = $process.StandardError.BaseStream.CopyToAsync([IO.Stream]::Null)
        if (-not $process.WaitForExit($TimeoutSeconds * 1000)) {
            # Only terminate this verifier's own timed-out query, never an app.
            $process.Kill()
            $process.WaitForExit()
            return @{ ok = $false; exitCode = $null; output = ''; reason = 'QUERY_TIMEOUT' }
        }
        $discardTask.GetAwaiter().GetResult()
        return @{ ok = ($process.ExitCode -eq 0); exitCode = $process.ExitCode;
            output = $outputTask.GetAwaiter().GetResult(); reason = 'QUERY_FINISHED' }
    } catch {
        return @{ ok = $false; exitCode = $null; output = ''; reason = 'QUERY_UNAVAILABLE' }
    } finally {
        if ($null -ne $process) { $process.Dispose() }
    }
}

function Test-LocalHttp {
    param([string]$Name, [int]$Port, [string]$Path)
    $handler = [Net.Http.HttpClientHandler]::new()
    $handler.AllowAutoRedirect = $false
    $handler.UseProxy = $false
    $client = [Net.Http.HttpClient]::new($handler)
    $client.Timeout = [TimeSpan]::FromSeconds($TimeoutSeconds)
    $response = $null
    try {
        $response = $client.GetAsync("http://127.0.0.1:$Port$Path",
            [Net.Http.HttpCompletionOption]::ResponseHeadersRead).GetAwaiter().GetResult()
        $code = [int]$response.StatusCode
        return [ordered]@{ component = $Name; port = $Port; path = $Path;
            status = $(if ($code -eq 200) { 'PASS' } else { 'FAIL' });
            httpStatus = $code; scope = 'HTTP_HEADERS_ONLY'; bodyRead = $false }
    } catch {
        return [ordered]@{ component = $Name; port = $Port; path = $Path;
            status = 'UNAVAILABLE'; httpStatus = $null;
            scope = 'HTTP_HEADERS_ONLY'; bodyRead = $false }
    } finally {
        if ($null -ne $response) { $response.Dispose() }
        $client.Dispose()
    }
}

$http = @(
    Test-LocalHttp -Name 'backendHealth' -Port 8081 -Path '/actuator/health'
    Test-LocalHttp -Name 'web' -Port 3000 -Path '/'
    Test-LocalHttp -Name 'keycloakRealm' -Port 8080 -Path '/realms/ecoroute/.well-known/openid-configuration'
)

# Read only process names, numeric IDs and parent IDs; no CommandLine/VM URI.
$processRows = @()
$processReadStatus = 'PASS'
try {
    $processRows = @(Get-CimInstance -Query (
        "SELECT Name, ProcessId, ParentProcessId FROM Win32_Process WHERE " +
        "Name='java.exe' OR Name='javaw.exe' OR Name='node.exe' OR " +
        "Name='dart.exe' OR Name='dartaotruntime.exe' OR Name='flutter.exe'"
    ) -ErrorAction Stop | ForEach-Object {
        [ordered]@{ name = [string]$_.Name; pid = [int]$_.ProcessId;
            parentPid = [int]$_.ParentProcessId }
    })
} catch { $processReadStatus = 'UNAVAILABLE' }

$listenerRows = @()
$listenerReadStatus = 'PASS'
try {
    $listenerRows = @(Get-NetTCPConnection -State Listen -ErrorAction Stop |
        Where-Object { $_.LocalPort -in @(8081, 3000, 8080, 5005, 9006) } |
        Select-Object LocalPort, OwningProcess -Unique | ForEach-Object {
            $ownerName = 'UNKNOWN'
            try { $ownerName = (Get-Process -Id $_.OwningProcess -ErrorAction Stop).ProcessName }
            catch { }
            [ordered]@{ port = [int]$_.LocalPort; pid = [int]$_.OwningProcess;
                processName = $ownerName }
        })
} catch { $listenerReadStatus = 'UNAVAILABLE' }

$backendOwners = @($listenerRows | Where-Object { $_.port -eq 8081 })
$webOwners = @($listenerRows | Where-Object { $_.port -eq 3000 })
$debugOwners = @($listenerRows | Where-Object { $_.port -eq 5005 })
$sourceProcesses = [ordered]@{
    status = $processReadStatus
    backendJava = @($processRows | Where-Object { $_.name -in @('java.exe', 'javaw.exe') })
    webNodeViteCandidates = @($processRows | Where-Object { $_.name -eq 'node.exe' })
    flutterDartCandidates = @($processRows | Where-Object {
        $_.name -in @('dart.exe', 'dartaotruntime.exe', 'flutter.exe') })
    backend8081Owners = $backendOwners
    web3000Owners = $webOwners
    javaDebug5005Owners = $debugOwners
    javaOwns8081 = [bool]@($backendOwners | Where-Object { $_.processName -match '^javaw?$' }).Count
    nodeOwns3000 = [bool]@($webOwners | Where-Object { $_.processName -eq 'node' }).Count
    sourceOrIdeLaunchConfirmed = $false
    limitation = 'PID/name/port evidence only; Vite, source checkout, Flutter session and IDE attachment are not proven without reading private command lines or separate IDE evidence.'
}

# Inspect only named EcoRoute containers, with name/state fields. No env/logs.
$dependencies = @('ecoroute-db', 'ecoroute-redis', 'ecoroute-keycloak', 'ecoroute-localstack', 'ecoroute-osrm')
$applicationContainers = @('ecoroute-backend', 'ecoroute-web-admin')
$docker = [ordered]@{ status = 'UNAVAILABLE'; scope = 'EXPECTED_ECOROUTE_CONTAINER_NAMES';
    dependencies = @(); applicationContainers = @(); onlyDependenciesRunning = $null }
$dockerCommand = Get-Command docker.exe -ErrorAction SilentlyContinue
if ($null -ne $dockerCommand) {
    $result = Invoke-ReadOnlyQuery -Executable $dockerCommand.Source -Arguments @(
        'container', 'ls', '--all', '--filter',
        'name=^/ecoroute-(db|redis|keycloak|localstack|osrm|backend|web-admin)$',
        '--format', '{{.Names}}|{{.State}}'
    )
    if ($result.ok) {
        $states = @{}
        foreach ($line in ($result.output -split '\r?\n')) {
            if ($line -match '^(ecoroute-(?:db|redis|keycloak|localstack|osrm|backend|web-admin))\|(created|running|paused|restarting|removing|exited|dead)$') {
                $states[$Matches[1]] = $Matches[2]
            }
        }
        $docker.dependencies = @($dependencies | ForEach-Object {
            [ordered]@{ name = $_; state = $(if ($states.ContainsKey($_)) { $states[$_] } else { 'missing' }) }
        })
        $docker.applicationContainers = @($applicationContainers | ForEach-Object {
            [ordered]@{ name = $_; state = $(if ($states.ContainsKey($_)) { $states[$_] } else { 'missing' }) }
        })
        $appsActive = @($docker.applicationContainers | Where-Object { $_.state -in @('running', 'paused', 'restarting') }).Count
        $depsActive = @($docker.dependencies | Where-Object { $_.state -eq 'running' }).Count
        $docker.onlyDependenciesRunning = ($appsActive -eq 0 -and $depsActive -gt 0)
        $docker.status = if ($appsActive -eq 0 -and $depsActive -eq $dependencies.Count) { 'PASS' } else { 'FAIL' }
    }
}

$adbExecutable = $null
$adbCommand = Get-Command adb.exe -ErrorAction SilentlyContinue
if ($null -ne $adbCommand) { $adbExecutable = $adbCommand.Source }
if (-not $adbExecutable) {
    # Only well-known SDK path variables, never an environment dump.
    $sdkRoots = @($env:ANDROID_HOME, $env:ANDROID_SDK_ROOT,
        (Join-Path $env:LOCALAPPDATA 'Android/Sdk'), 'C:/Android/Sdk', 'C:/Android',
        'C:/tools/android-sdk', 'C:/tools/android', 'C:/Android/android-sdk')
    foreach ($sdkRoot in $sdkRoots) {
        if ([string]::IsNullOrWhiteSpace($sdkRoot)) { continue }
        $candidate = Join-Path $sdkRoot 'platform-tools/adb.exe'
        if (Test-Path -LiteralPath $candidate -PathType Leaf) { $adbExecutable = $candidate; break }
    }
}
$adb = [ordered]@{ status = 'UNAVAILABLE'; package = $package; device = $null;
    devices = @(); packageInstalled = $null; packagePids = @();
    forward9006Present = $null; host9006Owners = @($listenerRows | Where-Object { $_.port -eq 9006 });
    scope = 'DEVICE_LIST_PACKAGE_PATH_PIDOF_EXISTING_FORWARD_LIST_ONLY' }
# adb can auto-start its server even for a query. Require an existing server
# first; this verifier never invokes adb if the server is not listening.
$adbServerListening = $false
try {
    $adbServerListening = [bool]@(Get-NetTCPConnection -State Listen -LocalPort 5037 -ErrorAction Stop).Count
} catch { }
$adb.serverAlreadyListening = $adbServerListening
if ($adbExecutable -and $adbServerListening) {
    $devicesResult = Invoke-ReadOnlyQuery -Executable $adbExecutable -Arguments @('devices')
    if ($devicesResult.ok) {
        $devices = @()
        foreach ($line in ($devicesResult.output -split '\r?\n')) {
            if ($line -match '^([A-Za-z0-9._:-]+)\s+(device|offline|unauthorized)$') {
                $devices += [ordered]@{ serial = $Matches[1]; state = $Matches[2] }
            }
        }
        $adb.devices = $devices
        $available = @($devices | Where-Object { $_.state -eq 'device' })
        if ($DeviceSerial) {
            $available = @($available | Where-Object { $_.serial -eq $DeviceSerial })
        }
        if ($available.Count -eq 1) {
            $serial = $available[0].serial
            $adb.device = $serial
            $installed = Invoke-ReadOnlyQuery -Executable $adbExecutable -Arguments @('-s', $serial, 'shell', 'pm', 'path', $package)
            if ($installed.ok) { $adb.packageInstalled = [bool]($installed.output -match '(?m)^package:') }
            $pids = Invoke-ReadOnlyQuery -Executable $adbExecutable -Arguments @('-s', $serial, 'shell', 'pidof', $package)
            if ($pids.ok -and $pids.output.Trim() -match '^\d+(?:\s+\d+)*$') {
                $adb.packagePids = @($pids.output.Trim() -split '\s+' | ForEach-Object { [int]$_ })
            }
            $forwards = Invoke-ReadOnlyQuery -Executable $adbExecutable -Arguments @('-s', $serial, 'forward', '--list')
            if ($forwards.ok) {
                $adb.forward9006Present = $false
                foreach ($line in ($forwards.output -split '\r?\n')) {
                    $parts = $line.Trim() -split '\s+'
                    if ($parts.Count -eq 3 -and $parts[0] -eq $serial -and $parts[1] -eq 'tcp:9006') {
                        $adb.forward9006Present = $true
                    }
                }
            }
            $adb.status = if ($adb.packageInstalled -eq $true -and $adb.packagePids.Count -gt 0 -and
                $adb.forward9006Present -eq $true) { 'PASS' } else { 'FAIL' }
        } else { $adb.status = 'DEVICE_SELECTION_REQUIRED' }
    }
}

$report = [ordered]@{
    at = [DateTimeOffset]::Now.ToString('o')
    mode = 'READ_ONLY_SANITIZED'
    http = $http
    listeners = [ordered]@{ status = $listenerReadStatus; rows = $listenerRows }
    sourceProcesses = $sourceProcesses
    docker = $docker
    adb = $adb
    limitations = @(
        'HTTP 200 verifies endpoint response, not response body or authenticated business flow.',
        'No secrets, process arguments, VM URI, environment dump, app logs or container inspect data are collected.',
        'No applications, containers, emulator, ADB server, forwards or sessions are started/modified.',
        'Docker scope is the seven expected EcoRoute container names; other projects are outside this report.',
        'An existing tcp:9006 forward does not prove a healthy Dart VM or IDE attachment.'
    )
}
[IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($reportPath)) | Out-Null
[IO.File]::WriteAllText($reportPath, ($report | ConvertTo-Json -Depth 10), [Text.UTF8Encoding]::new($false))
Write-Output 'Sanitized report saved: docs/guia_total_ide/ejecucion_20261026/runtime_verification.json'
Write-Output ('HTTP checks: ' + (($http | ForEach-Object { $_.component + '=' + $_.status }) -join ', '))
Write-Output ('Docker=' + $docker.status + '; ADB=' + $adb.status + '; process query=' + $processReadStatus)
