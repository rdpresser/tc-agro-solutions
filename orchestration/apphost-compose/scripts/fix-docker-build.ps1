# =====================================================
# Fix Docker Build Connectivity Issues
# =====================================================
# Purpose: Resolve EOF/timeout errors when building images
# Target: MCR (Microsoft Container Registry) and Docker Hub
# =====================================================

$ErrorActionPreference = "Continue"

# Color functions
function Write-Success { param($Message) Write-Host "✓ $Message" -ForegroundColor Green }
function Write-Info { param($Message) Write-Host "ℹ $Message" -ForegroundColor Cyan }
function Write-Warning { param($Message) Write-Host "⚠ $Message" -ForegroundColor Yellow }
function Write-Error { param($Message) Write-Host "✗ $Message" -ForegroundColor Red }
function Write-Section { param($Message) Write-Host "`n=== $Message ===" -ForegroundColor Magenta }

Write-Section "Docker Build Connectivity Fix"

# Step 1: Restart Docker Desktop
Write-Section "Step 1: Restart Docker Desktop"
Write-Info "This will restart Docker Desktop service..."
Write-Host "Continue? [Y/n]: " -NoNewline -ForegroundColor Yellow
$response = Read-Host
if ($response -eq "" -or $response -eq "Y" -or $response -eq "y") {
    try {
        Stop-Process -Name "Docker Desktop" -Force -ErrorAction SilentlyContinue
        Write-Success "Stopped Docker Desktop"
        Start-Sleep -Seconds 3
        
        Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
        Write-Success "Started Docker Desktop"
        Write-Info "Waiting 30 seconds for Docker to initialize..."
        Start-Sleep -Seconds 30
        
        # Wait for Docker to be ready
        $maxWait = 60
        $waited = 0
        while ($waited -lt $maxWait) {
            $dockerStatus = docker info 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Success "Docker is ready!"
                break
            }
            Write-Host "." -NoNewline
            Start-Sleep -Seconds 2
            $waited += 2
        }
        Write-Host ""
    }
    catch {
        Write-Warning "Failed to restart Docker Desktop automatically"
        Write-Info "Please restart manually: Right-click Docker tray icon → Restart"
    }
}
else {
    Write-Warning "Skipped Docker restart - please restart manually if needed"
}

# Step 2: Test connectivity to registries
Write-Section "Step 2: Test Registry Connectivity"

Write-Info "Testing Microsoft Container Registry..."
try {
    $mcrTest = Test-NetConnection -ComputerName mcr.microsoft.com -Port 443 -WarningAction SilentlyContinue
    if ($mcrTest.TcpTestSucceeded) {
        Write-Success "MCR (mcr.microsoft.com:443) is reachable"
    }
    else {
        Write-Error "Cannot reach MCR - check firewall/proxy"
    }
}
catch {
    Write-Error "MCR connectivity test failed: $_"
}

Write-Info "Testing Docker Hub..."
try {
    $hubTest = Test-NetConnection -ComputerName registry-1.docker.io -Port 443 -WarningAction SilentlyContinue
    if ($hubTest.TcpTestSucceeded) {
        Write-Success "Docker Hub (registry-1.docker.io:443) is reachable"
    }
    else {
        Write-Error "Cannot reach Docker Hub - check firewall/proxy"
    }
}
catch {
    Write-Error "Docker Hub connectivity test failed: $_"
}

# Step 3: Clear Docker build cache
Write-Section "Step 3: Clear Docker Build Cache"
Write-Info "This will remove old build cache that may be corrupted..."
Write-Host "Clear build cache? [Y/n]: " -NoNewline -ForegroundColor Yellow
$response = Read-Host
if ($response -eq "" -or $response -eq "Y" -or $response -eq "y") {
    Write-Info "Clearing build cache..."
    docker builder prune -a -f
    Write-Success "Build cache cleared"
}

# Step 4: Pre-pull base images
Write-Section "Step 4: Pre-pull Base Images"
Write-Info "Pre-pulling base images needed for builds..."

$baseImages = @(
    "mcr.microsoft.com/dotnet/aspnet:10.0",
    "mcr.microsoft.com/dotnet/sdk:10.0",
    "nginx:1.27-alpine",
    "node:20-alpine"
)

foreach ($image in $baseImages) {
    Write-Host "`nPulling $image..." -ForegroundColor Cyan
    docker pull $image
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Successfully pulled $image"
    }
    else {
        Write-Error "Failed to pull $image"
    }
}

# Step 5: Verify pulled images
Write-Section "Step 5: Verify Images"
Write-Info "Checking pulled images..."
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}" | Select-String -Pattern "mcr.microsoft.com|nginx|node"

# Step 6: Final instructions
Write-Section "Next Steps"
Write-Host @"

✅ Docker has been restarted and base images pre-pulled

Now try building again in VS 2026:
  1. Press F5 in docker-compose.dcproj
  2. Or right-click docker-compose.dcproj → Rebuild

If the error persists:
  1. Check Windows Firewall: Allow Docker Desktop
  2. Check antivirus: Whitelist Docker
  3. Check proxy settings (if corporate network)
  4. Try alternative DNS: Use 1.1.1.1 (Cloudflare) as primary

"@ -ForegroundColor Green

Write-Success "Done! Try building again in VS 2026"
