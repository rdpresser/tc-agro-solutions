# 🔄 GitOps Integration - CI/CD Setup

**Date:** February 3, 2026  
**Status:** ✅ Implemented

---

## 🎯 Overview

GitOps completo implementado com:

- **CI:** GitHub Actions (build, test, push Docker Hub)
- **CD:** ArgoCD (auto-sync via Git)
- **Registry:** Docker Hub (público)
- **Cluster:** k3d localhost

---

## 🏗️ Architecture Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                        GITOPS FLOW                               │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Developer Push                                                  │
│         ↓                                                        │
│  GitHub Actions CI                                               │
│         ├── Build & Test                                         │
│         ├── Docker Build & Push (Docker Hub)                     │
│         └── Update Kubernetes Manifest (Git Commit)              │
│                  ↓                                               │
│         Git Commit Triggers ArgoCD                               │
│                  ↓                                               │
│         ArgoCD Auto-Sync                                         │
│                  ↓                                               │
│         kubectl apply                                            │
│                  ↓                                               │
│         k3d pulls from Docker Hub                                │
│                  ↓                                               │
│         New pods running                                         │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 📁 Repository Structure

### Identity Service (Separate Repo)

```
rdpresser/tc-agro-identity-service
├── .github/workflows/
│   └── identity-ci.yml          # ✅ CI + GitOps commit
├── src/
└── ...
```

**CI Flow:**

1. Build .NET app
2. Run tests
3. Build & push Docker image → `rdpresser/identity-service:${SHA}`
4. **Commit to solutions repo** → `infrastructure/kubernetes/apps/base/identity/deployment.yaml`
5. ArgoCD detects change → deploys

---

### Solutions Repo (This Repo)

```
rdpresser/tc-agro-solutions
├── .github/workflows/
│   └── frontend-ci.yml          # ✅ CI + GitOps commit (same repo)
├── poc/frontend/                # Frontend source
├── infrastructure/kubernetes/
│   └── apps/base/
│       ├── identity/
│       │   └── deployment.yaml  # ✅ Updated by identity CI
│       └── frontend/
│           └── deployment.yaml  # ✅ Updated by frontend CI
└── ...
```

**Frontend CI Flow:**

1. Build Vite app
2. Build & push Docker image → `rdpresser/frontend-service:${SHA}`
3. **Commit to same repo** → `infrastructure/kubernetes/apps/base/frontend/deployment.yaml`
4. ArgoCD detects change → deploys

---

## 🔐 Required Secrets

### Identity Service Repo

```bash
# Docker Hub credentials
DOCKERHUB_USERNAME=rdpresser
DOCKERHUB_TOKEN=<your-token>

# PAT for updating solutions repo
SOLUTIONS_REPO_TOKEN=<github-pat-with-repo-write-access>
```

**Create PAT:**

1. GitHub → Settings → Developer Settings → Personal Access Tokens → Fine-grained
2. Repository access: Only select `tc-agro-solutions`
3. Permissions: `Contents: Read and Write`
4. Generate and copy token
5. Add to identity-service repo secrets as `SOLUTIONS_REPO_TOKEN`

---

### Solutions Repo (Frontend)

```bash
# Docker Hub credentials
DOCKERHUB_USERNAME=rdpresser
DOCKERHUB_TOKEN=<your-token>

# GITHUB_TOKEN (automatic, no setup needed)
```

---

## 🚀 How to Test

### Test Identity CI (Cross-Repo GitOps)

```bash
# 1. Make a code change in identity-service repo
cd ~/tc-agro-identity-service
git checkout -b test/gitops-integration
echo "// test" >> src/TC.Agro.Identity.Service/Program.cs
git add .
git commit -m "test: gitops integration"
git push origin test/gitops-integration

# 2. Open PR or trigger workflow_dispatch
# GitHub Actions → identity-ci.yml → Run workflow

# 3. Watch the CI:
# ✅ Build & test pass
# ✅ Docker image pushed to Docker Hub
# ✅ Commit made to solutions repo

# 4. Verify solutions repo:
cd ~/tc-agro-solutions
git pull
git log --oneline -5
# You should see: "ci(identity): update image to xxxxxxxx"

# 5. Check ArgoCD:
kubectl get applications -n argocd
kubectl describe application identity-app -n argocd

# 6. Watch deployment:
kubectl get pods -n agro-apps -w
# New pod with new image should appear
```

---

### Test Frontend CI (Same-Repo GitOps)

```bash
# 1. Make a code change in frontend
cd ~/tc-agro-solutions
git checkout -b test/frontend-gitops
echo "<!-- test -->" >> poc/frontend/index.html
git add .
git commit -m "test: frontend gitops"
git push origin test/frontend-gitops

# 2. Merge to main or trigger workflow_dispatch

# 3. Watch the CI:
# ✅ Vite build pass
# ✅ Docker image pushed to Docker Hub
# ✅ Commit made to same repo

# 4. Check manifest update:
git log --oneline -5
# You should see: "ci(frontend): update image to xxxxxxxx"

# 5. Watch deployment:
kubectl get pods -n agro-apps -w
# New frontend pod with new image should appear
```

---

## 🔍 Verification Commands

### Check Deployed Images

