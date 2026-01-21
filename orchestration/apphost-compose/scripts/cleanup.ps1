# =====================================================
# TC Agro Solutions - Safe Cleanup Script
# =====================================================
# Purpose: Safely removes ONLY TC Agro containers, networks, and volumes
# Uses labels to ensure k3d and other Docker resources are not affected
# =====================================================

param(
    [switch]$Force,
    [switch]$KeepVolumes
)

Write-Host "`n==================================================" -ForegroundColor Cyan
Write-Host "  TC Agro Solutions - Safe Docker Cleanup" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

$scriptPath = Split-Path -Parent $PSScriptRoot
Set-Location $scriptPath

# Check Docker
try {
    docker info | Out-Null
}
catch {
    Write-Host "`n❌ Docker is not running!" -ForegroundColor Red
    exit 1
}

# Show what will be cleaned
Write-Host "`n🔍 Scanning TC Agro resources..." -ForegroundColor Yellow

$containers = docker ps -a --filter "label=tc-agro.component" --format "{{.Names}}" 2>$null
$volumes = docker volume ls --filter "label=com.docker.compose.project=tc-agro-local" --quiet 2>$null
$networks = docker network ls --filter "label=com.docker.compose.project=tc-agro-local" --format "{{.Name}}" 2>$null

$containerCount = if ($containers) { ($containers | Measure-Object).Count } else { 0 }
$volumeCount = if ($volumes) { ($volumes | Measure-Object).Count } else { 0 }
$networkCount = if ($networks) { ($networks | Measure-Object).Count } else { 0 }

Write-Host "`nResources to be removed:" -ForegroundColor Yellow
Write-Host "  📦 Containers: $containerCount" -ForegroundColor Gray
if ($containerCount -gt 0) {
    $containers | ForEach-Object { Write-Host "     - $_" -ForegroundColor Gray }
}

if (-not $KeepVolumes) {
    Write-Host "  💾 Volumes: $volumeCount" -ForegroundColor Gray
    if ($volumeCount -gt 0) {
        $volumes | ForEach-Object { Write-Host "     - $_" -ForegroundColor Gray }
    }
}
else {
    Write-Host "  💾 Volumes: PRESERVED (--KeepVolumes)" -ForegroundColor Green
}

Write-Host "  🌐 Networks: $networkCount" -ForegroundColor Gray
if ($networkCount -gt 0) {
    $networks | ForEach-Object { Write-Host "     - $_" -ForegroundColor Gray }
}

# Safety check - ensure no k3d resources
$k3dContainers = docker ps -a --filter "name=k3d-" --format "{{.Names}}" 2>$null
if ($k3dContainers) {
    Write-Host "`n✅ Safety Check: K3D containers detected and will be PRESERVED" -ForegroundColor Green
    Write-Host "   K3D containers: $(($k3dContainers | Measure-Object).Count)" -ForegroundColor Gray
}

if ($containerCount -eq 0 -and $volumeCount -eq 0 -and $networkCount -eq 0) {
    Write-Host "`n✨ Nothing to clean - environment is already clean!" -ForegroundColor Green
    exit 0
}

# Ask for confirmation (unless -Force)
if (-not $Force) {
    Write-Host "`n⚠️  This will remove the resources listed above." -ForegroundColor Yellow
    $confirmation = Read-Host "Continue? (yes/no)"
    
    if ($confirmation -ne "yes") {
        Write-Host "`n❌ Cleanup cancelled." -ForegroundColor Yellow
        exit 0
    }
}

# Execute cleanup
Write-Host "`n🧹 Starting cleanup..." -ForegroundColor Yellow

# Step 1: Stop and remove containers via compose
Write-Host "`n[1/3] Stopping containers via Docker Compose..." -ForegroundColor Yellow
if ($KeepVolumes) {
    docker compose down --remove-orphans 2>&1 | Out-Null
}
else {
    docker compose down -v --remove-orphans 2>&1 | Out-Null
}

if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Docker Compose cleanup complete" -ForegroundColor Green
}
else {
    Write-Host "   ⚠️  Docker Compose cleanup had issues, continuing..." -ForegroundColor Yellow
}

# Step 2: Force remove any remaining TC Agro containers
Write-Host "`n[2/3] Removing any remaining TC Agro containers..." -ForegroundColor Yellow
$remainingContainers = docker ps -a --filter "label=tc-agro.component" --format "{{.Names}}" 2>$null

if ($remainingContainers) {
    $remainingContainers | ForEach-Object {
        Write-Host "   Removing: $_" -ForegroundColor Gray
        docker rm -f $_ 2>&1 | Out-Null
    }
    Write-Host "   ✅ Remaining containers removed" -ForegroundColor Green
}
else {
    Write-Host "   ✅ No remaining containers" -ForegroundColor Green
}

# Step 3: Clean networks (only TC Agro networks)
Write-Host "`n[3/3] Cleaning TC Agro networks..." -ForegroundColor Yellow
$agroNetworks = docker network ls --filter "label=com.docker.compose.project=tc-agro-local" --format "{{.Name}}" 2>$null

if ($agroNetworks) {
    $agroNetworks | ForEach-Object {
        # Skip default networks
        if ($_ -notin @("bridge", "host", "none")) {
            Write-Host "   Removing network: $_" -ForegroundColor Gray
            docker network rm $_ 2>&1 | Out-Null
        }
    }
    Write-Host "   ✅ Networks cleaned" -ForegroundColor Green
}
else {
    Write-Host "   ✅ No networks to clean" -ForegroundColor Green
}

# Final verification
Write-Host "`n==================================================" -ForegroundColor Cyan
Write-Host "  Verification" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

$remainingTC = docker ps -a --filter "label=tc-agro.component" --format "{{.Names}}" 2>$null
$remainingK3D = docker ps -a --filter "name=k3d-" --format "{{.Names}}" 2>$null

if (-not $remainingTC) {
    Write-Host "`n✅ All TC Agro containers removed" -ForegroundColor Green
}
else {
    Write-Host "`n⚠️  Some TC Agro containers still exist:" -ForegroundColor Yellow
    $remainingTC | ForEach-Object { Write-Host "   - $_" -ForegroundColor Gray }
}

if ($remainingK3D) {
    Write-Host "✅ K3D containers preserved ($(($remainingK3D | Measure-Object).Count) containers)" -ForegroundColor Green
}

Write-Host "`n==================================================" -ForegroundColor Green
Write-Host "  Cleanup complete!" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green

Write-Host "`n💡 To start fresh:" -ForegroundColor Cyan
Write-Host "   .\scripts\start.ps1" -ForegroundColor White
Write-Host "   or" -ForegroundColor Gray
Write-Host "   .\scripts\docker-manager.ps1 start" -ForegroundColor White
Write-Host ""
