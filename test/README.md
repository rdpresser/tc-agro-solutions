# Integration Tests Quick Guide

This folder contains cross-service integration tests for the platform.

## Scope

`TC.Agro.Integration.Tests` validates real event-driven flows (no mocks) across:

- Identity -> Farm, Sensor Ingest, Analytics (owner snapshots)
- Farm -> Sensor Ingest, Analytics (sensor snapshots)
- Sensor Ingest -> Analytics (alert generation)

Tests spin up dependencies with Testcontainers (PostgreSQL/TimescaleDB, RabbitMQ, Redis) and run 4 service hosts via `WebApplicationFactory`.

## Run Commands

Run from repository root: `c:\Projects\tc-agro-solutions`.

```bash
# Integration suite only
dotnet test test/TC.Agro.Integration.Tests/TC.Agro.Integration.Tests.csproj -c Release --nologo --verbosity minimal

# Single flow class
dotnet test test/TC.Agro.Integration.Tests/TC.Agro.Integration.Tests.csproj -c Release --filter "FullyQualifiedName~IdentityToCrossServiceOwnerSnapshotsFlowTests"
dotnet test test/TC.Agro.Integration.Tests/TC.Agro.Integration.Tests.csproj -c Release --filter "FullyQualifiedName~FarmToCrossServiceSensorSnapshotsFlowTests"
dotnet test test/TC.Agro.Integration.Tests/TC.Agro.Integration.Tests.csproj -c Release --filter "FullyQualifiedName~SensorIngestToCrossServiceAnalyticsAlertFlowTests"
```

```powershell
# All test projects
$root = "C:\Projects\tc-agro-solutions"
Get-ChildItem -Path $root -Recurse -Filter "*Tests.csproj" |
  Sort-Object FullName |
  ForEach-Object { dotnet test $_.FullName -c Release --nologo --verbosity minimal }

# Clean build (warnings as errors)
Get-ChildItem -Path $root -Recurse -Filter "*Tests.csproj" |
  Sort-Object FullName |
  ForEach-Object { dotnet build $_.FullName -c Release --nologo --no-restore -warnaserror --verbosity minimal }
```

## Troubleshooting

- If tests pass but the runner does not exit, run with detailed console logs:
  `dotnet test test/TC.Agro.Integration.Tests/TC.Agro.Integration.Tests.csproj -c Release --logger "console;verbosity=detailed"`
- Keep `TC.Agro.Integration.Tests.csproj` free of machine-specific `RunSettingsFilePath` values.

Test results are written to `test/TC.Agro.Integration.Tests/TestResults/`.
