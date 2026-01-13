param(
    [switch]$NoPull = $false
)

$ErrorActionPreference = "Stop"

# ===========================
# HELPER FUNCTIONS
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
        throw "Command '$name' not found. Please install it and try again."
    }
}

function Ensure-Dir($path) {
    if (-not (Test-Path $path)) {
        New-Item -ItemType Directory -Path $path -Force | Out-Null
        Write-Success "Directory created: $path"
    }
}

function Ask-YesNo($question) {
    $response = Read-Host "$question (y/n)"
    return $response -eq 'y'
}

function Clone-Or-Pull-Repo($repoUrl, $targetPath, $repoName) {
    if (-not (Test-Path $targetPath)) {
        Write-Step "Cloning $repoName -> $targetPath"
        
        try {
            # Test if repository is accessible
            Write-Info "Testing repository connectivity..."
            git ls-remote $repoUrl HEAD 2>&1 | Out-Null
            
            if ($LASTEXITCODE -ne 0) {
                Write-Error-Custom "Repository not accessible: $repoUrl"
                throw "Repository $repoName is not accessible or does not exist"
            }
            
            Write-Info "Repository is accessible, cloning now..."
            git clone $repoUrl $targetPath
            
            if ($LASTEXITCODE -eq 0) {
                Write-Success "$repoName cloned successfully to $targetPath"
            }
            else {
                Write-Error-Custom "Failed to clone $repoName"
                throw "Clone of $repoName failed"
            }
        }
        catch {
            Write-Error-Custom "Error cloning $repoName : $_"
            throw
        }
    }
    else {
        # Check if it's a valid git repository
        $gitPath = Join-Path $targetPath ".git"
        
        if (-not (Test-Path $gitPath)) {
            Write-Error-Custom "$repoName folder exists but is not a valid git repository (missing .git folder)"
            Write-Warning "Please delete $targetPath and run bootstrap again, or manually clone:"
            Write-Warning "  git clone $repoUrl $targetPath"
            throw "Invalid repository state for $repoName"
        }
        
        Write-Info "$repoName already exists in $targetPath"
        
        if (-not $NoPull) {
            if (Ask-YesNo "Do you want to pull (git pull origin main) for $repoName?") {
                Write-Step "Updating $repoName with pull..."
                Push-Location $targetPath
                
                try {
                    git fetch origin --prune
                    
                    # Checks which default branch (main or master)
                    $branches = git branch -r
                    $hasMain = $branches | Select-String "origin/main"
                    $defaultBranch = if ($hasMain) { "main" } else { "master" }
                    
                    git checkout $defaultBranch 2>$null | Out-Null
                    git pull origin $defaultBranch
                    
                    Write-Success "$repoName updated to $defaultBranch"
                }
                catch {
                    Write-Error-Custom "Failed to pull $repoName : $_"
                }
                finally {
                    Pop-Location
                }
            }
            else {
                Write-Info "Pull skipped for $repoName"
            }
        }
        else {
            Write-Info "Pull disabled (--NoPull)"
        }
    }
}

function Ensure-DotEnv($rootPath) {
    $envPath = Join-Path $rootPath ".env"
    
    if (-not (Test-Path $envPath)) {
        Write-Step "Creating .env file"
        
        $envContent = @"
# =====================================================
# TC Agro Solutions - Local Configuration
# =====================================================

# Environment
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

# Connection String for .NET (optional, built by services)
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
# Services - HTTP Ports
# =====================================================
IDENTITY_HTTP_PORT=5001
FARM_HTTP_PORT=5002
SENSOR_INGEST_HTTP_PORT=5003
ANALYTICS_WORKER_HTTP_PORT=5004
DASHBOARD_HTTP_PORT=5005

# =====================================================
# JWT / Authentication
# =====================================================
JWT_ISSUER=http://localhost:5001
JWT_AUDIENCE=http://localhost:5000
JWT_SECRET_KEY=your-256-bit-secret-key-change-in-production-12345678
JWT_EXPIRATION_MINUTES=480

# =====================================================
# Logging
# =====================================================
LOG_LEVEL=Information
"@
        
        Set-Content -Path $envPath -Value $envContent -Encoding UTF8
        Write-Success ".env created: $envPath"
    }
    else {
        Write-Info ".env already exists"
    }
}

# ===========================
# MAIN EXECUTION
# ===========================

Write-Header "TC Agro Solutions - Bootstrap"

# Resolve path to project root (one level above scripts/)
$rootPath = Resolve-Path (Join-Path $PSScriptRoot "..")

Write-Info "Project root: $rootPath"

# ===========================
# Validate Prerequisites
# ===========================
Write-Step "Validating prerequisites"

Ensure-Command "git"
Write-Success "Git found"

Ensure-Command "docker"
Write-Success "Docker found"

# Test internet connectivity
Write-Step "Testing internet connectivity..."
try {
    $testUrl = "https://github.com"
    $null = Invoke-WebRequest -Uri $testUrl -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
    Write-Success "Internet connectivity verified"
}
catch {
    Write-Warning "Could not verify internet connectivity. Make sure you have a working internet connection."
}

# ===========================
# Create Directories
# ===========================
Write-Step "Preparing folder structure"

Ensure-Dir (Join-Path $rootPath "services")
# Note: 'common' folder will be created by git clone

# ===========================
# Create .env
# ===========================
Ensure-DotEnv $rootPath

# ===========================
# Clone/Update Repositories
# ===========================
Write-Step "Cloning/updating service repositories"

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
# Clone/Update Common
# ===========================
Write-Step "Cloning/updating common repository"

$commonRepo = @{
    name = "common"
    url  = "https://github.com/rdpresser/tc-agro-common.git"
    path = "common"
}

$commonFullPath = Join-Path $rootPath $commonRepo.path
Clone-Or-Pull-Repo $commonRepo.url $commonFullPath $commonRepo.name

# ===========================
# Final Summary
# ===========================
Write-Header "Bootstrap Complete"

Write-Info "Structure created:"
Write-Info "  ✓ services/"
Write-Info "    - identity-service/"
Write-Info "    - farm-service/"
Write-Info "    - sensor-ingest-service/"
Write-Info "    - analytics-worker/"
Write-Info "    - dashboard-service/"
Write-Info "  ✓ common/"
Write-Info "  ✓ .env (local configuration)"

# Verify folder structure
Write-Step "Verifying cloned repositories..."

$expectedFolders = @(
    "services/identity-service",
    "services/farm-service",
    "services/sensor-ingest-service",
    "services/analytics-worker",
    "services/dashboard-service",
    "common"
)

$allSuccess = $true
foreach ($folder in $expectedFolders) {
    $fullPath = Join-Path $rootPath $folder
    if (Test-Path $fullPath) {
        Write-Success "✓ $folder exists"
    }
    else {
        Write-Error-Custom "✗ $folder NOT FOUND"
        $allSuccess = $false
    }
}

if (-not $allSuccess) {
    Write-Warning "Some repositories are missing. Please check the errors above."
    exit 1
}

Write-Info ""
Write-Info "Next steps:"
Write-Info "  1. Open tc-agro-solutions.sln in Visual Studio 2026"
Write-Info "  2. Add service projects to solution"
Write-Info "  3. Create docker-compose.yml with services"
Write-Info "  4. Run: docker compose up -d"

Write-Host ""
Write-Host "✅ Environment ready for development!" -ForegroundColor Green
Write-Host ""
