# Telemetry Configuration Guide - TC Agro Solutions

**Date:** January 28, 2026  
**Status:** ✅ Configured and Ready

---

## Overview

This document describes the complete telemetry flow for TC Agro Solutions:

```
.NET Application (k3d) → OTEL Collector (k3d) → Observability Stack (Docker Compose)
```

**Why this architecture?**

- Applications run in k3d cluster (development/testing)
- Observability stack runs in Docker Compose (lightweight, accessible via localhost)
- OTEL Collector acts as telemetry gateway between k3d and Docker Compose

---

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                     k3d Cluster (localhost)                      │
│                                                                  │
│  ┌─────────────────┐                                            │
│  │  .NET Identity  │                                            │
│  │    Service      │                                            │
│  │                 │  Telemetry__Grafana__Otlp__Endpoint       │
│  │  (agro-apps)    │  = http://platform-observability-         │
│  │                 │    opentelemetry-collector.monitoring     │
│  │                 │    .svc.cluster.local:4317                │
│  └────────┬────────┘                                            │
│           │                                                      │
│           │ OTLP gRPC (traces, metrics, logs)                   │
│           ↓                                                      │
│  ┌──────────────────────────────┐                               │
│  │  OTEL Collector              │                               │
│  │  (monitoring namespace)      │                               │
│  │                              │                               │
│  │  - Receives: OTLP (4317)     │                               │
│  │  - Exports: Tempo, Prom,     │                               │
│  │             Loki via         │                               │
│  │             host.k3d.internal│                               │
│  └──────────┬───────────────────┘                               │
│             │                                                    │
└─────────────┼────────────────────────────────────────────────────┘
              │
              │ host.k3d.internal (192.168.65.254)
              ↓
┌──────────────────────────────────────────────────────────────────┐
│             Docker Compose (localhost ports)                     │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   Tempo     │  │ Prometheus  │  │    Loki     │             │
│  │   :3200     │  │   :9090     │  │   :3100     │             │
│  │  (Traces)   │  │  (Metrics)  │  │   (Logs)    │             │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │
│         │                │                │                      │
│         └────────────────┴────────────────┘                      │
│                          │                                       │
│                          ↓                                       │
│                  ┌───────────────┐                               │
│                  │    Grafana    │                               │
│                  │     :3000     │                               │
│                  │  (Dashboard)  │                               │
│                  └───────────────┘                               │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Component Configuration

### 1. .NET Application (k3d cluster)

**Location:** `infrastructure/kubernetes/apps/base/identity/configmap.yaml`

```yaml
# Telemetry configuration for applications running in k3d
Telemetry__Grafana__Agent__Host: "platform-observability-opentelemetry-collector.monitoring.svc.cluster.local"
Telemetry__Grafana__Agent__OtlpGrpcPort: "4317"
Telemetry__Grafana__Agent__OtlpHttpPort: "4318"
Telemetry__Grafana__Agent__MetricsPort: "8889"
Telemetry__Grafana__Agent__Enabled: "true" # ✅ ENABLED in k3d
Telemetry__Grafana__Otlp__Endpoint: "http://platform-observability-opentelemetry-collector.monitoring.svc.cluster.local:4317"
Telemetry__Grafana__Otlp__Protocol: "grpc"
Telemetry__Grafana__Otlp__TimeoutSeconds: "10"
Telemetry__Grafana__Otlp__Insecure: "true"
```

**Override File:** `orchestration/apphost-compose/.env.k3d` (optional overrides only)

---

### 2. OTEL Collector (k3d cluster)

**Location:** `infrastructure/kubernetes/platform/helm-values/dev/otel-collector.values.yaml`

