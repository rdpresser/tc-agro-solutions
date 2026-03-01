# AKS Terraform Node Pools Configuration Reference

**Purpose:** Reference for future Azure AKS deployment via Terraform — architecture designed during Phase 5, **not yet deployed**  
**Decision Source:** [ADR-007: AKS Node Pool Strategy](../../docs/adr/ADR-007-node-pool-strategy.md)

> ⚠️ **Status:** This Terraform configuration was designed but not applied. The delivered system runs on **k3d (local)** — see [kubernetes/](../kubernetes/) for active manifests. Azure migration is planned for post-hackathon.

---

## Complete AKS Module with 3 Node Pools

```hcl
# File: terraform/modules/aks/main.tf

resource "azurerm_kubernetes_cluster" "main" {
  name                = var.cluster_name
  location            = var.location
  resource_group_name = var.resource_group_name
  dns_prefix          = var.dns_prefix
  kubernetes_version  = var.kubernetes_version

  # ============================================
  # SYSTEM POOL (Critical Kubernetes Components)
  # ============================================
  default_node_pool {
    name                = "system"
    node_count          = 1
    vm_size             = "Standard_B2ms"  # 2 vCPU, 8 GB RAM
    enable_auto_scaling = true
    min_count           = 1
    max_count           = 2
    os_disk_size_gb     = 30
    
    node_labels = {
      workload = "system"
    }
    
    node_taints = [
      {
        key    = "CriticalAddonsOnly"
        value  = "true"
        effect = "NoSchedule"
      }
    ]
  }

  # =============================================
  # PLATFORM POOL (Infrastructure & Operations)
  # =============================================
  node_pool {
    name                = "platform"
    node_count          = 1
    vm_size             = "Standard_B2s"   # 2 vCPU, 4 GB RAM
    enable_auto_scaling = true
    min_count           = 1
    max_count           = 3
    os_disk_size_gb     = 30
    
    node_labels = {
      workload = "platform"
    }
  }

  # ============================================
  # WORKER POOL (Business Application Workloads)
  # ============================================
  node_pool {
    name                = "worker"
    node_count          = 2
    vm_size             = "Standard_B2s"   # 2 vCPU, 4 GB RAM
    enable_auto_scaling = true
    min_count           = 2
    max_count           = 5
    os_disk_size_gb     = 50
    
    node_labels = {
      workload = "application"
    }
  }

  identity {
    type = "SystemAssigned"
  }

  network_profile {
    network_plugin      = "azure"
    service_cidr        = var.service_cidr
    dns_service_ip      = var.dns_service_ip
    docker_bridge_cidr  = var.docker_bridge_cidr
  }

  tags = {
    Project     = "TC-Agro-Solutions"
    Environment = "Production"
    ManagedBy   = "Terraform"
    Phase       = "Phase-5"
  }
}

output "kube_config" {
  value     = azurerm_kubernetes_cluster.main.kube_config_raw
  sensitive = true
}

output "cluster_name" {
  value = azurerm_kubernetes_cluster.main.name
}

output "cluster_fqdn" {
  value = azurerm_kubernetes_cluster.main.fqdn
}

output "system_pool_id" {
  value = azurerm_kubernetes_cluster.main.default_node_pool[0].id
}
```

---

## Pod Deployment Examples

### Example 1: Deploy to Platform Pool (ArgoCD)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: argocd-server
  namespace: argocd
spec:
  replicas: 2
  selector:
    matchLabels:
      app: argocd-server
  template:
    metadata:
      labels:
        app: argocd-server
    spec:
      # TARGET: Platform Pool
      nodeSelector:
        workload: platform
      
      containers:
      - name: argocd
        image: quay.io/argoproj/argocd:latest
        ports:
        - containerPort: 8080
        
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

### Example 2: Deploy to Worker Pool (Application)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: farm-api
  namespace: agro
spec:
  replicas: 2
  selector:
    matchLabels:
      app: farm-api
  template:
    metadata:
      labels:
        app: farm-api
    spec:
      # TARGET: Worker Pool
      nodeSelector:
        workload: application
      
      containers:
      - name: farm-api
        image: acrname.azurecr.io/agro-farm-api:latest
        ports:
        - containerPort: 80
        
        env:
        - name: ASPNETCORE_ENVIRONMENT
          value: "Production"
        
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        
        livenessProbe:
          httpGet:
            path: /health/live
            port: 80
          initialDelaySeconds: 30
          periodSeconds: 10
        
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 80
          initialDelaySeconds: 10
          periodSeconds: 5
