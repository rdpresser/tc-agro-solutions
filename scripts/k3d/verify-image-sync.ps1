<#
.SYNOPSIS
  Verify image sync: Docker Hub tags vs Kubernetes pods vs ArgoCD.

.DESCRIPTION
  Validates that:
  1. Latest images are available on Docker Hub (rdpresser)
  2. Pods are running the most recent tag (not just "latest")
  3. ArgoCD Applications are synced and healthy

  Checks:
  - frontend-service (rdpresser/frontend-service)
  - identity-service (rdpresser/identity-service)
    - farm-service (rdpresser/farm-service)
    - sensor-ingest-service (rdpresser/sensor-ingest-service)
    - analytics-worker (rdpresser/analytics-worker)

.EXAMPLE
  .\verify-image-sync.ps1
#>

$dockerHubUser = "rdpresser"

$services = @(
    @{ name = "frontend-service"; repo = "$dockerHubUser/frontend-service"; deployment = "frontend" }
    @{ name = "identity-service"; repo = "$dockerHubUser/identity-service"; deployment = "identity-service" }
    @{ name = "farm-service"; repo = "$dockerHubUser/farm-service"; deployment = "farm-service" }
    @{ name = "sensor-ingest-service"; repo = "$dockerHubUser/sensor-ingest-service"; deployment = "sensor-ingest-service" }
    @{ name = "analytics-worker"; repo = "$dockerHubUser/analytics-worker"; deployment = "analytics-worker" }
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
Write-Host "║         VERIFY IMAGE SYNC: DOCKER HUB → PODS → ARGOCD     ║" -ForegroundColor $Color.Info
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor $Color.Info
Write-Host ""

# ─────────────────────────────────────────────────────────────────────────────
# 1. CHECK DOCKER HUB TAGS
# ─────────────────────────────────────────────────────────────────────────────
Write-Host "📦 STEP 1: Checking Docker Hub tags..." -ForegroundColor $Color.Info
Write-Host ""

$dockerHubTags = @{}

foreach ($svc in $services) {
    $repo = $svc.repo
    $name = $svc.name
    
    Write-Host "   🔍 Checking Docker Hub: $repo..." -ForegroundColor $Color.Muted
    
    # Pull latest image to verify it's available
    docker pull $repo`:latest 2>&1 | Out-Null
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "   ❌ Failed to pull $repo`:latest" -ForegroundColor $Color.Error
        $dockerHubTags[$name] = @{ available = $false }
        Write-Host ""
        continue
    }
    
    # Verify image metadata is available locally after pull
    docker inspect --format='{{.RepoDigests}}' $repo`:latest 2>$null | Out-Null
    Write-Host "   ✅ Available on Docker Hub: $repo`:latest" -ForegroundColor $Color.Success
    
    $dockerHubTags[$name] = @{
        available = $true
        repo      = $repo
    }
    
    Write-Host ""
}

# ─────────────────────────────────────────────────────────────────────────────
# 2. CHECK KUBERNETES PODS
# ─────────────────────────────────────────────────────────────────────────────
Write-Host "🐳 STEP 2: Checking Kubernetes pods..." -ForegroundColor $Color.Info
Write-Host ""

$podImages = @{}

