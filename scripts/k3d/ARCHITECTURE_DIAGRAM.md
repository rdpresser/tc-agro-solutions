# 🏗️ GitOps Infrastructure Architecture - TC Agro Solutions

Complete visual overview of the GitOps infrastructure setup with Docker network integration.

**Updated:** February 1, 2026  
**Key Change:** Observability runs in Docker Compose, k3d joins `tc-agro-network`

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
│  │   Ready for microservice images                                     │       │
│  └──────────────────────────────────────────────────────────────────────┘       │
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────┐       │
│  │ 2️⃣ Create K3D Cluster (joins tc-agro-network)                        │       │
│  │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │       │
│  │                                                                      │       │
│  │  🖥️ Server                                                           │       │
│  │  ├─ kube-apiserver                                                 │       │
│  │  ├─ etcd                                                           │       │
│  │  └─ Controller Manager                                            │       │
│  │                                                                      │       │
│  │  🖥️ Agent - SYSTEM [agentpool=system]                               │       │
│  │  ├─ Traefik Ingress (k3s built-in)                                 │       │
│  │  └─ OTEL DaemonSet (telemetry collection)                          │       │
│  │                                                                      │       │
│  │  🖥️ Agent - PLATFORM [agentpool=platform]                           │       │
│  │  └─ ArgoCD components                                              │       │
│  │                                                                      │       │
│  │  🖥️ Agent - APPS [agentpool=apps]                                   │       │
│  │  └─ Microservices (frontend, identity-service, etc.)               │       │
│  │                                                                      │       │
│  │  🔗 Network: --network tc-agro-network                              │       │
│  │  ↓ Pods resolve Docker container names directly                    │       │
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
│  │ 4️⃣ Apply ArgoCD Bootstrap Applications                              │       │
│  │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │       │
│  │ kubectl apply -f bootstrap/bootstrap-platform.yaml                 │       │
│  │ kubectl apply -f bootstrap/bootstrap-apps.yaml                     │       │
│  │ ↓                                                                    │       │
│  │ 🎯 App: "platform-base" → observability namespace + OTEL DaemonSet │       │
│  │ 🎯 App: "apps-dev" → agro-apps namespace + microservices           │       │
│  └──────────────────────────────────────────────────────────────────────┘       │
│                                                                                  │
│                                                                                  │
│  GITOPS PHASE (ArgoCD auto-syncs from Git)                                     │
│  ════════════════════════════════════════════════════════════════════════════  │
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────┐       │
│  │ 5️⃣ ArgoCD Syncs Applications                                        │       │
│  │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │       │
│  │                                                                      │       │
│  │  📦 Application: platform-base                                      │       │
│  │     ├─ Namespace: observability                                    │       │
│  │     └─ OTEL DaemonSet (collects from pods)                        │       │
│  │        Exports to: tc-agro-otel-collector:4318 (Docker)            │       │
│  │                                                                      │       │
│  │  🚀 Application: apps-dev                                           │       │
│  │     ├─ Namespace: agro-apps                                        │       │
│  │     ├─ frontend-service                                            │       │
│  │     ├─ identity-service                                            │       │
│  │     ├─ farm-service                                                │       │
│  │     ├─ sensor-ingest-service                                       │       │
│  │     └─ dashboard-service                                           │       │
│  │                                                                      │       │
│  │  ⚡ Optional: KEDA (kedacore/keda) for autoscaling                  │       │
│  │                                                                      │       │
│  │  NOTE: Full observability stack (Prometheus, Grafana, Loki, Tempo) │       │
│  │        runs in Docker Compose, NOT in k3d cluster!                  │       │
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
│  │  ✅ localhost:5000/tc-agro-frontend-service:latest                   │       │
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
│  🌐 K3D Cluster joins Docker network: tc-agro-network                          │
│     ↓ Pods resolve Docker container names directly                             │
│                                                                                  │
│  🔌 Services (Docker Compose - tc-agro-network):                               │
│     tc-agro-postgres:5432   → PostgreSQL                                       │
│     tc-agro-redis:6379      → Redis                                            │
│     tc-agro-rabbitmq:5672   → RabbitMQ                                         │
│     tc-agro-otel-collector:4317/4318 → OTEL Collector                          │
│                                                                                  │
│  📊 Observability UIs (Docker Compose):                                        │
│     localhost:3000        → Grafana (admin/admin)                              │
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
         ├─ 2️⃣ Create k3d cluster (joins tc-agro-network)
         │      └─ Auto-link registry to all nodes
         │
         ├─ 3️⃣ Install ArgoCD via Helm
         │
         └─ 4️⃣ Apply bootstrap Applications
                 │
                 └─ ArgoCD reads Git repository
                    │
                    ├─ platform-base
                    │  ├─ observability namespace
                    │  └─ OTEL DaemonSet (exports to tc-agro-otel-collector)
                    │
                    └─ apps-dev
                       └─ Microservices in agro-apps namespace

  📊 Observability stack runs in Docker Compose (NOT in k3d):
     Prometheus, Grafana, Loki, Tempo, OTEL Collector
