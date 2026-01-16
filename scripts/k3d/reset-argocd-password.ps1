<#
.SYNOPSIS
  Reset ArgoCD admin password to Argo@123! or test password change functionality

.DESCRIPTION
  Changes ArgoCD admin password from the auto-generated initial password
  to the standard password (Argo@123!).
  
  Can also run in test mode (-TestOnly) to verify password change works without actually changing it.
  
  The -Force flag enables a direct secret patching method using bcrypt hash generation,
  which works even when the current password is unknown.
  
  Useful when:
  - Bootstrap didn't change password correctly
  - You forgot the password
  - Need to reset to known value
  - Debugging password change issues
  - All known passwords fail (use -Force)

.PARAMETER TestOnly
  If specified, tests password change without actually changing it.
  Shows detailed debug output.

.PARAMETER NewPassword
  Custom password to set (default: Argo@123!)

.PARAMETER CurrentPassword
  If provided, use this instead of initial secret for authentication.

.PARAMETER Force
  Bypass API authentication and force password reset via direct secret patching.
  Uses bcrypt hash generation via temporary Python container.
  Works even when current password is unknown.

.EXAMPLE
  .\reset-argocd-password.ps1
  # Changes password to Argo@123!

.EXAMPLE
  .\reset-argocd-password.ps1 -TestOnly
  # Tests password change with debug output (doesn't change password)

.EXAMPLE
  .\reset-argocd-password.ps1 -NewPassword "MyCustomPass@123"
  # Changes password to custom value

.EXAMPLE
  .\reset-argocd-password.ps1 -CurrentPassword "Argo@123!"
  # Uses explicit current password instead of initial secret

.EXAMPLE
  .\reset-argocd-password.ps1 -CurrentPassword "Argo@123!" -NewPassword "NewPass@456"
  # Change from one known password to another

.EXAMPLE
  .\reset-argocd-password.ps1 -Force
  # Force reset password via kubectl (no current password needed)

.EXAMPLE
  .\reset-argocd-password.ps1 -Force -NewPassword "MyNewPass@123"
  # Force reset to custom password via kubectl
#>

param(
    [switch]$TestOnly,
    [string]$NewPassword = "Argo@123!",
    [string]$CurrentPassword = "",  # If provided, use this instead of initial secret
    [switch]$Force  # Force reset via bcrypt + kubectl patch (no current password needed)
)

$ErrorActionPreference = "Stop"

$argocdNamespace = "argocd"
$argocdBaseUrl = "http://localhost:8090/argocd/api/v1"  # BasePath configured in Helm: /argocd
$clusterName = "dev"

$Color = @{
    Success = "Green"
    Warning = "Yellow"
    Error   = "Red"
    Info    = "Cyan"
    Muted   = "Gray"
}

