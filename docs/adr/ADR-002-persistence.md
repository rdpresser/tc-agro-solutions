# ADR-002: Data Persistence Strategy

## Status

✅ Accepted

## Environment Context

- **🔵 CURRENT (Phase 5):** PostgreSQL + TimescaleDB in Docker (localhost)
- **🟣 FUTURE (Post-Hackathon):** Azure PostgreSQL Flexible Server + TimescaleDB

## Context

The project has different types of data: registrations (properties, plots), alerts (transactional), and sensor readings (continuous and voluminous).

## Decision

Use PostgreSQL as the main database (Docker locally, Azure PostgreSQL Flexible Server in production), persistence via EF Core for transactional data, avoiding full event sourcing. TimescaleDB as an extension for sensor time series.

## Justification

- EF Core reduces learning curve
- PostgreSQL is already integrated with Azure infrastructure
- Event sourcing would be overengineering for the domain
- TimescaleDB offers superior performance for continuous metrics
- Full compatibility between EF Core and TimescaleDB

## Consequences

- Auditing will be done via log tables and Application Insights
- Greater operational simplicity
- Time series queries will use raw SQL (KQL in reports)
- Better performance in historical reads

## Domain Model Summary (Mandatory Attributes)

**Plot** stores crop_type per producer:

- `Id` (PK)
- `PropertyId` (FK)
- `Name`
- `CropType` (mandatory: informing the culture planted in each plot)
- `AreaHectares`
