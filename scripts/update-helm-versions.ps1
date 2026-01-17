#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Automatically update Helm chart versions in ArgoCD application manifests

.DESCRIPTION
    This script checks for latest Helm chart versions and optionally updates
    the targetRevision values in ArgoCD application YAML files.
    
    CAUTION: Always review release notes before applying updates!

.PARAMETER DryRun
    Show what would be updated without making changes (default: true)

.PARAMETER Apply
    Actually apply the updates to YAML files

.PARAMETER SkipBackup
    Skip creating backup files (not recommended)

.EXAMPLE
    .\update-helm-versions.ps1
    # Dry run - shows what would be updated

.EXAMPLE
    .\update-helm-versions.ps1 -Apply
    # Actually update the files

.EXAMPLE
    .\update-helm-versions.ps1 -Apply -SkipBackup
    # Update without creating backups (not recommended)

.NOTES
    Requires: helm CLI installed
    Location: scripts/update-helm-versions.ps1
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [switch]$Apply,
    
    [Parameter(Mandatory = $false)]
    [switch]$SkipBackup
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# Colors
$ColorInfo = "Cyan"
$ColorSuccess = "Green"
$ColorWarning = "Yellow"
$ColorError = "Red"
$ColorHeader = "Magenta"

# Base paths
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$ArgocdAppsPath = Join-Path $ProjectRoot "infrastructure" "kubernetes" "platform" "argocd" "applications"

# Chart definitions
$charts = @(
    @{
        Name        = "kube-prometheus-stack"
        Repo        = "https://prometheus-community.github.io/helm-charts"
        RepoName    = "prometheus-community"
        File        = Join-Path $ArgocdAppsPath "platform-observability.yaml"
        LinePattern = "chart: kube-prometheus-stack"
    },
    @{
        Name        = "loki"
        Repo        = "https://grafana.github.io/helm-charts"
        RepoName    = "grafana"
        File        = Join-Path $ArgocdAppsPath "platform-observability.yaml"
        LinePattern = "chart: loki"
    },
    @{
        Name        = "tempo"
        Repo        = "https://grafana.github.io/helm-charts"
        RepoName    = "grafana"
        File        = Join-Path $ArgocdAppsPath "platform-observability.yaml"
        LinePattern = "chart: tempo"
    },
    @{
        Name        = "opentelemetry-collector"
        Repo        = "https://open-telemetry.github.io/opentelemetry-helm-charts"
        RepoName    = "opentelemetry"
        File        = Join-Path $ArgocdAppsPath "platform-observability.yaml"
        LinePattern = "chart: opentelemetry-collector"
    },
    @{
        Name        = "keda"
        Repo        = "https://kedacore.github.io/charts"
        RepoName    = "kedacore"
        File        = Join-Path $ArgocdAppsPath "platform-autoscaling.yaml"
        LinePattern = "chart: keda"
    }
)

Write-Host "╔═══════════════════════════════════════════════════════════════════════════════╗" -ForegroundColor $ColorHeader
Write-Host "║              🔄 HELM CHART VERSION UPDATE UTILITY                             ║" -ForegroundColor $ColorHeader
Write-Host "╚═══════════════════════════════════════════════════════════════════════════════╝" -ForegroundColor $ColorHeader
Write-Host ""

if (-not $Apply) {
    Write-Host "ℹ️  DRY RUN MODE - No changes will be made" -ForegroundColor $ColorWarning
    Write-Host "   Use -Apply to actually update files" -ForegroundColor $ColorWarning
    Write-Host ""
}

# Check helm CLI
try {
    $helmVersion = helm version --short 2>$null
    Write-Host "✅ Helm installed: $helmVersion" -ForegroundColor $ColorSuccess
}
catch {
    Write-Host "❌ Helm CLI not found. Install from: https://helm.sh/docs/intro/install/" -ForegroundColor $ColorError
    exit 1
}

Write-Host ""
Write-Host "📦 Updating Helm repositories..." -ForegroundColor $ColorInfo
$reposToAdd = $charts | Select-Object -Property RepoName, Repo -Unique
foreach ($repo in $reposToAdd) {
    helm repo add $repo.RepoName $repo.Repo 2>&1 | Out-Null
}
helm repo update 2>&1 | Out-Null
Write-Host "  ✓ Repositories updated" -ForegroundColor $ColorSuccess
Write-Host ""

# Process each chart
$updatesToApply = @()

foreach ($chart in $charts) {
    Write-Host "🔍 Checking: $($chart.Name)" -ForegroundColor $ColorInfo
    
    # Get current version from file
    if (-not (Test-Path $chart.File)) {
        Write-Host "  ⚠️  File not found: $($chart.File)" -ForegroundColor $ColorWarning
        continue
    }
    
    $content = Get-Content $chart.File -Raw
    $lines = Get-Content $chart.File
    
    # Find current version
    $currentVersion = $null
    $versionLineNumber = $null
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match $chart.LinePattern) {
            # Next non-empty line should be targetRevision
            for ($j = $i + 1; $j -lt $lines.Count; $j++) {
                if ($lines[$j] -match '^\s*targetRevision:\s*(.+)$') {
                    $currentVersion = $matches[1].Trim()
                    $versionLineNumber = $j
                    break
                }
            }
            break
        }
    }
    
    if (-not $currentVersion) {
        Write-Host "  ⚠️  Could not find current version" -ForegroundColor $ColorWarning
        continue
    }
    
    Write-Host "  Current: $currentVersion" -ForegroundColor DarkGray
    
    # Get latest version
    try {
        $searchResult = helm search repo "$($chart.RepoName)/$($chart.Name)" --output json | ConvertFrom-Json
        if ($searchResult -and $searchResult.Count -gt 0) {
            $latestVersion = $searchResult[0].version
            Write-Host "  Latest:  $latestVersion" -ForegroundColor $(if ($latestVersion -eq $currentVersion) { $ColorSuccess } else { $ColorWarning })
            
            if ($latestVersion -ne $currentVersion) {
                $updatesToApply += @{
                    Chart          = $chart.Name
                    File           = $chart.File
                    CurrentVersion = $currentVersion
                    LatestVersion  = $latestVersion
                    LineNumber     = $versionLineNumber
                    OldLine        = $lines[$versionLineNumber]
                }
                Write-Host "  ⚠️  UPDATE AVAILABLE" -ForegroundColor $ColorWarning
            }
            else {
                Write-Host "  ✅ UP TO DATE" -ForegroundColor $ColorSuccess
            }
        }
    }
    catch {
        Write-Host "  ❌ Error checking version: $_" -ForegroundColor $ColorError
    }
    
    Write-Host ""
}

