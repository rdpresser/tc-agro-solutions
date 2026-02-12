# Helm Chart Versions - Version Management Guide

**Date:** February 1, 2026  
**Status:** ✅ Active  
**Location:** `docs/HELM_VERSIONS.md`

---

## ⚠️ Important: Architecture Change

**Full observability stack (Prometheus, Grafana, Loki, Tempo) now runs in Docker Compose**, not in k3d cluster.

**Helm charts still in k3d:**

- **keda** - Kubernetes Event Driven Autoscaling (optional)

**Note:** OTEL DaemonSet is deployed via a manual manifest (`infrastructure/kubernetes/platform/base/otel-daemonset.yaml`), not a Helm chart.

---

## 📋 Overview

This document explains the `targetRevision` property in ArgoCD application manifests and provides guidance on managing Helm chart versions.

---

## 🎯 What is `targetRevision`?

### In ArgoCD Application Manifests

The `targetRevision` property in ArgoCD applications specifies **which version** of a resource to deploy:

```yaml
sources:
   - repoURL: https://kedacore.github.io/charts
      chart: keda
      targetRevision: 2.15.1 # ← Helm chart version
```

### Two Types of `targetRevision`

| Type                   | Example   | Meaning                            |
| ---------------------- | --------- | ---------------------------------- |
| **Helm Chart Version** | `0.105.0` | Specific version of the Helm chart |
| **Git Reference**      | `main`    | Git branch, tag, or commit SHA     |

---

## 📊 Current Helm Chart Versions (k3d)

### Active Charts

| Chart    | Current Version | Repository | Purpose                  |
| -------- | --------------- | ---------- | ------------------------ |
| **keda** | 2.15.1          | kedacore   | Event-driven autoscaling |

---

## 🔍 How to Check for Updates

### Automated Check Script

We provide a PowerShell script to check for latest versions:

```powershell
# Check for updates (no changes made)
.\scripts\check-helm-versions.ps1
```

**Output:**

- Shows current vs latest versions for KEDA
- Indicates which charts have updates available
- Provides links to release notes

### Manual Check

```bash
# Add repository
helm repo add kedacore https://kedacore.github.io/charts

# Update repository index
helm repo update

# Search for latest version
helm search repo kedacore/keda
```

---

## 🔄 How to Update Versions

### Option 1: Automated Update (Recommended)

```powershell
# Dry run - shows what would change
.\scripts\update-helm-versions.ps1

# Actually apply updates
.\scripts\update-helm-versions.ps1 -Apply
```

**The script will:**

1. Check for latest versions in Helm repositories
2. Create backup files (`.backup-YYYYMMDD-HHmmss`)
3. Update `targetRevision` values in YAML files
4. Show next steps for git commit and verification

### Option 2: Manual Update

1. **Find the file:**

   ```
   infrastructure/kubernetes/platform/helm-values/dev/
   └── keda.values.yaml   # KEDA (optional)
   ```

2. **Check latest version:**

   ```bash
   helm search repo kedacore/keda --versions | head -5
   ```

3. **Edit the values file or ArgoCD application:**

4. **Commit and push:**

   ```bash
   git add infrastructure/kubernetes/platform/
   git commit -m "chore: update keda chart"
   git push
   ```

5. **ArgoCD will automatically sync the new version**

---

## ⚠️ Before Updating

### 1. Review Release Notes

Always check release notes for **breaking changes**:

| Chart | Release Notes URL                           |
| ----- | ------------------------------------------- |
| keda  | https://github.com/kedacore/charts/releases |

### 2. Check for Breaking Changes

Look for:

- ❌ **API version changes** (e.g., `v1beta1` → `v1`)
- ❌ **Value schema changes** (renamed or removed values)
- ❌ **CRD updates** (may require manual steps)
- ❌ **Minimum Kubernetes version** requirements

### 3. Test in Development First

```bash
# Apply to local k3d cluster first
git checkout -b feature/update-helm-charts
# ... make changes ...
git push origin feature/update-helm-charts

# Monitor ArgoCD sync
kubectl get applications -n argocd -w

# Verify pods are healthy
kubectl get pods -n observability
kubectl get pods -n keda
```

---

## 🎯 Update Strategy

### Conservative Approach (Recommended for Phase 5)

**When to update:**

- ✅ Critical security patches
- ✅ Important bug fixes
- ⚠️ Minor version updates (e.g., 0.105.0 → 0.106.0)
- ❌ Major version updates (e.g., 0.x → 1.x) - **AVOID during hackathon**

**Rationale:**

- Focus on stability during Phase 5 (localhost development)
- Major updates can introduce breaking changes
- Post-hackathon is better time for major upgrades

### Aggressive Approach (Post-Hackathon)

