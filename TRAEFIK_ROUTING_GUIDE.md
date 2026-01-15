# Traefik Routing - Complete Setup Guide

**Date:** January 15, 2026  
**Status:** ✅ COMPLETE - Traefik is the sole ingress controller  
**Environment:** k3d local cluster (Kubernetes 1.31.5)

---

## 📖 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Routes](#routes)
4. [Implementation](#implementation)
5. [Troubleshooting](#troubleshooting)
6. [Next Steps](#next-steps)

---

## Overview

### What is Traefik?

Traefik is the **default ingress controller in k3s**. It provides:
- Native routing for Kubernetes services
- IngressRoute CRD (native k3s resource type)
- Zero-configuration path-based routing
- LoadBalancer integration on port 80/443

### Why Traefik (not NGINX)?

| Feature | Traefik | NGINX Ingress |
|---------|---------|---------------|
| **Integration** | ✅ k3s built-in | ❌ External installation |
| **Configuration** | ✅ IngressRoute CRD | ❌ Ingress (generic) |
| **Controller Conflict** | ✅ None (explicit) | ❌ Ambiguous with Traefik |
| **Setup Complexity** | ✅ Zero-config | ❌ Requires Helm |
| **Port Binding** | ✅ Native | ❌ Via port-forward |

**Decision:** Use Traefik as the **sole ingress controller**. NGINX removed to eliminate routing conflicts.

---

## Architecture

### Cluster Topology

```
┌─────────────────────────────────────────────────────────┐
│              k3s Cluster (Kubernetes 1.31.5)             │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │         Traefik (k3s built-in)                   │  │
│  │  ├─ IngressRoute CRD (traefik.io/v1alpha1)       │  │
│  │  ├─ LoadBalancer (svclb-traefik)                 │  │
│  │  ├─ Port 80 → localhost:80                       │  │
│  │  └─ Port 443 → localhost:443                     │  │
│  └──────────────────────────────────────────────────┘  │
│                      ↓                                 │
│  ┌──────────────────────────────────────────────────┐  │
│  │         Routing Rules (Middleware)                │  │
│  │  ├─ PathPrefix(/agro) → Strip → frontend         │  │
│  │  ├─ PathPrefix(/arcocd) → Strip → argocd         │  │
│  │  └─ Host(agro.local) → frontend                  │  │
│  │  └─ Host(arcocd.local) → argocd                  │  │
│  └──────────────────────────────────────────────────┘  │
│                      ↓                                 │
│  ┌──────────────────────────────────────────────────┐  │
│  │         Services (ClusterIP)                      │  │
│  │  ├─ frontend (agro-apps ns)                       │  │
│  │  ├─ argocd-server (argocd ns)                     │  │
│  │  └─ future microservices                          │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Node Pool Strategy (3 pools)

| Pool | Memory | Purpose | Nodes |
|------|--------|---------|-------|
| **system** | 4GB | kube-system, CoreDNS, CNI | agent-0 |
| **platform** | 6GB | ArgoCD, Ingress, cert-manager | agent-1 |
| **apps** | 8GB | .NET microservices, Frontend | agent-2 |

---

## Routes

### Path-Based Routing (Zero Configuration)

**Works out-of-the-box on localhost. No hosts file needed.**

```
┌──────────────────────────────────────────┐
│         Traefik LoadBalancer             │
│         (localhost:80)                   │
└──────────┬───────────────────────────────┘
           │
    ┌──────┴──────────┐
    │                 │
    ▼                 ▼
GET /agro        GET /arcocd
    │                 │
    ├─ StripPrefix    ├─ StripPrefix
    │   (/agro)       │   (/arcocd)
    ▼                 ▼
GET /          GET /
    │                 │
    ▼                 ▼
frontend        argocd-server
```

**Access:**

```bash
# Frontend
curl http://localhost/agro
curl http://localhost/agro/dashboard
curl http://localhost/agro/properties

# ArgoCD
curl http://localhost/arcocd
```

**Browser:**
- Frontend: `http://localhost/agro`
- ArgoCD: `http://localhost/arcocd`

---

### Host-Based Routing (Optional, requires hosts file)

**Requires adding entries to `C:\Windows\System32\drivers\etc\hosts`**

```
127.0.0.1 agro.local
127.0.0.1 arcocd.local
```

**Access:**

```bash
# Frontend
curl http://agro.local

# ArgoCD
curl http://arcocd.local
```

**Browser:**
- Frontend: `http://agro.local`
- ArgoCD: `http://arcocd.local`

---

## Implementation

### Core Files

#### 1. Frontend IngressRoute

**File:** `infrastructure/kubernetes/apps/base/frontend/ingressroute.yaml`

```yaml
apiVersion: traefik.io/v1alpha1
kind: IngressRoute
metadata:
  name: frontend
  namespace: agro-apps
spec:
  entryPoints:
    - web  # HTTP port 80
  
  routes:
    # Path-based routing
    - match: Host(`localhost`) && PathPrefix(`/agro`)
      services:
        - name: frontend
          port: 80
      middlewares:
        - name: strip-agro-prefix
        - name: compress
    
    # Host-based routing (requires hosts file)
    - match: Host(`agro.local`)
      services:
        - name: frontend
          port: 80
      middlewares:
        - name: compress
```

**Middleware (strip prefix before sending to pod):**

```yaml
apiVersion: traefik.io/v1alpha1
kind: Middleware
metadata:
  name: strip-agro-prefix
  namespace: agro-apps
spec:
  stripPrefix:
    prefixes:
      - /agro
```

---

#### 2. ArgoCD IngressRoute

**File:** `infrastructure/kubernetes/platform/base/ingress/arcocd-ingressroute.yaml`

```yaml
apiVersion: traefik.io/v1alpha1
kind: IngressRoute
metadata:
  name: arcocd
  namespace: argocd
spec:
  entryPoints:
    - web  # HTTP port 80
  
  routes:
    # Path-based routing
    - match: Host(`localhost`) && PathPrefix(`/arcocd`)
      services:
        - name: argocd-server
          port: 80
      middlewares:
        - name: strip-arcocd-prefix
        - name: compress
    
    # Host-based routing (requires hosts file)
    - match: Host(`arcocd.local`)
      services:
        - name: argocd-server
          port: 80
      middlewares:
        - name: compress
```

---

#### 3. Kustomization Configuration

**File:** `infrastructure/kubernetes/apps/base/frontend/kustomization.yaml`

```yaml
resources:
  - namespace.yaml
  - deployment.yaml
  - service.yaml
  - ingressroute.yaml        # ✅ Traefik IngressRoute
  # - ingress.yaml           # ❌ Disabled: NGINX Ingress (legacy)
```

**File:** `infrastructure/kubernetes/platform/base/kustomization.yaml`

```yaml
resources:
  - namespaces/namespaces.yaml
  - ingress/arcocd-ingressroute.yaml  # ✅ Traefik IngressRoute
```

---

### Vite Frontend Configuration

**File:** `poc/frontend/vite.config.js`

```javascript
export default defineConfig(({ mode }) => ({
  base: process.env.VITE_BASE_PATH || (mode === 'production' ? '/agro/' : './'),
  // ...
}));
```

**npm scripts** (`package.json`):

```json
{
  "scripts": {
    "dev": "vite",
    "build": "node --no-deprecation -e \"...\" && vite build",
    "build:k8s": "cross-env VITE_BASE_PATH=/agro/ npm run build",
    "build:root": "cross-env VITE_BASE_PATH=/ npm run build"
  },
  "devDependencies": {
    "cross-env": "^10.1.0"
  }
}
```

**Why `cross-env`?**
- On Windows: `SET VITE_BASE_PATH=/agro/` (PowerShell)
- On macOS/Linux: `export VITE_BASE_PATH=/agro/`
- `cross-env` handles both automatically

---

### Docker Build

**File:** `poc/frontend/Dockerfile`

```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
# Build for Kubernetes with base path /agro/
RUN npm run build:k8s

# Runtime stage
FROM nginx:1.27-alpine
RUN rm -rf /usr/share/nginx/html/*
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
```

---

## Deployment Steps

### 1. Fresh Cluster Setup

```bash
# Cleanup (if redeploying)
cd scripts/k3d
.\cleanup.ps1

# Bootstrap new cluster with Traefik
.\bootstrap.ps1
```

### 2. Deploy Platform (ArgoCD + observability)

```bash
cd infrastructure/kubernetes
kubectl apply -k platform/overlays/dev
```

### 3. Deploy Applications (Frontend)

```bash
kubectl apply -k apps/overlays/dev
```

### 4. Verify Traefik

```bash
# Check Traefik is running
kubectl get pods -n kube-system | grep traefik
# Expected: traefik-xxx (1/1 Running), svclb-traefik-xxx (2/2 Running)

# Check IngressRoutes created
kubectl get ingressroute -n agro-apps
# Expected: frontend

kubectl get ingressroute -n argocd
# Expected: arcocd
```

### 5. Test Routes

```bash
# Test path-based routing
curl -v http://localhost/agro
curl -v http://localhost/arcocd

# Expected: HTTP/1.1 200 OK
```

---

## Verification Commands

### Check Ingress Controllers

```bash
kubectl get ingressclass
# Expected output:
# NAME      CONTROLLER                      
# traefik   traefik.io/ingress-controller   

# NGINX should NOT appear if properly removed
```

### Check Service LoadBalancer

```bash
kubectl get svc -n kube-system traefik
# Expected: LoadBalancer with External IP
```

### Check Routes

```bash
kubectl describe ingressroute frontend -n agro-apps
kubectl describe ingressroute arcocd -n argocd
```

### Test Routing

```bash
# Frontend (path-based)
curl http://localhost/agro

# ArgoCD (path-based)
curl http://localhost/arcocd

# With host-based (after hosts file config)
curl http://agro.local
curl http://arcocd.local
```

---

## Troubleshooting

### Issue: Cannot reach localhost/agro

**Symptom:** `curl: (7) Failed to connect to localhost port 80`

**Solution:**
```bash
# Check Traefik LoadBalancer is running
kubectl get svc -n kube-system traefik
# Should show LoadBalancer with external IPs

# Check Traefik pods
kubectl get pods -n kube-system | grep traefik
# Should show traefik pod in Running state

# Check IngressRoute is created
kubectl get ingressroute -n agro-apps
```

---

### Issue: 404 or wrong content

**Symptom:** `HTTP 404 Not Found` or incorrect HTML

**Solution:**
```bash
# Check frontend pod is running
kubectl get pods -n agro-apps

# If ErrImagePull: build and push image
cd poc/frontend
docker build -t agro-frontend:latest -f Dockerfile .
k3d image import agro-frontend:latest -c dev

# Restart deployment
kubectl rollout restart deployment/frontend -n agro-apps
```

---

### Issue: NGINX pods still present

**Symptom:** `kubectl get pods -n ingress-nginx` returns pods

**Solution:**
```bash
# Remove NGINX namespace
kubectl delete namespace ingress-nginx

# Verify only Traefik remains
kubectl get ingressclass
# Should show ONLY traefik
```

---

## Configuration Files Location

```
infrastructure/kubernetes/
├── apps/
│   └── base/
│       └── frontend/
│           ├── ingressroute.yaml      ← Frontend routing
│           ├── kustomization.yaml     ← References ingressroute.yaml
│           ├── deployment.yaml
│           ├── service.yaml
│           └── namespace.yaml
│
└── platform/
    └── base/
        ├── ingress/
        │   └── arcocd-ingressroute.yaml  ← ArgoCD routing
        └── kustomization.yaml           ← References arcocd-ingressroute.yaml

poc/frontend/
├── vite.config.js                    ← Dynamic base path config
├── package.json                      ← npm scripts with cross-env
├── Dockerfile                        ← Build with npm run build:k8s
└── nginx.conf                        ← Serve static files + try_files
```

---

## FAQ

### Q: Why use path-based instead of host-based?

**A:** Path-based works out-of-the-box on localhost without modifying hosts file. Host-based requires Windows admin access to edit `C:\Windows\System32\drivers\etc\hosts`.

### Q: Can I use NGINX Ingress instead?

**A:** Not recommended. Traefik is k3s built-in and works perfectly. NGINX would create controller conflicts.

### Q: How do I add a new service route?

**A:** Create an IngressRoute in the service namespace:

```yaml
apiVersion: traefik.io/v1alpha1
kind: IngressRoute
metadata:
  name: my-service
  namespace: my-namespace
spec:
  entryPoints:
    - web
  routes:
    - match: Host(`localhost`) && PathPrefix(`/my-service`)
      services:
        - name: my-service
          port: 80
      middlewares:
        - name: strip-my-service-prefix

---
apiVersion: traefik.io/v1alpha1
kind: Middleware
metadata:
  name: strip-my-service-prefix
  namespace: my-namespace
spec:
  stripPrefix:
    prefixes:
      - /my-service
```

### Q: How do I remove the /agro prefix in the URL?

**A:** Update Vite base path. Currently:
- Dev: `./` (localhost:3000)
- Prod: `/agro/` (Kubernetes)

To change to root (`/`):
```bash
npm run build:root
```

---

## References

- [Traefik Documentation](https://doc.traefik.io/traefik/)
- [IngressRoute CRD](https://doc.traefik.io/traefik/routing/providers/kubernetes-crd/)
- [Traefik Middlewares](https://doc.traefik.io/traefik/middlewares/overview/)
- [k3s Networking](https://docs.k3s.io/networking)
- [Vite Base Path](https://vitejs.dev/config/shared-options.html#base)

---

## Changelog

| Date | Change | Status |
|------|--------|--------|
| 2026-01-15 | Initial Traefik IngressRoute implementation | ✅ Complete |
| 2026-01-15 | Removed NGINX Ingress from cluster | ✅ Complete |
| 2026-01-15 | Verified path-based routing works | ✅ Tested |

