#!/usr/bin/env bash

# TC Agro Solutions - macOS Bootstrap
# Purpose: Clone service repos and common lib, create .env, and validate setup
# OS: macOS (zsh/bash)

set -o errexit
set -o pipefail
set -o nounset

# -------- Colors --------
GREEN="\033[1;32m"
YELLOW="\033[1;33m"
RED="\033[1;31m"
CYAN="\033[1;36m"
RESET="\033[0m"

# -------- Paths --------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# -------- Logging --------
log_info()   { echo -e "    ${CYAN}ℹ${RESET} $1"; }
log_success(){ echo -e "    ${GREEN}✓${RESET} $1"; }
log_warn()   { echo -e "    ${YELLOW}⚠${RESET} $1"; }
log_error()  { echo -e "    ${RED}✗${RESET} $1"; }

header() {
  echo -e "\n${CYAN}╔════════════════════════════════════════════════════════╗${RESET}"
  echo -e "${CYAN}║ TC Agro Solutions - Bootstrap (macOS)${RESET}"
  echo -e "${CYAN}╚════════════════════════════════════════════════════════╝${RESET}\n"
  log_info "Project root: ${ROOT_DIR}"
}

ask_yes_no() {
  local prompt="$1 (y/n): "
  local reply
  read -r -p "${prompt}" reply || true
  case "${reply}" in
    y|Y|yes|YES) return 0;;
    *) return 1;;
  esac
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

ensure_dir() {
  local dir="$1"
  if [[ ! -d "${dir}" ]]; then
    mkdir -p "${dir}"
    log_success "Directory created: ${dir}"
  fi
}

write_env() {
  local env_path="${ROOT_DIR}/.env"
  if [[ -f "${env_path}" ]]; then
    log_info ".env already exists: ${env_path}"
    return 0
  fi

  cat > "${env_path}" <<'ENVEOF'
# =====================================================
# PostgreSQL
# =====================================================
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=agro
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres

# Connection String for .NET (optional, built by services)
# DefaultConnection=Host=postgres;Port=5432;Database=agro;Username=postgres;Password=postgres

# =====================================================
# Redis
# =====================================================
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=

# =====================================================
# RabbitMQ / Azure Service Bus
# =====================================================
RABBITMQ_HOST=rabbitmq
RABBITMQ_PORT=5672
RABMQ_MANAGEMENT_PORT=15672
RABBITMQ_USER=guest
RABBITMQ_PASSWORD=guest

# =====================================================
# Services - HTTP Ports
# =====================================================
IDENTITY_HTTP_PORT=5001
FARM_HTTP_PORT=5002
SENSOR_INGEST_HTTP_PORT=5003
ANALYTICS_WORKER_HTTP_PORT=5004
DASHBOARD_HTTP_PORT=5005

# =====================================================
# JWT / Authentication
# =====================================================
JWT_ISSUER=http://localhost:5001
JWT_AUDIENCE=http://localhost:5000
JWT_SECRET_KEY=your-256-bit-secret-key-change-in-production-12345678
JWT_EXPIRATION_MINUTES=480

# =====================================================
# Logging
# =====================================================
LOG_LEVEL=Information

# =====================================================
# Docker
# =====================================================
COMPOSE_PROJECT_NAME=tc-agro-solutions
ENVEOF

  log_success ".env created: ${env_path}"
}

get_default_branch() {
  # Try to detect remote default branch; fallback to main
  local branch
  branch=$(git remote show origin 2>/dev/null | sed -n 's/.*HEAD branch: \(.*\)/\1/p') || true
  if [[ -z "${branch}" ]]; then branch="main"; fi
  echo "${branch}"
}

