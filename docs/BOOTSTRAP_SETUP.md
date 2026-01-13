# 🚀 Bootstrap Setup - TC Agro Solutions

**Data:** January 13, 2026  
**Versão:** 1.0  
**Status:** Production Ready

---

## 📋 Visão Geral

Este documento descreve como configurar o ambiente de desenvolvimento local do TC Agro Solutions usando o script **`bootstrap.ps1`**.

O bootstrap automatiza:
- ✅ Clone de todos os 5 microserviços (via HTTPS)
- ✅ Clone do repositório `common` compartilhado
- ✅ Criação de arquivo `.env` com configurações locais
- ✅ Atualização de repositórios existentes (com confirmação)
- ✅ Preparação da estrutura de pastas

---

## 🏗️ Arquitetura de Pastas

Após bootstrap, a estrutura local será:

```
tc-agro-solutions/
├── services/                                # 🔄 Clonado por bootstrap
│   ├── identity-service/                   # Agro.Identity.Api
│   ├── farm-service/                       # Agro.Farm.Api
│   ├── sensor-ingest-service/              # Agro.Sensor.Ingest.Api
│   ├── analytics-worker/                   # Agro.Analytics.Worker
│   └── dashboard-service/                  # Agro.Dashboard.Api
│
├── common/                                  # 🔄 Clonado por bootstrap
│   ├── (shared libraries)
│   └── (domain models)
│
├── infrastructure/                          # 📦 Infraestrutura (Terraform, Kubernetes)
│   ├── terraform/
│   ├── kubernetes/
│   └── docker/
│
├── scripts/
│   └── bootstrap.ps1                        # ⚙️ Este script
│
├── docs/                                    # 📚 Documentação
│   ├── adr/                                 # Arquitetura Decisions Records
│   ├── architecture/                        # Diagramas e arquitetura
│   └── development/                         # Guias de desenvolvimento
│
├── poc/                                     # 🧪 Frontend POC
│   └── frontend/                            # Dashboard UI demo
│
├── .gitignore                               # Git: ignore services/ e common/
├── .env                                     # ⚙️ Criado por bootstrap
├── docker-compose.yml                       # 🐳 Orquestração local (futuro)
├── README.md                                # 📖 Início rápido
└── tc-agro-solutions.sln                    # 🔧 Solution (.NET)
```

---

## 🚀 Quick Start

### Pré-requisitos

- **Git** instalado
- **Docker** instalado e rodando
- **PowerShell 5.0+** (Windows) ou **PowerShell Core** (qualquer SO)
- **Visual Studio 2026** (para abrir a solution)

### 1️⃣ Clonar o Repositório

```powershell
git clone https://github.com/rdpresser/tc-agro-solutions.git
cd tc-agro-solutions
```

### 2️⃣ Executar Bootstrap

```powershell
# Executar com todos os defaults
.\scripts\bootstrap.ps1
```

Isso irá:
1. Criar pastas `services/` e `common/`
2. Clonar todos os 5 serviços
3. Clonar o repositório `common`
4. Criar arquivo `.env` com configurações padrão
5. Oferecer para subir `docker-compose` (será criado manualmente)

### 3️⃣ Abrir Solution

```powershell
# Abrir no Visual Studio
start tc-agro-solutions.sln
```

Ou abra manualmente com Visual Studio 2026 → File → Open → Solution

### 4️⃣ Adicionar Projetos à Solution

No Visual Studio, adicione os projetos dos serviços:

```
Right-click Solution → Add → Existing Project
```

Adicione cada `.csproj`:
- `services/identity-service/src/Agro.Identity.Api/Agro.Identity.Api.csproj`
- `services/farm-service/src/Agro.Farm.Api/Agro.Farm.Api.csproj`
- Etc...

### 5️⃣ Subir Infraestrutura

```powershell
# Criar docker-compose.yml manualmente (será documentado separadamente)
# Ou usar um template existente

docker compose up -d
```

Isso sobe:
- PostgreSQL (porta 5432)
- Redis (porta 6379)
- RabbitMQ (portas 5672 e 15672)

---

## ⚙️ Parâmetros do Script

### Executar com Defaults

```powershell
.\scripts\bootstrap.ps1
```

Clone/pull de tudo, pergunta sobre docker-compose.

### Não fazer Pull em Repos Existentes

```powershell
.\scripts\bootstrap.ps1 -NoPull
```

Se os serviços já existem, apenas skip o pull. Útil para CI/CD.

### Não Subir Docker Compose

```powershell
.\scripts\bootstrap.ps1 -NoUp
```

Clona/pull tudo, mas não executa `docker compose up`.

### Combinar Parâmetros

```powershell
.\scripts\bootstrap.ps1 -NoPull -NoUp
```

Apenas clona o que não existe, não atualiza nada.

---

## 📝 Arquivo `.env` Gerado

O bootstrap cria um arquivo `.env` na raiz com configurações seguras para desenvolvimento:

```bash
# Ambiente
ASPNETCORE_ENVIRONMENT=Development

# PostgreSQL
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=agro
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# RabbitMQ
RABBITMQ_HOST=rabbitmq
RABBITMQ_USER=guest
RABBITMQ_PASSWORD=guest

# JWT
JWT_ISSUER=http://localhost:5001
JWT_AUDIENCE=http://localhost:5000
JWT_SECRET_KEY=your-256-bit-secret-key-change-in-production-12345678

# Portas dos Serviços
IDENTITY_HTTP_PORT=5001
FARM_HTTP_PORT=5002
SENSOR_INGEST_HTTP_PORT=5003
ANALYTICS_WORKER_HTTP_PORT=5004
DASHBOARD_HTTP_PORT=5005
```

