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

$ExpectedContext = "k3d-dev"

function Show-Section {
  param(
    [string]$Title,
    [string]$Command
  )

  Write-Host ""  # spacer
  Write-Host $Title -ForegroundColor $Color.Info

  $output = Invoke-Expression $Command 2>&1

  if (-not $output) {
    Write-Host "   (empty or command returned nothing)" -ForegroundColor $Color.Warning
  }
  else {
    $output | ForEach-Object { Write-Host "   $_" }
  }
}

function Ensure-Context {
  Write-Host "🔌 Checking kubectl context..." -ForegroundColor $Color.Info

  $current = kubectl config current-context 2>$null
  if (-not $current) {
    Write-Host "❌ No current context set in kubeconfig" -ForegroundColor $Color.Error
    Write-Host "   Run: kubectl config use-context $ExpectedContext" -ForegroundColor $Color.Warning
    exit 1
  }

  if ($current -eq $ExpectedContext) {
    Write-Host "✅ Using context: $current" -ForegroundColor $Color.Success
    return
  }

  $contexts = kubectl config get-contexts -o name 2>$null
  if ($contexts -and ($contexts -contains $ExpectedContext)) {
    Write-Host "ℹ️  Switching context to $ExpectedContext" -ForegroundColor $Color.Info
    kubectl config use-context $ExpectedContext 2>&1 | Out-Null
    Write-Host "✅ Now using context: $ExpectedContext" -ForegroundColor $Color.Success
  }
  else {
    Write-Host "❌ Expected context '$ExpectedContext' not found in kubeconfig" -ForegroundColor $Color.Error
    Write-Host "   Available: $($contexts -join ', ')
    " -ForegroundColor $Color.Muted
    exit 1
  }
}

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor $Color.Title
Write-Host "║                    CLUSTER STATUS                          ║" -ForegroundColor $Color.Title
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor $Color.Title
Write-Host ""

Ensure-Context

Show-Section "📊 Nodes:" "kubectl get nodes -o wide"
Show-Section "📁 Namespaces:" "kubectl get namespaces"
Show-Section "🔧 Core Services:" "kubectl get svc -A | Select-String -Pattern '(argocd|grafana|prometheus|loki|tempo|ingress-nginx|keda)'"
Show-Section "📦 ArgoCD Applications:" "kubectl get applications -n argocd"
Show-Section "📦 Deployments (monitoring):" "kubectl get deployments -n monitoring"
Show-Section "📦 StatefulSets (monitoring):" "kubectl get statefulsets -n monitoring"
