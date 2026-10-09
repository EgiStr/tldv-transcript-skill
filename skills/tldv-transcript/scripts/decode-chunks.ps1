<#
  decode-chunks.ps1 — reassemble base64 chunks retrieved from the page into the .md file.

  Collect the chunks first via scripts/emit-chunks.js (a few parts per call),
  save each as .chunks/partNN.b64 in sorted order, then run this.

  Usage:
    pwsh -File decode-chunks.ps1 -ChunkDir .\.chunks -Out .\transcript.md
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$ChunkDir,
  [Parameter(Mandatory = $true)][string]$Out
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path $ChunkDir)) { throw "Chunk dir not found: $ChunkDir" }

$chunks = Get-ChildItem -Path $ChunkDir -Filter 'part*.b64' | Sort-Object Name
if (-not $chunks) { throw "No part*.b64 files inside $ChunkDir" }

# Concatenate in filename order — the order must match the original split.
$b64 = ($chunks | ForEach-Object { (Get-Content $_.FullName -Raw) }) -join ''
$b64 = $b64 -replace '\s', ''

$bytes = [System.Convert]::FromBase64String($b64)
$md = [System.Text.Encoding]::UTF8.GetString($bytes)

# Write UTF-8 without BOM so downstream tools do not see a stray \uFEFF.
[System.IO.File]::WriteAllText($Out, $md, (New-Object System.Text.UTF8Encoding($false)))

$rows = ([regex]::Matches($md, '(?m)^\|\s*\d+\s*\|')).Count
$plain = ([regex]::Matches($md, '(?m)^\*\*\[\d{2}:\d{2}(?::\d{2})?\] [^:]+:\*\*')).Count

Write-Output "WROTE    : $((Resolve-Path $Out).Path)"
Write-Output "CHUNKS   : $($chunks.Count)"
Write-Output "CHARS    : $($md.Length)"
Write-Output "TABLE    : $rows"
Write-Output "PLAIN    : $plain"
Write-Output "CONSIST  : $($rows -eq $plain)"
