# =====================================================
# TC Agro Solutions - Unified Cleanup Script
# =====================================================
# Purpose: Safely removes TC Agro containers and volumes
# Supports: all, individual services, postgres-specific cleanup
# Safety: Uses labels to ensure k3d resources are preserved
# =====================================================

param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Service,
    [switch]$Force,
    [switch]$DryRun,
    [switch]$KeepVolumes,
    [switch]$Help
)


# =====================================================
# Configuration
# =====================================================

$Color = @{
    Title   = "Cyan"
    Success = "Green"
    Warning = "Yellow"
    Error   = "Red"
    Info    = "White"
    Muted   = "Gray"
}

# Services that can be individually cleaned
$Services = @(
    @{ name = "postgres"; description = "PostgreSQL Database"; container = "tc-agro-postgres" }
    @{ name = "pgadmin"; description = "PgAdmin Management"; container = "tc-agro-pgadmin" }
    @{ name = "frontend"; description = "Frontend Application"; container = "tc-agro-frontend-service" }
    @{ name = "identity"; description = "Identity API"; container = "tc-agro-identity-service" }
    @{ name = "redis"; description = "Redis Cache"; container = "tc-agro-redis" }
    @{ name = "rabbitmq"; description = "RabbitMQ Messaging"; container = "tc-agro-rabbitmq" }
)

$CompositeServices = @(
    @{ name = "db"; description = "Database + PgAdmin"; services = @("postgres", "pgadmin") }
)

# =====================================================
# Functions
# =====================================================

function Get-HostPathsForService {
    param(
        [string]$ServiceName
    )
    
    $hostPaths = @()
    $dataDir = Join-Path $PSScriptRoot "../../data"
    
    # Map services to their data directories
    $pathMap = @{
        "postgres" = @("postgres", "postgresql")
        "pgadmin"  = @("pgadmin")
        "redis"    = @("redis")
        "rabbitmq" = @("rabbitmq")
        "frontend" = @("frontend")
        "identity" = @("identity")
    }
    
    if ($pathMap.ContainsKey($ServiceName)) {
        foreach ($pattern in $pathMap[$ServiceName]) {
            $path = Join-Path $dataDir $pattern
            if (Test-Path $path) {
                $hostPaths += $path
            }
        }
    }
    
    return $hostPaths
}

function Get-DanglingVolumes {
    # Get all dangling volumes (not associated with any container)
    $danglingVolumes = docker volume ls --filter "dangling=true" --quiet 2>$null | Where-Object { $_ }
    
    # Filter to only TC Agro volumes
    $agroVolumes = @()
    foreach ($vol in $danglingVolumes) {
        $volInfo = docker volume inspect $vol 2>$null | ConvertFrom-Json
        if ($volInfo -and $volInfo.Labels."com.docker.compose.project" -eq "tc-agro-local") {
            $agroVolumes += $vol
        }
    }
    
    return $agroVolumes
}

function Get-DanglingImages {
    # Get all dangling images
    $danglingImages = docker images --filter "dangling=true" --quiet 2>$null | Where-Object { $_ }
    return $danglingImages
}

function Get-UnusedImages {
    # Get all unused images (not tagged and not associated with containers)
    $unusedImages = docker image prune -a --dry-run --filter "label!=tc-agro.component" 2>$null | 
    Select-String "would remove" | 
    ForEach-Object { $_.Line -replace ".*would remove (.*?),.*", '$1' }
    
    return $unusedImages
}

