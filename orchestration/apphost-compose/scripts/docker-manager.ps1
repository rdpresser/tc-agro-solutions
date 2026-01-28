<#
.SYNOPSIS
  Docker Manager - Central orchestrator for TC Agro local environment management.

.DESCRIPTION
  Main script that centralizes and facilitates access to all Docker Compose
  management scripts. Provides an interactive menu and command line support.

.PARAMETER Command
  Command to execute. Use --help to see the full list.

.PARAMETER Service
  Specific service (used with restart, logs, etc).

.EXAMPLE
  .\docker-manager.ps1
  # Opens interactive menu

.EXAMPLE
  .\docker-manager.ps1 --help
  # Shows all available commands

.EXAMPLE
  .\docker-manager.ps1 start
  # Starts all services

.EXAMPLE
  .\docker-manager.ps1 restart identity
  # Restarts only identity service

.EXAMPLE
  .\docker-manager.ps1 logs rabbitmq -f
  # Shows live logs for RabbitMQ
#>

[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [string]$Command,

    [Parameter(Position = 1)]
    [string]$Service,

    [Parameter(ValueFromRemainingArguments)]
    [string[]]$RemainingArgs
)

# Colors and formatting
$script:Colors = @{
    Title   = "Cyan"
    Success = "Green"
    Warning = "Yellow"
    Error   = "Red"
    Info    = "White"
    Muted   = "Gray"
}

# Script paths
$script:ScriptPath = $PSScriptRoot
$script:RootPath = Split-Path $ScriptPath -Parent

function Show-Header {
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor $Colors.Title
    Write-Host "║          🌾 TC Agro Docker Manager v1.0                   ║" -ForegroundColor $Colors.Title
    Write-Host "║          Local Development Environment Manager            ║" -ForegroundColor $Colors.Title
    Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor $Colors.Title
    Write-Host ""
}

