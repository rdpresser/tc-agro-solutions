<#
.SYNOPSIS
  Bootstrap k3d cluster with GitOps (ArgoCD manages everything after cluster creation).

.DESCRIPTION
  Minimal bootstrap script that ONLY:
  1. Creates k3d cluster (1 server + 3 agents with AKS-like node pools)
  2. Installs ArgoCD via Helm
  3. Applies ArgoCD bootstrap Application (App-of-apps)
  4. Applies platform Project
  
  After this, ArgoCD installs automatically:
  - kube-prometheus-stack (Prometheus + Grafana)
  - Loki
  - Tempo
  - OpenTelemetry Collector
  - KEDA
  - Ingress NGINX
  
  Total cluster RAM: 20GB (Server 2GB + System 4GB + Platform 6GB + Apps 8GB)
  Note: Agents created individually to allow different memory per node pool

.NOTES
  Requirements: k3d v5.x+, kubectl, helm, docker
  Cluster name: "dev"
  Registry: localhost:5000

.EXAMPLE
  .\bootstrap.ps1
#>

# =====================================================
# === Configuration
# =====================================================
$clusterName = "dev"
$registryName = "localhost"
$registryPort = 5000

# Node resource allocation (20GB total)
# Creating agents individually allows different memory per node pool
$serverMemory = "2g"
$systemAgentMemory = "4g"    # agent-0: kube-system, CoreDNS, CNI, CSI
$platformAgentMemory = "6g"  # agent-1: ArgoCD, Ingress, cert-manager
$appsAgentMemory = "8g"       # agent-2: .NET microservices

# ArgoCD config
$argocdNamespace = "argocd"
$argocdAdminPassword = "Argo@123!"

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

function New-LocalRegistry {
    Write-Step "Creating local registry ($registryName`:$registryPort)"
    $regList = k3d registry list 2>&1 | Out-String
    if ($regList -match "k3d-$registryName") {
        Write-Host "   Registry already exists. Skipping." -ForegroundColor $Color.Muted
    }
    else {
        k3d registry create $registryName --port $registryPort 2>&1 | Out-Null
        Write-Host "✅ Registry created" -ForegroundColor $Color.Success
    }
}

function Remove-ExistingCluster {
    Write-Step "Checking for existing cluster"
    $clusterExists = k3d cluster list 2>$null | Select-String -Pattern "^$clusterName\s"
    if ($clusterExists) {
        Write-Host "   Cluster '$clusterName' exists. Deleting..." -ForegroundColor $Color.Warning
        k3d cluster delete $clusterName 2>&1 | Out-Null
        Start-Sleep -Seconds 2
        Write-Host "✅ Cluster deleted" -ForegroundColor $Color.Success
    }
    else {
        Write-Host "   No existing cluster" -ForegroundColor $Color.Muted
    }
}

