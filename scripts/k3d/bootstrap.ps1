<#
.SYNOPSIS
  Bootstrap k3d cluster with GitOps (ArgoCD manages everything after cluster creation).

.DESCRIPTION
  Minimal bootstrap script that ONLY:
  1. Creates k3d cluster (1 server + 2 agents with AKS-like node pools)
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
  
  Total cluster RAM: 18GB (Server 2GB + System 6GB + Apps 10GB)

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

# Node resource allocation (18GB total)
$serverMemory = "2g"
$systemAgentMemory = "6g"
$appsAgentMemory = "10g"

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
    Write-Step "Creating k3d cluster (Step 1/2): 1 server + 0 agents"
    Write-Host "   ℹ️  Agents added separately for per-node resource allocation" -ForegroundColor $Color.Info
    
    k3d cluster create $clusterName `
        --servers 1 `
        --agents 0 `
        --port "80:80@loadbalancer" `
        --port "443:443@loadbalancer" `
        --servers-memory $serverMemory `
        --registry-use "$registryName`:$registryPort" `
        --wait 2>&1 | Out-Null
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to create cluster" -ForegroundColor $Color.Error
        exit 1
    }
    
    Start-Sleep -Seconds 10
    kubectl config use-context "k3d-$clusterName" 2>&1 | Out-Null
    Write-Host "✅ Cluster created" -ForegroundColor $Color.Success
}

function Add-AgentNodes {
    Write-Step "Adding agent nodes (Step 2/2)"
    
    Write-Host "   Adding SYSTEM agent ($systemAgentMemory RAM)..." -ForegroundColor $Color.Info
    k3d node create "$clusterName-agent-system-0" `
        --cluster $clusterName `
        --role agent `
        --memory $systemAgentMemory 2>&1 | Out-Null
    
    Write-Host "   Adding APPS agent ($appsAgentMemory RAM)..." -ForegroundColor $Color.Info
    k3d node create "$clusterName-agent-apps-0" `
        --cluster $clusterName `
        --role agent `
        --memory $appsAgentMemory 2>&1 | Out-Null
    
    Write-Host "✅ Agent nodes added" -ForegroundColor $Color.Success
}

function Wait-ForNodes {
    Write-Step "Waiting for nodes to register"
    for ($i = 0; $i -lt 30; $i++) {
        $nodes = kubectl get nodes --no-headers 2>$null
        if ($nodes -and ($nodes | Measure-Object).Count -ge 3) {
            Write-Host "✅ All nodes registered:" -ForegroundColor $Color.Success
            kubectl get nodes -o wide
            return
        }
        Write-Host "   Attempt $($i+1)/30..." -ForegroundColor $Color.Muted
        Start-Sleep -Seconds 3
    }
    
    Write-Host "⚠️  Timeout waiting for nodes" -ForegroundColor $Color.Warning
}

function Set-NodeLabelsAndTaints {
    Write-Step "Labeling nodes for AKS-like pools"
    
    # Find nodes by pattern
    $allNodes = kubectl get nodes -o name | ForEach-Object { $_.Replace("node/", "") }
    $systemNode = $allNodes | Where-Object { $_ -like "*system*" } | Select-Object -First 1
    $appsNode = $allNodes | Where-Object { $_ -like "*apps*" } | Select-Object -First 1
    
    if ($systemNode -and $appsNode) {
        kubectl label node $systemNode agentpool=system --overwrite 2>&1 | Out-Null
        kubectl taint node $systemNode agentpool=system:NoSchedule --overwrite 2>&1 | Out-Null
        
        kubectl label node $appsNode agentpool=apps --overwrite 2>&1 | Out-Null
        
        Write-Host "✅ Nodes labeled and tainted" -ForegroundColor $Color.Success
        kubectl get nodes --show-labels 2>&1 | Select-Object -First 5
    }
    else {
        Write-Host "⚠️  Could not auto-detect nodes" -ForegroundColor $Color.Warning
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

function Apply-GitOpsBootstrap {
    Write-Step "Applying GitOps bootstrap (App-of-apps)"
    
    $repoRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
    $platformPath = Join-Path $repoRoot "infrastructure\kubernetes\platform"
    
    # Apply platform project first
    $projectFile = Join-Path $platformPath "argocd\projects\project-platform.yaml"
    if (Test-Path $projectFile) {
        kubectl apply -f $projectFile 2>&1 | Out-Null
        Write-Host "✅ Platform project created" -ForegroundColor $Color.Success
    }
    
    # Apply platform base manifests (namespaces, ingress)
    $baseKustomization = Join-Path $platformPath "base"
    if (Test-Path $baseKustomization) {
        kubectl apply -k $baseKustomization 2>&1 | Out-Null
        Write-Host "✅ Base manifests applied (namespaces, ingress)" -ForegroundColor $Color.Success
    }
    
    # Apply bootstrap Application (App-of-apps)
    $bootstrapFile = Join-Path $platformPath "argocd\bootstrap\application-bootstrap.yaml"
    if (Test-Path $bootstrapFile) {
        kubectl apply -f $bootstrapFile 2>&1 | Out-Null
        Write-Host "✅ Bootstrap Application applied" -ForegroundColor $Color.Success
        Write-Host "   ℹ️  ArgoCD will now install: Prometheus, Grafana, Loki, Tempo, OTel, KEDA, Ingress NGINX" -ForegroundColor $Color.Info
    }
    else {
        Write-Host "⚠️  Bootstrap file not found: $bootstrapFile" -ForegroundColor $Color.Warning
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
Add-AgentNodes
Wait-ForNodes
Set-NodeLabelsAndTaints
Install-ArgoCD
Apply-GitOpsBootstrap

# =====================================================
# === Summary
# =====================================================
Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor $Color.Success
Write-Host "║     ✅ GITOPS BOOTSTRAP COMPLETE                          ║" -ForegroundColor $Color.Success
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor $Color.Success
Write-Host ""
Write-Host "📊 CLUSTER INFO:" -ForegroundColor $Color.Info
Write-Host "   Cluster: $clusterName (3 nodes: 1 server + 2 agents)" -ForegroundColor $Color.Muted
Write-Host "   Total RAM: 18GB (Server 2GB + System 6GB + Apps 10GB)" -ForegroundColor $Color.Muted
Write-Host "   Registry: localhost:$registryPort" -ForegroundColor $Color.Muted

Write-Host ""
Write-Host "🔐 ARGOCD:" -ForegroundColor $Color.Info
Write-Host "   Username: admin" -ForegroundColor $Color.Muted
Write-Host "   Password: $argocdAdminPassword" -ForegroundColor $Color.Muted
Write-Host "   URL: http://argocd.local (after updating hosts file)" -ForegroundColor $Color.Muted

Write-Host ""
Write-Host "🔗 NEXT STEPS:" -ForegroundColor $Color.Info
Write-Host "   1) Watch ArgoCD sync platform stack:" -ForegroundColor $Color.Muted
Write-Host "      kubectl get applications -n argocd --watch" -ForegroundColor $Color.Success

Write-Host ""
Write-Host "   2) Update Windows hosts file (for Ingress access):" -ForegroundColor $Color.Muted
Write-Host "      .\update-hosts-file.ps1" -ForegroundColor $Color.Success

Write-Host ""
Write-Host "   3) Access ArgoCD (via Ingress - no port-forward!):" -ForegroundColor $Color.Muted
Write-Host "      http://argocd.local" -ForegroundColor $Color.Success

Write-Host ""
Write-Host "   4) (Optional) Port-forward Grafana:" -ForegroundColor $Color.Muted
Write-Host "      .\port-forward.ps1 grafana" -ForegroundColor $Color.Success

Write-Host ""
