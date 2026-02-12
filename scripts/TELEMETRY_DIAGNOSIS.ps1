#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Diagnostic script to identify why Metrics/Traces are not flowing in k3d cluster

.DESCRIPTION
    Tests 10 key diagnostics:
    1. k3d cluster connectivity to Docker Compose network
    2. DNS resolution from pod to otel-collector
    3. OTEL DaemonSet pod status
    4. OTEL DaemonSet receiver ports listening
    5. Network connectivity pod → collector
    6. Environment variables in running pod
    7. Logs from identity service pod
    8. Logs from OTEL DaemonSet
    9. Logs from Docker Compose OTEL Collector
    10. ConfigMap values currently loaded

.EXAMPLE
    .\TELEMETRY_DIAGNOSIS.ps1
    .\TELEMETRY_DIAGNOSIS.ps1 -Verbose
#>

param(
    [switch]$Verbose = $false,
    [int]$TailLines = 30
)

function Write-Status {
    param([string]$Message, [string]$Status = "INFO")
    $colors = @{
        "✅"  = "Green"
        "❌"  = "Red"  
        "⚠️" = "Yellow"
        "ℹ️" = "Cyan"
    }
    $color = $colors[$Status] ?? "White"
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] $Status $Message" -ForegroundColor $color
}

function Execute-Command {
    param([string]$Command, [string]$Description)
    Write-Host ""
    Write-Status "Testing: $Description" "ℹ️"
    try {
        $result = Invoke-Expression $Command 2>&1
        return @{
            Success     = $true
            Output      = $result
            Description = $Description
        }
    }
    catch {
        return @{
            Success     = $false
            Output      = $_.Exception.Message
            Description = $Description
        }
    }
}

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  🔍 TELEMETRY DIAGNOSTIC SUITE                                 ║" -ForegroundColor Cyan
Write-Host "║  Investigating: Metrics & Traces Not Flowing in k3d             ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

$diagnostics = @()

# ============================================================================
# TEST 1: k3d cluster network connectivity
# ============================================================================
Write-Status "═══ TEST 1/10: k3d Cluster Network ═══" "ℹ️"

$result1 = Execute-Command `
    "docker network inspect k3d-tcagro-network -f '{{json .Containers}}' | ConvertFrom-Json | Select -ExpandProperty Keys | Select -First 5" `
    "k3d-tcagro-network existence and containers"

$diagnostics += $result1
if ($result1.Success) {
    Write-Status "k3d network found with containers: $($result1.Output -join ', ')" "✅"
}
else {
    Write-Status "❌ CRITICAL: k3d network not found or no containers - this is the problem!" "❌"
    Write-Status "Recommendation: Verify k3d cluster is running" "⚠️"
}

# ============================================================================
# TEST 2: Docker Compose services on same network
# ============================================================================
Write-Status "═══ TEST 2/10: Docker Compose Services on k3d Network ═══" "ℹ️"

$result2 = Execute-Command `
    "docker ps -f label=com.docker.compose.service --format '{{.Label ""com.docker.compose.service""}} - {{.Status}}' 2>/dev/null" `
    "Docker Compose services running"

$diagnostics += $result2
if ($result2.Success -and $result2.Output -match "otel-collector") {
    Write-Status "✅ Docker Compose services found, including otel-collector" "✅"
    Write-Host $result2.Output
}
else {
    Write-Status "❌ Docker Compose services not found or otel-collector not running" "❌"
}

# ============================================================================
# TEST 3: Identity pod status
# ============================================================================
Write-Status "═══ TEST 3/10: Identity Service Pod Status ═══" "ℹ️"

$result3 = Execute-Command `
    "kubectl get pods -n agro-apps -l app=identity-service -o wide --no-headers 2>/dev/null" `
    "identity-service pod existence and status"

$diagnostics += $result3
if ($result3.Success) {
    Write-Status "✅ Identity service pod found:" "✅"
    Write-Host $result3.Output
    # Extract pod name for further tests
    $podName = ($result3.Output | Select-Object -First 1) -split '\s+' | Select-Object -First 1
}
else {
    Write-Status "❌ Identity service pod not found" "❌"
    $podName = $null
}

# ============================================================================
# TEST 4: OTEL DaemonSet pod status
# ============================================================================
Write-Status "═══ TEST 4/10: OTEL DaemonSet Pod Status ═══" "ℹ️"

$result4 = Execute-Command `
    "kubectl get pods -n observability -l app=otel-collector-agent -o wide --no-headers 2>/dev/null" `
    "OTEL DaemonSet pod existence and status"

$diagnostics += $result4
if ($result4.Success) {
    $daemonCount = ($result4.Output | Measure-Object -Line).Lines
    Write-Status "✅ OTEL DaemonSet has $daemonCount pods:" "✅"
    Write-Host $result4.Output
}
else {
    Write-Status "❌ OTEL DaemonSet pods not found" "❌"
}

# ============================================================================
# TEST 5: Environment variables in identity pod
# ============================================================================
if ($podName) {
    Write-Status "═══ TEST 5/10: Environment Variables in Identity Pod ═══" "ℹ️"
    
    $result5 = Execute-Command `
        "kubectl exec -n agro-apps $podName -- env 2>/dev/null | Select-String 'Telemetry|ASPNETCORE_ENVIRONMENT'" `
        "Telemetry environment variables"
    
    $diagnostics += $result5
    if ($result5.Success) {
        Write-Status "✅ Telemetry environment variables found:" "✅"
        Write-Host ($result5.Output | Out-String)
        
        # Check if Agent.Enabled is true
        if ($result5.Output -match "Agent__Enabled.*true") {
            Write-Status "✅ Agent.Enabled=true" "✅"
        }
        else {
            Write-Status "❌ Agent.Enabled is NOT set to true!" "❌"
        }
    }
    else {
        Write-Status "❌ Could not read environment variables from pod" "❌"
    }
}

