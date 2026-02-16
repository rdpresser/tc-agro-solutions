# GitHub Copilot Instructions - TC Agro Solutions

## 📋 Project Context

**Name:** TC Agro Solutions - Phase 5 (Hackathon 8NETT)  
**Objective:** Agricultural monitoring platform with IoT, sensor data processing, alerts, and dashboards on Azure  
**Deadline:** February 27, 2026  
**Team:** 4 backend developers  
**Architecture:** Microservices on Azure Kubernetes Service (AKS)

**Hackathon Requirements:** Producer authentication, property/plot registration with crop type, JWT-protected sensor ingestion API, historical charts, plot status badges from alert rules, simple alert engine (e.g., soil moisture <30% for 24h), dashboard with alerts, evidence of K8s + APM (metrics/traces/logs), CI/CD pipeline with green checks, ≤15 min demo video.

---

## 🛠️ Technology Stack

### Backend

- **Language:** C# / .NET 10
- **Web Framework:** FastEndpoints (do not use traditional Controllers)
- **ORM:** Entity Framework Core 10
- **Messaging:** Wolverine + Azure Service Bus
- **Pattern:** Pragmatic CQRS (no full event sourcing)

### Infrastructure

- **Cloud:** Microsoft Azure
- **Orchestration:** Azure Kubernetes Service (AKS)
- **Database:** Azure PostgreSQL Flexible Server + TimescaleDB (for time series)
- **Cache:** Azure Redis Cache
- **Messaging:** Azure Service Bus
- **Observability:** Application Insights, Log Analytics, Azure Monitor Workbooks
- **IaC:** Terraform (modular structure, single environment)
- **CI/CD:** GitHub Actions + ArgoCD (GitOps)

### Testing

- **Unit Tests:** xUnit
- **Load Tests:** k6
- **Mocking:** NSubstitute or Moq

---

## 🏗️ Microservices Architecture

### Repository Structure

The solution uses independent git repositories for each microservice:

```
tc-agro-solutions/              # Parent repository (this repo)
├── services/                   # Independent service repositories
│   ├── identity-service/
│   ├── farm-service/
│   ├── sensor-ingest-service/
│   ├── analytics-worker/
│   └── dashboard-service/
├── common/                     # Shared libraries repository
├── infrastructure/             # Terraform + Kubernetes
├── scripts/                    # Automation scripts (local to parent)
└── docs/                       # Architecture & ADRs (local to parent)
```

**Key Resources:**

- [Bootstrap Setup Guide](../docs/BOOTSTRAP_SETUP.md) - Quick setup automation
- [NEW_MICROSERVICE_TEMPLATE.md](../NEW_MICROSERVICE_TEMPLATE.md) - Template for new services
- [Local Development Setup](../docs/development/local-setup.md) - Development environment

### System Services

1. **Agro.Identity.Api** - Authentication and authorization (JWT)
2. **Agro.Farm.Api** - Management of properties, plots (with crop_type), and sensors
3. **Agro.Sensor.Ingest.Api** - JWT-protected sensor data ingestion
4. **Agro.Analytics.Worker** - Event processing, rules, and alerts (e.g., soil moisture <30% for 24h)
5. **Agro.Dashboard.Api** - Optimized queries with plot status badges (read-only)

### Inter-Service Communication

- **Synchronous:** HTTP/REST with JWT authentication
- **Asynchronous:** Azure Service Bus (domain events)
- **Pattern:** Each service has its own logical database
- **Repository Pattern:** Each service is an independent Git repository

---

## 📝 C# Coding Conventions

### Project Structure (Per Service Repository)

```
src/
├── Agro.Identity.Api/
│   ├── Endpoints/          # FastEndpoints
│   ├── Features/           # Handlers and Commands/Queries
│   ├── Domain/             # Entities
│   ├── Infrastructure/     # DbContext, Repositories
│   └── Program.cs
```

**Note:** Each microservice lives in its own Git repository. When creating new services, follow [NEW_MICROSERVICE_TEMPLATE.md](../NEW_MICROSERVICE_TEMPLATE.md).

### Naming Conventions

- **Namespaces:** `Agro.{ServiceName}.{Layer}`
- **Classes:** PascalCase
- **Methods:** PascalCase
- **Local variables:** camelCase
- **Constants:** UPPER_CASE or PascalCase
- **Interfaces:** Prefix `I` (e.g., `IUserRepository`)

### FastEndpoints - Endpoint Structure

