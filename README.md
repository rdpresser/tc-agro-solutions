# 🌾 TC Agro Solutions - Phase 5 (Hackathon 8NETT)

Agricultural monitoring platform with IoT, sensor data processing, alerts, and dashboards.

**Status:** 🔵 Developing locally on k3d | 🟣 Azure deployment planned post-hackathon

**Deadline:** February 27, 2026  
**Team:** 4 backend developers  
**Architecture:** Microservices with GitOps (localhost k3d → future Azure AKS)

---

## 🎯 Development Environment (Localhost - CURRENT)

**All developers work locally with k3d and Docker Compose. Zero cloud costs.**

```powershell
cd scripts\k3d
.\bootstrap.ps1  # Creates full k3d cluster + observability stack (~4 minutes)
```

**What you get:**

- ✅ k3d Kubernetes cluster (4 nodes on localhost)
- ✅ 5 microservices deployed via ArgoCD
- ✅ PostgreSQL + TimescaleDB (Docker)
- ✅ Redis (Docker)
- ✅ RabbitMQ (Docker)
- ✅ Prometheus + Grafana + Loki + Tempo + OTel (observability stack)
- ✅ Traefik ingress (k3s built-in)
- ✅ ArgoCD (GitOps controller)

**Infrastructure location:** `infrastructure/kubernetes/platform/` (k3d-optimized configs)

---

## 🎯 Two Development Modes

### 🐳 Docker Compose Mode (API Development)

Simple local environment for API development without Kubernetes complexity.

```powershell
docker compose up -d  # PostgreSQL + Redis + RabbitMQ
dotnet run --project services/farm-service/src/Agro.Farm.Api
```

**Best for:** Coding APIs, debugging services, database migrations

---

### ☸️ K3D Mode (Full Stack + GitOps)

Complete Kubernetes cluster with full observability stack managed via ArgoCD GitOps.

```powershell
cd scripts\k3d
.\bootstrap.ps1  # Creates cluster + ArgoCD installs everything
```

**What you get:**

- ✅ k3d cluster (4 nodes: 1 server + 3 agents)
- ✅ 🐳 Local registry at `localhost:5000` (auto-configured!)
- ✅ **Traefik** (k3s built-in ingress controller)
- ✅ ArgoCD (GitOps controller)
- ✅ **Auto-installed via GitOps:**
  - Prometheus + Grafana (metrics)
  - Loki (logs)
  - Tempo (traces)
  - OpenTelemetry Collector (telemetry hub)
  - KEDA (autoscaling)

**Routing (via Traefik):**

- 🌐 Frontend: `http://localhost/agro`
- 🔐 ArgoCD: `http://localhost/argocd`
- 📚 [Traefik Routing Guide](TRAEFIK_ROUTING_GUIDE.md) - Complete routing documentation

**Best for:** Testing K8s deployments, validating observability, rehearsing AKS production setup

**Time:** ~4 minutes for full stack

📚 **K3D Documentation:**

- [📖 K3D GitOps Guide](scripts/k3d/README.md) - Complete workflow
- [🐳 Registry Configuration](scripts/k3d/REGISTRY_CONFIGURATION.md) - How to build & push images
- [🏗️ Architecture Diagram](scripts/k3d/ARCHITECTURE_DIAGRAM.md) - Visual overview

---

## 🚀 Quick Start (Choose Your Mode)

### 1️⃣ Clone Repository

```powershell
git clone https://github.com/rdpresser/tc-agro-solutions.git
cd tc-agro-solutions
```

### 2️⃣ Run Bootstrap

**Windows:**

```powershell
# Clone all services and common libraries automatically
.\scripts\bootstrap.ps1
```

This will:

- Clone 5 microservices to `services/`
- Clone common libraries to `common/`
- Create `.env` with local configuration

### 3️⃣ Open Solution

```powershell
# Open in Visual Studio 2026
start tc-agro-solutions.sln
```

### 4️⃣ Start Infrastructure

```powershell
# Start PostgreSQL, Redis, RabbitMQ
docker compose up -d
```

**For detailed setup instructions, see [📖 Bootstrap Setup Guide](./docs/BOOTSTRAP_SETUP.md)**

---

## 🏗️ Solution Architecture

### Parent Repository (this repo)

