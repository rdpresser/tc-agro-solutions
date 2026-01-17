# 🚀 Bootstrap Setup - TC Agro Solutions

**Date:** January 13, 2026  
**Version:** 1.0  
**Status:** Production Ready

---

## 📋 Overview

This document describes how to set up your local development environment for TC Agro Solutions using the **`bootstrap.ps1`** script.

The bootstrap automates:

- ✅ Clone of all 5 microservices (via HTTPS)
- ✅ Clone of shared `common` libraries
- ✅ Creation of `.env` file with local configuration
- ✅ Update of existing repositories (with confirmation)
- ✅ Preparation of folder structure

---

## 🏗️ Folder Architecture

After bootstrap, your local structure will be:

```
tc-agro-solutions/
├── services/                                # 🔄 Clonado por bootstrap
│   ├── identity-service/                   # Agro.Identity.Api
│   ├── farm-service/                       # Agro.Farm.Api
│   ├── sensor-ingest-service/              # Agro.Sensor.Ingest.Api
│   ├── analytics-worker/                   # Agro.Analytics.Worker
│   └── dashboard-service/                  # Agro.Dashboard.Api
│
├── common/                                  # 🔄 Clonado por bootstrap
│   ├── (shared libraries)
│   └── (domain models)
│
├── infrastructure/                          # 📦 Infraestrutura (Terraform, Kubernetes)
│   ├── terraform/
│   ├── kubernetes/
│   └── docker/
│
├── scripts/
│   └── bootstrap.ps1                        # ⚙️ Este script
│
├── docs/                                    # 📚 Documentação
│   ├── adr/                                 # Arquitetura Decisions Records
│   ├── architecture/                        # Diagramas e arquitetura
│   └── development/                         # Guias de desenvolvimento
│
├── poc/                                     # 🧪 Frontend POC
│   └── frontend/                            # Dashboard UI demo
│
├── .gitignore                               # Git: ignore services/ e common/
├── .env                                     # ⚙️ Criado por bootstrap
├── docker-compose.yml                       # 🐳 Orquestração local (futuro)
├── README.md                                # 📖 Início rápido
└── tc-agro-solutions.sln                    # 🔧 Solution (.NET)
```

---

## 🚀 Quick Start

### Prerequisites

- **Git** installed
- **Docker** installed and running
- **PowerShell 5.0+** (Windows) or **PowerShell Core** (any OS)
- **Visual Studio 2026** (to open solution)

### 1️⃣ Clone Repository

```powershell
git clone https://github.com/rdpresser/tc-agro-solutions.git
cd tc-agro-solutions
```

### 2️⃣ Run Bootstrap

```powershell
# Run with all defaults
.\scripts\bootstrap.ps1
```

This will:

1. Create `services/` and `common/` directories
2. Validate Git and Docker are installed
3. Test internet connectivity
4. Clone all 5 services
5. Clone `common` repository
6. Create `.env` file with local configuration
7. **Verify all repositories were cloned successfully**

### 3️⃣ Open Solution

```powershell
# Open in Visual Studio
start tc-agro-solutions.sln
```

Or manually open with Visual Studio 2026 → File → Open → Solution

### 4️⃣ Add Projects to Solution

In Visual Studio, add service projects:

```
Right-click Solution → Add → Existing Project
```

Add each `.csproj`:

- `services/identity-service/src/Agro.Identity.Api/Agro.Identity.Api.csproj`
- `services/farm-service/src/Agro.Farm.Api/Agro.Farm.Api.csproj`
- And so on...

### 5️⃣ Start Infrastructure

```powershell
# Create docker-compose.yml manually (or use provided template)
docker compose up -d
```

This starts:

- PostgreSQL (port 5432)
- Redis (port 6379)
- RabbitMQ (ports 5672 and 15672)

---

## ⚙️ Script Parameters

### Run with Defaults

```powershell
.\scripts\bootstrap.ps1
```

Clone/pull everything, interactive confirmation for existing repos.

### Do NOT Pull Existing Repos

```powershell
.\scripts\bootstrap.ps1 -NoPull
```

If services already exist, skip the pull. Useful for CI/CD.

---

## 📝 Generated `.env` File

Bootstrap creates a `.env` file at root with safe local configuration:

```bash
# Environment
ASPNETCORE_ENVIRONMENT=Development

# PostgreSQL
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=agro
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# RabbitMQ
RABBITMQ_HOST=rabbitmq
RABBITMQ_USER=guest
RABBITMQ_PASSWORD=guest

# JWT
JWT_ISSUER=http://localhost:5001
JWT_AUDIENCE=http://localhost:5000
JWT_SECRET_KEY=your-256-bit-secret-key-change-in-production-12345678

# Service Ports
IDENTITY_HTTP_PORT=5001
FARM_HTTP_PORT=5002
SENSOR_INGEST_HTTP_PORT=5003
ANALYTICS_WORKER_HTTP_PORT=5004
DASHBOARD_HTTP_PORT=5005
```

⚠️ **Important:** This `.env` is for local development only. Use Azure Key Vault in production.

---

## 🔄 Daily Workflow

### Update All Services

```powershell
cd c:\Projects\tc-agro-solutions

# Clone/update everything with interactive confirmation
.\scripts\bootstrap.ps1
```

### Work on Specific Service

