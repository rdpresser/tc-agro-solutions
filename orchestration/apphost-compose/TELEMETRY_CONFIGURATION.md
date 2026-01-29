# Telemetry and Observability - TC Agro Solutions

**Date:** January 29, 2026  
**Status:** Consolidated (single source)

---

## Scope

This file consolidates telemetry and observability setup across Docker Compose and k3d, with short flows, required configuration, and validation commands.

---

## Versions (Local Stack)

- PostgreSQL/TimescaleDB: latest-pg17
- Loki: 3.6.4
- Tempo: 2.10.0
- OTEL Collector: 0.144.0
- Prometheus: v3.9.1
- Grafana: 12.3.1

---

## Global Data Flow

```
.NET Application
  -> OTEL SDK (OTLP gRPC 4317 / HTTP 4318)
  -> OTEL Collector
  -> Loki / Tempo / Prometheus
  -> Grafana (reads only)
```

Key points:

- The app pushes traces/logs/metrics to the Collector via OTLP.
- The Collector exports to Loki/Tempo/Prometheus.
- Grafana never receives pushes; it queries the backends.

---

## Scenario 1: 100% Docker Compose (Recommended for local dev)

Flow:

```
.NET App (Docker Compose)
  -> OTEL SDK (OTLP gRPC 4317)
  -> OTEL Collector (Docker Compose)
  -> Loki / Tempo / Prometheus (Docker Compose)
  -> Grafana (reads from Loki/Tempo/Prom)
```

App configuration:

```env
Telemetry__Grafana__Agent__Host=otel-collector
Telemetry__Grafana__Otlp__Endpoint=http://otel-collector:4317
Telemetry__Grafana__Otlp__Protocol=grpc
Telemetry__Grafana__Agent__Enabled=true
```

Key points:

- The app sends telemetry to the Docker Compose Collector.
- The Collector pushes logs to Loki, traces to Tempo, and metrics to Prometheus.
- Grafana queries these three services.

Commands:

```powershell
cd orchestration/apphost-compose
docker compose up -d
curl http://localhost:5001/health
```

---

## Scenario 2: 100% k3d (Full in-cluster observability)

Flow:

```
.NET App (k3d)
  -> OTEL SDK (OTLP gRPC 4317)
  -> OTEL Collector (k3d)
  -> Loki / Tempo / Prometheus (k3d)
  -> Grafana (k3d)
```

App configuration (cluster DNS):

```yaml
Telemetry__Grafana__Agent__Host: "platform-observability-opentelemetry-collector.monitoring.svc.cluster.local"
Telemetry__Grafana__Otlp__Endpoint: "http://platform-observability-opentelemetry-collector.monitoring.svc.cluster.local:4317"
Telemetry__Grafana__Otlp__Protocol: "grpc"
Telemetry__Grafana__Agent__Enabled: "true"
```

Port-forward Grafana (if needed):

```powershell
kubectl port-forward svc/platform-observability-grafana 3000:80 -n monitoring
```

---

## Scenario 3: k3d App + Docker Compose Observability

Flow:

```
.NET App (k3d)
  -> OTEL SDK (OTLP gRPC 4317)
  -> OTEL Collector (k3d)
  -> Loki / Tempo / Prometheus (Docker Compose)
  -> Grafana (Docker Compose)
```

Collector export targets (k3d -> host):

```yaml
exporters:
  otlp/tempo:
    endpoint: host.k3d.internal:3200
    tls:
      insecure: true
  loki:
    endpoint: http://host.k3d.internal:3100/loki/api/v1/push
  prometheus:
    endpoint: host.k3d.internal:9090
```

Notes:

- `/loki/api/v1/push` is the Loki ingestion route. Loki is the listener.
- Grafana reads from Loki, not the other way around.
- If `host.k3d.internal` does not resolve from pods, use the host IP.

---

## Scenario 4: Docker Compose App + k3d Collector

Flow:

```
.NET App (Docker Compose)
  -> OTEL SDK (OTLP gRPC 4317)
  -> OTEL Collector (k3d)
  -> Loki / Tempo / Prometheus (k3d or Docker Compose)
```

Expose the Collector:

```powershell
kubectl port-forward svc/platform-observability-opentelemetry-collector 4317:4317 4318:4318 -n monitoring
```

App configuration (compose -> host):

```env
Telemetry__Grafana__Agent__Host=host.docker.internal
Telemetry__Grafana__Otlp__Endpoint=http://host.docker.internal:4317
Telemetry__Grafana__Otlp__Protocol=grpc
Telemetry__Grafana__Agent__Enabled=true
```

---

## Loki + OTEL (Docker Compose Stack)

Collector uses OTLP/HTTP for Loki (no native Loki exporter in OTEL 0.144.0):

```
OTEL Collector (logs)
  -> OTLP/HTTP
  -> Loki /otlp
```

Collector config (Docker Compose):

```yaml
exporters:
  otlphttp/loki:
    endpoint: "http://loki:3100/otlp"
service:
  pipelines:
    logs:
      receivers: [otlp]
      processors: [memory_limiter, batch, attributes]
      exporters: [otlphttp/loki]
```

---

## Validation (Short)

```powershell
curl http://localhost:5001/health
start http://localhost:3000
curl http://localhost:3100/ready
curl http://localhost:3200/status
start http://localhost:9090/targets
```

---

## Key Files

- orchestration/apphost-compose/docker-compose.yml
- infrastructure/kubernetes/apps/base/identity/configmap.yaml
- infrastructure/kubernetes/platform/helm-values/dev/otel-collector.values.yaml