```
tc-agro-solutions/
├── services/                # 🔄 Cloned by bootstrap.ps1
│   ├── identity-service/
│   ├── farm-service/
│   ├── sensor-ingest-service/
│   ├── analytics-worker/
│   └── dashboard-service/
├── common/                  # 🔄 Cloned by bootstrap.ps1
├── infrastructure/          # Terraform IaC for AKS
├── kubernetes/             # Kubernetes manifests
├── scripts/
│   └── bootstrap.ps1       # ⚙️ Setup automation
├── docs/                   # Architecture & ADRs
├── .env                    # 🔄 Created by bootstrap
└── docker-compose.yml      # (To be created)
```

---

## � Service Repositories

### Microservices (5 independent repositories)

| Service              | Repository                    | Folder                           | Purpose              |
| -------------------- | ----------------------------- | -------------------------------- | -------------------- |
| **Identity**         | tc-agro-identity-service      | `services/identity-service`      | Authentication & JWT |
| **Farm**             | tc-agro-farm-service          | `services/farm-service`          | Properties & Plots   |
| **Sensor Ingest**    | tc-agro-sensor-ingest-service | `services/sensor-ingest-service` | Data ingestion API   |
| **Analytics Worker** | tc-agro-analytics-worker      | `services/analytics-worker`      | Rules & alerts       |
| **Dashboard**        | tc-agro-dashboard-service     | `services/dashboard-service`     | Optimized reads      |

### Common Libraries

| Repository         | Folder    | Purpose                                     |
| ------------------ | --------- | ------------------------------------------- |
| **tc-agro-common** | `common/` | Shared utilities, validators, domain models |

**All services are cloned automatically by `bootstrap.ps1`**

---

## 🏗️ Key Documentation

### For Developers (First Time)

- **[🚀 Bootstrap Setup Guide](docs/BOOTSTRAP_SETUP.md)** - Quick setup with `bootstrap.ps1`
- **[🐳 Local Development Setup](docs/development/local-setup.md)** - Docker Compose guide
- **[🤖 Copilot Instructions](.github/copilot-instructions.md)** - Coding standards

### For Architects / Tech Leads

## 📚 Documentation

### Getting Started

- **[🚀 Bootstrap Setup Guide](docs/BOOTSTRAP_SETUP.md)** - Quick setup with `bootstrap.ps1` ⭐ **START HERE**
- **[🧑‍💻 Local Development](docs/development/local-setup.md)** - Detailed local environment guide

### Architecture & Design

- **[🗺️ Technical Roadmap](README_ROADMAP.md)** - Complete strategy, phases, deliverables
- **[✅ Requirements Mapping](docs/REQUIREMENTS_MAPPING.md)** - Hackathon spec → roadmap traceability
- **[📋 Architectural Decision Records (ADRs)](docs/adr/)** - All decisions (001-007)
- **[📊 C4 Diagrams](docs/architecture/)** - System context + container diagrams

### Infrastructure & Deployment

- **[🏗️ Terraform Infrastructure Guide](docs/architecture/infrastructure-terraform.md)** - IaC implementation
- **[⚙️ AKS Node Pool Strategy](docs/adr/ADR-007-node-pool-strategy.md)** - Performance + cost optimization
- **[📖 Node Pool Quick Reference](terraform/AKS_NODE_POOLS_REFERENCE.md)** - Ready-to-use HCL

### Development

- **[📝 New Microservice Template](NEW_MICROSERVICE_TEMPLATE.md)** - Step-by-step checklist

---

## 🛠️ Technology Stack

### Backend

- **Language:** C# / .NET 10
- **Framework:** FastEndpoints (not MVC Controllers)
- **ORM:** Entity Framework Core 10
- **Messaging:** Wolverine + Azure Service Bus
- **Pattern:** Pragmatic CQRS (no full event sourcing)

### Cloud Infrastructure (Production)

- **Orchestration:** Azure Kubernetes Service (AKS)
- **Database:** Azure PostgreSQL Flexible Server + TimescaleDB
- **Cache:** Azure Redis Cache
- **Messaging:** Azure Service Bus
- **Registry:** Azure Container Registry (ACR)
- **Observability:** Application Insights + Log Analytics

### Local Development (Two Modes)

#### 🐳 Docker Compose Mode (Recommended for API development)

- **Orchestration:** Docker Compose
- **Database:** PostgreSQL 16
- **Cache:** Redis 7
- **Messaging:** RabbitMQ (Azure Service Bus replacement)

