# =====================================================
# TC Agro Solutions - Docker Compose Diagnostics
# =====================================================
# Purpose: Diagnose Docker Compose health issues
# Usage: .\scripts\diagnose.ps1
# Safety: Only checks TC Agro resources
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
Write-Host "`n[1/9] Checking Docker..." -ForegroundColor Yellow
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
Write-Host "`n[2/8] Checking env files..." -ForegroundColor Yellow
$envFiles = @(".env", ".env.identity", ".env.farm")
$missingEnvFiles = @()

foreach ($envFile in $envFiles) {
    if (Test-Path $envFile) {
        Write-Host "✓ $envFile found" -ForegroundColor Green
        $envLines = (Get-Content $envFile | Measure-Object -Line).Lines
        Write-Host "  $envLines configuration lines" -ForegroundColor Gray
    }
    else {
        $missingEnvFiles += $envFile
        Write-Host "✗ $envFile NOT found!" -ForegroundColor Red
    }
}

if ($missingEnvFiles.Count -gt 0) {
    Write-Host "  Expected at: $rootPath/$($missingEnvFiles -join ', ')" -ForegroundColor Yellow
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
# 5. Check for running containers (TC Agro only)
# =====================================================
Write-Host "`n[5/9] Checking for TC Agro containers..." -ForegroundColor Yellow
$tcAgroContainers = docker ps --filter "label=tc-agro.component" --format "{{.Names}}\t{{.Status}}" 2>&1
$allContainers = docker compose ps -q --no-trunc 2>&1

if ($tcAgroContainers) {
    $containerCount = ($tcAgroContainers | Measure-Object -Line).Lines
    Write-Host "✓ Found $containerCount TC Agro container(s)" -ForegroundColor Green
    Write-Host "`nTC Agro Container Status:" -ForegroundColor Gray
    docker ps --filter "label=tc-agro.component" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
}
else {
    Write-Host "✓ No TC Agro containers currently running" -ForegroundColor Green
}

# Check for K3D containers (informational)
Write-Host "`n[6/9] Checking for K3D containers (informational)..." -ForegroundColor Yellow
$k3dContainers = docker ps --filter "name=k3d-" --format "{{.Names}}" 2>$null
if ($k3dContainers) {
    $k3dCount = ($k3dContainers | Measure-Object).Count
    Write-Host "✓ Found $k3dCount K3D container(s) - PRESERVED by cleanup scripts" -ForegroundColor Green
}
else {
    Write-Host "  No K3D containers running" -ForegroundColor Gray
}

# =====================================================
# 7. Check container health
# =====================================================
Write-Host "`n[7/9] Checking container health status..." -ForegroundColor Yellow
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
# 8. Check specific service issues
# =====================================================
Write-Host "`n[8/9] Checking for known issues..." -ForegroundColor Yellow

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

# Check TC Agro labels
Write-Host "`nTC Agro labeled resources:" -ForegroundColor Gray
$labeledContainers = docker ps -a --filter "label=tc-agro.component" --format "{{.Names}}" 2>$null
if ($labeledContainers) {
    Write-Host "  Containers: $(($labeledContainers | Measure-Object).Count)" -ForegroundColor Gray
}
$labeledVolumes = docker volume ls --filter "label=com.docker.compose.project=tc-agro-local" --quiet 2>$null
if ($labeledVolumes) {
    Write-Host "  Volumes: $(($labeledVolumes | Measure-Object).Count)" -ForegroundColor Gray
}

# =====================================================
# 9. Generate full report
# =====================================================
Write-Host "`n[9/9] Generating diagnostic report..." -ForegroundColor Yellow
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

=== ENVIRONMENT (.env.identity) ===
$(Get-Content ".env.identity" -ErrorAction SilentlyContinue)

=== ENVIRONMENT (.env.farm) ===
$(Get-Content ".env.farm" -ErrorAction SilentlyContinue)

=== COMPOSE CONFIG ===
$(docker compose config 2>&1)

=== LOGS (Last 50 lines of each service) ===
$($services | ForEach-Object {
    "--- $_  ---`n$(docker compose logs --tail=50 $_ 2>&1)`n"
})
"@ | Out-File $reportFile
Write-Host "✓ RepSpecific:  docker compose restart <service>" -ForegroundColor Cyan
Write-Host "  3. All:       docker compose restart" -ForegroundColor Cyan
Write-Host "  4. Nuclear:   .\scripts\cleanup.ps1 && .\scripts\start.ps1" -ForegroundColor Cyan

Write-Host "`nIf running from Visual Studio:" -ForegroundColor Yellow
Write-Host "  1. Stop containers: docker compose down" -ForegroundColor Cyan
Write-Host "  2. Cleanup: .\scripts\pre-build-vs.ps1" -ForegroundColor Cyan
Write-Host "  3. Run via F5 (Debug Compose)" -ForegroundColor Cyan

Write-Host "`nUsing docker-manager.ps1 (recommended):" -ForegroundColor Yellow
Write-Host "  .\scripts\docker-manager.ps1 status" -ForegroundColor Cyan
Write-Host "  .\scripts\docker-manager.ps1 restart <service>" -ForegroundColor Cyan
Write-Host "  .\scripts\docker-manager.ps1 fix-rabbitmq" -ForegroundColor Cyan
Write-Host "  .\scripts\docker-manager.ps1 cleanup" -ForegroundColor Cyan

Write-Host "`nSafety Note:" -ForegroundColor Green
Write-Host "  All cleanup scripts preserve K3D containers and volumes" -ForegroundColor Gree
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
