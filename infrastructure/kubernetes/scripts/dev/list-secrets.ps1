<#
.SYNOPSIS
  Lists and searches Kubernetes secrets (debug/troubleshooting).

.DESCRIPTION
  Lists all secrets in the cluster and allows filtering by:
  - Namespace
  - Name
  - Key
  
  Can optionally decode base64 values (with masking).

.EXAMPLE
  .\list-secrets.ps1
  .\list-secrets.ps1 -Namespace agro-apps
  .\list-secrets.ps1 -Name argocd
#>

param(
    [string]$Namespace = "",
    [string]$Name = "",
    [string]$Key = "",
    [switch]$Decode
)

$ErrorActionPreference = "Stop"

$Color = @{
    Title    = "Cyan"
    Success  = "Green"
    Warning  = "Yellow"
    Error    = "Red"
    Info     = "White"
    Muted    = "Gray"
}

function Write-Title {
    param([string]$Text)
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor $Color.Title
    Write-Host "║  $Text" -ForegroundColor $Color.Title
    Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor $Color.Title
}

Write-Title "Listing Kubernetes Secrets"

# Get all secrets
$secretsJson = kubectl get secrets -A -o json 2>$null | ConvertFrom-Json
if (-not $secretsJson -or -not $secretsJson.items) {
    Write-Host "❌ Failed to retrieve secrets" -ForegroundColor $Color.Error
    exit 1
}

$secrets = $secretsJson.items

# Apply filters
if ($Namespace) {
    $secrets = $secrets | Where-Object { $_.metadata.namespace -like "*$Namespace*" }
}

if ($Name) {
    $secrets = $secrets | Where-Object { $_.metadata.name -like "*$Name*" }
}

Write-Host "Found: $($secrets.Count) secret(s)" -ForegroundColor $Color.Info
Write-Host ""

foreach ($secret in $secrets) {
    $ns = $secret.metadata.namespace
    $name = $secret.metadata.name
    $type = $secret.type
    
    Write-Host "📋 $ns / $name" -ForegroundColor $Color.Title
    Write-Host "   Type: $type" -ForegroundColor $Color.Muted
    
    if ($secret.data) {
        foreach ($keyName in $secret.data.PSObject.Properties.Name) {
            if ($Key -and $keyName -notlike "*$Key*") { continue }
            
            $value = $secret.data.$keyName
            
            if ($Decode) {
                try {
                    $decoded = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($value))
                    $display = if ($decoded.Length -gt 50) {
                        $decoded.Substring(0, 50) + "..."
                    } else {
                        $decoded
                    }
                    Write-Host "   • $keyName = $display" -ForegroundColor $Color.Success
                } catch {
                    Write-Host "   • $keyName = (decode failed)" -ForegroundColor $Color.Warning
                }
            } else {
                $display = if ($value.Length -gt 50) { $value.Substring(0, 50) + "..." } else { $value }
                Write-Host "   • $keyName = $display" -ForegroundColor $Color.Muted
            }
        }
    }
    
    Write-Host ""
}

Write-Host "✅ Secret list complete" -ForegroundColor $Color.Success
Write-Host ""
Write-Host "Tip: Use --Decode flag to show decoded values:" -ForegroundColor $Color.Info
Write-Host "     .\list-secrets.ps1 -Decode" -ForegroundColor $Color.Muted
Write-Host ""
