#!/usr/bin/env bash
# =============================================================================
# TC Agro Solutions - Full Stack Test Script
# =============================================================================
# Builds, starts, seeds data, and opens the frontend for end-to-end testing.
#
# Usage:
#   ./scripts/test-stack.sh          # Build + start + seed
#   ./scripts/test-stack.sh --seed   # Only seed data (services already running)
#   ./scripts/test-stack.sh --down   # Stop everything
# =============================================================================

set -euo pipefail

COMPOSE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$COMPOSE_DIR"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[!!]${NC} $1"; }
err()  { echo -e "${RED}[ERR]${NC} $1"; }
info() { echo -e "${CYAN}[>>]${NC} $1"; }

# Service URLs
IDENTITY_URL="http://localhost:5001"
FARM_URL="http://localhost:5002"
SENSOR_URL="http://localhost:5003"
FRONTEND_URL="http://localhost:5010"

# =============================================================================
# FUNCTIONS
# =============================================================================

wait_for_service() {
  local name="$1" url="$2" max_attempts="${3:-60}"
  local attempt=0

  info "Waiting for $name at $url ..."
  while [ $attempt -lt $max_attempts ]; do
    if curl -sf "$url/health" > /dev/null 2>&1; then
      log "$name is healthy"
      return 0
    fi
    attempt=$((attempt + 1))
    sleep 2
  done

  err "$name did not become healthy after $((max_attempts * 2))s"
  return 1
}

wait_for_frontend() {
  local max_attempts=30 attempt=0
  info "Waiting for Frontend at $FRONTEND_URL ..."
  while [ $attempt -lt $max_attempts ]; do
    if curl -sf "$FRONTEND_URL/" > /dev/null 2>&1; then
      log "Frontend is ready"
      return 0
    fi
    attempt=$((attempt + 1))
    sleep 2
  done
  warn "Frontend did not respond (may still be building)"
}

build_and_start() {
  info "Building and starting full stack..."
  docker compose build --parallel 2>&1 | tail -5
  docker compose up -d
  echo ""

  # Wait for infrastructure first
  info "Waiting for infrastructure..."
  local attempt=0
  while [ $attempt -lt 30 ]; do
    if docker compose exec -T postgres pg_isready -U postgres > /dev/null 2>&1; then
      log "PostgreSQL is ready"
      break
    fi
    attempt=$((attempt + 1))
    sleep 2
  done

  # Wait for services
  wait_for_service "Identity Service" "$IDENTITY_URL"
  wait_for_service "Farm Service" "$FARM_URL"
  wait_for_service "Sensor Ingest Service" "$SENSOR_URL"
  wait_for_frontend
  echo ""
}

