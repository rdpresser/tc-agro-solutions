# ✅ SETUP CHECKLIST - TC Agro Solutions

Use este checklist para garantir que seu ambiente está completamente configurado.

---

## 📋 PRE-REQUISITES VALIDATION

### Step 1: Install Required Tools

- [ ] **Git** installed
  ```powershell
  git --version
  ```
- [ ] **Docker Desktop** installed and running

  ```powershell
  docker ps
  ```

- [ ] **PowerShell 5.0+** available

  ```powershell
  $PSVersionTable.PSVersion
  ```

- [ ] **.NET 10 SDK** installed
  ```powershell
  dotnet --version
  ```

### Step 2: K3D-Specific Tools (if using K3D mode)

- [ ] **kubectl** installed

  ```powershell
  kubectl version --client --short
  ```

- [ ] **Helm** installed

  ```powershell
  helm version --short
  ```

- [ ] **Kustomize** installed

  ```powershell
  kustomize version
  ```

- [ ] **k3d** installed
  ```powershell
  k3d version
  ```

### Step 3: Validate All Prerequisites

- [ ] Run validation script
  ```powershell
  # Copy and run the validation script from QUICK_START.md
  ```

---

## 🚀 SETUP STEPS

### Step 1: Clone Repository

- [ ] Repository cloned

  ```powershell
  git clone https://github.com/rdpresser/tc-agro-solutions.git
  cd tc-agro-solutions
  ```

- [ ] All files present
  ```powershell
  ls scripts\clone_bootstrap.ps1    # Should exist
  ls scripts\k3d\bootstrap.ps1      # Should exist
  ```

### Step 2: Run Bootstrap (Administrator)

- [ ] Bootstrap script executed

  ```powershell
  # Run as Administrator
  .\scripts\clone_bootstrap.ps1
  ```

- [ ] `.env` file created

  ```powershell
  ls orchestration\apphost-compose\.env  # Should exist
  ```

- [ ] Services cloned

  ```powershell
  ls services\identity-service       # Should exist
  ls services\farm-service           # Should exist
  ls services\sensor-ingest-service  # Should exist
  ls services\analytics-worker       # Should exist
  ls services\dashboard-service      # Should exist
  ```

- [ ] Common libraries cloned
  ```powershell
  ls common                          # Should exist
  ```

---

## 🐳 DOCKER COMPOSE MODE (API Development)

### Step 1: Start Infrastructure

- [ ] Services started

  ```powershell
  cd orchestration\apphost-compose
  docker compose up -d
  ```

- [ ] All containers running

  ```powershell
  docker compose ps
  # All services should show "Up"
  ```

- [ ] Health checks passing
  ```powershell
  docker compose ps | findstr "healthy"
  ```

### Step 2: Access Services

- [ ] PostgreSQL accessible

  ```powershell
  docker exec tc-agro-postgres psql -U postgres -c "\l" | findstr identity
  ```

- [ ] Redis accessible

  ```powershell
  docker exec tc-agro-redis redis-cli ping
  # Should respond: PONG
  ```

- [ ] RabbitMQ accessible
  ```powershell
  docker exec tc-agro-rabbitmq rabbitmq-diagnostics -q ping
  # Should respond: ok
  ```

### Step 3: Open in Visual Studio (Recommended)

- [ ] Solution file opened

  ```powershell
  start tc-agro-solutions.sln
  ```

- [ ] Identity Service set as startup project
  - Right-click `tc-agro-identity-service`
  - Select "Set as Startup Project"

- [ ] Project builds successfully
  - Build → Build Solution
  - Should complete without errors

- [ ] Service runs
  - Press `F5` to start debugging
  - Should see: "Now listening on: http://localhost:5001"

- [ ] Swagger accessible
  - Open browser: http://localhost:5001/swagger
  - Should see API documentation

### Step 4: Verify Services

- [ ] Health endpoint responds

  ```powershell
  curl http://localhost:5001/health
  # Should return: {"status":"healthy"}
  ```

- [ ] Grafana accessible

  ```powershell
  start http://localhost:3000
  # Login: admin / admin
  ```

- [ ] pgAdmin accessible

  ```powershell
  start http://localhost:15432
  # Login: admin@admin.com / admin
  ```

- [ ] RabbitMQ UI accessible
  ```powershell
  start http://localhost:15672
  # Login: guest / guest
  ```

---

## ☸️ K3D MODE (Full Stack)

### Step 1: Create Cluster

- [ ] Cluster creation started

  ```powershell
  cd scripts\k3d
  .\bootstrap.ps1
  ```

- [ ] Bootstrap completed
  - Should see: "✅ GITOPS BOOTSTRAP COMPLETE"
  - Should take ~4 minutes

- [ ] Cluster running

  ```powershell
  k3d cluster list
  # Should show "dev" cluster
  ```

- [ ] Nodes ready
  ```powershell
  kubectl get nodes
  # Should show 4 nodes (1 server, 3 agents)
  ```

### Step 2: Verify GitOps

- [ ] ArgoCD installed

  ```powershell
  kubectl get ns | findstr argocd
  # Should exist
  ```

