<#
.SYNOPSIS
  Menu-driven orchestrator for tc-agro-solutions k3d cluster (local Kubernetes + full APM).
  
.DESCRIPTION
  Interactive menu to:
  - Create cluster (1 server + 2 agents: system/apps) with full observability stack
  - Start/stop cluster
  - Build & push images to local registry
  - Manage secrets
  - Manage port-forwards
  - Update Windows hosts file
  - Bootstrap ArgoCD applications
  - Cleanup resources

  Requirements: PowerShell 7+, k3d, kubectl, helm, docker

.EXAMPLE
  .\k3d-manager.ps1

.NOTES
  All scripts are idempotent (safe to run multiple times).
  Cluster size: 18GB total (Server 2GB + System 6GB + Apps 10GB).
  APM stack: Prometheus + Grafana + Loki + Tempo + OTel (inside cluster).
  Frontend image ready to test: localhost:5000/agro-frontend:dev
#>

param(
    [string]$Command = ""
)

# =====================================================
# === Configuration (Locked)
# =====================================================
$clusterName = "dev"
$registryName = "localhost"
$registryPort = 5000
$appNamespace = "agro-apps"

$Color = @{
    Title   = "Cyan"
    Success = "Green"
    Warning = "Yellow"
    Error   = "Red"
    Info    = "White"
    Muted   = "Gray"
}

# =====================================================
# === Helper Functions
# =====================================================

function Show-Menu {
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor $Color.Title
    Write-Host "║       k3d-manager — TC Agro Solutions Local Dev            ║" -ForegroundColor $Color.Title
    Write-Host "║       Cluster: $clusterName | Registry: $registryName`:$registryPort            ║" -ForegroundColor $Color.Title
    Write-Host "║       Namespace: $appNamespace                                   ║" -ForegroundColor $Color.Title
    Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor $Color.Title
    Write-Host ""
    Write-Host "📋 CLUSTER OPERATIONS:" -ForegroundColor $Color.Info
    Write-Host "  1) Create cluster (1 server + 2 agents, full APM stack)"
    Write-Host "  2) Start cluster"
    Write-Host "  3) Status (show nodes, namespaces, services)"
    Write-Host "  4) Cleanup cluster (delete everything)"
    Write-Host ""
    Write-Host "🛠️  APPLICATION OPERATIONS:" -ForegroundColor $Color.Info
    Write-Host "  5) Build & push images (frontend to localhost:5000)"
    Write-Host "  6) Bootstrap ArgoCD applications"
    Write-Host "  7) List & search secrets (debug)"
    Write-Host ""
    Write-Host "🌐 NETWORKING & ACCESS:" -ForegroundColor $Color.Info
    Write-Host "  8) Update Windows hosts file (add argocd.local, agro.local)"
    Write-Host "  9) Port-forward (Grafana, Prometheus, etc.)"
    Write-Host " 10) Stop port-forwards"
    Write-Host ""
    Write-Host "❌ EXIT: q) Quit" -ForegroundColor $Color.Muted
    Write-Host ""
}

function Check-Prerequisites {
    Write-Host "🔍 Checking prerequisites..." -ForegroundColor $Color.Info
    $missing = @()
    
    foreach ($cmd in @("k3d", "kubectl", "helm", "docker")) {
        if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
            $missing += $cmd
        }
    }
    
    if ($missing.Count -gt 0) {
        Write-Host "❌ Missing commands: $($missing -join ', ')" -ForegroundColor $Color.Error
        Write-Host "   Please install them before continuing." -ForegroundColor $Color.Warning
        return $false
    }
    
    Write-Host "✅ All prerequisites found." -ForegroundColor $Color.Success
    return $true
}

function Get-ScriptPath {
    param([string]$ScriptName)
    return Join-Path $PSScriptRoot $ScriptName
}

