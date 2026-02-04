# Platform GitOps Structure - TC Agro Solutions

**Status:** 🔵 CURRENT (Localhost k3d) | Infrastructure components managed by ArgoCD

This folder contains Kubernetes manifests for platform infrastructure components running on **local k3d cluster**. All configurations are optimized for localhost development.

## ⚠️ Important: Observability Architecture

**Full observability stack (Prometheus, Grafana, Loki, Tempo) now runs in Docker Compose**, not in k3d.

**In k3d cluster (this folder):**

- ArgoCD (GitOps controller)
- OTEL DaemonSet (collects telemetry from pods)
- Namespaces (observability, agro-apps)
- Ingress routes

**In Docker Compose (orchestration/apphost-compose/):**

- Prometheus (metrics)
- Grafana (dashboards)
- Loki (logs)
- Tempo (traces)
- OTEL Collector (central)

🟣 **Note:** For Azure production deployment (future), see [terraform/](../../terraform/) directory.

---

## 📁 Directory Structure (Localhost k3d)

```
platform/
├── helm-values/
│   └── dev/                             # DEV environment Helm values
│       └── keda.values.yaml             # KEDA config (optional)
│
├── argocd/                              # ArgoCD manifests
│   ├── bootstrap/
│   │   ├── bootstrap-all.yaml           # Single entrypoint (projects + apps + platform)
│   └── applications/
│       └── platform-base.yaml           # Namespaces + OTEL DaemonSet
├── base/                                # Kustomize base (namespaces, ingress)
│   ├── namespaces/
│       └── namespaces.yaml              # argocd, observability, agro-apps
│   ├── ingress/
│   │   └── argocd-ingressroute.yaml     # Traefik IngressRoute → localhost/argocd
│   ├── otel-daemonset.yaml              # OTEL DaemonSet manifest (kustomize)
│   └── kustomization.yaml
│
└── overlays/
    └── dev/                             # DEV overlay
        └── kustomization.yaml
```

---

## 🎯 How It Works

### 1. Bootstrap Flow

```
scripts/k3d/bootstrap.ps1
  └── Creates cluster (joins tc-agro-network)
  └── Installs ArgoCD
  └── Applies: argocd/bootstrap/bootstrap-all.yaml

ArgoCD syncs:
  └── platform-base (namespaces + OTEL DaemonSet)
  └── apps-dev (microservices)

Docker Compose (separate):
  └── Prometheus, Grafana, Loki, Tempo, OTEL Collector
```

---

### 2. OTEL DaemonSet Configuration

The OTEL DaemonSet runs in k3d to collect telemetry from pods and exports to the Docker Compose OTEL Collector.

**Example (`base/otel-daemonset.yaml` - ConfigMap section):**

```yaml
data:
  otel-collector-config.yaml: |
    exporters:
      otlp_http/docker:
        endpoint: http://tc-agro-otel-collector:4318

    service:
      pipelines:
        traces:
          exporters: [otlp_http/docker]
        metrics:
          exporters: [otlp_http/docker]
        logs:
          exporters: [otlp_http/docker]
```

**Why this architecture?**

- Observability stack is resource-intensive (Prometheus, Grafana, etc.)
- Running in Docker Compose frees k3d resources for applications
- DaemonSet collects from pods, exports to central collector
- Same telemetry data, simpler k3d cluster

---

## 📊 Platform Components (Current)

| Component                   | Purpose                 | Location       | Notes                    |
| --------------------------- | ----------------------- | -------------- | ------------------------ |
| **ArgoCD**                  | GitOps controller       | k3d cluster    | Manages all deployments  |
| **OTEL DaemonSet**          | Telemetry collection    | k3d cluster    | Exports to Docker OTEL   |
| **Namespaces**              | Resource organization   | k3d cluster    | observability, agro-apps |
| **Prometheus**              | Metrics                 | Docker Compose | localhost:9090           |
| **Grafana**                 | Dashboards              | Docker Compose | localhost:3000           |
| **Loki**                    | Logs                    | Docker Compose | localhost:3100           |
| **Tempo**                   | Traces                  | Docker Compose | localhost:3200           |
| **OpenTelemetry Collector** | Telemetry hub (central) | Docker Compose | tc-agro-otel-collector   |

---

## 🔧 Configuration

### OTEL DaemonSet Manifest (`base/otel-daemonset.yaml`)

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: otel-collector-agent-config
  namespace: observability

data:
  otel-collector-config.yaml: |
    receivers:
      otlp:
        protocols:
          grpc:
            endpoint: 0.0.0.0:4317
          http:
            endpoint: 0.0.0.0:4318

    exporters:
      otlp_http/docker:
        endpoint: http://tc-agro-otel-collector:4318

    service:
      pipelines:
        traces:
          receivers: [otlp]
          exporters: [otlp_http/docker]
```

**Key:** The DaemonSet exports to `tc-agro-otel-collector` (Docker container name).

---

## 🚀 GitOps Workflow

### Change Flow

1. **Edit manifest:**

```powershell
notepad platform\base\otel-daemonset.yaml
```

2. **Commit and push:**

   ```powershell
   git add platform/base/otel-daemonset.yaml
   git commit -m "feat: update OTEL DaemonSet config"
   git push origin main
   ```

3. **ArgoCD syncs automatically:**
   - Detects Git change
   - Updates OTEL DaemonSet
   - No manual `helm upgrade` needed

---

## 📦 Application Sync Policies

All Applications use:

```yaml
syncPolicy:
  automated:
    prune: true # Delete resources not in Git
    selfHeal: true # Revert manual kubectl changes
  syncOptions:
    - CreateNamespace=true # Auto-create namespaces
```

**Result:** Full GitOps reconciliation. Manual changes are reverted.

---

## 🛠️ Troubleshooting

### Application Stuck in "Progressing"

```powershell
# Check Application status
kubectl get application platform-base -n argocd

# Describe for events
kubectl describe application platform-base -n argocd

# Check pods in observability namespace
kubectl get pods -n observability
```

---

### OTEL DaemonSet Not Exporting

```powershell
# Check DaemonSet pods
kubectl get pods -n observability -l app.kubernetes.io/name=opentelemetry-collector

# Check logs
kubectl logs -n observability -l app.kubernetes.io/name=opentelemetry-collector

# Verify Docker Compose OTEL Collector is running
docker ps | grep otel
```

---

### Can't Resolve Docker Container Names

```powershell
# Verify k3d is in tc-agro-network
docker network inspect tc-agro-network

# Test from pod
kubectl run test --rm -it --image=busybox --restart=Never -- sh
# Inside pod:
getent hosts tc-agro-otel-collector
nc -zv tc-agro-otel-collector 4318
```

---

## 📚 References

- **ArgoCD Multi-Source Apps:** https://argo-cd.readthedocs.io/en/stable/user-guide/multiple_sources/
- **OpenTelemetry Collector:** https://opentelemetry.io/docs/collector/
- **Docker Compose Observability:** [orchestration/apphost-compose/OBSERVABILITY_STACK_SETUP.md](../../orchestration/apphost-compose/OBSERVABILITY_STACK_SETUP.md)

---

> **Version:** 2.0 (Docker Compose Observability)  
> **Date:** February 1, 2026  
> **Key Change:** Observability in Docker Compose, only OTEL DaemonSet in k3d
