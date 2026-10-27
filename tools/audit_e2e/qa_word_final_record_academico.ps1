# Record the completed, explicitly attested r2 academic visual review.
# This helper only enriches its QA JSON with hashes. It never opens Office,
# mutates a source document or promotes any deliverable.
$ErrorActionPreference = 'Stop'
$qaRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../docs/correccion_integral/_qa/word_final'))
$qaAcademic = Join-Path $qaRoot 'final_v15_20261020_r2/academico'
$qaReportPath = Join-Path $qaAcademic 'visual_review.json'
function Get-SharedReadSha256([string]$Path) {
    $stream = $null
    $hasher = $null
    try {
        $stream = [IO.File]::Open($Path, [IO.FileMode]::Open, [IO.FileAccess]::Read, ([IO.FileShare]::ReadWrite -bor [IO.FileShare]::Delete))
        $hasher = [Security.Cryptography.SHA256]::Create()
        return ([BitConverter]::ToString($hasher.ComputeHash($stream))).Replace('-','').ToLowerInvariant()
    } finally {
        if ($hasher) { $hasher.Dispose() }
        if ($stream) { $stream.Dispose() }
    }
}
$review = Get-Content -LiteralPath $qaReportPath -Raw | ConvertFrom-Json
if (-not $review.visualReviewComplete -or $review.run -ne 'final_v15_20261020_r2') { throw 'Wrong or incomplete review attestation' }
$pageFiles = @(Get-ChildItem -LiteralPath $qaAcademic -Filter 'page-*.png' | Sort-Object Name)
if ($pageFiles.Count -ne 124) { throw 'Expected exactly 124 page PNGs' }
$pages = @(foreach ($number in 1..124) {
    $page = Join-Path $qaAcademic ('page-{0:d3}.png' -f $number)
    [pscustomobject]@{page=$number; file=[IO.Path]::GetFileName($page); individuallyViewed=$true; sha256=Get-SharedReadSha256 $page}
})
$original = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../docs/Integrador I_Grupo3.docx'))
$originalHash = Get-SharedReadSha256 $original
if ($originalHash -ne '0510d1041b955184bbed180ce9a96ef31f3e08863d8ef58f93d34916c18ecfb5') { throw 'Original preservation hash mismatch' }
$review | Add-Member -Force NoteProperty recordedUtc ([DateTime]::UtcNow.ToString('o'))
$review | Add-Member -Force NoteProperty viewedPages @(1..124)
$review | Add-Member -Force NoteProperty pages $pages
$review | Add-Member -Force NoteProperty qaDocxSha256 (Get-SharedReadSha256 (Join-Path $qaAcademic 'Integrador I_Grupo3_Correccion_Integral.docx'))
$review | Add-Member -Force NoteProperty pdfSha256 (Get-SharedReadSha256 (Join-Path $qaAcademic 'render.pdf'))
$review | Add-Member -Force NoteProperty originalPreservedSha256 $originalHash
$automated = Get-Content -LiteralPath (Join-Path $qaAcademic 'automated_checks.json') -Raw | ConvertFrom-Json
$review | Add-Member -Force NoteProperty automatedSummary ([pscustomobject]@{
    pages=$automated.pdf.page_count
    blankCandidates=@($automated.pdf.pages | Where-Object blank_candidate | ForEach-Object page)
    textErrors=@($automated.pdf.pages | Where-Object { $_.errors.Count -gt 0 } | ForEach-Object page)
    nearPhysicalEdgeCandidates=@($automated.pdf.pages | Where-Object { $_.near_physical_edge.Count -gt 0 } | ForEach-Object page)
    note='See original automated_checks.json for geometry and text details; visual review recorded separately here.'
})
$review | ConvertTo-Json -Depth 16 | Set-Content -LiteralPath $qaReportPath -Encoding utf8
Write-Output ('Recorded individual visual review: 124/124 pages, QA DOCX SHA256 ' + $review.qaDocxSha256)
