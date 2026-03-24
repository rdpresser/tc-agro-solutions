#Requires -Version 7
<#
.SYNOPSIS
    Build one or all Docker Compose services with verbose --progress=plain output.
    Works on Linux, macOS, and Windows (PowerShell 7+).
.PARAMETER Service
    The compose service name to build. Omit to build all services.
.PARAMETER LogFile
    Optional log file name (created alongside this script). Omit for terminal output only.
.EXAMPLE
    .\build-verbose.ps1
    .\build-verbose.ps1 tc-agro-sensor-ingest-service build-sensor-ingest.log
#>
param(
    [Parameter(Position = 0)]
    [string]$Service = '',

    [Parameter(Position = 1)]
    [string]$LogFile = ''
)

if ($IsLinux -or $IsMacOS) {
    $env:APPDATA = "$env:HOME/.config"
}
$env:COMPOSE_PARALLEL_LIMIT = '1'

$dir = $PSScriptRoot
$baseArgs = @(
    'compose',
    '--project-name', 'tc-agro-local',
    '--progress=plain',
    '-f', "$dir/docker-compose.yml",
    '-f', "$dir/docker-compose.override.yml",
    'build'
)

if ($Service) { $baseArgs += $Service }

if ($LogFile) {
    $logPath = "$dir/$LogFile"
    Write-Host "==> Logging to: $logPath"
    & docker @baseArgs 2>&1 | Tee-Object -FilePath $logPath
}
else {
    & docker @baseArgs 2>&1
}

exit $LASTEXITCODE
