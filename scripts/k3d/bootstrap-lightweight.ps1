[CmdletBinding()]
param(
    [switch]$Help
)

$ErrorActionPreference = "Stop"

if ($Help) {
    Write-Host "Usage: pwsh ./scripts/k3d/bootstrap-lightweight.ps1"
    Write-Host "Creates lightweight local stack (compose infra + k3d + local image deployments)."
    exit 0
}

$scriptPath = $MyInvocation.MyCommand.Path
if (-not $scriptPath) {
    Write-Error "Unable to resolve script path."
    exit 1
}

$scriptDir = Split-Path -Parent $scriptPath
$rootPath = (Resolve-Path (Join-Path $scriptDir ".." "..")).Path

$clusterName = "dev"
$clusterMemory = "6g"
$composeNetwork = "tc-agro-network"
$composeDir = Join-Path $rootPath "orchestration" "apphost-compose"
$k8sAppsBase = Join-Path $rootPath "infrastructure" "kubernetes" "apps" "base"
$lightweightCompose = Join-Path $scriptDir "docker-compose-lightweight.yml"

$imageMap = @{
    "identity-service" = "tc-agro-identity-service:dev-local"
    "farm-service" = "tc-agro-farm-service:dev-local"
    "sensor-ingest-service" = "tc-agro-sensor-ingest-service:dev-local"
    "analytics-worker" = "tc-agro-analytics-worker:dev-local"
    "frontend" = "tc-agro-frontend-service:dev-local"
}

$Color = @{
    Error = "Red"
    Success = "Green"
    Warning = "Yellow"
    Info = "Cyan"
    Muted = "Gray"
}

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "=== $Message ===" -ForegroundColor $Color.Info
}

function Write-Ok {
    param([string]$Message)
    Write-Host $Message -ForegroundColor $Color.Success
}

function Write-WarnLine {
    param([string]$Message)
    Write-Host $Message -ForegroundColor $Color.Warning
}

function Write-ErrLine {
    param([string]$Message)
    Write-Host $Message -ForegroundColor $Color.Error
}

function Write-InfoLine {
    param([string]$Message)
    Write-Host $Message -ForegroundColor $Color.Muted
}

function Stop-Script {
    param(
        [string]$Message,
        [int]$Code = 1
    )

    Write-ErrLine $Message
    exit $Code
}

function Assert-Command {
    param([string]$CommandName)

    if (-not (Get-Command $CommandName -ErrorAction SilentlyContinue)) {
        Stop-Script "Missing command: $CommandName"
    }
}

function Invoke-Checked {
    param(
        [scriptblock]$Action,
        [string]$ErrorMessage
    )

    & $Action
    if ($LASTEXITCODE -ne 0) {
        Stop-Script $ErrorMessage $LASTEXITCODE
    }
}

function Wait-Until {
    param(
        [scriptblock]$Check,
        [int]$Attempts,
        [int]$DelaySeconds,
        [string]$Success,
        [string]$Failure
    )

    for ($i = 1; $i -le $Attempts; $i++) {
        & $Check
        if ($LASTEXITCODE -eq 0) {
            Write-Ok $Success
            return
        }

        Start-Sleep -Seconds $DelaySeconds
    }

    Stop-Script $Failure
}

Write-Step "Checking prerequisites"
foreach ($cmd in @("k3d", "kubectl", "docker")) {
    Assert-Command -CommandName $cmd
}

$missingImages = New-Object System.Collections.Generic.List[string]
foreach ($image in $imageMap.Values) {
    & docker image inspect $image *> $null
    if ($LASTEXITCODE -ne 0) {
        $missingImages.Add($image)
    }
}

if ($missingImages.Count -gt 0) {
    Write-ErrLine "Missing local Docker images (build them first):"
    foreach ($img in $missingImages) {
        Write-ErrLine "  - $img"
    }
    Write-Host ""
    Write-InfoLine "Build with: docker compose -f orchestration/apphost-compose/docker-compose.yml build"
    exit 1
}

Write-Ok "All prerequisites found (including local images)"

Write-Step "Cleaning up existing resources"
$clusterList = & k3d cluster list 2>$null
if ($clusterList -match "^$clusterName\s") {
    Write-WarnLine "Deleting existing k3d cluster '$clusterName'..."
    & k3d cluster delete $clusterName *> $null
    Start-Sleep -Seconds 2
}
Write-Ok "Clean slate"

