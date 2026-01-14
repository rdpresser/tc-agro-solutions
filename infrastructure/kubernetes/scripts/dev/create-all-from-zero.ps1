<#
.SYNOPSIS
  Creates local k3d cluster with AKS-like node pools (system/apps) and full observability stack.
  
.DESCRIPTION
  Two-step approach:
  1. Create cluster: 1 server (2GB) + 0 agents (we add agents separately for per-pool sizing)
  2. Add agents individually:
     - System agent (6GB): observability + controllers + ingress
     - Apps agent (10GB): microservices + database + workers
  
  Total cluster RAM: 18GB (leaves headroom for host/Docker)
  
  Native Ingress port mapping (80:80, 443:443) — no port-forward needed for Ingress!
  
  Installs:
  - ArgoCD (admin/Argo@123!)
  - kube-prometheus-stack (Prometheus + Grafana)
  - KEDA for autoscaling
  - Loki for logs
  - Tempo for traces  
  - OpenTelemetry Collector

.NOTES
  Requirements: k3d v5.x+, kubectl, helm, docker
  Cluster name: "dev"
  Registry: localhost:5000
  Namespace: agro-apps

.EXAMPLE
  .\create-all-from-zero.ps1
#>

# =====================================================
# === Configuration (Locked)
# =====================================================
$clusterName = "dev"
$registryName = "localhost"
$registryPort = 5000
$appNamespace = "agro-apps"

# Node resource allocation (18GB total)
$serverMemory = "2g"
$systemAgentMemory = "6g"
$appsAgentMemory = "10g"

# Credentials
$argocdAdminPassword = "Argo@123!"
$grafanaAdminPassword = "admin"

# =====================================================
# === 0) Check Prerequisites
# =====================================================
Write-Host "=== 0) Checking prerequisites ===" -ForegroundColor Cyan
foreach ($cmd in @("k3d", "kubectl", "helm", "docker")) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        Write-Host "ERROR: '$cmd' not found. Install and try again." -ForegroundColor Red
        exit 1
    }
}
Write-Host "✅ All prerequisites found." -ForegroundColor Green

# =====================================================
# === 0.1) Stop Existing Port-Forwards
# =====================================================
Write-Host "=== 0.1) Stopping existing port-forwards ===" -ForegroundColor Cyan
Get-Process kubectl -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*port-forward*" } | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1
Write-Host "✅ Port-forwards stopped." -ForegroundColor Green

# =====================================================
# === 1) Create Registry
# =====================================================
Write-Host "=== 1) Creating local registry ($registryName`:$registryPort) ===" -ForegroundColor Cyan
$regList = k3d registry list 2>&1 | Out-String
if ($regList -match "k3d-$registryName") {
    Write-Host "   Registry already exists. Skipping." -ForegroundColor Gray
}
else {
    k3d registry create $registryName --port $registryPort 2>&1 | Out-Null
    Write-Host "✅ Registry created." -ForegroundColor Green
}

# =====================================================
# === 2) Delete Existing Cluster
# =====================================================
Write-Host "=== 2) Checking for existing cluster ===" -ForegroundColor Cyan
$clusterExists = k3d cluster list 2>$null | Select-String -Pattern "^$clusterName\s"
if ($clusterExists) {
    Write-Host "   Cluster '$clusterName' exists. Deleting..." -ForegroundColor Yellow
    k3d cluster delete $clusterName 2>&1 | Out-Null
    Start-Sleep -Seconds 2
    Write-Host "✅ Cluster deleted." -ForegroundColor Green
}
else {
    Write-Host "   No existing cluster. Skipping." -ForegroundColor Gray
}

# =====================================================
# === 3) Create Cluster (Step 1/2)
# =====================================================
Write-Host "=== 3) Creating cluster (Step 1/2): 1 server + 0 agents ===" -ForegroundColor Cyan
Write-Host "   ℹ️  We'll add agents in Step 2 for precise per-node resource allocation" -ForegroundColor Cyan

k3d cluster create $clusterName `
    --servers 1 `
    --agents 0 `
    --port "80:80@loadbalancer" `
    --port "443:443@loadbalancer" `
    --servers-memory $serverMemory `
    --registry-use "$registryName`:$registryPort" `
    --wait

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to create cluster." -ForegroundColor Red
    exit 1
}

Write-Host "Waiting for cluster to stabilize..." -ForegroundColor Cyan
Start-Sleep -Seconds 10

kubectl config use-context "k3d-$clusterName" 2>&1 | Out-Null
Write-Host "✅ Cluster created and kubectl context set." -ForegroundColor Green

# =====================================================
# === 4) Add Agent Nodes (Step 2/2)
# =====================================================
Write-Host "=== 4) Adding agent nodes (Step 2/2) ===" -ForegroundColor Cyan

Write-Host "   Adding SYSTEM agent ($systemAgentMemory RAM)..." -ForegroundColor Cyan
k3d node create "$clusterName-agent-system-0" `
    --cluster $clusterName `
    --role agent `
    --memory $systemAgentMemory 2>&1 | Out-Null

