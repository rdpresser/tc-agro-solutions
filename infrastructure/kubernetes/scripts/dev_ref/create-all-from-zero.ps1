<#
.SYNOPSIS
  Creates local k3d cluster with native Ingress port mapping and installs core services.
  
.DESCRIPTION
  This script creates a complete local development environment with:
  - K3d cluster with 8GB RAM per node
  - Native port mapping (80:80, 443:443) for Ingress - NO port-forward needed!
  - Local Docker registry (localhost:5000)
  - ArgoCD (admin / Argo@123)
  - KEDA for autoscaling
  - Prometheus + Grafana monitoring (rdpresser / rdpresser@123)
  
  Requirements: k3d, kubectl, helm, docker
  
.EXAMPLE
  .\create-all-from-zero.ps1
  
.NOTES
  Port Mapping Feature: This script configures native port mapping (80:80@loadbalancer)
  so your Ingress works WITHOUT port-forward scripts. Just add to hosts file:
    127.0.0.1 cloudgames.local
  
  Then access: http://cloudgames.local/user, /games, /payments
#>

# === Configuration ===
$clusterName = "dev"
$registryName = "localhost"
$registryPort = 5000
$serverCount = 1
$agentCount = 2
$memoryPerNode = "8g"
$agentMemory = "8g"
$argocdAdminNewPassword = "Argo@123"
$grafanaAdminPassword = "Grafana@123"
$grafanaNewUser = "rdpresser"
$grafanaNewUserEmail = "rodrigo.presser@gmail.com"
$grafanaNewUserPassword = "rdpresser@123"


# === 0) Checking dependencies ===
Write-Host "=== 0) Checking dependencies: kubectl, helm, k3d, docker ==="
foreach ($cmd in @("k3d","kubectl","helm","docker")) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        Write-Host "ERROR: command '$cmd' not found in PATH. Install before continuing." -ForegroundColor Red
        exit 1
    }
}

# === 0.1) Stop existing port-forwards ===
Write-Host "=== 0.1) Stopping existing port-forwards to free up ports ==="
if (Test-Path ".\stop-port-forward.ps1") {
    .\stop-port-forward.ps1 all
} else {
    Write-Host "Warning: stop-port-forward.ps1 not found. Make sure ports 8090 and 3000 are free." -ForegroundColor Yellow
}

# === 1) Create registry if needed ===
Write-Host "=== 1) Checking local registry ($registryName`:$registryPort) ==="
$regList = k3d registry list
if ($regList -notmatch $registryName) {
    Write-Host "Creating registry $registryName`:$registryPort"
    k3d registry create $registryName --port $registryPort
} else {
    Write-Host "Registry $registryName already exists. Skipping."
}

# === 2) Delete cluster if exists ===
Write-Host "=== 2) Deleting cluster $clusterName (if exists) ==="
k3d cluster list | Select-String -Pattern "^$clusterName\s" | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "Cluster $clusterName exists. Deleting..."
    k3d cluster delete $clusterName
} else {
    Write-Host "Cluster $clusterName does not exist. Skipping delete."
}

# === 3) Create cluster with native Ingress port mapping ===
Write-Host "=== 3) Creating cluster $clusterName with native port mapping (80:80, 443:443)..."
Write-Host "   ℹ️  Port mapping means Ingress works WITHOUT port-forward scripts!" -ForegroundColor Cyan
Write-Host "   ℹ️  Just add to hosts file: 127.0.0.1 cloudgames.local" -ForegroundColor Cyan
Write-Host ""

k3d cluster create $clusterName --servers $serverCount --agents $agentCount `
  --port "80:80@loadbalancer" --port "443:443@loadbalancer" `
  --servers-memory $memoryPerNode --agents-memory $agentMemory `
  --registry-use "$registryName`:$registryPort"

if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to create cluster. Exiting." -ForegroundColor Red
    exit 1
}

Write-Host "Waiting for cluster to be ready..." -ForegroundColor Cyan
Start-Sleep -Seconds 15

# Set kubectl context
kubectl config use-context "k3d-$clusterName"

