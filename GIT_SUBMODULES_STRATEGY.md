# 🏗️ Git Submodules Strategy - TC Agro Solutions Monorepo

**Purpose:** Organize TC Agro Solutions as a parent solution with services and shared code in separate Git repositories  
**Benefit:** Modular structure, independent versioning, team-specific repos  
**Date:** January 9, 2026

---

## 📊 Proposed Folder Structure

```
tc-agro-solutions/ (PARENT - this repository)
│
├── services/                          # Git Submodule
│   ├── agro-identity-service/        # Git repo
│   ├── agro-farm-service/            # Git repo
│   ├── agro-sensor-ingest-service/   # Git repo
│   ├── agro-analytics-worker/        # Git repo
│   └── agro-dashboard-service/       # Git repo
│
├── common/                            # Git Submodule
│   ├── agro-shared-library/          # Git repo (DTOs, validators, utilities)
│   ├── agro-domain-models/           # Git repo (domain entities)
│   └── agro-integration-tests/       # Git repo (shared test fixtures)
│
├── infrastructure/                    # PARENT repo (local)
│   ├── terraform/
│   │   ├── modules/
│   │   ├── main.tf
│   │   └── AKS_NODE_POOLS_REFERENCE.md
│   ├── kubernetes/
│   │   ├── argocd/
│   │   ├── services/
│   │   └── namespaces.yaml
│   └── docker/
│       └── Dockerfile (templates)
│
├── scripts/                           # PARENT repo (local)
│   ├── deploy.sh
│   ├── local-setup.sh
│   ├── cleanup.sh
│   └── monitoring-setup.sh
│
├── docs/                              # PARENT repo (local)
│   ├── adr/
│   ├── architecture/
│   ├── development/
│   └── operations/
│
├── .gitmodules                        # Submodules configuration (PARENT)
├── README.md                          # Solution overview (PARENT)
├── SOLUTION_ARCHITECTURE.md           # High-level design (PARENT)
└── docker-compose.yml                 # Local development (PARENT)
```

---

## 🔑 Key Repositories

### Parent Repository (Solution)
- **Repository:** `git@github.com:your-org/tc-agro-solutions.git`
- **Responsibility:** 
  - Infrastructure as Code (Terraform)
  - Kubernetes manifests
  - Scripts for automation
  - Documentation (architecture, ADRs)
  - Git submodule configuration
  - Docker Compose for local development

### Service Repositories (Submodules)
- **agro-identity-service** → `git@github.com:your-org/agro-identity-service.git`
- **agro-farm-service** → `git@github.com:your-org/agro-farm-service.git`
- **agro-sensor-ingest-service** → `git@github.com:your-org/agro-sensor-ingest-service.git`
- **agro-analytics-worker** → `git@github.com:your-org/agro-analytics-worker.git`
- **agro-dashboard-service** → `git@github.com:your-org/agro-dashboard-service.git`

**Each service contains:**
```
agro-identity-service/
├── src/
│   ├── Agro.Identity.Api/
│   ├── Agro.Identity.Domain/
│   └── Agro.Identity.Tests/
├── Dockerfile
├── .github/workflows/
├── README.md
└── agro-identity-service.csproj
```

### Shared Code Repositories (Submodules)
- **agro-shared-library** → Common utilities, validation, exceptions
- **agro-domain-models** → Shared domain entities, DTOs
- **agro-integration-tests** → Shared test fixtures, test data builders

---

## 🔧 Step 1: Create Separate Git Repositories

### Create Service Repositories on GitHub
```bash
# Example: Create agro-identity-service repository
# Go to GitHub → New Repository
# Name: agro-identity-service
# Description: Identity and authentication microservice
# Visibility: Private (or Public)
# Initialize with README ✓

# Repeat for:
# - agro-farm-service
# - agro-sensor-ingest-service
# - agro-analytics-worker
# - agro-dashboard-service
```

### Create Shared Code Repositories
```bash
# Create shared repositories similarly:
# - agro-shared-library
# - agro-domain-models
# - agro-integration-tests
```

### Clone Parent Solution Repo
```bash
cd ~/projects
git clone git@github.com:your-org/tc-agro-solutions.git
cd tc-agro-solutions
```

---

## 🔗 Step 2: Add Git Submodules to Parent Repo