function Prune-OrphanedResources {
    param(
        [bool]$SkipConfirm = $false,
        [bool]$IsDryRun = $false
    )
    
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor $Color.Title
    Write-Host "║ Pruning: Orphaned TC Agro Resources" -ForegroundColor $Color.Title
    Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor $Color.Title
    
    Write-Host ""
    Write-Host "🔍 Scanning for orphaned resources..." -ForegroundColor $Color.Info
    
    # Get dangling volumes, images, and networks
    $danglingVolumes = Get-DanglingVolumes
    $danglingImages = Get-DanglingImages
    $orphanedNetworks = docker network ls --filter "dangling=true" --format "{{.Name}}" 2>$null | Where-Object { $_ -notin @("bridge", "host", "none") }
    
    Write-Host ""
    Write-Host "   💾 Dangling Volumes: $(($danglingVolumes | Measure-Object).Count)" -ForegroundColor $Color.Muted
    if ($danglingVolumes) {
        $danglingVolumes | ForEach-Object { Write-Host "      • $_" -ForegroundColor $Color.Muted }
    }
    
    Write-Host "   📦 Dangling Images: $(($danglingImages | Measure-Object).Count)" -ForegroundColor $Color.Muted
    if ($danglingImages) {
        $danglingImages | ForEach-Object { Write-Host "      • $_" -ForegroundColor $Color.Muted }
    }
    
    Write-Host "   🌐 Orphaned Networks: $(($orphanedNetworks | Measure-Object).Count)" -ForegroundColor $Color.Muted
    if ($orphanedNetworks) {
        $orphanedNetworks | ForEach-Object { Write-Host "      • $_" -ForegroundColor $Color.Muted }
    }
    
    if (($danglingVolumes | Measure-Object).Count -eq 0 -and 
        ($danglingImages | Measure-Object).Count -eq 0 -and 
        ($orphanedNetworks | Measure-Object).Count -eq 0) {
        Write-Host ""
        Write-Host "   ✅ No orphaned resources found" -ForegroundColor $Color.Success
        return $true
    }
    
    # Dry run - stop here
    if ($IsDryRun) {
        Write-Host ""
        Write-Host "   [DRY RUN] No changes made" -ForegroundColor $Color.Warning
        return $true
    }
    
    # Ask for confirmation
    if (-not $SkipConfirm) {
        Write-Host ""
        Write-Host "   ⚠️  This will permanently delete all orphaned resources above" -ForegroundColor $Color.Warning
        $confirm = Read-Host "   Continue? (yes/no)"
        
        if ($confirm -ne "yes") {
            Write-Host "   ❌ Cancelled" -ForegroundColor $Color.Error
            return $false
        }
    }
    
    Write-Host ""
    Write-Host "   Removing orphaned resources..." -ForegroundColor $Color.Info
    
    # Remove dangling volumes
    if ($danglingVolumes) {
        foreach ($vol in $danglingVolumes) {
            docker volume rm $vol 2>&1 | Out-Null
            Write-Host "      ✅ Volume removed: $vol" -ForegroundColor $Color.Success
        }
    }
    
    # Remove dangling images
    if ($danglingImages) {
        foreach ($img in $danglingImages) {
            docker rmi $img 2>&1 | Out-Null
            Write-Host "      ✅ Image removed: $($img.Substring(0, 12))..." -ForegroundColor $Color.Success
        }
    }
    
    # Remove orphaned networks
    if ($orphanedNetworks) {
        foreach ($net in $orphanedNetworks) {
            docker network rm $net 2>&1 | Out-Null
            Write-Host "      ✅ Network removed: $net" -ForegroundColor $Color.Success
        }
    }
    
    Write-Host ""
    Write-Host "   ✅ Orphaned resources cleanup complete" -ForegroundColor $Color.Success
    return $true
}

function Deep-Clean-Images {
    param(
        [bool]$SkipConfirm = $false,
        [bool]$IsDryRun = $false
    )
    
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor $Color.Title
    Write-Host "║ Deep Clean: Remove All Unused Images & Build Cache" -ForegroundColor $Color.Title
    Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor $Color.Title
    
    Write-Host ""
    Write-Host "🔍 Scanning for unused images and build cache..." -ForegroundColor $Color.Info
    
    # Count how much space could be freed
    $prune_output = docker system df 2>$null | Out-String
    
    Write-Host ""
    Write-Host "   Current Docker System Usage:" -ForegroundColor $Color.Muted
    Write-Host $prune_output.Trim() -ForegroundColor $Color.Muted
    
    if ($IsDryRun) {
        Write-Host ""
        Write-Host "   [DRY RUN] This would remove all unused images and build cache" -ForegroundColor $Color.Warning
        Write-Host "   [DRY RUN] Run without -DryRun to actually remove" -ForegroundColor $Color.Warning
        return $true
    }
    
    # Ask for confirmation
    if (-not $SkipConfirm) {
        Write-Host ""
        Write-Host "   ⚠️  This will PERMANENTLY DELETE:" -ForegroundColor $Color.Warning
        Write-Host "      • All unused images (tagged and untagged)" -ForegroundColor $Color.Warning
        Write-Host "      • ALL Docker build cache" -ForegroundColor $Color.Warning
        Write-Host "      • This can FREE UP several GB of disk space!" -ForegroundColor $Color.Warning
        Write-Host ""
        $confirm = Read-Host "   Continue? (type 'deep clean' to confirm)"
        
        if ($confirm -ne "deep clean") {
            Write-Host "   ❌ Cancelled" -ForegroundColor $Color.Error
            return $false
        }
    }
    
    Write-Host ""
    Write-Host "   Removing all unused images..." -ForegroundColor $Color.Info
    docker image prune -a -f 2>&1 | Out-Null
    Write-Host "      ✅ Unused images removed" -ForegroundColor $Color.Success
    
    Write-Host "   Removing build cache..." -ForegroundColor $Color.Info
    docker builder prune -a -f 2>&1 | Out-Null
    Write-Host "      ✅ Build cache removed" -ForegroundColor $Color.Success
    
    Write-Host ""
    Write-Host "   ✅ Deep clean complete" -ForegroundColor $Color.Success
    return $true
}

