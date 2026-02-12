# =====================================================
# Diagnostic Script: Loki Correlation ID Labels
# =====================================================
# Purpose: Diagnose why correlation_id doesn't appear in Grafana Loki label filters
# 
# Tests:
# 1. Check available labels in Loki
# 2. Check correlation_id values in Loki
# 3. Query logs with correlation_id filter
# 4. Check OTEL Collector debug output
# 5. Verify Serilog enricher configuration
# =====================================================

param(
    [string]$LokiUrl = "http://localhost:3100",
    [string]$CorrelationId = "",
    [string]$ServiceName = "tc-agro-identity",
    [switch]$ShowDebugLogs,
    [switch]$CheckOtlpStatus
)

Write-Host "`n╔═══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║     Loki Correlation ID Label Diagnostic Script      ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

# Helper function to make HTTP requests
function Invoke-LokiApi {
    param(
        [string]$Endpoint,
        [string]$Method = "GET"
    )
    
    try {
        $FullUrl = "$LokiUrl$Endpoint"
        Write-Host "🔗 Requesting: $FullUrl" -ForegroundColor Gray
        
        $response = Invoke-RestMethod -Uri $FullUrl -Method $Method -ErrorAction Stop
        return $response
    }
    catch {
        Write-Host "❌ Error calling Loki API: $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}

# =====================================================
# Test 1: Check if Loki is accessible
# =====================================================
Write-Host "📊 TEST 1: Checking Loki Accessibility" -ForegroundColor Yellow
Write-Host "─" * 50

try {
    $lokiStatus = Invoke-RestMethod -Uri "$LokiUrl/loki/api/v1/status/buildinfo" -ErrorAction Stop
    Write-Host "✅ Loki is accessible" -ForegroundColor Green
    Write-Host "   Version: $($lokiStatus.version)" -ForegroundColor Green
    Write-Host "   BuildDate: $($lokiStatus.builddate)" -ForegroundColor Green
}
catch {
    Write-Host "❌ Loki is NOT accessible at $LokiUrl" -ForegroundColor Red
    Write-Host "   Make sure: docker compose up -d loki" -ForegroundColor Yellow
    exit 1
}

# =====================================================
# Test 2: Get all available labels
# =====================================================
Write-Host "`n📊 TEST 2: Available Labels in Loki" -ForegroundColor Yellow
Write-Host "─" * 50

$labels = Invoke-LokiApi -Endpoint "/loki/api/v1/labels"

if ($labels) {
    Write-Host "✅ Labels found: $($labels.data.Count)" -ForegroundColor Green
    $labels.data | ForEach-Object {
        $hasCorrelation = $_ -eq "correlation_id"
        $icon = if ($hasCorrelation) { "🎯" } else { "  " }
        Write-Host "   $icon $_" -ForegroundColor $(if ($hasCorrelation) { "Green" } else { "Gray" })
    }
    
    if ($labels.data -notcontains "correlation_id") {
        Write-Host "`n⚠️  WARNING: correlation_id NOT in available labels!" -ForegroundColor Red
        Write-Host "   This explains why filters don't appear in Grafana." -ForegroundColor Red
    }
}
else {
    Write-Host "❌ Failed to retrieve labels" -ForegroundColor Red
}

# =====================================================
# Test 3: Check correlation_id label values
# =====================================================
Write-Host "`n📊 TEST 3: Correlation ID Label Values" -ForegroundColor Yellow
Write-Host "─" * 50

$correlationIdValues = Invoke-LokiApi -Endpoint "/loki/api/v1/label/correlation_id/values"

if ($correlationIdValues -and $correlationIdValues.data) {
    Write-Host "✅ correlation_id values found: $($correlationIdValues.data.Count)" -ForegroundColor Green
    $correlationIdValues.data | Select-Object -First 5 | ForEach-Object {
        Write-Host "   • $_" -ForegroundColor Green
    }
    
    if ($correlationIdValues.data.Count -gt 5) {
        Write-Host "   ... and $($correlationIdValues.data.Count - 5) more" -ForegroundColor Gray
    }
}
else {
    Write-Host "❌ No correlation_id values found in Loki" -ForegroundColor Red
    Write-Host "   Possible causes:" -ForegroundColor Yellow
    Write-Host "   1. Logs haven't arrived yet (wait a few seconds)" -ForegroundColor Yellow
    Write-Host "   2. OTEL Collector not converting attributes to labels" -ForegroundColor Yellow
    Write-Host "   3. Serilog not enriching with correlation_id property" -ForegroundColor Yellow
}

# =====================================================
# Test 4: Try to query logs
# =====================================================
Write-Host "`n📊 TEST 4: Querying Logs (Recent 5 minutes)" -ForegroundColor Yellow
Write-Host "─" * 50

$query = '{service_name="' + $ServiceName + '"}'
Write-Host "Query: $query" -ForegroundColor Gray

try {
    $logsResponse = Invoke-RestMethod `
        -Uri "$LokiUrl/loki/api/v1/query?query=$([Uri]::EscapeDataString($query))" `
        -ErrorAction Stop
    
    if ($logsResponse.data.result) {
        Write-Host "✅ Logs found: $($logsResponse.data.result.Count)" -ForegroundColor Green
        
        $logsResponse.data.result | ForEach-Object {
            Write-Host "`n📋 Result:" -ForegroundColor Gray
            Write-Host "   Stream Labels:" -ForegroundColor Gray
            $_.stream.PSObject.Properties | ForEach-Object {
                Write-Host "      • $($_.Name) = $($_.Value)" -ForegroundColor $(if ($_.Name -eq "correlation_id") { "Green" } else { "Gray" })
            }
            
            # Show first log entry
            if ($_.values) {
                Write-Host "   First Log Entry:" -ForegroundColor Gray
                $firstLog = $_.values[0]
                Write-Host "      Timestamp: $($firstLog[0])" -ForegroundColor Gray
                Write-Host "      Message: $($firstLog[1].Substring(0, [Math]::Min(100, $firstLog[1].Length)))..." -ForegroundColor Gray
            }
        }
    }
    else {
        Write-Host "⚠️  No logs found for service: $ServiceName" -ForegroundColor Yellow
        Write-Host "   Try making an HTTP request to generate logs:" -ForegroundColor Yellow
        Write-Host "   curl http://localhost:5001/health" -ForegroundColor Yellow
    }
}
catch {
    Write-Host "❌ Error querying logs: $($_.Exception.Message)" -ForegroundColor Red
}

# =====================================================
# Test 5: Query with correlation_id filter
# =====================================================
if ($CorrelationId) {
    Write-Host "`n📊 TEST 5: Querying Logs with Correlation ID Filter" -ForegroundColor Yellow
    Write-Host "─" * 50
    
    $queryWithCorr = '{correlation_id="' + $CorrelationId + '"}'
    Write-Host "Query: $queryWithCorr" -ForegroundColor Gray
    
    try {
        $logsWithCorrResponse = Invoke-RestMethod `
            -Uri "$LokiUrl/loki/api/v1/query?query=$([Uri]::EscapeDataString($queryWithCorr))" `
            -ErrorAction Stop
        
        if ($logsWithCorrResponse.data.result) {
            Write-Host "✅ Logs found with correlation_id filter: $($logsWithCorrResponse.data.result.Count)" -ForegroundColor Green
            Write-Host "   This means correlation_id IS working in Loki!" -ForegroundColor Green
        }
        else {
            Write-Host "❌ No logs found with correlation_id=$CorrelationId" -ForegroundColor Red
            Write-Host "   This means:" -ForegroundColor Yellow
            Write-Host "   • correlation_id value doesn't exist in Loki, OR" -ForegroundColor Yellow
            Write-Host "   • correlation_id is not a label (only an attribute in the log)" -ForegroundColor Yellow
        }
    }
    catch {
        Write-Host "❌ Error querying with correlation_id: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# =====================================================
# Test 6: Check OTEL Collector logs
# =====================================================
if ($CheckOtlpStatus) {
    Write-Host "`n📊 TEST 6: OTEL Collector Status" -ForegroundColor Yellow
    Write-Host "─" * 50
    
    try {
        $otlpDiag = docker compose logs otel-collector --tail=50 2>$null
        if ($otlpDiag) {
            Write-Host "✅ OTEL Collector logs (last 50 lines):" -ForegroundColor Green
            Write-Host "─" * 50
            Write-Host $otlpDiag -ForegroundColor Gray
        }
        else {
            Write-Host "⚠️  Could not retrieve OTEL Collector logs" -ForegroundColor Yellow
        }
    }
    catch {
        Write-Host "⚠️  Docker compose not accessible: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

# =====================================================
# Summary and Recommendations
# =====================================================
Write-Host "`n╔═══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║                    DIAGNOSTICS SUMMARY                 ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

Write-Host "🔍 Checklist for correlation_id to work in Loki:" -ForegroundColor Yellow
Write-Host "   ☐ Loki accessible at $LokiUrl" -ForegroundColor Gray
Write-Host "   ☐ correlation_id appears in /loki/api/v1/labels" -ForegroundColor Gray
Write-Host "   ☐ correlation_id has values in /loki/api/v1/label/correlation_id/values" -ForegroundColor Gray
Write-Host "   ☐ Query {correlation_id=`"...\`"} returns logs" -ForegroundColor Gray
Write-Host "   ☐ Grafana Explore shows correlation_id in Label Filters" -ForegroundColor Gray

Write-Host "`n📋 Next Steps if correlation_id is missing:" -ForegroundColor Yellow
Write-Host "   1. Verify Serilog LogContext.PushProperty is being called" -ForegroundColor Gray
Write-Host "   2. Check TelemetryMiddleware is executing AFTER CorrelationMiddleware" -ForegroundColor Gray
Write-Host "   3. Verify OTEL Collector's attributes_to_labels/logs processor is active" -ForegroundColor Gray
Write-Host "   4. Restart OTEL Collector: docker compose restart otel-collector" -ForegroundColor Gray
Write-Host "   5. Wait 30 seconds, then generate new logs with: curl http://localhost:5001/health" -ForegroundColor Gray

Write-Host "`n💡 Additional Commands:" -ForegroundColor Yellow
Write-Host "   # Query all logs:" -ForegroundColor Gray
Write-Host "   curl 'http://localhost:3100/loki/api/v1/query_range?query=%7B%7D&start=0&end=now'" -ForegroundColor Gray
Write-Host "" -ForegroundColor Gray
Write-Host "   # Query with service filter:" -ForegroundColor Gray
Write-Host "   curl 'http://localhost:3100/loki/api/v1/query_range?query=%7Bservice_name=%22tc-agro-identity%22%7D'" -ForegroundColor Gray
Write-Host "" -ForegroundColor Gray
Write-Host "   # Get Grafana datasource test:" -ForegroundColor Gray
Write-Host "   curl http://localhost:3000/api/datasources/uid/loki" -ForegroundColor Gray

Write-Host "`n"