### Add Service Submodules
```bash
# From tc-agro-solutions/ directory

# Add services
git submodule add git@github.com:your-org/agro-identity-service.git services/agro-identity-service
git submodule add git@github.com:your-org/agro-farm-service.git services/agro-farm-service
git submodule add git@github.com:your-org/agro-sensor-ingest-service.git services/agro-sensor-ingest-service
git submodule add git@github.com:your-org/agro-analytics-worker.git services/agro-analytics-worker
git submodule add git@github.com:your-org/agro-dashboard-service.git services/agro-dashboard-service

# Add shared libraries
git submodule add git@github.com:your-org/agro-shared-library.git common/agro-shared-library
git submodule add git@github.com:your-org/agro-domain-models.git common/agro-domain-models
git submodule add git@github.com:your-org/agro-integration-tests.git common/agro-integration-tests
```

### Verify Submodules
```bash
# Check .gitmodules file
cat .gitmodules

# Output should show:
# [submodule "services/agro-identity-service"]
#     path = services/agro-identity-service
#     url = git@github.com:your-org/agro-identity-service.git
# [submodule "services/agro-farm-service"]
#     path = services/agro-farm-service
#     url = git@github.com:your-org/agro-farm-service.git
# ... (more submodules)
```

### Commit Submodule Configuration
```bash
git add .gitmodules
git add services/
git add common/
git commit -m "feat: add service and shared library submodules"
git push origin main
```

---

## 📥 Step 3: Clone Solution with All Submodules

### Option A: Clone With Submodules (Recommended)
```bash
# Clones parent + automatically initializes and updates all submodules
git clone --recurse-submodules git@github.com:your-org/tc-agro-solutions.git

cd tc-agro-solutions
# All services and common libraries are now present
ls -la services/
# agro-analytics-worker/
# agro-dashboard-service/
# agro-farm-service/
# agro-identity-service/
# agro-sensor-ingest-service/

ls -la common/
# agro-domain-models/
# agro-integration-tests/
# agro-shared-library/
```

### Option B: Clone Without Submodules, Then Initialize
```bash
# Clone only parent repo
git clone git@github.com:your-org/tc-agro-solutions.git
cd tc-agro-solutions

# Initialize submodules (download all services and shared code)
git submodule init
git submodule update

# Or in one command:
git submodule update --init --recursive
```

---

## 🔄 Step 4: Working with Submodules

### Update All Submodules to Latest Version
```bash
# From parent tc-agro-solutions/ directory
git submodule update --remote

# This pulls the latest version of each submodule from their respective repos
```

### Update Specific Submodule
```bash
# Update only agro-farm-service to latest
cd services/agro-farm-service
git pull origin main
cd ../..

# Or use:
git submodule update --remote services/agro-farm-service
```

### Make Changes in a Submodule
```bash
# Navigate to submodule directory
cd services/agro-identity-service

# Work as normal
git checkout -b feature/new-endpoint
# ... make changes ...
git add src/
git commit -m "feat: add new auth endpoint"
git push origin feature/new-endpoint

# Create PR on the service repo, then merge
```

### Commit Submodule Changes to Parent
```bash
# After merging changes in agro-identity-service, update parent repo
cd tc-agro-solutions

# Parent repo now shows submodule has new commits
git status
# modified:   services/agro-identity-service (new commits)

# Commit the submodule update
git add services/agro-identity-service
git commit -m "chore: update agro-identity-service to latest"
git push origin main
```

---

## 🛠️ Step 5: Local Development Setup

### One-Command Local Development
```bash
# Clone everything
git clone --recurse-submodules git@github.com:your-org/tc-agro-solutions.git
cd tc-agro-solutions

# Start all services locally
docker-compose up -d

# All services are now running:
# - Identity API on port 5001
# - Farm API on port 5002
# - Sensor Ingest on port 5003
# - Dashboard on port 5004
# - PostgreSQL on port 5432
# - Redis on port 6379
# - RabbitMQ on port 15672
```

### Build All Services (for Docker)
```bash
# Script to build all submodules and create Docker images
# File: scripts/build-all-services.sh

#!/bin/bash
set -e

echo "🔨 Building all services..."

cd services/agro-identity-service
docker build -t agro-identity-service:latest .
echo "✅ agro-identity-service built"

cd ../agro-farm-service
docker build -t agro-farm-service:latest .
echo "✅ agro-farm-service built"

cd ../agro-sensor-ingest-service
docker build -t agro-sensor-ingest-service:latest .
echo "✅ agro-sensor-ingest-service built"

cd ../agro-analytics-worker
docker build -t agro-analytics-worker:latest .
echo "✅ agro-analytics-worker built"

cd ../agro-dashboard-service
docker build -t agro-dashboard-service:latest .
echo "✅ agro-dashboard-service built"

cd ../..
echo "🎉 All services built successfully!"
```

