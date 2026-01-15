# Traefik vs NGINX Ingress - Implementação

**Date:** January 15, 2026  
**Status:** ✅ IngressRoute (Traefik) implementado  
**Strategy:** Usar Traefik localmente (k3s default), NGINX documentado para Azure

---

## 🎯 Decisão: Por que Traefik?

### **Cluster tem 2 Ingress Controllers:**

```
Traefik (k3s default)
├─ Status: ✅ Ativo com LoadBalancer
├─ Portas: 80/443 expostas em k3d
├─ Config: IngressRoute CRD (type: traefik.io/v1alpha1)
└─ Vantagem: Zero config, já funcional

NGINX Ingress (instalado manualmente)
├─ Status: ✅ Ativo mas sem LoadBalancer claro
├─ Config: Ingress padrão (type: networking.k8s.io/v1)
├─ Problema: Competi com Traefik pelas mesmas rotas
└─ Uso: Preparação para Azure/AKS
```

### **Conflito Identificado:**

O `ingress.yaml` do frontend usava `ingressClassName: nginx`, criando ambiguidade:

```yaml
# Antes (ambíguo):
ingressClassName: nginx  # Qual controller vai rotear? NGINX ou Traefik?
```

### **Solução Implementada:**

1. ✅ Criar **IngressRoute** do Traefik (usa CRD, unívoco)
2. ✅ Desabilitar **Ingress** NGINX (comentado no kustomization)
3. ✅ Resultado: Traefik é o único roteador, sem ambiguidade

---

## 📁 Arquivos Modificados/Criados

### **1. Frontend: Traefik IngressRoute**

**Arquivo:** `infrastructure/kubernetes/apps/base/frontend/ingressroute.yaml`

```yaml
apiVersion: traefik.io/v1alpha1
kind: IngressRoute
metadata:
  name: frontend
  namespace: agro-apps
spec:
  entryPoints:
    - web
  routes:
    # Path-based: localhost/agro (zero config)
    - match: Host(`localhost`) && PathPrefix(`/agro`)
      services:
        - name: frontend
          port: 80
      middlewares:
        - name: strip-agro-prefix
    
    # Host-based: agro.local (requires hosts file)
    - match: Host(`agro.local`)
      services:
        - name: frontend
          port: 80
```

**Middleware:**
```yaml
apiVersion: traefik.io/v1alpha1
kind: Middleware
metadata:
  name: strip-agro-prefix
  namespace: agro-apps
spec:
  stripPrefix:
    prefixes:
      - /agro
```

**Resultado:**
- Browser: `http://localhost/agro/dashboard`
- Traefik rewrite: Remove `/agro`
- Frontend recebe: `/dashboard`
- Vite base path: `/agro/` (assets carregam de `/agro/assets/...`)

---

### **2. Frontend: Kustomization Atualizado**

**Arquivo:** `infrastructure/kubernetes/apps/base/frontend/kustomization.yaml`

```yaml
resources:
  - namespace.yaml
  - deployment.yaml
  - service.yaml
  - ingressroute.yaml        # ✅ Traefik IngressRoute
  # - ingress.yaml           # ❌ Disabled: NGINX Ingress (legacy)
```

**Benefício:** Explícito qual controller usar, sem conflitos.

---

### **3. ArgoCD: Traefik IngressRoute (Novo)**

**Arquivo:** `infrastructure/kubernetes/platform/base/ingress/argocd-ingressroute.yaml`

```yaml
apiVersion: traefik.io/v1alpha1
kind: IngressRoute
metadata:
  name: argocd
  namespace: argocd
spec:
  entryPoints:
    - web
  routes:
    # Path-based: localhost/argocd (zero config)
    - match: Host(`localhost`) && PathPrefix(`/argocd`)
      services:
        - name: argocd-server
          port: 80
      middlewares:
        - name: strip-argocd-prefix
    
    # Host-based: argocd.local (requires hosts file)
    - match: Host(`argocd.local`)
      services:
        - name: argocd-server
          port: 80
```

---

## 🚀 Como Aplicar

### **1. Deploy Frontend com Traefik**

```bash
# Aplicar Kustomization (usa ingressroute.yaml automaticamente)
kubectl apply -k infrastructure/kubernetes/apps/overlays/dev

# Verificar
kubectl get ingressroute -n agro-apps
# NAME       AGE
# frontend   2m
```

### **2. Deploy ArgoCD com Traefik**