function Invoke-Script {
    param(
        [string]$ScriptName,
        [string[]]$Arguments = @()
    )
    
    $script = Get-ScriptPath $ScriptName
    if (-not (Test-Path $script)) {
        Write-Host "❌ Script not found: $script" -ForegroundColor $Color.Error
        return $false
    }
    
    Write-Host ""
    Write-Host "▶️  Running: $ScriptName $Arguments" -ForegroundColor $Color.Muted
    Write-Host "───────────────────────────────────────────────────────────" -ForegroundColor $Color.Muted
    
    & $script @Arguments
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Script failed with exit code $LASTEXITCODE" -ForegroundColor $Color.Error
        return $false
    }
    
    Write-Host "───────────────────────────────────────────────────────────" -ForegroundColor $Color.Muted
    Write-Host "✅ Script completed successfully." -ForegroundColor $Color.Success
    return $true
}

# =====================================================
# === Main Menu Loop
# =====================================================

# Check if command passed as parameter
if ($Command) {
    $choice = $Command
}
else {
    # Check prerequisites once at startup
    if (-not (Check-Prerequisites)) {
        exit 1
    }
    
    # Interactive menu loop
    do {
        Show-Menu
        $choice = Read-Host "Enter command (1-10 or q to quit)"
    } while (@("1", "2", "3", "4", "5", "6", "7", "8", "9", "10") -notcontains $choice -and $choice -ne "q")
}

switch ($choice) {
    "1" {
        Invoke-Script "create-all-from-zero.ps1"
    }
    
    "2" {
        Invoke-Script "start-cluster.ps1"
    }
    
    "3" {
        Write-Host ""
        Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor $Color.Title
        Write-Host "║                    CLUSTER STATUS                          ║" -ForegroundColor $Color.Title
        Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor $Color.Title
        Write-Host ""
        
        Write-Host "📊 Nodes:" -ForegroundColor $Color.Info
        kubectl get nodes -o wide 2>$null
        
        Write-Host ""
        Write-Host "📁 Namespaces:" -ForegroundColor $Color.Info
        kubectl get namespaces 2>$null
        
        Write-Host ""
        Write-Host "🔧 Core Services:" -ForegroundColor $Color.Info
        kubectl get svc -A 2>$null | Select-String -Pattern "(argocd|grafana|prometheus|loki|tempo)"
        
        Write-Host ""
        Write-Host "📦 Deployments (monitoring):" -ForegroundColor $Color.Info
        kubectl get deployments -n monitoring 2>$null
        
        Write-Host ""
        Write-Host "📦 StatefulSets (monitoring):" -ForegroundColor $Color.Info
        kubectl get statefulsets -n monitoring 2>$null
    }
    
    "4" {
        Invoke-Script "cleanup-all.ps1"
    }
    
    "5" {
        Invoke-Script "build-push-images.ps1"
    }
    
    "6" {
        Invoke-Script "bootstrap-argocd-apps.ps1"
    }
    
    "7" {
        Invoke-Script "list-secrets.ps1"
    }
    
    "8" {
        Invoke-Script "update-hosts-file.ps1"
    }
    
    "9" {
        Write-Host ""
        Write-Host "🔗 Available port-forwards:" -ForegroundColor $Color.Info
        Write-Host "  - grafana (Grafana UI, port 3000)"
        Write-Host "  - prometheus (Prometheus, port 9090)"
        Write-Host "  - loki (Loki, port 3100)"
        Write-Host "  - tempo (Tempo, port 3200)"
        Write-Host "  - all (all services)"
        Write-Host ""
        
        $pf = Read-Host "Enter service name (or 'all')"
        Invoke-Script "port-forward.ps1" -Arguments @($pf)
    }
    
    "10" {
        Invoke-Script "stop-port-forward.ps1" -Arguments @("all")
    }
    
    "q" {
        Write-Host "Goodbye!" -ForegroundColor $Color.Info
        exit 0
    }
    
    default {
        Write-Host "❌ Invalid choice. Please try again." -ForegroundColor $Color.Error
    }
}

# If command was passed, exit; otherwise loop
if (-not $Command) {
    & $PSScriptRoot\k3d-manager.ps1
}
