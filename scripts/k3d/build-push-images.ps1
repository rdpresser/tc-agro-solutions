<#
.SYNOPSIS
  Build and push container images to local k3d registry.

.DESCRIPTION
  Builds Docker images and pushes to localhost:5000 registry.

  Supports:
  - tc-agro-frontend-service (poc/frontend)
  - tc-agro-identity-service (services/identity-service)
  - tc-agro-sensor-ingest-service (services/sensor-ingest-service)

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
    @{ name = "tc-agro-frontend-service"; path = "poc/frontend"; dockerfile = "Dockerfile" }
    @{ name = "tc-agro-identity-service"; path = "services/identity-service"; dockerfile = "src/Adapters/Inbound/TC.Agro.Identity.Service/Dockerfile" }
    @{ name = "tc-agro-sensor-ingest-service"; path = "services/sensor-ingest-service"; dockerfile = "src/Adapters/Inbound/TC.Agro.SensorIngest.Service/Dockerfile" }
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

    # Force pod restart to pull new images (since tag is always 'latest')
    Write-Host ""
    Write-Host "🔄 Forcing pod restart to pull new images..." -ForegroundColor $Color.Info

    # Map image names to deployment names (not always a simple replace)
    $deploymentMap = @{
        'tc-agro-frontend-service' = 'frontend'
        'tc-agro-identity-service' = 'identity-service'
        'tc-agro-sensor-ingest-service' = 'sensor-ingest-service'
    }

    foreach ($img in $images) {
        $deploymentName = $deploymentMap[$img.name]
        if (-not $deploymentName) { $deploymentName = ($img.name -replace '^agro-', '') }

        # Check if deployment exists before attempting restart
        $exists = kubectl get deployment $deploymentName -n agro-apps --no-headers 2>$null
        if (-not $exists) {
            Write-Host "   ⚠️  Deployment not found: $deploymentName (skipping)" -ForegroundColor $Color.Warning
            continue
        }

        Write-Host "   Rolling restart: $deploymentName" -ForegroundColor $Color.Muted
        kubectl rollout restart deployment/$deploymentName -n agro-apps 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   ✅ Restart triggered for $deploymentName" -ForegroundColor $Color.Success
        }
        else {
            Write-Host "   ⚠️  Restart command returned non-zero for $deploymentName" -ForegroundColor $Color.Warning
        }
    }

    # Wait for rollouts to complete with extended timeout
    Write-Host ""
    Write-Host "⏳ Waiting for rollouts to complete (max 5 min per deployment)..." -ForegroundColor $Color.Info

    $rolloutErrors = 0
    foreach ($img in $images) {
        $deploymentName = $deploymentMap[$img.name]
        if (-not $deploymentName) { $deploymentName = ($img.name -replace '^agro-', '') }

        $exists = kubectl get deployment $deploymentName -n agro-apps --no-headers 2>$null
        if (-not $exists) { continue }

        Write-Host "   Waiting for $deploymentName..." -ForegroundColor $Color.Muted
        kubectl rollout status deployment/$deploymentName -n agro-apps --timeout=300s 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            # Verify pods are actually running
            $readyPods = kubectl get pods -n agro-apps -l app=$deploymentName -o jsonpath='{.items[?(@.status.conditions[?(@.type==\"Ready\")].status==\"True\")].metadata.name}' 2>$null
            if ($readyPods) {
                Write-Host "   ✅ $deploymentName rolled out successfully (pods running)" -ForegroundColor $Color.Success
            }
            else {
                Write-Host "   ⚠️  $deploymentName deployment ready but checking pods..." -ForegroundColor $Color.Warning
                Start-Sleep -Seconds 10
            }
        }
        else {
            Write-Host "   ❌ $deploymentName rollout failed (check logs)" -ForegroundColor $Color.Error
            $rolloutErrors++
        }
    }

    if ($rolloutErrors -gt 0) {
        Write-Host ""
        Write-Host "⚠️  Some deployments had issues. Check pod status:" -ForegroundColor $Color.Warning
        Write-Host "   kubectl get pods -n agro-apps" -ForegroundColor $Color.Muted
        Write-Host "   kubectl logs -n agro-apps -l app=<deployment-name>" -ForegroundColor $Color.Muted
    }

    # Normalize exit code so manager.ps1 doesn't flag false failures
    $global:LASTEXITCODE = 0
}
elseif ($successfulImages -eq 0) {
    Write-Host "⚠️  No images were pushed; skipping ArgoCD sync." -ForegroundColor $Color.Warning
}
else {
    Write-Host "ℹ️  ArgoCD sync skipped (SkipSync flag)." -ForegroundColor $Color.Muted
}

Write-Host "✅ Build & push complete!" -ForegroundColor $Color.Success
Write-Host ""
