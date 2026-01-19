<#
.SYNOPSIS
  Stop running k3d cluster without deleting it.

.DESCRIPTION
  Stops the k3d cluster gracefully, preserving all data.
  Cluster can be restarted later with start-cluster.ps1

.EXAMPLE
  .\stop-cluster.ps1
#>

$clusterName = "dev"

$Color = @{
    Success = "Green"
    Error   = "Red"
    Info    = "Cyan"
    Muted   = "Gray"
    Warning = "Yellow"
}

Write-Host ""
Write-Host "=== Stopping cluster '$clusterName' ===" -ForegroundColor $Color.Info

# Stop all port-forwards first
Write-Host "   Stopping port-forwards..." -ForegroundColor $Color.Muted
Get-Process kubectl -ErrorAction SilentlyContinue | 
Where-Object { 
    try {
        $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $($_.Id)").CommandLine
        $cmdLine -like "*port-forward*"
    }
    catch { $false }
} | 
Stop-Process -Force -ErrorAction SilentlyContinue

Start-Sleep -Seconds 1

# Stop cluster
k3d cluster stop $clusterName 2>&1 | Out-Null

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to stop cluster" -ForegroundColor $Color.Error
    Write-Host "   Check if cluster is already stopped: k3d cluster list" -ForegroundColor $Color.Warning
    exit 1
}

Write-Host "✅ Cluster stopped successfully" -ForegroundColor $Color.Success
Write-Host ""
Write-Host "💡 To restart the cluster:" -ForegroundColor $Color.Info
Write-Host "   .\start-cluster.ps1" -ForegroundColor $Color.Success
Write-Host "   or" -ForegroundColor $Color.Muted
Write-Host "   .\manager.ps1 → Option 2 (Start cluster)" -ForegroundColor $Color.Success
Write-Host ""