function Show-Help {
    Show-Header

    Write-Host "📖 AVAILABLE COMMANDS:" -ForegroundColor $Colors.Title
    Write-Host ""

    Write-Host "  🚀 ENVIRONMENT MANAGEMENT:" -ForegroundColor $Colors.Info
    Write-Host "    start               " -NoNewline -ForegroundColor $Colors.Success
    Write-Host "Starts all services (builds if needed)" -ForegroundColor $Colors.Muted
    Write-Host "    stop                " -NoNewline -ForegroundColor $Colors.Success
    Write-Host "Stops all services (preserves volumes)" -ForegroundColor $Colors.Muted
    Write-Host "    restart [service]   " -NoNewline -ForegroundColor $Colors.Success
    Write-Host "Restarts services (all or specific)" -ForegroundColor $Colors.Muted
    Write-Host "    cleanup             " -NoNewline -ForegroundColor $Colors.Success
    Write-Host "Removes containers and volumes (safe - TC Agro only)" -ForegroundColor $Colors.Muted
    Write-Host ""

    Write-Host "  🔍 MONITORING & DIAGNOSTICS:" -ForegroundColor $Colors.Info
    Write-Host "    status              " -NoNewline -ForegroundColor $Colors.Success
    Write-Host "Shows complete environment status" -ForegroundColor $Colors.Muted
    Write-Host "    diagnose            " -NoNewline -ForegroundColor $Colors.Success
    Write-Host "Runs full diagnostics with detailed report" -ForegroundColor $Colors.Muted
    Write-Host "    logs [service] [-f] " -NoNewline -ForegroundColor $Colors.Success
    Write-Host "Shows logs (all or specific, -f for follow)" -ForegroundColor $Colors.Muted
    Write-Host "    ps                  " -NoNewline -ForegroundColor $Colors.Success
    Write-Host "Lists running containers" -ForegroundColor $Colors.Muted
    Write-Host ""

    Write-Host "  🔧 TROUBLESHOOTING:" -ForegroundColor $Colors.Info
    Write-Host "    fix-rabbitmq        " -NoNewline -ForegroundColor $Colors.Success
    Write-Host "Fixes RabbitMQ health check issues" -ForegroundColor $Colors.Muted
    Write-Host "    rebuild [service]   " -NoNewline -ForegroundColor $Colors.Success
    Write-Host "Rebuilds and restarts services" -ForegroundColor $Colors.Muted
    Write-Host ""

    Write-Host "  🐳 DOCKER OPERATIONS:" -ForegroundColor $Colors.Info
    Write-Host "    build [service]     " -NoNewline -ForegroundColor $Colors.Success
    Write-Host "Builds Docker images (all or specific)" -ForegroundColor $Colors.Muted
    Write-Host "    pull                " -NoNewline -ForegroundColor $Colors.Success
    Write-Host "Pulls latest base images" -ForegroundColor $Colors.Muted
    Write-Host "    update-versions     " -NoNewline -ForegroundColor $Colors.Success
    Write-Host "Check/update service versions in docker-compose.yml" -ForegroundColor $Colors.Muted
    Write-Host "    exec <service> <cmd>" -NoNewline -ForegroundColor $Colors.Success
    Write-Host "Executes command in container" -ForegroundColor $Colors.Muted
    Write-Host ""

    Write-Host "  ℹ️  INFORMATION:" -ForegroundColor $Colors.Info
    Write-Host "    help                " -NoNewline -ForegroundColor $Colors.Success
    Write-Host "Shows this help" -ForegroundColor $Colors.Muted
    Write-Host "    menu                " -NoNewline -ForegroundColor $Colors.Success
    Write-Host "Opens interactive menu" -ForegroundColor $Colors.Muted
    Write-Host ""

    Write-Host "📝 EXAMPLES:" -ForegroundColor $Colors.Title
    Write-Host "  .\docker-manager.ps1 start" -ForegroundColor $Colors.Muted
    Write-Host "  .\docker-manager.ps1 status" -ForegroundColor $Colors.Muted
    Write-Host "  .\docker-manager.ps1 restart identity" -ForegroundColor $Colors.Muted
    Write-Host "  .\docker-manager.ps1 logs rabbitmq -f" -ForegroundColor $Colors.Muted
    Write-Host "  .\docker-manager.ps1 diagnose" -ForegroundColor $Colors.Muted
    Write-Host "  .\docker-manager.ps1 fix-rabbitmq" -ForegroundColor $Colors.Muted
    Write-Host "  .\docker-manager.ps1 cleanup" -ForegroundColor $Colors.Muted
    Write-Host "  .\docker-manager.ps1 exec postgres psql -U postgres -d agro" -ForegroundColor $Colors.Muted
    Write-Host ""

    Write-Host "🔗 SERVICE ACCESS:" -ForegroundColor $Colors.Title
    Write-Host "  Infrastructure:" -ForegroundColor $Colors.Info
    Write-Host "    PostgreSQL:    localhost:5432" -ForegroundColor $Colors.Muted
    Write-Host "    pgAdmin:       http://localhost:15432 (admin@admin.com / admin)" -ForegroundColor $Colors.Muted
    Write-Host "    Redis:         localhost:6379" -ForegroundColor $Colors.Muted
    Write-Host "    RabbitMQ UI:   http://localhost:15672 (guest / guest)" -ForegroundColor $Colors.Muted
    Write-Host ""
    Write-Host "  Services:" -ForegroundColor $Colors.Info
    Write-Host "    Identity API:  http://localhost:5001/swagger" -ForegroundColor $Colors.Muted
    Write-Host "    Health Check:  http://localhost:5001/health" -ForegroundColor $Colors.Muted
    Write-Host "    Frontend POC:  http://localhost:5010/" -ForegroundColor $Colors.Muted
    Write-Host ""
    Write-Host "  Observability:" -ForegroundColor $Colors.Info
    Write-Host "    Grafana:       http://localhost:3000 (admin / admin)" -ForegroundColor $Colors.Muted
    Write-Host "    Prometheus:    http://localhost:9090" -ForegroundColor $Colors.Muted
    Write-Host "    Loki:          http://localhost:3100" -ForegroundColor $Colors.Muted
    Write-Host "    Tempo:         http://localhost:3200" -ForegroundColor $Colors.Muted
    Write-Host ""
}

