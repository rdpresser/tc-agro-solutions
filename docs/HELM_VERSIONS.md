# Helm Chart Versions - Version Management Guide

**Date:** January 17, 2026  
**Status:** ✅ Active  
**Location:** `docs/HELM_VERSIONS.md`

---

## 📋 Overview

This document explains the `targetRevision` property in ArgoCD application manifests and provides guidance on managing Helm chart versions.

---

## 🎯 What is `targetRevision`?

### In ArgoCD Application Manifests

The `targetRevision` property in ArgoCD applications specifies **which version** of a resource to deploy:

```yaml
sources:
  - repoURL: https://prometheus-community.github.io/helm-charts
    chart: kube-prometheus-stack
    targetRevision: 65.0.0 # ← Helm chart version
```

### Two Types of `targetRevision`

| Type                   | Example  | Meaning                            |
| ---------------------- | -------- | ---------------------------------- |
| **Helm Chart Version** | `65.0.0` | Specific version of the Helm chart |
| **Git Reference**      | `main`   | Git branch, tag, or commit SHA     |

---

## 📊 Current Helm Chart Versions

### Platform Observability Stack

| Chart                       | Current Version | Repository           | Purpose                           |
| --------------------------- | --------------- | -------------------- | --------------------------------- |
| **kube-prometheus-stack**   | 65.0.0          | prometheus-community | Prometheus, Grafana, AlertManager |
| **loki**                    | 6.16.0          | grafana              | Log aggregation                   |
| **tempo**                   | 1.10.3          | grafana              | Distributed tracing               |
| **opentelemetry-collector** | 0.105.0         | opentelemetry        | Telemetry ingestion               |

### Platform Autoscaling

| Chart    | Current Version | Repository | Purpose                             |
| -------- | --------------- | ---------- | ----------------------------------- |
| **keda** | 2.15.1          | kedacore   | Kubernetes Event Driven Autoscaling |

---

## 🔍 How to Check for Updates

### Automated Check Script

We provide a PowerShell script to check for latest versions:

```powershell
# Check for updates (no changes made)
.\scripts\check-helm-versions.ps1
```

**Output:**

- Shows current vs latest versions
- Indicates which charts have updates available
- Provides links to release notes

### Manual Check

```bash
# Add repository
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts

# Update repository index
helm repo update

# Search for latest version
helm search repo prometheus-community/kube-prometheus-stack
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
   infrastructure/kubernetes/platform/argocd/applications/
   ├── platform-observability.yaml  # Prometheus, Loki, Tempo, OTel
   └── platform-autoscaling.yaml    # KEDA
   ```

2. **Check latest version:**

   ```bash
   helm search repo grafana/loki --versions | head -5
   ```

3. **Edit the YAML file:**

   ```yaml
   - repoURL: https://grafana.github.io/helm-charts
     chart: loki
     targetRevision: 6.16.0 # ← Update this line
   ```

4. **Commit and push:**

   ```bash
   git add infrastructure/kubernetes/platform/argocd/applications/
   git commit -m "chore: update loki chart to version 6.20.0"
   git push
   ```

5. **ArgoCD will automatically sync the new version**

---

## ⚠️ Before Updating

### 1. Review Release Notes

Always check release notes for **breaking changes**:

| Chart                   | Release Notes URL                                                    |
| ----------------------- | -------------------------------------------------------------------- |
| kube-prometheus-stack   | https://github.com/prometheus-community/helm-charts/releases         |
| loki                    | https://github.com/grafana/loki/releases                             |
| tempo                   | https://github.com/grafana/tempo/releases                            |
| opentelemetry-collector | https://github.com/open-telemetry/opentelemetry-helm-charts/releases |
| keda                    | https://github.com/kedacore/charts/releases                          |

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
kubectl get pods -n monitoring
kubectl get pods -n keda
```

---

## 🎯 Update Strategy

### Conservative Approach (Recommended for Phase 5)

**When to update:**

- ✅ Critical security patches
- ✅ Important bug fixes
- ⚠️ Minor version updates (e.g., 6.16.0 → 6.17.0)
- ❌ Major version updates (e.g., 6.x → 7.x) - **AVOID during hackathon**

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
git log --oneline --follow infrastructure/kubernetes/platform/argocd/applications/platform-observability.yaml
```

