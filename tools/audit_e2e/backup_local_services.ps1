param([string]$Destination = "backups/pre_correction_20261019")
$ErrorActionPreference = 'Stop'
$taskRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$taskBackup = [IO.Path]::GetFullPath((Join-Path $taskRoot $Destination))
if (-not $taskBackup.StartsWith($taskRoot + [IO.Path]::DirectorySeparatorChar)) { throw 'Backup must remain inside workspace' }
if (Test-Path -LiteralPath $taskBackup) { throw 'Backup destination already exists; do not overwrite it' }
New-Item -ItemType Directory -Path $taskBackup | Out-Null
function Assert-Exit { if ($LASTEXITCODE -ne 0) { throw 'Backup command failed; do not recreate any service' } }
docker exec ecoroute-db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f /tmp/ecoroute-pre-correction.dump'
Assert-Exit
docker cp ecoroute-db:/tmp/ecoroute-pre-correction.dump (Join-Path $taskBackup 'database.dump')
Assert-Exit
docker exec ecoroute-localstack awslocal s3 sync s3://ecoroute-proofs /tmp/ecoroute-pre-correction/objects
Assert-Exit
docker cp ecoroute-localstack:/tmp/ecoroute-pre-correction/objects (Join-Path $taskBackup 'objects')
Assert-Exit
$taskQueue = docker exec ecoroute-localstack awslocal sqs get-queue-url --queue-name ecoroute-notifications --query QueueUrl --output text
Assert-Exit
$taskMessages = docker exec ecoroute-localstack awslocal sqs receive-message --queue-url $taskQueue --max-number-of-messages 10 --visibility-timeout 0 --wait-time-seconds 1
Assert-Exit
[IO.File]::WriteAllText((Join-Path $taskBackup 'queue_snapshot.json'),($taskMessages -join "`n"),[Text.UTF8Encoding]::new($false))
$taskFiles = Get-ChildItem -LiteralPath $taskBackup -File -Recurse | ForEach-Object {
    @{path=$_.FullName.Substring($taskBackup.Length+1); bytes=$_.Length; sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash}
}
[IO.File]::WriteAllText((Join-Path $taskBackup 'manifest.json'),(ConvertTo-Json -InputObject @($taskFiles) -Depth 5),[Text.UTF8Encoding]::new($false))
Write-Output "Backup complete: $taskBackup. Original database, objects and queue messages were preserved."