function New-K3dCluster {
    Write-Step "Creating k3d cluster (1 server, agents added separately)"
    Write-Host "   💾 Target memory allocation per node pool:" -ForegroundColor $Color.Info
    Write-Host "      Server: $serverMemory (control plane)" -ForegroundColor $Color.Muted
    Write-Host "      System: $systemAgentMemory (agent-0)" -ForegroundColor $Color.Muted
    Write-Host "      Platform: $platformAgentMemory (agent-1)" -ForegroundColor $Color.Muted
    Write-Host "      Apps: $appsAgentMemory (agent-2)" -ForegroundColor $Color.Muted
    Write-Host "      Total: 20GB (2+4+6+8)" -ForegroundColor $Color.Success
    Write-Host ""
    
    # Step 1: Create cluster WITHOUT agents (we'll add them individually)
    Write-Host "   Step 1/2: Creating server node..." -ForegroundColor $Color.Info
    k3d cluster create $clusterName `
        --servers 1 `
        --agents 0 `
        --port "80:80@loadbalancer" `
        --port "443:443@loadbalancer" `
        --servers-memory $serverMemory `
        --registry-use "$registryName`:$registryPort" 2>&1 | Out-Null
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to create cluster" -ForegroundColor $Color.Error
        exit 1
    }
    
    Write-Host "   ✅ Server node created" -ForegroundColor $Color.Success
    Write-Host ""
    
    # Step 2: Add agents individually with specific memory
    Write-Host "   Step 2/2: Adding agent nodes with specific memory..." -ForegroundColor $Color.Info
    
    # Agent 0 - System pool (4GB)
    Write-Host "      Creating agent-0 (system pool, 4GB)..." -ForegroundColor $Color.Muted
    k3d node create "$clusterName-agent-system" `
        --cluster $clusterName `
        --role agent `
        --memory $systemAgentMemory 2>&1 | Out-Null
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "      ⚠️  Warning: Failed to create system agent" -ForegroundColor $Color.Warning
    }
    else {
        Write-Host "      ✅ System agent created (4GB)" -ForegroundColor $Color.Success
    }
    
    # Agent 1 - Platform pool (6GB)
    Write-Host "      Creating agent-1 (platform pool, 6GB)..." -ForegroundColor $Color.Muted
    k3d node create "$clusterName-agent-platform" `
        --cluster $clusterName `
        --role agent `
        --memory $platformAgentMemory 2>&1 | Out-Null
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "      ⚠️  Warning: Failed to create platform agent" -ForegroundColor $Color.Warning
    }
    else {
        Write-Host "      ✅ Platform agent created (6GB)" -ForegroundColor $Color.Success
    }
    
    # Agent 2 - Apps pool (8GB)
    Write-Host "      Creating agent-2 (apps pool, 8GB)..." -ForegroundColor $Color.Muted
    k3d node create "$clusterName-agent-apps" `
        --cluster $clusterName `
        --role agent `
        --memory $appsAgentMemory 2>&1 | Out-Null
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "      ⚠️  Warning: Failed to create apps agent" -ForegroundColor $Color.Warning
    }
    else {
        Write-Host "      ✅ Apps agent created (8GB)" -ForegroundColor $Color.Success
    }
    
    Write-Host ""
    Write-Host "   Waiting for cluster stabilization..." -ForegroundColor $Color.Muted
    Start-Sleep -Seconds 20
    
    # Set kubectl context
    kubectl config use-context "k3d-$clusterName" 2>&1 | Out-Null
    Write-Host "✅ Cluster created with 3 node pools (4GB + 6GB + 8GB)" -ForegroundColor $Color.Success
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
        Write-Host "⚠️  Could not adjust kubeconfig (non-critical)" -ForegroundColor $Color.Warning
    }
}

function Validate-KubernetesAPI {
    Write-Step "Validating Kubernetes API connectivity"
    
    for ($i = 0; $i -lt 30; $i++) {
        try {
            $result = kubectl cluster-info 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✅ Kubernetes API accessible" -ForegroundColor $Color.Success
                return $true
            }
        }
        catch {}
        
        Write-Host "   Attempt $($i+1)/30: API not ready yet..." -ForegroundColor $Color.Muted
        Start-Sleep -Seconds 5
    }
    
    Write-Host "❌ ERROR: Kubernetes API did not respond after 2.5 minutes" -ForegroundColor $Color.Error
    Write-Host "   Troubleshooting steps:" -ForegroundColor $Color.Warning
    Write-Host "   1. Restart Docker Desktop" -ForegroundColor $Color.Warning
    Write-Host "   2. Run: k3d cluster delete $clusterName" -ForegroundColor $Color.Warning
    Write-Host "   3. Run this script again" -ForegroundColor $Color.Warning
    return $false
}

function Wait-ForNodes {
    Write-Step "Waiting for nodes to register"
    for ($i = 0; $i -lt 30; $i++) {
        $nodes = kubectl get nodes --no-headers 2>$null
        if ($nodes -and ($nodes | Measure-Object).Count -ge 4) {
            Write-Host "✅ All 4 nodes registered:" -ForegroundColor $Color.Success
            kubectl get nodes -o wide 2>$null | ForEach-Object { Write-Host "   $_" -ForegroundColor $Color.Muted }
            return
        }
        Write-Host "   Attempt $($i+1)/30: Waiting for 4 nodes (1 server + 3 agents)..." -ForegroundColor $Color.Muted
        Start-Sleep -Seconds 3
    }
    
    Write-Host "⚠️  WARNING: Nodes did not register within 90 seconds" -ForegroundColor $Color.Warning
    Write-Host "   This may indicate Docker network issues. Attempting to continue..." -ForegroundColor $Color.Warning
}

function Verify-NodePools {
    Write-Step "Verifying node pool configuration"
    
    Write-Host "   Checking Docker container memory limits..." -ForegroundColor $Color.Info
    Write-Host ""
    
    # Get actual memory from Docker containers
    $containers = docker ps --filter "name=k3d-$clusterName" --format "{{.Names}}"
    foreach ($container in $containers) {
        $memLimit = docker inspect $container --format "{{.HostConfig.Memory}}" 2>$null
        if ($memLimit) {
            $memGB = [math]::Round($memLimit / 1GB, 1)
            $label = "unknown"
            if ($container -match "server") { $label = "Server (control)" }
            elseif ($container -match "system") { $label = "System pool" }
            elseif ($container -match "platform") { $label = "Platform pool" }
            elseif ($container -match "apps") { $label = "Apps pool" }
            
            Write-Host "      $container → ${memGB}GB ($label)" -ForegroundColor $Color.Success
        }
    }
    
    Write-Host ""
    Write-Host "   💡 Node pool strategy achieved:" -ForegroundColor $Color.Info
    Write-Host "      System (4GB): kube-system components (critical)" -ForegroundColor $Color.Muted
    Write-Host "      Platform (6GB): ArgoCD + Ingress (infrastructure)" -ForegroundColor $Color.Muted
    Write-Host "      Apps (8GB): .NET microservices (business logic)" -ForegroundColor $Color.Muted
    Write-Host ""
    Write-Host "✅ Node pool configuration verified" -ForegroundColor $Color.Success
}

function Set-NodeLabelsAndTaints {
    Write-Step "Labeling nodes for AKS-like pools (3 node pools)"
    
    # Retry logic: sometimes nodes take a moment to fully register
    $retries = 0
    $maxRetries = 5
    $allNodes = @()
    
    while ($allNodes.Count -lt 3 -and $retries -lt $maxRetries) {
        $allNodes = kubectl get nodes -o name 2>$null | ForEach-Object { $_.Replace("node/", "") }
        
        if ($allNodes.Count -lt 3) {
            $retries++
            Write-Host "   ⏳ Waiting for all nodes to register ($($allNodes.Count)/4 ready, retry $retries/$maxRetries)..." -ForegroundColor $Color.Muted
            Start-Sleep -Seconds 2
        }
    }
    
    if ($allNodes.Count -eq 0) {
        Write-Host "❌ No nodes found after waiting" -ForegroundColor $Color.Error
        return
    }
    
    Write-Host "   📍 Found nodes: $($allNodes -join ', ')" -ForegroundColor $Color.Muted
    
    # Label agents with agentpool (simulating AKS node pools)
    # Agents created with custom names: k3d-dev-agent-system, k3d-dev-agent-platform, k3d-dev-agent-apps
    $agentSystem = $allNodes | Where-Object { $_ -like "*agent-system*" } | Select-Object -First 1
    $agentPlatform = $allNodes | Where-Object { $_ -like "*agent-platform*" } | Select-Object -First 1
    $agentApps = $allNodes | Where-Object { $_ -like "*agent-apps*" } | Select-Object -First 1
    
    Write-Host "   🔍 Matching patterns:" -ForegroundColor $Color.Muted
    Write-Host "      System (*agent-system*): $($agentSystem ?? 'NOT FOUND')" -ForegroundColor $Color.Muted
    Write-Host "      Platform (*agent-platform*): $($agentPlatform ?? 'NOT FOUND')" -ForegroundColor $Color.Muted
    Write-Host "      Apps (*agent-apps*): $($agentApps ?? 'NOT FOUND')" -ForegroundColor $Color.Muted
    
    $labeledCount = 0
    
    if ($agentSystem) {
        kubectl label node $agentSystem agentpool=system workload=system --overwrite 2>&1 | Out-Null
        kubectl taint node $agentSystem agentpool=system:NoSchedule --overwrite 2>&1 | Out-Null
        Write-Host "   ✓ $agentSystem → system pool (4GB, NoSchedule taint)" -ForegroundColor $Color.Success
        $labeledCount++
    }
    
    if ($agentPlatform) {
        kubectl label node $agentPlatform agentpool=platform workload=platform --overwrite 2>&1 | Out-Null
        Write-Host "   ✓ $agentPlatform → platform pool (6GB)" -ForegroundColor $Color.Success
        $labeledCount++
    }
    
    if ($agentApps) {
        kubectl label node $agentApps agentpool=apps workload=application --overwrite 2>&1 | Out-Null
        Write-Host "   ✓ $agentApps → apps pool (8GB)" -ForegroundColor $Color.Success
        $labeledCount++
    }
    
    if ($labeledCount -eq 3) {
        Write-Host "✅ All 3 node pools labeled successfully" -ForegroundColor $Color.Success
        Write-Host "   Viewing node allocation:" -ForegroundColor $Color.Muted
        kubectl get nodes -L agentpool,workload 2>&1 | ForEach-Object { 
            Write-Host "   $_" -ForegroundColor $Color.Muted 
        }
    }
    elseif ($labeledCount -gt 0) {
        Write-Host "⚠️  Only $labeledCount/3 node pools labeled" -ForegroundColor $Color.Warning
        Write-Host "   Nodes found: $($allNodes -join ', ')" -ForegroundColor $Color.Muted
        Write-Host "   This may resolve automatically in a few moments" -ForegroundColor $Color.Info
    }
    else {
        Write-Host "❌ Could not find agent nodes matching patterns" -ForegroundColor $Color.Error
        Write-Host "   Nodes available: $($allNodes -join ', ')" -ForegroundColor $Color.Muted
        Write-Host "   Expected patterns: *agent-system*, *agent-platform*, *agent-apps*" -ForegroundColor $Color.Muted
    }
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
        --wait --timeout=5m 2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ ArgoCD installed" -ForegroundColor $Color.Success
    }
    else {
        Write-Host "⚠️  ArgoCD install had issues" -ForegroundColor $Color.Warning
    }
    
    # Wait for ArgoCD server to be ready
    Write-Host "   Waiting for ArgoCD server..." -ForegroundColor $Color.Info
    kubectl wait --for=condition=available --timeout=300s `
        deployment/argocd-server -n $argocdNamespace 2>&1 | Out-Null
}

