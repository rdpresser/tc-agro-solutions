# =====================================================
# Fix Docker Desktop IPv6 Connectivity Issues
# =====================================================
# Purpose: Resolve IPv6 timeout errors when pulling images
# Error: dial tcp [2606:4700:2ff9::1]:443: connectex timeout
# Target: Cloudflare R2 (Docker Hub storage backend)
# =====================================================

param(
    [switch]$DiagnoseOnly,
    [switch]$Force
)

$ErrorActionPreference = "Stop"

# Color functions
function Write-Success { param($Message) Write-Host "✓ $Message" -ForegroundColor Green }
function Write-Info { param($Message) Write-Host "ℹ $Message" -ForegroundColor Cyan }
function Write-Warning { param($Message) Write-Host "⚠ $Message" -ForegroundColor Yellow }
function Write-Error { param($Message) Write-Host "✗ $Message" -ForegroundColor Red }
function Write-Section { param($Message) Write-Host "`n=== $Message ===" -ForegroundColor Magenta }

# Check admin privileges
function Test-Admin {
    $currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    return $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# Get Docker Desktop network adapters
function Get-DockerAdapters {
    Get-NetAdapter | Where-Object { 
        $_.InterfaceDescription -match "Docker|WSL|Hyper-V" -or 
        $_.Name -match "vEthernet|DockerNAT"
    }
}

# Check IPv6 status on adapters
function Get-IPv6Status {
    $adapters = Get-DockerAdapters
    $results = @()
    
    foreach ($adapter in $adapters) {
        $ipv6 = Get-NetAdapterBinding -Name $adapter.Name -ComponentID ms_tcpip6 -ErrorAction SilentlyContinue
        $results += [PSCustomObject]@{
            Name                 = $adapter.Name
            InterfaceDescription = $adapter.InterfaceDescription
            Status               = $adapter.Status
            IPv6Enabled          = $ipv6.Enabled
        }
    }
    
    return $results
}

# Test connectivity to Docker Hub
function Test-DockerHubConnectivity {
    Write-Info "Testing connectivity to Docker Hub..."
    
    # Test IPv4
    Write-Host "  IPv4: " -NoNewline
    try {
        $ipv4 = Test-NetConnection -ComputerName registry-1.docker.io -Port 443 -WarningAction SilentlyContinue
        if ($ipv4.TcpTestSucceeded) {
            Write-Success "OK"
        }
        else {
            Write-Error "FAILED"
        }
    }
    catch {
        Write-Error "FAILED - $_"
    }
    
    # Test IPv6
    Write-Host "  IPv6: " -NoNewline
    try {
        # Force IPv6 resolution
        $ipv6Test = Test-NetConnection -ComputerName registry-1.docker.io -Port 443 -InformationLevel Detailed -WarningAction SilentlyContinue
        if ($ipv6Test.RemoteAddress -like "*:*") {
            Write-Warning "IPv6 route exists but may timeout"
        }
        else {
            Write-Info "No IPv6 route"
        }
    }
    catch {
        Write-Info "No IPv6 connectivity"
    }
}

# Disable IPv6 on Docker adapters
function Disable-DockerIPv6 {
    $adapters = Get-DockerAdapters
    $modified = 0
    
    foreach ($adapter in $adapters) {
        $ipv6 = Get-NetAdapterBinding -Name $adapter.Name -ComponentID ms_tcpip6 -ErrorAction SilentlyContinue
        
        if ($ipv6 -and $ipv6.Enabled) {
            Write-Info "Disabling IPv6 on: $($adapter.Name)"
            try {
                Disable-NetAdapterBinding -Name $adapter.Name -ComponentID ms_tcpip6 -Confirm:$false
                Write-Success "Disabled IPv6 on $($adapter.Name)"
                $modified++
            }
            catch {
                Write-Error "Failed to disable IPv6 on $($adapter.Name): $_"
            }
        }
        else {
            Write-Info "IPv6 already disabled on: $($adapter.Name)"
        }
    }
    
    return $modified
}

# Main execution
Write-Section "Docker Desktop IPv6 Diagnostics"

# Check admin
if (-not (Test-Admin)) {
    Write-Error "This script requires Administrator privileges"
    Write-Info "Right-click PowerShell and select 'Run as Administrator'"
    exit 1
}

# Show Docker Engine config
Write-Section "Current Docker Engine Configuration"
$dockerConfigPath = "$env:USERPROFILE\.docker\daemon.json"
if (Test-Path $dockerConfigPath) {
    Write-Info "Docker daemon.json:"
    Get-Content $dockerConfigPath | ConvertFrom-Json | ConvertTo-Json -Depth 10
    Write-Host ""
}
else {
    Write-Warning "No daemon.json found at $dockerConfigPath"
}

# Show network adapters
Write-Section "Docker Network Adapters"
$adapters = Get-IPv6Status

if ($adapters.Count -eq 0) {
    Write-Warning "No Docker network adapters found"
    Write-Info "Docker Desktop may not be running"
}
else {
    $adapters | Format-Table -AutoSize
}

# Test connectivity
Write-Section "Connectivity Test"
Test-DockerHubConnectivity

# Check if any adapter has IPv6 enabled
$ipv6Enabled = $adapters | Where-Object { $_.IPv6Enabled -eq $true }

if ($ipv6Enabled.Count -gt 0) {
    Write-Warning "Found $($ipv6Enabled.Count) adapter(s) with IPv6 enabled"
    Write-Info "This may cause timeout errors when pulling images"
    
    if ($DiagnoseOnly) {
        Write-Info "`nRun without -DiagnoseOnly to disable IPv6"
    }
    else {
        Write-Host "`nDisable IPv6 on Docker adapters? [Y/n]: " -NoNewline -ForegroundColor Yellow
        $response = if ($Force) { "Y" } else { Read-Host }
        
        if ($response -eq "" -or $response -eq "Y" -or $response -eq "y") {
            Write-Section "Disabling IPv6"
            $modified = Disable-DockerIPv6
            
            if ($modified -gt 0) {
                Write-Success "`nDisabled IPv6 on $modified adapter(s)"
                Write-Info "Restart Docker Desktop for changes to take effect:"
                Write-Host "  1. Right-click Docker Desktop tray icon" -ForegroundColor Cyan
                Write-Host "  2. Select 'Restart'" -ForegroundColor Cyan
                Write-Host "  3. Wait for Docker to restart (~30 seconds)" -ForegroundColor Cyan
                Write-Host "  4. Try pulling images again in VS 2026" -ForegroundColor Cyan
            }
        }
        else {
            Write-Info "Operation cancelled"
        }
    }
}
else {
    Write-Success "All Docker adapters have IPv6 disabled"
    Write-Info "IPv6 timeout issue should be resolved"
    
    Write-Host "`nIf you still see errors:"
    Write-Host "  1. Restart Docker Desktop" -ForegroundColor Yellow
    Write-Host "  2. Clear Docker image cache: docker system prune -a" -ForegroundColor Yellow
    Write-Host "  3. Check Windows Firewall settings" -ForegroundColor Yellow
}

Write-Section "Alternative Solutions"
Write-Host "If the problem persists, try:" -ForegroundColor Cyan
Write-Host "  1. Use Docker Hub mirror (China/Asia mirrors)" -ForegroundColor Gray
Write-Host "  2. Pre-pull images manually: docker pull redis:8.4.0-alpine" -ForegroundColor Gray
Write-Host "  3. Use alternative image tags (redis:7-alpine instead of 8.4.0)" -ForegroundColor Gray
Write-Host "  4. Build images locally instead of pulling" -ForegroundColor Gray

Write-Host "`nDone! ✓" -ForegroundColor Green
