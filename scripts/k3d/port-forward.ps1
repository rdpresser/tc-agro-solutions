<#
.SYNOPSIS
  Sets up background port-forwards for Kubernetes services.

.DESCRIPTION
  Manages background kubectl port-forward processes for:
  - argocd (8090:80)
  - grafana (3000:80)
  - prometheus (9090:9090)
  - loki (3100:3100)
  - tempo (3200:3100)
  - frontend (3080:80)

.EXAMPLE
  .\port-forward.ps1 argocd
  .\port-forward.ps1 grafana
  .\port-forward.ps1 frontend
  .\port-forward.ps1 all
#>

param(
    [ValidateSet("argocd", "grafana", "prometheus", "loki", "tempo", "frontend", "identity", "all")]
    [string]$Service = "grafana"
)

$ErrorActionPreference = "Stop"

$portForwards = @{
    argocd     = @{ namespace = "argocd"; service = "argocd-server"; localPort = 8090; remotePort = 80 }
    grafana    = @{ namespace = "monitoring"; service = "kube-prom-stack-grafana"; localPort = 3000; remotePort = 80 }
    prometheus = @{ namespace = "monitoring"; service = "kube-prom-stack-kube-prome-prometheus"; localPort = 9090; remotePort = 9090 }
    loki       = @{ namespace = "monitoring"; service = "loki"; localPort = 3100; remotePort = 3100 }
    tempo      = @{ namespace = "monitoring"; service = "tempo"; localPort = 3200; remotePort = 3100 }
    frontend   = @{ namespace = "agro-apps"; service = "frontend"; localPort = 3080; remotePort = 80 }
    identity   = @{ namespace = "agro-apps"; service = "identity-api"; localPort = 5001; remotePort = 80 }
}

$Color = @{
    Title   = "Cyan"
    Success = "Green"
    Warning = "Yellow"
    Error   = "Red"
    Info    = "White"
    Muted   = "Gray"
}

# Function to check if port-forward is already running for a specific service
function Test-PortForwardRunning($port, $serviceName) {
    # First check if port is in use
    $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($connections.Count -eq 0) {
        return $false
    }

    # Check if it's a kubectl port-forward for this specific service
    $kubectlProcs = Get-Process -Name kubectl -ErrorAction SilentlyContinue
    if (-not $kubectlProcs) {
        # Port in use but not kubectl - consider as free for our purposes
        return $false
    }

    $foundProcesses = @()
    foreach ($proc in $kubectlProcs) {
        try {
            $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $($proc.Id)").CommandLine
            # Check if it's port-forward for the same service and port
            if ($cmdLine -and
                $cmdLine -like "*port-forward*" -and
                $cmdLine -like "*svc/$serviceName*" -and
                $cmdLine -like "*$port`:*") {
                
                $foundProcesses += $proc.Id
                Write-Host "   ℹ️  Found existing process: PID $($proc.Id)" -ForegroundColor $Color.Muted
            }
        }
        catch {
            continue
        }
    }

    # If we found multiple processes, kill all but the first one
    if ($foundProcesses.Count -gt 1) {
        Write-Host "   ⚠️  Found $($foundProcesses.Count) duplicate processes, cleaning up..." -ForegroundColor $Color.Warning
        for ($i = 1; $i -lt $foundProcesses.Count; $i++) {
            $processId = $foundProcesses[$i]
            Write-Host "   🔫 Killing duplicate process: PID $processId" -ForegroundColor $Color.Warning
            Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
        }
        Start-Sleep -Seconds 2
        return $true
    }

    return $foundProcesses.Count -gt 0
}

# Function to start port-forward in background
function Start-PortForward($serviceName, $namespace, $port, $targetPort) {
    # Check if port-forward already exists for this service on this port
    if (Test-PortForwardRunning $port $serviceName) {
        Write-Host "⚠️  Port-forward for $serviceName is already running on port $port" -ForegroundColor $Color.Warning
        return $null
    }

    Write-Host "🚀 Starting port-forward for $serviceName..." -ForegroundColor $Color.Info
    
    # Display correct URL based on service
    if ($serviceName -eq "argocd-server") {
        Write-Host "   📡 Accessible at: http://localhost:$port/argocd/" -ForegroundColor $Color.Success
    }
    else {
        Write-Host "   📡 Accessible at: http://localhost:$port" -ForegroundColor $Color.Success
    }

    # Start process in background
    $process = Start-Process -FilePath kubectl `
        -ArgumentList "port-forward", "svc/$serviceName", "-n", "$namespace", "${port}:${targetPort}", "--address", "127.0.0.1" `
        -WindowStyle Hidden `
        -PassThru

    Write-Host "   ⏳ Process started: PID $($process.Id)" -ForegroundColor $Color.Muted

    # Wait a moment to ensure port-forward is active
    Start-Sleep -Seconds 3

    # Check if process is still running
    if ($process.HasExited) {
        Write-Host "❌ Failed to start port-forward for $serviceName" -ForegroundColor $Color.Error
        Write-Host "   The process terminated immediately. Check if the service exists in the cluster." -ForegroundColor $Color.Warning
        return $null
    }

    # Validate if the port is actually listening
    $portCheck = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if (-not $portCheck) {
        Write-Host "❌ Port-forward started but port $port is not listening" -ForegroundColor $Color.Error
        Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
        return $null
    }

    Write-Host "✅ Port-forward for $serviceName started (PID: $($process.Id))" -ForegroundColor $Color.Success
    return $process
}

function Write-Title {
    param([string]$Text)
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor $Color.Title
    Write-Host "║  $Text" -ForegroundColor $Color.Title
    Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor $Color.Title
}

# Check if kubectl is available
if (-not (Get-Command kubectl -ErrorAction SilentlyContinue)) {
    Write-Host "❌ ERROR: kubectl not found in PATH" -ForegroundColor $Color.Error
    exit 1
}

Write-Title "Setting up Port-Forwards"

$servicesToForward = if ($Service -eq "all") { $portForwards.Keys } else { @($Service) }
$processes = @()

foreach ($svc in $servicesToForward) {
    $pf = $portForwards[$svc]
    $ns = $pf.namespace
    $name = $pf.service
    $local = $pf.localPort
    $remote = $pf.remotePort
    
    Write-Host ""
    Write-Host "🔗 $svc ($local → $remote)" -ForegroundColor $Color.Info
    
    # Check if service exists
    $svcExists = kubectl get svc $name -n $ns -o jsonpath="{.metadata.name}" 2>$null
    if (-not $svcExists) {
        Write-Host "   ⚠️  Service not found: $name in $ns" -ForegroundColor $Color.Warning
        continue
    }
    
    # Start port-forward using the robust function
    $proc = Start-PortForward $name $ns $local $remote
    if ($proc) { 
        $processes += $proc 
    }
}

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor $Color.Success
Write-Host "║  ✅ Port-forwards ready!                                  ║" -ForegroundColor $Color.Success
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor $Color.Success
Write-Host ""
Write-Host "📌 Access Points:" -ForegroundColor $Color.Info
foreach ($svc in $servicesToForward) {
    if ($portForwards.ContainsKey($svc)) {
        $pf = $portForwards[$svc]
        if ($svc -eq "argocd") {
            Write-Host "   • http://localhost:$($pf.localPort)/argocd/" -ForegroundColor $Color.Info
        }
        else {
            Write-Host "   • http://localhost:$($pf.localPort)" -ForegroundColor $Color.Info
        }
    }
}
Write-Host ""
Write-Host "💡 Stop port-forwards: .\stop-port-forward.ps1" -ForegroundColor $Color.Info
Write-Host ""
