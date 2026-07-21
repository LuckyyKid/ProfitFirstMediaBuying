Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location -LiteralPath $repoRoot

$env:CI = "true"
$npm = "C:\Program Files\nodejs\npm.cmd"
if (-not (Test-Path -LiteralPath $npm)) {
  $npm = (Get-Command npm.cmd -ErrorAction Stop).Source
}

& $npm run dev -- --host 127.0.0.1 --port 5173
