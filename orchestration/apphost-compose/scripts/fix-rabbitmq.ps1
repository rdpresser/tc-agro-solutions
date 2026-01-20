# =====================================================
# TC Agro Solutions - RabbitMQ Troubleshooting
# =====================================================
# Purpose: Fix RabbitMQ "unhealthy" status
# Usage: .\scripts\fix-rabbitmq.ps1
# =====================================================

Write-Host "`n==================================================" -ForegroundColor Cyan
Write-Host "  RabbitMQ Health Check Fix" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

$scriptPath = $PSScriptRoot
$rootPath = Split-Path $scriptPath -Parent
Set-Location $rootPath

# =====================================================
# 1. Check RabbitMQ container status
# =====================================================
Write-Host "`n[1/5] Checking RabbitMQ status..." -ForegroundColor Yellow
$rabbitContainer = docker compose ps -q rabbitmq 2>&1

if (-not $rabbitContainer -or $rabbitContainer -eq "") {
    Write-Host "✗ RabbitMQ container is NOT running!" -ForegroundColor Red
    Write-Host "  Starting RabbitMQ..." -ForegroundColor Yellow
    docker compose up -d rabbitmq
    Start-Sleep -Seconds 5
    $rabbitContainer = docker compose ps -q rabbitmq
}

if ($rabbitContainer -and $rabbitContainer -ne "") {
    Write-Host "✓ RabbitMQ container is running (ID: $($rabbitContainer.Substring(0, 12)))" -ForegroundColor Green
}
else {
    Write-Host "✗ Failed to start RabbitMQ!" -ForegroundColor Red
    Write-Host "  Try: docker compose logs rabbitmq" -ForegroundColor Yellow
    exit 1
}

# =====================================================
# 2. Check health status
# =====================================================
Write-Host "`n[2/5] Checking health status..." -ForegroundColor Yellow
$health = docker inspect -f '{{.State.Health.Status}}' $rabbitContainer 2>&1
Write-Host "  Current status: $health" -ForegroundColor Gray

# =====================================================
# 3. Test RabbitMQ connectivity
# =====================================================
Write-Host "`n[3/5] Testing RabbitMQ connectivity..." -ForegroundColor Yellow
try {
    $diagOutput = docker exec $rabbitContainer rabbitmq-diagnostics -q ping 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ RabbitMQ responds to ping" -ForegroundColor Green
    }
    else {
        Write-Host "⚠ RabbitMQ ping failed, attempting restart..." -ForegroundColor Yellow
        docker compose restart rabbitmq
        Start-Sleep -Seconds 10
    }
}
catch {
    Write-Host "⚠ Diagnostics test failed: $_" -ForegroundColor Yellow
}

# =====================================================
# 4. Check RabbitMQ status
# =====================================================
Write-Host "`n[4/5] Checking RabbitMQ service status..." -ForegroundColor Yellow
try {
    $status = docker exec $rabbitContainer rabbitmq-diagnostics status 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ RabbitMQ service is healthy" -ForegroundColor Green
        Write-Host "  $(($status | Select-Object -First 3) -join ' / ')" -ForegroundColor Gray
    }
    else {
        Write-Host "⚠ RabbitMQ service status check returned errors" -ForegroundColor Yellow
        Write-Host "  Logs:" -ForegroundColor Gray
        docker compose logs --tail=20 rabbitmq
    }
}
catch {
    Write-Host "⚠ Status check failed" -ForegroundColor Yellow
}

# =====================================================
# 5. Wait for health
# =====================================================
Write-Host "`n[5/5] Waiting for RabbitMQ to become healthy..." -ForegroundColor Yellow
$maxWait = 0
$healthyWait = $false

while ($maxWait -lt 120) {
    $currentHealth = docker inspect -f '{{.State.Health.Status}}' $rabbitContainer 2>&1
    
    if ($currentHealth -eq "healthy") {
        Write-Host "✓ RabbitMQ is now HEALTHY!" -ForegroundColor Green
        $healthyWait = $true
        break
    }
    elseif ($currentHealth -eq "unhealthy") {
        Write-Host "." -NoNewline -ForegroundColor Yellow
    }
    else {
        Write-Host "." -NoNewline -ForegroundColor Gray
    }
    
    Start-Sleep -Seconds 2
    $maxWait += 2
}

if (-not $healthyWait) {
    Write-Host "`n⚠ RabbitMQ did not become healthy after 120 seconds" -ForegroundColor Yellow
    Write-Host "  This might be normal on first startup (30-60 seconds)" -ForegroundColor Gray
    Write-Host "  Checking logs..." -ForegroundColor Gray
    docker compose logs --tail=50 rabbitmq
}

# =====================================================
# Summary
# =====================================================
Write-Host "`n==================================================" -ForegroundColor Cyan
Write-Host "  RabbitMQ Status" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

$finalHealth = docker inspect -f '{{.State.Health.Status}}' $rabbitContainer 2>&1
Write-Host "`nFinal Status: $finalHealth" -ForegroundColor $(if ($finalHealth -eq "healthy") { "Green" } else { "Yellow" })

Write-Host "`nAccess Management UI:" -ForegroundColor Yellow
Write-Host "  URL: http://localhost:15672" -ForegroundColor Cyan
Write-Host "  User: guest" -ForegroundColor Gray
Write-Host "  Pass: guest" -ForegroundColor Gray

Write-Host "`nIf still having issues:" -ForegroundColor Yellow
Write-Host "  1. View logs: docker compose logs -f rabbitmq" -ForegroundColor Cyan
Write-Host "  2. Restart:   docker compose restart rabbitmq" -ForegroundColor Cyan
Write-Host "  3. Full reset: .\cleanup.ps1 && .\start.ps1" -ForegroundColor Cyan
Write-Host "`n"