function Show-Status {
    Show-Header
    Write-Host "📊 DOCKER ENVIRONMENT STATUS" -ForegroundColor $Colors.Title
    Write-Host ""

    Set-Location $script:RootPath
    
    # Docker
    Write-Host "🐳 Docker Desktop:" -ForegroundColor $Colors.Info
    try {
        docker version | Out-Null
        Write-Host "   ✅ Running" -ForegroundColor $Colors.Success
    }
    catch {
        Write-Host "   ❌ Not running" -ForegroundColor $Colors.Error
        return
    }

    # Containers
    Write-Host "`n📦 TC Agro Containers:" -ForegroundColor $Colors.Info
    $containers = docker ps -a --filter "label=tc-agro.component" --format "{{.Names}}\t{{.Status}}\t{{.State}}"
    
    if ($containers) {
        $running = ($containers | Where-Object { $_ -match "Up" } | Measure-Object).Count
        $total = ($containers | Measure-Object).Count
        Write-Host "   📊 $running/$total running" -ForegroundColor $Colors.Info
        Write-Host ""
        Write-Host "   Container Status:" -ForegroundColor $Colors.Muted
        docker compose ps
    }
    else {
        Write-Host "   ⚠️  No containers running" -ForegroundColor $Colors.Warning
        Write-Host "   💡 Run: .\docker-manager.ps1 start" -ForegroundColor $Colors.Info
    }

    # Health checks
    Write-Host "`n🏥 Health Status:" -ForegroundColor $Colors.Info
    $services = docker compose config --services 2>$null
    if ($services) {
        foreach ($service in $services) {
            $container = docker compose ps -q $service 2>&1
            if ($container -and $container -ne "") {
                $health = docker inspect -f '{{.State.Health.Status}}' $container 2>&1
                $symbol = switch ($health) {
                    "healthy" { "✅"; break }
                    "unhealthy" { "❌"; break }
                    "starting" { "⏳"; break }
                    default { "⚪" }
                }
                $color = switch ($health) {
                    "healthy" { $Colors.Success; break }
                    "unhealthy" { $Colors.Error; break }
                    "starting" { $Colors.Warning; break }
                    default { $Colors.Muted }
                }
                Write-Host "   $symbol $service`: $health" -ForegroundColor $color
            }
        }
    }

    # Resources
    Write-Host "`n💾 Docker Resources:" -ForegroundColor $Colors.Info
    $volumes = docker volume ls --filter "label=com.docker.compose.project=tc-agro-local" --quiet 2>$null
    if ($volumes) {
        $volumeCount = ($volumes | Measure-Object).Count
        Write-Host "   📦 Volumes: $volumeCount" -ForegroundColor $Colors.Info
    }

    $networks = docker network ls --filter "label=com.docker.compose.project=tc-agro-local" --quiet 2>$null
    if ($networks) {
        $networkCount = ($networks | Measure-Object).Count
        Write-Host "   🌐 Networks: $networkCount" -ForegroundColor $Colors.Info
    }

    Write-Host ""
}

function Show-Menu {
    while ($true) {
        Show-Header
        Write-Host "📋 MAIN MENU" -ForegroundColor $Colors.Title
        Write-Host ""
        Write-Host "  🚀 ENVIRONMENT" -ForegroundColor $Colors.Info
        Write-Host "  [1] Start all services" -ForegroundColor $Colors.Muted
        Write-Host "  [2] Stop all services" -ForegroundColor $Colors.Muted
        Write-Host "  [3] Restart services" -ForegroundColor $Colors.Muted
        Write-Host "  [4] Cleanup (remove containers & volumes)" -ForegroundColor $Colors.Muted
        Write-Host ""
        Write-Host "  🔍 MONITORING" -ForegroundColor $Colors.Info
        Write-Host "  [5] Show status" -ForegroundColor $Colors.Muted
        Write-Host "  [6] Run diagnostics" -ForegroundColor $Colors.Muted
        Write-Host "  [7] Show logs" -ForegroundColor $Colors.Muted
        Write-Host "  [8] List containers" -ForegroundColor $Colors.Muted
        Write-Host ""
        Write-Host "  🔧 TROUBLESHOOTING" -ForegroundColor $Colors.Info
        Write-Host "  [9] Fix RabbitMQ" -ForegroundColor $Colors.Muted
        Write-Host " [10] Rebuild services" -ForegroundColor $Colors.Muted
        Write-Host ""
        Write-Host "  🔄 MAINTENANCE" -ForegroundColor $Colors.Info
        Write-Host " [11] Check/update service versions" -ForegroundColor $Colors.Muted
        Write-Host ""
        Write-Host "  [0] ❌ Exit" -ForegroundColor $Colors.Error
        Write-Host ""

        $choice = Read-Host "Choose an option"

        switch ($choice) {
            "1" { Invoke-Command "start" }
            "2" { Invoke-Command "stop" }
            "3" { Invoke-Command "restart" }
            "4" { Invoke-Command "cleanup" }
            "5" { Invoke-Command "status" }
            "6" { Invoke-Command "diagnose" }
            "7" { Invoke-Command "logs" }
            "8" { Invoke-Command "ps" }
            "9" { Invoke-Command "fix-rabbitmq" }
            "10" { Invoke-Command "rebuild" }
            "11" { Invoke-Command "update-versions" }
            "0" {
                Write-Host "`n👋 Goodbye!" -ForegroundColor $Colors.Success
                exit 0
            }
            default {
                Write-Host "`n❌ Invalid option!" -ForegroundColor $Colors.Error
                Start-Sleep -Seconds 2
            }
        }

        Write-Host "`nPress any key to continue..." -ForegroundColor $Colors.Muted
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    }
}