# ============================================================
# Force Password Reset Function (bcrypt + kubectl patch)
# ============================================================
function Invoke-ForcePasswordReset {
    param(
        [string]$Password,
        [string]$Namespace = "argocd"
    )
    
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor $Color.Warning
    Write-Host "║  FORCE PASSWORD RESET (kubectl patch method)              ║" -ForegroundColor $Color.Warning
    Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor $Color.Warning
    Write-Host ""
    
    # Step 1: Generate bcrypt hash via Python container
    Write-Host "🔐 Generating bcrypt hash..." -ForegroundColor $Color.Info
    Write-Host "   Using temporary Python container..." -ForegroundColor $Color.Muted
    
    $pythonScript = "import bcrypt; print(bcrypt.hashpw(b'$Password', bcrypt.gensalt(10)).decode())"
    $bcryptHash = $null
    
    try {
        # Run Python container to generate bcrypt hash
        $bcryptHash = kubectl run bcrypt-gen --rm -i --restart=Never --image=python:3.11-slim `
            -- /bin/bash -c "pip install bcrypt -q && python -c `"$pythonScript`"" 2>&1 | 
        Where-Object { $_ -match '^\$2[aby]?\$' } | Select-Object -First 1
        
        if (-not $bcryptHash) {
            throw "Failed to generate bcrypt hash"
        }
        
        # Clean up hash (remove any extra whitespace)
        $bcryptHash = $bcryptHash.Trim()
        
        Write-Host "   ✅ Hash generated successfully" -ForegroundColor $Color.Success
        Write-Host "   Hash: $($bcryptHash.Substring(0, 20))..." -ForegroundColor $Color.Muted
    }
    catch {
        Write-Host "   ❌ Failed to generate bcrypt hash" -ForegroundColor $Color.Error
        Write-Host "   Error: $_" -ForegroundColor $Color.Error
        return $false
    }
    
    # Step 2: Patch argocd-secret with new password hash
    Write-Host ""
    Write-Host "📝 Patching argocd-secret..." -ForegroundColor $Color.Info
    
    $timestamp = Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ"
    $patchJson = @{
        stringData = @{
            "admin.password"      = $bcryptHash
            "admin.passwordMtime" = $timestamp
        }
    } | ConvertTo-Json -Compress
    
    try {
        kubectl patch secret argocd-secret -n $Namespace -p $patchJson 2>&1 | Out-Null
        Write-Host "   ✅ Secret patched successfully" -ForegroundColor $Color.Success
    }
    catch {
        Write-Host "   ❌ Failed to patch secret" -ForegroundColor $Color.Error
        Write-Host "   Error: $_" -ForegroundColor $Color.Error
        return $false
    }
    
    # Step 3: Restart argocd-server deployment
    Write-Host ""
    Write-Host "🔄 Restarting ArgoCD server..." -ForegroundColor $Color.Info
    
    try {
        kubectl rollout restart deployment argocd-server -n $Namespace 2>&1 | Out-Null
        Write-Host "   Waiting for rollout to complete..." -ForegroundColor $Color.Muted
        
        # Wait for pod to be ready
        kubectl rollout status deployment/argocd-server -n $Namespace --timeout=60s 2>&1 | Out-Null
        Write-Host "   ✅ ArgoCD server restarted" -ForegroundColor $Color.Success
    }
    catch {
        Write-Host "   ⚠️  Rollout may still be in progress" -ForegroundColor $Color.Warning
        Write-Host "   Check with: kubectl get pods -n $Namespace" -ForegroundColor $Color.Muted
    }
    
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor $Color.Success
    Write-Host "║  ✅ Force Password Reset Completed!                       ║" -ForegroundColor $Color.Success
    Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor $Color.Success
    Write-Host ""
    Write-Host "🔐 New credentials:" -ForegroundColor $Color.Info
    Write-Host "   Username: admin" -ForegroundColor $Color.Muted
    Write-Host "   Password: $Password" -ForegroundColor $Color.Success
    Write-Host ""
    Write-Host "🌐 Access ArgoCD at:" -ForegroundColor $Color.Info
    Write-Host "   http://localhost:8090/argocd/" -ForegroundColor $Color.Muted
    Write-Host "   (requires: .\port-forward.ps1 argocd)" -ForegroundColor $Color.Muted
    Write-Host ""
    
    return $true
}

# ============================================================
# If -Force flag is set, bypass API and use direct patching
# ============================================================
if ($Force) {
    Write-Host "`n╔════════════════════════════════════════════════════════════╗" -ForegroundColor $Color.Warning
    Write-Host "║  FORCE MODE: Bypassing API authentication                 ║" -ForegroundColor $Color.Warning
    Write-Host "╚════════════════════════════════════════════════════════════╝`n" -ForegroundColor $Color.Warning
    
    # Check if ArgoCD is installed
    Write-Host "🔍 Checking ArgoCD installation..." -ForegroundColor $Color.Info
    $argocdPod = kubectl get pods -n $argocdNamespace -l app.kubernetes.io/name=argocd-server --no-headers 2>$null
    if (-not $argocdPod) {
        Write-Host "❌ ArgoCD not found in namespace '$argocdNamespace'" -ForegroundColor $Color.Error
        exit 1
    }
    Write-Host "✅ ArgoCD found" -ForegroundColor $Color.Success
    
    $result = Invoke-ForcePasswordReset -Password $NewPassword -Namespace $argocdNamespace
    if ($result) {
        exit 0
    }
    else {
        exit 1
    }
}

