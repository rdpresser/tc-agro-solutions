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

param(
    [ValidateSet("all", "platform", "apps")]
    [string]$SyncTarget = "apps",
    [switch]$SkipSync
)

$registryPort = 5000
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

$images = @(
    @{ name = "agro-frontend"; path = "poc/frontend"; dockerfile = "Dockerfile" }
    @{ name = "agro-identity-service"; path = "services/identity-service"; dockerfile = "src/Adapters/Inbound/TC.Agro.Identity.Service/Dockerfile" }
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

$successfulImages = 0

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
    
    # Determine build context: nested Dockerfiles build from repo root
    if ($img.dockerfile -like "*/*") {
        $buildContext = $repoRoot
        Write-Host "   Building from repo root (nested Dockerfile)" -ForegroundColor $Color.Muted
    }
    else {
        $buildContext = $imagePath
        Write-Host "   Building from service path" -ForegroundColor $Color.Muted
    }

    # Build with both tags (for local docker and k3d cluster reference)
    docker build -t $tag -t $k3dTag -f $dockerfilePath $buildContext
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "   ❌ Build failed" -ForegroundColor $Color.Error
        continue
    }
    
    Write-Host "   ✅ Built: $tag" -ForegroundColor $Color.Success
    Write-Host "   ✅ Tagged: $k3dTag (for in-cluster pulls)" -ForegroundColor $Color.Success
    
    # Push only to localhost:5000 (k3d registry mirrors this internally as k3d-localhost:5000)
    Write-Host "   Pushing to registry..." -ForegroundColor $Color.Muted
    docker push $tag
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Pushed: $tag" -ForegroundColor $Color.Success
        Write-Host "   ℹ️  k3d cluster will pull via: $k3dTag" -ForegroundColor $Color.Muted
        $successfulImages++
    }
    else {
        Write-Host "   ❌ Push failed" -ForegroundColor $Color.Error
    }
    
    Write-Host ""
}

if (-not $SkipSync -and $successfulImages -gt 0) {
    $syncScript = Join-Path $PSScriptRoot "sync-argocd.ps1"
    if (Test-Path $syncScript) {
        Write-Host "🔄 Triggering ArgoCD sync ($SyncTarget)..." -ForegroundColor $Color.Info
        & $syncScript $SyncTarget
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ ArgoCD sync triggered." -ForegroundColor $Color.Success
        }
        else {
            Write-Host "⚠️  ArgoCD sync returned exit code $LASTEXITCODE" -ForegroundColor $Color.Warning
        }
    }
    else {
        Write-Host "⚠️  sync-argocd.ps1 not found at $syncScript" -ForegroundColor $Color.Warning
    }
}
elseif ($successfulImages -eq 0) {
    Write-Host "⚠️  No images were pushed; skipping ArgoCD sync." -ForegroundColor $Color.Warning
}
else {
    Write-Host "ℹ️  ArgoCD sync skipped (SkipSync flag)." -ForegroundColor $Color.Muted
}

Write-Host "✅ Build & push complete!" -ForegroundColor $Color.Success
Write-Host ""