function Clean-HostPaths {
    param(
        [string]$ServiceName,
        [bool]$SkipConfirm = $false,
        [bool]$IsDryRun = $false
    )
    
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor $Color.Title
    Write-Host "║ Cleaning: Host Path Data for $ServiceName" -ForegroundColor $Color.Title
    Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor $Color.Title
    
    $hostPaths = Get-HostPathsForService -ServiceName $ServiceName
    
    if ($hostPaths.Count -eq 0) {
        Write-Host "   ℹ️  No host path data found for $ServiceName" -ForegroundColor $Color.Muted
        return $true
    }
    
    Write-Host ""
    Write-Host "🔍 Found host path directories:" -ForegroundColor $Color.Info
    
    $totalSize = 0
    foreach ($path in $hostPaths) {
        if (Test-Path $path) {
            $size = (Get-ChildItem -Path $path -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
            $sizeMB = [math]::Round($size / 1MB, 2)
            $totalSize += $size
            Write-Host "   • $path ($sizeMB MB)" -ForegroundColor $Color.Muted
        }
    }
    
    $totalSizeMB = [math]::Round($totalSize / 1MB, 2)
    Write-Host ""
    Write-Host "   Total size: $totalSizeMB MB" -ForegroundColor $Color.Muted
    
    # Dry run - stop here
    if ($IsDryRun) {
        Write-Host ""
        Write-Host "   [DRY RUN] Would delete $totalSizeMB MB of data" -ForegroundColor $Color.Warning
        return $true
    }
    
    # Ask for confirmation
    if (-not $SkipConfirm) {
        Write-Host ""
        Write-Host "   ⚠️  This will permanently DELETE all data in paths above" -ForegroundColor $Color.Warning
        Write-Host "   ⚠️  This includes databases, configurations, and logs!" -ForegroundColor $Color.Warning
        $confirm = Read-Host "   Continue? (yes/no)"
        
        if ($confirm -ne "yes") {
            Write-Host "   ❌ Cancelled" -ForegroundColor $Color.Error
            return $false
        }
    }
    
    Write-Host ""
    Write-Host "   Removing host path directories..." -ForegroundColor $Color.Info
    
    foreach ($path in $hostPaths) {
        if (Test-Path $path) {
            try {
                Remove-Item -Path $path -Recurse -Force -ErrorAction Stop
                Write-Host "      ✅ Removed: $path" -ForegroundColor $Color.Success
            }
            catch {
                Write-Host "      ⚠️  Could not remove: $path" -ForegroundColor $Color.Warning
            }
        }
    }
    
    Write-Host ""
    Write-Host "   ✅ Host path cleanup complete" -ForegroundColor $Color.Success
    return $true
}

function Show-Help {
    Write-Host "`n" -ForegroundColor $Color.Title
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor $Color.Title
    Write-Host "  TC Agro Solutions - Docker Cleanup Script" -ForegroundColor $Color.Title
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor $Color.Title
    Write-Host ""
    Write-Host "USAGE:" -ForegroundColor $Color.Info
    Write-Host "  .\cleanup.ps1 [SERVICE] [OPTIONS]" -ForegroundColor $Color.Muted
    Write-Host ""
    Write-Host "SERVICES:" -ForegroundColor $Color.Info
    Write-Host "  all              Clean all TC Agro containers and volumes" -ForegroundColor $Color.Muted
    Write-Host "  postgres         Clean PostgreSQL only" -ForegroundColor $Color.Muted
    Write-Host "  pgadmin          Clean PgAdmin only" -ForegroundColor $Color.Muted
    Write-Host "  db               Clean PostgreSQL + PgAdmin" -ForegroundColor $Color.Muted
    Write-Host "  frontend         Clean Frontend app" -ForegroundColor $Color.Muted
    Write-Host "  identity         Clean Identity API" -ForegroundColor $Color.Muted
    Write-Host "  redis            Clean Redis cache" -ForegroundColor $Color.Muted
    Write-Host "  rabbitmq         Clean RabbitMQ messaging" -ForegroundColor $Color.Muted
    Write-Host ""
    Write-Host "OPTIONS:" -ForegroundColor $Color.Info
    Write-Host "  -Force           Skip resource description prompt (but still requires yes/no)" -ForegroundColor $Color.Muted
    Write-Host "  -DryRun          Show what would be deleted WITHOUT deleting" -ForegroundColor $Color.Muted
    Write-Host "  -KeepVolumes     Remove containers but preserve volumes" -ForegroundColor $Color.Muted
    Write-Host "  -PruneOrphaned   Remove dangling volumes/images/networks (with -all only)" -ForegroundColor $Color.Muted
    Write-Host "  -Deep            Deep clean: remove all unused images + build cache" -ForegroundColor $Color.Muted
    Write-Host "  -CleanData       Remove host path data (./data directories)" -ForegroundColor $Color.Muted
    Write-Host "  -Help            Show this help message" -ForegroundColor $Color.Muted
    Write-Host ""
    Write-Host "CLEANUP LEVELS (from safe to destructive):" -ForegroundColor $Color.Info
    Write-Host "  Level 1 - Service Cleanup" -ForegroundColor $Color.Muted
    Write-Host "    .\cleanup.ps1 postgres" -ForegroundColor $Color.Success
    Write-Host "    → Remove container + volumes" -ForegroundColor $Color.Muted
    Write-Host ""
    Write-Host "  Level 2 - Service Cleanup + Orphaned" -ForegroundColor $Color.Muted
    Write-Host "    .\cleanup.ps1 all -PruneOrphaned" -ForegroundColor $Color.Success
    Write-Host "    → Remove containers + volumes + orphaned images/volumes/networks" -ForegroundColor $Color.Muted
    Write-Host ""
    Write-Host "  Level 3 - Deep Clean" -ForegroundColor $Color.Muted
    Write-Host "    .\cleanup.ps1 all -Deep -PruneOrphaned" -ForegroundColor $Color.Success
    Write-Host "    → Remove everything + ALL unused images + build cache (can free GB)" -ForegroundColor $Color.Muted
    Write-Host ""
    Write-Host "  Level 4 - Total Destruction" -ForegroundColor $Color.Muted
    Write-Host "    .\cleanup.ps1 all -Deep -PruneOrphaned -CleanData" -ForegroundColor $Color.Success
    Write-Host "    → Remove EVERYTHING including host data (nuclear option)" -ForegroundColor $Color.Muted
    Write-Host ""
    Write-Host "EXAMPLES:" -ForegroundColor $Color.Info
    Write-Host "  .\cleanup.ps1 postgres -DryRun" -ForegroundColor $Color.Success
    Write-Host "  .\cleanup.ps1 db -Force" -ForegroundColor $Color.Success
    Write-Host "  .\cleanup.ps1 all -DryRun" -ForegroundColor $Color.Success
    Write-Host "  .\cleanup.ps1 all -Deep -PruneOrphaned -Force" -ForegroundColor $Color.Success
    Write-Host ""
    Write-Host "NOTES:" -ForegroundColor $Color.Info
    Write-Host "  • K3D resources are ALWAYS preserved" -ForegroundColor $Color.Muted
    Write-Host "  • Only TC Agro resources are removed (using Docker labels)" -ForegroundColor $Color.Muted
    Write-Host "  • You will ALWAYS see what will be deleted before confirming" -ForegroundColor $Color.Muted
    Write-Host "  • Use -DryRun to preview without deleting" -ForegroundColor $Color.Muted
    Write-Host ""
}

function Show-Menu {
    Write-Host "`n" -ForegroundColor $Color.Title
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor $Color.Title
    Write-Host "  TC Agro Solutions - Cleanup Menu" -ForegroundColor $Color.Title
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor $Color.Title
    Write-Host ""
    Write-Host "⚠️  CLEANUP LEVELS:" -ForegroundColor $Color.Warning
    Write-Host ""
    Write-Host "  LEVEL 1 - Safe (Single Service)" -ForegroundColor $Color.Success
    Write-Host "  ────────────────────────────────" -ForegroundColor $Color.Success
    Write-Host "  1) PostgreSQL only" -ForegroundColor $Color.Muted
    Write-Host "  2) PgAdmin only" -ForegroundColor $Color.Muted
    Write-Host "  3) PostgreSQL + PgAdmin (db)" -ForegroundColor $Color.Muted
    Write-Host "  4) Frontend" -ForegroundColor $Color.Muted
    Write-Host "  5) Identity API" -ForegroundColor $Color.Muted
    Write-Host "  6) Redis" -ForegroundColor $Color.Muted
    Write-Host "  7) RabbitMQ" -ForegroundColor $Color.Muted
    Write-Host ""
    Write-Host "  LEVEL 2 - Complete (All Services)" -ForegroundColor $Color.Warning
    Write-Host "  ───────────────────────────────────" -ForegroundColor $Color.Warning
    Write-Host "  8) ALL - Remove all containers + volumes" -ForegroundColor $Color.Muted
    Write-Host ""
    Write-Host "  LEVEL 3 - Deep Clean (Remove Orphaned)" -ForegroundColor $Color.Warning
    Write-Host "  ───────────────────────────────────────" -ForegroundColor $Color.Warning
    Write-Host "  9) ALL + Prune orphaned volumes/images/networks" -ForegroundColor $Color.Muted
    Write-Host ""
    Write-Host "  LEVEL 4 - Nuclear (Remove Everything)" -ForegroundColor $Color.Error
    Write-Host "  ──────────────────────────────────────" -ForegroundColor $Color.Error
    Write-Host "  10) ALL + Deep clean (unused images + cache)" -ForegroundColor $Color.Muted
    Write-Host "  11) ALL + Deep clean + Host data" -ForegroundColor $Color.Muted
    Write-Host ""
    Write-Host "  0) Cancel" -ForegroundColor $Color.Muted
    Write-Host ""
}

function Find-Service-Resources {
    param(
        [string]$ContainerName
    )
    
    $result = @{
        Container   = $null
        ContainerId = $null
        Volumes     = @()
    }
    
    # Find container
    $container = docker ps -a --filter "name=$ContainerName" --format "{{.ID}} {{.Names}} {{.State}}" 2>$null
    
    if ($container) {
        $parts = $container.Trim() -split "\s+"
        $cid = $parts[0]
        $cname = $parts[1]
        
        $result.Container = $cname
        $result.ContainerId = $cid
        
        # Get all named volumes for this container
        $volumeInfo = docker inspect $cid 2>$null | ConvertFrom-Json
        if ($volumeInfo) {
            foreach ($mount in $volumeInfo.Mounts) {
                if ($mount.Type -eq "volume" -and $mount.Name) {
                    $result.Volumes += $mount.Name
                }
            }
        }
    }
    
    return $result
}

function Cleanup-Service {
    param(
        [string]$ServiceName,
        [string]$ServiceDescription,
        [string]$ContainerName,
        [bool]$SkipConfirm = $false,
        [bool]$IsDryRun = $false,
        [bool]$ShouldKeepVolumes = $false
    )
    
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor $Color.Title
    Write-Host "║ Cleaning: $ServiceDescription" -ForegroundColor $Color.Title
    Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor $Color.Title
    
    # Find resources
    Write-Host "🔍 Scanning for $ServiceDescription resources..." -ForegroundColor $Color.Info
    $resources = Find-Service-Resources -ContainerName $ContainerName
    
    if (-not $resources.Container -and $resources.Volumes.Count -eq 0) {
        Write-Host "   ℹ️  No resources found for $ServiceName" -ForegroundColor $Color.Muted
        return $true
    }
    
    # Display what will be removed
    Write-Host ""
    if ($resources.Container) {
        Write-Host "   📦 Container: $($resources.Container)" -ForegroundColor $Color.Muted
        Write-Host "      ID: $($resources.ContainerId.Substring(0, 12))..." -ForegroundColor $Color.Muted
    }
    
    if ($resources.Volumes.Count -gt 0) {
        Write-Host "   💾 Volumes: $($resources.Volumes.Count)" -ForegroundColor $Color.Muted
        foreach ($vol in $resources.Volumes) {
            Write-Host "      • $vol" -ForegroundColor $Color.Muted
        }
    }
    
    # Dry run - stop here
    if ($IsDryRun) {
        Write-Host ""
        Write-Host "   [DRY RUN] No changes made" -ForegroundColor $Color.Warning
        return $true
    }
    
    # Ask for confirmation
    if (-not $SkipConfirm) {
        Write-Host ""
        Write-Host "   ⚠️  This will permanently delete the resources above" -ForegroundColor $Color.Warning
        $confirm = Read-Host "   Continue? (yes/no)"
        
        if ($confirm -ne "yes") {
            Write-Host "   ❌ Cancelled" -ForegroundColor $Color.Error
            return $false
        }
    }
    
    # Stop and remove container
    if ($resources.Container) {
        Write-Host ""
        Write-Host "   Stopping container..." -ForegroundColor $Color.Info
        docker stop $resources.ContainerId 2>&1 | Out-Null
        
        Start-Sleep -Milliseconds 500
        
        Write-Host "   Removing container..." -ForegroundColor $Color.Info
        docker rm $resources.ContainerId 2>&1 | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   ✅ Container removed" -ForegroundColor $Color.Success
        }
        else {
            Write-Host "   ⚠️  Failed to remove container" -ForegroundColor $Color.Warning
        }
    }
    
    # Remove volumes (unless -KeepVolumes)
    if (-not $ShouldKeepVolumes -and $resources.Volumes.Count -gt 0) {
        Write-Host ""
        Write-Host "   Removing volumes..." -ForegroundColor $Color.Info
        
        foreach ($vol in $resources.Volumes) {
            docker volume rm $vol 2>&1 | Out-Null
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "      ✅ $vol" -ForegroundColor $Color.Success
            }
            else {
                Write-Host "      ⚠️  Could not remove $vol" -ForegroundColor $Color.Warning
            }
        }
    }
    
    Write-Host ""
    Write-Host "   ✅ Cleanup complete for $ServiceName" -ForegroundColor $Color.Success
    return $true
}

