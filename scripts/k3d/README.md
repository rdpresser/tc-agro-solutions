# 🚀 K3D GitOps Cluster - TC Agro Solutions

**Status:** 🔵 CURRENT (Localhost Development) | GitOps-first approach for local k3d cluster

This folder contains scripts and documentation for running the complete TC Agro Solutions system locally on k3d with ArgoCD managing microservices via GitOps.

**What you get:**

- k3d Kubernetes cluster (4 nodes: 1 server + 3 agents) on localhost
- Observability stack in Docker Compose (Prometheus, Grafana, Loki, Tempo, OTEL Collector)
- OTEL DaemonSet in k3d for telemetry collection
- Microservices deployed via GitOps (ArgoCD)
- Zero cloud costs, all local

**Networking:**

- k3d cluster joins `tc-agro-network` Docker network
- Pods resolve Docker container names directly (e.g., `tc-agro-postgres`, `tc-agro-redis`)
- No need for `host.k3d.internal` or bridge IPs

---

## 🎯 GitOps Philosophy

### ❌ Before (Legacy Scripts in `/dev/`)

```powershell
create-all-from-zero.ps1
  ├─ Create k3d cluster
  ├── Install ArgoCD via Helm
  ├── Install Prometheus via Helm
  ├── Install Grafana via Helm
  ├── Install Loki via Helm
  ├── Install Tempo via Helm
  ├── Install OTel via Helm
  └── Install KEDA via Helm

❌ Problems:
- Huge script (~500+ lines)
- Hardcoded configuration in script
- Hard to version changes
- Not real GitOps
```

### ✅ New GitOps Approach

```powershell
# 1) Minimal bootstrap (only cluster + ArgoCD)
.\bootstrap.ps1

# 2) ArgoCD installs EVERYTHING automatically via Git
# - Reads manifests from repository
# - Installs Helm charts with versioned values
# - Auto-sync, auto-heal, self-service
```

**Result**: Script from 350 lines → ~200 lines. Everything else is GitOps.

---

## 🎯 Workflow GitOps (How it Works)

### Bootstrap Flow

```
1. .\bootstrap.ps1
   └─ Create k3d cluster (18GB: 2+6+10)
   └─ Install ArgoCD via Helm
   └─ Apply bootstrap-platform.yaml (Infrastructure)
   └─ Apply bootstrap-apps.yaml (Applications)

2. ArgoCD takes over and installs:
   ├─ platform-base (namespaces, ingress config)
   └── apps-dev (microservices: frontend, identity-service)

   **Note:** Observability stack (Prometheus, Grafana, Loki, Tempo) runs in Docker Compose.
   Only the OTEL DaemonSet runs in k3d for telemetry collection.

3. You manage microservices via Git:
   - Push manifests to repos
   - ArgoCD syncs automatically
   - Zero manual kubectl apply
```

---

## 📦 What Gets Installed

### 🏗️ By Bootstrap Script

- k3d cluster (3 nodes: 1 server + 2 agents)
- Local registry (localhost:5000)
- ArgoCD (via Helm)
- Platform Project
- Bootstrap Application (App-of-apps)
- Base manifests (namespaces, ArgoCD Ingress)

### ✨ By ArgoCD (GitOps)

- **platform-base** (namespaces: agro-apps, observability; ingress config)
- **apps-dev** (frontend, identity-service deployments)
- **OTEL DaemonSet** (telemetry collection in observability namespace)

**Note:** Full observability stack (Prometheus, Grafana, Loki, Tempo, OTEL Collector) runs in **Docker Compose**, not k3d.

---

## 🎯 Quick Start

### 1. Bootstrap Everything

```powershell
cd c:\Projects\tc-agro-solutions\scripts\k3d
.\bootstrap.ps1
```

**What it does:**

1. Creates k3d cluster (1 server + 3 agents, labeled by workload type)
2. Joins cluster to `tc-agro-network` Docker network
3. Installs ArgoCD via Helm
4. Applies ArgoCD bootstrap Application (App-of-apps)
5. ArgoCD installs **automatically**:
   - platform-base (namespaces, ingress)
   - apps-dev (microservices)
   - OTEL DaemonSet (telemetry)

**Observability:** Runs in Docker Compose (`docker-compose.yml`)

**Time:** ~3-4 minutes

---

### 2. Watch ArgoCD Sync

```powershell
kubectl get applications -n argocd --watch
```

Expected applications:

- `platform-base` (namespaces + OTEL DaemonSet)
- `apps-dev` (microservices)