```yaml
config:
  receivers:
    otlp:
      protocols:
        grpc:
          endpoint: 0.0.0.0:4317
        http:
          endpoint: 0.0.0.0:4318

  processors:
    batch:
      timeout: 10s
      send_batch_size: 1024

  exporters:
    debug:
      verbosity: detailed

    # Export traces to Tempo (Docker Compose)
    otlp/tempo:
      endpoint: host.k3d.internal:3200
      tls:
        insecure: true

    # Export logs to Loki (Docker Compose)
    loki:
      endpoint: http://host.k3d.internal:3100/loki/api/v1/push

    # Export metrics to Prometheus (Docker Compose)
    prometheus:
      endpoint: host.k3d.internal:9090
      namespace: tc_agro
      send_timestamps: true
      metric_expiration: 10m

  service:
    pipelines:
      traces:
        receivers: [otlp]
        processors: [batch]
        exporters: [debug, otlp/tempo]

      metrics:
        receivers: [otlp]
        processors: [batch]
        exporters: [debug, prometheus]

      logs:
        receivers: [otlp]
        processors: [batch]
        exporters: [debug, loki]
```

**Service Name:** `platform-observability-opentelemetry-collector.monitoring.svc.cluster.local`  
**Namespace:** `monitoring`  
**Ports:**

- `4317`: OTLP gRPC
- `4318`: OTLP HTTP
- `8889`: Prometheus metrics (collector self-monitoring)

---

### 3. Observability Stack (Docker Compose)

**Location:** `orchestration/apphost-compose/docker-compose.yml`

| Service    | Image Version            | Port | Purpose                       |
| ---------- | ------------------------ | ---- | ----------------------------- |
| Tempo      | grafana/tempo:2.10.0     | 3200 | Distributed tracing backend   |
| Loki       | grafana/loki:3.6.4       | 3100 | Log aggregation               |
| Prometheus | prom/prometheus:v3.9.1   | 9090 | Metrics storage & querying    |
| Grafana    | grafana/grafana:12.3.1   | 3000 | Visualization dashboards      |
| OTEL Col.  | otel/...-contrib:0.144.0 | 4317 | (Local OTEL, not used by k3d) |

**Access URLs:**

- Grafana: http://localhost:3000 (admin/admin)
- Prometheus: http://localhost:9090
- Loki: http://localhost:3100 (API only, no UI)
- Tempo: http://localhost:3200 (API only, no UI)

---

## Configuration Files Summary

| File                           | Purpose                 | Telemetry Enabled?                 |
| ------------------------------ | ----------------------- | ---------------------------------- |
| `docker-compose.yml`           | Local Docker services   | ❌ No (Agent\_\_Enabled=false)     |
| `.env`                         | Docker Compose env vars | ❌ No (dev only)                   |
| `.env.k3d`                     | k3d sensitive overrides | ✅ Yes (commented, uses configmap) |
| `configmap.yaml`               | k3d app configuration   | ✅ Yes (Agent\_\_Enabled=true)     |
| `otel-collector.values.yaml`   | k3d OTEL config         | ✅ Yes (exports enabled)           |
| `appsettings.Development.json` | .NET app defaults       | ❌ No (localhost fallback)         |

---

## Deployment & Verification

### Step 1: Deploy Updated OTEL Collector to k3d

```powershell
# From project root
cd infrastructure/kubernetes

# ArgoCD will auto-sync, or force refresh:
kubectl apply -f platform/argocd/applications/platform-observability.yaml

# Wait for rollout
kubectl rollout status deployment/platform-observability-opentelemetry-collector -n monitoring
```

### Step 2: Restart Applications in k3d

```powershell
# Restart identity service to pick up new configmap
kubectl rollout restart deployment/identity-service -n agro-apps

# Watch pod logs for telemetry export
kubectl logs -f deployment/identity-service -n agro-apps | Select-String -Pattern "telemetry|otlp|trace"
```

### Step 3: Verify Docker Compose Stack

```powershell
cd orchestration/apphost-compose

# Restart with new versions (pull images)
docker compose pull
docker compose up -d

# Check service health
docker compose ps
docker compose logs -f tempo loki prometheus
```

### Step 4: Test Telemetry Flow

1. **Generate traffic:** Call identity service API endpoints in k3d
2. **Check OTEL Collector logs:**
   ```powershell
   kubectl logs -f deployment/platform-observability-opentelemetry-collector -n monitoring | Select-String -Pattern "traces|metrics|logs"
   ```
3. **Query Tempo (traces):**
   ```powershell
   curl http://localhost:3200/api/search
   ```
