# 🧑‍💻 Local Development Setup

This document describes how to run the entire TC Agro Solutions project locally without Azure dependencies.

---

## 📌 Prerequisites

### Required
- **Docker Desktop** (with Docker Compose v2)
- **.NET 9 SDK** ([Download](https://dotnet.microsoft.com/download/dotnet/9.0))
- **Git**

### Optional
- **k3d** or **kind** (for local Kubernetes testing)
- **kubectl** (Kubernetes CLI)
- **Make** (for simplified commands)

---

## 🧩 Local Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Database | PostgreSQL 16 | Persistent storage |
| Time Series | TimescaleDB | Sensor data (hypertables) |
| Cache | Redis 7 | Query caching |
| Messaging | RabbitMQ | Event streaming (Service Bus replacement) |
| Backend | .NET 9 | Microservices |
| Orchestration | Docker Compose | Service coordination |

---

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/your-org/tc-agro-solutions.git
cd tc-agro-solutions
```

### 2. Start Infrastructure Services
```bash
docker compose up -d postgres redis rabbitmq
```

### 3. Apply Database Migrations
```bash
dotnet ef database update --project src/Agro.Identity.Api
dotnet ef database update --project src/Agro.Farm.Api
dotnet ef database update --project src/Agro.Sensor.Ingest.Api
```

### 4. Start Microservices
```bash
# Option A: Run all via Docker Compose
docker compose up -d

# Option B: Run services individually for debugging
dotnet run --project src/Agro.Identity.Api
dotnet run --project src/Agro.Farm.Api
dotnet run --project src/Agro.Sensor.Ingest.Api
dotnet run --project src/Agro.Analytics.Worker
dotnet run --project src/Agro.Dashboard.Api
```

### 5. Verify Services
```bash
# Check all containers are running
docker compose ps

# Check API health
curl http://localhost:5001/health  # Identity
curl http://localhost:5002/health  # Farm
curl http://localhost:5003/health  # Ingest
curl http://localhost:5004/health  # Dashboard
```

---

## 🔧 Service Configuration

### 🗄️ PostgreSQL
- **Host:** `localhost`
- **Port:** `5432`
- **Database:** `agro_db`
- **User:** `postgres`
- **Password:** `postgres`

**Connection String:**
```
Host=localhost;Port=5432;Database=agro_db;Username=postgres;Password=postgres
```

**TimescaleDB Extension:** Enabled automatically on database creation.

### 📬 RabbitMQ (Azure Service Bus Replacement)
- **AMQP URL:** `amqp://localhost:5672`
- **Management UI:** [http://localhost:15672](http://localhost:15672)
- **User:** `guest`
- **Password:** `guest`

**Access Management UI:**
Navigate to http://localhost:15672 and login with `guest` / `guest`.

### ⚡ Redis
- **Host:** `localhost`
- **Port:** `6379`
- **Password:** _(none for local)_

**Connection String:**
```
localhost:6379
```

### 🚀 Microservices APIs

| Service | URL | Swagger |
|---------|-----|---------|
| **Identity** | http://localhost:5001 | [/swagger](http://localhost:5001/swagger) |
| **Farm** | http://localhost:5002 | [/swagger](http://localhost:5002/swagger) |
| **Ingest** | http://localhost:5003 | [/swagger](http://localhost:5003/swagger) |
| **Dashboard** | http://localhost:5004 | [/swagger](http://localhost:5004/swagger) |
| **Analytics Worker** | _(background service)_ | N/A |

---

## 🧪 Testing the Stack

### 1. Create a User (Identity API)
```bash
curl -X POST http://localhost:5001/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@agro.local",
    "password": "Test@1234"
  }'
```

### 2. Login and Get JWT Token
```bash
curl -X POST http://localhost:5001/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@agro.local",
    "password": "Test@1234"
  }'
```

### 3. Create a Property (Farm API)
```bash
TOKEN="<your-jwt-token>"

curl -X POST http://localhost:5002/properties \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Farm",
    "location": "São Paulo, SP",
    "areaHectares": 150.5
  }'
```

### 4. Ingest Sensor Data (Ingest API)
```bash
curl -X POST http://localhost:5003/sensors/readings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sensorId": "Sensor123",
    "timestamp": "2026-01-09T10:30:00Z",
    "temperature": 28.5,
    "humidity": 65.2,
    "soilMoisture": 42.1
  }'
```

### 5. Query Dashboard (Dashboard API)
```bash
curl -X GET http://localhost:5004/dashboard/latest \
  -H "Authorization: Bearer $TOKEN"
```

---

## 🛠️ Development Workflow

### Running Migrations
```bash
# Add a new migration
dotnet ef migrations add <MigrationName> --project src/Agro.Farm.Api

# Apply migrations
dotnet ef database update --project src/Agro.Farm.Api

# Rollback to specific migration
dotnet ef database update <MigrationName> --project src/Agro.Farm.Api
```

### Seeding Test Data
```bash
# Run seeder (if implemented)
dotnet run --project src/Agro.Farm.Api -- --seed
```

### Viewing Logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f postgres
docker compose logs -f rabbitmq

# .NET service logs (if running via dotnet run)
# Logs appear in console
```

### Cleaning Up
```bash
# Stop all services
docker compose down

# Stop and remove volumes (deletes data)
docker compose down -v

# Remove all images
docker compose down --rmi all
```

---

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Find process using port 5432
netstat -ano | findstr :5432  # Windows
lsof -i :5432                 # macOS/Linux

# Kill the process or change port in docker-compose.yml
```

### Database Connection Issues
```bash
# Verify PostgreSQL is running
docker compose ps postgres

# Check PostgreSQL logs
docker compose logs postgres

# Test connection
docker exec -it agro-postgres psql -U postgres -d agro_db
```

### RabbitMQ Connection Issues
```bash
# Verify RabbitMQ is running
docker compose ps rabbitmq

# Check management UI
open http://localhost:15672

# View RabbitMQ logs
docker compose logs rabbitmq
```

### Migration Errors
```bash
# Drop database and recreate
docker compose down -v
docker compose up -d postgres
dotnet ef database update --project src/Agro.Farm.Api
```

---

## 📦 Environment Variables

Create a `.env` file at the repository root:

```bash
# Database
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=agro_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# RabbitMQ
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_USER=guest
RABBITMQ_PASSWORD=guest

# JWT
JWT_SECRET=your-256-bit-secret-key-change-in-production
JWT_ISSUER=https://agro.local
JWT_AUDIENCE=https://agro.local

# Logging
LOG_LEVEL=Information
```

---

## 🎯 Next Steps

After successfully running locally:
1. Review [API Conventions](api-conventions.md)
2. Read [Testing Strategy](testing-strategy.md)
3. Check [Deployment Checklist](deployment-checklist.md) for Azure deployment
4. Explore [Architecture Decisions](../adr/) to understand design choices

---

## 📚 Additional Resources

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [.NET 9 Documentation](https://learn.microsoft.com/dotnet/)
- [PostgreSQL + TimescaleDB](https://docs.timescale.com/)
- [RabbitMQ Management](https://www.rabbitmq.com/management.html)

---

> **Note:** This local setup is for development only. For production deployment to Azure, refer to [Deployment Guide](../architecture/deployment.md).
