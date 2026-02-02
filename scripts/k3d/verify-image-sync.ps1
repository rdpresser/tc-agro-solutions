<#
.SYNOPSIS
  Verify image synchronization between Docker registry and k3d cluster.

.DESCRIPTION
  Compares image IDs in:
  - Docker Desktop (localhost:5000 registry)
  - k3d nodes (cached images)
  - Running pods (actual running images)

.EXAMPLE
  .\verify-image-sync.ps1
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
Write-Host "║          IMAGE SYNCHRONIZATION VERIFICATION                ║" -ForegroundColor $Color.Info
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor $Color.Info
Write-Host ""

$images = @("tc-agro-identity-service", "tc-agro-sensor-ingest-service", "tc-agro-frontend-service")
$deploymentMap = @{
    'tc-agro-frontend-service'      = 'frontend'
    'tc-agro-identity-service'      = 'identity-service'
    'tc-agro-sensor-ingest-service' = 'sensor-ingest-service'
}

foreach ($imageName in $images) {
    Write-Host "=== $imageName ===" -ForegroundColor $Color.Info
    Write-Host ""

    # 1. Docker Desktop (registry image)
    $registryTag = "localhost:5000/${imageName}:latest"
    $registryImageId = docker images --no-trunc --format "{{.ID}}" $registryTag 2>$null
    if ($registryImageId) {
        Write-Host "   📦 Docker Registry: $($registryImageId.Substring(7, 12))..." -ForegroundColor $Color.Success
    }
    else {
        Write-Host "   ❌ Docker Registry: Image not found!" -ForegroundColor $Color.Error
    }

    # 2. k3d nodes (cached images)
    Write-Host "   🖥️  k3d Nodes Cache:" -ForegroundColor $Color.Muted
    $k3dNodes = @("k3d-tc-agro-gitops-server-0", "k3d-tc-agro-gitops-agent-0", "k3d-tc-agro-gitops-agent-1", "k3d-tc-agro-gitops-agent-2")
    $k3dImageTag = "k3d-localhost:5000/${imageName}:latest"
    
    foreach ($node in $k3dNodes) {
        $nodeImageId = docker exec $node crictl images --no-trunc 2>$null | Select-String -Pattern $k3dImageTag
        if ($nodeImageId) {
            $idMatch = $nodeImageId -match "sha256:([a-f0-9]+)"
            if ($idMatch) {
                $shortId = $Matches[1].Substring(0, 12)
                Write-Host "      - $node : $shortId..." -ForegroundColor $Color.Muted
            }
        }
        else {
            Write-Host "      - $node : Not cached" -ForegroundColor $Color.Warning
        }
    }

    # 3. Running pod (actual running image)
    $deploymentName = $deploymentMap[$imageName]
    $podImageId = kubectl get pods -n agro-apps -l app=$deploymentName -o jsonpath='{.items[0].status.containerStatuses[0].imageID}' 2>$null
    if ($podImageId) {
        # Extract short ID from full imageID (format: k3d-localhost:5000/tc-agro-identity-service@sha256:...)
        $podImageId -match "sha256:([a-f0-9]+)"
        if ($Matches) {
            $shortId = $Matches[1].Substring(0, 12)
            Write-Host "   🏃 Running Pod:    $shortId..." -ForegroundColor $Color.Success
        }
        else {
            Write-Host "   🏃 Running Pod:    $podImageId" -ForegroundColor $Color.Success
        }
    }
    else {
        Write-Host "   ⚠️  Running Pod:    No pods found!" -ForegroundColor $Color.Warning
    }

    # 4. Deployment image pull policy
    $imagePullPolicy = kubectl get deployment $deploymentName -n agro-apps -o jsonpath='{.spec.template.spec.containers[0].imagePullPolicy}' 2>$null
    Write-Host "   ⚙️  ImagePullPolicy: $imagePullPolicy" -ForegroundColor $(if ($imagePullPolicy -eq "Always") { $Color.Success } else { $Color.Warning })

    Write-Host ""
}

Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor $Color.Info
Write-Host "║                        SUMMARY                             ║" -ForegroundColor $Color.Info
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor $Color.Info
Write-Host ""
Write-Host "✅ Images are in sync when Registry, Nodes, and Pod IDs match" -ForegroundColor $Color.Success
Write-Host "⚠️  Images are OUT OF SYNC when IDs differ" -ForegroundColor $Color.Warning
Write-Host ""
Write-Host "📋 To force sync:" -ForegroundColor $Color.Info
Write-Host "   1. Run: .\manager.ps1 -> Option 13 (Build & push images)" -ForegroundColor $Color.Muted
Write-Host "   2. OR: .\build-push-images.ps1" -ForegroundColor $Color.Muted
Write-Host ""