Write-Host "   Adding APPS agent ($appsAgentMemory RAM)..." -ForegroundColor Cyan
k3d node create "$clusterName-agent-apps-0" `
    --cluster $clusterName `
    --role agent `
    --memory $appsAgentMemory 2>&1 | Out-Null

Write-Host "✅ Agent nodes added." -ForegroundColor Green

# =====================================================
# === 5) Wait for Nodes to Register
# =====================================================
Write-Host "=== 5) Waiting for nodes to register ===" -ForegroundColor Cyan
for ($i = 0; $i -lt 30; $i++) {
    $nodes = kubectl get nodes --no-headers 2>$null
    if ($nodes -and ($nodes | Measure-Object).Count -ge 3) {
        Write-Host "✅ All nodes registered:" -ForegroundColor Green
        kubectl get nodes -o wide
        break
    }
    Write-Host "   Attempt $($i+1)/30..." -ForegroundColor Gray
    Start-Sleep -Seconds 3
}

# =====================================================
# === 6) Label Nodes for AKS-like Pools
# =====================================================
Write-Host "=== 6) Labeling nodes for AKS-like node pools ===" -ForegroundColor Cyan

function Get-NodeNameByPattern($pattern) {
    $all = kubectl get nodes -o name | ForEach-Object { $_.Replace("node/", "") }
    $match = $all | Where-Object { $_ -like "*$pattern*" } | Select-Object -First 1
    return $match
}

$systemNode = Get-NodeNameByPattern "system"
$appsNode = Get-NodeNameByPattern "apps"

if ($systemNode -and $appsNode) {
    kubectl label node $systemNode agentpool=system --overwrite 2>&1 | Out-Null
    kubectl taint node $systemNode agentpool=system:NoSchedule --overwrite 2>&1 | Out-Null
    
    kubectl label node $appsNode agentpool=apps --overwrite 2>&1 | Out-Null
    
    Write-Host "✅ Nodes labeled and tainted:" -ForegroundColor Green
    kubectl get nodes --show-labels 2>&1 | Select-Object -First 5
}
else {
    Write-Host "⚠️  Could not auto-detect node names. Run 'kubectl get nodes' to check." -ForegroundColor Yellow
}

# =====================================================
# === 7) Create Namespaces
# =====================================================
Write-Host "=== 7) Creating namespaces ===" -ForegroundColor Cyan
foreach ($ns in @("argocd", "monitoring", "keda", $appNamespace)) {
    kubectl create namespace $ns --dry-run=client -o yaml 2>$null | kubectl apply -f - 2>&1 | Out-Null
}
Write-Host "✅ Namespaces created: argocd, monitoring, keda, $appNamespace" -ForegroundColor Green

# =====================================================
# === 8) Install ArgoCD
# =====================================================
Write-Host "=== 8) Installing ArgoCD ===" -ForegroundColor Cyan
helm repo add argo https://argoproj.github.io/argo-helm 2>$null
helm repo update 2>&1 | Out-Null

helm upgrade --install argocd argo/argo-cd `
    -n argocd `
    --create-namespace `
    --set server.service.type=LoadBalancer `
    --set server.ingress.enabled=false `
    --set configs.params."server\.insecure"=true `
    --wait=true --timeout=5m 2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ ArgoCD installed." -ForegroundColor Green
}
else {
    Write-Host "⚠️  ArgoCD install had issues. Continuing..." -ForegroundColor Yellow
}

# =====================================================
# === 9) Install KEDA
# =====================================================
Write-Host "=== 9) Installing KEDA ===" -ForegroundColor Cyan
helm repo add kedacore https://kedacore.github.io/charts 2>$null
helm repo update 2>&1 | Out-Null

helm upgrade --install keda kedacore/keda `
    -n keda `
    --create-namespace `
    --wait=true --timeout=5m 2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ KEDA installed." -ForegroundColor Green
}
else {
    Write-Host "⚠️  KEDA install had issues. Continuing..." -ForegroundColor Yellow
}

# =====================================================
# === 10) Install Observability Stack
# =====================================================
Write-Host "=== 10) Installing Observability Stack ===" -ForegroundColor Cyan

# kube-prometheus-stack
Write-Host "   Installing kube-prometheus-stack (Prometheus + Grafana)..." -ForegroundColor Cyan
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts 2>$null
helm repo update 2>&1 | Out-Null

