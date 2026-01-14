<#
.SYNOPSIS
  Builds and pushes Docker images to local registry.

.DESCRIPTION
  For now: builds frontend image (poc/frontend/Dockerfile)
  
  Future: Add Agro API services as they become available
  - Agro.Identity.Api
  - Agro.Farm.Api
  - Agro.Sensor.Ingest.Api
  - Agro.Analytics.Worker
  - Agro.Dashboard.Api

.NOTES
  Registry: localhost:5000
  Images tagged as :dev
  Uses k3d import (loads directly into cluster) instead of pushing

.EXAMPLE
  .\build-push-images.ps1
#>

$ErrorActionPreference = "Stop"

$registryName = "localhost"
$registryPort = 5000
$clusterName = "dev"
$Color = @{
    Title    = "Cyan"
    Success  = "Green"
    Warning  = "Yellow"
    Error    = "Red"
    Info     = "White"
}

function Write-Title {
    param([string]$Text)
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor $Color.Title
    Write-Host "║  $Text" -ForegroundColor $Color.Title
    Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor $Color.Title
}

# Image list: (name, dockerfile_path, build_context)
$images = @(
    @{
        name       = "agro-frontend"
        dockerfile = "poc/frontend/Dockerfile"
        context    = "."
        description = "Frontend Dashboard POC"
    }
    # TODO: Add Agro APIs as they become available
    # @{
    #     name        = "agro-identity"
    #     dockerfile  = "services/identity-service/Dockerfile"
    #     context     = "services/identity-service"
    #     description = "Identity & Auth API"
    # }
    # @{
    #     name        = "agro-farm"
    #     dockerfile  = "services/farm-service/Dockerfile"
    #     context     = "services/farm-service"
    #     description = "Farm Properties & Plots API"
    # }
    # @{
    #     name        = "agro-sensor-ingest"
    #     dockerfile  = "services/sensor-ingest-service/Dockerfile"
    #     context     = "services/sensor-ingest-service"
    #     description = "Sensor Data Ingestion API"
    # }
    # @{
    #     name        = "agro-analytics"
    #     dockerfile  = "services/analytics-worker/Dockerfile"
    #     context     = "services/analytics-worker"
    #     description = "Analytics & Alerts Worker"
    # }
    # @{
    #     name        = "agro-dashboard"
    #     dockerfile  = "services/dashboard-service/Dockerfile"
    #     context     = "services/dashboard-service"
    #     description = "Dashboard Read-Only API"
    # }
)

Write-Title "Building & Loading Docker Images"
Write-Host "Registry: $registryName`:$registryPort" -ForegroundColor $Color.Muted
Write-Host "Cluster: $clusterName" -ForegroundColor $Color.Muted
Write-Host ""

# Check Docker
Write-Host "Checking Docker..." -ForegroundColor $Color.Info
try {
    docker info | Out-Null
    Write-Host "✅ Docker is running" -ForegroundColor $Color.Success
} catch {
    Write-Host "❌ Docker is not running" -ForegroundColor $Color.Error
    exit 1
}

# Check cluster
Write-Host "Checking k3d cluster..." -ForegroundColor $Color.Info
$clusterExists = k3d cluster list 2>$null | Select-String -Pattern "^$clusterName\s"
if (-not $clusterExists) {
    Write-Host "❌ Cluster '$clusterName' does not exist" -ForegroundColor $Color.Error
    exit 1
}
Write-Host "✅ Cluster '$clusterName' exists" -ForegroundColor $Color.Success

# Build & load each image
foreach ($image in $images) {
    $imageName = $image.name
    $dockerfile = $image.dockerfile
    $context = $image.context
    $description = $image.description
    $fullImageTag = "$registryName`:$registryPort/$imageName`:dev"
    
    Write-Host ""
    Write-Host "📦 Building: $imageName ($description)" -ForegroundColor $Color.Info
    
    # Check if Dockerfile exists
    if (-not (Test-Path $dockerfile)) {
        Write-Host "⚠️  Dockerfile not found: $dockerfile" -ForegroundColor $Color.Warning
        Write-Host "   Skipping $imageName" -ForegroundColor $Color.Muted
        continue
    }
    
    # Build image
    Write-Host "   Building: docker build -f $dockerfile -t $fullImageTag $context" -ForegroundColor $Color.Muted
    docker build -f $dockerfile -t $fullImageTag $context
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Build failed for $imageName" -ForegroundColor $Color.Error
        continue
    }
    
    Write-Host "   ✅ Build successful" -ForegroundColor $Color.Success
    
    # Load into k3d (imports the image directly into the cluster)
    Write-Host "   Loading into k3d cluster..." -ForegroundColor $Color.Muted
    k3d image import "$fullImageTag" -c $clusterName
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "⚠️  Failed to import image into k3d. Image is in Docker but not in cluster." -ForegroundColor $Color.Warning
    } else {
        Write-Host "   ✅ Image loaded into cluster" -ForegroundColor $Color.Success
    }
}

Write-Host ""
Write-Host "✅ Build & load complete!" -ForegroundColor $Color.Success
Write-Host ""
Write-Host "Images available in k3d registry:" -ForegroundColor $Color.Info
Write-Host "  - $registryName`:$registryPort/agro-frontend:dev" -ForegroundColor $Color.Muted
Write-Host ""
Write-Host "Use in Kubernetes manifests (Deployment/Pod):" -ForegroundColor $Color.Info
Write-Host "  image: $registryName`:$registryPort/agro-frontend:dev" -ForegroundColor $Color.Muted
Write-Host "  imagePullPolicy: IfNotPresent" -ForegroundColor $Color.Muted
Write-Host ""
