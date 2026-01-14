<#
.SYNOPSIS
  Creates local k3d cluster with AKS-like pools (system/apps) using a 2-step approach:
  - Step 1: Create cluster with 1 server and 0 agents
  - Step 2: Add 2 agents individually with different CPU/RAM sizing
  
.DESCRIPTION
  Why 2-step?
  k3d only supports a single --agents-memory/--agents-cpu value for ALL agents during `k3d cluster create`.
  To emulate AKS-like pools (system smaller, apps larger), we create the cluster first, then add nodes with per-node Docker limits.

  This script:
  - Creates a local Docker registry (localhost:5000)
  - Creates k3d cluster with native Ingress port mapping (80/443 -> loadbalancer)
  - Adds 2 agents with different resources:
      system: 5GB / 2 vCPU
      apps:   12GB / 6 vCPU
  - Labels and taints nodes to enforce scheduling separation:
      system node: label agentpool=system + taint agentpool=system:NoSchedule
      apps node:   label agentpool=apps

.NOTES
  Requirements: k3d, kubectl, helm, docker
  Ports 80/443 must be free (or change mappings below).

.EXAMPLE
  .\create-all-from-zero-2step.ps1
#>

# =========================
# === Configuration =======
# =========================
$clusterName = "dev"
$registryName = "localhost"
$registryPort = 5000

# Desired AKS-like shape
$serverCount = 1
$agentCount = 0  # IMPORTANT: create with 0 agents (we add them later)

# Resources (per node)
$serverMemory = "3g"
$serverCpu = "2"

$systemAgentMemory = "5g"
$systemAgentCpu = "2"

$appsAgentMemory = "12g"
$appsAgentCpu = "6"

# Optional: names for the agent nodes we add
$systemNodeName = "$clusterName-agent-system-0"
$appsNodeName   = "$clusterName-agent-apps-0"

# =========================
# === 0) Dependencies =====
# =========================
Write-Host "=== 0) Checking dependencies: kubectl, helm, k3d, docker ==="
foreach ($cmd in @("k3d","kubectl","helm","docker")) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        Write-Host "ERROR: command '$cmd' not found in PATH. Install before continuing." -ForegroundColor Red
        exit 1
    }
}

# =========================
# === 1) Registry =========
# =========================
Write-Host "=== 1) Checking local registry ($registryName`:$registryPort) ==="
$regList = k3d registry list
if ($regList -notmatch $registryName) {
    Write-Host "Creating registry $registryName`:$registryPort"
    k3d registry create $registryName --port $registryPort
} else {
    Write-Host "Registry $registryName already exists. Skipping."
}

# =========================
# === 2) Delete cluster ====
# =========================
Write-Host "=== 2) Deleting cluster $clusterName (if exists) ==="
k3d cluster list | Select-String -Pattern "^$clusterName\s" | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "Cluster $clusterName exists. Deleting..."
    k3d cluster delete $clusterName
} else {
    Write-Host "Cluster $clusterName does not exist. Skipping delete."
}

# =========================
# === 3) Create cluster ====
# =========================
Write-Host "=== 3) Creating cluster $clusterName (Step 1/2) - 1 server, 0 agents ==="
Write-Host "   ℹ️  Native port mapping enabled: 80/443 -> loadbalancer" -ForegroundColor Cyan
Write-Host "   ℹ️  We'll add 2 agents with per-node sizing in Step 2/2" -ForegroundColor Cyan
Write-Host ""

k3d cluster create $clusterName `
  --servers $serverCount `
  --agents $agentCount `
  --port "80:80@loadbalancer" `
  --port "443:443@loadbalancer" `
  --servers-memory $serverMemory `
  --servers-cpu $serverCpu `
  --registry-use "$registryName`:$registryPort"

if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to create cluster. Exiting." -ForegroundColor Red
    exit 1
}

Write-Host "Waiting for cluster to be ready..." -ForegroundColor Cyan
Start-Sleep -Seconds 10

