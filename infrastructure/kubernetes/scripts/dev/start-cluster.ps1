<#
.SYNOPSIS
  Starts the k3d cluster and validates readiness.

.DESCRIPTION
  Validates:
  - Docker is running
  - Cluster exists
  - Cluster containers are running
  - Kubernetes API is accessible
  - Core namespaces are ready

.EXAMPLE
  .\start-cluster.ps1
#>

$ErrorActionPreference = "Stop"

$clusterName = "dev"
$Color = @{
    Title   = "Cyan"
    Success = "Green"
    Warning = "Yellow"
    Error   = "Red"
    Info    = "White"
}

function Write-Title {
    param([string]$Text)
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor $Color.Title
    Write-Host "║  $Text" -ForegroundColor $Color.Title
    Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor $Color.Title
}

# Check Docker
Write-Title "Checking Docker"
try {
    docker info | Out-Null
    Write-Host "✅ Docker is running" -ForegroundColor $Color.Success
}
catch {
    Write-Host "❌ Docker is not running. Please start Docker Desktop." -ForegroundColor $Color.Error
    exit 1
}

# Check cluster exists
Write-Title "Checking cluster"
$clusterExists = k3d cluster list 2>$null | Select-String -Pattern "^$clusterName\s"
if (-not $clusterExists) {
    Write-Host "❌ Cluster '$clusterName' does not exist." -ForegroundColor $Color.Error
    Write-Host "   Run: .\create-all-from-zero.ps1" -ForegroundColor $Color.Info
    exit 1
}
Write-Host "✅ Cluster '$clusterName' exists" -ForegroundColor $Color.Success

# Start cluster if not running
Write-Title "Starting cluster"
$clusterStatus = k3d cluster start $clusterName 2>&1
if ($clusterStatus -like "*started*" -or $clusterStatus -like "*already*") {
    Write-Host "✅ Cluster is started" -ForegroundColor $Color.Success
}
else {
    Write-Host "⚠️  Cluster start output: $clusterStatus" -ForegroundColor $Color.Warning
}

Start-Sleep -Seconds 5

# Set context
kubectl config use-context "k3d-$clusterName" | Out-Null

# Wait for API
Write-Title "Validating Kubernetes API"
$apiReady = $false
for ($i = 0; $i -lt 20; $i++) {
    try {
        kubectl cluster-info 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) {
            $apiReady = $true
            Write-Host "✅ Kubernetes API is ready" -ForegroundColor $Color.Success
            break
        }
    }
    catch {}
    
    Write-Host "   Attempt $($i+1)/20..." -ForegroundColor $Color.Info
    Start-Sleep -Seconds 5
}

if (-not $apiReady) {
    Write-Host "❌ Kubernetes API is not responding" -ForegroundColor $Color.Error
    exit 1
}

# Wait for core namespaces
Write-Title "Validating core namespaces"
foreach ($ns in @("argocd", "monitoring", "keda", "agro-apps")) {
    $nsReady = $false
    for ($i = 0; $i -lt 15; $i++) {
        $phase = kubectl get namespace $ns -o jsonpath="{.status.phase}" 2>$null
        if ($phase -eq "Active") {
            $nsReady = $true
            break
        }
        Start-Sleep -Seconds 2
    }
    
    if ($nsReady) {
        Write-Host "✅ Namespace '$ns' is ready" -ForegroundColor $Color.Success
    }
    else {
        Write-Host "⚠️  Namespace '$ns' is not ready yet (may be initializing)" -ForegroundColor $Color.Warning
    }
}

# Show status
Write-Title "Cluster Status"
Write-Host ""
kubectl get nodes -o wide
Write-Host ""
Write-Host "✅ Cluster is ready!" -ForegroundColor $Color.Success
Write-Host ""
