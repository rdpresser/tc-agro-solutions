<#
.SYNOPSIS
  Stop running k3d cluster without deleting it.

.DESCRIPTION
  Stops the k3d cluster gracefully, preserving all data.
  Cluster can be restarted later with start-cluster.ps1

.EXAMPLE
  .\stop-cluster.ps1
#>

$clusterName = "dev"
$registryName = "localhost"

$Color = @{
    Success = "Green"
    Error   = "Red"
    Info    = "Cyan"
    Muted   = "Gray"
    Warning = "Yellow"
}

Write-Host ""
Write-Host "=== Stopping cluster '$clusterName' ===" -ForegroundColor $Color.Info

# Check if cluster exists
Write-Host "   Checking if cluster exists..." -ForegroundColor $Color.Muted
$clusterExists = k3d cluster list 2>&1 | Select-String -Pattern "^$clusterName\s"
if (-not $clusterExists) {
    Write-Host "❌ Cluster '$clusterName' not found" -ForegroundColor $Color.Error
    Write-Host "   Use .\bootstrap.ps1 to create a cluster first" -ForegroundColor $Color.Warning
    exit 1
}

Write-Host "   ✅ Cluster exists" -ForegroundColor $Color.Success

# Stop all port-forwards first
Write-Host "   Stopping port-forwards..." -ForegroundColor $Color.Muted
$portForwardProcesses = Get-Process kubectl -ErrorAction SilentlyContinue | 
Where-Object { 
    try {
        $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $($_.Id)").CommandLine
        $cmdLine -like "*port-forward*"
    }
    catch { $false }
}

if ($portForwardProcesses) {
    $portForwardProcesses | Stop-Process -Force -ErrorAction SilentlyContinue
    Write-Host "   ✅ Port-forwards stopped" -ForegroundColor $Color.Success
    Start-Sleep -Seconds 1
}
else {
    Write-Host "   ℹ️  No port-forwards running" -ForegroundColor $Color.Muted
}

# Stop cluster
Write-Host "   Stopping cluster... (this may take 10-20 seconds)" -ForegroundColor $Color.Muted
$stopOutput = k3d cluster stop $clusterName 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to stop cluster" -ForegroundColor $Color.Error
    Write-Host "   Output: $stopOutput" -ForegroundColor $Color.Muted
    Write-Host "   Try: k3d cluster stop $clusterName" -ForegroundColor $Color.Warning
    exit 1
}

Write-Host "✅ Cluster stopped successfully" -ForegroundColor $Color.Success

# Give Docker time to stop containers
Start-Sleep -Seconds 2

# Stop registry as well (best effort)
Write-Host "   Stopping registry k3d-$registryName (if running)..." -ForegroundColor $Color.Muted
$regStop = k3d registry stop $registryName 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Registry stop issued" -ForegroundColor $Color.Success
} else {
    Write-Host "   ⚠️  Could not stop registry (may already be stopped or not present)" -ForegroundColor $Color.Warning
    Write-Host "      Output: $regStop" -ForegroundColor $Color.Muted
}

# Fallback: directly stop any registry containers matching name k3d-localhost
Write-Host "   Checking registry containers in Docker..." -ForegroundColor $Color.Muted
$registryContainers = docker ps -a --filter "name=k3d-$registryName" --format "{{.ID}} {{.Names}} {{.Status}}" 2>$null
if ($registryContainers) {
    $registryContainers.Trim() | ForEach-Object {
        $parts = $_ -split "\s+"
        $cid = $parts[0]
        $cname = $parts[1]
        $cstatus = ($parts[2..($parts.Length-1)] -join " ")
        if ($cstatus -like "Up*") {
            Write-Host "   🔧 Stopping registry container $cname ($cid)..." -ForegroundColor $Color.Warning
            docker stop $cid 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) {
                Write-Host "   ✅ Stopped $cname" -ForegroundColor $Color.Success
            }
            else {
                Write-Host "   ⚠️  Failed to stop $cname" -ForegroundColor $Color.Warning
            }
        }
        else {
            Write-Host "   ℹ️  Registry container $cname already stopped ($cstatus)" -ForegroundColor $Color.Muted
        }
    }
} else {
    Write-Host "   ℹ️  No registry containers named k3d-$registryName found" -ForegroundColor $Color.Muted
}
Write-Host ""
Write-Host "💡 To restart the cluster:" -ForegroundColor $Color.Info
Write-Host "   .\start-cluster.ps1" -ForegroundColor $Color.Success
Write-Host "   or" -ForegroundColor $Color.Muted
Write-Host "   .\manager.ps1 → Option 2 (Start cluster)" -ForegroundColor $Color.Success
Write-Host ""
