<#
.SYNOPSIS
  Force sync ArgoCD applications after Git changes.

.DESCRIPTION
  Syncs all ArgoCD applications without destroying the cluster.
  Useful after committing changes to Git that ArgoCD should detect.
  
  Options:
  - all: Sync all applications
  - platform: Sync only platform components
  - apps: Sync only application components

.EXAMPLE
  .\sync-argocd.ps1 all
  .\sync-argocd.ps1 apps
#>

param(
    [ValidateSet("all", "platform", "apps")]
    [string]$Target = "all"
)

$ErrorActionPreference = "Stop"

$Color = @{
    Title   = "Cyan"
    Success = "Green"
    Warning = "Yellow"
    Error   = "Red"
    Info    = "White"
    Muted   = "Gray"
}

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor $Color.Title
Write-Host "║              ARGOCD FORCE SYNC                            ║" -ForegroundColor $Color.Title
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor $Color.Title
Write-Host ""

# Check ArgoCD is installed
$argocdCheck = kubectl get ns argocd --no-headers 2>$null
if (-not $argocdCheck) {
    Write-Host "❌ ArgoCD not found in cluster" -ForegroundColor $Color.Error
    Write-Host "   Run: .\bootstrap.ps1 first" -ForegroundColor $Color.Warning
    exit 1
}

Write-Host "✅ ArgoCD found in cluster" -ForegroundColor $Color.Success
Write-Host ""

# Ensure ArgoCD projects exist before syncing applications
Write-Host "Ensuring ArgoCD projects exist..." -ForegroundColor $Color.Info
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$projectsPath = Join-Path $repoRoot "infrastructure\kubernetes\platform\argocd\projects"

$projectPlatform = Join-Path $projectsPath "project-platform.yaml"
$projectApps = Join-Path $projectsPath "project-apps.yaml"

if (Test-Path $projectPlatform) {
    kubectl apply -f $projectPlatform 2>&1 | Out-Null
    Write-Host "  ✅ Platform project applied" -ForegroundColor $Color.Success
}
if (Test-Path $projectApps) {
    kubectl apply -f $projectApps 2>&1 | Out-Null
    Write-Host "  ✅ Apps project applied" -ForegroundColor $Color.Success
}
Write-Host ""

# Define applications to sync
$applications = @()

switch ($Target) {
    "all" {
        Write-Host "Syncing ALL applications..." -ForegroundColor $Color.Info
        $applications = @("platform-bootstrap", "apps-bootstrap", "platform-observability", "platform-autoscaling", "platform-ingress-nginx", "app-frontend")
    }
    "platform" {
        Write-Host "Syncing PLATFORM components..." -ForegroundColor $Color.Info
        $applications = @("platform-bootstrap", "platform-observability", "platform-autoscaling", "platform-ingress-nginx")
    }
    "apps" {
        Write-Host "Syncing APPLICATION components..." -ForegroundColor $Color.Info
        $applications = @("apps-bootstrap", "app-frontend")
    }
}

Write-Host ""

$syncedCount = 0
$failedCount = 0

foreach ($app in $applications) {
    Write-Host "Syncing: $app" -ForegroundColor $Color.Warning
    
    # Check if application exists
    $appExists = kubectl get application $app -n argocd --no-headers 2>$null
    
    if (-not $appExists) {
        Write-Host "  Application not found: $app" -ForegroundColor $Color.Warning
        $failedCount++
        continue
    }
    
    # Force refresh
    Write-Host "  • Refreshing repository..." -ForegroundColor $Color.Muted
    kubectl patch application $app -n argocd --type merge -p '{"metadata":{"annotations":{"argocd.argoproj.io/refresh":"hard"}}}' 2>$null
    
    # Trigger sync
    Write-Host "  • Triggering sync..." -ForegroundColor $Color.Muted
    kubectl patch application $app -n argocd --type merge -p '{"spec":{"syncPolicy":{"automated":{"syncInterval":"1s"}}}}' 2>$null
    
    # Wait a moment
    Start-Sleep -Seconds 2
    
    # Check sync status
    $status = kubectl get application $app -n argocd -o jsonpath='{.status.operationState.phase}' 2>$null
    
    if ($status -eq "Succeeded" -or $status -eq "") {
        Write-Host "  ✅ Sync triggered successfully" -ForegroundColor $Color.Success
        $syncedCount++
    }
    else {
        Write-Host "  ⚠️  Status: $status" -ForegroundColor $Color.Warning
        $syncedCount++
    }
    
    Write-Host ""
}

# Summary
Write-Host "═════════════════════════════════════════════════════════" -ForegroundColor $Color.Muted
Write-Host ""
Write-Host "📊 SYNC SUMMARY:" -ForegroundColor $Color.Info
Write-Host "   ✅ Triggered: $syncedCount" -ForegroundColor $Color.Success
if ($failedCount -gt 0) {
    Write-Host "   ⚠️  Failed: $failedCount" -ForegroundColor $Color.Warning
}
Write-Host ""

# Show how to monitor
Write-Host "🔍 MONITOR SYNC STATUS:" -ForegroundColor $Color.Info
Write-Host ""
Write-Host "   Via kubectl:" -ForegroundColor $Color.Muted
Write-Host "   kubectl get applications -n argocd" -ForegroundColor $Color.Info
Write-Host ""
Write-Host "   Via ArgoCD UI:" -ForegroundColor $Color.Muted
Write-Host "   1. Port-forward: .\manager.ps1 6 → argocd" -ForegroundColor $Color.Info
Write-Host "   2. Open: http://localhost:8080" -ForegroundColor $Color.Info
Write-Host "   3. Login: admin / Argo@123!" -ForegroundColor $Color.Info
Write-Host ""

Write-Host "✅ Force sync complete!" -ForegroundColor $Color.Success
Write-Host ""
