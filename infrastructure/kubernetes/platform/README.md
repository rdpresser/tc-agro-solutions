# Platform GitOps Structure - TC Agro Solutions

**Status:** 🔵 CURRENT (Localhost k3d) | Infrastructure components managed by ArgoCD

This folder contains Kubernetes manifests for platform infrastructure components running on **local k3d cluster**. All configurations are optimized for localhost development.

**Components managed here:**

- Prometheus (metrics)
- Grafana (dashboards)
- Loki (logs)
- Tempo (traces)
- OpenTelemetry Collector (telemetry hub)
- ArgoCD (GitOps controller)

🟣 **Note:** For Azure production deployment (future), see [terraform/](../../terraform/) directory.

---

## 📁 Directory Structure (Localhost k3d)

```
platform/
├── helm-values/
│   └── dev/                             # DEV environment Helm values
│       ├── kube-prometheus-stack.values.yaml
│       ├── loki.values.yaml
│       ├── tempo.values.yaml
│       └── otel-collector.values.yaml
│
├── argocd/                              # ArgoCD manifests
│   ├── bootstrap/
│   │   ├── bootstrap-platform.yaml      # Platform infrastructure bootstrap
│   │   └── bootstrap-apps.yaml          # Applications bootstrap
│   ├── projects/
│   │   └── project-platform.yaml        # Platform Project
│   └── applications/
│       └── platform-observability.yaml  # Installs: Prometheus, Grafana, Loki, Tempo, OTel
├── base/                                # Kustomize base (namespaces, ingress)
│   ├── namespaces/
│       └── namespaces.yaml              # argocd, observability, agro-apps
│   ├── ingress/
│   │   └── argocd-ingressroute.yaml     # Traefik IngressRoute → localhost/argocd
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
  └── Creates cluster + installs ArgoCD
  └── Applies: argocd/bootstrap/bootstrap-platform.yaml (platform)
  └── Applies: argocd/bootstrap/bootstrap-apps.yaml (applications)

ArgoCD reads: argocd/applications/
  └── platform-observability.yaml
      └── Installs: Prometheus, Grafana, Loki, Tempo, OTel
```

---

### 2. Multi-Source Application Pattern

Each Application uses **multi-source** to combine:

- Helm charts from upstream (e.g., Prometheus community)
- Helm values from Git (versioned, auditable)

**Example (`platform-observability.yaml`):**

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: platform-observability
spec:
  sources:
    # 1) Helm chart from upstream
    - repoURL: https://prometheus-community.github.io/helm-charts
      chart: kube-prometheus-stack
      targetRevision: 65.0.0
      helm:
        valueFiles:
          - $values/infrastructure/kubernetes/platform/helm-values/dev/kube-prometheus-stack.values.yaml

    # 2) Values from Git repo
    - repoURL: https://github.com/rdpresser/tc-agro-solutions.git
      targetRevision: main
      ref: values

    # 3) Loki chart
    - repoURL: https://grafana.github.io/helm-charts
      chart: loki
      targetRevision: 6.21.0
      helm:
        valueFiles:
          - $values/infrastructure/kubernetes/platform/helm-values/dev/loki.values.yaml

    # ... (Tempo, OTel Collector)
```

**Why Multi-source?**

- Helm charts from official repos (versioned, stable)
- Helm values from our Git (versioned, auditable)
- Changes to values → Git PR → ArgoCD auto-syncs
- No manual `helm upgrade` commands

---

## 🛠️ Adding a New Platform Component

**Example: Adding Jaeger for tracing**

### 1. Create Helm Values

`platform/helm-values/dev/jaeger.values.yaml`:

```yaml
# Jaeger configuration for DEV
allInOne:
  enabled: true

agent:
  enabled: false

collector:
  enabled: false

query:
  enabled: false

resources:
  limits:
    memory: 1Gi
    cpu: 500m

# Node affinity (system pool)
nodeSelector:
  agentpool: system

tolerations:
  - key: agentpool
    operator: Equal
    value: system
    effect: NoSchedule
```

---

### 2. Create ArgoCD Application

`platform/argocd/applications/platform-jaeger.yaml`:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: platform-jaeger
  namespace: argocd
spec:
  project: platform

  sources:
    # Helm chart from Jaeger
    - repoURL: https://jaegertracing.github.io/helm-charts
      chart: jaeger
      targetRevision: 3.3.1
      helm:
        releaseName: jaeger
        valueFiles:
          - $values/infrastructure/kubernetes/platform/helm-values/dev/jaeger.values.yaml

    # Values from Git
    - repoURL: https://github.com/rdpresser/tc-agro-solutions.git
      targetRevision: main
      ref: values

  destination:
    server: https://kubernetes.default.svc
    namespace: observability

  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
```

