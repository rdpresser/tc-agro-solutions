#!/usr/bin/env pwsh
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

param(
    [string]$EnvFile = "../.env",
    [int]$StartupTimeoutSeconds = 180,
    [int]$HealthTimeoutSeconds = 240,
    [switch]$SkipConnectivityChecks,
    [switch]$SkipBuild
)

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$appHostRoot = (Resolve-Path (Join-Path $scriptRoot "..")).Path
$runScript = Join-Path $scriptRoot "run-apphost.ps1"
$resolvedEnvFile = (Resolve-Path (Join-Path $scriptRoot $EnvFile)).Path

if (-not (Test-Path -LiteralPath $runScript)) {
    throw "run-apphost.ps1 not found at '$runScript'."
}

if (-not (Test-Path -LiteralPath $resolvedEnvFile)) {
    throw "Env file '$resolvedEnvFile' not found."
}

function Get-TcpPort {
    param(
        [Parameter(Mandatory = $true)][string]$Host,
        [Parameter(Mandatory = $true)][int]$Port,
        [int]$TimeoutMs = 3500
    )

    $client = [System.Net.Sockets.TcpClient]::new()
    try {
        $connectTask = $client.ConnectAsync($Host, $Port)
        if (-not $connectTask.Wait($TimeoutMs)) {
            return $false
        }

        return $client.Connected
    }
    catch {
        return $false
    }
    finally {
        $client.Dispose()
    }
}

function Get-EnvMap {
    param([Parameter(Mandatory = $true)][string]$Path)

    $map = @{}
    foreach ($line in Get-Content -LiteralPath $Path) {
        $trimmed = $line.Trim()
        if ([string]::IsNullOrWhiteSpace($trimmed) -or $trimmed.StartsWith("#")) {
            continue
        }

        $separator = $trimmed.IndexOf("=")
        if ($separator -lt 1) {
            continue
        }

        $key = $trimmed.Substring(0, $separator).Trim()
        $value = $trimmed.Substring($separator + 1).Trim()
        $map[$key] = $value
    }

    return $map
}

function Wait-HttpOk {
    param(
        [Parameter(Mandatory = $true)][string]$Url,
        [Parameter(Mandatory = $true)][int]$TimeoutSeconds,
        [int]$PollMilliseconds = 2000
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)

    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -Uri $Url -Method GET -TimeoutSec 5
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) {
                return $true
            }
        }
        catch {
            # Service may still be bootstrapping.
        }

        Start-Sleep -Milliseconds $PollMilliseconds
    }

    return $false
}

$envMap = Get-EnvMap -Path $resolvedEnvFile

$requiredConnectivityChecks = @(
    @{ Name = "Postgres"; HostKey = "Database__Postgres__Host"; PortKey = "Database__Postgres__Port" },
    @{ Name = "Redis"; HostKey = "Cache__Redis__Host"; PortKey = "Cache__Redis__Port" },
    @{ Name = "RabbitMQ"; HostKey = "Messaging__RabbitMQ__Host"; PortKey = "Messaging__RabbitMQ__Port" },
    @{ Name = "OTLP"; HostKey = "Telemetry__Grafana__Agent__Host"; PortKey = "Telemetry__Grafana__Agent__OtlpHttpPort" }
)

if (-not $SkipConnectivityChecks) {
    Write-Host "Running connectivity checks from $resolvedEnvFile..."

    foreach ($check in $requiredConnectivityChecks) {
        if (-not $envMap.ContainsKey($check.HostKey) -or -not $envMap.ContainsKey($check.PortKey)) {
            throw "Connectivity check '$($check.Name)' requires keys '$($check.HostKey)' and '$($check.PortKey)' in env file."
        }

        $host = $envMap[$check.HostKey]
        $port = [int]$envMap[$check.PortKey]

        if (-not (Get-TcpPort -Host $host -Port $port)) {
            throw "Connectivity check failed for $($check.Name): $host:$port"
        }

        Write-Host "Connectivity OK: $($check.Name) ($host:$port)"
    }
}

$logFile = Join-Path $appHostRoot "smoke-external-apphost.log"
if (Test-Path -LiteralPath $logFile) {
    Remove-Item -LiteralPath $logFile -Force
}

$runArgs = @(
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", $runScript,
    "-Mode", "External",
    "-EnvFile", $resolvedEnvFile
)

if ($SkipBuild) {
    $runArgs += "-NoBuild"
}

$process = Start-Process -FilePath "pwsh" -ArgumentList $runArgs -WorkingDirectory $appHostRoot -NoNewWindow -PassThru -RedirectStandardOutput $logFile -RedirectStandardError $logFile

try {
    $startupDeadline = (Get-Date).AddSeconds($StartupTimeoutSeconds)
    while ((Get-Date) -lt $startupDeadline) {
        if (-not $process.HasExited) {
            break
        }

        throw "AppHost terminated before startup. Check $logFile"
    }

    $healthChecks = @(
        "http://localhost:5001/health",
        "http://localhost:5002/health",
        "http://localhost:5003/health",
        "http://localhost:5004/health",
        "http://localhost:5001/ready",
        "http://localhost:5002/ready",
        "http://localhost:5003/ready",
        "http://localhost:5004/ready",
        "http://localhost:5001/metrics",
        "http://localhost:5002/metrics",
        "http://localhost:5003/metrics"
    )

    foreach ($url in $healthChecks) {
        if (-not (Wait-HttpOk -Url $url -TimeoutSeconds $HealthTimeoutSeconds)) {
            throw "Health/metrics check failed: $url"
        }

        Write-Host "OK: $url"
    }

    Write-Host "External smoke test finished successfully."
}
finally {
    if ($process -and -not $process.HasExited) {
        $process.Kill($true)
        $process.WaitForExit()
    }
}