```csharp
using FastEndpoints;

public class CreatePropertyEndpoint : Endpoint<CreatePropertyRequest, CreatePropertyResponse>
{
    private readonly IPropertyService _propertyService;

    public CreatePropertyEndpoint(IPropertyService propertyService)
    {
        _propertyService = propertyService;
    }

    public override void Configure()
    {
        Post("/properties");
        AllowAnonymous(); // or Roles("Admin")
        Description(b => b
            .Accepts<CreatePropertyRequest>("application/json")
            .Produces<CreatePropertyResponse>(201)
            .ProducesProblemDetails(400));
    }

    public override async Task HandleAsync(CreatePropertyRequest req, CancellationToken ct)
    {
        var result = await _propertyService.CreateAsync(req, ct);

        if (result.IsSuccess)
        {
            await SendCreatedAtAsync<GetPropertyEndpoint>(
                new { id = result.Value.Id },
                result.Value,
                cancellation: ct);
        }
        else
        {
            ThrowError(result.Error);
        }
    }
}
```

### Entity Framework Core - Entities

```csharp
public class Property
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Location { get; set; } = string.Empty;
    public double AreaHectares { get; set; }
    public Guid OwnerId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }

    // Navigation properties
    public ICollection<Plot> Plots { get; set; } = new List<Plot>();
}
```

### DbContext - Configuration

```csharp
public class FarmDbContext : DbContext
{
    public FarmDbContext(DbContextOptions<FarmDbContext> options) : base(options) { }

    public DbSet<Property> Properties => Set<Property>();
    public DbSet<Plot> Plots => Set<Plot>();
    public DbSet<Sensor> Sensors => Set<Sensor>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(FarmDbContext).Assembly);
    }
}
```

### Entity Configuration

```csharp
public class PropertyConfiguration : IEntityTypeConfiguration<Property>
{
    public void Configure(EntityTypeBuilder<Property> builder)
    {
        builder.HasKey(p => p.Id);

        builder.Property(p => p.Name)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(p => p.Location)
            .HasMaxLength(500);

        builder.HasMany(p => p.Plots)
            .WithOne()
            .HasForeignKey(plot => plot.PropertyId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(p => p.OwnerId);
    }
}
```

---

## 🔄 Pragmatic CQRS with Wolverine

### Command (Write)

```csharp
public record CreateSensorReadingCommand(
    string SensorId,
    DateTime Timestamp,
    double Temperature,
    double Humidity,
    double SoilMoisture
);

public class CreateSensorReadingHandler
{
    private readonly SensorDbContext _db;
    private readonly IMessageBus _bus;
    private readonly ILogger<CreateSensorReadingHandler> _logger;

    public CreateSensorReadingHandler(
        SensorDbContext db,
        IMessageBus bus,
        ILogger<CreateSensorReadingHandler> logger)
    {
        _db = db;
        _bus = bus;
        _logger = logger;
    }

    public async Task<Guid> Handle(CreateSensorReadingCommand command, CancellationToken ct)
    {
        var reading = new SensorReading
        {
            Id = Guid.NewGuid(),
            SensorId = command.SensorId,
            Timestamp = command.Timestamp,
            Temperature = command.Temperature,
            Humidity = command.Humidity,
            SoilMoisture = command.SoilMoisture
        };

        await _db.SensorReadings.AddAsync(reading, ct);
        await _db.SaveChangesAsync(ct);

        // Publish event for Analytics Worker
        await _bus.PublishAsync(new SensorReadingReceivedEvent(reading.Id, command.SensorId), ct);

        _logger.LogInformation("Sensor reading {ReadingId} created for sensor {SensorId}",
            reading.Id, command.SensorId);

        return reading.Id;
    }
}
```

### Query (Read)

```csharp
public record GetLatestReadingsQuery(string SensorId, int Limit = 10);

public class GetLatestReadingsHandler
{
    private readonly SensorDbContext _db;
    private readonly IDistributedCache _cache;

    public GetLatestReadingsHandler(SensorDbContext db, IDistributedCache cache)
    {
        _db = db;
        _cache = cache;
    }

    public async Task<List<SensorReadingDto>> Handle(GetLatestReadingsQuery query, CancellationToken ct)
    {
        var cacheKey = $"sensor:latest:{query.SensorId}";
        var cached = await _cache.GetStringAsync(cacheKey, ct);

        if (cached != null)
            return JsonSerializer.Deserialize<List<SensorReadingDto>>(cached)!;

        var readings = await _db.SensorReadings
            .Where(r => r.SensorId == query.SensorId)
            .OrderByDescending(r => r.Timestamp)
            .Take(query.Limit)
            .Select(r => new SensorReadingDto(
                r.Id,
                r.SensorId,
                r.Timestamp,
                r.Temperature,
                r.Humidity,
                r.SoilMoisture
            ))
            .ToListAsync(ct);

        await _cache.SetStringAsync(
            cacheKey,
            JsonSerializer.Serialize(readings),
            new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5) },
            ct
        );

        return readings;
    }
}
```

