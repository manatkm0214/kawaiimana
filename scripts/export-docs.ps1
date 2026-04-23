$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$htmlDir = Join-Path $root "docs\\export\\html"
$pdfDir = Join-Path $root "docs\\export\\pdf"
$edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"

if (!(Test-Path $edgePath)) {
  throw "Microsoft Edge was not found at: $edgePath"
}

New-Item -ItemType Directory -Force -Path $pdfDir | Out-Null

Get-ChildItem -Path $htmlDir -Filter *.html | Sort-Object Name | ForEach-Object {
  $inputPath = $_.FullName
  $baseName = [System.IO.Path]::GetFileNameWithoutExtension($_.Name)
  $pdfPath = Join-Path $pdfDir ($baseName + ".pdf")
  $uri = "file:///" + ($inputPath -replace "\\", "/")

  & $edgePath `
    "--headless=new" `
    "--disable-gpu" `
    "--run-all-compositor-stages-before-draw" `
    "--print-to-pdf-no-header" `
    "--print-to-pdf=$pdfPath" `
    $uri 2>$null | Out-Null

  Write-Host "Exported $baseName.pdf"
}