function Set-ArgocdPassword {
    Write-Step "Configuring ArgoCD admin password"
    
    # Get initial password from secret
    Write-Host "   Retrieving initial password..." -ForegroundColor $Color.Info
    $initialPassword = kubectl -n $argocdNamespace get secret argocd-initial-admin-secret `
        -o jsonpath="{.data.password}" 2>$null | 
    ForEach-Object { [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($_)) }
    
    if (-not $initialPassword) {
        Write-Host "⚠️  Could not retrieve initial password" -ForegroundColor $Color.Warning
        return
    }
    
    Write-Host "   Initial password: $initialPassword" -ForegroundColor $Color.Muted
    
    # Start temporary port-forward
    Write-Host "   Starting port-forward..." -ForegroundColor $Color.Info
    $pfProcess = Start-Process -FilePath kubectl `
        -ArgumentList "port-forward svc/argocd-server -n $argocdNamespace 8090:443 --address 127.0.0.1" `
        -WindowStyle Hidden -PassThru
    
    Start-Sleep -Seconds 8
    
    # Change password via REST API
    try {
        # Login to get token
        $loginBody = @{ 
            username = "admin"
            password = $initialPassword 
        } | ConvertTo-Json
        
        $loginResponse = Invoke-RestMethod `
            -Uri "http://localhost:8090/api/v1/session" `
            -Method Post `
            -Body $loginBody `
            -ContentType "application/json" `
            -ErrorAction Stop
        
        $token = $loginResponse.token
        
        # Update password
        $updateBody = @{ 
            currentPassword = $initialPassword
            newPassword     = $argocdAdminPassword 
        } | ConvertTo-Json
        
        $headers = @{ 
            "Authorization" = "Bearer $token"
            "Content-Type"  = "application/json" 
        }
        
        Invoke-RestMethod `
            -Uri "http://localhost:8090/api/v1/account/password" `
            -Method Put `
            -Headers $headers `
            -Body $updateBody `
            -ErrorAction Stop | Out-Null
        
        Write-Host "✅ Password changed to: $argocdAdminPassword" -ForegroundColor $Color.Success
    }
    catch {
        Write-Host "⚠️  Failed to change password: $_" -ForegroundColor $Color.Warning
        Write-Host "   Manual change: http://localhost:8080" -ForegroundColor $Color.Info
    }
    finally {
        # Stop port-forward
        Stop-Process -Id $pfProcess.Id -Force -ErrorAction SilentlyContinue
    }
}

function Apply-GitOpsBootstrap {
    Write-Step "Applying GitOps bootstrap (App-of-apps)"
    
    # Calculate repo root correctly:
    # PSScriptRoot = c:\Projects\tc-agro-solutions\scripts\k3d
    # Parent 1 = c:\Projects\tc-agro-solutions\scripts
    # Parent 2 = c:\Projects\tc-agro-solutions (repo root) ✅
    $repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
    $platformPath = Join-Path $repoRoot "infrastructure\kubernetes\platform"
    
    # Apply platform project first
    $projectFile = Join-Path $platformPath "argocd\projects\project-platform.yaml"
    if (Test-Path $projectFile) {
        kubectl apply -f $projectFile 2>&1 | Out-Null
        Write-Host "✅ Platform project created" -ForegroundColor $Color.Success
    }
    
    # Apply apps project
    $appsProjectFile = Join-Path $platformPath "argocd\projects\project-apps.yaml"
    if (Test-Path $appsProjectFile) {
        kubectl apply -f $appsProjectFile 2>&1 | Out-Null
        Write-Host "✅ Apps project created" -ForegroundColor $Color.Success
    }
    
    # Apply platform base manifests (namespaces, ingress)
    $baseKustomization = Join-Path $platformPath "base"
    if (Test-Path $baseKustomization) {
        kubectl apply -k $baseKustomization 2>&1 | Out-Null
        Write-Host "✅ Base manifests applied (namespaces, ingress)" -ForegroundColor $Color.Success
    }
    
    # Apply bootstrap Applications (App-of-apps)
    # 1. Platform bootstrap (infrastructure)
    $bootstrapPlatformFile = Join-Path $platformPath "argocd\bootstrap\bootstrap-platform.yaml"
    if (Test-Path $bootstrapPlatformFile) {
        kubectl apply -f $bootstrapPlatformFile 2>&1 | Out-Null
        Write-Host "✅ Platform bootstrap Applied (infrastructure components)" -ForegroundColor $Color.Success
        Write-Host "   ℹ️  ArgoCD will now install: Prometheus, Grafana, Loki, Tempo, OTel, KEDA, Ingress NGINX" -ForegroundColor $Color.Info
    }
    else {
        Write-Host "⚠️  Bootstrap file not found: $bootstrapPlatformFile" -ForegroundColor $Color.Warning
    }
    
    # 2. Apps bootstrap (applications)
    $bootstrapAppsFile = Join-Path $platformPath "argocd\bootstrap\bootstrap-apps.yaml"
    if (Test-Path $bootstrapAppsFile) {
        kubectl apply -f $bootstrapAppsFile 2>&1 | Out-Null
        Write-Host "✅ Apps bootstrap Applied (application components)" -ForegroundColor $Color.Success
        Write-Host "   ℹ️  ArgoCD will now install: Frontend and future microservices" -ForegroundColor $Color.Info
    }
    else {
        Write-Host "⚠️  Apps bootstrap file not found: $bootstrapAppsFile" -ForegroundColor $Color.Warning
    }
}

# =====================================================
# === Main Execution
# =====================================================

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor $Color.Success
Write-Host "║     GITOPS BOOTSTRAP - K3D CLUSTER + ARGOCD              ║" -ForegroundColor $Color.Success
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor $Color.Success

Test-Prerequisites
Stop-PortForwards
New-LocalRegistry
Remove-ExistingCluster
New-K3dCluster
Fix-KubeconfigForDocker
Validate-KubernetesAPI
Wait-ForNodes
Verify-NodePools

# Give nodes a moment to fully register before labeling
Write-Host ""
Write-Host "⏳ Allowing nodes to fully stabilize before labeling..." -ForegroundColor $Color.Info
Start-Sleep -Seconds 3

Set-NodeLabelsAndTaints
Install-ArgoCD
Set-ArgocdPassword
Apply-GitOpsBootstrap

# =====================================================
# === Summary
# =====================================================
Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor $Color.Success
Write-Host "║     ✅ GITOPS BOOTSTRAP COMPLETE                          ║" -ForegroundColor $Color.Success
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor $Color.Success
Write-Host ""
Write-Host "📊 CLUSTER INFO" -ForegroundColor $Color.Info
Write-Host "   Cluster: $clusterName (4 nodes - 1 server + 3 agents)" -ForegroundColor $Color.Muted
Write-Host "   Total RAM: 20GB allocated (2+4+6+8)" -ForegroundColor $Color.Muted
Write-Host "      Server: 2GB (control plane)" -ForegroundColor $Color.Success
Write-Host "      System: 4GB (kube-system, CoreDNS, CNI)" -ForegroundColor $Color.Success
Write-Host "      Platform: 6GB (ArgoCD, Ingress, cert-manager)" -ForegroundColor $Color.Success
Write-Host "      Apps: 8GB (.NET microservices)" -ForegroundColor $Color.Success
Write-Host "   Registry: localhost:$registryPort" -ForegroundColor $Color.Muted

Write-Host ""
Write-Host "🔐 ARGOCD" -ForegroundColor $Color.Info
Write-Host "   Username: admin" -ForegroundColor $Color.Muted
Write-Host "   Password: $argocdAdminPassword" -ForegroundColor $Color.Muted
Write-Host "   URL: http://argocd.local (after updating hosts file)" -ForegroundColor $Color.Muted

Write-Host ""
Write-Host "🔗 NEXT STEPS" -ForegroundColor $Color.Info
Write-Host "   1) Watch ArgoCD sync platform stack" -ForegroundColor $Color.Muted
Write-Host "      kubectl get applications -n argocd --watch" -ForegroundColor $Color.Success

Write-Host ""
Write-Host "   2) Update Windows hosts file for Ingress access" -ForegroundColor $Color.Muted
Write-Host "      .\update-hosts-file.ps1" -ForegroundColor $Color.Success

Write-Host ""
Write-Host "   3) Access ArgoCD via Ingress (no port-forward needed)" -ForegroundColor $Color.Muted
Write-Host "      http://argocd.local" -ForegroundColor $Color.Success

Write-Host ""
Write-Host "   4) Optional: Port-forward Grafana" -ForegroundColor $Color.Muted
Write-Host "      .\port-forward.ps1 grafana" -ForegroundColor $Color.Success

Write-Host ""
