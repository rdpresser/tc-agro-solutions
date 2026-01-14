<#
.SYNOPSIS
  K3D Manager - Central orchestrator for local k3d cluster management.

.DESCRIPTION
  Main script that centralizes and facilitates access to all k3d cluster
  management scripts. Provides an interactive menu and command line support.

.PARAMETER Command
  Command to execute. Use --help to see the full list.

.PARAMETER Service
  Specific service (used with port-forward/stop-port-forward).

.PARAMETER Id
  Specific PID (used with stop-port-forward).

.EXAMPLE
  .\k3d-manager.ps1
  # Opens interactive menu

.EXAMPLE
  .\k3d-manager.ps1 --help
  # Shows all available commands

.EXAMPLE
  .\k3d-manager.ps1 create
  # Creates cluster from scratch

.EXAMPLE
  .\k3d-manager.ps1 port-forward grafana
  # Starts port-forward for Grafana (only management service that needs it)
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
    Title = "Cyan"
    Success = "Green"
    Warning = "Yellow"
    Error = "Red"
    Info = "White"
    Muted = "Gray"
}

function Show-Header {
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor $Colors.Title
    Write-Host "║          🚀 K3D Cluster Manager v1.0                      ║" -ForegroundColor $Colors.Title
    Write-Host "║          Local Kubernetes Cluster Manager                 ║" -ForegroundColor $Colors.Title
    Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor $Colors.Title
    Write-Host ""
}