if ($TestOnly) {
    Write-Host "`n╔════════════════════════════════════════════════════════════╗" -ForegroundColor $Color.Info
    Write-Host "║  ARGOCD PASSWORD CHANGE - TEST MODE                        ║" -ForegroundColor $Color.Info
    Write-Host "╚════════════════════════════════════════════════════════════╝`n" -ForegroundColor $Color.Info
}
else {
    Write-Host "`n╔════════════════════════════════════════════════════════════╗" -ForegroundColor $Color.Info
    Write-Host "║  Resetting ArgoCD Admin Password                          ║" -ForegroundColor $Color.Info
    Write-Host "╚════════════════════════════════════════════════════════════╝`n" -ForegroundColor $Color.Info
}

# === Step 1: Verify cluster context ===
if ($TestOnly) {
    Write-Host "[1] Verifying cluster context..." -ForegroundColor $Color.Warning
    $context = kubectl config current-context
    Write-Host "    Current context: $context" -ForegroundColor $Color.Muted
    
    if ($context -notmatch "k3d-$clusterName") {
        Write-Host "    ⚠️  Expected 'k3d-$clusterName' but got '$context'" -ForegroundColor $Color.Warning
        Write-Host "    Switching to correct context..." -ForegroundColor $Color.Muted
        kubectl config use-context "k3d-$clusterName" 2>$null
    }
    Write-Host ""
}

# Check if ArgoCD is installed
Write-Host "🔍 Checking ArgoCD installation..." -ForegroundColor $Color.Info
$argocdPod = kubectl get pods -n $argocdNamespace -l app.kubernetes.io/name=argocd-server --no-headers 2>$null
if (-not $argocdPod) {
    Write-Host "❌ ArgoCD not found in namespace '$argocdNamespace'" -ForegroundColor $Color.Error
    exit 1
}
Write-Host "✅ ArgoCD found" -ForegroundColor $Color.Success

# === Step 2: Retrieve initial password ===
if ($TestOnly) {
    Write-Host "[2] Retrieving initial password..." -ForegroundColor $Color.Warning
}
else {
    Write-Host "`n🔑 Retrieving initial password..." -ForegroundColor $Color.Info
}

# If CurrentPassword provided via parameter, use that instead of secret
if ($CurrentPassword) {
    $initialPassword = $CurrentPassword
    Write-Host "   Using provided current password" -ForegroundColor $Color.Success
}
else {
    $initialPassword = kubectl -n $argocdNamespace get secret argocd-initial-admin-secret `
        -o jsonpath="{.data.password}" 2>$null | 
    ForEach-Object { [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($_)) }
}

if (-not $initialPassword) {
    if ($TestOnly) {
        Write-Host "    ⚠️  Could not retrieve initial password from secret" -ForegroundColor $Color.Warning
        Write-Host "    The password may have already been changed" -ForegroundColor $Color.Muted
        Write-Host ""
    }
    else {
        Write-Host "⚠️  Could not retrieve initial password from secret" -ForegroundColor $Color.Warning
        Write-Host "   The password may have already been changed" -ForegroundColor $Color.Muted
        Write-Host ""
    }
    $initialPassword = Read-Host "   Enter current admin password"
}
else {
    if ($TestOnly) {
        Write-Host "    Initial password: $initialPassword" -ForegroundColor $Color.Muted
        Write-Host ""
    }
    else {
        Write-Host "   Initial password: $initialPassword" -ForegroundColor $Color.Muted
    }
}

# === Step 3: Start port-forward ===
if ($TestOnly) {
    Write-Host "[3] Starting port-forward..." -ForegroundColor $Color.Warning
    Write-Host "    Command: kubectl port-forward svc/argocd-server -n $argocdNamespace 8090:80 --address 127.0.0.1" -ForegroundColor $Color.Muted
}
else {
    Write-Host "`n🔗 Starting port-forward..." -ForegroundColor $Color.Info
}

