<#
.SYNOPSIS
  Cleans up k3d cluster and registry (idempotent).

.DESCRIPTION
  Prompts for confirmation, then:
  - Kills all kubectl port-forwards
  - Deletes k3d cluster
  - Optionally deletes local registry

.EXAMPLE
  .\cleanup-all.ps1
#>

$ErrorActionPreference = "Stop"

$clusterName = "dev"
$registryName = "localhost"
$Color = @{
    Title   = "Cyan"
    Success = "Green"
    Warning = "Yellow"
    Error   = "Red"
    Info    = "White"
    Muted   = "Gray"
}

function Write-Title {
    param([string]$Text)
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor $Color.Title
    Write-Host "║  $Text" -ForegroundColor $Color.Title
    Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor $Color.Title
}

Write-Title "CLEANUP CONFIRMATION"
Write-Host ""
Write-Host "⚠️  This will DELETE:" -ForegroundColor $Color.Warning
Write-Host "   - All port-forward processes" -ForegroundColor $Color.Muted
Write-Host "   - Cluster '$clusterName' and all resources" -ForegroundColor $Color.Muted
Write-Host "   - (Optional) Registry 'localhost:5000'" -ForegroundColor $Color.Muted
Write-Host ""

$confirm = Read-Host "Type 'yes' to confirm cleanup"
if ($confirm -ne "yes") {
    Write-Host "Cleanup cancelled." -ForegroundColor $Color.Info
    exit 0
}

Write-Title "Stopping port-forwards"
Write-Host "Killing all kubectl port-forward processes..." -ForegroundColor $Color.Info
Get-Process kubectl -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*port-forward*" } | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1
Write-Host "✅ Port-forwards stopped" -ForegroundColor $Color.Success

Write-Title "Deleting cluster"
$clusterExists = k3d cluster list 2>$null | Select-String -Pattern "^$clusterName\s"
if ($clusterExists) {
    Write-Host "Deleting cluster '$clusterName'..." -ForegroundColor $Color.Info
    k3d cluster delete $clusterName
    Write-Host "✅ Cluster deleted" -ForegroundColor $Color.Success
}
else {
    Write-Host "Cluster '$clusterName' does not exist. Skipping." -ForegroundColor $Color.Muted
}

Write-Title "Deleting registry"
$deleteRegistry = Read-Host "Delete registry '$registryName' as well? (yes/no)"
if ($deleteRegistry -eq "yes") {
    $regExists = k3d registry list 2>$null | Select-String -Pattern "^$registryName"
    if ($regExists) {
        Write-Host "Deleting registry '$registryName'..." -ForegroundColor $Color.Info
        k3d registry delete $registryName
        Write-Host "✅ Registry deleted" -ForegroundColor $Color.Success
    }
    else {
        Write-Host "Registry '$registryName' does not exist. Skipping." -ForegroundColor $Color.Muted
    }
}
else {
    Write-Host "Registry left in place." -ForegroundColor $Color.Muted
}

Write-Host ""
Write-Host "✅ Cleanup complete!" -ForegroundColor $Color.Success
Write-Host ""
