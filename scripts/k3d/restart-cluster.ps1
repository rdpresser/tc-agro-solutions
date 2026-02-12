<#
.SYNOPSIS
  Restart k3d cluster (stop + start).

.DESCRIPTION
  Performs a full restart of the k3d cluster:
  1. Stops port-forwards
  2. Stops cluster
  3. Starts cluster
  4. Waits for nodes to be Ready
  5. Waits for ArgoCD to be Ready

.EXAMPLE
  .\restart-cluster.ps1
#>

$clusterName = "dev"

$portUtils = Join-Path $PSScriptRoot "port-utils.ps1"
if (Test-Path $portUtils) {
    . $portUtils
}

$Color = @{
    Success = "Green"
    Error   = "Red"
    Info    = "Cyan"
    Muted   = "Gray"
    Warning = "Yellow"
}

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor $Color.Info
Write-Host "║          K3D CLUSTER RESTART                              ║" -ForegroundColor $Color.Info
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor $Color.Info

# Step 1: Stop cluster
Write-Host ""
Write-Host "=== Step 1/2: Stopping cluster ===" -ForegroundColor $Color.Info

$apiStatus = $null
if (Get-Command Test-K3dApiPortHealth -ErrorAction SilentlyContinue) {
    $apiStatus = Test-K3dApiPortHealth -ClusterName $clusterName
    if ($apiStatus.Port) {
        if ($apiStatus.IsExcluded) {
            Write-Host "⚠️  Cluster API port $($apiStatus.Port) is in a Windows excluded port range." -ForegroundColor $Color.Warning
            Write-Host "   Recommendation: re-run .\bootstrap.ps1 to recreate the cluster with a safe port." -ForegroundColor $Color.Muted
        }
        elseif ($apiStatus.IsInUse) {
            Write-Host "⚠️  Cluster API port $($apiStatus.Port) is already in use on the host." -ForegroundColor $Color.Warning
            Write-Host "   Recommendation: stop the conflicting process or re-run .\bootstrap.ps1." -ForegroundColor $Color.Muted
        }
    }
}

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

k3d cluster stop $clusterName 2>&1 | Out-Null

if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Cluster may already be stopped" -ForegroundColor $Color.Warning
}
else {
    Write-Host "✅ Cluster stopped" -ForegroundColor $Color.Success
}

Start-Sleep -Seconds 2

# Step 2: Start cluster
Write-Host ""
Write-Host "=== Step 2/2: Starting cluster ===" -ForegroundColor $Color.Info

k3d cluster start $clusterName 2>&1 | Out-Null

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to start cluster" -ForegroundColor $Color.Error
    exit 1
}

Write-Host "✅ Cluster started" -ForegroundColor $Color.Success

# Wait for nodes to be Ready
Write-Host ""
Write-Host "=== Waiting for nodes to be Ready ===" -ForegroundColor $Color.Info

for ($i = 0; $i -lt 30; $i++) {
    $nodes = kubectl get nodes --no-headers 2>$null
    if ($nodes) {
        $notReady = $nodes | Where-Object { $_ -notmatch "\sReady\s" }
        if (-not $notReady) {
            Write-Host "✅ All nodes Ready:" -ForegroundColor $Color.Success
            kubectl get nodes -o wide
            break
        }
    }
    Write-Host "   Attempt $($i+1)/30..." -ForegroundColor $Color.Muted
    Start-Sleep -Seconds 3
}

# Wait for ArgoCD to be Ready
Write-Host ""
Write-Host "=== Waiting for ArgoCD pods ===" -ForegroundColor $Color.Info

for ($i = 0; $i -lt 60; $i++) {
    $argocdPods = kubectl get pods -n argocd --no-headers 2>$null
    if ($argocdPods) {
        $running = $argocdPods | Where-Object { $_ -match "Running" } | Measure-Object | Select-Object -ExpandProperty Count
        $total = ($argocdPods | Measure-Object).Count
        
        if ($running -eq $total -and $total -gt 0) {
            Write-Host "✅ ArgoCD pods Ready ($running/$total)" -ForegroundColor $Color.Success
            break
        }
        
        Write-Host "   Attempt $($i+1)/60: $running/$total pods Running..." -ForegroundColor $Color.Muted
    }
    Start-Sleep -Seconds 2
}

# Summary
Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor $Color.Success
Write-Host "║          ✅ CLUSTER RESTART COMPLETE                      ║" -ForegroundColor $Color.Success
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor $Color.Success
Write-Host ""
Write-Host "🌐 ACCESS URLS:" -ForegroundColor $Color.Info
Write-Host "   ArgoCD: http://localhost/argocd/" -ForegroundColor $Color.Success
Write-Host "   (Ingress via Traefik - no port-forward needed)" -ForegroundColor $Color.Muted
Write-Host ""
Write-Host "💡 NEXT STEPS:" -ForegroundColor $Color.Info
Write-Host "   1. Verify ArgoCD Applications:" -ForegroundColor $Color.Muted
Write-Host "      kubectl get applications -n argocd" -ForegroundColor $Color.Success
Write-Host ""
Write-Host "   2. Force sync if needed:" -ForegroundColor $Color.Muted
Write-Host "      .\sync-argocd.ps1 all" -ForegroundColor $Color.Success
Write-Host ""
Write-Host "   3. Diagnose ArgoCD access:" -ForegroundColor $Color.Muted
Write-Host "      .\diagnose-argocd.ps1" -ForegroundColor $Color.Success
Write-Host ""
