# ADR-002: Data Persistence Strategy

## Status
✅ Accepted

## Context
The project has different types of data: registrations (properties, plots), alerts (transactional), and sensor readings (continuous and voluminous).

## Decision
Use PostgreSQL as the main database with Azure PostgreSQL Flexible Server, persistence via EF Core for transactional data, avoiding full event sourcing. TimescaleDB as an extension for sensor time series.

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
