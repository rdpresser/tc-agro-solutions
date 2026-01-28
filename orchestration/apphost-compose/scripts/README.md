# 📋 TC Agro Docker Management Scripts

Consolidated and streamlined scripts for managing the local Docker Compose environment.

---

## 🎯 Main Entry Point

### `docker-manager.ps1` - Central Management Hub

The primary interface for all Docker operations. Similar to k3d-manager.ps1.

**Usage:**

```powershell
# Interactive menu
.\scripts\docker-manager.ps1

# Direct commands
.\scripts\docker-manager.ps1 start
.\scripts\docker-manager.ps1 status
.\scripts\docker-manager.ps1 restart identity
.\scripts\docker-manager.ps1 logs rabbitmq -f
.\scripts\docker-manager.ps1 cleanup

# Get help
.\scripts\docker-manager.ps1 --help
```

**Available Commands:**

```
Environment Management:
  start               - Starts all services (builds if needed)
  stop                - Stops all services (preserves volumes)
  restart [service]   - Restarts services (all or specific)
  cleanup             - Removes containers and volumes (TC Agro only)

Monitoring & Diagnostics:
  status              - Shows complete environment status
  diagnose            - Runs full diagnostics with detailed report
  logs [service] [-f] - Shows logs (all or specific, -f for follow)
  ps                  - Lists running containers

Troubleshooting:
  fix-rabbitmq        - Fixes RabbitMQ health check issues
  rebuild [service]   - Rebuilds and restarts services

Docker Operations:
  build [service]     - Builds Docker images
  update-versions     - Checks/updates service versions in docker-compose.yml
  pull                - Pulls latest base images
  exec <service> <cmd>- Executes command in container
```

---

## 📦 Individual Scripts

### `start.ps1`

**Purpose:** Comprehensive startup script with pre-flight checks

**Features:**

- Checks Docker status
- Validates .env file
- Detects port conflicts
- Builds images if needed
- Starts all services
- Displays access points

**Usage:**

```powershell
.\scripts\start.ps1
```

---

### `cleanup.ps1`

**Purpose:** Safe cleanup of TC Agro resources

**Safety Features:**

- ✅ Uses Docker labels (`tc-agro.*`) to identify resources
- ✅ Preserves k3d containers and volumes
- ✅ Only removes TC Agro networks
- ✅ Interactive confirmation (unless `-Force`)
- ✅ Option to keep volumes (`-KeepVolumes`)

**Usage:**

```powershell
# Interactive cleanup (asks confirmation)
.\scripts\cleanup.ps1

# Force cleanup without confirmation
.\scripts\cleanup.ps1 -Force

# Cleanup but keep volumes (preserves data)
.\scripts\cleanup.ps1 -KeepVolumes
```

**What it removes:**

- Containers with label `tc-agro.component=*`
- Volumes with label `com.docker.compose.project=tc-agro-local`
- Networks with label `com.docker.compose.project=tc-agro-local`

**What it preserves:**

- All k3d containers (`k3d-*`)
- All k3d volumes
- All k3d networks
- Any other Docker resources not labeled as TC Agro

---

### `diagnose.ps1`

**Purpose:** Comprehensive diagnostics and health checks

**Checks performed:**

1. Docker status
2. .env file existence and content
3. Docker Compose file validation
4. Running containers count
5. Container health status
6. Service-specific issues (RabbitMQ)
7. Resource usage

**Generates:** Detailed diagnostic report file

**Usage:**

```powershell
.\scripts\diagnose.ps1
```

---

### `fix-rabbitmq.ps1`

**Purpose:** Troubleshoots RabbitMQ health check issues

**Actions:**

1. Checks RabbitMQ container status
2. Tests connectivity with `rabbitmq-diagnostics ping`
3. Restarts if needed
4. Waits for healthy status (up to 120s)
5. Shows access information

**Usage:**

```powershell
.\scripts\fix-rabbitmq.ps1
```

**Common Issue:** RabbitMQ takes 30-60 seconds on first startup. This script waits patiently.

---

### `pre-build-vs.ps1`

**Purpose:** Pre-build cleanup for Visual Studio F5/Ctrl+F5