---

## ⏰ TimescaleDB - Time Series Data

### Hypertable Configuration

```csharp
// In DbContext or Migration
public partial class InitialCreate : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "sensor_readings",
            columns: table => new
            {
                time = table.Column<DateTime>(type: "timestamptz", nullable: false),
                sensor_id = table.Column<string>(type: "text", nullable: false),
                plot_id = table.Column<Guid>(type: "uuid", nullable: false),
                temperature = table.Column<double>(type: "double precision", nullable: true),
                humidity = table.Column<double>(type: "double precision", nullable: true),
                soil_moisture = table.Column<double>(type: "double precision", nullable: true),
                rainfall = table.Column<double>(type: "double precision", nullable: true)
            });

        // Create hypertable (TimescaleDB)
        migrationBuilder.Sql(
            "SELECT create_hypertable('sensor_readings', 'time');"
        );

        // Create indexes for common queries
        migrationBuilder.CreateIndex(
            name: "ix_sensor_readings_sensor_id_time",
            table: "sensor_readings",
            columns: new[] { "sensor_id", "time" }
        );
    }
}
```

### TimescaleDB Aggregation Queries

```csharp
// Query with time_bucket (hourly aggregation)
public async Task<List<HourlyAggregateDto>> GetHourlyAggregates(
    string sensorId,
    int days,
    CancellationToken ct)
{
    var sql = @"
        SELECT
            time_bucket('1 hour', time) AS hour,
            AVG(temperature) AS avg_temperature,
            MAX(temperature) AS max_temperature,
            MIN(temperature) AS min_temperature,
            AVG(humidity) AS avg_humidity
        FROM sensor_readings
        WHERE sensor_id = {0}
          AND time > now() - interval '{1} days'
        GROUP BY hour
        ORDER BY hour DESC
    ";

    return await _db.Database
        .SqlQueryRaw<HourlyAggregateDto>(sql, sensorId, days)
        .ToListAsync(ct);
}
```

---

## 🔍 Observability with Application Insights

### Structured Logging

```csharp
public class SensorIngestService
{
    private readonly ILogger<SensorIngestService> _logger;
    private readonly IActivitySource _activitySource;

    public async Task IngestAsync(SensorReading reading, CancellationToken ct)
    {
        using var activity = _activitySource.StartActivity("Ingest.SensorReading");
        activity?.SetTag("sensor.id", reading.SensorId);
        activity?.SetTag("reading.temperature", reading.Temperature);

        try
        {
            _logger.LogInformation(
                "Ingesting sensor reading {ReadingId} from sensor {SensorId} with temperature {Temperature}°C",
                reading.Id,
                reading.SensorId,
                reading.Temperature
            );

            await ProcessReadingAsync(reading, ct);

            _logger.LogInformation(
                "Successfully ingested sensor reading {ReadingId}",
                reading.Id
            );
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Failed to ingest sensor reading {ReadingId} from sensor {SensorId}",
                reading.Id,
                reading.SensorId
            );

            activity?.SetStatus(ActivityStatusCode.Error, ex.Message);
            throw;
        }
    }
}
```

### Custom Metrics

```csharp
public class MetricsService
{
    private readonly TelemetryClient _telemetry;

    public void TrackIngestLatency(TimeSpan duration, string sensorId)
    {
        _telemetry.TrackMetric(
            "Ingest.Latency",
            duration.TotalMilliseconds,
            new Dictionary<string, string>
            {
                ["SensorId"] = sensorId,
                ["Service"] = "Ingest.Api"
            }
        );
    }

    public void TrackAlertGenerated(string severity, string plotId)
    {
        _telemetry.TrackEvent(
            "Alert.Generated",
            new Dictionary<string, string>
            {
                ["Severity"] = severity,
                ["PlotId"] = plotId
            }
        );
    }
}
```

---

## 🔐 JWT Authentication

### Program.cs Configuration

```csharp
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(builder.Configuration["Jwt:SecretKey"]!)
            )
        };
    });
```

### Token Generation

