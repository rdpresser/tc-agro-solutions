# 🏗️ GitOps Infrastructure Architecture - TC Agro Solutions

Complete visual overview of the new GitOps infrastructure setup with registry configuration.

---

## 📊 Full Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    TC AGRO SOLUTIONS - LOCAL K3D GITOPS CLUSTER                │
│                                                                                  │
│  BOOTSTRAP PHASE (scripts/k3d/bootstrap.ps1)                                   │
│  ════════════════════════════════════════════════════════════════════════════  │
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────┐       │
│  │ 1️⃣ Create Local Registry                                             │       │
│  │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │       │
│  │ k3d registry create localhost --port 5000                           │       │
│  │ ↓                                                                    │       │
│  │ 🐳 localhost:5000 (registry)                                        │       │
│  │   Ready for images                                                 │       │
│  └──────────────────────────────────────────────────────────────────────┘       │
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────┐       │
│  │ 2️⃣ Create K3D Cluster (18GB RAM)                                     │       │
│  │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │       │
│  │                                                                      │       │
│  │  🖥️ Server (2GB)                                                    │       │
│  │  ├─ kube-apiserver                                                 │       │
│  │  ├─ etcd                                                           │       │
│  │  └─ Controller Manager                                            │       │
│  │                                                                      │       │
│  │  🖥️ Agent - SYSTEM (6GB) [agentpool=system, taint:NoSchedule]       │       │
│  │  ├─ Prometheus + Grafana                                           │       │
│  │  ├─ Loki + Tempo                                                   │       │
│  │  ├─ OpenTelemetry Collector                                        │       │
│  │  └─ AlertManager                                                   │       │
│  │                                                                      │       │
│  │  🖥️ Agent - APPS (10GB) [agentpool=apps]                            │       │
│  │  ├─ KEDA Operator                                                  │       │
│  │  └─ (Microservices & apps deployed via ArgoCD)                    │       │
│  │                                                                      │       │
│  │  Registry Integration: --registry-use localhost:5000                │       │
│  │  ↓ All nodes auto-configured to access localhost:5000              │       │
│  └──────────────────────────────────────────────────────────────────────┘       │
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────┐       │
│  │ 3️⃣ Install ArgoCD via Helm                                          │       │
│  │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │       │
│  │ helm repo add argo                                                 │       │
│  │ helm install argocd argo/argo-cd                                   │       │
│  │ ↓                                                                    │       │
│  │ 📦 ArgoCD (namespace: argocd)                                       │       │
│  │    Ready for GitOps                                                │       │
│  └──────────────────────────────────────────────────────────────────────┘       │
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────┐       │
│  │ 4️⃣ Apply ArgoCD Bootstrap Application (App-of-apps)                 │       │
│  │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │       │
│  │ kubectl apply -f bootstrap/bootstrap-platform.yaml
kubectl apply -f bootstrap/bootstrap-apps.yaml              │       │
│  │ ↓                                                                    │       │
│  │ 🎯 Application: "platform-bootstrap" (App-of-apps)                  │       │
│  │    source: infrastructure/kubernetes/platform/argocd/applications/ │       │
│  │    syncs: true                                                      │       │
│  └──────────────────────────────────────────────────────────────────────┘       │
│                                                                                  │
│                                                                                  │
│  GITOPS PHASE (ArgoCD auto-syncs from Git)                                     │
│  ════════════════════════════════════════════════════════════════════════════  │
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────┐       │
│  │ 5️⃣ ArgoCD Syncs Platform Applications                               │       │
│  │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │       │
│  │                                                                      │       │
│  │  📊 Application: platform-observability                            │       │
│  │     Sources:                                                        │       │
│  │     ├─ Helm: prometheus-community/kube-prometheus-stack (65.0.0)   │       │
│  │     │  valueFiles: $values/.../kube-prometheus-stack.values.yaml   │       │
│  │     │  ↓ Installs: Prometheus + Grafana + AlertManager             │       │
│  │     │                                                               │       │
│  │     ├─ Helm: grafana/loki (6.21.0)                                │       │
│  │     │  valueFiles: $values/.../loki.values.yaml                    │       │
│  │     │  ↓ Installs: Loki (log aggregation)                          │       │
│  │     │                                                               │       │
│  │     ├─ Helm: grafana/tempo (1.11.0)                               │       │
│  │     │  valueFiles: $values/.../tempo.values.yaml                   │       │
│  │     │  ↓ Installs: Tempo (distributed tracing)                     │       │
│  │     │                                                               │       │
│  │     └─ Helm: open-telemetry/opentelemetry-collector (0.95.0)      │       │
│  │        valueFiles: $values/.../otel-collector.values.yaml          │       │
│  │        ↓ Installs: OTEL Collector (telemetry hub)                  │       │
│  │                                                                      │       │
│  │  ⚡ Application: platform-autoscaling                               │       │
│  │     Source: Helm: kedacore/keda (2.14.0)                           │       │
│  │     valueFiles: $values/.../keda.values.yaml                       │       │
│  │     ↓ Installs: KEDA (event-driven autoscaling)                    │       │
│  │                                                                      │       │
│  │  Namespace: monitoring, keda                                        │       │
│  └──────────────────────────────────────────────────────────────────────┘       │
│                                                                                  │
│                                                                                  │
│  DEVELOPER WORKFLOW (Building & Deploying Images)                              │
│  ════════════════════════════════════════════════════════════════════════════  │
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────┐       │
│  │ 🛠️ Build & Push Images to localhost:5000                            │       │
│  │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │       │
│  │                                                                      │       │
│  │  .\build-push-images.ps1                                           │       │
│  │                                                                      │       │
│  │  FOR EACH IMAGE IN $images ARRAY:                                   │       │
│  │    1️⃣ docker build -t localhost:5000/{image-name}:latest            │       │
│  │    2️⃣ docker push localhost:5000/{image-name}:latest                │       │
│  │                                                                      │       │
│  │  RESULT: Image available in localhost:5000 registry                 │       │
│  │                                                                      │       │
│  │  Examples:                                                           │       │
│  │  ✅ localhost:5000/agro-frontend:latest                             │       │
│  │  ⏳ localhost:5000/agro-identity-service:latest (when added)         │       │
│  │  ⏳ localhost:5000/agro-farm-service:latest (when added)             │       │
│  │  ⏳ localhost:5000/agro-sensor-ingest-service:latest (when added)    │       │
│  │  ⏳ localhost:5000/agro-dashboard-service:latest (when added)        │       │
│  └──────────────────────────────────────────────────────────────────────┘       │
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────┐       │
│  │ 🚀 Deploy Pods Using Images from localhost:5000                     │       │
│  │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │       │
│  │                                                                      │       │
│  │  Deployment YAML:                                                   │       │
│  │  ┌──────────────────────────────────────────────────────────────┐  │       │
│  │  │ apiVersion: apps/v1                                          │  │       │
│  │  │ kind: Deployment                                             │  │       │
│  │  │ metadata:                                                    │  │       │
│  │  │   name: identity-service                                    │  │       │
│  │  │ spec:                                                        │  │       │
│  │  │   template:                                                  │  │       │
│  │  │     spec:                                                    │  │       │
│  │  │       containers:                                            │  │       │
│  │  │       - name: api                                            │  │       │
│  │  │         image: localhost:5000/agro-identity-service:latest  │  │       │
│  │  │         imagePullPolicy: IfNotPresent                       │  │       │
│  │  │                                                              │  │       │
│  │  │  ↓ K8s kubelet pulls from localhost:5000 (already linked)   │  │       │
│  │  │  ↓ Pod container starts                                      │  │       │
│  │  └──────────────────────────────────────────────────────────────┘  │       │
│  │                                                                      │       │
│  │  NO AUTH NEEDED:                                                    │       │
│  │  - bootstrap.ps1 auto-configures all nodes                         │       │
│  │  - k3d handles registry linking                                    │       │
│  │  - No ImagePullSecret required                                     │       │
│  └──────────────────────────────────────────────────────────────────────┘       │
│                                                                                  │
│                                                                                  │
│  NETWORKING & ACCESS                                                            │
│  ════════════════════════════════════════════════════════════════════════════  │
│                                                                                  │
│  🌐 Ingress Routing (via Ingress NGINX):                                        │
│     http://argocd.local   → ArgoCD Server (80:80@loadbalancer)                 │
│     http://agro.local     → (future) Microservices                              │
│                                                                                  │
│  🔌 Port-Forwards (optional):                                                   │
│     localhost:3000        → Grafana                                             │
│     localhost:9090        → Prometheus                                          │
│     localhost:3100        → Loki                                                │
│     localhost:3200        → Tempo                                               │
│                                                                                  │
│  📦 Registry Access:                                                            │
│     localhost:5000        → Docker Registry API (pull/push)                     │
│     curl http://localhost:5000/v2/_catalog   (list images)                     │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Component Interaction Flow

