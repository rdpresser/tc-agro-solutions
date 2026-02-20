<#
.SYNOPSIS
  Diagnose ArgoCD access issues and suggest fixes.

.DESCRIPTION
    Checks all components needed for ArgoCD to be accessible via http://localhost:8090/argocd/

.EXAMPLE
  .\diagnose-argocd.ps1
#>

$Color = @{
    Success = "Green"
    Error   = "Red"
    Warning = "Yellow"
    Info    = "Cyan"
    Muted   = "Gray"
}

function Write-Section {
    param([string]$Title)
    Write-Host ""
    Write-Host "╔══════════════════════════════════════════════════════════╗" -ForegroundColor $Color.Info
    Write-Host "║ $($Title.PadRight(56)) ║" -ForegroundColor $Color.Info
    Write-Host "╚══════════════════════════════════════════════════════════╝" -ForegroundColor $Color.Info
}

function Check-Status {
    param([string]$Description, [scriptblock]$Check)
    
    Write-Host ""
    Write-Host "🔍 $Description" -ForegroundColor $Color.Info
    
    try {
        $result = & $Check
        if ($result) {
            Write-Host "   ✅ OK" -ForegroundColor $Color.Success
            return $true
        }
        else {
            Write-Host "   ❌ FAILED" -ForegroundColor $Color.Error
            return $false
        }
    }
    catch {
        Write-Host "   ❌ ERROR: $($_.Exception.Message)" -ForegroundColor $Color.Error
        return $false
    }
}

# =====================================================
# === DIAGNOSTICS
# =====================================================

Write-Section "ARGOCD ACCESS DIAGNOSTIC"

$allOk = $true

# 1. Check cluster is running
Write-Section "1️⃣  CLUSTER STATUS"

$clusterOk = Check-Status "Cluster context is set" {
    $ctx = kubectl config current-context 2>$null
    Write-Host "   Context: $ctx" -ForegroundColor $Color.Muted
    $ctx -like "*dev*"
}
$allOk = $allOk -and $clusterOk

$nodesOk = Check-Status "All nodes are Ready" {
    $nodes = kubectl get nodes --no-headers 2>$null
    if ($nodes) {
        $notReady = $nodes | Where-Object { $_ -notmatch "\sReady\s" }
        if (-not $notReady) {
            Write-Host "   $($nodes.Count) nodes Ready" -ForegroundColor $Color.Muted
            return $true
        }
    }
    return $false
}
$allOk = $allOk -and $nodesOk

# 2. Check Traefik
Write-Section "2️⃣  TRAEFIK (INGRESS CONTROLLER)"

$traefikOk = Check-Status "Traefik pods are Running" {
    $traefik = kubectl get pods -n kube-system -l app=traefik 2>$null
    if ($traefik -match "Running") {
        Write-Host "   Traefik is Running in kube-system" -ForegroundColor $Color.Muted
        return $true
    }
    return $false
}
$allOk = $allOk -and $traefikOk

$portOk = Check-Status "Port-forward 8090 is listening (localhost)" {
    $connections = Get-NetTCPConnection -LocalPort 8090 -State Listen -ErrorAction SilentlyContinue
    if ($connections) {
        Write-Host "   Port 8090 is listening (ArgoCD port-forward)" -ForegroundColor $Color.Muted
        return $true
    }
    return $false
}
$allOk = $allOk -and $portOk

# 3. Check ArgoCD
Write-Section "3️⃣  ARGOCD DEPLOYMENT"

$argocdNsOk = Check-Status "ArgoCD namespace exists" {
    $ns = kubectl get namespace argocd 2>$null
    if ($ns) {
        Write-Host "   Namespace 'argocd' exists" -ForegroundColor $Color.Muted
        return $true
    }
    return $false
}
$allOk = $allOk -and $argocdNsOk

$argocdPodsOk = Check-Status "ArgoCD pods are Running" {
    $pods = kubectl get pods -n argocd 2>$null
    if ($pods) {
        $running = $pods | Where-Object { $_ -match "Running" } | Measure-Object | Select-Object -ExpandProperty Count
        $total = $pods.Count
        Write-Host "   Running: $running/$total pods" -ForegroundColor $Color.Muted
        if ($running -eq $total) {
            return $true
        }
        else {
            Write-Host "      Waiting for all pods..." -ForegroundColor $Color.Warning
            return $false
        }
    }
    return $false
}
$allOk = $allOk -and $argocdPodsOk

# 4. Check Ingress
Write-Section "4️⃣  INGRESS CONFIGURATION"

$ingressOk = Check-Status "IngressRoute argocd exists" {
    $ingress = kubectl get ingressroute argocd -n argocd 2>$null
    if ($ingress) {
        Write-Host "   IngressRoute 'argocd' in namespace 'argocd'" -ForegroundColor $Color.Muted
        return $true
    }
    Write-Host "   ⚠️  IngressRoute not found - may need to sync ArgoCD" -ForegroundColor $Color.Warning
    return $false
}
$allOk = $allOk -and $ingressOk