$pfProcess = Start-Process -FilePath kubectl `
    -ArgumentList "port-forward svc/argocd-server -n $argocdNamespace 8090:80 --address 127.0.0.1" `
    -WindowStyle Hidden `
    -PassThru

if ($TestOnly) {
    Write-Host "    Process ID: $($pfProcess.Id)" -ForegroundColor $Color.Muted
    Write-Host "    Waiting 8 seconds for port-forward to be ready..." -ForegroundColor $Color.Muted
}
else {
    Write-Host "   Waiting for port-forward to be ready..." -ForegroundColor $Color.Muted
}

Start-Sleep -Seconds 8

if ($TestOnly) {
    Write-Host ""
}

# === Step 3.5: Verify port-forward connectivity ===
Write-Host "   Verifying port-forward connectivity..." -ForegroundColor $Color.Muted
$portReady = $false
for ($i = 0; $i -lt 10; $i++) {
    try {
        $response = Invoke-WebRequest -Uri "$argocdBaseUrl/version" `
            -Method Get `
            -TimeoutSec 2 `
            -ErrorAction Stop
        
        if ($response.StatusCode -eq 200) {
            $portReady = $true
            Write-Host "   ✓ Port 8090 is responding correctly" -ForegroundColor $Color.Success
            break
        }
    }
    catch {
        if ($i -lt 9) {
            Start-Sleep -Seconds 2
        }
    }
}

if (-not $portReady) {
    Write-Host "   ⚠️  WARNING: Port-forward may not be fully ready" -ForegroundColor $Color.Warning
    Write-Host "   Waiting additional 5 seconds..." -ForegroundColor $Color.Muted
    Start-Sleep -Seconds 5
}

if ($TestOnly) {
    Write-Host ""
}

