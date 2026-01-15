<#
.SYNOPSIS
  Reset ArgoCD admin password to Argo@123!

.DESCRIPTION
  Changes ArgoCD admin password from the auto-generated initial password
  to the standard password (Argo@123!).
  
  Useful when:
  - Bootstrap didn't change password correctly
  - You forgot the password
  - Need to reset to known value

.EXAMPLE
  .\reset-argocd-password.ps1
#>

$ErrorActionPreference = "Stop"

$argocdNamespace = "argocd"
$newPassword = "Argo@123!"

$Color = @{
    Success = "Green"
    Warning = "Yellow"
    Error   = "Red"
    Info    = "Cyan"
    Muted   = "Gray"
}

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor $Color.Info
Write-Host "║  Resetting ArgoCD Admin Password                          ║" -ForegroundColor $Color.Info
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor $Color.Info
Write-Host ""

# Check if ArgoCD is installed
Write-Host "🔍 Checking ArgoCD installation..." -ForegroundColor $Color.Info
$argocdPod = kubectl get pods -n $argocdNamespace -l app.kubernetes.io/name=argocd-server --no-headers 2>$null
if (-not $argocdPod) {
    Write-Host "❌ ArgoCD not found in namespace '$argocdNamespace'" -ForegroundColor $Color.Error
    exit 1
}
Write-Host "✅ ArgoCD found" -ForegroundColor $Color.Success

# Get initial password
Write-Host ""
Write-Host "🔑 Retrieving initial password..." -ForegroundColor $Color.Info
$initialPassword = kubectl -n $argocdNamespace get secret argocd-initial-admin-secret `
    -o jsonpath="{.data.password}" 2>$null | 
    ForEach-Object { [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($_)) }

if (-not $initialPassword) {
    Write-Host "⚠️  Could not retrieve initial password from secret" -ForegroundColor $Color.Warning
    Write-Host "   The password may have already been changed" -ForegroundColor $Color.Muted
    Write-Host ""
    $initialPassword = Read-Host "   Enter current admin password"
}
else {
    Write-Host "   Initial password: $initialPassword" -ForegroundColor $Color.Muted
}

# Start port-forward
Write-Host ""
Write-Host "🔗 Starting port-forward..." -ForegroundColor $Color.Info
$pfProcess = Start-Process -FilePath kubectl `
    -ArgumentList "port-forward svc/argocd-server -n $argocdNamespace 8090:443 --address 127.0.0.1" `
    -WindowStyle Hidden `
    -PassThru

Write-Host "   Waiting for port-forward to be ready..." -ForegroundColor $Color.Muted
Start-Sleep -Seconds 8

# Change password via REST API
try {
    Write-Host ""
    Write-Host "🔐 Changing password..." -ForegroundColor $Color.Info
    
    # Login to get token
    $loginBody = @{ 
        username = "admin"
        password = $initialPassword 
    } | ConvertTo-Json
    
    $loginResponse = Invoke-RestMethod `
        -Uri "http://localhost:8090/api/v1/session" `
        -Method Post `
        -Body $loginBody `
        -ContentType "application/json" `
        -ErrorAction Stop
    
    $token = $loginResponse.token
    Write-Host "   ✅ Login successful" -ForegroundColor $Color.Success
    
    # Update password
    $updateBody = @{ 
        currentPassword = $initialPassword
        newPassword = $newPassword 
    } | ConvertTo-Json
    
    $headers = @{ 
        "Authorization" = "Bearer $token"
        "Content-Type" = "application/json" 
    }
    
    Invoke-RestMethod `
        -Uri "http://localhost:8090/api/v1/account/password" `
        -Method Put `
        -Headers $headers `
        -Body $updateBody `
        -ErrorAction Stop | Out-Null
    
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor $Color.Success
    Write-Host "║  ✅ Password Changed Successfully!                        ║" -ForegroundColor $Color.Success
    Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor $Color.Success
    Write-Host ""
    Write-Host "🔐 New credentials:" -ForegroundColor $Color.Info
    Write-Host "   Username: admin" -ForegroundColor $Color.Muted
    Write-Host "   Password: $newPassword" -ForegroundColor $Color.Success
    Write-Host ""
}
catch {
    Write-Host ""
    Write-Host "❌ Failed to change password" -ForegroundColor $Color.Error
    Write-Host "   Error: $_" -ForegroundColor $Color.Error
    Write-Host ""
    Write-Host "📋 Troubleshooting:" -ForegroundColor $Color.Warning
    Write-Host "   1. Check if current password is correct" -ForegroundColor $Color.Muted
    Write-Host "   2. Try: .\port-forward.ps1 argocd" -ForegroundColor $Color.Muted
    Write-Host "   3. Open: http://localhost:8080" -ForegroundColor $Color.Muted
    Write-Host "   4. Change password manually in UI" -ForegroundColor $Color.Muted
    Write-Host ""
}
finally {
    # Stop port-forward
    Write-Host "🛑 Stopping port-forward..." -ForegroundColor $Color.Info
    Stop-Process -Id $pfProcess.Id -Force -ErrorAction SilentlyContinue
    Write-Host ""
}