### 3. Document Upgrade Reasons

```
chore: update kube-prometheus-stack to 66.0.0

- Security patch for CVE-2024-XXXXX
- Fixes Grafana dashboard rendering issue
- Requires no configuration changes

Release notes: https://github.com/.../releases/tag/v66.0.0
```

### 4. Monitor After Updates

```bash
# Watch ArgoCD sync status
kubectl get applications -n argocd -w

# Check pod health
kubectl get pods -n monitoring

# Check logs for errors
kubectl logs -n monitoring -l app.kubernetes.io/name=prometheus --tail=50
```

---

## 🔗 Useful Commands

### Check Current Versions

```bash
# From ArgoCD applications
grep -A2 "chart: kube-prometheus-stack" infrastructure/kubernetes/platform/argocd/applications/platform-observability.yaml

# From running cluster
helm list -n monitoring
helm list -n keda
```

### View Chart Details

```bash
# Show chart information
helm show chart prometheus-community/kube-prometheus-stack --version 65.0.0

# Show default values
helm show values grafana/loki --version 6.16.0

# Show README
helm show readme kedacore/keda --version 2.15.1
```

### Compare Versions

```bash
# List all available versions
helm search repo prometheus-community/kube-prometheus-stack --versions

# Show what would change
helm template monitoring prometheus-community/kube-prometheus-stack \
  --version 65.0.0 \
  --values infrastructure/kubernetes/platform/helm-values/dev/kube-prometheus-stack.values.yaml \
  > /tmp/old.yaml

helm template monitoring prometheus-community/kube-prometheus-stack \
  --version 66.0.0 \
  --values infrastructure/kubernetes/platform/helm-values/dev/kube-prometheus-stack.values.yaml \
  > /tmp/new.yaml

diff /tmp/old.yaml /tmp/new.yaml
```

---

## 🚨 Troubleshooting

### Issue: ArgoCD shows "OutOfSync"

**Check:**

```bash
kubectl get application platform-observability -n argocd -o yaml
```

**Common causes:**

- Git repository not updated
- Invalid chart version
- CRD version mismatch

**Fix:**

```bash
# Force refresh
kubectl patch application platform-observability -n argocd \
  --type merge -p '{"metadata":{"annotations":{"argocd.argoproj.io/refresh":"hard"}}}'
```

### Issue: Pods CrashLoopBackOff after update

**Check logs:**

```bash
kubectl logs -n monitoring <pod-name> --previous
```

**Rollback:**

```bash
# Revert YAML file to previous version
git revert <commit-hash>
git push

# Or manually edit and change targetRevision back
```

---

## 📊 Version History

Track major version changes here:

| Date       | Chart      | Old Version | New Version       | Reason        |
| ---------- | ---------- | ----------- | ----------------- | ------------- |
| 2026-01-17 | (baseline) | -           | (see table above) | Initial setup |

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

- Review all charts for major version updates
- Align with vendor LTS releases
- Create staging environment for testing
- Automate version checks in CI/CD

---

## 🔗 Related Documentation

- [ArgoCD Application CRD](https://argo-cd.readthedocs.io/en/stable/operator-manual/declarative-setup/)
- [Helm Chart Versions](https://helm.sh/docs/topics/charts/#the-chart-version)
- [Local Setup Guide](./development/local-setup.md)
- [ADR-004: Observability](./adr/ADR-004-observability.md)

---

## 📝 Notes

- `targetRevision: main` is used for Git repositories (e.g., our values repo)
- Helm chart versions follow [Semantic Versioning](https://semver.org/) (MAJOR.MINOR.PATCH)
- ArgoCD automatically detects new versions when Git repository is updated
- Use automated scripts to avoid manual errors

---

> **Last Updated:** January 17, 2026  
> **Scripts:** `scripts/check-helm-versions.ps1`, `scripts/update-helm-versions.ps1`  
> **Status:** ✅ All charts at stable versions for Phase 5