```csharp
public class JwtTokenService
{
    private readonly IConfiguration _config;

    public string GenerateToken(User user, IEnumerable<string> roles)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Email, user.Email),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        claims.AddRange(roles.Select(role => new Claim(ClaimTypes.Role, role)));

        var key = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(_config["Jwt:SecretKey"]!)
        );
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: _config["Jwt:Issuer"],
            audience: _config["Jwt:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddHours(8),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
```

---

## ✅ Validation with FluentValidation

```csharp
public class CreatePropertyRequestValidator : Validator<CreatePropertyRequest>
{
    public CreatePropertyRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Property name is required")
            .MaximumLength(200).WithMessage("Name must be at most 200 characters");

        RuleFor(x => x.Location)
            .NotEmpty().WithMessage("Location is required")
            .MaximumLength(500);

        RuleFor(x => x.AreaHectares)
            .GreaterThan(0).WithMessage("Area must be greater than zero")
            .LessThanOrEqualTo(1000000).WithMessage("Area exceeds maximum limit");
    }
}
```

---

## 🧪 Testing - Patterns and Examples

### Unit Test - Handler

```csharp
public class CreatePropertyHandlerTests
{
    [Fact]
    public async Task Handle_ValidCommand_CreatesProperty()
    {
        // Arrange
        var options = new DbContextOptionsBuilder<FarmDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        await using var context = new FarmDbContext(options);
        var handler = new CreatePropertyHandler(context);

        var command = new CreatePropertyCommand(
            "Test Farm",
            "São Paulo, SP",
            100.5,
            Guid.NewGuid()
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeEmpty();
        var property = await context.Properties.FindAsync(result);
        property.Should().NotBeNull();
        property!.Name.Should().Be("Test Farm");
    }
}
```

### Integration Test - Endpoint

```csharp
public class PropertiesEndpointTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;

    public PropertiesEndpointTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task CreateProperty_ValidRequest_Returns201()
    {
        // Arrange
        var request = new CreatePropertyRequest
        {
            Name = "New Farm",
            Location = "Minas Gerais",
            AreaHectares = 250.0
        };

        // Act
        var response = await _client.PostAsJsonAsync("/properties", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var property = await response.Content.ReadFromJsonAsync<PropertyResponse>();
        property.Should().NotBeNull();
        property!.Name.Should().Be("New Farm");
    }
}
```

---

## 📦 Dockerization

### Standard Dockerfile

```dockerfile
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
WORKDIR /app
EXPOSE 8080

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY ["Agro.Farm.Api/Agro.Farm.Api.csproj", "Agro.Farm.Api/"]
RUN dotnet restore "Agro.Farm.Api/Agro.Farm.Api.csproj"
COPY . .
WORKDIR "/src/Agro.Farm.Api"
RUN dotnet build "Agro.Farm.Api.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "Agro.Farm.Api.csproj" -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "Agro.Farm.Api.dll"]
```

---

## � Local Development Environment

### Local vs Cloud Strategy

The project supports two distinct environments:

- **Local (Development):** Docker Compose with PostgreSQL, Redis, RabbitMQ (no Terraform, no Azure)
- **Cloud (Production):** Azure via Terraform modules with AKS and managed services

### Bootstrap Setup

**Windows:**

```powershell
# Clone all services and common libraries automatically
.\scripts\bootstrap.ps1
```

### Local Orchestration

- **Primary tool:** Docker Compose (required for all developers)
- **Optional:** .NET Aspire (for individual developer preference only)
- **Why Docker Compose:** Universal, simple, explicit, no vendor lock-in

### Terraform Strategy

- **Single environment:** Terraform provisions Azure resources (production)
- **No multi-environment complexity:** Local = Docker Compose, Azure = Terraform
- **Modular structure:** One module per Azure resource type
- **Clear separation:** Development happens locally, deployment targets Azure

### Local Technology Stack

| Component     | Local                    | Cloud (Azure)                    |
| ------------- | ------------------------ | -------------------------------- |
| Database      | PostgreSQL + TimescaleDB | Azure PostgreSQL Flexible Server |
| Cache         | Redis (Docker)           | Azure Redis Cache                |
| Messaging     | RabbitMQ                 | Azure Service Bus                |
| Orchestration | Docker Compose           | AKS                              |
| Observability | Console logs             | Application Insights             |

### Running Locally