```

### Example 3: HPA for Auto-Scaling (Worker Pool)

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: farm-api-hpa
  namespace: agro
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: farm-api
  
  minReplicas: 2
  maxReplicas: 10
  
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

---

## Validation Checklist

Before deploying AKS with these node pools:

### Terraform Configuration (pre-deployment checklist — future work)
- [ ] `cluster_name` variable is set (e.g., "agro-aks-cluster")
- [ ] `resource_group_name` points to existing Azure Resource Group
- [ ] `location` is set (e.g., "eastus")
- [ ] Network variables are defined:
  - `service_cidr` (e.g., "10.0.0.0/16")
  - `dns_service_ip` (e.g., "10.0.0.10")
  - `docker_bridge_cidr` (e.g., "172.17.0.1/16")

### Pod Deployment
- [ ] All pods targeting worker pool have `nodeSelector: workload: application`
- [ ] All infrastructure pods (ArgoCD, Ingress) have `nodeSelector: workload: platform`
- [ ] Pod resource requests and limits are defined
- [ ] Liveness and readiness probes are configured

### Auto-Scaling
- [ ] Worker pool HPA is configured (min 2, max 5 initial replicas)
- [ ] Platform pool can scale up to 3 if needed
- [ ] System pool defaults to 1 node (max 2 for redundancy)

### Cost Monitoring
- [ ] Azure Cost Management alerts configured
- [ ] Expected monthly cost tracked: $200–300 USD
- [ ] Scaling behavior monitored for first week post-deployment

---

## Performance Targets (SLA)

Based on 3-node-pool strategy:

| Metric | Target | Pool Dependency |
|--------|--------|-----------------|
| API Ingestion Latency (P99) | < 100ms | Worker + Database |
| Dashboard Query Latency (P99) | < 500ms | Worker + Database + Cache |
| System Pool CPU Usage | < 60% | System pool stability |
| Worker Pod OOMKill Rate | < 0.1% | Proper request/limits |
| Cluster Node Health | > 99.5% | System pool redundancy |

---

## Cost Analysis

### Estimated Monthly Cost Breakdown

| Component | Type | Cost |
|-----------|------|------|
| System Node (B2ms × 1) | Compute | ~$50 |
| Platform Node (B2s × 1) | Compute | ~$35 |
| Worker Nodes (B2s × 2–5) | Compute | ~$70–175 |
| Storage (managed disks) | Managed | ~$20 |
| **Subtotal (Compute)** | | **~$175–280** |
| | | |
| PostgreSQL Flexible Server | Managed | ~$150 |
| Redis Cache | Managed | ~$30 |
| Service Bus | Messaging | ~$15 |
| Application Insights | Observability | ~$5–20 |
| **TOTAL (Estimated)** | | **~$375–575** |

**Notes:**
- B-series instances provide burst capability for spikes
- Actual cost depends on:
  - Data egress from Azure (usually < $1)
  - Application Insights ingestion volume
  - Auto-scaling behavior under load
  - Regional differences in Azure pricing

---

## Upgrading Node Pool SKUs (Future)

If performance requirements increase post-Hackathon:

```hcl
# Upgrade system pool to larger instance
vm_size = "Standard_D2s_v3"  # 2 vCPU, 8 GB (same memory, better CPU)

# Upgrade platform pool for margin
vm_size = "Standard_B2ms"    # 2 vCPU, 8 GB

# Upgrade worker pool for production workloads
vm_size = "Standard_D4s_v3"  # 4 vCPU, 16 GB
```

No architectural changes needed; just update `vm_size` in Terraform and re-apply.

---

## References

- [Azure VM Pricing](https://azure.microsoft.com/en-us/pricing/details/virtual-machines/windows/)
- [AKS Best Practices](https://docs.microsoft.com/en-us/azure/aks/operator-best-practices-cluster-security)
- [Kubernetes Resource Requests and Limits](https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/)
- [ADR-007: AKS Node Pool Strategy](../../docs/adr/ADR-007-node-pool-strategy.md)

---

> **Last Updated:** January 9, 2026  
> **Architecture:** Designed during Phase 5 (Hackathon 8NETT) — ready to apply post-hackathon  
> **Delivery status:** k3d local cluster delivered ✅ | Azure deployment planned 📋
