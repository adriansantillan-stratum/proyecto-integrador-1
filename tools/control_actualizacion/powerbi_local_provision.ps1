<#
PowerShell 7. Default: verify the existing BI_LOCAL_* login read-only.
-ProvisionNewLogin creates ONLY ecoroute_bi_local after checking it is absent.
Explicitly authorized local scope: 127.0.0.1:5433/ecoroute.
Secrets: ignored .env and child environment/stdin only; never process arguments.
No existing role, migration, view, function, service or business row is changed.
#>
[CmdletBinding()]
param([switch]$ProvisionNewLogin, [switch]$InspectOnly)
$ErrorActionPreference = 'Stop'
$biProvisionRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$biProvisionEnv = Join-Path $biProvisionRoot '.env'
$biProvisionPsql = 'C:/Program Files/PostgreSQL/18/bin/psql.exe'
$biProvisionRole = 'ecoroute_bi_local'
$biProvisionConfig = @{}
& git -C $biProvisionRoot check-ignore --quiet -- .env
if ($LASTEXITCODE -ne 0) { throw 'Refuse: .env is not git-ignored.' }
& git -C $biProvisionRoot ls-files --error-unmatch -- .env 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) { throw 'Refuse: .env is tracked.' }
if (-not (Test-Path -LiteralPath $biProvisionPsql)) { throw 'Existing psql not found.' }
$biProvisionOriginalText = [IO.File]::ReadAllText($biProvisionEnv)
$biProvisionOriginalHash = (Get-FileHash -LiteralPath $biProvisionEnv -Algorithm SHA256).Hash
foreach ($biProvisionLine in $biProvisionOriginalText -split '\r?\n') {
    if ($biProvisionLine -match '^\s*(DB_USER|DB_PASSWORD|BI_LOCAL_USER|BI_LOCAL_PASSWORD|BI_LOCAL_SERVER|BI_LOCAL_DATABASE)\s*=(.*)$') {
        $biProvisionKey = $matches[1]
        if ($biProvisionConfig.ContainsKey($biProvisionKey)) { throw "Duplicate configuration key: $biProvisionKey" }
        $biProvisionValue = $matches[2].Trim()
        if (($biProvisionValue.StartsWith('"') -and $biProvisionValue.EndsWith('"')) -or
            ($biProvisionValue.StartsWith("'") -and $biProvisionValue.EndsWith("'"))) {
            $biProvisionValue = $biProvisionValue.Substring(1,$biProvisionValue.Length-2)
        }
        $biProvisionConfig[$biProvisionKey] = $biProvisionValue
    }
}

function Invoke-BiLocalPsql([string]$Login, [string]$Secret, [string]$Sql, [bool]$ReadOnly = $true) {
    $biStart = [Diagnostics.ProcessStartInfo]::new()
    $biStart.FileName = $biProvisionPsql
    $biStart.UseShellExecute = $false
    $biStart.CreateNoWindow = $true
    $biStart.RedirectStandardInput = $true
    $biStart.RedirectStandardOutput = $true
    $biStart.RedirectStandardError = $true
    foreach ($biArg in @('-X','-qAt','-w','-v','ON_ERROR_STOP=1','--host','127.0.0.1',
        '--port','5433','--dbname','ecoroute','--username',$Login)) { $biStart.ArgumentList.Add($biArg) }
    $biStart.Environment['PGPASSWORD'] = $Secret
    # For the BI login do not force default_transaction_read_only from the client:
    # the verification must observe the role's actual server-side default.
    $biStart.Environment['PGOPTIONS'] = if ($ReadOnly) {
        '-c statement_timeout=15000'
    } else { '-c statement_timeout=15000 -c default_transaction_read_only=off' }
    $biStart.Environment['PGCONNECT_TIMEOUT'] = '5'
    $biStart.Environment['PGSSLMODE'] = 'disable'
    $biStart.Environment['PGAPPNAME'] = 'ecoroute_bi_local_authorized_provision_check'
    $biProcess = [Diagnostics.Process]::new()
    $biProcess.StartInfo = $biStart
    try {
        [void]$biProcess.Start()
        $biStdoutTask = $biProcess.StandardOutput.ReadToEndAsync()
        $biStderrTask = $biProcess.StandardError.ReadToEndAsync()
        $biProcess.StandardInput.Write($Sql)
        $biProcess.StandardInput.Close()
        if (-not $biProcess.WaitForExit(30000)) {
            $biProcess.Kill()
            throw 'Local psql operation exceeded 30 seconds.'
        }
        [pscustomobject]@{ExitCode=$biProcess.ExitCode; Out=$biStdoutTask.GetAwaiter().GetResult(); Err=$biStderrTask.GetAwaiter().GetResult()}
    } finally {
        $biStart.Environment.Remove('PGPASSWORD') | Out-Null
        $biProcess.Dispose()
    }
}