```

---

## 📂 Git Repository Structure (GitOps Config)

```
tc-agro-solutions/
│
├─ infrastructure/kubernetes/
│  │
│  ├─ platform/                           # Platform components (ArgoCD, OTEL DaemonSet)
│  │  ├─ otel-daemonset.yaml                      (OTEL DaemonSet manifest)
│  │  ├─ helm-values/dev/
│  │  │  └─ keda.values.yaml                     (KEDA config - optional)
│  │  │
│  │  ├─ argocd/
│  │  │  ├─ bootstrap/
│  │  │  │  ├─ bootstrap-platform.yaml           (platform-base app)
│  │  │  │  └─ bootstrap-apps.yaml               (apps-dev app)
│  │  │  ├─ projects/
│  │  │  │  └─ project-platform.yaml
│  │  │  └─ applications/
│  │  │     └─ platform-base.yaml                (OTEL DaemonSet)
│  │  │
│  │  ├─ base/
│  │  │  ├─ namespaces/
│  │  │  │  └─ namespaces.yaml                   (observability, agro-apps)
│  │  │  ├─ ingress/
│  │  │  │  └─ argocd-ingressroute.yaml         (Traefik IngressRoute)
│  │  │  └─ kustomization.yaml
│  │  │
│  │  └─ overlays/dev/
│  │     └─ kustomization.yaml
│  │
│  └─ apps/                               # Microservices
│     ├─ argocd/
│     │  └─ applications/
│     │     └─ apps-dev.yaml                     (ApplicationSet)
│     │
│     ├─ base/
│     │  ├─ identity/
│     │  │  ├─ deployment.yaml
│     │  │  ├─ service.yaml
│     │  │  └─ configmap.yaml
│     │  └─ kustomization.yaml
│     │
│     └─ overlays/dev/
│        └─ kustomization.yaml
│
├─ orchestration/apphost-compose/         # Docker Compose + Observability
│  ├─ docker-compose.yml                  (PostgreSQL, Redis, RabbitMQ, OTEL stack)
│  ├─ observability/                      (Prometheus, Grafana, Loki, Tempo configs)
│  └─ scripts/
│
├─ scripts/k3d/                           # Bootstrap & management scripts
│  ├─ bootstrap.ps1                       (Main bootstrap - joins tc-agro-network)
│  ├─ build-push-images.ps1               (Build & push to localhost:5000)
│  ├─ manager.ps1                         (Interactive menu)
│  ├─ status.ps1                          (Cluster status)
│  ├─ cleanup.ps1                         (Delete cluster)
│  └─ README.md                           (This guide)
│
├─ services/                              # Microservices source code
│  ├─ identity-service/
│  ├─ farm-service/
│  ├─ sensor-ingest-service/
│  ├─ analytics-worker/
│  └─ dashboard-service/
│
└─ poc/frontend/                          # Frontend POC
   └─ Dockerfile                          (Build & push to localhost:5000)
```

---

## 🎯 Network Integration Points

### 1. **Bootstrap Creates Cluster in Docker Network**

```powershell
# bootstrap.ps1
$networkName = "tc-agro-network"

# Creates cluster in Docker network
k3d cluster create ... --network $networkName
```

### 2. **Pods Access Docker Compose Services**

```yaml
# configmap.yaml (environment)
ConnectionStrings__PostgreSQL: Host=tc-agro-postgres;Port=5432;...
ConnectionStrings__Redis: tc-agro-redis:6379
RabbitMQ__Host: tc-agro-rabbitmq
OTEL_EXPORTER_OTLP_ENDPOINT: http://otel-collector-agent.observability:4317
```

### 3. **OTEL DaemonSet Exports to Docker Collector**

```yaml
# otel-daemonset.yaml (ConfigMap)
exporters:
  otlp_http/docker:
    endpoint: http://tc-agro-otel-collector:4318
```

### 4. **Observability Stack (Docker Compose)**

```
Prometheus, Grafana, Loki, Tempo run in Docker Compose
↑ Accessed via localhost:3000 (Grafana), localhost:9090 (Prometheus), etc.
↑ Receives telemetry from tc-agro-otel-collector
```

---

## ✅ Verification Checklist

- [x] Registry created: `k3d registry list` shows `localhost:5000`
- [x] Cluster in network: `docker network inspect tc-agro-network` shows k3d nodes
- [x] ArgoCD managing apps: platform-base and apps-dev synced
- [x] Pods resolve container names: `kubectl exec ... -- getent hosts tc-agro-postgres`
- [x] Images can be pushed: `docker push localhost:5000/tc-agro-frontend-service:latest`
- [x] Pods can pull images: no `ImagePullSecret` needed
- [x] OTEL DaemonSet running: `kubectl get pods -n observability`
- [x] Observability stack in Docker Compose: `docker compose ps`

---

> **Architecture Version:** 2.0 (Docker Network Integration)  
> **Date:** February 1, 2026  
> **Key Change:** Observability in Docker Compose, k3d joins tc-agro-network  
> **Status:** ✅ Complete and Tested
