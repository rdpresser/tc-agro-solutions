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
Write-Host "ARGOCD FORCE SYNC" -ForegroundColor $Color.Title
Write-Host ""

# Check ArgoCD is installed
$argocdCheck = kubectl get ns argocd --no-headers 2>$null
if (-not $argocdCheck) {
    Write-Host "ArgoCD not found in cluster" -ForegroundColor $Color.Error
    Write-Host "   Run: .\bootstrap.ps1 first" -ForegroundColor $Color.Warning
    exit 1
}

Write-Host "ArgoCD found in cluster" -ForegroundColor $Color.Success
Write-Host ""

# Ensure ArgoCD projects and bootstrap apps exist before syncing applications
Write-Host "Ensuring ArgoCD bootstrap is applied..." -ForegroundColor $Color.Info
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$bootstrapAllPath = Join-Path $repoRoot "infrastructure\kubernetes\platform\argocd\bootstrap\bootstrap-all.yaml"

if (Test-Path $bootstrapAllPath) {
    kubectl apply -f $bootstrapAllPath 2>&1 | Out-Null
    Write-Host "  ArgoCD bootstrap applied" -ForegroundColor $Color.Success
}
else {
    Write-Host "  Bootstrap file not found: $bootstrapAllPath" -ForegroundColor $Color.Warning
}
Write-Host ""

# Define applications to sync
$applications = @()

switch ($Target) {
    "all" {
        Write-Host "Syncing ALL applications..." -ForegroundColor $Color.Info
        $applications = @(
            "platform-bootstrap",
            "platform-base",
            "apps-bootstrap",
            "apps-dev"
        )
    }
    "platform" {
        Write-Host "Syncing PLATFORM components..." -ForegroundColor $Color.Info
        $applications = @(
            "platform-bootstrap",
            "platform-base"
        )
    }
    "apps" {
        Write-Host "Syncing APPLICATION components..." -ForegroundColor $Color.Info
        $applications = @("apps-bootstrap", "apps-dev")
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
    
    # Hard refresh (clears cache and fetches latest from Git)
    Write-Host "  - Hard refresh from Git..." -ForegroundColor $Color.Muted
    kubectl patch application $app -n argocd --type merge -p '{\"metadata\":{\"annotations\":{\"argocd.argoproj.io/refresh\":\"hard\"}}}' 2>&1 | Out-Null
    
    Start-Sleep -Seconds 1
    
    # Force sync operation
    Write-Host "  - Forcing sync operation..." -ForegroundColor $Color.Muted
    $syncPatch = @'
{"operation":{"initiatedBy":{"username":"admin"},"sync":{"syncStrategy":{"hook":{}}}}}
'@
    $patchFile = [System.IO.Path]::GetTempFileName()
    Set-Content -Path $patchFile -Value $syncPatch -Encoding ASCII
    try {
        kubectl patch application $app -n argocd --type merge --patch-file $patchFile 2>&1 | Out-Null
    }
    finally {
        Remove-Item -Path $patchFile -ErrorAction SilentlyContinue
    }
    
    # Wait for sync to start
    Start-Sleep -Seconds 2
    
    # Check sync status
    $status = kubectl get application $app -n argocd -o jsonpath='{.status.operationState.phase}' 2>$null
    $syncStatus = kubectl get application $app -n argocd -o jsonpath='{.status.sync.status}' 2>$null
    
    if ($syncStatus -eq "Synced") {
        Write-Host "  Synced successfully" -ForegroundColor $Color.Success
        $syncedCount++
    }
    elseif ($status -eq "Running" -or $status -eq "Progressing") {
        Write-Host "  Sync in progress..." -ForegroundColor $Color.Warning
        $syncedCount++
    }
    elseif ($status -eq "Succeeded") {
        Write-Host "  Sync operation succeeded" -ForegroundColor $Color.Success
        $syncedCount++
    }
    else {
        Write-Host "  Status: $syncStatus (Operation: $status)" -ForegroundColor $Color.Warning
        $syncedCount++
    }
    
    Write-Host ""
}

# Summary
Write-Host "----------------------------------------" -ForegroundColor $Color.Muted
Write-Host ""
Write-Host "SYNC SUMMARY:" -ForegroundColor $Color.Info
Write-Host "   Triggered: $syncedCount" -ForegroundColor $Color.Success
if ($failedCount -gt 0) {
    Write-Host "   Failed: $failedCount" -ForegroundColor $Color.Warning
}
Write-Host ""

# Wait for syncs to complete (optional, with timeout)
Write-Host "Waiting for syncs to complete (max 30s)..." -ForegroundColor $Color.Info
$timeout = 30
$elapsed = 0
$allSynced = $false

while ($elapsed -lt $timeout -and -not $allSynced) {
    Start-Sleep -Seconds 3
    $elapsed += 3
    
    $pendingApps = @()
    foreach ($app in $applications) {
        $syncStatus = kubectl get application $app -n argocd -o jsonpath='{.status.sync.status}' 2>$null
        if ($syncStatus -ne "Synced") {
            $pendingApps += "$app($syncStatus)"
        }
    }
    
    if ($pendingApps.Count -eq 0) {
        $allSynced = $true
        Write-Host "   All applications synced." -ForegroundColor $Color.Success
    }
    else {
        Write-Host "   Pending: $($pendingApps -join ', ')" -ForegroundColor $Color.Muted
    }
}

if (-not $allSynced) {
    Write-Host "   Timeout reached. Some apps may still be syncing." -ForegroundColor $Color.Warning
}
Write-Host ""

# Show how to monitor
Write-Host "MONITOR SYNC STATUS:" -ForegroundColor $Color.Info
Write-Host ""
Write-Host "   Via kubectl:" -ForegroundColor $Color.Muted
Write-Host "   kubectl get applications -n argocd" -ForegroundColor $Color.Info
Write-Host ""
Write-Host "   Via ArgoCD UI:" -ForegroundColor $Color.Muted
Write-Host "   1. Port-forward: .\manager.ps1 6 - argocd" -ForegroundColor $Color.Info
Write-Host "   2. Open: http://localhost:8090/argocd/" -ForegroundColor $Color.Info
Write-Host "   3. Login: admin / Argo@123!" -ForegroundColor $Color.Info
Write-Host ""

Write-Host "Force sync complete." -ForegroundColor $Color.Success
Write-Host ""