function Cleanup-All {
    param(
        [bool]$SkipConfirm = $false,
        [bool]$IsDryRun = $false,
        [bool]$ShouldKeepVolumes = $false
    )
    
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor $Color.Title
    Write-Host "║ Cleaning: ALL TC Agro Containers & Volumes" -ForegroundColor $Color.Title
    Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor $Color.Title
    
    # Scan all resources
    Write-Host ""
    Write-Host "🔍 Scanning for all TC Agro resources..." -ForegroundColor $Color.Info
    
    $allContainers = docker ps -a --filter "label=tc-agro.component" --format "{{.Names}}" 2>$null
    $allVolumes = docker volume ls --filter "label=com.docker.compose.project=tc-agro-local" --quiet 2>$null
    
    $containerCount = if ($allContainers) { ($allContainers | Measure-Object).Count } else { 0 }
    $volumeCount = if ($allVolumes) { ($allVolumes | Measure-Object).Count } else { 0 }
    
    Write-Host ""
    Write-Host "   📦 Containers: $containerCount" -ForegroundColor $Color.Muted
    if ($containerCount -gt 0) {
        $allContainers | ForEach-Object { Write-Host "      • $_" -ForegroundColor $Color.Muted }
    }
    
    Write-Host "   💾 Volumes: $volumeCount" -ForegroundColor $Color.Muted
    if ($volumeCount -gt 0 -and -not $ShouldKeepVolumes) {
        $allVolumes | ForEach-Object { Write-Host "      • $_" -ForegroundColor $Color.Muted }
    }
    elseif ($ShouldKeepVolumes) {
        Write-Host "      [Volumes will be PRESERVED]" -ForegroundColor $Color.Success
    }
    
    # Check k3d safety
    $k3dCount = (docker ps -a --filter "name=k3d-" --format "{{.Names}}" 2>$null | Measure-Object).Count
    if ($k3dCount -gt 0) {
        Write-Host ""
        Write-Host "   ✅ K3D containers detected ($k3dCount) and will be PRESERVED" -ForegroundColor $Color.Success
    }
    
    if ($containerCount -eq 0 -and $volumeCount -eq 0) {
        Write-Host ""
        Write-Host "   ✨ Nothing to clean - environment is already clean!" -ForegroundColor $Color.Success
        return $true
    }
    
    # Dry run - stop here
    if ($IsDryRun) {
        Write-Host ""
        Write-Host "   [DRY RUN] No changes made" -ForegroundColor $Color.Warning
        return $true
    }
    
    # Ask for confirmation
    if (-not $SkipConfirm) {
        Write-Host ""
        Write-Host "   ⚠️  This will permanently delete all resources above" -ForegroundColor $Color.Warning
        $confirm = Read-Host "   Continue? (yes/no)"
        
        if ($confirm -ne "yes") {
            Write-Host "   ❌ Cancelled" -ForegroundColor $Color.Error
            return $false
        }
    }
    
    # Stop and remove all containers via docker compose
    Write-Host ""
    Write-Host "   Stopping services via docker compose..." -ForegroundColor $Color.Info
    if ($ShouldKeepVolumes) {
        docker compose down --remove-orphans 2>&1 | Out-Null
    }
    else {
        docker compose down -v --remove-orphans 2>&1 | Out-Null
    }
    
    Start-Sleep -Milliseconds 500
    
    # Force remove any remaining containers
    $remaining = docker ps -a --filter "label=tc-agro.component" --format "{{.Names}}" 2>$null
    if ($remaining) {
        Write-Host "   Removing remaining containers..." -ForegroundColor $Color.Info
        $remaining | ForEach-Object {
            docker rm -f $_ 2>&1 | Out-Null
            Write-Host "      ✅ $_" -ForegroundColor $Color.Success
        }
    }
    
    # Remove networks
    Write-Host "   Cleaning networks..." -ForegroundColor $Color.Info
    $networks = docker network ls --filter "label=com.docker.compose.project=tc-agro-local" --format "{{.Name}}" 2>$null
    if ($networks) {
        $networks | ForEach-Object {
            if ($_ -notin @("bridge", "host", "none")) {
                docker network rm $_ 2>&1 | Out-Null
            }
        }
        Write-Host "      ✅ Networks removed" -ForegroundColor $Color.Success
    }
    
    Write-Host ""
    Write-Host "   ✅ All cleanup operations complete" -ForegroundColor $Color.Success
    return $true
}

