# ADR-001: Microservices-based Architecture

## Status
✅ Accepted

## Context
Phase 5 needs to demonstrate scalability, decoupling, observability, and cloud execution, respecting the deadline and the reduced team (4 backenders).

## Decision
Adopt microservices-based architecture, running on Azure Kubernetes Service (AKS), with synchronous communication via HTTP and asynchronous via messaging (Azure Service Bus).

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
