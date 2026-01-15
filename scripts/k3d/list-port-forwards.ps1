<#
.SYNOPSIS
  Lists all active port-forwards and their ports.

.DESCRIPTION
  Shows information about running kubectl port-forward processes,
  including PID, ports, and uptime.

.EXAMPLE
  .\list-port-forwards.ps1
#>

$ErrorActionPreference = "Continue"

$Color = @{
    Success = "Green"
    Warning = "Yellow"
    Info    = "Cyan"
    Muted   = "Gray"
}

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor $Color.Info
Write-Host "║  Active Port-Forwards                                     ║" -ForegroundColor $Color.Info
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor $Color.Info
Write-Host ""

# Find kubectl processes with port-forward
$kubectlProcesses = Get-Process -Name kubectl -ErrorAction SilentlyContinue

if (-not $kubectlProcesses) {
    Write-Host "ℹ️  No active port-forwards" -ForegroundColor $Color.Warning
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
            $namespace = "Unknown"

            if ($cmdLine -match "svc/([^\s]+)") {
                $service = $matches[1]
            }

            if ($cmdLine -match "-n\s+([^\s]+)") {
                $namespace = $matches[1]
            }

            if ($cmdLine -match "(\d+):\d+") {
                $port = $matches[1]
            }

            # Calculate uptime
            $uptime = (Get-Date) - $proc.StartTime
            $uptimeStr = "{0:hh\:mm\:ss}" -f $uptime

            Write-Host "🔗 Port-Forward:" -ForegroundColor $Color.Success
            Write-Host "   Service:   $service" -ForegroundColor White
            Write-Host "   Namespace: $namespace" -ForegroundColor $Color.Muted
            Write-Host "   URL:       http://localhost:$port" -ForegroundColor $Color.Info
            Write-Host "   PID:       $($proc.Id)" -ForegroundColor $Color.Muted
            Write-Host "   Started:   $($proc.StartTime.ToString('HH:mm:ss'))" -ForegroundColor $Color.Muted
            Write-Host "   Uptime:    $uptimeStr" -ForegroundColor $Color.Muted
            Write-Host ""
        }
    } catch {
        # Ignore errors when accessing process information
        continue
    }
}

if (-not $found) {
    Write-Host "ℹ️  No active port-forwards" -ForegroundColor $Color.Warning
    Write-Host ""
}

Write-Host "💡 Tip: Use '.\stop-port-forward.ps1' to stop port-forwards" -ForegroundColor $Color.Info
Write-Host ""
