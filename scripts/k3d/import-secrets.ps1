param(
    [string]$Namespace = "agro-apps",
    [string]$EnvFile = "..\..\orchestration\apphost-compose\.env.k3d",
    [string]$ConfigMapPath = "..\..\infrastructure\kubernetes\apps\base\identity\configmap.yaml",
    [string]$SecretName = "agro-secrets"
)

$ErrorActionPreference = "Stop"

function Ensure-Namespace {
    param([string]$Ns)
    $exists = kubectl get ns $Ns --ignore-not-found
    if (-not $exists) {
        kubectl create namespace $Ns | Out-Null
    }
}

function Apply-ConfigMap {
    param([string]$Path, [string]$Ns)
    if (-not (Test-Path $Path)) {
        Write-Host "ConfigMap file not found: $Path" -ForegroundColor Yellow
        return
    }
    kubectl apply -n $Ns -f $Path | Out-Null
}

function Apply-SecretFromEnv {
    param([string]$File, [string]$Ns, [string]$Name)
    if (-not (Test-Path $File)) {
        throw "Env file not found: $File"
    }
    # Create/Update via server-side apply
    kubectl -n $Ns create secret generic $Name --from-env-file=$File --dry-run=client -o yaml |
    kubectl -n $Ns apply -f - | Out-Null
}

Write-Host "\n🔐 Importing secrets and configmap into namespace '$Namespace'" -ForegroundColor Cyan
Ensure-Namespace -Ns $Namespace
Apply-ConfigMap -Path $ConfigMapPath -Ns $Namespace
Apply-SecretFromEnv -File $EnvFile -Ns $Namespace -Name $SecretName

Write-Host "✅ Secrets and ConfigMap applied." -ForegroundColor Green