# Fix for WSL2: replace host.docker.internal with 127.0.0.1
Write-Host "Adjusting kubeconfig to use 127.0.0.1..." -ForegroundColor Cyan
$serverUrl = kubectl config view -o json | ConvertFrom-Json |
    ForEach-Object { $_.clusters | Where-Object { $_.name -eq "k3d-$clusterName" } } |
    ForEach-Object { $_.cluster.server }

if ($serverUrl -match "host.docker.internal:(\d+)") {
    $port = $matches[1]
    kubectl config set-cluster "k3d-$clusterName" --server="https://127.0.0.1:$port" | Out-Null
    Write-Host "✅ Kubeconfig adjusted to https://127.0.0.1:$port" -ForegroundColor Green
}

# Validate connectivity with cluster API (retry with timeout)
Write-Host "Validating Kubernetes API connectivity..." -ForegroundColor Cyan
$apiReady = $false
for ($i=0; $i -lt 30; $i++) {
    try {
        kubectl cluster-info 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            $apiReady = $true
            Write-Host "✅ Kubernetes API accessible" -ForegroundColor Green
            break
        }
    } catch {}
    Write-Host "   Attempt $($i+1)/30: API not ready yet..." -ForegroundColor Gray
    Start-Sleep -Seconds 5
}

if (-not $apiReady) {
    Write-Host "❌ ERROR: Kubernetes API did not respond after 2.5 minutes" -ForegroundColor Red
    Write-Host "   Try the following steps:" -ForegroundColor Yellow
    Write-Host "   1. Restart Docker Desktop" -ForegroundColor Yellow
    Write-Host "   2. Run: k3d cluster delete $clusterName" -ForegroundColor Yellow
    Write-Host "   3. Run this script again" -ForegroundColor Yellow
    exit 1
}

# === 4) Create basic namespaces ===
Write-Host "=== 4) Creating namespaces: argocd, monitoring, keda, users ==="
foreach ($ns in @("argocd","monitoring","keda","users")) {
    kubectl create namespace $ns --dry-run=client -o yaml | kubectl apply --validate=false -f -
}

# === 5) Install Argo CD via Helm ===
Write-Host "=== 5) Installing Argo CD ==="

# Validate cluster before installing
kubectl get nodes | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Cluster is not accessible. Aborting." -ForegroundColor Red
    exit 1
}

helm repo add argo https://argoproj.github.io/argo-helm 2>$null
helm repo update
helm upgrade --install argocd argo/argo-cd -n argocd `
    --create-namespace `
    --set server.service.type=LoadBalancer `
    --set server.ingress.enabled=false `
    --set configs.params."server\.insecure"=true

Write-Host "Waiting for ArgoCD pods to be ready..."
Start-Sleep -Seconds 10

# Apply ArgoCD Ingress for native access (no port-forward needed)
Write-Host "Applying ArgoCD Ingress (argocd.local)..."
$manifestsPath = Join-Path (Split-Path $PSScriptRoot -Parent) "manifests"
kubectl apply -f "$manifestsPath\argocd-ingress.yaml"
Write-Host "✅ ArgoCD Ingress applied (access via http://argocd.local after updating hosts file)" -ForegroundColor Green

# === 6) Install KEDA ===
Write-Host "=== 6) Installing KEDA ==="

# Validate cluster before installing
kubectl get nodes | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Cluster is not accessible. Aborting." -ForegroundColor Red
    exit 1
}

helm repo add kedacore https://kedacore.github.io/charts 2>$null
helm repo update
helm upgrade --install keda kedacore/keda -n keda --create-namespace

# === 7) Install Prometheus + Grafana (kube-prometheus-stack) ===
Write-Host "=== 7) Installing kube-prometheus-stack (Prometheus + Grafana) ==="

# Validate cluster before installing
kubectl get nodes | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Cluster is not accessible. Aborting." -ForegroundColor Red
    exit 1
}

helm repo add prometheus-community https://prometheus-community.github.io/helm-charts 2>$null
helm repo add grafana https://grafana.github.io/helm-charts 2>$null
helm repo update

helm upgrade --install kube-prom-stack prometheus-community/kube-prometheus-stack -n monitoring `
  --create-namespace `
  --set grafana.enabled=true `
  --set grafana.adminPassword="$grafanaAdminPassword" `
  --set prometheus.prometheusSpec.serviceMonitorSelectorNilUsesHelmValues=false