⚠️ **Importante:** Este `.env` é apenas para desenvolvimento local. Em produção, use Azure Key Vault.

---

## 🔄 Workflow Diário

### Atualizar Todos os Serviços

```powershell
cd c:\Projects\tc-agro-solutions

# Clonar/atualizar tudo com confirmação interativa
.\scripts\bootstrap.ps1
```

### Trabalhar em um Serviço Específico

```powershell
# Entrar na pasta do serviço
cd services\identity-service

# Criar feature branch
git checkout -b feature/new-endpoint

# Fazer mudanças
# ...

# Commit e push
git add .
git commit -m "feat: add new endpoint"
git push origin feature/new-endpoint

# Voltar para raiz
cd ..\..
```

### Testar Localmente (sem Docker)

```powershell
# Entrar na pasta do serviço
cd services\identity-service\src\Agro.Identity.Api

# Rodar diretamente
dotnet run

# Será disponível em http://localhost:5001
```

---

## 🐳 Docker Compose (Próximo Passo)

O bootstrap **não cria** `docker-compose.yml` automaticamente. Você precisa:

1. **Criar manualmente** (ou usar template que será fornecido)
2. **Adicionar os serviços** que foram clonados
3. **Executar**:

```powershell
docker compose up -d
```

---

## 🔧 Troubleshooting

### Erro: Git não encontrado

```
Comando 'git' não encontrado.
```

**Solução:** Instale Git do site https://git-scm.com/

### Erro: Docker não encontrado

```
Comando 'docker' não encontrado.
```

**Solução:** Instale Docker Desktop de https://www.docker.com/products/docker-desktop

### Repo já existe - quer fazer pull?

O script pergunta interativamente se deseja atualizar repos existentes:

```
ℹ identity-service já existe em services/identity-service
Deseja fazer pull (git pull origin main) em identity-service? (s/n): s
```

Responda `s` para atualizar ou `n` para manter como está.

### Falha ao clonar um repo

```
✗ Falha ao clonar identity-service
```

**Verificar:**
- Conexão internet funcionando
- URLs corretas em `scripts/bootstrap.ps1`
- Permissões de acesso ao repositório

### PowerShell: Execution Policy

Se receber erro sobre execution policy:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

## 📚 Estrutura de Repositórios

### Services (5 repositórios independentes)

| Repositório | URL | Pasta Local |
|------------|-----|-------------|
| tc-agro-identity-service | https://github.com/rdpresser/tc-agro-identity-service.git | `services/identity-service` |
| tc-agro-farm-service | https://github.com/rdpresser/tc-agro-farm-service.git | `services/farm-service` |
| tc-agro-sensor-ingest-service | https://github.com/rdpresser/tc-agro-sensor-ingest-service.git | `services/sensor-ingest-service` |
| tc-agro-analytics-worker | https://github.com/rdpresser/tc-agro-analytics-worker.git | `services/analytics-worker` |
| tc-agro-dashboard-service | https://github.com/rdpresser/tc-agro-dashboard-service.git | `services/dashboard-service` |

### Common (1 repositório compartilhado)

| Repositório | URL | Pasta Local |
|------------|-----|-------------|
| tc-agro-common | https://github.com/rdpresser/tc-agro-common.git | `common` |

---

## 🎯 Próximos Passos

1. ✅ **Executar bootstrap**: `.\scripts\bootstrap.ps1`
2. ✅ **Verificar estrutura**: `dir services`, `dir common`
3. ✅ **Abrir solution**: `start tc-agro-solutions.sln`
4. ✅ **Adicionar projetos** à solution (Add Existing Project)
5. ⏳ **Criar docker-compose.yml** (será documentado)
6. ⏳ **Executar**: `docker compose up -d`
7. ⏳ **Testar APIs** com Swagger

---

## 📖 Documentação Relacionada

- [Local Development Setup](./development/local-setup.md) - Ambiente local detalhado
- [Architecture Decisions (ADRs)](./adr/) - Decisões arquiteturais
- [README Principal](../README.md) - Overview do projeto

---

## ❓ FAQ

**P: Por que não usar Git Submodules?**  
R: Submodules adicionam complexidade sem benefício significativo. O bootstrap em PowerShell é mais simples e idempotente.

**P: E se um repositório estiver privado?**  
R: O script usa HTTPS. Configure seu GitHub token via:
```bash
git config --global credential.helper wincred
```

**P: Posso clonar só alguns serviços?**  
R: Edite o array `$repos` no script `bootstrap.ps1` e remova os que não quer.

**P: Como fazer pull de novos commits?**  
R: Execute o bootstrap novamente e responda `s` para pull.

---

## 🤝 Contribuindo

1. Clone/pull via bootstrap
2. Crie feature branch em um serviço
3. Commit e push para seu fork
4. Abra PR no repositório específico do serviço
5. Após merge, volte à raiz e execute bootstrap para sincronizar

---

> **Versão:** 1.0  
> **Última atualização:** January 13, 2026  
> **Status:** Production Ready  
> **Próximo:** Criar docker-compose.yml centralizado
