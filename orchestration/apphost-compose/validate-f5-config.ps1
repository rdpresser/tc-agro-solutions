#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Valida que todas as mudanças de healthcheck foram aplicadas corretamente
    
.DESCRIPTION
    Verifica docker-compose.yml para confirmar que todos os 9 serviços
    têm os novos timeouts otimizados.
    
.EXAMPLE
    .\validate-f5-config.ps1
    
.NOTES
    Run from: orchestration/apphost-compose/
#>

Write-Host "`n🔍 Validando Configuração F5 Complete Stack...`n" -ForegroundColor Cyan

$compose_file = "docker-compose.yml"
$issues = @()
$validated = @()

# Definir valores esperados para cada serviço
$expectations = @{
    "postgres"                 = @{ start_period = "40s"; retries = 15 }
    "redis"                    = @{ start_period = "15s"; retries = 15 }
    "rabbitmq"                 = @{ start_period = "60s"; retries = 20 }
    "loki"                     = @{ start_period = "30s"; retries = 10 }
    "tempo"                    = @{ start_period = "30s"; retries = 10 }
    "prometheus"               = @{ start_period = "30s"; retries = 10 }
    "otel-collector"           = @{ start_period = "40s"; retries = 15 }
    "grafana"                  = @{ start_period = "45s"; retries = 15 }
    "tc-agro-identity-service" = @{ start_period = "50s"; retries = 15 }
}

# Ler arquivo
if (-not (Test-Path $compose_file)) {
    Write-Host "❌ Arquivo não encontrado: $compose_file" -ForegroundColor Red
    exit 1
}

$content = Get-Content $compose_file -Raw

# Validar cada serviço
foreach ($service in $expectations.Keys) {
    Write-Host "  Validando: $service" -ForegroundColor Yellow
    
    # Procurar por padrão do serviço
    $pattern = "$service.*?healthcheck:.*?start_period:\s*(\S+).*?retries:\s*(\d+)" -replace "`n", " "
    
    if ($content -match $pattern) {
        $start_period = $matches[1]
        $retries = [int]$matches[2]
        
        $expected_sp = $expectations[$service].start_period
        $expected_retries = $expectations[$service].retries
        
        $sp_match = $start_period -eq $expected_sp
        $retries_match = $retries -eq $expected_retries
        
        if ($sp_match -and $retries_match) {
            Write-Host "    ✅ $service: start_period=$start_period, retries=$retries" -ForegroundColor Green
            $validated += $service
        }
        else {
            $msg = "    ❌ $service encontrado, mas valores incorretos:`n"
            if (-not $sp_match) { $msg += "       start_period: $start_period (esperado: $expected_sp)`n" }
            if (-not $retries_match) { $msg += "       retries: $retries (esperado: $expected_retries)`n" }
            Write-Host $msg -ForegroundColor Red
            $issues += $service
        }
    }
    else {
        Write-Host "    ❌ $service NÃO ENCONTRADO no arquivo!" -ForegroundColor Red
        $issues += $service
    }
}

Write-Host "`n" -ForegroundColor Cyan

# Verificar launchSettings.json
Write-Host "🔍 Validando launchSettings.json..." -ForegroundColor Cyan
$settings_file = "launchSettings.json"

if (Test-Path $settings_file) {
    $settings = Get-Content $settings_file | ConvertFrom-Json
    if ($settings.profiles."Docker Compose".timeout -eq 180) {
        Write-Host "  ✅ Docker Compose timeout: 180 segundos" -ForegroundColor Green
    }
    else {
        $timeout = $settings.profiles."Docker Compose".timeout
        Write-Host "  ⚠️  Docker Compose timeout: $timeout (esperado: 180)" -ForegroundColor Yellow
    }
}
else {
    Write-Host "  ⚠️  launchSettings.json não encontrado" -ForegroundColor Yellow
}

# Resumo
Write-Host "`n" -ForegroundColor Cyan
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║              RESUMO DA VALIDAÇÃO                           ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan

$total_expected = $expectations.Count
$validated_count = $validated.Count
$percentage = [math]::Round(($validated_count / $total_expected) * 100)

Write-Host "`n✅ Validados: $validated_count/$total_expected ($percentage%)" -ForegroundColor Green

if ($issues.Count -gt 0) {
    Write-Host "`n❌ Problemas encontrados em:" -ForegroundColor Red
    foreach ($issue in $issues) {
        Write-Host "   - $issue" -ForegroundColor Red
    }
    Write-Host "`n⚠️  Execute 'git diff docker-compose.yml' para revisar mudanças" -ForegroundColor Yellow
    exit 1
}
else {
    Write-Host "`n✨ SUCESSO! Todas as configurações estão corretas!`n" -ForegroundColor Green
    Write-Host "📝 Próximo passo: Pressione F5 no Visual Studio" -ForegroundColor Cyan
    Write-Host "⏱️  Tempo esperado de startup: 140-150 segundos`n" -ForegroundColor Cyan
    exit 0
}
