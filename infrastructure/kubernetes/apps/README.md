# Apps GitOps Structure - TC Agro Solutions

**Status:** 🔵 CURRENT (Localhost k3d) | Microservices managed by ArgoCD

This folder contains Kubernetes manifests for **microservice deployments on local k3d cluster**. All configurations are optimized for localhost development.

**Microservices deployed here:**

- 🔐 Identity.Api (authentication)
- 🌾 Farm.Api (properties/plots management)
- 📡 Ingest.Api (sensor data ingestion)
- 📈 Analytics.Worker (rules and alerts)
- 📊 Dashboard.Api (queries and dashboards)

🟣 **Note:** For Azure production deployment (future), see [terraform/](../../terraform/) directory.

---

## 📁 Directory Structure (Localhost k3d)

```
apps/
├── argocd/                              # ArgoCD manifests
│   ├── projects/                        # (Managed by platform; see platform/argocd/projects/)
│   │   └── [project-apps.yaml is in platform/]
│   └── applications/
│       └── apps-dev.yaml                # Application for microservices
│
├── base/                                # Kustomize base (placeholder)
│   └── kustomization.yaml
│
└── overlays/
    └── dev/                             # DEV overlay (placeholder)
        └── kustomization.yaml
```

**Note:** The `project-apps` AppProject is defined once in `platform/argocd/projects/project-apps.yaml` and shared by all applications.

---

## 🎯 Current Status: Placeholder

This structure is a **placeholder** for future microservice deployments.

### Why Placeholder?

Currently, the 5 microservice repositories contain **only application code**:

- `tc-agro-identity-service`
- `tc-agro-farm-service`
- `tc-agro-sensor-ingest-service`
- `tc-agro-analytics-worker`
- `tc-agro-dashboard-service`

**Missing:** Kubernetes manifests (Deployment, Service, Ingress, ConfigMap)

---

## 🚀 Future Implementation Plan

### Phase 1: Add K8s Manifests to Each Microservice

Each microservice repo will have:

```
tc-agro-identity-service/
├── src/                                 # Application code
│   └── Agro.Identity.Api/
├── k8s/                                 # Kubernetes manifests (NEW)
│   ├── base/
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   ├── configmap.yaml
│   │   └── kustomization.yaml
│   └── overlays/
│       └── dev/
│           ├── kustomization.yaml
│           └── patches/
│               └── resources.yaml
└── Dockerfile
```

---

### Phase 2: Create ArgoCD ApplicationSet

`apps/argocd/applications/apps-dev.yaml` will use **ApplicationSet** to automatically deploy all microservices:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: apps-dev
  namespace: argocd
spec:
  generators:
    # List generator: one Application per microservice
    - list:
        elements:
          - name: identity-service
            repo: https://github.com/rdpresser/tc-agro-identity-service.git
            path: k8s/overlays/dev

          - name: farm-service
            repo: https://github.com/rdpresser/tc-agro-farm-service.git
            path: k8s/overlays/dev

          - name: sensor-ingest-service
            repo: https://github.com/rdpresser/tc-agro-sensor-ingest-service.git
            path: k8s/overlays/dev

          - name: analytics-worker
            repo: https://github.com/rdpresser/tc-agro-analytics-worker.git
            path: k8s/overlays/dev

          - name: dashboard-service
            repo: https://github.com/rdpresser/tc-agro-dashboard-service.git
            path: k8s/overlays/dev

  template:
    metadata:
      name: "{{name}}"
      namespace: argocd

    spec:
      project: apps

      source:
        repoURL: "{{repo}}"
        targetRevision: main
        path: "{{path}}"

      destination:
        server: https://kubernetes.default.svc
        namespace: agro-apps

      syncPolicy:
        automated:
          prune: true
          selfHeal: true
        syncOptions:
          - CreateNamespace=true
```

---

## 📦 Example: Identity Service Manifests

### Deployment (`k8s/base/deployment.yaml`)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: identity-service
  labels:
    app: identity-service
spec:
  replicas: 2
  selector:
    matchLabels:
      app: identity-service
  template:
    metadata:
      labels:
        app: identity-service
    spec:
      # Deploy to apps node pool
      nodeSelector:
        agentpool: apps

      containers:
        - name: identity-service
          image: localhost:5000/agro-identity-service:latest
          imagePullPolicy: IfNotPresent

          ports:
            - containerPort: 8080
              name: http

          env:
            - name: ASPNETCORE_ENVIRONMENT
              value: Development

            - name: ConnectionStrings__DefaultConnection
              valueFrom:
                configMapKeyRef:
                  name: identity-config
                  key: db-connection-string

          resources:
            requests:
              memory: 512Mi
              cpu: 250m
            limits:
              memory: 1Gi
              cpu: 500m

          livenessProbe:
            httpGet:
              path: /health/live
              port: 8080
            initialDelaySeconds: 30
            periodSeconds: 10

          readinessProbe:
            httpGet:
              path: /health/ready
              port: 8080
            initialDelaySeconds: 10
            periodSeconds: 5
```

---

### Service (`k8s/base/service.yaml`)

