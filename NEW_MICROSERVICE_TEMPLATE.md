# 📋 Template - New Microservice Setup

**Purpose:** Checklist for adding a new microservice to TC Agro Solutions  
**Time:** ~30 minutes setup + development time

---

## Step 1: Create Service Repository on GitHub

```
Repository Name: agro-{service-name}-service
Description: {Service description} microservice for TC Agro Solutions
Visibility: Private (or Public)
Initialize with: README ✓
```

Example names:

- `agro-identity-service`
- `agro-farm-service`
- `agro-notification-service`
- `agro-reporting-service`

---

## Step 2: Clone Template Repository

```bash
# Clone this service repo locally
git clone git@github.com:your-org/agro-{service-name}-service.git
cd agro-{service-name}-service
```

---

## Step 3: Project Structure

Create this folder structure:

```
agro-{service-name}-service/
├── src/
│   ├── Agro.{ServiceName}.Api/
│   │   ├── Endpoints/
│   │   ├── Features/
│   │   │   ├── {Feature}/
│   │   │   │   ├── Handler.cs
│   │   │   │   └── Request.cs
│   │   ├── Domain/
│   │   ├── Infrastructure/
│   │   ├── Program.cs
│   │   ├── appsettings.json
│   │   └── Dockerfile
│   ├── Agro.{ServiceName}.Domain/
│   │   ├── Entities/
│   │   └── ValueObjects/
│   └── Agro.{ServiceName}.Tests/
│       ├── Unit/
│       └── Integration/
├── .github/workflows/
│   ├── build-and-test.yml
│   └── push-to-acr.yml
├── README.md
├── .gitignore
├── Dockerfile
└── agro-{service-name}-service.sln
```

---

## Step 4: .NET Project Setup

### Create Solution

```bash
dotnet new sln -n Agro.{ServiceName}
```

### Create Projects

```bash
# API project (FastEndpoints)
dotnet new webapi -n Agro.{ServiceName}.Api -o src/Agro.{ServiceName}.Api
cd src/Agro.{ServiceName}.Api

# Add FastEndpoints NuGet
dotnet add package FastEndpoints
dotnet add package FastEndpoints.Swagger
dotnet add package Microsoft.EntityFrameworkCore.PostgreSQL
dotnet add package StackExchange.Redis

cd ../..

# Domain project (entities, value objects)
dotnet new classlib -n Agro.{ServiceName}.Domain -o src/Agro.{ServiceName}.Domain

# Tests project
dotnet new xunit -n Agro.{ServiceName}.Tests -o src/Agro.{ServiceName}.Tests
dotnet add src/Agro.{ServiceName}.Tests/Agro.{ServiceName}.Tests.csproj reference src/Agro.{ServiceName}.Api/Agro.{ServiceName}.Api.csproj
dotnet add src/Agro.{ServiceName}.Tests package NSubstitute
dotnet add src/Agro.{ServiceName}.Tests package xunit
dotnet add src/Agro.{ServiceName}.Tests package xunit.runner.visualstudio

# Add projects to solution
dotnet sln add src/Agro.{ServiceName}.Api/Agro.{ServiceName}.Api.csproj
dotnet sln add src/Agro.{ServiceName}.Domain/Agro.{ServiceName}.Domain.csproj
dotnet sln add src/Agro.{ServiceName}.Tests/Agro.{ServiceName}.Tests.csproj
```

---

## Step 5: FastEndpoints Setup

### Program.cs Template

