param(
    [Parameter(Position = 0)]
    [string]$Command,

    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Arguments
)

$ErrorActionPreference = "Stop"

$scriptPath = $MyInvocation.MyCommand.Path
if (-not $scriptPath) {
    Write-Error "Unable to resolve script path."
    exit 1
}

$scriptDir = Split-Path -Parent $scriptPath

function Show-Usage {
    @"
Usage: pwsh ./scripts/k3d/run.ps1 <command> [args]

Commands:
    setup-cli            Run Fedora CLI setup (PowerShell)
  bootstrap            Full bootstrap (PowerShell)
    bootstrap-lite       Lightweight bootstrap (PowerShell)
  manager              Interactive k3d manager (PowerShell)
  status               Cluster status (PowerShell)
  start                Start cluster (PowerShell)
  stop                 Stop cluster (PowerShell)
  restart              Restart cluster (PowerShell)
  cleanup              Cleanup cluster (PowerShell)
  import-secrets       Import k3d env secrets/configmap (PowerShell)
  port-forward         Start port-forward (PowerShell)
  stop-port-forward    Stop port-forward (PowerShell)
  list-port-forwards   List active port-forwards (PowerShell)
  sync-argocd          Force ArgoCD sync (PowerShell)
  reset-argocd-pass    Reset ArgoCD admin password (PowerShell)
  list-secrets         List cluster secrets (PowerShell)
  verify-image-sync    Verify image sync (PowerShell)
  diagnose-argocd      Diagnose ArgoCD access (PowerShell)
  build-images         Build and push images (PowerShell)
  ensure-infra         Ensure compose infrastructure (PowerShell)
"@
}

function Invoke-PowerShellScript {
    param(
        [Parameter(Mandatory = $true)]
        [string]$FileName,

        [string[]]$ScriptArgs = @()
    )

    $target = Join-Path $scriptDir $FileName
    if ($null -eq $ScriptArgs -or $ScriptArgs.Count -eq 0) {
        & $target
    }
    else {
        & $target @ScriptArgs
    }
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
}

if ([string]::IsNullOrWhiteSpace($Command)) {
    Show-Usage
    exit 1
}

switch ($Command) {
    "setup-cli" { Invoke-PowerShellScript -FileName "setup-cli-fedora.ps1" -ScriptArgs $Arguments }
    "bootstrap" { Invoke-PowerShellScript -FileName "bootstrap.ps1" -ScriptArgs $Arguments }
    "bootstrap-lite" { Invoke-PowerShellScript -FileName "bootstrap-lightweight.ps1" -ScriptArgs $Arguments }
    "manager" { Invoke-PowerShellScript -FileName "manager.ps1" -ScriptArgs $Arguments }
    "status" { Invoke-PowerShellScript -FileName "status.ps1" -ScriptArgs $Arguments }
    "start" { Invoke-PowerShellScript -FileName "start-cluster.ps1" -ScriptArgs $Arguments }
    "stop" { Invoke-PowerShellScript -FileName "stop-cluster.ps1" -ScriptArgs $Arguments }
    "restart" { Invoke-PowerShellScript -FileName "restart-cluster.ps1" -ScriptArgs $Arguments }
    "cleanup" { Invoke-PowerShellScript -FileName "cleanup.ps1" -ScriptArgs $Arguments }
    "import-secrets" { Invoke-PowerShellScript -FileName "import-secrets.ps1" -ScriptArgs $Arguments }
    "port-forward" { Invoke-PowerShellScript -FileName "port-forward.ps1" -ScriptArgs $Arguments }
    "stop-port-forward" { Invoke-PowerShellScript -FileName "stop-port-forward.ps1" -ScriptArgs $Arguments }
    "list-port-forwards" { Invoke-PowerShellScript -FileName "list-port-forwards.ps1" -ScriptArgs $Arguments }
    "sync-argocd" { Invoke-PowerShellScript -FileName "sync-argocd.ps1" -ScriptArgs $Arguments }
    "reset-argocd-pass" { Invoke-PowerShellScript -FileName "reset-argocd-password.ps1" -ScriptArgs $Arguments }
    "list-secrets" { Invoke-PowerShellScript -FileName "list-secrets.ps1" -ScriptArgs $Arguments }
    "verify-image-sync" { Invoke-PowerShellScript -FileName "verify-image-sync.ps1" -ScriptArgs $Arguments }
    "diagnose-argocd" { Invoke-PowerShellScript -FileName "diagnose-argocd.ps1" -ScriptArgs $Arguments }
    "build-images" { Invoke-PowerShellScript -FileName "build-push-images.ps1" -ScriptArgs $Arguments }
    "ensure-infra" { Invoke-PowerShellScript -FileName "ensure-compose-infrastructure.ps1" -ScriptArgs $Arguments }
    "help" { Show-Usage; exit 0 }
    "-h" { Show-Usage; exit 0 }
    "--help" { Show-Usage; exit 0 }
    default {
        Write-Error "Unknown command '$Command'."
        Show-Usage
        exit 1
    }
}
