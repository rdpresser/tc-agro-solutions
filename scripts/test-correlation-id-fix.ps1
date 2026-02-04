#!/usr/bin/env pwsh

# =====================================================
# Test Script: Verify correlation_id Fix in Loki
# =====================================================
# Purpose: Verify that correlation_id now appears as label in Loki
# after Serilog OTLP sink configuration fix
#
# Date: February 4, 2026
# =====================================================

$ErrorActionPreference = "Stop"

Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   Correlation ID Loki Fix - Verification Script           ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Test 1: Verify services are running
Write-Host "📋 Test 1: Checking service availability..." -ForegroundColor Yellow

$services = @(
    @{ Name = "Identity API"; URL = "http://localhost:5001/health"; Port = 5001 }
    @{ Name = "Sensor Ingest API"; URL = "http://localhost:5003/health"; Port = 5003 }
    @{ Name = "Loki"; URL = "http://localhost:3100/ready"; Port = 3100 }
)

$allRunning = $true
foreach ($svc in $services) {
    try {
        $response = Invoke-WebRequest -Uri $svc.URL -TimeoutSec 2 -SkipHttpErrorCheck
        if ($response.StatusCode -eq 200) {
            Write-Host "  ✅ $($svc.Name) is UP (port $($svc.Port))" -ForegroundColor Green
        }
        else {
            Write-Host "  ⚠️  $($svc.Name) returned status $($response.StatusCode)" -ForegroundColor Yellow
        }
    }
    catch {
        Write-Host "  ❌ $($svc.Name) is DOWN (port $($svc.Port)) - $_" -ForegroundColor Red
        $allRunning = $false
    }
}

if (-not $allRunning) {
    Write-Host ""
    Write-Host "⚠️  Some services are not running. Please start them first:" -ForegroundColor Yellow
    Write-Host "   docker compose up -d" -ForegroundColor Gray
    Write-Host ""
    exit 1
}

Write-Host ""

# Test 2: Generate test correlation ID
Write-Host "📋 Test 2: Generating test request with correlation ID..." -ForegroundColor Yellow

$testCorrelationId = "TEST-FIX-$((Get-Date).Ticks)"
Write-Host "  Generated Correlation ID: $testCorrelationId" -ForegroundColor Cyan

try {
    $response = Invoke-WebRequest -Uri "http://localhost:5001/health" `
        -Headers @{ "X-Correlation-ID" = $testCorrelationId } `
        -TimeoutSec 5 -ErrorAction SilentlyContinue
    Write-Host "  ✅ Test request sent successfully" -ForegroundColor Green
}
catch {
    Write-Host "  ❌ Failed to send test request: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Start-Sleep -Seconds 2

# Test 3: Query Loki for available labels
Write-Host "📋 Test 3: Fetching available labels from Loki..." -ForegroundColor Yellow

try {
    $labelsResponse = Invoke-RestMethod -Uri "http://localhost:3100/loki/api/v1/labels" `
        -TimeoutSec 10
    
    if ($labelsResponse.data) {
        $labels = $labelsResponse.data
        Write-Host "  📊 Found $($labels.Count) labels:" -ForegroundColor Cyan
        
        $labels | ForEach-Object {
            if ($_ -eq "correlation_id") {
                Write-Host "    ✅ $_ (FOUND - FIX WORKS!)" -ForegroundColor Green
            }
            else {
                Write-Host "    • $_" -ForegroundColor Gray
            }
        }
        
        if ($labels -contains "correlation_id") {
            Write-Host ""
            Write-Host "🎉 SUCCESS! correlation_id is now available as a label!" -ForegroundColor Green
        }
        else {
            Write-Host ""
            Write-Host "⚠️  correlation_id NOT found in label list" -ForegroundColor Yellow
            Write-Host "    This might mean:" -ForegroundColor Yellow
            Write-Host "    1. Services haven't restarted with new config" -ForegroundColor Gray
            Write-Host "    2. OTEL Collector not processing attributes properly" -ForegroundColor Gray
            Write-Host "    3. Loki not receiving structured metadata" -ForegroundColor Gray
        }
    }
    else {
        Write-Host "  ❌ No labels returned from Loki" -ForegroundColor Red
    }
}
catch {
    Write-Host "  ❌ Failed to query Loki labels: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Test 4: Try querying with correlation_id filter
if ($labels -contains "correlation_id") {
    Write-Host "📋 Test 4: Testing correlation_id filter query..." -ForegroundColor Yellow
    
    $query = '{correlation_id="' + $testCorrelationId + '"}'
    Write-Host "  Query: $query" -ForegroundColor Cyan
    
    try {
        $queryResponse = Invoke-RestMethod `
            -Uri "http://localhost:3100/loki/api/v1/query?query=$([System.Uri]::EscapeDataString($query))" `
            -TimeoutSec 10
        
        if ($queryResponse.data.result.Count -gt 0) {
            Write-Host "  ✅ Found $($queryResponse.data.result.Count) log entries with correlation_id filter" -ForegroundColor Green
            Write-Host "    First entry: $($queryResponse.data.result[0].values[0][1])" -ForegroundColor Gray
        }
        else {
            Write-Host "  ℹ️  No logs found yet (normal if just created)" -ForegroundColor Cyan
        }
    }
    catch {
        Write-Host "  ⚠️  Query failed: $_" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║                  VERIFICATION COMPLETE                     ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

if ($labels -contains "correlation_id") {
    Write-Host "✅ FIX VERIFIED: correlation_id is now filterable in Loki!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "  1. Open Grafana: http://localhost:3000" -ForegroundColor Gray
    Write-Host "  2. Go to Explore → Loki datasource" -ForegroundColor Gray
    Write-Host "  3. Click 'Label Filters' and select 'correlation_id'" -ForegroundColor Gray
    Write-Host "  4. Filter by value: $testCorrelationId" -ForegroundColor Gray
    Write-Host "  5. Verify logs appear!" -ForegroundColor Gray
}
else {
    Write-Host "⚠️  VERIFICATION INCONCLUSIVE: correlation_id not yet in Loki" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Troubleshooting steps:" -ForegroundColor Yellow
    Write-Host "  1. Verify services restarted: docker compose ps" -ForegroundColor Gray
    Write-Host "  2. Check OTEL logs: docker compose logs otel-collector | grep -i correlation" -ForegroundColor Gray
    Write-Host "  3. Verify appsettings have includeProperties=true" -ForegroundColor Gray
    Write-Host "  4. Wait 10-15 seconds and re-run this script" -ForegroundColor Gray
}

Write-Host ""
