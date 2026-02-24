<#
.SYNOPSIS
  Restart k3d cluster by orchestrating stop + start scripts.

.DESCRIPTION
  Consolidates lifecycle logic to avoid duplication:
  1. Executes stop-cluster.ps1
  2. Executes start-cluster.ps1

  This keeps all start/stop behavior in a single place.

.EXAMPLE
  .\restart-cluster.ps1
#>

$Color = @{
    Success = "Green"
    Error   = "Red"
    Info    = "Cyan"
    Muted   = "Gray"
    Warning = "Yellow"
}

function Invoke-ChildScript {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ScriptName,

        [string[]]$Arguments = @()
    )

    $scriptPath = Join-Path $PSScriptRoot $ScriptName
    if (-not (Test-Path $scriptPath)) {
        Write-Host "❌ Script not found: $scriptPath" -ForegroundColor $Color.Error
        return @{ Success = $false; ExitCode = 1 }
    }

    $hostExecutable = (Get-Process -Id $PID).Path
    if (-not (Test-Path $hostExecutable)) {
        Write-Host "❌ Could not determine current PowerShell executable" -ForegroundColor $Color.Error
        return @{ Success = $false; ExitCode = 1 }
    }

    & $hostExecutable -NoProfile -ExecutionPolicy Bypass -File $scriptPath @Arguments
    $exitCode = $LASTEXITCODE

    if ($null -eq $exitCode) {
        $exitCode = 0
    }

    return @{ Success = ($exitCode -eq 0); ExitCode = $exitCode }
}

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor $Color.Info
Write-Host "║          K3D CLUSTER RESTART                              ║" -ForegroundColor $Color.Info
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor $Color.Info

Write-Host ""
Write-Host "=== Step 1/2: Stopping cluster ===" -ForegroundColor $Color.Info
$stopResult = Invoke-ChildScript -ScriptName "stop-cluster.ps1"
if (-not $stopResult.Success) {
    Write-Host "❌ Restart aborted: stop-cluster.ps1 failed (exit code: $($stopResult.ExitCode))" -ForegroundColor $Color.Error
    exit $stopResult.ExitCode
}

Write-Host ""
Write-Host "=== Step 2/2: Starting cluster ===" -ForegroundColor $Color.Info
$startResult = Invoke-ChildScript -ScriptName "start-cluster.ps1"
if (-not $startResult.Success) {
    Write-Host "❌ Restart failed: start-cluster.ps1 failed (exit code: $($startResult.ExitCode))" -ForegroundColor $Color.Error
    exit $startResult.ExitCode
}

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor $Color.Success
Write-Host "║          ✅ CLUSTER RESTART COMPLETE                      ║" -ForegroundColor $Color.Success
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor $Color.Success
Write-Host ""
