# Documentation Index

**Last Updated:** January 15, 2026

---

## 🎯 Start Here

### For New Developers

1. **[README.md](README.md)** - Project overview (5 min read)
2. **[TRAEFIK_ROUTING_GUIDE.md](TRAEFIK_ROUTING_GUIDE.md)** - How routes work (10 min read)
3. **[TESTING_TRAEFIK_ROUTES.md](TESTING_TRAEFIK_ROUTES.md)** - Verify everything works (5 min read)

### For Cluster Setup

1. **[scripts/k3d/README.md](scripts/k3d/README.md)** - k3d workflow
2. **[scripts/k3d/bootstrap.ps1](scripts/k3d/bootstrap.ps1)** - Run this first

### For Architecture Decisions

1. **[docs/adr/ADR-001-microservices.md](docs/adr/ADR-001-microservices.md)** - Why microservices?
2. **[docs/adr/ADR-007-node-pool-strategy.md](docs/adr/ADR-007-node-pool-strategy.md)** - Why these node pools?

---

## 📚 Complete Documentation Map

### Infrastructure & Setup

```
scripts/k3d/
├── README.md                    ← k3d cluster management guide
├── bootstrap.ps1                ← Create cluster + ArgoCD
├── cleanup.ps1                  ← Delete cluster
├── manager.ps1                  ← Interactive menu
├── port-forward.ps1             ← Port forwarding helper
└── ARCHITECTURE_DIAGRAM.md      ← Visual cluster overview
```

### Networking & Routing

```
Root (./)
├── TRAEFIK_ROUTING_GUIDE.md     ← 📘 MAIN: Traefik routing (MUST READ)
├── TRAEFIK_COMPLETE.md          ← ✅ Implementation summary
├── TESTING_TRAEFIK_ROUTES.md    ← 🧪 Testing & troubleshooting
```

### Kubernetes Manifests

```
infrastructure/kubernetes/
├── apps/
│   ├── README.md
│   └── base/frontend/
│       ├── ingressroute.yaml    ← Frontend routing (Traefik)
│       ├── deployment.yaml
│       ├── service.yaml
│       └── kustomization.yaml
│
└── platform/
    ├── README.md
    └── base/
        ├── ingress/
        │   └── arcocd-ingressroute.yaml  ← ArgoCD routing (Traefik)
        └── kustomization.yaml
```

### Architecture Decisions (ADRs)

```
docs/adr/
├── ADR-001-microservices.md         ← Microservices pattern
├── ADR-002-persistence.md           ← Database strategy
├── ADR-003-timeseries.md            ← TimescaleDB for sensors
├── ADR-004-observability.md         ← Metrics, logs, traces
├── ADR-005-local-vs-cloud.md        ← Dev vs production
├── ADR-006-local-orchestration.md   ← Docker Compose vs Aspire
└── ADR-007-node-pool-strategy.md    ← AKS-like node pools
```

### Architecture Documentation

```
docs/architecture/
├── c4-context.md                    ← System context diagram
├── c4-container.md                  ← Container architecture
└── infrastructure-terraform.md      ← Terraform for Azure
```

### Development Guides

```
docs/development/
├── local-setup.md                   ← Local Docker Compose setup
└── (other guides)
```

### Frontend POC

```
poc/frontend/
├── README.md                    ← Frontend overview
├── Dockerfile                   ← Multi-stage build
├── vite.config.js               ← Dynamic base path config
├── package.json                 ← npm scripts (build:k8s)
└── nginx.conf                   ← Static file serving
```

---

## 🔗 Quick Navigation

### I want to...

#### ...understand the project
→ Read [README.md](README.md)

#### ...understand routing
→ Read [TRAEFIK_ROUTING_GUIDE.md](TRAEFIK_ROUTING_GUIDE.md)

#### ...test if routes work
→ Follow [TESTING_TRAEFIK_ROUTES.md](TESTING_TRAEFIK_ROUTES.md)

#### ...create a k3d cluster
→ Run `scripts/k3d/bootstrap.ps1`

#### ...understand architecture decisions
→ Browse [docs/adr/](docs/adr/)

#### ...develop locally without Kubernetes
→ Follow [docs/development/local-setup.md](docs/development/local-setup.md)

#### ...deploy to Azure
→ Read [docs/architecture/infrastructure-terraform.md](docs/architecture/infrastructure-terraform.md)

#### ...add a new microservice
→ Follow [NEW_MICROSERVICE_TEMPLATE.md](NEW_MICROSERVICE_TEMPLATE.md)

#### ...understand the roadmap
→ Read [README_ROADMAP.md](README_ROADMAP.md)

---

## 📊 Documentation Status

| Document | Purpose | Status | Audience |
|----------|---------|--------|----------|
| **README.md** | Project overview | ✅ Updated | Everyone |
| **TRAEFIK_ROUTING_GUIDE.md** | Complete routing guide | ✅ Main reference | DevOps, Backend |
| **TRAEFIK_COMPLETE.md** | Implementation summary | ✅ Summary | Everyone |
| **TESTING_TRAEFIK_ROUTES.md** | Testing procedures | ✅ Troubleshooting | QA, DevOps |
| **README_ROADMAP.md** | Technical roadmap | ✅ Complete | Architects |
| **docs/adr/** | Architecture decisions | ✅ Complete | Architects |
| **scripts/k3d/README.md** | k3d workflow | ✅ Complete | DevOps, Backend |

---

## 🗑️ Removed Documentation

The following outdated/duplicate documents were removed:

- ❌ TRAEFIK_NATIVE_ANALYSIS.md (superseded by TRAEFIK_ROUTING_GUIDE.md)
- ❌ TRAEFIK_IMPLEMENTATION_SUMMARY.md (superseded by TRAEFIK_COMPLETE.md)
- ❌ TRAEFIK_IMPLEMENTATION_ANSWERS.md (superseded by TRAEFIK_ROUTING_GUIDE.md)
- ❌ TRAEFIK_TESTING_GUIDE.md (superseded by TESTING_TRAEFIK_ROUTES.md)
- ❌ IMPLEMENTATION_COMPLETE.md (obsolete)
- ❌ README_INDEX_TRAEFIK.md (superseded by this file)

---

## 📝 Writing Guidelines (For Contributors)

### Language
- ✅ All documentation in **English**
- ✅ Consistent terminology
- ✅ Code examples for clarity

### Format
- ✅ Markdown (.md files)
- ✅ Clear headings (H1, H2, H3)
- ✅ Code blocks with syntax highlighting
- ✅ Links to related docs

### Location
- ✅ Root docs go in `/` (README.md, TRAEFIK_*.md, etc.)
- ✅ Architecture in `docs/architecture/`
- ✅ Decisions in `docs/adr/`
- ✅ Development guides in `docs/development/`
- ✅ Infrastructure scripts in `scripts/k3d/`

---

## 🔄 Version History

| Date | Change |
|------|--------|
| 2026-01-15 | Consolidated Traefik documentation, removed duplicates |
| 2026-01-15 | Created DOCUMENTATION_INDEX.md |
| 2026-01-15 | Updated README.md to reference Traefik |

---

## 📞 Questions?

- **About routing:** See [TRAEFIK_ROUTING_GUIDE.md](TRAEFIK_ROUTING_GUIDE.md)
- **About testing:** See [TESTING_TRAEFIK_ROUTES.md](TESTING_TRAEFIK_ROUTES.md)
- **About architecture:** See [docs/adr/](docs/adr/)
- **About cluster setup:** See [scripts/k3d/README.md](scripts/k3d/README.md)

