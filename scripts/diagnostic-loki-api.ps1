#!/usr/bin/env pwsh
# =====================================================
# Loki API Direct Testing Script
# =====================================================
# Purpose: Make direct HTTP calls to Loki API to verify correlation_id data
#
# Reference: https://grafana.com/docs/loki/latest/api/
# =====================================================

param(
    [string]$LokiUrl = "http://localhost:3100",
    [string]$Query = "",
    [int]$Limit = 100,
    [switch]$ShowRawJson,
    [switch]$ShowPrettyJson
)

Write-Host "`n╔═══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║         Loki API Direct Testing - Correlation ID      ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

# Helper function for API calls
function Invoke-LokiQuery {
    param(
        [string]$Endpoint,
        [hashtable]$QueryParams = @{},
        [string]$Description = ""
    )
    
    $uri = "$LokiUrl$Endpoint"
    
    if ($QueryParams.Count -gt 0) {
        $queryString = ($QueryParams.GetEnumerator() | ForEach-Object { "$($_.Key)=$([Uri]::EscapeDataString($_.Value.ToString()))" }) -join "&"
        $uri += "?$queryString"
    }
    
    Write-Host "📍 API Call: $Description" -ForegroundColor Yellow
    Write-Host "   Endpoint: $Endpoint" -ForegroundColor Gray
    if ($QueryParams.Count -gt 0) {
        Write-Host "   Parameters:" -ForegroundColor Gray
        $QueryParams.GetEnumerator() | ForEach-Object {
            Write-Host "      • $($_.Key) = $($_.Value)" -ForegroundColor Gray
        }
    }
    
    try {
        Write-Host "   ⏳ Calling Loki..." -ForegroundColor Gray
        
        $response = Invoke-RestMethod -Uri $uri -Method Get -ErrorAction Stop
        
        Write-Host "   ✅ Success" -ForegroundColor Green
        return $response
    }
    catch {
        Write-Host "   ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}

# =====================================================
# Test 1: Loki Status
# =====================================================
Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Magenta
Write-Host "TEST 1: Loki Server Status" -ForegroundColor Magenta
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Magenta

$status = Invoke-LokiQuery `
    -Endpoint "/loki/api/v1/status/buildinfo" `
    -Description "Get Loki build info and version"

if ($status) {
    Write-Host "Response:" -ForegroundColor Gray
    $status.PSObject.Properties | ForEach-Object {
        Write-Host "   $($_.Name): $($_.Value)" -ForegroundColor Cyan
    }
}

# =====================================================
# Test 2: Available Labels
# =====================================================
Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Magenta
Write-Host "TEST 2: Available Labels in Loki" -ForegroundColor Magenta
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Magenta

$labels = Invoke-LokiQuery `
    -Endpoint "/loki/api/v1/labels" `
    -Description "Get all available labels"

if ($labels -and $labels.data) {
    Write-Host "Found $($labels.data.Count) labels:" -ForegroundColor Green
    
    $labels.data | Sort-Object | ForEach-Object {
        $icon = if ($_ -eq "correlation_id") { "🎯" } else { "  " }
        $color = if ($_ -eq "correlation_id") { "Green" } else { "Gray" }
        Write-Host "   $icon $_" -ForegroundColor $color
    }
    
    if ($labels.data -notcontains "correlation_id") {
        Write-Host "`n⚠️  correlation_id NOT in label list!" -ForegroundColor Red
    }
}

# =====================================================
# Test 3: Correlation ID Values
# =====================================================
Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Magenta
Write-Host "TEST 3: Correlation ID Label Values" -ForegroundColor Magenta
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Magenta

$corrValues = Invoke-LokiQuery `
    -Endpoint "/loki/api/v1/label/correlation_id/values" `
    -Description "Get values for correlation_id label"

if ($corrValues -and $corrValues.data) {
    Write-Host "Found $($corrValues.data.Count) unique correlation_id values:" -ForegroundColor Green
    
    $corrValues.data | Select-Object -Last 10 | ForEach-Object {
        Write-Host "   • $_" -ForegroundColor Cyan
    }
    
    if ($corrValues.data.Count -gt 10) {
        Write-Host "   ... and $($corrValues.data.Count - 10) more" -ForegroundColor Gray
    }
}
else {
    Write-Host "❌ No correlation_id values found" -ForegroundColor Red
}

# =====================================================
# Test 4: Service Names (to verify data)
# =====================================================
Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Magenta
Write-Host "TEST 4: Service Names (Data Existence Check)" -ForegroundColor Magenta
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Magenta

$serviceValues = Invoke-LokiQuery `
    -Endpoint "/loki/api/v1/label/service_name/values" `
    -Description "Get available services"

if ($serviceValues -and $serviceValues.data) {
    Write-Host "Found $($serviceValues.data.Count) services:" -ForegroundColor Green
    $serviceValues.data | ForEach-Object {
        Write-Host "   • $_" -ForegroundColor Cyan
    }
}
else {
    Write-Host "⚠️  No services found. Generate logs first:" -ForegroundColor Yellow
    Write-Host "   curl -H 'X-Correlation-ID: TEST-123' http://localhost:5001/health" -ForegroundColor Yellow
}

# =====================================================
# Test 5: Recent Logs (Generic Query)
# =====================================================
Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Magenta
Write-Host "TEST 5: Recent Logs (Last 5 minutes)" -ForegroundColor Magenta
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Magenta

$recentLogs = Invoke-LokiQuery `
    -Endpoint "/loki/api/v1/query_range" `
    -QueryParams @{
    "query" = '{service_name="tc-agro-identity"}'
    "start" = [Math]::Floor((Get-Date).AddMinutes(-5).ToUniversalTime().Ticks / 10000000).ToString()
    "end"   = [Math]::Floor((Get-Date).ToUniversalTime().Ticks / 10000000).ToString()
    "limit" = $Limit
} `
    -Description "Query recent identity service logs"

if ($recentLogs -and $recentLogs.data.result) {
    Write-Host "Found $($recentLogs.data.result.Count) log streams" -ForegroundColor Green
    
    $recentLogs.data.result | ForEach-Object {
        Write-Host "`n📋 Stream:" -ForegroundColor Gray
        
        # Show labels
        $_.stream.PSObject.Properties | ForEach-Object {
            $value = $_.Value
            $color = if (@("correlation_id", "trace_id", "span_id") -contains $_.Name) { "Green" } else { "Gray" }
            Write-Host "   $($_.Name) = $value" -ForegroundColor $color
        }
        
        # Show entry count
        if ($_.values) {
            Write-Host "   📝 Entries: $($_.values.Count)" -ForegroundColor Gray
            
            # Show last entry preview
            $lastEntry = $_.values[-1]
            $message = $lastEntry[1]
            $preview = if ($message.Length -gt 80) { $message.Substring(0, 77) + "..." } else { $message }
            Write-Host "   Last: $preview" -ForegroundColor Gray
        }
    }
}
else {
    Write-Host "⚠️  No recent logs found. Services might not be logging yet." -ForegroundColor Yellow
}

