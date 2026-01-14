<#
.SYNOPSIS
  Configures External Secrets Operator for Azure Key Vault integration.

.DESCRIPTION
  This script installs the External Secrets Operator via Helm and configures
  the connection to Azure Key Vault using a Service Principal.

  The clientSecret is requested interactively (never saved to files/Git).

.PARAMETER ClientSecret
  The Service Principal client secret. If not provided, will be prompted interactively.

.PARAMETER SkipHelmInstall
  Skips External Secrets Operator installation (useful if already installed).

.EXAMPLE
  .\setup-external-secrets.ps1
  # Interactive execution

.EXAMPLE
  .\setup-external-secrets.ps1 -SkipHelmInstall
  # Only creates the secret, without installing the operator
#>

[CmdletBinding()]
param(
    [Parameter()]
    [string]$ClientSecret,

    [Parameter()]
    [switch]$SkipHelmInstall
)

# === Configuration ===
$tenantId = "084169c0-a779-43c3-970c-487a71a93f88"
$clientId = "44193307-5366-4806-860d-5656aa54c9e3"
$keyVaultName = "tccloudgamesdevcr8nkv"
$namespace = "external-secrets"
$secretName = "azure-sp-credentials"
$appNamespace = "cloudgames-dev"

# === Colors ===
$Colors = @{
    Title = "Cyan"
    Success = "Green"
    Warning = "Yellow"
    Error = "Red"
    Info = "White"
    Muted = "Gray"
}

function Write-Header {
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor $Colors.Title
    Write-Host "║     🔐 External Secrets Operator - Azure Key Vault        ║" -ForegroundColor $Colors.Title
    Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor $Colors.Title
    Write-Host ""
}

Write-Header

# === 1) Check prerequisites ===
Write-Host "=== 1) Checking prerequisites ===" -ForegroundColor $Colors.Title

foreach ($cmd in @("kubectl", "helm")) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        Write-Host "❌ ERROR: '$cmd' not found in PATH." -ForegroundColor $Colors.Error
        exit 1
    }
}

# Check cluster
kubectl cluster-info 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ ERROR: Kubernetes cluster is not accessible." -ForegroundColor $Colors.Error
    Write-Host "   Run first: .\k3d-manager.ps1 start" -ForegroundColor $Colors.Warning
    exit 1
}
Write-Host "✅ Kubernetes cluster accessible" -ForegroundColor $Colors.Success

# === 2) Request clientSecret if not provided ===
Write-Host ""
Write-Host "=== 2) Azure Credentials ===" -ForegroundColor $Colors.Title
Write-Host ""
Write-Host "📋 Current configuration:" -ForegroundColor $Colors.Info
Write-Host "   Tenant ID:   $tenantId" -ForegroundColor $Colors.Muted
Write-Host "   Client ID:   $clientId" -ForegroundColor $Colors.Muted
Write-Host "   Key Vault:   $keyVaultName" -ForegroundColor $Colors.Muted
Write-Host ""

if (-not $ClientSecret) {
    Write-Host "🔑 Enter the Service Principal Client Secret:" -ForegroundColor $Colors.Warning
    Write-Host "   (This value will NEVER be saved to files)" -ForegroundColor $Colors.Muted
    $secureSecret = Read-Host -AsSecureString "   Client Secret"
    $ClientSecret = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureSecret)
    )
}

if ([string]::IsNullOrWhiteSpace($ClientSecret)) {
    Write-Host "❌ ERROR: Client Secret cannot be empty." -ForegroundColor $Colors.Error
    exit 1
}

