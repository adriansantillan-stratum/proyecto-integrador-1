param([Parameter(Mandatory=$true)][string]$DocumentPath,[Parameter(Mandatory=$true)][string]$OutputDirectory)
# Read-only input snapshots for verification of OneDrive-shared QA DOCX copies.
$ErrorActionPreference='Stop'
$taskRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$qaRoot=[IO.Path]::GetFullPath((Join-Path $taskRoot 'docs/correccion_integral/_qa/word_final'))
$inputPath=(Resolve-Path -LiteralPath $DocumentPath).Path
$outPath=[IO.Path]::GetFullPath((Join-Path (Get-Location) $OutputDirectory))
foreach($path in @($inputPath,$outPath)) {if(-not $path.StartsWith($qaRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Snapshots are restricted to authorized QA paths'}}
function Read-TaskBytes([string]$Path) {
    $stream=$null;$memory=$null
    try {
        $stream=[IO.File]::Open($Path,[IO.FileMode]::Open,[IO.FileAccess]::Read,([IO.FileShare]::ReadWrite -bor [IO.FileShare]::Delete))
        $memory=New-Object IO.MemoryStream;$stream.CopyTo($memory);return ,($memory.ToArray())
    } finally {if($stream){$stream.Dispose()};if($memory){$memory.Dispose()}}
}
function Hash-TaskBytes([byte[]]$Bytes) {
    $hash=[Security.Cryptography.SHA256]::Create()
    try{return ([BitConverter]::ToString($hash.ComputeHash($Bytes))).Replace('-','').ToLowerInvariant()}finally{$hash.Dispose()}
}
$bytes=Read-TaskBytes $inputPath;$digest=Hash-TaskBytes $bytes
if((Hash-TaskBytes (Read-TaskBytes $inputPath)) -ne $digest){throw 'QA copy changed during snapshot'}
$null=New-Item -ItemType Directory -Force -Path $outPath
$snapshot=Join-Path $outPath ($digest+'.docx')
if(-not(Test-Path -LiteralPath $snapshot)){[IO.File]::WriteAllBytes($snapshot,$bytes)}
if((Hash-TaskBytes (Read-TaskBytes $snapshot)) -ne $digest){throw 'Snapshot hash mismatch'}
$metadata=[pscustomobject]@{source=$inputPath;snapshot=$snapshot;sha256=$digest;bytes=$bytes.Length;sharing='FileShare.ReadWrite | FileShare.Delete';capturedUtc=[DateTime]::UtcNow.ToString('o')}
$metadata | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $outPath ($digest+'.json')) -Encoding utf8
$metadata | ConvertTo-Json