kubectl config use-context "k3d-$clusterName" | Out-Null

# =========================
# === 4) Add agents =======
# =========================
Write-Host "=== 4) Adding agents (Step 2/2) with per-node CPU/RAM ==="

# Add SYSTEM agent (smaller)
Write-Host "Adding SYSTEM agent: $systemNodeName ($systemAgentMemory RAM / $systemAgentCpu vCPU)..." -ForegroundColor Cyan
k3d node create $systemNodeName `
  --cluster $clusterName `
  --role agent `
  --memory $systemAgentMemory `
  --cpu $systemAgentCpu

if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to add system agent node. Exiting." -ForegroundColor Red
    exit 1
}

# Add APPS agent (bigger)
Write-Host "Adding APPS agent: $appsNodeName ($appsAgentMemory RAM / $appsAgentCpu vCPU)..." -ForegroundColor Cyan
k3d node create $appsNodeName `
  --cluster $clusterName `
  --role agent `
  --memory $appsAgentMemory `
  --cpu $appsAgentCpu

if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to add apps agent node. Exiting." -ForegroundColor Red
    exit 1
}

# =========================
# === 5) Wait nodes =======
# =========================
Write-Host "Waiting for nodes to register in Kubernetes..." -ForegroundColor Cyan
for ($i=0; $i -lt 30; $i++) {
    $nodes = kubectl get nodes --no-headers 2>$null
    if ($nodes -and ($nodes | Measure-Object).Count -ge 3) {
        Write-Host "✅ Nodes registered:" -ForegroundColor Green
        kubectl get nodes -o wide
        break
    }
    Start-Sleep -Seconds 3
}

# =========================
# === 6) Label/Taint ======
# =========================
Write-Host "=== 6) Applying labels/taints to emulate AKS node pools ===" -ForegroundColor Cyan

# Identify k8s node names (they should match k3d node container names)
# Usually: k3d-<cluster>-server-0, k3d-<cluster>-agent-0, etc.
# But since we created custom names, they will appear as k3d-<name> or <name> depending on k3d version.
# We'll search by partial name to be robust.

function Get-NodeNameByContains($needle) {
    $all = kubectl get nodes -o name | ForEach-Object { $_.Replace("node/","") }
    $match = $all | Where-Object { $_ -like "*$needle*" } | Select-Object -First 1
    return $match
}

$systemK8sNode = Get-NodeNameByContains $systemNodeName
$appsK8sNode   = Get-NodeNameByContains $appsNodeName

if (-not $systemK8sNode -or -not $appsK8sNode) {
    Write-Host "⚠️  Could not auto-detect node names for labeling/tainting." -ForegroundColor Yellow
    Write-Host "    Run: kubectl get nodes -o wide" -ForegroundColor Yellow
    Write-Host "    Then label manually:" -ForegroundColor Yellow
    Write-Host "      kubectl label node <systemNode> agentpool=system" -ForegroundColor Yellow
    Write-Host "      kubectl taint node <systemNode> agentpool=system:NoSchedule" -ForegroundColor Yellow
    Write-Host "      kubectl label node <appsNode> agentpool=apps" -ForegroundColor Yellow
} else {
    # SYSTEM pool: label + taint
    kubectl label node $systemK8sNode agentpool=system --overwrite | Out-Null
    kubectl taint node $systemK8sNode agentpool=system:NoSchedule --overwrite | Out-Null

    # APPS pool: label only
    kubectl label node $appsK8sNode agentpool=apps --overwrite | Out-Null

    Write-Host "✅ Labeled/tainted nodes:" -ForegroundColor Green
    kubectl get nodes --show-labels
}

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║     ✅ k3d 2-step AKS-like cluster created successfully    ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "Next: install your core services (Ingress, ArgoCD, KEDA, monitoring) as you already do."
Write-Host "Tip: schedule infra on system pool using tolerations; schedule apps using nodeSelector/affinity."
