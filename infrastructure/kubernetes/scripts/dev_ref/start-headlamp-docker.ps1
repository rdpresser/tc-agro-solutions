<#
.SYNOPSIS
  Starts Headlamp Kubernetes UI in Docker.
.DESCRIPTION
  Creates a temporary kubeconfig and starts the Headlamp container
  pointing to the local k3d cluster.
.EXAMPLE
  .\start-headlamp-docker.ps1
#>

# Temporary path to store kubeconfig compatible with the container
$kubeTemp = "$env:TEMP\kubeconfig-headlamp"

# 1️⃣ Generate a complete copy of the current kubeconfig
# --raw keeps the original tokens and certificates
kubectl config view --raw | Out-File -FilePath $kubeTemp -Encoding utf8

# 2️⃣ Check if the file was generated correctly
if (-Not (Test-Path $kubeTemp)) {
    Write-Host "❌ Error: could not generate temporary kubeconfig." -ForegroundColor Red
    exit 1
}

# 3️⃣ Show the path (chmod not needed on Windows)
Write-Host "✅ Temporary kubeconfig file created at: $kubeTemp" -ForegroundColor Green

# 4️⃣ Stop and remove any previous Headlamp container
docker stop headlamp 2>$null | Out-Null
docker rm headlamp 2>$null | Out-Null

# 5️⃣ Start the Headlamp container pointing to the temporary kubeconfig
docker run -d `
  --name headlamp `
  -p 4466:4466 `
  -v "${kubeTemp}:/root/.kube/config:ro" `
  -e KUBECONFIG=/root/.kube/config `
  ghcr.io/headlamp-k8s/headlamp:latest | Out-Null

# 6️⃣ Wait for the Headlamp backend to start
Write-Host "🚀 Starting Headlamp... wait a few seconds." -ForegroundColor Cyan
Start-Sleep -Seconds 3

# 7️⃣ Automatically open in default browser
Start-Process "http://localhost:4466"

# 8️⃣ Show container status
docker ps --filter "name=headlamp"
