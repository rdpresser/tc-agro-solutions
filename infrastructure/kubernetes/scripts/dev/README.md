# 🚀 tc-agro-solutions — Local k3d Development Scripts

**Purpose:** Automate k3d cluster creation and management for local development (Windows-first, PowerShell 7+)

**Status:** ✅ Ready to use

---

## 📋 Overview

This folder contains PowerShell scripts to:

1. **Create** an AKS-like k3d cluster with 18GB RAM (1 server + 2 agents: system/apps)
2. **Install** full observability stack (Prometheus + Grafana + Loki + Tempo + OTel)
3. **Manage** cluster (start/stop/cleanup)
4. **Build & push** Docker images to local registry
5. **Bootstrap** ArgoCD applications
6. **Configure** Ingress hostnames (Windows hosts file)
7. **Debug** secrets and manage port-forwards

---

## 🏗️ Cluster Architecture

```
┌─────────────────────────────────────────────────────┐
│             k3d Cluster (18GB total)               │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Server (Control-plane)        2GB / 2 vCPU       │
│  • Kubernetes API              (control plane only) │
│                                                     │
│  System Agent                  6GB / 2 vCPU       │
│  • ArgoCD                                          │
│  • Prometheus + Grafana                            │
│  • Loki (logs)                                     │
│  • Tempo (traces)                                  │
│  • OTel Collector                                  │
│  • Ingress Controller                              │
│  • KEDA                                            │
│                                                     │
│  Apps Agent                    10GB / 6 vCPU      │
│  • Agro microservices (when available)            │
│  • Databases (if in-cluster)                       │
│  • Workers                                         │
│                                                     │
└─────────────────────────────────────────────────────┘

Native Ingress Port Mapping (80:80, 443:443)
↓
http://argocd.local  (Argo CD)
http://agro.local    (App Ingress — after deploying)
```

**Key Details:**

- **RAM Budget:** 18GB cluster leaves headroom for Docker/host (no swap needed)
- **Observability:** Full APM stack with resource caps (Prom 1.5GB, Loki 1GB, Tempo 1GB, OTel 512Mi)
- **Registry:** localhost:5000 (local k3d registry)
- **Namespace:** `agro-apps` (application workloads)

---

## 📂 Scripts

| Script                        | Purpose                            | Idempotent                 |
| ----------------------------- | ---------------------------------- | -------------------------- |
| **k3d-manager.ps1**           | Interactive menu (entry point)     | ✅ Yes                     |
| **create-all-from-zero.ps1**  | Create cluster + full APM          | ✅ Yes                     |
| **start-cluster.ps1**         | Start cluster + validate readiness | ✅ Yes                     |
| **cleanup-all.ps1**           | Delete cluster + registry          | ✅ Yes (with confirmation) |
| **bootstrap-argocd-apps.ps1** | Apply ArgoCD app manifests         | ✅ Yes                     |
| **build-push-images.ps1**     | Build Docker images → k3d registry | ✅ Yes                     |
| **list-secrets.ps1**          | Debug: list/search K8s secrets     | ✅ Yes                     |
| **update-hosts-file.ps1**     | Manage Windows hosts file (admin)  | ✅ Yes                     |
| **port-forward.ps1**          | Setup background port-forwards     | ✅ Yes                     |
| **stop-port-forward.ps1**     | Kill port-forward processes        | ✅ Yes                     |

---

## 🚀 Quick Start

### 1️⃣ Create Cluster (First Time)

```powershell
cd infrastructure/kubernetes/scripts/dev

# Interactive menu (recommended)
.\k3d-manager.ps1

# Or direct script
.\create-all-from-zero.ps1
```

**Output:**