function Show-Help {
    Show-Header

    Write-Host "📖 AVAILABLE COMMANDS:" -ForegroundColor $Colors.Title
    Write-Host ""

    Write-Host "  🔧 CLUSTER MANAGEMENT:" -ForegroundColor $Colors.Info
    Write-Host "    create              " -NoNewline -ForegroundColor $Colors.Success
    Write-Host "Creates/recreates complete cluster from scratch" -ForegroundColor $Colors.Muted
    Write-Host "    start               " -NoNewline -ForegroundColor $Colors.Success
    Write-Host "Starts cluster after computer reboot" -ForegroundColor $Colors.Muted
    Write-Host "    cleanup             " -NoNewline -ForegroundColor $Colors.Success
    Write-Host "Removes cluster, registry and resources" -ForegroundColor $Colors.Muted
    Write-Host ""

    Write-Host "  🔌 PORT-FORWARD:" -ForegroundColor $Colors.Info
    Write-Host "    port-forward        " -NoNewline -ForegroundColor $Colors.Success
    Write-Host "Starts port-forward for Grafana (only service that needs it)" -ForegroundColor $Colors.Muted
    Write-Host "    stop                " -NoNewline -ForegroundColor $Colors.Success
    Write-Host "Stops port-forward for Grafana" -ForegroundColor $Colors.Muted
    Write-Host "    list                " -NoNewline -ForegroundColor $Colors.Success
    Write-Host "Lists active port-forwards" -ForegroundColor $Colors.Muted
    Write-Host ""

    Write-Host "  🐳 DOCKER & NETWORK:" -ForegroundColor $Colors.Info
    Write-Host "    check               " -NoNewline -ForegroundColor $Colors.Success
    Write-Host "Checks Docker network connectivity" -ForegroundColor $Colors.Muted
    Write-Host "    update-hosts        " -NoNewline -ForegroundColor $Colors.Success
    Write-Host "Update hosts file (requires Admin) - adds argocd.local, cloudgames.local" -ForegroundColor $Colors.Muted
    Write-Host "    headlamp            " -NoNewline -ForegroundColor $Colors.Success
    Write-Host "Starts Headlamp UI (port 4466)" -ForegroundColor $Colors.Muted
    Write-Host ""

    Write-Host "  🔐 AZURE INTEGRATION:" -ForegroundColor $Colors.Info
    Write-Host "    external-secrets    " -NoNewline -ForegroundColor $Colors.Success
    Write-Host "Configures External Secrets with Azure Key Vault" -ForegroundColor $Colors.Muted
    Write-Host "    secrets [opts]      " -NoNewline -ForegroundColor $Colors.Success
    Write-Host "Lists/searches secrets (-SecretName, -Key, -Decode)" -ForegroundColor $Colors.Muted
    Write-Host ""

    Write-Host "  📦 BUILD & DEPLOY:" -ForegroundColor $Colors.Info
    Write-Host "    build [api]         " -NoNewline -ForegroundColor $Colors.Success
    Write-Host "Build and push Docker images (all/user/games/payments)" -ForegroundColor $Colors.Muted
    Write-Host "    bootstrap [env]     " -NoNewline -ForegroundColor $Colors.Success
    Write-Host "Bootstrap ArgoCD applications (dev/prod)" -ForegroundColor $Colors.Muted
    Write-Host ""

    Write-Host "  ℹ️  INFORMATION:" -ForegroundColor $Colors.Info
    Write-Host "    status              " -NoNewline -ForegroundColor $Colors.Success
    Write-Host "Shows complete cluster status" -ForegroundColor $Colors.Muted
    Write-Host "    help                " -NoNewline -ForegroundColor $Colors.Success
    Write-Host "Shows this help" -ForegroundColor $Colors.Muted
    Write-Host "    menu                " -NoNewline -ForegroundColor $Colors.Success
    Write-Host "Opens interactive menu" -ForegroundColor $Colors.Muted
    Write-Host ""

    Write-Host "📝 EXAMPLES:" -ForegroundColor $Colors.Title
    Write-Host "  .\k3d-manager.ps1 create" -ForegroundColor $Colors.Muted
    Write-Host "  .\k3d-manager.ps1 start" -ForegroundColor $Colors.Muted
    Write-Host "  .\k3d-manager.ps1 update-hosts" -ForegroundColor $Colors.Muted
    Write-Host "  .\k3d-manager.ps1 port-forward grafana" -ForegroundColor $Colors.Muted
    Write-Host "  .\k3d-manager.ps1 external-secrets" -ForegroundColor $Colors.Muted
    Write-Host "  .\k3d-manager.ps1 build" -ForegroundColor $Colors.Muted
    Write-Host "  .\k3d-manager.ps1 build user" -ForegroundColor $Colors.Muted
    Write-Host "  .\k3d-manager.ps1 bootstrap" -ForegroundColor $Colors.Muted
    Write-Host "  .\k3d-manager.ps1 reset-argocd" -ForegroundColor $Colors.Muted
    Write-Host "  .\k3d-manager.ps1 secrets" -ForegroundColor $Colors.Muted
    Write-Host "  .\k3d-manager.ps1 secrets -Key db-password" -ForegroundColor $Colors.Muted
    Write-Host ""

    Write-Host "🔗 SERVICE ACCESS:" -ForegroundColor $Colors.Title
    Write-Host "  Native Ingress Access (NO port-forward needed!):" -ForegroundColor $Colors.Info
    Write-Host "    ArgoCD:  http://argocd.local (admin / Argo@123)" -ForegroundColor $Colors.Muted
    Write-Host "    APIs:    http://cloudgames.local/user, /games, /payments" -ForegroundColor $Colors.Muted
    Write-Host "    ⚠️  Run first: .\k3d-manager.ps1 update-hosts (requires Admin)" -ForegroundColor $Colors.Warning
    Write-Host ""
    Write-Host "  Management Services (require port-forward):" -ForegroundColor $Colors.Info
    Write-Host "    Grafana: http://localhost:3000  (rdpresser / rdpresser@123)" -ForegroundColor $Colors.Muted
    Write-Host "    Headlamp: http://localhost:4466" -ForegroundColor $Colors.Muted
    Write-Host ""
}