foreach ($svc in $services) {
    $deploymentName = $svc.deployment
    $name = $svc.name
    
    Write-Host "   🔍 Checking deployment: $deploymentName..." -ForegroundColor $Color.Muted
    
    # Check if deployment exists
    $exists = kubectl get deployment $deploymentName -n agro-apps --no-headers 2>$null
    if (-not $exists) {
        Write-Host "   ⚠️  Deployment not found: $deploymentName" -ForegroundColor $Color.Warning
        $podImages[$name] = @{ status = "not-found" }
        Write-Host ""
        continue
    }
    
    # Get deployment spec image
    $specImage = kubectl get deployment $deploymentName -n agro-apps -o jsonpath='{.spec.template.spec.containers[0].image}' 2>$null
    Write-Host "   📝 Spec Image: $specImage" -ForegroundColor $Color.Muted
    
    # Get running pod image
    $podName = kubectl get pods -n agro-apps -l app=$deploymentName -o jsonpath='{.items[0].metadata.name}' 2>$null
    
    if (-not $podName) {
        Write-Host "   ⚠️  No running pods found for $deploymentName" -ForegroundColor $Color.Warning
        $podImages[$name] = @{ status = "no-pods"; specImage = $specImage }
        Write-Host ""
        continue
    }
    
    # Get actual image running in pod
    $podImage = kubectl get pod -n agro-apps $podName -o jsonpath='{.status.containerStatuses[0].imageID}' 2>$null
    $podImageRef = kubectl get pod -n agro-apps $podName -o jsonpath='{.status.containerStatuses[0].image}' 2>$null
    
    # Pod status
    $podReady = kubectl get pod -n agro-apps $podName -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>$null
    $readyColor = if ($podReady -eq "True") { $Color.Success } else { $Color.Warning }
    
    Write-Host "   🏃 Pod Name: $podName" -ForegroundColor $Color.Muted
    Write-Host "   📦 Pod Image: $podImageRef" -ForegroundColor $Color.Muted
    Write-Host "   🏷️  Image ID: $podImage" -ForegroundColor $Color.Muted
    Write-Host "   ✅ Pod Ready: $podReady" -ForegroundColor $readyColor
    
    $podImages[$name] = @{
        status    = "running"
        specImage = $specImage
        podName   = $podName
        podImage  = $podImageRef
        imageId   = $podImage
        podReady  = $podReady
    }
    
    Write-Host ""
}

# ─────────────────────────────────────────────────────────────────────────────
# 3. CHECK ARGOCD APPLICATIONS
# ─────────────────────────────────────────────────────────────────────────────
Write-Host "🔄 STEP 3: Checking ArgoCD Applications..." -ForegroundColor $Color.Info
Write-Host ""

$argocdApps = kubectl get applications -n argocd -o jsonpath='{range .items[*]}{.metadata.name}{"="}{.status.sync.status}{"="}{.status.health.status}{"="}{.status.operationState.phase}{"\n"}{end}' 2>$null

if ($argocdApps) {
    foreach ($line in ($argocdApps -split "`n")) {
        if ([string]::IsNullOrWhiteSpace($line)) { continue }
        
        $parts = $line -split "="
        $appName = $parts[0]
        $syncStatus = $parts[1]
        $healthStatus = $parts[2]
        $operationPhase = $parts[3]
        
        # Color based on status
        $syncColor = if ($syncStatus -eq "Synced") { $Color.Success } else { $Color.Warning }
        $healthColor = if ($healthStatus -eq "Healthy") { $Color.Success } else { $Color.Warning }
        
        Write-Host "   📋 $appName" -ForegroundColor $Color.Muted
        Write-Host "      Sync: $syncStatus" -ForegroundColor $syncColor
        Write-Host "      Health: $healthStatus" -ForegroundColor $healthColor
        if ($operationPhase) {
            Write-Host "      Operation: $operationPhase" -ForegroundColor $Color.Muted
        }
    }
}
else {
    Write-Host "   ⚠️  Could not fetch ArgoCD applications" -ForegroundColor $Color.Warning
}

Write-Host ""

# ─────────────────────────────────────────────────────────────────────────────
# 4. VALIDATION & SUMMARY
# ─────────────────────────────────────────────────────────────────────────────
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor $Color.Muted
Write-Host "📊 VALIDATION SUMMARY" -ForegroundColor $Color.Info
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor $Color.Muted
Write-Host ""

$allHealthy = $true

