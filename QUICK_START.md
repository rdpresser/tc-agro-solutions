# ✅ TC Agro Solutions - Complete Validation & Quick Start

**Status:** 🟢 All Systems Operational - 100% Guarantee  
**Date:** January 27, 2026  
**Validated:** All connectivity tests passing

---

## 🚀 Quick Start (5 Minutes)

### 1. **Verify Everything is Running**

```powershell
# Run the complete validation suite
.\scripts\k3d\validate-connectivity.ps1

# Expected output: "✨ ALL TESTS PASSED - 100% GUARANTEE ✨"
```

### 2. **Access the Services**

**Frontend (already port-forwarded):**

```
http://localhost:5010/
```

**Identity-Service API:**

```powershell
# Set up port-forward
kubectl port-forward svc/identity-service -n agro-apps 5001:80

# Test health
curl http://localhost:5001/health
```

### 3. **View Logs (Live)**

```powershell
# Watch frontend logs
kubectl logs -f -n agro-apps frontend-6b896496c7-9r4sc

# Watch identity-service logs
kubectl logs -f -n agro-apps identity-service-7bf495bc8-qzq28
```

### 4. **Access ArgoCD Dashboard**

```powershell
# Port-forward ArgoCD
kubectl port-forward -n argocd svc/argocd-server 8080:443

# Then open: https://localhost:8080
# (Ignore SSL warnings for local testing)
```

---

## 📋 System Status

### Pods Running

- ✅ **frontend** (1/1)
- ✅ **identity-service** (2/2 replicas)

### Backend Services Accessible (Inside Pods)

- ✅ **PostgreSQL** (tc-agro-postgres:5432) - Docker container name
- ✅ **Redis** (tc-agro-redis:6379) - Docker container name
- ✅ **RabbitMQ** (tc-agro-rabbitmq:5672) - Docker container name
- ✅ **OTEL Collector** (otel-collector-agent.observability:4317) - DaemonSet in cluster

### ArgoCD Applications

- ✅ apps-bootstrap (Synced + Healthy)
- ✅ apps-dev (Synced + Healthy)
- ✅ platform-base (Synced + Healthy)
- ✅ platform-bootstrap (Synced + Healthy)

---

## 🔧 Common Commands

### Pod Management

```powershell
# View all pods
kubectl get pods -n agro-apps

# Describe a pod (for debugging)
kubectl describe pod identity-service-7bf495bc8-qzq28 -n agro-apps

# Get pod logs
kubectl logs -n agro-apps identity-service-7bf495bc8-qzq28 --tail=50

# Execute command in pod
kubectl exec -it identity-service-7bf495bc8-qzq28 -n agro-apps -- /bin/sh
```

### Services

```powershell
# View all services
kubectl get svc -n agro-apps

# Port-forward a service
kubectl port-forward svc/frontend -n agro-apps 5010:80

# Test service from within cluster
kubectl run -it --rm debug --image=alpine --restart=Never -- sh
# Inside: wget -O- http://identity-service.agro-apps.svc.cluster.local/health
```

### Deployments

```powershell
# View deployments
kubectl get deployments -n agro-apps

# Scale a deployment
kubectl scale deployment identity-service -n agro-apps --replicas=3

# Restart a deployment
kubectl rollout restart deployment/identity-service -n agro-apps

# Check rollout status
kubectl rollout status deployment/identity-service -n agro-apps
```

### ArgoCD

```powershell
# View all applications
kubectl get applications -n argocd

# Sync an application manually
kubectl patch app apps-dev -n argocd -p '{"metadata":{"annotations":{"argocd.argoproj.io/compare-result":"Unknown"}}}' --type=merge

# Get application status details
kubectl describe app apps-dev -n argocd
```

---

## 🐛 Troubleshooting

### Pod not starting?

```powershell
# Check pod status
kubectl describe pod <pod-name> -n agro-apps

# Check logs for errors
kubectl logs <pod-name> -n agro-apps

# Common issues:
# - ImagePullBackOff: Image not imported, run: .\scripts\k3d\build-push-images.ps1
# - CrashLoopBackOff: Application error, check logs
# - Pending: Resource constraints, check node status: kubectl top nodes
```

### Database not accessible from pod?

```powershell
# Verify container name resolves from pod (k3d shares Docker network)
kubectl exec <pod-name> -n agro-apps -- sh -c 'getent hosts tc-agro-postgres'
# Expected: IP address of the PostgreSQL container

# Test connection to PostgreSQL using container name
kubectl exec <pod-name> -n agro-apps -- sh -c 'nc -zv tc-agro-postgres 5432'
```

### Services not communicating?

```powershell
# Verify DNS resolution inside pod
kubectl exec <pod-name> -n agro-apps -- sh -c 'getent hosts identity-service.agro-apps.svc.cluster.local'
# Expected: 10.43.x.x identity-service.agro-apps.svc.cluster.local

# Test inter-pod communication
kubectl run -it --rm test-pod --image=alpine --restart=Never -- wget -O- http://identity-service.agro-apps.svc.cluster.local/health
```

### ArgoCD application out of sync?

```powershell
# Force sync
kubectl patch app <app-name> -n argocd -p '{"metadata":{"annotations":{"argocd.argoproj.io/compare-result":"Unknown"}}}' --type=merge

# Or use ArgoCD CLI
argocd app sync <app-name>
```

---

## 📊 Key Configuration Files

All critical configuration files are documented below. **DO NOT** modify these unless you understand the implications.

### ConfigMap: identity-config