Write-Step "Starting minimal infrastructure (Postgres + Redis + RabbitMQ)"

$composeContent = @"
name: tc-agro-local

services:
  postgres:
    image: timescale/timescaledb:latest-pg17
    container_name: tc-agro-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: postgres
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      PGDATA: /var/lib/postgresql/data/pgdata
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d postgres"]
      interval: 10s
      timeout: 5s
      retries: 15
      start_period: 40s
    networks:
      - agro-net

  redis:
    image: redis:8.4.0-alpine
    container_name: tc-agro-redis
    restart: unless-stopped
    command: >
      redis-server
      --appendonly yes
      --save 60 1000
      --loglevel warning
      --maxmemory 128mb
      --maxmemory-policy allkeys-lru
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 15
      start_period: 15s
    networks:
      - agro-net

  rabbitmq:
    image: rabbitmq:4.2.3-management-alpine
    container_name: tc-agro-rabbitmq
    restart: unless-stopped
    hostname: tc-agro-rabbitmq
    environment:
      RABBITMQ_DEFAULT_USER: guest
      RABBITMQ_DEFAULT_PASS: guest
      RABBITMQ_DEFAULT_VHOST: /
    ports:
      - "5672:5672"
      - "15672:15672"
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq
    healthcheck:
      test: ["CMD-SHELL", "rabbitmq-diagnostics -q ping"]
      interval: 10s
      timeout: 10s
      retries: 20
      start_period: 60s
    networks:
      - agro-net

networks:
  agro-net:
    name: tc-agro-network
    driver: bridge

volumes:
  postgres_data:
  redis_data:
  rabbitmq_data:
"@

Set-Content -LiteralPath $lightweightCompose -Value $composeContent -Encoding utf8

Invoke-Checked -Action { & docker compose -f $lightweightCompose up -d } -ErrorMessage "Failed to start lightweight compose infrastructure"
Write-Ok "Infrastructure started"

Write-InfoLine "Waiting for Postgres to be healthy..."
Wait-Until -Attempts 30 -DelaySeconds 2 -Success "Postgres is ready" -Failure "Postgres did not become ready in time" -Check {
    & docker exec tc-agro-postgres pg_isready -U postgres *> $null
}

Write-InfoLine "Waiting for Redis to be healthy..."
Wait-Until -Attempts 15 -DelaySeconds 2 -Success "Redis is ready" -Failure "Redis did not become ready in time" -Check {
    $redisPing = & docker exec tc-agro-redis redis-cli ping 2>$null
    if ($redisPing -match "PONG") { $global:LASTEXITCODE = 0 } else { $global:LASTEXITCODE = 1 }
}

Write-InfoLine "Waiting for RabbitMQ to be healthy..."
Wait-Until -Attempts 30 -DelaySeconds 3 -Success "RabbitMQ is ready" -Failure "RabbitMQ did not become ready in time" -Check {
    & docker exec tc-agro-rabbitmq rabbitmq-diagnostics -q ping *> $null
}

Write-Step "Creating k3d cluster (single node, $clusterMemory RAM)"

$apiPort = 6443
foreach ($port in @(6443, 6444, 6445, 6446)) {
    & ss -ltn "( sport = :$port )" *> $null
    if ($LASTEXITCODE -ne 0) {
        $apiPort = $port
        break
    }
}
Write-InfoLine "Using API port: $apiPort"

Invoke-Checked -ErrorMessage "Failed to create k3d cluster" -Action {
    & k3d cluster create $clusterName `
        --servers 1 `
        --agents 0 `
        --api-port $apiPort `
        --port "80:80@loadbalancer" `
        --port "443:443@loadbalancer" `
        --servers-memory $clusterMemory `
        --network $composeNetwork `
        --k3s-arg "--disable=metrics-server@server:0"
}

& kubectl config use-context "k3d-$clusterName" *> $null
Write-Ok "k3d cluster created (single node, $clusterMemory)"

