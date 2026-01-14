<#
.SYNOPSIS
  List and search Kubernetes secrets in application namespaces.

.DESCRIPTION
  Utility script to list, search, and inspect secrets synced from Azure Key Vault
  via External Secrets Operator. Supports filtering by namespace, name, and key.

.PARAMETER Namespace
  Kubernetes namespace to search. Default: cloudgames-dev

.PARAMETER SecretName
  Filter by secret name (supports wildcards).

.PARAMETER Key
  Search for a specific key within secrets.

.PARAMETER Decode
  Decode and show secret values (use with caution).

.EXAMPLE
  .\list-secrets.ps1
  # Lists all secrets in cloudgames-dev

.EXAMPLE
  .\list-secrets.ps1 -SecretName user*
  # Lists secrets starting with user

.EXAMPLE
  .\list-secrets.ps1 -Key db-password
  # Searches for db-password key in all secrets
#>

[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [string]$Namespace = "cloudgames-dev",

    [Parameter()]
    [string]$SecretName = "",

    [Parameter()]
    [string]$Key = "",

    [Parameter()]
    [switch]$Decode
)

$script:Colors = @{
    Title   = "Cyan"
    Success = "Green"
    Warning = "Yellow"
    Error   = "Red"
    Info    = "White"
    Muted   = "Gray"
    Key     = "Magenta"
}

function Show-Header {
    Write-Host ""
    Write-Host "========================================================" -ForegroundColor $Colors.Title
    Write-Host "          Kubernetes Secrets Explorer                   " -ForegroundColor $Colors.Title
    Write-Host "========================================================" -ForegroundColor $Colors.Title
    Write-Host ""
}

try {
    kubectl cluster-info 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Cluster not accessible" }
} catch {
    Write-Host "ERROR: Kubernetes cluster not accessible." -ForegroundColor $Colors.Error
    Write-Host "   Make sure the cluster is running: .\k3d-manager.ps1 start" -ForegroundColor $Colors.Muted
    exit 1
}

Show-Header

$namespaces = @()
if ($Namespace -eq "all") {
    $namespaces = @("cloudgames-dev", "cloudgames-prod", "external-secrets")
} else {
    $namespaces = @($Namespace)
}

foreach ($ns in $namespaces) {
    Write-Host "Namespace: $ns" -ForegroundColor $Colors.Key
    Write-Host ("-" * 60) -ForegroundColor $Colors.Muted

    $secretsJson = kubectl get secrets -n $ns -o json 2>$null | ConvertFrom-Json

    if (-not $secretsJson -or -not $secretsJson.items) {
        Write-Host "   No secrets found or namespace does not exist." -ForegroundColor $Colors.Warning
        Write-Host ""
        continue
    }

    $secrets = $secretsJson.items

    if ($SecretName) {
        $secrets = $secrets | Where-Object { $_.metadata.name -like $SecretName }
    }

    if ($secrets.Count -eq 0) {
        Write-Host "   No secrets matching filter" -ForegroundColor $Colors.Warning
        Write-Host ""
        continue
    }

    foreach ($secret in $secrets) {
        $name = $secret.metadata.name
        $type = $secret.type
        $keys = @()

        if ($secret.data) {
            $keys = $secret.data.PSObject.Properties.Name
        }

        if ($Key -and $keys) {
            $matchingKeys = $keys | Where-Object { $_ -like "*$Key*" }
            if ($matchingKeys.Count -eq 0) { continue }
        }

        Write-Host "   [Secret] $name (Type: $type, Keys: $($keys.Count))" -ForegroundColor $Colors.Success

        if ($keys) {
            foreach ($k in $keys) {
                if ($Key -and $k -notlike "*$Key*") { continue }

                if ($Decode) {
                    $encodedValue = $secret.data.$k
                    try {
                        $decodedValue = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($encodedValue))
                        if ($k -match "password|secret|token|key|credential") {
                            $masked = $decodedValue.Substring(0, [Math]::Min(3, $decodedValue.Length)) + "***"
                            Write-Host "      - $k = $masked" -ForegroundColor $Colors.Warning
                        } else {
                            Write-Host "      - $k = $decodedValue" -ForegroundColor $Colors.Info
                        }
                    } catch {
                        Write-Host "      - $k = [decode error]" -ForegroundColor $Colors.Error
                    }
                } else {
                    Write-Host "      - $k" -ForegroundColor $Colors.Muted
                }
            }
        }
    }
    Write-Host ""
}

Write-Host "ExternalSecrets Sync Status:" -ForegroundColor $Colors.Title
Write-Host ("-" * 60) -ForegroundColor $Colors.Muted

$esJson = kubectl get externalsecrets -n cloudgames-dev -o json 2>$null | ConvertFrom-Json
if ($esJson -and $esJson.items) {
    foreach ($es in $esJson.items) {
        $esName = $es.metadata.name
        $statusObj = $es.status.conditions | Where-Object { $_.type -eq "Ready" } | Select-Object -First 1
        $ready = if ($statusObj.status -eq "True") { "[OK]" } else { "[FAIL]" }
        Write-Host "   $ready $esName - Status: $($statusObj.reason)" -ForegroundColor $Colors.Muted
    }
}
Write-Host ""

Write-Host "Tips:" -ForegroundColor $Colors.Title
Write-Host "   - Use -SecretName pattern* to filter secrets" -ForegroundColor $Colors.Muted
Write-Host "   - Use -Key keyname to search for specific keys" -ForegroundColor $Colors.Muted
Write-Host "   - Use -Decode to show values (sensitive data!)" -ForegroundColor $Colors.Muted
Write-Host "   - Use -Namespace all to search all namespaces" -ForegroundColor $Colors.Muted
Write-Host ""
