param(
    [Parameter(Mandatory=$true)][ValidateSet('WORD_LISTO')][string]$Signal,
    [Parameter(Mandatory=$true)][ValidatePattern('^[A-Za-z0-9_-]+$')][string]$RunName,
    [ValidateSet('manual','guion','academico')][string[]]$Documents=@('manual','guion','academico')
)
# Invoke only after the user has actually supplied WORD_LISTO. Serial Word exports.
$ErrorActionPreference = 'Stop'
$qaProject = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$qaRoot = Join-Path $qaProject 'docs/correccion_integral/_qa/word_final'
$qaRun = Join-Path $qaRoot $RunName
if (Test-Path -LiteralPath $qaRun) { throw 'Use a new run name; existing QA runs are preserved.' }
$qaDependencies = 'C:/Users/USUARIO/.cache/codex-runtimes/codex-primary-runtime/dependencies'
$qaPython = Join-Path $qaDependencies 'python/python.exe'
$qaPoppler = Join-Path $qaDependencies 'native/poppler/Library/bin/pdftoppm.exe'
$qaOriginal = Join-Path $qaProject 'docs/Integrador I_Grupo3.docx'
$qaOriginalHash = (Get-FileHash -LiteralPath $qaOriginal -Algorithm SHA256).Hash
$qaDocuments = @(
    @{Key='manual';Path='docs/correccion_integral/EcoRoute_Manual_Integral_Implementacion_y_Pruebas.docx'},
    @{Key='guion';Path='docs/correccion_integral/EcoRoute_Guion_Tecnico_Exposicion.docx'},
    @{Key='academico';Path='docs/Integrador I_Grupo3_Correccion_Integral.docx'}
)
$qaDocuments = @($Documents | ForEach-Object { $qaRequested=$_; $qaDocuments | Where-Object { $_.Key -eq $qaRequested } })
$null = New-Item -ItemType Directory -Path $qaRun
$qaManifest = [ordered]@{
    phase='exporting_qa_copies';signal=$Signal;createdUtc=[DateTime]::UtcNow.ToString('o')
    renderer='Word COM via render_word.ps1; Poppler 120 DPI PNG'
    sourceDocumentsModified=$false;visualReviewComplete=$false
    originalSha256=$qaOriginalHash;documents=@()
    limits=@('Only QA copies receive TOC and page-field updates.',
             'No source/final DOCX has been changed by this helper.',
             'PNG generation does not constitute visual inspection.')
}
foreach ($qaDoc in $qaDocuments) {
    $qaInput = Join-Path $qaProject $qaDoc.Path
    $qaHashBefore = (Get-FileHash -LiteralPath $qaInput -Algorithm SHA256).Hash
    $qaFolder = Join-Path $qaRun $qaDoc.Key
    $null = New-Item -ItemType Directory -Path $qaFolder
    $qaCopy = Join-Path $qaFolder ([IO.Path]::GetFileName($qaInput))
    Copy-Item -LiteralPath $qaInput -Destination $qaCopy
    $qaPdf = Join-Path $qaFolder 'render.pdf'
    # render_word.ps1 joins PdfPath to the working directory, so pass a relative path.
    $qaRelativePdf = [IO.Path]::GetRelativePath((Get-Location).Path, $qaPdf)
    & (Join-Path $PSScriptRoot 'render_word.ps1') -DocumentPath $qaCopy -PdfPath $qaRelativePdf -UpdateFields
    if (-not (Test-Path -LiteralPath $qaPdf)) { throw "PDF missing: $($qaDoc.Key)" }
    & $qaPoppler -r 120 -png $qaPdf (Join-Path $qaFolder 'page')
    if ($LASTEXITCODE -ne 0) { throw "Poppler failed: $($qaDoc.Key)" }
    & $qaPython (Join-Path $PSScriptRoot 'qa_word_final_audit.py') --pdf $qaPdf --out (Join-Path $qaFolder 'automated_checks.json')
    if ($LASTEXITCODE -ne 0) { throw "PDF audit failed: $($qaDoc.Key)" }
    $qaHashAfter = (Get-FileHash -LiteralPath $qaInput -Algorithm SHA256).Hash
    if ($qaHashBefore -ne $qaHashAfter) { throw "Source changed during QA: $($qaDoc.Key). Invalidate this render." }
    $qaManifest.documents += [ordered]@{
        key=$qaDoc.Key;source=$qaInput;sourceSha256=$qaHashBefore;qaCopy=$qaCopy
        qaCopySha256=(Get-FileHash -LiteralPath $qaCopy -Algorithm SHA256).Hash
        pdf=$qaPdf;pngCount=@(Get-ChildItem -LiteralPath $qaFolder -Filter 'page-*.png').Count
        viewedPages=@();visualReviewComplete=$false
    }
    $qaManifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $qaRun 'render_manifest.json') -Encoding utf8
    Write-Output "Export and automated checks complete: $($qaDoc.Key)"
}
if ((Get-FileHash -LiteralPath $qaOriginal -Algorithm SHA256).Hash -ne $qaOriginalHash) {
    throw 'Original academic document hash changed during QA.'
}
$qaManifest.phase = 'rendered_pending_visual_review'
$qaManifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $qaRun 'render_manifest.json') -Encoding utf8
Write-Output "Rendered QA copies ready for full PNG inspection: $qaRun"
