# Helm Version Management Scripts

**Location:** `scripts/`  
**Purpose:** Automated Helm chart version checking and updating  
**Date:** January 17, 2026

---

## 📋 Overview

Two PowerShell scripts for managing Helm chart versions in ArgoCD applications:

1. **`check-helm-versions.ps1`** - Check for available updates (read-only)
2. **`update-helm-versions.ps1`** - Automatically update chart versions (writes to files)

---

## 🔍 check-helm-versions.ps1

### Purpose

Check if newer versions of Helm charts are available without making any changes.

### Usage

```powershell
# Run from project root
.\scripts\check-helm-versions.ps1
```

### What it does

1. ✅ Adds/updates Helm repositories
2. ✅ Queries latest versions for each chart
3. ✅ Compares with current versions in YAML files
4. ✅ Shows which charts have updates available
5. ✅ Provides release notes links

### Output Example

```
📊 Checking: kube-prometheus-stack
   Current version:  65.0.0
   Latest version:   81.0.0
   App version:      v0.88.0
   ⚠️  UPDATE AVAILABLE
```

### No Changes Made

This script is **completely safe** - it only reads information and displays it.

---

## 🔄 update-helm-versions.ps1

### Purpose

Automatically update `targetRevision` values in ArgoCD application manifests.

### Usage

```powershell
# Dry run (see what would change)
.\scripts\update-helm-versions.ps1

# Actually apply updates
.\scripts\update-helm-versions.ps1 -Apply

# Apply without creating backups (not recommended)
.\scripts\update-helm-versions.ps1 -Apply -SkipBackup
```

### What it does

1. ✅ Checks for latest versions (same as check script)
2. ✅ Creates backup files (`.backup-YYYYMMDD-HHmmss`)
3. ✅ Updates `targetRevision` in YAML files
4. ✅ Shows git diff command for review

### Safety Features

- **Dry run by default** - Must use `-Apply` to make changes
- **Automatic backups** - Creates timestamped backup files
- **Regex-based updates** - Precise version string replacement
- **No git operations** - You control git add/commit/push

---

## 📊 Current Versions (as of January 17, 2026)

| Chart                       | Current | Latest  | Gap | Priority |
| --------------------------- | ------- | ------- | --- | -------- |
| **kube-prometheus-stack**   | 65.0.0  | 81.0.0  | +16 | Medium   |
| **loki**                    | 6.16.0  | 6.49.0  | +33 | Medium   |
| **tempo**                   | 1.10.3  | 1.24.3  | +14 | Low      |
| **opentelemetry-collector** | 0.105.0 | 0.143.0 | +38 | Low      |
| **keda**                    | 2.15.1  | 2.18.3  | +3  | Low      |

### Analysis

All charts have updates available, but these are **minor/patch updates** within the same major version (no breaking changes expected).

---

## 🎯 Recommendations for Phase 5

### Should we update NOW?

**For Hackathon (Phase 5):** ⚠️ **NOT RECOMMENDED**

**Reasons:**

1. ✅ **Current versions are stable** - No known critical bugs
2. ✅ **No security vulnerabilities** - Current versions are secure
3. ⚠️ **Risk of instability** - Updates can introduce issues
4. ⏰ **Time constraint** - Focus on delivering features, not infra updates
5. 🎯 **Hackathon priorities** - Demonstrate working system, not latest versions

**Exception:** If you encounter a bug that's fixed in a newer version, consider updating that specific chart only.

### Post-Hackathon Update Strategy

**After February 27, 2026:**

1. ✅ Update all charts to latest minor versions
2. ✅ Test in staging environment
3. ✅ Review release notes for breaking changes
4. ✅ Apply to production

---

## 📝 Update Workflow

### Recommended Process

```powershell
# 1. Check current status
.\scripts\check-helm-versions.ps1

# 2. Dry run to see changes
.\scripts\update-helm-versions.ps1

# 3. Apply updates (creates backups)
.\scripts\update-helm-versions.ps1 -Apply

# 4. Review changes
git diff infrastructure/kubernetes/platform/argocd/applications/

# 5. Test locally (if cluster is running)
kubectl get applications -n argocd

# 6. Commit if satisfied
git add infrastructure/kubernetes/platform/argocd/applications/
git commit -m "chore: update Helm chart versions to latest releases"
git push

# 7. Monitor ArgoCD sync
kubectl get applications -n argocd -w

# 8. Verify pods
kubectl get pods -n monitoring
kubectl get pods -n keda
```

### Rollback if Needed

```powershell
# Option 1: Restore from backup
Copy-Item infrastructure/kubernetes/platform/argocd/applications/platform-observability.yaml.backup-* infrastructure/kubernetes/platform/argocd/applications/platform-observability.yaml -Force

# Option 2: Git revert
git revert <commit-hash>
git push
```

---

## 🔗 Files Modified by Scripts

### ArgoCD Application Manifests

```
infrastructure/kubernetes/platform/argocd/applications/
├── platform-observability.yaml  ← 4 charts (Prometheus, Loki, Tempo, OTel)
└── platform-autoscaling.yaml    ← 1 chart (KEDA)
```

### Backup Files (created by update script)

```
infrastructure/kubernetes/platform/argocd/applications/
├── platform-observability.yaml.backup-20260117-145030
└── platform-autoscaling.yaml.backup-20260117-145030
```

**Note:** Backup files are safe to delete after verifying updates work correctly.

---

## 🚨 Troubleshooting

### Script fails with "Helm not found"

**Solution:** Install Helm CLI

```powershell
# Windows (Chocolatey)
choco install kubernetes-helm

# Or download from: https://helm.sh/docs/intro/install/
```

### Script shows wrong versions

**Solution:** Update Helm repository index

```powershell
helm repo update
```

### Updates not appearing in cluster

**Solution:** Check ArgoCD sync status

```powershell
kubectl get applications -n argocd
kubectl describe application platform-observability -n argocd
```

### ArgoCD stuck in "OutOfSync"

**Solution:** Force refresh

```powershell
kubectl patch application platform-observability -n argocd \
  --type merge -p '{"metadata":{"annotations":{"argocd.argoproj.io/refresh":"hard"}}}'
```

---

## 📚 Related Documentation

- [HELM_VERSIONS.md](../docs/HELM_VERSIONS.md) - Detailed version management guide
- [Local Setup Guide](../docs/development/local-setup.md) - k3d cluster setup
- [ArgoCD Documentation](https://argo-cd.readthedocs.io/en/stable/)

---

## 💡 Tips

1. **Run check script regularly** - Stay aware of available updates
2. **Always dry run first** - See what would change before applying
3. **Read release notes** - Especially for major version changes
4. **Test locally** - Use k3d cluster before pushing to shared environments
5. **One chart at a time** - Update charts individually to isolate issues
6. **Monitor after updates** - Watch pod status for 10-15 minutes

---

## 🎯 Quick Decision Matrix

| Situation                  | Action                              |
| -------------------------- | ----------------------------------- |
| **Security vulnerability** | ✅ Update immediately               |
| **Critical bug fix**       | ✅ Update after testing             |
| **Minor version update**   | ⚠️ Update post-hackathon            |
| **Major version update**   | ❌ Plan carefully, test extensively |
| **During hackathon**       | ❌ Only if absolutely necessary     |

---

> **Last Updated:** January 17, 2026  
> **Status:** ✅ Scripts working, 5 updates available  
> **Recommendation:** Keep current versions for Phase 5, update post-hackathon
