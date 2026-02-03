<#
.SYNOPSIS
  Fix Docker connectivity issues with MCR (Microsoft Container Registry)

.DESCRIPTION
  Solves EOF errors and connection issues when pulling from mcr.microsoft.com
#>

$Color = @{
    Success = "Green"
    Error   = "Red"
    Info    = "Cyan"
    Warning = "Yellow"
    Muted   = "Gray"
}

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor $Color.Info
Write-Host "║         FIX DOCKER MCR CONNECTIVITY                       ║" -ForegroundColor $Color.Info
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor $Color.Info
Write-Host ""

# Solution 1: Clear Docker builder cache
Write-Host "🧹 Solution 1: Clear Docker builder cache" -ForegroundColor $Color.Info
Write-Host "   This removes corrupted build cache that may cause EOF errors" -ForegroundColor $Color.Muted
$response = Read-Host "   Execute? (y/n - default: y)"
if ($response -eq "" -or $response -eq "y") {
    docker builder prune -af
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Builder cache cleared" -ForegroundColor $Color.Success
    }
    else {
        Write-Host "   ❌ Failed to clear builder cache" -ForegroundColor $Color.Error
    }
}
Write-Host ""

# Solution 2: Restart Docker Desktop
Write-Host "🔄 Solution 2: Restart Docker Desktop" -ForegroundColor $Color.Info
Write-Host "   This resets network connections and internal state" -ForegroundColor $Color.Muted
$response = Read-Host "   Execute? (y/n - default: n)"
if ($response -eq "y") {
    Write-Host "   Stopping Docker Desktop..." -ForegroundColor $Color.Muted
    Stop-Process -Name "Docker Desktop" -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 5
    
    Write-Host "   Starting Docker Desktop..." -ForegroundColor $Color.Muted
    Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    
    Write-Host "   ⏳ Waiting for Docker to be ready (30s)..." -ForegroundColor $Color.Muted
    Start-Sleep -Seconds 30
    
    $ready = docker ps 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Docker restarted successfully" -ForegroundColor $Color.Success
    }
    else {
        Write-Host "   ⚠️  Docker may need more time to start" -ForegroundColor $Color.Warning
    }
}
Write-Host ""

# Solution 3: Test MCR connectivity
Write-Host "🔍 Solution 3: Test MCR connectivity" -ForegroundColor $Color.Info
Write-Host "   Attempting to pull .NET 10 SDK image directly" -ForegroundColor $Color.Muted
$response = Read-Host "   Execute? (y/n - default: y)"
if ($response -eq "" -or $response -eq "y") {
    Write-Host "   Pulling mcr.microsoft.com/dotnet/sdk:10.0..." -ForegroundColor $Color.Muted
    docker pull mcr.microsoft.com/dotnet/sdk:10.0
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Successfully pulled .NET 10 SDK" -ForegroundColor $Color.Success
    }
    else {
        Write-Host "   ❌ Failed to pull image" -ForegroundColor $Color.Error
        Write-Host ""
        Write-Host "   💡 Try these manual steps:" -ForegroundColor $Color.Warning
        Write-Host "      1. Check your internet connection" -ForegroundColor $Color.Muted
        Write-Host "      2. Check Docker Desktop network settings" -ForegroundColor $Color.Muted
        Write-Host "      3. Try again in a few minutes (MCR may be temporarily down)" -ForegroundColor $Color.Muted
        Write-Host "      4. Check firewall/antivirus blocking Docker" -ForegroundColor $Color.Muted
    }
}
Write-Host ""

# Solution 4: Alternative - Use buildx with different driver
Write-Host "🛠️  Solution 4: Use BuildKit with retry" -ForegroundColor $Color.Info
Write-Host "   This enables advanced build features with better error handling" -ForegroundColor $Color.Muted
$response = Read-Host "   Would you like to see the command? (y/n - default: y)"
if ($response -eq "" -or $response -eq "y") {
    Write-Host ""
    Write-Host "   Add this to build command:" -ForegroundColor $Color.Muted
    Write-Host "   $env:DOCKER_BUILDKIT=1" -ForegroundColor Cyan
    Write-Host "   docker build --pull --network=host ..." -ForegroundColor Cyan
    Write-Host ""
}

Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor $Color.Muted
Write-Host "✅ Diagnostic complete" -ForegroundColor $Color.Success
Write-Host ""
Write-Host "Next steps:" -ForegroundColor $Color.Info
Write-Host "1. If pull succeeded, retry: .\build-push-images.ps1" -ForegroundColor $Color.Muted
Write-Host "2. If still failing, check Docker Desktop → Settings → Resources → Network" -ForegroundColor $Color.Muted
Write-Host ""