Write-Step "Waiting for Kubernetes API"
Wait-Until -Attempts 30 -DelaySeconds 3 -Success "Kubernetes API accessible" -Failure "Kubernetes API not ready in time" -Check {
    & kubectl cluster-info *> $null
}

Invoke-Checked -ErrorMessage "Node did not become ready" -Action {
    & kubectl wait --for=condition=Ready node --all --timeout=120s *> $null
}
Write-Ok "Node is Ready"

Write-InfoLine "Waiting for Traefik CRDs..."
Wait-Until -Attempts 30 -DelaySeconds 2 -Success "Traefik CRDs ready" -Failure "Traefik CRDs not found" -Check {
    & kubectl get crd ingressroutes.traefik.io *> $null
}

Write-Step "Importing local Docker images into k3d"
$imagesToImport = @($imageMap.Values)
Invoke-Checked -ErrorMessage "Failed to import local images into k3d" -Action {
    & k3d image import @imagesToImport -c $clusterName
}
Write-Ok "All images imported"

Write-Step "Creating namespace and secrets"

Invoke-Checked -ErrorMessage "Failed to ensure namespace agro-apps" -Action {
    & kubectl create namespace agro-apps --dry-run=client -o yaml | kubectl apply -f - *> $null
}

& kubectl delete secret agro-secrets -n agro-apps --ignore-not-found=true *> $null

$envFile = Join-Path $composeDir ".env.k3d"
if (-not (Test-Path -LiteralPath $envFile)) {
    $envFile = Join-Path $composeDir ".env.k3d.example"
    Write-WarnLine "No .env.k3d found, using .env.k3d.example defaults"
}

$secretArgs = New-Object System.Collections.Generic.List[string]
Get-Content -LiteralPath $envFile | ForEach-Object {
    if ([string]::IsNullOrWhiteSpace($_)) { return }
    if ($_.TrimStart().StartsWith("#")) { return }

    if ($_ -match "^([^=]+)=(.*)$") {
        $key = $Matches[1]
        $value = $Matches[2]
        $secretArgs.Add("--from-literal=$key=$value")
    }
}

Invoke-Checked -ErrorMessage "Failed to create agro-secrets" -Action {
    & kubectl create secret generic agro-secrets -n agro-apps @secretArgs *> $null
}
Write-Ok "Namespace 'agro-apps' and secret 'agro-secrets' created"

Write-Step "Applying ConfigMaps"
foreach ($service in @("identity", "farm", "sensor-ingest", "analytics-worker", "frontend")) {
    $configMap = Join-Path $k8sAppsBase $service "configmap.yaml"
    if (Test-Path -LiteralPath $configMap) {
        & kubectl apply -f $configMap *> $null
        Write-InfoLine "  Applied: $service configmap"
    }
}
Write-Ok "All ConfigMaps applied"

Write-Step "Applying Services"
foreach ($service in @("identity", "farm", "sensor-ingest", "analytics-worker", "frontend")) {
    $svcFile = Join-Path $k8sAppsBase $service "service.yaml"
    if (Test-Path -LiteralPath $svcFile) {
        & kubectl apply -f $svcFile *> $null
        Write-InfoLine "  Applied: $service service"
    }
}
Write-Ok "All Services applied"

Write-Step "Applying IngressRoutes"
foreach ($service in @("identity", "farm", "sensor-ingest", "analytics-worker", "frontend")) {
    $ingressFile = Join-Path $k8sAppsBase $service "ingressroute.yaml"
    if (Test-Path -LiteralPath $ingressFile) {
        (Get-Content -LiteralPath $ingressFile -Raw).Replace("traefik.containo.us/v1alpha1", "traefik.io/v1alpha1") |
            kubectl apply -f - *> $null
        Write-InfoLine "  Applied: $service ingressroute"
    }
}
Write-Ok "All IngressRoutes applied"

Write-Step "Deploying services (local images, lightweight resources, 1 replica)"
foreach ($service in @("identity", "farm", "sensor-ingest", "analytics-worker", "frontend")) {
    $deploymentFile = Join-Path $k8sAppsBase $service "deployment.yaml"
    if (Test-Path -LiteralPath $deploymentFile) {
        & kubectl apply -f $deploymentFile *> $null
        Write-InfoLine "  Applied: $service deployment"
    }
}

