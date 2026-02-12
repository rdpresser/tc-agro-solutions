<#
.SYNOPSIS
  Cleanup k3d cluster and registry (SAFE mode).

.DESCRIPTION
  Stops port-forwards and deletes k3d cluster and registry.
  Also removes ONLY k3d-related Docker resources:
  - k3d containers
  - k3d networks
  - k3d volumes (only those used by the cluster, and only if orphaned)
  - k3d/k3s images (optional)

  ⚠️ This script DOES NOT run:
  - docker volume prune
  - docker network prune

  This avoids deleting Docker Compose resources.

.EXAMPLE
  .\cleanup.ps1

.EXAMPLE
  echo "yes`nyes`nyes" | .\cleanup.ps1  # Non-interactive
#>

$clusterName = "dev"

$Color = @{
    Success = "Green"
    Error   = "Red"
    Warning = "Yellow"
    Info    = "Cyan"
    Muted   = "Gray"
}

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "=== $Message ===" -ForegroundColor $Color.Info
}

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor $Color.Warning
Write-Host "║                    CLEANUP K3D CLUSTER                     ║" -ForegroundColor $Color.Warning
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor $Color.Warning
Write-Host ""

# Stop port-forwards
Write-Step "Stopping port-forwards"
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

# Docker cleanup (SAFE)
Write-Host ""
Write-Host "=== Clean k3d Docker resources only? ===" -ForegroundColor $Color.Warning
Write-Host "   This will remove ONLY k3d-related resources:" -ForegroundColor $Color.Info
Write-Host "   - Containers: name starts with 'k3d-'" -ForegroundColor $Color.Muted
Write-Host "   - Networks:  name starts with 'k3d-'" -ForegroundColor $Color.Muted
Write-Host "   - Volumes:   only volumes mounted by k3d cluster containers (if orphaned)" -ForegroundColor $Color.Muted
Write-Host "   - Images:    optional (k3d/k3s only)" -ForegroundColor $Color.Muted
Write-Host ""
Write-Host "   ⚠️ No global prune will be executed (safe for Docker Compose)." -ForegroundColor $Color.Success

$confirmDocker = Read-Host "Type 'yes' to confirm"

if ($confirmDocker -eq "yes") {

    # --------------------------------------------------
    # Remove k3d containers (safe by name prefix)
    # --------------------------------------------------
    Write-Step "Removing k3d containers"
    $k3dContainers = docker ps -a --filter "name=^k3d-" --format "{{.ID}}"
    if ($k3dContainers) {
        $k3dContainers | ForEach-Object {
            docker rm -f $_ 2>&1 | Out-Null
        }
        Write-Host "✅ k3d containers removed" -ForegroundColor $Color.Success
    }
    else {
        Write-Host "No k3d containers found" -ForegroundColor $Color.Muted
    }

    # --------------------------------------------------
    # Remove k3d networks (safe by name prefix)
    # --------------------------------------------------
    Write-Step "Removing k3d networks"
    $k3dNetworks = docker network ls --format "{{.Name}}" | Where-Object { $_ -like "k3d-*" }
    if ($k3dNetworks) {
        $k3dNetworks | ForEach-Object {
            docker network rm $_ 2>&1 | Out-Null
        }
        Write-Host "✅ k3d networks removed" -ForegroundColor $Color.Success
    }
    else {
        Write-Host "No k3d networks found" -ForegroundColor $Color.Muted
    }

    # Remove tc-agro-network (shared with Docker Compose)
    $tcAgroNet = docker network ls --format "{{.Name}}" | Where-Object { $_ -eq "tc-agro-network" }
    if ($tcAgroNet) {
        Write-Host "Removing tc-agro-network (shared network)..." -ForegroundColor $Color.Info
        docker network rm tc-agro-network 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ tc-agro-network removed" -ForegroundColor $Color.Success
        }
        else {
            Write-Host "⚠️  tc-agro-network in use or already removed" -ForegroundColor $Color.Warning
        }
    }

    # --------------------------------------------------
    # Remove k3d volumes (safe: only volumes mounted by k3d cluster containers)
    # --------------------------------------------------
    Write-Step "Removing k3d volumes (safe mode)"

    # Find volumes referenced by k3d cluster containers (by name prefix)
    $volumeNames = @()

    $containers = docker ps -a --filter "name=^k3d-$clusterName" --format "{{.ID}}"
    foreach ($c in $containers) {
        try {
            $mounts = docker inspect $c --format "{{json .Mounts}}" 2>$null | ConvertFrom-Json
            foreach ($m in $mounts) {
                if ($m.Type -eq "volume" -and $m.Name) {
                    $volumeNames += $m.Name
                }
            }
        }
        catch {}
    }

    $volumeNames = $volumeNames | Sort-Object -Unique

    if (-not $volumeNames -or $volumeNames.Count -eq 0) {
        Write-Host "No k3d volumes detected from cluster containers" -ForegroundColor $Color.Muted
    }
    else {
        Write-Host "Detected $($volumeNames.Count) volume(s) from k3d containers" -ForegroundColor $Color.Info

        foreach ($v in $volumeNames) {
            # Only remove volume if it is NOT used by any container anymore
            $usedBy = docker ps -a --filter "volume=$v" --format "{{.ID}}"
            if (-not $usedBy) {
                docker volume rm $v 2>&1 | Out-Null
                Write-Host "✅ Removed volume: $v" -ForegroundColor $Color.Success
            }
            else {
                Write-Host "Skipping volume (still in use): $v" -ForegroundColor $Color.Warning
            }
        }
    }

    # --------------------------------------------------
    # Optional: remove k3d/k3s images only (safe filters)
    # --------------------------------------------------
    Write-Host ""
    Write-Host "=== Remove k3d/k3s images? (optional) ===" -ForegroundColor $Color.Warning
    Write-Host "   This will remove ONLY images matching:" -ForegroundColor $Color.Info
    Write-Host "   - rancher/k3d-*" -ForegroundColor $Color.Muted
    Write-Host "   - rancher/k3s*" -ForegroundColor $Color.Muted
    Write-Host "   - ghcr.io/k3d-io/*" -ForegroundColor $Color.Muted
    $confirmImages = Read-Host "Type 'yes' to confirm"

    if ($confirmImages -eq "yes") {
        Write-Step "Removing k3d/k3s images"

        docker images --filter "reference=rancher/k3d-*" --format "{{.ID}}" | ForEach-Object {
            docker rmi -f $_ 2>&1 | Out-Null
        }

        docker images --filter "reference=rancher/k3s*" --format "{{.ID}}" | ForEach-Object {
            docker rmi -f $_ 2>&1 | Out-Null
        }

        docker images --filter "reference=ghcr.io/k3d-io/*" --format "{{.ID}}" | ForEach-Object {
            docker rmi -f $_ 2>&1 | Out-Null
        }

        Write-Host "✅ k3d/k3s images removed" -ForegroundColor $Color.Success
    }
    else {
        Write-Host "❌ Image removal skipped" -ForegroundColor $Color.Muted
    }

    Write-Host ""
    Write-Host "✅ Safe k3d Docker cleanup complete" -ForegroundColor $Color.Success
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
Write-Host "   Docker containers (k3d-*):" -ForegroundColor $Color.Muted
docker ps -a --filter "name=k3d-"
Write-Host ""
