<#
.SYNOPSIS
  Build and push Docker images for CloudGames APIs to k3d local registry.

.DESCRIPTION
  Builds Docker images for user-api, games-api, and payments-api,
  tags them for the local k3d registry (localhost:5000), and pushes them.
  Optionally restarts deployments to pull new images.

.PARAMETER Api
  Specific API to build: user, games, payments, or all (default).

.PARAMETER Tag
  Image tag to use. Default: dev

.PARAMETER Restart
  Restart deployments after push to pull new images.

.PARAMETER SkipPush
  Build only, skip push to registry.

.EXAMPLE
  .\build-push-images.ps1
  # Builds and pushes all APIs with tag 'dev'

.EXAMPLE
  .\build-push-images.ps1 -Api user -Tag v1.0.0
  # Builds and pushes only user-api with tag v1.0.0

.EXAMPLE
  .\build-push-images.ps1 -Restart
  # Builds, pushes, and restarts all deployments
#>

[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet("all", "user", "games", "payments")]
    [string]$Api = "all",

    [Parameter()]
    [string]$Tag = "dev",

    [Parameter()]
    [switch]$Restart,

    [Parameter()]
    [switch]$SkipPush
)

$script:Colors = @{
    Title   = "Cyan"
    Success = "Green"
    Warning = "Yellow"
    Error   = "Red"
    Info    = "White"
    Muted   = "Gray"
}

$script:RegistryHost = "localhost:5000"
$script:Namespace = "cloudgames-dev"

# API configurations
$script:Apis = @{
    "user" = @{
        Name = "user-api"
        Dockerfile = "services\users\src\Adapters\Inbound\TC.CloudGames.Users.Api\Dockerfile"
    }
    "games" = @{
        Name = "games-api"
        Dockerfile = "services\games\src\Adapters\Inbound\TC.CloudGames.Games.Api\Dockerfile"
    }
    "payments" = @{
        Name = "payments-api"
        Dockerfile = "services\payments\src\Adapters\Inbound\TC.CloudGames.Payments.Api\Dockerfile"
    }
}

function Show-Header {
    Write-Host ""
    Write-Host "========================================================" -ForegroundColor $Colors.Title
    Write-Host "       Docker Build & Push - CloudGames APIs            " -ForegroundColor $Colors.Title
    Write-Host "========================================================" -ForegroundColor $Colors.Title
    Write-Host ""
}

function Test-Prerequisites {
    Write-Host "=== 1) Checking prerequisites ===" -ForegroundColor $Colors.Title
    
    # Check Docker
    try {
        docker info 2>$null | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "Docker not running" }
        Write-Host "[OK] Docker is running" -ForegroundColor $Colors.Success
    } catch {
        Write-Host "[ERROR] Docker is not running or not installed." -ForegroundColor $Colors.Error
        exit 1
    }

    # Check registry
    $regCheck = docker ps --filter "name=k3d-localhost" --format "{{.Names}}" 2>$null
    if (-not $regCheck) {
        Write-Host "[ERROR] k3d registry not running. Start cluster first." -ForegroundColor $Colors.Error
        Write-Host "   Run: .\k3d-manager.ps1 start" -ForegroundColor $Colors.Muted
        exit 1
    }
    Write-Host "[OK] k3d registry running at $RegistryHost" -ForegroundColor $Colors.Success
    Write-Host ""
}

