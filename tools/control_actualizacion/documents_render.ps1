param(
    [Parameter(Mandatory=$true)][ValidatePattern('^[a-z0-9_-]+$')][string]$Revision,
    [Parameter(Mandatory=$true)][ValidatePattern('^[a-z0-9_-]+$')][string]$RunName
)
# Single-owner serial renderer. Never save originals or the deliverable package.
$ErrorActionPreference='Stop'
$documentsRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../docs/control_actualizacion/documentos'))
$revisionRoot=[IO.Path]::GetFullPath((Join-Path $documentsRoot $Revision))
if (-not $revisionRoot.StartsWith($documentsRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { throw 'Revision outside assigned scope.' }
$buildFile=Join-Path $revisionRoot 'build_manifest.json'
if (-not (Test-Path -LiteralPath $buildFile)) { throw 'Build manifest required.' }
$manifest=Get-Content -LiteralPath $buildFile -Raw | ConvertFrom-Json -Depth 100
$runRoot=Join-Path $documentsRoot "_qa/$Revision/$RunName"
if (Test-Path -LiteralPath $runRoot) { throw 'Use a new QA run name.' }
$null=New-Item -ItemType Directory -Path $runRoot
$runtime='C:/Users/USUARIO/.cache/codex-runtimes/codex-primary-runtime/dependencies'
$python=Join-Path $runtime 'python/python.exe'
$poppler=Join-Path $runtime 'native/poppler/Library/bin/pdftoppm.exe'
$skill='C:/Users/USUARIO/.codex/plugins/cache/openai-primary-runtime/documents/26.1020.11127/skills/documents'
$repoRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$records=@()
$word=$null
try {
    foreach($record in $manifest.documents) {
        $source=[IO.Path]::GetFullPath((Join-Path $repoRoot $record.output))
        if (-not $source.StartsWith($revisionRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { throw 'Unapproved source path.' }
        $expected=(Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash
        $key=[IO.Path]::GetFileNameWithoutExtension($source)
        $folder=Join-Path $runRoot $key
        $null=New-Item -ItemType Directory -Path $folder
        $canonical=Join-Path $folder 'canonical'
        $null=New-Item -ItemType Directory -Path $canonical
        # Do not call or search for the user's desktop LibreOffice installation.
        $canonicalTemp=Join-Path $canonical 'temp'
        $null=New-Item -ItemType Directory -Path $canonicalTemp
        $taskPreviousPath=$env:PATH
        $taskPreviousTemp=$env:TEMP
        $taskPreviousTmp=$env:TMP
        try {
            $env:PATH=@((Join-Path $runtime 'python'),(Join-Path $runtime 'native/poppler/Library/bin'),(Join-Path $runtime 'native/powershell')) -join ';'
            $env:TEMP=$canonicalTemp
            $env:TMP=$canonicalTemp
            $canonicalOutput=& $python -B -X utf8 (Join-Path $skill 'render_docx.py') $source --output_dir $canonical --emit_pdf --verbose 2>&1
            $canonicalExit=$LASTEXITCODE
        } finally {
            $env:PATH=$taskPreviousPath
            $env:TEMP=$taskPreviousTemp
            $env:TMP=$taskPreviousTmp
        }
        $canonicalOutput|Out-File -LiteralPath (Join-Path $folder 'canonical_attempt.log') -Encoding utf8
        $renderer='canonical'
        $pdf=$null
        if ($canonicalExit -eq 0 -and @(Get-ChildItem -LiteralPath $canonical -Filter 'page-*.png').Count -gt 0) {
            $pdf=Join-Path $canonical ($key+'.pdf')
            $imageFolder=$canonical
        } else {
            $renderer='Word COM fallback serial'
            if (-not $word) {
                $word=New-Object -ComObject Word.Application
                $word.Visible=$false
                $word.DisplayAlerts=0
                $word.AutomationSecurity=3
            }
            $copy=Join-Path $folder ([IO.Path]::GetFileName($source))
            Copy-Item -LiteralPath $source -Destination $copy
            $pdf=Join-Path $folder 'render.pdf'
            $doc=$null
            try {
                $doc=$word.Documents.Open($copy,$false,$false)
                # Fields are refreshed in memory for export, never saved globally.
                foreach($toc in $doc.TablesOfContents) { $toc.Update() }
                $null=$doc.Fields.Update()
                $doc.Repaginate()
                foreach($toc in $doc.TablesOfContents) { $toc.UpdatePageNumbers() }
                $pages=$doc.ComputeStatistics(2)
                $doc.ExportAsFixedFormat($pdf,17)
            } finally {
                if ($doc) { $doc.Close(0);[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($doc) }
            }
            & $poppler -r 120 -png $pdf (Join-Path $folder 'page')
            if ($LASTEXITCODE -ne 0) { throw 'Poppler rasterization failed.' }
            $imageFolder=$folder
        }
        if ((Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash -ne $expected) { throw 'Deliverable package changed during rendering.' }
        & $python -B -X utf8 (Join-Path $PSScriptRoot 'documents_pdf_audit.py') --pdf $pdf --images $imageFolder --out (Join-Path $folder 'page_review.json')
        if ($LASTEXITCODE -ne 0) { throw 'PDF audit failed.' }
        $records+=@{source=$record.output;sha256=$expected;renderer=$renderer;canonicalExit=$canonicalExit;pdf=$pdf;images=$imageFolder;pageReview=(Join-Path $folder 'page_review.json')}
        [ordered]@{revision=$Revision;run=$RunName;documents=$records;visualReviewComplete=$false;fieldsSavedToDeliverables=$false}|ConvertTo-Json -Depth 10|Out-File -LiteralPath (Join-Path $runRoot 'render_manifest.json') -Encoding utf8
        Write-Output ('PNG ready for every-page review: '+$key)
    }
} finally {
    if ($word) { $word.Quit();[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($word) }
}