function Show-Status {
    Show-Header
    Write-Host "📊 K3D CLUSTER STATUS" -ForegroundColor $Colors.Title
    Write-Host ""
    
    # Docker
    Write-Host "🐳 Docker Desktop:" -ForegroundColor $Colors.Info
    try {
        docker version | Out-Null
        Write-Host "   ✅ Running" -ForegroundColor $Colors.Success
    } catch {
        Write-Host "   ❌ Not running" -ForegroundColor $Colors.Error
        return
    }

    # Cluster k3d
    Write-Host "`n📦 K3D Cluster:" -ForegroundColor $Colors.Info
    $clusters = k3d cluster list 2>&1 | Out-String
    if ($clusters -match "dev") {
        Write-Host "   ✅ Cluster 'dev' found" -ForegroundColor $Colors.Success

        # Containers
        $containers = docker ps --filter "name=k3d-dev" --format "{{.Names}}\t{{.Status}}"
        $running = ($containers | Measure-Object).Count
        Write-Host "   📦 Containers running: $running" -ForegroundColor $Colors.Info
    } else {
        Write-Host "   ❌ Cluster 'dev' not found" -ForegroundColor $Colors.Error
        Write-Host "   💡 Run: .\k3d-manager.ps1 create" -ForegroundColor $Colors.Warning
        return
    }

    # Kubectl
    Write-Host "`n⚙️  Kubernetes API:" -ForegroundColor $Colors.Info
    try {
        kubectl cluster-info 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   ✅ API accessible" -ForegroundColor $Colors.Success

            # Nodes
            $nodes = kubectl get nodes --no-headers 2>$null
            if ($nodes) {
                $nodeCount = ($nodes | Measure-Object).Count
                Write-Host "   📍 Nodes ready: $nodeCount" -ForegroundColor $Colors.Info
            }
        } else {
            Write-Host "   ⚠️  API not responding" -ForegroundColor $Colors.Warning
        }
    } catch {
        Write-Host "   ❌ Could not connect to API" -ForegroundColor $Colors.Error
    }

    # Port-forwards
    Write-Host "`n🔌 Port-Forwards:" -ForegroundColor $Colors.Info
    $kubectlProcs = Get-Process -Name kubectl -ErrorAction SilentlyContinue | Where-Object {
        $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $($_.Id)" -ErrorAction SilentlyContinue).CommandLine
        $cmdLine -like "*port-forward*"
    }

    if ($kubectlProcs) {
        Write-Host "   ✅ Active: $($kubectlProcs.Count)" -ForegroundColor $Colors.Success
        Write-Host "   💡 Run: .\k3d-manager.ps1 list" -ForegroundColor $Colors.Info
    } else {
        Write-Host "   ⚠️  No active port-forwards" -ForegroundColor $Colors.Warning
        Write-Host "   💡 Run: .\k3d-manager.ps1 port-forward grafana" -ForegroundColor $Colors.Info
    }

    Write-Host ""
}