# Apply updates if requested
if ($updatesToApply.Count -eq 0) {
    Write-Host "═══════════════════════════════════════════════════════════════════════════════" -ForegroundColor $ColorHeader
    Write-Host ""
    Write-Host "✅ ALL CHARTS ARE UP TO DATE!" -ForegroundColor $ColorSuccess
    Write-Host ""
    exit 0
}

Write-Host "═══════════════════════════════════════════════════════════════════════════════" -ForegroundColor $ColorHeader
Write-Host ""
Write-Host "📋 UPDATES TO APPLY: $($updatesToApply.Count)" -ForegroundColor $ColorWarning
Write-Host ""

foreach ($update in $updatesToApply) {
    Write-Host "  📦 $($update.Chart)" -ForegroundColor $ColorInfo
    Write-Host "     $($update.CurrentVersion) → $($update.LatestVersion)" -ForegroundColor $ColorWarning
}

Write-Host ""

if ($Apply) {
    Write-Host "🔧 APPLYING UPDATES..." -ForegroundColor $ColorInfo
    Write-Host ""
    
    # Group updates by file
    $updatesByFile = $updatesToApply | Group-Object -Property File
    
    foreach ($fileGroup in $updatesByFile) {
        $file = $fileGroup.Name
        $fileUpdates = $fileGroup.Group
        
        Write-Host "📝 Updating: $(Split-Path $file -Leaf)" -ForegroundColor $ColorInfo
        
        # Create backup unless skipped
        if (-not $SkipBackup) {
            $backupFile = "$file.backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
            Copy-Item $file $backupFile -Force
            Write-Host "  📋 Backup: $(Split-Path $backupFile -Leaf)" -ForegroundColor DarkGray
        }
        
        # Read file content
        $content = Get-Content $file -Raw
        
        # Apply each update (replace version strings)
        foreach ($update in $fileUpdates) {
            $oldPattern = "targetRevision:\s*$([regex]::Escape($update.CurrentVersion))"
            $newValue = "targetRevision: $($update.LatestVersion)"
            
            if ($content -match $oldPattern) {
                $content = $content -replace $oldPattern, $newValue
                Write-Host "  ✓ $($update.Chart): $($update.CurrentVersion) → $($update.LatestVersion)" -ForegroundColor $ColorSuccess
            }
            else {
                Write-Host "  ⚠️  Could not update $($update.Chart) (pattern not found)" -ForegroundColor $ColorWarning
            }
        }
        
        # Write updated content
        Set-Content -Path $file -Value $content -NoNewline
        Write-Host ""
    }
    
    Write-Host "═══════════════════════════════════════════════════════════════════════════════" -ForegroundColor $ColorHeader
    Write-Host ""
    Write-Host "✅ Updates applied successfully!" -ForegroundColor $ColorSuccess
    Write-Host ""
    Write-Host "🔄 NEXT STEPS:" -ForegroundColor $ColorInfo
    Write-Host ""
    Write-Host "  1. Review the changes:" -ForegroundColor DarkGray
    Write-Host "     git diff infrastructure/kubernetes/platform/argocd/applications/" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "  2. Test locally with k3d cluster" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "  3. Commit and push:" -ForegroundColor DarkGray
    Write-Host "     git add -A" -ForegroundColor DarkGray
    Write-Host "     git commit -m 'chore: update Helm chart versions to latest releases'" -ForegroundColor DarkGray
    Write-Host "     git push" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "  4. Monitor ArgoCD sync:" -ForegroundColor DarkGray
    Write-Host "     kubectl get applications -n argocd -w" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "  5. Verify pods are healthy:" -ForegroundColor DarkGray
    Write-Host "     kubectl get pods -n monitoring" -ForegroundColor DarkGray
    Write-Host "     kubectl get pods -n keda" -ForegroundColor DarkGray
    Write-Host ""
    
    if (-not $SkipBackup) {
        Write-Host "📋 Backup files created (can be deleted after verification)" -ForegroundColor DarkGray
        Write-Host ""
    }
}
else {
    Write-Host "ℹ️  DRY RUN - No changes were made" -ForegroundColor $ColorWarning
    Write-Host ""
    Write-Host "To apply these updates, run:" -ForegroundColor $ColorInfo
    Write-Host "  .\scripts\update-helm-versions.ps1 -Apply" -ForegroundColor $ColorSuccess
    Write-Host ""
}

Write-Host "═══════════════════════════════════════════════════════════════════════════════" -ForegroundColor $ColorHeader
Write-Host ""
