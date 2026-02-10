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
    @{ name = "farm-service"; path = "services/farm-service"; dockerfile = "src/Adapters/Inbound/TC.Agro.Farm.Service/Dockerfile"; repo = "$dockerHubUser/farm-service" }
    # @{ name = "tc-agro-sensor-ingest-service"; path = "services/sensor-ingest-service"; dockerfile = "src/Adapters/Inbound/TC.Agro.SensorIngest.Service/Dockerfile" }
)

$Color = @{
    Success = "Green"
    Error   = "Red"
    Info    = "Cyan"
    Warning = "Yellow"
    Muted   = "Gray"
}

function Update-GitOpsManifest {
    param(
        [string]$ServiceName,
        [string]$ImageTag,
        [string]$RepoRoot
    )

    $manifestMap = @{
        "frontend-service" = "infrastructure/kubernetes/apps/base/frontend/deployment.yaml"
        "identity-service" = "infrastructure/kubernetes/apps/base/identity/deployment.yaml"
        "farm-service"     = "infrastructure/kubernetes/apps/base/farm/deployment.yaml"
    }

    $manifestPath = $manifestMap[$ServiceName]
    if (-not $manifestPath) {
        Write-Host "   ⚠️  No manifest mapping for $ServiceName" -ForegroundColor $Color.Warning
        return $false
    }

    $fullManifestPath = Join-Path $RepoRoot $manifestPath
    if (-not (Test-Path $fullManifestPath)) {
        Write-Host "   ⚠️  Manifest not found: $manifestPath" -ForegroundColor $Color.Warning
        return $false
    }

    Write-Host "   🔄 Updating GitOps manifest..." -ForegroundColor $Color.Info
    Write-Host "      File: $manifestPath" -ForegroundColor $Color.Muted

    # Read, update, and write manifest
    $content = Get-Content $fullManifestPath -Raw
    $newImage = "rdpresser/${ServiceName}:${ImageTag}"
    $pattern = "image:\s+rdpresser/${ServiceName}:\S+"
    $replacement = "image: $newImage"
    
    if ($content -match $pattern) {
        $updatedContent = $content -replace $pattern, $replacement
        Set-Content -Path $fullManifestPath -Value $updatedContent -NoNewline
        Write-Host "      ✅ Updated image to: $newImage" -ForegroundColor $Color.Success
    }
    else {
        Write-Host "      ⚠️  Could not find image line to update" -ForegroundColor $Color.Warning
        return $false
    }

    # Git commit and push
    Write-Host "      📝 Committing changes..." -ForegroundColor $Color.Muted
    
    Push-Location $RepoRoot
    try {
        git config user.name "Local Build Script" 2>&1 | Out-Null
        git config user.email "build-script@local" 2>&1 | Out-Null
        
        git add $manifestPath 2>&1 | Out-Null
        
        $commitMsg = @"
ci($ServiceName): update image to $ImageTag

Automated commit from local build-push-images.ps1
Tag: $ImageTag
"@
        
        git commit -m $commitMsg 2>&1 | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "      ✅ Changes committed" -ForegroundColor $Color.Success
            
            Write-Host "      🔄 Pulling latest changes..." -ForegroundColor $Color.Muted
            $pullOutput = git pull --rebase origin main 2>&1
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "      ✅ Pull successful" -ForegroundColor $Color.Success
                Write-Host "      📤 Pushing to remote..." -ForegroundColor $Color.Muted
                $pushOutput = git push origin main 2>&1
                
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "      ✅ GitOps manifest updated successfully!" -ForegroundColor $Color.Success
                    return $true
                }
                else {
                    Write-Host "      ❌ Failed to push to remote" -ForegroundColor $Color.Error
                    Write-Host "      💡 Error: $($pushOutput -join ' ')" -ForegroundColor $Color.Muted
                    return $false
                }
            }
            else {
                # Check if it's "Already up to date"
                if ($pullOutput -match "Already up to date|Current branch .* is up to date") {
                    Write-Host "      ✅ Already up to date, pushing..." -ForegroundColor $Color.Success
                    $pushOutput = git push origin main 2>&1
                    
                    if ($LASTEXITCODE -eq 0) {
                        Write-Host "      ✅ GitOps manifest updated successfully!" -ForegroundColor $Color.Success
                        return $true
                    }
                    else {
                        Write-Host "      ❌ Failed to push to remote" -ForegroundColor $Color.Error
                        Write-Host "      💡 Error: $($pushOutput -join ' ')" -ForegroundColor $Color.Muted
                        return $false
                    }
                }
                else {
                    Write-Host "      ❌ Failed to pull/rebase" -ForegroundColor $Color.Error
                    Write-Host "      💡 Error: $($pullOutput -join ' ')" -ForegroundColor $Color.Muted
                    Write-Host "      💡 Try: git pull --rebase origin main (manually resolve conflicts)" -ForegroundColor $Color.Warning
                    return $false
                }
            }
        }
        else {
            Write-Host "      ℹ️  No changes to commit (already up to date)" -ForegroundColor $Color.Muted
            return $true
        }
    }
    finally {
        Pop-Location
    }
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

    # Build with both tags (with retry on network errors)
    Write-Host "   Building with tags: latest, $gitSha" -ForegroundColor $Color.Muted
    
    $buildSuccess = $false
    $maxRetries = 2
    for ($i = 0; $i -lt $maxRetries; $i++) {
        if ($i -gt 0) {
            Write-Host "   🔄 Retry attempt $($i + 1)/$maxRetries..." -ForegroundColor $Color.Warning
            Start-Sleep -Seconds 5
        }
        
        docker build -t $tag_latest -t $tag_sha -f $dockerfilePath $buildContext
        
        if ($LASTEXITCODE -eq 0) {
            $buildSuccess = $true
            break
        }
    }

    if (-not $buildSuccess) {
        Write-Host "   ❌ Build FAILED after $maxRetries attempts" -ForegroundColor $Color.Error
        Write-Host "   💡 Run: .\fix-docker-mcr.ps1" -ForegroundColor $Color.Warning
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
    
    # Update GitOps manifest (fallback when CI is not used)
    $gitopsSuccess = Update-GitOpsManifest -ServiceName $imageName -ImageTag $gitSha -RepoRoot $repoRoot
    if (-not $gitopsSuccess) {
        Write-Host "   ⚠️  GitOps manifest update failed, but image was pushed successfully" -ForegroundColor $Color.Warning
    }
    
    $successfulImages++
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor $Color.Muted
Write-Host "📊 Build Summary: $successfulImages/$($images.Count) successful" -ForegroundColor $Color.Info

if ($successfulImages -eq 0) {
    Write-Host "❌ No images built successfully" -ForegroundColor $Color.Error
    exit 1
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor $Color.Muted
Write-Host "🎯 GitOps Fallback Strategy:" -ForegroundColor $Color.Info
Write-Host "   ✅ Manifests updated locally with new tags" -ForegroundColor $Color.Success
Write-Host "   ✅ Changes committed and pushed to main branch" -ForegroundColor $Color.Success
Write-Host "   🔄 ArgoCD will detect changes and reconcile automatically" -ForegroundColor $Color.Muted
Write-Host ""
Write-Host "   💡 Prefer using CI pipelines (frontend-ci.yml, identity-ci.yml)" -ForegroundColor $Color.Muted
Write-Host "      This script serves as local fallback/testing tool" -ForegroundColor $Color.Muted
Write-Host ""
Write-Host "✅ Build, push & GitOps update complete!" -ForegroundColor $Color.Success
Write-Host ""
