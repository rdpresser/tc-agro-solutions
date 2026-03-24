#Requires -Version 7
<#
.SYNOPSIS
    Build diagnostic: builds each service individually in sequence.
    Stops and reports clearly on first failure.
    Works on Linux, macOS, and Windows (PowerShell 7+).
#>

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

$services = @(
    'tc-agro-frontend-service',
    'tc-agro-identity-service',
    'tc-agro-farm-service',
    'tc-agro-analytics-worker',
    'tc-agro-sensor-ingest-service'   # historically the suspicious one
)

Write-Host '===== BUILD DIAGNOSTIC: Testing each service individually ====='

foreach ($svc in $services) {
    Write-Host ''
    Write-Host "Testing $svc..."
    & docker @baseArgs $svc
    if ($LASTEXITCODE -ne 0) {
        Write-Host ''
        Write-Host "===== BUILD FAILED: $svc (exit $LASTEXITCODE) =====" -ForegroundColor Red
        exit $LASTEXITCODE
    }
}

Write-Host ''
Write-Host '===== ALL BUILDS COMPLETED =====' -ForegroundColor Green
