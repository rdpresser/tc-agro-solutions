<#
.SYNOPSIS
  Interactive menu for k3d GitOps cluster management.

.DESCRIPTION
  Provides a unified interface for:
  - Bootstrap (cluster + ArgoCD + GitOps)
  - Status checking
  - Cleanup
  - Port-forwards
  - Image builds
  - Hosts file updates

.EXAMPLE
  .\manager.ps1
  .\manager.ps1 1  # Direct command
#>

param(
    [string]$Command = ""
)

$ErrorActionPreference = "Continue"

$Color = @{
    Title   = "Green"
    Info    = "Cyan"
    Success = "Green"
    Error   = "Red"
    Warning = "Yellow"
    Muted   = "Gray"
}

function Show-Menu {
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor $Color.Title
    Write-Host "║          K3D GITOPS CLUSTER MANAGER                        ║" -ForegroundColor $Color.Title
    Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor $Color.Title
    Write-Host ""
    Write-Host "🚀 CLUSTER OPERATIONS:" -ForegroundColor $Color.Info
    Write-Host "  1) Bootstrap (create cluster + ArgoCD + GitOps)"
    Write-Host "  2) Start cluster"
    Write-Host "  3) Status (nodes, services, ArgoCD apps)"
    Write-Host "  4) Cleanup (delete cluster + registry)"
    Write-Host ""
    Write-Host "🛠️  UTILITIES:" -ForegroundColor $Color.Info
    Write-Host "  5) Build & push images"
    Write-Host "  6) List secrets"
    Write-Host ""
    Write-Host "🌐 NETWORKING & ACCESS:" -ForegroundColor $Color.Info
    Write-Host "  7) Update Windows hosts file"
    Write-Host "  8) Port-forward (Grafana, Prometheus, etc.)"
    Write-Host "  9) Stop port-forwards"
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
    
    if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne $null) {
        Write-Host "❌ Script failed with exit code $LASTEXITCODE" -ForegroundColor $Color.Error
        return $false
    }
    
    Write-Host "───────────────────────────────────────────────────────────" -ForegroundColor $Color.Muted
    Write-Host "✅ Script completed." -ForegroundColor $Color.Success
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
        $choice = Read-Host "Enter command (1-9 or q to quit)"
    } while (@("1", "2", "3", "4", "5", "6", "7", "8", "9") -notcontains $choice -and $choice -ne "q")
}

switch ($choice) {
    "1" {
        Invoke-Script "bootstrap.ps1"
    }
    
    "2" {
        Invoke-Script "start-cluster.ps1"
    }
    
    "3" {
        Invoke-Script "status.ps1"
    }
    
    "4" {
        Invoke-Script "cleanup.ps1"
    }
    
    "5" {
        Invoke-Script "build-push-images.ps1"
    }
    
    "6" {
        Write-Host ""
        $ns = Read-Host "Enter namespace (or press Enter for all)"
        if ($ns) {
            Invoke-Script "list-secrets.ps1" -Arguments @($ns)
        }
        else {
            Invoke-Script "list-secrets.ps1"
        }
    }
    
    "7" {
        Invoke-Script "update-hosts-file.ps1"
    }
    
    "8" {
        Write-Host ""
        Write-Host "🔗 Available port-forwards:" -ForegroundColor $Color.Info
        Write-Host "  - grafana (port 3000)"
        Write-Host "  - prometheus (port 9090)"
        Write-Host "  - loki (port 3100)"
        Write-Host "  - tempo (port 3200)"
        Write-Host "  - all (all services)"
        Write-Host ""
        
        $pf = Read-Host "Enter service name (or 'all')"
        if ($pf) {
            Invoke-Script "port-forward.ps1" -Arguments @($pf)
        }
    }
    
    "9" {
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
    & $PSScriptRoot\manager.ps1
}