# =====================================================
# Test 6: Query with Correlation ID Filter
# =====================================================
if (-not $Query) {
    # Get first correlation_id from available values
    if ($corrValues -and $corrValues.data -and $corrValues.data.Count -gt 0) {
        $Query = $corrValues.data[0]
    }
}

if ($Query) {
    Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Magenta
    Write-Host "TEST 6: Query with Correlation ID Filter" -ForegroundColor Magenta
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Magenta
    
    $filteredLogs = Invoke-LokiQuery `
        -Endpoint "/loki/api/v1/query" `
        -QueryParams @{
        "query" = '{correlation_id="' + $Query + '"}'
    } `
        -Description "Query logs by correlation_id=$Query"
    
    if ($filteredLogs -and $filteredLogs.data.result) {
        Write-Host "✅ Found $($filteredLogs.data.result.Count) log stream(s) with this correlation_id" -ForegroundColor Green
        Write-Host "   This proves correlation_id filtering WORKS in Loki!" -ForegroundColor Green
        
        $filteredLogs.data.result | ForEach-Object {
            Write-Host "`n📋 Stream:" -ForegroundColor Gray
            $_.stream.PSObject.Properties | ForEach-Object {
                Write-Host "   $($_.Name) = $($_.Value)" -ForegroundColor Cyan
            }
            
            if ($_.values.Count -gt 0) {
                Write-Host "   📝 Entries: $($_.values.Count)" -ForegroundColor Gray
                Write-Host "   First few entries:" -ForegroundColor Gray
                
                $_.values | Select-Object -First 3 | ForEach-Object {
                    $timestamp = $.[0]
                    $message = $.[1]
                    Write-Host "      [$timestamp] $message" -ForegroundColor Gray
                }
            }
        }
        
        if ($ShowRawJson) {
            Write-Host "`nRaw JSON Response:" -ForegroundColor Magenta
            Write-Host ($filteredLogs | ConvertTo-Json -Depth 10) -ForegroundColor Gray
        }
    }
    else {
        Write-Host "❌ No logs found with correlation_id=$Query" -ForegroundColor Red
        Write-Host "   Possible causes:" -ForegroundColor Yellow
        Write-Host "   1. correlation_id value doesn't exist" -ForegroundColor Yellow
        Write-Host "   2. correlation_id is not indexed as a label (only as attribute)" -ForegroundColor Yellow
        Write-Host "   3. OTEL Collector not sending to Loki with labels" -ForegroundColor Yellow
    }
}

