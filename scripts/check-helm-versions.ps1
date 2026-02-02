#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Check for latest versions of Helm charts used in ArgoCD applications

.DESCRIPTION
    This script queries Helm repositories to find the latest versions of charts
    used in optional KEDA applications.
    
    NOTE: Full observability stack (Prometheus, Grafana, Loki, Tempo) runs
    in Docker Compose, not in k3d. The OTEL DaemonSet is a manual manifest
    (platform/otel-daemonset.yaml) and is not managed via Helm.

.EXAMPLE
    .\check-helm-versions.ps1

.NOTES
    Requires: helm CLI installed and configured
#>

#Requires -Version 5.0

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# Colors for output
$ColorInfo = "Cyan"
$ColorSuccess = "Green"
$ColorWarning = "Yellow"
$ColorError = "Red"
$ColorHeader = "Magenta"

# Chart definitions - only charts that are still deployed via Helm in k3d
# NOTE: kube-prometheus-stack, loki, tempo were moved to Docker Compose
# NOTE: OTEL DaemonSet is a manual manifest (not a Helm chart)
$charts = @(
    @{
        Name           = "keda"
        Repo           = "https://kedacore.github.io/charts"
        RepoName       = "kedacore"
        CurrentVersion = "2.15.1"
        File           = "keda.values.yaml"
        Description    = "Kubernetes Event Driven Autoscaling (optional)"
    }
)

Write-Host "╔═══════════════════════════════════════════════════════════════════════════════╗" -ForegroundColor $ColorHeader
Write-Host "║                    🔍 HELM CHART VERSION CHECK                                ║" -ForegroundColor $ColorHeader
Write-Host "╚═══════════════════════════════════════════════════════════════════════════════╝" -ForegroundColor $ColorHeader
Write-Host ""

# Check if helm is installed
try {
    $helmVersion = helm version --short 2>$null
    Write-Host "✅ Helm installed: $helmVersion" -ForegroundColor $ColorSuccess
    Write-Host ""
}
catch {
    Write-Host "❌ Helm CLI not found. Please install Helm first:" -ForegroundColor $ColorError
    Write-Host "   https://helm.sh/docs/intro/install/" -ForegroundColor $ColorInfo
    exit 1
}

# Add/update repositories
Write-Host "📦 Updating Helm repositories..." -ForegroundColor $ColorInfo
$reposToAdd = $charts | Select-Object -Property RepoName, Repo -Unique
foreach ($repo in $reposToAdd) {
    try {
        helm repo add $repo.RepoName $repo.Repo 2>&1 | Out-Null
        Write-Host "  ✓ Added/updated: $($repo.RepoName)" -ForegroundColor $ColorSuccess
    }
    catch {
        Write-Host "  ⚠ Could not add repo: $($repo.RepoName)" -ForegroundColor $ColorWarning
    }
}

Write-Host ""
Write-Host "🔄 Refreshing repository index..." -ForegroundColor $ColorInfo
helm repo update 2>&1 | Out-Null
Write-Host "  ✓ Repository index updated" -ForegroundColor $ColorSuccess
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════════════════════" -ForegroundColor $ColorHeader
Write-Host ""

# Check each chart
$updates = @()
foreach ($chart in $charts) {
    Write-Host "📊 Checking: $($chart.Name)" -ForegroundColor $ColorInfo
    Write-Host "   Description: $($chart.Description)" -ForegroundColor DarkGray
    Write-Host "   File: infrastructure/kubernetes/platform/argocd/applications/$($chart.File)" -ForegroundColor DarkGray
    
    try {
        # Search for the chart
        $searchResult = helm search repo "$($chart.RepoName)/$($chart.Name)" --output json | ConvertFrom-Json
        
        if ($searchResult -and $searchResult.Count -gt 0) {
            $latestVersion = $searchResult[0].version
            $appVersion = $searchResult[0].app_version
            
            Write-Host "   Current version:  $($chart.CurrentVersion)" -ForegroundColor $ColorInfo
            Write-Host "   Latest version:   $latestVersion" -ForegroundColor $(if ($latestVersion -eq $chart.CurrentVersion) { $ColorSuccess } else { $ColorWarning })
            Write-Host "   App version:      $appVersion" -ForegroundColor DarkGray
            
            # Compare versions
            if ($latestVersion -ne $chart.CurrentVersion) {
                $updates += @{
                    Chart       = $chart.Name
                    Current     = $chart.CurrentVersion
                    Latest      = $latestVersion
                    AppVersion  = $appVersion
                    File        = $chart.File
                    Description = $chart.Description
                }
                Write-Host "   ⚠️  UPDATE AVAILABLE" -ForegroundColor $ColorWarning
            }
            else {
                Write-Host "   ✅ UP TO DATE" -ForegroundColor $ColorSuccess
            }
        }
        else {
            Write-Host "   ❌ Chart not found in repository" -ForegroundColor $ColorError
        }
    }
    catch {
        Write-Host "   ❌ Error checking version: $_" -ForegroundColor $ColorError
    }
    
    Write-Host ""
}

