# Frontend + Identity API Connection Guide

## 🎯 Auto-Detection Strategy

The frontend automatically detects which backend URL to use based on context:

| Context            | Frontend URL   | Identity URL       | Auto-Detected API Base  |
| ------------------ | -------------- | ------------------ | ----------------------- |
| **Dev Mode**       | localhost:3000 | localhost:5001     | `http://localhost:5001` |
| **Docker Compose** | localhost:5010 | localhost:5001     | `http://localhost:5001` |
| **K3d Cluster**    | localhost/agro | localhost/identity | `/identity`             |

### Detection Logic

```javascript
// In js/utils.js - detectApiBaseUrl()

1. If VITE_API_BASE_URL env var set → use it (manual override)
2. Else if BASE_URL === '/agro/' → cluster mode → '/identity'
3. Else if host includes 'localhost:3000' → dev mode → 'http://localhost:5001'
4. Else → default to 'http://localhost:5001' (docker-compose/fallback)
```

---

## 🚀 Usage Scenarios

### 1️⃣ Local Development (Default)

```bash
# Terminal 1: Run identity API locally
cd services/identity-service
dotnet run --project src/Adapters/Inbound/TC.Agro.Identity.Service

# Terminal 2: Run frontend dev server
cd poc/frontend
npm run dev
```

**Result:**

- Frontend: http://localhost:3000
- Identity: http://localhost:5001
- API calls: `http://localhost:5001/auth/login`

---

### 2️⃣ Docker Compose (Both Services)

```bash
cd orchestration/apphost-compose
docker compose up -d tc-agro-identity-service tc-agro-frontend-service
```

**Result:**

- Frontend: http://localhost:5010
- Identity: http://localhost:5001 (external port)
- API calls: `http://localhost:5001/auth/login`

**Note:** Browser accesses external ports; docker-internal would be `http://tc-agro-identity-service:8080`

---

### 3️⃣ K3d Cluster (Both Services)

```bash
# Build and push images
cd scripts/k3d
.\manager.ps1
# Choose option 13: Build and push all images

# Sync ArgoCD
# Choose option 9: Sync ArgoCD applications

# Access via Ingress
```

**Result:**

- Frontend: http://localhost/agro
- Identity: http://localhost/identity
- API calls: `/identity/auth/login` (relative path)

---

## 🐛 Debug Scenarios (Manual Override)

### Debug: Frontend Local + Identity in Docker Compose

Create `.env.local`:

```bash
VITE_API_BASE_URL=http://localhost:5001
```

```bash
# Terminal 1: Identity in docker-compose
cd orchestration/apphost-compose
docker compose up -d tc-agro-identity-service

# Terminal 2: Frontend dev mode
cd poc/frontend
npm run dev
```

---

### Debug: Frontend Local + Identity in K3d

Create `.env.local`:

```bash
VITE_API_BASE_URL=http://localhost/identity
```

```bash
# Ensure identity is running in k3d
kubectl -n agro-apps get pods -l app=identity-api

# Run frontend locally
cd poc/frontend
npm run dev
```

---

### Debug: Frontend in Cluster + Identity Local

Create `.env.local`:

```bash
VITE_API_BASE_URL=http://host.docker.internal:5001
```

Rebuild frontend image:

```bash
cd poc/frontend
docker build -t k3d-localhost:5000/agro-frontend-service:latest .
docker push k3d-localhost:5000/agro-frontend-service:latest
```

---

## 📝 Environment Variables

### `.env.local` (Git-ignored, for local overrides)

```bash
# Manual API base URL override (optional)
VITE_API_BASE_URL=http://localhost:5001

# Custom base path (optional)
# VITE_BASE_PATH=/custom-path/

# Enable SignalR (optional)
# VITE_SIGNALR_ENABLED=true
```

### `.env.example` (Template, committed to repo)

Copy to `.env.local` and customize for your debug scenario.

---

## 🧪 Testing API Connection

### Check Detected API Base URL

Open browser console:

```javascript
// In any page after loading
console.log('API Base URL:', window.APP_CONFIG?.apiBaseUrl);
```

Expected outputs:

- Dev mode: `http://localhost:5001`
- Docker Compose: `http://localhost:5001`
- K3d cluster: `/identity`

---

### Test Login Endpoint

```bash
# Dev mode or Docker Compose
curl -X POST http://localhost:5001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@agro.com","password":"Test@1234"}'

# K3d cluster
curl -X POST http://localhost/identity/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@agro.com","password":"Test@1234"}'
```

---

## 🔧 Troubleshooting

### Issue: CORS Errors

**Symptom:** Browser console shows CORS policy errors

**Fix:** Ensure identity API has CORS configured for frontend origin:

```csharp
// In identity Program.cs
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins("http://localhost:3000", "http://localhost:5010")
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});
```

---

### Issue: API calls go to wrong URL

**Fix:** Check detected API base URL in console:

```javascript
console.log('API Base URL:', window.APP_CONFIG?.apiBaseUrl);
console.log('BASE_URL:', import.meta.env.BASE_URL);
console.log('Host:', window.location.host);
```

If incorrect, set `.env.local`:

```bash
VITE_API_BASE_URL=http://localhost:5001
```

---

### Issue: 404 on cluster routes

**Symptom:** `/identity/auth/login` returns 404 in cluster

**Fix:** Verify Ingress routes in k3d:

```bash
kubectl -n agro-apps get ingress
kubectl -n agro-apps describe ingress identity-ingress
```

Ensure identity API has path prefix configured:

```csharp
// In identity Program.cs
app.UsePathBase("/identity");
```

---

## 📦 Build for Production

### Local Build

```bash
cd poc/frontend
npm run build
```

Outputs to `dist/` with base path `/agro/`.

### Docker Build

```bash
cd poc/frontend
docker build -t agro-frontend:latest .
```

---

## 🎯 Summary

✅ **Zero configuration needed for standard workflows**  
✅ **Auto-detection based on BASE_URL and host**  
✅ **Manual override via `.env.local` for debugging**  
✅ **Works across dev, docker-compose, and k3d contexts**

No need to change code or config files when switching contexts!
