# =====================================================
# TC Agro Solutions - Docker Compose Diagnostics
# =====================================================
# Purpose: Diagnose Docker Compose health issues
# Usage: .\scripts\diagnose.ps1
# =====================================================

Write-Host "`n==================================================" -ForegroundColor Cyan
Write-Host "  TC Agro Solutions - Docker Diagnostics" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

$scriptPath = $PSScriptRoot
$rootPath = Split-Path $scriptPath -Parent
Set-Location $rootPath

# =====================================================
# 1. Check Docker Status
# =====================================================
Write-Host "`n[1/8] Checking Docker..." -ForegroundColor Yellow
try {
    $dockerVersion = docker --version
    Write-Host "✓ Docker is running" -ForegroundColor Green
    Write-Host "  $dockerVersion" -ForegroundColor Gray
}
catch {
    Write-Host "✗ Docker is NOT running!" -ForegroundColor Red
    Write-Host "  Please start Docker Desktop" -ForegroundColor Yellow
    exit 1
}

# =====================================================
# 2. Check .env file
# =====================================================
Write-Host "`n[2/8] Checking .env file..." -ForegroundColor Yellow
if (Test-Path ".env") {
    Write-Host "✓ .env file found" -ForegroundColor Green
    $envLines = (Get-Content ".env" | Measure-Object -Line).Lines
    Write-Host "  $envLines configuration lines" -ForegroundColor Gray
}
else {
    Write-Host "✗ .env file NOT found!" -ForegroundColor Red
    Write-Host "  Expected at: $rootPath/.env" -ForegroundColor Yellow
    exit 1
}

# =====================================================
# 3. Check Docker Compose files
# =====================================================
Write-Host "`n[3/8] Checking Docker Compose files..." -ForegroundColor Yellow
$composeFiles = @(
    "docker-compose.yml",
    "docker-compose.override.yml",
    "docker-compose.vs.debug.yml",
    "docker-compose.vs.release.yml"
)

foreach ($file in $composeFiles) {
    if (Test-Path $file) {
        Write-Host "✓ $file found" -ForegroundColor Green
    }
    else {
        Write-Host "✗ $file NOT found" -ForegroundColor Yellow
    }
}

# =====================================================
# 4. Validate Docker Compose
# =====================================================
Write-Host "`n[4/8] Validating docker-compose.yml..." -ForegroundColor Yellow
try {
    $validation = docker compose config > $null 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ docker-compose.yml is valid" -ForegroundColor Green
    }
    else {
        Write-Host "✗ docker-compose.yml has ERRORS" -ForegroundColor Red
        docker compose config
        exit 1
    }
}
catch {
    Write-Host "✗ Failed to validate: $_" -ForegroundColor Red
    exit 1
}

# =====================================================
# 5. Check for running containers
# =====================================================
Write-Host "`n[5/8] Checking for running containers..." -ForegroundColor Yellow
$containers = docker compose ps -q --no-trunc 2>&1
if ($containers) {
    $containerCount = ($containers | Measure-Object -Line).Lines
    Write-Host "✓ Found $containerCount running container(s)" -ForegroundColor Green
    Write-Host "`nContainer Status:" -ForegroundColor Gray
    docker compose ps
}
else {
    Write-Host "✓ No containers currently running" -ForegroundColor Green
}

# =====================================================
# 6. Check container health
# =====================================================
Write-Host "`n[6/8] Checking container health status..." -ForegroundColor Yellow
$services = docker compose config --services
foreach ($service in $services) {
    $container = docker compose ps -q $service 2>&1
    if ($container -and $container -ne "") {
        $health = docker inspect -f '{{.State.Health.Status}}' $container 2>&1
        if ($health -eq "healthy") {
            Write-Host "✓ $service is HEALTHY" -ForegroundColor Green
        }
        elseif ($health -eq "starting") {
            Write-Host "⚠ $service is STARTING..." -ForegroundColor Yellow
        }
        elseif ($health -eq "unhealthy") {
            Write-Host "✗ $service is UNHEALTHY!" -ForegroundColor Red
            Write-Host "  Details:" -ForegroundColor Gray
            docker inspect -f '{{json .State.Health}}' $container | ConvertFrom-Json | Format-List
        }
        else {
            Write-Host "⊙ $service (no health check)" -ForegroundColor Gray
        }
    }
    else {
        Write-Host "⊙ $service (not running)" -ForegroundColor Gray
    }
}