# === 3) Install External Secrets Operator ===
if (-not $SkipHelmInstall) {
    Write-Host ""
    Write-Host "=== 3) Installing External Secrets Operator ===" -ForegroundColor $Colors.Title

    helm repo add external-secrets https://charts.external-secrets.io 2>$null
    helm repo update

    helm upgrade --install external-secrets external-secrets/external-secrets `
        -n $namespace `
        --create-namespace `
        --set installCRDs=true

    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ ERROR: Failed to install External Secrets Operator." -ForegroundColor $Colors.Error
        exit 1
    }

    Write-Host "✅ External Secrets Operator installed" -ForegroundColor $Colors.Success

    # Wait for pods to be ready
    Write-Host "⏳ Waiting for pods to be ready..." -ForegroundColor $Colors.Muted
    Start-Sleep -Seconds 10

    $ready = $false
    for ($i = 0; $i -lt 30; $i++) {
        $pods = kubectl get pods -n $namespace --no-headers 2>$null
        if ($pods -match "Running" -and $pods -notmatch "0/") {
            $ready = $true
            break
        }
        Start-Sleep -Seconds 5
    }

    if (-not $ready) {
        Write-Host "⚠️  Warning: Pods may not be fully ready yet." -ForegroundColor $Colors.Warning
    } else {
        Write-Host "✅ Operator pods are ready" -ForegroundColor $Colors.Success
    }

    # Wait for CRDs to be registered (critical step!)
    Write-Host "⏳ Waiting for CRDs to be registered..." -ForegroundColor $Colors.Muted
    $crdsReady = $false
    for ($i = 0; $i -lt 30; $i++) {
        $crdCheck = kubectl get crd clustersecretstores.external-secrets.io 2>$null
        if ($LASTEXITCODE -eq 0) {
            $crdsReady = $true
            break
        }
        Start-Sleep -Seconds 3
    }

    if (-not $crdsReady) {
        Write-Host "❌ ERROR: CRDs were not registered after 90 seconds." -ForegroundColor $Colors.Error
        Write-Host "   Run 'kubectl get crd | findstr external-secrets' to check." -ForegroundColor $Colors.Muted
        exit 1
    } else {
        Write-Host "✅ CRDs registered successfully" -ForegroundColor $Colors.Success
    }
} else {
    Write-Host ""
    Write-Host "=== 3) Skipping Helm installation (--SkipHelmInstall) ===" -ForegroundColor $Colors.Warning

    # Even when skipping, verify CRDs are available
    Write-Host "⏳ Verifying CRDs are available..." -ForegroundColor $Colors.Muted
    $crdCheck = kubectl get crd clustersecretstores.external-secrets.io 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ ERROR: CRDs not found. External Secrets Operator may not be installed." -ForegroundColor $Colors.Error
        Write-Host "   Run without -SkipHelmInstall to install the operator." -ForegroundColor $Colors.Muted
        exit 1
    }
    Write-Host "✅ CRDs are available" -ForegroundColor $Colors.Success
}

# === 4) Create Secret with Azure credentials ===
Write-Host ""
Write-Host "=== 4) Creating Secret with Azure credentials ===" -ForegroundColor $Colors.Title

# Check if secret already exists
kubectl get secret $secretName -n $namespace 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "⚠️  Secret '$secretName' already exists. Updating..." -ForegroundColor $Colors.Warning
    kubectl delete secret $secretName -n $namespace 2>$null | Out-Null
}

kubectl create secret generic $secretName `
    -n $namespace `
    --from-literal=clientId=$clientId `
    --from-literal=clientSecret=$ClientSecret

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ ERROR: Failed to create secret." -ForegroundColor $Colors.Error
    exit 1
}

Write-Host "✅ Secret '$secretName' created in namespace '$namespace'" -ForegroundColor $Colors.Success

# === 5) Create application namespace ===
Write-Host ""
Write-Host "=== 5) Creating namespace '$appNamespace' ===" -ForegroundColor $Colors.Title

kubectl create namespace $appNamespace --dry-run=client -o yaml | kubectl apply -f - 2>$null
Write-Host "✅ Namespace '$appNamespace' ready" -ForegroundColor $Colors.Success

# === 5.1) Wait for webhook to be ready ===
Write-Host ""
Write-Host "=== 5.1) Waiting for External Secrets webhook to be ready ===" -ForegroundColor $Colors.Title
Write-Host "⏳ This ensures manifests can be validated properly..." -ForegroundColor $Colors.Muted

$webhookReady = $false
$maxAttempts = 30
for ($i = 1; $i -le $maxAttempts; $i++) {
    # Check if webhook pod is running and has endpoints
    $webhookPod = kubectl get pods -n $namespace -l app.kubernetes.io/name=external-secrets-webhook --no-headers 2>$null
    $endpoints = kubectl get endpoints external-secrets-webhook -n $namespace -o jsonpath='{.subsets[*].addresses[*].ip}' 2>$null
    
    if ($webhookPod -match "Running" -and $webhookPod -match "1/1" -and $endpoints) {
        $webhookReady = $true
        break
    }
    
    if ($i % 5 -eq 0) {
        Write-Host "   Attempt $i/$maxAttempts - Webhook not ready yet..." -ForegroundColor $Colors.Muted
    }
    Start-Sleep -Seconds 2
}

