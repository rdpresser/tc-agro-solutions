# ⚡ Quick Start - Git Submodules (5 Minutes)

**Goal:** Clone TC Agro Solutions with all services in one command

---

## 🚀 Option 1: Clone Everything (Easiest)

```bash
# Clone solution + all services + shared code in one command
git clone --recurse-submodules git@github.com:your-org/tc-agro-solutions.git

cd tc-agro-solutions

# Verify all services are present
ls services/
# agro-analytics-worker/
# agro-dashboard-service/
# agro-farm-service/
# agro-identity-service/
# agro-sensor-ingest-service/

ls common/
# agro-domain-models/
# agro-integration-tests/
# agro-shared-library/

# Start everything locally
docker-compose up -d

# Check if services are running
curl http://localhost:5001/health  # Identity (should return 200)
curl http://localhost:5002/health  # Farm
curl http://localhost:5003/health  # Ingest
curl http://localhost:5004/health  # Dashboard
```

---

## 🔄 Option 2: Clone Without Submodules, Then Init

```bash
# Clone only parent (fast)
git clone git@github.com:your-org/tc-agro-solutions.git

cd tc-agro-solutions

# Download all services + shared code
git submodule init
git submodule update --recursive

# Now you have everything (same as Option 1)
```

---

## 📦 What Gets Cloned?

```
tc-agro-solutions/  (Parent repo)
├── services/  (Git submodules)
│   ├── agro-identity-service/
│   ├── agro-farm-service/
│   ├── agro-sensor-ingest-service/
│   ├── agro-analytics-worker/
│   └── agro-dashboard-service/
├── common/  (Git submodules)
│   ├── agro-shared-library/
│   ├── agro-domain-models/
│   └── agro-integration-tests/
├── infrastructure/  (Local files)
│   ├── terraform/
│   └── kubernetes/
├── scripts/  (Local files)
└── docs/  (Local files)
```

**Size:** ~500MB (depends on service history)  
**Time:** ~5 minutes (depends on internet speed)

---

## ✨ Daily Commands

### Check Status
```bash
# Which submodules have changes?
git status

# Detailed view
git submodule status
```

### Update All Services
```bash
# Get latest version of all services (from main branch)
git submodule update --remote

# Commit this update to parent repo
git add .
git commit -m "chore: update all services to latest"
git push
```

### Work on a Service
```bash
# Navigate to service
cd services/agro-farm-service

# Create feature branch
git checkout -b feature/new-endpoint

# Make changes
# ...

# Commit to service repo
git add .
git commit -m "feat: add new endpoint"
git push origin feature/new-endpoint

# Go back to parent
cd ../..

# After PR is merged to service main branch:
git submodule update --remote services/agro-farm-service
git add services/agro-farm-service
git commit -m "chore: update farm service with new endpoint"
git push
```

---

## 🛠️ Troubleshooting

### Services Not Cloned
```bash
# If you cloned without --recurse-submodules:
git submodule init
git submodule update --recursive
```

### Service Folder Empty
```bash
# Update that specific service
git submodule update --init services/agro-identity-service
```

### Submodule in Detached HEAD
```bash
cd services/agro-farm-service
git checkout main
git pull
```

### Pull Latest Changes
```bash
# In parent repo
git submodule foreach --recursive 'git pull origin main'
```

---

## 🎯 Real Scenarios

### Scenario 1: Pull Latest Code on Monday Morning
```bash
cd tc-agro-solutions

# Get everything updated
git submodule update --remote

# Verify
docker-compose up -d
curl http://localhost:5001/health  # Should work
```

### Scenario 2: Fix Bug in Farm Service
```bash
cd services/agro-farm-service

# Create fix branch
git checkout -b bugfix/fix-plot-validation

# Make fix
# ... edit code ...

# Commit and push
git add .
git commit -m "fix: validate plot area correctly"
git push origin bugfix/fix-plot-validation

# Open PR, get review, merge to main

# Back in parent repo
cd ../..
git submodule update --remote services/agro-farm-service
git add services/agro-farm-service
git commit -m "chore: update farm service with plot validation fix"
git push
```

### Scenario 3: Add New Service
```bash
# 1. Create new repository on GitHub (agro-new-service)

# 2. Add to parent repo
git submodule add git@github.com:your-org/agro-new-service.git services/agro-new-service

# 3. Create Kubernetes manifest in infrastructure/

# 4. Commit to parent
git add .
git commit -m "feat: add new microservice"
git push
```

### Scenario 4: Update Infrastructure
```bash
# Only parent repo involved
cd infrastructure/terraform

# Make changes
# ... edit Terraform ...

# Test
terraform validate

# Commit
cd ../..
git add infrastructure/
git commit -m "chore: update AKS configuration"
git push
```

---

## 🔗 Useful One-Liners

```bash
# Show current branch in each service
git submodule foreach --recursive 'echo "$(pwd | sed "s|.*/||"): $(git branch --show-current)"'

# Show latest commit in each service
git submodule foreach --recursive 'echo "$(pwd | sed "s|.*/||"): $(git log -1 --oneline)"'

# Fetch all services without updating
git submodule foreach --recursive 'git fetch origin'

# Check if any service has uncommitted changes
git submodule foreach --recursive 'git status --short'

# Pull all services
git submodule foreach --recursive 'git pull origin main'

# Show remote URL of each service
git submodule foreach --recursive 'echo "$(pwd | sed "s|.*/||"): $(git remote get-url origin)"'
```

---

## 📚 Learn More

- **Detailed Guide:** [GIT_SUBMODULES_STRATEGY.md](../GIT_SUBMODULES_STRATEGY.md)
- **Official Git Docs:** https://git-scm.com/book/en/v2/Git-Tools-Submodules
- **Solution Architecture:** [README.md](../README.md)

---

## ⚠️ Important Notes

### ✅ DO
- Use `--recurse-submodules` when cloning
- Run `git submodule update --remote` regularly
- Commit parent repo after updating submodule references
- Keep each service repo independent

### ❌ DON'T
- Edit service files directly in parent repo (they're read-only references)
- Leave submodules in detached HEAD state without fixing
- Push parent repo without pulling latest services first
- Forget to commit parent repo after service updates

---

## 🎓 How Submodules Work (2-Minute Explanation)

Git submodules are **pointers** to other Git repositories:

```
Parent Repo (tc-agro-solutions)
  ├─ Points to agro-identity-service @ commit ABC123
  ├─ Points to agro-farm-service @ commit DEF456
  ├─ Points to agro-analytics-worker @ commit GHI789
  └─ Stores this in .gitmodules file
```

When you clone with `--recurse-submodules`, it:
1. Clones parent repo
2. Reads `.gitmodules` to find all referenced repos
3. Clones each service repo
4. Checks out the specific commit recorded in parent

When a service is updated:
1. Developer merges PR in service repo (new commit)
2. Parent repo shows "services/agro-farm-service has new commits"
3. Run `git submodule update --remote` to get latest
4. Commit parent repo to record the update

**Result:** Parent tracks which version of each service is deployed ✅

---

## 🚀 Next Steps

1. **Clone:** `git clone --recurse-submodules <url>`
2. **Start:** `docker-compose up -d`
3. **Verify:** `curl http://localhost:5001/health`
4. **Read:** [Detailed Guide](../GIT_SUBMODULES_STRATEGY.md)
5. **Code:** Start developing!

---

> **Time to First Working Environment:** 5 minutes ⚡  
> **All services running locally:** ✅  
> **Ready to develop:** ✅

**Questions?** See [GIT_SUBMODULES_STRATEGY.md](../GIT_SUBMODULES_STRATEGY.md)
