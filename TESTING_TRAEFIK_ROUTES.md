# Testing Traefik Routes

**Date:** January 15, 2026  
**Cluster:** k3d dev (Traefik ingress controller)

---

## ✅ Verification Checklist

### Step 1: Verify Cluster is Running

```bash
kubectl get nodes
# Expected: 4 nodes (1 server + 3 agents), all Ready

kubectl get ingressclass
# Expected: Only "traefik" (no nginx)

kubectl get pods -n kube-system | grep traefik
# Expected: traefik pod (1/1 Running) + svclb-traefik pods (2/2 Running)
```

### Step 2: Verify Ingress Routes Created

```bash
# Frontend route
kubectl get ingressroute -n agro-apps
# Expected: frontend

# ArgoCD route
kubectl get ingressroute -n argocd
# Expected: arcocd
```

### Step 3: Test Path-Based Routing

#### Path: /agro (Frontend)

```bash
# Test endpoint exists
curl -v http://localhost/agro

# Expected response:
# HTTP/1.1 200 OK
# Content-Type: text/html
# (HTML content of frontend dashboard)
```

**Browser:** Open `http://localhost/agro`

#### Path: /arcocd (ArgoCD)

```bash
# Test endpoint exists
curl -v http://localhost/arcocd

# Expected response:
# HTTP/1.1 200 OK
# Content-Security-Policy: frame-ancestors 'self'
# (ArgoCD login page HTML)
```

**Browser:** Open `http://localhost/arcocd`

---

## 🔍 Debugging Commands

### Check Traefik Routes

```bash
# Get all IngressRoute definitions
kubectl get ingressroute -A

# Detailed info
kubectl describe ingressroute frontend -n agro-apps
kubectl describe ingressroute arcocd -n argocd
```

### Check Traefik Logs

```bash
# Get Traefik logs
kubectl logs -n kube-system -l app=traefik -f

# Filter for routing events
kubectl logs -n kube-system -l app=traefik | grep -i "route\|ingress"
```

### Check Services Behind Routes

```bash
# Frontend service
kubectl get svc -n agro-apps frontend
# Expected: ClusterIP service on port 80

# ArgoCD service
kubectl get svc -n argocd argocd-server
# Expected: ClusterIP service on port 80
```

### Test LoadBalancer Port Binding

```bash
# Check Traefik LoadBalancer
kubectl get svc -n kube-system traefik
# Expected: LoadBalancer with External-IP

# Test port 80 is listening
netstat -an | findstr "0.0.0.0:80"
# or
Get-NetTCPConnection -LocalPort 80 | Select-Object LocalAddress, LocalPort, OwnerProcess
```

---

## 🐛 Troubleshooting

### Issue: Cannot reach localhost/agro

**Error:** `curl: (7) Failed to connect to localhost port 80`

**Diagnosis:**
```bash
# 1. Check if port 80 is bound
netstat -an | findstr ":80 "

# 2. Check Traefik LoadBalancer
kubectl get svc -n kube-system traefik
# Should show LoadBalancer with ExternalIP

# 3. Check route is created
kubectl get ingressroute -n agro-apps
# Should show "frontend"

# 4. Check pod is running
kubectl get pods -n agro-apps
# Frontend pod should be Running (not ErrImagePull)
```

**Fix:**
```bash
# If ErrImagePull - build the image
cd poc/frontend
npm run build:k8s
docker build -t agro-frontend:latest -f Dockerfile .
k3d image import agro-frontend:latest -c dev

# Restart the deployment
kubectl rollout restart deployment/frontend -n agro-apps
kubectl rollout status deployment/frontend -n agro-apps
```

---

### Issue: Wrong HTML served / 404 Error

**Error:** `HTTP 404 Not Found` or wrong page content

**Diagnosis:**
```bash
# Check which pod responded
kubectl logs -f $(kubectl get pods -n agro-apps -o jsonpath='{.items[0].metadata.name}') -n agro-apps

# Check frontend is healthy
kubectl get pods -n agro-apps -o wide
# Pod should be RUNNING and READY 1/1

# Check route config
kubectl describe ingressroute frontend -n agro-apps
```

**Fix:**
```bash
# Verify Vite base path config
cd poc/frontend
npm run build:k8s
# Should create dist/ with base path /agro/

# Verify assets in image
docker run --rm agro-frontend:latest \
  ls -la /usr/share/nginx/html/assets/

# If missing, rebuild image
```

---

### Issue: NGINX pods still running

**Error:** `kubectl get pods -n ingress-nginx` shows pods

**Diagnosis:**
```bash
# Check which ingress classes exist
kubectl get ingressclass

# NGINX should not appear if properly removed
```

**Fix:**
```bash
# Delete NGINX namespace (if it exists)
kubectl delete namespace ingress-nginx --ignore-not-found

# Verify only Traefik remains
kubectl get ingressclass
# Should show ONLY: traefik
```

---

## 📊 Performance Testing

### Measure Response Time

```bash
# Single request with timing
curl -w "\nTime to first byte: %{time_starttransfer}s\n" \
     -w "Total time: %{time_total}s\n" \
     http://localhost/agro

# Load test with ab (Apache Bench)
ab -n 100 -c 10 http://localhost/agro/

# Load test with k6
k6 run k6/frontend-load-test.js
```

### Monitor Traefik Metrics

```bash
# Enable Traefik metrics (if configured)
kubectl port-forward -n kube-system svc/traefik 9100:9100

# Access metrics
curl http://localhost:9100/metrics | grep traefik
```

---

## 🔧 Optional: Host-Based Routing

**Requires modifying Windows hosts file**

### Setup

1. Edit `C:\Windows\System32\drivers\etc\hosts` (requires admin):

```
127.0.0.1 agro.local
127.0.0.1 arcocd.local
```

2. Test:

```bash
# Frontend via host
curl http://agro.local

# ArgoCD via host
curl http://arcocd.local

# Browser
# - http://agro.local
# - http://arcocd.local
```

---

## 📝 Test Report Template

**When reporting issues, provide:**

```
**Environment:**
- OS: [Windows/macOS/Linux]
- k3d version: $(k3d version)
- kubectl version: $(kubectl version --short)

**Symptom:**
[Describe what's not working]

**Steps to Reproduce:**
1. [First step]
2. [Second step]

**Expected Result:**
[What should happen]

**Actual Result:**
[What actually happens]

**Logs:**
$(kubectl describe ingressroute frontend -n agro-apps)
$(kubectl logs -n agro-apps -l app=frontend)
```

---

## ✅ Success Criteria

All tests pass when:

✅ `kubectl get ingressclass` shows only `traefik`  
✅ `curl http://localhost/agro` returns 200 OK with HTML  
✅ `curl http://localhost/arcocd` returns 200 OK with ArgoCD page  
✅ Frontend pod shows RUNNING 1/1  
✅ ArgoCD pod shows RUNNING 1/1  
✅ Browser can access both routes  
✅ No NGINX pods or services exist  

**Status:** 🟢 Ready for deployment