# ============================================================================
# TEST 6: DNS resolution from pod
# ============================================================================
if ($podName) {
    Write-Status "═══ TEST 6/10: DNS Resolution from Identity Pod ═══" "ℹ️"
    
    $result6 = Execute-Command `
        "kubectl exec -n agro-apps $podName -- nslookup otel-collector 2>/dev/null" `
        "otel-collector DNS resolution"
    
    $diagnostics += $result6
    if ($result6.Success -and $result6.Output -match "Address:") {
        Write-Status "✅ otel-collector resolves correctly" "✅"
        Write-Host ($result6.Output | Out-String)
    }
    else {
        Write-Status "❌ otel-collector DNS resolution failed" "❌"
    }
}

# ============================================================================
# TEST 7: Network connectivity pod → OTEL collector
# ============================================================================
if ($podName) {
    Write-Status "═══ TEST 7/10: Network Connectivity (gRPC 4317) ═══" "ℹ️"
    
    $result7 = Execute-Command `
        "kubectl exec -n agro-apps $podName -- curl -m 2 http://otel-collector-agent.observability.svc.cluster.local:4317/ 2>&1" `
        "TCP connection to OTEL DaemonSet:4317 (gRPC)"
    
    $diagnostics += $result7
    if ($result7.Success) {
        Write-Status "✅ Network connectivity to OTEL gRPC port: WORKING" "✅"
    }
    else {
        Write-Status "❌ Network connectivity to OTEL gRPC port: FAILED - Check network" "❌"
    }
}

# ============================================================================
# TEST 8: Identity Service Logs
# ============================================================================
if ($podName) {
    Write-Status "═══ TEST 8/10: Identity Service Pod Logs (Recent) ═══" "ℹ️"
    
    $result8 = Execute-Command `
        "kubectl logs -n agro-apps $podName --tail=$TailLines 2>/dev/null | Select-String 'Telemetry|OTLP|OpenTelemetry|exporter' -CaseSensitive:$false" `
        "Telemetry-related logs from identity pod"
    
    $diagnostics += $result8
    if ($result8.Success -and $result8.Output.Count -gt 0) {
        Write-Status "✅ Telemetry logs found in identity pod:" "✅"
        Write-Host ($result8.Output | Out-String)
    }
    else {
        Write-Status "⚠️ No telemetry-specific logs found (may be normal)" "⚠️"
    }
}

# ============================================================================
# TEST 9: OTEL DaemonSet Logs
# ============================================================================
Write-Status "═══ TEST 9/10: OTEL DaemonSet Logs (Recent) ═══" "ℹ️"

$result9 = Execute-Command `
    "kubectl logs -n observability -l app=otel-collector-agent --tail=$TailLines 2>/dev/null | Select-String 'listening|error|refused|export' -CaseSensitive:$false" `
    "OTEL DaemonSet logs"

$diagnostics += $result9
if ($result9.Success -and $result9.Output.Count -gt 0) {
    Write-Status "✅ OTEL DaemonSet logs found:" "✅"
    Write-Host ($result9.Output | Out-String)
}
else {
    Write-Status "⚠️ No relevant OTEL DaemonSet logs found" "⚠️"
}

# ============================================================================
# TEST 10: ConfigMap current values
# ============================================================================
Write-Status "═══ TEST 10/10: ConfigMap Current Values ═══" "ℹ️"

$result10 = Execute-Command `
    "kubectl get configmap -n agro-apps identity-config -o jsonpath='{.data.Telemetry__Grafana__Agent__Enabled}' 2>/dev/null" `
    "Telemetry__Grafana__Agent__Enabled in ConfigMap"

$diagnostics += $result10
if ($result10.Success) {
    Write-Status "ConfigMap Telemetry__Grafana__Agent__Enabled = $($result10.Output)" $(if ($result10.Output -eq "true") { "✅" } else { "❌" })
}
else {
    Write-Status "Could not read ConfigMap" "⚠️"
}

# ============================================================================
# SUMMARY
# ============================================================================
Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  📊 DIAGNOSTIC SUMMARY                                         ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

$passed = ($diagnostics | Where-Object { $_.Success } | Measure-Object).Count
$failed = ($diagnostics | Where-Object { -not $_.Success } | Measure-Object).Count

Write-Status "Tests Passed: $passed" "✅"
Write-Status "Tests Failed: $failed" $(if ($failed -gt 0) { "❌" } else { "✅" })

Write-Host ""
Write-Host "═══ NEXT STEPS ═══" -ForegroundColor Yellow

if ($failed -gt 0) {
    Write-Status "Some diagnostics failed. Check the failures above." "⚠️"
    Write-Status "Most likely causes:" "ℹ️"
    Write-Host "  1. k3d cluster not running or not connected to Docker network"
    Write-Host "  2. OTEL DaemonSet pods not deployed or not Running"
    Write-Host "  3. ConfigMap not applied to cluster"
    Write-Host "  4. Pods haven't been restarted after ConfigMap update"
}
else {
    Write-Status "All diagnostics passed! ✅" "✅"
    Write-Status "If traces/metrics still not flowing, check:" "ℹ️"
    Write-Host "  1. Logs in Docker Compose otel-collector for export errors"
    Write-Host "  2. Prometheus/Tempo/Grafana dashboards for data"
    Write-Host "  3. Check if OpenTelemetry SDK is actually configured in code"
}

Write-Host ""
Write-Host "For detailed debugging, see: docs/TELEMETRY_DIAGNOSIS_COMMANDS.md" -ForegroundColor Cyan
Write-Host ""