# === Step 4: Change password via REST API ===
try {
    if ($TestOnly) {
        Write-Host "[4] Testing password change API..." -ForegroundColor $Color.Warning
        Write-Host ""
        Write-Host "    [4.1] Authenticating with ArgoCD..." -ForegroundColor $Color.Info
    }
    else {
        Write-Host "`n🔐 Changing password..." -ForegroundColor $Color.Info
    }
    
    # Login to get token (with retry logic for robustness)
    $loginBody = @{ 
        username = "admin"
        password = $initialPassword 
    } | ConvertTo-Json
    
    if ($TestOnly) {
        Write-Host "          Request URL: $argocdBaseUrl/session" -ForegroundColor $Color.Muted
        Write-Host "          Method: POST" -ForegroundColor $Color.Muted
        Write-Host "          Body:" -ForegroundColor $Color.Muted
        Write-Host "          {" -ForegroundColor $Color.Muted
        Write-Host "            `"username`": `"admin`"," -ForegroundColor $Color.Muted
        Write-Host "            `"password`": `"$initialPassword`"" -ForegroundColor $Color.Muted
        Write-Host "          }" -ForegroundColor $Color.Muted
        Write-Host ""
        Write-Host "          Sending request..." -ForegroundColor $Color.Muted
    }
    
    $loginResponse = $null
    $loginAttempts = 0
    $maxLoginAttempts = 3
    
    while (-not $loginResponse -and $loginAttempts -lt $maxLoginAttempts) {
        try {
            $loginResponse = Invoke-RestMethod `
                -Uri "$argocdBaseUrl/session" `
                -Method Post `
                -Body $loginBody `
                -ContentType "application/json" `
                -TimeoutSec 5 `
                -ErrorAction Stop
        }
        catch {
            $loginAttempts++
            $errorMessage = $_.Exception.Message
            
            # Check if error is due to invalid credentials (password was already changed)
            if ($errorMessage -match "Invalid username or password" -or $errorMessage -match "401") {
                if ($TestOnly) {
                    Write-Host "          ❌ Authentication failed with 401 Unauthorized" -ForegroundColor $Color.Error
                    Write-Host "          The initial password is no longer valid." -ForegroundColor $Color.Muted
                    Write-Host "          This means the password was already changed before." -ForegroundColor $Color.Muted
                    Write-Host ""
                    Write-Host "          Options:" -ForegroundColor $Color.Info
                    Write-Host "            1. Run with -CurrentPassword parameter:" -ForegroundColor $Color.Muted
                    Write-Host "               .\reset-argocd-password.ps1 -CurrentPassword 'your-current-password'" -ForegroundColor $Color.Muted
                    Write-Host "            2. Use manager.ps1 option 5 for manual password reset" -ForegroundColor $Color.Muted
                    Write-Host ""
                }  
                throw $_
            }
            
            if ($loginAttempts -lt $maxLoginAttempts) {
                Write-Host "          ⚠️  Login attempt $loginAttempts failed, retrying..." -ForegroundColor $Color.Warning
                Start-Sleep -Seconds 2
            }
            else {
                throw $_
            }
        }
    }
    
    $token = $loginResponse.token
    
    if ($TestOnly) {
        Write-Host "          ✅ Authentication successful!" -ForegroundColor $Color.Success
        Write-Host "          Token received: $($token.Substring(0, 20))..." -ForegroundColor $Color.Muted
        Write-Host ""
        Write-Host "    [4.2] Updating password..." -ForegroundColor $Color.Info
    }
    else {
        Write-Host "   ✅ Login successful" -ForegroundColor $Color.Success
    }
    
    # Update password (or test update if TestOnly)
    $updateBody = @{ 
        currentPassword = $initialPassword
        newPassword     = $NewPassword 
    } | ConvertTo-Json
    
    $headers = @{ 
        "Authorization" = "Bearer $token"
        "Content-Type"  = "application/json" 
    }
    
    if ($TestOnly) {
        Write-Host "          Request URL: $argocdBaseUrl/account/password" -ForegroundColor $Color.Muted
        Write-Host "          Method: PUT" -ForegroundColor $Color.Muted
        Write-Host "          Headers:" -ForegroundColor $Color.Muted
        Write-Host "            Authorization: Bearer $($token.Substring(0, 20))..." -ForegroundColor $Color.Muted
        Write-Host "          Body:" -ForegroundColor $Color.Muted
        Write-Host "          {" -ForegroundColor $Color.Muted
        Write-Host "            `"currentPassword`": `"$initialPassword`"," -ForegroundColor $Color.Muted
        Write-Host "            `"newPassword`": `"$NewPassword`"" -ForegroundColor $Color.Muted
        Write-Host "          }" -ForegroundColor $Color.Muted
        Write-Host ""
        Write-Host "          ⚠️  TEST MODE: Skipping actual password change" -ForegroundColor $Color.Warning
        Write-Host ""
    }
    else {
        Invoke-RestMethod `
            -Uri "$argocdBaseUrl/account/password" `
            -Method Put `
            -Headers $headers `
            -Body $updateBody `
            -ErrorAction Stop | Out-Null
    }
    
    if ($TestOnly) {
        Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor $Color.Success
        Write-Host "║  ✅ Password Change Test Completed Successfully!          ║" -ForegroundColor $Color.Success
        Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor $Color.Success
        Write-Host ""
        Write-Host "💡 Summary:" -ForegroundColor $Color.Info
        Write-Host "   - Authentication: ✅ Successful" -ForegroundColor $Color.Success
        Write-Host "   - Token received: ✅ Valid" -ForegroundColor $Color.Success
        Write-Host "   - API endpoint: ✅ Reachable" -ForegroundColor $Color.Success
        Write-Host "   - Password change: ⚠️  Skipped (test mode)" -ForegroundColor $Color.Warning
        Write-Host ""
        Write-Host "🔐 To actually change the password, run:" -ForegroundColor $Color.Info
        Write-Host "   .\reset-argocd-password.ps1" -ForegroundColor $Color.Muted
        Write-Host ""
    }
    else {
        Write-Host ""
        Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor $Color.Success
        Write-Host "║  ✅ Password Changed Successfully!                        ║" -ForegroundColor $Color.Success
        Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor $Color.Success
        Write-Host ""
        Write-Host "🔐 New credentials:" -ForegroundColor $Color.Info
        Write-Host "   Username: admin" -ForegroundColor $Color.Muted
        Write-Host "   Password: $NewPassword" -ForegroundColor $Color.Success
        Write-Host ""
    }
}
catch {
    Write-Host ""
    if ($TestOnly) {
        Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor $Color.Error
        Write-Host "║  ❌ Password Change Test Failed                           ║" -ForegroundColor $Color.Error
        Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor $Color.Error
    }
    else {
        Write-Host "❌ Failed to change password" -ForegroundColor $Color.Error
    }
    Write-Host ""
    Write-Host "Error details:" -ForegroundColor $Color.Error
    Write-Host "   $($_.Exception.Message)" -ForegroundColor $Color.Error
    
    if ($_.Exception.Response) {
        Write-Host "   HTTP Status: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor $Color.Error
    }
    
    # Check if this is an authentication failure (401)
    $is401Error = $_.Exception.Message -match "401" -or 
    $_.Exception.Message -match "Invalid username or password" -or
    ($_.Exception.Response -and $_.Exception.Response.StatusCode.value__ -eq 401)
    
    if ($is401Error -and -not $TestOnly) {
        Write-Host ""
        Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor $Color.Warning
        Write-Host "║  🔑 Authentication Failed - Force Reset Available         ║" -ForegroundColor $Color.Warning
        Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor $Color.Warning
        Write-Host ""
        Write-Host "The current password is unknown or invalid." -ForegroundColor $Color.Muted
        Write-Host "You can force reset the password via kubectl." -ForegroundColor $Color.Muted
        Write-Host ""
        Write-Host "Options:" -ForegroundColor $Color.Info
        Write-Host "   1. Specify current password:" -ForegroundColor $Color.Muted
        Write-Host "      .\reset-argocd-password.ps1 -CurrentPassword 'your-password'" -ForegroundColor $Color.Muted
        Write-Host ""
        Write-Host "   2. Force reset (no current password needed):" -ForegroundColor $Color.Muted
        Write-Host "      .\reset-argocd-password.ps1 -Force" -ForegroundColor $Color.Muted
        Write-Host ""
        
        $response = Read-Host "Would you like to force reset now? (y/N)"
        if ($response -eq "y" -or $response -eq "Y") {
            # Stop port-forward before force reset
            Write-Host ""
            Write-Host "🛑 Stopping port-forward..." -ForegroundColor $Color.Info
            Stop-Process -Id $pfProcess.Id -Force -ErrorAction SilentlyContinue
            
            # Execute force reset
            $result = Invoke-ForcePasswordReset -Password $NewPassword -Namespace $argocdNamespace
            if ($result) {
                exit 0
            }
            else {
                exit 1
            }
        }
    }
    else {
        Write-Host ""
        Write-Host "📋 Troubleshooting:" -ForegroundColor $Color.Warning
        Write-Host "   1. Check if current password is correct" -ForegroundColor $Color.Muted
        Write-Host "   2. Try: .\port-forward.ps1 argocd" -ForegroundColor $Color.Muted
        Write-Host "   3. Open: http://localhost:8090/argocd/" -ForegroundColor $Color.Muted
        Write-Host "   4. Change password manually in UI" -ForegroundColor $Color.Muted
        Write-Host "   5. Check if ArgoCD pod is healthy: kubectl get pods -n argocd" -ForegroundColor $Color.Muted
        Write-Host "   6. Force reset: .\reset-argocd-password.ps1 -Force" -ForegroundColor $Color.Muted
        Write-Host ""
    }
}
finally {
    # Stop port-forward
    if ($TestOnly) {
        Write-Host "🛑 Stopping port-forward (PID: $($pfProcess.Id))..." -ForegroundColor $Color.Info
    }
    else {
        Write-Host "🛑 Stopping port-forward..." -ForegroundColor $Color.Info
    }
    Stop-Process -Id $pfProcess.Id -Force -ErrorAction SilentlyContinue
    Write-Host ""
}
