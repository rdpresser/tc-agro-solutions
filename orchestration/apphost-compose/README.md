# TC Agro Solutions - Local Development Environment

Complete Docker Compose orchestration for local development with full observability stack.

## ?? Quick Start

### Prerequisites

- Docker Desktop 4.x+
- Docker Compose V2
- .NET 10 SDK
- Visual Studio 2022 or VS Code

### Start the Environment

```bash
# Navigate to orchestration directory
cd orchestration/apphost-compose

# Start all services (automatically loads override for development)
docker compose up -d

# View logs
docker compose logs -f

# Stop all services
docker compose down

# Stop and remove volumes (clean slate)
docker compose down -v
```

## ?? Access Points

### Infrastructure

- **PostgreSQL**: `localhost:5432` (postgres/postgres)
- **pgAdmin**: http://localhost:15432 (admin@tcagro.local/admin)
- **Redis**: `localhost:6379`
- **RabbitMQ Management**: http://localhost:15672 (guest/guest)

### Services

- **Identity Service**: http://localhost:5001
  - Health: http://localhost:5001/health
  - Swagger: http://localhost:5001/swagger
- **Identity Service Debug**: `localhost:15001` (Visual Studio debugger)

### Observability

- **Grafana**: http://localhost:3000 (admin/admin)
- **Prometheus**: http://localhost:9090
- **Loki**: http://localhost:3100
- **Tempo**: http://localhost:3200

## ??? Architecture

```
???????????????????????????????????????????????????????
?  TC Agro Solutions - Local Stack                    ?
???????????????????????????????????????????????????????
?                                                     ?
?  Services:                                          ?
?  ?? Identity Service (5001) ?                      ?
?  ?? Farm Service (5002) ?? Placeholder             ?
?  ?? Sensor Ingest Service (5003) ?? Placeholder    ?
?  ?? Analytics Worker ?? Placeholder                 ?
?  ?? Dashboard Service (5005) ?? Placeholder        ?
?                                                     ?
?  Infrastructure:                                    ?
?  ?? PostgreSQL + TimescaleDB                       ?
?  ?? Redis                                           ?
?  ?? RabbitMQ                                        ?
?  ?? pgAdmin                                         ?
?                                                     ?
?  Observability:                                     ?
?  ?? Grafana (Dashboards)                           ?
?  ?? Prometheus (Metrics)                           ?
?  ?? Loki (Logs)                                    ?
?  ?? Tempo (Traces)                                 ?
?  ?? OpenTelemetry Collector                        ?
???????????????????????????????????????????????????????
```

## ?? Configuration

Environment variables are loaded from:

- `orchestration/apphost-compose/.env` (shared defaults)

Service-specific values are set per service in docker-compose.yml.

Key configurations:

- Database credentials
- Redis settings
- RabbitMQ credentials
- JWT secret keys
- Service ports
- Observability ports

## ?? Docker Compose Files

### `docker-compose.yml` (Base Configuration)

Production-ready configuration with all services.

### `docker-compose.override.yml` (Development Overrides)

Development-specific enhancements automatically applied locally:

- ? Debug logging (verbose output)
- ? Hot-reload for code changes (when volumes enabled)
- ? Debug ports for Visual Studio (15001, 15002, etc.)
- ? NuGet package caching for faster builds
- ? Faster container restart on failures

**Note:** The override file is ONLY loaded in local development.
When deploying to k3d or production, only the base `docker-compose.yml` is used.

## ?? Debugging

### Debug Identity Service in Visual Studio

#### Option 1: Docker Compose Debug (Recommended)

1. **Set Docker Compose as Startup Project**
   - Right-click `docker-compose.dcproj` ? **Set as StartUp Project**
2. **Enable code volume (hot-reload)**
   - Uncomment this line in `docker-compose.override.yml`:
   ```yaml
   - ../../services/identity-service/src:/app/src:ro
   ```
3. **Press F5** to start debugging
4. **Breakpoints work normally** in the Identity Service code

#### Option 2: Attach to Running Container

```bash
# Start containers
docker compose up -d

# In Visual Studio: Debug ? Attach to Process ? Docker
# Select tc-agro-identity-service container
```

#### Option 3: Remote Debugging

Enable debugger port in your Dockerfile and connect from VS to `localhost:15001`

## ?? Adding New Services

Uncomment placeholder services in both files:

**`docker-compose.yml`:**

```yaml
# Farm Service - Property & Plot Management
tc-agro-farm-service:
  # ...production config
```

**`docker-compose.override.yml`:**

```yaml
# Farm Service - Development Mode
tc-agro-farm-service:
  build:
    args:
      BUILD_CONFIGURATION: Debug
  environment:
    - Serilog__MinimumLevel__Default=Debug
  volumes:
    - farm_nuget_cache:/root/.nuget/packages
```

Then run:

```bash
docker compose up -d tc-agro-farm-service
```

## ?? Monitoring & Troubleshooting

