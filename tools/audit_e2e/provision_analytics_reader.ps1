<#
Run manually as a DBA after V12. Requires psql in PATH; never embeds a password.
Creates a real dedicated LOGIN and grants only the analytics reader membership.
psql prompts separately for administrator authentication and for the BI password.
Do not run against production without the organization's deployment authorization.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$DatabaseHost,
    [int]$DatabasePort = 5432,
    [Parameter(Mandatory=$true)][ValidatePattern('^[A-Za-z_][A-Za-z0-9_]{0,62}$')][string]$DatabaseName,
    [Parameter(Mandatory=$true)][string]$Administrator,
    [Parameter(Mandatory=$true)][ValidatePattern('^[a-z_][a-z0-9_]{0,62}$')][string]$LoginRole
)
$ErrorActionPreference = 'Stop'
if ($LoginRole -eq 'ecoroute_bi_reader') { throw 'El LOGIN debe ser distinto del rol NOLOGIN.' }
if (-not (Get-Command psql -ErrorAction SilentlyContinue)) { throw 'Instala el cliente oficial PostgreSQL psql antes de ejecutar.' }
$analyticsPsqlArgs = @('-X','-v','ON_ERROR_STOP=1','--host',$DatabaseHost,'--port',"$DatabasePort",'--dbname',$DatabaseName,'--username',$Administrator)
$analyticsProvisionSql = @"
DO `$`$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '$LoginRole') THEN
    CREATE ROLE "$LoginRole" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION INHERIT;
  ELSE
    RAISE EXCEPTION 'El rol ya existe: usa un nombre dedicado nuevo y revisa sus privilegios antes de reutilizarlo';
  END IF;
END `$`$;
GRANT CONNECT ON DATABASE "$DatabaseName" TO "$LoginRole";
GRANT ecoroute_bi_reader TO "$LoginRole";
ALTER ROLE "$LoginRole" SET default_transaction_read_only = on;
"@
& psql @analyticsPsqlArgs --command $analyticsProvisionSql
if ($LASTEXITCODE -ne 0) { throw 'Falló el aprovisionamiento; revisar el error PostgreSQL.' }
# \password asks twice and avoids cleartext passwords in command arguments/history.
& psql @analyticsPsqlArgs --command "\password $LoginRole"
if ($LASTEXITCODE -ne 0) { throw 'Contraseña pendiente. El DBA debe ejecutar \password para el nuevo rol antes de usarlo.' }
Write-Host "LOGIN $LoginRole creado. Configura TLS y conecta Power BI sólo a las cuatro vistas analytics_*_facts."
Write-Host 'Valida permisos heredados de PUBLIC y políticas de red en la base destino antes de entregar acceso.'
