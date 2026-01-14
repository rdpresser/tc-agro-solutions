<#
.SYNOPSIS
  Bootstraps ArgoCD with application manifests.

.DESCRIPTION
  Validates cluster and ArgoCD readiness, then applies ArgoCD app manifests.

.EXAMPLE
  .\bootstrap-argocd-apps.ps1
#>

$ErrorActionPreference = "Stop"

$clusterName = "dev"
$manifestsPath = Join-Path (Split-Path $PSScriptRoot -Parent) "manifests"
$Color = @{
    Title   = "Cyan"
    Success = "Green"
    Warning = "Yellow"
    Error   = "Red"
    Info    = "White"
}

function Write-Title {
    param([string]$Text)
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor $Color.Title
    Write-Host "║  $Text" -ForegroundColor $Color.Title
    Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor $Color.Title
}

Write-Title "Validating Cluster"
try {
    kubectl cluster-info 2>$null | Out-Null
    Write-Host "✅ Cluster is accessible" -ForegroundColor $Color.Success
}
catch {
    Write-Host "❌ Cluster is not accessible" -ForegroundColor $Color.Error
    exit 1
}

Write-Title "Validating ArgoCD"
$argocdNs = kubectl get namespace argocd -o jsonpath="{.metadata.name}" 2>$null
if (-not $argocdNs) {
    Write-Host "❌ ArgoCD namespace does not exist" -ForegroundColor $Color.Error
    exit 1
}
Write-Host "✅ ArgoCD namespace exists" -ForegroundColor $Color.Success

Write-Title "Applying ArgoCD Applications"
if (-not (Test-Path $manifestsPath)) {
    Write-Host "⚠️  Manifests path does not exist: $manifestsPath" -ForegroundColor $Color.Warning
    Write-Host "   Expecting ArgoCD Application manifests in: infrastructure/kubernetes/manifests/" -ForegroundColor $Color.Muted
    Write-Host ""
    Write-Host "   Placeholder: Create your ArgoCD Application manifests here" -ForegroundColor $Color.Info
    Write-Host "   Example: $manifestsPath\argocd-apps.yaml" -ForegroundColor $Color.Muted
    exit 0
}

$manifestFiles = @(Get-ChildItem -Path $manifestsPath -Filter "*app*.yaml" -ErrorAction SilentlyContinue)
if ($manifestFiles.Count -eq 0) {
    Write-Host "⚠️  No ArgoCD app manifests found in $manifestsPath" -ForegroundColor $Color.Warning
    Write-Host "   Expected: *app*.yaml files" -ForegroundColor $Color.Muted
    exit 0
}

foreach ($file in $manifestFiles) {
    Write-Host "   Applying: $($file.Name)" -ForegroundColor $Color.Muted
    kubectl apply -f $file.FullName 2>$null
}

Write-Host "✅ ArgoCD applications applied" -ForegroundColor $Color.Success

Write-Title "Checking ArgoCD Application Status"
Start-Sleep -Seconds 3
kubectl get applications -A 2>$null || Write-Host "   (No applications found yet)" -ForegroundColor $Color.Muted

Write-Host ""
Write-Host "✅ Bootstrap complete!" -ForegroundColor $Color.Success
Write-Host ""
