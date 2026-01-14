<#
.SYNOPSIS
  Starts the k3d "dev" cluster after computer restart.
.DESCRIPTION
  This script checks if the k3d cluster exists and starts it if stopped.
  Use this script after restarting your computer to reactivate the cluster.

  What this script does:
  1. Checks if Docker is running
  2. Lists existing k3d clusters
  3. Starts the "dev" cluster if it exists
  4. Configures the correct kubectl context
  5. Waits for main pods to be ready

.EXAMPLE
  .\start-cluster.ps1
#>

$clusterName = "dev"

Write-Host "`n=== Starting K3D Cluster ===" -ForegroundColor Cyan
Write-Host ""

# 1) Check if Docker is running
Write-Host "🐳 Checking if Docker is running..." -ForegroundColor Cyan
try {
    docker ps | Out-Null
    Write-Host "✅ Docker is active" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not running. Start Docker Desktop first!" -ForegroundColor Red
    Write-Host "   Wait for Docker Desktop to fully start before continuing." -ForegroundColor Yellow
    exit 1
}

# 2) Check if cluster exists
Write-Host "`n📋 Checking existing k3d clusters..." -ForegroundColor Cyan
$clusterList = k3d cluster list 2>&1 | Out-String

if ($clusterList -notmatch $clusterName) {
    Write-Host "❌ Cluster '$clusterName' not found!" -ForegroundColor Red
    Write-Host "   Run .\create-all-from-zero.ps1 to create the cluster first." -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Cluster '$clusterName' found" -ForegroundColor Green

# 3) Check if cluster containers are running
Write-Host "`n🔍 Checking container status..." -ForegroundColor Cyan
$containers = docker ps -a --filter "name=k3d-$clusterName" --format "{{.Names}}\t{{.Status}}"

if (-not $containers) {
    Write-Host "❌ No containers found for cluster '$clusterName'" -ForegroundColor Red
    Write-Host "   The cluster may have been deleted. Run .\create-all-from-zero.ps1" -ForegroundColor Yellow
    exit 1
}

# Check if any container is stopped
$stoppedContainers = $containers | Where-Object { $_ -match "Exited" }

if ($stoppedContainers) {
    Write-Host "⚠️  Cluster containers are stopped. Starting..." -ForegroundColor Yellow
    k3d cluster start $clusterName

    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to start the cluster!" -ForegroundColor Red
        exit 1
    }

    Write-Host "✅ Cluster started successfully" -ForegroundColor Green
    Start-Sleep -Seconds 5
} else {
    Write-Host "✅ Cluster is already running" -ForegroundColor Green
}

# 4) Configure kubectl context
Write-Host "`n⚙️  Configuring kubectl context..." -ForegroundColor Cyan
kubectl config use-context "k3d-$clusterName" | Out-Null

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to configure kubectl context!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ kubectl context configured: k3d-$clusterName" -ForegroundColor Green

# 5) Wait for main pods to be ready
Write-Host "`n⏳ Waiting for main pods to be ready..." -ForegroundColor Cyan
Write-Host "   (This may take a few minutes after reboot)" -ForegroundColor Gray

$namespaces = @("argocd", "monitoring", "keda")
$ready = $true

foreach ($ns in $namespaces) {
    Write-Host "   Checking namespace: $ns" -ForegroundColor Gray

    $attempts = 0
    $maxAttempts = 30

    while ($attempts -lt $maxAttempts) {
        $pods = kubectl -n $ns get pods --no-headers 2>$null

        if ($pods) {
            $notReady = $pods | Where-Object { $_ -notmatch "Running|Completed" }

            if (-not $notReady) {
                Write-Host "   ✅ ${ns}: All pods ready" -ForegroundColor Green
                break
            }
        }

        $attempts++
        Start-Sleep -Seconds 5
    }

    if ($attempts -eq $maxAttempts) {
        Write-Host "   ⚠️  ${ns}: Some pods are not ready yet (timeout)" -ForegroundColor Yellow
        $ready = $false
    }
}

# 6) Verify ArgoCD Ingress is present
Write-Host "`n🌐 Verifying ArgoCD Ingress..." -ForegroundColor Cyan
$ingress = kubectl get ingress -n argocd argocd-server --no-headers 2>$null
if ($ingress) {
    Write-Host "   ✅ ArgoCD Ingress is active (argocd.local)" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  ArgoCD Ingress not found. Applying..." -ForegroundColor Yellow
    $manifestsPath = Join-Path (Split-Path $PSScriptRoot -Parent) "manifests"
    kubectl apply -f "$manifestsPath\argocd-ingress.yaml" 2>$null
    Write-Host "   ✅ ArgoCD Ingress applied" -ForegroundColor Green
}

# 7) Check hosts file
Write-Host "`n📝 Checking hosts file..." -ForegroundColor Cyan
$hostsContent = Get-Content C:\Windows\System32\drivers\etc\hosts -ErrorAction SilentlyContinue
$hasArgocd = $hostsContent -match "argocd\.local"
$hasCloudgames = $hostsContent -match "cloudgames\.local"
if ($hasArgocd -and $hasCloudgames) {
    Write-Host "   ✅ Hosts file configured (argocd.local, cloudgames.local)" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  Hosts file missing entries. Run as Admin:" -ForegroundColor Yellow
    Write-Host "      .\k3d-manager.ps1 update-hosts" -ForegroundColor White
}

# 8) Summary
Write-Host "`n=== Summary ===" -ForegroundColor Cyan
Write-Host "Cluster:  k3d-$clusterName" -ForegroundColor White
Write-Host "Status:   " -NoNewline
if ($ready) {
    Write-Host "✅ Ready" -ForegroundColor Green
} else {
    Write-Host "⚠️  Partially ready (some pods still initializing)" -ForegroundColor Yellow
}

Write-Host "`n🌐 ACCESS URLs (Native Ingress - NO port-forward needed!):" -ForegroundColor Cyan
Write-Host "   ArgoCD:       http://argocd.local (admin / Argo@123)" -ForegroundColor White
Write-Host "   User API:     http://cloudgames.local/user" -ForegroundColor White
Write-Host "   Games API:    http://cloudgames.local/games" -ForegroundColor White
Write-Host "   Payments API: http://cloudgames.local/payments" -ForegroundColor White

Write-Host "`n💡 Port-forward only needed for Grafana:" -ForegroundColor Cyan
Write-Host "   .\k3d-manager.ps1 port-forward grafana" -ForegroundColor White
Write-Host "   Access: http://localhost:3000" -ForegroundColor Gray
Write-Host ""

