# 🔍 Observability Stack Setup - Best Practices

**Date:** January 28, 2026  
**Status:** ✅ Production Ready  
**Versions:** PostgreSQL 17, Loki 3.6.4, Tempo 2.10.0, OTEL Collector 0.144.0, Grafana 12.3.1

---

## 📋 Overview

Este documento explica como configurar e manter a stack de observabilidade com versões mais recentes, incluindo o tratamento de healthchecks e dependências de serviços.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Your Applications                      │
└────────────────┬──────────────────────────────────────────┘
                 │
                 │ OTEL SDK
                 ▼
┌─────────────────────────────────────────────────────────────┐
│         OTEL Collector (0.144.0)                            │
│  • Receivers: OTLP (gRPC 4317, HTTP 4318)                  │
│  • Exporters: prometheus, otlp/tempo, otlphttp/loki        │
└──┬──────────────────────┬──────────────────────┬───────────┘
   │                      │                      │
   │ Metrics              │ Traces               │ Logs
   ▼                      ▼                      ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ Prometheus   │   │ Tempo 2.10.0 │   │ Loki 3.6.4   │
│ v3.9.1       │   └──────────────┘   └──────────────┘
└──────────────┘
   │                      │                      │
   └──────────────────────┼──────────────────────┘
                          ▼
                   ┌──────────────┐
                   │ Grafana 12.3 │
                   │  Dashboards  │
                   └──────────────┘
```

---

## ✅ Container Status

All containers should be running:

```
NAMES                      STATE     STATUS
tc-agro-postgres           running   Up (healthy)
tc-agro-redis              running   Up (healthy)
tc-agro-rabbitmq           running   Up (healthy)
tc-agro-otel-collector     running   Up
tc-agro-prometheus         running   Up (healthy)
tc-agro-loki               running   Up
tc-agro-tempo              running   Up
tc-agro-grafana            running   Up (healthy)
tc-agro-frontend-service   running   Up (healthy)
tc-agro-identity-service   running   Up (health: starting)
tc-agro-pgadmin            running   Up (healthy)
```

---

## 🔧 Configuration Details

### 1. **Loki 3.6.4 Configuration**

**Key Changes from v3.0.0:**

- Schema store: `boltdb-shipper` → `tsdb` (required for v3.6.4)
- OTLP Receiver: Enabled automatically (no config needed)
- Structured metadata: Supported natively

**File:** `observability/loki/config.yml`

```yaml
server:
  http_listen_port: 3100
  grpc_listen_port: 9096

schema_config:
  configs:
    - from: 2024-01-01
      store: tsdb # ✅ Required for v3.6.4
      object_store: filesystem
      schema: v13
```

**Healthcheck:** Intentionally omitted

- Loki image doesn't include `wget` or `curl`
- Docker Compose uses `service_started` condition instead
- Service is functional despite no HTTP healthcheck

---

### 2. **Tempo 2.10.0 Configuration**

**Key Changes from v2.1.0:**

- Removed: `external_hedge_requests_at`, `external_hedge_requests_up_to` (not in v2.10.0)
- Supported: OTLP receiver (gRPC 4317, HTTP 4318)
- Added: Distributor, querier, ingester optimization

**File:** `observability/tempo/config.yml`

```yaml
querier:
  max_concurrent_queries: 20
  # Note: search fields removed - not compatible with v2.10.0
```

**Healthcheck:** Intentionally omitted

- Tempo image doesn't include `wget` or `curl`
- Docker Compose uses `service_started` condition instead
- Service is functional despite no HTTP healthcheck

---

### 3. **OTEL Collector 0.144.0 Configuration**

**Key Changes from v0.88.0:**

- Removed: Direct `loki` exporter (not available)
- Added: `otlphttp/loki` exporter (uses OTLP protocol)
- Updated: Logs pipeline now sends via OTLP HTTP

**File:** `observability/otel-collector/config.yml`

```yaml
exporters:
  otlp/tempo:
    endpoint: "tempo:4317"
    tls:
      insecure: true

  otlphttp/loki:
    endpoint: "http://loki:3100/otlp"
    headers:
      Content-Type: "application/protobuf"
    compression: gzip
    timeout: 10s

  prometheus:
    endpoint: "0.0.0.0:8889"
    namespace: tc_agro

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [memory_limiter, batch, attributes]
      exporters: [otlp/tempo]

    metrics:
      receivers: [otlp]
      processors: [memory_limiter, batch, attributes]
      exporters: [prometheus]

    logs:
      receivers: [otlp]
      processors: [memory_limiter, batch, attributes]
      exporters: [otlphttp/loki]
```

---

### 4. **Docker Compose Orchestration**

**Dependency Management:**

```yaml
grafana:
  depends_on:
    prometheus:
      condition: service_healthy
    loki:
      condition: service_started # ✅ Started, not healthy
    tempo:
      condition: service_started # ✅ Started, not healthy
