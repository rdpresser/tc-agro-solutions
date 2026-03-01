# Terraform — Azure Infrastructure (Future)

> ⚠️ **This directory contains architecture design, not deployed infrastructure.**  
> The delivered system runs on **k3d (local Kubernetes)**. Azure migration is planned post-hackathon.

---

## What's Here

| File | Purpose |
|---|---|
| `AKS_NODE_POOLS_REFERENCE.md` | Complete HCL reference for AKS with 3 node pools (system, platform, worker) |

## What's Not Here (by design)

No `.tf` files were created during Phase 5. The decision was documented in [ADR-005: Local vs Cloud Development Strategy](../../docs/adr/ADR-005-local-vs-cloud.md):

- Building and proving the architecture locally first eliminates cloud cost during development
- The same manifests in `kubernetes/` deploy to AKS with minimal changes (image registry swap, secrets, ingress hostnames)
- Terraform modules were designed and referenced in ADR-007 but provisioning was deferred to post-hackathon

## Migration Path

When ready to move to Azure, the steps are:

1. Provision resources via Terraform (AKS + PostgreSQL Flexible Server + Redis + RabbitMQ/Service Bus)
2. Enable TimescaleDB extension on Azure PostgreSQL
3. Push images to Azure Container Registry (swap `rdpresser/` prefix)
4. Update `overlays/dev` → `overlays/prod` with Azure-specific secrets and ingress hostnames
5. Point ArgoCD to the new overlay

See [AKS_NODE_POOLS_REFERENCE.md](./AKS_NODE_POOLS_REFERENCE.md) for the full Terraform module reference and [ADR-007](../../docs/adr/ADR-007-node-pool-strategy.md) for node pool strategy rationale.
