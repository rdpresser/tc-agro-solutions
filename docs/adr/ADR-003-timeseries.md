# ADR-003: Use of Time Series with TimescaleDB

## Status

✅ Accepted

## Environment Context

- **🔵 CURRENT (Phase 5):** PostgreSQL + TimescaleDB in Docker (localhost)
- **🟣 FUTURE (Post-Hackathon):** Azure PostgreSQL Flexible Server + TimescaleDB extension

## Context

Sensor readings generate a large volume of time-oriented data, requiring:

- Continuous inserts (hundreds per minute)
- Efficient historical queries
- Aggregations by period (hour/day/week)
- Automatic retention of old data

## Decision

Use TimescaleDB as a PostgreSQL extension to store and query sensor data in optimized hypertables (Docker locally, Azure PostgreSQL in production).

## Justification

- Specifically optimized for time series
- Full compatibility with PostgreSQL and EF Core
- Enables efficient aggregations ("time_bucket")
- Automatic compression of history
- Automatic retention and cleanup of data
- No overhead of external tools

## Consequences

- Need to enable the extension on Azure PostgreSQL Flexible Server
- Advanced time series queries will use raw SQL
- Dashboard uses native aggregation functions
- Differentiated modeling for hypertables vs normal tables
