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
Write-Host "=== Starting cluster '$clusterName' ===" -ForegroundColor $Color.Info

# Check if Docker is running
Write-Host "   Checking Docker daemon..." -ForegroundColor $Color.Muted
try {
    docker ps 2>&1 | Out-Null
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



# Start cluster with verbose output
Write-Host ""
Write-Host "   Starting cluster... (this may take 20-30 seconds)" -ForegroundColor $Color.Muted
$startOutput = k3d cluster start $clusterName 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to start cluster" -ForegroundColor $Color.Error
    Write-Host "   Output: $startOutput" -ForegroundColor $Color.Muted
    Write-Host ""

    $startOutputText = ($startOutput | Out-String)
    if ($startOutputText -match "network\s+[a-f0-9]{12,}\s+not\s+found") {
        Write-Host "🔧 Root cause detected: orphaned Docker network reference in k3d containers." -ForegroundColor $Color.Warning
        Write-Host "   This happens when tc-agro-network was removed while cluster was running." -ForegroundColor $Color.Muted
        Write-Host "" 
        Write-Host "✅ Recommended fix:" -ForegroundColor $Color.Info
        Write-Host "   1) Run manager option 22 (Diagnose & fix cluster network issues)" -ForegroundColor $Color.Muted
        Write-Host "   2) If cluster is deleted during fix, run option 20 (Full Rebuild) or option 1 (Bootstrap)" -ForegroundColor $Color.Muted
        Write-Host "" 

        $autoFix = Read-Host "Apply automatic fix now (delete cluster '$clusterName')? (yes/no)"
        if ($autoFix -eq "yes") {
            Write-Host "" 
            Write-Host "🗑️  Deleting broken cluster '$clusterName'..." -ForegroundColor $Color.Warning
            k3d cluster delete $clusterName 2>&1 | Out-Null

            if ($LASTEXITCODE -eq 0) {
                Write-Host "✅ Cluster deleted successfully" -ForegroundColor $Color.Success
                Write-Host "" 
                Write-Host "🚀 Next step: run option 20 (Full Rebuild) or option 1 (Bootstrap)." -ForegroundColor $Color.Info
                exit 2
            }
            else {
                Write-Host "❌ Failed to delete cluster automatically" -ForegroundColor $Color.Error
                Write-Host "   Try manually: k3d cluster delete $clusterName" -ForegroundColor $Color.Muted
                exit 1
            }
        }
    }

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
    $cstatus = ($parts[1..($parts.Length - 1)] -join " ")
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
    kubectl config use-context "k3d-$clusterName" 2>&1 | Out-Null
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
