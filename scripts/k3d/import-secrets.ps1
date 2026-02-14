param(
    [string]$Namespace = "agro-apps",
    [string]$EnvFile = "..\..\orchestration\apphost-compose\.env.k3d",
    [string[]]$Services = @(),
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

function Apply-ConfigMaps {
    param([string[]]$SelectedServices, [string]$Ns)

    $serviceMap = @{
        identity        = "..\..\infrastructure\kubernetes\apps\base\identity\configmap.yaml"
        farm            = "..\..\infrastructure\kubernetes\apps\base\farm\configmap.yaml"
        "sensor-ingest" = "..\..\infrastructure\kubernetes\apps\base\sensor-ingest\configmap.yaml"
    }

    $targets = if ($SelectedServices -and $SelectedServices.Count -gt 0) {
        $SelectedServices | ForEach-Object { $_.ToLowerInvariant() } | Where-Object { $serviceMap.ContainsKey($_) }
    }
    else {
        $serviceMap.Keys
    }

    foreach ($svc in $targets) {
        $rawPath = $serviceMap[$svc]
        $path = if ([System.IO.Path]::IsPathRooted($rawPath)) {
            $rawPath
        }
        else {
            Join-Path $PSScriptRoot $rawPath
        }

        if (-not (Test-Path $path)) {
            Write-Host "ConfigMap file not found: $path" -ForegroundColor Yellow
            continue
        }
        kubectl apply -n $Ns -f $path --server-side | Out-Null
    }
}

function Apply-SecretFromEnv {
    param([string]$File, [string]$Ns, [string]$Name)
    $resolvedFile = if ([System.IO.Path]::IsPathRooted($File)) {
        $File
    }
    else {
        Join-Path $PSScriptRoot $File
    }

    if (-not (Test-Path $resolvedFile)) {
        throw "Env file not found: $resolvedFile"
    }
    # Create/Update via server-side apply
    kubectl -n $Ns create secret generic $Name --from-env-file=$resolvedFile --dry-run=client -o yaml |
    kubectl -n $Ns apply --server-side -f - | Out-Null
}

Write-Host "\nImporting secrets and configmap into namespace '$Namespace'" -ForegroundColor Cyan
Ensure-Namespace -Ns $Namespace
Apply-ConfigMaps -SelectedServices $Services -Ns $Namespace
Apply-SecretFromEnv -File $EnvFile -Ns $Namespace -Name $SecretName

Write-Host "Secrets and ConfigMap applied." -ForegroundColor Green
