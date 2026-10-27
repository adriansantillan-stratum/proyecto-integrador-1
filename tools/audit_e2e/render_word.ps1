param([string]$DocumentPath,[string]$PdfPath,[switch]$UpdateFields)
$ErrorActionPreference='Stop'
$resolvedDocument=(Resolve-Path -LiteralPath $DocumentPath).Path
if ($UpdateFields) {
    $documentWorkspace=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
    $allowedAcademic=Join-Path $documentWorkspace 'docs/Integrador I_Grupo3_Correccion_Integral.docx'
    $allowedChapter3=Join-Path $documentWorkspace 'docs/Integrador I_Grupo3_Capitulo3_Completo.docx'
    $allowedChapter3Final=Join-Path $documentWorkspace 'docs/Integrador I_Grupo3_Capitulo3_Final.docx'
    $allowedFolder=Join-Path $documentWorkspace 'docs/correccion_integral/'
    if ($resolvedDocument -ne $allowedAcademic -and $resolvedDocument -ne $allowedChapter3 -and $resolvedDocument -ne $allowedChapter3Final -and -not $resolvedDocument.StartsWith($allowedFolder,[StringComparison]::OrdinalIgnoreCase)) {
        throw 'La actualización de campos solo se permite en las revisiones generadas para esta tarea.'
    }
}
$absolutePdf=[IO.Path]::GetFullPath((Join-Path (Get-Location) $PdfPath))
$null=New-Item -ItemType Directory -Force -Path ([IO.Path]::GetDirectoryName($absolutePdf))
$auditWord=$null
$auditDocument=$null
$auditBackgroundSave=$null
try {
    $auditWord=New-Object -ComObject Word.Application
    $auditWord.Visible=$false
    $auditWord.DisplayAlerts=0
    $auditBackgroundSave=$auditWord.Options.BackgroundSave
    $auditWord.Options.BackgroundSave=$false
    $auditDocument=$auditWord.Documents.Open($resolvedDocument,$false,(-not $UpdateFields))
    if ($UpdateFields) {
        foreach ($toc in $auditDocument.TablesOfContents) { $toc.Update(); [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($toc) }
        $null=$auditDocument.Fields.Update()
        $auditDocument.Repaginate()
        foreach ($toc in $auditDocument.TablesOfContents) { $toc.UpdatePageNumbers(); [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($toc) }
        $auditDocument.Save()
    }
    $auditDocument.Repaginate()
    $pages=$auditDocument.ComputeStatistics(2)
    $auditDocument.ExportAsFixedFormat($absolutePdf,17)
    Write-Output "PDF generado con $pages paginas"
} finally {
    if ($auditDocument) { try { $auditDocument.Close(0) } catch { Write-Warning 'Word no confirmó el cierre del documento de revisión.' }; [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($auditDocument) }
    if ($auditWord) { if ($null -ne $auditBackgroundSave) { $auditWord.Options.BackgroundSave=$auditBackgroundSave }; try { $auditWord.Quit() } catch { Write-Warning 'Word no confirmó el cierre de su instancia de revisión.' }; [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($auditWord) }
    [GC]::Collect(); [GC]::WaitForPendingFinalizers()
}
