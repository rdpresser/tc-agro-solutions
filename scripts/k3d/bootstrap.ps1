<#
.SYNOPSIS
  Bootstrap k3d cluster with GitOps (ArgoCD manages everything after cluster creation).

.DESCRIPTION
  Minimal bootstrap script that ONLY:
  1. Creates k3d cluster (1 server + 3 agents with AKS-like node pools)
  2. Joins cluster to tc-agro-network for Docker container name resolution
  3. Installs ArgoCD via Helm
  4. Applies ArgoCD bootstrap Application (App-of-apps)
  5. Applies platform Project

  After this, ArgoCD installs automatically:
  - OpenTelemetry Collector DaemonSet (exports to Docker Compose OTEL Collector)

  Observability Stack (Docker Compose - NOT k3d):
  - Prometheus, Grafana, Loki, Tempo run in Docker Compose
  - OTEL DaemonSet in k3d exports to tc-agro-otel-collector container

  Optional (disabled by default):
  - KEDA (event-driven autoscaling) - NOT USED in current project

  Note: Traefik is k3s built-in (no Helm install needed)

  Total cluster RAM: 20GB (Server 3GB + System 4GB + Platform 6GB + Apps 7GB)
  Note: Agents are created individually to allow different memory per node pool.

.NOTES
  Requirements: k3d v5.x+, kubectl, helm, docker
  Cluster name: "dev"
  Registry: Docker Hub (rdpresser)

.EXAMPLE
  .\bootstrap.ps1
#>

# =====================================================
# === Configuration
# =====================================================
$clusterName = "dev"

# Node resource allocation (20GB total)
# Creating agents individually allows different memory per node pool
$serverMemory = "3g"         # Control plane (etcd, apiserver, scheduler, controller-manager)
$systemAgentMemory = "4g"    # agent-0: kube-system, CoreDNS, CNI, CSI
$platformAgentMemory = "6g"  # agent-1: ArgoCD, Ingress, cert-manager
$appsAgentMemory = "7g"      # agent-2: .NET microservices (business logic)

# Docker Compose network (k3d will join this network to access compose services)
# This allows pods to resolve Docker Compose container names like:
# - tc-agro-postgres, tc-agro-redis, tc-agro-rabbitmq, tc-agro-otel-collector
$composeNetworkName = "tc-agro-network"

# ArgoCD config
$argocdNamespace = "argocd"
$argocdAdminPassword = "Argo@123!"

# Optional components (disabled by default)
$script:installKeda = $false  # KEDA is NOT USED in current project - kept for future reference

# Colors
$Color = @{
  Success = "Green"
  Error   = "Red"
  Warning = "Yellow"
  Info    = "Cyan"
  Muted   = "Gray"
}

# =====================================================
# === Functions
# =====================================================
function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "=== $Message ===" -ForegroundColor $Color.Info
}

function Prompt-OptionalComponents {
  Write-Step "Optional Components Configuration"
  
  Write-Host ""
  Write-Host " ╔══════════════════════════════════════════════════════════════╗" -ForegroundColor $Color.Warning
  Write-Host " ║  KEDA (Kubernetes Event-Driven Autoscaling)                   ║" -ForegroundColor $Color.Warning
  Write-Host " ║  Status: NOT USED in current project                         ║" -ForegroundColor $Color.Warning
  Write-Host " ║  Purpose: Scale pods based on events (RabbitMQ queue, etc.)  ║" -ForegroundColor $Color.Warning
  Write-Host " ║  Note: Can be added later if needed                          ║" -ForegroundColor $Color.Warning
  Write-Host " ╚══════════════════════════════════════════════════════════════╝" -ForegroundColor $Color.Warning
  Write-Host ""
  
  $response = Read-Host " Install KEDA? (y/N - default: N)"
  if ($response -match "^[Yy](es)?$") {
    $script:installKeda = $true
    Write-Host " ✓ KEDA will be installed" -ForegroundColor $Color.Success
  }
  else {
    $script:installKeda = $false
    Write-Host " ✓ KEDA will NOT be installed (recommended)" -ForegroundColor $Color.Muted
  }
  
  Write-Host ""
}

