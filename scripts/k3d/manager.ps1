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
    Write-Host "   3) Stop cluster"
    Write-Host "   4) Restart cluster (stop + start)"
    Write-Host "   5) Status (nodes, services, ArgoCD apps)"
    Write-Host "   6) Cleanup (delete cluster + registry)"
    Write-Host ""
    Write-Host "🔐 ARGOCD MANAGEMENT:" -ForegroundColor $Color.Info
    Write-Host "   7) Reset ArgoCD admin password"
    Write-Host "   8) Test password change (debug mode)"
    Write-Host "   9) Force sync ArgoCD applications (after Git changes)"
    Write-Host ""
    Write-Host "🌐 NETWORKING & ACCESS:" -ForegroundColor $Color.Info
    Write-Host "  10) Start port-forward (ArgoCD, Grafana, etc.)"
    Write-Host "  11) List active port-forwards"
    Write-Host "  12) Stop port-forwards"
    Write-Host ""
    Write-Host "🛠️  UTILITIES:" -ForegroundColor $Color.Info
    Write-Host "  13) Build & push images"
    Write-Host "  14) List secrets"
    Write-Host "  15) Diagnose ArgoCD access"
    Write-Host "  19) Import k3d env secrets/configmap"
    Write-Host ""
    Write-Host "📦 HELM CHART MANAGEMENT:" -ForegroundColor $Color.Info
    Write-Host "  16) Check Helm chart versions (read-only)"
    Write-Host "  17) Update Helm charts (dry-run)"
    Write-Host "  18) Update Helm charts (apply with backup)"
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
        $choice = Read-Host "Enter command (1-19 or q to quit)"
    } while (@("1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19") -notcontains $choice -and $choice -ne "q")

    if ($choice -eq "q") {
        Write-Host "`n👋 Goodbye!" -ForegroundColor $Color.Success
        exit 0
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
            $null = Invoke-Script "stop-cluster.ps1"
            $null = Read-Host "`nPress Enter to continue"
        }
    
        "4" {
            $null = Invoke-Script "restart-cluster.ps1"
            $null = Read-Host "`nPress Enter to continue"
        }
    
        "5" {
            $null = Invoke-Script "status.ps1"
            $null = Read-Host "`nPress Enter to continue"
        }
    
        "6" {
            $null = Invoke-Script "cleanup.ps1"
            $null = Read-Host "`nPress Enter to continue"
        }
    
        "7" {
            $null = Invoke-Script "reset-argocd-password.ps1"
            $null = Read-Host "`nPress Enter to continue"
        }
    
        "8" {
            $null = Invoke-Script "reset-argocd-password.ps1" -Arguments @("-TestOnly")
            $null = Read-Host "`nPress Enter to continue"
        }
    
        "9" {
            Write-Host ""
            Write-Host "Force sync targets:" -ForegroundColor $Color.Info
            Write-Host "  - all (platform + apps)" -ForegroundColor $Color.Muted
            Write-Host "  - platform (platform components only)" -ForegroundColor $Color.Muted
            Write-Host "  - apps (application components only)" -ForegroundColor $Color.Muted
            Write-Host ""
        
            $sync = Read-Host "Enter sync target (default: all)"
            if (-not $sync) { $sync = "all" }
            
            if (@("all", "platform", "apps") -contains $sync) {
                # Import secrets/configmap BEFORE ArgoCD sync to ensure referenced resources exist
                $null = Invoke-Script "import-secrets.ps1"
                $null = Invoke-Script "sync-argocd.ps1" -Arguments @($sync)
            }
            else {
                Write-Host "Invalid target: $sync" -ForegroundColor $Color.Error
            }
            $null = Read-Host "`nPress Enter to continue"
        }
    
        "10" {
            Write-Host ""
            Write-Host "Port-forward to services:" -ForegroundColor $Color.Info
            Write-Host "  - argocd (default)" -ForegroundColor $Color.Muted
            Write-Host "  - grafana" -ForegroundColor $Color.Muted
            Write-Host "  - prometheus" -ForegroundColor $Color.Muted
            Write-Host "  - loki" -ForegroundColor $Color.Muted
            Write-Host "  - tempo" -ForegroundColor $Color.Muted
            Write-Host "  - frontend" -ForegroundColor $Color.Muted
            Write-Host "  - identity" -ForegroundColor $Color.Muted
            Write-Host "  - all" -ForegroundColor $Color.Muted
            Write-Host ""
        
            $pf = Read-Host "Enter service (default: argocd)"
            if (-not $pf) { $pf = "argocd" }
            
            $null = Invoke-Script "port-forward.ps1" -Arguments @($pf)
            $null = Read-Host "`nPress Enter to continue"
        }
    
        "11" {
            $null = Invoke-Script "list-port-forwards.ps1"
            $null = Read-Host "`nPress Enter to continue"
        }
    
        "12" {
            $null = Invoke-Script "stop-port-forward.ps1" -Arguments @("all")
            $null = Read-Host "`nPress Enter to continue"
        }
    
        "13" {
            $null = Invoke-Script "build-push-images.ps1"
            # Import secrets/configmap after image build & push
            $null = Invoke-Script "import-secrets.ps1"
            $null = Read-Host "`nPress Enter to continue"
        }
    
        "14" {
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
    
        "15" {
            $null = Invoke-Script "diagnose-argocd.ps1"
            $null = Read-Host "`nPress Enter to continue"
        }
    
        "16" {
            Write-Host ""
            Write-Host "🔍 Checking for Helm chart updates..." -ForegroundColor $Color.Info
            Write-Host "   This will query Helm repositories for latest versions." -ForegroundColor $Color.Muted
            Write-Host "   No changes will be made to your system." -ForegroundColor $Color.Muted
            Write-Host ""
        
            $parentScriptsPath = Split-Path -Parent $PSScriptRoot
            $helmCheckScript = Join-Path $parentScriptsPath "check-helm-versions.ps1"
        
            if (Test-Path $helmCheckScript) {
                & $helmCheckScript
            }
            else {
                Write-Host "❌ Script not found: $helmCheckScript" -ForegroundColor $Color.Error
            }
            $null = Read-Host "`nPress Enter to continue"
        }
    
        "17" {
            Write-Host ""
            Write-Host "🔄 Helm Chart Update - DRY RUN" -ForegroundColor $Color.Info
            Write-Host "   This will show what would be updated without making changes." -ForegroundColor $Color.Muted
            Write-Host "   Review the output carefully before applying." -ForegroundColor $Color.Muted
            Write-Host ""
        
            $parentScriptsPath = Split-Path -Parent $PSScriptRoot
            $helmUpdateScript = Join-Path $parentScriptsPath "update-helm-versions.ps1"
        
            if (Test-Path $helmUpdateScript) {
                & $helmUpdateScript
            }
            else {
                Write-Host "❌ Script not found: $helmUpdateScript" -ForegroundColor $Color.Error
            }
            $null = Read-Host "`nPress Enter to continue"
        }
    
        "18" {
            Write-Host ""
            Write-Host "⚠️  HELM CHART UPDATE - APPLY MODE" -ForegroundColor $Color.Warning
            Write-Host "   This will UPDATE targetRevision values in ArgoCD manifests." -ForegroundColor $Color.Warning
            Write-Host "   Backups will be created automatically." -ForegroundColor $Color.Muted
            Write-Host ""
            Write-Host "⚠️  WARNING:" -ForegroundColor $Color.Warning
            Write-Host "   - Always review release notes before updating" -ForegroundColor $Color.Muted
            Write-Host "   - Test in development before production" -ForegroundColor $Color.Muted
            Write-Host "   - Monitor pods after ArgoCD sync" -ForegroundColor $Color.Muted
            Write-Host ""
        
            $confirm = Read-Host "Are you sure you want to apply updates? (yes/no)"
        
            if ($confirm -eq "yes") {
                $parentScriptsPath = Split-Path -Parent $PSScriptRoot
                $helmUpdateScript = Join-Path $parentScriptsPath "update-helm-versions.ps1"
            
                if (Test-Path $helmUpdateScript) {
                    & $helmUpdateScript -Apply
                
                    Write-Host ""
                    Write-Host "✅ Updates applied!" -ForegroundColor $Color.Success
                    Write-Host ""
                    Write-Host "🔄 NEXT STEPS:" -ForegroundColor $Color.Info
                    Write-Host "   1. Review changes: git diff" -ForegroundColor $Color.Muted
                    Write-Host "   2. Commit and push to trigger ArgoCD sync" -ForegroundColor $Color.Muted
                    Write-Host "   3. Monitor: kubectl get applications -n argocd -w" -ForegroundColor $Color.Muted
                    Write-Host "   4. Verify pods: kubectl get pods -n monitoring" -ForegroundColor $Color.Muted
                }
                else {
                    Write-Host "❌ Script not found: $helmUpdateScript" -ForegroundColor $Color.Error
                }
            }
            else {
                Write-Host "ℹ️  Update cancelled." -ForegroundColor $Color.Info
            }
            $null = Read-Host "`nPress Enter to continue"
        }

        "19" {
            $null = Invoke-Script "import-secrets.ps1"
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
}
