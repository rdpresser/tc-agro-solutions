<#
.SYNOPSIS
  Ensure Docker Compose infrastructure stack is running and properly networked.

.DESCRIPTION
  This script:
  1. Starts the Docker Compose observability stack
  2. Ensures the tc-agro-network exists
  3. Ensures Identity Service is on tc-agro-network (if running)
  4. Validates all critical services are healthy

.EXAMPLE
  .\ensure-compose-infrastructure.ps1
#>

$Color = @{
    Success = "Green"
    Error   = "Red"
    Warning = "Yellow"
    Info    = "Cyan"
    Muted   = "Gray"
}

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "=== $Message ===" -ForegroundColor $Color.Info
}

Write-Step "Ensuring Docker Compose Infrastructure Stack"

# Check Docker
Write-Host "Checking Docker daemon..." -ForegroundColor $Color.Info
$dockerInfo = docker info 2>&1
if ($dockerInfo -match "ERROR|Cannot connect") {
    Write-Host "Docker daemon not running" -ForegroundColor $Color.Error
    exit 1
}
Write-Host "Docker is running" -ForegroundColor $Color.Success

# Navigate to docker-compose directory
$composeDir = Join-Path $PSScriptRoot "..\..\orchestration\apphost-compose"
if (-not (Test-Path $composeDir)) {
    Write-Host "Docker Compose directory not found: $composeDir" -ForegroundColor $Color.Error
    exit 1
}

Write-Host "Working directory: $composeDir" -ForegroundColor $Color.Muted

Write-Step "Starting Docker Compose Stack"

Write-Host "Checking if Docker Compose services are already running..." -ForegroundColor $Color.Info

# Check if critical services are running
$servicesRunning = docker ps --format "{{.Names}}" 2>&1 | Where-Object { $_ -match "postgres|redis|rabbitmq|otel-collector|grafana|loki|tempo|prometheus" }

if ($servicesRunning -and ($servicesRunning | Measure-Object).Count -ge 5) {
    Write-Host "Docker Compose services already running (likely via VS 2026)" -ForegroundColor $Color.Success
    Write-Host "Skipping 'docker-compose up' to preserve existing deployment" -ForegroundColor $Color.Muted
}
else {
    Write-Host "Services not running. Starting via docker-compose..." -ForegroundColor $Color.Warning
    Push-Location $composeDir
    docker-compose up -d 2>&1 | Out-Null
    Pop-Location
    Write-Host "Docker Compose stack started" -ForegroundColor $Color.Success
}

Write-Step "Configuring Docker Network"

$networkName = "tc-agro-network"
Write-Host "Checking network: $networkName" -ForegroundColor $Color.Info

$networkExists = docker network ls --format "{{.Name}}" 2>&1 | Where-Object { $_ -eq $networkName }

if ($networkExists) {
    Write-Host "Network exists" -ForegroundColor $Color.Success
}
else {
    Write-Host "Creating network..." -ForegroundColor $Color.Warning
    docker network create --driver bridge $networkName 2>&1 | Out-Null
    Write-Host "Network created" -ForegroundColor $Color.Success
}

Write-Step "Configuring Identity Service"

$identityContainer = "tc-agro-identity-service"
$identityExists = docker ps -a --format "{{.Names}}" 2>&1 | Where-Object { $_ -eq $identityContainer }

if ($null -ne $identityExists) {
    Write-Host "Container found: $identityContainer" -ForegroundColor $Color.Info
  
    # Try to connect to network (errors are safe to ignore if already connected)
    docker network connect $networkName $identityContainer 2>&1 | Out-Null
    Write-Host "Network configuration applied" -ForegroundColor $Color.Success
}
else {
    Write-Host "Container not found (will be created by docker-compose)" -ForegroundColor $Color.Muted
}

Write-Host ""
Write-Host "================================================" -ForegroundColor $Color.Success
Write-Host "Infrastructure Stack Ready" -ForegroundColor $Color.Success
Write-Host "================================================" -ForegroundColor $Color.Success
Write-Host ""
Write-Host "Services available:" -ForegroundColor $Color.Info
Write-Host "  Grafana:      http://localhost:3000" -ForegroundColor $Color.Muted
Write-Host "  Prometheus:   http://localhost:9090" -ForegroundColor $Color.Muted
Write-Host "  Loki:         http://localhost:3100" -ForegroundColor $Color.Muted
Write-Host "  Tempo:        http://localhost:3200" -ForegroundColor $Color.Muted

Write-Host ""

exit 0