```bash
# Aplicar IngressRoute
kubectl apply -f infrastructure/kubernetes/platform/base/ingress/argocd-ingressroute.yaml

# Verificar
kubectl get ingressroute -n argocd
# NAME    AGE
# argocd  2m
```

### **3. Testar Acesso**

**Path-based (zero config):**
```bash
# Frontend
curl http://localhost/agro

# ArgoCD
curl http://localhost/argocd
```

**Host-based (requer hosts file):**
```bash
# Adicionar ao C:\Windows\System32\drivers\etc\hosts:
# 127.0.0.1 agro.local
# 127.0.0.1 argocd.local

# Depois acessar
curl http://agro.local
curl http://argocd.local
```

---

## 📊 Comparação: Antes vs Depois

### **ANTES (Ambíguo):**

```
Ingress (NGINX) @ agro.local
         ↓
Traefik? NGINX? (undefined behavior)
         ↓
❓ Qual roteia? Conflito!
```

**Problemas:**
- Dois controllers competindo
- Rotas ambíguas
- Comportamento imprevisível

---

### **DEPOIS (Unívoco):**

```
IngressRoute (Traefik) @ agro.local
         ↓
Traefik (definido explicitamente)
         ↓
✅ Roteamento claro e determinístico
```

**Benefícios:**
- Um único roteador
- Sem conflitos de IngressClass
- Comportamento previsível

---

## 🔄 Fallback: Se Precisar de NGINX

Se em futuro precisar migrar para NGINX (ex: preparar para AKS), é simples:

```bash
# 1. Desabilitar Traefik IngressRoute
kubectl delete ingressroute frontend -n agro-apps
kubectl delete ingressroute argocd -n argocd

# 2. Habilitar Ingress NGINX
# Descomentar em: infrastructure/kubernetes/apps/base/frontend/kustomization.yaml
# - ingress.yaml

# 3. Re-aplicar
kubectl apply -k infrastructure/kubernetes/apps/overlays/dev
```

---

## ❓ E o cross-env no package.json?

### **Sim, mantém! É essencial:**

```json
{
  "scripts": {
    "build:k8s": "cross-env VITE_BASE_PATH=/agro/ npm run build"
  }
}
```

**Por quê:**

| Sistema | Comando | Sem cross-env | Com cross-env |
|---------|---------|---------------|---------------|
| macOS/Linux | `npm run build:k8s` | ✅ `export VITE_BASE_PATH=/agro/` funciona | ✅ Funciona |
| Windows | `npm run build:k8s` | ❌ Erro (sintaxe Unix) | ✅ Funciona |

**Sem cross-env:**
```powershell
# Windows PowerShell erro:
'VITE_BASE_PATH' não é reconhecido como um comando interno
```

**Com cross-env:**
```powershell
# Windows PowerShell OK:
cross-env VITE_BASE_PATH=/agro/ npm run build
# ✅ Funciona!
```

### **Conclusão:**
- ✅ **Manter cross-env**
- ✅ Permite que team dev em Mac/Windows/Linux use mesmos scripts
- ✅ Prática padrão em projetos JavaScript

---

## 📋 Checklist

- [x] IngressRoute Frontend criado (Traefik)
- [x] IngressRoute ArgoCD criado (Traefik)
- [x] Kustomization atualizado (ingressroute.yaml)
- [x] Ingress NGINX desabilitado (comentado)
- [x] Documentação criada
- [x] cross-env mantido no package.json
- [ ] Testar: `kubectl apply -k infrastructure/kubernetes/apps/overlays/dev`
- [ ] Testar: `http://localhost/agro`
- [ ] Testar: `http://localhost/argocd`

---

## 🎯 Próximas Ações

1. **Aplicar no cluster:**
   ```bash
   kubectl apply -k infrastructure/kubernetes/apps/overlays/dev
   kubectl apply -f infrastructure/kubernetes/platform/base/ingress/argocd-ingressroute.yaml
   ```

2. **Testar acesso:**
   ```bash
   curl http://localhost/agro
   curl http://localhost/argocd
   ```

3. **Opcional: Configurar hosts file para acesso host-based**

4. **Documentar no README.md**

---

## 📚 Referências

- [Traefik IngressRoute](https://doc.traefik.io/traefik/routing/providers/kubernetes-crd/)
- [Traefik Middleware](https://doc.traefik.io/traefik/middlewares/overview/)
- [k3s Traefik Integration](https://docs.k3s.io/networking#traefik-ingress-controller)
