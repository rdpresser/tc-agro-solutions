# ADR-006: Local Orchestration – .NET Aspire vs Docker Compose

## Status
✅ Accepted

## Context
The project requires orchestrating local dependencies including:
- PostgreSQL database
- Redis cache
- Message broker (RabbitMQ)
- Multiple .NET 9 microservices

Two primary options exist: **.NET Aspire** or **Docker Compose**.

## Decision
Use **Docker Compose** as the primary local orchestration mechanism.
.NET Aspire may be used optionally for individual developer preference but is not required.

## Justification
### Why Docker Compose?
- **Simplicity:** Explicit, declarative YAML configuration
- **Universal:** Works for all team members regardless of IDE or tooling
- **No vendor lock-in:** Standard Docker tooling, well-documented
- **Easier onboarding:** New developers understand it immediately
- **Troubleshooting:** Standard Docker commands, no proprietary abstractions
- **Portability:** Same compose file can be shared across Windows, macOS, Linux

### Why NOT .NET Aspire (as primary tool)?
- **Immature:** Still evolving, breaking changes possible
- **IDE dependency:** Works best with Visual Studio/Rider
- **Complexity:** Adds abstraction layer that hides underlying infrastructure
- **Hybrid scenarios:** Not ideal for mixing Kubernetes + cloud deployment
- **Learning curve:** Requires understanding Aspire-specific concepts

## Consequences
### Positive
- Standardized local environment across all developers
- Clear visibility into infrastructure (ports, networks, volumes)
- Easy to debug and modify service configurations
- No dependency on specific .NET tooling

### Negative
- Manual observability setup (no built-in dashboard like Aspire)
- Less abstraction means more explicit configuration
- Service discovery requires explicit container networking

## Implementation Notes
- Create `docker-compose.yml` at repository root
- Include all backing services (PostgreSQL, Redis, RabbitMQ)
- Microservices can run via Docker Compose or directly via `dotnet run`
- Environment variables managed via `.env` file
- Health checks defined for all services
- Development database seeding via EF Core migrations

## Optional Use of Aspire
Individual developers may use .NET Aspire for their personal workflow, but:
- It is **not required** for team collaboration
- Docker Compose remains the source of truth
- CI/CD pipelines use Docker Compose, not Aspire