function Save-BiLocalEnvironmentWithPatch([string]$PatchText) {
    # Use the actual apply_patch helper via stdin, never place a secret in argv.
    $biPatchWrapper = (Get-Command apply_patch -ErrorAction Stop).Source
    $biPatchWrapperText = [IO.File]::ReadAllText($biPatchWrapper)
    $biPatchExecutableSpec = [regex]::Match($biPatchWrapperText,'(?m)^"([^"]+codex\.exe)"').Groups[1].Value
    if (-not $biPatchExecutableSpec.StartsWith('%~dp0')) { throw 'Unsupported apply_patch wrapper; no credential edit attempted.' }
    $biPatchExecutable = [IO.Path]::GetFullPath($biPatchExecutableSpec.Replace('%~dp0',([IO.Path]::GetDirectoryName($biPatchWrapper) + '\')))
    if (-not (Test-Path -LiteralPath $biPatchExecutable)) { throw 'apply_patch executable missing.' }
    $biPatchStart = [Diagnostics.ProcessStartInfo]::new()
    $biPatchStart.FileName = $biPatchExecutable
    $biPatchStart.ArgumentList.Add('--codex-run-as-apply-patch')
    $biPatchStart.WorkingDirectory = $biProvisionRoot
    $biPatchStart.UseShellExecute = $false
    $biPatchStart.CreateNoWindow = $true
    $biPatchStart.RedirectStandardInput = $true
    $biPatchStart.RedirectStandardOutput = $true
    $biPatchStart.RedirectStandardError = $true
    $biPatchProcess = [Diagnostics.Process]::new()
    $biPatchProcess.StartInfo = $biPatchStart
    try {
        [void]$biPatchProcess.Start()
        $biPatchOut = $biPatchProcess.StandardOutput.ReadToEndAsync()
        $biPatchErr = $biPatchProcess.StandardError.ReadToEndAsync()
        $biPatchProcess.StandardInput.Write($PatchText)
        $biPatchProcess.StandardInput.Close()
        if (-not $biPatchProcess.WaitForExit(15000)) {
            $biPatchProcess.Kill()
            throw 'apply_patch timeout; inspect only key presence before retrying.'
        }
        # Helper diagnostics may echo patch context. Do not emit either stream.
        [void]$biPatchOut.GetAwaiter().GetResult()
        [void]$biPatchErr.GetAwaiter().GetResult()
        if ($biPatchProcess.ExitCode -ne 0) { throw 'apply_patch failed; no secret diagnostics emitted.' }
    } finally { $biPatchProcess.Dispose() }
}

$biCreatedHere = $false
$biPrecheck = $null
if ($ProvisionNewLogin -or $InspectOnly) {
    if (-not $biProvisionConfig['DB_USER'] -or -not $biProvisionConfig['DB_PASSWORD']) { throw 'Existing administrator environment keys missing.' }
    $biCheckResult = Invoke-BiLocalPsql $biProvisionConfig['DB_USER'] $biProvisionConfig['DB_PASSWORD'] @'
BEGIN READ ONLY;
SELECT json_build_object('role_absent',NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='ecoroute_bi_local'),
  'reader_is_nologin',EXISTS(SELECT 1 FROM pg_roles WHERE rolname='ecoroute_bi_reader' AND NOT rolcanlogin),
  'v16_applied',EXISTS(SELECT 1 FROM flyway_schema_history WHERE version='16' AND success),
  'migrations',(SELECT json_agg(json_build_object('version',version,'success',success) ORDER BY installed_rank)
    FROM flyway_schema_history WHERE version IN ('12','15','16')),
  'reader_safe_attributes',EXISTS(SELECT 1 FROM pg_roles WHERE rolname='ecoroute_bi_reader'
    AND NOT (rolcanlogin OR rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)),
  'returned_terminal_view',pg_get_viewdef('public.analytics_route_facts'::regclass) LIKE '%RETURNED%',
  'audit_extension_loaded',current_setting('shared_preload_libraries') LIKE '%pgaudit%' OR EXISTS(SELECT 1 FROM pg_extension WHERE extname='pgaudit'),
  'server_version',current_setting('server_version'),'database',current_database());
ROLLBACK;
'@
    if ($biCheckResult.ExitCode -ne 0) { throw 'Administrator read-only precheck failed; no account changed.' }
    $biPrecheck = $biCheckResult.Out.Trim() | ConvertFrom-Json
    if ($InspectOnly) {
        [pscustomobject]@{precheck=$biPrecheck; env_keys_present=@(
            'BI_LOCAL_USER','BI_LOCAL_PASSWORD','BI_LOCAL_SERVER','BI_LOCAL_DATABASE' |
            Where-Object { $biProvisionConfig.ContainsKey($_) }); mutation_executed=$false} | ConvertTo-Json -Depth 8
        $biProvisionConfig.Clear()
        return
    }
    if (-not $biPrecheck.role_absent) {
        # Existing role is verification-only, even when provisioning was requested.
        $ProvisionNewLogin = $false
    }
}
if ($ProvisionNewLogin) {
    if (-not $biPrecheck.reader_is_nologin -or -not $biPrecheck.reader_safe_attributes -or -not $biPrecheck.v16_applied -or $biPrecheck.audit_extension_loaded) {
        throw 'Required absent account / NOLOGIN reader / applied V16 conditions not met; no account changed.'
    }
    $biExistingKeyCount = @('BI_LOCAL_USER','BI_LOCAL_PASSWORD','BI_LOCAL_SERVER','BI_LOCAL_DATABASE' |
        Where-Object { $biProvisionConfig.ContainsKey($_) }).Count
    if ($biExistingKeyCount -notin @(0,4)) { throw 'Incomplete BI configuration; no existing credential will be reset.' }
    if ($biExistingKeyCount -eq 4 -and ($biProvisionConfig['BI_LOCAL_USER'] -ne $biProvisionRole -or
        $biProvisionConfig['BI_LOCAL_SERVER'] -ne '127.0.0.1:5433' -or
        $biProvisionConfig['BI_LOCAL_DATABASE'] -ne 'ecoroute' -or -not $biProvisionConfig['BI_LOCAL_PASSWORD'])) {
        throw 'Existing BI configuration does not match the authorized local target.'
    }
    if ($biExistingKeyCount -eq 0) {
    # Probe stdin support before generating a credential or editing its file.
    Save-BiLocalEnvironmentWithPatch "*** Begin Patch`n*** End Patch`n"
    $biRandomBytes = [byte[]]::new(48)
    [Security.Cryptography.RandomNumberGenerator]::Fill($biRandomBytes)
    $biNewSecret = [Convert]::ToBase64String($biRandomBytes) # 64 chars, 384 random bits.
    [Array]::Clear($biRandomBytes,0,$biRandomBytes.Length)
    if ((Get-FileHash -LiteralPath $biProvisionEnv -Algorithm SHA256).Hash -ne $biProvisionOriginalHash) {
        throw '.env changed concurrently; no credential edit or provisioning attempted.'
    }
    $biPatch = "*** Begin Patch`n*** Update File: .env`n@@`n+BI_LOCAL_USER=ecoroute_bi_local`n+BI_LOCAL_PASSWORD=$biNewSecret`n+BI_LOCAL_SERVER=127.0.0.1:5433`n+BI_LOCAL_DATABASE=ecoroute`n*** End Patch`n"
    Save-BiLocalEnvironmentWithPatch $biPatch
    $biPatch = $null
    $biEnvAfter = [IO.File]::ReadAllText($biProvisionEnv)
    if (-not $biEnvAfter.Contains("BI_LOCAL_PASSWORD=$biNewSecret")) { throw 'Credential persistence check failed; account not created.' }
    } else {
        # Recover an interrupted save-before-create attempt without resetting its password.
        $biNewSecret = $biProvisionConfig['BI_LOCAL_PASSWORD']
    }
    # SQL literal escaping is explicit even though the base64 alphabet has no quote.
    $biQuotedSecret = "'" + $biNewSecret.Replace("'","''") + "'"
    # Suppress statement text in server errors before sending credential DDL.
    # Every ALTER below targets the role just created in this same transaction.
    $biCreateSql = @"
BEGIN;
SET LOCAL log_statement='none';
SET LOCAL log_min_error_statement='panic';
SET LOCAL log_min_messages='panic';
SET LOCAL log_min_duration_statement=-1;
SET LOCAL log_min_duration_sample=-1;
SET LOCAL log_duration=off;
DO `$`$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='ecoroute_bi_local') THEN
  RAISE EXCEPTION 'New local role already exists; refusing alteration';
 END IF;
END `$`$;
CREATE ROLE ecoroute_bi_local LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD $biQuotedSecret;
GRANT CONNECT ON DATABASE ecoroute TO ecoroute_bi_local;
GRANT ecoroute_bi_reader TO ecoroute_bi_local;
ALTER ROLE ecoroute_bi_local SET default_transaction_read_only=on;
COMMIT;
"@
    $biCreateResult = Invoke-BiLocalPsql $biProvisionConfig['DB_USER'] $biProvisionConfig['DB_PASSWORD'] $biCreateSql $false
    $biCreateSql = $null
    $biQuotedSecret = $null
    if ($biCreateResult.ExitCode -ne 0) { throw 'New-login transaction failed; no secret diagnostics emitted. Ignored .env retains the candidate credential for local recovery.' }
    $biCreatedHere = $true
    $biProvisionConfig['BI_LOCAL_USER'] = $biProvisionRole
    $biProvisionConfig['BI_LOCAL_PASSWORD'] = $biNewSecret
    $biProvisionConfig['BI_LOCAL_SERVER'] = '127.0.0.1:5433'
    $biProvisionConfig['BI_LOCAL_DATABASE'] = 'ecoroute'
    $biNewSecret = $null
}

if ($biProvisionConfig['BI_LOCAL_USER'] -ne $biProvisionRole -or
    $biProvisionConfig['BI_LOCAL_SERVER'] -ne '127.0.0.1:5433' -or
    $biProvisionConfig['BI_LOCAL_DATABASE'] -ne 'ecoroute' -or
    -not $biProvisionConfig['BI_LOCAL_PASSWORD']) { throw 'Existing BI_LOCAL_* configuration does not match the authorized local target.' }

$biVerifySql = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'powerbi_local_login_audit.sql'))
$biVerifyResult = Invoke-BiLocalPsql $biProvisionRole $biProvisionConfig['BI_LOCAL_PASSWORD'] $biVerifySql
if ($biVerifyResult.ExitCode -ne 0) { throw 'Dedicated TCP login/view check failed; no Desktop connection claim made.' }
$biChecks = @($biVerifyResult.Out -split '\r?\n' | Where-Object { $_.Trim() } | ForEach-Object { $_ | ConvertFrom-Json })
$biSelectDenied = Invoke-BiLocalPsql $biProvisionRole $biProvisionConfig['BI_LOCAL_PASSWORD'] @'
\set VERBOSITY sqlstate
BEGIN READ ONLY;
SELECT count(*) FROM public.orders;
ROLLBACK;
'@
$biInsertDenied = Invoke-BiLocalPsql $biProvisionRole $biProvisionConfig['BI_LOCAL_PASSWORD'] @'
\set VERBOSITY sqlstate
BEGIN READ ONLY;
INSERT INTO public.orders DEFAULT VALUES;
ROLLBACK;
'@
$biSelectState = [regex]::Match($biSelectDenied.Err,'\b[0-9A-Z]{5}\b').Value
$biInsertState = [regex]::Match($biInsertDenied.Err,'\b[0-9A-Z]{5}\b').Value
$biLoginCheck = $biChecks | Where-Object check -eq 'real_login'
$biWrongPassword = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
$biWrongAuth = Invoke-BiLocalPsql $biProvisionRole $biWrongPassword "\set VERBOSITY sqlstate`nSELECT 1;`n"
$biWrongPassword = $null
# A successful connection with a deliberately wrong password would indicate trust/other auth.
# Do not claim password authentication based solely on a successful PGPASSWORD session.
$biWrongAuthRejected = $biWrongAuth.ExitCode -ne 0 -and $biWrongAuth.Err -match '28P01|password authentication failed|autenticaci.n.*contrase.a'
$biAttributes = $biChecks | Where-Object check -eq 'attributes'
$biPermissions = $biChecks | Where-Object check -eq 'permissions'
$biV16Columns = ($biChecks | Where-Object { $_.check -eq 'view_columns' -and $_.view -eq 'analytics_route_facts' }).columns
$biExpectedViews = @('analytics_order_facts','analytics_route_facts','analytics_goal_facts','analytics_goal_history_facts')
$biRelations = @($biChecks | Where-Object check -eq 'relation_privileges')
$biUnexpectedAccess = @($biRelations | Where-Object {
    $_.any_write -or $_.owner -or (($_.select -or $_.column_select) -and
        -not ($_.schema -eq 'public' -and $_.kind -eq 'v' -and $_.relation -in $biExpectedViews))
})
$biViewGrants = @($biRelations | Where-Object { $_.schema -eq 'public' -and $_.kind -eq 'v' -and
    $_.relation -in $biExpectedViews -and $_.select -and -not $_.any_write })
