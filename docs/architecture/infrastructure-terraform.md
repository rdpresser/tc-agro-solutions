# Infrastructure as Code with Terraform

## Overview

TC Agro Solutions uses Terraform to provision and manage Azure infrastructure in a modular, maintainable way.

---

## Environment Strategy

| Environment | Tool | Purpose |
|-------------|------|---------|
| **Local (Development)** | Docker Compose | Cost-free local development, no Azure resources |
| **Cloud (Production)** | Terraform + Azure | Live production environment with full Azure services |

**Key Decision:** No multi-environment Terraform setup. Development happens locally with Docker Compose, and Terraform only manages Azure (production).

## Delivery Evidence (Hackathon 8NETT)

- Capture proof of Kubernetes objects (namespaces, deployments, services) and APM telemetry (metrics, traces, logs) as part of the delivery package. Screenshots or exported dashboards should accompany the deployment notes.

---

## Terraform Structure

```
terraform/
├── providers.tf           # Azure provider configuration
├── versions.tf            # Terraform and provider versions
├── variables.tf           # Input variables
├── outputs.tf             # Outputs (connection strings, endpoints)
├── main.tf                # Root module orchestration
│
└── modules/               # Modular Azure resources
    ├── resource-group/
    │   └── main.tf
    │
    ├── aks/
    │   ├── main.tf
    │   ├── variables.tf
    │   └── outputs.tf
    │
    ├── acr/
    │   └── main.tf
    │
    ├── postgres/
    │   ├── main.tf
    │   └── outputs.tf
    │
    ├── servicebus/
    │   └── main.tf
    │
    ├── redis/
    │   └── main.tf
    │
    ├── observability/      # App Insights + Log Analytics
    │   └── main.tf
    │
    └── keyvault/
        └── main.tf
```

---

## Module Design

### Root Module (main.tf)

Orchestrates all resources by calling child modules:

```hcl
module "rg" {
  source   = "./modules/resource-group"
  name     = var.resource_group_name
  location = var.location
}

module "aks" {
  source              = "./modules/aks"
  resource_group_name = module.rg.name
  location            = var.location
  node_count          = 3
}

module "acr" {
  source              = "./modules/acr"
  resource_group_name = module.rg.name
  location            = var.location
}

module "postgres" {
  source              = "./modules/postgres"
  resource_group_name = module.rg.name
  location            = var.location
  enable_timescaledb  = true
}

module "servicebus" {
  source              = "./modules/servicebus"
  resource_group_name = module.rg.name
  location            = var.location
  sku                 = "Standard"
}

module "redis" {
  source              = "./modules/redis"
  resource_group_name = module.rg.name
  location            = var.location
  sku                 = "Standard"
}

module "observability" {
  source              = "./modules/observability"
  resource_group_name = module.rg.name
  location            = var.location
}

module "keyvault" {
  source              = "./modules/keyvault"
  resource_group_name = module.rg.name
  location            = var.location
  tenant_id           = var.tenant_id
}
```

---

## Resource Modules

### 1. Resource Group

**Location:** `modules/resource-group/main.tf`

```hcl
resource "azurerm_resource_group" "main" {
  name     = var.name
  location = var.location

  tags = {
    Project     = "TC-Agro-Solutions"
    Environment = "Production"
    ManagedBy   = "Terraform"
  }
}

output "name" {
  value = azurerm_resource_group.main.name
}

output "location" {
  value = azurerm_resource_group.main.location
}
```

---

### 2. Azure Kubernetes Service (AKS)

**Location:** `modules/aks/main.tf`

Implements **3 optimized node pools** for workload isolation (see [ADR-007: Node Pool Strategy](../adr/ADR-007-node-pool-strategy.md)):

```hcl
resource "azurerm_kubernetes_cluster" "main" {
  name                = var.cluster_name
  location            = var.location
  resource_group_name = var.resource_group_name
  dns_prefix          = var.dns_prefix
  kubernetes_version  = var.kubernetes_version

  # System pool for critical Kubernetes components
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

  # Platform pool for infrastructure components (ArgoCD, Ingress, cert-manager)
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

  # Worker pool for business domain applications
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
    network_plugin    = "azure"
    service_cidr      = var.service_cidr
    dns_service_ip    = var.dns_service_ip
    docker_bridge_cidr = var.docker_bridge_cidr
  }

  tags = {
    Project     = "TC-Agro-Solutions"
    Environment = "Production"
    ManagedBy   = "Terraform"
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
```