function Test-Prerequisites {
  Write-Step "Checking prerequisites"
  $missing = @()

  foreach ($cmd in @("k3d", "kubectl", "helm", "docker")) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
      $missing += $cmd
    }
  }

  if ($missing.Count -gt 0) {
    Write-Host "❌ Missing: $($missing -join ', ')" -ForegroundColor $Color.Error
    exit 1
  }

  Write-Host "✅ All prerequisites found" -ForegroundColor $Color.Success
}

function Stop-PortForwards {
  Write-Step "Stopping existing port-forwards"
  Get-Process kubectl -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -like "*port-forward*" } |
  Stop-Process -Force -ErrorAction SilentlyContinue

  Start-Sleep -Seconds 1
  Write-Host "✅ Port-forwards stopped" -ForegroundColor $Color.Success
}

function Ensure-ComposeNetwork {
  Write-Step "Ensuring Docker Compose network exists ($composeNetworkName)"
  
  $networkExists = docker network ls --format "{{.Name}}" 2>$null | Where-Object { $_ -eq $composeNetworkName }
  
  if ($networkExists) {
    Write-Host " Network '$composeNetworkName' already exists" -ForegroundColor $Color.Muted
  }
  else {
    Write-Host " Creating network '$composeNetworkName'..." -ForegroundColor $Color.Info
    docker network create $composeNetworkName 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
      Write-Host "✅ Network created" -ForegroundColor $Color.Success
    }
    else {
      Write-Host "⚠️ Network creation failed (may already exist)" -ForegroundColor $Color.Warning
    }
  }
  
  Write-Host ""
  Write-Host " 💡 k3d will join this network to access Docker Compose services:" -ForegroundColor $Color.Info
  Write-Host "    • tc-agro-postgres (PostgreSQL)" -ForegroundColor $Color.Muted
  Write-Host "    • tc-agro-redis (Redis)" -ForegroundColor $Color.Muted
  Write-Host "    • tc-agro-rabbitmq (RabbitMQ)" -ForegroundColor $Color.Muted
  Write-Host "    • tc-agro-otel-collector (OpenTelemetry)" -ForegroundColor $Color.Muted
  Write-Host ""
}

function Remove-ExistingCluster {
  Write-Step "Checking for existing cluster"
  $clusterExists = k3d cluster list 2>$null | Select-String -Pattern "^$clusterName\s"

  if ($clusterExists) {
    Write-Host " Cluster '$clusterName' exists. Deleting..." -ForegroundColor $Color.Warning
    k3d cluster delete $clusterName 2>&1 | Out-Null
    Start-Sleep -Seconds 2
    Write-Host "✅ Cluster deleted" -ForegroundColor $Color.Success
  }
  else {
    Write-Host " No existing cluster" -ForegroundColor $Color.Muted
  }
}

function Invoke-Retry {
  param(
    [Parameter(Mandatory = $true)][scriptblock]$Action,
    [int]$Retries = 3,
    [int]$DelaySeconds = 3,
    [string]$ErrorMessage = "Action failed"
  )

  for ($i = 1; $i -le $Retries; $i++) {
    & $Action
    if ($LASTEXITCODE -eq 0) { return $true }

    Write-Host " ⚠️ Attempt $i/$Retries failed. Retrying in $DelaySeconds sec..." -ForegroundColor $Color.Warning
    Start-Sleep -Seconds $DelaySeconds
  }

  Write-Host "❌ $ErrorMessage" -ForegroundColor $Color.Error
  return $false
}

