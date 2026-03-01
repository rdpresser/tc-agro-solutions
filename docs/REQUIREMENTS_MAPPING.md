# Requirements Mapping - Hackathon 8NETT vs Delivered System

**Date:** February 27, 2026  
**Status:** ✅ Delivered

---

## Overview

This document maps mandatory requirements from the Hackathon 8NETT specification to what was actually built and delivered. It serves as traceability evidence for evaluation.

---

## Functional Requirements

| Requirement                              | Status   | Delivered in                                                                                  |
| ---------------------------------------- | -------- | --------------------------------------------------------------------------------------------- |
| **Producer login (email/password)**      | ✅       | Identity Service — `POST /auth/login` → JWT token                                             |
| **Register property + multiple plots**   | ✅       | Farm Service — `POST /api/properties`, `POST /api/plots`                                      |
| **Crop type per plot**                   | ✅       | Farm Service — `PlotAggregate.CropType` field, required on creation                           |
| **Sensor ingestion API (JWT-protected)** | ✅       | Sensor Ingest Service — `POST /readings`, `POST /readings/batch` (Roles: Admin/Producer/Sensor)|
| **Historical sensor charts**             | ✅       | Sensor Ingest Service — `GET /sensors/{id}/readings/history` (up to 30 days, paginated)       |
| **Plot status badge from alert rules**   | ✅       | Analytics Service — `GET /sensors/{id}/status` derived from active alert state                 |
| **Simple alert engine**                  | ✅       | Analytics Service — `SensorIngestedHandler` + `AlertAggregate.CreateFromSensorData()`         |
| **Display alerts on dashboard**          | ✅       | Analytics Service — `GET /alerts/pending`, `GET /alerts/history`, `GET /alerts/summary`       |

---

## Technical Requirements

| Requirement                              | Status   | Delivered in                                                                                  |
| ---------------------------------------- | -------- | --------------------------------------------------------------------------------------------- |
| **Microservices architecture**           | ✅       | 4 independent services, each with own DB and git repo — [ADR-001](./adr/ADR-001-microservices.md) |
| **Kubernetes orchestration**             | ✅       | k3d local cluster, ArgoCD GitOps, Kustomize overlays                                          |
| **APM / observability**                  | ✅       | OpenTelemetry + Prometheus + Grafana + Loki + Tempo on all services                            |
| **Async messaging**                      | ✅       | RabbitMQ + Wolverine Outbox Pattern — [ADR-002](./adr/ADR-002-persistence.md)                 |
| **CI/CD pipeline with green checks**     | ✅       | GitHub Actions per service: test → build → push to Docker Hub (rdpresser)                     |
| **Software architecture best practices** | ✅       | DDD, CQRS, Outbox, Snapshot, Result Pattern — 7 ADRs documented                               |

---

## Alert Engine Details

The alert engine evaluates three rules on every `SensorIngestedIntegrationEvent`:

| Metric        | Condition          | Alert Type         | Severity (by deviation from threshold)        |
| ------------- | ------------------ | ------------------ | --------------------------------------------- |
| Temperature   | > MaxTemperature   | `HighTemperature`  | Low (<5°C) / Medium (<10°C) / High (<15°C) / Critical (≥15°C) |
| Soil Moisture | < MinSoilMoisture  | `LowSoilMoisture`  | Low (<10%) / Medium (<20%) / High (<30%) / Critical (≥30%)     |
| Battery Level | < MinBatteryLevel  | `LowBattery`       | Medium (<30%) / High (<20%) / Critical (<10%) |

Thresholds are configurable via `appsettings.json` (`AlertThresholdOptions`). Default values: `MaxTemperature=35`, `MinSoilMoisture=20`, `MinBatteryLevel=15`.

Alerts follow a full lifecycle: **Pending → Acknowledged → Resolved** with timestamps and user attribution at each transition.

---

## What Was Not Implemented (and Why)

