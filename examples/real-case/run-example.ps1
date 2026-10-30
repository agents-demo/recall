# Ingest the example case (or your case.json) and ask the openjiuwen agent.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File examples\real-case\run-example.ps1
#   powershell -ExecutionPolicy Bypass -File examples\real-case\run-example.ps1 -Case examples\real-case\case.json
#
# Prerequisites:
#   - PPMA running on 127.0.0.1:8771 (or set -PpmaBase)
#   - the bridge running: cd server; $env:PPMA_BASE_URL=...; npm run live
#   - coachme's venv with openjiuwen (override with -CoachmePython)

param(
  [string]$Case = "examples\real-case\case.example.json",
  [string]$Query = "For the Helios rollout case, list the decisions, the open actions with owners and due dates, and the top risk. Quote the exact PPMA memory statements.",
  [string]$Bridge = "http://127.0.0.1:8788",
  [string]$CoachmePython = "C:\Workspace\openjiuwendemos\coachme\.venv\Scripts\python.exe"
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $root

Write-Host "== 1. Ingest case =="
py -3 scripts\ingest_case.py --case $Case

Write-Host "`n== 2. Ask the agent =="
if (-not (Test-Path $CoachmePython)) {
  throw "openjiuwen venv not found at $CoachmePython. Pass -CoachmePython <path>."
}
$env:PYTHONIOENCODING = "utf-8"
$env:RECALL_BRIDGE = $Bridge
$env:RECALL_CASE_FILE = $Case
& $CoachmePython integrations\openjiuwen\recall_agent.py --json --query $Query