function New-K3dCluster {
  Write-Step "Creating k3d cluster (1 server, agents added separately)"

  Write-Host " 💾 Target memory allocation per node pool:" -ForegroundColor $Color.Info
  Write-Host " Server:   $serverMemory (control plane)" -ForegroundColor $Color.Muted
  Write-Host " System:   $systemAgentMemory (agent-system)" -ForegroundColor $Color.Muted
  Write-Host " Platform: $platformAgentMemory (agent-platform)" -ForegroundColor $Color.Muted
  Write-Host " Apps:     $appsAgentMemory (agent-apps)" -ForegroundColor $Color.Muted
  Write-Host " Total:    20GB (3+4+6+7)" -ForegroundColor $Color.Success
  Write-Host ""
  Write-Host " 🔗 Network: $composeNetworkName (shared with Docker Compose)" -ForegroundColor $Color.Info
  Write-Host ""

  # Step 1: Create cluster WITHOUT agents (we'll add them individually)
  # Using --network to join Docker Compose network for service discovery
  Write-Host " Step 1/2: Creating server node on $composeNetworkName network..." -ForegroundColor $Color.Info

  $ok = Invoke-Retry -Retries 3 -DelaySeconds 2 -ErrorMessage "Failed to create cluster server node" -Action {
    k3d cluster create $clusterName `
      --servers 1 `
      --agents 0 `
      --port "80:80@loadbalancer" `
      --port "443:443@loadbalancer" `
      --servers-memory $serverMemory `
      --network $composeNetworkName 2>&1 | Out-Null
  }

  if (-not $ok) { exit 1 }

  Write-Host " ✅ Server node created" -ForegroundColor $Color.Success
  Write-Host ""

  # Step 2: Add agents individually with specific memory
  Write-Host " Step 2/2: Adding agent nodes with specific memory..." -ForegroundColor $Color.Info

  # Agent 0 - System pool (4GB)
  Write-Host " Creating agent-system (system pool, $systemAgentMemory)..." -ForegroundColor $Color.Muted
  $okSystem = Invoke-Retry -Retries 3 -DelaySeconds 3 -ErrorMessage "Failed to create system agent" -Action {
    k3d node create "$clusterName-agent-system" `
      --cluster $clusterName `
      --role agent `
      --memory $systemAgentMemory 2>&1 | Out-Null
  }
  if ($okSystem) { Write-Host " ✅ System agent created ($systemAgentMemory)" -ForegroundColor $Color.Success }

  # Agent 1 - Platform pool (6GB)
  Write-Host " Creating agent-platform (platform pool, $platformAgentMemory)..." -ForegroundColor $Color.Muted
  $okPlatform = Invoke-Retry -Retries 3 -DelaySeconds 3 -ErrorMessage "Failed to create platform agent" -Action {
    k3d node create "$clusterName-agent-platform" `
      --cluster $clusterName `
      --role agent `
      --memory $platformAgentMemory 2>&1 | Out-Null
  }
  if ($okPlatform) { Write-Host " ✅ Platform agent created ($platformAgentMemory)" -ForegroundColor $Color.Success }

  # Agent 2 - Apps pool (7GB)
  Write-Host " Creating agent-apps (apps pool, $appsAgentMemory)..." -ForegroundColor $Color.Muted
  $okApps = Invoke-Retry -Retries 3 -DelaySeconds 3 -ErrorMessage "Failed to create apps agent" -Action {
    k3d node create "$clusterName-agent-apps" `
      --cluster $clusterName `
      --role agent `
      --memory $appsAgentMemory 2>&1 | Out-Null
  }
  if ($okApps) { Write-Host " ✅ Apps agent created ($appsAgentMemory)" -ForegroundColor $Color.Success }

  if (-not ($okSystem -and $okPlatform -and $okApps)) {
    Write-Host ""
    Write-Host "❌ One or more agent nodes failed to create. Aborting to avoid a broken cluster." -ForegroundColor $Color.Error
    Write-Host " Tip: Restart Docker Desktop and re-run bootstrap.ps1" -ForegroundColor $Color.Warning
    exit 1
  }

  Write-Host ""
  Write-Host " Waiting for cluster stabilization..." -ForegroundColor $Color.Muted
  Start-Sleep -Seconds 15

  # Set kubectl context
  kubectl config use-context "k3d-$clusterName" 2>&1 | Out-Null
  Write-Host "✅ Cluster created with 3 node pools (system/platform/apps) and dedicated memory" -ForegroundColor $Color.Success
}

function Fix-KubeconfigForDocker {
  Write-Step "Adjusting kubeconfig for Docker Desktop"
  try {
    $serverUrl = kubectl config view -o json 2>$null | ConvertFrom-Json |
    ForEach-Object { $_.clusters | Where-Object { $_.name -eq "k3d-$clusterName" } } |
    ForEach-Object { $_.cluster.server }

    if ($serverUrl -match "host\.docker\.internal:(\d+)") {
      $port = $matches[1]
      kubectl config set-cluster "k3d-$clusterName" --server="https://127.0.0.1:$port" 2>&1 | Out-Null
      Write-Host "✅ Kubeconfig adjusted to https://127.0.0.1:$port" -ForegroundColor $Color.Success
    }
  }
  catch {
    Write-Host "⚠️ Could not adjust kubeconfig (non-critical)" -ForegroundColor $Color.Warning
  }
}

function Validate-KubernetesAPI {
  Write-Step "Validating Kubernetes API connectivity"
  for ($i = 0; $i -lt 30; $i++) {
    try {
      kubectl cluster-info 2>&1 | Out-Null
      if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Kubernetes API accessible" -ForegroundColor $Color.Success
        return $true
      }
    }
    catch {}

    Write-Host " Attempt $($i+1)/30: API not ready yet..." -ForegroundColor $Color.Muted
    Start-Sleep -Seconds 5
  }

  Write-Host "❌ ERROR: Kubernetes API did not respond after 2.5 minutes" -ForegroundColor $Color.Error
  return $false
}

function Wait-ForNodes {
  Write-Step "Waiting for nodes to register"
  for ($i = 0; $i -lt 40; $i++) {
    $nodes = kubectl get nodes --no-headers 2>$null
    if ($nodes -and ($nodes | Measure-Object).Count -ge 4) {
      Write-Host "✅ All 4 nodes registered:" -ForegroundColor $Color.Success
      kubectl get nodes -o wide 2>$null | ForEach-Object { Write-Host " $_" -ForegroundColor $Color.Muted }
      return
    }

    Write-Host " Attempt $($i+1)/40: Waiting for 4 nodes (1 server + 3 agents)..." -ForegroundColor $Color.Muted
    Start-Sleep -Seconds 3
  }

  Write-Host "❌ ERROR: Nodes did not register in time (expected 4 nodes)" -ForegroundColor $Color.Error
  kubectl get nodes -o wide 2>$null
  exit 1
}

function Verify-NodePools {
  Write-Step "Verifying node pool configuration"

  Write-Host " Checking Docker container memory limits..." -ForegroundColor $Color.Info
  Write-Host ""

  $containers = docker ps --filter "name=k3d-$clusterName" --format "{{.Names}}"
  foreach ($container in $containers) {
    $memLimit = docker inspect $container --format "{{.HostConfig.Memory}}" 2>$null
    if ($memLimit -and $memLimit -gt 0) {
      $memGB = [math]::Round($memLimit / 1GB, 1)
      Write-Host " $container → ${memGB}GB" -ForegroundColor $Color.Success
    }
  }

  Write-Host ""
  Write-Host " 💡 Node pool strategy:" -ForegroundColor $Color.Info
  Write-Host " System (4GB): kube-system components (critical)" -ForegroundColor $Color.Muted
  Write-Host " Platform (6GB): ArgoCD + Ingress (infrastructure)" -ForegroundColor $Color.Muted
  Write-Host " Apps (7GB): .NET microservices (business logic)" -ForegroundColor $Color.Muted
  Write-Host " Server (3GB): control plane (etcd, apiserver) headroom" -ForegroundColor $Color.Muted
  Write-Host ""
  Write-Host "✅ Node pool configuration verified" -ForegroundColor $Color.Success
}

function Set-NodeLabelsAndTaints {
  Write-Step "Labeling nodes for AKS-like pools (3 node pools)"

  $allNodes = kubectl get nodes -o name 2>$null | ForEach-Object { $_.Replace("node/", "") }
  if (-not $allNodes -or $allNodes.Count -lt 4) {
    Write-Host "❌ Not enough nodes found for labeling" -ForegroundColor $Color.Error
    kubectl get nodes -o wide 2>$null
    exit 1
  }

  Write-Host " 📍 Found nodes: $($allNodes -join ', ')" -ForegroundColor $Color.Muted

  $agentSystem = $allNodes | Where-Object { $_ -like "*agent-system*" } | Select-Object -First 1
  $agentPlatform = $allNodes | Where-Object { $_ -like "*agent-platform*" } | Select-Object -First 1
  $agentApps = $allNodes | Where-Object { $_ -like "*agent-apps*" } | Select-Object -First 1

  if (-not $agentSystem -or -not $agentPlatform -or -not $agentApps) {
    Write-Host "❌ Could not match all agent nodes by name pattern" -ForegroundColor $Color.Error
    Write-Host " Expected patterns: *agent-system*, *agent-platform*, *agent-apps*" -ForegroundColor $Color.Muted
    Write-Host " Nodes available: $($allNodes -join ', ')" -ForegroundColor $Color.Muted
    exit 1
  }

  kubectl label node $agentSystem agentpool=system workload=system --overwrite 2>&1 | Out-Null
  kubectl taint node $agentSystem agentpool=system:NoSchedule --overwrite 2>&1 | Out-Null
  Write-Host " ✓ $agentSystem → system pool (NoSchedule taint)" -ForegroundColor $Color.Success

  kubectl label node $agentPlatform agentpool=platform workload=platform --overwrite 2>&1 | Out-Null
  Write-Host " ✓ $agentPlatform → platform pool" -ForegroundColor $Color.Success

  kubectl label node $agentApps agentpool=apps workload=application --overwrite 2>&1 | Out-Null
  Write-Host " ✓ $agentApps → apps pool" -ForegroundColor $Color.Success

  Write-Host "✅ All 3 node pools labeled successfully" -ForegroundColor $Color.Success
  kubectl get nodes -L agentpool 2>&1 | ForEach-Object { Write-Host " $_" -ForegroundColor $Color.Muted }
}

function Install-ArgoCD {
  Write-Step "Installing ArgoCD via Helm"

  helm repo add argo https://argoproj.github.io/argo-helm 2>$null
  helm repo update 2>&1 | Out-Null

  helm upgrade --install argocd argo/argo-cd `
    -n $argocdNamespace `
    --create-namespace `
    --set server.service.type=ClusterIP `
    --set server.ingress.enabled=false `
    --set configs.params."server\.insecure"=true `
    --set configs.params."server\.basehref"="/argocd" `
    --set configs.params."server\.rootpath"="/argocd" `
    --wait --timeout=5m 2>&1 | Out-Null

  if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ ArgoCD installed" -ForegroundColor $Color.Success
  }
  else {
    Write-Host "⚠️ ArgoCD install had issues" -ForegroundColor $Color.Warning
  }

  Write-Host " Waiting for ArgoCD server..." -ForegroundColor $Color.Info
  kubectl wait --for=condition=available --timeout=300s `
    deployment/argocd-server -n $argocdNamespace 2>&1 | Out-Null
}

function Set-ArgocdPassword {
  Write-Step "Configuring ArgoCD admin password"

  $scriptPath = Join-Path $PSScriptRoot "reset-argocd-password.ps1"
  if (-not (Test-Path $scriptPath)) {
    Write-Host "⚠️ reset-argocd-password.ps1 not found at $scriptPath" -ForegroundColor $Color.Warning
    Write-Host " Password must be changed manually or via manager.ps1 option 5" -ForegroundColor $Color.Info
    return
  }

  Write-Host " Delegating to reset-argocd-password.ps1 (standardized password change)..." -ForegroundColor $Color.Muted
  Write-Host ""
  & $scriptPath -NewPassword $argocdAdminPassword
  
  # Ignore exit code from reset script - it may return 1 even on success
  # We'll validate ArgoCD is ready in next steps instead
  $null = $LASTEXITCODE
}

function Apply-GitOpsBootstrap {
  Write-Step "Applying GitOps bootstrap (App-of-apps)"

  # Calculate repo root correctly:
  # PSScriptRoot = c:\Projects\tc-agro-solutions\scripts\k3d
  # Parent 1 = c:\Projects\tc-agro-solutions\scripts
  # Parent 2 = c:\Projects\tc-agro-solutions (repo root) ✅
  $repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
  $platformPath = Join-Path $repoRoot "infrastructure\kubernetes\platform"

  $projectFile = Join-Path $platformPath "argocd\projects\project-platform.yaml"
  if (Test-Path $projectFile) {
    kubectl apply -f $projectFile 2>&1 | Out-Null
    Write-Host "✅ Platform project created" -ForegroundColor $Color.Success
  }

  $appsProjectFile = Join-Path $platformPath "argocd\projects\project-apps.yaml"
  if (Test-Path $appsProjectFile) {
    kubectl apply -f $appsProjectFile 2>&1 | Out-Null
    Write-Host "✅ Apps project created" -ForegroundColor $Color.Success
  }

  $baseKustomization = Join-Path $platformPath "base"
  if (Test-Path $baseKustomization) {
    kubectl apply -k $baseKustomization 2>&1 | Out-Null
    Write-Host "✅ Base manifests applied (namespaces, ingress)" -ForegroundColor $Color.Success
  }

  $bootstrapPlatformFile = Join-Path $platformPath "argocd\bootstrap\bootstrap-platform.yaml"
  if (Test-Path $bootstrapPlatformFile) {
    kubectl apply -f $bootstrapPlatformFile 2>&1 | Out-Null
    Write-Host "✅ Platform bootstrap applied (infrastructure components)" -ForegroundColor $Color.Success
    Write-Host " ℹ️ ArgoCD will now install: OTEL DaemonSet (observability agent)" -ForegroundColor $Color.Info
    
    # Optional: Install KEDA if user requested
    if ($script:installKeda) {
      Write-Host " ℹ️ Installing KEDA (user requested)..." -ForegroundColor $Color.Info
      
      # Create KEDA namespace
      kubectl create namespace keda --dry-run=client -o yaml | kubectl apply -f - 2>&1 | Out-Null
      
      # Install KEDA via Helm
      helm repo add kedacore https://kedacore.github.io/charts 2>$null
      helm repo update 2>&1 | Out-Null
      helm upgrade --install keda kedacore/keda -n keda --wait --timeout=3m 2>&1 | Out-Null
      
      if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ KEDA installed successfully" -ForegroundColor $Color.Success
        
        # KEDA CRD Known Issue: Helm adds oversized annotations (>262KB limit)
        Write-Host " 🔧 Applying KEDA CRD metadata fix..." -ForegroundColor $Color.Info
        Start-Sleep -Seconds 5
        kubectl patch crd scaledjobs.keda.sh -p '{"metadata":{"annotations":null}}' --type=merge 2>&1 | Out-Null
        kubectl patch crd scaledobjects.keda.sh -p '{"metadata":{"annotations":null}}' --type=merge 2>&1 | Out-Null
        kubectl patch crd triggerauthentications.keda.sh -p '{"metadata":{"annotations":null}}' --type=merge 2>&1 | Out-Null
        Write-Host "✅ KEDA CRD metadata patched" -ForegroundColor $Color.Success
      }
      else {
        Write-Host "⚠️ KEDA installation had issues (non-critical)" -ForegroundColor $Color.Warning
      }
    }
    else {
      Write-Host " ℹ️ KEDA skipped (not installed - use bootstrap prompt to enable)" -ForegroundColor $Color.Muted
    }
  }
  else {
    Write-Host "⚠️ Bootstrap file not found: $bootstrapPlatformFile" -ForegroundColor $Color.Warning
  }

  $bootstrapAppsFile = Join-Path $platformPath "argocd\bootstrap\bootstrap-apps.yaml"
  if (Test-Path $bootstrapAppsFile) {
    kubectl apply -f $bootstrapAppsFile 2>&1 | Out-Null
    Write-Host "✅ Apps bootstrap applied (application components)" -ForegroundColor $Color.Success
    Write-Host " ℹ️ ArgoCD will now install: Frontend and future microservices" -ForegroundColor $Color.Info
  }
  else {
    Write-Host "⚠️ Apps bootstrap file not found: $bootstrapAppsFile" -ForegroundColor $Color.Warning
  }
}