function Build-Api {
    param([string]$ApiKey)
    
    $apiConfig = $Apis[$ApiKey]
    $imageName = $apiConfig.Name
    $dockerfile = $apiConfig.Dockerfile
    $fullImageName = "${imageName}:${Tag}"
    $registryImage = "${RegistryHost}/${imageName}:${Tag}"
    
    Write-Host "Building $imageName..." -ForegroundColor $Colors.Info
    
    # Check Dockerfile exists
    $repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..\")).Path
    $dockerfilePath = Join-Path $repoRoot $dockerfile

    if (-not (Test-Path $dockerfilePath)) {
        Write-Host "[ERROR] Dockerfile not found: $dockerfile" -ForegroundColor $Colors.Error
        return $false
    }

    # Build
    Push-Location $repoRoot
    docker build -t $fullImageName -f $dockerfile . 2>&1
    $buildResult = $LASTEXITCODE
    Pop-Location

    if ($buildResult -ne 0) {
        Write-Host "[FAILED] Build failed for $imageName" -ForegroundColor $Colors.Error
        return $false
    }
    Write-Host "[OK] Built $fullImageName" -ForegroundColor $Colors.Success

    # Tag for registry
    docker tag $fullImageName $registryImage
    Write-Host "[OK] Tagged as $registryImage" -ForegroundColor $Colors.Success

    # Import to k3d cluster (more reliable than registry push)
    if (-not $SkipPush) {
        Write-Host "Importing to k3d cluster..." -ForegroundColor $Colors.Muted
        k3d image import $registryImage -c dev 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[WARNING] k3d import failed, trying registry push..." -ForegroundColor $Colors.Warning
            docker push $registryImage 2>&1
            if ($LASTEXITCODE -ne 0) {
                Write-Host "[FAILED] Push failed for $registryImage" -ForegroundColor $Colors.Error
                return $false
            }
        }
        Write-Host "[OK] Imported $registryImage to cluster" -ForegroundColor $Colors.Success
    }

    return $true
}

function Restart-Deployment {
    param([string]$ApiKey)

    $apiConfig = $Apis[$ApiKey]
    $deployName = $apiConfig.Name

    Write-Host "Restarting $deployName..." -ForegroundColor $Colors.Muted
    kubectl rollout restart deployment $deployName -n $Namespace 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Restarted $deployName" -ForegroundColor $Colors.Success
    } else {
        Write-Host "[WARNING] Could not restart $deployName" -ForegroundColor $Colors.Warning
    }
}

# Main execution
Show-Header
Test-Prerequisites

# Determine which APIs to build
$apisToBuild = @()
if ($Api -eq "all") {
    $apisToBuild = @("user", "games", "payments")
} else {
    $apisToBuild = @($Api)
}

Write-Host "=== 2) Building Docker images ===" -ForegroundColor $Colors.Title
Write-Host "   APIs: $($apisToBuild -join ', ')" -ForegroundColor $Colors.Info
Write-Host "   Tag: $Tag" -ForegroundColor $Colors.Info
Write-Host "   Registry: $RegistryHost" -ForegroundColor $Colors.Info
Write-Host ""

$successCount = 0
$failCount = 0

foreach ($apiKey in $apisToBuild) {
    $result = Build-Api -ApiKey $apiKey
    if ($result) {
        $successCount++
    } else {
        $failCount++
    }
    Write-Host ""
}

# Restart deployments if requested
if ($Restart -and $successCount -gt 0 -and -not $SkipPush) {
    Write-Host "=== 3) Restarting deployments ===" -ForegroundColor $Colors.Title
    foreach ($apiKey in $apisToBuild) {
        Restart-Deployment -ApiKey $apiKey
    }
    Write-Host ""
}

# Summary
Write-Host "=== Summary ===" -ForegroundColor $Colors.Title
Write-Host "   Built: $successCount" -ForegroundColor $Colors.Success
if ($failCount -gt 0) {
    Write-Host "   Failed: $failCount" -ForegroundColor $Colors.Error
}
if (-not $SkipPush) {
    Write-Host "   Pushed to: $RegistryHost" -ForegroundColor $Colors.Info
}
Write-Host ""

if ($failCount -eq 0) {
    Write-Host "[OK] All images built successfully!" -ForegroundColor $Colors.Success
    if (-not $Restart -and -not $SkipPush) {
        Write-Host ""
        Write-Host "To restart deployments and pull new images:" -ForegroundColor $Colors.Muted
        Write-Host "   .\build-push-images.ps1 -Restart" -ForegroundColor $Colors.Muted
        Write-Host "   # or manually:" -ForegroundColor $Colors.Muted
        Write-Host "   kubectl rollout restart deployment -n $Namespace --all" -ForegroundColor $Colors.Muted
    }
} else {
    Write-Host "[WARNING] Some builds failed. Check errors above." -ForegroundColor $Colors.Warning
    exit 1
}
Write-Host ""

