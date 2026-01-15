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

# Docker cleanup
Write-Host ""
Write-Host "=== Clean Docker resources? (containers, images, volumes, networks) ===" -ForegroundColor $Color.Warning
Write-Host "   This will remove:" -ForegroundColor $Color.Info
Write-Host "   - All stopped k3d containers" -ForegroundColor $Color.Muted
Write-Host "   - All k3d images (rancher/k3s, rancher/k3d-*, ghcr.io/k3d-io/*, registry:*)" -ForegroundColor $Color.Muted
Write-Host "   - All unused volumes" -ForegroundColor $Color.Muted
Write-Host "   - All unused networks" -ForegroundColor $Color.Muted
$confirmDocker = Read-Host "Type 'yes' to confirm"

if ($confirmDocker -eq "yes") {
    Write-Host "   Removing stopped k3d containers..." -ForegroundColor $Color.Info
    docker ps -a --filter "name=k3d-" --format "{{.ID}}" | ForEach-Object {
        docker rm -f $_ 2>&1 | Out-Null
    }
    
    Write-Host "   Removing k3d images (rancher/k3d-*)..." -ForegroundColor $Color.Info
    docker images --filter "reference=rancher/k3d-*" --format "{{.ID}}" | ForEach-Object {
        docker rmi -f $_ 2>&1 | Out-Null
    }
    
    Write-Host "   Removing k3s images (rancher/k3s*)..." -ForegroundColor $Color.Info
    docker images --filter "reference=rancher/k3s*" --format "{{.ID}}" | ForEach-Object {
        docker rmi -f $_ 2>&1 | Out-Null
    }
    
    Write-Host "   Removing k3d-io images (ghcr.io/k3d-io/*)..." -ForegroundColor $Color.Info
    docker images --filter "reference=ghcr.io/k3d-io/*" --format "{{.ID}}" | ForEach-Object {
        docker rmi -f $_ 2>&1 | Out-Null
    }
    
    Write-Host "   Removing registry images (registry:*)..." -ForegroundColor $Color.Info
    docker images --filter "reference=registry:*" --format "{{.ID}}" | ForEach-Object {
        docker rmi -f $_ 2>&1 | Out-Null
    }
    
    Write-Host "   Pruning unused volumes..." -ForegroundColor $Color.Info
    docker volume prune -f 2>&1 | Out-Null
    
    Write-Host "   Pruning unused networks..." -ForegroundColor $Color.Info
    docker network prune -f 2>&1 | Out-Null
    
    Write-Host "✅ Docker cleanup complete" -ForegroundColor $Color.Success
}
else {
    Write-Host "❌ Docker cleanup cancelled" -ForegroundColor $Color.Muted
}

Write-Host ""
Write-Host "✅ Cleanup complete" -ForegroundColor $Color.Success
Write-Host ""
Write-Host "📊 Current state:" -ForegroundColor $Color.Info
Write-Host "   k3d clusters:" -ForegroundColor $Color.Muted
k3d cluster list
Write-Host ""
Write-Host "   Docker containers:" -ForegroundColor $Color.Muted
docker ps -a --filter "name=k3d-"
Write-Host ""
