param(
    [switch]$NoPull = $false,
    [switch]$NoUp = $false
)

$ErrorActionPreference = "Stop"

# ===========================
# FUNÇÕES AUXILIARES
# ===========================

function Write-Header($msg) {
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║ $msg" -ForegroundColor Cyan
    Write-Host "╚════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Step($msg) {
    Write-Host ""
    Write-Host "==> $msg" -ForegroundColor Green
}

function Write-Info($msg) {
    Write-Host "    ℹ $msg" -ForegroundColor DarkGray
}

function Write-Warning($msg) {
    Write-Host "    ⚠ $msg" -ForegroundColor Yellow
}

function Write-Success($msg) {
    Write-Host "    ✓ $msg" -ForegroundColor Green
}

function Write-Error-Custom($msg) {
    Write-Host "    ✗ $msg" -ForegroundColor Red
}

function Ensure-Command($name) {
    if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
        throw "Comando '$name' não encontrado. Instale e tente novamente."
    }
}

function Ensure-Dir($path) {
    if (-not (Test-Path $path)) {
        New-Item -ItemType Directory -Path $path -Force | Out-Null
        Write-Success "Pasta criada: $path"
    }
}

function Ask-YesNo($question) {
    $response = Read-Host "$question (s/n)"
    return $response -eq 's'
}

function Clone-Or-Pull-Repo($repoUrl, $targetPath, $repoName) {
    if (-not (Test-Path $targetPath)) {
        Write-Step "Clonando $repoName -> $targetPath"
        git clone $repoUrl $targetPath
        if ($LASTEXITCODE -eq 0) {
            Write-Success "$repoName clonado"
        } else {
            Write-Error-Custom "Falha ao clonar $repoName"
            throw "Clone de $repoName falhou"
        }
    } else {
        Write-Info "$repoName já existe em $targetPath"
        
        if (-not $NoPull) {
            if (Ask-YesNo "Deseja fazer pull (git pull origin main) em $repoName?") {
                Write-Step "Atualizando $repoName com pull..."
                Push-Location $targetPath
                
                try {
                    git fetch origin --prune
                    
                    # Verifica qual branch padrão (main ou master)
                    $branches = git branch -r
                    $hasMain = $branches | Select-String "origin/main"
                    $defaultBranch = if ($hasMain) { "main" } else { "master" }
                    
                    git checkout $defaultBranch 2>$null | Out-Null
                    git pull origin $defaultBranch
                    
                    Write-Success "$repoName atualizado para $defaultBranch"
                } catch {
                    Write-Error-Custom "Falha ao fazer pull em $repoName"
                } finally {
                    Pop-Location
                }
            } else {
                Write-Info "Pull skipped para $repoName"
            }
        } else {
            Write-Info "Pull desabilitado (--NoPull)"
        }
    }
}

function Ensure-DotEnv($rootPath) {
    $envPath = Join-Path $rootPath ".env"
    
    if (-not (Test-Path $envPath)) {
        Write-Step "Criando arquivo .env"
        
        $envContent = @"
# =====================================================
# TC Agro Solutions - Configuração Local
# =====================================================

# Ambiente
ASPNETCORE_ENVIRONMENT=Development
ASPNETCORE_URLS=http://0.0.0.0:5000

# =====================================================
# PostgreSQL
# =====================================================
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=agro
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres

# Connection String para .NET (opcional, construído pelos serviços)
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
RABBITMQ_MANAGEMENT_PORT=15672
RABBITMQ_USER=guest
RABBITMQ_PASSWORD=guest

# =====================================================
# Serviços - Portas HTTP
# =====================================================
IDENTITY_HTTP_PORT=5001
FARM_HTTP_PORT=5002
SENSOR_INGEST_HTTP_PORT=5003
ANALYTICS_WORKER_HTTP_PORT=5004
DASHBOARD_HTTP_PORT=5005

# =====================================================
# JWT / Autenticação
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
"@
        
        Set-Content -Path $envPath -Value $envContent -Encoding UTF8
        Write-Success ".env criado: $envPath"
    } else {
        Write-Info ".env já existe"
    }
}

# ===========================
# EXECUÇÃO PRINCIPAL
# ===========================

