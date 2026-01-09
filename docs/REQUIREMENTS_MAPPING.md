# Requirements Mapping - Hackathon 8NETT vs Current Roadmap

**Date:** January 9, 2026  
**Status:** ✅ Mapped & Integrated

---

## Overview

This document maps mandatory requirements from [HACKATHON%208NETT.pdf](../tech_challenge/HACKATHON%208NETT.pdf) to existing roadmap and ADRs, identifies gaps, and proposes consolidation of documentation.

---

## Functional Requirements Mapping

### ✅ Already Covered in Roadmap

| Requirement | Coverage | Location |
|------------|----------|----------|
| **Producer login (email/password)** | Full | [README_ROADMAP.md](../README_ROADMAP.md#🔐-agroidentityapi) – Identity API endpoints |
| **Register property + multiple plots** | Full | [README_ROADMAP.md](../README_ROADMAP.md#🌾-agrofarmapi) – Farm API + domain models |
| **Crop type per plot** | ✅ Added | [ADR-002-persistence.md](./adr/ADR-002-persistence.md#domain-model-summary-mandatory-attributes) – Plot model |
| **Sensor ingestion API (JWT-protected)** | ✅ Added | [README_ROADMAP.md](../README_ROADMAP.md#📡-agrosensoringestapi) – Ingest API endpoints |
| **Historical sensor charts** | Full | [README_ROADMAP.md](../README_ROADMAP.md#📊-agrodashboardapi) – Dashboard aggregation queries |
| **Plot status badge** | ✅ Added | [README_ROADMAP.md](../README_ROADMAP.md#333-dashboard-queries) – Computed from alert rules (e.g., soil <30% for 24h) |
| **Simple alert engine** | Full | [README_ROADMAP.md](../README_ROADMAP.md#📈-agroanalyticsworker) – Rules + alerts worker |
| **Display alerts on dashboard** | Full | [README_ROADMAP.md](../README_ROADMAP.md#📊-agrodashboardapi) – Alerts endpoints |

### ✅ Technical Requirements (All Covered)

| Requirement | Coverage | Location |
|------------|----------|----------|
| **Microservices** | Full | [ADR-001-microservices.md](./adr/ADR-001-microservices.md) |
| **Kubernetes orchestration** | Full | [ADR-007-node-pool-strategy.md](./adr/ADR-007-node-pool-strategy.md) |
| **APM observability** | Full | [ADR-004-observability.md](./adr/ADR-004-observability.md) |
| **Messaging (async)** | Full | [README_ROADMAP.md](../README_ROADMAP.md#🔄-microservices) – Service Bus |
| **CI/CD pipeline** | ✅ Added note | [README_ROADMAP.md](../README_ROADMAP.md#112-cicd-github-actions) – Local deploy SLA |
| **Software architecture best practices** | Full | [docs/adr/](./adr/) – 7 ADRs documented |

---

## New Additions / Clarifications

### 1. **Plot Status Badge Computation** ✅
- **What:** Dashboard computes status from alert rules (e.g., soil moisture <30% for 24h → "Dry Alert")
- **Where:** [README_ROADMAP.md L476](../README_ROADMAP.md#L476) – Dashboard Queries section
- **Why:** Connects business logic (alert rules) to UI (plot status badge)

### 2. **JWT-Protected Ingestion** ✅
- **What:** All sensor ingestion endpoints must enforce JWT authentication
- **Where:** [README_ROADMAP.md L659](../README_ROADMAP.md#L659) – Ingest API Stack section
- **Why:** Security requirement from hackathon spec

### 3. **Local CI/CD Expectations** ✅
- **What:** For local deploy, CI must run tests, build image, push to registry; green checks required even without cloud
- **Where:** [README_ROADMAP.md L966](../README_ROADMAP.md#L966) – CI/CD Local Deploy Note
- **Why:** Hackathon evaluation criteria for pipelines with local targets

### 4. **Mandatory Deliverables Checklist** ✅
- **What:** Explicit list of 7 minimum deliverables (diagram, infra proof, CI/CD, MVP, video, repos, report)
- **Where:** [README_ROADMAP.md L1034](../README_ROADMAP.md#L1034) – Mandatory Deliverables Section
- **Why:** Evaluation rubric from hackathon spec

### 5. **Delivery Evidence (K8s + APM)** ✅
- **What:** Capture screenshots/exports of K8s objects and APM metrics/traces/logs as delivery package
- **Where:** [infrastructure-terraform.md](./architecture/infrastructure-terraform.md#delivery-evidence-hackathon-8nett) – New section
- **Why:** Technical validation requirement from hackathon spec

### 6. **Alert Rule Consistency** ✅
- **What:** Base alert rules must be defined in both Dashboard.Api and Workbooks
- **Where:** [ADR-004-observability.md](./adr/ADR-004-observability.md#consequences) – Consequences section
- **Why:** Ensures plot status badges stay consistent across API and monitoring views

### 7. **Crop Type in Plot Model** ✅
- **What:** Domain model explicitly includes crop_type attribute
- **Where:** [ADR-002-persistence.md](./adr/ADR-002-persistence.md#domain-model-summary-mandatory-attributes) – New section
- **Why:** Mandatory field per hackathon functional requirements

---

## Documentation Consolidation Strategy

### Current State (Too Many Files)
```
README_ROADMAP.md                          (1100 lines – high-level + details)
GIT_SUBMODULES_STRATEGY.md                 (400 lines – in-depth)
QUICK_START_SUBMODULES.md                  (200 lines – 5-min quickstart)
SOLUTION_STRUCTURE_GUIDE.md                (300 lines – redundant summary)
NEW_MICROSERVICE_TEMPLATE.md               (400 lines – service template)
docs/development/local-setup.md            (200 lines)
docs/development/GITIGNORE_WITH_SUBMODULES.md  (300 lines)
docs/adr/ (7 files)
docs/architecture/ (3 files)
```

### Proposed Consolidation

| Current State | Action | Rationale |
|---------------|--------|-----------|
| **README_ROADMAP.md** | Keep as authoritative source | Main roadmap + phases + tech details + deliverables |
| **GIT_SUBMODULES_STRATEGY.md** | Keep as reference | Complete setup guide (point from README.md) |
| **QUICK_START_SUBMODULES.md** | Keep (referenced by above) | Entry point for developers (5-min) |
| **SOLUTION_STRUCTURE_GUIDE.md** | **Retire / Merge** | Redundant summary – consolidate into GIT_SUBMODULES_STRATEGY.md |
| **NEW_MICROSERVICE_TEMPLATE.md** | Keep (referenced in guides) | Service creation checklist |
| **docs/development/local-setup.md** | Keep | Local environment instructions |
| **docs/development/GITIGNORE_WITH_SUBMODULES.md** | **Merge into** GIT_SUBMODULES_STRATEGY.md | .gitignore strategy is submodule-specific |
| **docs/adr/** | Keep (7 ADRs) | Architectural decisions (concise format) |
| **docs/architecture/** | Keep (3 files) | C4 diagrams + Terraform + Requirements Mapping |

### New File Added
- **docs/REQUIREMENTS_MAPPING.md** (this file) – Traceability from hackathon spec to implementation

### Proposed New README Links
Update **README.md** with:
```markdown
## Quick Navigation

### For Developers (First Time)
1. [5-Minute Quickstart (Git Submodules)](./QUICK_START_SUBMODULES.md)
2. [Local Development Setup](./docs/development/local-setup.md)

### For Architects / Tech Leads
1. [Technical Roadmap (Complete)](./README_ROADMAP.md)
2. [Architectural Decision Records](./docs/adr/)
3. [Requirements Mapping (vs Hackathon 8NETT)](./docs/REQUIREMENTS_MAPPING.md)

### For Adding New Services
1. [New Microservice Template](./NEW_MICROSERVICE_TEMPLATE.md)

### For Git Submodules Deep Dive
1. [Git Submodules Strategy (In-Depth)](./GIT_SUBMODULES_STRATEGY.md)
```

---

## Files Modified / Created

### Modified
| File | Line | Change |
|------|------|--------|
| README_ROADMAP.md | L476 | Added plot status badge computation |
| README_ROADMAP.md | L659 | Added JWT-protected ingestion note |
| README_ROADMAP.md | L966 | Added local CI/CD expectations |
| README_ROADMAP.md | L1034 | Added mandatory deliverables section |
| README_ROADMAP.md | L1094 | Added documentation consolidation notes |
| ADR-004-observability.md | Decision/Consequences | Added plot status badge derivation + rule consistency note |
| ADR-002-persistence.md | Consequences | Added domain model summary (crop_type in Plot) |
| infrastructure-terraform.md | After Environment Strategy | Added delivery evidence section |

### Created
| File | Purpose |
|------|---------|
| docs/REQUIREMENTS_MAPPING.md | Traceability from hackathon spec to roadmap (this file) |

### To Retire (Future)
- **SOLUTION_STRUCTURE_GUIDE.md** – After consolidating into GIT_SUBMODULES_STRATEGY.md
- **docs/development/GITIGNORE_WITH_SUBMODULES.md** – After moving into GIT_SUBMODULES_STRATEGY.md

---

## Compliance Checklist

### Mandatory Requirements (All ✅)
- [x] Authentication (JWT)
- [x] Property/plot registration with crop type
- [x] Authenticated sensor ingestion API
- [x] Historical charts (Dashboard.Api)
- [x] Plot status badges from alert rules
- [x] Simple alert engine (rules + processing)
- [x] Microservices architecture
- [x] Kubernetes orchestration
- [x] APM observability (Application Insights + Workbooks)
- [x] Messaging (Azure Service Bus)
- [x] CI/CD pipeline (GitHub Actions)
- [x] Architecture best practices (ADRs + C4)
- [x] Mandatory deliverables list
- [x] Delivery evidence guidance (K8s + APM)

### Optional Requirements (Not included – per instructions)
- [ ] NoSQL (MongoDB / InfluxDB)
- [ ] Serverless (Lambda / Azure Functions)
- [ ] Weather API integration

---

## Next Steps

1. **Review** this mapping with the team
2. **Execute** doc consolidation (merge GITIGNORE guide, retire SOLUTION_STRUCTURE_GUIDE.md)
3. **Update** README.md with quick navigation links
4. **Validate** all 7 mandatory deliverables are achievable per roadmap
5. **Begin** Phase 0 (infrastructure + code structure)

---

## Summary

✅ **All mandatory requirements from Hackathon 8NETT are now mapped to the roadmap.**

- **No gaps:** Every functional and technical requirement has a documented home (README_ROADMAP.md or ADRs).
- **New clarifications:** Plot status badges, JWT on ingest, local CI/CD, delivery evidence, crop type in model.
- **Documentation health:** Identified redundancy (SOLUTION_STRUCTURE_GUIDE.md, GITIGNORE guide); proposed consolidation.
- **Ready for execution:** Roadmap is complete, traceable, and aligned with evaluation criteria.

**Status:** ✅ Ready for Phase 0 kick-off (January 9, 2026)