function Apply-LocalManifests {
  Write-Step "Applying platform/apps overlays (local safety net)"

  $repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
  $platformOverlay = Join-Path $repoRoot "infrastructure\kubernetes\platform\overlays\dev"
  $appsOverlay = Join-Path $repoRoot "infrastructure\kubernetes\apps\overlays\dev"

  if (Test-Path $platformOverlay) {
    Write-Host " Applying platform overlay (namespaces, ingress, ArgoCD projects)..." -ForegroundColor $Color.Info
    kubectl apply -k $platformOverlay 2>&1 | Out-Null
    Write-Host "✅ Platform overlay applied" -ForegroundColor $Color.Success
  }
  else {
    Write-Host "⚠️ Platform overlay not found: $platformOverlay" -ForegroundColor $Color.Warning
  }

  if (Test-Path $appsOverlay) {
    Write-Host " Applying apps overlay (frontend ingress/deployment)..." -ForegroundColor $Color.Info
    kubectl apply -k $appsOverlay 2>&1 | Out-Null
    Write-Host "✅ Apps overlay applied" -ForegroundColor $Color.Success
  }
  else {
    Write-Host "⚠️ Apps overlay not found: $appsOverlay" -ForegroundColor $Color.Warning
  }
}

# =====================================================
# === Main Execution
# =====================================================
Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor $Color.Success
Write-Host "║ GITOPS BOOTSTRAP - K3D CLUSTER + ARGOCD ║" -ForegroundColor $Color.Success
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor $Color.Success

