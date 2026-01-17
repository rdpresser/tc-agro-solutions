# ADR-007: AKS Node Pool Strategy

## Status

✅ Accepted

## Environment Context

- **🔵 CURRENT (Phase 5):** Localhost development with k3d (this ADR is reference only)
- **🟣 FUTURE (Post-Hackathon):** Azure AKS deployment (documented here for migration planning)

This ADR describes the **🟣 FUTURE** Azure production architecture. During Phase 5, development uses k3d locally.

## Context

Azure Kubernetes Service (AKS) deployment for future production requires careful resource planning to balance:

- **Stability:** System components must remain healthy
- **Cost:** Limited infrastructure budget
- **Simplicity:** Operational overhead must be minimal
- **Performance:** Application workloads need consistent responsiveness

Observability is handled exclusively via Application Insights (no Prometheus/Grafana/OTEL Collector in-cluster), which significantly reduces resource consumption compared to traditional monitoring stacks.

## Decision

Implement **3 distinct node pools** on AKS, each optimized for specific workload types and resource consumption patterns:

### 1. System Pool

- **Purpose:** Kubernetes critical components
- **SKU:** `Standard_B2ms` (2 vCPU, 8 GB RAM)
- **Workloads:**
  - `kube-system` namespace
  - CoreDNS
  - CNI networking
  - CSI storage drivers
  - Azure agents
  - Cluster addons

**Rationale:** System components have unpredictable memory consumption and cannot be constrained with limits. OOMKill in this pool affects the entire cluster. A larger instance mitigates risk.

### 2. Platform Pool

- **Purpose:** Infrastructure and platform components
- **SKU:** `Standard_B2s` (2 vCPU, 4 GB RAM)
  - _Upgrade to B2ms if additional margin needed_
- **Workloads:**
  - ArgoCD (server, repo-server, application-controller)
  - Ingress Controller (NGINX)
  - cert-manager
  - Light cluster addons

**Rationale:** ArgoCD and Ingress have moderate, predictable memory consumption (~700MB–1GB combined). Without heavy observability stacks (Prometheus, Grafana), this pool's usage remains controlled. B2s is cost-optimal; B2ms available for upgraded margins.

### 3. Worker Pool

- **Purpose:** Business domain application workloads
- **SKU:** `Standard_B2s` (2 vCPU, 4 GB RAM)
- **Workloads:**
  - .NET 10 microservices
    - Agro.Identity.Api
    - Agro.Farm.Api
    - Agro.Sensor.Ingest.Api
    - Agro.Dashboard.Api
  - Agro.Analytics.Worker
  - All user-facing applications

**Rationale:** Application workloads are under team control with well-defined resource requests and limits. OOMKill is pod-isolated with automatic recovery. Horizontal scaling (HPA) is available for demand spikes. This is the appropriate pool for cost optimization.

## Justification

| Criterion                   | System Pool                | Platform Pool                  | Worker Pool                    |
| --------------------------- | -------------------------- | ------------------------------ | ------------------------------ |
| **Resource Predictability** | Low (unpredictable)        | Moderate (controlled)          | High (requests/limits defined) |
| **Impact of Failure**       | Critical (affects cluster) | Moderate (service degradation) | Low (isolated to pod)          |
| **Cost Optimization**       | Not a priority             | Medium                         | High                           |
| **SKU Chosen**              | B2ms (stronger)            | B2s/B2ms (balanced)            | B2s (optimized)                |

## Implementation Details

### Node Pool Configuration

**System Pool:**

```
- name: system
- vm_size: Standard_B2ms
- enable_auto_scaling: true
- min_count: 1
- max_count: 2
- node_labels: workload=system
- node_taints: CriticalAddonsOnly=true:NoSchedule
```

**Platform Pool:**

```
- name: platform
- vm_size: Standard_B2s
- enable_auto_scaling: true
- min_count: 1
- max_count: 3
- node_labels: workload=platform
```

**Worker Pool:**

```
- name: worker
- vm_size: Standard_B2s
- enable_auto_scaling: true
- min_count: 2
- max_count: 5
- node_labels: workload=application
```

### Pod Placement via Node Affinity

Applications deployed to appropriate pools via `nodeSelector`:

```yaml
# ArgoCD → Platform Pool
apiVersion: apps/v1
kind: Deployment
metadata:
  name: argocd-server
spec:
  template:
    spec:
      nodeSelector:
        workload: platform
      containers:
        - name: argocd
          resources:
            requests:
              memory: "256Mi"
              cpu: "100m"
            limits:
              memory: "512Mi"
              cpu: "500m"
```

```yaml
# Application → Worker Pool
apiVersion: apps/v1
kind: Deployment
metadata:
  name: farm-api
spec:
  template:
    spec:
      nodeSelector:
        workload: application
      containers:
        - name: farm-api
          resources:
            requests:
              memory: "512Mi"
              cpu: "250m"
            limits:
              memory: "1Gi"
              cpu: "500m"
```

## Consequences

### Positive

- **Stability:** System pool isolation prevents cluster-wide impacts
- **Cost Control:** Worker pool optimization without sacrificing reliability
- **Operational Simplicity:** Clear separation of concerns
- **Scalability:** Worker pool can auto-scale independently based on application demand
- **Predictability:** Memory consumption is bounded and manageable

### Negative

- **Slightly Higher Base Cost:** 3 nodes instead of potential 2-node shared pool
- **Operational Overhead:** Managing 3 separate node pools (minimal, managed by Terraform)
- **Complexity:** Requires understanding of node selectors and taints (well-documented)

## Performance Implications

- **Ingestion Latency:** Worker pool B2s provides sufficient compute for target SLA (<100ms)
- **Query Latency:** Platform pool Ingress on B2s handles expected traffic volumes (<500ms P99)
- **Recovery Time:** Auto-scaling policy enables 2–5 worker nodes to scale under demand

## Cost Optimization Notes

This strategy is only cost-optimal because:

1. **No in-cluster observability:** Application Insights eliminates Prometheus/Grafana resource overhead
2. **Controlled environment:** Hackathon/Phase 5 allows reasonable resource requests/limits
3. **Realistic workload volume:** Not production-scale, justifying B-series instances

**Future scalability:** If production demands increase:

- Upgrade worker pool to D-series (Standard_D2s_v3)
- Upgrade platform pool to B2ms for margin
- System pool remains B2ms (no further upgrade needed)

## References

- [Terraform AKS Module](../architecture/infrastructure-terraform.md#aks-module) – Module definition with node pools
- [Local Setup Guide](../development/local-setup.md) – Understanding local vs cloud environments
- [Architecture Overview](../README_ROADMAP.md#🏗️-4-architectural-decisions) – Context and justification

---

> **Summary:** Node pools are separated by criticality and resource predictability. Critical infrastructure gets stronger SKUs; controlled workloads get cost-optimized resources. The strategy is realistic, defensible, and enables effective scaling.