Write-Host "═══════════════════════════════════════════════════════════════════════════════" -ForegroundColor $ColorHeader
Write-Host ""

# Summary
if ($updates.Count -eq 0) {
    Write-Host "✅ ALL CHARTS ARE UP TO DATE!" -ForegroundColor $ColorSuccess
    Write-Host ""
    Write-Host "No action required. All Helm charts are using the latest available versions." -ForegroundColor $ColorSuccess
}
else {
    Write-Host "📋 UPDATES AVAILABLE: $($updates.Count) chart(s)" -ForegroundColor $ColorWarning
    Write-Host ""
    
    foreach ($update in $updates) {
        Write-Host "  📦 $($update.Chart)" -ForegroundColor $ColorInfo
        Write-Host "     Description:     $($update.Description)" -ForegroundColor DarkGray
        Write-Host "     Current:         $($update.Current)" -ForegroundColor $ColorWarning
        Write-Host "     Latest:          $($update.Latest)" -ForegroundColor $ColorSuccess
        Write-Host "     App Version:     $($update.AppVersion)" -ForegroundColor DarkGray
        Write-Host "     File:            infrastructure/kubernetes/platform/helm-values/dev/$($update.File)" -ForegroundColor DarkGray
        Write-Host ""
    }
    
    Write-Host "═══════════════════════════════════════════════════════════════════════════════" -ForegroundColor $ColorHeader
    Write-Host ""
    Write-Host "🔧 TO UPDATE:" -ForegroundColor $ColorInfo
    Write-Host ""
    Write-Host "Option 1 - Manual Update (Recommended for careful review):" -ForegroundColor $ColorInfo
    Write-Host "  1. Edit the YAML file listed above" -ForegroundColor DarkGray
    Write-Host "  2. Update 'targetRevision' to the latest version" -ForegroundColor DarkGray
    Write-Host "  3. Review CHANGELOG/release notes for breaking changes" -ForegroundColor DarkGray
    Write-Host "  4. Test in development before applying to production" -ForegroundColor DarkGray
    Write-Host "  5. Commit and push changes" -ForegroundColor DarkGray
    Write-Host "  6. ArgoCD will automatically sync the new version" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "Option 2 - Check release notes:" -ForegroundColor $ColorInfo
    foreach ($update in $updates) {
        switch ($update.Chart) {
            "keda" {
                Write-Host "  • $($update.Chart): https://github.com/kedacore/charts/releases" -ForegroundColor DarkGray
            }
        }
    }
    Write-Host ""
}

Write-Host "═══════════════════════════════════════════════════════════════════════════════" -ForegroundColor $ColorHeader
Write-Host ""
Write-Host "💡 TIPS:" -ForegroundColor $ColorInfo
Write-Host ""
Write-Host "  • Always review CHANGELOG before updating major versions" -ForegroundColor DarkGray
Write-Host "  • Test updates in development environment first" -ForegroundColor DarkGray
Write-Host "  • ArgoCD will automatically apply updates after git push" -ForegroundColor DarkGray
Write-Host "  • Use 'kubectl get pods -n observability' to verify OTEL DaemonSet" -ForegroundColor DarkGray
Write-Host "  • Use 'kubectl get pods -n keda' for KEDA verification" -ForegroundColor DarkGray
Write-Host ""
Write-Host "🔗 USEFUL COMMANDS:" -ForegroundColor $ColorInfo
Write-Host ""
Write-Host "  # View chart details:" -ForegroundColor DarkGray
Write-Host "  helm show chart <repo>/<chart> --version <version>" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  # View chart values:" -ForegroundColor DarkGray
Write-Host "  helm show values <repo>/<chart> --version <version>" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  # Check ArgoCD application status:" -ForegroundColor DarkGray
Write-Host "  kubectl get applications -n argocd" -ForegroundColor DarkGray
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════════════════════" -ForegroundColor $ColorHeader
Write-Host ""
Write-Host "✅ Version check complete!" -ForegroundColor $ColorSuccess
Write-Host ""
