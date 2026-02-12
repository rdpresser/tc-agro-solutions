#!/usr/bin/env pwsh
# =====================================================
# Loki API Direct Testing Script (FIXED)
# =====================================================

param(
    [string]$LokiUrl = "http://localhost:3100"
)

Write-Host "`n╔═══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║         Loki API Direct Testing - Correlation ID      ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

# Test 1: Loki Status
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Magenta
Write-Host "TEST 1: Loki Server Status" -ForegroundColor Magenta
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Magenta

try {
    $status = Invoke-RestMethod -Uri "$LokiUrl/loki/api/v1/status/buildinfo" -ErrorAction Stop
    Write-Host "✅ Loki is accessible" -ForegroundColor Green
    Write-Host "   Version: $($status.version)" -ForegroundColor Green
}
catch {
    Write-Host "❌ Loki not accessible: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Test 2: Available Labels
Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Magenta
Write-Host "TEST 2: Available Labels" -ForegroundColor Magenta
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Magenta

try {
    $labels = Invoke-RestMethod -Uri "$LokiUrl/loki/api/v1/labels" -ErrorAction Stop
    Write-Host "✅ Found $($labels.data.Count) labels:" -ForegroundColor Green
    
    $labels.data | Sort-Object | ForEach-Object {
        if ($_ -eq "correlation_id") {
            Write-Host "   🎯 $_" -ForegroundColor Green
        }
        else {
            Write-Host "      $_" -ForegroundColor Gray
        }
    }
    
    if ($labels.data -notcontains "correlation_id") {
        Write-Host "`n⚠️  correlation_id NOT found in labels!" -ForegroundColor Red
    }
}
catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: Correlation ID Values
Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Magenta
Write-Host "TEST 3: Correlation ID Values" -ForegroundColor Magenta
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Magenta

try {
    $corrValues = Invoke-RestMethod -Uri "$LokiUrl/loki/api/v1/label/correlation_id/values" -ErrorAction Stop
    
    if ($corrValues.data.Count -gt 0) {
        Write-Host "✅ Found $($corrValues.data.Count) unique correlation_id values:" -ForegroundColor Green
        
        $corrValues.data | Select-Object -Last 5 | ForEach-Object {
            Write-Host "   • $_" -ForegroundColor Cyan
        }
    }
    else {
        Write-Host "❌ No correlation_id values" -ForegroundColor Red
    }
}
catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 4: Services
Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Magenta
Write-Host "TEST 4: Available Services" -ForegroundColor Magenta
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Magenta

try {
    $services = Invoke-RestMethod -Uri "$LokiUrl/loki/api/v1/label/service_name/values" -ErrorAction Stop
    
    if ($services.data.Count -gt 0) {
        Write-Host "✅ Found $($services.data.Count) services:" -ForegroundColor Green
        $services.data | ForEach-Object {
            Write-Host "   • $_" -ForegroundColor Cyan
        }
    }
    else {
        Write-Host "⚠️  No services found. Generate logs:" -ForegroundColor Yellow
        Write-Host "   curl -H 'X-Correlation-ID: TEST-123' http://localhost:5001/health" -ForegroundColor Yellow
    }
}
catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 5: Recent Logs
Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Magenta
Write-Host "TEST 5: Recent Logs" -ForegroundColor Magenta
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Magenta

try {
    $query = [Uri]::EscapeDataString('{service_name="tc-agro-identity"}')
    $recentLogs = Invoke-RestMethod `
        -Uri "$LokiUrl/loki/api/v1/query?query=$query" `
        -ErrorAction Stop
    
    if ($recentLogs.data.result.Count -gt 0) {
        Write-Host "✅ Found $($recentLogs.data.result.Count) log streams:" -ForegroundColor Green
        
        $recentLogs.data.result | ForEach-Object {
            Write-Host "`n   Stream labels:" -ForegroundColor Gray
            $_.stream.PSObject.Properties | ForEach-Object {
                $labelName = $_.Name
                $color = if (("correlation_id", "trace_id", "span_id") -contains $labelName) { "Green" } else { "Gray" }
                Write-Host "      $($_.Name) = $($_.Value)" -ForegroundColor $color
            }
        }
    }
}
catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n╔═══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║                    SUMMARY                            ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

Write-Host "✅ Check the results above:" -ForegroundColor Yellow
Write-Host "   • If TEST 3 shows correlation_id values → working!" -ForegroundColor Green
Write-Host "   • If TEST 3 is empty → correlation_id not reaching Loki" -ForegroundColor Red
Write-Host "   • If TEST 4 is empty → no logs generated yet" -ForegroundColor Yellow

Write-Host "`n"
