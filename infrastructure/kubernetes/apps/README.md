# Apps GitOps Structure - TC Agro Solutions

**Status:** 🔵 DELIVERED (Localhost k3d) | 4 microservices managed by ArgoCD

This folder contains Kubernetes manifests for **microservice deployments on local k3d cluster**.

**Microservices deployed (Phase 5 — delivered Feb 27, 2026):**

- 🔐 **Identity Service** — authentication, JWT, user lifecycle
- 🌾 **Farm Service** — properties, plots, sensors management
- 📡 **Sensor Ingest Service** — ingestion, time-series persistence, dashboard reads, SignalR
- 📈 **Analytics Service** — alert engine, alert lifecycle, REST API, SignalR

> **Dashboard Service** was not implemented as a separate microservice. Its responsibilities (dashboard reads and real-time updates) were absorbed into Sensor Ingest Service and Analytics Service during the delivery sprint.

🟣 **Azure production deployment** (future): see [terraform/](../../terraform/) — architecture designed, not deployed.

---

## 📁 Directory Structure

```
apps/
├── argocd/
│   └── applications/
│       └── apps-dev.yaml                # ApplicationSet — orchestrates all services via ArgoCD
│
├── base/                                # Kustomize base manifests per service
│   ├── identity/                        # deployment, service, configmap, ingressroute
│   ├── farm/                            # deployment, service, configmap, ingressroute
│   ├── sensor-ingest/                   # deployment, service, configmap, ingressroute
│   ├── analytics-worker/                # deployment, service, configmap, ingressroute
│   ├── frontend/                        # deployment, service, configmap, ingress, ingressroute
│   └── kustomization.yaml               # lists all 5 resource directories
│
└── overlays/
    └── dev/
        ├── kustomization.yaml           # references base + HPA files
        ├── identity-hpa.yaml
        ├── farm-hpa.yaml
        ├── sensor-ingest-hpa.yaml
        └── analytics-worker-hpa.yaml
```

---

## 🔄 How ArgoCD Manages the Services

```
bootstrap.ps1
  └── Creates k3d cluster
  └── Installs ArgoCD
  └── Applies: argocd/bootstrap/bootstrap-all.yaml

ArgoCD syncs:
  └── platform-base (namespaces + OTEL DaemonSet)
  └── apps-dev (microservices via overlays/dev)

Each Git push to main:
  1. ArgoCD detects change in infrastructure/kubernetes/apps/
  2. Reads overlays/dev/kustomization.yaml
  3. Kustomize merges base manifests + HPA configs
  4. ArgoCD applies to agro-apps namespace
  5. automated.prune=true removes anything not in Git
  6. automated.selfHeal=true reverts manual kubectl changes
```

---

## 📊 Service → Manifest Mapping

| Service | Port | Base Path | Image |
|---|---|---|---|
| Identity Service | 5001 | `base/identity/` | `rdpresser/tc-agro-identity-service:latest` |
| Farm Service | 5002 | `base/farm/` | `rdpresser/tc-agro-farm-service:latest` |
| Sensor Ingest Service | 5003 | `base/sensor-ingest/` | `rdpresser/tc-agro-sensor-ingest-service:latest` |
| Analytics Service | 5004 | `base/analytics-worker/` | `rdpresser/tc-agro-analytics-worker:latest` |

Each service directory contains: `deployment.yaml`, `service.yaml`, `configmap.yaml`, `ingressroute.yaml`, `kustomization.yaml`.

---

## 🚀 GitOps Workflow (day-to-day)

```powershell
# Build and push new image
.\scripts\k3d\build-push-images.ps1

# ArgoCD detects new image tag and syncs automatically
# Or force sync:
kubectl -n argocd get app apps-dev
argocd app sync apps-dev  # if ArgoCD CLI installed
```

---

## 📚 References

- [ArgoCD ApplicationSets](https://argo-cd.readthedocs.io/en/stable/user-guide/application-set/)
- [Kustomize Overlays](https://kubernetes.io/docs/tasks/manage-kubernetes-objects/kustomization/)
- [Platform README](../platform/README.md)
- [New Microservice Template](../../../NEW_MICROSERVICE_TEMPLATE.md)

---

> **Version:** 2.0 — Updated to reflect delivered state (Feb 27, 2026)
