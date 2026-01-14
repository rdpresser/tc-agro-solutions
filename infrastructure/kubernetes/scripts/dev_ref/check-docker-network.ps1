<#
.SYNOPSIS
  Checks Docker network connectivity before creating k3d cluster.
.DESCRIPTION
  This script diagnoses common Docker Desktop network issues on Windows
  that may prevent the k3d cluster from working correctly.
#>

Write-Host "`n=== Docker Network Diagnostics ===" -ForegroundColor Cyan
Write-Host ""

# 1) Check if Docker is running
Write-Host "1️⃣ Checking Docker..." -ForegroundColor Cyan
try {
    docker version | Out-Null
    Write-Host "   ✅ Docker is active" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Docker is not running!" -ForegroundColor Red
    Write-Host "   Start Docker Desktop first." -ForegroundColor Yellow
    exit 1
}

# 2) Check basic network connectivity
Write-Host "`n2️⃣ Checking container connectivity..." -ForegroundColor Cyan
try {
    $testResult = docker run --rm alpine ping -c 2 google.com 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Containers can access the internet" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Containers have connectivity issues" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ⚠️  Could not test container connectivity" -ForegroundColor Yellow
}

# 3) Check host.docker.internal
Write-Host "`n3️⃣ Checking host.docker.internal..." -ForegroundColor Cyan
try {
    $hostResolution = docker run --rm alpine nslookup host.docker.internal 2>&1
    if ($hostResolution -match "Address") {
        Write-Host "   ✅ host.docker.internal resolves correctly" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  host.docker.internal does not resolve" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ⚠️  Could not verify host.docker.internal" -ForegroundColor Yellow
}

# 4) Check WSL2 settings (if applicable)
Write-Host "`n4️⃣ Checking Docker backend mode..." -ForegroundColor Cyan
$dockerInfo = docker info 2>&1 | Out-String
if ($dockerInfo -match "WSL") {
    Write-Host "   ℹ️  Docker using WSL2 backend" -ForegroundColor Cyan
    Write-Host "   If there are issues, consider:" -ForegroundColor Gray
    Write-Host "   - Restart WSL: wsl --shutdown" -ForegroundColor Gray
    Write-Host "   - Restart Docker Desktop" -ForegroundColor Gray
} else {
    Write-Host "   ℹ️  Docker using Hyper-V backend" -ForegroundColor Cyan
}

# 5) Check available resources
Write-Host "`n5️⃣ Checking Docker resources..." -ForegroundColor Cyan
$cpus = (docker info --format '{{.NCPU}}' 2>$null)
$memory = (docker info --format '{{.MemTotal}}' 2>$null)

if ($cpus) {
    Write-Host "   CPUs: $cpus" -ForegroundColor White
}
if ($memory) {
    $memoryGB = [math]::Round($memory / 1GB, 2)
    Write-Host "   Memory: $memoryGB GB" -ForegroundColor White

    if ($memoryGB -lt 16) {
        Write-Host "   ⚠️  Recommended: at least 16GB for this cluster" -ForegroundColor Yellow
    } else {
        Write-Host "   ✅ Sufficient memory" -ForegroundColor Green
    }
}

# 6) Check required ports
Write-Host "`n6️⃣ Checking required ports..." -ForegroundColor Cyan
$ports = @(80, 443, 8090, 3000)
$portsInUse = @()

foreach ($port in $ports) {
    $connection = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($connection) {
        $portsInUse += $port
    }
}

if ($portsInUse.Count -gt 0) {
    Write-Host "   ⚠️  Ports in use: $($portsInUse -join ', ')" -ForegroundColor Yellow
    Write-Host "   Run .\stop-port-forward.ps1 to free ports 8090/3000" -ForegroundColor Gray
} else {
    Write-Host "   ✅ All required ports are free" -ForegroundColor Green
}

# Summary
Write-Host "`n=== Summary ===" -ForegroundColor Cyan
Write-Host "If all checks passed, you can create the cluster:" -ForegroundColor White
Write-Host "   .\create-all-from-zero.ps1" -ForegroundColor Green
Write-Host ""
Write-Host "If there are issues:" -ForegroundColor Yellow
Write-Host "   1. Restart Docker Desktop" -ForegroundColor Gray
Write-Host "   2. If using WSL2, run: wsl --shutdown" -ForegroundColor Gray
Write-Host "   3. Wait for Docker to fully start" -ForegroundColor Gray
Write-Host "   4. Run this script again" -ForegroundColor Gray
Write-Host ""
