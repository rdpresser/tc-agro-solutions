# TC Agro Solutions - Integration Tests

This directory contains integration tests for the TC Agro Solutions microservices platform.

## Overview

These integration tests validate:
- Individual service endpoints (Identity, Farm, Sensor Ingest, Dashboard)
- Cross-service workflows
- End-to-end user scenarios
- API contracts and behavior

## Test Structure

```
TC.Agro.IntegrationTests/
├── Infrastructure/              # Test base classes and utilities
│   ├── IntegrationTestBase.cs   # Base test class with HTTP helpers
│   ├── ServiceEndpoints.cs      # Centralized endpoint configuration
│   └── TestDataFactory.cs       # Test data generation utilities
├── Services/                    # Service-specific integration tests
│   ├── IdentityServiceTests.cs  # Authentication & user management tests
│   └── FarmServiceTests.cs      # Property & plot management tests
└── Workflows/                   # End-to-end workflow tests
    └── EndToEndWorkflowTests.cs # Cross-service scenario tests
```

## Prerequisites

### Services Must Be Running

Integration tests require the services to be running. Choose one option:

#### Option 1: Docker Compose (Recommended for Local Development)

```powershell
# From repository root
cd orchestration/apphost-compose
docker compose up -d

# Wait for services to be ready (~30 seconds)
# Check status
docker compose ps
```

#### Option 2: K3D Cluster (Full Kubernetes Stack)

```powershell
# From repository root
cd scripts/k3d
.\bootstrap.ps1

# Set up port forwarding for services
.\port-forward.ps1 identity
.\port-forward.ps1 farm
.\port-forward.ps1 ingest
.\port-forward.ps1 dashboard
```

## Running Tests

### Run All Tests

```bash
cd tests/TC.Agro.IntegrationTests
dotnet test
```

### Run Specific Test Class

```bash
# Run only Identity Service tests
dotnet test --filter "FullyQualifiedName~IdentityServiceTests"

# Run only Farm Service tests
dotnet test --filter "FullyQualifiedName~FarmServiceTests"

# Run only workflow tests
dotnet test --filter "FullyQualifiedName~EndToEndWorkflowTests"
```

### Run Single Test Method

```bash
dotnet test --filter "FullyQualifiedName~IdentityServiceTests.Login_WithValidCredentials_ShouldReturnToken"
```

### Run with Detailed Output

```bash
dotnet test --logger "console;verbosity=detailed"
```

## Configuration

### Environment Variables

Tests use environment variables to configure service endpoints. Defaults are set for Docker Compose setup.

| Variable | Default | Description |
|----------|---------|-------------|
| `IDENTITY_SERVICE_URL` | `http://localhost:5001` | Identity Service endpoint |
| `FARM_SERVICE_URL` | `http://localhost:5002` | Farm Service endpoint |
| `SENSOR_INGEST_SERVICE_URL` | `http://localhost:5003` | Sensor Ingest Service endpoint |
| `DASHBOARD_SERVICE_URL` | `http://localhost:5004` | Dashboard Service endpoint |
| `K3D_BASE_URL` | `http://localhost` | K3D cluster base URL (with ingress) |

### Custom Configuration Example

```powershell
# Windows PowerShell
$env:IDENTITY_SERVICE_URL="http://localhost:8001"
$env:FARM_SERVICE_URL="http://localhost:8002"
dotnet test
```

```bash
# Linux/Mac
export IDENTITY_SERVICE_URL="http://localhost:8001"
export FARM_SERVICE_URL="http://localhost:8002"
dotnet test
```

## Test Categories

### Service Tests

Individual service endpoint tests:
- **IdentityServiceTests**: User registration, login, token management
- **FarmServiceTests**: Property and plot CRUD operations

### Workflow Tests

End-to-end scenarios across multiple services:
- **EndToEndWorkflowTests**: Complete producer workflows, health checks

## Writing New Tests

### Example Test Structure

```csharp
using TC.Agro.IntegrationTests.Infrastructure;
using FluentAssertions;

public class MyServiceTests : IntegrationTestBase
{
    public MyServiceTests()
    {
        ConfigureServiceUrl(ServiceEndpoints.FarmServiceUrl);
    }

    [Fact]
    public async Task MyEndpoint_WithValidData_ShouldSucceed()
    {
        // Arrange
        var request = new { /* test data */ };

        // Act
        var response = await PostAsync("/api/endpoint", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }
}
```

### Best Practices

1. **Use Test Data Factory**: Generate unique test data using `TestDataFactory` helpers
2. **Clean Up**: Tests should be independent and not rely on shared state
3. **Realistic Scenarios**: Test real user workflows, not just happy paths
4. **Flexible Assertions**: Use `Should().BeOneOf()` for status codes that may vary
5. **Clear Naming**: Use descriptive test method names (Given_When_Then pattern)

## Continuous Integration

These tests are designed to run in CI/CD pipelines. See `.github/workflows/integration-tests.yml` for the GitHub Actions workflow configuration.

## Troubleshooting

### Tests Fail With Connection Errors

**Problem**: `HttpRequestException: Connection refused`

**Solution**: Ensure services are running
```powershell
cd orchestration/apphost-compose
docker compose up -d
docker compose ps  # Verify all services are "Up"
```

### Tests Fail With 404 Not Found

**Problem**: Endpoint URLs don't match actual API routes

**Solution**: Check service Swagger documentation
- Identity: http://localhost:5001/swagger
- Farm: http://localhost:5002/swagger
- Ingest: http://localhost:5003/swagger
- Dashboard: http://localhost:5004/swagger

### Tests Are Flaky

**Problem**: Tests pass sometimes and fail other times

**Solution**: 
- Ensure services are fully initialized before running tests
- Check for shared test data causing conflicts
- Use unique identifiers in test data (GUIDs, timestamps)

## Contributing

When adding new integration tests:
1. Follow existing patterns in `Infrastructure/IntegrationTestBase.cs`
2. Use `TestDataFactory` for generating test data
3. Add tests to appropriate category (Services/ or Workflows/)
4. Update this README with new test information
5. Ensure tests run successfully in CI

## Related Documentation

- [Development Quick Reference](../../DEVELOPER_QUICK_REFERENCE.md)
- [Docker Compose Setup](../../orchestration/apphost-compose/README.md)
- [K3D Setup](../../scripts/k3d/README.md)
- [API Tests (Bruno)](../../api-tests/README.md)
