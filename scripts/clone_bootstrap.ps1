param(
    [switch]$NoPull = $false
)

$ErrorActionPreference = "Stop"

# ===========================
# HELPER FUNCTIONS
# ===========================

function Write-Header($msg) {
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║ $msg" -ForegroundColor Cyan
    Write-Host "╚════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Step($msg) {
    Write-Host ""
    Write-Host "==> $msg" -ForegroundColor Green
}

function Write-Info($msg) {
    Write-Host "    ℹ $msg" -ForegroundColor DarkGray
}

function Write-Warning($msg) {
    Write-Host "    ⚠ $msg" -ForegroundColor Yellow
}

function Write-Success($msg) {
    Write-Host "    ✓ $msg" -ForegroundColor Green
}

function Write-Error-Custom($msg) {
    Write-Host "    ✗ $msg" -ForegroundColor Red
}

function Ensure-Command($name) {
    if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
        throw "Command '$name' not found. Please install it and try again."
    }
}

function Ensure-Dir($path) {
    if (-not (Test-Path $path)) {
        New-Item -ItemType Directory -Path $path -Force | Out-Null
        Write-Success "Directory created: $path"
    }
}

function Ask-YesNo($question) {
    $response = Read-Host "$question (y/n)"
    return $response -eq 'y'
}

function Clone-Or-Pull-Repo($repoUrl, $targetPath, $repoName) {
    if (-not (Test-Path $targetPath)) {
        Write-Step "Cloning $repoName -> $targetPath"
        
        try {
            # Test if repository is accessible
            Write-Info "Testing repository connectivity..."
            git ls-remote $repoUrl HEAD 2>&1 | Out-Null
            
            if ($LASTEXITCODE -ne 0) {
                Write-Error-Custom "Repository not accessible: $repoUrl"
                throw "Repository $repoName is not accessible or does not exist"
            }
            
            Write-Info "Repository is accessible, cloning now..."
            git clone $repoUrl $targetPath
            
            if ($LASTEXITCODE -eq 0) {
                Write-Success "$repoName cloned successfully to $targetPath"
            }
            else {
                Write-Error-Custom "Failed to clone $repoName"
                throw "Clone of $repoName failed"
            }
        }
        catch {
            Write-Error-Custom "Error cloning $repoName : $_"
            throw
        }
    }
    else {
        # Check if it's a valid git repository
        $gitPath = Join-Path $targetPath ".git"
        
        if (-not (Test-Path $gitPath)) {
            Write-Error-Custom "$repoName folder exists but is not a valid git repository (missing .git folder)"
            Write-Warning "Please delete $targetPath and run bootstrap again, or manually clone:"
            Write-Warning "  git clone $repoUrl $targetPath"
            throw "Invalid repository state for $repoName"
        }
        
        Write-Info "$repoName already exists in $targetPath"
        
        if (-not $NoPull) {
            if (Ask-YesNo "Do you want to pull (git pull origin main) for $repoName?") {
                Write-Step "Updating $repoName with pull..."
                Push-Location $targetPath
                
                try {
                    git fetch origin --prune
                    
                    # Checks which default branch (main or master)
                    $branches = git branch -r
                    $hasMain = $branches | Select-String "origin/main"
                    $defaultBranch = if ($hasMain) { "main" } else { "master" }
                    
                    git checkout $defaultBranch 2>$null | Out-Null
                    git pull origin $defaultBranch
                    
                    Write-Success "$repoName updated to $defaultBranch"
                }
                catch {
                    Write-Error-Custom "Failed to pull $repoName : $_"
                }
                finally {
                    Pop-Location
                }
            }
            else {
                Write-Info "Pull skipped for $repoName"
            }
        }
        else {
            Write-Info "Pull disabled (--NoPull)"
        }
    }
}

