# 🚀 Developer Quick Reference Card

**Quick access to the most common commands and resources.**

---

## 📱 MOST COMMON COMMANDS

### Start Development Environment

```powershell
# 🐳 Docker Compose (Recommended for API development)
cd orchestration/apphost-compose
docker compose up -d
# Wait ~30 seconds for services to be ready

# Open Visual Studio
start tc-agro-solutions.sln
# Press F5 to run Identity Service

# Or run K3D (Full Kubernetes stack)
cd scripts/k3d
.\bootstrap.ps1
```

### Stop Services

```powershell
# Stop all containers (keep volumes)
cd orchestration/apphost-compose
docker compose down

# Stop and clean all data (fresh start)
cd orchestration/apphost-compose
docker compose down -v
```

### Check Service Status

```powershell
# Health check with comprehensive report
.\scripts\health-check.ps1 -Mode docker

# Or manual check - list all running containers
cd orchestration/apphost-compose
docker compose ps

# View logs from specific service
docker compose logs -f identity-api
docker compose logs -f postgres
```

---

## 🌐 SERVICE ACCESS URLS

### APIs

| Service          | URL                    | Swagger Docs                  |
| ---------------- | ---------------------- | ----------------------------- |
| Identity API     | http://localhost:5001  | http://localhost:5001/swagger |
| Farm API         | http://localhost:5002  | http://localhost:5002/swagger |
| Ingest API       | http://localhost:5003  | http://localhost:5003/swagger |
| Analytics Worker | _(background service)_ | N/A                           |
| Dashboard API    | http://localhost:5004  | http://localhost:5004/swagger |
| Frontend POC     | http://localhost:5173  | N/A (Vite dev server)         |

### Infrastructure

| Service    | URL                    | Login                   |
| ---------- | ---------------------- | ----------------------- |
| Grafana    | http://localhost:3000  | admin / admin           |
| Prometheus | http://localhost:9090  | No auth                 |
| Loki       | http://localhost:3100  | No auth                 |
| Tempo      | http://localhost:3200  | No auth                 |
| pgAdmin    | http://localhost:15432 | admin@admin.com / admin |
| RabbitMQ   | http://localhost:15672 | guest / guest           |
| Redis      | localhost:6379         | No auth (local)         |
| PostgreSQL | localhost:5432         | postgres / postgres     |

---

## 🔧 COMMON DEVELOPMENT TASKS

### Build a Service

```powershell
# Build specific service
dotnet build src/Agro.Identity.Api

# Build entire solution
dotnet build

# Clean and rebuild (if issues)
dotnet clean
dotnet build
```

### Run Tests

```powershell
# Run all tests
dotnet test

# Run specific test project
dotnet test src/Agro.Identity.Tests

# Run with output
dotnet test --logger "console;verbosity=detailed"

# Run specific test class
dotnet test --filter "ClassName=YourTestClass"
```

### Entity Framework Migrations

```powershell
# Add new migration
dotnet ef migrations add MigrationName --project src/Agro.Identity.Api

# View pending migrations
dotnet ef migrations list --project src/Agro.Identity.Api

# Apply migrations to database
dotnet ef database update --project src/Agro.Identity.Api

# Remove last migration (if not applied)
dotnet ef migrations remove --project src/Agro.Identity.Api
```

### Database Commands

```powershell
# Connect to PostgreSQL directly
docker exec -it tc-agro-postgres psql -U postgres -d tc-agro-identity-db

# Run SQL command
docker exec tc-agro-postgres psql -U postgres -d tc-agro-identity-db -c "SELECT * FROM schema_migrations;"

# Backup database
docker exec tc-agro-postgres pg_dump -U postgres tc-agro-identity-db > backup.sql

# Restore database
docker exec -i tc-agro-postgres psql -U postgres tc-agro-identity-db < backup.sql
```

### Redis Commands

```powershell
# Connect to Redis
docker exec -it tc-agro-redis redis-cli

# Common Redis commands (in redis-cli):
PING                           # Test connection
KEYS *                         # List all keys
GET keyname                    # Get value
DEL keyname                    # Delete key
FLUSHALL                       # Clear all data (careful!)
DBSIZE                         # Number of keys
```

### RabbitMQ Commands

```powershell
# Check RabbitMQ status
docker exec tc-agro-rabbitmq rabbitmq-diagnostics status

# List queues
docker exec tc-agro-rabbitmq rabbitmq-diagnostics queues

# View connections
docker exec tc-agro-rabbitmq rabbitmq-diagnostics connections

# Reset RabbitMQ (careful - clears all data)
docker exec tc-agro-rabbitmq rabbitmqctl reset
```

---

## 🐛 QUICK TROUBLESHOOTING

### Docker Issues

```powershell
# Docker daemon not running
# → Start Docker Desktop from Start menu

# Port already in use
# → Kill process: netstat -ano | findstr :PORT
#   Then: taskkill /PID <PID> /F

# Container keeps restarting
# → Check logs: docker compose logs service-name

# Permission denied errors
# → Run PowerShell as Administrator
```

### Database Issues