foreach ($deploy in $imageMap.Keys) {
    $image = $imageMap[$deploy]
    & kubectl set image "deployment/$deploy" "$deploy=$image" -n agro-apps *> $null
    & kubectl patch deployment $deploy -n agro-apps --type=json -p "[{\"op\":\"replace\",\"path\":\"/spec/template/spec/containers/0/imagePullPolicy\",\"value\":\"Never\"}]" *> $null
    Write-InfoLine "  Image: $deploy -> $image (local)"
}

foreach ($deploy in @("identity-service", "farm-service", "sensor-ingest-service", "analytics-worker")) {
    & kubectl patch deployment $deploy -n agro-apps --type=json -p '[{"op":"replace","path":"/spec/replicas","value":1},{"op":"replace","path":"/spec/template/spec/containers/0/resources/requests/memory","value":"128Mi"},{"op":"replace","path":"/spec/template/spec/containers/0/resources/requests/cpu","value":"50m"},{"op":"replace","path":"/spec/template/spec/containers/0/resources/limits/memory","value":"384Mi"},{"op":"replace","path":"/spec/template/spec/containers/0/resources/limits/cpu","value":"300m"}]' *> $null
    Write-InfoLine "  Patched: $deploy (128Mi/384Mi, 1 replica)"
}

& kubectl patch deployment frontend -n agro-apps --type=json -p '[{"op":"replace","path":"/spec/replicas","value":1}]' *> $null
Write-InfoLine "  Patched: frontend (1 replica)"
Write-Ok "All deployments applied"

Write-Step "Waiting for pods to be ready..."
$deployments = @("identity-service", "farm-service", "sensor-ingest-service", "analytics-worker", "frontend")
$allReady = $true

foreach ($deploy in $deployments) {
    Write-InfoLine "  Waiting for $deploy..."
    & kubectl rollout status "deployment/$deploy" -n agro-apps --timeout=180s *> $null
    if ($LASTEXITCODE -ne 0) {
        Write-WarnLine "  $deploy not ready yet"
        $allReady = $false
    }
}

if ($allReady) {
    Write-Ok "All pods ready!"
}
else {
    Write-WarnLine "Some pods may still be starting. Check: kubectl get pods -n agro-apps"
}

Write-Host ""
Write-Host "============================================" -ForegroundColor $Color.Success
Write-Host "  LIGHTWEIGHT K3D BOOTSTRAP COMPLETE" -ForegroundColor $Color.Success
Write-Host "============================================" -ForegroundColor $Color.Success
Write-Host ""
Write-Host "CLUSTER:" -ForegroundColor $Color.Info
Write-Host "  Name:   $clusterName (single node, $clusterMemory limit)"
Write-Host ""
Write-Host "INFRASTRUCTURE (Docker Compose):" -ForegroundColor $Color.Info
Write-Host "  Postgres:  localhost:5432"
Write-Host "  Redis:     localhost:6379"
Write-Host "  RabbitMQ:  localhost:5672 (UI: localhost:15672)"
Write-Host ""
Write-Host "SERVICES (k3d via Traefik @ localhost:80):" -ForegroundColor $Color.Info
Write-Host "  Frontend:       http://localhost/agro"
Write-Host "  Identity API:   http://localhost/identity"
Write-Host "  Farm API:       http://localhost/farm"
Write-Host "  Sensor Ingest:  http://localhost/sensor-ingest"
Write-Host "  Analytics:      http://localhost/analytics-worker"
Write-Host ""
Write-Host "DISABLED (to save RAM):" -ForegroundColor $Color.Info
Write-Host "  ArgoCD, Grafana, Prometheus, Loki, Tempo, OTEL, HPA, pgAdmin"
Write-Host ""
Write-Host "USEFUL COMMANDS:" -ForegroundColor $Color.Info
Write-Host "  kubectl get pods -n agro-apps"
Write-Host "  kubectl logs -f deploy/identity-service -n agro-apps"
Write-Host "  docker compose -f scripts/k3d/docker-compose-lightweight.yml down"
Write-Host "  k3d cluster delete dev"
Write-Host ""
Write-Host "CURRENT POD STATUS:" -ForegroundColor $Color.Info
& kubectl get pods -n agro-apps -o wide 2>$null
Write-Host ""
