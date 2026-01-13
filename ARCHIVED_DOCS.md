# 📦 Archived Documentation

## Overview

The following documentation files have been **archived** as they are no longer used in the current project architecture.

The project has migrated from **Git Submodules** to **Bootstrap PowerShell Script** for managing microservices repositories.

---

## Archived Files

### 1. `GIT_SUBMODULES_STRATEGY.md` 
- **Date Archived:** January 13, 2026
- **Reason:** Git Submodules approach replaced by simpler `bootstrap.ps1`
- **Replacement:** [docs/BOOTSTRAP_SETUP.md](docs/BOOTSTRAP_SETUP.md)

**What it covered:**
- Git submodule setup and configuration
- Step-by-step submodule initialization
- Submodule workflows and troubleshooting

### 2. `QUICK_START_SUBMODULES.md`
- **Date Archived:** January 13, 2026
- **Reason:** Replaced by quick start in [docs/BOOTSTRAP_SETUP.md](docs/BOOTSTRAP_SETUP.md)
- **Replacement:** [docs/BOOTSTRAP_SETUP.md - Quick Start Section](docs/BOOTSTRAP_SETUP.md#quick-start)

**What it covered:**
- 5-minute quickstart for cloning with submodules
- Common daily commands
- Real-world scenarios

---

## Why the Change?

### ❌ Git Submodules Complexity
- Multiple `.gitmodules` files to maintain
- Detached HEAD states difficult to manage
- Steeper learning curve for new developers
- Recursive initialization could fail silently

### ✅ Bootstrap PowerShell Script Benefits
- **Simpler:** Single `bootstrap.ps1` file
- **Idempotent:** Safe to run multiple times
- **Interactive:** Ask before making changes
- **Transparent:** Clear console output
- **Flexible:** Easy to add/remove services
- **No Git Magic:** Standard git clone/pull

---

## Migration Guide

### Old Way (Submodules)
```bash
git clone --recurse-submodules git@github.com:your-org/tc-agro-solutions.git
cd tc-agro-solutions
git submodule update --remote
```

### New Way (Bootstrap)
```powershell
git clone https://github.com/rdpresser/tc-agro-solutions.git
cd tc-agro-solutions
.\scripts\bootstrap.ps1
```

---

## If You Need the Old Documentation

The archived files are **not deleted**, they are simply **removed from git tracking**.

If you need to reference the old submodules documentation:

1. Check the Git history: `git log --full-history -- GIT_SUBMODULES_STRATEGY.md`
2. View the file at a specific commit: `git show COMMIT_HASH:GIT_SUBMODULES_STRATEGY.md`
3. Or access it from a backup/archive if needed

---

## Current Setup Flow

```
┌─────────────────────────────────────┐
│ 1. Clone Main Repository            │
│    git clone https://github.com/... │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│ 2. Run Bootstrap Script             │
│    .\scripts\bootstrap.ps1          │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│ 3. All Services Cloned              │
│    - services/identity-service/     │
│    - services/farm-service/         │
│    - services/sensor-ingest/        │
│    - services/analytics-worker/     │
│    - services/dashboard-service/    │
│    - common/                        │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│ 4. Open Solution & Start Dev        │
│    Visual Studio 2026               │
│    docker compose up -d             │
└─────────────────────────────────────┘
```

---

## Documentation Structure (Current)

```
tc-agro-solutions/
├── docs/
│   ├── BOOTSTRAP_SETUP.md             ⭐ NEW - Setup documentation
│   ├── development/
│   │   └── local-setup.md
│   ├── adr/                           ADRs
│   └── architecture/                  Architecture docs
├── scripts/
│   └── bootstrap.ps1                  ⭐ NEW - Setup automation
├── README.md                          Updated with new setup
└── ARCHIVED_DOCS.md                   This file
```

---

## Questions?

If you have questions about the migration:

1. **For Setup:** See [docs/BOOTSTRAP_SETUP.md](docs/BOOTSTRAP_SETUP.md)
2. **For Architecture:** See [docs/adr/](docs/adr/) and [README_ROADMAP.md](README_ROADMAP.md)
3. **For Local Dev:** See [docs/development/local-setup.md](docs/development/local-setup.md)

---

> **Archived:** January 13, 2026  
> **Status:** Documentation migrated to new architecture  
> **Last Updated:** January 13, 2026