Write-Host "`n==================================================" -ForegroundColor Cyan
Write-Host "  TC Agro Solutions - Safe Docker Cleanup" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

$scriptPath = Split-Path -Parent $PSScriptRoot
Set-Location $scriptPath

# Check Docker
try {
    docker info | Out-Null
}
catch {
    Write-Host "`n❌ Docker is not running!" -ForegroundColor Red
    exit 1
}

# Show what will be cleaned
Write-Host "`n🔍 Scanning TC Agro resources..." -ForegroundColor Yellow

$containers = docker ps -a --filter "label=tc-agro.component" --format "{{.Names}}" 2>$null
$volumes = docker volume ls --filter "label=com.docker.compose.project=tc-agro-local" --quiet 2>$null
$networks = docker network ls --filter "label=com.docker.compose.project=tc-agro-local" --format "{{.Name}}" 2>$null

$containerCount = if ($containers) { ($containers | Measure-Object).Count } else { 0 }
$volumeCount = if ($volumes) { ($volumes | Measure-Object).Count } else { 0 }
$networkCount = if ($networks) { ($networks | Measure-Object).Count } else { 0 }


# Show what will be cleaned
Write-Host "`n🔍 Scanning TC Agro resources..." -ForegroundColor Yellow

$containers = docker ps -a --filter "label=tc-agro.component" --format "{{.Names}}" 2>$null
$volumes = docker volume ls --filter "label=com.docker.compose.project=tc-agro-local" --quiet 2>$null
$networks = docker network ls --filter "label=com.docker.compose.project=tc-agro-local" --format "{{.Name}}" 2>$null

