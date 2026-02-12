# =====================================================
# Diagnostic Script: Full Data Flow Pipeline Analysis
# =====================================================
# Purpose: Trace correlation_id flow from source to destination
#
# Data Flow:
# 1. ASP.NET Core Request
#    ↓
# 2. CorrelationMiddleware → correlationIdGenerator.SetCorrelationId()
#    ↓
# 3. TelemetryMiddleware → LogContext.PushProperty("correlation_id", ...)
#    ↓
# 4. Serilog → Enriches log record with correlation_id
#    ↓
# 5. Serilog OTLP Sink → Converts LogEvent to OTLP LogRecord
#    ↓
# 6. OTEL Collector receives LogRecord.Attributes["correlation_id"]
#    ↓
# 7. attributes_to_labels/logs processor → Promotes attribute to label
#    ↓
# 8. OTLP HTTP exporter → Sends to Loki /otlp endpoint
#    ↓
# 9. Loki receives as structured metadata (label)
#    ↓
# 10. Grafana Explore → Shows in Label Filters
# =====================================================

param(
    [string]$ServiceUrl = "http://localhost:5001",
    [string]$LokiUrl = "http://localhost:3100",
    [string]$OtelCollectorUrl = "http://localhost:14318",  # OTLP HTTP from k3d
    [string]$PrometheusUrl = "http://localhost:9090",
    [int]$WaitSeconds = 5,
    [switch]$VerboseOutput
)

Write-Host "`n╔═══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║      Data Flow Pipeline Analysis - Correlation ID     ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

$ErrorCount = 0
$WarningCount = 0

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Url,
        [string]$Icon = "🔗"
    )
    
    try {
        $response = Invoke-RestMethod -Uri $Url -ErrorAction Stop -TimeoutSec 3
        Write-Host "✅ $Icon $Name is UP" -ForegroundColor Green
        return $true
    }
    catch {
        Write-Host "❌ $Icon $Name is DOWN" -ForegroundColor Red
        Write-Host "   URL: $Url" -ForegroundColor Gray
        Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Gray
        $script:ErrorCount++
        return $false
    }
}

function Get-ServiceLogs {
    param(
        [string]$ServiceName,
        [int]$Lines = 20
    )
    
    try {
        $logs = docker compose logs $ServiceName --tail=$Lines 2>$null
        return $logs
    }
    catch {
        return $null
    }
}

# =====================================================
# Step 1: Verify all infrastructure is up
# =====================================================
Write-Host "📊 STEP 1: Infrastructure Availability Check" -ForegroundColor Yellow
Write-Host "─" * 50

$services = @(
    @{ Name = "Identity Service"; Url = "$ServiceUrl/health"; Icon = "🔐" },
    @{ Name = "Loki"; Url = "$LokiUrl/loki/api/v1/status/buildinfo"; Icon = "📊" },
    @{ Name = "OTEL Collector (gRPC)"; Url = "$OtelCollectorUrl/../../../."; Icon = "📡" }
)

$allUp = $true
foreach ($service in $services) {
    $isUp = Test-Endpoint -Name $service.Name -Url $service.Url -Icon $service.Icon
    if (-not $isUp) { $allUp = $false }
}

if (-not $allUp) {
    Write-Host "`n❌ Some services are down. Start with:" -ForegroundColor Red
    Write-Host "   docker compose up -d" -ForegroundColor Yellow
    exit 1
}

# =====================================================
# Step 2: Generate correlation ID in logs
# =====================================================
Write-Host "`n📊 STEP 2: Generating Test Request with Correlation ID" -ForegroundColor Yellow
Write-Host "─" * 50

$testCorrelationId = "TEST-$([Guid]::NewGuid().ToString().Substring(0, 8).ToUpper())"
Write-Host "Generated Test Correlation ID: $testCorrelationId" -ForegroundColor Cyan

try {
    Write-Host "Sending request to $ServiceUrl/health..." -ForegroundColor Gray
    
    $response = Invoke-RestMethod `
        -Uri "$ServiceUrl/health" `
        -Headers @{ "X-Correlation-ID" = $testCorrelationId } `
        -ErrorAction Stop `
        -TimeoutSec 5
    
    Write-Host "✅ Health request succeeded" -ForegroundColor Green
    Write-Host "   Response: $($response | ConvertTo-Json)" -ForegroundColor Gray
    
    Write-Host "`n⏳ Waiting $WaitSeconds seconds for logs to propagate through pipeline..." -ForegroundColor Yellow
    Start-Sleep -Seconds $WaitSeconds
}
catch {
    Write-Host "❌ Health request failed: $($_.Exception.Message)" -ForegroundColor Red
    $script:ErrorCount++
}

# =====================================================
# Step 3: Check Serilog logs locally
# =====================================================
Write-Host "`n📊 STEP 3: Service Logs (Serilog Output)" -ForegroundColor Yellow
Write-Host "─" * 50

$serviceLogs = Get-ServiceLogs -ServiceName "identity-service" -Lines 30