**Note:** Full observability (Prometheus, Grafana, Loki, Tempo) runs in Docker Compose.

---

### 3. Update Hosts File (for Ingress access)

```powershell
.\update-hosts-file.ps1
```

Adds to `C:\Windows\System32\drivers\etc\hosts`:

```
127.0.0.1 argocd.local
127.0.0.1 agro.local
```

---

### 4. Access ArgoCD

```powershell
# Option 1: Port-Forward (Recommended for development)
.\port-forward.ps1 argocd
# Then access: http://localhost:8090/argocd/

# Option 2: Via Ingress (requires hosts file configuration)
# Edit C:\Windows\System32\drivers\etc\hosts and add:
#   127.0.0.1 argocd.local
# Then access: http://argocd.local/

# Credentials
Username: admin
Password: Argo@123! (or initial password from secret)

# (Optional) Get initial admin password if needed:
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d

# (Optional) Reset password if needed:
.\reset-argocd-password.ps1 -CurrentPassword "Argo@123!"
```

---

## 🔄 GitOps Workflow

### What Happens After Bootstrap?

1. **bootstrap.ps1** creates cluster + installs ArgoCD + applies bootstrap Application
2. **ArgoCD** automatically syncs and installs:
   - **platform-base** (namespaces, ingress configuration)
   - **apps-dev** (frontend, identity-service deployments)
   - **OTEL DaemonSet** (telemetry collection)
3. Observability (Prometheus, Grafana, Loki, Tempo) runs in **Docker Compose**
4. Changes to manifests in `infrastructure/kubernetes/` auto-sync via ArgoCD

---

## 🚀 Quick Start

### 1. **Bootstrap Cluster + GitOps**

```powershell
.\manager.ps1 1
# OR
.\bootstrap.ps1
```

This single command:

- ✅ Creates k3d cluster (18GB: 2GB server + 6GB system + 10GB apps)
- ✅ Installs ArgoCD via Helm
- ✅ Applies GitOps bootstrap (App-of-apps)
- ✅ **Creates local registry at localhost:5000** ⭐ **NEW**
- ✅ ArgoCD auto-installs: Prometheus, Grafana, Loki, Tempo, OTel, KEDA

⏱️ **Time:** ~3-4 minutes

---

## 🐳 Container Registry Configuration

### Registry Automatically Configured ✅

The local registry `localhost:5000` is **automatically configured** during bootstrap:

```powershell
# bootstrap.ps1 (line 32-33, 158):
$registryName = "localhost"
$registryPort = 5000

# bootstrap.ps1 (line 200):
--registry-use "$registryName`:$registryPort"
```

**What bootstrap.ps1 does:**

- ✅ Creates k3d registry at `localhost:5000`
- ✅ Connects cluster nodes to registry (auto-configured, no auth)
- ✅ Nodes can pull/push images without credentials
- ✅ Ready for your microservices

### Build & Push Images

```powershell
.\build-push-images.ps1
```

This script:

1. **Builds** Docker images with tag `localhost:5000/{image-name}:latest`
2. **Pushes** to local registry
3. Currently configured for: `tc-agro-frontend-service`

**To add your microservices:**
Edit `build-push-images.ps1` and add to the `$images` array:

```powershell
$images = @(
    @{ name = "tc-agro-frontend-service"; path = "poc/frontend"; dockerfile = "Dockerfile" }
    # Add your services:
    @{ name = "agro-identity-service"; path = "services/identity-service"; dockerfile = "Dockerfile" }
    @{ name = "agro-farm-service"; path = "services/farm-service"; dockerfile = "Dockerfile" }
    # ... etc
)
```

### Example Workflow

```powershell
# 1️⃣ Build your microservices
.\build-push-images.ps1

# 2️⃣ Verify images in registry
curl http://localhost:5000/v2/_catalog

# 3️⃣ Deploy pods using the images
# image: localhost:5000/agro-identity-service:latest