---

## 📋 Step 6: Docker Compose Configuration

### docker-compose.yml (in parent tc-agro-solutions)
```yaml
version: '3.8'

services:
  # Infrastructure
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: agro_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7
    ports:
      - "6379:6379"

  rabbitmq:
    image: rabbitmq:3.12-management
    environment:
      RABBITMQ_DEFAULT_USER: guest
      RABBITMQ_DEFAULT_PASS: guest
    ports:
      - "5672:5672"
      - "15672:15672"

  # Services (from submodules)
  identity-api:
    build: ./services/agro-identity-service
    ports:
      - "5001:80"
    environment:
      ASPNETCORE_ENVIRONMENT: Development
      ConnectionStrings__DefaultConnection: Host=postgres;Database=agro_db;Username=postgres;Password=postgres
      Jwt__SecretKey: your-256-bit-secret-key
    depends_on:
      - postgres

  farm-api:
    build: ./services/agro-farm-service
    ports:
      - "5002:80"
    environment:
      ASPNETCORE_ENVIRONMENT: Development
      ConnectionStrings__DefaultConnection: Host=postgres;Database=agro_db;Username=postgres;Password=postgres
    depends_on:
      - postgres
      - redis

  sensor-ingest:
    build: ./services/agro-sensor-ingest-service
    ports:
      - "5003:80"
    environment:
      ASPNETCORE_ENVIRONMENT: Development
      ConnectionStrings__DefaultConnection: Host=postgres;Database=agro_db;Username=postgres;Password=postgres
      RabbitMQ__Host: rabbitmq
    depends_on:
      - postgres
      - rabbitmq

  analytics-worker:
    build: ./services/agro-analytics-worker
    environment:
      ASPNETCORE_ENVIRONMENT: Development
      ConnectionStrings__DefaultConnection: Host=postgres;Database=agro_db;Username=postgres;Password=postgres
      RabbitMQ__Host: rabbitmq
    depends_on:
      - postgres
      - rabbitmq

  dashboard-api:
    build: ./services/agro-dashboard-service
    ports:
      - "5004:80"
    environment:
      ASPNETCORE_ENVIRONMENT: Development
      ConnectionStrings__DefaultConnection: Host=postgres;Database=agro_db;Username=postgres;Password=postgres
      Redis__Host: redis
    depends_on:
      - postgres
      - redis

volumes:
  postgres_data:
```

---

## 📚 Step 7: Documentation Structure

### SOLUTION_ARCHITECTURE.md (Parent Repo)
```markdown
# Solution Architecture - TC Agro Solutions

## Overview
Monorepo solution with microservices in separate Git repositories managed via Git submodules.

## Repository Map
| Component | Repository | Type |
|-----------|-----------|------|
| Parent/Infrastructure | tc-agro-solutions | Parent |
| Identity Service | agro-identity-service | Submodule (services/) |
| Farm Service | agro-farm-service | Submodule (services/) |
| ... | ... | ... |
| Shared Library | agro-shared-library | Submodule (common/) |

## Getting Started
\`\`\`bash
# Clone with all services
git clone --recurse-submodules git@github.com:your-org/tc-agro-solutions.git
cd tc-agro-solutions

# Start local development
docker-compose up -d

# All services now running on ports 5001-5004
\`\`\`

## CI/CD with Submodules
- Each service repo has its own GitHub Actions
- Parent repo triggers tests when submodules are updated
- ArgoCD uses parent repo Kubernetes manifests
```

---

## 🚀 Step 8: CI/CD Integration

### GitHub Actions - Parent Repo Workflow
```yaml
# .github/workflows/deploy-solution.yml

name: Deploy Solution to AKS

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
        with:
          submodules: 'recursive'  # Clone with submodules
      
      - name: Build services
        run: |
          chmod +x scripts/build-all-services.sh
          ./scripts/build-all-services.sh
      
      - name: Push to ACR
        run: |
          az acr login --name $ACR_NAME
          docker push $ACR_NAME.azurecr.io/agro-identity-service:latest
          # ... push other services
      
      - name: Deploy via ArgoCD
        run: |
          kubectl apply -f infrastructure/kubernetes/
```