seed_data() {
  info "=== Seeding test data ==="
  echo ""

  # ----------------------------------------------------------
  # Step 1: Register user
  # ----------------------------------------------------------
  info "1/6 - Registering test user..."
  REGISTER_RESP=$(curl -sf -X POST "$IDENTITY_URL/auth/register" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "Test Producer",
      "email": "producer@test.com",
      "password": "Test@123456",
      "role": "Producer"
    }' 2>&1) || true

  if echo "$REGISTER_RESP" | grep -qi "already\|exists\|conflict"; then
    warn "User already exists (OK)"
  else
    log "User registered"
  fi

  # ----------------------------------------------------------
  # Step 2: Login
  # ----------------------------------------------------------
  info "2/6 - Logging in..."
  LOGIN_RESP=$(curl -sf -X POST "$IDENTITY_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d '{
      "email": "producer@test.com",
      "password": "Test@123456"
    }')

  TOKEN=$(echo "$LOGIN_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['jwtToken'])" 2>/dev/null) || {
    err "Login failed. Response: $LOGIN_RESP"
    err "Make sure Identity Service is running and the user was registered."
    return 1
  }
  log "Got JWT token: ${TOKEN:0:20}..."

  AUTH="Authorization: Bearer $TOKEN"

  # ----------------------------------------------------------
  # Step 3: Create Property
  # ----------------------------------------------------------
  info "3/6 - Creating property..."
  PROP_RESP=$(curl -sf -X POST "$FARM_URL/api/properties" \
    -H "Content-Type: application/json" \
    -H "$AUTH" \
    -d '{
      "name": "Fazenda Boa Vista",
      "address": "Estrada Rural Km 15",
      "city": "Ribeirao Preto",
      "state": "SP",
      "country": "Brazil",
      "areaHectares": 250.5,
      "latitude": -21.1767,
      "longitude": -47.8208
    }')

  PROPERTY_ID=$(echo "$PROP_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null) || {
    err "Create property failed. Response: $PROP_RESP"
    return 1
  }
  log "Property created: $PROPERTY_ID"

  # ----------------------------------------------------------
  # Step 4: Create Plot
  # ----------------------------------------------------------
  info "4/6 - Creating plot..."
  PLOT_RESP=$(curl -sf -X POST "$FARM_URL/api/plots" \
    -H "Content-Type: application/json" \
    -H "$AUTH" \
    -d "{
      \"propertyId\": \"$PROPERTY_ID\",
      \"name\": \"Talhao Norte\",
      \"cropType\": \"Soja\",
      \"areaHectares\": 50.0
    }")

  PLOT_ID=$(echo "$PLOT_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null) || {
    err "Create plot failed. Response: $PLOT_RESP"
    return 1
  }
  log "Plot created: $PLOT_ID"

  # ----------------------------------------------------------
  # Step 5: Create Sensor (via Farm → RabbitMQ → SensorIngest)
  # ----------------------------------------------------------
  info "5/6 - Creating sensor (Farm publishes event → Sensor Ingest consumes)..."
  SENSOR_RESP=$(curl -sf -X POST "$FARM_URL/api/sensors" \
    -H "Content-Type: application/json" \
    -H "$AUTH" \
    -d "{
      \"plotId\": \"$PLOT_ID\",
      \"type\": \"Temperature\",
      \"label\": \"Sensor Norte 1\"
    }")

  SENSOR_ID=$(echo "$SENSOR_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null) || {
    err "Create sensor failed. Response: $SENSOR_RESP"
    return 1
  }
  log "Sensor created in Farm: $SENSOR_ID"

  # Wait a moment for the integration event to propagate via RabbitMQ
  info "Waiting 3s for SensorRegisteredIntegrationEvent to propagate..."
  sleep 3

  # ----------------------------------------------------------
  # Step 6: Send sensor reading (to Sensor Ingest)
  # ----------------------------------------------------------
  info "6/6 - Sending sensor reading to Sensor Ingest..."
  READING_RESP=$(curl -sf -X POST "$SENSOR_URL/api/readings" \
    -H "Content-Type: application/json" \
    -H "$AUTH" \
    -d "{
      \"sensorId\": \"$SENSOR_ID\",
      \"plotId\": \"$PLOT_ID\",
      \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
      \"temperature\": 28.5,
      \"humidity\": 65.0,
      \"soilMoisture\": 42.0,
      \"rainfall\": null,
      \"batteryLevel\": 85.0
    }")

  if echo "$READING_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('readingId',''))" 2>/dev/null | grep -q .; then
    log "Reading accepted!"
  else
    warn "Reading response: $READING_RESP"
    warn "If you see 'not registered' error, the integration event may not have propagated yet."
    warn "Try sending the reading again manually."
  fi

  echo ""

  # ----------------------------------------------------------
  # Verify: List sensors from Sensor Ingest
  # ----------------------------------------------------------
  info "=== Verification ==="
  info "Sensors in Sensor Ingest:"
  curl -sf "$SENSOR_URL/api/sensors" -H "$AUTH" | python3 -m json.tool 2>/dev/null || warn "Could not list sensors"

  echo ""
  info "Dashboard stats:"
  curl -sf "$SENSOR_URL/api/dashboard/stats" -H "$AUTH" | python3 -m json.tool 2>/dev/null || warn "Could not get stats"

  echo ""
}

print_urls() {
  echo ""
  echo -e "${CYAN}========================================${NC}"
  echo -e "${CYAN}  TC Agro Solutions - Access URLs${NC}"
  echo -e "${CYAN}========================================${NC}"
  echo ""
  echo -e "  Frontend:        ${GREEN}$FRONTEND_URL${NC}"
  echo -e "  Identity API:    $IDENTITY_URL"
  echo -e "  Farm API:        $FARM_URL"
  echo -e "  Sensor Ingest:   $SENSOR_URL"
  echo ""
  echo -e "  RabbitMQ UI:     http://localhost:15672  (guest/guest)"
  echo -e "  pgAdmin:         http://localhost:15432  (admin@admin.com/admin)"
  echo -e "  Grafana:         http://localhost:3000   (admin/admin)"
  echo ""
  echo -e "  Test credentials: ${GREEN}producer@test.com / Test@123456${NC}"
  echo ""
  echo -e "${CYAN}========================================${NC}"
}

stop_stack() {
  info "Stopping all services..."
  docker compose down
  log "All services stopped."
}

# =============================================================================
# MAIN
# =============================================================================

case "${1:-}" in
  --seed)
    seed_data
    print_urls
    ;;
  --down)
    stop_stack
    ;;
  --urls)
    print_urls
    ;;
  *)
    build_and_start
    seed_data
    print_urls

    # Try to open browser
    if command -v open &> /dev/null; then
      info "Opening frontend in browser..."
      open "$FRONTEND_URL"
    elif command -v xdg-open &> /dev/null; then
      xdg-open "$FRONTEND_URL"
    fi
    ;;
esac
