# Authorized promotion of ONLY the reviewed academic r3 copy.
# Does not edit document contents, open Office, or copy manual/guion/original.
$ErrorActionPreference = 'Stop'
$taskRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$qaRun = Join-Path $taskRoot 'docs/correccion_integral/_qa/word_final/academico_final_r3'
$qaPath = Join-Path $qaRun 'Integrador I_Grupo3_Correccion_Integral.docx'
$targetPath = Join-Path $taskRoot 'docs/Integrador I_Grupo3_Correccion_Integral.docx'
$originalPath = Join-Path $taskRoot 'docs/Integrador I_Grupo3.docx'
$reviewPath = Join-Path $qaRun 'visual_review.json'
$review = Get-Content -LiteralPath $reviewPath -Raw | ConvertFrom-Json
$manifest = Get-Content -LiteralPath (Join-Path $qaRun 'audit-inputs/snapshot_manifest.json') -Raw | ConvertFrom-Json
function Read-TaskBytes([string]$Path) {
    $stream=$null; $memory=$null
    try {
        $stream=[IO.File]::Open($Path,[IO.FileMode]::Open,[IO.FileAccess]::Read,([IO.FileShare]::ReadWrite -bor [IO.FileShare]::Delete))
        $memory=New-Object IO.MemoryStream
        $stream.CopyTo($memory)
        return ,($memory.ToArray())
    } finally {if ($stream) {$stream.Dispose()}; if ($memory) {$memory.Dispose()}}
}
function Hash-TaskBytes([byte[]]$Bytes) {
    $hash=[Security.Cryptography.SHA256]::Create()
    try {return ([BitConverter]::ToString($hash.ComputeHash($Bytes))).Replace('-','').ToLowerInvariant()}
    finally {$hash.Dispose()}
}
if ($review.status -ne 'PASS_VISUAL_AND_SOURCE_PRESERVATION' -or -not $review.visualReviewComplete -or $review.counts.totalCovered -ne 125 -or $review.openLayoutFindings.Count -ne 0 -or $review.footerExcluded) {throw 'Review gate failed'}
if ($review.promotion.status -ne 'READY_NOT_YET_COPIED') {throw 'Promotion already attempted or wrong state'}
if ($review.qaDocxPath -ne $qaPath) {throw 'Unexpected QA source path'}
foreach ($page in $review.pages) {
    if ((Hash-TaskBytes (Read-TaskBytes (Join-Path $qaRun $page.file))) -ne $page.png_sha256) {throw 'Reviewed page image changed'}
}
if ((Hash-TaskBytes (Read-TaskBytes (Join-Path $qaRun 'render.pdf'))) -ne $review.pdfSha256) {throw 'Reviewed PDF changed'}
$copyBytes=Read-TaskBytes $qaPath
$copyHash=Hash-TaskBytes $copyBytes
if ($copyHash -ne $review.qaDocxSha256) {throw 'Reviewed QA DOCX changed'}
$protectedPaths=@($originalPath,(Join-Path $taskRoot 'docs/correccion_integral/EcoRoute_Guion_Tecnico_Exposicion.docx'),(Join-Path $taskRoot 'docs/correccion_integral/EcoRoute_Manual_Integral_Implementacion_y_Pruebas.docx'))
$protectedBefore=@(foreach ($path in $protectedPaths) {[pscustomobject]@{path=$path;sha256=(Hash-TaskBytes (Read-TaskBytes $path))}})
if ($protectedBefore[0].sha256 -ne '0510d1041b955184bbed180ce9a96ef31f3e08863d8ef58f93d34916c18ecfb5') {throw 'Original preservation failed'}
$previousBytes=Read-TaskBytes $targetPath
$previousHash=Hash-TaskBytes $previousBytes
$expectedBefore=($manifest.preservationBefore | Where-Object path -eq $targetPath).sha256
if ($previousHash -ne $expectedBefore) {throw 'Final academic target changed since preflight; do not overwrite concurrent changes'}
$backupPath=Join-Path $qaRun ('before-promotion-' + $previousHash.Substring(0,16) + '.docx')
if (Test-Path -LiteralPath $backupPath) {
    if ((Hash-TaskBytes (Read-TaskBytes $backupPath)) -ne $previousHash) {throw 'Existing backup differs'}
} else {
    $backupStream=[IO.File]::Open($backupPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
    try {$backupStream.Write($previousBytes,0,$previousBytes.Length)} finally {$backupStream.Dispose()}
}
if ((Hash-TaskBytes (Read-TaskBytes $backupPath)) -ne $previousHash) {throw 'Backup hash failed'}
$stagePath=Join-Path $qaRun ('promotion-stage-' + [Guid]::NewGuid().ToString('N') + '.docx')
[IO.File]::WriteAllBytes($stagePath,$copyBytes)
if ((Hash-TaskBytes (Read-TaskBytes $stagePath)) -ne $copyHash) {throw 'Staging hash failed'}
if ((Hash-TaskBytes (Read-TaskBytes $targetPath)) -ne $previousHash) {throw 'Target changed before replacement'}
if ((Hash-TaskBytes (Read-TaskBytes $qaPath)) -ne $copyHash) {throw 'QA input changed before replacement'}
# Atomic same-volume rename/replace; failed replacement leaves the prior target intact.
[IO.File]::Move($stagePath,$targetPath,$true)
$finalHash=Hash-TaskBytes (Read-TaskBytes $targetPath)
if ($finalHash -ne $copyHash) {throw 'Destination hash does not match independent QA source hash'}
$protectedAfter=@(foreach ($item in $protectedBefore) {
    $afterHash=Hash-TaskBytes (Read-TaskBytes $item.path)
    if ($afterHash -ne $item.sha256) {throw ('Protected file changed concurrently: ' + $item.path)}
    [pscustomobject]@{path=$item.path;beforeSha256=$item.sha256;afterSha256=$afterHash;unchanged=$true}
})
$promotion=[pscustomobject]@{
    status='PROMOTED_VERIFIED';atUtc=[DateTime]::UtcNow.ToString('o');source=$qaPath;destination=$targetPath
    sourceQaSha256=$copyHash;destinationFinalSha256=$finalHash;sourceDestinationHashesMatch=$true
    backup=$backupPath;backupSha256=$previousHash;previousFinalSha256=$previousHash
    protectedFiles=$protectedAfter;onlyAcademicCopied=$true;humanMICOTRANSValidation='PENDING'
}
$promotion | ConvertTo-Json -Depth 7 | Set-Content -LiteralPath (Join-Path $qaRun 'promotion.json') -Encoding utf8
$review.promotion=$promotion
$review | ConvertTo-Json -Depth 18 | Set-Content -LiteralPath $reviewPath -Encoding utf8
$ledgerPath=Join-Path $taskRoot 'docs/correccion_integral/_qa/word_final/visual_review_ledger.json'
$ledger=Get-Content -LiteralPath $ledgerPath -Raw | ConvertFrom-Json
$ledger.runs | Add-Member -Force NoteProperty academico_final_r3 ([pscustomobject]@{academico=[pscustomobject]@{
    page_count=125;visual_review_complete=$true;status='PASS_PROMOTED_VERIFIED';individually_opened_current_pages=$review.individuallyOpenedThisRevision
    full_pixel_identity_transferred_pages=$review.identityTransferredPages;footer_excluded=$false
    report='academico_final_r3/visual_review.json';promotion='academico_final_r3/promotion.json';sha256=$finalHash
}})
foreach ($finding in $ledger.open_findings) {if ($finding.id -in @('AC01','AC02')) {$finding.status='CLOSED_VERIFIED_ACADEMICO_FINAL_R3'}}
$ledger.academico_next_revision_scope.promotion_status='PROMOTED_ACADEMICO_FINAL_R3_VERIFIED'
$ledger | ConvertTo-Json -Depth 18 | Set-Content -LiteralPath $ledgerPath -Encoding utf8
$promotion | ConvertTo-Json -Depth 7
