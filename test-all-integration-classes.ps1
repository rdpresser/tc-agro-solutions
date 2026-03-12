#!/usr/bin/env pwsh

$testClasses = @(
    "FullSystemSagaE2ETests",
    "SensorIngestWolverineOutboxFlowTests",
    "SensorIngestToCrossServiceAnalyticsAlertFlowTests",
    "IdentityToFarmCropTypeMetadataFlowTests",
    "IdentityToCrossServiceOwnerSnapshotsFlowTests",
    "IdentityToFarmCropCyclesFlowTests",
    "IdentityToCrossServiceReSyncUsersFlowTests",
    "FarmToCrossServiceSensorSnapshotsFlowTests",
    "SensorIngestSimulatedReadingsJobFlowTests"
)

$logFile = "test-results/integration-classes-sequential.log"
$results = @()
$totalStart = Get-Date

Write-Host "╔════════════════════════════════════════════════════════════════╗"
Write-Host "║   E2E Integration Tests - Sequential Execution                ║"
Write-Host "╚════════════════════════════════════════════════════════════════╝"
Write-Host ""

foreach ($className in $testClasses) {
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    Write-Host "Running: $className"
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    $classStart = Get-Date
    
    $output = (dotnet test `
            test/TC.Agro.Integration.Tests/TC.Agro.Integration.Tests.csproj `
            --no-build `
            --logger "console;verbosity=minimal" `
            --filter "FullyQualifiedName~$className" `
            2>&1) | Tee-Object -Variable allOutput
    
    $classEnd = Get-Date
    $duration = ($classEnd - $classStart).TotalSeconds
    
    # Parse result
    $passed = $output | Select-String "Aprovado:\s+(?<count>\d+)" | ForEach-Object { "$($_.Matches.Groups['count'].Value)" }
    $failed = $output | Select-String "Com falha:\s+(?<count>\d+)" | ForEach-Object { "$($_.Matches.Groups['count'].Value)" }
    
    $status = if ($LASTEXITCODE -eq 0) { "✅ PASS" } else { "❌ FAIL" }
    
    Write-Host "$status | Duration: ${duration:F1}s | Passed: $passed | Failed: $failed"
    Write-Host ""
    
    $results += [PSCustomObject]@{
        Class    = $className
        Status   = $status
        Duration = $duration
        Passed   = $passed
        Failed   = $failed
    }
}

$totalEnd = Get-Date
$totalDuration = ($totalEnd - $totalStart).TotalSeconds

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════════╗"
Write-Host "║   SUMMARY                                                      ║"
Write-Host "╚════════════════════════════════════════════════════════════════╝"

$results | Format-Table -AutoSize

$totalPassed = ($results | Measure-Object Passed -Sum).Sum
$totalFailed = ($results | Measure-Object Failed -Sum).Sum
$passedClasses = ($results | Where-Object { $_.Status -eq "✅ PASS" } | Measure-Object).Count
$totalClasses = $results.Count

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════════╗"
Write-Host "║   FINAL RESULT                                                 ║"
Write-Host "╚════════════════════════════════════════════════════════════════╝"
Write-Host "Total Classes: $passedClasses/$totalClasses PASSED"
Write-Host "Total Tests: $totalPassed passed, $totalFailed failed"
Write-Host "Total Duration: ${totalDuration:F1}s (~$([Math]::Round($totalDuration/60, 1)) min)"
Write-Host ""

# Save to log
$results | ConvertTo-Json | Out-File $logFile
Write-Host "Results saved to: $logFile"
