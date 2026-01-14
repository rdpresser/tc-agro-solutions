<#
.SYNOPSIS
  Adds required DNS entries to Windows hosts file for local k3d cluster.

.DESCRIPTION
  Adds cloudgames.local and argocd.local entries to C:\Windows\System32\drivers\etc\hosts
  pointing to 127.0.0.1 for native Ingress access without port-forward.
  
  ⚠️ REQUIRES ADMINISTRATOR PRIVILEGES

.PARAMETER Remove
  Remove the entries instead of adding them.

.EXAMPLE
  .\update-hosts-file.ps1
  # Adds entries to hosts file

.EXAMPLE
  .\update-hosts-file.ps1 -Remove
  # Removes entries from hosts file
#>

[CmdletBinding()]
param(
    [Parameter()]
    [switch]$Remove
)

$hostsFile = "C:\Windows\System32\drivers\etc\hosts"
$cloudgamesEntry = "127.0.0.1 cloudgames.local"
$argocdEntry = "127.0.0.1 argocd.local"

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host ""
    Write-Host "❌ ERROR: This script requires Administrator privileges!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please run PowerShell as Administrator and try again:" -ForegroundColor Yellow
    Write-Host "  1. Right-click PowerShell" -ForegroundColor Gray
    Write-Host "  2. Select 'Run as Administrator'" -ForegroundColor Gray
    Write-Host "  3. Navigate to: $PSScriptRoot" -ForegroundColor Gray
    Write-Host "  4. Run: .\update-hosts-file.ps1" -ForegroundColor Gray
    Write-Host ""
    exit 1
}

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║          📝 Update Hosts File for K3D Ingress            ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

try {
    # Read current hosts file
    $hostsContent = Get-Content $hostsFile -ErrorAction Stop
    
    if ($Remove) {
        Write-Host "🗑️  Removing entries from hosts file..." -ForegroundColor Yellow
        Write-Host ""
        
        # Remove entries
        $newContent = $hostsContent | Where-Object { 
            $_ -notmatch "cloudgames\.local" -and $_ -notmatch "argocd\.local"
        }
        
        # Write back
        $newContent | Set-Content $hostsFile -Force
        
        Write-Host "✅ Entries removed successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Removed:" -ForegroundColor Gray
        Write-Host "  - cloudgames.local" -ForegroundColor Gray
        Write-Host "  - argocd.local" -ForegroundColor Gray
        
    } else {
        Write-Host "📝 Adding entries to hosts file..." -ForegroundColor Cyan
        Write-Host ""
        
        $modified = $false
        
        # Check if cloudgames.local already exists
        if ($hostsContent -match "cloudgames\.local") {
            Write-Host "ℹ️  cloudgames.local already exists in hosts file" -ForegroundColor Yellow
        } else {
            Add-Content -Path $hostsFile -Value $cloudgamesEntry
            Write-Host "✅ Added: $cloudgamesEntry" -ForegroundColor Green
            $modified = $true
        }
        
        # Check if argocd.local already exists
        if ($hostsContent -match "argocd\.local") {
            Write-Host "ℹ️  argocd.local already exists in hosts file" -ForegroundColor Yellow
        } else {
            Add-Content -Path $hostsFile -Value $argocdEntry
            Write-Host "✅ Added: $argocdEntry" -ForegroundColor Green
            $modified = $true
        }
        
        Write-Host ""
        if ($modified) {
            Write-Host "✅ Hosts file updated successfully!" -ForegroundColor Green
        } else {
            Write-Host "✅ All entries already present!" -ForegroundColor Green
        }
        
        Write-Host ""
        Write-Host "📋 Current entries:" -ForegroundColor Cyan
        Get-Content $hostsFile | Where-Object { $_ -match "cloudgames\.local|argocd\.local" } | ForEach-Object {
            Write-Host "  $_" -ForegroundColor Gray
        }
    }
    
    Write-Host ""
    Write-Host "🌐 Access URLs (after deploying applications):" -ForegroundColor Cyan
    Write-Host "  • ArgoCD:       http://argocd.local" -ForegroundColor White
    Write-Host "  • User API:     http://cloudgames.local/user" -ForegroundColor White
    Write-Host "  • Games API:    http://cloudgames.local/games" -ForegroundColor White
    Write-Host "  • Payments API: http://cloudgames.local/payments" -ForegroundColor White
    Write-Host ""
    Write-Host "💡 Note: ArgoCD credentials are admin / Argo@123" -ForegroundColor Gray
    Write-Host ""
    
} catch {
    Write-Host ""
    Write-Host "❌ ERROR: Failed to update hosts file!" -ForegroundColor Red
    Write-Host "   $_" -ForegroundColor Red
    Write-Host ""
    exit 1
}
