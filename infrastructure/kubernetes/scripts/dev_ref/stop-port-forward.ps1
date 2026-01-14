<#
.SYNOPSIS
  Stops active kubectl port-forwards.
.DESCRIPTION
  Identifies and terminates running kubectl port-forward processes.
  Allows termination by service name or specific PID.

  Note: ArgoCD no longer needs port-forward - access via http://argocd.local

.PARAMETER Service
  Optional: Specifies which service to stop (grafana or all). Default: all.

.PARAMETER Id
  Optional: Specific PID to kill (useful for stuck/zombie processes).

.EXAMPLE
  .\stop-port-forward.ps1
  .\stop-port-forward.ps1 grafana
  .\stop-port-forward.ps1 -Id 12345
#>

[CmdletBinding(DefaultParameterSetName="ByService")]
param(
    [Parameter(ParameterSetName="ByService", Position = 0)]
    [ValidateSet("grafana", "all")]
    [string]$Service = "all",

    [Parameter(ParameterSetName="ById", Mandatory=$true)]
    [int]$Id
)

Write-Host "`n=== Stopping Port-Forwards ===" -ForegroundColor Cyan

if ($PSCmdlet.ParameterSetName -eq "ById") {
    try {
        $proc = Get-Process -Id $Id -ErrorAction Stop
        Write-Host "🛑 Stopping process PID: $($proc.Id) ($($proc.ProcessName))..." -ForegroundColor Yellow
        Stop-Process -Id $proc.Id -Force
        Write-Host "✅ Process terminated successfully." -ForegroundColor Green
    } catch {
        Write-Host "❌ Error stopping PID ${Id}: $_" -ForegroundColor Red
    }
    exit
}

# Find kubectl processes with port-forward
$kubectlProcesses = Get-Process -Name kubectl -ErrorAction SilentlyContinue

if (-not $kubectlProcesses) {
    Write-Host "✅ No active port-forward found" -ForegroundColor Green
    exit 0
}

$stopped = 0

foreach ($proc in $kubectlProcesses) {
    try {
        # Try to get the process command line
        $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $($proc.Id)").CommandLine

        # Check if it's a port-forward
        if ($cmdLine -like "*port-forward*") {
            $shouldStop = $false

            switch ($Service) {
                "grafana" {
                    if ($cmdLine -like "*grafana*") {
                        $shouldStop = $true
                    }
                }
                "all" {
                    $shouldStop = $true
                }
            }

            if ($shouldStop) {
                Write-Host "🛑 Stopping port-forward (PID: $($proc.Id))..." -ForegroundColor Yellow
                Stop-Process -Id $proc.Id -Force
                $stopped++
            }
        }
    } catch {
        # Ignore errors when accessing process information
        continue
    }
}

if ($stopped -gt 0) {
    Write-Host "✅ $stopped port-forward(s) stopped" -ForegroundColor Green
} else {
    Write-Host "ℹ️  No matching port-forward found" -ForegroundColor Cyan
}

Write-Host ""
