# ADR-005: Local vs Cloud Development Strategy

## Status
✅ Accepted

## Context
Phase 5 requires:
- Local execution for cost-free development
- Azure deployment for delivery and evaluation
- Portability and Kubernetes adherence across environments

The team needs to develop efficiently without incurring continuous cloud costs while maintaining architectural fidelity to the production environment.

## Decision
Adopt two distinct environments with clear boundaries:
- **Local environment:** Lightweight Kubernetes (k3d/kind) or Docker Compose
- **Cloud environment:** Azure Kubernetes Service (AKS) with full Azure-managed services

## Justification
- Reduces development costs significantly
- Avoids excessive cloud dependency during development
- Enables parallel development by the entire team
- Maintains architectural fidelity between environments
- Allows rapid iteration without cloud provisioning delays

## Consequences
### Positive
- Zero cloud costs during development
- Faster feedback loops
- Team can work offline or with intermittent connectivity
- Easier debugging and troubleshooting

### Negative
- Local infrastructure does not replicate all Azure services
- Azure Service Bus must be simulated locally (RabbitMQ)
- Local observability is simplified (no Application Insights)
- Requires maintaining parity between environments

## Implementation Notes
- Use Docker Compose for local orchestration
- PostgreSQL runs locally (no Azure PostgreSQL Flexible Server)
- RabbitMQ replaces Azure Service Bus for local messaging
- Redis runs in a local container
- Environment-specific configurations via `appsettings.{Environment}.json`
- **Terraform only used for Azure (production)**, not for local development
- Single Terraform environment targeting Azure production resources
