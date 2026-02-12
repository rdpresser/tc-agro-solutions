# 🔄 GitOps Architecture - Visual Flow

## Complete CI/CD Pipeline

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         GITOPS COMPLETE FLOW                                 │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────┐         ┌─────────────────────┐                   │
│  │  Identity Service   │         │  Frontend Service   │                   │
│  │   (Separate Repo)   │         │   (Solutions Repo)  │                   │
│  └──────────┬──────────┘         └──────────┬──────────┘                   │
│             │                               │                               │
│             │ push code                     │ push code                     │
│             ▼                               ▼                               │
│  ┌─────────────────────┐         ┌─────────────────────┐                   │
│  │  GitHub Actions CI  │         │  GitHub Actions CI  │                   │
│  │  identity-ci.yml    │         │  frontend-ci.yml    │                   │
│  └──────────┬──────────┘         └──────────┬──────────┘                   │
│             │                               │                               │
│             ├── build & test                ├── build (vite)                │
│             ├── docker build                ├── docker build                │
│             ├── push to Docker Hub          ├── push to Docker Hub          │
│             │                               │                               │
│             ▼                               ▼                               │
│  ┌──────────────────────────────────────────────────────┐                  │
│  │              Docker Hub (Public Registry)            │                  │
│  │  rdpresser/identity-service:abc12345                 │                  │
│  │  rdpresser/frontend-service:def67890                 │                  │
│  └──────────────────────────────────────────────────────┘                  │
│             │                               │                               │
│             │ commit manifest               │ commit manifest               │
│             ▼                               ▼                               │
│  ┌──────────────────────────────────────────────────────┐                  │
│  │          tc-agro-solutions (Git Repository)          │                  │
│  │                                                       │                  │
│  │  infrastructure/kubernetes/apps/base/                │                  │
│  │    ├── identity/deployment.yaml (updated)            │                  │
│  │    └── frontend/deployment.yaml (updated)            │                  │
│  └────────────────────────┬──────────────────────────────┘                 │
│                           │                                                 │
│                           │ git commit detected                             │
│                           ▼                                                 │
│  ┌──────────────────────────────────────────────────────┐                  │
│  │              ArgoCD (Running in k3d)                 │                  │
│  │                                                       │                  │
│  │  • Polls Git repository every 3 minutes              │                  │
│  │  • Detects manifest changes                          │                  │
│  │  • Auto-sync enabled                                 │                  │
│  │  • Applies changes to cluster                        │                  │
│  └────────────────────────┬──────────────────────────────┘                 │
│                           │                                                 │
│                           │ kubectl apply                                   │
│                           ▼                                                 │
│  ┌──────────────────────────────────────────────────────┐                  │
│  │         k3d Cluster (localhost Kubernetes)           │                  │
│  │                                                       │                  │
│  │  namespace: agro-apps                                │                  │
│  │    ├── identity-service pod                          │                  │
│  │    │   └── image: rdpresser/identity-service:abc123  │                  │
│  │    └── frontend pod                                  │                  │
│        └── image: rdpresser/frontend-service:def678     │                  │
│  └────────────────────────┬──────────────────────────────┘                 │
│                           │                                                 │
│                           │ docker pull from Docker Hub                     │
│                           ▼                                                 │
│                  ✅ Application Running                                     │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Detailed Steps

### Identity Service Flow (Cross-Repo)

```
1. Developer commits to identity-service repo
        ↓
2. GitHub Actions CI triggered
        ├── Checkout identity-service code
        ├── Checkout common library
        ├── Build & test .NET app
        ├── Build Docker image
        ├── Trivy security scan
        ├── Push to Docker Hub: rdpresser/identity-service:abc12345
        └── Push to Docker Hub: rdpresser/identity-service:latest
        ↓
3. GitOps job triggered
        ├── Checkout tc-agro-solutions repo
        ├── Update infrastructure/kubernetes/apps/base/identity/deployment.yaml
        │   └── image: rdpresser/identity-service:abc12345
        ├── Git commit: "ci(identity): update image to abc12345"
        └── Git push to solutions repo
        ↓
4. ArgoCD detects Git change
        ├── Polls every 3 minutes (or immediate if webhook configured)
        ├── Sees deployment.yaml changed
        └── Triggers sync
        ↓
5. ArgoCD applies to cluster
        ├── kubectl apply -f deployment.yaml
        └── Creates new ReplicaSet with new image
        ↓
6. Kubernetes pulls image
        ├── Docker pull rdpresser/identity-service:abc12345
        ├── Terminates old pod
        └── Starts new pod
        ↓
7. ✅ New version running
```

