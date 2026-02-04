<#
.SYNOPSIS
  Start stopped k3d cluster and validate readiness.

.DESCRIPTION
  Starts a stopped k3d cluster and waits for nodes to be Ready.
  Includes Docker validation and kubeconfig fix.

.EXAMPLE
  .\start-cluster.ps1
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
Write-Host "=== Starting cluster '$clusterName' ===" -ForegroundColor $Color.Info

# Check if Docker is running
Write-Host "   Checking Docker daemon..." -ForegroundColor $Color.Muted
try {
    $dockerCheck = docker ps 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Docker daemon not responding" -ForegroundColor $Color.Error
        Write-Host "   Please start Docker Desktop and wait a few seconds" -ForegroundColor $Color.Warning
        exit 1
    }
    Write-Host "   ✅ Docker is running" -ForegroundColor $Color.Success
}
catch {
    Write-Host "❌ Docker not found or not accessible" -ForegroundColor $Color.Error
    exit 1
}

# Check cluster exists
Write-Host "   Checking if cluster exists..." -ForegroundColor $Color.Muted
$clusterExists = k3d cluster list 2>&1 | Select-String -Pattern "^$clusterName\s"
if (-not $clusterExists) {
    Write-Host "❌ Cluster '$clusterName' not found" -ForegroundColor $Color.Error
    Write-Host "   Run bootstrap first: .\bootstrap.ps1" -ForegroundColor $Color.Warning
    exit 1
}
Write-Host "   ✅ Cluster exists" -ForegroundColor $Color.Success



# Start cluster with verbose output
Write-Host ""
Write-Host "   Starting cluster... (this may take 20-30 seconds)" -ForegroundColor $Color.Muted
$startOutput = k3d cluster start $clusterName 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to start cluster" -ForegroundColor $Color.Error
    Write-Host "   Output: $startOutput" -ForegroundColor $Color.Muted
    Write-Host ""
    Write-Host "🔧 Troubleshooting:" -ForegroundColor $Color.Warning
    Write-Host "   1) Check Docker Desktop status (should show 'Running')" -ForegroundColor $Color.Muted
    Write-Host "   2) Try manual k3d command: k3d cluster start $clusterName" -ForegroundColor $Color.Muted
    Write-Host "   3) If stuck, try: k3d cluster delete $clusterName && .\bootstrap.ps1" -ForegroundColor $Color.Muted
    exit 1
}

Write-Host "✅ Cluster started" -ForegroundColor $Color.Success

# Ensure server load-balancer container is running (k3d-$clusterName-serverlb)
$lbName = "k3d-$clusterName-serverlb"
$lbContainer = docker ps -a --filter "name=$lbName" --format "{{.ID}} {{.Status}}" 2>$null
if ($lbContainer) {
    $parts = $lbContainer.Trim() -split "\s+"
    $cid = $parts[0]
    $cstatus = ($parts[1..($parts.Length-1)] -join " ")
    if ($cstatus -notlike "Up*") {
        Write-Host "   Starting load-balancer container (docker start $cid)..." -ForegroundColor $Color.Muted
        docker start $cid 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   ✅ Load-balancer started" -ForegroundColor $Color.Success
        }
        else {
            Write-Host "   ⚠️  Failed to start load-balancer $lbName" -ForegroundColor $Color.Warning
        }
    }
    else {
        Write-Host "   ✅ Load-balancer already running" -ForegroundColor $Color.Success
    }
}
else {
    Write-Host "   ⚠️  Load-balancer container $lbName not found; cluster networking may be impaired" -ForegroundColor $Color.Warning
}

# Fix kubeconfig for Docker Desktop (if needed)
Write-Host ""
Write-Host "=== Fixing kubeconfig context ===" -ForegroundColor $Color.Info
try {
    $contextOutput = kubectl config use-context "k3d-$clusterName" 2>&1
    Write-Host "   ✅ Context set to k3d-$clusterName" -ForegroundColor $Color.Success
}
catch {
    Write-Host "   ⚠️  Warning setting context: $_" -ForegroundColor $Color.Warning
}

Write-Host ""
Write-Host "=== Waiting for nodes to be Ready ===" -ForegroundColor $Color.Info
Write-Host "   (Timeout: 90 seconds)" -ForegroundColor $Color.Muted
Write-Host ""

$nodesReady = $false
for ($i = 0; $i -lt 30; $i++) {
    try {
        $nodes = kubectl get nodes --no-headers 2>$null
        if ($nodes) {
            $notReady = $nodes | Where-Object { $_ -notmatch "\sReady\s" }
            if (-not $notReady) {
                Write-Host "✅ All nodes Ready:" -ForegroundColor $Color.Success
                kubectl get nodes -o wide
                $nodesReady = $true
                break
            }
            else {
                Write-Host "   ⏳ Attempt $($i+1)/30 - Nodes not yet ready..." -ForegroundColor $Color.Muted
            }
        }
        else {
            Write-Host "   ⏳ Attempt $($i+1)/30 - Waiting for API connectivity..." -ForegroundColor $Color.Muted
        }
    }
    catch {
        Write-Host "   ⏳ Attempt $($i+1)/30 - Checking cluster state..." -ForegroundColor $Color.Muted
    }
    Start-Sleep -Seconds 3
}

if ($nodesReady) {
    Write-Host ""
    
    # Start ArgoCD port-forward for convenient access
    Write-Host "=== Starting ArgoCD port-forward ===" -ForegroundColor $Color.Info
    $portForwardScript = Join-Path $PSScriptRoot "port-forward.ps1"
    if (Test-Path $portForwardScript) {
        & $portForwardScript "argocd"
    }
    else {
        Write-Host "⚠️  port-forward.ps1 not found at $portForwardScript" -ForegroundColor $Color.Warning
    }
    
    exit 0
}
else {
    Write-Host ""
    Write-Host "❌ Timeout waiting for nodes to be ready (90+ seconds)" -ForegroundColor $Color.Error
    Write-Host ""
    Write-Host "🔧 Diagnostics:" -ForegroundColor $Color.Warning
    Write-Host "   1) Check Docker containers manually:" -ForegroundColor $Color.Muted
    Write-Host "      docker ps | findstr k3d-$clusterName" -ForegroundColor $Color.Success
    Write-Host ""
    Write-Host "   2) Check k3d logs:" -ForegroundColor $Color.Muted
    Write-Host "      k3d cluster list" -ForegroundColor $Color.Success
    Write-Host ""
    Write-Host "   3) If containers are stopped:" -ForegroundColor $Color.Muted
    Write-Host "      docker ps -a | findstr k3d-$clusterName" -ForegroundColor $Color.Success
    Write-Host ""
    Write-Host "   4) Recovery options:" -ForegroundColor $Color.Muted
    Write-Host "      • Restart Docker Desktop and try again" -ForegroundColor $Color.Success
    Write-Host "      • Delete and recreate: k3d cluster delete $clusterName && .\bootstrap.ps1" -ForegroundColor $Color.Success
    Write-Host ""
    exit 1
}