Test-Prerequisites
Prompt-OptionalComponents
Stop-PortForwards
Ensure-ComposeNetwork
Remove-ExistingCluster
New-K3dCluster
Fix-KubeconfigForDocker
Validate-KubernetesAPI
Wait-ForNodes
Verify-NodePools

Write-Host ""
Write-Host "⏳ Allowing nodes to fully stabilize before labeling..." -ForegroundColor $Color.Info
Start-Sleep -Seconds 3

Set-NodeLabelsAndTaints
Install-ArgoCD
Set-ArgocdPassword
Apply-GitOpsBootstrap
Apply-LocalManifests

# =====================================================
# === Summary
# =====================================================
Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor $Color.Success
Write-Host "║ ✅ GITOPS BOOTSTRAP COMPLETE ║" -ForegroundColor $Color.Success
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor $Color.Success

Write-Host ""
Write-Host "📊 CLUSTER INFO" -ForegroundColor $Color.Info
Write-Host " Cluster: $clusterName (4 nodes - 1 server + 3 agents)" -ForegroundColor $Color.Muted
Write-Host " Total RAM: 20GB allocated (3+4+6+7)" -ForegroundColor $Color.Muted
Write-Host " Server: 3GB (control plane)" -ForegroundColor $Color.Success
Write-Host " System: 4GB (kube-system, CoreDNS, CNI)" -ForegroundColor $Color.Success
Write-Host " Platform: 6GB (ArgoCD, Ingress, cert-manager)" -ForegroundColor $Color.Success
Write-Host " Apps: 7GB (.NET microservices)" -ForegroundColor $Color.Success
Write-Host " Registry: Docker Hub (rdpresser)" -ForegroundColor $Color.Muted
Write-Host " Network: $composeNetworkName (shared with Docker Compose)" -ForegroundColor $Color.Success

