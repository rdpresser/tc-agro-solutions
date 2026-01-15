# 🚀 K3D GitOps Cluster - TC Agro Solutions

**GitOps-first approach:** Bootstrap cria cluster + ArgoCD, e ArgoCD instala todo o resto.

---

## 🎯 Filosofia (GitOps Real)

### ❌ Antes (Scripts Legados em `/dev/`)

```powershell
create-all-from-zero.ps1
  ├─ Cria cluster k3d
  ├── Instala ArgoCD via Helm
  ├── Instala Prometheus via Helm
  ├── Instala Grafana via Helm
  ├── Instala Loki via Helm
  ├── Instala Tempo via Helm
  ├── Instala OTel via Helm
  ├── Instala KEDA via Helm
  └── Instala Ingress NGINX via Helm

❌ Problemas:
- Script gigante (~500+ linhas)
- Configuração hardcoded no script
- Difícil de versionar mudanças
- Não é GitOps real
```

### ✅ Novo Approach GitOps

```powershell
# 1) Bootstrap mínimo (só cluster + ArgoCD)
.\bootstrap.ps1

# 2) ArgoCD instala TUDO sozinho via Git
# - Lê manifests do repositório
# - Instala Helm charts com values versionados
# - Auto-sync, auto-heal, self-service
```

**Resultado**: Script de 350 linhas → ~200 linhas. Todo o resto é GitOps.

---

## 🎯 Workflow GitOps (Como Funciona)

### Fluxo de Bootstrap

```
1. .\bootstrap.ps1
   └─ Cria cluster k3d (18GB: 2+6+10)
   └─ Instala ArgoCD via Helm
   └─ Aplica Application-Bootstrap (App-of-apps)

2. ArgoCD assume e instala:
   ├─ platform-observability
   │  ├── kube-prometheus-stack (Prometheus + Grafana + AlertManager)
   │  ├── Loki (logs)
   │  ├── Tempo (traces)
   │  └── OpenTelemetry Collector
   ├── platform-autoscaling (KEDA)
   └── platform-ingress-nginx

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

- **kube-prometheus-stack** (Prometheus + Grafana + AlertManager)
- **Loki** (log aggregation)
- **Tempo** (distributed tracing)
- **OpenTelemetry Collector** (telemetry hub)
- **KEDA** (event-driven autoscaling)
- **Ingress NGINX** (with native k3d LoadBalancer)

---

## 🎯 Quick Start

### 1. Bootstrap Everything

```powershell
cd c:\Projects\tc-agro-solutions\scripts\k3d
.\bootstrap.ps1
```

**What it does:**

1. Creates k3d cluster (1 server + 2 agents, 18GB total)
2. Installs ArgoCD via Helm
3. Applies ArgoCD bootstrap Application (App-of-apps)
4. ArgoCD installs **automatically**:
   - kube-prometheus-stack (Prometheus + Grafana)
   - Loki (logs)
   - Tempo (traces)
   - OpenTelemetry Collector
   - KEDA (autoscaling)
   - Ingress NGINX

**Time:** ~3-4 minutes

---

### 2. Watch ArgoCD Sync

```powershell
kubectl get applications -n argocd --watch
```

Expected applications:

- `platform-observability` (Prometheus, Grafana, Loki, Tempo, OTel)
- `platform-autoscaling` (KEDA)
- `platform-ingress-nginx`

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
# Via Ingress (no port-forward needed!)
http://argocd.local

# Credentials
Username: admin
Password: Argo@123!

# (Optional) Get initial admin password if you didn't set custom:
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
```

---

## 🔄 GitOps Workflow

### What Happens After Bootstrap?

1. **bootstrap.ps1** creates cluster + installs ArgoCD + applies bootstrap Application
2. **ArgoCD** automatically syncs and installs:
   - **platform-observability** (Prometheus, Grafana, Loki, Tempo, OTel Collector)
   - **platform-autoscaling** (KEDA)
   - **platform-ingress-nginx** (Ingress Controller)