**Integrated into:** `docker-compose.dcproj` (runs automatically before VS starts containers)

**Safety Features:**

- Only removes TC Agro containers (uses labels)
- Preserves k3d clusters
- Checks for port conflicts
- Idempotent (safe to run multiple times)
- Silent mode for automation

**Usage:**

```powershell
# Manual execution (verbose)
.\scripts\pre-build-vs.ps1

# Silent mode (for automation)
.\scripts\pre-build-vs.ps1 -Silent

# Force remove stubborn containers
.\scripts\pre-build-vs.ps1 -Force
```

**Automatic execution:** Called by Visual Studio before starting containers.

---

## 🏷️ Docker Labels Used

TC Agro uses consistent Docker labels for safe resource management:

### Container Labels

```yaml
labels:
  - "tc-agro.component=infrastructure" # or service, observability
  - "tc-agro.layer=database" # or api, cache, messaging, etc
  - "tc-agro.service=identity" # service name (for services)
```

### Compose Project Label

Docker Compose automatically adds:

```yaml
com.docker.compose.project=tc-agro-local
```

These labels enable safe cleanup operations that don't affect k3d or other Docker resources.

---

## 🔒 Safety Guarantees

All cleanup scripts follow these rules:

1. **Label-based filtering** - Only touch resources with `tc-agro.*` labels
2. **K3D preservation** - Explicitly check for and preserve `k3d-*` containers
3. **Network isolation** - Only remove networks created by `tc-agro-local` project
4. **Volume safety** - Only remove volumes with compose project label
5. **Confirmation required** - Interactive scripts ask for confirmation (unless `-Force`)

---

## 🚀 Quick Reference

### First Time Setup

```powershell
# Start everything
.\scripts\start.ps1
```

### Daily Usage (via manager)

```powershell
# Start environment
.\scripts\docker-manager.ps1 start

# Check status
.\scripts\docker-manager.ps1 status

# View logs
.\scripts\docker-manager.ps1 logs identity -f

# Restart a service
.\scripts\docker-manager.ps1 restart rabbitmq
```

### Troubleshooting

```powershell
# Full diagnostics
.\scripts\docker-manager.ps1 diagnose

# Fix RabbitMQ
.\scripts\docker-manager.ps1 fix-rabbitmq

# Nuclear option (preserves volumes)
.\scripts\docker-manager.ps1 cleanup
.\scripts\docker-manager.ps1 start
```

### Visual Studio Integration

- **F5 (Debug)** - Pre-build script runs automatically, then VS starts containers
- **Ctrl+F5 (Release)** - Same pre-build, optimized build
- **Manual cleanup** - `.\scripts\pre-build-vs.ps1` if needed

---

## 🗂️ Removed Scripts (Consolidated)

The following scripts were removed as their functionality is now handled by `docker-manager.ps1`:

- ~~`quick-cleanup.ps1`~~ → Use `cleanup.ps1 -Force`
- ~~`restart-services.ps1`~~ → Use `docker-manager.ps1 restart`
- ~~`fix-and-restart.ps1`~~ → Use `docker-manager.ps1 restart`
- ~~`vs-setup.ps1`~~ → Documentation (no longer needed)
- ~~`test-pre-build.ps1`~~ → Test script (no longer needed)

---

## 📞 Access Points

After running `.\scripts\start.ps1`:

**Infrastructure:**

- PostgreSQL: `localhost:5432`
- pgAdmin: http://localhost:15432 (admin@admin.com / admin)
- Redis: `localhost:6379`
- RabbitMQ UI: http://localhost:15672 (guest / guest)

**Services:**

- Identity API: http://localhost:5001/swagger
- Health Check: http://localhost:5001/health

**Observability:**

- Grafana: http://localhost:3000 (admin / admin)
- Prometheus: http://localhost:9090
- Loki: http://localhost:3100
- Tempo: http://localhost:3200

---

## 🔍 Debugging Tips

### Check container health

```powershell
docker compose ps
```

### View logs

```powershell
# All services
docker compose logs

# Specific service with follow
docker compose logs -f rabbitmq

# Last 50 lines
docker compose logs --tail=50 identity
```

### Execute commands in containers