# 4️⃣ K8s pulls automatically (already configured)
kubectl get pods  # Shows running pods
```

📖 **Complete registry guide:** See **[REGISTRY_CONFIGURATION.md](REGISTRY_CONFIGURATION.md)**

---

### 2️⃣ **Watch ArgoCD Install Platform Stack**

```powershell
kubectl get applications -n argocd --watch
```

You should see:

```
NAME                      SYNC STATUS   HEALTH STATUS
platform-bootstrap        Synced        Healthy
platform-base             Synced        Healthy
apps-bootstrap            Synced        Healthy
apps-dev                  Synced        Healthy
```

---

### 3. **Update Hosts File (Windows)**

```powershell
.\update-hosts-file.ps1
```

Adds:

- `127.0.0.1 argocd.local`
- `127.0.0.1 agro.local`

---

### 4. **Access ArgoCD (Native Ingress)**

```powershell
# No port-forward needed! Native ingress on port 80.
http://argocd.local
```

**Credentials:**

- Username: `admin`
- Password: `Argo@123!`

---

## 📊 Cluster Details

| Component        | Value                                             |
| ---------------- | ------------------------------------------------- |
| **Cluster Name** | dev                                               |
| **Nodes**        | 1 server (2GB) + 2 agents (system 6GB, apps 10GB) |
| **Total RAM**    | 18GB                                              |
| **Registry**     | localhost:5000                                    |
| **Port Mapping** | 80:80, 443:443 (native LoadBalancer)              |

### Node Pools (AKS-like)

| Pool       | Label              | Taint                         | Purpose                                  |
| ---------- | ------------------ | ----------------------------- | ---------------------------------------- |
| **system** | `agentpool=system` | `agentpool=system:NoSchedule` | Platform (OTEL DaemonSet, Ingress)       |
| **apps**   | `agentpool=apps`   | (none)                        | Microservices (frontend, identity, etc.) |

---

## 🚀 Quick Start

### 1. Bootstrap Cluster (GitOps from zero)

```powershell
.\bootstrap.ps1
```

**What it does:**

- Creates k3d cluster (1 server + 3 agents)
- Joins cluster to `tc-agro-network` Docker network
- Installs ArgoCD via Helm
- Applies ArgoCD bootstrap Application (App-of-apps)
- ArgoCD automatically installs:
  - platform-base (namespaces, ingress)
  - apps-dev (microservices)
  - OTEL DaemonSet

**Observability:** Prometheus/Grafana/Loki/Tempo run in Docker Compose.

**Time:** ~3-4 minutes

---

### 2. Watch ArgoCD Sync

```powershell
kubectl get applications -n argocd --watch
```

Expected applications:

- `platform-bootstrap` (App-of-apps)
- `platform-base` (namespaces, ingress)
- `apps-bootstrap` (App-of-apps)
- `apps-dev` (microservices)

---

### 3. Update Hosts File (for Ingress)

```powershell
.\update-hosts-file.ps1
```

Adds:

- `127.0.0.1 argocd.local`
- `127.0.0.1 agro.local`

---

### 4. Access ArgoCD

```
http://argocd.local
```

**Credentials:**

- Username: `admin`
- Password: `Argo@123!`

---

## 📊 Management Scripts

### Interactive Menu

```powershell
.\manager.ps1
```

### Individual Commands

| Command                       | Description                                   |
| ----------------------------- | --------------------------------------------- |
| `.\status.ps1`                | Cluster status (nodes, services, ArgoCD apps) |
| `.\cleanup.ps1`               | Delete cluster and registry                   |
| `.\start-cluster.ps1`         | Start stopped cluster                         |
| `.\port-forward.ps1 grafana`  | Access Grafana at `http://localhost:3000`     |
| `.\port-forward.ps1 all`      | Port-forward all services                     |
| `.\stop-port-forward.ps1 all` | Stop all port-forwards                        |
| `.\build-push-images.ps1`     | Build and push images to local registry       |
| `.\list-secrets.ps1`          | Debug tool for secrets                        |

---

## 🗂️ Project Structure

```
tc-agro-solutions/
├── scripts/k3d/                         # Scripts (this folder)
├── infrastructure/kubernetes/
│   ├── platform/                        # Platform GitOps state
│   │   ├── helm-values/dev/             # Helm values (versioned)
│   │   ├── argocd/                      # ArgoCD manifests
│   │   │   ├── bootstrap/               # App-of-apps
│   │   │   ├── projects/                # ArgoCD Projects
│   │   │   └── applications/            # Applications (per component)
│   │   ├── base/                        # Kustomize base
│   │   └── overlays/dev/                # DEV overlay
│   │
│   └── apps/                            # Microservices (future)
│       ├── base/
│       ├── overlays/dev/
│       └── argocd/
```

---

## 🔧 GitOps Architecture

### Bootstrap Flow

```
1. bootstrap.ps1
   ├── Create k3d cluster (joins tc-agro-network)
   ├── Install ArgoCD (Helm)
   └── Apply bootstrap Application
       └── ArgoCD reads: infrastructure/kubernetes/platform/argocd/
           ├── bootstrap/
           │   ├── bootstrap-platform.yaml (platform App-of-apps)
           │   └── bootstrap-apps.yaml (microservices App-of-apps)
           └── applications/
               └── platform-base.yaml (namespaces, ingress)
```

