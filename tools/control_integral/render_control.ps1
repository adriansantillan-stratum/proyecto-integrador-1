param([string]$RunName='control_20261022_final')
$ErrorActionPreference='Stop'
if($RunName -notmatch '^control_[A-Za-z0-9_-]+$'){throw 'Invalid QA run name'}
$taskRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$folder=Join-Path $taskRoot ('docs/correccion_integral/_qa/'+$RunName)
$source=Join-Path $taskRoot 'docs/correccion_integral/EcoRoute_Control_Integral_y_Aceptacion.docx'
$copy=Join-Path $folder 'EcoRoute_Control_Integral_y_Aceptacion.docx'
if(Test-Path -LiteralPath $copy){throw 'QA copy already exists'}
$null=New-Item -ItemType Directory -Force -Path $folder
Copy-Item -LiteralPath $source -Destination $copy
$pdf=Join-Path $folder 'render.pdf'
& (Join-Path $taskRoot 'tools/audit_e2e/render_word.ps1') -DocumentPath $copy -PdfPath ([IO.Path]::GetRelativePath((Get-Location).Path,$pdf)) -UpdateFields
& 'C:/Users/USUARIO/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/poppler/Library/bin/pdftoppm.exe' -r 120 -png $pdf (Join-Path $folder 'page')
if($LASTEXITCODE -ne 0){throw 'PNG render failed'}
Write-Output ('PNG pages: '+@(Get-ChildItem -LiteralPath $folder -Filter 'page-*.png').Count)