```bash
# Clone solution with all services
.\scripts\bootstrap.ps1
cd tc-agro-solutions

# Start infrastructure
docker compose up -d postgres redis rabbitmq

# Run migrations (per service)
cd services/agro-farm-service
dotnet ef database update --project src/Agro.Farm.Api

# Start services
cd services/agro-identity-service
dotnet run --project src/Agro.Identity.Api

cd ../agro-farm-service
dotnet run --project src/Agro.Farm.Api
# ... other services
```

### Configuration Patterns

- Use `appsettings.Development.json` for local environment
- Use `appsettings.Production.json` for Azure environment
- Connection strings via environment variables or User Secrets

---

## 📝 Documentation and Language Standards

### Documentation Files

- **No automatic .md file creation:** Do not create markdown documentation files unless explicitly requested
- **Suggest before creating:** If a .md file seems valuable, ask the user first or mention it at the end of the interaction
- **Visual summaries in chat:** Provide clear, visual summaries of work completed in the conversation (emoji, formatting, etc.)
- **Use English for all content:** All files created, modified, or generated (code, comments, filenames, folders, .md files, etc.) must use English
  - Exception: Chat responses can be in Portuguese if the user writes in Portuguese
  - Apply this rule to: PowerShell comments, C# code/comments, variable names, file/folder names, and all documentation

---

## 📁 Repository Roots & File Creation Rules

- Treat the solution root as the reference point (no absolute local paths).
- The repository contains multiple independent Git repos under `services/` and `common/`.
- When creating files or classes, always place them relative to the active repository you are working in:
  - If working inside a service repository (under `services/<service-name>/`), create files within that service repository.
  - If working inside `common/`, create files within `common/`.
- Do not place new files under the orchestration project (`orchestration/apphost-compose`) unless explicitly requested.
- When asked to use a reference file, follow its relative path and place new files alongside it unless directed otherwise.

---

## 🎯 Important Rules

### ✅ ALWAYS Do:

- Use **FastEndpoints** for APIs (not MVC Controllers)
- Use **async/await** in all I/O operations
- Implement **structured logging** with Application Insights (cloud) or Console (local)
- Add **validation** with FluentValidation
- Use **DTOs** for requests/responses (do not expose entities)
- Implement **Redis cache** for frequent queries
- Use **CancellationToken** in async methods
- Follow **pragmatic CQRS** (separate Commands and Queries)
- Instrument with **distributed tracing**
- Write **unit tests** for handlers
- Support both local (Docker Compose) and cloud (Azure) configurations

### ❌ NEVER Do:

- Use MVC Controllers (use FastEndpoints)
- Expose domain entities directly in APIs
- Perform blocking synchronous operations (use async)
- Ignore error handling
- Cause N+1 queries (use Include/ThenInclude appropriately)
- Hardcode configurations (use appsettings.json)
- Forget to log important operations
- Return sensitive data (passwords, tokens) in responses
- Use full event sourcing (overengineering for this project)
- Create coupling between microservices (use messaging)

### 📊 TimescaleDB Specific:

- Use **hypertables** for sensor data (time series)
- Aggregation queries: use **time_bucket()** from TimescaleDB
- Indexes: always include **time** column + identifier (sensor_id, plot_id)
- Retention: configure compression and cleanup policies
- Raw SQL queries when necessary to leverage TimescaleDB functions

### 🔐 Security:

- All APIs protected with JWT (except login)
- Validate input on all endpoints
- Never log sensitive data
- Use Azure Key Vault for secrets
- Implement rate limiting
- Validate request origin (CORS)

### 📈 Performance:

- Redis cache for frequent reads (TTL 1-5 min)
- Batch processing for mass ingestion
- Pagination on listings (do not return everything at once)
- Appropriate indexes in the database
- Connection pooling enabled
- Lazy loading disabled in EF Core (use explicit Include)

---

## 🚀 Useful Commands

### Local Development

````bash
# Start all infrastructure services
docker compose up -d

# Start specific service
docker compose up -d postgres

# View logs
docker compose logs -f

# Stop all services
dockTerraform (Azure Production)
```bash
# Initialize Terraform
cd terraform
terraform init

# Plan infrastructure changes
terraform plan

# Apply infrastructure
terraform apply

# Destroy infrastructure (careful!)
terraform destroy

# Validate configuration
terraform validate

# Format code
terraform fmt -recursive
````

### er compose down

# Stop and remove volumes (cleans data)

docker compose down -v

````

### Entity Framework Migrations
```bash
# Add new migration
dotnet ef migrations add <MigrationName> --project src/Agro.Farm.Api

# Apply migrations (local)
dotnet ef database update --project src/Agro.Farm.Api

