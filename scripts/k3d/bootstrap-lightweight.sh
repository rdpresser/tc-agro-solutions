#!/usr/bin/env bash
# =====================================================
# TC Agro Solutions - Lightweight k3d Bootstrap
# =====================================================
# Optimized for 16GB RAM Macs (Apple Silicon / ARM64)
#
# What this does:
#   - Starts ONLY essential infra (Postgres, Redis, RabbitMQ) via Docker Compose
#   - Creates k3d single-node cluster (6GB) - NO separate agents
#   - Imports local Docker images (arm64) into k3d
#   - Deploys all 5 services + frontend directly (NO ArgoCD)
#   - NO observability stack (no Grafana/Prometheus/Loki/Tempo/OTEL)
#   - NO HPA (1 replica each)
#
# RAM usage (~1.8GB total):
#   k3d single node: ~1.5GB actual (6GB limit)
#   Postgres:         ~250MB
#   Redis:            ~11MB
#   RabbitMQ:         ~110MB
#
# Prerequisites:
#   - Local images must be built first (docker compose build or dev-local tags)
#   - k3d, kubectl, docker installed
#
# Usage:
#   chmod +x scripts/k3d/bootstrap-lightweight.sh
#   ./scripts/k3d/bootstrap-lightweight.sh
# =====================================================

set -euo pipefail

CLUSTER_NAME="dev"
CLUSTER_MEMORY="6g"
COMPOSE_NETWORK="tc-agro-network"
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
COMPOSE_DIR="$REPO_ROOT/orchestration/apphost-compose"
K8S_APPS_BASE="$REPO_ROOT/infrastructure/kubernetes/apps/base"

# Image mapping: deployment name -> local docker image
declare -A IMAGE_MAP=(
  ["identity-service"]="tc-agro-identity-service:dev-local"
  ["farm-service"]="tc-agro-farm-service:dev-local"
  ["sensor-ingest-service"]="tc-agro-sensor-ingest-service:dev-local"
  ["analytics-worker"]="tc-agro-analytics-worker:dev-local"
  ["frontend"]="tc-agro-frontend-service:dev-local"
)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
GRAY='\033[0;37m'
NC='\033[0m'

step() { echo -e "\n${CYAN}=== $1 ===${NC}"; }
ok()   { echo -e "${GREEN}$1${NC}"; }
warn() { echo -e "${YELLOW}$1${NC}"; }
err()  { echo -e "${RED}$1${NC}"; }
info() { echo -e "${GRAY}$1${NC}"; }

# =====================================================
# Prerequisites
# =====================================================
step "Checking prerequisites"
for cmd in k3d kubectl docker; do
  if ! command -v "$cmd" &>/dev/null; then
    err "Missing: $cmd"
    exit 1
  fi
done

# Check local images exist
MISSING_IMAGES=()
for deploy in "${!IMAGE_MAP[@]}"; do
  img="${IMAGE_MAP[$deploy]}"
  if ! docker image inspect "$img" &>/dev/null; then
    MISSING_IMAGES+=("$img")
  fi
done