function Invoke-Command($cmd, $arg1 = "", $arg2 = "") {
    Set-Location $script:RootPath

    switch ($cmd.ToLower()) {
        "start" {
            Write-Host "`n🚀 Starting all services..." -ForegroundColor $Colors.Info
            & "$script:ScriptPath\start.ps1"
        }
        "stop" {
            Write-Host "`n🛑 Stopping all services..." -ForegroundColor $Colors.Info
            docker compose down
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✅ Services stopped successfully" -ForegroundColor $Colors.Success
            }
        }
        "restart" {
            $svc = if ($arg1) { $arg1 } else { "" }
            Write-Host "`n🔄 Restarting services..." -ForegroundColor $Colors.Info
            if ($svc) {
                docker compose restart $svc
            }
            else {
                docker compose restart
            }
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✅ Services restarted successfully" -ForegroundColor $Colors.Success
            }
        }
        "cleanup" {
            Write-Host "`n🧹 Cleaning up TC Agro resources..." -ForegroundColor $Colors.Warning
            & "$script:ScriptPath\cleanup.ps1"
        }
        "status" {
            Show-Status
        }
        "diagnose" {
            Write-Host "`n🔍 Running diagnostics..." -ForegroundColor $Colors.Info
            & "$script:ScriptPath\diagnose.ps1"
        }
        { $_ -in "logs", "log" } {
            $svc = if ($arg1) { $arg1 } else { "" }
            $followFlag = if ($arg2 -eq "-f" -or $RemainingArgs -contains "-f") { "-f" } else { "" }
            
            Write-Host "`n📋 Showing logs..." -ForegroundColor $Colors.Info
            if ($svc) {
                if ($followFlag) {
                    docker compose logs -f $svc
                }
                else {
                    docker compose logs --tail=50 $svc
                }
            }
            else {
                if ($followFlag) {
                    docker compose logs -f
                }
                else {
                    docker compose logs --tail=50
                }
            }
        }
        "ps" {
            Write-Host "`n📦 Container List:" -ForegroundColor $Colors.Info
            docker compose ps
        }
        "fix-rabbitmq" {
            Write-Host "`n🐰 Fixing RabbitMQ..." -ForegroundColor $Colors.Info
            & "$script:ScriptPath\fix-rabbitmq.ps1"
        }
        { $_ -in "rebuild", "build" } {
            $svc = if ($arg1) { $arg1 } else { "" }
            Write-Host "`n🔨 Rebuilding services..." -ForegroundColor $Colors.Info
            if ($svc) {
                docker compose build $svc
                docker compose up -d $svc
            }
            else {
                docker compose build
                docker compose up -d
            }
        }
        "pull" {
            Write-Host "`n⬇️  Pulling latest images..." -ForegroundColor $Colors.Info
            docker compose pull
        }
        { $_ -in "update-versions", "update", "versions" } {
            Write-Host "`n🔄 Checking service versions..." -ForegroundColor $Colors.Info
            & "$script:ScriptPath\update-service-versions.ps1"
            if ($LASTEXITCODE -eq 1) {
                Write-Host ""
                $response = Read-Host "Updates available. Apply now? (y/N)"
                if ($response -eq 'y' -or $response -eq 'Y') {
                    Write-Host ""
                    & "$script:ScriptPath\update-service-versions.ps1" -Apply
                    if ($LASTEXITCODE -eq 0) {
                        Write-Host ""
                        Write-Host "💡 Next steps:" -ForegroundColor $Colors.Info
                        Write-Host "   1. Review changes: git diff docker-compose.yml" -ForegroundColor $Colors.Muted
                        Write-Host "   2. Pull images: \"docker compose pull\"" -ForegroundColor $Colors.Muted
                        Write-Host "   3. Restart: \"docker compose up -d\"" -ForegroundColor $Colors.Muted
                    }
                }
            }
        }
        "exec" {
            if (-not $arg1) {
                Write-Host "❌ Usage: exec <service> <command>" -ForegroundColor $Colors.Error
                return
            }
            $execArgs = @($arg1) + @($arg2) + $RemainingArgs
            docker compose exec @execArgs
        }
        { $_ -in "help", "--help", "-h", "/?" } {
            Show-Help
        }
        "menu" {
            Show-Menu
        }
        default {
            Write-Host "`n❌ Unknown command: $cmd" -ForegroundColor $Colors.Error
            Write-Host "Run with --help to see available commands." -ForegroundColor $Colors.Muted
            exit 1
        }
    }
}

# Main execution
if (-not $Command) {
    # No parameters: open interactive menu
    Show-Menu
}
elseif ($Command -in @("help", "--help", "-h", "/?")) {
    Show-Help
}
else {
    Invoke-Command $Command $Service $RemainingArgs
}