# Generate SQL script (for production)
dotnet ef migrations script --project src/Agro.Farm.Api --output migration.sql
````

### Docker (for Cloud Deployment)

```bash
# Build
docker build -t agro-farm-api:latest -f src/Agro.Farm.Api/Dockerfile .

# Run local
docker run -p 8080:8080 --env-file .env agro-farm-api:latest
### Technology Stack
- **FastEndpoints:** https://fast-endpoints.com/
- **Wolverine:** https://wolverine.netlify.app/
- **TimescaleDB:** https://docs.timescale.com/
- **EF Core 10:** https://learn.microsoft.com/ef/core/
- **Application Insights:** https://learn.microsoft.com/azure/azure-monitor/app/app-insights-overview

### Project Documentation
- **Local Setup:** [docs/development/local-setup.md](../docs/development/local-setup.md)
- **Architecture Decisions:** [docs/adr/](../docs/adr/)
- **C4 Diagrams:** [docs/architecture/](../docs/architecture/)
- **Terraform Infrastructure:** [docs/architecture/infrastructure-terraform.md](../docs/architecture/infrastructure-terraform.md)
- **Roadmap:** [README_ROADMAP.md](../README_ROADMAP.md)

### Key ADRs
- [ADR-001: Microservices Architecture](../docs/adr/ADR-001-microservices.md)
- [ADR-002: Data Persistence Strategy](../docs/adr/ADR-002-persistence.md)
- [ADR-003: TimescaleDB for Time Series](../docs/adr/ADR-003-timeseries.md)
- [ADR-004: Observability and Dashboards](../docs/adr/ADR-004-observability.md)
- [ADR-005: Local vs Cloud Strategy](../docs/adr/ADR-005-local-vs-cloud.md)
- [ADR-006: Docker Compose vs .NET Aspire](../docs/adr/ADR-006-local-orchestration.md)- [ADR-007: AKS Node Pool Strategy](../docs/adr/ADR-007-node-pool-strategy.md)

---

## 🏗️ Infrastructure as Code (IaC) & AKS Node Pools

### Environment Strategy
- **Local (Development):** Docker Compose (PostgreSQL, Redis, RabbitMQ in containers)
- **Cloud (Production):** Terraform + Azure (AKS, managed services, Application Insights)

### AKS Node Pool Strategy

Three optimized pools by criticality and resource predictability:

| Pool | SKU | Min | Max | Workloads |
|------|-----|-----|-----|-----------|
| **system** | B2ms (8GB) | 1 | 2 | kube-system, CoreDNS, CNI, CSI, Azure agents |
| **platform** | B2s (4GB) | 1 | 3 | ArgoCD, Ingress Controller, cert-manager |
| **worker** | B2s (4GB) | 2 | 5 | .NET APIs, domain workers |

**Key Rationale:** System pool handles unpredictable infrastructure components; platform pool uses moderate resources without in-cluster observability; worker pool applies cost optimization where workloads are bounded (requests/limits defined).

See [ADR-007: AKS Node Pool Strategy](../docs/adr/ADR-007-node-pool-strategy.md) for detailed justification.

### Terraform Module Structure
```

terraform/
├── main.tf # Root orchestration
├── modules/aks/ # AKS with 3 node pools
├── modules/postgres/ # PostgreSQL + TimescaleDB
├── modules/redis/ # Azure Redis
├── modules/servicebus/ # Azure Service Bus
├── modules/observability/ # App Insights + Log Analytics
└── ...other modules

````

### Terraform Deployment

```bash
cd terraform
terraform init
terraform validate && terraform fmt -recursive
terraform plan -out=tfplan
terraform apply tfplan
terraform output -json > outputs.json
````

---

> **Last update:** January 2026  
> **Version:** 1.1

# Apply manifests

kubectl apply -f k8s/

# Check pods

kubectl get pods -n agro

# Logs

kubectl logs -f <pod-name> -n agro

# Port forward for debugging

kubectl port-forward svc/farm-api 8080:80 -n agro

```

---

## �️ Frontend POC (Demo Dashboard)

### Overview
A pure HTML/CSS/JavaScript frontend for demonstrating the dashboard UI without requiring Azure/backend dependencies.

**Location:** `poc/frontend/`
**Documentation:** [poc/frontend/README.md](../poc/frontend/README.md)

