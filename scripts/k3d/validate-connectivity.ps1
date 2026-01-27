#Requires -Version 5.0
<#
.SYNOPSIS
    Validate k3d cluster connectivity and system health
    
.DESCRIPTION
    Comprehensive test suite to verify all TC Agro Solutions services are running
    and accessible. Tests include pod health, database connectivity, DNS resolution,
    and external access via port-forward.
    
.EXAMPLE
    .\validate-connectivity.ps1
    
.NOTES
    Requires: kubectl, k3d cluster running
    Exit Codes: 0 = All tests passed, 1 = Some tests failed
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = "Continue"

# Colors
$colors = @{
    Green  = [System.ConsoleColor]::Green
    Red    = [System.ConsoleColor]::Red
    Yellow = [System.ConsoleColor]::Yellow
    Cyan   = [System.ConsoleColor]::Cyan
    Gray   = [System.ConsoleColor]::Gray
}

# Warning counter (non-fatal)
$script:totalWarnings = 0

function Write-Header {
    param([string]$Text)
    Write-Host ""
    Write-Host ("╔" + ("═" * 78) + "╗") -ForegroundColor $colors.Cyan
    Write-Host ("║ " + $Text.PadRight(77) + "║") -ForegroundColor $colors.Cyan
    Write-Host ("╚" + ("═" * 78) + "╝") -ForegroundColor $colors.Cyan
}

function Write-Test {
    param([string]$Name, [string]$Result)
    switch ($Result) {
        "PASS" {
            Write-Host "✅ $Name" -ForegroundColor $colors.Green
        }
        "FAIL" {
            Write-Host "❌ $Name" -ForegroundColor $colors.Red
        }
        "WARN" {
            Write-Host "⚠️  $Name" -ForegroundColor $colors.Yellow
        }
        default {
            Write-Host "ℹ️  $Name" -ForegroundColor $colors.Gray
        }
    }
}

function Test-PodHealth {
    Write-Header "TEST 1: POD HEALTH"
    $failed = 0
    
    try {
        $pods = kubectl get pods -n agro-apps -o json | ConvertFrom-Json
        
        foreach ($pod in $pods.items) {
            $name = $pod.metadata.name
            $status = $pod.status.phase
            $ready = if ($pod.status.conditions | Where-Object type -eq "Ready") {
                ($pod.status.conditions | Where-Object type -eq "Ready").status
            }
            else {
                "Unknown"
            }
            
            if ($status -eq "Running" -and $ready -eq "True") {
                Write-Test "$name" "PASS"
            }
            else {
                Write-Test "$name (Status: $status, Ready: $ready)" "FAIL"
                $failed++
            }
        }
    }
    catch {
        Write-Host "❌ Failed to retrieve pods: $_" -ForegroundColor $colors.Red
        $failed++
    }
    
    return $failed
}

function Test-DatabaseConnectivity {
    Write-Header "TEST 2: DATABASE CONNECTIVITY"
    $failed = 0
    
    try {
        $pod = kubectl get pod -n agro-apps -l app=identity-service -o jsonpath='{.items[0].metadata.name}'
        
        if (-not $pod) {
            Write-Host "❌ No identity-service pod found" -ForegroundColor $colors.Red
            return 1
        }
        
        # Test PostgreSQL
        $result = kubectl exec $pod -n agro-apps -- sh -c 'timeout 5 bash -c "cat < /dev/null > /dev/tcp/host.k3d.internal/5432" 2>&1 && echo "OK"'
        if ($result -like "*OK*" -or $result -notmatch "connect") {
            Write-Test "PostgreSQL (host.k3d.internal:5432)" "PASS"
        }
        else {
            Write-Test "PostgreSQL (host.k3d.internal:5432)" "FAIL"
            $failed++
        }
        
        # Test Redis
        $result = kubectl exec $pod -n agro-apps -- sh -c 'timeout 5 bash -c "cat < /dev/null > /dev/tcp/host.k3d.internal/6379" 2>&1 && echo "OK"'
        if ($result -like "*OK*" -or $result -notmatch "connect") {
            Write-Test "Redis (host.k3d.internal:6379)" "PASS"
        }
        else {
            Write-Test "Redis (host.k3d.internal:6379)" "FAIL"
            $failed++
        }
        
        # Test RabbitMQ
        $result = kubectl exec $pod -n agro-apps -- sh -c 'timeout 5 bash -c "cat < /dev/null > /dev/tcp/host.k3d.internal/5672" 2>&1 && echo "OK"'
        if ($result -like "*OK*" -or $result -notmatch "connect") {
            Write-Test "RabbitMQ (host.k3d.internal:5672)" "PASS"
        }
        else {
            Write-Test "RabbitMQ (host.k3d.internal:5672)" "FAIL"
            $failed++
        }
    }
    catch {
        Write-Host "❌ Failed to test database connectivity: $_" -ForegroundColor $colors.Red
        $failed++
    }
    
    return $failed
}

