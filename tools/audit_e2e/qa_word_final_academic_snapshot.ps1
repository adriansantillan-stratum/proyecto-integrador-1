# Snapshot only QA inputs with shared-read access; never mutate Office/source files.
$ErrorActionPreference = 'Stop'
$taskRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$qaRoot = Join-Path $taskRoot 'docs/correccion_integral/_qa/word_final'
$outRoot = Join-Path $qaRoot 'academico_final_r3/audit-inputs'
$null = New-Item -ItemType Directory -Force -Path $outRoot
function Read-TaskBytes([string]$Path) {
    $stream = $null; $memory = $null
    try {
        $stream = [IO.File]::Open($Path,[IO.FileMode]::Open,[IO.FileAccess]::Read,([IO.FileShare]::ReadWrite -bor [IO.FileShare]::Delete))
        $memory = New-Object IO.MemoryStream
        $stream.CopyTo($memory)
        return ,($memory.ToArray())
    } finally { if ($stream) {$stream.Dispose()}; if ($memory) {$memory.Dispose()} }
}
function Hash-TaskBytes([byte[]]$Bytes) {
    $hash = [Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($hash.ComputeHash($Bytes))).Replace('-','').ToLowerInvariant() }
    finally { $hash.Dispose() }
}
$inputs = @(
    @{key='r2'; path=(Join-Path $qaRoot 'final_v15_20261020_r2/academico/Integrador I_Grupo3_Correccion_Integral.docx')},
    @{key='r3'; path=(Join-Path $qaRoot 'academico_final_r3/Integrador I_Grupo3_Correccion_Integral.docx')}
)
$snapshots = @(foreach ($inputItem in $inputs) {
    $content = Read-TaskBytes $inputItem.path
    $digest = Hash-TaskBytes $content
    if ((Hash-TaskBytes (Read-TaskBytes $inputItem.path)) -ne $digest) {throw 'Input changed while being read'}
    $snapshot = Join-Path $outRoot ($inputItem.key + '-' + $digest.Substring(0,16) + '.docx')
    if (-not (Test-Path -LiteralPath $snapshot)) {[IO.File]::WriteAllBytes($snapshot,$content)}
    if ((Hash-TaskBytes (Read-TaskBytes $snapshot)) -ne $digest) {throw 'Snapshot hash mismatch'}
    [pscustomobject]@{key=$inputItem.key;source=$inputItem.path;snapshot=$snapshot;sha256=$digest;bytes=$content.Length}
})
$preservation = @(foreach ($relative in @('docs/Integrador I_Grupo3.docx','docs/Integrador I_Grupo3_Correccion_Integral.docx','docs/correccion_integral/EcoRoute_Guion_Tecnico_Exposicion.docx','docs/correccion_integral/EcoRoute_Manual_Integral_Implementacion_y_Pruebas.docx')) {
    $path = Join-Path $taskRoot $relative
    [pscustomobject]@{path=$path;sha256=(Hash-TaskBytes (Read-TaskBytes $path))}
})
$result = [pscustomobject]@{createdUtc=[DateTime]::UtcNow.ToString('o');snapshots=$snapshots;preservationBefore=$preservation}
$result | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $outRoot 'snapshot_manifest.json') -Encoding utf8
$result | ConvertTo-Json -Depth 6
