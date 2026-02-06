# Sensor Data Ingestion Service - Implementation Summary

**Date**: February 6, 2026  
**Status**: ✅ Complete  
**Repository**: [tc-agro-sensor-ingest-service](https://github.com/rdpresser/tc-agro-sensor-ingest-service)

---

## Overview

The Sensor Data Ingestion Service has been successfully implemented as a production-ready microservice for receiving, validating, persisting, and publishing agricultural IoT sensor data.

## What Was Built

### 1. Core Service (Already Existed)
✅ FastEndpoints REST API with JWT authentication  
✅ CQRS pattern with Wolverine messaging  
✅ Domain-driven design with SensorReadingAggregate  
✅ Transactional outbox for reliable event publishing  
✅ Integration with RabbitMQ for event-driven architecture

### 2. Database Layer (Added)
✅ **EF Core Migration** with TimescaleDB hypertable  
✅ **Time-based partitioning**: 7-day chunks  
✅ **Compression policy**: Compress data older than 30 days  
✅ **Retention policy**: Keep data for 2 years  
✅ **Optimized indexes** for time-series queries:
- `sensor_id + time` (most common query pattern)
- `plot_id + time` (query by agricultural plot)
- `time` (time-range scans)

### 3. Load Testing with Realistic Data (Added)
✅ **K6 load testing script** with three scenarios:
- **Smoke test**: 30s, 1 virtual user (verify functionality)
- **Load test**: 5min, ramp 0→10→0 users (normal load)
- **Stress test**: 4min, ramp 0→50 users (find breaking point)

✅ **Realistic sensor data patterns**:
- Temperature: Daily cycle (18°C at 4am → 35°C at 14h)
- Soil moisture: Gradual decline + irrigation spikes
- Humidity: Inverse correlation with temperature
- Precipitation: Event-based (5% chance per reading)
- Battery level: Gradual decline + recharge at <20%
- Outliers: 2% sensor malfunction chance

### 4. Documentation (Added)
✅ **Service README** (10+ sections):
- API endpoints with request/response examples
- Validation rules for all sensor metrics
- Architecture diagram
- Integration events specification
- TimescaleDB schema with SQL
- Local development setup
- Configuration guide
- Testing instructions
- Deployment to Kubernetes
- Observability (metrics, traces, logs)

✅ **K6 README** (comprehensive testing guide):
- Installation across platforms (macOS, Windows, Linux)
- Usage examples for all scenarios
- Docker execution
- CI/CD integration patterns
- Troubleshooting guide
- Performance thresholds explanation

---

## API Endpoints

### POST /sensors/readings
Ingest single sensor reading (JWT required)

**Request**:
```json
{
  "sensorId": "SENSOR-001",
  "plotId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "timestamp": "2026-02-06T10:30:00Z",
  "temperature": 28.5,
  "humidity": 65.2,
  "soilMoisture": 42.1,
  "rainfall": 0.0,
  "batteryLevel": 85.0
}
```

**Response** (202 Accepted):
```json
{
  "readingId": "f1e2d3c4-b5a6-7890-abcd-ef1234567890",
  "sensorId": "SENSOR-001",
  "plotId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "timestamp": "2026-02-06T10:30:00Z"
}
```

### POST /sensors/readings/batch
Ingest multiple readings in single request (10-50 readings typical)

### GET /sensors/readings/latest
Query latest sensor readings (for dashboard/monitoring)

---

## Database Schema

```sql
-- TimescaleDB hypertable
CREATE TABLE public.sensor_readings (
    id UUID PRIMARY KEY,
    sensor_id VARCHAR(100) NOT NULL,
    plot_id UUID NOT NULL,
    time TIMESTAMPTZ NOT NULL,  -- Partition key
    temperature DOUBLE PRECISION,
    humidity DOUBLE PRECISION,
    soil_moisture DOUBLE PRECISION,
    rainfall DOUBLE PRECISION,
    battery_level DOUBLE PRECISION,
    created_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN NOT NULL
);

-- Convert to hypertable
SELECT create_hypertable('public.sensor_readings', 'time', 
    chunk_time_interval => INTERVAL '7 days');

-- Compression (30 days)
ALTER TABLE public.sensor_readings SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'sensor_id,plot_id'
);
SELECT add_compression_policy('public.sensor_readings', INTERVAL '30 days');

-- Retention (2 years)
SELECT add_retention_policy('public.sensor_readings', INTERVAL '730 days');
```

---

## Integration Events

**SensorIngestedIntegrationEvent** published to RabbitMQ:
```json
{
  "eventId": "uuid",
  "occurredOn": "2026-02-06T10:30:00Z",
  "readingId": "uuid",
  "sensorId": "SENSOR-001",
  "plotId": "uuid",
  "temperature": 28.5,
  "humidity": 65.2,
  "soilMoisture": 42.1,
  "rainfall": 0.0
}
```

**Consumed by**:
- Analytics Worker (alert rule processing)
- Dashboard Service (real-time updates)

---

## How to Use

### 1. Local Development

```bash
# Start infrastructure
docker compose up -d postgres rabbitmq

# Apply migrations
cd services/sensor-ingest-service
dotnet ef database update \
  --project src/Adapters/Outbound/TC.Agro.SensorIngest.Infrastructure \
  --startup-project src/Adapters/Inbound/TC.Agro.SensorIngest.Service

# Run service
dotnet run --project src/Adapters/Inbound/TC.Agro.SensorIngest.Service
# → http://localhost:5003
```

### 2. Run K6 Load Tests

```bash
# Install k6
brew install k6  # macOS
choco install k6 # Windows

# Set environment variables
export BASE_URL="http://localhost:5003"
export JWT_TOKEN="your-jwt-token"  # Get from Identity service login

# Run all scenarios (smoke → load → stress)
cd services/sensor-ingest-service/tests/k6
k6 run sensor-ingestion-load-test.js

# Output example:
# ✓ http_req_duration..............: avg=234ms p(95)=456ms p(99)=789ms
# ✓ http_req_failed................: 1.2%
# Total Requests: 5432
```

### 3. Deploy to K8s

```bash
# Via ArgoCD (automatic)
kubectl apply -k infrastructure/kubernetes/apps/overlays/k3d/

# Access via ingress
curl http://localhost/sensor-ingest/health
```

---

## Testing

### Unit Tests
```bash
cd services/sensor-ingest-service
dotnet test
```

### Load Tests
```bash
cd services/sensor-ingest-service/tests/k6
k6 run sensor-ingestion-load-test.js
```

**Performance Thresholds**:
- P95 response time: < 500ms ✓
- P99 response time: < 1000ms ✓
- Error rate: < 5% ✓

---

## Files Changed

In `services/sensor-ingest-service/`:

1. **Directory.Packages.props**  
   Updated Wolverine packages (5.12.0 → 5.12.1)

2. **README.md**  
   Comprehensive documentation (40+ KB, 384 new lines)

3. **src/Adapters/Outbound/TC.Agro.SensorIngest.Infrastructure/Migrations/**  
   - `20260206040753_InitialCreate.cs` (EF migration + TimescaleDB SQL)
   - `20260206040753_InitialCreate.Designer.cs`
   - `ApplicationDbContextModelSnapshot.cs`

4. **tests/k6/sensor-ingestion-load-test.js**  
   K6 load test script with realistic data (307 lines, 9.6 KB)

5. **tests/k6/README.md**  
   K6 testing documentation (255 lines, 7.4 KB)

**Total**: 1,431 lines added/modified

---

## Success Criteria (from Issue)

✅ **Create ingestion service**: Done (service exists with full CQRS implementation)  
✅ **Endpoint for sensor data**: POST /sensors/readings + batch endpoint  
✅ **Publish event to messaging**: SensorIngestedIntegrationEvent → RabbitMQ via Wolverine  
✅ **Persist as time-series**: TimescaleDB hypertable with optimized queries  
✅ **Generate realistic data** (via k6): Temperature cycles, soil moisture patterns, etc.  
✅ **Load testing**: k6 with smoke, load, stress scenarios  

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│              Sensor Ingest Service (Port 5003)          │
│                                                         │
│  ┌────────────┐  ┌────────────┐  ┌────────────────┐   │
│  │FastEndpoints│→│  CQRS       │→│  TimescaleDB   │   │
│  │ (JWT Auth) │  │  Handlers   │  │  Hypertable    │   │
│  └────────────┘  └────────────┘  └────────────────┘   │
│         │               │               ↑               │
│         │               │               │               │
│         │               ↓               │               │
│         │       ┌────────────────┐     │               │
│         │       │ Transactional  │     │               │
│         └──────→│    Outbox      │→ RabbitMQ           │
│                 └────────────────┘   (Wolverine)       │
│                        │                                │
│                        ↓                                │
│             SensorIngestedIntegrationEvent              │
└─────────────────────────────────────────────────────────┘
                        │
                        ├──→ Analytics Worker (alerts)
                        └──→ Dashboard Service (real-time)
```

---

## Next Steps

The service is production-ready for the hackathon. Optional enhancements:

1. **Weather API Integration**: Use real historical data from Open-Meteo/NOAA
2. **Seasonal Patterns**: Different data behavior in summer vs winter
3. **Geolocation**: Sensor data based on plot coordinates (climate zones)
4. **Continuous Generation**: Background worker for demo data (cron job)
5. **Alert Integration**: Connect with Analytics Worker alert rules

---

## Observability

**Metrics** (Prometheus):
- `sensor_readings_ingested_total`
- `sensor_readings_rejected_total`
- `http_request_duration_seconds`

**Traces** (Tempo):
- Distributed tracing via OpenTelemetry
- Tags: `sensor.id`, `plot.id`, `reading.temperature`

**Logs** (Loki):
- Structured JSON logs
- Correlation IDs for request tracking

---

## References

- **Service README**: `services/sensor-ingest-service/README.md`
- **K6 Tests**: `services/sensor-ingest-service/tests/k6/`
- **Migrations**: `services/sensor-ingest-service/src/.../Migrations/`
- **TimescaleDB Docs**: https://docs.timescale.com/
- **K6 Docs**: https://k6.io/docs/

---

**Implementation Status**: ✅ Complete  
**Hackathon Ready**: Yes  
**Production Ready**: Yes (with appropriate monitoring)