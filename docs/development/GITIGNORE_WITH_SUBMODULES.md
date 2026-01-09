# .gitignore with Git Submodules

## 📋 Core Concept

**Each Git repository has its own `.gitignore` INDEPENDENT.**

```
tc-agro-solutions/                  ← Parent repo
├── .gitignore                      ← Ignores parent-level items
├── services/
│   └── agro-farm-service/          ← Submodule (Git repository)
│       └── .gitignore              ← Ignores farm SERVICE items
├── common/
│   └── agro-shared-library/        ← Submodule (Git repository)
│       └── .gitignore              ← Ignores shared library items
└── infrastructure/
    └── .gitignore                  ← Ignores infrastructure items
```

**Result:** 3 `.gitignore` files, working **independently**.

---

## 🔍 How It Works

### 1. Submodule `.gitignore` (services/agro-farm-service/.gitignore)

Controls **WHAT IS IGNORED IN THE FARM REPOSITORY**:

```bash
# .NET / C#
bin/
obj/
*.dll
*.exe
*.pdb
.vs/
.vscode/
*.user
packages/

# Environment
.env
appsettings.*.json (except appsettings.Development.json)
secrets.json

# OS
.DS_Store
Thumbs.db

# IDE
.idea/
*.swp
*.swo
```


```bash
# Build outputs (parent level)
build/
dist/

node_modules/

# Terraform (if local)
*.tfstate
*.tfstate.backup

# Environment
.env

# IDE
.idea/
*.swp

# OS
.DS_Store
```


```bash
cd tc-agro-solutions
cd services/agro-farm-service
dotnet build

# Cria:
# - bin/  ← Ignorado por services/agro-farm-service/.gitignore
# - obj/  ← Ignorado por services/agro-farm-service/.gitignore
```

**Git status da farm:**
```bash
$ git status
On branch main
nothing to commit, working tree clean
```

**Git status do parent:**
```bash
$ cd ../..
$ git status
On branch main
nothing to commit, working tree clean
```


---


```bash
```

```bash
$ git status
On branch main
Changes not staged for commit:
  modified:   src/Features/Properties/CreatePropertyHandler.cs
```

```bash
$ cd ../..
$ git status
On branch main
modified:   services/agro-farm-service (modified content)
```


---


```bash
cd services/agro-farm-service
echo "DB_PASSWORD=secret123" > .env
```

**Git status da farm:**
```bash
$ git status
On branch main
nothing to commit, working tree clean
```

**Git status do parent:**
```bash
$ cd ../..
$ git status
On branch main
nothing to commit, working tree clean
```


---


|---------|-------------------|----------------------|
| **Controla** | O que é ignorado no parent repo | O que é ignorado no submodule repo |
| **Afeta** | `git status` no parent | `git status` no submodule |

---

## 🚀 Prática Recomendada

### Parent `.gitignore` (tc-agro-solutions/.gitignore)

```bash
# ============================================
# PARENT-LEVEL IGNORES
# ============================================

# Build outputs (parent level)
build/
dist/
*.out

# Terraform (if local)
*.tfstate
*.tfstate.backup
.terraform/
.terraform.lock.hcl
terraform.tfvars

# Infrastructure
.kube/
kubeconfig

# Environment file (parent level, for deployment config)
.env.deployment

# IDE / Editor
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db
*.log
```

**⚠️ IMPORTANTE:** Não inclua diretórios dos submodules (como `bin/`, `obj/`) porque:
- Cada submodule tem seu próprio `.gitignore`
- Se ignora no parent, criar confusão
- Deixa controle total para cada repo

---

### Submodule `.gitignore` (services/agro-farm-service/.gitignore)

```bash
# ============================================
# C# / .NET
# ============================================

bin/
obj/
*.dll
*.exe
*.pdb
.vs/
.vscode/
*.user
packages/

# ============================================
# Environment & Secrets
# ============================================

# Local environment (NEVER commit)
.env
.env.local
.env.*.local

# Secrets
appsettings.Secrets.json
secrets.json

# IDE
.idea/
*.swp
*.swo
*.vscode

# OS
.DS_Store
Thumbs.db

# Build artifacts
*.nupkg
*.snupkg
```

---

## 🔄 Workflow Comum

### 1. Setup (primeira vez)

```bash
# Clone parent com submodules
git clone --recurse-submodules https://github.com/org/tc-agro-solutions.git
cd tc-agro-solutions

# Check .gitignore files exist
ls -la .gitignore
ls -la services/agro-farm-service/.gitignore
ls -la common/agro-shared-library/.gitignore
```

### 2. Development (rotina)

```bash
# Compilar (gera bin/, obj/ — ignorados)
cd services/agro-farm-service
dotnet build

# Status (limpo, sem artefatos)
git status  ✅ clean

# Editar código
# ... work on features ...

# Commit (apenas código, sem bin/, obj/, .env)
git add .
git commit -m "feat: add plot validation"
git push origin feature/plot-validation

# Back to parent
cd ../..
git status  # mostra que farm service foi atualizado

# Update parent to latest farm version
git add services/agro-farm-service
git commit -m "chore: update farm service"
git push
```

### 3. Verificar se está tudo certo

```bash
# Garantir que .gitignore não está sendo ignorado
git status .gitignore  # deve rastrear
git status

# Ver o que está sendo rastreado em uma submodule
cd services/agro-farm-service
git ls-files  # lista TODOS os arquivos rastreados

# Confirmar que bin/, obj/ NÃO estão na lista
git ls-files | grep bin  # não deve retornar nada
```

---

git commit -m "chore: ignore .env file"
```

---


# Commit
git commit -m "chore: ignore build artifacts"
```

---

git rm --cached -r .
git add -A
git commit -m "chore: reset git tracking"
```

---


---

## 📚 Referências

- [Git .gitignore Documentation](https://git-scm.com/docs/gitignore)
- [Git Submodules](https://git-scm.com/book/en/v2/Git-Tools-Submodules)
- [GitHub .gitignore Templates](https://github.com/github/gitignore)

---


```
┌─────────────────────────────────────────────┐
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
└─────────────────────────────────────────────┘

```

