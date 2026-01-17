# ADR-005: Local vs Cloud Development Strategy

## Status
✅ Accepted & **IMPLEMENTED (Phase 5)**

---

## Current Implementation

### 🔵 NOW (Phase 5 - Active)
- **Development:** k3d (localhost Kubernetes cluster)
- **Infrastructure services:** Docker Compose (PostgreSQL, Redis, RabbitMQ, observability stack)
- **GitOps:** ArgoCD managing k3d cluster
- **Location:** `scripts/k3d/` + `infrastructure/kubernetes/platform/` (k3d-specific configs)
- **Status:** ✅ Running daily by all developers

### 🟣 FUTURE (Post-Hackathon - Reference)
- **Production:** Azure Kubernetes Service (AKS)
- **Managed services:** Azure PostgreSQL, Azure Service Bus, Azure Redis, etc.
- **Location:** `terraform/` (Azure infrastructure modules)
- **Status:** 📋 Documented, NOT deployed during Phase 5

---

## Context

Phase 5 requires:
- **Cost-free development** for entire team (no Azure subscription charges during hackathon)
- **Real Kubernetes experience** - full k3d cluster, not just Docker Compose
- **Complete observability** - local observability stack (no cloud telemetry bills)
- **Architectural fidelity** - resembles production (Traefik ingress, namespaces, RBAC, ArgoCD)
- **Team parallelization** - all developers work independently without infrastructure conflicts

The team needs to develop and validate efficiently without cloud costs while maintaining architectural patterns for future production migration.

## Decision

Adopt **two strictly separated environments:**

### 🔵 Local Development Environment (CURRENT - ACTIVE)
- **Orchestration:** k3d (lightweight Kubernetes, 4 nodes: 1 server + 3 agents)
- **Networking:** Traefik ingress controller (k3s built-in), localhost-based routing
- **Cluster Management:** ArgoCD (installed via bootstrap script)
- **Configuration:** Kubernetes manifests in `infrastructure/kubernetes/platform/` (k3d-optimized)

- **Infrastructure Services (Docker Compose):**
  - PostgreSQL 15 + TimescaleDB extension → Replaces Azure PostgreSQL Flexible Server
  - Redis 7 → Replaces Azure Redis Cache
  - RabbitMQ 3.12 → Replaces Azure Service Bus
  - Prometheus + Grafana → Replaces Azure Monitor + Workbooks
  - Loki → Replaces Log Analytics
  - Tempo → Replaces distributed tracing (Application Insights)
  - OpenTelemetry Collector → Telemetry ingestion hub

- **Namespaces (Kubernetes):**
  - `argocd` - GitOps infrastructure
  - `agro-apps` - Microservices deployments
  - `monitoring` - Prometheus, Grafana, Loki, Tempo, OTel
  - `keda` - Autoscaling (Horizontal Pod Autoscaler, KEDA)

- **Development Workflow:**
  - Run `./scripts/k3d/bootstrap.ps1` → Full stack ready (~4 minutes)
  - Edit code locally → Services hot-reload via Docker Compose
  - Deploy to k3d → ArgoCD syncs changes
  - Observe metrics/logs → Grafana + Loki dashboard

### 🟣 Cloud Production Environment (FUTURE - REFERENCE ONLY)
- **Orchestration:** Azure Kubernetes Service (AKS)
- **Networking:** Azure Application Gateway or Traefik on AKS
- **Cluster Management:** ArgoCD (same as localhost)

- **Managed Services (Terraform modules):**
  - Azure PostgreSQL Flexible Server + TimescaleDB extension
  - Azure Redis Cache
  - Azure Service Bus (queues/topics)
  - Application Insights (metrics, traces, logs)
  - Log Analytics Workspace
  - Azure Monitor Workbooks
  - Azure Key Vault

- **Configuration:** Terraform modules in `terraform/` directory (documented but not deployed)

- **Deployment:** Post-hackathon migration (not Phase 5 scope)

## Justification
- Reduces development costs significantly
- Avoids excessive cloud dependency during development
- Enables parallel development by the entire team
- Maintains architectural fidelity between environments
- Allows rapid iteration without cloud provisioning delays

## Consequences
### Positive
- Zero cloud costs during development
- Faster feedback loops
- Team can work offline or with intermittent connectivity
- Easier debugging and troubleshooting

### Negative
- Local infrastructure does not replicate all Azure services
- Azure Service Bus must be simulated locally (RabbitMQ)
- Local observability is simplified (no Application Insights)
- Requires maintaining parity between environments

## Implementation Notes
- Use Docker Compose for local orchestration
- PostgreSQL runs locally (no Azure PostgreSQL Flexible Server)
- RabbitMQ replaces Azure Service Bus for local messaging
- Redis runs in a local container
- Environment-specific configurations via `appsettings.{Environment}.json`
- **Terraform only used for Azure (production)**, not for local development
- Single Terraform environment targeting Azure production resources
