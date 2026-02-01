# Observability DaemonSet Strategy (Consolidated)

**Date:** January 31, 2026  
**Scope:** Local Phase 5 (k3d + Docker Compose)  
**Decision:** Use a DaemonSet agent in k3d and keep the OpenTelemetry Collector in Docker Compose.

---

## 1) Decision (Objective Summary)

We standardize on **DaemonSet** for in-cluster telemetry collection. Each k3d node runs an OTEL Collector agent, which forwards OTLP to the **Docker Compose OTEL Collector**, keeping the existing Grafana/Tempo/Loki/Prometheus stack unchanged.

**Why:** lower latency, automatic scaling per node, and zero changes to C# source code.

---

## 2) Final Data Flow

```
Apps in k3d
   → DaemonSet Agent (otel-collector-agent.observability:4318)
   → Docker OTEL Collector (tc-agro-otel-collector:4318)
   → Grafana Stack (Tempo/Loki/Prometheus)
```

Docker Compose apps continue to send to `http://otel-collector:4318` and remain fully supported.

**Note:** k3d cluster joins the `tc-agro-network` Docker network, allowing pods to resolve Docker container names directly.

---

## 3) Required Configuration (Applied)

### A) Docker Compose OTEL Collector Ports

File: orchestration/apphost-compose/docker-compose.yml

- Expose extra ports for k3d → Docker OTEL Collector:
  - `0.0.0.0:14317:4317` (gRPC)
  - `0.0.0.0:14318:4318` (HTTP)

### B) Docker OTEL Collector Receiver

File: orchestration/apphost-compose/observability/otel-collector/config.yml

- Add receiver `otlp/from-k3d` on ports `14317/14318`.
- Include `otlp/from-k3d` in traces/metrics/logs pipelines.

### C) Environment Endpoint (DaemonSet)

Files:

- orchestration/apphost-compose/.env
- orchestration/apphost-compose/.env.example

Set the active endpoint to:

```
Telemetry__Grafana__Otlp__Endpoint=http://otel-collector-agent.observability:4318
```

The old Docker-only endpoint remains commented for quick rollback.

---

## 4) Feature Flag / Rollback (Docker-Only)

To return to 100% Docker Compose (no k3d DaemonSet), edit `.env`:

1. Comment the DaemonSet endpoint:

```
# Telemetry__Grafana__Otlp__Endpoint=http://otel-collector-agent.observability:4318
```

2. Re-enable Docker endpoint:

```
Telemetry__Grafana__Otlp__Endpoint=http://otel-collector:4318
```

No C# code changes required.

---

## 5) DaemonSet Manifest

File: infrastructure/kubernetes/platform/otel-daemonset.yaml

- ConfigMap for agent config
- DaemonSet (1 pod per node)
- ClusterIP Service: `otel-collector.observability` on 4317/4318

The agent exports to:

```
http://tc-agro-otel-collector:4318
```

**Note:** k3d cluster joins `tc-agro-network`, so pods resolve Docker container names directly.

---

## 6) Apply / Validate (When Needed)

1. Apply the DaemonSet:

```
kubectl apply -f infrastructure/kubernetes/platform/otel-daemonset.yaml
```

2. Confirm the DaemonSet is running:

```
kubectl get pods -n observability
```

3. Confirm Docker OTEL Collector is receiving k3d traffic:

```
docker logs tc-agro-otel-collector | findstr /i "from-k3d"
```

---

## 7) Status

- ✅ DaemonSet strategy adopted
- ✅ OTEL Collector remains in Docker Compose
- ✅ k3d agent forwarding enabled
- ✅ Docker-only fallback preserved

---

## 8) Single Source of Truth

This file is the only maintained observability strategy document for DaemonSet usage.