# =====================================================
# Test 7: Raw Query Interface
# =====================================================
Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Magenta
Write-Host "TEST 7: Manual Query Interface" -ForegroundColor Magenta
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Magenta

Write-Host "`n🔍 You can run these queries manually in PowerShell:" -ForegroundColor Yellow

$examples = @(
    @{
        Name  = "All logs (no filter)"
        Query = '{}'
        Curl  = 'curl -G -d ''query={}'' http://localhost:3100/loki/api/v1/query'
    },
    @{
        Name  = "Logs from specific service"
        Query = '{service_name="tc-agro-identity"}'
        Curl  = 'curl -G -d ''query={service_name="tc-agro-identity"}'' http://localhost:3100/loki/api/v1/query'
    },
    @{
        Name  = "Logs with correlation_id"
        Query = '{correlation_id="YOUR_CORRELATION_ID"}'
        Curl  = 'curl -G -d ''query={correlation_id="YOUR_CORRELATION_ID"}'' http://localhost:3100/loki/api/v1/query'
    },
    @{
        Name  = "Logs matching pattern"
        Query = '{service_name="tc-agro-identity"} | "error"'
        Curl  = 'curl -G -d ''query={service_name="tc-agro-identity"} | "error"'' http://localhost:3100/loki/api/v1/query'
    }
)

$examples | ForEach-Object {
    Write-Host "`n📌 $($_.Name)" -ForegroundColor Cyan
    Write-Host "   PowerShell:" -ForegroundColor Gray
    Write-Host "   `$query = '$($_.Query)'" -ForegroundColor Gray
    Write-Host "   `$uri = 'http://localhost:3100/loki/api/v1/query?query=' + [Uri]::EscapeDataString(`$query)" -ForegroundColor Gray
    Write-Host "   Invoke-RestMethod -Uri `$uri | ConvertTo-Json" -ForegroundColor Gray
    Write-Host "" -ForegroundColor Gray
    Write-Host "   Curl:" -ForegroundColor Gray
    Write-Host "   $($_.Curl)" -ForegroundColor Gray
}

# =====================================================
# Summary
# =====================================================
Write-Host "`n╔═══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║                    KEY FINDINGS                        ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

Write-Host "✅ If Test 3 shows correlation_id values:" -ForegroundColor Green
Write-Host "   → correlation_id IS being sent to Loki as a label" -ForegroundColor Green
Write-Host "   → Grafana Label Filters should show correlation_id" -ForegroundColor Green
Write-Host "   → If NOT showing in Grafana, issue is in Grafana datasource config" -ForegroundColor Green

Write-Host "`n❌ If Test 3 shows NO correlation_id values:" -ForegroundColor Red
Write-Host "   → correlation_id is NOT reaching Loki as a label" -ForegroundColor Red
Write-Host "   → Check OTEL Collector attributes_to_labels/logs processor" -ForegroundColor Red
Write-Host "   → Verify Serilog LogContext.PushProperty is being called" -ForegroundColor Red
Write-Host "   → Check middleware execution order (CorrelationMiddleware BEFORE TelemetryMiddleware)" -ForegroundColor Red

Write-Host "`n🔧 Next Steps:" -ForegroundColor Yellow
Write-Host "   1. Run: docker compose restart otel-collector" -ForegroundColor Gray
Write-Host "   2. Generate logs: curl -H 'X-Correlation-ID: TEST-XYZ' http://localhost:5001/health" -ForegroundColor Gray
Write-Host "   3. Wait 5 seconds for propagation" -ForegroundColor Gray
Write-Host "   4. Re-run this script: ./diagnostic-loki-api.ps1" -ForegroundColor Gray

Write-Host "`n"