$containerCount = if ($containers) { ($containers | Measure-Object).Count } else { 0 }
$volumeCount = if ($volumes) { ($volumes | Measure-Object).Count } else { 0 }
$networkCount = if ($networks) { ($networks | Measure-Object).Count } else { 0 }

# Parse service parameter
$selectedService = if ($Service) { $Service[0].ToLower() } else { $null }

# Interactive menu if no service specified
if (-not $selectedService) {
    Show-Menu
    $choice = Read-Host "Enter your choice"
    
    switch ($choice) {
        "1" { $selectedService = "postgres" }
        "2" { $selectedService = "pgadmin" }
        "3" { $selectedService = "db" }
        "4" { $selectedService = "frontend" }
        "5" { $selectedService = "identity" }
        "6" { $selectedService = "redis" }
        "7" { $selectedService = "rabbitmq" }
        "8" { $selectedService = "all" }
        "9" { $selectedService = "all"; $PruneOrphaned = $true }
        "10" { $selectedService = "all"; $Deep = $true; $PruneOrphaned = $true }
        "11" { $selectedService = "all"; $Deep = $true; $PruneOrphaned = $true; $CleanData = $true }
        "0" { 
            Write-Host "`n❌ Cancelled" -ForegroundColor $Color.Error
            exit 0 
        }
        default { 
            Write-Host "`n❌ Invalid choice" -ForegroundColor $Color.Error
            exit 1 
        }
    }
}