### View Service Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f tc-agro-identity-service

# Infrastructure only
docker compose logs -f postgres redis rabbitmq

# Observability only
docker compose logs -f grafana prometheus loki tempo
```

### Health Checks

```bash
# Check all container statuses
docker compose ps

# Restart unhealthy service
docker compose restart <service-name>

# View detailed container info
docker compose inspect <service-name>
```

### Database Access

```bash
# Direct PostgreSQL access
docker compose exec postgres psql -U postgres -d agro

# View tables
\dt

# Check TimescaleDB extension
SELECT * FROM pg_extension WHERE extname = 'timescaledb';
```

### Redis CLI

```bash
docker compose exec redis redis-cli
> PING
PONG
> KEYS *
```

### RabbitMQ Queues

```bash
# Explore via UI: http://localhost:15672
# Or via CLI
docker compose exec rabbitmq rabbitmq-queues list
```

## ?? Testing

### API Testing with curl

```bash
# Identity Service health
curl http://localhost:5001/health

# Get OpenAPI/Swagger spec
curl http://localhost:5001/swagger/v1/swagger.json
```

### Load Testing with k6

```bash
# Install k6
# Run load test (when scripts are created)
k6 run tests/load/identity-service.js
```

## ?? Volumes

Persistent data is stored in named volumes:

**Infrastructure:**

- `tc-agro-postgres-data` - Database
- `tc-agro-postgres-backups` - Database backups (dev only)
- `tc-agro-redis-data` - Cache
- `tc-agro-rabbitmq-data` - Messages
- `tc-agro-pgadmin-data` - pgAdmin configs

**Observability:**

- `tc-agro-grafana-data` - Dashboards
- `tc-agro-loki-data` - Logs
- `tc-agro-tempo-data` - Traces
- `tc-agro-prometheus-data` - Metrics

**Services:**

- `tc-agro-identity-logs` - Service logs
- `tc-agro-identity-nuget-cache` - NuGet packages (dev only)

### Clean All Data

```bash
docker compose down -v
```

### Backup Database

```bash
docker compose exec postgres pg_dump -U postgres agro > backup.sql
```

### Restore Database

```bash
docker compose exec -T postgres psql -U postgres agro < backup.sql
```

## ?? Security Notes

?? **FOR LOCAL DEVELOPMENT ONLY**

- Default passwords are insecure
- JWT secret key must be changed for production
- No SSL/TLS configured
- pgAdmin accessible without strong auth

**Production Deployment:** Update all credentials and enable SSL/TLS before deploying to Azure or k3d.

## ?? Documentation

- [Copilot Instructions](../../.github/copilot-instructions.md)
- [Architecture Decisions](../../docs/adr/)
- [Local Setup Guide](../../docs/development/local-setup.md)

## ?? Common Issues

### Port Already in Use

```bash
# Find process using port
netstat -ano | findstr :5001

# Kill process or change port in .env
```

### Container Won't Start

```bash
# View detailed logs
docker compose logs <service-name>

# Rebuild without cache
docker compose build --no-cache <service-name>
docker compose up -d <service-name>
```

### Database Connection Refused

```bash
# Wait for PostgreSQL to be ready
docker compose exec postgres pg_isready -U postgres

# Check connection string in service
docker compose logs tc-agro-identity-service | grep "Connection"
```

### Hot-Reload Not Working

```bash
# Make sure volume is uncommented in docker-compose.override.yml
# Ensure file watcher is enabled
DOTNET_USE_POLLING_FILE_WATCHER=1

# Restart container
docker compose restart tc-agro-identity-service
```

### Debugger Not Connecting

```bash
# Check if debug port is exposed
docker compose ps | grep identity

# Verify port mapping: 15001:15001

# Check Visual Studio debugger settings
# Debug ? Attach to Process ? Docker ? select container
```

## ?? Contributing

When adding new services:

1. Create service Dockerfile
2. Add service to `docker-compose.yml` (base config)
3. Add service overrides to `docker-compose.override.yml` (debug config)
4. Configure environment variables in `.env`
5. Add health check endpoint
6. Update this README
7. Test locally: `docker compose up -d <service-name>`

## ?? Quick Commands Reference

```bash
# Start development environment
.\start.ps1
# or
docker compose up -d

# View live logs
docker compose logs -f

# Rebuild services
docker compose build --no-cache

# Access database
docker compose exec postgres psql -U postgres -d agro

# Access cache
docker compose exec redis redis-cli

# Stop services gracefully
docker compose stop

# Stop and remove all (keep volumes)
docker compose down

# Stop and remove everything (clean slate)
docker compose down -v

# Clean up unused resources
docker system prune -a --volumes
```

---

**Version**: 1.1  
**Last Updated**: January 2026  
**Maintainer**: TC Agro Solutions Team

**Key Update**: Added `docker-compose.override.yml` for development-specific enhancements (hot-reload, debug ports, verbose logging).
