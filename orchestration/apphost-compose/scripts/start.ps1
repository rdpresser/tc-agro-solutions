# =====================================================
# TC Agro Solutions - Quick Start Script
# =====================================================

Write-Host "`n==================================================" -ForegroundColor Cyan
Write-Host "  TC Agro Solutions - Docker Compose Startup" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

$scriptPath = Split-Path -Parent $PSScriptRoot
Set-Location $scriptPath

# Check if Docker is running
Write-Host "`n[1/5] Checking Docker status..." -ForegroundColor Yellow
try {
    docker info | Out-Null
    Write-Host "? Docker is running" -ForegroundColor Green
} catch {
    Write-Host "? Docker is not running. Please start Docker Desktop." -ForegroundColor Red
    exit 1
}

# Check if .env file exists
Write-Host "`n[2/6] Checking .env file..." -ForegroundColor Yellow
if (Test-Path ".env") {
    Write-Host "✅ .env file found" -ForegroundColor Green
} else {
    Write-Host "❌ .env file not found at orchestration/apphost-compose/.env" -ForegroundColor Red
    exit 1
}

# Check for port conflicts and cleanup if needed
Write-Host "`n[3/6] Checking for port conflicts..." -ForegroundColor Yellow
$criticalPorts = @(4317, 4318, 5432, 3000, 9090)
$portsInUse = @()

foreach ($port in $criticalPorts) {
    $connection = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | 
                  Where-Object { $_.State -eq "Listen" }
    if ($connection) {
        $portsInUse += $port
    }
}

if ($portsInUse.Count -gt 0) {
    Write-Host "⚠️  Found containers using ports: $($portsInUse -join ', ')" -ForegroundColor Yellow
    Write-Host "   Running cleanup..." -ForegroundColor Yellow
    docker compose down --remove-orphans 2>&1 | Out-Null
    Start-Sleep -Seconds 3
    Write-Host "✅ Cleanup complete" -ForegroundColor Green
} else {
    Write-Host "✅ No port conflicts detected" -ForegroundColor Green
}

# Build images
Write-Host "`n[4/6] Building Docker images..." -ForegroundColor Yellow
docker compose build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}

# Start services
Write-Host "`n[5/6] Starting services..." -ForegroundColor Yellow
docker compose up -d

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to start services!" -ForegroundColor Red
    exit 1
}

# Wait for services to be healthy
Write-Host "`n[6/6] Waiting for services to be healthy..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Check service status
Write-Host "`n==================================================" -ForegroundColor Cyan
Write-Host "  Service Status" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

docker compose ps

Write-Host "`n==================================================" -ForegroundColor Cyan
Write-Host "  Access Points" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

Write-Host "`nInfrastructure:" -ForegroundColor Yellow
Write-Host "  PostgreSQL:    localhost:5432" -ForegroundColor White
Write-Host "  pgAdmin:       http://localhost:15432" -ForegroundColor White
Write-Host "  Redis:         localhost:6379" -ForegroundColor White
Write-Host "  RabbitMQ UI:   http://localhost:15672" -ForegroundColor White

Write-Host "`nServices:" -ForegroundColor Yellow
Write-Host "  Identity API:  http://localhost:5001" -ForegroundColor White
Write-Host "  Health Check:  http://localhost:5001/health" -ForegroundColor White
Write-Host "  Swagger:       http://localhost:5001/swagger" -ForegroundColor White

Write-Host "`nObservability:" -ForegroundColor Yellow
Write-Host "  Grafana:       http://localhost:3000 (admin/admin)" -ForegroundColor White
Write-Host "  Prometheus:    http://localhost:9090" -ForegroundColor White
Write-Host "  Loki:          http://localhost:3100" -ForegroundColor White
Write-Host "  Tempo:         http://localhost:3200" -ForegroundColor White

Write-Host "`n==================================================" -ForegroundColor Cyan
Write-Host "  Useful Commands" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

Write-Host "`nView logs:" -ForegroundColor Yellow
Write-Host "  docker compose logs -f" -ForegroundColor White

Write-Host "`nStop services:" -ForegroundColor Yellow
Write-Host "  docker compose down" -ForegroundColor White

Write-Host "`nRestart service:" -ForegroundColor Yellow
Write-Host "  docker compose restart <service-name>" -ForegroundColor White

Write-Host "`nAccess database:" -ForegroundColor Yellow
Write-Host "  docker compose exec postgres psql -U postgres -d agro" -ForegroundColor White

Write-Host "`n==================================================" -ForegroundColor Green
Write-Host "  Environment is ready! Happy coding! ??" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Write-Host ""
