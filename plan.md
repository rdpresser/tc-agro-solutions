Status: Approved by user on 2026-04-29. Implementation phase requested.


## Plan: External Infra Startup Strategy for TC Agro

Refactor orchestration to decouple application startup from Docker Compose by introducing a dedicated Aspire AppHost for process orchestration and external infrastructure binding. Keep Docker Compose for infra-local scenarios, but make runtime startup of services independent from containers. Reuse existing options binding and validation in SharedKernel to avoid duplication.

**Steps**
1. Phase 1 - Baseline Assessment and Constraints
1. Confirm and document current orchestration behavior and coupling points in [orchestration/apphost-compose/docker-compose.yml](orchestration/apphost-compose/docker-compose.yml), [orchestration/apphost-compose/docker-compose.override.yml](orchestration/apphost-compose/docker-compose.override.yml), [orchestration/apphost-compose/src/TC.Agro.AppHost.Compose/Program.cs](orchestration/apphost-compose/src/TC.Agro.AppHost.Compose/Program.cs), and [orchestration/apphost-compose/docker-compose.dcproj](orchestration/apphost-compose/docker-compose.dcproj).
2. Confirm service runtime config model and externalization viability through [common/src/TC.Agro.SharedKernel/Infrastructure/DependencyInjection.cs](common/src/TC.Agro.SharedKernel/Infrastructure/DependencyInjection.cs), [common/src/TC.Agro.SharedKernel/Infrastructure/Database/PostgresOptions.cs](common/src/TC.Agro.SharedKernel/Infrastructure/Database/PostgresOptions.cs), [common/src/TC.Agro.SharedKernel/Infrastructure/Caching/Provider/RedisOptions.cs](common/src/TC.Agro.SharedKernel/Infrastructure/Caching/Provider/RedisOptions.cs), [common/src/TC.Agro.SharedKernel/Infrastructure/MessageBroker/RabbitMqOptions.cs](common/src/TC.Agro.SharedKernel/Infrastructure/MessageBroker/RabbitMqOptions.cs), and service Program/Extensions files.
3. Record critical architectural constraints: do not duplicate config logic, preserve current env naming, preserve local Docker flows, and support Linux host process execution.

2. Phase 2 - Recommended Architecture (Plan A)
1. Create a new orchestration project under orchestration/apphost-aspire (for example TC.Agro.AppHost.Aspire) dedicated to process startup and environment injection for services: identity, farm, sensor-ingest, analytics-worker. Depends on phase 1.
2. Add InfraSettings section with UseExternalResources toggle, aligned with reference pattern from [src/MT.Saga.AppHost.Aspire/AppHost.cs](../mt-saga-order-processing/src/MT.Saga.AppHost.Aspire/AppHost.cs) and [src/MT.Saga.AppHost.Aspire/Configuration/OrchestrationOptions.cs](../mt-saga-order-processing/src/MT.Saga.AppHost.Aspire/Configuration/OrchestrationOptions.cs).
3. Add dual mode in AppHost:
1. External mode: require ConnectionStrings and endpoint settings for Redis/RabbitMQ/Postgres/OTLP and inject into service processes.
2. Internal mode: optional local managed infra (Aspire containers) only if needed for dev parity.
4. Keep service startup code unchanged as much as possible by reusing existing hierarchical configuration keys already consumed by SharedKernel and service extensions (Database__Postgres__*, Cache__Redis__*, Messaging__RabbitMQ__*, Auth__Jwt__*, Telemetry__Grafana__*).
5. Introduce one shared configuration contract class in common for orchestration-level validation only if needed, but do not re-implement existing PostgresOptions/RedisOptions/RabbitMqOptions.

3. Phase 3 - Configuration Model Hardening
1. Define canonical config source precedence for host-run mode: env file -> environment variables -> appsettings.Development.json.
2. Create host-run examples:
1. .env.external.example for proxmox LXC services endpoints (build-server runtime).
2. Keep .env.example and .env.k3d.example as infra templates for compose/k3d.
3. Add explicit validation of mandatory settings when UseExternalResources=true (fail fast with actionable errors), mirroring mt-saga EnsureExternalConnectionString pattern.
4. Ensure connection string support and section-based support both work (connection string preferred if present, section fallback), to reduce operational friction.

4. Phase 4 - Plan B (If avoiding new AppHost project)
1. Evaluate updating current compose startup to support a no-compose mode in [orchestration/apphost-compose/src/TC.Agro.AppHost.Compose/Program.cs](orchestration/apphost-compose/src/TC.Agro.AppHost.Compose/Program.cs), but treat as fallback due architectural ambiguity.
2. Risk assessment for Plan B:
1. Current project is a minimal web host and not a real orchestrator.
2. It is packaged with docker-compose.dcproj semantics, increasing conceptual confusion for non-container startup.
3. Recommendation: do not overload this project with orchestration responsibilities.

5. Phase 5 - Migration and Rollout Strategy
1. Preserve existing workflows: docker compose and k3d scripts continue working unchanged during transition. Parallel with phase 2.
2. Add new host-run workflow commands to run services outside containers with external infra endpoints.
3. Pilot on one service first (identity) in external mode, then scale to farm, sensor-ingest, analytics-worker.
4. Add clear runbooks in existing docs paths (only if requested) for Linux host startup and troubleshooting.

