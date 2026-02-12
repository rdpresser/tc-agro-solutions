# ✅ GitOps Setup Checklist

## 🔐 Step 1: Configure Secrets

### Identity Service Repo

```bash
# Go to: https://github.com/rdpresser/tc-agro-identity-service/settings/secrets/actions

# Add these secrets:
DOCKERHUB_USERNAME=rdpresser
DOCKERHUB_TOKEN=<your-docker-hub-token>
SOLUTIONS_REPO_TOKEN=<github-pat>
```

**Create GitHub PAT (Personal Access Token):**

1. Go to: https://github.com/settings/tokens?type=beta
2. Click "Generate new token"
3. Name: `identity-ci-gitops`
4. Repository access: **Only select repositories** → `tc-agro-solutions`
5. Permissions:
   - ✅ Contents: **Read and write**
6. Generate token
7. Copy and save as `SOLUTIONS_REPO_TOKEN` secret

---

### Solutions Repo (Frontend)

```bash
# Go to: https://github.com/rdpresser/tc-agro-solutions/settings/secrets/actions

# Add these secrets:
DOCKERHUB_USERNAME=rdpresser
DOCKERHUB_TOKEN=<your-docker-hub-token>
```

---

## 📝 Step 2: Apply Manifest Changes

```bash
cd ~/tc-agro-solutions

# Commit the updated manifests
git add infrastructure/kubernetes/apps/base/identity/deployment.yaml
git add infrastructure/kubernetes/apps/base/frontend/deployment.yaml
git commit -m "feat: migrate to Docker Hub registry for GitOps"
git push
```

---

## 🔄 Step 3: Trigger ArgoCD Sync

```bash
# ArgoCD should auto-detect changes, but you can force it:
kubectl get applications -n argocd

# Force sync if needed
kubectl patch application apps-dev -n argocd \
  --type merge -p '{"operation": {"sync": {"revision": "HEAD"}}}'

# Watch pods restart with Docker Hub images
kubectl get pods -n agro-apps -w
```

---

## 🧪 Step 4: Test Identity CI

```bash
# Option A: Trigger via GitHub UI
# Go to: https://github.com/rdpresser/tc-agro-identity-service/actions
# Select "Identity Service CI" → Run workflow → Run

# Option B: Push a test commit
cd ~/tc-agro-identity-service
git checkout -b test/gitops
echo "// GitOps test" >> src/TC.Agro.Identity.Service/Program.cs
git add .
git commit -m "test: gitops integration"
git push origin test/gitops
# Open PR or merge to main
```

**Expected Result:**

- ✅ CI builds and tests
- ✅ Docker image pushed to `rdpresser/identity-service:xxxxxxxx`
- ✅ Commit appears in solutions repo: `ci(identity): update image to xxxxxxxx`
- ✅ ArgoCD syncs
- ✅ New pod running with new image

---

## 🧪 Step 5: Test Frontend CI

```bash
cd ~/tc-agro-solutions
git checkout -b test/frontend-gitops
echo "<!-- GitOps test -->" >> poc/frontend/index.html
git add .
git commit -m "test: frontend gitops"
git push origin test/frontend-gitops
# Merge to main
```

**Expected Result:**

- ✅ CI builds Vite app
- ✅ Docker image pushed to `rdpresser/frontend-service:xxxxxxxx`
- ✅ Commit appears in same repo: `ci(frontend): update image to xxxxxxxx`
- ✅ ArgoCD syncs
- ✅ New frontend pod running

---

## 🔍 Step 6: Verify Everything

```bash
# Check images are from Docker Hub
kubectl get deployment -n agro-apps -o wide

# Check specific image tags
kubectl get deployment identity-service -n agro-apps \
  -o jsonpath='{.spec.template.spec.containers[0].image}'

kubectl get deployment frontend -n agro-apps \
  -o jsonpath='{.spec.template.spec.containers[0].image}'

# Should show:
# rdpresser/identity-service:xxxxxxxx
# rdpresser/frontend-service:xxxxxxxx
```

---

## ✅ Success Criteria

- [ ] Secrets configured in both repos
- [ ] Manifests updated and pushed
- [ ] ArgoCD synced with new manifests
- [ ] Identity CI can commit to solutions repo
- [ ] Frontend CI can commit to same repo
- [ ] Pods pulling from Docker Hub
- [ ] New commits trigger ArgoCD auto-sync
- [ ] No ImagePullBackOff errors

---

## 🎯 Final State

```
┌─────────────────────────────────────────────────────────────┐
│  BEFORE (k3d local)          →  NOW (GitOps + Docker Hub)   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Build local Docker          →  CI builds & pushes         │
│  k3d cache                   →  Docker Hub public          │
│  Manual apply                →  ArgoCD auto-sync           │
│  Previous local images       →  rdpresser/...              │
│  imagePullPolicy: Never      →  imagePullPolicy: Always    │
│  No version control          →  Git = source of truth      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Next Steps After Setup

1. **Remove local image builds** - CI does it now
2. **Monitor ArgoCD UI** - https://localhost:8080 (port-forward)
3. **Watch CI/CD flow** - GitHub Actions + ArgoCD
4. **Test rollback** - `git revert` manifest commits
5. **Document for team** - Share GITOPS_INTEGRATION.md

---

> **Quick Start:** Follow steps 1-6 in order  
> **Time Required:** ~15 minutes  
> **Difficulty:** Intermediate
