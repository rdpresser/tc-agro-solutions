#!/usr/bin/env pwsh
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$appHostRoot = Resolve-Path (Join-Path $scriptRoot "..")
$appHostProject = Join-Path $appHostRoot "src/TC.Agro.AppHost.Aspire/TC.Agro.AppHost.Aspire.csproj"

if (-not (Test-Path -LiteralPath $appHostProject)) {
    throw "AppHost project not found at '$appHostProject'."
}

$scenarios = @(
    @{
        Name = "missing-redis"
        Expected = "ConnectionStrings:redis"
        Lines = @(
            "InfraSettings__UseExternalResources=true",
            "ConnectionStrings__rabbitmq=amqp://guest:guest@localhost:5672/%2F",
            "ConnectionStrings__postgres=Host=localhost;Port=5432;Database=postgres;Username=postgres;Password=postgres"
        )
    },
    @{
        Name = "missing-rabbitmq"
        Expected = "ConnectionStrings:rabbitmq"
        Lines = @(
            "InfraSettings__UseExternalResources=true",
            "ConnectionStrings__redis=localhost:6379,password=devuser,ssl=false",
            "ConnectionStrings__postgres=Host=localhost;Port=5432;Database=postgres;Username=postgres;Password=postgres"
        )
    },
    @{
        Name = "missing-postgres"
        Expected = "ConnectionStrings:postgres"
        Lines = @(
            "InfraSettings__UseExternalResources=true",
            "ConnectionStrings__redis=localhost:6379,password=devuser,ssl=false",
            "ConnectionStrings__rabbitmq=amqp://guest:guest@localhost:5672/%2F"
        )
    }
)

Push-Location $appHostRoot
try {
    foreach ($scenario in $scenarios) {
        $tempFile = Join-Path $appHostRoot (".env.smoke." + $scenario.Name)
        Set-Content -LiteralPath $tempFile -Value ($scenario.Lines -join [Environment]::NewLine) -Encoding UTF8

        try {
            $env:ASPIRE_ENV_FILE = $tempFile
            $env:InfraSettings__UseExternalResources = "true"

            $output = & dotnet run --project $appHostProject --no-launch-profile --no-build 2>&1
            $text = ($output | Out-String)

            if ($LASTEXITCODE -eq 0) {
                throw "Scenario '$($scenario.Name)' unexpectedly succeeded."
            }

            if (-not $text.Contains($scenario.Expected, [StringComparison]::Ordinal)) {
                throw "Scenario '$($scenario.Name)' failed without expected message '$($scenario.Expected)'."
            }

            Write-Host "OK: $($scenario.Name) -> '$($scenario.Expected)'"
        }
        finally {
            Remove-Item -LiteralPath $tempFile -Force -ErrorAction SilentlyContinue
        }
    }

    Write-Host "Fail-fast smoke validation completed successfully."
}
finally {
    Pop-Location
}