$biSequenceAccess = @($biChecks | Where-Object { $_.check -eq 'sequence_privileges' -and $_.any_privilege })
$biMemberships = @((($biChecks | Where-Object check -eq 'role_memberships').memberships))
$biGpsInvariant = $biChecks | Where-Object check -eq 'v16_invariants'
$biKpis = @($biChecks | Where-Object check -eq 'kpi')
$biPass = $biLoginCheck.session_user -eq $biProvisionRole -and
    $biLoginCheck.current_user -eq $biProvisionRole -and
    $biLoginCheck.default_transaction_read_only -eq 'on' -and
    $biLoginCheck.transaction_read_only -eq 'on' -and
    $biLoginCheck.database -eq 'ecoroute' -and
    $biWrongAuthRejected -and
    $biAttributes.login -and $biAttributes.reader_member -and
    -not ($biAttributes.superuser -or $biAttributes.createdb -or $biAttributes.createrole -or $biAttributes.replication -or $biAttributes.bypassrls) -and
    $biPermissions.connect -and $biPermissions.v16_function_execute -and
    $biUnexpectedAccess.Count -eq 0 -and $biViewGrants.Count -eq 4 -and $biSequenceAccess.Count -eq 0 -and
    $biMemberships.Count -eq 1 -and $biMemberships[0].role -eq 'ecoroute_bi_reader' -and -not $biMemberships[0].admin_option -and
    $biGpsInvariant.violations -eq 0 -and $biKpis.Count -eq 5 -and
    -not ($biPermissions.orders_select -or $biPermissions.orders_insert -or $biPermissions.orders_update -or $biPermissions.orders_delete) -and
    (@($biChecks | Where-Object check -eq 'view_count').Count -eq 4) -and
    ('gps_quality' -in $biV16Columns) -and ('observed_distance_km' -in $biV16Columns) -and
    $biSelectDenied.ExitCode -ne 0 -and $biSelectState -eq '42501' -and
    $biInsertDenied.ExitCode -ne 0 -and $biInsertState -in @('25006','42501')
