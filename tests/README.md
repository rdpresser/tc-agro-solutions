# TC Agro Solutions - Tests Directory

This directory contains all automated tests for the TC Agro Solutions platform.

## Test Projects

### Integration Tests

**Location:** `TC.Agro.IntegrationTests/`

Automated integration tests that validate microservice endpoints and cross-service workflows.

- **21 tests** covering Identity, Farm, and workflow scenarios
- Uses xUnit + FluentAssertions
- Targets running services (Docker Compose or k3d)
- See [Integration Tests README](TC.Agro.IntegrationTests/README.md) for details

**Quick Start:**

```bash
# Start services
cd ../orchestration/apphost-compose
docker compose up -d

# Run all integration tests
cd ../../tests/TC.Agro.IntegrationTests
dotnet test
```

## Test Categories

| Category | Description | Location |
|----------|-------------|----------|
| **Integration Tests** | API endpoint validation, cross-service workflows | `TC.Agro.IntegrationTests/` |
| **Manual API Tests** | Bruno collections for manual testing | `../api-tests/` |
| **Load Tests** | k6 performance tests (future) | _(planned)_ |

## Running Tests

### All Integration Tests

```bash
cd TC.Agro.IntegrationTests
dotnet test
```

### Filtered Tests

```bash
# Run only Identity Service tests
dotnet test --filter "FullyQualifiedName~IdentityServiceTests"

# Run only Farm Service tests  
dotnet test --filter "FullyQualifiedName~FarmServiceTests"

# Run only workflow tests
dotnet test --filter "FullyQualifiedName~WorkflowTests"
```

### With Verbose Output

```bash
dotnet test --logger "console;verbosity=detailed"
```

## CI/CD Integration

Integration tests run automatically in GitHub Actions:

- **Workflow:** `.github/workflows/integration-tests.yml`
- **Triggers:** Push to main, PRs, manual dispatch
- **Infrastructure:** Docker Compose (PostgreSQL, Redis, RabbitMQ)
- **Results:** Published as GitHub Actions test results

## Service Test Coverage

### ✅ Identity Service
- Health checks
- User registration (valid/invalid)
- Login with credentials
- Duplicate email handling
- Password validation

### ✅ Farm Service
- Health checks
- Property CRUD operations
- Plot management
- List filtering
- Error handling

### ✅ Cross-Service Workflows
- Complete producer workflow
- Multi-service health checks
- Property & plot creation flow
- Endpoint availability validation

## Test Infrastructure

### Base Classes

- **IntegrationTestBase**: Base test class with HTTP client helpers
- **ServiceEndpoints**: Centralized service URL configuration
- **TestDataFactory**: Realistic test data generation

### Configuration

Service endpoints configured via environment variables:

```bash
export IDENTITY_SERVICE_URL="http://localhost:5001"
export FARM_SERVICE_URL="http://localhost:5002"
export SENSOR_INGEST_SERVICE_URL="http://localhost:5003"
export DASHBOARD_SERVICE_URL="http://localhost:5004"
```

## Future Test Additions

### Planned
- [ ] Sensor Ingest Service integration tests
- [ ] Dashboard Service integration tests
- [ ] Load/performance tests with k6
- [ ] Contract tests
- [ ] End-to-end UI tests (Playwright/Selenium)

## Contributing

When adding new tests:

1. Follow existing patterns in `IntegrationTestBase`
2. Use `TestDataFactory` for generating test data
3. Add tests to appropriate category folder
4. Update documentation
5. Ensure tests pass in CI

## Related Documentation

- [Developer Quick Reference](../DEVELOPER_QUICK_REFERENCE.md)
- [Docker Compose Setup](../orchestration/apphost-compose/README.md)
- [K3D Setup](../scripts/k3d/README.md)
- [Integration Tests Detail](TC.Agro.IntegrationTests/README.md)