| Item                             | Decision                                                                                   |
| -------------------------------- | ------------------------------------------------------------------------------------------ |
| **Dashboard Service (5th service)** | Absorbed into Sensor Ingest Service (readings) and Analytics Service (alerts). Pragmatic decision during final sprint — avoids a thin service with no domain logic of its own. |
| **Configurable alert rules per plot** | Rules use configurable global thresholds. Per-plot rule configuration was out of scope. |
| **Azure / Terraform deployment** | Architecture was designed for Azure migration post-hackathon. IaC modules were specified in ADR-007 but not provisioned. See [ADR-005](./adr/ADR-005-local-vs-cloud.md). |
| **NoSQL / InfluxDB**             | Not required. PostgreSQL + TimescaleDB covers all time-series needs — [ADR-003](./adr/ADR-003-timeseries.md). |
| **Serverless functions**         | Not required. Wolverine message handlers in the Analytics Service cover the same use case. |

---

## Sensor Data Simulation

Since no physical hardware is available, the Sensor Ingest Service includes a `SimulatedSensorReadingsJob` (Quartz scheduler) that:

1. Queries all active sensors from `SensorSnapshot`
2. Fetches real weather data from the **Open-Meteo API** (temperature, humidity, soil moisture, precipitation) — cached for 60 minutes
3. Applies ±2% variance per sensor to simulate individual readings
4. Falls back to `Bogus`-generated data when the API is unavailable
5. Persists readings and publishes `SensorIngestedIntegrationEvent` for analytics processing
6. Pushes live readings to `SensorHub` (SignalR)

This approach produces realistic correlated data across sensors rather than pure random noise.

---

## Real-Time Capabilities

Both the Sensor Ingest Service and Analytics Service expose **SignalR hubs** for real-time push to connected clients:

| Hub         | Service              | Events pushed                                      |
| ----------- | -------------------- | -------------------------------------------------- |
| `SensorHub` | Sensor Ingest (5003) | New sensor reading (sensorId, temp, humidity, soil, time) |
| `AlertHub`  | Analytics (5004)     | Alert created, acknowledged, resolved               |

---

## Test Coverage Summary

| Service              | Tests | Coverage |
| -------------------- | ----- | -------- |
| Identity Service     | 56    | 82%      |
| Farm Service         | 247   | 92%      |
| Sensor Ingest Service| 241   | 94%      |
| Analytics Service    | 170+  | 91%      |

---

## Documentation Map

| Document                                             | Purpose                                      |
| ---------------------------------------------------- | -------------------------------------------- |
| [README_ROADMAP.md](../README_ROADMAP.md)            | Technical roadmap and delivered architecture |
| [docs/REQUIREMENTS_MAPPING.md](./REQUIREMENTS_MAPPING.md) | This file — traceability to spec        |
| [docs/adr/](./adr/)                                  | 7 Architectural Decision Records             |
| [docs/architecture/](./architecture/)                | C4 diagrams, data model                      |
| [docs/development/local-setup.md](./development/local-setup.md) | Local environment setup           |
| [NEW_MICROSERVICE_TEMPLATE.md](../NEW_MICROSERVICE_TEMPLATE.md) | Template for future services       |

---

## Compliance Summary

### ✅ All mandatory requirements delivered

- [x] JWT authentication (login + refresh + role-based authorization)
- [x] Property and plot registration with crop type
- [x] Authenticated sensor ingestion API
- [x] Historical readings (paginated, up to 30 days)
- [x] Plot/sensor status derived from alert rules
- [x] Alert engine (HighTemperature, LowSoilMoisture, LowBattery)
- [x] Alert display (pending, history, summary, lifecycle management)
- [x] Microservices architecture (4 independent services)
- [x] Kubernetes orchestration (k3d + ArgoCD)
- [x] APM observability (OTel + Prometheus + Grafana + Loki + Tempo)
- [x] Async messaging (RabbitMQ + Wolverine Outbox)
- [x] CI/CD with green checks (GitHub Actions + Docker Hub)
- [x] Architecture best practices (ADRs + C4 + DDD + CQRS)
- [x] Demo video (≤ 15 min)
- [x] Public repositories
- [x] Delivery report

---

> **Status:** ✅ Delivered — February 27, 2026