```powershell
# PostgreSQL shell
docker compose exec postgres psql -U postgres -d agro

# Redis CLI
docker compose exec redis redis-cli

# RabbitMQ management
docker compose exec rabbitmq rabbitmq-diagnostics status
```

### Check resource usage

```powershell
# Container stats
docker stats

# Disk usage
docker system df

# TC Agro specific
docker ps --filter "label=tc-agro.component"
```

---

## � Version Management

### `update-service-versions.ps1` - Automated Version Checker

Checks and updates service versions in `docker-compose.yml` using GitHub Releases and Docker Hub APIs.

**Usage:**

```powershell
# Check current versions (dry-run, no changes)
.\scripts\update-service-versions.ps1

# Apply updates automatically
.\scripts\update-service-versions.ps1 -Apply

# Skip backup before updating
.\scripts\update-service-versions.ps1 -Apply -SkipBackup

# Verbose output with API details
.\scripts\update-service-versions.ps1 -Verbose
```

**Monitored Services:**

| Service            | Source          | Update Strategy            |
| ------------------ | --------------- | -------------------------- |
| **TimescaleDB**    | Docker Hub      | Manual Review (PG version) |
| **pgAdmin**        | Docker Hub      | Latest                     |
| **Redis**          | Docker Hub      | Major Version (7.x)        |
| **RabbitMQ**       | Docker Hub      | Major Version (3.x)        |
| **Loki**           | GitHub Releases | Auto                       |
| **Tempo**          | GitHub Releases | Auto                       |
| **Prometheus**     | GitHub Releases | Auto                       |
| **OTEL Collector** | GitHub Releases | Auto                       |
| **Grafana**        | GitHub Releases | Auto                       |

**Update Strategies:**

- **Auto**: Automatically update to latest (patch/minor)
- **ManualReview**: Show available updates, require manual intervention
- **MajorVersion**: Pin to major version (e.g., 7.x → 7.latest)
- **Latest**: Always use `:latest` tag

**Output Example:**

```
╔════════════════════════════════════════════════════════════════╗
║              Docker Compose Service Version Report             ║
╚════════════════════════════════════════════════════════════════╝

Service          Current         Latest          Status     Strategy
───────────────  ──────────────  ──────────────  ─────────  ────────────
TimescaleDB      latest-pg16     latest-pg17     ⚠ Outdated ManualReview
Loki             3.6.4           3.6.4           ✓ Up-to-date Auto
Tempo            2.10.0          2.10.0          ✓ Up-to-date Auto
Prometheus       v3.9.1          v3.9.1          ✓ Up-to-date Auto
OTEL Collector   0.144.0         0.144.0         ✓ Up-to-date Auto
Grafana          12.3.1          12.3.1          ✓ Up-to-date Auto

Summary: 5 up-to-date, 1 outdated, 0 ahead
```

**Features:**

- ✅ GitHub Releases API integration (Grafana projects)
- ✅ Docker Hub API v2 integration (base images)
- ✅ Semantic version comparison
- ✅ Automatic backup before updates
- ✅ Dry-run mode (default)
- ✅ Color-coded status output
- ✅ CI/CD integration (exit code 0/1)
- ✅ Error handling for API failures

**Safety:**

- Default mode is **dry-run** (check only, no changes)
- `-Apply` flag required for actual updates
- Automatic backup created before modifications
- Manual review required for breaking changes (TimescaleDB PG version)

**Integration with docker-manager.ps1:**

```powershell
# From manager menu
.\scripts\docker-manager.ps1 update-versions

# Or directly
.\scripts\update-service-versions.ps1
```

---

## 📝 Notes

- **F5 in Visual Studio** works smoothly thanks to `pre-build-vs.ps1`
- **K3D clusters** are always preserved by cleanup operations
- **Volumes** can be preserved with `-KeepVolumes` flag
- **Labels** ensure safe multi-environment Docker usage
- **Interactive menu** available via `docker-manager.ps1` (no parameters)
- **Version updates** can be automated via `update-service-versions.ps1 -Apply`

---

> **Version:** 2.1 - Added Automated Version Management  
> **Last Updated:** January 21, 2026  
> **Purpose:** Streamlined Docker management with k3d coexistence