```powershell
# Can't connect to PostgreSQL
docker exec tc-agro-postgres pg_isready -U postgres
# Should respond: accepting connections

# Database doesn't exist
# → Should auto-create on first run
# → Or run: docker compose up -d postgres
#           (wait 30 seconds)
#           docker compose exec postgres psql -U postgres -l

# Bad migration state
docker exec tc-agro-postgres psql -U postgres -d tc-agro-identity-db -c "DELETE FROM \"__EFMigrationsHistory\" WHERE \"MigrationId\" = 'XXX';"
```

### Service Won't Start

```powershell
# View detailed logs
docker compose logs service-name --tail 100

# Rebuild service
docker compose build service-name --no-cache

# Force remove and recreate
docker compose rm -f service-name
docker compose up -d service-name

# Check resource limits
docker compose exec service-name free -h     # Memory
docker compose exec service-name df -h       # Disk
```

---

## 🎯 DEVELOPMENT WORKFLOW

### 1. Start Your Day

```powershell
# ✅ Ensure everything is clean and healthy
.\scripts\health-check.ps1 -Mode docker

# ✅ Start services if not running
cd orchestration/apphost-compose
docker compose up -d

# ✅ Open solution
start tc-agro-solutions.sln
```

### 2. Make Changes

```powershell
# ✅ Create feature branch
git checkout -b feature/your-feature

# ✅ Make code changes
# (Edit in Visual Studio with F5 debugging)

# ✅ Run tests
dotnet test

# ✅ Verify endpoints with curl or Postman
curl -X GET http://localhost:5001/health
```

### 3. Commit and Push

```powershell
# ✅ Review changes
git status
git diff

# ✅ Commit with descriptive message
git add .
git commit -m "feat: describe your feature"

# ✅ Push to your branch
git push origin feature/your-feature

# ✅ Create Pull Request in GitHub
```

### 4. End Your Day

```powershell
# ✅ Run full test suite
dotnet test

# ✅ Stop services (keep data)
cd orchestration/apphost-compose
docker compose down

# Or fully clean (reset data)
docker compose down -v
```

---

## 📚 DOCUMENTATION SHORTCUTS

| Document                   | Purpose                                    | Path                              |
| -------------------------- | ------------------------------------------ | --------------------------------- |
| **QUICK_START.md**         | Setup guide for first-time developers      | `./QUICK_START.md`                |
| **SETUP_CHECKLIST.md**     | Detailed checklist with verification steps | `./SETUP_CHECKLIST.md`            |
| **README_ROADMAP.md**      | Technical roadmap and architecture         | `./README_ROADMAP.md`             |
| **Local Setup Guide**      | Development environment details            | `docs/development/local-setup.md` |
| **Architecture Decisions** | ADRs 001-007                               | `docs/adr/`                       |
| **API Conventions**        | Coding standards                           | `docs/architecture/`              |
| **K3D Guide**              | Kubernetes setup                           | `scripts/k3d/README.md`           |

---

## 🆘 NEED HELP?

### Most Common Issues

**"Docker daemon is not running"**

- → Start Docker Desktop from Windows Start menu
- → Wait 30 seconds for it to fully load

**"Port 5432 is already in use"**

- → Kill existing process: `netstat -ano | findstr :5432`
- → Or change port in `.env` and rebuild

**"Cannot connect to database"**

- → Check if PostgreSQL container is running: `docker compose ps postgres`
- → Check logs: `docker compose logs postgres`
- → Verify `.env` has correct values

**"Services keep restarting"**

- → Check logs: `docker compose logs`
- → Restart everything: `docker compose down -v && docker compose up -d`
- → Wait 2-3 minutes for databases to initialize

**"API not responding"**

- → Is it running in Visual Studio or console? (`F5` or `dotnet run`)
- → Check swagger: http://localhost:5001/swagger
- → Check logs in console or docker: `docker compose logs identity-api`

### Getting More Help

1. **Check documentation** → `QUICK_START.md` or `docs/development/local-setup.md`
2. **Run health check** → `.\scripts\health-check.ps1`
3. **Review recent logs** → `docker compose logs -f --tail 50`
4. **Search issues** → GitHub issues: https://github.com/rdpresser/tc-agro-solutions/issues
5. **Ask team** → Discord: @dev-team-channel

---

## ⚡ POWER USER TIPS

### Aliases (Add to PowerShell Profile)

```powershell
# Add to $PROFILE
Set-Alias -Name dc -Value "docker compose"
Set-Alias -Name dcup -Value "docker compose up -d"
Set-Alias -Name dcdown -Value "docker compose down"
Set-Alias -Name dclogs -Value "docker compose logs"
Set-Alias -Name hc -Value ".\scripts\health-check.ps1"

# Usage:
# dc ps
# dcup
# dclogs -f postgres
# hc -Mode docker
```

### Watch Containers

```powershell
# Real-time container monitoring
watch -n 1 "docker compose ps"

# Watch a specific service logs
docker compose logs -f identity-api --tail 50

# Watch database activity (advanced)
docker exec tc-agro-postgres psql -U postgres -c "SELECT pid, query FROM pg_stat_statements ORDER BY query_time DESC LIMIT 10;"
```

### Performance Tuning

```powershell
# Check resource usage
docker stats tc-agro-postgres tc-agro-redis

# Check container details
docker inspect tc-agro-postgres | ConvertFrom-Json | Select -ExpandProperty Config

# View network details
docker network ls
docker network inspect apphost-compose_default
```

---

> **Version:** 1.0  
> **Updated:** January 21, 2026  
> **Print this card or bookmark this file!** 🔖
