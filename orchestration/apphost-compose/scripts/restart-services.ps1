# =====================================================
# TC Agro Solutions - Restart Services
# =====================================================
# Purpose: Gracefully restart services without cleanup
# Usage: .\scripts\restart-services.ps1
# =====================================================

Write-Host "`n==================================================" -ForegroundColor Cyan
Write-Host "  TC Agro Solutions - Service Restart" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

$scriptPath = $PSScriptRoot
$rootPath = Split-Path $scriptPath -Parent
Set-Location $rootPath

# Optional: specify which services to restart
$servicesToRestart = $args[0]

if ($servicesToRestart) {
    Write-Host "`nRestarting service: $servicesToRestart" -ForegroundColor Yellow
    docker compose restart $servicesToRestart
}
else {
    Write-Host "`nRestarting ALL services..." -ForegroundColor Yellow
    docker compose restart
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n✗ Failed to restart services!" -ForegroundColor Red
    exit 1
}

Write-Host "`nWaiting for services to stabilize..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Show status
Write-Host "`n==================================================" -ForegroundColor Green
Write-Host "  Service Status After Restart" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green

docker compose ps

Write-Host "`n✓ Services restarted successfully!" -ForegroundColor Green
Write-Host ""