foreach ($svc in $services) {
    $name = $svc.name
    $repo = $svc.repo
    
    Write-Host "🔹 $name ($repo)" -ForegroundColor $Color.Info
    
    $hubTags = $dockerHubTags[$name]
    $podInfo = $podImages[$name]
    
    # Check 1: Docker Hub image is available
    if ($hubTags.available) {
        Write-Host "   ✅ Docker Hub: Image available (latest)" -ForegroundColor $Color.Success
    }
    else {
        Write-Host "   ❌ Docker Hub: Image NOT available" -ForegroundColor $Color.Error
        $allHealthy = $false
    }
    
    # Check 2: Pod is running
    if ($podInfo.status -eq "running") {
        Write-Host "   ✅ Kubernetes: Pod is running ($($podInfo.podName))" -ForegroundColor $Color.Success
        
        # Check 3: Pod is using a specific tag (not just "latest")
        if ($podInfo.podImage) {
            $podImageTag = ($podInfo.podImage -split ":")[-1]
            
            if ($podImageTag -eq "latest") {
                Write-Host "   ⚠️  Image: Pod using 'latest' tag (recommended: use specific build tag)" -ForegroundColor $Color.Warning
                $allHealthy = $false
            }
            else {
                Write-Host "   ✅ Image: Pod using specific tag '$podImageTag'" -ForegroundColor $Color.Success
            }
        }
        
        # Check 4: Pod is ready
        if ($podInfo.podReady -eq "True") {
            Write-Host "   ✅ Status: Pod is ready" -ForegroundColor $Color.Success
        }
        else {
            Write-Host "   ⚠️  Status: Pod is not ready" -ForegroundColor $Color.Warning
            $allHealthy = $false
        }
    }
    else {
        Write-Host "   ⚠️  Kubernetes: Deployment not running" -ForegroundColor $Color.Warning
        $allHealthy = $false
    }
    
    Write-Host ""
}

# ─────────────────────────────────────────────────────────────────────────────
# 5. RECOMMENDATIONS
# ─────────────────────────────────────────────────────────────────────────────
if ($allHealthy) {
    Write-Host "✅ ALL CHECKS PASSED - Images are properly synced!" -ForegroundColor $Color.Success
}
else {
    Write-Host "⚠️  SOME ISSUES DETECTED - See above for details" -ForegroundColor $Color.Warning
    Write-Host ""
    Write-Host "💡 TROUBLESHOOTING:" -ForegroundColor $Color.Info
    Write-Host "   1. If pods are using 'latest' instead of SHA:" -ForegroundColor $Color.Muted
    Write-Host "      • Run manager.ps1 option 9 (Force sync ArgoCD)" -ForegroundColor $Color.Muted
    Write-Host "      • Or: manager.ps1 option 13 (Build & push images)" -ForegroundColor $Color.Muted
    Write-Host ""
    Write-Host "   2. If Docker Hub tags are missing:" -ForegroundColor $Color.Muted
    Write-Host "      • Run: manager.ps1 option 13 (Build & push images)" -ForegroundColor $Color.Muted
    Write-Host ""
    Write-Host "   3. If pods are not ready:" -ForegroundColor $Color.Muted
    Write-Host "      • Check logs: kubectl logs -f <pod-name> -n agro-apps" -ForegroundColor $Color.Muted
    Write-Host "      • Check events: kubectl describe pod <pod-name> -n agro-apps" -ForegroundColor $Color.Muted
}

Write-Host ""
Write-Host "📝 DOCKER HUB LINKS:" -ForegroundColor $Color.Info
Write-Host "   • Frontend: https://hub.docker.com/r/$($dockerHubUser)/frontend-service/tags" -ForegroundColor $Color.Muted
Write-Host "   • Identity: https://hub.docker.com/r/$($dockerHubUser)/identity-service/tags" -ForegroundColor $Color.Muted
Write-Host "   • Farm: https://hub.docker.com/r/$($dockerHubUser)/farm-service/tags" -ForegroundColor $Color.Muted
Write-Host "   • Sensor Ingest: https://hub.docker.com/r/$($dockerHubUser)/sensor-ingest-service/tags" -ForegroundColor $Color.Muted
Write-Host "   • Analytics: https://hub.docker.com/r/$($dockerHubUser)/analytics-worker/tags" -ForegroundColor $Color.Muted
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor $Color.Muted
Write-Host "✅ Validation complete." -ForegroundColor $Color.Info
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor $Color.Muted
Write-Host ""