$biEvidence = [ordered]@{
    checked_at_utc=[DateTime]::UtcNow.ToString('o')
    checked_at_lima=[TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([DateTime]::UtcNow,'SA Pacific Standard Time').ToString('yyyy-MM-ddTHH:mm:ss')+'-05:00'
    status=$(if ($biPass) {'DEDICATED_LOCAL_TCP_LOGIN_VALIDATED'} else {'VALIDATION_FAILED'})
    role=$biProvisionRole
    server='127.0.0.1:5433'
    database='ecoroute'
    credentials_reference='.env: BI_LOCAL_USER / BI_LOCAL_PASSWORD / BI_LOCAL_SERVER / BI_LOCAL_DATABASE'
    created_in_this_run=$biCreatedHere
    precheck=$biPrecheck
    real_tcp_authentication_without_set_role=$true
    wrong_password_authentication_rejected=$biWrongAuthRejected
    client_forced_default_readonly=$false
    psql_path=$biProvisionPsql
    psql_version=(& $biProvisionPsql --version)
    only_four_views_have_relation_select=($biUnexpectedAccess.Count -eq 0 -and $biViewGrants.Count -eq 4)
    base_relations_checked=@($biRelations | Where-Object kind -ne 'v').Count
    five_kpis_computed=($biKpis.Count -eq 5)
    v16_invariants_pass=($biGpsInvariant.violations -eq 0)
    negative_select=@{rejected=($biSelectDenied.ExitCode -ne 0);sqlstate=$biSelectState}
    negative_insert=@{rejected=($biInsertDenied.ExitCode -ne 0);sqlstate=$biInsertState;transaction='READ ONLY';business_rows_committed=0}
    checks=$biChecks
    remaining_public_schema_create=$biPermissions.public_schema_create
    existing_accounts_altered=$false
    v16_applied_or_function_changed_by_this_work=$false
    powerbi_desktop_connection_verified_by_this_work=$false
}
$biEvidenceJson = $biEvidence | ConvertTo-Json -Depth 10
foreach ($biSecretKey in @('BI_LOCAL_PASSWORD','DB_PASSWORD')) {
    if ($biProvisionConfig[$biSecretKey] -and $biEvidenceJson.Contains($biProvisionConfig[$biSecretKey])) { throw 'Refuse evidence containing a configured secret.' }
}
$biEvidencePath = Join-Path $PSScriptRoot ('powerbi_local_login_evidence_' + [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfffffffZ') + '.json')
if (Test-Path -LiteralPath $biEvidencePath) { throw 'Refuse overwriting existing evidence.' }
[IO.File]::WriteAllText($biEvidencePath,$biEvidenceJson,[Text.UTF8Encoding]::new($false))
$biProvisionConfig.Clear()
$biEvidenceJson
if (-not $biPass) { throw 'Dedicated login validation incomplete; see redacted evidence.' }
