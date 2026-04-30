#!/usr/bin/env pwsh
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

param(
    [ValidateSet("External", "Internal")]
    [string]$Mode = "External",

    [string]$EnvFile,

    [switch]$NoBuild
)

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$appHostRoot = Resolve-Path (Join-Path $scriptRoot "..")
$appHostProject = Join-Path $appHostRoot "src/TC.Agro.AppHost.Aspire/TC.Agro.AppHost.Aspire.csproj"

if (-not (Test-Path -LiteralPath $appHostProject)) {
    throw "AppHost project not found at '$appHostProject'."
}

if ([string]::IsNullOrWhiteSpace($EnvFile)) {
    $EnvFile = Join-Path $appHostRoot ".env"
}

if (-not (Test-Path -LiteralPath $EnvFile)) {
    throw "Environment file '$EnvFile' was not found."
}

$resolvedEnvFile = (Resolve-Path -LiteralPath $EnvFile).Path
$useExternalResources = if ($Mode -eq "External") { "true" } else { "false" }

$env:ASPIRE_ENV_FILE = $resolvedEnvFile
$env:InfraSettings__UseExternalResources = $useExternalResources

Write-Host "Running AppHost in $Mode mode"
Write-Host "Using env file: $resolvedEnvFile"

$arguments = @(
    "run",
    "--project",
    $appHostProject,
    "--no-launch-profile"
)

if ($NoBuild) {
    $arguments += "--no-build"
}

Push-Location $appHostRoot
try {
    & dotnet @arguments
}
finally {
    Pop-Location
}
