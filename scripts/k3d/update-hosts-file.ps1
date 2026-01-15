<#
.SYNOPSIS
  Update Windows hosts file with local k3d ingress entries.

.DESCRIPTION
  Adds entries for:
  - 127.0.0.1 argocd.local
  - 127.0.0.1 agro.local
  
  Requires administrator privileges.

.EXAMPLE
  .\update-hosts-file.ps1
#>

#Requires -RunAsAdministrator

$hostsFile = "$env:SystemRoot\System32\drivers\etc\hosts"
$entries = @(
    "127.0.0.1 argocd.local",
    "127.0.0.1 agro.local"
)

$Color = @{
    Success = "Green"
    Warning = "Yellow"
    Info    = "Cyan"
    Muted   = "Gray"
}

Write-Host ""
Write-Host "=== Updating Windows hosts file ===" -ForegroundColor $Color.Info
Write-Host "   File: $hostsFile" -ForegroundColor $Color.Muted

$hostsContent = Get-Content $hostsFile

foreach ($entry in $entries) {
    $domain = $entry.Split(" ")[1]
    
    if ($hostsContent -match $domain) {
        Write-Host "   ✓ $domain already exists" -ForegroundColor $Color.Muted
    }
    else {
        Add-Content -Path $hostsFile -Value $entry
        Write-Host "   ✅ Added: $entry" -ForegroundColor $Color.Success
    }
}

Write-Host ""
Write-Host "✅ Hosts file updated!" -ForegroundColor $Color.Success
Write-Host ""
Write-Host "You can now access:" -ForegroundColor $Color.Info
Write-Host "   http://argocd.local" -ForegroundColor $Color.Success
Write-Host "   http://agro.local (when deployed)" -ForegroundColor $Color.Success
Write-Host ""