if [ ${#MISSING_IMAGES[@]} -gt 0 ]; then
  err "Missing local Docker images (build them first):"
  for img in "${MISSING_IMAGES[@]}"; do
    err "  - $img"
  done
  echo ""
  info "Build with: docker compose -f orchestration/apphost-compose/docker-compose.yml build"
  exit 1
fi

ok "All prerequisites found (including local images)"

# =====================================================
# Cleanup existing
# =====================================================
step "Cleaning up existing resources"

if k3d cluster list 2>/dev/null | grep -q "^$CLUSTER_NAME "; then
  warn "Deleting existing k3d cluster '$CLUSTER_NAME'..."
  k3d cluster delete "$CLUSTER_NAME" 2>/dev/null || true
  sleep 2
fi
ok "Clean slate"

# =====================================================
# Start minimal Docker Compose (infra only)
# =====================================================
step "Starting minimal infrastructure (Postgres + Redis + RabbitMQ)"

LIGHTWEIGHT_COMPOSE="$REPO_ROOT/scripts/k3d/docker-compose-lightweight.yml"

cat > "$LIGHTWEIGHT_COMPOSE" <<'COMPOSE_EOF'
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
COMPOSE_EOF

docker compose -f "$LIGHTWEIGHT_COMPOSE" up -d
ok "Infrastructure started"

# Wait for health checks
info "Waiting for Postgres to be healthy..."
for i in $(seq 1 30); do
  if docker exec tc-agro-postgres pg_isready -U postgres &>/dev/null; then
    ok "Postgres is ready"
    break
  fi
  sleep 2
done

info "Waiting for Redis to be healthy..."
for i in $(seq 1 15); do
  if docker exec tc-agro-redis redis-cli ping 2>/dev/null | grep -q PONG; then
    ok "Redis is ready"
    break
  fi
  sleep 2
done

info "Waiting for RabbitMQ to be healthy..."
for i in $(seq 1 30); do
  if docker exec tc-agro-rabbitmq rabbitmq-diagnostics -q ping &>/dev/null; then
    ok "RabbitMQ is ready"
    break
  fi
  sleep 3
done

# =====================================================
# Create k3d cluster (single node, lightweight)
# =====================================================
step "Creating k3d cluster (single node, ${CLUSTER_MEMORY} RAM)"

# Find available API port
API_PORT=6443
for port in 6443 6444 6445 6446; do
  if ! lsof -i ":$port" &>/dev/null; then
    API_PORT=$port
    break
  fi
done
info "Using API port: $API_PORT"

k3d cluster create "$CLUSTER_NAME" \
  --servers 1 \
  --agents 0 \
  --api-port "$API_PORT" \
  --port "80:80@loadbalancer" \
  --port "443:443@loadbalancer" \
  --servers-memory "$CLUSTER_MEMORY" \
  --network "$COMPOSE_NETWORK" \
  --k3s-arg "--disable=metrics-server@server:0" \
  2>&1

kubectl config use-context "k3d-$CLUSTER_NAME" 2>/dev/null
ok "k3d cluster created (single node, ${CLUSTER_MEMORY})"

# Wait for cluster to be ready
step "Waiting for Kubernetes API"
for i in $(seq 1 30); do
  if kubectl cluster-info &>/dev/null; then
    ok "Kubernetes API accessible"
    break
  fi
  info "Attempt $i/30: API not ready yet..."
  sleep 3
done

# Wait for node to be ready
info "Waiting for node to be Ready..."
kubectl wait --for=condition=Ready node --all --timeout=120s 2>/dev/null
ok "Node is Ready"

# Wait for Traefik CRDs to be installed
info "Waiting for Traefik CRDs..."
for i in $(seq 1 30); do
  if kubectl get crd ingressroutes.traefik.io &>/dev/null; then
    ok "Traefik CRDs ready"
    break
  fi
  sleep 2
done

# =====================================================
# Import local images into k3d
# =====================================================
step "Importing local Docker images into k3d"

IMAGES_TO_IMPORT=()
for deploy in "${!IMAGE_MAP[@]}"; do
  IMAGES_TO_IMPORT+=("${IMAGE_MAP[$deploy]}")
done

k3d image import "${IMAGES_TO_IMPORT[@]}" -c "$CLUSTER_NAME" 2>&1
ok "All images imported"

# =====================================================
# Create namespace and secrets
# =====================================================
step "Creating namespace and secrets"

kubectl create namespace agro-apps --dry-run=client -o yaml | kubectl apply -f - 2>/dev/null

# Create secrets
kubectl delete secret agro-secrets -n agro-apps --ignore-not-found=true 2>/dev/null

# Check for .env.k3d first, fallback to .env.k3d.example
ENV_FILE="$COMPOSE_DIR/.env.k3d"
if [ ! -f "$ENV_FILE" ]; then
  ENV_FILE="$COMPOSE_DIR/.env.k3d.example"
  warn "No .env.k3d found, using .env.k3d.example defaults"
fi

SECRET_ARGS=()
while IFS= read -r line; do
  [[ -z "$line" || "$line" =~ ^# ]] && continue
  if [[ "$line" =~ ^([^=]+)=(.*)$ ]]; then
    key="${BASH_REMATCH[1]}"
    value="${BASH_REMATCH[2]}"
    SECRET_ARGS+=("--from-literal=$key=$value")
  fi
done < "$ENV_FILE"

kubectl create secret generic agro-secrets -n agro-apps "${SECRET_ARGS[@]}" 2>/dev/null
ok "Namespace 'agro-apps' and secret 'agro-secrets' created"

# =====================================================
# Apply ConfigMaps
# =====================================================
step "Applying ConfigMaps"

for service in identity farm sensor-ingest analytics-worker frontend; do
  configmap="$K8S_APPS_BASE/$service/configmap.yaml"
  if [ -f "$configmap" ]; then
    kubectl apply -f "$configmap" 2>/dev/null
    info "  Applied: $service configmap"
  fi
done
ok "All ConfigMaps applied"

# =====================================================
# Apply Services (ClusterIP)
# =====================================================
step "Applying Services"

for service in identity farm sensor-ingest analytics-worker frontend; do
  svcfile="$K8S_APPS_BASE/$service/service.yaml"
  if [ -f "$svcfile" ]; then
    kubectl apply -f "$svcfile" 2>/dev/null
    info "  Applied: $service service"
  fi
done
ok "All Services applied"

# =====================================================
# Apply IngressRoutes (Traefik)
# Fixes old API group: traefik.containo.us -> traefik.io
# =====================================================
step "Applying IngressRoutes"

for service in identity farm sensor-ingest analytics-worker frontend; do
  ingressfile="$K8S_APPS_BASE/$service/ingressroute.yaml"
  if [ -f "$ingressfile" ]; then
    # Fix old Traefik API group for k3s v1.33+ (Traefik v3)
    sed 's|traefik.containo.us/v1alpha1|traefik.io/v1alpha1|g' "$ingressfile" | kubectl apply -f - 2>/dev/null
    info "  Applied: $service ingressroute"
  fi
done
ok "All IngressRoutes applied"

# =====================================================
# Apply Deployments with local images + lightweight resources
# =====================================================
step "Deploying services (local images, lightweight resources, 1 replica)"

for service in identity farm sensor-ingest analytics-worker frontend; do
  deployfile="$K8S_APPS_BASE/$service/deployment.yaml"
  if [ -f "$deployfile" ]; then
    kubectl apply -f "$deployfile" 2>/dev/null
    info "  Applied: $service deployment"
  fi
done

# Update images to local + set imagePullPolicy=Never
for deploy in "${!IMAGE_MAP[@]}"; do
  img="${IMAGE_MAP[$deploy]}"
  container_name="$deploy"
  kubectl set image "deployment/$deploy" "$container_name=$img" -n agro-apps 2>/dev/null
  kubectl patch deployment "$deploy" -n agro-apps --type=json -p="[
    {\"op\": \"replace\", \"path\": \"/spec/template/spec/containers/0/imagePullPolicy\", \"value\": \"Never\"}
  ]" 2>/dev/null
  info "  Image: $deploy -> $img (local)"
done

# Patch backend services to use less resources
for deploy in identity-service farm-service sensor-ingest-service analytics-worker; do
  kubectl patch deployment "$deploy" -n agro-apps --type=json -p='[
    {"op": "replace", "path": "/spec/replicas", "value": 1},
    {"op": "replace", "path": "/spec/template/spec/containers/0/resources/requests/memory", "value": "128Mi"},
    {"op": "replace", "path": "/spec/template/spec/containers/0/resources/requests/cpu", "value": "50m"},
    {"op": "replace", "path": "/spec/template/spec/containers/0/resources/limits/memory", "value": "384Mi"},
    {"op": "replace", "path": "/spec/template/spec/containers/0/resources/limits/cpu", "value": "300m"}
  ]' 2>/dev/null
  info "  Patched: $deploy (128Mi/384Mi, 1 replica)"
done

kubectl patch deployment frontend -n agro-apps --type=json -p='[
  {"op": "replace", "path": "/spec/replicas", "value": 1}
]' 2>/dev/null
info "  Patched: frontend (1 replica)"

ok "All deployments applied"

# =====================================================
# Wait for rollout
# =====================================================
step "Waiting for pods to be ready..."

DEPLOYMENTS=(identity-service farm-service sensor-ingest-service analytics-worker frontend)
ALL_READY=true
for deploy in "${DEPLOYMENTS[@]}"; do
  info "  Waiting for $deploy..."
  if ! kubectl rollout status "deployment/$deploy" -n agro-apps --timeout=180s 2>/dev/null; then
    warn "  $deploy not ready yet"
    ALL_READY=false
  fi
done

if $ALL_READY; then
  ok "All pods ready!"
else
  warn "Some pods may still be starting. Check: kubectl get pods -n agro-apps"
fi

# =====================================================
# Summary
# =====================================================
echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  LIGHTWEIGHT K3D BOOTSTRAP COMPLETE${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo -e "${CYAN}CLUSTER:${NC}"
echo -e "  Name:   $CLUSTER_NAME (single node, ${CLUSTER_MEMORY} limit)"
echo ""
echo -e "${CYAN}INFRASTRUCTURE (Docker Compose):${NC}"
echo -e "  Postgres:  localhost:5432"
echo -e "  Redis:     localhost:6379"
echo -e "  RabbitMQ:  localhost:5672 (UI: localhost:15672)"
echo ""
echo -e "${CYAN}SERVICES (k3d via Traefik @ localhost:80):${NC}"
echo -e "  Frontend:       http://localhost/agro"
echo -e "  Identity API:   http://localhost/identity"
echo -e "  Farm API:       http://localhost/farm"
echo -e "  Sensor Ingest:  http://localhost/sensor-ingest"
echo -e "  Analytics:      http://localhost/analytics-worker"
echo ""
echo -e "${CYAN}DISABLED (to save RAM):${NC}"
echo -e "  ArgoCD, Grafana, Prometheus, Loki, Tempo, OTEL, HPA, pgAdmin"
echo ""
echo -e "${CYAN}USEFUL COMMANDS:${NC}"
echo -e "  kubectl get pods -n agro-apps                              # Pod status"
echo -e "  kubectl logs -f deploy/identity-service -n agro-apps       # View logs"
echo -e "  docker compose -f scripts/k3d/docker-compose-lightweight.yml down  # Stop infra"
echo -e "  k3d cluster delete dev                                     # Delete cluster"
echo ""

echo -e "${CYAN}CURRENT POD STATUS:${NC}"
kubectl get pods -n agro-apps -o wide 2>/dev/null || true
echo ""