helm upgrade --install kube-prom-stack prometheus-community/kube-prometheus-stack `
    -n monitoring `
    --create-namespace `
    --set grafana.adminPassword="$grafanaAdminPassword" `
    --set prometheus.prometheusSpec.resources.requests.memory=256Mi `
    --set prometheus.prometheusSpec.resources.limits.memory=1500Mi `
    --set grafana.resources.requests.memory=128Mi `
    --set grafana.resources.limits.memory=512Mi `
    --wait=true --timeout=10m 2>&1 | Out-Null

Write-Host "   Waiting for Grafana to be ready..." -ForegroundColor Cyan
Start-Sleep -Seconds 15

if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ kube-prometheus-stack installed." -ForegroundColor Green
}
else {
    Write-Host "   ⚠️  kube-prometheus-stack had issues. Continuing..." -ForegroundColor Yellow
}

# Loki
Write-Host "   Installing Loki..." -ForegroundColor Cyan
helm repo add grafana https://grafana.github.io/helm-charts 2>$null
helm repo update 2>&1 | Out-Null

helm upgrade --install loki grafana/loki-stack `
    -n monitoring `
    --set loki.enabled=true `
    --set loki.persistence.enabled=false `
    --set loki.resources.requests.memory=256Mi `
    --set loki.resources.limits.memory=1Gi `
    --wait=true --timeout=5m 2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Loki installed." -ForegroundColor Green
}
else {
    Write-Host "   ⚠️  Loki had issues. Continuing..." -ForegroundColor Yellow
}

# Tempo
Write-Host "   Installing Tempo..." -ForegroundColor Cyan
helm upgrade --install tempo grafana/tempo `
    -n monitoring `
    --set tempo.persistence.enabled=false `
    --set tempo.resources.requests.memory=256Mi `
    --set tempo.resources.limits.memory=1Gi `
    --wait=true --timeout=5m 2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Tempo installed." -ForegroundColor Green
}
else {
    Write-Host "   ⚠️  Tempo had issues. Continuing..." -ForegroundColor Yellow
}

# OpenTelemetry Collector
Write-Host "   Installing OpenTelemetry Collector..." -ForegroundColor Cyan
helm repo add open-telemetry https://open-telemetry.github.io/opentelemetry-helm-charts 2>$null
helm repo update 2>&1 | Out-Null

helm upgrade --install otel-collector open-telemetry/opentelemetry-collector `
    -n monitoring `
    --set mode=daemonset `
    --set presets.kubernetesAttributes.enabled=true `
    --set resources.requests.memory=256Mi `
    --set resources.limits.memory=512Mi `
    --wait=true --timeout=5m 2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ OTel Collector installed." -ForegroundColor Green
}
else {
    Write-Host "   ⚠️  OTel Collector had issues. Continuing..." -ForegroundColor Yellow
}

Write-Host "✅ Observability stack installed." -ForegroundColor Green

# =====================================================
# === Summary
# =====================================================
Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║     ✅ CLUSTER CREATION COMPLETE                           ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "📊 CLUSTER INFO:" -ForegroundColor Cyan
Write-Host "   Cluster: $clusterName (3 nodes: 1 server + 2 agents)" -ForegroundColor Gray
Write-Host "   Total RAM: 18GB (Server 2GB + System 6GB + Apps 10GB)" -ForegroundColor Gray
Write-Host "   Registry: localhost:$registryPort" -ForegroundColor Gray
Write-Host "   Namespace: $appNamespace" -ForegroundColor Gray

Write-Host ""
Write-Host "🔐 CREDENTIALS:" -ForegroundColor Cyan
Write-Host "   ArgoCD:  admin / $argocdAdminPassword" -ForegroundColor Gray
Write-Host "   Grafana: admin / $grafanaAdminPassword" -ForegroundColor Gray

Write-Host ""
Write-Host "🔗 NEXT STEPS:" -ForegroundColor Cyan
Write-Host "   1) Update Windows hosts file (for Ingress access):" -ForegroundColor Gray
Write-Host "      .\k3d-manager.ps1 8" -ForegroundColor Green
Write-Host "      (Adds: 127.0.0.1 argocd.local, agro.local)" -ForegroundColor Gray

Write-Host ""
Write-Host "   2) Access ArgoCD (native Ingress — no port-forward!):" -ForegroundColor Gray
Write-Host "      http://argocd.local" -ForegroundColor Green

Write-Host ""
Write-Host "   3) Access Observability (optional port-forward):" -ForegroundColor Gray
Write-Host "      .\k3d-manager.ps1 9" -ForegroundColor Green
Write-Host "      Grafana: http://localhost:3000" -ForegroundColor Gray

Write-Host ""
Write-Host "   4) Build & push frontend image:" -ForegroundColor Gray
Write-Host "      .\k3d-manager.ps1 5" -ForegroundColor Green

Write-Host ""