```
✅ Cluster created successfully
📊 CLUSTER SUMMARY:
   Name: dev
   Nodes: 1 server (2GB) + 2 agents (6GB + 10GB = 18GB total)
   Registry: localhost:5000

🔐 CREDENTIALS:
   ArgoCD admin: admin / Argo@123!
   Grafana admin: admin / admin
   Grafana extra: rdpresser / rdpresser@123

🔗 NEXT STEPS:
   1️⃣  Update Windows hosts file:
      .\k3d-manager.ps1 8

   2️⃣  Access Ingress (native port mapping — no port-forward needed!):
      ArgoCD: http://argocd.local
      Apps:   http://agro.local (after deploying)

   3️⃣  Access Observability (optional port-forward):
      .\k3d-manager.ps1 9
```

### 2️⃣ Update Windows Hosts File

```powershell
# Requires Administrator
.\update-hosts-file.ps1 add

# This adds:
# 127.0.0.1 argocd.local
# 127.0.0.1 agro.local
```

### 3️⃣ Access Services

**Ingress (native, no port-forward):**

- ArgoCD: http://argocd.local
- Apps: http://agro.local

**Observability (with port-forward):**

```powershell
.\port-forward.ps1 grafana
# Access: http://localhost:3000
# Credentials: admin / admin  OR  rdpresser / rdpresser@123
```

---

## 🎯 Interactive Menu (k3d-manager.ps1)

```
╔════════════════════════════════════════════════════════════╗
║       k3d-manager — TC Agro Solutions Local Dev            ║
║       Cluster: dev | Registry: localhost:5000              ║
║       Namespace: agro-apps                                 ║
╚════════════════════════════════════════════════════════════╝

📋 CLUSTER OPERATIONS:
  1) Create cluster (1 server + 2 agents, full APM stack)
  2) Start cluster
  3) Status (show nodes, namespaces, services)
  4) Cleanup cluster (delete everything)

🛠️  APPLICATION OPERATIONS:
  5) Build & push images (frontend to localhost:5000)
  6) Bootstrap ArgoCD applications
  7) List & search secrets (debug)

🌐 NETWORKING & ACCESS:
  8) Update Windows hosts file (add argocd.local, agro.local)
  9) Port-forward (Grafana, Prometheus, etc.)
 10) Stop port-forwards

❌ EXIT: q) Quit
```

---

## 📝 Usage Examples

### Create from Scratch

```powershell
.\create-all-from-zero.ps1
```

### View Cluster Status

```powershell
.\k3d-manager.ps1
# Choose: 3
```

### Build Frontend Image

```powershell
.\build-push-images.ps1
# Creates: localhost:5000/agro-frontend:dev
# Imports into k3d cluster
```

### Debug Secrets

```powershell
.\list-secrets.ps1
.\list-secrets.ps1 -Namespace agro-apps
.\list-secrets.ps1 -Name argocd -Decode
```

### Port-Forward to Grafana

```powershell
.\port-forward.ps1 grafana
# Access: http://localhost:3000
# Stop: .\stop-port-forward.ps1 grafana
```

### Cleanup

```powershell
.\cleanup-all.ps1
# Prompts for confirmation
# Deletes cluster + registry
```

---

## 🔒 Credentials & Access

### ArgoCD

- **URL:** http://argocd.local
- **Username:** admin
- **Password:** Argo@123!

### Grafana

- **URL:** http://localhost:3000 (via port-forward)
- **Admin:** admin / admin
- **Extra user:** rdpresser / rdpresser@123

### Docker Registry

- **URL:** localhost:5000
- **Type:** Local k3d registry (no authentication)

---

## 📦 Building Docker Images

Currently **frontend POC** is available to test:

```powershell
.\build-push-images.ps1
```

**Output:**

```
📦 Building: agro-frontend (Frontend Dashboard POC)
   Building: docker build -f poc/frontend/Dockerfile -t localhost:5000/agro-frontend:dev .
   ✅ Build successful
   Loading into k3d cluster...
   ✅ Image loaded into cluster

Images available in k3d registry:
  - localhost:5000/agro-frontend:dev

Use in Kubernetes manifests:
  image: localhost:5000/agro-frontend:dev
  imagePullPolicy: IfNotPresent
```