clone_or_pull_repo() {
  local name="$1" url="$2" relpath="$3"
  local target="${ROOT_DIR}/${relpath}"

  if [[ ! -d "${target}" ]]; then
    echo -e "\n==> Cloning ${name} -> ${target}"
    log_info "Testing repository connectivity..."
    if ! git ls-remote "${url}" HEAD >/dev/null 2>&1; then
      log_error "Repository not accessible: ${url}"
      exit 1
    fi
    log_info "Repository is accessible, cloning now..."
    if git clone "${url}" "${target}"; then
      log_success "${name} cloned successfully to ${target}"
    else
      log_error "Failed to clone ${name}"
      exit 1
    fi
  else
    # Validate it's a git repo before offering pull
    if [[ ! -d "${target}/.git" ]]; then
      log_error "${name} folder exists but is not a valid git repository (missing .git)"
      log_warn  "Please delete ${target} and run bootstrap again, or manually clone:"
      echo "      git clone ${url} ${target}"
      exit 1
    fi

    echo -e "\n==> ${name} already exists in ${target}"
    if ask_yes_no "Do you want to pull (git pull origin <default branch>) for ${name}?"; then
      echo -e "\n==> Updating ${name} with pull..."
      pushd "${target}" >/dev/null
      local branch
      branch=$(get_default_branch)
      git fetch origin --prune || { log_error "git fetch failed"; popd >/dev/null; exit 1; }
      git pull origin "${branch}" || { log_error "git pull failed"; popd >/dev/null; exit 1; }
      log_success "${name} updated to ${branch}"
      popd >/dev/null
    fi
  fi
}

verify_repos() {
  echo -e "\n==> Verifying cloned repositories..."
  local paths=(
    "services/identity-service"
    "services/farm-service"
    "services/sensor-ingest-service"
    "services/analytics-worker"
    "services/dashboard-service"
    "common"
  )
  local ok=1
  for p in "${paths[@]}"; do
    local full="${ROOT_DIR}/${p}"
    if [[ -d "${full}" ]]; then
      echo -e "    ${GREEN}✓ ✓${RESET} ${p} exists"
    else
      echo -e "    ${RED}✗ ✗${RESET} ${p} NOT FOUND"
      ok=0
    fi
  done
  if [[ "${ok}" -ne 1 ]]; then
    log_warn "Some repositories are missing. Please check the errors above."
    exit 1
  fi
}

main() {
  header

  echo -e "\n==> Validating prerequisites"
  if command_exists git; then log_success "Git found"; else log_error "Git not found"; exit 1; fi
  if command_exists docker; then log_success "Docker found"; else log_warn "Docker not found (optional for now)"; fi

  echo -e "\n==> Testing internet connectivity..."
  if curl -s --max-time 5 https://github.com >/dev/null; then
    log_success "Internet connectivity verified"
  else
    log_warn "Could not verify internet connectivity. Make sure you have a working internet connection."
  fi

  echo -e "\n==> Preparing folder structure"
  ensure_dir "${ROOT_DIR}/services"
  # Note: 'common' folder will be created by git clone

  echo -e "\n==> Creating .env file"
  write_env

  echo -e "\n==> Cloning/updating service repositories"
  local repos=(
    "identity-service|https://github.com/rdpresser/tc-agro-identity-service.git|services/identity-service"
    "farm-service|https://github.com/rdpresser/tc-agro-farm-service.git|services/farm-service"
    "sensor-ingest-service|https://github.com/rdpresser/tc-agro-sensor-ingest-service.git|services/sensor-ingest-service"
    "analytics-worker|https://github.com/rdpresser/tc-agro-analytics-worker.git|services/analytics-worker"
    "dashboard-service|https://github.com/rdpresser/tc-agro-dashboard-service.git|services/dashboard-service"
  )
  for entry in "${repos[@]}"; do
    IFS='|' read -r name url relpath <<< "${entry}"
    clone_or_pull_repo "${name}" "${url}" "${relpath}"
  done

  echo -e "\n==> Cloning/updating common repository"
  clone_or_pull_repo "common" "https://github.com/rdpresser/tc-agro-common.git" "common"

  echo -e "\n${CYAN}╔════════════════════════════════════════════════════════╗${RESET}"
  echo -e "${CYAN}║ Bootstrap Complete${RESET}"
  echo -e "${CYAN}╚════════════════════════════════════════════════════════╝${RESET}\n"

  log_info "Structure created:"
  log_info "  ✓ services/"
  log_info "    - identity-service/"
  log_info "    - farm-service/"
  log_info "    - sensor-ingest-service/"
  log_info "    - analytics-worker/"
  log_info "    - dashboard-service/"
  log_info "  ✓ common/"
  log_info "  ✓ .env (local configuration)"

  verify_repos

  echo -e "    \n${CYAN}Next steps:${RESET}"
  echo -e "    1. Open tc-agro-solutions.sln in Visual Studio 2026"
  echo -e "    2. Add service projects to solution"
  echo -e "    3. Create docker-compose.yml with services"
  echo -e "    4. Run: docker compose up -d\n"
  echo -e "${GREEN}✅ Environment ready for development!${RESET}\n"
}

main "$@"