**File:** `infrastructure/kubernetes/apps/base/identity/configmap.yaml`

Controls database and service connections:

```yaml
Database__Postgres__Host: "tc-agro-postgres" # ← Docker container name
Cache__Redis__Host: "tc-agro-redis" # ← Docker container name
Messaging__RabbitMQ__Host: "tc-agro-rabbitmq" # ← Docker container name
```

⚠️ **Critical:** These hostnames are Docker container names. k3d cluster joins the `tc-agro-network` Docker network, allowing pods to resolve container names directly. If migrating to Azure AKS, change to Azure service endpoints.

### Deployment: identity-service

**File:** `infrastructure/kubernetes/apps/base/identity/deployment.yaml`

- **Image:** `k3d-localhost:5000/tc-agro-identity-service:latest`
- **ImagePullPolicy:** `IfNotPresent` (uses locally imported image)
- **Replicas:** 2
- **Health Probes:**
  - Readiness: `/health` endpoint, 5s initial delay
  - Liveness: `/health` endpoint, 15s initial delay

### Deployment: frontend

**File:** `infrastructure/kubernetes/apps/base/frontend/deployment.yaml`

- **Image:** `k3d-localhost:5000/tc-agro-frontend-service:latest`
- **ImagePullPolicy:** `IfNotPresent`
- **Replicas:** 1
- **Port:** 80

---

## 🔄 Complete Rebuild Process

If you need to completely rebuild the cluster from scratch:

```powershell
# 1. Clean up (if needed)
.\scripts\k3d\cleanup.ps1

# 2. Bootstrap cluster and install ArgoCD
.\scripts\k3d\bootstrap.ps1

# 3. Build and push images
.\scripts\k3d\build-push-images.ps1

# 4. Wait for convergence
Start-Sleep -Seconds 30

# 5. Validate everything
.\scripts\k3d\validate-connectivity.ps1

# Expected output: "✨ ALL TESTS PASSED - 100% GUARANTEE ✨"
```

**Time:** ~10-15 minutes total

---

## 📈 Next Steps

### Short-term (This Week)

- [ ] Run `validate-connectivity.ps1` daily to ensure stability
- [ ] Test API endpoints using Swagger/API clients
- [ ] Monitor pod logs for any errors
- [ ] Test frontend UI in browser

### Medium-term (Next 2 Weeks)

- [ ] Set up Grafana dashboards for monitoring
- [ ] Configure Traefik ingress for external routing
- [ ] Implement automated backup strategy
- [ ] Add more detailed API tests

### Long-term (Post-Hackathon)

- [ ] Migrate to Azure AKS using Terraform
- [ ] Replace RabbitMQ with Azure Service Bus
- [ ] Move PostgreSQL to Azure PostgreSQL Flexible Server
- [ ] Implement Application Insights for production monitoring

---

## 💡 Pro Tips

### 1. **Keep Terminal Windows Open**

```powershell
# Terminal 1: Watch pods
kubectl get pods -n agro-apps --watch

# Terminal 2: Watch logs
kubectl logs -f -n agro-apps identity-service-7bf495bc8-qzq28

# Terminal 3: Run commands
# ... your commands here
```

### 2. **Create Aliases**

```powershell
# Add to PowerShell profile ($PROFILE)
Set-Alias -Name kgp -Value "kubectl get pods -n agro-apps"
Set-Alias -Name kd -Value "kubectl describe pod -n agro-apps"
Set-Alias -Name kl -Value "kubectl logs -n agro-apps"
```

### 3. **Set Default Namespace**

```powershell
# Avoid typing -n agro-apps every time
kubectl config set-context --current --namespace=agro-apps
```

### 4. **Use kubectl Auto-completion**

```powershell
# PowerShell: Install module
Install-Module PSKubectlCompletion -Scope CurrentUser
```

---

## 📞 Getting Help

### Check Validation Report

```powershell
# Open the detailed validation report
code VALIDATION_REPORT.md
```

### Run Quick Tests

```powershell
# Test connectivity
.\scripts\k3d\validate-connectivity.ps1

# Check cluster status
kubectl cluster-info
kubectl get nodes
kubectl get events -n agro-apps
```

### View Component Status

```powershell
# All resources in cluster
kubectl get all -n agro-apps

# Focus on specific component
kubectl describe deployment identity-service -n agro-apps
```

---

## 🎯 Success Criteria

Your system is working correctly if:

✅ `validate-connectivity.ps1` shows "ALL TESTS PASSED"  
✅ Frontend responds at `http://localhost:5010/`  
✅ Pod logs show HTTP 200 responses (no errors)  
✅ ArgoCD shows all apps "Synced + Healthy"  
✅ DNS resolves correctly inside pods  
✅ Databases accessible from pods

---

## 📝 Notes

- **k3d Networking:** k3d cluster joins the `tc-agro-network` Docker network, allowing pods to resolve Docker Compose container names directly (e.g., `tc-agro-postgres`, `tc-agro-redis`). This approach avoids the unreliable `host.k3d.internal` DNS.

- **Port 5010 & 5001:** Pre-configured for frontend and identity-service respectively. These ports should already be forwarded from the bootstrap script.

- **Database:** PostgreSQL runs in Docker Compose alongside k3d cluster. Both must be running.

- **Replicas:** Identity-service runs 2 replicas for availability demonstration. Frontend runs 1 replica.

---

> **Created:** January 27, 2026  
> **Status:** 🟢 Production Ready (k3d environment)  
> **Maintenance:** Run `validate-connectivity.ps1` weekly
