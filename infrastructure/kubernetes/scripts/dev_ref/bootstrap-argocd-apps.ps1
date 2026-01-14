<#
.SYNOPSIS
  Bootstrap ArgoCD Applications for CloudGames.

.DESCRIPTION
  Applies the ArgoCD application bootstrap manifest to deploy all applications
  via GitOps. Supports different environments (dev, prod) through overlays.

.PARAMETER Environment
  Target environment: dev (default) or prod.

.PARAMETER DryRun
  Show what would be applied without actually applying.

.PARAMETER Wait
  Wait for applications to sync after applying.

.EXAMPLE
  .\bootstrap-argocd-apps.ps1
  # Bootstraps applications for dev environment

.EXAMPLE
  .\bootstrap-argocd-apps.ps1 -Environment prod
  # Bootstraps applications for prod environment

.EXAMPLE
  .\bootstrap-argocd-apps.ps1 -DryRun
  # Shows what would be applied
#>

[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet("dev", "prod")]
    [string]$Environment = "dev",

    [Parameter()]
    [switch]$DryRun,

    [Parameter()]
    [switch]$Wait
)

$script:Colors = @{
    Title   = "Cyan"
    Success = "Green"
    Warning = "Yellow"
    Error   = "Red"
    Info    = "White"
    Muted   = "Gray"
}

function Show-Header {
    Write-Host ""
    Write-Host "========================================================" -ForegroundColor $Colors.Title
    Write-Host "          ArgoCD Application Bootstrap                  " -ForegroundColor $Colors.Title
    Write-Host "========================================================" -ForegroundColor $Colors.Title
    Write-Host ""
}

Show-Header

Write-Host "=== 1) Checking prerequisites ===" -ForegroundColor $Colors.Title

try {
    kubectl cluster-info 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Cluster not accessible" }
    Write-Host "[OK] Kubernetes cluster accessible" -ForegroundColor $Colors.Success
} catch {
    Write-Host "[ERROR] Kubernetes cluster not accessible." -ForegroundColor $Colors.Error
    Write-Host "   Make sure the cluster is running: .\k3d-manager.ps1 start" -ForegroundColor $Colors.Muted
    exit 1
}

$argoNs = kubectl get namespace argocd 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] ArgoCD namespace not found." -ForegroundColor $Colors.Error
    Write-Host "   Run: .\k3d-manager.ps1 create" -ForegroundColor $Colors.Muted
    exit 1
}
Write-Host "[OK] ArgoCD namespace exists" -ForegroundColor $Colors.Success

$esoReady = kubectl get clustersecretstores azure-keyvault 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "[WARNING] External Secrets not configured." -ForegroundColor $Colors.Warning
    Write-Host "   Applications may fail if secrets are not available." -ForegroundColor $Colors.Muted
    Write-Host "   Run: .\k3d-manager.ps1 external-secrets" -ForegroundColor $Colors.Muted
    Write-Host ""
    $continue = Read-Host "Continue anyway? (y/N)"
    if ($continue -ne "y" -and $continue -ne "Y") {
        Write-Host "Aborted." -ForegroundColor $Colors.Warning
        exit 0
    }
} else {
    Write-Host "[OK] External Secrets configured" -ForegroundColor $Colors.Success
}

Write-Host ""
Write-Host "=== 2) Applying ArgoCD Bootstrap ===" -ForegroundColor $Colors.Title
Write-Host "   Environment: $Environment" -ForegroundColor $Colors.Info

$manifestPath = Join-Path $PSScriptRoot "..\manifests\application-bootstrap.yaml"
if (-not (Test-Path $manifestPath)) {
    Write-Host "[ERROR] Bootstrap manifest not found at:" -ForegroundColor $Colors.Error
    Write-Host "   $manifestPath" -ForegroundColor $Colors.Muted
    exit 1
}

Write-Host "   Manifest: $manifestPath" -ForegroundColor $Colors.Muted

if ($DryRun) {
    Write-Host ""
    Write-Host "[DRY RUN] Would apply:" -ForegroundColor $Colors.Warning
    kubectl apply -f $manifestPath --dry-run=client
} else {
    kubectl apply -f $manifestPath
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Failed to apply bootstrap manifest." -ForegroundColor $Colors.Error
        exit 1
    }
    Write-Host "[OK] Bootstrap manifest applied successfully" -ForegroundColor $Colors.Success
}

if ($Wait -and -not $DryRun) {
    Write-Host ""
    Write-Host "=== 3) Waiting for applications to sync ===" -ForegroundColor $Colors.Title
    Write-Host "Waiting for ArgoCD to sync applications..." -ForegroundColor $Colors.Muted

    for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Seconds 5
        $apps = kubectl get applications -n argocd -o json 2>$null | ConvertFrom-Json
        if ($apps -and $apps.items) {
            $synced = ($apps.items | Where-Object { $_.status.sync.status -eq "Synced" }).Count
            $total = $apps.items.Count
            Write-Host "   Synced: $synced / $total" -ForegroundColor $Colors.Info
            if ($synced -eq $total -and $total -gt 0) {
                Write-Host "[OK] All applications synced!" -ForegroundColor $Colors.Success
                break
            }
        }
    }
}

Write-Host ""
Write-Host "=== ArgoCD Applications Status ===" -ForegroundColor $Colors.Title
kubectl get applications -n argocd 2>$null

Write-Host ""
Write-Host "Access ArgoCD UI:" -ForegroundColor $Colors.Title
Write-Host "   URL: http://argocd.local" -ForegroundColor $Colors.Info
Write-Host "   User: admin" -ForegroundColor $Colors.Muted
Write-Host "   Pass: Argo@123" -ForegroundColor $Colors.Muted
Write-Host ""
Write-Host "Note: Requires hosts file entry (run once as Admin):" -ForegroundColor $Colors.Muted
Write-Host "   .\k3d-manager.ps1 update-hosts" -ForegroundColor $Colors.Muted
Write-Host ""