### Structure
```

poc/frontend/
├── index.html # Login page (entry point)
├── dashboard.html # Main dashboard with stats & metrics
├── properties.html # Properties list
├── properties-form.html # Property CRUD form
├── plots.html # Plots list
├── plots-form.html # Plot CRUD form
├── sensors.html # Sensor monitoring grid
├── alerts.html # Alert management
├── css/style.css # Agro-themed styles
├── js/
│ ├── utils.js # Common utilities
│ ├── auth.js # Authentication (mock + prepared real)
│ └── api.js # API client with mock data
└── README.md # Integration guide

````

### Key Patterns

#### Token Management (sessionStorage)
```javascript
// Token is stored in sessionStorage (clears on browser close)
sessionStorage.setItem('agro_token', token);
sessionStorage.getItem('agro_token');
sessionStorage.removeItem('agro_token');
````

#### Mock Data Pattern

```javascript
// All API functions return mock data for demo
// Real AJAX calls are commented and ready to uncomment

// MOCK (active):
return Promise.resolve({ properties: 4, plots: 5 });

/* REAL API (uncomment when backend ready):
const response = await fetch(`${API_BASE_URL}/dashboard/stats`, {
  headers: getHeaders()  // Includes Bearer token
});
return handleResponse(response);
*/
```

#### Security Model

```
⚠️ CRITICAL: Frontend security is for UX only!

Frontend → Controls UI navigation (sessionStorage check)
Backend  → MUST validate JWT on EVERY request ([Authorize] attribute)

The frontend CANNOT enforce security. Backend MUST validate all tokens.
```

### Running the POC

```bash
# Option 1: Open directly in browser
# Just open poc/frontend/index.html

# Option 2: Use VS Code Live Server
# Right-click index.html → "Open with Live Server"

# Option 3: Python server
cd poc/frontend && python -m http.server 8000
```

### Design System

- **Primary Color:** #2D5016 (Dark Green)
- **Icons:** Unicode emoji (🌾🏘️📊📡🔔)
- **Responsive:** Mobile-first with breakpoints at 768px/1024px

---

## 📚 References and Documentation

### Technology Stack

- **FastEndpoints:** https://fast-endpoints.com/
- **Wolverine:** https://wolverine.netlify.app/
- **TimescaleDB:** https://docs.timescale.com/
- **EF Core 10:** https://learn.microsoft.com/ef/core/
- **Application Insights:** https://learn.microsoft.com/azure/azure-monitor/app/app-insights-overview

### Project Documentation

- **Frontend POC:** [poc/frontend/README.md](../poc/frontend/README.md) - Dashboard demo guide
- **Requirements Mapping:** [docs/REQUIREMENTS_MAPPING.md](../docs/REQUIREMENTS_MAPPING.md) - Hackathon spec → roadmap traceability
- **Technical Roadmap:** [README_ROADMAP.md](../README_ROADMAP.md) - Complete strategy, phases, deliverables
- **Bootstrap Setup:** [docs/BOOTSTRAP_SETUP.md](../docs/BOOTSTRAP_SETUP.md) - Quick setup guide
- **New Service Template:** [NEW_MICROSERVICE_TEMPLATE.md](../NEW_MICROSERVICE_TEMPLATE.md) - Service creation checklist
- **Local Setup:** [docs/development/local-setup.md](../docs/development/local-setup.md) - Docker Compose environment
- **Architecture Decisions:** [docs/adr/](../docs/adr/) - 7 ADRs (001-007)
- **C4 Diagrams:** [docs/architecture/](../docs/architecture/) - Context + Container
- **Terraform Infrastructure:** [docs/architecture/infrastructure-terraform.md](../docs/architecture/infrastructure-terraform.md) - IaC + delivery evidence

### Key ADRs

- [ADR-001: Microservices Architecture](../docs/adr/ADR-001-microservices.md)
- [ADR-002: Data Persistence Strategy](../docs/adr/ADR-002-persistence.md)
- [ADR-003: TimescaleDB for Time Series](../docs/adr/ADR-003-timeseries.md)
- [ADR-004: Observability and Dashboards](../docs/adr/ADR-004-observability.md)
- [ADR-005: Local vs Cloud Strategy](../docs/adr/ADR-005-local-vs-cloud.md)
- [ADR-006: Docker Compose vs .NET Aspire](../docs/adr/ADR-006-local-orchestration.md)
- [ADR-007: AKS Node Pool Strategy](../docs/adr/ADR-007-node-pool-strategy.md)

---

## 📋 Documentation Maintenance & Review Protocol

### When Making Infrastructure or Script Changes

**✅ CRITICAL: Always perform documentation validation**

After creating, modifying, or deleting files (especially scripts, manifests, or infrastructure-related code):

