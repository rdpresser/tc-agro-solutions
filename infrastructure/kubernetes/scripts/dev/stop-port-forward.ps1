<#
.SYNOPSIS
  Stops background port-forward processes.

.DESCRIPTION
  Terminates kubectl port-forward processes for cleanup.

.EXAMPLE
  .\stop-port-forward.ps1 grafana
  .\stop-port-forward.ps1 all
#>

param(
    [ValidateSet("grafana", "prometheus", "loki", "tempo", "all")]
    [string]$Service = "all"
)

$ErrorActionPreference = "Stop"

$Color = @{
    Title    = "Cyan"
    Success  = "Green"
    Warning  = "Yellow"
    Error    = "Red"
    Info     = "White"
}

function Write-Title {
    param([string]$Text)
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor $Color.Title
    Write-Host "║  $Text" -ForegroundColor $Color.Title
    Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor $Color.Title
}

Write-Title "Stopping Port-Forwards"

if ($Service -eq "all") {
    Write-Host "Stopping all kubectl port-forward processes..." -ForegroundColor $Color.Info
    Get-Process kubectl -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*port-forward*" } | Stop-Process -Force -ErrorAction SilentlyContinue
    Write-Host "✅ All port-forwards stopped" -ForegroundColor $Color.Success
} else {
    Write-Host "Stopping port-forward for: $Service" -ForegroundColor $Color.Info
    Get-Process kubectl -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*$Service*" } | Stop-Process -Force -ErrorAction SilentlyContinue
    Write-Host "✅ Port-forward stopped" -ForegroundColor $Color.Success
}

Write-Host ""
