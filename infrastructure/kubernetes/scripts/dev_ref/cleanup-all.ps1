<#
.SYNOPSIS
  Cleans up local environment: deletes k3d clusters, local registry (if exists), and removes headlamp container.
#>

# === Confirmation ===
Write-Host ""
Write-Host "⚠️  WARNING: This will DELETE your entire local Kubernetes environment!" -ForegroundColor Red
Write-Host "   - Stop all port-forwards" -ForegroundColor Gray
Write-Host "   - Remove Headlamp container" -ForegroundColor Gray
Write-Host "   - Delete k3d cluster 'dev'" -ForegroundColor Gray
Write-Host "   - Remove local registry" -ForegroundColor Gray
Write-Host ""
Write-Host "   This action is IRREVERSIBLE. You will need to run 'create' again." -ForegroundColor Yellow
Write-Host ""
$confirm = Read-Host "Are you sure you want to continue? (Y/N)"

if ($confirm -ne 'Y' -and $confirm -ne 'y') {
    Write-Host "
❌ Operation cancelled." -ForegroundColor Red
    return
}

Write-Host ""

# List of clusters to remove (adjust if you have others)
$clusters = @("dev")
$registryName = "localhost"

# 0) Stop port-forwards (CRITICAL: Free ports 8090/3000)
Write-Host "=== 0) Stopping port-forwards ==="
if (Test-Path ".\stop-port-forward.ps1") {
    .\stop-port-forward.ps1 all
} else {
    Write-Host "Script stop-port-forward.ps1 not found. Trying to kill kubectl port-forward manually..."
    Get-Process kubectl -ErrorAction SilentlyContinue | ForEach-Object {
        try {
            $cmd = (Get-CimInstance Win32_Process -Filter "ProcessId = $($_.Id)").CommandLine
            if ($cmd -match "port-forward") {
                Stop-Process -Id $_.Id -Force
                Write-Host "kubectl port-forward process ($($_.Id)) terminated."
            }
        } catch {}
    }
}

# 1) Stop & remove headlamp container (if exists)
Write-Host "Removing Headlamp container if exists..."
docker ps -a --filter "name=headlamp" --format "{{.ID}}\t{{.Names}}" | ForEach-Object {
    $id = ($_ -split "`t")[0]
    docker rm -f $id 2>$null | Out-Null
}

# 2) Delete clusters
foreach ($c in $clusters) {
    Write-Host "Deleting cluster $c (if exists)..."
    k3d cluster list | Select-String -Pattern "^$c\s" | Out-Null
    if ($LASTEXITCODE -eq 0) {
        k3d cluster delete $c
    } else {
        Write-Host "Cluster $c does not exist. Skipping."
    }
}

# 3) Remove registry (if exists)
Write-Host "Checking registry $registryName..."
$regList = k3d registry list
if ($regList -match $registryName) {
    Write-Host "Removing registry $registryName..."
    k3d registry delete $registryName
} else {
    Write-Host "Registry not found. Skipping."
}

# 4) Optional: remove local helm releases (not applicable after cluster delete)
Write-Host "Cleanup complete. Check docker ps -a and k3d cluster list to confirm."