**Note:** Observability (Prometheus, Grafana, Loki, Tempo) runs in Docker Compose, not k3d.

### Helm Values Strategy

Active k3d components use **versioned Helm values** in:

```
infrastructure/kubernetes/platform/helm-values/dev/
├── otel-collector.values.yaml    # OTEL DaemonSet (exports to Docker Compose)
└── keda.values.yaml              # Optional autoscaling (future)
```

Archived values (for reference, observability moved to Docker Compose):

```
├── kube-prometheus-stack.values.yaml  # Archived - Docker Compose
├── loki.values.yaml                   # Archived - Docker Compose
└── tempo.values.yaml                  # Archived - Docker Compose
```

**Why?**

- Configurations are versioned and auditable
- Easy to review changes (Git PRs)
- Reproducible across environments
- GitOps-friendly

---

## 🌐 Access Methods

| Service      | Method       | URL                             | Notes                                 |
| ------------ | ------------ | ------------------------------- | ------------------------------------- |
| **ArgoCD**   | Port-Forward | `http://localhost:8090/argocd/` | Recommended: works immediately        |
| **ArgoCD**   | Ingress      | `http://argocd.local/`          | Requires hosts file setup (see below) |
| **Frontend** | Port-Forward | `http://localhost:3080`         | Frontend POC app                      |

### Port-Forward Method (Quick & Easy)

```powershell
# Start port-forward for ArgoCD
.\port-forward.ps1 argocd

# Access at:
# http://localhost:8090/argocd/
```

### Ingress Method (Clean URLs, requires setup)

Edit `C:\Windows\System32\drivers\etc\hosts` and add:

```
127.0.0.1 argocd.local
127.0.0.1 agro.local
```

Then access:

```
http://argocd.local/   (if Ingress configured)
```

**Note:** Traefik Ingress for ArgoCD requires additional configuration due to k3d networking. Port-forward is the reliable method for local development.

---

## 📊 Port Forwards (Optional)

- Grafana: http://localhost:3000 (Docker Compose)
- Prometheus: http://localhost:9090 (Docker Compose)

---

## 🛠️ Troubleshooting

### ArgoCD Application Stuck in "Progressing"

```powershell
kubectl get applications -n argocd
kubectl describe application apps-dev -n argocd
```

### Check Pods in Namespaces

```powershell
kubectl get pods -n agro-apps
kubectl get pods -n observability
```

### Grafana Not Accessible

```powershell
# Grafana runs in Docker Compose, not k3d
docker logs tc-agro-grafana

# Access Grafana at http://localhost:3000
# Default credentials: admin / admin
```

### Node Pool Issues

```powershell
# Check labels and taints
kubectl get nodes --show-labels
kubectl describe node k3d-dev-agent-system-0-0
```

---

## 📚 References

- **GitOps Strategy:** [/infrastructure/kubernetes/scripts/dev_ref/gitops-final-tree-and-bootstrap-reference.txt](../../../infrastructure/kubernetes/scripts/dev_ref/gitops-final-tree-and-bootstrap-reference.txt)
- **Helm Values Bundle:** [/infrastructure/kubernetes/scripts/dev_ref/platform-helm-values-dev-prod-bundle.yaml](../../../infrastructure/kubernetes/scripts/dev_ref/platform-helm-values-dev-prod-bundle.yaml)
- **k3d Documentation:** https://k3d.io/
- **ArgoCD Documentation:** https://argo-cd.readthedocs.io/

---

## 🔄 Migration from `/dev/` Scripts

If migrating from old `/infrastructure/kubernetes/scripts/dev/`:

| Old Script                 | New Equivalent     | Notes                   |
| -------------------------- | ------------------ | ----------------------- |
| `create-all-from-zero.ps1` | `bootstrap.ps1`    | Simplified, GitOps-only |
| `cleanup-all.ps1`          | `cleanup.ps1`      | Same functionality      |
| `k3d-manager.ps1`          | `manager.ps1`      | Same menu structure     |
| `port-forward.ps1`         | `port-forward.ps1` | Copied                  |
| (rest)                     | (same names)       | Adapted                 |

**Key Difference:** New scripts install **only cluster + ArgoCD**. Everything else is GitOps (Helm values + ArgoCD Applications).

---

> **Version:** 1.0 (GitOps Bootstrap)  
> **Date:** January 15, 2026  
> **Approach:** Minimal scripts + GitOps (ArgoCD manages platform stack)
