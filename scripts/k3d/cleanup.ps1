<#
.SYNOPSIS
  Cleanup k3d cluster and registry.

.DESCRIPTION
  Stops port-forwards and deletes k3d cluster and registry.
  Prompts for confirmation before deletion.

.EXAMPLE
  .\cleanup.ps1
  
.EXAMPLE
  echo "yes`nyes" | .\cleanup.ps1  # Non-interactive
#>

$clusterName = "dev"
$registryName = "localhost"

$Color = @{
    Success = "Green"
    Error   = "Red"
    Warning = "Yellow"
    Info    = "Cyan"
    Muted   = "Gray"
}

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor $Color.Warning
Write-Host "║                    CLEANUP K3D CLUSTER                     ║" -ForegroundColor $Color.Warning
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor $Color.Warning
Write-Host ""

# Stop port-forwards
Write-Host "=== Stopping port-forwards ===" -ForegroundColor $Color.Info
Get-Process kubectl -ErrorAction SilentlyContinue | 
Where-Object { $_.CommandLine -like "*port-forward*" } | 
Stop-Process -Force -ErrorAction SilentlyContinue
Write-Host "✅ Port-forwards stopped" -ForegroundColor $Color.Success

# Delete cluster
Write-Host ""
Write-Host "=== Delete cluster '$clusterName'? ===" -ForegroundColor $Color.Warning
$confirmCluster = Read-Host "Type 'yes' to confirm"

if ($confirmCluster -eq "yes") {
    k3d cluster delete $clusterName 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Cluster deleted" -ForegroundColor $Color.Success
    }
    else {
        Write-Host "⚠️  Cluster not found or already deleted" -ForegroundColor $Color.Muted
    }
}
else {
    Write-Host "❌ Cluster deletion cancelled" -ForegroundColor $Color.Muted
}

# Delete registry
Write-Host ""
Write-Host "=== Delete registry '$registryName'? ===" -ForegroundColor $Color.Warning
$confirmRegistry = Read-Host "Type 'yes' to confirm"

if ($confirmRegistry -eq "yes") {
    k3d registry delete $registryName 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Registry deleted" -ForegroundColor $Color.Success
    }
    else {
        Write-Host "⚠️  Registry not found or already deleted" -ForegroundColor $Color.Muted
    }
}
else {
    Write-Host "❌ Registry deletion cancelled" -ForegroundColor $Color.Muted
}

Write-Host ""
Write-Host "✅ Cleanup complete" -ForegroundColor $Color.Success
Write-Host ""
