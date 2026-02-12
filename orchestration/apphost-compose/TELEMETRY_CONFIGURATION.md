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

> **⚠️ DEPRECATED:** This scenario is no longer used. We now use Scenario 3 (k3d + Docker Compose).
> The `platform-observability` ArgoCD application was removed to simplify the stack.

Flow:

```
.NET App (k3d)
  -> OTEL SDK (OTLP gRPC 4317)
  -> OTEL Collector DaemonSet (k3d)
  -> Docker Compose Stack (Loki / Tempo / Prometheus)
  -> Grafana (Docker Compose)
```

App configuration (DaemonSet in observability namespace):

```yaml
Telemetry__Grafana__Agent__Host: "otel-collector-agent.observability.svc.cluster.local"
Telemetry__Grafana__Otlp__Endpoint: "http://otel-collector-agent.observability.svc.cluster.local:4317"
Telemetry__Grafana__Otlp__Protocol: "grpc"
Telemetry__Grafana__Agent__Enabled: "true"
```

---

## Scenario 3: k3d App + Docker Compose Observability (CURRENT)

> **✅ RECOMMENDED:** This is the current production configuration.

Flow:

```
.NET App (k3d)
  -> OTEL SDK (OTLP gRPC 4317)
  -> OTEL DaemonSet Agent (k3d)
  -> Docker Compose OTEL Collector (tc-agro-otel-collector)
  -> Grafana Stack (Tempo/Loki/Prometheus in Docker Compose)
```

DaemonSet exports to Docker Compose using container name:

```yaml
exporters:
  otlphttp/docker:
    endpoint: "http://tc-agro-otel-collector:4318"
    tls:
      insecure: true
```

Notes:

- k3d cluster joins `tc-agro-network` Docker network via `--network` flag.
- Pods can resolve Docker container names directly (e.g., `tc-agro-otel-collector`).
- No need for `host.k3d.internal` or bridge IPs.

---

## Scenario 4: Docker Compose App + k3d Collector (Alternative)

> **⚠️ NOT RECOMMENDED:** This scenario is rarely needed. Use Scenario 1 or 3 instead.
> Documented for reference only.

Flow:

```
.NET App (Docker Compose)
  -> OTEL SDK (OTLP gRPC 4317)
  -> OTEL DaemonSet (k3d)
  -> Docker Compose Stack (Loki / Tempo / Prometheus)
```

If needed, expose the Collector from k3d:

```powershell
kubectl port-forward svc/otel-collector-agent 4317:4317 4318:4318 -n observability
```

App configuration (compose -> host):

```env
Telemetry__Grafana__Agent__Host=host.docker.internal
Telemetry__Grafana__Otlp__Endpoint=http://host.docker.internal:4317
Telemetry__Grafana__Otlp__Protocol=grpc
Telemetry__Grafana__Agent__Enabled=true
```

> **Note:** In most cases, Scenario 1 (100% Docker Compose) is simpler and sufficient for local development.

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
- infrastructure/kubernetes/platform/base/otel-daemonset.yaml