if ($serviceLogs) {
    Write-Host "Recent logs from identity-service:" -ForegroundColor Gray
    Write-Host "─" * 50
    
    $lines = $serviceLogs -split "`n"
    
    # Look for correlation_id in logs
    $correlationFound = $false
    $lines | ForEach-Object {
        if ($_ -match $testCorrelationId) {
            Write-Host $_ -ForegroundColor Green
            $correlationFound = $true
        }
        elseif ($_ -match '"correlation_id"') {
            Write-Host $_ -ForegroundColor Green
            $correlationFound = $true
        }
        elseif ($VerboseOutput) {
            Write-Host $_ -ForegroundColor Gray
        }
    }
    
    if (-not $correlationFound) {
        Write-Host "⚠️  Test correlation_id NOT found in service logs" -ForegroundColor Yellow
        Write-Host "   Possible issue: CorrelationMiddleware not working OR logs not captured" -ForegroundColor Yellow
    }
    else {
        Write-Host "✅ Correlation ID is present in service logs" -ForegroundColor Green
    }
}
else {
    Write-Host "⚠️  Could not retrieve service logs" -ForegroundColor Yellow
}

# =====================================================
# Step 4: Check OTEL Collector logs
# =====================================================
Write-Host "`n📊 STEP 4: OTEL Collector Logs (Receiving OTLP)" -ForegroundColor Yellow
Write-Host "─" * 50

$otlpLogs = Get-ServiceLogs -ServiceName "otel-collector" -Lines 30

if ($otlpLogs) {
    Write-Host "Recent OTEL Collector logs:" -ForegroundColor Gray
    Write-Host "─" * 50
    
    $lines = $otlpLogs -split "`n"
    
    $logRecordCount = 0
    $lines | ForEach-Object {
        if ($_ -match "LogRecord") {
            $logRecordCount++
        }
        if ($_ -match "correlation_id|attributes_to_labels|loki") {
            Write-Host $_ -ForegroundColor Magenta
        }
        elseif ($VerboseOutput -and $_ -match "ERROR|WARN") {
            Write-Host $_ -ForegroundColor Yellow
        }
    }
    
    Write-Host "`nℹ️  LogRecord count in recent logs: $logRecordCount" -ForegroundColor Gray
    
    if ($logRecordCount -eq 0) {
        Write-Host "⚠️  WARNING: No LogRecords seen in OTEL Collector" -ForegroundColor Yellow
        Write-Host "   This could mean:" -ForegroundColor Yellow
        Write-Host "   1. Serilog is not sending logs to OTEL Collector" -ForegroundColor Yellow
        Write-Host "   2. OTEL Collector not listening on correct port" -ForegroundColor Yellow
    }
}
else {
    Write-Host "⚠️  Could not retrieve OTEL Collector logs" -ForegroundColor Yellow
}

# =====================================================
# Step 5: Query Loki for correlation_id label
# =====================================================
Write-Host "`n📊 STEP 5: Querying Loki for Correlation ID" -ForegroundColor Yellow
Write-Host "─" * 50

