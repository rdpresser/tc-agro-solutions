# 🐳 Docker Setup - TC Agro Solutions Frontend POC

## 📋 Overview

This folder contains Docker configuration for running the TC Agro Solutions frontend POC in a production-ready container optimized for AKS (Azure Kubernetes Service) deployment.

## 🏗️ Architecture

**Multi-stage Dockerfile:**

- **Stage 1 (Builder):** Node.js 20 Alpine - builds the application with Vite
- **Stage 2 (Runtime):** Nginx 1.27 Alpine - serves static files with optimized configuration

**Key Features:**

- ✅ Minimal image size (~50MB final image)
- ✅ Non-root user for security
- ✅ Health checks for Kubernetes probes
- ✅ SPA routing support
- ✅ Gzip compression
- ✅ Security headers
- ✅ Optimized caching strategy
- ✅ Non-privileged port (8080) for AKS compatibility

## 🚀 Quick Start

### Build the Docker Image

```bash
# From the frontend folder
docker build -t tc-agro-frontend:latest .

# Or with specific tag
docker build -t tc-agro-frontend:v1.0.0 .
```

### Run Locally

```bash
# Run container on port 8080
docker run -d -p 8080:8080 --name agro-frontend tc-agro-frontend:latest

# View logs
docker logs -f agro-frontend

# Access the application
# Open browser: http://localhost:8080
```

### Stop and Remove

```bash
# Stop container
docker stop agro-frontend

# Remove container
docker rm agro-frontend

# Remove image
docker rmi tc-agro-frontend:latest
```

## 🔍 Testing the Container

### Health Check

```bash
# Check health endpoint
curl http://localhost:8080/health

# Expected response: "healthy"
```

### Verify Build Output

```bash
# List files in container
docker exec agro-frontend ls -la /usr/share/nginx/html

# Check nginx configuration
docker exec agro-frontend cat /etc/nginx/conf.d/default.conf
```

### Check Logs

```bash
# Nginx access logs
docker exec agro-frontend tail -f /var/log/nginx/access.log

# Nginx error logs
docker exec agro-frontend tail -f /var/log/nginx/error.log
```

## ☁️ Azure Container Registry (ACR) Deployment

### Push to ACR

```bash
# Login to ACR
az acr login --name <your-acr-name>

# Tag image for ACR
docker tag tc-agro-frontend:latest <your-acr-name>.azurecr.io/tc-agro-frontend:latest
docker tag tc-agro-frontend:latest <your-acr-name>.azurecr.io/tc-agro-frontend:v1.0.0

# Push to ACR
docker push <your-acr-name>.azurecr.io/tc-agro-frontend:latest
docker push <your-acr-name>.azurecr.io/tc-agro-frontend:v1.0.0
```

### Verify in ACR

```bash
# List repositories
az acr repository list --name <your-acr-name> --output table

# Show tags
az acr repository show-tags --name <your-acr-name> --repository tc-agro-frontend --output table
```

## ☸️ Kubernetes Deployment (AKS)

### Create Kubernetes Manifest

Create `k8s-deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: tc-agro-frontend
  namespace: agro
spec:
  replicas: 2
  selector:
    matchLabels:
      app: tc-agro-frontend
  template:
    metadata:
      labels:
        app: tc-agro-frontend
    spec:
      containers:
        - name: frontend
          image: <your-acr-name>.azurecr.io/tc-agro-frontend:latest
          ports:
            - containerPort: 8080
          resources:
            requests:
              memory: '64Mi'
              cpu: '50m'
            limits:
              memory: '128Mi'
              cpu: '200m'
          livenessProbe:
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 10
            periodSeconds: 30
          readinessProbe:
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: tc-agro-frontend-svc
  namespace: agro
spec:
  selector:
    app: tc-agro-frontend
  ports:
    - protocol: TCP
      port: 80
      targetPort: 8080
  type: ClusterIP
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: tc-agro-frontend-ingress
  namespace: agro
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  ingressClassName: nginx
  rules:
    - host: agro.yourdomain.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: tc-agro-frontend-svc
                port:
                  number: 80
```

### Deploy to AKS

```bash
# Apply deployment
kubectl apply -f k8s-deployment.yaml

# Check deployment status
kubectl get pods -n agro

# Check service
kubectl get svc -n agro

# Check ingress
kubectl get ingress -n agro

# View logs
kubectl logs -f deployment/tc-agro-frontend -n agro
```

## 🔧 Troubleshooting

### Container Won't Start

```bash
# Check container logs
docker logs agro-frontend

# Inspect container
docker inspect agro-frontend

# Run with interactive shell
docker run -it --entrypoint /bin/sh tc-agro-frontend:latest
```

### Build Failures

```bash
# Clean build cache
docker builder prune -a

# Build with no cache
docker build --no-cache -t tc-agro-frontend:latest .

# Build with verbose output
docker build --progress=plain -t tc-agro-frontend:latest .
```

### Nginx Issues

```bash
# Test nginx configuration
docker run --rm tc-agro-frontend:latest nginx -t

# Check nginx version
docker run --rm tc-agro-frontend:latest nginx -v
```

## 📊 Image Size Optimization

Current image size breakdown:

- **Builder stage:** ~300MB (discarded)
- **Runtime stage:** ~50MB (nginx:alpine + app)

Tips:

- Builder stage artifacts are not included in final image
- .dockerignore excludes unnecessary files
- Multi-stage build keeps runtime image minimal

## 🔐 Security Best Practices

✅ **Non-root user:** Container runs as user `appuser` (UID 1001)  
✅ **Non-privileged port:** Uses port 8080 instead of 80  
✅ **Security headers:** X-Frame-Options, X-Content-Type-Options, etc.  
✅ **Minimal base image:** Alpine Linux reduces attack surface  
✅ **Health checks:** Kubernetes can detect unhealthy pods  
✅ **No secrets in image:** Use ConfigMaps/Secrets in K8s

## 📝 Configuration

### Environment Variables (Optional)

To configure backend API URL at runtime, update `nginx.conf` proxy settings and rebuild image, or use Kubernetes ConfigMap to inject environment-specific configurations.

### Custom Nginx Configuration

Edit `nginx.conf` for:

- Backend API proxy configuration
- Custom headers
- Cache policies
- SSL/TLS settings (when using cert-manager)

## 🎯 CI/CD Integration

### GitHub Actions Example

```yaml
name: Build and Push Frontend

on:
  push:
    branches: [main]
    paths:
      - 'poc/frontend/**'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Login to ACR
        uses: azure/docker-login@v1
        with:
          login-server: ${{ secrets.ACR_NAME }}.azurecr.io
          username: ${{ secrets.ACR_USERNAME }}
          password: ${{ secrets.ACR_PASSWORD }}

      - name: Build and push
        run: |
          docker build -t ${{ secrets.ACR_NAME }}.azurecr.io/tc-agro-frontend:${{ github.sha }} poc/frontend
          docker push ${{ secrets.ACR_NAME }}.azurecr.io/tc-agro-frontend:${{ github.sha }}
```

## 📚 References

- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [AKS Best Practices](https://learn.microsoft.com/azure/aks/best-practices)
- [Multi-stage Builds](https://docs.docker.com/build/building/multi-stage/)

---

> **Version:** 1.0  
> **Last Updated:** January 2026  
> **Maintainer:** TC Agro Solutions Team
