# Requirements Mapping - Hackathon 8NETT vs Current Roadmap

**Date:** January 9, 2026  
**Status:** ✅ Mapped & Integrated

---

## Overview

This document maps mandatory requirements from [HACKATHON%208NETT.pdf](../tech_challenge/HACKATHON%208NETT.pdf) to existing roadmap and ADRs, identifies gaps, and proposes consolidation of documentation.

---

## Functional Requirements Mapping

### ✅ Already Covered in Roadmap

| Requirement                              | Coverage | Location                                                                                                              |
| ---------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------- |
| **Producer login (email/password)**      | Full     | [README_ROADMAP.md](../README_ROADMAP.md#🔐-agroidentityapi) – Identity API endpoints                                 |
| **Register property + multiple plots**   | Full     | [README_ROADMAP.md](../README_ROADMAP.md#🌾-agrofarmapi) – Farm API + domain models                                   |
| **Crop type per plot**                   | ✅ Added | [ADR-002-persistence.md](./adr/ADR-002-persistence.md#domain-model-summary-mandatory-attributes) – Plot model         |
| **Sensor ingestion API (JWT-protected)** | ✅ Added | [README_ROADMAP.md](../README_ROADMAP.md#📡-agrosensoringestapi) – Ingest API endpoints                               |
| **Historical sensor charts**             | Full     | [README_ROADMAP.md](../README_ROADMAP.md#📊-agrodashboardapi) – Dashboard aggregation queries                         |
| **Plot status badge**                    | ✅ Added | [README_ROADMAP.md](../README_ROADMAP.md#333-dashboard-queries) – Computed from alert rules (e.g., soil <30% for 24h) |
| **Simple alert engine**                  | Full     | [README_ROADMAP.md](../README_ROADMAP.md#📈-agroanalyticsworker) – Rules + alerts worker                              |
| **Display alerts on dashboard**          | Full     | [README_ROADMAP.md](../README_ROADMAP.md#📊-agrodashboardapi) – Alerts endpoints                                      |

### ✅ Technical Requirements (All Covered)

| Requirement                              | Coverage      | Location                                                                             |
| ---------------------------------------- | ------------- | ------------------------------------------------------------------------------------ |
| **Microservices**                        | Full          | [ADR-001-microservices.md](./adr/ADR-001-microservices.md)                           |
| **Kubernetes orchestration**             | Full          | [ADR-007-node-pool-strategy.md](./adr/ADR-007-node-pool-strategy.md)                 |
| **APM observability**                    | Full          | [ADR-004-observability.md](./adr/ADR-004-observability.md)                           |
| **Messaging (async)**                    | Full          | [README_ROADMAP.md](../README_ROADMAP.md#🔄-microservices) – Service Bus             |
| **CI/CD pipeline**                       | ✅ Added note | [README_ROADMAP.md](../README_ROADMAP.md#112-cicd-github-actions) – Local deploy SLA |
| **Software architecture best practices** | Full          | [docs/adr/](./adr/) – 7 ADRs documented                                              |

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

### Current State

```
README_ROADMAP.md                          (1100 lines – high-level + details)
BOOTSTRAP_SETUP.md                         (Setup automation guide)
NEW_MICROSERVICE_TEMPLATE.md               (400 lines – service template)
docs/development/local-setup.md            (200 lines)
docs/adr/ (7 files)
docs/architecture/ (3 files)
```

### Documentation Structure

| File                                | Purpose                          | Status    |
| ----------------------------------- | -------------------------------- | --------- |
| **README.md**                       | Main entry point                 | Active    |
| **README_ROADMAP.md**               | Complete technical roadmap       | Active    |
| **NEW_MICROSERVICE_TEMPLATE.md**    | Service creation checklist       | Active    |
| **docs/development/local-setup.md** | Local environment setup          | Active    |
| **docs/REQUIREMENTS_MAPPING.md**    | Hackathon spec traceability      | This file |
| **docs/adr/**                       | Architectural decisions (7 ADRs) | Active    |
| **docs/architecture/**              | C4 diagrams + IaC + domain       | Active    |

### Key Documentation Links

**For Developers (First Time):**

1. [🚀 Bootstrap Setup Guide](../docs/BOOTSTRAP_SETUP.md)
2. [🐳 Local Development Setup](../docs/development/local-setup.md)

**For Architects / Tech Leads:**

1. [📖 Technical Roadmap](../README_ROADMAP.md)
2. [📋 Architectural Decision Records](../docs/adr/)
3. [📊 Requirements Mapping](../docs/REQUIREMENTS_MAPPING.md)

**For Adding New Services:**

1. [📝 New Microservice Template](../NEW_MICROSERVICE_TEMPLATE.md)

---

## Files Modified / Created

### Modified

| File                        | Line                       | Change                                                     |
| --------------------------- | -------------------------- | ---------------------------------------------------------- |
| README_ROADMAP.md           | L476                       | Added plot status badge computation                        |
| README_ROADMAP.md           | L659                       | Added JWT-protected ingestion note                         |
| README_ROADMAP.md           | L966                       | Added local CI/CD expectations                             |
| README_ROADMAP.md           | L1034                      | Added mandatory deliverables section                       |
| README_ROADMAP.md           | L1094                      | Added documentation consolidation notes                    |
| ADR-004-observability.md    | Decision/Consequences      | Added plot status badge derivation + rule consistency note |
| ADR-002-persistence.md      | Consequences               | Added domain model summary (crop_type in Plot)             |
| infrastructure-terraform.md | After Environment Strategy | Added delivery evidence section                            |

### Created

| File                         | Purpose                                                 |
| ---------------------------- | ------------------------------------------------------- |
| docs/REQUIREMENTS_MAPPING.md | Traceability from hackathon spec to roadmap (this file) |

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

1. **Validate** all mandatory deliverables are achievable per roadmap
2. **Begin** Phase 0 (infrastructure + code structure)
3. **Execute** bootstrap and local environment setup

---

## Summary

✅ **All mandatory requirements from Hackathon 8NETT are mapped to the roadmap.**

- **No gaps:** Every functional and technical requirement has a documented home (README_ROADMAP.md or ADRs).
- **Setup simplified:** Git Submodules removed, bootstrap.ps1 handles service cloning
- **Ready for execution:** Roadmap is complete, traceable, and aligned with evaluation criteria.

**Status:** ✅ Ready for Phase 0 kick-off (January 17, 2026)