try {
    # Get all labels
    Write-Host "Fetching all available labels from Loki..." -ForegroundColor Gray
    $allLabels = Invoke-RestMethod -Uri "$LokiUrl/loki/api/v1/labels" -ErrorAction Stop
    
    Write-Host "✅ Available labels in Loki: $($allLabels.data.Count)" -ForegroundColor Green
    
    $hasCorrLabel = $allLabels.data -contains "correlation_id"
    if ($hasCorrLabel) {
        Write-Host "✅ correlation_id label IS available" -ForegroundColor Green
        
        # Get correlation_id values
        try {
            $corrValues = Invoke-RestMethod -Uri "$LokiUrl/loki/api/v1/label/correlation_id/values" -ErrorAction Stop
            Write-Host "✅ Found $($corrValues.data.Count) unique correlation_id values" -ForegroundColor Green
            
            # Show recent values
            Write-Host "Recent correlation_id values:" -ForegroundColor Gray
            $corrValues.data | Select-Object -Last 5 | ForEach-Object {
                $marker = if ($_ -eq $testCorrelationId) { "⭐ TEST ID" } else { "  " }
                Write-Host "   $marker $_" -ForegroundColor $(if ($_ -eq $testCorrelationId) { "Cyan" } else { "Gray" })
            }
        }
        catch {
            Write-Host "⚠️  Could not fetch correlation_id values: $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }
    else {
        Write-Host "❌ correlation_id label NOT available in Loki" -ForegroundColor Red
        Write-Host "   Available labels:" -ForegroundColor Yellow
        $allLabels.data | ForEach-Object { Write-Host "      • $_" -ForegroundColor Gray }
        $script:ErrorCount++
    }
}
catch {
    Write-Host "❌ Could not query Loki labels: $($_.Exception.Message)" -ForegroundColor Red
    $script:ErrorCount++
}

# =====================================================
# Step 6: Query logs with correlation_id filter
# =====================================================
Write-Host "`n📊 STEP 6: Testing Log Query with Correlation ID Filter" -ForegroundColor Yellow
Write-Host "─" * 50

try {
    $query = '{correlation_id="' + $testCorrelationId + '"}'
    Write-Host "Query: $query" -ForegroundColor Gray
    
    $logsResponse = Invoke-RestMethod `
        -Uri "$LokiUrl/loki/api/v1/query?query=$([Uri]::EscapeDataString($query))" `
        -ErrorAction Stop
    
    if ($logsResponse.data.result -and $logsResponse.data.result.Count -gt 0) {
        Write-Host "✅ Query returned $($logsResponse.data.result.Count) log stream(s)" -ForegroundColor Green
        Write-Host "   This means correlation_id IS working as a searchable label!" -ForegroundColor Green
        
        $logsResponse.data.result | ForEach-Object {
            Write-Host "`n📋 Stream:" -ForegroundColor Gray
            $_.stream.PSObject.Properties | ForEach-Object {
                Write-Host "   $($_.Name) = $($_.Value)" -ForegroundColor Gray
            }
            
            if ($_.values.Count -gt 0) {
                Write-Host "   Entries: $($_.values.Count)" -ForegroundColor Gray
            }
        }
    }
    else {
        Write-Host "⚠️  No logs found with correlation_id=$testCorrelationId" -ForegroundColor Yellow
        Write-Host "   Possible reasons:" -ForegroundColor Yellow
        Write-Host "   1. Logs not arrived yet (try waiting longer)" -ForegroundColor Yellow
        Write-Host "   2. correlation_id value is different" -ForegroundColor Yellow
        Write-Host "   3. correlation_id not being set as a label" -ForegroundColor Yellow
        $script:WarningCount++
    }
}
catch {
    Write-Host "❌ Query failed: $($_.Exception.Message)" -ForegroundColor Red
    $script:ErrorCount++
}

# =====================================================
# Step 7: Grafana Datasource Check
# =====================================================
Write-Host "`n📊 STEP 7: Grafana Datasource Configuration" -ForegroundColor Yellow
Write-Host "─" * 50

try {
    $grafanaUrl = "http://localhost:3000"
    $datasource = Invoke-RestMethod `
        -Uri "$grafanaUrl/api/datasources/uid/loki" `
        -Headers @{ "Authorization" = "Bearer admin" } `
        -ErrorAction Stop
    
    Write-Host "✅ Grafana Loki datasource found" -ForegroundColor Green
    Write-Host "   Name: $($datasource.name)" -ForegroundColor Gray
    Write-Host "   URL: $($datasource.url)" -ForegroundColor Gray
    Write-Host "   Type: $($datasource.type)" -ForegroundColor Gray
}
catch {
    Write-Host "⚠️  Could not access Grafana datasource: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host "   Grafana might require authentication" -ForegroundColor Yellow
}

# =====================================================
# Summary
# =====================================================
Write-Host "`n╔═══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║                    DIAGNOSIS SUMMARY                   ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

if ($ErrorCount -eq 0 -and $WarningCount -eq 0) {
    Write-Host "✅ All checks passed! correlation_id is flowing correctly." -ForegroundColor Green
}
elseif ($ErrorCount -gt 0) {
    Write-Host "❌ $ErrorCount critical issue(s) found" -ForegroundColor Red
}
else {
    Write-Host "⚠️  $WarningCount warning(s) found" -ForegroundColor Yellow
}

Write-Host "`n🔍 Troubleshooting Checklist:" -ForegroundColor Yellow
Write-Host "" -ForegroundColor Gray
Write-Host "If correlation_id is missing from Loki labels:" -ForegroundColor Yellow
Write-Host "   1. Check CorrelationMiddleware is registered BEFORE TelemetryMiddleware" -ForegroundColor Gray
Write-Host "      Location: services/identity-service/Program.cs" -ForegroundColor Gray
Write-Host "" -ForegroundColor Gray
Write-Host "   2. Verify LogContext.PushProperty is called in TelemetryMiddleware" -ForegroundColor Gray
Write-Host "      Location: services/identity-service/Middleware/TelemetryMiddleware.cs" -ForegroundColor Gray
Write-Host "" -ForegroundColor Gray
Write-Host "   3. Confirm OTEL Collector attributes_to_labels/logs processor" -ForegroundColor Gray
Write-Host "      Location: orchestration/apphost-compose/observability/otel-collector/config.yml" -ForegroundColor Gray
Write-Host "      Lines: ~45-75 (attributes_to_labels/logs section)" -ForegroundColor Gray
Write-Host "" -ForegroundColor Gray
Write-Host "   4. Restart OTEL Collector and wait 30 seconds:" -ForegroundColor Gray
Write-Host "      docker compose restart otel-collector" -ForegroundColor Gray
Write-Host "" -ForegroundColor Gray
Write-Host "   5. Generate fresh logs:" -ForegroundColor Gray
Write-Host "      curl http://localhost:5001/health" -ForegroundColor Gray
Write-Host "" -ForegroundColor Gray
Write-Host "   6. Re-run this diagnostic:" -ForegroundColor Gray
Write-Host "      powershell diagnostic-full-pipeline.ps1 -WaitSeconds 10 -VerboseOutput" -ForegroundColor Gray

Write-Host "`n"
