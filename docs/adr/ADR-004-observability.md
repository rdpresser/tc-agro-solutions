# ADR-004: Observability and Dashboards

## Status

✅ Accepted

## Environment Context

- **🔵 CURRENT (Phase 5):** Localhost with Prometheus/Grafana/Loki/Tempo (Docker Compose)
- **🟣 FUTURE (Post-Hackathon):** Azure with Application Insights/Log Analytics/Monitor Workbooks

## Context

Phase 5 requires technical visibility (logs, metrics, traces) and business visibility (alert dashboards, performance).

## Decision

**Current (localhost):** Use Prometheus, Grafana, Loki, and Tempo for observability stack via Docker Compose.  
**Future (Azure):** Migrate to Application Insights as the telemetry center, Log Analytics for centralized analysis, and Azure Monitor Workbooks for technical dashboards. Business dashboards via Dashboard.Api with Redis cache, exposing plot status badges derived from alert rules (e.g., soil moisture below 30% for 24h → "Dry Alert").

## Justification

- Native integration with Azure and .NET
- Enables technical and business dashboards simultaneously
- Avoids dedicated frontend development
- Log Analytics enables advanced KQL queries
- Workbooks offer customization without complex UI

## Consequences

- Dashboards depend on KQL queries (learning curve)
- Cost proportional to telemetry volume
- Need for instrumentation in all services
- Optional Power BI for more sophisticated reports
- Base alert rules must be defined and fed into both Dashboard.Api and Workbooks to keep plot status views consistent.
