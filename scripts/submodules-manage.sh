#!/bin/bash

# TC Agro Solutions - Git Submodules Management Script
# Purpose: Simplify cloning, updating, and managing Git submodules
# Usage: ./scripts/submodules-manage.sh <command>

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Functions
print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Commands
cmd_init() {
    print_header "Initializing Git Submodules"
    
    cd "$REPO_ROOT"
    
    echo "Initializing submodules..."
    git submodule init
    
    echo "Updating submodules..."
    git submodule update --recursive
    
    print_success "All submodules initialized"
    
    echo ""
    echo "Submodules status:"
    git submodule status
}

cmd_update() {
    print_header "Updating All Submodules to Latest"
    
    cd "$REPO_ROOT"
    
    echo "Fetching latest from all submodules..."
    git submodule update --remote
    
    print_success "All submodules updated to latest remote version"
    
    echo ""
    echo "Submodules status:"
    git submodule status
}

cmd_status() {
    print_header "Submodules Status"
    
    cd "$REPO_ROOT"
    
    git submodule status
}

cmd_foreach() {
    print_header "Running Command in Each Submodule"
    
    if [ -z "$2" ]; then
        print_error "Usage: $0 foreach '<command>'"
        echo "Example: $0 foreach 'git log -1 --oneline'"
        exit 1
    fi
    
    cd "$REPO_ROOT"
    
    git submodule foreach --recursive "$2"
}

cmd_pull_all() {
    print_header "Pulling Latest Changes in All Submodules"
    
    cd "$REPO_ROOT"
    
    git submodule foreach --recursive 'git pull origin main'
    
    print_success "All submodules pulled"
}

cmd_branches() {
    print_header "Current Branch in Each Submodule"
    
    cd "$REPO_ROOT"
    
    git submodule foreach --recursive 'echo "$(pwd | sed "s|.*/||"): $(git branch --show-current)"'
}

cmd_commit_all() {
    print_header "Committing Submodule Updates to Parent"
    
    if [ -z "$2" ]; then
        print_error "Usage: $0 commit_all '<commit message>'"
        echo "Example: $0 commit_all 'chore: update all services to latest'"
        exit 1
    fi
    
    cd "$REPO_ROOT"
    
    echo "Checking for modified submodules..."
    git status
    
    echo ""
    echo "Adding all changes..."
    git add .
    
    echo "Committing with message: $2"
    git commit -m "$2"
    
    echo ""
    echo "Pushing to remote..."
    git push origin $(git rev-parse --abbrev-ref HEAD)
    
    print_success "Parent repository updated"
}

cmd_clone() {
    print_header "Clone Solution with All Submodules"
    
    if [ -z "$2" ]; then
        print_error "Usage: $0 clone '<repo-url>'"
        echo "Example: $0 clone 'git@github.com:your-org/tc-agro-solutions.git'"
        exit 1
    fi
    
    CLONE_URL="$2"
    CLONE_DIR="${3:-.}"
    
    echo "Cloning $CLONE_URL with submodules..."
    git clone --recurse-submodules "$CLONE_URL" "$CLONE_DIR"
    
    if [ "$CLONE_DIR" != "." ]; then
        cd "$CLONE_DIR"
    fi
    
    print_success "Solution cloned successfully"
    echo ""
    echo "Next steps:"
    echo "  1. cd tc-agro-solutions (or your cloned directory)"
    echo "  2. docker-compose up -d"
    echo "  3. curl http://localhost:5001/health"
}

cmd_list() {
    print_header "List All Submodules"
    
    cd "$REPO_ROOT"
    
    if [ ! -f ".gitmodules" ]; then
        print_warning "No submodules configured"
        exit 0
    fi
    
    echo "Configured submodules:"
    echo ""
    
    grep -E '^\[submodule' .gitmodules | sed 's/\[submodule "\(.*\)"\]/  📦 \1/' 
    
    echo ""
    echo "Detailed configuration:"
    cat .gitmodules | grep -E '(path|url)' | awk '{print $3}' | paste - - | sed 's/\t/ -> /'
}

cmd_clean() {
    print_header "Clean Submodules (Discard Local Changes)"
    
    print_warning "This will discard all local changes in submodules!"
    read -p "Continue? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Cancelled"
        exit 0
    fi
    
    cd "$REPO_ROOT"
    
    echo "Cleaning submodules..."
    git submodule foreach --recursive 'git checkout .'
    git submodule foreach --recursive 'git clean -fd'
    
    print_success "Submodules cleaned"
}

cmd_help() {
    cat << EOF
${BLUE}TC Agro Solutions - Git Submodules Management${NC}

${GREEN}Usage:${NC}
  $0 <command> [options]

${GREEN}Commands:${NC}
  init              Initialize and clone all submodules
  update            Update all submodules to latest remote version
  status            Show status of all submodules
  list              List all configured submodules
  branches          Show current branch in each submodule
  pull_all          Pull latest changes in all submodules
  foreach <cmd>     Run command in each submodule
  commit_all <msg>  Commit submodule updates to parent repo
  clone <url> [dir] Clone solution with all submodules
  clean             Discard local changes in submodules
  help              Show this help message

${GREEN}Examples:${NC}
  # Initialize submodules after cloning
  $0 init

  # Update all services to latest version
  $0 update

  # Check status of all submodules
  $0 status

  # List all submodules
  $0 list

  # Run git status in all submodules
  $0 foreach 'git status'

  # Clone entire solution
  $0 clone git@github.com:your-org/tc-agro-solutions.git ~/projects/agro

  # Commit submodule updates to parent
  $0 commit_all 'chore: update all services'

${GREEN}Workflow Example:${NC}
  1. Clone solution with submodules:
     $0 clone git@github.com:your-org/tc-agro-solutions.git

  2. Make changes in a service:
     cd services/agro-farm-service
     git checkout -b feature/new-endpoint
     # ... edit code ...
     git push origin feature/new-endpoint

  3. After PR merge, update parent repo:
     cd ../..
     $0 update
     $0 commit_all 'chore: update farm service'

${GREEN}Documentation:${NC}
  See GIT_SUBMODULES_STRATEGY.md for detailed information

EOF
}

# Main
case "${1:-help}" in
    init)
        cmd_init
        ;;
    update)
        cmd_update
        ;;
    status)
        cmd_status
        ;;
    list)
        cmd_list
        ;;
    branches)
        cmd_branches
        ;;
    pull_all)
        cmd_pull_all
        ;;
    foreach)
        cmd_foreach "$@"
        ;;
    commit_all)
        cmd_commit_all "$@"
        ;;
    clone)
        cmd_clone "$@"
        ;;
    clean)
        cmd_clean
        ;;
    help|--help|-h|"")
        cmd_help
        ;;
    *)
        print_error "Unknown command: $1"
        echo ""
        cmd_help
        exit 1
        ;;
esac