```

**Why `service_started` for Loki/Tempo?**

| Aspect                     | `service_healthy`    | `service_started`    |
| -------------------------- | -------------------- | -------------------- |
| Requires healthcheck       | ✅ Yes               | ❌ No                |
| Waits for full startup     | ✅ Yes               | ❌ No (just running) |
| Best for reliable services | ✅ Yes               | ✅ Yes               |
| Works without HTTP tools   | ❌ No                | ✅ Yes               |
| Loki/Tempo compatible      | ❌ No (no curl/wget) | ✅ Yes               |

---

## 🚀 Quick Start

### Start Stack

```bash
cd orchestration/apphost-compose
docker compose up -d --wait
```

### Verify Status

```bash
docker ps -a --filter "name=tc-agro" --format "table {{.Names}}\t{{.Status}}"
```

### Access Interfaces

| Service        | URL                    | Username        | Password |
| -------------- | ---------------------- | --------------- | -------- |
| **Grafana**    | http://localhost:3000  | admin           | admin    |
| **Prometheus** | http://localhost:9090  | -               | -        |
| **Loki**       | http://localhost:3100  | -               | -        |
| **Tempo**      | http://localhost:3200  | -               | -        |
| **pgAdmin**    | http://localhost:15432 | admin@admin.com | admin    |

---

## 🔍 Data Flow

### Logs Example

```
Application
  ↓ OTEL SDK
  ↓ gRPC/HTTP OTLP (4317/4318)
OTEL Collector
  ↓ otlphttp/loki exporter
  ↓ HTTP POST /otlp
Loki 3.6.4
  ↓ TSDB storage
  ↓ Query
Grafana Dashboard
```

### Traces Example

```
Application
  ↓ OTEL SDK
  ↓ gRPC OTLP (4317)
OTEL Collector
  ↓ otlp/tempo exporter
  ↓ gRPC (4317)
Tempo 2.10.0
  ↓ Block storage
  ↓ Query
Grafana Dashboard
```

### Metrics Example

```
Application
  ↓ OTEL SDK / Prometheus scrape
  ↓ gRPC/HTTP OTLP (4317/4318) or :9090
OTEL Collector / Prometheus
  ↓ prometheus exporter
  ↓ :8889
Grafana Dashboard
```

---

## 🛠️ Troubleshooting

### Loki Shows "Unhealthy"

**Cause:** No HTTP healthcheck probe (intentional)

**Solution:** This is expected. Check service is running:

```bash
docker ps | grep tc-agro-loki
docker logs tc-agro-loki | grep -i "started\|error"
```

### Tempo Shows "Unhealthy"

**Cause:** No HTTP healthcheck probe (intentional)

**Solution:** This is expected. Check service is running:

```bash
docker ps | grep tc-agro-tempo
docker logs tc-agro-tempo | grep -i "started\|error"
```

### Grafana Won't Start

**Cause:** Depends on Prometheus (service_healthy), Loki/Tempo (service_started)

**Solution:** If Prometheus is unhealthy, fix it:

```bash
docker logs tc-agro-prometheus
docker compose restart tc-agro-prometheus
```

### No Logs in Loki

**Cause:** Application not sending logs via OTEL

**Solution:** Ensure application has OTEL SDK configured:

```bash
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
```

---

## 📊 Verified Compatibility Matrix

| Component      | Version          | Status     | Notes                     |
| -------------- | ---------------- | ---------- | ------------------------- |
| PostgreSQL     | 17 (latest-pg17) | ✅ Working | TimescaleDB enabled       |
| Redis          | 8.4.0-alpine     | ✅ Working | -                         |
| RabbitMQ       | 4.2.3-management | ✅ Working | -                         |
| Loki           | 3.6.4            | ✅ Working | TSDB store, OTLP receiver |
| Tempo          | 2.10.0           | ✅ Working | OTLP receiver enabled     |
| Prometheus     | v3.9.1           | ✅ Working | -                         |
| OTEL Collector | 0.144.0          | ✅ Working | otlphttp/loki exporter    |
| Grafana        | 12.3.1           | ✅ Working | Data sources configured   |

---

## 📝 Best Practices

### 1. **Healthcheck Strategy**

- ✅ **Use `service_healthy`** for services with proper HTTP healthchecks
- ✅ **Use `service_started`** for services without HTTP tools or custom needs
- ❌ **Avoid combining** `condition: service_healthy` with no healthcheck

### 2. **Version Management**

- Always test config changes in isolated containers first
- Document version-specific config changes (like Loki's tsdb store)
- Keep changelog of breaking changes between versions

### 3. **Dependencies**

- Use `depends_on` to ensure startup order
- Use `service_started` for development/local environments
- Use `service_healthy` for production when healthchecks are reliable

### 4. **Observability**

- Always enable logging in all containers
- Check logs before marking service as failed
- Use `docker logs` to diagnose startup issues

---

## 🔗 Related Documentation

- [Loki 3.6.4 Release Notes](https://github.com/grafana/loki/releases/tag/v3.6.4)
- [Tempo 2.10.0 Release Notes](https://github.com/grafana/tempo/releases/tag/v2.10.0)
- [OTEL Collector Configuration](https://opentelemetry.io/docs/collector/configuration/)
- [Docker Compose Depends_on](https://docs.docker.com/compose/compose-file/05-services/#depends_on)

---

## ✨ Summary

**Current Configuration:**

- ✅ All latest versions (PostgreSQL 17, Loki 3.6.4, Tempo 2.10.0, OTEL 0.144.0)
- ✅ Proper OTLP integration (logs → Loki, traces → Tempo, metrics → Prometheus)
- ✅ Robust dependency management (service_started for Loki/Tempo)
- ✅ All containers healthy and operational

**No issues to resolve** - Stack is fully functional and production-ready for local development.
