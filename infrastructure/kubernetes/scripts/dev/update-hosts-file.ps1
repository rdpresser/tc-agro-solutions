<#
.SYNOPSIS
  Manages Windows hosts file entries for cluster Ingress hostnames (idempotent).

.DESCRIPTION
  Adds or removes Ingress hostnames to/from Windows hosts file:
  - argocd.local
  - agro.local
  
  Requires Administrator privileges.

.EXAMPLE
  .\update-hosts-file.ps1 add
  .\update-hosts-file.ps1 remove
#>

param(
    [ValidateSet("add", "remove")]
    [string]$Action = "add"
)

$ErrorActionPreference = "Stop"

$hostsPath = "C:\Windows\System32\drivers\etc\hosts"
$entries = @(
    "127.0.0.1 argocd.local"
    "127.0.0.1 agro.local"
)

$Color = @{
    Title    = "Cyan"
    Success  = "Green"
    Warning  = "Yellow"
    Error    = "Red"
    Info     = "White"
}

function Write-Title {
    param([string]$Text)
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor $Color.Title
    Write-Host "║  $Text" -ForegroundColor $Color.Title
    Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor $Color.Title
}

function Test-AdminPrivilege {
    $currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object System.Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([System.Security.Principal.WindowsBuiltInRole]::Administrator)
}

Write-Title "Windows Hosts File Manager"

# Check Admin
if (-not (Test-AdminPrivilege)) {
    Write-Host "❌ Administrator privileges required!" -ForegroundColor $Color.Error
    Write-Host ""
    Write-Host "Please run PowerShell as Administrator and try again." -ForegroundColor $Color.Warning
    Write-Host ""
    exit 1
}

Write-Host "✅ Running with Administrator privileges" -ForegroundColor $Color.Success
Write-Host ""
Write-Host "Hosts file: $hostsPath" -ForegroundColor $Color.Muted
Write-Host ""

if ($Action -eq "add") {
    Write-Title "Adding entries to hosts file"
    
    $hostsContent = Get-Content $hostsPath -Raw
    
    foreach ($entry in $entries) {
        if ($hostsContent -like "*$entry*") {
            Write-Host "⏭️  Already present: $entry" -ForegroundColor $Color.Muted
        } else {
            Write-Host "   Adding: $entry" -ForegroundColor $Color.Info
            Add-Content -Path $hostsPath -Value $entry -Encoding UTF8
        }
    }
    
    Write-Host ""
    Write-Host "✅ Hosts file updated (added entries)" -ForegroundColor $Color.Success
    
} elseif ($Action -eq "remove") {
    Write-Title "Removing entries from hosts file"
    
    $hostsContent = @(Get-Content $hostsPath)
    $newContent = $hostsContent | Where-Object { 
        $line = $_
        -not ($entries | Where-Object { $line -eq $_ })
    }
    
    Set-Content -Path $hostsPath -Value $newContent -Encoding UTF8
    
    Write-Host "✅ Hosts file updated (removed entries)" -ForegroundColor $Color.Success
}

Write-Host ""
Write-Host "Current Ingress entries:" -ForegroundColor $Color.Info
Get-Content $hostsPath | Select-String "argocd.local|agro.local" | ForEach-Object { Write-Host "   $_" -ForegroundColor $Color.Muted }

Write-Host ""
Write-Host "You can now access:" -ForegroundColor $Color.Info
Write-Host "   ArgoCD: http://argocd.local" -ForegroundColor $Color.Success
Write-Host "   Apps:   http://agro.local" -ForegroundColor $Color.Success
Write-Host ""