After hackathon delivery, consider:

- Evaluate major version updates (e.g., Prometheus Operator v2 → v3)
- Align with LTS releases where available
- Test in staging environment before production

---

## 📚 Version Management Best Practices

### 1. Pin Specific Versions

✅ **Good:**

```yaml
targetRevision: 65.0.0 # Specific version
```

❌ **Avoid:**

```yaml
targetRevision: "*"     # Latest (unpredictable)
targetRevision: "65.*"  # Floating minor version
```

**Reason:** Specific versions ensure reproducible deployments.

### 2. Track Version Changes in Git

```bash
# Platform components
git log --oneline --follow infrastructure/kubernetes/platform/argocd/applications/platform-base.yaml

# Apps
git log --oneline --follow infrastructure/kubernetes/apps/argocd/applications/apps-dev.yaml
```

### 3. Document Upgrade Reasons

```
chore: update keda to 2.17.0

- CRD fixes and stability improvements
- No breaking changes in configuration

Release notes: https://github.com/kedacore/charts/releases
```

### 4. Monitor After Updates

```bash
# Watch ArgoCD sync status
kubectl get applications -n argocd -w

# Check pod health (OTEL DaemonSet)
kubectl get pods -n observability

# Check logs for errors
kubectl logs -n observability -l app.kubernetes.io/name=opentelemetry-collector --tail=50
```

---

## 🔗 Useful Commands

### Check Current Versions

```bash
# From ArgoCD applications
kubectl get applications -n argocd

# From running cluster (if using Helm)
helm list -n observability
```

### View Chart Details

```bash
# Show chart information
helm show chart kedacore/keda --version 2.15.1

# Show default values
helm show values kedacore/keda --version 2.15.1

# Show README
helm show readme kedacore/keda --version 2.15.1
```

---

## 🚨 Troubleshooting

### Issue: ArgoCD shows "OutOfSync"

**Check:**

```bash
kubectl get application platform-base -n argocd -o yaml
```

**Common causes:**

- Git repository not updated
- Invalid chart version
- CRD version mismatch

**Fix:**

```bash
# Force refresh
kubectl patch application platform-base -n argocd \
  --type merge -p '{"metadata":{"annotations":{"argocd.argoproj.io/refresh":"hard"}}}'
```

### Issue: OTEL DaemonSet not exporting telemetry

**Check:**

```bash
kubectl get pods -n observability -l app.kubernetes.io/name=opentelemetry-collector
kubectl logs -n observability -l app.kubernetes.io/name=opentelemetry-collector
```

**Verify Docker Compose OTEL Collector is running:**

```bash
docker ps | grep otel
```

---

## 📊 Version History

Track major version changes here:

| Date       | Chart               | Old Version | New Version | Reason                 |
| ---------- | ------------------- | ----------- | ----------- | ---------------------- |
| 2026-01-17 | (baseline)          | -           | (see above) | Initial setup          |
| 2026-02-01 | Architecture change | -           | -           | Observability → Docker |

---

## 🎯 Recommendations

### For Phase 5 (Hackathon - Current)

**DO:**

- ✅ Use current versions (already validated)
- ✅ Apply critical security patches only
- ✅ Test thoroughly before updating

**DON'T:**

- ❌ Update to major versions during hackathon
- ❌ Update multiple charts simultaneously
- ❌ Skip reading release notes

### For Post-Hackathon

**Consider:**

- Review OTEL and KEDA charts for major version updates
- Evaluate if in-cluster observability is needed for production
- Create staging environment for testing
- Automate version checks in CI/CD

---

## 🔗 Related Documentation

- [ArgoCD Application CRD](https://argo-cd.readthedocs.io/en/stable/operator-manual/declarative-setup/)
- [Helm Chart Versions](https://helm.sh/docs/topics/charts/#the-chart-version)
- [Local Setup Guide](./development/local-setup.md)
- [ADR-004: Observability](./adr/ADR-004-observability.md)
- [Docker Compose Observability](../orchestration/apphost-compose/OBSERVABILITY_STACK_SETUP.md)

---

## 📝 Notes

- `targetRevision: main` is used for Git repositories (e.g., our values repo)
- Helm chart versions follow [Semantic Versioning](https://semver.org/) (MAJOR.MINOR.PATCH)
- ArgoCD automatically detects new versions when Git repository is updated
- Use automated scripts to avoid manual errors
- Full observability (Prometheus, Grafana, Loki, Tempo) runs in Docker Compose

---

> **Last Updated:** February 1, 2026  
> **Scripts:** `scripts/check-helm-versions.ps1`, `scripts/update-helm-versions.ps1`  
> **Key Change:** Observability moved to Docker Compose