**Future:** When Agro API services are ready (Identity, Farm, Sensor.Ingest, Analytics, Dashboard), uncomment in `build-push-images.ps1` and provide Dockerfile paths.

---

## 🛠️ Troubleshooting

### Cluster Not Starting

```powershell
# Check Docker
docker info

# Check existing cluster
k3d cluster list

# Delete and recreate
.\cleanup-all.ps1
.\create-all-from-zero.ps1
```

### Port-Forward Issues

```powershell
# Stop all port-forwards
.\stop-port-forward.ps1 all

# Check existing processes
Get-Process kubectl | Where-Object { $_.CommandLine -like "*port-forward*" } | Stop-Process -Force
```

### Kubernetes API Not Ready

```powershell
# Restart cluster
k3d cluster stop dev
k3d cluster start dev

# Or recreate
.\cleanup-all.ps1
.\create-all-from-zero.ps1
```

### Ingress Not Working

```powershell
# Ensure hosts file is updated
.\update-hosts-file.ps1 add

# Check Ingress objects
kubectl get ingress -A

# Verify native port mapping
kubectl get svc -A | grep LoadBalancer
```

---

## 📊 Resource Allocation

### Cluster Node RAM (18GB total)

- **Server:** 2GB (control-plane only)
- **System agent:** 6GB (observability + controllers)
- **Apps agent:** 10GB (microservices + workers)

### Observability Stack Resource Limits

| Component      | Request | Limit | Purpose                   |
| -------------- | ------- | ----- | ------------------------- |
| Prometheus     | 1GB     | 2–3GB | Metrics + retention (24h) |
| Grafana        | 256Mi   | 512Mi | Dashboards                |
| Loki           | 256Mi   | 1GB   | Log aggregation           |
| Tempo          | 256Mi   | 1GB   | Distributed tracing       |
| OTel Collector | 256Mi   | 512Mi | Telemetry ingestion       |

**Total APM footprint:** ~4–6GB (leaves ~4GB free on system agent for ingress + controllers)

---

## 🔐 Idempotency & Safety

All scripts are **idempotent**:

- ✅ Check existence before creating
- ✅ Skip if already exists
- ✅ Use `--dry-run` + `apply` for Kubernetes
- ✅ Kill + restart for port-forwards
- ✅ Confirmation prompts for destructive actions

**Safe to run multiple times** — no data loss if you rerun scripts.

---

## 📝 Notes

### Windows-First

- Scripts are optimized for **PowerShell 7+ on Windows**
- Future platform support planned
- Requires **Administrator** for hosts file updates

### Local-Only

- Registry is **local** (localhost:5000)
- Docker Hub push commented for future
- No Azure/Cloud dependencies

### Port Mapping

- Native Ingress port mapping (80:80@loadbalancer, 443:443@loadbalancer)
- **No port-forward needed** for Ingress
- Optional port-forwards for observability tools (Grafana, Prometheus, etc.)

---

## 🚀 Next: Deploy Agro APIs

When API Dockerfiles are ready:

1. Add paths to `build-push-images.ps1`
2. Run: `.\build-push-images.ps1`
3. Create ArgoCD Application manifests in `infrastructure/kubernetes/manifests/`
4. Run: `.\bootstrap-argocd-apps.ps1`

---

## 📚 Related Documentation

- [LOCAL_SETUP.md](../../docs/development/local-setup.md) — Local Docker Compose (alternative)
- [INFRASTRUCTURE_TERRAFORM.md](../../docs/architecture/infrastructure-terraform.md) — Azure AKS (production)
- [K3D Docs](https://k3d.io) — Official k3d documentation
- [Helm Docs](https://helm.sh) — Package management

---

**Version:** 1.0  
**Date:** January 14, 2026  
**Status:** ✅ Production-Ready (Local Development)
