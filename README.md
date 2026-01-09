# 🌾 TC Agro Solutions - Phase 5 (Hackathon 8NETT)

Agricultural monitoring platform with IoT, sensor data processing, alerts, and dashboards on Azure Kubernetes Service.

**Deadline:** February 27, 2026  
**Team:** 4 backend developers  
**Architecture:** Microservices on AKS with Git submodules

---

## 🎯 Quick Start

### Clone with All Services
```bash
git clone --recurse-submodules git@github.com:your-org/tc-agro-solutions.git
cd tc-agro-solutions

# Start local development environment
docker-compose up -d

# Verify all services are running
curl http://localhost:5001/health  # Identity
curl http://localhost:5002/health  # Farm
curl http://localhost:5003/health  # Sensor Ingest
curl http://localhost:5004/health  # Dashboard
```

### Deploy to Azure
```bash
cd infrastructure
terraform init
terraform plan
terraform apply

# Deploy applications via ArgoCD (configured in Kubernetes)
```

---

## 📊 Solution Architecture

### Parent Repository (this repo)
```
tc-agro-solutions/
├── infrastructure/          # Terraform IaC for AKS
├── kubernetes/             # Kubernetes manifests
├── scripts/                # Automation scripts
├── docs/                   # Architecture & ADRs
└── docker-compose.yml      # Local development
```

### Service Repositories (Submodules)
```
services/
├── agro-identity-service/          # Authentication & Authorization
├── agro-farm-service/              # Properties & Plots management
├── agro-sensor-ingest-service/     # Sensor data ingestion
├── agro-analytics-worker/          # Rules & alerts processing
└── agro-dashboard-service/         # Optimized dashboards & reads

common/
├── agro-shared-library/            # Shared utilities & validators
├── agro-domain-models/             # Domain entities & DTOs
└── agro-integration-tests/         # Shared test fixtures
```

**See [GIT_SUBMODULES_STRATEGY.md](GIT_SUBMODULES_STRATEGY.md) for detailed structure and workflows.**

---

## 🏗️ Key Documentation

### Quick References
- **[⚡ Quick Start - Submodules (5 min)](QUICK_START_SUBMODULES.md)** - Clone and run in 5 minutes
- **[🔗 Git Submodules Strategy](GIT_SUBMODULES_STRATEGY.md)** - Complete setup & workflow guide

### Architecture & Decisions
- [Technical Roadmap](README_ROADMAP.md) - Complete strategy & timeline
- [C4 Context Diagram](docs/architecture/c4-context.md) - System context
- [C4 Container Diagram](docs/architecture/c4-container.md) - Component structure
- [Architectural Decision Records](docs/adr/) - All decisions (ADR-001 to ADR-007)

### Infrastructure
- [Terraform Infrastructure Guide](docs/architecture/infrastructure-terraform.md) - IaC implementation
- [AKS Node Pool Strategy](docs/adr/ADR-007-node-pool-strategy.md) - Performance & cost optimization
- [Node Pool Quick Reference](terraform/AKS_NODE_POOLS_REFERENCE.md) - Ready-to-use HCL

### Development
- [Local Development Setup](docs/development/local-setup.md) - Docker Compose guide
- [Copilot Instructions](https://github.com/your-org/tc-agro-solutions/blob/main/.github/copilot-instructions.md) - Coding standards

---

## 🛠️ Technology Stack

### Backend
- **Language:** C# / .NET 9
- **Framework:** FastEndpoints (not MVC Controllers)
- **ORM:** Entity Framework Core 9
- **Messaging:** Wolverine + Azure Service Bus
- **Pattern:** Pragmatic CQRS (no full event sourcing)

### Cloud Infrastructure
- **Orchestration:** Azure Kubernetes Service (AKS)
- **Database:** Azure PostgreSQL Flexible Server + TimescaleDB
- **Cache:** Azure Redis Cache
- **Messaging:** Azure Service Bus
- **Registry:** Azure Container Registry (ACR)
- **Observability:** Application Insights + Log Analytics

### Local Development
- **Orchestration:** Docker Compose
- **Database:** PostgreSQL 16
- **Cache:** Redis 7
- **Messaging:** RabbitMQ (Azure Service Bus replacement)

---

## 📅 Development Timeline (Phase 5)

| Phase | Duration | Focus |
|-------|----------|-------|
| **Phase 0** | Week 1 | Infra setup, code structure, local environment |
| **Phase 1** | Weeks 1-2 | Domain structure, API design, database schema |
| **Phase 2** | Weeks 2-3 | Data modeling, performance testing, aggregations |
| **Phase 3** | Weeks 3-4 | Ingestion endpoints, alerts worker, dashboards |
| **Phase 4** | Weeks 4-5 | Code quality, observability, testing |
| **Phase 5** | Weeks 5-6 | Integrated demo, dashboards, presentation |

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

## 🔗 Git Submodules Quick Guide

### Clone Everything
```bash
git clone --recurse-submodules git@github.com:your-org/tc-agro-solutions.git
cd tc-agro-solutions
```

### Update All Services
```bash
git submodule update --remote
```

### Work on a Service
```bash
cd services/agro-identity-service
git checkout -b feature/new-feature
# ... make changes ...
git push origin feature/new-feature
# After merge, update parent:
cd ../..
git submodule update --remote
git add services/agro-identity-service
git commit -m "chore: update identity service"
```

**Quick Start:** [⚡ 5-Minute Guide](QUICK_START_SUBMODULES.md)  
**Detailed Guide:** [🔗 Complete Strategy](GIT_SUBMODULES_STRATEGY.md)

---

## 📊 AKS Node Pool Strategy

Three optimized node pools for stability, performance, and cost:

| Pool | SKU | Min-Max | Workload |
|------|-----|---------|----------|
| **system** | B2ms (8GB) | 1-2 | Kubernetes infrastructure |
| **platform** | B2s (4GB) | 1-3 | ArgoCD, Ingress, cert-manager |
| **worker** | B2s (4GB) | 2-5 | .NET APIs, workers |

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
1. Clone solution: `git clone --recurse-submodules <url>`
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
2. Check [Git Submodules Strategy](GIT_SUBMODULES_STRATEGY.md)
3. Review all [ADRs](docs/adr/) for decision context

---

## 🔄 Workflow Examples

### Adding a New Microservice
1. Create new repository: `agro-new-service`
2. Add as submodule: `git submodule add git@github.com:org/agro-new-service.git services/agro-new-service`
3. Add Kubernetes manifest in `infrastructure/kubernetes/`
4. Configure in ArgoCD
5. Commit: `git add . && git commit -m "feat: add new microservice"`

### Deploying a Service Update
1. Developer creates PR in service repo
2. Service repo CI/CD runs tests, builds Docker image
3. After merge, parent repo is updated via: `git submodule update --remote`
4. ArgoCD detects new image and rolls out to AKS

### Local Development with Service Changes
```bash
# Clone solution
git clone --recurse-submodules <url>
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
- [Git Submodules Strategy](GIT_SUBMODULES_STRATEGY.md)
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
- **Repositories:** 1 parent + 8 submodules (5 services + 3 shared)
- **Documentation:** 8 ADRs + architecture guides
- **Test Coverage:** Unit, integration, load, smoke tests
- **Deployment:** Azure AKS via Terraform + ArgoCD

---

> **Version:** 2.0 - Submodule-ready architecture  
> **Last Updated:** January 9, 2026  
> **Status:** Production-ready for Phase 5 delivery  
> **Deadline:** February 27, 2026 ✅