- [ ] Applications syncing

  ```powershell
  kubectl get applications -n argocd
  # Should show platform applications
  ```

- [ ] Platform stack deployed
  ```powershell
  kubectl get pods -n observability
  # Should show otel-collector-agent DaemonSet pods
  ```

### Step 3: Access Services

- [ ] Docker Hub access available

  ```powershell
  docker pull rdpresser/frontend-service:latest
  ```

- [ ] ArgoCD via port-forward

  ```powershell
  cd scripts\k3d
  .\port-forward.ps1 argocd
  # Then visit: http://localhost:8090/argocd
  ```

- [ ] Grafana via port-forward

  ```powershell
  # Grafana runs in Docker Compose
  # Then visit: http://localhost:3000
  ```

- [ ] Prometheus accessible
  ```powershell
  # Prometheus runs in Docker Compose
  # Then visit: http://localhost:9090
  ```

---

## 🔧 ENVIRONMENT CONFIGURATION

### .env File

- [ ] `.env` file exists

  ```powershell
  ls orchestration\apphost-compose\.env
  ```

- [ ] `.env` has correct values
  - `POSTGRES_DB=tc-agro-identity-db`
  - `POSTGRES_USER=postgres`
  - `POSTGRES_PASSWORD=postgres`
  - `REDIS_HOST=redis`
  - `RABBITMQ_HOST=rabbitmq`

- [ ] `.env` is in `.gitignore`
  ```powershell
  # Should NOT be tracked by git
  git status | findstr ".env"
  # Should be empty (not shown)
  ```

### .env.example Template

- [ ] `.env.example` exists as reference

  ```powershell
  ls orchestration\apphost-compose\.env.example
  ```

- [ ] `.env.example` is tracked in Git
  ```powershell
  git status | findstr ".env.example"
  # Should show "nothing to commit"
  ```

---

## 🧪 QUICK TESTS

### API Test

- [ ] Create test user

  ```powershell
  $body = @{
    email = "test@example.com"
    password = "Test@1234"
  } | ConvertTo-Json

  Invoke-WebRequest -Uri "http://localhost:5001/auth/register" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body
  ```

- [ ] Login and get token

  ```powershell
  $loginBody = @{
    email = "test@example.com"
    password = "Test@1234"
  } | ConvertTo-Json

  $response = Invoke-WebRequest -Uri "http://localhost:5001/auth/login" `
    -Method POST `
    -ContentType "application/json" `
    -Body $loginBody

  $token = ($response.Content | ConvertFrom-Json).token
  Write-Host "Token: $token"
  ```

### Database Test

- [ ] Connect to database

  ```powershell
  docker exec tc-agro-postgres psql -U postgres -d tc-agro-identity-db -c "SELECT version();"
  ```

- [ ] Verify TimescaleDB extension
  ```powershell
  docker exec tc-agro-postgres psql -U postgres -d tc-agro-identity-db -c "SELECT * FROM pg_extension WHERE extname='timescaledb';"
  ```

### Cache Test

- [ ] Redis connection
  ```powershell
  docker exec tc-agro-redis redis-cli INFO server
  ```

### Message Queue Test

- [ ] RabbitMQ overview
  ```powershell
  curl -X GET http://guest:guest@localhost:15672/api/overview 2>$null | ConvertFrom-Json | Select-Object queue_totals, object_totals
  ```

---

## 📊 FINAL VERIFICATION

- [ ] All prerequisite tools installed and validated
- [ ] Repository cloned with all services
- [ ] Bootstrap completed successfully
- [ ] Docker Compose or K3D environment running
- [ ] All infrastructure services healthy
- [ ] API accessible and responding
- [ ] Database connected and configured
- [ ] Cache (Redis) operational
- [ ] Message broker (RabbitMQ) operational
- [ ] Observability stack running (Grafana/Prometheus/Loki/Tempo)
- [ ] Can start developing!

---

## 🎉 YOU'RE READY!

All checks passed? Congratulations! You're ready to start developing.

### Next Steps:

1. **For API Development:**
   - Open `tc-agro-solutions.sln` in Visual Studio
   - Start with `tc-agro-identity-service`
   - Begin coding!

2. **For Kubernetes/GitOps Testing:**
   - Explore K3D cluster: `kubectl get all -A`
   - Watch ArgoCD: `kubectl get applications -n argocd --watch`
   - Deploy test services

3. **Learn More:**
   - [Technical Roadmap](README_ROADMAP.md) - Architecture overview
   - [Architecture Decisions](docs/adr/) - Design decisions
   - [K3D Guide](scripts/k3d/README.md) - Kubernetes details

---

## ❓ ISSUES?

- [ ] Check [TROUBLESHOOTING](QUICK_START.md#-troubleshooting) section
- [ ] Run diagnostics: `.\scripts\docker-manager.ps1 diagnose`
- [ ] Review logs: `docker compose logs -f`
- [ ] Check GitHub issues: https://github.com/rdpresser/tc-agro-solutions/issues

---

> **Checklist Version:** 1.0  
> **Last Updated:** January 21, 2026  
> **Status:** ✅ Ready to use