Write-Header "TC Agro Solutions - Bootstrap"

# Resolve caminho para a raiz do projeto (um nível acima de scripts/)
$rootPath = Resolve-Path (Join-Path $PSScriptRoot "..")

Write-Info "Raiz do projeto: $rootPath"

# ===========================
# Validar Pré-requisitos
# ===========================
Write-Step "Validando pré-requisitos"

Ensure-Command "git"
Write-Success "Git encontrado"

Ensure-Command "docker"
Write-Success "Docker encontrado"

# ===========================
# Criar Pastas
# ===========================
Write-Step "Preparando estrutura de pastas"

Ensure-Dir (Join-Path $rootPath "services")
Ensure-Dir (Join-Path $rootPath "common")

# ===========================
# Criar .env
# ===========================
Ensure-DotEnv $rootPath

# ===========================
# Clonar/Atualizar Repositórios
# ===========================
Write-Step "Clonando/atualizando repositórios de serviços"

$repos = @(
    @{
        name = "identity-service"
        url  = "https://github.com/rdpresser/tc-agro-identity-service.git"
        path = "services/identity-service"
    },
    @{
        name = "farm-service"
        url  = "https://github.com/rdpresser/tc-agro-farm-service.git"
        path = "services/farm-service"
    },
    @{
        name = "sensor-ingest-service"
        url  = "https://github.com/rdpresser/tc-agro-sensor-ingest-service.git"
        path = "services/sensor-ingest-service"
    },
    @{
        name = "analytics-worker"
        url  = "https://github.com/rdpresser/tc-agro-analytics-worker.git"
        path = "services/analytics-worker"
    },
    @{
        name = "dashboard-service"
        url  = "https://github.com/rdpresser/tc-agro-dashboard-service.git"
        path = "services/dashboard-service"
    }
)

foreach ($repo in $repos) {
    $fullPath = Join-Path $rootPath $repo.path
    Clone-Or-Pull-Repo $repo.url $fullPath $repo.name
}

# ===========================
# Clonar/Atualizar Common
# ===========================
Write-Step "Clonando/atualizando repositório common"

$commonRepo = @{
    name = "common"
    url  = "https://github.com/rdpresser/tc-agro-common.git"
    path = "common"
}

$commonFullPath = Join-Path $rootPath $commonRepo.path
Clone-Or-Pull-Repo $commonRepo.url $commonFullPath $commonRepo.name

# ===========================
# Resumo Final
# ===========================
Write-Header "Bootstrap Concluído com Sucesso"

Write-Info "Estrutura criada:"
Write-Info "  ✓ services/"
Write-Info "    - identity-service/"
Write-Info "    - farm-service/"
Write-Info "    - sensor-ingest-service/"
Write-Info "    - analytics-worker/"
Write-Info "    - dashboard-service/"
Write-Info "  ✓ common/"
Write-Info "  ✓ .env (configuração local)"

Write-Info "Próximos passos:"
Write-Info "  1. Abrir tc-agro-solutions.sln no Visual Studio 2026"
Write-Info "  2. Adicionar projetos dos serviços à solution"
Write-Info "  3. Configurar docker-compose.yml com os serviços"
Write-Info "  4. Rodar: docker compose up -d"

if (-not $NoUp) {
    Write-Host ""
    if (Ask-YesNo "Deseja subir docker-compose agora?") {
        Write-Step "Subindo docker-compose..."
        Push-Location $rootPath
        
        try {
            docker compose up -d
            Write-Success "Docker Compose subido"
            Write-Info "Acesse:"
            Write-Info "  - PostgreSQL: localhost:5432"
            Write-Info "  - Redis: localhost:6379"
            Write-Info "  - RabbitMQ Management: http://localhost:15672 (guest/guest)"
        } catch {
            Write-Error-Custom "Falha ao subir docker-compose"
            Write-Warning "Execute manualmente: docker compose up -d"
        } finally {
            Pop-Location
        }
    }
} else {
    Write-Info "Docker Compose não foi subido (--NoUp)"
}

Write-Host ""
Write-Host "✅ Ambiente pronto para desenvolvimento!" -ForegroundColor Green
Write-Host ""