---

## 💡 Best Practices

### ✅ DO
- Use `--recurse-submodules` when cloning
- Run `git submodule update --remote` regularly to sync submodules
- Keep parent repo lightweight (infra, docs, scripts only)
- Each service repo has its own CI/CD pipeline
- Document in SOLUTION_ARCHITECTURE.md how to work with submodules

### ❌ DON'T
- Modify submodule files directly in parent repo
- Commit submodule files in parent .gitignore
- Leave submodules in detached HEAD state without understanding
- Forget to push parent repo after updating submodule references

---

## 🔧 Troubleshooting

### Submodule Not Cloned
```bash
# If you cloned without --recurse-submodules:
git submodule init
git submodule update --recursive
```

### Submodule in Detached HEAD
```bash
# Navigate to submodule
cd services/agro-identity-service

# Check current state
git status

# Attach to main branch
git checkout main
git pull
```

### Undo Submodule Changes
```bash
# Revert submodule to committed version
cd services/agro-identity-service
git checkout .

# Or from parent:
git submodule update --force
```

### Remove Submodule (if needed)
```bash
# Remove from git
git submodule deinit -f services/agro-identity-service
rm -rf .git/modules/services/agro-identity-service

# Update .gitmodules and commit
git rm services/agro-identity-service
git commit -m "chore: remove agro-identity-service submodule"
```

---

## 📊 Example Workflow

### Developer A: Working on Identity Service
```bash
# Clone solution with all services
git clone --recurse-submodules git@github.com:your-org/tc-agro-solutions.git
cd tc-agro-solutions/services/agro-identity-service

# Create feature branch
git checkout -b feature/oauth-support

# Make changes
# ... edit code ...

# Commit to service repo
git add src/
git commit -m "feat: add OAuth2 support"
git push origin feature/oauth-support

# Open PR on agro-identity-service repo
# After merge to main, update parent:
cd ../..
git submodule update --remote services/agro-identity-service
git add services/agro-identity-service
git commit -m "chore: update identity service with OAuth support"
git push origin main
```

### Developer B: Working on Farm Service
```bash
# Same process, different service
git clone --recurse-submodules git@github.com:your-org/tc-agro-solutions.git
cd tc-agro-solutions/services/agro-farm-service

# ... work on farm service ...
```

### DevOps: Deploy Solution
```bash
# Clone with all services
git clone --recurse-submodules git@github.com:your-org/tc-agro-solutions.git
cd tc-agro-solutions

# All submodules automatically have latest versions from main branches

# Deploy infrastructure
cd infrastructure
terraform apply

# Deploy Kubernetes manifests
kubectl apply -f kubernetes/
```

---

## 🎯 Summary

| Task | Command |
|------|---------|
| Clone with submodules | `git clone --recurse-submodules <url>` |
| Initialize submodules | `git submodule init && git submodule update --recursive` |
| Update all submodules | `git submodule update --remote` |
| Update single submodule | `cd services/<name> && git pull origin main` |
| Add new submodule | `git submodule add <repo-url> <path>` |
| Commit submodule update | `git add <submodule-path> && git commit -m "chore: update <name>"` |

---

> **Version:** 1.0  
> **Date:** January 9, 2026  
> **Status:** Ready for implementation  
> **Next Steps:** Create separate repositories on GitHub and add as submodules
---

## 📁 .gitignore Strategy with Submodules

### Core Concept

**Each Git repository has its own `.gitignore` INDEPENDENT.**

```
tc-agro-solutions/                  ← Parent repo
├── .gitignore                      ← Ignores parent-level items
├── services/
│   └── agro-farm-service/          ← Submodule (Git repository)
│       └── .gitignore              ← Ignores farm SERVICE items
├── common/
│   └── agro-shared-library/        ← Submodule (Git repository)
│       └── .gitignore              ← Ignores shared library items
└── infrastructure/
    └── .gitignore                  ← Ignores infrastructure items
```

**Result:** Multiple `.gitignore` files, working **independently**.

### Parent Repository `.gitignore`

Controls what is ignored at the **parent level** (tc-agro-solutions/.gitignore):

```bash
# Build outputs (parent level)
build/
dist/
*.out

# Terraform state
*.tfstate
*.tfstate.backup
.terraform/
.terraform.lock.hcl
terraform.tfvars

# Infrastructure
.kube/
kubeconfig

# Environment
.env.deployment

# IDE / Editor
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db
*.log
```