#### 1. **File Reference Audit**

```bash
# Search for references to newly created/modified/deleted files
grep -r "filename-pattern" docs/ scripts/ infrastructure/

# Check for broken links in all .md files
# Ensure file paths match actual directory structure
```

#### 2. **Structural References to Update**

- [ ] Any `.md` file showing directory structure (check folder layout is current)
- [ ] Any `.md` file listing scripts or manifests (check names match actual files)
- [ ] Any `.md` file showing file paths (verify no deleted files referenced)
- [ ] Any `.md` file with code examples (check paths are correct)

#### 3. **Documentation Files to Always Check**

| File                                             | When to Check           | What to Validate             |
| ------------------------------------------------ | ----------------------- | ---------------------------- |
| **scripts/k3d/README.md**                        | Script renamed/moved    | Script names, usage examples |
| **scripts/k3d/ARCHITECTURE_DIAGRAM.md**          | K8s structure changed   | Folder layout, filenames     |
| **infrastructure/kubernetes/platform/README.md** | Manifests renamed/moved | File references, paths       |
| **infrastructure/kubernetes/apps/README.md**     | App structure changed   | Directory tree accuracy      |
| **docs/architecture/\*.md**                      | Infrastructure changed  | Tech stack section           |
| **docs/development/local-setup.md**              | Local setup changed     | Endpoint URLs, ports         |

#### 4. **Smart Reference Search Pattern**

When deleting a file named `argocd-ingress.yaml`:

```bash
# Search for ALL variations:
grep -r "argocd.ingress\|argocd-ingress\|argocd_ingress" .
grep -r "\.yaml.*ingress" docs/ scripts/
grep -r "Ingress" docs/ --include="*.md"
```

#### 5. **Before Closing Any Session**

After significant infrastructure or script changes, ask these questions:

**🤔 Self-Review Questions:**

1. **What files were created/deleted/renamed?**
   - Created: `arcocd-ingressroute.yaml` (typo - should have been deleted)
   - Deleted: `argocd-ingress.yaml` (obsolete NGINX)
   - Have I updated ALL references?

2. **What documentation needs updating?**
   - Directory structures in READMEs?
   - Architecture diagrams?
   - Script usage examples?
   - File path references?

3. **Are there orphaned references?**
   - Does any `.md` file reference deleted files?
   - Does any script reference old paths?
   - Are there comments/documentation pointing to wrong locations?

4. **Is the documentation dual-perspective (Current vs Future)?**
   - Is it clear what's LOCALHOST (Phase 5 - CURRENT)?
   - Is it clear what's AZURE (Future - REFERENCE)?
   - Or does it mix concerns?

**✅ Validation Checklist:**

- [ ] Ran `grep` search for all old/new file references
- [ ] Updated all `.md` files with accurate paths
- [ ] No broken links in markdown files
- [ ] Script examples match actual filenames
- [ ] Directory structures in diagrams match reality
- [ ] No references to deleted files
- [ ] Current setup (localhost) is clearly marked
- [ ] Future setup (Azure) is clearly marked as "future"

### Suggested Improvements During Complex Changes

When making changes that span multiple systems (e.g., infra + docs + scripts):

**Propose Questions Like:**

- "This change affects k3d bootstrap. Should we create a validation script to verify all references?"
- "The docs reference files in 4 different places. Should we consider a centralized manifest?"
- "This is the 3rd time we've deleted a file and updated 10 references. Should we create a tracking system?"
- "The localhost vs Azure docs are now mixed. Should we separate them more explicitly?"

### Current Phase Context (January 17, 2026)

**🔵 PHASE 5 - LOCALHOST FOCUS (CURRENT):**

- All development happens locally with k3d + Docker Compose
- PostgreSQL, Redis, RabbitMQ run in containers
- Traefik handles ingress (k3s built-in)
- Console logs for observability

**🟣 AZURE PRODUCTION (FUTURE - Reference Only):**

- Terraform code exists for reference
- AKS, managed PostgreSQL, Azure Service Bus documented
- For post-hackathon migration
- Not currently active

**Key Rule:**  
When updating docs, clearly separate these two perspectives. Make it obvious to developers what's CURRENT vs what's PLANNED.

---

> **Last update:** January 17, 2026  
> **Version:** 1.4  
> **Key Addition:** Documentation maintenance protocol + reference audit procedures
>
> Use these instructions to guide code generation in the TC Agro Solutions project.
> Always validate documentation references when making infrastructure changes.