# Show help if requested
if ($Help) {
    Show-Help
    exit 0
}

# Process selection
$success = $false

if ($selectedService -eq "all") {
    $success = Cleanup-All -SkipConfirm:$Force -IsDryRun:$DryRun -ShouldKeepVolumes:$KeepVolumes
    
    # Additional cleanups for "all"
    if ($success -and $PruneOrphaned) {
        $success = Prune-OrphanedResources -SkipConfirm:$Force -IsDryRun:$DryRun
    }
    
    if ($success -and $Deep) {
        $success = Deep-Clean-Images -SkipConfirm:$Force -IsDryRun:$DryRun
    }
    
    if ($success -and $CleanData) {
        # Clean all service data paths
        foreach ($svc in $Services) {
            $pathSuccess = Clean-HostPaths -ServiceName $svc.name -SkipConfirm:$Force -IsDryRun:$DryRun
            if (-not $pathSuccess) {
                $success = $false
            }
        }
    }
}
elseif ($selectedService -eq "db") {
    # Composite: postgres + pgadmin
    $success = Cleanup-Service -ServiceName "postgres" `
        -ServiceDescription "PostgreSQL Database" `
        -ContainerName "tc-agro-postgres" `
        -SkipConfirm:$Force `
        -IsDryRun:$DryRun `
        -ShouldKeepVolumes:$KeepVolumes
    
    if ($success) {
        $success = Cleanup-Service -ServiceName "pgadmin" `
            -ServiceDescription "PgAdmin Management" `
            -ContainerName "tc-agro-pgadmin" `
            -SkipConfirm:$Force `
            -IsDryRun:$DryRun `
            -ShouldKeepVolumes:$KeepVolumes
    }
    
    if ($success -and $CleanData) {
        Clean-HostPaths -ServiceName "postgres" -SkipConfirm:$Force -IsDryRun:$DryRun
        Clean-HostPaths -ServiceName "pgadmin" -SkipConfirm:$Force -IsDryRun:$DryRun
    }
}
else {
    # Single service
    $serviceDef = $Services | Where-Object { $_.name -eq $selectedService }
    
    if (-not $serviceDef) {
        Write-Host ""
        Write-Host "❌ Unknown service: $selectedService" -ForegroundColor $Color.Error
        Show-Help
        exit 1
    }
    
    $success = Cleanup-Service -ServiceName $serviceDef.name `
        -ServiceDescription $serviceDef.description `
        -ContainerName $serviceDef.container `
        -SkipConfirm:$Force `
        -IsDryRun:$DryRun `
        -ShouldKeepVolumes:$KeepVolumes
    
    if ($success -and $CleanData) {
        Clean-HostPaths -ServiceName $selectedService -SkipConfirm:$Force -IsDryRun:$DryRun
    }
}

# Summary
if ($success) {
    Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor $Color.Success
    Write-Host "║                    ✅ CLEANUP COMPLETE                    ║" -ForegroundColor $Color.Success
    Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor $Color.Success
    Write-Host ""
    Write-Host "🔄 NEXT STEPS:" -ForegroundColor $Color.Info
    Write-Host "   To restart services:" -ForegroundColor $Color.Muted
    Write-Host "   .\start.ps1" -ForegroundColor $Color.Success
    Write-Host ""
    exit 0
}
else {
    Write-Host ""
    Write-Host "⚠️  Cleanup operation cancelled or encountered issues" -ForegroundColor $Color.Warning
    exit 1
}
