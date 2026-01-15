<#
.SYNOPSIS
  Start stopped k3d cluster and validate readiness.

.DESCRIPTION
  Starts a stopped k3d cluster and waits for nodes to be Ready.

.EXAMPLE
  .\start-cluster.ps1
#>

$clusterName = "dev"

$Color = @{
    Success = "Green"
    Error   = "Red"
    Info    = "Cyan"
    Muted   = "Gray"
}

Write-Host ""
Write-Host "=== Starting cluster '$clusterName' ===" -ForegroundColor $Color.Info

k3d cluster start $clusterName 2>&1 | Out-Null

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to start cluster" -ForegroundColor $Color.Error
    exit 1
}

Write-Host "✅ Cluster started" -ForegroundColor $Color.Success

Write-Host ""
Write-Host "=== Waiting for nodes to be Ready ===" -ForegroundColor $Color.Info

for ($i = 0; $i -lt 30; $i++) {
    $nodes = kubectl get nodes --no-headers 2>$null
    if ($nodes) {
        $notReady = $nodes | Where-Object { $_ -notmatch "\sReady\s" }
        if (-not $notReady) {
            Write-Host "✅ All nodes Ready:" -ForegroundColor $Color.Success
            kubectl get nodes -o wide
            Write-Host ""
            exit 0
        }
    }
    Write-Host "   Attempt $($i+1)/30..." -ForegroundColor $Color.Muted
    Start-Sleep -Seconds 3
}

Write-Host "⚠️  Timeout waiting for nodes" -ForegroundColor $Color.Warning
Write-Host ""
