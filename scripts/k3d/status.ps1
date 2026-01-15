<#
.SYNOPSIS
  Display k3d cluster status.

.DESCRIPTION
  Shows nodes, namespaces, core services, and ArgoCD applications status.

.EXAMPLE
  .\status.ps1
#>

$Color = @{
    Success = "Green"
    Error   = "Red"
    Warning = "Yellow"
    Info    = "Cyan"
    Title   = "Green"
    Muted   = "Gray"
}

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
kubectl get svc -A 2>$null | Select-String -Pattern "(argocd|grafana|prometheus|loki|tempo|ingress-nginx|keda)"

Write-Host ""
Write-Host "📦 ArgoCD Applications:" -ForegroundColor $Color.Info
kubectl get applications -n argocd 2>$null

Write-Host ""
Write-Host "📦 Deployments (monitoring):" -ForegroundColor $Color.Info
kubectl get deployments -n monitoring 2>$null

Write-Host ""
Write-Host "📦 StatefulSets (monitoring):" -ForegroundColor $Color.Info
kubectl get statefulsets -n monitoring 2>$null

Write-Host ""
