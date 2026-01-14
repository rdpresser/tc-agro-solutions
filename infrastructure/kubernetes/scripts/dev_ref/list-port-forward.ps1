<#
.SYNOPSIS
  Lists all active port-forwards and their ports.
.DESCRIPTION
  Shows information about running kubectl port-forward processes,
  including PID, ports, and uptime.
.EXAMPLE
  .\list-port-forward.ps1
#>

Write-Host "`n=== Active Port-Forwards ===" -ForegroundColor Cyan
Write-Host ""

# Find kubectl processes with port-forward
$kubectlProcesses = Get-Process -Name kubectl -ErrorAction SilentlyContinue

if (-not $kubectlProcesses) {
    Write-Host "ℹ️  No active port-forward" -ForegroundColor Yellow
    Write-Host ""
    exit 0
}

$found = $false

foreach ($proc in $kubectlProcesses) {
    try {
        # Try to get the process command line
        $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $($proc.Id)").CommandLine

        # Check if it's a port-forward
        if ($cmdLine -like "*port-forward*") {
            $found = $true

            # Extract information
            $service = "Unknown"
            $port = "Unknown"

            if ($cmdLine -match "svc/([^\s]+)") {
                $service = $matches[1]
            }

            if ($cmdLine -match "(\d+):\d+") {
                $port = $matches[1]
            }

            # Calculate uptime
            $uptime = (Get-Date) - $proc.StartTime
            $uptimeStr = "{0:hh\:mm\:ss}" -f $uptime

            Write-Host "🔗 Active Port-Forward:" -ForegroundColor Green
            Write-Host "   Service: $service" -ForegroundColor White
            Write-Host "   Port:    http://localhost:$port" -ForegroundColor Cyan
            Write-Host "   PID:     $($proc.Id)" -ForegroundColor Gray
            Write-Host "   Started: $($proc.StartTime)" -ForegroundColor Gray
            Write-Host "   Uptime:  $uptimeStr" -ForegroundColor Gray
            Write-Host ""
        }
    } catch {
        # Ignore errors when accessing process information
        continue
    }
}

if (-not $found) {
    Write-Host "ℹ️  No active port-forward" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "💡 Use '.\stop-port-forward.ps1' to stop port-forwards" -ForegroundColor Yellow
Write-Host ""