**Node Pool Strategy:**

| Pool | Purpose | SKU | Min | Max | Rationale |
|------|---------|-----|-----|-----|-----------|
| **system** | kube-system, CoreDNS, CNI, CSI | B2ms | 1 | 2 | Critical infra, unpredictable memory, OOMKill affects cluster |
| **platform** | ArgoCD, Ingress, cert-manager | B2s | 1 | 3 | Infrastructure services with moderate, controlled consumption |
| **worker** | .NET APIs, domain workers | B2s | 2 | 5 | Business workloads with bounded resource requests/limits |

**Pod Placement:** Applications use `nodeSelector` to target appropriate pools:
```yaml
# Platform workload (ArgoCD)
nodeSelector:
  workload: platform

# Application workload (Farm API)
nodeSelector:
  workload: application
```

See [ADR-007: Node Pool Strategy](../adr/ADR-007-node-pool-strategy.md) for full justification.

---

### 3. Azure Container Registry (ACR)

**Location:** `modules/acr/main.tf`

```hcl
resource "azurerm_container_registry" "main" {
  name                = var.registry_name
  resource_group_name = var.resource_group_name
  location            = var.location
  sku                 = "Standard"
  admin_enabled       = true
}

output "login_server" {
  value = azurerm_container_registry.main.login_server
}
```

---

### 4. PostgreSQL Flexible Server + TimescaleDB

**Location:** `modules/postgres/main.tf`

```hcl
resource "azurerm_postgresql_flexible_server" "main" {
  name                = var.server_name
  resource_group_name = var.resource_group_name
  location            = var.location
  version             = "16"
  
  administrator_login    = var.admin_username
  administrator_password = var.admin_password

  sku_name   = "B_Standard_B2s"
  storage_mb = 32768

  backup_retention_days = 7
  geo_redundant_backup_enabled = false
}

resource "azurerm_postgresql_flexible_server_database" "main" {
  name      = "agro_db"
  server_id = azurerm_postgresql_flexible_server.main.id
  charset   = "UTF8"
  collation = "en_US.utf8"
}

# Enable TimescaleDB extension
resource "azurerm_postgresql_flexible_server_configuration" "timescaledb" {
  name      = "shared_preload_libraries"
  server_id = azurerm_postgresql_flexible_server.main.id
  value     = "timescaledb"
}

output "fqdn" {
  value = azurerm_postgresql_flexible_server.main.fqdn
}

output "connection_string" {
  value     = "Host=${azurerm_postgresql_flexible_server.main.fqdn};Database=agro_db;Username=${var.admin_username};Password=${var.admin_password}"
  sensitive = true
}
```

---

### 5. Azure Service Bus

**Location:** `modules/servicebus/main.tf`

```hcl
resource "azurerm_servicebus_namespace" "main" {
  name                = var.namespace_name
  location            = var.location
  resource_group_name = var.resource_group_name
  sku                 = "Standard"
}

resource "azurerm_servicebus_topic" "sensor_readings" {
  name         = "sensor-readings"
  namespace_id = azurerm_servicebus_namespace.main.id
}

resource "azurerm_servicebus_subscription" "analytics" {
  name               = "analytics-worker"
  topic_id           = azurerm_servicebus_topic.sensor_readings.id
  max_delivery_count = 10
}

output "connection_string" {
  value     = azurerm_servicebus_namespace.main.default_primary_connection_string
  sensitive = true
}
```

---

### 6. Azure Redis Cache

**Location:** `modules/redis/main.tf`

```hcl
resource "azurerm_redis_cache" "main" {
  name                = var.cache_name
  location            = var.location
  resource_group_name = var.resource_group_name
  capacity            = 1
  family              = "C"
  sku_name            = "Standard"
  enable_non_ssl_port = false
  minimum_tls_version = "1.2"
}

output "hostname" {
  value = azurerm_redis_cache.main.hostname
}

output "connection_string" {
  value     = azurerm_redis_cache.main.primary_connection_string
  sensitive = true
}
```

---

### 7. Observability (App Insights + Log Analytics)

**Location:** `modules/observability/main.tf`

