# ADR-004: Observability and Dashboards

## Status
✅ Accepted

## Context
Phase 5 requires technical visibility (logs, metrics, traces) and business visibility (alert dashboards, performance).

## Decision
Use Application Insights as the telemetry center, Log Analytics for centralized analysis, and Azure Monitor Workbooks for technical dashboards. Business dashboards via Dashboard.Api with Redis cache.

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