---

### 3. Commit and Push

```powershell
git add platform/helm-values/dev/jaeger.values.yaml
git add platform/argocd/applications/platform-jaeger.yaml
git commit -m "feat: add Jaeger to platform stack"
git push origin main
```

---

### 4. ArgoCD Auto-Syncs

- ArgoCD detects new Application manifest
- Creates `platform-jaeger` Application
- Installs Jaeger with values from Git
- **No manual helm commands needed!**

---

## 📊 Platform Components

| Component                   | Purpose                             | Namespace     | Helm Chart                                 |
| --------------------------- | ----------------------------------- | ------------- | ------------------------------------------ |
| **kube-prometheus-stack**   | Prometheus + Grafana + AlertManager | observability | prometheus-community/kube-prometheus-stack |
| **Loki**                    | Log aggregation                     | observability | grafana/loki                               |
| **Tempo**                   | Distributed tracing                 | observability | grafana/tempo                              |
| **OpenTelemetry Collector** | Telemetry hub (OTLP)                | observability | open-telemetry/opentelemetry-collector     |

---

## 🎯 Helm Values Strategy

### DEV Environment (`helm-values/dev/`)

**Common patterns:**

1. **Node Affinity (System Pool)**

   ```yaml
   nodeSelector:
     agentpool: system

   tolerations:
     - key: agentpool
       operator: Equal
       value: system
       effect: NoSchedule
   ```

2. **Resource Limits (DEV)**

   ```yaml
   resources:
     limits:
       memory: 2Gi
       cpu: 1000m
     requests:
       memory: 512Mi
       cpu: 250m
   ```

3. **Retention (DEV)**

   ```yaml
   # Short retention for development
   retention: 12h
   ```

4. **Persistence (DEV)**
   ```yaml
   # Small volumes for development
   persistence:
     enabled: true
     size: 2Gi
   ```

---

### Future: PROD Environment (`helm-values/prod/`)

When creating PROD environment:

```
platform/helm-values/
├── dev/                    # Development (current)
│   ├── kube-prometheus-stack.values.yaml (12h retention, 2Gi)
│   └── ...
└── prod/                   # Production (future)
    ├── kube-prometheus-stack.values.yaml (30d retention, 50Gi)
    └── ...
```

---

## 🔧 Kustomize Structure

### Base (`base/`)

Contains **environment-agnostic** resources:

- Namespaces
- ArgoCD Ingress

### Overlays (`overlays/dev/`)

Contains **environment-specific** patches:

- Currently empty (all config in Helm values)
- Future: ConfigMaps, Secrets patches

---

## 🚀 GitOps Workflow

### Change Flow

1. **Edit Helm values:**

   ```powershell
   notepad platform\helm-values\dev\loki.values.yaml
   ```

2. **Commit and push:**

   ```powershell
   git add platform/helm-values/dev/loki.values.yaml
   git commit -m "feat: increase Loki retention to 24h"
   git push origin main
   ```

3. **ArgoCD syncs automatically:**
   - Detects Git change
   - Updates Loki Helm release
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
kubectl get application platform-observability -n argocd

# Describe for events
kubectl describe application platform-observability -n argocd

# Check pods in target namespace
kubectl get pods -n monitoring
```

---

### Helm Release Failed

```powershell
# List Helm releases
helm list -n monitoring

# Get release history
helm history kube-prom-stack -n monitoring

# Check ArgoCD logs
kubectl logs -n argocd deployment/argocd-application-controller
```

---

### Values Not Applied

**Common causes:**

1. **Typo in `valueFiles` path**

   ```yaml
   # Wrong:
   valueFiles:
     - $values/platform/helm-values/dev/loki.values.yaml

   # Correct:
   valueFiles:
     - $values/infrastructure/kubernetes/platform/helm-values/dev/loki.values.yaml
   ```

2. **Wrong `ref` name**
   ```yaml
   # Must match the repoURL reference
   - repoURL: https://github.com/rdpresser/tc-agro-solutions.git
     ref: values # This name is used in $values/...
   ```

---

## 📚 References

- **ArgoCD Multi-Source Apps:** https://argo-cd.readthedocs.io/en/stable/user-guide/multiple_sources/
- **Helm Values Documentation:** https://helm.sh/docs/chart_template_guide/values_files/
- **Kustomize Overlays:** https://kubernetes.io/docs/tasks/manage-kubernetes-objects/kustomization/#bases-and-overlays

---

> **Version:** 1.0 (GitOps Platform)  
> **Date:** January 15, 2026  
> **Approach:** Declarative Helm values + ArgoCD multi-source Applications