function Ensure-DotEnv($rootPath) {
    $envPath = Join-Path $rootPath "orchestration\apphost-compose\.env"
    
    if (-not (Test-Path $envPath)) {
        Write-Step "Creating .env file (apphost-compose)"
        
        $envContent = @"
# =====================================================
# TC Agro Solutions - Unified Environment Configuration
# =====================================================
# This file contains ALL configuration for:
#   1. Docker Compose infrastructure services (simple names)
#   2. .NET applications (hierarchical IOptions pattern)
#
# Hierarchy Format (based on appsettings.Development.json):
#   appsettings.json: "Section": { "SubSection": { "Key": "value" } }
#   Environment: Section__SubSection__Key=value
# =====================================================

# =====================================================
# CORE ENVIRONMENT
# =====================================================
ASPNETCORE_ENVIRONMENT=Development
ASPNETCORE_URLS=http://0.0.0.0:8080
BUILD_CONFIGURATION=Debug

# =====================================================
# INFRASTRUCTURE - PostgreSQL (simple names for Docker)
# =====================================================
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=tc-agro-identity-db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_SCHEMA=public
POSTGRES_MAINTENANCE_DB=postgres
POSTGRES_INIT_ARGS=-c log_statement=all -c log_duration=on

# =====================================================
# INFRASTRUCTURE - Redis (simple names for Docker)
# =====================================================
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_MAXMEMORY=256mb
REDIS_MAXMEMORY_POLICY=allkeys-lru

# =====================================================
# INFRASTRUCTURE - RabbitMQ (simple names for Docker)
# =====================================================
RABBITMQ_HOST=rabbitmq
RABBITMQ_PORT=5672
RABBITMQ_MANAGEMENT_PORT=15672
RABBITMQ_DEFAULT_USER=guest
RABBITMQ_DEFAULT_PASSWORD=guest
RABBITMQ_DEFAULT_VHOST=/
RABBITMQ_VM_MEMORY_HIGH_WATERMARK=512MB

# =====================================================
# INFRASTRUCTURE - OBSERVABILITY
# =====================================================
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=admin
GRAFANA_PORT=3000

PROMETHEUS_PORT=9090
PROMETHEUS_RETENTION=15d
PROMETHEUS_CONFIG_FILE=prometheus.yml
# To disable Identity monitoring, use this alternative config file or stop container in docker desktop to avoid duplicate scrape targets on /metrics
# PROMETHEUS_CONFIG_FILE=prometheus.no-identity.yml

LOKI_PORT=3100
TEMPO_PORT=3200
OTEL_COLLECTOR_PORT=4317
OTEL_COLLECTOR_HTTP_PORT=4318

# =====================================================
# .NET APPLICATION - DATABASE (Database.Postgres.*)
# =====================================================
# Hierarchy: Database > Postgres > Key
# Maps to appsettings.json: "Database": { "Postgres": { ... } }
Database__Postgres__Host=${POSTGRES_HOST}
Database__Postgres__Port=${POSTGRES_PORT}
Database__Postgres__Database=${POSTGRES_DB}
Database__Postgres__UserName=${POSTGRES_USER}
Database__Postgres__Password=${POSTGRES_PASSWORD}
Database__Postgres__Schema=${POSTGRES_SCHEMA}
Database__Postgres__MaintenanceDatabase=${POSTGRES_MAINTENANCE_DB}
Database__Postgres__ConnectionTimeout=30
Database__Postgres__MinPoolSize=2
Database__Postgres__MaxPoolSize=20

# .NET Connection String (built from above variables)
# This is a convenience variable, apps can build it from individual values
ConnectionStrings__DefaultConnection=Host=${POSTGRES_HOST};Port=${POSTGRES_PORT};Database=${POSTGRES_DB};Username=${POSTGRES_USER};Password=${POSTGRES_PASSWORD};Include Error Detail=true

# =====================================================
# .NET APPLICATION - CACHE (Cache.Redis.*)
# =====================================================
# Hierarchy: Cache > Redis > Key
# Maps to appsettings.json: "Cache": { "Redis": { ... } }
Cache__Redis__Host=${REDIS_HOST}
Cache__Redis__Port=${REDIS_PORT}
Cache__Redis__Password=${REDIS_PASSWORD}
Cache__Redis__DefaultTTL=300

# =====================================================
# .NET APPLICATION - MESSAGING (Messaging.RabbitMQ.*)
# =====================================================
# Hierarchy: Messaging > RabbitMQ > Key
# Maps to appsettings.json: "Messaging": { "RabbitMQ": { ... } }
Messaging__RabbitMQ__Host=${RABBITMQ_HOST}
Messaging__RabbitMQ__Port=${RABBITMQ_PORT}
Messaging__RabbitMQ__ManagementPort=${RABBITMQ_MANAGEMENT_PORT}
Messaging__RabbitMQ__VirtualHost=${RABBITMQ_DEFAULT_VHOST}
Messaging__RabbitMQ__Exchange=identity.events
Messaging__RabbitMQ__UserName=${RABBITMQ_DEFAULT_USER}
Messaging__RabbitMQ__Password=${RABBITMQ_DEFAULT_PASSWORD}
Messaging__RabbitMQ__AutoProvision=true
Messaging__RabbitMQ__Durable=true
Messaging__RabbitMQ__UseQuorumQueues=false
Messaging__RabbitMQ__AutoPurgeOnStartup=false

# =====================================================
# .NET APPLICATION - TELEMETRY (Telemetry.Grafana.*)
# =====================================================
# Hierarchy: Telemetry > Grafana > Agent/Otlp > Key
# Maps to appsettings.json: "Telemetry": { "Grafana": { ... } }
# 
# IMPORTANTE: Esta configuração é para aplicações DENTRO do Docker Compose!
# Para rodar com "dotnet run" no host, use localhost em vez de otel-collector
#
# NOTA: Endpoint vs LogsEndpoint
#   - Endpoint (sem path): OpenTelemetry SDK adiciona automaticamente /v1/traces, /v1/metrics
#   - LogsEndpoint (com /v1/logs): Serilog.Sinks.OpenTelemetry requer path completo
# =====================================================

# Simple vars (for Docker Compose readability)
TELEMETRY_GRAFANA_AGENT_HOST=otel-collector
TELEMETRY_GRAFANA_AGENT_OTLP_GRPC_PORT=4317
TELEMETRY_GRAFANA_AGENT_OTLP_HTTP_PORT=4318
TELEMETRY_GRAFANA_AGENT_METRICS_PORT=12345
TELEMETRY_GRAFANA_AGENT_ENABLED=true
# =====================================================
# ESTRATÉGIA DE ENDPOINT POR AMBIENTE
# =====================================================
# Docker Compose (este arquivo .env): Apps Docker → OTEL Collector Docker
#   - Endpoint: http://otel-collector:4318 (nome do container)
#
# k3d Cluster (configmap.yaml): Apps k3d → DaemonSet Agent → OTEL Collector Docker
#   - Endpoint: http://otel-collector-agent.observability.svc.cluster.local:4317
#   - DaemonSet encaminha para Docker via host.k3d.internal:14318
# =====================================================
TELEMETRY_GRAFANA_OTLP_ENDPOINT=http://otel-collector:4318
TELEMETRY_GRAFANA_OTLP_PROTOCOL=http/protobuf
TELEMETRY_GRAFANA_OTLP_TIMEOUT_SECONDS=10
TELEMETRY_GRAFANA_OTLP_INSECURE=true

# Hierarchical vars (for .NET IOptions binding)
Telemetry__Grafana__Agent__Host=${TELEMETRY_GRAFANA_AGENT_HOST}
Telemetry__Grafana__Agent__OtlpGrpcPort=${TELEMETRY_GRAFANA_AGENT_OTLP_GRPC_PORT}
Telemetry__Grafana__Agent__OtlpHttpPort=${TELEMETRY_GRAFANA_AGENT_OTLP_HTTP_PORT}
Telemetry__Grafana__Agent__MetricsPort=${TELEMETRY_GRAFANA_AGENT_METRICS_PORT}
Telemetry__Grafana__Agent__Enabled=${TELEMETRY_GRAFANA_AGENT_ENABLED}
Telemetry__Grafana__Otlp__Endpoint=${TELEMETRY_GRAFANA_OTLP_ENDPOINT}
Telemetry__Grafana__Otlp__Protocol=${TELEMETRY_GRAFANA_OTLP_PROTOCOL}
Telemetry__Grafana__Otlp__TimeoutSeconds=${TELEMETRY_GRAFANA_OTLP_TIMEOUT_SECONDS}
Telemetry__Grafana__Otlp__Insecure=${TELEMETRY_GRAFANA_OTLP_INSECURE}

# =====================================================
# .NET APPLICATION - SERVICES (Services.{Service}.*)
# =====================================================
# Hierarchy: Services > ServiceName > Key
# Maps to appsettings.json: "Services": { "Identity": { "HttpPort": ... } }
Services__Identity__HttpPort=5001
Services__Farm__HttpPort=5002
Services__SensorIngest__HttpPort=5003
Services__AnalyticsWorker__HttpPort=5004
Services__Dashboard__HttpPort=5005

# =====================================================
# .NET APPLICATION - JWT / AUTHENTICATION (Auth.Jwt.*)
# =====================================================
# Hierarchy: Auth > Jwt > Key
# Maps to appsettings.json: "Auth": { "Jwt": { ... } }
Auth__Jwt__Issuer=http://localhost:5001
Auth__Jwt__Audience=http://localhost:5000
Auth__Jwt__SecretKey=your-256-bit-secret-key-change-in-production-12345678901234567890
Auth__Jwt__ExpirationInMinutes=480

# =====================================================
# .NET APPLICATION - LOGGING (Logging.LogLevel.*)
# =====================================================
# Hierarchy: Logging > LogLevel > Key
# Maps to appsettings.json: "Logging": { "LogLevel": { ... } }
# Note: Keys with dots are preserved in the name (e.g., Microsoft.AspNetCore)
Logging__LogLevel__Default=Information
Logging__LogLevel__Microsoft_AspNetCore=Warning
Logging__LogLevel__System=Warning

# =====================================================
# .NET APPLICATION - TELEMETRY (Telemetry.Grafana.*)
# =====================================================
# See section above for Telemetry__Grafana__* variables
# (defined above in "TELEMETRY (Telemetry.Grafana.*)" section)
"@
        
        $envDir = Split-Path -Parent $envPath
        if (-not (Test-Path $envDir)) {
            New-Item -ItemType Directory -Path $envDir -Force | Out-Null
        }

        Set-Content -Path $envPath -Value $envContent -Encoding UTF8
        Write-Success ".env created: $envPath"
    }
    else {
        Write-Warning ".env already exists at $envPath - skipping generation"
    }
}

