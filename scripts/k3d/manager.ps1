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
    Write-Host "   1) Bootstrap (create cluster + ArgoCD + GitOps)"
    Write-Host "   2) Start cluster"
    Write-Host "   3) Status (nodes, services, ArgoCD apps)"
    Write-Host "   4) Cleanup (delete cluster + registry)"
    Write-Host ""
    Write-Host "🔐 ARGOCD MANAGEMENT:" -ForegroundColor $Color.Info
    Write-Host "   5) Reset ArgoCD admin password"
    Write-Host "   6) Force sync ArgoCD applications (after Git changes)"
    Write-Host ""
    Write-Host "🌐 NETWORKING & ACCESS:" -ForegroundColor $Color.Info
    Write-Host "   7) Start port-forward (ArgoCD, Grafana, etc.)"
    Write-Host "   8) List active port-forwards"
    Write-Host "   9) Stop port-forwards"
    Write-Host ""
    Write-Host "🛠️  UTILITIES:" -ForegroundColor $Color.Info
    Write-Host "  10) Build & push images"
    Write-Host "  11) List secrets"
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
    Write-Host "Running: $ScriptName $Arguments" -ForegroundColor $Color.Muted
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
        $choice = Read-Host "Enter command (1-11 or q to quit)"
    } while (@("1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11") -notcontains $choice -and $choice -ne "q")
}

switch ($choice) {
    "1" {
        $null = Invoke-Script "bootstrap.ps1"
        $null = Read-Host "`nPress Enter to continue"
    }
    
    "2" {
        $null = Invoke-Script "start-cluster.ps1"
        $null = Read-Host "`nPress Enter to continue"
    }
    
    "3" {
        $null = Invoke-Script "status.ps1"
        $null = Read-Host "`nPress Enter to continue"
    }
    
    "4" {
        $null = Invoke-Script "cleanup.ps1"
        $null = Read-Host "`nPress Enter to continue"
    }
    
    "5" {
        $null = Invoke-Script "reset-argocd-password.ps1"
        $null = Read-Host "`nPress Enter to continue"
    }
    
    "6" {
        Write-Host ""
        Write-Host "Force sync targets:" -ForegroundColor $Color.Info
        Write-Host "  - all (platform + apps)" -ForegroundColor $Color.Muted
        Write-Host "  - platform (platform components only)" -ForegroundColor $Color.Muted
        Write-Host "  - apps (application components only)" -ForegroundColor $Color.Muted
        Write-Host ""
        
        $sync = Read-Host "Enter sync target (default: all)"
        if (-not $sync) { $sync = "all" }
        
        if (@("all", "platform", "apps") -contains $sync) {
            $null = Invoke-Script "sync-argocd.ps1" -Arguments @($sync)
        }
        else {
            Write-Host "Invalid target: $sync" -ForegroundColor $Color.Error
        }
        $null = Read-Host "`nPress Enter to continue"
    }
    
    "7" {
        Write-Host ""
        Write-Host "Port-forward to services:" -ForegroundColor $Color.Info
        Write-Host "  - argocd (default)" -ForegroundColor $Color.Muted
        Write-Host "  - grafana" -ForegroundColor $Color.Muted
        Write-Host "  - prometheus" -ForegroundColor $Color.Muted
        Write-Host "  - loki" -ForegroundColor $Color.Muted
        Write-Host "  - tempo" -ForegroundColor $Color.Muted
        Write-Host "  - frontend" -ForegroundColor $Color.Muted
        Write-Host "  - all" -ForegroundColor $Color.Muted
        Write-Host ""
        
        $pf = Read-Host "Enter service (default: argocd)"
        if (-not $pf) { $pf = "argocd" }
        
        if (@("argocd", "grafana", "prometheus", "loki", "tempo", "frontend", "all") -contains $pf) {
            $null = Invoke-Script "port-forward.ps1" -Arguments @($pf)
        }
        else {
            Write-Host "Invalid service: $pf" -ForegroundColor $Color.Error
        }
        $null = Read-Host "`nPress Enter to continue"
    }
    
    "8" {
        $null = Invoke-Script "list-port-forwards.ps1"
        $null = Read-Host "`nPress Enter to continue"
    }
    
    "9" {
        $null = Invoke-Script "stop-port-forward.ps1" -Arguments @("all")
        $null = Read-Host "`nPress Enter to continue"
    }
    
    "10" {
        $null = Invoke-Script "build-push-images.ps1"
        $null = Read-Host "`nPress Enter to continue"
    }
    
    "11" {
        Write-Host ""
        $ns = Read-Host "Enter namespace (or press Enter for all)"
        if ($ns) {
            $null = Invoke-Script "list-secrets.ps1" -Arguments @($ns)
        }
        else {
            $null = Invoke-Script "list-secrets.ps1"
        }
        $null = Read-Host "`nPress Enter to continue"
    }
    
    "q" {
        Write-Host "Goodbye!" -ForegroundColor $Color.Info
        exit 0
    }
    
    default {
        Write-Host "Invalid choice. Please try again." -ForegroundColor $Color.Error
    }
}

# If command was passed, exit; otherwise loop
if (-not $Command) {
    & $PSScriptRoot\manager.ps1
}