#### ☸️ K3D Mode (Recommended for K8s/GitOps testing)

- **Orchestration:** k3d (lightweight Kubernetes)
- **Platform Stack:** GitOps via ArgoCD (Prometheus, Grafana, Loki, Tempo, KEDA)
- **Cluster:** 18GB total (1 server 2GB + 2 agents: system 6GB + apps 10GB)
- **Registry:** localhost:5000 (local image registry)

**Choose your mode:**

- 🐳 **Docker Compose** → Simple API development
- ☸️ **K3D** → Full K8s with observability stack

**Quick Start K3D:**

```powershell
cd scripts\k3d
.\bootstrap.ps1
# Wait ~4 minutes for full GitOps deployment
```

See [📖 K3D GitOps Guide](scripts/k3d/README.md) for details.

---

## 📅 Development Timeline (Phase 5)

| Phase       | Duration  | Focus                                            |
| ----------- | --------- | ------------------------------------------------ |
| **Phase 0** | Week 1    | Infra setup, code structure, local environment   |
| **Phase 1** | Weeks 1-2 | Domain structure, API design, database schema    |
| **Phase 2** | Weeks 2-3 | Data modeling, performance testing, aggregations |
| **Phase 3** | Weeks 3-4 | Ingestion endpoints, alerts worker, dashboards   |
| **Phase 4** | Weeks 4-5 | Code quality, observability, testing             |
| **Phase 5** | Weeks 5-6 | Integrated demo, dashboards, presentation        |

---

## 🚀 Microservices

### 🔐 Agro.Identity.Api

Authentication, authorization, user management via JWT tokens.

**Repo:** `git@github.com:your-org/agro-identity-service.git`

### 🌾 Agro.Farm.Api

Properties, plots, sensors management (CRUD with caching).

**Repo:** `git@github.com:your-org/agro-farm-service.git`

### 📡 Agro.Sensor.Ingest.Api

Receives sensor data, validates, persists to TimescaleDB, publishes events.

**Repo:** `git@github.com:your-org/agro-sensor-ingest-service.git`

### 📈 Agro.Analytics.Worker

Consumes events, applies rules, generates alerts (background worker).

**Repo:** `git@github.com:your-org/agro-analytics-worker.git`

### 📊 Agro.Dashboard.Api

Optimized queries, aggregations, caching for dashboards.

**Repo:** `git@github.com:your-org/agro-dashboard-service.git`

---

## 💾 Data Model

### Core Tables

```
Identity
├── Users (email, password_hash, status)
├── Roles (name)
└── UserRoles (user_id, role_id)

Farm
├── Properties (name, location, owner)
├── Plots (property_id, name, crop_type, area)
└── Sensors (plot_id, type, status)

Sensor Data (TimescaleDB Hypertable)
├── sensor_readings (time, sensor_id, temperature, humidity, soil_moisture)

Analytics
├── Rules (plot_id, metric, condition, threshold)
├── Alerts (rule_id, timestamp, message, status)
└── AuditLog (entity, action, user_id, timestamp)
```

---

## AKS Node Pool Strategy

Three optimized node pools for stability, performance, and cost:

| Pool         | SKU        | Min-Max | Workload                      |
| ------------ | ---------- | ------- | ----------------------------- |
| **system**   | B2ms (8GB) | 1-2     | Kubernetes infrastructure     |
| **platform** | B2s (4GB)  | 1-3     | ArgoCD, Ingress, cert-manager |
| **worker**   | B2s (4GB)  | 2-5     | .NET APIs, workers            |

**Est. Cost:** $375–575/month  
**Details:** [ADR-007: AKS Node Pool Strategy](docs/adr/ADR-007-node-pool-strategy.md)

---

## 🔐 Security

### JWT Authentication

All APIs protected with JWT Bearer tokens (except login endpoint).

### Validation

FluentValidation on all endpoints.

### Secrets Management

Azure Key Vault for production secrets.

### Network

- APIs behind Ingress Controller
- Service-to-service via Kubernetes DNS
- External requests only via Ingress

---

## 📈 Observability

### Application Insights

- Custom metrics (ingestion rate, processing time)
- Distributed tracing (correlation IDs)
- Dependency tracking

### Log Analytics

- Centralized logs from all services
- KQL queries for analysis

### Azure Monitor Workbooks

- Real-time system health dashboard
- Alert status and trends
- Query performance metrics

---