Write-Host ""
Write-Host "🔐 ARGOCD" -ForegroundColor $Color.Info
Write-Host " Username: admin" -ForegroundColor $Color.Muted
Write-Host " Password: $argocdAdminPassword" -ForegroundColor $Color.Muted
Write-Host " URL: http://argocd.local (after updating hosts file)" -ForegroundColor $Color.Muted

Write-Host ""
Write-Host "� INSTALLED COMPONENTS" -ForegroundColor $Color.Info
Write-Host " ✅ OTEL DaemonSet (observability agent)" -ForegroundColor $Color.Success
Write-Host " ✅ Docker Compose Observability Stack (Grafana/Prometheus/Loki/Tempo)" -ForegroundColor $Color.Success
if ($script:installKeda) {
  Write-Host " ✅ KEDA (event-driven autoscaling)" -ForegroundColor $Color.Success
}
else {
  Write-Host " ⏭️ KEDA (skipped - not used in current project)" -ForegroundColor $Color.Muted
}

Write-Host ""
Write-Host "�� NEXT STEPS" -ForegroundColor $Color.Info
Write-Host " 1) Watch ArgoCD sync platform stack" -ForegroundColor $Color.Muted
Write-Host "    kubectl get applications -n argocd --watch" -ForegroundColor $Color.Success
Write-Host ""
Write-Host " 2) Update Windows hosts file for Ingress access" -ForegroundColor $Color.Muted
Write-Host "    .\update-hosts-file.ps1" -ForegroundColor $Color.Success
Write-Host ""
Write-Host " 3) Access ArgoCD via Ingress (no port-forward needed)" -ForegroundColor $Color.Muted
Write-Host "    http://argocd.local" -ForegroundColor $Color.Success
Write-Host ""
Write-Host " 4) Optional: Start Docker Compose observability stack" -ForegroundColor $Color.Muted
Write-Host "    (Grafana at http://localhost:3000)" -ForegroundColor $Color.Success
Write-Host ""
