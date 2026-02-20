<#
.SYNOPSIS
  Stop port-forward processes.

.DESCRIPTION
  Kills kubectl port-forward processes by service name or all.

.EXAMPLE
    .\stop-port-forward.ps1 argocd
    .\stop-port-forward.ps1 all
#>

param(
    [ValidateSet("argocd", "frontend", "identity", "analytics-worker", "all")]
    [string]$Service = "all"
)

$Color = @{
    Success = "Green"
    Info    = "Cyan"
    Muted   = "Gray"
}

Write-Host ""
Write-Host "=== Stopping Port-Forwards ===" -ForegroundColor $Color.Info

if ($Service -eq "all") {
    $processes = Get-Process kubectl -ErrorAction SilentlyContinue | 
    Where-Object { $_.CommandLine -like "*port-forward*" }
    
    if ($processes) {
        $processes | Stop-Process -Force
        Write-Host "✅ All port-forwards stopped" -ForegroundColor $Color.Success
    }
    else {
        Write-Host "   No port-forwards running" -ForegroundColor $Color.Muted
    }
}
else {
    $ports = @{
        argocd           = 8090
        frontend         = 3080
        identity         = 5001
        "analytics-worker" = 5004
    }
    
    $port = $ports[$Service]
    $processes = Get-Process kubectl -ErrorAction SilentlyContinue | 
    Where-Object { $_.CommandLine -like "*port-forward*$port*" }
    
    if ($processes) {
        $processes | Stop-Process -Force
        Write-Host "✅ Port-forward for $Service stopped" -ForegroundColor $Color.Success
    }
    else {
        Write-Host "   No port-forward running for $Service" -ForegroundColor $Color.Muted
    }
}

Write-Host ""
