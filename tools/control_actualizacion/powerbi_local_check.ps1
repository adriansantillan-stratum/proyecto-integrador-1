<#
Read-only local inventory and PostgreSQL TCP check. Does not provision accounts.
DB_PASSWORD is read only from a git-ignored .env and passed through the child
process environment. No password appears in arguments, output or evidence.
Run from PowerShell 7. The host port deliberately defaults to Docker's 5433,
not DB_PORT=5432 from .env (the internal database port).
#>
[CmdletBinding()]
param(
    [ValidateSet('127.0.0.1','localhost','::1')][string]$DatabaseHost = '127.0.0.1',
    [ValidateRange(1,65535)][int]$DatabasePort = 5433,
    [string]$DatabaseName = 'ecoroute',
    [string]$PsqlPath = 'C:/Program Files/PostgreSQL/18/bin/psql.exe'
)
$ErrorActionPreference = 'Stop'
$powerbiRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$powerbiEnvPath = Join-Path $powerbiRoot '.env'
& git -C $powerbiRoot check-ignore --quiet -- .env
if ($LASTEXITCODE -ne 0) { throw '.env must already be git-ignored; no credential file will be created.' }
if (-not (Test-Path -LiteralPath $powerbiEnvPath)) { throw 'Existing ignored .env not found.' }
if (-not (Test-Path -LiteralPath $PsqlPath)) { throw 'Existing psql executable not found; nothing installed.' }
$powerbiConfig = @{}
foreach ($powerbiLine in [IO.File]::ReadLines($powerbiEnvPath)) {
    if ($powerbiLine -match '^\s*(DB_USER|DB_PASSWORD)\s*=(.*)$') {
        $powerbiValue = $matches[2].Trim()
        if (($powerbiValue.StartsWith('"') -and $powerbiValue.EndsWith('"')) -or
            ($powerbiValue.StartsWith("'") -and $powerbiValue.EndsWith("'"))) {
            $powerbiValue = $powerbiValue.Substring(1,$powerbiValue.Length-2)
        }
        $powerbiConfig[$matches[1]] = $powerbiValue
    }
}
if (-not $powerbiConfig['DB_USER'] -or -not $powerbiConfig['DB_PASSWORD']) {
    throw 'Existing DB_USER/DB_PASSWORD are required in the ignored .env; no credentials changed.'
}

function Invoke-PowerbiReadOnlyPsql([string]$SqlText) {
    $powerbiStart = [Diagnostics.ProcessStartInfo]::new()
    $powerbiStart.FileName = $PsqlPath
    $powerbiStart.UseShellExecute = $false
    $powerbiStart.CreateNoWindow = $true
    $powerbiStart.RedirectStandardInput = $true
    $powerbiStart.RedirectStandardOutput = $true
    $powerbiStart.RedirectStandardError = $true
    foreach ($powerbiArg in @('-X','-qAt','-w','-v','ON_ERROR_STOP=1',
        '--host',$DatabaseHost,'--port',"$DatabasePort",'--dbname',$DatabaseName,
        '--username',$powerbiConfig['DB_USER'])) { $powerbiStart.ArgumentList.Add($powerbiArg) }
    $powerbiStart.Environment['PGPASSWORD'] = $powerbiConfig['DB_PASSWORD']
    $powerbiStart.Environment['PGOPTIONS'] = '-c default_transaction_read_only=on -c statement_timeout=15000'
    $powerbiStart.Environment['PGCONNECT_TIMEOUT'] = '5'
    $powerbiStart.Environment['PGSSLMODE'] = 'disable'
    $powerbiStart.Environment['PGAPPNAME'] = 'ecoroute_powerbi_local_readonly_audit'
    $powerbiProcess = [Diagnostics.Process]::new()
    $powerbiProcess.StartInfo = $powerbiStart
    try {
        [void]$powerbiProcess.Start()
        $powerbiOutputTask = $powerbiProcess.StandardOutput.ReadToEndAsync()
        $powerbiErrorTask = $powerbiProcess.StandardError.ReadToEndAsync()
        $powerbiProcess.StandardInput.Write($SqlText)
        $powerbiProcess.StandardInput.Close()
        if (-not $powerbiProcess.WaitForExit(30000)) {
            $powerbiProcess.Kill()
            throw 'Read-only psql check exceeded 30 seconds.'
        }
        return [pscustomobject]@{
            ExitCode=$powerbiProcess.ExitCode
            Stdout=$powerbiOutputTask.GetAwaiter().GetResult()
            Stderr=$powerbiErrorTask.GetAwaiter().GetResult()
        }
    } finally {
        $powerbiStart.Environment.Remove('PGPASSWORD') | Out-Null
        $powerbiProcess.Dispose()
    }
}