$middlewareOk = Check-Status "Middleware strip-argocd-prefix exists" {
    $middleware = kubectl get middleware strip-argocd-prefix -n argocd 2>$null
    if ($middleware) {
        Write-Host "   Middleware configured to strip /argocd prefix" -ForegroundColor $Color.Muted
        return $true
    }
    Write-Host "   ⚠️  Middleware not found - may need to sync ArgoCD" -ForegroundColor $Color.Warning
    return $false
}
$allOk = $allOk -and $middlewareOk

# 5. Check connectivity
Write-Section "5️⃣  CONNECTIVITY TEST"

Write-Host ""
Write-Host "🌐 Testing HTTP access to localhost:8090/argocd/" -ForegroundColor $Color.Info

try {
    $response = Invoke-WebRequest -Uri "http://localhost:8090/argocd/" -TimeoutSec 3 -ErrorAction Stop
    Write-Host "   ✅ localhost:8090/argocd/ is responding" -ForegroundColor $Color.Success
    Write-Host "   Status: $($response.StatusCode)" -ForegroundColor $Color.Muted
}
catch {
    Write-Host "   ❌ localhost:8090/argocd/ is NOT responding" -ForegroundColor $Color.Error
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor $Color.Muted
    Write-Host "   Tip: run .\port-forward.ps1 argocd and retry" -ForegroundColor $Color.Muted
    $allOk = $false
}

# =====================================================
# === RECOMMENDATIONS
# =====================================================

Write-Section "📋 RECOMMENDATIONS"

if ($allOk) {
    Write-Host ""
    Write-Host "✅ All checks passed!" -ForegroundColor $Color.Success
    Write-Host ""
    Write-Host "   Access ArgoCD at:" -ForegroundColor $Color.Info
    Write-Host "   http://localhost:8090/argocd/" -ForegroundColor $Color.Success
    Write-Host ""
    Write-Host "   Default credentials:" -ForegroundColor $Color.Muted
    Write-Host "   - Username: admin" -ForegroundColor $Color.Muted
    Write-Host "   - Password: Argo@123!" -ForegroundColor $Color.Muted
    Write-Host ""
}
else {
    Write-Host ""
    Write-Host "⚠️  Some checks failed. Here's what to do:" -ForegroundColor $Color.Warning
    Write-Host ""
    
    if (-not $nodesOk) {
        Write-Host "1️⃣  Nodes not Ready:" -ForegroundColor $Color.Error
        Write-Host "   Run: kubectl get nodes" -ForegroundColor $Color.Muted
        Write-Host "   Wait 2-3 minutes and try again" -ForegroundColor $Color.Muted
        Write-Host ""
    }
    
    if (-not $traefikOk) {
        Write-Host "2️⃣  Traefik not running:" -ForegroundColor $Color.Error
        Write-Host "   Traefik is built into k3s but may not be started" -ForegroundColor $Color.Muted
        Write-Host "   This should be automatic - contact support" -ForegroundColor $Color.Muted
        Write-Host ""
    }
    
    if (-not $portOk) {
        Write-Host "3️⃣  Port-forward not available:" -ForegroundColor $Color.Error
        Write-Host "   Run: .\port-forward.ps1 argocd" -ForegroundColor $Color.Muted
        Write-Host "   Verify: netstat -ano | findstr :8090" -ForegroundColor $Color.Muted
        Write-Host ""
    }
    
    if (-not $argocdNsOk) {
        Write-Host "4️⃣  ArgoCD namespace doesn't exist:" -ForegroundColor $Color.Error
        Write-Host "   This should be created by bootstrap.ps1" -ForegroundColor $Color.Muted
        Write-Host "   Run: .\bootstrap.ps1" -ForegroundColor $Color.Muted
        Write-Host ""
    }
    
    if (-not $argocdPodsOk) {
        Write-Host "5️⃣  ArgoCD pods not ready:" -ForegroundColor $Color.Error
        Write-Host "   Run: kubectl get pods -n argocd" -ForegroundColor $Color.Muted
        Write-Host "   Wait for all pods to be Running (2-5 minutes)" -ForegroundColor $Color.Muted
        Write-Host "   Run: kubectl logs -n argocd -f <pod-name>" -ForegroundColor $Color.Muted
        Write-Host ""
    }
    
    if (-not $ingressOk) {
        Write-Host "6️⃣  IngressRoute not found:" -ForegroundColor $Color.Error
        Write-Host "   The ingress manifests need to be applied/synced" -ForegroundColor $Color.Muted
        Write-Host "   Run: .\sync-argocd.ps1 platform" -ForegroundColor $Color.Muted
        Write-Host "   Or via manager: .\manager.ps1 → Option 7" -ForegroundColor $Color.Muted
        Write-Host ""
    }
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor $Color.Info
Write-Host ""
