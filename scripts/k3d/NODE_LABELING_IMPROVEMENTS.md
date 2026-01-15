# Node Labeling Improvements

**Date:** January 15, 2026  
**Commit:** 7b18231  
**Status:** ✅ Complete

---

## Problem Statement

The warning message `⚠️ Could not find agent nodes to label` appeared during bootstrap, creating confusion:
- Nodes WERE created successfully
- The function just couldn't find them due to timing or matching issues
- No visibility into what was being searched or why it failed

---

## Solution Implemented

### 1. **Retry Logic with Sleep**

```powershell
$retries = 0
$maxRetries = 5
$allNodes = @()

while ($allNodes.Count -lt 3 -and $retries -lt $maxRetries) {
    $allNodes = kubectl get nodes -o name 2>$null | ...
    
    if ($allNodes.Count -lt 3) {
        $retries++
        Write-Host "   ⏳ Waiting for all nodes to register..." 
        Start-Sleep -Seconds 2
    }
}
```

**Benefit:** Automatically handles timing issues where nodes might not be fully registered immediately.

### 2. **Pre-Labeling Stabilization**

Added 3-second delay in main execution before calling `Set-NodeLabelsAndTaints`:

```powershell
# Give nodes a moment to fully register before labeling
Write-Host "⏳ Allowing nodes to fully stabilize before labeling..." 
Start-Sleep -Seconds 3
Set-NodeLabelsAndTaints
```

**Benefit:** Ensures nodes have time to register and be ready for labeling operations.

### 3. **Enhanced Debug Output**

Now shows exactly what's being searched for:

```powershell
Write-Host "   📍 Found nodes: k3d-dev-server-0, k3d-dev-agent-system-0, ..." 

Write-Host "   🔍 Matching patterns:" 
Write-Host "      System (*agent-system*): k3d-dev-agent-system-0"
Write-Host "      Platform (*agent-platform*): k3d-dev-agent-platform-0" 
Write-Host "      Apps (*agent-apps*): k3d-dev-agent-apps-0"
```

**Benefit:** Full visibility into matching process - easy to diagnose if something goes wrong.

### 4. **Improved Error Messages**

| Scenario | Old Message | New Message |
|----------|-------------|-------------|
| All labeled | ✅ All 3 labeled | ✅ All 3 labeled + node details |
| Partial | ⚠️ Could not find | ⚠️ Only 2/3 labeled (shows which) |
| None found | ⚠️ Could not find | ❌ No agents found + expected patterns |

---

## Test Results

### Before (Still Shows Timing Issue if Nodes Slow)
```
=== Labeling nodes for AKS-like pools (3 node pools) ===
⚠️  Could not find agent nodes to label
```

❌ Confusing - nodes were created but message doesn't explain why labeling failed

### After (Clear Feedback)
```
=== Labeling nodes for AKS-like pools (3 node pools) ===
   📍 Found nodes: k3d-dev-server-0, k3d-dev-agent-apps-0, k3d-dev-agent-platform-0, k3d-dev-agent-system-0
   🔍 Matching patterns:
      System (*agent-system*): k3d-dev-agent-system-0
      Platform (*agent-platform*): k3d-dev-agent-platform-0
      Apps (*agent-apps*): k3d-dev-agent-apps-0
   ✓ k3d-dev-agent-system-0 → system pool (4GB, NoSchedule taint)
   ✓ k3d-dev-agent-platform-0 → platform pool (6GB)
   ✓ k3d-dev-agent-apps-0 → apps pool (8GB)
✅ All 3 node pools labeled successfully
   Viewing node allocation:
   NAME                        ROLES                 AGENTPOOL WORKLOAD
   k3d-dev-server-0            control-plane,master  <none>    <none>
   k3d-dev-agent-apps-0        <none>                apps      application
   k3d-dev-agent-platform-0    <none>                platform  platform
   k3d-dev-agent-system-0      <none>                system    system
```

✅ Crystal clear - shows exactly what was found and what was labeled

---

## How It Works Now

### Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  Verify-NodePools (confirms Docker memory limits)           │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  3-second stabilization wait (ensures ready state)          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Set-NodeLabelsAndTaints with retry logic:                  │
│  1. Get all nodes (kubectl get nodes)                       │
│  2. Retry up to 5x if < 3 agents found                      │
│  3. Show debug info (found nodes + matching)                │
│  4. Apply labels and taints                                 │
│  5. Report results (success/partial/error)                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Improvements

| Aspect | Before | After |
|--------|--------|-------|
| **Visibility** | Silent failure | Full debug output |
| **Reliability** | Timing-dependent | Retry logic + stabilization |
| **Clarity** | Confusing message | Shows what was found & matched |
| **Diagnostics** | Hard to debug | Easy to understand failure reason |
| **Node Pool State** | Unclear if labeled | Displays full labeling result |

---

## When This Helps

✅ **Slow system:** Node registration delayed → retry logic handles it  
✅ **Debugging:** Want to know what nodes were found → shows them all  
✅ **Troubleshooting:** Label failed? → shows exact patterns it was looking for  
✅ **Validation:** Want proof nodes were labeled? → displays final state with labels  

---

## Files Modified

- `scripts/k3d/bootstrap.ps1`
  - `Set-NodeLabelsAndTaints()` - Added retry logic + debug output
  - `Main execution` - Added 3-second stabilization wait

---

## Next Steps

If you still see failures after these improvements:

1. Check node names: `kubectl get nodes -o wide`
2. Check node pool labels: `kubectl get nodes -L agentpool,workload`
3. Check taints: `kubectl describe node k3d-dev-agent-system-0`
4. Manual labeling if needed:
   ```powershell
   kubectl label node k3d-dev-agent-system-0 agentpool=system --overwrite
   kubectl taint node k3d-dev-agent-system-0 agentpool=system:NoSchedule
   ```

---

> **Summary:** Node labeling function now has retry logic, stabilization wait, and comprehensive debug output for full visibility into the process.
