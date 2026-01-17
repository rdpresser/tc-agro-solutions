# ADR-001: Microservices-based Architecture

## Status

✅ Accepted

## Environment Context

- **🔵 CURRENT (Phase 5):** Development on localhost with k3d + Docker Compose
- **🟣 FUTURE (Post-Hackathon):** Production deployment on Azure AKS

## Context

Phase 5 needs to demonstrate scalability, decoupling, observability, and cloud execution, respecting the deadline and the reduced team (4 backenders).

## Decision

Adopt microservices-based architecture, running on Kubernetes (k3d locally, AKS in production), with synchronous communication via HTTP and asynchronous via messaging (RabbitMQ locally, Azure Service Bus in production).

## Justification

- Enables independent scalability
- Facilitates per-service observability
- Adheres to modern market practices
- Aligns with the stack mastered by the team
- Demonstrates architectural maturity

## Consequences

- Greater operational complexity (mitigated by IaC and GitOps)
- Need for well-defined observability
- More elaborate integration tests
- Critical documentation for maintenance