$powerbiCandidates = @(
    'C:/Program Files/Microsoft Power BI Desktop/bin/PBIDesktop.exe',
    'C:/Program Files/Microsoft Power BI Desktop/PBIDesktop.exe',
    'C:/Program Files (x86)/Microsoft Power BI Desktop/bin/PBIDesktop.exe',
    (Join-Path $env:LOCALAPPDATA 'Microsoft/WindowsApps/PBIDesktop.exe')
)
$powerbiExecutable = Get-Command PBIDesktop -ErrorAction SilentlyContinue
if ($powerbiExecutable) { $powerbiCandidates += $powerbiExecutable.Source }
$powerbiStoreStatus = 'checked'
try { $powerbiStorePackages = @(Get-AppxPackage -Name '*PowerBI*' | Select-Object Name,Version,InstallLocation) }
catch { $powerbiStoreStatus = 'unavailable'; $powerbiStorePackages = @() }
$powerbiInstalled = @(Get-ItemProperty -Path @(
    'HKLM:/Software/Microsoft/Windows/CurrentVersion/Uninstall/*',
    'HKLM:/Software/WOW6432Node/Microsoft/Windows/CurrentVersion/Uninstall/*',
    'HKCU:/Software/Microsoft/Windows/CurrentVersion/Uninstall/*'
) -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -match 'Power BI|PostgreSQL|Npgsql|psqlODBC' } |
    Select-Object DisplayName,DisplayVersion,InstallLocation)
$powerbiDrivers = @(Get-OdbcDriver | Select-Object Name,Platform)
$powerbiDsns = @(Get-OdbcDsn | Where-Object { $_.DriverName -match 'Postgre' } |
    Select-Object Name,DsnType,Platform,DriverName)
$powerbiSql = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'powerbi_readonly_audit.sql'))
$powerbiRead = Invoke-PowerbiReadOnlyPsql $powerbiSql
if ($powerbiRead.ExitCode -ne 0) { throw "Read-only SQL failed (psql exit $($powerbiRead.ExitCode)); no connection claim recorded." }
$powerbiRows = @($powerbiRead.Stdout -split '\r?\n' | Where-Object { $_.Trim() } | ForEach-Object { $_ | ConvertFrom-Json })

# Negative SELECT check only; failure closes and rolls back its read-only session.
$powerbiDenied = Invoke-PowerbiReadOnlyPsql @'
\set VERBOSITY sqlstate
BEGIN READ ONLY;
SET LOCAL ROLE ecoroute_bi_reader;
SELECT count(*) FROM public.orders;
ROLLBACK;
'@
$powerbiConnection = $powerbiRows | Where-Object check -eq 'connection'
$powerbiReader = $powerbiRows | Where-Object check -eq 'reader_session'
$powerbiCounts = @($powerbiRows | Where-Object check -eq 'view_count')
$powerbiResult = [ordered]@{
    checked_at_utc=[DateTime]::UtcNow.ToString('o')
    scope='LOCAL_READ_ONLY_SQL_AND_INSTALLATION_INVENTORY'
    endpoint="$($DatabaseHost):$DatabasePort"
    database=$DatabaseName
    credentials_reference='.env: DB_USER/DB_PASSWORD (existing ignored file; value not included)'
    psql_path=$PsqlPath
    powerbi_executable_checks=@($powerbiCandidates | Select-Object -Unique | ForEach-Object {
        [pscustomobject]@{path=$_; exists=(Test-Path -LiteralPath $_)}
    })
    powerbi_store_inventory_status=$powerbiStoreStatus
    powerbi_store_packages=$powerbiStorePackages
    installed_database_or_bi_products=$powerbiInstalled
    postgres_odbc_drivers=@($powerbiDrivers | Where-Object Name -match 'Postgre')
    postgres_odbc_dsns=$powerbiDsns
    available_odbc_driver_count=$powerbiDrivers.Count
    pbi_tools_available=[bool](Get-Command pbi-tools -ErrorAction SilentlyContinue)
    sql_connection_authenticated=($powerbiConnection.transaction_read_only -eq 'on')
    four_views_counted_as_reader=($powerbiCounts.Count -eq 4 -and $powerbiReader.current_user -eq 'ecoroute_bi_reader')
    base_orders_select_denied=($powerbiDenied.ExitCode -ne 0 -and $powerbiDenied.Stderr -match '42501')
    sql_checks=$powerbiRows
    powerbi_desktop_connection_verified=$false
    native_powerquery_evaluation_executed=$false
    provision_or_credential_changes_executed=$false
}
$powerbiJson = $powerbiResult | ConvertTo-Json -Depth 12
if ($powerbiJson.Contains($powerbiConfig['DB_PASSWORD'])) { throw 'Refuse output containing the configured password.' }
[IO.File]::WriteAllText((Join-Path $PSScriptRoot 'powerbi_local_evidence.json'),$powerbiJson,[Text.UTF8Encoding]::new($false))
$powerbiConfig.Clear()
$powerbiJson
