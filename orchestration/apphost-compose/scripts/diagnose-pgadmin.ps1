<#
.SYNOPSIS
  Diagnose PgAdmin configuration issues

.DESCRIPTION
  Checks PgAdmin configuration consistency between:
  - Host file (docker_pgadmin_servers.json)
  - Mounted file inside container
  - PgAdmin internal storage

.EXAMPLE
  .\diagnose-pgadmin.ps1
#>

$ErrorActionPreference = "Continue"

$Color = @{
    Title   = "Cyan"
    Success = "Green"
    Warning = "Yellow"
    Error   = "Red"
    Info    = "White"
    Muted   = "Gray"
}

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor $Color.Title
Write-Host "║         PGADMIN CONFIGURATION DIAGNOSTICS                  ║" -ForegroundColor $Color.Title
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor $Color.Title
Write-Host ""

# Change to apphost-compose directory
$scriptPath = Split-Path -Parent $PSScriptRoot
Set-Location $scriptPath

# 1. Check host file
Write-Host "1️⃣  HOST CONFIGURATION FILE" -ForegroundColor $Color.Title
Write-Host "   ──────────────────────────────" -ForegroundColor $Color.Muted

$configFile = ".\docker_pgadmin_servers.json"

if (Test-Path $configFile) {
    Write-Host "   ✅ File exists: $configFile" -ForegroundColor $Color.Success
    
    try {
        $config = Get-Content $configFile | ConvertFrom-Json
        $serverName = $config.Servers."1".Name
        $pgHost = $config.Servers."1".Host
        $pgPort = $config.Servers."1".Port
        $dbNames = @($config.Servers."1".Databases.PSObject.Properties.Name)
        
        Write-Host "   📋 Server Name: $serverName" -ForegroundColor $Color.Info
        Write-Host "   🔌 Host: $pgHost" -ForegroundColor $Color.Info
        Write-Host "   🔢 Port: $pgPort" -ForegroundColor $Color.Info
        Write-Host "   💾 Databases: $($dbNames -join ', ')" -ForegroundColor $Color.Success
    }
    catch {
        Write-Host "   ❌ Invalid JSON format" -ForegroundColor $Color.Error
        Write-Host "      Error: $($_.Exception.Message)" -ForegroundColor $Color.Muted
    }
}
else {
    Write-Host "   ❌ File NOT found: $configFile" -ForegroundColor $Color.Error
}

# 2. Check container
Write-Host ""
Write-Host "2️⃣  PGADMIN CONTAINER STATUS" -ForegroundColor $Color.Title
Write-Host "   ──────────────────────────────" -ForegroundColor $Color.Muted

$container = docker ps --filter "name=tc-agro-pgadmin" --format "{{.Names}}" 2>$null
$containerStatus = docker ps --filter "name=tc-agro-pgadmin" --format "{{.Status}}" 2>$null

if ($container) {
    Write-Host "   ✅ Container: $container" -ForegroundColor $Color.Success
    Write-Host "   📊 Status: $containerStatus" -ForegroundColor $Color.Info
    $containerRunning = $true
}
else {
    Write-Host "   ❌ Container NOT running" -ForegroundColor $Color.Error
    $containerRunning = $false
}

# 3. Check volume
Write-Host ""
Write-Host "3️⃣  PGADMIN VOLUME" -ForegroundColor $Color.Title
Write-Host "   ──────────────────────────────" -ForegroundColor $Color.Muted

$volumeName = "tc-agro-pgadmin-data"
$volume = docker volume inspect $volumeName 2>$null | ConvertFrom-Json

if ($volume) {
    Write-Host "   ✅ Volume exists: $volumeName" -ForegroundColor $Color.Success
    Write-Host "   📁 Mountpoint: $($volume.Mountpoint)" -ForegroundColor $Color.Muted
    $volumeExists = $true
}
else {
    Write-Host "   ⚠️  Volume NOT found (will be created on next start)" -ForegroundColor $Color.Warning
    $volumeExists = $false
}

# 4. Check mounted config
Write-Host ""
Write-Host "4️⃣  MOUNTED CONFIGURATION" -ForegroundColor $Color.Title
Write-Host "   ──────────────────────────────" -ForegroundColor $Color.Muted