4. **Query Prometheus (metrics):**
   ```powershell
   curl http://localhost:9090/api/v1/query?query=up
   ```
5. **Check Loki (logs):**
   ```powershell
   curl http://localhost:3100/loki/api/v1/labels
   ```
6. **View in Grafana:**
   - Open http://localhost:3000
   - Login: admin / admin
   - Explore → Select Tempo/Prometheus/Loki data sources

---

## Troubleshooting

### Problem: OTEL Collector not receiving telemetry

**Check:**

1. Application configmap has correct endpoint:
   ```powershell
   kubectl get configmap identity-config -n agro-apps -o yaml | Select-String -Pattern "Telemetry"
   ```
2. OTEL Collector pod is running:
   ```powershell
   kubectl get pods -n monitoring | Select-String -Pattern "otel"
   ```
3. Network connectivity from app to OTEL:
   ```powershell
   kubectl exec -it deployment/identity-service -n agro-apps -- sh -c "wget -O- http://platform-observability-opentelemetry-collector.monitoring.svc.cluster.local:4318/v1/traces"
   ```

### Problem: OTEL Collector not exporting to Docker Compose

**Check:**

1. Docker Compose services are running:
   ```powershell
   docker compose ps tempo loki prometheus
   ```
2. host.k3d.internal resolves from k3d:
   ```powershell
   kubectl exec -it deployment/platform-observability-opentelemetry-collector -n monitoring -- sh -c "getent hosts host.k3d.internal"
   # Should return: 192.168.65.254
   ```
3. OTEL Collector logs show export attempts:
   ```powershell
   kubectl logs deployment/platform-observability-opentelemetry-collector -n monitoring | Select-String -Pattern "host.k3d.internal|export"
   ```

### Problem: Grafana not showing data

**Check:**

1. Data sources configured in Grafana:
   - Explore → Connections → Data sources
   - Should have: Prometheus (http://localhost:9090), Loki (http://localhost:3100), Tempo (http://localhost:3200)
2. Query each data source directly via API (see Step 4 above)
3. Check time range in Grafana (default: last 6h)

---

## Version Upgrade Notes

**Updated on January 28, 2026:**

| Service    | Old Version | New Version | Breaking Changes?                               |
| ---------- | ----------- | ----------- | ----------------------------------------------- |
| Grafana    | 10.4.2      | 12.3.1      | ⚠️ YES (major bump, check plugin compatibility) |
| Loki       | 2.9.8       | 3.6.4       | ⚠️ YES (check config schema)                    |
| Tempo      | 2.4.1       | 2.10.0      | ✅ No (minor bump)                              |
| Prometheus | v2.52.0     | v3.9.1      | ⚠️ YES (major bump, OTLP ingestion changes)     |
| OTEL Col.  | 0.98.0      | 0.144.0     | ⚠️ YES (check exporter compatibility)           |

**Recommendation:** Test in dev environment before production upgrade.

---

## Next Steps

1. ✅ **DONE:** Configure OTEL Collector to export to Docker Compose
2. ✅ **DONE:** Update application configmap with correct endpoints
3. ✅ **DONE:** Update service versions to latest stable
4. ⏳ **TODO:** Deploy updated OTEL config to k3d (ArgoCD sync)
5. ⏳ **TODO:** Restart applications and verify telemetry flow
6. ⏳ **TODO:** Configure Grafana dashboards for application metrics

---

## References

- [OpenTelemetry Collector Documentation](https://opentelemetry.io/docs/collector/)
- [Grafana Configuration](https://grafana.com/docs/grafana/latest/setup-grafana/configure-grafana/)
- [Tempo OTLP Ingestion](https://grafana.com/docs/tempo/latest/configuration/receiver/)
- [Loki Push API](https://grafana.com/docs/loki/latest/api/#post-lokiapiv1push)
- [Prometheus Remote Write](https://prometheus.io/docs/prometheus/latest/configuration/configuration/#remote_write)

---

> **Status:** Configuration complete. Ready for deployment validation.  
> **Next Action:** Deploy OTEL Collector update to k3d via ArgoCD sync.
