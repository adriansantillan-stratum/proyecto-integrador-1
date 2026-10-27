param([Parameter(Mandatory=$true)][ValidatePattern('^[A-Za-z0-9_-]+$')][string]$RunName,[switch]$FinalizeOnly)
# Render only generated academic/manual QA copies. Never open the original for writing.
$ErrorActionPreference='Stop'
$taskRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$qaRoot=Join-Path $taskRoot 'docs/correccion_integral/_qa/word_final'
$qaRun=Join-Path $qaRoot $RunName
if ((Test-Path -LiteralPath $qaRun) -and -not $FinalizeOnly) { throw 'QA run already exists; use a new name.' }
function Get-ClosureHash([string]$Path) {
    $stream=[IO.File]::Open($Path,[IO.FileMode]::Open,[IO.FileAccess]::Read,([IO.FileShare]::ReadWrite -bor [IO.FileShare]::Delete))
    try { return (Get-FileHash -InputStream $stream -Algorithm SHA256).Hash } finally { $stream.Dispose() }
}
$runtime='C:/Users/USUARIO/.cache/codex-runtimes/codex-primary-runtime/dependencies'
$original=Join-Path $taskRoot 'docs/Integrador I_Grupo3.docx'
$originalHash=Get-ClosureHash $original
if (-not $FinalizeOnly) { $null=New-Item -ItemType Directory -Path $qaRun }
$manifest=[ordered]@{atUtc=[DateTime]::UtcNow.ToString('o');renderer='Word COM fallback after bundled renderer unavailable; Poppler 120 DPI';documents=@();visualReviewComplete=$false;originalSha256=$originalHash;recoveredManifestOnly=[bool]$FinalizeOnly}
foreach ($entry in @(
    @{Key='manual';Path='docs/correccion_integral/EcoRoute_Manual_Integral_Implementacion_y_Pruebas.docx'},
    @{Key='academico';Path='docs/Integrador I_Grupo3_Correccion_Integral.docx'}
)) {
    $source=Join-Path $taskRoot $entry.Path
    $sourceHash=Get-ClosureHash $source
    $folder=Join-Path $qaRun $entry.Key
    if (-not $FinalizeOnly) { $null=New-Item -ItemType Directory -Path $folder }
    $copy=Join-Path $folder ([IO.Path]::GetFileName($source))
    $pdf=Join-Path $folder 'render.pdf'
    if (-not $FinalizeOnly) {
    Copy-Item -LiteralPath $source -Destination $copy
    & (Join-Path $PSScriptRoot 'render_word.ps1') -DocumentPath $copy -PdfPath ([IO.Path]::GetRelativePath((Get-Location).Path,$pdf)) -UpdateFields
    & (Join-Path $runtime 'native/poppler/Library/bin/pdftoppm.exe') -r 120 -png $pdf (Join-Path $folder 'page')
    if ($LASTEXITCODE -ne 0) { throw ('PNG export failed: '+$entry.Key) }
    & (Join-Path $runtime 'python/python.exe') -B -X utf8 (Join-Path $PSScriptRoot 'qa_word_final_audit.py') --pdf $pdf --out (Join-Path $folder 'automated_checks.json')
    if ($LASTEXITCODE -ne 0) { throw ('PDF checks failed: '+$entry.Key) }
    } else {
        foreach ($required in @($copy,$pdf,(Join-Path $folder 'automated_checks.json'))) { if (-not (Test-Path -LiteralPath $required)) { throw 'Incomplete render cannot be finalized.' } }
        $audit=Get-Content -LiteralPath (Join-Path $folder 'automated_checks.json') -Raw | ConvertFrom-Json
        if (@($audit.pdf.pages).Count -ne @(Get-ChildItem -LiteralPath $folder -Filter 'page-*.png').Count) { throw 'PNG/PDF page count mismatch.' }
    }
    if ((Get-ClosureHash $source) -ne $sourceHash) { throw 'Source changed during render.' }
    $manifest.documents+=@{key=$entry.Key;source=$source;sourceSha256=$sourceHash;qaCopy=$copy;qaCopySha256=(Get-ClosureHash $copy);pages=@(Get-ChildItem -LiteralPath $folder -Filter 'page-*.png').Count}
    $manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $qaRun 'render_manifest.json') -Encoding utf8
    Write-Output ('Ready for individual visual review: '+$entry.Key)
}
if ((Get-ClosureHash $original) -ne $originalHash) { throw 'Original preservation failed.' }