```yaml
apiVersion: v1
kind: Service
metadata:
  name: identity-service
  labels:
    app: identity-service
spec:
  selector:
    app: identity-service
  ports:
    - protocol: TCP
      port: 80
      targetPort: 8080
  type: ClusterIP
```

---

### ConfigMap (`k8s/base/configmap.yaml`)

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: identity-config
data:
  db-connection-string: "Host=postgres;Database=agro_identity;Username=postgres;Password=postgres"
```

---

### Kustomization (`k8s/base/kustomization.yaml`)

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: agro-apps

resources:
  - deployment.yaml
  - service.yaml
  - configmap.yaml

commonLabels:
  app: identity-service
```

---

### DEV Overlay (`k8s/overlays/dev/kustomization.yaml`)

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: agro-apps

bases:
  - ../../base

# DEV-specific patches
patches:
  # Lower replicas for DEV
  - target:
      kind: Deployment
      name: identity-service
    patch: |-
      - op: replace
        path: /spec/replicas
        value: 1

  # DEV-specific env vars
  - target:
      kind: Deployment
      name: identity-service
    patch: |-
      - op: add
        path: /spec/template/spec/containers/0/env/-
        value:
          name: ASPNETCORE_ENVIRONMENT
          value: Development
```

---

## 🚀 Workflow After Manifests Added

### 1. Developer Adds K8s Manifests

```powershell
# In each microservice repo
cd tc-agro-identity-service
mkdir k8s\base
mkdir k8s\overlays\dev

# Create manifests (deployment, service, configmap)
# ...

git add k8s/
git commit -m "feat: add Kubernetes manifests"
git push origin main
```

---

### 2. Uncomment ApplicationSet

Edit `apps/argocd/applications/apps-dev.yaml`:

```powershell
notepad infrastructure\kubernetes\apps\argocd\applications\apps-dev.yaml
```

Remove comment block, commit:

```powershell
git add apps/argocd/applications/apps-dev.yaml
git commit -m "feat: enable ApplicationSet for microservices"
git push origin main
```

---

### 3. ArgoCD Auto-Syncs

- ArgoCD detects new ApplicationSet
- Creates 5 Applications (one per microservice)
- Each Application syncs from its repo
- Microservices deployed to `agro-apps` namespace

---

## 📊 Microservices Repository Mapping

| Microservice              | Repository                                                     | K8s Path (future)  |
| ------------------------- | -------------------------------------------------------------- | ------------------ |
| **Identity Service**      | https://github.com/rdpresser/tc-agro-identity-service.git      | `k8s/overlays/dev` |
| **Farm Service**          | https://github.com/rdpresser/tc-agro-farm-service.git          | `k8s/overlays/dev` |
| **Sensor Ingest Service** | https://github.com/rdpresser/tc-agro-sensor-ingest-service.git | `k8s/overlays/dev` |
| **Analytics Worker**      | https://github.com/rdpresser/tc-agro-analytics-worker.git      | `k8s/overlays/dev` |
| **Dashboard Service**     | https://github.com/rdpresser/tc-agro-dashboard-service.git     | `k8s/overlays/dev` |

---

## 🎯 ArgoCD Project Configuration

The `apps` project is defined in `platform/argocd/projects/project-apps.yaml` and allows:

- **All source repositories** (via `sourceRepos: ['*']`)
- **All destinations** (via `destinations: [namespace: '*']`)

This flexible configuration supports all microservices and future applications:

```yaml
spec:
  sourceRepos:
    - "*" # All repositories allowed

  destinations:
    - namespace: "*"
      server: https://kubernetes.default.svc
```

> **Note:** Individual applications (in `apps-dev` Application) specify exact source repos and target namespace `agro-apps`.

---

## 🛠️ Ingress Configuration (Future)

Each microservice will have an Ingress:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: identity-service-ingress
  namespace: agro-apps
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  ingressClassName: nginx
  rules:
    - host: agro.local
      http:
        paths:
          - path: /auth
            pathType: Prefix
            backend:
              service:
                name: identity-service
                port:
                  number: 80
```

**Result:** `http://agro.local/auth` → Identity Service

---

## 📚 References

- **ArgoCD ApplicationSets:** https://argo-cd.readthedocs.io/en/stable/user-guide/application-set/
- **Kustomize Overlays:** https://kubernetes.io/docs/tasks/manage-kubernetes-objects/kustomization/#bases-and-overlays
- **Microservice Template:** [/NEW_MICROSERVICE_TEMPLATE.md](../../../NEW_MICROSERVICE_TEMPLATE.md)

---

## 🔄 Next Steps

1. ✅ **Platform Stack Running** (Prometheus, Grafana, Loki, Tempo via GitOps)
2. ⏳ **Add K8s Manifests** to each microservice repository
3. ⏳ **Uncomment ApplicationSet** in `apps-dev.yaml`
4. ⏳ **Push to Git** → ArgoCD auto-deploys microservices

---

> **Version:** 1.0 (Placeholder)  
> **Date:** January 15, 2026  
> **Status:** Waiting for K8s manifests in microservice repositories
