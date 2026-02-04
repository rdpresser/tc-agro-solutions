# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TC Agro Solutions is an agricultural IoT monitoring platform (FIAP Tech Challenge Phase 5). The system ingests sensor data, processes analytics, generates alerts, and provides dashboards. Currently runs on localhost k3d with Azure AKS planned post-hackathon.

**Architecture**: 5 independent microservices managed via GitOps (ArgoCD)

## Repository Structure

This is a **parent repository** that orchestrates platform infrastructure. Service repositories are cloned separately into `services/` (git-ignored):

```
tc-agro-solutions/           # Platform orchestration (this repo)
├── services/                # Microservice repos (cloned by bootstrap.ps1)
├── common/                  # Shared libraries (cloned by bootstrap.ps1)
├── infrastructure/kubernetes/
│   ├── platform/            # Observability stack (Prometheus, Grafana, Loki, Tempo, ArgoCD, KEDA)
│   └── apps/                # Microservice deployments
├── scripts/k3d/             # Cluster management (PowerShell)
├── poc/frontend/            # Dashboard UI POC (Vite + ES6)
└── docs/adr/                # Architectural Decision Records
```

## Build & Development Commands

### Initial Setup

```powershell
.\scripts\bootstrap.ps1                    # Clone all services + common, create .env
docker compose up -d postgres redis rabbitmq  # Start local infrastructure
```

### K3D Cluster (Full Stack)

```powershell
cd scripts\k3d
.\bootstrap.ps1              # Create cluster + ArgoCD (~3-4 min)
.\port-forward.ps1 argocd    # Access ArgoCD at http://localhost:8090/argocd/
.\status.ps1                 # Show cluster status
.\cleanup.ps1                # Delete cluster
.\build-push-images.ps1      # Build and push images to Docker Hub (rdpresser)
```

### .NET Services

```bash
cd services/agro-farm-service

# Run service
dotnet run --project src/Agro.Farm.Api

# Run all tests
dotnet test

# Run single test file
dotnet test --filter "FullyQualifiedName~CreatePropertyHandlerTests"

# Run specific test method
dotnet test --filter "FullyQualifiedName~CreatePropertyHandlerTests.Handle_ValidCommand_CreatesProperty"

# EF Migrations
dotnet ef migrations add MigrationName --project src/Agro.Farm.Api
dotnet ef database update --project src/Agro.Farm.Api
```

### Frontend POC

```bash
cd poc/frontend
npm install
npm run dev    # http://localhost:3000
npm run build
```

## Microservices

| Service               | Port       | Project Path                                                                       |
| --------------------- | ---------- | ---------------------------------------------------------------------------------- |
| identity-service      | 5001       | `services/identity-service/src/Agro.Identity.Api`                                  |
| farm-service          | 5002       | `services/farm-service/src/Agro.Farm.Api`                                          |
| sensor-ingest-service | 5003       | `services/sensor-ingest-service/src/Adapters/Inbound/TC.Agro.SensorIngest.Service` |
| analytics-worker      | (internal) | `services/analytics-worker/src/Agro.Analytics.Worker`                              |
| dashboard-service     | 5004       | `services/dashboard-service/src/Agro.Dashboard.Api`                                |

## Critical Coding Standards

### MUST Use

- **FastEndpoints** for all HTTP endpoints (NOT MVC Controllers)
- **Async/await** for all I/O operations with `CancellationToken`
- **FluentValidation** on all endpoints
- **DTOs** for requests/responses (never expose EF entities)
- **Redis caching** with appropriate TTLs
- **Pragmatic CQRS** with Wolverine (separate Commands/Queries)
- **Structured logging** with correlation IDs
- **xUnit** for tests

### NEVER Do

- Use MVC Controllers
- Expose domain entities in APIs
- Block on I/O operations
- Hardcode configuration values
- Log sensitive data
- Create tight coupling between services (use messaging)
- Over-engineer with full event sourcing

### FastEndpoints Pattern

```csharp
public class CreatePropertyEndpoint : Endpoint<CreatePropertyRequest, CreatePropertyResponse>
{
    public override void Configure()
    {
        Post("/properties");
        AllowAnonymous(); // or Roles("Admin")
    }

    public override async Task HandleAsync(CreatePropertyRequest req, CancellationToken ct)
    {
        var result = await _service.CreateAsync(req, ct);
        await SendCreatedAtAsync<GetPropertyEndpoint>(new { id = result.Id }, result, cancellation: ct);
    }
}
```

### CQRS with Wolverine

```csharp
// Command
public record CreateSensorReadingCommand(string SensorId, DateTime Timestamp, double Temperature);

// Handler with IMessageBus for async events
public async Task<Guid> Handle(CreateSensorReadingCommand command, CancellationToken ct)
{
    // ... persist to DB
    await _bus.PublishAsync(new SensorReadingReceivedEvent(reading.Id), ct);
    return reading.Id;
}
```

### TimescaleDB for Sensor Data

- Use **hypertables** for time series data
- Use **time_bucket()** for aggregation queries
- Always index: time column + identifier (sensor_id, plot_id)

### Project Structure per Service

```
src/
├── Adapters/
│   ├── Inbound/TC.Agro.{ServiceName}.Service/
│   └── Outbound/TC.Agro.{ServiceName}.Infrastructure/
├── Core/
│   ├── TC.Agro.{ServiceName}.Application/
│   └── TC.Agro.{ServiceName}.Domain/
```

## Technology Stack

| Component     | Technology                                      |
| ------------- | ----------------------------------------------- |
| Backend       | C# .NET 10, FastEndpoints                       |
| ORM           | Entity Framework Core 10                        |
| Database      | PostgreSQL + TimescaleDB                        |
| Messaging     | RabbitMQ (local) / Azure Service Bus (cloud)    |
| Cache         | Redis                                           |
| Orchestration | k3d (local) / Azure AKS (cloud)                 |
| GitOps        | ArgoCD                                          |
| Observability | Prometheus, Grafana, Loki, Tempo, OpenTelemetry |

## Git Conventions

- **Branches**: `feature/`, `bugfix/`, `hotfix/`
- **Commits**: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`
- Services are independent repos; platform/infrastructure changes go in this parent repo

## ArgoCD Access

After running k3d bootstrap:

- URL: http://localhost:8090/argocd/
- Credentials: admin / Argo@123!

## Key Documentation

- **docs/adr/** - 7 Architectural Decision Records
- **docs/development/local-setup.md** - Detailed local dev guide
- **.github/copilot-instructions.md** - Comprehensive coding standards (1200+ lines with examples)
- **scripts/k3d/README.md** - K3D cluster management and GitOps workflow