```powershell
# Enter service folder
cd services\identity-service

# Create feature branch
git checkout -b feature/new-endpoint

# Make changes
# ...

# Commit and push
git add .
git commit -m "feat: add new endpoint"
git push origin feature/new-endpoint

# Return to root
cd ..\..
```

### Test Locally (without Docker)

```powershell
# Enter service folder
cd services\identity-service\src\Agro.Identity.Api

# Run directly
dotnet run

# Available at http://localhost:5001
```

---

## 🐳 Docker Compose

Create a `docker-compose.yml` at project root to orchestrate local services:

```yaml
version: "3.8"

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: agro
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  rabbitmq:
    image: rabbitmq:3.12-management-alpine
    environment:
      RABBITMQ_DEFAULT_USER: guest
      RABBITMQ_DEFAULT_PASS: guest
    ports:
      - "5672:5672"
      - "15672:15672"

volumes:
  postgres-data:
```

Then run:

```powershell
docker compose up -d
```

---

## 🔧 Troubleshooting

### Error: Git not found

```
Command 'git' not found.
```

**Solution:** Install Git from https://git-scm.com/

### Error: Docker not found

```
Command 'docker' not found.
```

**Solution:** Install Docker Desktop from https://www.docker.com/products/docker-desktop

### Bootstrap shows "Nothing happens" for common repo

**Symptom:** Script says "common already exists" and offers pull, but folder is empty or has no git repository.

**Root Cause (FIXED in v1.1):** Previous bootstrap versions pre-created an empty `common` folder. When the script tried to clone, it detected the folder exists and offered pull instead - but pull fails on an empty folder.

**Solution:**

```powershell
# Delete the empty/invalid common folder
Remove-Item -Recurse -Force common

# Run bootstrap again - will clone properly now
.\scripts\bootstrap.ps1
```

**What's different in v1.1+:** Bootstrap no longer pre-creates the `common` folder. It lets `git clone` create it automatically, preventing this issue.

**Alternative - Manual clone:**

```powershell
git clone https://github.com/rdpresser/tc-agro-common.git common
```

### Repo already exists - want to pull?

Script asks interactively if you want to update existing repos:

```
ℹ identity-service already exists in services/identity-service
Do you want to pull (git pull origin main) for identity-service? (y/n): y
```

Answer `y` to update or `n` to keep as is.

### Failed to clone a repo

```
✗ Failed to clone identity-service
Repository not accessible or does not exist
```

**Check:**

- Internet connection is working and stable
- Correct URLs in `scripts/bootstrap.ps1`
- Repository access permissions
- GitHub credentials if repository is private
- Try running script again with `-NoPull` to skip existing repos:
  ```powershell
  .\scripts\bootstrap.ps1 -NoPull
  ```

### PowerShell: Execution Policy

If you get execution policy error:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

## 📚 Repository Structure

### Services (5 independent repositories)

| Repository                    | URL                                                            | Local Folder                     |
| ----------------------------- | -------------------------------------------------------------- | -------------------------------- |
| tc-agro-identity-service      | https://github.com/rdpresser/tc-agro-identity-service.git      | `services/identity-service`      |
| tc-agro-farm-service          | https://github.com/rdpresser/tc-agro-farm-service.git          | `services/farm-service`          |
| tc-agro-sensor-ingest-service | https://github.com/rdpresser/tc-agro-sensor-ingest-service.git | `services/sensor-ingest-service` |
| tc-agro-analytics-worker      | https://github.com/rdpresser/tc-agro-analytics-worker.git      | `services/analytics-worker`      |
| tc-agro-dashboard-service     | https://github.com/rdpresser/tc-agro-dashboard-service.git     | `services/dashboard-service`     |

### Common (1 shared repository)

| Repository     | URL                                             | Local Folder |
| -------------- | ----------------------------------------------- | ------------ |
| tc-agro-common | https://github.com/rdpresser/tc-agro-common.git | `common`     |

---

## 🎯 Next Steps

1. ✅ **Run bootstrap**: `.\scripts\bootstrap.ps1`
2. ✅ **Check structure**: `dir services`, `dir common`
3. ✅ **Open solution**: `start tc-agro-solutions.sln`
4. ✅ **Add projects** to solution (Add Existing Project)
5. ⏳ **Create docker-compose.yml** (see template above)
6. ⏳ **Run**: `docker compose up -d`
7. ⏳ **Test APIs** with Swagger

---

## 📖 Related Documentation

- [Local Development Setup](./development/local-setup.md) - Detailed local environment guide
- [Architecture Decisions (ADRs)](./adr/) - Architectural decisions
- [Main README](../README.md) - Project overview

---

## ❓ FAQ

**Q: What if a repository is private?**  
A: Script uses HTTPS. Configure your GitHub token via:

```bash
git config --global credential.helper wincred
```

**Q: Can I clone only some services?**  
A: Edit the `$repos` array in `bootstrap.ps1` and remove unwanted ones.

**Q: How do I pull new commits?**  
A: Run bootstrap again and answer `y` to pull.

---

## 🤝 Contributing

1. Clone/pull via bootstrap
2. Create feature branch in a service
3. Commit and push to your fork
4. Open PR in the specific service repository
5. After merge, return to root and run bootstrap to sync

---

> **Version:** 1.0  
> **Last Updated:** January 13, 2026  
> **Status:** Production Ready  
> **Next:** Create docker-compose.yml template
