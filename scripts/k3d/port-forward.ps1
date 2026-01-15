<#
.SYNOPSIS
  Sets up background port-forwards for Kubernetes services.

.DESCRIPTION
  Manages background kubectl port-forward processes for:
  - argocd (8080:80)
  - grafana (3000:80)
  - prometheus (9090:9090)
  - loki (3100:3100)
  - tempo (3200:3100)
  - frontend (3080:80)

.EXAMPLE
  .\port-forward.ps1 argocd
  .\port-forward.ps1 grafana
  .\port-forward.ps1 frontend
  .\port-forward.ps1 all
#>

param(
    [ValidateSet("argocd", "grafana", "prometheus", "loki", "tempo", "frontend", "all")]
    [string]$Service = "grafana"
)

$ErrorActionPreference = "Stop"

$portForwards = @{
    argocd     = @{ namespace = "argocd"; service = "argocd-server"; localPort = 8080; remotePort = 80 }
    grafana    = @{ namespace = "monitoring"; service = "kube-prom-stack-grafana"; localPort = 3000; remotePort = 80 }
    prometheus = @{ namespace = "monitoring"; service = "kube-prom-stack-kube-prome-prometheus"; localPort = 9090; remotePort = 9090 }
    loki       = @{ namespace = "monitoring"; service = "loki"; localPort = 3100; remotePort = 3100 }
    tempo      = @{ namespace = "monitoring"; service = "tempo"; localPort = 3200; remotePort = 3100 }
    frontend   = @{ namespace = "agro-apps"; service = "frontend"; localPort = 3080; remotePort = 80 }
}

$Color = @{
    Title   = "Cyan"
    Success = "Green"
    Warning = "Yellow"
    Error   = "Red"
    Info    = "White"
    Muted   = "Gray"
}

function Write-Title {
    param([string]$Text)
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor $Color.Title
    Write-Host "║  $Text" -ForegroundColor $Color.Title
    Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor $Color.Title
}

Write-Title "Setting up Port-Forwards"

$servicesToForward = if ($Service -eq "all") { $portForwards.Keys } else { @($Service) }

foreach ($svc in $servicesToForward) {
    $pf = $portForwards[$svc]
    $ns = $pf.namespace
    $name = $pf.service
    $local = $pf.localPort
    $remote = $pf.remotePort
    
    Write-Host ""
    Write-Host "🔗 $svc ($local → $remote)" -ForegroundColor $Color.Info
    
    # Check if service exists
    $svcExists = kubectl get svc $name -n $ns -o jsonpath="{.metadata.name}" 2>$null
    if (-not $svcExists) {
        Write-Host "   ⚠️  Service not found: $name in $ns" -ForegroundColor $Color.Warning
        continue
    }
    
    Write-Host "   Starting kubectl port-forward (background)..." -ForegroundColor $Color.Muted
    
    # Kill existing port-forward if any
    Get-Process kubectl -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*port-forward*$local*" } | Stop-Process -Force -ErrorAction SilentlyContinue
    
    # Start new port-forward
    $pf = Start-Process -FilePath kubectl `
        -ArgumentList "port-forward svc/$name -n $ns $local`:$remote --address 127.0.0.1" `
        -WindowStyle Hidden `
        -PassThru
    
    Start-Sleep -Seconds 2
    
    Write-Host "   ✅ Port-forward started (PID: $($pf.Id))" -ForegroundColor $Color.Success
    Write-Host "   Access: http://localhost:$local" -ForegroundColor $Color.Success
}

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor $Color.Success
Write-Host "║  ✅ Port-forwards ready!                                  ║" -ForegroundColor $Color.Success
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor $Color.Success
Write-Host ""
Write-Host "📌 Access Points:" -ForegroundColor $Color.Info
foreach ($svc in $servicesToForward) {
    if ($portForwards.ContainsKey($svc)) {
        $pf = $portForwards[$svc]
        Write-Host "   • http://localhost:$($pf.localPort)" -ForegroundColor $Color.Info
    }
}
Write-Host ""
Write-Host "💡 Stop port-forwards: .\stop-port-forward.ps1" -ForegroundColor $Color.Info
Write-Host ""
