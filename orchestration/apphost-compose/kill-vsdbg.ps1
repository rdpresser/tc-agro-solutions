#Requires -Version 7
<#
.SYNOPSIS
    Prepare a service container for vsdbg attach.
.DESCRIPTION
    If vsdbg is already running (stale session), kill it and restart the
    container to reset the .NET runtime debug state.
    Works on Linux, macOS, and Windows (PowerShell 7+).
.PARAMETER Service
    The docker compose service name to check.
#>
param(
    [Parameter(Mandatory, Position = 0)]
    [string]$Service
)

$dir = $PSScriptRoot
$project = 'tc-agro-vscode-debug'
$cf = @(
    '-f', "$dir/docker-compose.yml",
    '-f', "$dir/docker-compose.override.yml",
    '-f', "$dir/docker-compose.vs.debug.yml"
)

function Invoke-InContainer {
    param([string]$Command)
    $dockerArgs = @('compose', '--project-name', $project) + $cf +
    @('exec', '-T', '-u', 'root', $Service, 'sh', '-c', $Command)
    & docker @dockerArgs 2>$null
}

$findCmd = 'ps aux | grep "/vsdbg/vsdbg" | grep -v grep | awk "{print $2}" | head -1'
$rawOut = Invoke-InContainer $findCmd
$vsdbgPid = if ($rawOut) { ($rawOut | Select-Object -First 1).Trim() } else { '' }

if ($vsdbgPid -match '^\d+$') {
    Invoke-InContainer "kill -9 $vsdbgPid" | Out-Null
    Write-Host "vsdbg killed (PID $vsdbgPid) in $Service"
    Write-Host "Restarting $Service to reset .NET runtime debug state..."
    $restartArgs = @('compose', '--project-name', $project) + $cf + @('restart', $Service)
    & docker @restartArgs
    Write-Host "Waiting 10s for $Service to start..."
    Start-Sleep -Seconds 10
    Write-Host "$Service ready."
}
else {
    Write-Host "vsdbg not running in $Service — runtime is clean."
}