6. Phase 6 - Verification and Quality Gates
1. Configuration validation:
1. Start AppHost external mode with intentionally missing setting and verify fail-fast message quality.
2. Start with full external settings and verify each service binds expected endpoints.
2. Runtime validation:
1. Health endpoints for all services respond.
2. DB connectivity/migrations succeed against external Postgres.
3. RabbitMQ publishing/consuming works for at least one end-to-end flow.
4. Redis cache read/write and invalidation behavior validated.
3. Observability validation:
1. Logs/traces/metrics exported to podman-hosted Grafana stack endpoint.
4. Non-regression:
1. Existing docker compose up and k3d flow still operate.

**Relevant files**
- [orchestration/apphost-compose/src/TC.Agro.AppHost.Compose/Program.cs](orchestration/apphost-compose/src/TC.Agro.AppHost.Compose/Program.cs) — current startup project is minimal and not orchestration-capable.
- [orchestration/apphost-compose/docker-compose.yml](orchestration/apphost-compose/docker-compose.yml) — infra and service orchestration coupling map.
- [orchestration/apphost-compose/docker-compose.override.yml](orchestration/apphost-compose/docker-compose.override.yml) — developer behavior and service env injection details.
- [orchestration/apphost-compose/.env.example](orchestration/apphost-compose/.env.example) — current hierarchical env model and keys to preserve.
- [orchestration/apphost-compose/.env.k3d.example](orchestration/apphost-compose/.env.k3d.example) — sensitive settings model reference.
- [common/src/TC.Agro.SharedKernel/Infrastructure/DependencyInjection.cs](common/src/TC.Agro.SharedKernel/Infrastructure/DependencyInjection.cs) — central options validation for database/cache/messaging/auth/telemetry.
- [common/src/TC.Agro.SharedKernel/Infrastructure/Database/PostgresOptions.cs](common/src/TC.Agro.SharedKernel/Infrastructure/Database/PostgresOptions.cs) — connection string composition and SSL support.
- [common/src/TC.Agro.SharedKernel/Infrastructure/Caching/Provider/RedisOptions.cs](common/src/TC.Agro.SharedKernel/Infrastructure/Caching/Provider/RedisOptions.cs) — secure/non-secure Redis endpoint handling.
- [common/src/TC.Agro.SharedKernel/Infrastructure/MessageBroker/RabbitMqOptions.cs](common/src/TC.Agro.SharedKernel/Infrastructure/MessageBroker/RabbitMqOptions.cs) — AMQP URI assembly.
- [services/identity-service/src/Adapters/Inbound/TC.Agro.Identity.Service/Extensions/ServiceCollectionExtensions.cs](services/identity-service/src/Adapters/Inbound/TC.Agro.Identity.Service/Extensions/ServiceCollectionExtensions.cs) — Wolverine RabbitMQ bootstrap pattern.
- [services/farm-service/src/Adapters/Inbound/TC.Agro.Farm.Service/Extensions/ServiceCollectionExtensions.cs](services/farm-service/src/Adapters/Inbound/TC.Agro.Farm.Service/Extensions/ServiceCollectionExtensions.cs) — same pattern with consumer/publisher setup.
- [services/sensor-ingest-service/src/Adapters/Inbound/TC.Agro.SensorIngest.Service/Extensions/ServiceCollectionExtensions.cs](services/sensor-ingest-service/src/Adapters/Inbound/TC.Agro.SensorIngest.Service/Extensions/ServiceCollectionExtensions.cs) — same pattern with additional event wiring.
- [services/analytics-worker/src/Adapters/Inbound/TC.Agro.Analytics.Service/Extensions/ServiceCollectionExtensions.cs](services/analytics-worker/src/Adapters/Inbound/TC.Agro.Analytics.Service/Extensions/ServiceCollectionExtensions.cs) — worker-side consumer setup.
- [../mt-saga-order-processing/src/MT.Saga.AppHost.Aspire/AppHost.cs](../mt-saga-order-processing/src/MT.Saga.AppHost.Aspire/AppHost.cs) — reference orchestration with external resource toggle.
- [../mt-saga-order-processing/src/MT.Saga.AppHost.Aspire/Configuration/OrchestrationOptions.cs](../mt-saga-order-processing/src/MT.Saga.AppHost.Aspire/Configuration/OrchestrationOptions.cs) — reference options model.

**Verification**
1. Run startup in external mode with your Proxmox endpoints and confirm all services reach healthy status.
2. Run functional path: identity auth -> farm operation -> sensor ingest -> analytics consumption, validating RabbitMQ routing and DB writes.
3. Validate telemetry ingestion to podman-hosted stack using OTLP endpoint and dashboard traces/logs/metrics.
4. Run existing compose and k3d workflows unchanged and confirm no regression.
5. Build and unit test each service after orchestration integration changes.

**Decisions**
- Preferred approach: create new AppHost Aspire orchestration project for external/internal toggle support.
- Preserve current compose project as dedicated container orchestration path (do not overload).
- Avoid duplicated configuration classes; reuse SharedKernel options and key naming.
- Keep compatibility with current env examples while introducing external-mode focused example.

**Further Considerations**
1. Connection string source of truth recommendation: prefer ConnectionStrings for infra endpoints in orchestration, keep section-based keys for service-level options compatibility.
2. For production hardening, migrate sensitive values to secret managers and keep env examples non-sensitive.
3. If Azure Service Bus migration is planned later, abstract messaging transport selection now to avoid RabbitMQ-only assumptions in future orchestration.