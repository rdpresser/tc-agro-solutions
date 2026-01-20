# =====================================================
# TC Agro Solutions - Cleanup Script
# =====================================================

Write-Host "`n==================================================" -ForegroundColor Cyan
Write-Host "  TC Agro Solutions - Docker Cleanup" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

$scriptPath = Split-Path -Parent $PSScriptRoot
Set-Location $scriptPath

# Ask for confirmation
Write-Host "`nThis will stop and remove all containers, networks, and volumes." -ForegroundColor Yellow
$confirmation = Read-Host "Are you sure? (yes/no)"

if ($confirmation -ne "yes") {
    Write-Host "`nCleanup cancelled." -ForegroundColor Yellow
    exit 0
}

# Stop and remove containers, networks
Write-Host "`n[1/2] Stopping and removing containers..." -ForegroundColor Yellow
docker compose down

# Remove volumes
Write-Host "`n[2/2] Removing volumes..." -ForegroundColor Yellow
docker compose down -v

Write-Host "`n==================================================" -ForegroundColor Green
Write-Host "  Cleanup complete!" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green

Write-Host "`nTo start fresh, run: .\scripts\start.ps1" -ForegroundColor Cyan
Write-Host ""
