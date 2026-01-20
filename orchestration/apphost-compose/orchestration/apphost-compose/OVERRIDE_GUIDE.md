# Docker Compose Override - Development Guide

## ?? O que é o `docker-compose.override.yml`?

Um arquivo que estende o `docker-compose.yml` com configurações específicas para **desenvolvimento local**.

Docker Compose carrega automaticamente na seguinte ordem:
1. `docker-compose.yml` (base)
2. `docker-compose.override.yml` (development overrides)

---

## ? O Que Está Habilitado em Development?

### 1?? **Hot-Reload (Recarregamento Automático)**

Quando você edita o código, o container recarrega automaticamente.

**Para ativar:**
```yaml
# docker-compose.override.yml - linha ~130
volumes:
  # Descomente a linha abaixo:
  - ../../services/identity-service/src:/app/src:ro
```

**Variáveis de ambiente necessárias (já setadas):**
```yaml
- DOTNET_USE_POLLING_FILE_WATCHER=1
- DOTNET_WATCH_RESTART_ON_RUDE_EDIT=1
```

### 2?? **Debug Ports**

Visual Studio consegue se conectar para debugging.

**Identity Service debug port:**
- Port: `15001` ? `15001` (container)

**Quando usar:**
- Visual Studio: `Debug ? Attach to Process ? Docker`
- Breakpoints funcionam normalmente

### 3?? **Verbose Logging**

Logs detalhados para ajudar no desenvolvimento.

**Nível de log:**
```yaml
environment:
  - Serilog__MinimumLevel__Default=Debug
  - Serilog__MinimumLevel__Override__Microsoft=Information
```

### 4?? **NuGet Cache**

Pacotes NuGet são cached entre builds para ser mais rápido.

```yaml
volumes:
  - identity_nuget_cache:/root/.nuget/packages
```

### 5?? **Build Configuration**

Build em `Debug` ao invés de `Release`:

```yaml
build:
  args:
    BUILD_CONFIGURATION: Debug
```

---

## ?? Como Usar

### **Iniciar com Override (Padrão)**
```bash
docker compose up -d
# Carrega: docker-compose.yml + docker-compose.override.yml
```

### **Iniciar SEM Override (Simular Produção)**
```bash
docker compose -f docker-compose.yml up -d
# Carrega APENAS o base (sem overrides)
```

### **Usar em k3d**
```bash
# No k3d, você provavelmente quer APENAS o base
docker compose -f docker-compose.yml up -d

# Ou copiar apenas docker-compose.yml para k3d
kubectl apply -f orchestration/apphost-compose/docker-compose.yml
```

---

## ?? Development Workflow

### **Cenário 1: Hot-Reload Enabled**

```yaml
# Ativar em docker-compose.override.yml
volumes:
  - ../../services/identity-service/src:/app/src:ro
```

**Fluxo:**
1. `docker compose up -d`
2. Editar código em `services/identity-service/src/...`
3. ? Container recarrega automaticamente
4. Teste imediatamente sem rebuild

### **Cenário 2: Debugging**

```powershell
# 1. Iniciar containers
docker compose up -d

# 2. No Visual Studio:
#    Debug ? Attach to Process ? Docker
#    Procurar por: tc-agro-identity-service
#    Conectar

# 3. Colocar breakpoints normalmente
# 4. Hit F5/Continue
```

### **Cenário 3: Verbose Logging**

```bash
# Ver todos os logs em tempo real
docker compose logs -f tc-agro-identity-service

# Saída inclui: Debug logs, traces, stack traces detalhados
```

---

## ?? Comparação: Base vs Override

| Feature | Base (Production) | Override (Development) |
|---------|------------------|----------------------|
| Build | Release | Debug |
| Log Level | Information | Debug |
| Hot Reload | ? No | ? Yes (optional) |
| Debug Ports | ? No | ? Yes (15001) |
| NuGet Cache | ? No | ? Yes |
| Startup Speed | Fast | Slower (rebuild) |
| Code Changes | Need rebuild | Automatic reload |

---

## ?? Troubleshooting

### Hot-Reload Não Funciona

**Verificar:**
```yaml
# 1. Volume está descomentado?
volumes:
  - ../../services/identity-service/src:/app/src:ro  # ? Ativo

# 2. Variáveis de ambiente?
environment:
  - DOTNET_USE_POLLING_FILE_WATCHER=1  # ? Presente
  - DOTNET_WATCH_RESTART_ON_RUDE_EDIT=1  # ? Presente
```

**Solução:**
```bash
# Reiniciar container
docker compose restart tc-agro-identity-service

# Ou rebuild
docker compose build --no-cache tc-agro-identity-service
docker compose up -d tc-agro-identity-service
```

### Debug Port Não Conecta

**Verificar:**
```bash
# Porta está exposta?
docker compose ps | grep identity

# Output deve mostrar: 15001->15001
```

**Solução:**
```bash
# Resetar container
docker compose stop tc-agro-identity-service
docker compose rm tc-agro-identity-service
docker compose up -d tc-agro-identity-service

# Reconectar no VS
# Debug ? Attach to Process ? Refresh ? Select container
```

### Logs Estão Vazios

**Verificar:**
```yaml
# Logging está configurado?
environment:
  - Serilog__MinimumLevel__Default=Debug  # ? Present

# Volume de logs?
volumes:
  - identity_logs:/app/logs  # ? Present
```

**Solução:**
```bash
# Ver logs do container
docker compose logs tc-agro-identity-service

# Acompanhar em tempo real
docker compose logs -f tc-agro-identity-service
```

---

## ?? Adicionando Novos Serviços

### **1. Adicionar em `docker-compose.yml`** (Base)

```yaml
tc-agro-farm-service:
  image: ${DOCKER_REGISTRY-}tc-agro-farm-service:latest
  build:
    context: ../../
    dockerfile: services/farm-service/src/Adapters/Inbound/TC.Agro.Farm.Service/Dockerfile
  # ... rest of production config
```

### **2. Adicionar em `docker-compose.override.yml`** (Development)

```yaml
tc-agro-farm-service:
  build:
    args:
      BUILD_CONFIGURATION: Debug  # Development build
  ports:
    - "5002:8080"
    - "15002:15001"  # Debug port
  environment:
    - Serilog__MinimumLevel__Default=Debug
  volumes:
    # - ../../services/farm-service/src:/app/src:ro  # Hot-reload
    - farm_nuget_cache:/root/.nuget/packages
```

### **3. Descomente em ambos os arquivos**

```bash
docker compose up -d tc-agro-farm-service
```

---

## ?? Best Practices

? **DO:**
- Manter base `docker-compose.yml` production-ready
- Override apenas configs específicas de dev
- Documentar mudanças em ambos arquivos
- Testar sem override antes de commitar
- Usar para: hot-reload, debugging, logging

? **DON'T:**
- Modificar base config para dev needs
- Adicionar serviços apenas no override
- Commitar segredos/senhas no override
- Deixar debug ports habilitados em prod
- Usar volumes em produção

---

## ?? Referências

- **Docker Compose Override:** https://docs.docker.com/compose/multiple-compose-files/
- **FastEndpoints Debugging:** https://fast-endpoints.com/
- **Visual Studio Container Tools:** https://learn.microsoft.com/en-us/visualstudio/containers/overview

---

**Version**: 1.0  
**Last Updated**: January 2026

Para questões, consulte o [README.md](./README.md) ou a [Documentação Oficial](../../docs/).
