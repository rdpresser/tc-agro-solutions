# 🔧 Problem: K3D Cluster doesn't connect after creation

## ❌ Symptom
- k3d cluster is created successfully
- Command `kubectl get nodes` fails with error:
  ```
  dial tcp 192.168.0.25:XXXXX: connectex: A connection attempt failed...
  ```
- Error occurs with `host.docker.internal`

## 🔍 Cause
Windows DNS resolution issue with WSL2 after being on for a long time or with network changes.

## ✅ Quick Solution

### Option 1: Restart WSL2 (Recommended)
```powershell
# 1. Close ALL terminals/VS Code that use WSL

# 2. Open PowerShell as Administrator and run:
wsl --shutdown

# 3. Wait 10 seconds

# 4. Open Docker Desktop and wait for it to fully start

# 5. Run the diagnostic:
.\check-docker-network.ps1

# 6. If all OK, recreate the cluster:
.\create-all-from-zero.ps1
```

### Option 2: Restart Docker Desktop
```powershell
# 1. Right-click on Docker Desktop icon (system tray)
# 2. Select "Restart Docker Desktop"
# 3. Wait for it to fully start
# 4. Run:
.\create-all-from-zero.ps1
```

### Option 3: Restart Windows (If options 1 and 2 fail)
```powershell
# Simply restart the computer
# After restart:
.\start-cluster.ps1  # If cluster already existed
# OR
.\create-all-from-zero.ps1  # If you need to create new
```

## 🛡️ Prevention

### Create Cluster Correctly from the beginning:
```powershell
# 1. Restart Docker Desktop OR run wsl --shutdown
# 2. Wait for Docker to be completely ready
# 3. Run diagnostic:
.\check-docker-network.ps1

# 4. If all OK, create the cluster:
.\create-all-from-zero.ps1
```

## 🔧 Manual Fix (If script fails)

If the script creates the cluster but kubectl doesn't connect:

```powershell
# 1. Get the cluster port
$port = (docker port k3d-dev-serverlb 6443/tcp).Split(':')[-1]

# 2. Update kubeconfig
kubectl config set-cluster k3d-dev --server="https://127.0.0.1:$port"

# 3. Test
kubectl get nodes
```

## 📝 Technical Notes

- k3d uses `host.docker.internal` by default on Windows
- WSL2 sometimes fails to resolve this hostname correctly
- Using `127.0.0.1` fixes the issue
- The `create-all-from-zero.ps1` script now does this automatically

## ⚠️ If NOTHING works:

```powershell
# Complete cleanup:
.\cleanup-all.ps1
k3d registry delete registry.local
docker system prune -a --volumes -f

# Restart WSL:
wsl --shutdown

# Restart Docker Desktop

# Wait 1-2 minutes

# Recreate everything:
.\create-all-from-zero.ps1
```

## 🆘 Useful Logs

```powershell
# View k3d server logs:
docker logs k3d-dev-server-0

# View serverlb logs:
docker logs k3d-dev-serverlb

# Test direct connectivity:
docker exec -it k3d-dev-server-0 kubectl get nodes
```