if (-not $webhookReady) {
    Write-Host "⚠️  Warning: Webhook may not be fully ready. Waiting additional 10 seconds..." -ForegroundColor $Colors.Warning
    Start-Sleep -Seconds 10
} else {
    Write-Host "✅ Webhook is ready and has endpoints" -ForegroundColor $Colors.Success
}

# === 6) Apply Kustomize manifests ===
Write-Host ""
Write-Host "=== 6) Applying External Secrets manifests ===" -ForegroundColor $Colors.Title

$manifestsPath = Join-Path $PSScriptRoot "..\overlays\dev"
if (Test-Path $manifestsPath) {
    # Apply with retry logic in case webhook needs a moment
    $applySuccess = $false
    $retryCount = 3
    
    for ($attempt = 1; $attempt -le $retryCount; $attempt++) {
        $output = kubectl apply -k $manifestsPath 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            $applySuccess = $true
            Write-Host $output
            Write-Host "✅ Manifests applied successfully" -ForegroundColor $Colors.Success
            break
        }
        
        # Check if it's a webhook error
        if ($output -match "failed calling webhook") {
            Write-Host "⚠️  Webhook not ready (attempt $attempt/$retryCount). Waiting 10 seconds..." -ForegroundColor $Colors.Warning
            Start-Sleep -Seconds 10
        } else {
            # Different error, show it and exit
            Write-Host $output
            Write-Host "⚠️  Warning: Some resources may have failed. Check manually." -ForegroundColor $Colors.Warning
            break
        }
    }
    
    if (-not $applySuccess -and $LASTEXITCODE -ne 0) {
        Write-Host "⚠️  Warning: Some resources may have failed after $retryCount attempts." -ForegroundColor $Colors.Warning
        Write-Host "   You can retry manually: kubectl apply -k $manifestsPath" -ForegroundColor $Colors.Muted
    }
} else {
    Write-Host "⚠️  Manifests directory not found: $manifestsPath" -ForegroundColor $Colors.Warning
    Write-Host "   Apply manually: kubectl apply -k infrastructure/kubernetes/overlays/dev/" -ForegroundColor $Colors.Muted
}

# === 7) Verify synchronization ===
Write-Host ""
Write-Host "=== 7) Verifying secrets synchronization ===" -ForegroundColor $Colors.Title
Write-Host "⏳ Waiting for synchronization (may take a few seconds)..." -ForegroundColor $Colors.Muted
Start-Sleep -Seconds 10

$externalSecrets = kubectl get externalsecrets -n $appNamespace 2>$null
if ($externalSecrets) {
    Write-Host ""
    Write-Host "📋 External Secrets:" -ForegroundColor $Colors.Info
    kubectl get externalsecrets -n $appNamespace
    Write-Host ""

    # Check status
    $synced = kubectl get externalsecrets -n $appNamespace -o jsonpath='{.items[*].status.conditions[?(@.type=="Ready")].status}' 2>$null
    if ($synced -match "True") {
        Write-Host "✅ Secrets synchronized successfully!" -ForegroundColor $Colors.Success
    } else {
        Write-Host "⚠️  Some secrets may not have synchronized yet." -ForegroundColor $Colors.Warning
        Write-Host "   Run: kubectl describe externalsecret user-api-secrets -n $appNamespace" -ForegroundColor $Colors.Muted
    }
} else {
    Write-Host "⚠️  No ExternalSecret found. Check if manifests were applied." -ForegroundColor $Colors.Warning
}

# === Summary ===
Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor $Colors.Success
Write-Host "║                    ✅ SETUP COMPLETE                      ║" -ForegroundColor $Colors.Success
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor $Colors.Success
Write-Host ""
Write-Host "📋 Summary:" -ForegroundColor $Colors.Title
Write-Host "   • External Secrets Operator: Installed" -ForegroundColor $Colors.Info
Write-Host "   • Azure SP Secret: Created in '$namespace'" -ForegroundColor $Colors.Info
Write-Host "   • Key Vault: $keyVaultName.vault.azure.net" -ForegroundColor $Colors.Info
Write-Host "   • App Namespace: $appNamespace" -ForegroundColor $Colors.Info
Write-Host ""
Write-Host "🔍 Useful commands:" -ForegroundColor $Colors.Title
Write-Host "   kubectl get externalsecrets -n $appNamespace" -ForegroundColor $Colors.Muted
Write-Host "   kubectl get secrets -n $appNamespace" -ForegroundColor $Colors.Muted
Write-Host "   kubectl describe externalsecret user-api-secrets -n $appNamespace" -ForegroundColor $Colors.Muted
Write-Host ""