3. All configurations come from **versioned Helm values** in Git
4. Changes to `platform/helm-values/dev/*.values.yaml` auto-sync via ArgoCD

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
- ✅ ArgoCD auto-installs: Prometheus, Grafana, Loki, Tempo, OTel, KEDA, Ingress NGINX

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
3. Currently configured for: `agro-frontend`

**To add your microservices:**
Edit `build-push-images.ps1` and add to the `$images` array:

```powershell
$images = @(
    @{ name = "agro-frontend"; path = "poc/frontend"; dockerfile = "Dockerfile" }
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
platform-observability    Synced        Healthy
platform-autoscaling      Synced        Healthy
platform-ingress-nginx    Synced        Healthy
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

| Pool       | Label              | Taint                         | Purpose                                                          |
| ---------- | ------------------ | ----------------------------- | ---------------------------------------------------------------- |
| **system** | `agentpool=system` | `agentpool=system:NoSchedule` | Platform (Prometheus, Grafana, Loki, Tempo, OTel, KEDA, Ingress) |
| **apps**   | `agentpool=apps`   | (none)                        | Microservices                                                    |

---

## 🚀 Quick Start

### 1. Bootstrap Cluster (GitOps from zero)

```powershell
.\bootstrap.ps1
```

**What it does:**

- Creates k3d cluster (1 server + 2 agents)
- Installs ArgoCD via Helm
- Applies ArgoCD bootstrap Application (App-of-apps)
- ArgoCD automatically installs:
  - kube-prometheus-stack (Prometheus + Grafana)
  - Loki
  - Tempo
  - OpenTelemetry Collector
  - KEDA
  - Ingress NGINX

**Time:** ~3-4 minutes

---

### 2. Watch ArgoCD Sync

```powershell
kubectl get applications -n argocd --watch
```

Expected applications:

- `platform-observability` (Prometheus, Grafana, Loki, Tempo, OTel)
- `platform-autoscaling` (KEDA)
- `platform-ingress-nginx` (Ingress Controller)

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
   ├── Create k3d cluster
   ├── Install ArgoCD (Helm)
   └── Apply bootstrap Application
       └── ArgoCD reads: infrastructure/kubernetes/platform/argocd/applications/
           ├── platform-observability.yaml
           │   └── Installs: Prometheus, Grafana, Loki, Tempo, OTel
           ├── platform-autoscaling.yaml
           │   └── Installs: KEDA
           └── platform-ingress-nginx.yaml
               └── Installs: Ingress NGINX
```

### Helm Values Strategy

All platform components use **versioned Helm values** in:

```
infrastructure/kubernetes/platform/helm-values/dev/
├── kube-prometheus-stack.values.yaml
├── loki.values.yaml
├── tempo.values.yaml
├── otel-collector.values.yaml
├── keda.values.yaml
└── ingress-nginx.values.yaml
```

**Why?**

- Configurations are versioned and auditable
- Easy to review changes (Git PRs)
- Reproducible across environments
- GitOps-friendly

---

## 🌐 Ingress Access

| Service    | URL                 | Notes                         |
| ---------- | ------------------- | ----------------------------- |
| **ArgoCD** | http://argocd.local | Via Ingress (no port-forward) |
| **Apps**   | http://agro.local   | (future deployments)          |

**Port-forwards (optional):**

- Grafana: `.\port-forward.ps1 grafana` → `http://localhost:3000`
- Prometheus: `.\port-forward.ps1 prometheus` → `http://localhost:9090`

---

## 🛠️ Troubleshooting

### ArgoCD Application Stuck in "Progressing"

```powershell
kubectl get applications -n argocd
kubectl describe application platform-observability -n argocd
```

### Check Helm Release Status

```powershell
helm list -n monitoring
kubectl get pods -n monitoring
```

### Grafana Not Accessible

```powershell
# Check service
kubectl get svc -n monitoring | Select-String grafana

# Port-forward directly
kubectl port-forward -n monitoring svc/kube-prom-stack-grafana 3000:80
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