```bash
# Identity
kubectl get deployment identity-service -n agro-apps -o jsonpath='{.spec.template.spec.containers[0].image}'
# Should show: rdpresser/identity-service:xxxxxxxx

# Frontend
kubectl get deployment frontend -n agro-apps -o jsonpath='{.spec.template.spec.containers[0].image}'
# Should show: rdpresser/frontend-service:xxxxxxxx
```

### Check ArgoCD Sync Status

```bash
# All apps
kubectl get applications -n argocd

# Specific app
kubectl describe application apps-dev -n argocd | grep -A 5 "Sync Status"
```

### Check Pod Image Source

```bash
# Verify pulling from Docker Hub (not k3d local registry)
kubectl describe pod -n agro-apps | grep -i "image:"
# Should show: rdpresser/... NOT k3d-localhost:5000/...
```

### Force ArgoCD Sync (Manual)

```bash
# If auto-sync seems slow
kubectl patch application apps-dev -n argocd \
  --type merge -p '{"operation": {"sync": {"revision": "HEAD"}}}'
```

---

## ⚠️ Troubleshooting

### Issue: CI can't push to solutions repo

**Symptom:** `Permission denied` when identity CI tries to commit

**Fix:**

```bash
# Ensure SOLUTIONS_REPO_TOKEN is set in identity-service repo
# Token must have 'Contents: Read and Write' permission
# Verify token scope in GitHub → Settings → Developer Settings
```

---

### Issue: ArgoCD not detecting changes

**Symptom:** Manifest updated but ArgoCD still shows old image

**Checks:**

```bash
# 1. Verify auto-sync is enabled
kubectl get application apps-dev -n argocd -o yaml | grep -i sync

# 2. Check ArgoCD logs
kubectl logs -n argocd deployment/argocd-application-controller

# 3. Force refresh
kubectl patch application apps-dev -n argocd \
  --type merge -p '{"metadata": {"annotations": {"argocd.argoproj.io/refresh": "hard"}}}'
```

---

### Issue: k3d still using local images

**Symptom:** Old behavior, builds locally

**Fix:**

```bash
# Verify deployments use Docker Hub image
kubectl get deployment -n agro-apps -o yaml | grep "image:"

# Should show:
# image: rdpresser/identity-service:xxxxxxxx
# image: rdpresser/frontend-service:xxxxxxxx

# NOT:
# image: k3d-localhost:5000/...

# If wrong, the manifests weren't updated correctly
```

---

### Issue: ImagePullBackOff

**Symptom:** Pods can't pull from Docker Hub

**Checks:**

```bash
# 1. Verify images exist in Docker Hub
# Visit: https://hub.docker.com/u/rdpresser

# 2. Check image pull policy
kubectl get deployment -n agro-apps -o yaml | grep -i pullpolicy
# Should be: imagePullPolicy: Always

# 3. Test manual pull
docker pull rdpresser/identity-service:latest
docker pull rdpresser/frontend-service:latest
```

---

## 📊 Monitoring GitOps

### GitHub Actions Dashboard

```
https://github.com/rdpresser/tc-agro-identity-service/actions
https://github.com/rdpresser/tc-agro-solutions/actions
```

### ArgoCD UI

```bash
# Port-forward ArgoCD UI
kubectl port-forward svc/argocd-server -n argocd 8080:443

# Access: https://localhost:8080
# Login: admin / <get-password>
kubectl get secret argocd-initial-admin-secret -n argocd \
  -o jsonpath="{.data.password}" | base64 -d
```

### Docker Hub Registry

```
https://hub.docker.com/r/rdpresser/identity-service/tags
https://hub.docker.com/r/rdpresser/frontend-service/tags
```

---

## 🎯 Expected Behavior

### When Identity Code Changes

```
Developer Push → Identity CI
  ↓
Docker Hub: rdpresser/identity-service:abc12345
  ↓
Solutions Repo: deployment.yaml updated
  ↓
ArgoCD: Detects change
  ↓
k3d: Pulls new image from Docker Hub
  ↓
New identity pod running
```

### When Frontend Code Changes

```
Developer Push → Frontend CI
  ↓
Docker Hub: rdpresser/frontend-service:def67890
  ↓
Same Repo: deployment.yaml updated
  ↓
ArgoCD: Detects change
  ↓
k3d: Pulls new image from Docker Hub
  ↓
New frontend pod running
```

---

## 🏆 What This Achieves

✅ **True GitOps:** Git is single source of truth  
✅ **CI/CD Separation:** Build ≠ Deploy  
✅ **Cross-Repo Support:** Identity isolated, Frontend integrated  
✅ **Immutable Tags:** SHA-based tags, not `latest`  
✅ **Auto-Deploy:** ArgoCD syncs on Git changes  
✅ **No Webhooks:** Pure Git polling  
✅ **Production-Ready:** Same flow works for AKS later

---

## 📚 Related Documentation

- [ArgoCD Setup](../scripts/k3d/README.md)
- [CI/CD Strategy](../docs/adr/ADR-005-local-vs-cloud.md)
- [Local Development](../docs/development/local-setup.md)

---

> **Version:** 1.0  
> **Last Updated:** February 3, 2026  
> **Status:** ✅ Production Ready