```hcl
resource "azurerm_log_analytics_workspace" "main" {
  name                = var.workspace_name
  location            = var.location
  resource_group_name = var.resource_group_name
  sku                 = "PerGB2018"
  retention_in_days   = 30
}

resource "azurerm_application_insights" "main" {
  name                = var.app_insights_name
  location            = var.location
  resource_group_name = var.resource_group_name
  workspace_id        = azurerm_log_analytics_workspace.main.id
  application_type    = "web"
}

output "instrumentation_key" {
  value     = azurerm_application_insights.main.instrumentation_key
  sensitive = true
}

output "connection_string" {
  value     = azurerm_application_insights.main.connection_string
  sensitive = true
}
```

---

### 8. Azure Key Vault

**Location:** `modules/keyvault/main.tf`

```hcl
resource "azurerm_key_vault" "main" {
  name                = var.vault_name
  location            = var.location
  resource_group_name = var.resource_group_name
  tenant_id           = var.tenant_id
  sku_name            = "standard"

  soft_delete_retention_days = 7
  purge_protection_enabled   = false

  access_policy {
    tenant_id = var.tenant_id
    object_id = var.admin_object_id

    secret_permissions = [
      "Get", "List", "Set", "Delete"
    ]
  }
}

output "vault_uri" {
  value = azurerm_key_vault.main.vault_uri
}
```

---

## Deployment Workflow

### 1. Initialize Terraform

```bash
cd terraform
terraform init
```

### 2. Validate Configuration

```bash
terraform validate
terraform fmt -recursive
```

### 3. Plan Changes

```bash
terraform plan -out=tfplan
```

### 4. Apply Infrastructure

```bash
terraform apply tfplan
```

### 5. Store Outputs

```bash
terraform output -json > outputs.json
```

---

## Best Practices

### 1. State Management
- Store Terraform state in Azure Storage Account
- Enable state locking
- Never commit `.tfstate` files to Git

### 2. Secrets Management
- Use Azure Key Vault for secrets
- Mark sensitive outputs with `sensitive = true`
- Never hardcode credentials

### 3. Resource Naming
- Use consistent naming conventions
- Include project prefix: `agro-{resource}-{suffix}`
- Example: `agro-aks-cluster`, `agro-postgres-db`

### 4. Tagging
- Tag all resources with: `Project`, `Environment`, `ManagedBy`
- Enables cost tracking and resource management

### 5. Module Reusability
- Keep modules generic where appropriate
- Use variables for configurable parameters
- Document module inputs/outputs

---

## CI/CD Integration

### GitHub Actions Workflow

```yaml
name: Terraform Deploy

on:
  push:
    branches: [main]
    paths:
      - 'terraform/**'

jobs:
  terraform:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v2
        
      - name: Terraform Init
        run: terraform init
        working-directory: terraform
        
      - name: Terraform Plan
        run: terraform plan
        working-directory: terraform
        env:
          ARM_CLIENT_ID: ${{ secrets.AZURE_CLIENT_ID }}
          ARM_CLIENT_SECRET: ${{ secrets.AZURE_CLIENT_SECRET }}
          ARM_SUBSCRIPTION_ID: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
          ARM_TENANT_ID: ${{ secrets.AZURE_TENANT_ID }}
          
      - name: Terraform Apply
        if: github.ref == 'refs/heads/main'
        run: terraform apply -auto-approve
        working-directory: terraform
```

---

## Troubleshooting

### Common Issues

1. **Provider authentication failed**
   - Verify Azure CLI is logged in: `az login`
   - Check service principal credentials

2. **Resource naming conflicts**
   - Azure resource names must be globally unique
   - Add random suffixes if needed

3. **State lock issues**
   - Release lock manually: `terraform force-unlock <lock-id>`

4. **Module not found**
   - Run `terraform init` after adding new modules

---

## References

- [Terraform Azure Provider](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs)
- [Azure Naming Conventions](https://learn.microsoft.com/azure/cloud-adoption-framework/ready/azure-best-practices/naming-and-tagging)
- [Terraform Best Practices](https://www.terraform-best-practices.com/)

---

> **Note:** This infrastructure setup is for production (Azure) only. For local development, use Docker Compose as described in [Local Setup Guide](../development/local-setup.md).