```csharp
using FastEndpoints;

var builder = WebApplication.CreateBuilder(args);

// Add services
builder.Services
    .AddFastEndpoints()
    .AddSwaggerDoc();

builder.Services.AddCors(options => options
    .AddPolicy("default", policy =>
    {
        policy.WithOrigins("*")
            .AllowAnyHeader()
            .AllowAnyMethod();
    }));

// Add database (if needed)
// builder.Services.AddDbContext<ServiceDbContext>(options =>
//     options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// Add caching
// builder.Services.AddStackExchangeRedisCache(options =>
//     options.Configuration = builder.Configuration.GetConnectionString("Redis"));

var app = builder.Build();

app.UseCors("default");

if (app.Environment.IsDevelopment())
{
    app.UseSwaggerGen();
}

app.UseHttpsRedirection();

app.UseFastEndpoints()
    .UseSwaggerUI(config =>
    {
        config.SwaggerEndpoint("/swagger/v1/swagger.json",
            "Agro.{ServiceName}.Api v1");
    });

app.MapGet("/health", () => Results.Ok(new { status = "healthy" }))
    .WithName("Health")
    .WithOpenApi()
    .AllowAnonymous();

app.Run();
```

---

## Step 6: Sample Endpoint

### Feature Example: Get Health

**File:** `src/Agro.{ServiceName}.Api/Endpoints/GetHealthEndpoint.cs`

```csharp
using FastEndpoints;

namespace Agro.{ServiceName}.Api.Endpoints;

public class GetHealthResponse
{
    public string Status { get; set; } = "healthy";
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    public string Service { get; set; } = "Agro.{ServiceName}.Api";
}

public class GetHealthEndpoint : EndpointWithoutRequest<GetHealthResponse>
{
    public override void Configure()
    {
        Get("/health");
        AllowAnonymous();
        WithName("Health");
        WithOpenApi();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var response = new GetHealthResponse
        {
            Status = "healthy",
            Timestamp = DateTime.UtcNow
        };

        await SendOkAsync(response);
    }
}
```

---

## Step 7: Docker Setup

### Dockerfile

```dockerfile
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
WORKDIR /app
EXPOSE 8080

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY ["src/Agro.{ServiceName}.Api/Agro.{ServiceName}.Api.csproj", "src/Agro.{ServiceName}.Api/"]
COPY ["src/Agro.{ServiceName}.Domain/Agro.{ServiceName}.Domain.csproj", "src/Agro.{ServiceName}.Domain/"]

RUN dotnet restore "src/Agro.{ServiceName}.Api/Agro.{ServiceName}.Api.csproj"

COPY . .
WORKDIR "/src/src/Agro.{ServiceName}.Api"
RUN dotnet build "Agro.{ServiceName}.Api.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "Agro.{ServiceName}.Api.csproj" -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "Agro.{ServiceName}.Api.dll"]
```

---

## Step 8: GitHub Actions CI/CD

### .github/workflows/build-and-test.yml

```yaml
name: Build and Test

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup .NET
        uses: actions/setup-dotnet@v3
        with:
          dotnet-version: "9.0.x"

      - name: Restore dependencies
        run: dotnet restore

      - name: Build
        run: dotnet build --no-restore --configuration Release

      - name: Run tests
        run: dotnet test --no-build --verbosity normal
```

### .github/workflows/push-to-acr.yml

```yaml
name: Push to ACR

on:
  push:
    branches: [main]

jobs:
  push:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Build image
        run: docker build -t agro-{service-name}-service:${{ github.sha }} .

      - name: Push to ACR
        run: |
          docker tag agro-{service-name}-service:${{ github.sha }} \
            ${{ secrets.ACR_NAME }}.azurecr.io/agro-{service-name}-service:latest

          az acr login --name ${{ secrets.ACR_NAME }}
          docker push ${{ secrets.ACR_NAME }}.azurecr.io/agro-{service-name}-service:latest
```

---

## Step 9: README.md Template