Write-Host "Waiting for Grafana to be ready..."
Start-Sleep -Seconds 10
# wait for grafana
$ok = $false
for ($i=0; $i -lt 40; $i++) {
    $pods = kubectl -n monitoring get pods -l app.kubernetes.io/name=grafana --no-headers
    if ($pods -match "Running") { $ok = $true; break }
    Start-Sleep -Seconds 5
}
if (-not $ok) { Write-Host "Warning: Grafana took too long to start." -ForegroundColor Yellow }

# === 8) Retrieve initial passwords ===
Write-Host "=== 8) Retrieving initial passwords ==="
$argocdInitialPassword = kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" 2>$null | ForEach-Object { [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($_)) }
Write-Host "ArgoCD initial admin password: $argocdInitialPassword"

# Grafana admin password (from secret or from value we set)
try {
    $grafanaSecret = kubectl -n monitoring get secret kube-prom-stack-grafana -o jsonpath="{.data.admin-password}" 2>$null
    if ($grafanaSecret) {
        $grafanaAdminCurrent = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($grafanaSecret))
    } else {
        $grafanaAdminCurrent = $grafanaAdminPassword
    }
} catch {
    $grafanaAdminCurrent = $grafanaAdminPassword
}
Write-Host "Grafana admin password: $grafanaAdminCurrent"

# === 9) Change ArgoCD password ===
Write-Host "=== 9) Changing ArgoCD password to $argocdAdminNewPassword ==="
# Port-forward argocd-server locally
Write-Host "Port-forwarding argocd-server to 8090 (background)..."
$pfArgocd = Start-Process -FilePath kubectl -ArgumentList "port-forward svc/argocd-server -n argocd 8090:443 --address 0.0.0.0" -WindowStyle Hidden -PassThru
Write-Host "Waiting for port-forward to be available..."
Start-Sleep -Seconds 8

# Check if port-forward is accessible
$pfReady = $false
for ($i=0; $i -lt 10; $i++) {
    try {
        Invoke-WebRequest -Uri "http://localhost:8090" -Method Head -TimeoutSec 2 -ErrorAction Stop | Out-Null
        $pfReady = $true
        Write-Host "✅ Port-forward accessible via localhost:8090" -ForegroundColor Green
        break
    } catch {
        Start-Sleep -Seconds 2
    }
}
if (-not $pfReady) {
    Write-Host "⚠️  Warning: Port-forward may not be fully ready. Trying anyway..." -ForegroundColor Yellow
}

# Change password via REST API (more reliable than CLI)
try {
    # Get session token
    $loginBody = @{ username = "admin"; password = $argocdInitialPassword } | ConvertTo-Json
    $loginResponse = Invoke-RestMethod -Uri "http://localhost:8090/api/v1/session" -Method Post -Body $loginBody -ContentType "application/json" -ErrorAction Stop
    $token = $loginResponse.token

    # Update password
    $updateBody = @{ currentPassword = $argocdInitialPassword; newPassword = $argocdAdminNewPassword } | ConvertTo-Json
    $headers = @{ "Authorization" = "Bearer $token"; "Content-Type" = "application/json" }
    Invoke-RestMethod -Uri "http://localhost:8090/api/v1/account/password" -Method Put -Headers $headers -Body $updateBody -ErrorAction Stop | Out-Null

    Write-Host "✅ ArgoCD password changed successfully to: $argocdAdminNewPassword" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Failed to change ArgoCD password: $_" -ForegroundColor Yellow
    Write-Host "   You can change it manually via UI at http://argocd.local" -ForegroundColor Yellow
}
# kill port-forward
Stop-Process -Id $pfArgocd.Id -ErrorAction SilentlyContinue

