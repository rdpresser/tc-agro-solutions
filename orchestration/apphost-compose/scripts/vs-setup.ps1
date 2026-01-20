# =====================================================
# TC Agro Solutions - Visual Studio Integration Guide
# =====================================================
# Purpose: Instructions for running Docker Compose from VS 2026
# =====================================================

Write-Host "`n==================================================" -ForegroundColor Cyan
Write-Host "  TC Agro Solutions - Visual Studio 2026 Setup" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

$scriptPath = $PSScriptRoot
$rootPath = Split-Path $scriptPath -Parent

Write-Host "`n📋 DOCKER COMPOSE PROJECT STRUCTURE" -ForegroundColor Cyan
Write-Host "==================================================`n" -ForegroundColor Cyan

Write-Host "The project has 4 docker-compose files:" -ForegroundColor White
Write-Host "
1. docker-compose.yml (BASE)
   - Defines all services: PostgreSQL, Redis, RabbitMQ, Observability, Identity
   - Production-like configuration
   - All services defined with health checks

2. docker-compose.override.yml (DEVELOPMENT)
   - Merged automatically with base by Docker Compose
   - Adds: verbose logging, debug environment variables, shorter retention policies
   - Used when running: docker compose up -d

3. docker-compose.vs.debug.yml (VISUAL STUDIO DEBUG - F5)
   - Used by Visual Studio when you press F5
   - Configures: debugger ports, user secrets volume mapping
   - Builds 'base' stage for debug symbols
   - Sets: ASPNETCORE_ENVIRONMENT=Development

4. docker-compose.vs.release.yml (VISUAL STUDIO RELEASE - Ctrl+F5)
   - Used by Visual Studio when you press Ctrl+F5
   - Builds 'final' stage (optimized)
   - Sets: ASPNETCORE_ENVIRONMENT=Production

" -ForegroundColor Gray

Write-Host "`n🎯 HOW VISUAL STUDIO 2026 USES THEM" -ForegroundColor Cyan
Write-Host "==================================================`n" -ForegroundColor Cyan

Write-Host "Visual Studio reads from: launchSettings.json" -ForegroundColor White
Write-Host "
Current launchSettings.json configuration:
{
  'profiles': {
    'Docker Compose': {
      'commandName': 'DockerCompose',
      'commandVersion': '1.0',
      'serviceActions': {
        'tc.agro.apphost.compose': 'StartDebugging'
      }
    }
  }
}

When you press F5 (Debug):
  1. VS runs: docker compose -f docker-compose.yml -f docker-compose.override.yml -f docker-compose.vs.debug.yml up
  2. Services start in Development mode
  3. Identity Service runs with debugger attached
  4. You can set breakpoints in code

When you press Ctrl+F5 (Run without debug):
  1. VS runs: docker compose -f docker-compose.yml -f docker-compose.override.yml -f docker-compose.vs.release.yml up
  2. Services start in Production mode
  3. Optimized build, no debugger overhead
  4. Faster startup

" -ForegroundColor Gray

Write-Host "`n❌ COMMON ERROR: 'dependency failed to start: container tc-agro-rabbitmq is unhealthy'" -ForegroundColor Red
Write-Host "==================================================\n" -ForegroundColor Red

Write-Host "ROOT CAUSE:" -ForegroundColor Yellow
Write-Host "- RabbitMQ startup healthcheck fails within timeout" -ForegroundColor Gray
Write-Host "- First container startup takes 30-60 seconds" -ForegroundColor Gray
Write-Host "- Visual Studio timeout is often shorter than needed" -ForegroundColor Gray
Write-Host "- Ports might be already in use" -ForegroundColor Gray

Write-Host "`nSOLUTION 1: Pre-warm containers (RECOMMENDED)" -ForegroundColor Cyan
Write-Host "
Before opening solution in VS, run:
  .\scripts\start.ps1

This starts all containers and waits for health.
Then open VS and press F5.
Containers will be reused, not recreated.

" -ForegroundColor White

Write-Host "`nSOLUTION 2: Cleanup and retry" -ForegroundColor Cyan
Write-Host "
From Visual Studio:
  1. View > Other Windows > Containers (opens Docker view)
  2. Right-click any container > Stop
  3. Right-click again > Remove
  4. Or run from PowerShell: .\cleanup.ps1

Then:
  1. Press F5 in Visual Studio again
  2. Wait for containers to start
  3. This may take 60+ seconds on first run

" -ForegroundColor White

Write-Host "`nSOLUTION 3: Increase Docker timeout (WORKAROUND)" -ForegroundColor Cyan
Write-Host "
Edit: launchSettings.json
Add to Docker Compose section:
  'timeout': 120  (seconds)

