# =====================================================
# Emergency: Pull .NET Images via Alternative Methods
# =====================================================

$ErrorActionPreference = "Continue"

function Write-Success { param($Message) Write-Host "✓ $Message" -ForegroundColor Green }
function Write-Info { param($Message) Write-Host "ℹ $Message" -ForegroundColor Cyan }
function Write-Warning { param($Message) Write-Host "⚠ $Message" -ForegroundColor Yellow }
function Write-Error { param($Message) Write-Host "✗ $Message" -ForegroundColor Red }
function Write-Section { param($Message) Write-Host "`n=== $Message ===" -ForegroundColor Magenta }

Write-Section "Emergency .NET Image Pull"

# Method 1: Try with --platform flag
Write-Info "Method 1: Trying with explicit platform..."
docker pull --platform linux/amd64 mcr.microsoft.com/dotnet/aspnet:10.0
if ($LASTEXITCODE -eq 0) {
    Write-Success ".NET aspnet:10.0 pulled successfully!"
    docker pull --platform linux/amd64 mcr.microsoft.com/dotnet/sdk:10.0
    if ($LASTEXITCODE -eq 0) {
        Write-Success ".NET sdk:10.0 pulled successfully!"
        exit 0
    }
}

# Method 2: Try disabling HTTP/2
Write-Section "Method 2: Trying with HTTP/1.1 (disable HTTP/2)"
$env:DOCKER_BUILDKIT = 0
docker pull mcr.microsoft.com/dotnet/aspnet:10.0
if ($LASTEXITCODE -eq 0) {
    Write-Success ".NET aspnet:10.0 pulled with HTTP/1.1!"
    docker pull mcr.microsoft.com/dotnet/sdk:10.0
    if ($LASTEXITCODE -eq 0) {
        Write-Success ".NET sdk:10.0 pulled with HTTP/1.1!"
        exit 0
    }
}

# Method 3: Use Docker Hub alternative if available
Write-Section "Method 3: Checking Docker Hub alternatives"
Write-Info "Searching for .NET images on Docker Hub..."
docker search dotnet/aspnet --limit 5 --format "table {{.Name}}\t{{.Stars}}"

Write-Section "Workaround: Build without pulling base image"
Write-Host @"

MCR is having connectivity issues. Temporary workarounds:

Option A: Wait and retry
  - MCR may be experiencing temporary issues
  - Try again in 5-10 minutes
  - Check MCR status: https://status.mcr.microsoft.com/

Option B: Use cached layers
  - If you've built before, Docker may use cached layers
  - Try: docker-compose build --no-cache (forces fresh build)

Option C: Modify Dockerfiles temporarily
  - Change FROM mcr.microsoft.com/dotnet/aspnet:10.0
  - To:    FROM mcr.microsoft.com/dotnet/aspnet:8.0
  - (Use .NET 8 which may be cached or more stable)

Option D: Disable BUILDKIT and retry
  - Run: `$env:DOCKER_BUILDKIT=0
  - Then rebuild in VS 2026

Option E: Check corporate proxy/firewall
  - Whitelist: *.mcr.microsoft.com, *.microsoft.com
  - Disable SSL inspection for MCR domains

"@ -ForegroundColor Yellow

Write-Section "Recommended Action"
Write-Host "Try this command manually:" -ForegroundColor Cyan
Write-Host '  docker pull --platform linux/amd64 mcr.microsoft.com/dotnet/aspnet:10.0' -ForegroundColor White
Write-Host "`nIf it fails, we'll need to:" -ForegroundColor Cyan
Write-Host "  1. Check your corporate proxy/firewall settings" -ForegroundColor White
Write-Host "  2. Temporarily downgrade to .NET 8 images" -ForegroundColor White
Write-Host "  3. Contact your network admin about MCR access" -ForegroundColor White