# ===========================
# MAIN EXECUTION
# ===========================

Write-Header "TC Agro Solutions - Bootstrap"

# Resolve path to project root (one level above scripts/)
$rootPath = Resolve-Path (Join-Path $PSScriptRoot "..")

Write-Info "Project root: $rootPath"

# ===========================
# Validate Prerequisites
# ===========================
Write-Step "Validating prerequisites"

Ensure-Command "git"
Write-Success "Git found"

Ensure-Command "docker"
Write-Success "Docker found"

# Test internet connectivity
Write-Step "Testing internet connectivity..."
try {
    $testUrl = "https://github.com"
    $null = Invoke-WebRequest -Uri $testUrl -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
    Write-Success "Internet connectivity verified"
}
catch {
    Write-Warning "Could not verify internet connectivity. Make sure you have a working internet connection."
}

# ===========================
# Create Directories
# ===========================
Write-Step "Preparing folder structure"

Ensure-Dir (Join-Path $rootPath "services")
# Note: 'common' folder will be created by git clone

# ===========================
# Create .env
# ===========================
Ensure-DotEnv $rootPath

# ===========================
# Clone/Update Repositories
# ===========================
Write-Step "Cloning/updating service repositories"

$repos = @(
    @{
        name = "identity-service"
        url  = "https://github.com/rdpresser/tc-agro-identity-service.git"
        path = "services/identity-service"
    },
    @{
        name = "farm-service"
        url  = "https://github.com/rdpresser/tc-agro-farm-service.git"
        path = "services/farm-service"
    },
    @{
        name = "sensor-ingest-service"
        url  = "https://github.com/rdpresser/tc-agro-sensor-ingest-service.git"
        path = "services/sensor-ingest-service"
    },
    @{
        name = "analytics-worker"
        url  = "https://github.com/rdpresser/tc-agro-analytics-worker.git"
        path = "services/analytics-worker"
    },
    @{
        name = "dashboard-service"
        url  = "https://github.com/rdpresser/tc-agro-dashboard-service.git"
        path = "services/dashboard-service"
    }
)