```
┌─────────────────┐
│  bootstrap.ps1  │
└────────┬────────┘
         │
         ├─ 1️⃣ Create registry (localhost:5000)
         │
         ├─ 2️⃣ Create k3d cluster (18GB)
         │      └─ Auto-link registry to all nodes
         │
         ├─ 3️⃣ Install ArgoCD via Helm
         │
         └─ 4️⃣ Apply bootstrap Application
                 │
                 └─ ArgoCD reads: infrastructure/kubernetes/platform/argocd/applications/
                    │
                    ├─ platform-observability.yaml
                    │  ├─ kube-prometheus-stack (Prometheus + Grafana + AlertManager)
                    │  ├─ loki (Loki)
                    │  ├─ tempo (Tempo)
                    │  └─ otel-collector (OpenTelemetry)
                    │
                    └─ platform-autoscaling.yaml
                       └─ keda (KEDA)
```

---

## 📂 Git Repository Structure (GitOps Config)

```
tc-agro-solutions/
│
├─ infrastructure/kubernetes/
│  │
│  ├─ platform/                           # Platform components (Prometheus, Grafana, etc)
│  │  ├─ helm-values/dev/
│  │  │  ├─ kube-prometheus-stack.values.yaml    (Prometheus, Grafana config)
│  │  │  ├─ loki.values.yaml                     (Loki config)
│  │  │  ├─ tempo.values.yaml                    (Tempo config)
│  │  │  ├─ otel-collector.values.yaml           (OTEL config)
│  │  │  └─ keda.values.yaml                     (KEDA config)
│  │  │
│  │  ├─ argocd/
│  │  │  ├─ bootstrap/
│  │  │  │  ├─ bootstrap-platform.yaml           (Platform infrastructure)
│  │  │  │  └─ bootstrap-apps.yaml               (Applications)
│  │  │  ├─ projects/
│  │  │  │  └─ project-platform.yaml             (Platform Project)
│  │  │  └─ applications/
│  │  │     ├─ platform-observability.yaml       (Multi-source: 4 Helm + values repo)
│  │  │     └─ platform-autoscaling.yaml         (Helm + values repo)
│  │  │
│  │  ├─ base/
│  │  │  ├─ namespaces/
│  │  │  │  └─ namespaces.yaml                   (4 namespaces)
│  │  │  ├─ ingress/
│  │  │  │  └─ argocd-ingress.yaml               (ArgoCD Ingress)
│  │  │  └─ kustomization.yaml
│  │  │
│  │  └─ overlays/dev/
│  │     └─ kustomization.yaml
│  │
│  └─ apps/                               # Microservices (future)
│     ├─ argocd/
│     │  ├─ projects/
│     │  │  └─ project-apps.yaml                 (Apps Project - 5 microservice repos)
│     │  └─ applications/
│     │     └─ apps-dev.yaml                     (ApplicationSet placeholder)
│     │
│     ├─ base/
│     │  └─ kustomization.yaml
│     │
│     └─ overlays/dev/
│        └─ kustomization.yaml
│
├─ scripts/k3d/                           # Bootstrap & management scripts
│  ├─ bootstrap.ps1                       (Main bootstrap)
│  ├─ build-push-images.ps1               (Build & push to localhost:5000)
│  ├─ manager.ps1                         (Interactive menu)
│  ├─ status.ps1                          (Cluster status)
│  ├─ cleanup.ps1                         (Delete cluster)
│  ├─ README.md                           (This guide)
│  └─ REGISTRY_CONFIGURATION.md           (Registry details)
│
├─ services/                              # Microservices (future: add k8s/)
│  ├─ identity-service/                   (todo: k8s/base + k8s/overlays/dev)
│  ├─ farm-service/                       (todo: k8s/base + k8s/overlays/dev)
│  ├─ sensor-ingest-service/              (todo: k8s/base + k8s/overlays/dev)
│  ├─ analytics-worker/                   (todo: k8s/base + k8s/overlays/dev)
│  └─ dashboard-service/                  (todo: k8s/base + k8s/overlays/dev)
│
└─ poc/frontend/                          # Frontend POC
   └─ Dockerfile                          (Build & push to localhost:5000)
```

