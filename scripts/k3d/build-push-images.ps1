<#
.SYNOPSIS
  Build and push container images to local k3d registry.

.DESCRIPTION
  Builds Docker images and pushes to localhost:5000 registry.
  
  Supports:
  - agro-frontend (poc/frontend)
  - (future: microservices when they have Dockerfiles)

.EXAMPLE
  .\build-push-images.ps1
#>

$registryPort = 5000
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

$images = @(
    @{ name = "agro-frontend"; path = "poc/frontend"; dockerfile = "Dockerfile" }
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
Write-Host "║           BUILD & PUSH IMAGES TO LOCAL REGISTRY           ║" -ForegroundColor $Color.Info
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor $Color.Info
Write-Host ""

foreach ($img in $images) {
    $imageName = $img.name
    $imagePath = Join-Path $repoRoot $img.path
    $dockerfilePath = Join-Path $imagePath $img.dockerfile
    
    Write-Host "=== Building $imageName ===" -ForegroundColor $Color.Info
    Write-Host "   Path: $imagePath" -ForegroundColor $Color.Muted
    
    if (-not (Test-Path $dockerfilePath)) {
        Write-Host "   ⚠️  Dockerfile not found: $dockerfilePath" -ForegroundColor $Color.Warning
        continue
    }
    
    $tag = "localhost:$registryPort/${imageName}:latest"
    $k3dTag = "k3d-localhost:$registryPort/${imageName}:latest"
    
    docker build -t $tag -t $k3dTag -f $dockerfilePath $imagePath
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "   ❌ Build failed" -ForegroundColor $Color.Error
        continue
    }
    
    Write-Host "   ✅ Built: $tag" -ForegroundColor $Color.Success
    
    Write-Host "   Pushing to registry..." -ForegroundColor $Color.Muted
    docker push $tag
    docker push $k3dTag
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Pushed: $tag" -ForegroundColor $Color.Success
        Write-Host "   ✅ Pushed: $k3dTag" -ForegroundColor $Color.Success
    }
    else {
        Write-Host "   ❌ Push failed" -ForegroundColor $Color.Error
    }
    
    Write-Host ""
}

Write-Host "✅ Build & push complete!" -ForegroundColor $Color.Success
Write-Host ""
