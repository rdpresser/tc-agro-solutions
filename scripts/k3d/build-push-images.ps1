<#
.SYNOPSIS
  Build and push container images to Docker Hub.

.DESCRIPTION
  Builds Docker images and pushes to Docker Hub (rdpresser).

  Supports:
  - rdpresser/frontend-service (poc/frontend)
  - rdpresser/identity-service (services/identity-service)

  Requires: docker login to have been executed successfully

.EXAMPLE
  .\build-push-images.ps1
#>

param(
    [ValidateSet("all", "platform", "apps")]
    [string]$SyncTarget = "apps",
    [switch]$SkipSync
)

$dockerHubUser = "rdpresser"
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

$images = @(
    @{ name = "frontend-service"; path = "poc/frontend"; dockerfile = "Dockerfile"; repo = "$dockerHubUser/frontend-service" }
    @{ name = "identity-service"; path = "services/identity-service"; dockerfile = "src/Adapters/Inbound/TC.Agro.Identity.Service/Dockerfile"; repo = "$dockerHubUser/identity-service" }
    # @{ name = "tc-agro-sensor-ingest-service"; path = "services/sensor-ingest-service"; dockerfile = "src/Adapters/Inbound/TC.Agro.SensorIngest.Service/Dockerfile" }
)

$Color = @{
    Success = "Green"
    Error   = "Red"
    Info    = "Cyan"
    Warning = "Yellow"
    Muted   = "Gray"
}

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor $Color.Info
Write-Host "║         BUILD & PUSH IMAGES TO DOCKER HUB                 ║" -ForegroundColor $Color.Info
Write-Host "║         📦 User: $dockerHubUser                              ║" -ForegroundColor $Color.Info
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor $Color.Info
Write-Host ""

# Verify docker login
Write-Host "🔍 Checking Docker Hub login status..." -ForegroundColor $Color.Info
# Test login by attempting a simple docker command that requires authentication
$dockerLoginCheck = docker ps 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker daemon not accessible or not logged in" -ForegroundColor $Color.Error
    Write-Host "   Run: docker login" -ForegroundColor $Color.Warning
    Write-Host "   Or: Restart Docker Desktop" -ForegroundColor $Color.Warning
    exit 1
}
Write-Host "✅ Docker is running and accessible" -ForegroundColor $Color.Success
Write-Host ""

$successfulImages = 0
$gitSha = & git rev-parse --short HEAD 2>$null
if (-not $gitSha) {
    $gitSha = "latest"
    Write-Host "⚠️  Could not get git SHA, using 'latest' tag" -ForegroundColor $Color.Warning
}

foreach ($img in $images) {
    $imageName = $img.name
    $imagePath = Join-Path $repoRoot $img.path
    $dockerfilePath = Join-Path $imagePath $img.dockerfile
    $repoUrl = $img.repo

    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor $Color.Muted
    Write-Host "🔨 Building: $imageName" -ForegroundColor $Color.Info
    Write-Host "   Path: $imagePath" -ForegroundColor $Color.Muted
    Write-Host "   Repo: $repoUrl" -ForegroundColor $Color.Muted

    if (-not (Test-Path $dockerfilePath)) {
        Write-Host "   ⚠️  Dockerfile not found: $dockerfilePath" -ForegroundColor $Color.Warning
        continue
    }

    # Build with multiple tags (latest + git sha)
    $tag_latest = "${repoUrl}:latest"
    $tag_sha = "${repoUrl}:${gitSha}"

    # Determine build context: nested Dockerfiles build from repo root
    if ($img.dockerfile -like "*/*") {
        $buildContext = $repoRoot
        Write-Host "   Context: Repo root (nested Dockerfile)" -ForegroundColor $Color.Muted
    }
    else {
        $buildContext = $imagePath
        Write-Host "   Context: Service directory" -ForegroundColor $Color.Muted
    }

    # Build with both tags
    Write-Host "   Building with tags: latest, $gitSha" -ForegroundColor $Color.Muted
    docker build -t $tag_latest -t $tag_sha -f $dockerfilePath $buildContext

    if ($LASTEXITCODE -ne 0) {
        Write-Host "   ❌ Build FAILED" -ForegroundColor $Color.Error
        continue
    }

    Write-Host "   ✅ Build successful" -ForegroundColor $Color.Success

    # Push to Docker Hub
    Write-Host "   📤 Pushing to Docker Hub..." -ForegroundColor $Color.Muted
    
    docker push $tag_latest
    if ($LASTEXITCODE -ne 0) {
        Write-Host "   ❌ Push FAILED (latest)" -ForegroundColor $Color.Error
        continue
    }
    Write-Host "   ✅ Pushed: $tag_latest" -ForegroundColor $Color.Success

    docker push $tag_sha
    if ($LASTEXITCODE -ne 0) {
        Write-Host "   ❌ Push FAILED (sha)" -ForegroundColor $Color.Error
        continue
    }
    Write-Host "   ✅ Pushed: $tag_sha" -ForegroundColor $Color.Success

    Write-Host "   📍 Docker Hub: https://hub.docker.com/r/$repoUrl" -ForegroundColor $Color.Muted
    $successfulImages++
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor $Color.Muted
Write-Host "📊 Build Summary: $successfulImages/$($images.Count) successful" -ForegroundColor $Color.Info

if ($successfulImages -eq 0) {
    Write-Host "❌ No images built successfully" -ForegroundColor $Color.Error
    exit 1
}

if (-not $SkipSync) {
    Write-Host ""
    Write-Host "✅ GitOps mode: no ArgoCD force sync." -ForegroundColor $Color.Info
    Write-Host "   CI pipelines update manifests; ArgoCD will reconcile automatically." -ForegroundColor $Color.Muted
}
else {
    Write-Host "ℹ️  GitOps sync skipped (SkipSync flag)." -ForegroundColor $Color.Muted
}

Write-Host "✅ Build & push complete!" -ForegroundColor $Color.Success
Write-Host ""