But SOLUTION 1 is better - pre-warm containers.

" -ForegroundColor White

Write-Host "`n🔧 COMMAND LINE DEBUGGING (ALTERNATIVE)" -ForegroundColor Cyan
Write-Host "==================================================\n" -ForegroundColor Cyan

Write-Host "If Visual Studio gives too much trouble:" -ForegroundColor White
Write-Host "
# Terminal 1: Start all infrastructure + Identity
.\scripts\start.ps1

# Terminal 2: Run Identity Service directly
cd services\identity-service\src\Adapters\Inbound\TC.Agro.Identity.Service
dotnet run

You get:
  ✓ Faster feedback
  ✓ Full debugger control
  ✓ Better logs visibility
  ✓ Easy to restart

" -ForegroundColor Gray

Write-Host "`n📊 UNDERSTANDING DOCKER COMPOSE MERGING" -ForegroundColor Cyan
Write-Host "==================================================\n" -ForegroundColor Cyan

Write-Host "Docker Compose merges files in order:" -ForegroundColor White
Write-Host "
Base values from docker-compose.yml:
  - postgres:
      command: pg_isready...
      environment: [POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD]
      healthcheck: [test, interval, timeout]

Override values from docker-compose.override.yml:
  - postgres:
      environment:  # ADDS these (merges with base)
        - POSTGRES_INITDB_ARGS=-c log_statement=all

Result: Base + Override merged intelligently

Debug override from docker-compose.vs.debug.yml:
  - tc-agro-identity-service:
      build:
        target: base  # OVERRIDE: Use debug stage
      labels: [debugger settings]  # ADD debug labels

FINAL: All three files combined!

" -ForegroundColor Gray

Write-Host "`n🐳 VIEWING WHAT ACTUALLY RUNS" -ForegroundColor Cyan
Write-Host "==================================================\n" -ForegroundColor Cyan

Write-Host "To see the final merged configuration:" -ForegroundColor White
Write-Host "
# Shows what Visual Studio would actually use:
docker compose -f docker-compose.yml -f docker-compose.override.yml config

# Shows debug configuration:
docker compose -f docker-compose.yml -f docker-compose.override.yml -f docker-compose.vs.debug.yml config | Select-String 'tc-agro-identity'

# Shows release configuration:
docker compose -f docker-compose.yml -f docker-compose.override.yml -f docker-compose.vs.release.yml config | Select-String 'tc-agro-identity'

" -ForegroundColor Gray

Write-Host "`n✅ RECOMMENDED WORKFLOW" -ForegroundColor Green
Write-Host "==================================================\n" -ForegroundColor Green

Write-Host "1. FIRST TIME SETUP:" -ForegroundColor Cyan
Write-Host "   .\scripts\start.ps1" -ForegroundColor White
Write-Host "   (Pre-warms containers, healthchecks complete)" -ForegroundColor Gray

Write-Host "`n2. OPEN VISUAL STUDIO:" -ForegroundColor Cyan
Write-Host "   Open: TC.Agro.AppHost.Compose.slnx" -ForegroundColor White
Write-Host "   Containers already running, VS won't restart them" -ForegroundColor Gray

Write-Host "`n3. START DEBUGGING:" -ForegroundColor Cyan
Write-Host "   Press F5 or Ctrl+F5" -ForegroundColor White
Write-Host "   Attach to running Identity Service" -ForegroundColor Gray

Write-Host "`n4. VIEW LOGS:" -ForegroundColor Cyan
Write-Host "   View > Other Windows > Containers" -ForegroundColor White
Write-Host "   Or PowerShell: docker compose logs -f" -ForegroundColor Gray

Write-Host "`n5. RESTART SERVICES:" -ForegroundColor Cyan
Write-Host "   In VS Docker view: Right-click > Restart" -ForegroundColor White
Write-Host "   Or PowerShell: docker compose restart" -ForegroundColor Gray

Write-Host "`n6. CLEANUP:" -ForegroundColor Cyan
Write-Host "   .\cleanup.ps1" -ForegroundColor White
Write-Host "   (Removes all containers and volumes)" -ForegroundColor Gray

Write-Host "`n"

# =====================================================
# Offer to start containers now
# =====================================================
Write-Host "🚀 START CONTAINERS NOW?" -ForegroundColor Cyan
Write-Host "==================================================\n" -ForegroundColor Cyan

$startNow = Read-Host "Run .\scripts\start.ps1 now? (yes/no)"

if ($startNow -eq "yes") {
    & "$rootPath\start.ps1"
}
else {
    Write-Host "`nWhen ready, run:" -ForegroundColor Yellow
    Write-Host "  .\scripts\start.ps1" -ForegroundColor Cyan
    Write-Host "`n"
}