---

### Frontend Service Flow (Same-Repo)

```
1. Developer commits to tc-agro-solutions repo (frontend changes)
        ↓
2. GitHub Actions CI triggered
        ├── Checkout code
        ├── npm ci (install dependencies)
        ├── npm run build (Vite build)
        ├── Build Docker image with dist/
        ├── Trivy security scan
        ├── Push to Docker Hub: rdpresser/frontend-service:def67890
        └── Push to Docker Hub: rdpresser/frontend-service:latest
        ↓
3. GitOps job triggered (same repo)
        ├── Update infrastructure/kubernetes/apps/base/frontend/deployment.yaml
        │   └── image: rdpresser/frontend-service:def67890
        ├── Git commit: "ci(frontend): update image to def67890"
        └── Git push to same repo
        ↓
4. ArgoCD detects Git change
        ├── Polls and sees deployment.yaml changed
        └── Triggers sync
        ↓
5. ArgoCD applies to cluster
        ├── kubectl apply -f deployment.yaml
        └── Creates new ReplicaSet
        ↓
6. Kubernetes pulls image
        ├── Docker pull rdpresser/frontend-service:def67890
        └── Rolling update
        ↓
7. ✅ New frontend running
```

---

## Key Differences: Before vs After

| Aspect              | BEFORE (local images)     | NOW (GitOps + Docker Hub)  |
| ------------------- | ------------------------- | -------------------------- |
| **Image Source**    | Local images              | rdpresser/... (Docker Hub) |
| **Build Location**  | Developer's machine       | GitHub Actions CI          |
| **Deploy Trigger**  | Manual `kubectl apply`    | ArgoCD auto-sync           |
| **Version Control** | No Git history            | Git commits = deployments  |
| **Rollback**        | Manual previous image     | `git revert` manifest      |
| **Multi-Dev**       | Conflicts possible        | Isolated, no conflicts     |
| **Audit Trail**     | None                      | Full Git history           |
| **Pull Policy**     | `Never` or `IfNotPresent` | `Always`                   |

---

## Security & Permissions

```
┌────────────────────────────────────────────────────────────┐
│                   SECURITY BOUNDARIES                      │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Identity Service Repo                                     │
│    ↓ Needs access to:                                      │
│    • Docker Hub (push images)                              │
│    • Solutions repo (commit manifests via PAT)             │
│                                                            │
│  Solutions Repo                                            │
│    ↓ Needs access to:                                      │
│    • Docker Hub (push images)                              │
│    • Same repo (commit manifests via GITHUB_TOKEN)         │
│                                                            │
│  ArgoCD                                                    │
│    ↓ Needs access to:                                      │
│    • Solutions repo (read manifests - public or SSH key)   │
│    • k3d cluster (apply resources - in-cluster auth)       │
│    • Docker Hub (pull images - public, no auth needed)     │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## Why This Architecture is Correct

✅ **Separation of Concerns**

- CI = Build & Test
- Git = Source of Truth
- CD = ArgoCD sync

✅ **Immutable Deployments**

- SHA-based tags
- Git history = deployment history
- Easy rollback

✅ **No Direct Coupling**

- CI doesn't call k8s
- CI doesn't call ArgoCD
- Only Git connection

✅ **Multi-Repo Support**

- Identity isolated
- Frontend integrated
- Both work seamlessly

✅ **Production-Ready**

- Same flow works for AKS/EKS
- Standard GitOps pattern
- Industry best practice

---

## Monitoring Points

```
1. GitHub Actions
   → https://github.com/<repo>/actions
   → Check CI success/failure

2. Docker Hub
   → https://hub.docker.com/u/rdpresser
   → Verify image tags pushed

3. Git Commits
   → git log --oneline --grep="ci("
   → See automated manifest updates

4. ArgoCD UI
   → https://localhost:8080 (port-forward)
   → Watch sync status

5. Kubernetes Pods
   → kubectl get pods -n agro-apps -w
   → See rolling updates
```

---

> **Flow Diagram Version:** 1.0  
> **Last Updated:** February 3, 2026  
> **Visual Guide for:** GitOps CI/CD Pipeline