```markdown
# Agro.{ServiceName} API

{Service description and responsibility}

## Quick Start

### Build

\`\`\`bash
dotnet build
\`\`\`

### Run Locally

\`\`\`bash
dotnet run --project src/Agro.{ServiceName}.Api
\`\`\`

API will be available at: http://localhost:5000

### Run Tests

\`\`\`bash
dotnet test
\`\`\`

### Docker

\`\`\`bash
docker build -t agro-{service-name}-service:latest .
docker run -p 8080:80 agro-{service-name}-service:latest
\`\`\`

## Endpoints

### GET /health

Service health check.

**Response:** 200 OK
\`\`\`json
{
"status": "healthy",
"timestamp": "2026-01-09T10:30:00Z",
"service": "Agro.{ServiceName}.Api"
}
\`\`\`

## Architecture

- **FastEndpoints:** HTTP API framework
- **EF Core:** Data persistence
- **PostgreSQL:** Primary database
- **Redis:** Caching layer

## Development

1. Install .NET 10 SDK
2. Clone repository
3. Run \`dotnet restore\`
4. Run \`dotnet run --project src/Agro.{ServiceName}.Api\`
5. Visit http://localhost:5000/swagger for API docs

## Documentation

- [Architecture Decisions](../../docs/adr/)
- [Local Setup](../../docs/development/local-setup.md)
- [FastEndpoints](https://fast-endpoints.com/)
```

---

## Step 10: Register Service in Parent

The service repository is now independent. Parent repository developers will:

1. Clone the parent: `.\scripts\bootstrap.ps1`
2. Clone the new service separately: `git clone git@github.com:your-org/agro-{service-name}-service.git services/agro-{service-name}-service`
3. Service will be automatically integrated via ArgoCD GitOps

---

## Step 11: Create Kubernetes Manifest

**File:** `infrastructure/kubernetes/services/{service-name}-deployment.yaml`

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {service-name}-api
  namespace: agro
spec:
  replicas: 2
  selector:
    matchLabels:
      app: {service-name}-api
  template:
    metadata:
      labels:
        app: {service-name}-api
    spec:
      nodeSelector:
        workload: application
      containers:
      - name: {service-name}-api
        image: acrname.azurecr.io/agro-{service-name}-service:latest
        ports:
        - containerPort: 80
        env:
        - name: ASPNETCORE_ENVIRONMENT
          value: Production
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 80
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 80
          initialDelaySeconds: 10
          periodSeconds: 5

---
apiVersion: v1
kind: Service
metadata:
  name: {service-name}-api-svc
  namespace: agro
spec:
  selector:
    app: {service-name}-api
  ports:
  - protocol: TCP
    port: 80
    targetPort: 80
  type: ClusterIP
```

---

## Step 12: Update docker-compose.yml (Parent Repo)

Add to `docker-compose.yml` in parent:

```yaml
{service-name}-api:
  build: ./services/agro-{service-name}-service
  ports:
    - "500X:80"  # Replace X with unique port
  environment:
    ASPNETCORE_ENVIRONMENT: Development
    # Database name should come from appsettings.* per service
  depends_on:
    - postgres
```

---

## Step 13: Testing Locally

```bash
# From parent repository
docker-compose build {service-name}-api
docker-compose up -d {service-name}-api

# Test
curl http://localhost:500X/health

# View logs
docker-compose logs -f {service-name}-api

# Stop
docker-compose down
```

---

## ✅ Checklist

- [ ] GitHub repository created
- [ ] Repository cloned locally
- [ ] .NET solution created with API, Domain, Tests projects
- [ ] FastEndpoints configured in Program.cs
- [ ] Sample health endpoint created
- [ ] Dockerfile created and tested
- [ ] GitHub Actions workflows added
- [ ] README.md written
- [ ] Kubernetes manifest created
- [ ] docker-compose.yml entry added
- [ ] Local testing successful
- [ ] Ready for development

---

## 🚀 Next Steps

1. Start implementing features in `/src/Agro.{ServiceName}.Api/Endpoints/`
2. Add entity models in `/src/Agro.{ServiceName}.Domain/Entities/`
3. Implement infrastructure in `/src/Agro.{ServiceName}.Api/Infrastructure/`
4. Write tests in `/src/Agro.{ServiceName}.Tests/`
5. Push to GitHub when ready
6. CI/CD will automatically build and test

---

> **Service Template Version:** 1.0  
> **Last Updated:** January 9, 2026  
> **Aligned with:** Copilot Instructions & Architecture Standards