# === 10) Create Grafana user via API ===
Write-Host "=== 10) Creating Grafana user $grafanaNewUser ==="
# Port-forward grafana svc to localhost:3000
$pfGraf = Start-Process -FilePath kubectl -ArgumentList "port-forward svc/kube-prom-stack-grafana -n monitoring 3000:80 --address 0.0.0.0" -WindowStyle Hidden -PassThru
Start-Sleep -Seconds 5
$grafanaApi = "http://localhost:3000"
# create user
$createJson = @{ name = "Rodrigo"; email = $grafanaNewUserEmail; login = $grafanaNewUser; password = $grafanaNewUserPassword } | ConvertTo-Json
try {
    Invoke-RestMethod -Method Post -Uri "$grafanaApi/api/admin/users" -Body $createJson -ContentType "application/json" -Credential (New-Object System.Management.Automation.PSCredential("admin",(ConvertTo-SecureString $grafanaAdminCurrent -AsPlainText -Force))) -AllowUnencryptedAuthentication -ErrorAction Stop | Out-Null
    Write-Host "User $grafanaNewUser created in Grafana."
} catch {
    Write-Host "Failed to create Grafana user (may already exist) - $_" -ForegroundColor Yellow
}

# Add user to org as Admin (orgId 1 normally)
try {
    $addJson = @{ loginOrEmail = $grafanaNewUser; role = "Admin" } | ConvertTo-Json
    Invoke-RestMethod -Method Post -Uri "$grafanaApi/api/orgs/1/users" -Body $addJson -ContentType "application/json" -Credential (New-Object System.Management.Automation.PSCredential("admin",(ConvertTo-SecureString $grafanaAdminCurrent -AsPlainText -Force))) -AllowUnencryptedAuthentication -ErrorAction Stop
    Write-Host "User $grafanaNewUser promoted to Admin of the org."
} catch {
    Write-Host "Failed to promote user (may already be admin) - $_" -ForegroundColor Yellow
}

# kill grafana port-forward
Stop-Process -Id $pfGraf.Id -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║           ✅ Environment Created Successfully             ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "📋 CREDENTIALS:" -ForegroundColor Cyan
Write-Host "   ArgoCD:  admin / $argocdAdminNewPassword" -ForegroundColor White
Write-Host "   Grafana: $grafanaNewUser / $grafanaNewUserPassword" -ForegroundColor White
Write-Host ""
Write-Host "🌐 INGRESS ACCESS (Native - NO port-forward needed!):" -ForegroundColor Cyan
Write-Host "   ℹ️  Cluster created with native port mapping (80:80@loadbalancer)" -ForegroundColor Yellow
Write-Host ""
Write-Host "   ⚠️  REQUIRED: Update hosts file (run as Administrator):" -ForegroundColor Yellow
Write-Host "      .\k3d-manager.ps1 update-hosts" -ForegroundColor White
Write-Host ""
Write-Host "   ✅ Then access directly at:" -ForegroundColor Green
Write-Host "      ArgoCD:       http://argocd.local" -ForegroundColor White
Write-Host "      User API:     http://cloudgames.local/user" -ForegroundColor White
Write-Host "      Games API:    http://cloudgames.local/games" -ForegroundColor White
Write-Host "      Payments API: http://cloudgames.local/payments" -ForegroundColor White
Write-Host ""
Write-Host "🔗 ALTERNATIVE ACCESS (with port-forward):" -ForegroundColor Cyan
Write-Host "   Grafana only: .\k3d-manager.ps1 port-forward grafana" -ForegroundColor White
Write-Host "   Access:       http://localhost:3000" -ForegroundColor Gray
Write-Host ""
Write-Host "📝 NEXT STEPS:" -ForegroundColor Cyan
Write-Host "   1. Update hosts file (REQUIRED for Ingress access):" -ForegroundColor White
Write-Host "      .\k3d-manager.ps1 update-hosts" -ForegroundColor Gray
Write-Host ""
Write-Host "   2. Configure External Secrets (Azure Key Vault):" -ForegroundColor White
Write-Host "      .\k3d-manager.ps1 external-secrets" -ForegroundColor Gray
Write-Host ""
Write-Host "   3. Bootstrap ArgoCD Applications:" -ForegroundColor White
Write-Host "      .\k3d-manager.ps1 bootstrap" -ForegroundColor Gray
Write-Host ""
Write-Host "   4. Test Ingress access (after deploying apps):" -ForegroundColor White
Write-Host "      Invoke-WebRequest http://argocd.local" -ForegroundColor Gray
Write-Host "      Invoke-WebRequest http://cloudgames.local/user/health" -ForegroundColor Gray
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