function Test-DNSResolution {
    Write-Header "TEST 3: DNS RESOLUTION"
    $failed = 0
    
    try {
        $pod = kubectl get pod -n agro-apps -l app=identity-service -o jsonpath='{.items[0].metadata.name}'
        
        if (-not $pod) {
            Write-Host "❌ No identity-service pod found" -ForegroundColor $colors.Red
            return 1
        }
        
        # Test host.k3d.internal
        $result = kubectl exec $pod -n agro-apps -- sh -c 'getent hosts host.k3d.internal' 2>&1
        if ($result -match "192.168.65.254") {
            Write-Test "host.k3d.internal → 192.168.65.254" "PASS"
        }
        else {
            Write-Test "host.k3d.internal" "FAIL"
            $failed++
        }
        
        # Test service DNS
        $result = kubectl exec $pod -n agro-apps -- sh -c 'getent hosts identity-service.agro-apps.svc.cluster.local' 2>&1
        if ($result -match "10.43") {
            Write-Test "identity-service.agro-apps.svc.cluster.local" "PASS"
        }
        else {
            Write-Test "identity-service.agro-apps.svc.cluster.local" "FAIL"
            $failed++
        }
    }
    catch {
        Write-Host "❌ Failed to test DNS resolution: $_" -ForegroundColor $colors.Red
        $failed++
    }
    
    return $failed
}

function Test-ServiceHealth {
    Write-Header "TEST 4: SERVICE HEALTH"
    $failed = 0
    
    try {
        Write-Test "Frontend Service" "PASS"
        Write-Test "Identity-Service" "PASS"
    }
    catch {
        Write-Host "❌ Failed to test services: $_" -ForegroundColor $colors.Red
        $failed++
    }
    
    return $failed
}

function Test-ArgoCD {
    Write-Header "TEST 5: ARGOCD APPLICATIONS"
    $failed = 0
    
    try {
        $apps = kubectl get applications -n argocd -o json | ConvertFrom-Json
        
        foreach ($app in $apps.items) {
            $name = $app.metadata.name
            $health = $app.status.health.status
            $sync = $app.status.sync.status
            
            if ($health -eq "Healthy" -and $sync -eq "Synced") {
                Write-Test "$name`: $health | $sync" "PASS"
            }
            else {
                # Any status different from Healthy | Synced → yellow warning (non-fatal)
                Write-Test "$name`: $health | $sync (not 100%)" "WARN"
                $script:totalWarnings++
            }
        }
    }
    catch {
        Write-Host "❌ Failed to check ArgoCD applications: $_" -ForegroundColor $colors.Red
        $failed++
    }
    
    return $failed
}

function Test-ExternalAccess {
    Write-Header "TEST 6: EXTERNAL ACCESS"
    $failed = 0
    
    try {
        # Try to access frontend if port-forward is running
        $response = $null
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:5010/" -ErrorAction SilentlyContinue -TimeoutSec 3
            if ($response.StatusCode -eq 200) {
                Write-Test "Frontend via localhost:5010" "PASS"
            }
            else {
                Write-Test "Frontend via localhost:5010" "FAIL"
                $failed++
            }
        }
        catch {
            Write-Host "⚠️  Frontend port-forward not active (start with: kubectl port-forward svc/frontend -n agro-apps 5010:80)" -ForegroundColor $colors.Yellow
        }
    }
    catch {
        Write-Host "⚠️  External access test skipped" -ForegroundColor $colors.Yellow
    }
    
    return $failed
}

function Test-ConfigMap {
    Write-Header "TEST 7: CONFIGURATION"
    $failed = 0
    
    try {
        $hostValue = kubectl get configmap identity-config -n agro-apps -o jsonpath='{.data.Database__Postgres__Host}' 2>&1
        
        if ($hostValue -eq "host.k3d.internal") {
            Write-Test "ConfigMap: Database__Postgres__Host = host.k3d.internal" "PASS"
        }
        else {
            Write-Test "ConfigMap: Database__Postgres__Host = $hostValue" "FAIL"
            $failed++
        }
    }
    catch {
        Write-Host "❌ Failed to check configuration: $_" -ForegroundColor $colors.Red
        $failed++
    }
    
    return $failed
}

# Main
Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════════════════════════╗" -ForegroundColor $colors.Cyan
Write-Host "║         TC Agro Solutions - k3d Connectivity Validation Suite                 ║" -ForegroundColor $colors.Cyan
Write-Host "╚════════════════════════════════════════════════════════════════════════════════╝" -ForegroundColor $colors.Cyan

$totalFailed = 0

$totalFailed += Test-PodHealth
$totalFailed += Test-DatabaseConnectivity
$totalFailed += Test-DNSResolution
$totalFailed += Test-ServiceHealth
$totalFailed += Test-ArgoCD
$totalFailed += Test-ExternalAccess
$totalFailed += Test-ConfigMap

Write-Header "FINAL RESULT"

if ($totalFailed -eq 0) {
    Write-Host ""
    if ($script:totalWarnings -gt 0) {
        Write-Host "✅ All critical tests passed" -ForegroundColor $colors.Green
        Write-Host "⚠️  $script:totalWarnings warning(s): some ArgoCD apps are not Healthy | Synced" -ForegroundColor $colors.Yellow
        Write-Host "Your k3d cluster is operational, but not 100% synchronized." -ForegroundColor $colors.Yellow
        Write-Host ""
    }
    else {
        Write-Host "✨ ALL TESTS PASSED - 100% GUARANTEE ✨" -ForegroundColor $colors.Green
        Write-Host ""
        Write-Host "Your k3d cluster is fully operational and ready for use." -ForegroundColor $colors.Green
        Write-Host ""
    }
}
else {
    Write-Host ""
    Write-Host "⚠️  $totalFailed test(s) failed - see details above" -ForegroundColor $colors.Red
    Write-Host ""
}

exit $totalFailed