if ($containerRunning) {
    $mountedConfigJson = docker exec tc-agro-pgadmin cat /pgadmin4/servers.json 2>$null
    
    if ($mountedConfigJson) {
        Write-Host "   ✅ Mount successful" -ForegroundColor $Color.Success
        
        try {
            $mountedConfig = $mountedConfigJson | ConvertFrom-Json
            $mountedDbNames = @($mountedConfig.Servers."1".Databases.PSObject.Properties.Name)
            
            Write-Host "   💾 Mounted Databases: $($mountedDbNames -join ', ')" -ForegroundColor $Color.Info
            
            # Compare with host file
            if ($dbNames -and ($mountedDbNames -join ',') -eq ($dbNames -join ',')) {
                Write-Host "   ✅ Configuration matches host file" -ForegroundColor $Color.Success
                $configMatch = $true
            }
            else {
                Write-Host "   ⚠️  Configuration MISMATCH detected!" -ForegroundColor $Color.Warning
                Write-Host "      Host file:    $($dbNames -join ', ')" -ForegroundColor $Color.Muted
                Write-Host "      Mounted file: $($mountedDbNames -join ', ')" -ForegroundColor $Color.Muted
                $configMatch = $false
            }
        }
        catch {
            Write-Host "   ❌ Invalid mounted configuration" -ForegroundColor $Color.Error
        }
    }
    else {
        Write-Host "   ❌ Mount failed or file not accessible" -ForegroundColor $Color.Error
    }
}
else {
    Write-Host "   ⚠️  Cannot check - container not running" -ForegroundColor $Color.Warning
}

# 5. Summary and recommendations
Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor $Color.Title
Write-Host "║                  📋 RECOMMENDATIONS                        ║" -ForegroundColor $Color.Title
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor $Color.Title
Write-Host ""

if (-not (Test-Path $configFile)) {
    Write-Host "⚠️  CRITICAL: Configuration file missing!" -ForegroundColor $Color.Error
    Write-Host "   • Restore docker_pgadmin_servers.json from Git" -ForegroundColor $Color.Info
    Write-Host ""
}

if (-not $containerRunning) {
    Write-Host "🚀 RECOMMENDED: Start services" -ForegroundColor $Color.Warning
    Write-Host "   • Run: .\start.ps1" -ForegroundColor $Color.Success
    Write-Host ""
}

if ($containerRunning -and $volumeExists -and $configMatch -eq $false) {
    Write-Host "⚠️  ISSUE: Configuration mismatch detected!" -ForegroundColor $Color.Error
    Write-Host ""
    Write-Host "   🔧 SOLUTION 1: Reset PgAdmin (recommended)" -ForegroundColor $Color.Info
    Write-Host "      .\scripts\cleanup.ps1 pgadmin -Force" -ForegroundColor $Color.Success
    Write-Host "      .\start.ps1" -ForegroundColor $Color.Success
    Write-Host ""
    Write-Host "   🔧 SOLUTION 2: Force config reload (keep data)" -ForegroundColor $Color.Info
    Write-Host "      docker cp .\docker_pgadmin_servers.json tc-agro-pgadmin:/pgadmin4/servers.json" -ForegroundColor $Color.Success
    Write-Host "      docker restart tc-agro-pgadmin" -ForegroundColor $Color.Success
    Write-Host ""
}

if ($containerRunning -and $volumeExists -and $configMatch -eq $true) {
    Write-Host "✅ HEALTHY: Configuration is correct!" -ForegroundColor $Color.Success
    Write-Host ""
    Write-Host "   🌐 Access PgAdmin:" -ForegroundColor $Color.Info
    Write-Host "      • URL: http://localhost:15432" -ForegroundColor $Color.Success
    Write-Host "      • Email: admin@admin.com" -ForegroundColor $Color.Muted
    Write-Host "      • Password: admin" -ForegroundColor $Color.Muted
    Write-Host ""
    Write-Host "   💡 TIP: If browser shows old config, clear cache (Ctrl+Shift+Delete)" -ForegroundColor $Color.Warning
    Write-Host ""
}

Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor $Color.Success
Write-Host "║                    DIAGNOSTICS COMPLETE                    ║" -ForegroundColor $Color.Success
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor $Color.Success
Write-Host ""

# Open browser if healthy
if ($containerRunning -and $configMatch) {
    $openBrowser = Read-Host "Open PgAdmin in browser? (y/n)"
    if ($openBrowser -eq "y") {
        Start-Process "http://localhost:15432"
    }
}