---

## 🎯 Registry Integration Points

### 1. **Bootstrap Creates & Links Registry**

```powershell
# bootstrap.ps1
$registryName = "localhost"
$registryPort = 5000

# Creates registry
k3d registry create $registryName --port $registryPort

# Links to cluster
k3d cluster create ... --registry-use "$registryName:$registryPort"
```

### 2. **Build Script Pushes to Registry**

```powershell
# build-push-images.ps1
docker build -t localhost:5000/{image}:latest ...
docker push localhost:5000/{image}:latest
```

### 3. **K8s Deployments Pull from Registry**

```yaml
# k8s/base/deployment.yaml (in microservice repos)
containers:
  - name: service
    image: localhost:5000/{image}:latest
    imagePullPolicy: IfNotPresent
```

### 4. **kubelet Resolves & Runs**

```
K8s Node → kubelet → Check localhost:5000 registry → Pull image → Run container
↑ Already configured by k3d! No auth, auto-linked
```

---

## ✅ Verification Checklist

- [x] Registry created: `k3d registry list` shows `localhost:5000`
- [x] Registry linked to cluster: nodes can access `localhost:5000`
- [x] ArgoCD managing platform stack: 3 Applications synced
- [x] Images can be pushed: `docker push localhost:5000/agro-frontend:latest`
- [x] Pods can pull images: no `ImagePullSecret` needed
- [x] Multi-source Applications working: Helm + values repo pattern

---

> **Architecture Version:** 1.0 (GitOps with Registry Integration)  
> **Date:** January 15, 2026  
> **Status:** ✅ Complete and Tested