## 🧪 Testing

### Unit Tests

xUnit with NSubstitute/Moq for each service.

### Integration Tests

API endpoint tests with in-memory database.

### Load Tests

k6 simulating 100+ sensors with continuous readings.

### Smoke Tests

Automated post-deployment validation.

---

## 📚 Documentation Structure

```
docs/
├── adr/                          # Architectural Decision Records
│   ├── ADR-001-microservices.md
│   ├── ADR-002-persistence.md
│   ├── ADR-003-timeseries.md
│   ├── ADR-004-observability.md
│   ├── ADR-005-local-vs-cloud.md
│   ├── ADR-006-local-orchestration.md
│   └── ADR-007-node-pool-strategy.md
├── architecture/                 # Architecture Documentation
│   ├── c4-context.md
│   ├── c4-container.md
│   ├── infrastructure-terraform.md
│   └── data-model.md
└── development/                  # Developer Guides
    ├── local-setup.md
    ├── api-conventions.md
    ├── testing-strategy.md
    └── deployment-checklist.md
```

---

## 🚀 Getting Started

### For Developers

1. Clone solution: `.\scripts\bootstrap.ps1`
2. Start local env: `docker-compose up -d`
3. Read [Local Development Setup](docs/development/local-setup.md)
4. Check [Copilot Instructions](.github/copilot-instructions.md)

### For DevOps/Infrastructure

1. Review [Terraform Guide](docs/architecture/infrastructure-terraform.md)
2. Read [Node Pool Strategy](docs/adr/ADR-007-node-pool-strategy.md)
3. Check [Node Pool Reference](terraform/AKS_NODE_POOLS_REFERENCE.md)
4. Deploy: `cd infrastructure && terraform apply`

### For Team Leads

1. Review [Technical Roadmap](README_ROADMAP.md)
2. Review all [ADRs](docs/adr/) for decision context
3. Check [Architecture Documentation](docs/architecture/)

---

## 🔄 Workflow Examples

### Adding a New Microservice

1. Create new repository: `agro-new-service`
2. Clone it into `services/` folder locally
3. Add Kubernetes manifest in `infrastructure/kubernetes/`
4. Configure in ArgoCD
5. Commit: `git add . && git commit -m "feat: add new microservice"`

### Deploying a Service Update

1. Developer creates PR in service repo
2. Service repo CI/CD runs tests, builds Docker image
3. After merge, new image is deployed via ArgoCD

### Local Development with Service Changes

```bash
# Clone solution
git clone <url>
cd tc-agro-solutions

# Make changes in a service
cd services/agro-farm-service
# ... edit code ...

# Build and run locally
docker-compose build agro-farm-service
docker-compose up -d agro-farm-service

# Test via http://localhost:5002
```

---

## 🤝 Contributing

### Branch Naming

- Feature: `feature/description`
- Bugfix: `bugfix/description`
- Hotfix: `hotfix/description`

### Commit Messages

```
feat: add new endpoint
fix: resolve timeout issue
chore: update dependencies
docs: add ADR for decision
refactor: simplify query logic
test: add integration test
```

### Code Review

- All changes via pull request
- Minimum 1 approval required
- CI/CD must pass
- ADR required for architectural changes

---

## 📞 Support & Resources

### Documentation

- [Technical Roadmap](README_ROADMAP.md)
- [Bootstrap Setup](docs/BOOTSTRAP_SETUP.md)
- [All ADRs](docs/adr/)
- [Copilot Instructions](.github/copilot-instructions.md)

### External Resources

- [FastEndpoints](https://fast-endpoints.com/)
- [Wolverine](https://wolverine.netlify.app/)
- [TimescaleDB](https://docs.timescale.com/)
- [Azure AKS](https://learn.microsoft.com/azure/aks/)
- [Terraform](https://www.terraform.io/)

---

## 📝 License

This project is proprietary. All rights reserved.

---

## ✨ Key Metrics

- **Services:** 5 microservices
- **Repositories:** Independent git repositories per service
- **Documentation:** 8 ADRs + architecture guides
- **Test Coverage:** Unit, integration, load, smoke tests
- **Deployment:** Azure AKS via Terraform + ArgoCD

---

> **Version:** 2.1 - Independent service repositories  
> **Last Updated:** January 17, 2026  
> **Status:** Production-ready for Phase 5 delivery  
> **Deadline:** February 27, 2026 ✅
