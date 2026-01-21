# =====================================================
# TC Agro Solutions - Visual Studio Pre-Build Cleanup
# =====================================================
# Purpose: Clean up existing TC Agro containers before VS starts new ones
# Called automatically before F5 or Ctrl+F5
# Safety: Only removes TC Agro containers (preserves k3d and other resources)
# Idempotent: Safe to run multiple times
# =====================================================

param(
    [switch]$Force,
    [switch]$Silent
)

$ErrorActionPreference = "Continue"

if (-not $Silent) {
    Write-Host "`n==================================================" -ForegroundColor Cyan
    Write-Host "  TC Agro - Pre-Build Cleanup (Visual Studio)" -ForegroundColor Cyan
    Write-Host "==================================================" -ForegroundColor Cyan
}

$scriptPath = Split-Path -Parent $PSScriptRoot
Set-Location $scriptPath

# =====================================================
# 1. Check Docker Status
# =====================================================
try {
    docker info | Out-Null
    if (-not $Silent) {
        Write-Host "✅ Docker is running" -ForegroundColor Green
    }
}
catch {
    Write-Host "❌ Docker is not running. Please start Docker Desktop." -ForegroundColor Red
    exit 1
}

# =====================================================
# 2. Stop TC Agro Containers (safe - uses labels)
# =====================================================
if (-not $Silent) {
    Write-Host "`n🧹 Stopping TC Agro containers..." -ForegroundColor Yellow
}

# Get running TC Agro containers using labels
$tcAgroContainers = docker ps -a --filter "label=tc-agro.component" --format "{{.Names}}" 2>$null

if ($tcAgroContainers) {
    if (-not $Silent) {
        Write-Host "   Found TC Agro containers:" -ForegroundColor Gray
        $tcAgroContainers | ForEach-Object { Write-Host "     - $_" -ForegroundColor Gray }
    }
    
    # Use compose down for graceful shutdown
    docker compose down --remove-orphans 2>&1 | Out-Null
    
    # Force remove if containers still exist and -Force is specified
    if ($Force) {
        Start-Sleep -Seconds 2
        $remainingContainers = docker ps -a --filter "label=tc-agro.component" --format "{{.Names}}" 2>$null
        if ($remainingContainers) {
            if (-not $Silent) {
                Write-Host "   Force removing stubborn containers..." -ForegroundColor Yellow
            }
            $remainingContainers | ForEach-Object {
                docker rm -f $_ 2>&1 | Out-Null
            }
        }
    }
    
    # Wait for cleanup
    Start-Sleep -Seconds 2
    
    if (-not $Silent) {
        Write-Host "   ✅ Cleanup complete" -ForegroundColor Green
    }
}
else {
    if (-not $Silent) {
        Write-Host "   ℹ️  No TC Agro containers to clean" -ForegroundColor Cyan
    }
}

# =====================================================
# 3. Verify K3D Preservation
# =====================================================
if (-not $Silent) {
    $k3dContainers = docker ps --filter "name=k3d-" --format "{{.Names}}" 2>$null
    if ($k3dContainers) {
        $k3dCount = ($k3dContainers | Measure-Object).Count
        Write-Host "`n✅ K3D containers preserved: $k3dCount running" -ForegroundColor Green
    }
}

# =====================================================
# 4. Check Port Conflicts (informational only)
# =====================================================
if (-not $Silent) {
    Write-Host "`n🔍 Checking for port conflicts..." -ForegroundColor Yellow
}

$portsToCheck = @(5432, 6379, 5672, 15672, 3000, 9090, 3100, 3200, 4317, 5001)
$portsInUse = @()

foreach ($port in $portsToCheck) {
    $connection = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | 
    Where-Object { $_.State -eq "Listen" }
    
    if ($connection) {
        $processId = $connection.OwningProcess
        $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
        
        # Only warn if it's not Docker
        if ($process -and $process.ProcessName -notlike "*docker*" -and $process.ProcessName -notlike "*com.docker*") {
            $portsInUse += @{
                Port        = $port
                ProcessId   = $processId
                ProcessName = $process.ProcessName
            }
        }
    }
}

if ($portsInUse.Count -gt 0 -and -not $Silent) {
    Write-Host "   ⚠️  Warning: Ports in use by non-Docker processes:" -ForegroundColor Yellow
    $portsInUse | ForEach-Object {
        Write-Host "      Port $($_.Port): $($_.ProcessName) (PID: $($_.ProcessId))" -ForegroundColor Gray
    }
    Write-Host "   These may cause conflicts. Consider stopping these processes." -ForegroundColor Yellow
}
else {
    if (-not $Silent) {
        Write-Host "   ✅ No port conflicts detected" -ForegroundColor Green
    }
}

# =====================================================
# 5. Summary
# =====================================================
if (-not $Silent) {
    Write-Host "`n==================================================" -ForegroundColor Green
    Write-Host "  Pre-Build cleanup complete! VS can now start." -ForegroundColor Green
    Write-Host "==================================================" -ForegroundColor Green
    Write-Host ""
}

exit 0
}
}
}
}

if ($portsInUse.Count -gt 0) {
    Write-Host "   ⚠️  Warning: Ports in use by non-Docker processes:" -ForegroundColor Yellow
    $portsInUse | ForEach-Object {
        Write-Host "      Port $($_.Port): $($_.ProcessName) (PID: $($_.ProcessId))" -ForegroundColor Gray
    }
    Write-Host "   These may cause conflicts. Consider stopping these processes." -ForegroundColor Yellow
}
else {
    if (-not $Silent) {
        Write-Host "   ✅ No port conflicts detected" -ForegroundColor Green
    }
}

if (-not $Silent) {
    Write-Host "`n==================================================" -ForegroundColor Green
    Write-Host "  Pre-Build cleanup complete! VS can now start." -ForegroundColor Green
    Write-Host "==================================================" -ForegroundColor Green
    Write-Host ""
}

exit 0