function Show-Menu {
    while ($true) {
        Show-Header
        Write-Host "📋 MAIN MENU" -ForegroundColor $Colors.Title
        Write-Host ""
        Write-Host "  [1] 🔧 Create cluster from scratch" -ForegroundColor $Colors.Info
        Write-Host "  [2] 🚀 Start cluster (after reboot)" -ForegroundColor $Colors.Info
        Write-Host "  [3] 🔌 Port-forward (Grafana)" -ForegroundColor $Colors.Info
        Write-Host "  [4] 🛑 Stop port-forwards" -ForegroundColor $Colors.Info
        Write-Host "  [5] 📋 List port-forwards" -ForegroundColor $Colors.Info
        Write-Host "  [6] 🐳 Check Docker" -ForegroundColor $Colors.Info
        Write-Host "  [7] 🌐 Update Hosts File (requires Admin)" -ForegroundColor $Colors.Info
        Write-Host "  [8] 📊 Cluster status" -ForegroundColor $Colors.Info
        Write-Host "  [9] 🎨 Start Headlamp UI" -ForegroundColor $Colors.Info
        Write-Host " [10] 🔐 Configure External Secrets (Azure Key Vault)" -ForegroundColor $Colors.Info
        Write-Host " [11] 🔑 List/Search Secrets" -ForegroundColor $Colors.Info
        Write-Host " [12] 🐳 Build & Push Docker Images" -ForegroundColor $Colors.Info
        Write-Host " [13] 🚀 Bootstrap ArgoCD Applications" -ForegroundColor $Colors.Info
        Write-Host " [14] 🔄 Reset ArgoCD Application" -ForegroundColor $Colors.Info
        Write-Host " [15] 🗑️  Cleanup all" -ForegroundColor $Colors.Info
        Write-Host "  [0] ❌ Exit" -ForegroundColor $Colors.Error
        Write-Host ""

        $choice = Read-Host "Choose an option"

        switch ($choice) {
            "1" { Invoke-Command "create" }
            "2" { Invoke-Command "start" }
            "3" { Invoke-Command -cmd "port-forward" -args @("grafana") }
            "4" { Invoke-Command -cmd "stop-port-forward" }
            "5" { Invoke-Command -cmd "list-port-forward" }
            "6" { Invoke-Command -cmd "check" }
            "7" { Invoke-Command -cmd "update-hosts" }
            "8" { Invoke-Command -cmd "status" }
            "9" { Invoke-Command -cmd "headlamp" }
            "10" { Invoke-Command -cmd "external-secrets" }
            "11" { Invoke-Command -cmd "list-secrets" }
            '12' { Invoke-Command -cmd "build-push" }
            '13' { Invoke-Command -cmd "bootstrap-argocd" }
            '14' { Invoke-Command -cmd "reset-argocd" }
            '15' { Invoke-Command -cmd "cleanup" }
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
    $scriptPath = $PSScriptRoot

    switch ($cmd.ToLower()) {
        "create" {
            Write-Host "`n🔧 Creating cluster from scratch..." -ForegroundColor $Colors.Info
            & "$scriptPath\create-all-from-zero.ps1"
        }
        "start" {
            Write-Host "`n🚀 Starting cluster..." -ForegroundColor $Colors.Info
            & "$scriptPath\start-cluster.ps1"
        }
        "cleanup" {
            Write-Host "`n🗑️  Cleaning up resources..." -ForegroundColor $Colors.Warning
            & "$scriptPath\cleanup-all.ps1"
        }
        "port-forward" {
            $svc = if ($arg1) { $arg1 } else { "all" }
            Write-Host "`n🔌 Starting port-forward ($svc)..." -ForegroundColor $Colors.Info
            & "$scriptPath\port-forward.ps1" $svc
        }
        { $_ -in "stop", "stop-port-forward" } {
            $svc = if ($arg1) { $arg1 } else { "all" }
            Write-Host "`n🛑 Stopping port-forwards ($svc)..." -ForegroundColor $Colors.Info
            if ($arg1 -match '^\d+$') {
                & "$scriptPath\stop-port-forward.ps1" -Id $arg1
            } else {
                & "$scriptPath\stop-port-forward.ps1" $svc
            }
        }
        { $_ -in "list", "list-port-forward" } {
            Write-Host "`n📋 Listing port-forwards..." -ForegroundColor $Colors.Info
            & "$scriptPath\list-port-forward.ps1"
        }
        { $_ -in "check", "check-docker" } {
            Write-Host "`n🐳 Checking Docker..." -ForegroundColor $Colors.Info
            & "$scriptPath\check-docker-network.ps1"
        }
        { $_ -in "update-hosts", "hosts" } {
            Write-Host "`n🌐 Updating hosts file..." -ForegroundColor $Colors.Info
            Write-Host "⚠️  This requires Administrator privileges!" -ForegroundColor $Colors.Warning
            Write-Host ""
            & "$scriptPath\update-hosts-file.ps1"
        }
        "headlamp" {
            Write-Host "`n🎨 Starting Headlamp..." -ForegroundColor $Colors.Info
            & "$scriptPath\start-headlamp-docker.ps1"
        }
        "external-secrets" {
            Write-Host "`n🔐 Configuring External Secrets with Azure Key Vault..." -ForegroundColor $Colors.Info
            & "$scriptPath\setup-external-secrets.ps1"
        }
        { $_ -in "secrets", "list-secrets" } {
            Write-Host "`n🔑 Listing secrets..." -ForegroundColor $Colors.Info
            # Pass remaining arguments to the script
            $secretsArgs = @()
            if ($arg1) { $secretsArgs += $arg1 }
            if ($arg2) { $secretsArgs += $arg2 }
            & "$scriptPath\list-secrets.ps1" @secretsArgs
        }
        { $_ -in "build", "build-push" } {
            Write-Host "`n🐳 Building and pushing Docker images..." -ForegroundColor $Colors.Info
            $api = if ($arg1) { $arg1 } else { "all" }
            & "$scriptPath\build-push-images.ps1" -Api $api -Restart
        }
        { $_ -in "bootstrap", "bootstrap-argocd" } {
            Write-Host "`n🚀 Bootstrapping ArgoCD applications..." -ForegroundColor $Colors.Info
            $env = if ($arg1) { $arg1 } else { "dev" }
            & "$scriptPath\bootstrap-argocd-apps.ps1" -Environment $env
        }
        { $_ -in "reset", "reset-argocd" } {
            Write-Host "`n🔄 Resetting ArgoCD application..." -ForegroundColor $Colors.Info
            & "$scriptPath\reset-argocd-app.ps1"
        }
        "status" {
            Show-Status
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
} elseif ($Command -in @("help", "--help", "-h", "/?")) {
    Show-Help
} else {
    Invoke-Command $Command $Service $RemainingArgs
}