# =====================================================
# 7. Check specific service issues
# =====================================================
Write-Host "`n[7/8] Checking for known issues..." -ForegroundColor Yellow

# RabbitMQ Health Check
$rabbitContainer = docker compose ps -q rabbitmq 2>&1
if ($rabbitContainer -and $rabbitContainer -ne "") {
    $rabbitHealth = docker inspect -f '{{.State.Health.Status}}' $rabbitContainer 2>&1
    if ($rabbitHealth -eq "unhealthy") {
        Write-Host "`n⚠ RabbitMQ Health Issue Detected:" -ForegroundColor Yellow
        Write-Host "  Run: .\scripts\fix-rabbitmq.ps1" -ForegroundColor Cyan
    }
}

# Memory Issues
Write-Host "`nDocker resource usage:" -ForegroundColor Gray
$dockerInfo = docker info --format '{{.MemTotal}}'
if ($dockerInfo) {
    $memGB = [math]::Round($dockerInfo / 1GB, 2)
    Write-Host "  Available memory: $memGB GB" -ForegroundColor Gray
}

# =====================================================
# 8. Generate full report
# =====================================================
Write-Host "`n[8/8] Generating diagnostic report..." -ForegroundColor Yellow
$reportFile = "diagnostics-$(Get-Date -Format 'yyyyMMdd-HHmmss').txt"
@"
TC Agro Solutions - Docker Diagnostics Report
Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
Location: $rootPath

=== DOCKER INFO ===
$(docker info 2>&1)

=== CONTAINERS ===
$(docker compose ps -a 2>&1)

=== IMAGES ===
$(docker compose images 2>&1)

=== NETWORKS ===
$(docker network ls 2>&1)

=== VOLUMES ===
$(docker volume ls 2>&1)

=== ENVIRONMENT (.env) ===
$(Get-Content ".env" -ErrorAction SilentlyContinue)

=== COMPOSE CONFIG ===
$(docker compose config 2>&1)

=== LOGS (Last 50 lines of each service) ===
$($services | ForEach-Object {
    "--- $_  ---`n$(docker compose logs --tail=50 $_ 2>&1)`n"
})
"@ | Out-File $reportFile
Write-Host "✓ Report saved to: $reportFile" -ForegroundColor Green

# =====================================================
# Summary & Recommendations
# =====================================================
Write-Host "`n==================================================" -ForegroundColor Cyan
Write-Host "  Diagnostics Summary" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

Write-Host "`nIf you see UNHEALTHY services:" -ForegroundColor Yellow
Write-Host "  1. RabbitMQ:  .\scripts\fix-rabbitmq.ps1" -ForegroundColor Cyan
Write-Host "  2. All:       .\scripts\restart-services.ps1" -ForegroundColor Cyan
Write-Host "  3. Nuclear:   .\cleanup.ps1 && .\start.ps1" -ForegroundColor Cyan

Write-Host "`nIf running from Visual Studio:" -ForegroundColor Yellow
Write-Host "  1. Stop container (Docker > Stop) if running" -ForegroundColor Cyan
Write-Host "  2. Delete containers: docker compose down" -ForegroundColor Cyan
Write-Host "  3. Run via F5 (Debug Compose)" -ForegroundColor Cyan

Write-Host "`nIf using from command line:" -ForegroundColor Yellow
Write-Host "  1. Start all: .\start.ps1" -ForegroundColor Cyan
Write-Host "  2. View logs: docker compose logs -f <service>" -ForegroundColor Cyan
Write-Host "`n"