foreach ($repo in $repos) {
    $fullPath = Join-Path $rootPath $repo.path
    Clone-Or-Pull-Repo $repo.url $fullPath $repo.name
}

# ===========================
# Clone/Update Common
# ===========================
Write-Step "Cloning/updating common repository"

$commonRepo = @{
    name = "common"
    url  = "https://github.com/rdpresser/tc-agro-common.git"
    path = "common"
}

$commonFullPath = Join-Path $rootPath $commonRepo.path
Clone-Or-Pull-Repo $commonRepo.url $commonFullPath $commonRepo.name

# ===========================
# Final Summary
# ===========================
Write-Header "Bootstrap Complete"

Write-Info "Structure created:"
Write-Info "  ✓ services/"
Write-Info "    - identity-service/"
Write-Info "    - farm-service/"
Write-Info "    - sensor-ingest-service/"
Write-Info "    - analytics-worker/"
Write-Info "    - dashboard-service/"
Write-Info "  ✓ common/"
Write-Info "  ✓ .env (local configuration)"

# Verify folder structure
Write-Step "Verifying cloned repositories..."

$expectedFolders = @(
    "services/identity-service",
    "services/farm-service",
    "services/sensor-ingest-service",
    "services/analytics-worker",
    "services/dashboard-service",
    "common"
)

$allSuccess = $true
foreach ($folder in $expectedFolders) {
    $fullPath = Join-Path $rootPath $folder
    if (Test-Path $fullPath) {
        Write-Success "✓ $folder exists"
    }
    else {
        Write-Error-Custom "✗ $folder NOT FOUND"
        $allSuccess = $false
    }
}

if (-not $allSuccess) {
    Write-Warning "Some repositories are missing. Please check the errors above."
    exit 1
}

Write-Info ""
Write-Info "Next steps:"
Write-Info "  1. Open tc-agro-solutions.sln in Visual Studio 2026"
Write-Info "  2. Add service projects to solution"
Write-Info "  3. Create docker-compose.yml with services"
Write-Info "  4. Run: docker compose up -d"

Write-Host ""
Write-Host "✅ Environment ready for development!" -ForegroundColor Green
Write-Host ""