**⚠️ IMPORTANT:** Do NOT include submodule directories (like `bin/`, `obj/`) because:
- Each submodule has its own `.gitignore`
- Ignoring in parent creates confusion
- Leaves full control to each repository

### Submodule `.gitignore` Template

For .NET services (services/agro-farm-service/.gitignore):

```bash
# .NET / C#
bin/
obj/
*.dll
*.exe
*.pdb
.vs/
.vscode/
*.user
packages/

# Environment & Secrets
.env
.env.local
.env.*.local
appsettings.Secrets.json
secrets.json

# IDE
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Build artifacts
*.nupkg
*.snupkg
```

### How It Works

#### Example 1: Building a Service

```bash
cd tc-agro-solutions/services/agro-farm-service
dotnet build

# Creates:
# - bin/  ← Ignored by services/agro-farm-service/.gitignore
# - obj/  ← Ignored by services/agro-farm-service/.gitignore

# Git status in farm service:
git status
# Output: nothing to commit, working tree clean

# Git status in parent:
cd ../..
git status
# Output: nothing to commit, working tree clean
```

#### Example 2: Code Changes in Submodule

```bash
cd services/agro-farm-service
# Edit code
vim src/Features/Properties/CreatePropertyHandler.cs

# Git status in service:
git status
# Output: modified: src/Features/Properties/CreatePropertyHandler.cs

# Git status in parent:
cd ../..
git status
# Output: modified: services/agro-farm-service (modified content)
```

#### Example 3: Environment Files

```bash
cd services/agro-farm-service
echo "DB_PASSWORD=secret123" > .env

# Git status in service:
git status
# Output: nothing to commit (.env is ignored)

# Git status in parent:
cd ../..
git status
# Output: nothing to commit
```

### Common Workflow

#### Setup (First Time)
```bash
git clone --recurse-submodules https://github.com/org/tc-agro-solutions.git
cd tc-agro-solutions

# Verify .gitignore files exist
ls -la .gitignore
ls -la services/agro-farm-service/.gitignore
ls -la common/agro-shared-library/.gitignore
```

#### Development Routine
```bash
# Build service (generates bin/, obj/ — ignored)
cd services/agro-farm-service
dotnet build

# Status check (clean, no artifacts)
git status  # ✅ clean

# Edit code
# ... work on features ...

# Commit (only code, no bin/, obj/, .env)
git add .
git commit -m "feat: add plot validation"
git push origin feature/plot-validation

# Back to parent
cd ../..
git status  # shows farm service was updated

# Update parent to latest farm version
git add services/agro-farm-service
git commit -m "chore: update farm service"
git push
```

#### Verify Everything is Correct
```bash
# Ensure .gitignore is being tracked
git status .gitignore  # should be tracked

# See what's being tracked in a submodule
cd services/agro-farm-service
git ls-files  # lists ALL tracked files

# Confirm bin/, obj/ are NOT in the list
git ls-files | grep bin  # should return nothing
```

### Troubleshooting

#### Issue: Accidentally Committed Build Artifacts

**Solution:**
```bash
cd services/agro-farm-service

# Add to .gitignore
echo "bin/" >> .gitignore
echo "obj/" >> .gitignore

# Remove from Git (but keep locally)
git rm -r --cached bin/ obj/

# Commit
git commit -m "chore: ignore build artifacts"
```

#### Issue: .gitignore Not Working

**Solution:**
```bash
# Clear Git cache and re-add everything
git rm --cached -r .
git add -A
git commit -m "chore: reset git tracking"
```

### Best Practices Summary

| What | Parent `.gitignore` | Submodule `.gitignore` |
|------|---------------------|------------------------|
| **Controls** | What is ignored in parent repo | What is ignored in submodule repo |
| **Affects** | `git status` in parent | `git status` in submodule |
| **Should Ignore** | Infrastructure files, parent-level build outputs | Service-specific artifacts (bin/, obj/, .env) |
| **Should NOT Ignore** | Submodule artifacts | Parent-level files |

### References

- [Git .gitignore Documentation](https://git-scm.com/docs/gitignore)
- [Git Submodules](https://git-scm.com/book/en/v2/Git-Tools-Submodules)
- [GitHub .gitignore Templates](https://github.com/github/gitignore)