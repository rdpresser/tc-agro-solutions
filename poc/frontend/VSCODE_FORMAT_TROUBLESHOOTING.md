# 🔧 VS Code - Troubleshooting Format On Save

**Data:** Janeiro 2026  
**Problema:** `Ctrl+S` não está formatando automaticamente com Prettier

---

## ✅ Configuração Atual (Correta)

### Arquivo: `.vscode/settings.json`

```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "[javascript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[json]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```

### Extensões Instaladas

- ✅ `dbaeumer.vscode-eslint` (ESLint)
- ✅ `esbenp.prettier-vscode` (Prettier)

---

## 🔧 Solução em 5 Passos

### Passo 1: Recarregar VS Code (MAIS IMPORTANTE!)

**Atalho:** `Ctrl+Shift+P` → Digite `"Reload Window"` → `Enter`

**Por quê?** VS Code precisa reiniciar para aplicar novas configurações de workspace.

**Teste após reload:**

1. Abra qualquer arquivo `.js`
2. Adicione espaços extras: `function  test(   ) {    }`
3. Salve (`Ctrl+S`)
4. Se formatar automaticamente = ✅ **RESOLVIDO!**

---

### Passo 2: Verificar Barra de Status

**Localização:** Canto inferior direito do VS Code

**O que procurar:**

- ✅ **Deve mostrar:** `Prettier` (pequeno ícone ou texto)
- ❌ **Se mostrar:** `undefined` ou nada = Prettier não está ativo

**Como ativar:**

1. Clique na barra de status onde aparece o formatador
2. Selecione `"Configure Default Formatter"`
3. Escolha `"Prettier - Code formatter"`

---

### Passo 3: Testar Formatação Manual

**Atalho:** `Shift+Alt+F` (Windows) ou `Shift+Option+F` (Mac)

**Teste:**

1. Abra `js/utils.js`
2. Desformate uma linha: `function    test(   x  ,  y   ){}`
3. Pressione `Shift+Alt+F`

**Resultados possíveis:**

- ✅ **Formatou:** Prettier funciona! Problema está só no `formatOnSave`
- ❌ **Pediu para escolher formatador:** Selecione `Prettier - Code formatter`
- ❌ **Erro:** Veja Passo 5 (Output Logs)

---

### Passo 4: Verificar Settings Globais

**Atalho:** `Ctrl+,` (abre Settings)

**Verificar:**

1. Na busca, digite: `format on save`
2. Deve estar **MARCADO** ✓
3. Na busca, digite: `default formatter`
4. Deve mostrar: `Prettier - Code formatter`

**Se não estiver marcado:**

- Marque `Editor: Format On Save` ✓
- Selecione `Prettier` como default formatter

**Nota:** Settings globais (User) podem sobrescrever settings do workspace!

---

### Passo 5: Verificar Logs de Erro

**Atalho:** `Ctrl+Shift+U` (abre Output panel)

**Passos:**

1. No dropdown superior, selecione `"Prettier"`
2. Abra um arquivo `.js`
3. Faça uma mudança e salve (`Ctrl+S`)
4. Observe os logs

**Possíveis mensagens:**

- ✅ `"Formatting completed"` = Funcionando!
- ❌ `"No parser found"` = Problema de configuração
- ❌ `"Cannot format"` = Arquivo pode estar em `.prettierignore`

---

## 🧪 Teste Rápido (30 segundos)

```bash
# 1. Feche completamente o VS Code (File → Exit)

# 2. Reabra VS Code (importante reiniciar!)

# 3. Abra o workspace:
#    File → Open Folder → Selecione: C:\Projects\tc-agro-solutions\poc\frontend

# 4. Abra: js/utils.js

# 5. Adicione espaços extras em qualquer função:
function    test(   x  ,  y   ){   return x+y;   }

# 6. Salve (Ctrl+S)

# 7. Resultado esperado:
function test(x, y) {
  return x + y;
}
```

**Se formatou:** ✅ **FUNCIONANDO!**  
**Se não formatou:** Continue troubleshooting abaixo.

---

## 🔍 Troubleshooting Avançado

### Problema: Prettier não aparece na barra de status

**Solução:**

1. `Ctrl+Shift+P` → `"Format Document With..."`
2. Selecione `"Configure Default Formatter..."`
3. Escolha `"Prettier - Code formatter"`
4. Tente salvar novamente

### Problema: "There is no formatter for 'javascript' files installed"

**Solução:**

1. Verifique que a extensão Prettier está habilitada:
   - `Ctrl+Shift+X` (Extensions)
   - Busque `"Prettier"`
   - Deve mostrar `"Disable"` (significa está habilitada)
2. Se mostrar `"Enable"`, clique para habilitar
3. Recarregue VS Code

### Problema: Formatação funciona manualmente (Shift+Alt+F) mas não no save

**Solução:**

1. Verifique conflito com outras extensões de formatação
2. Desabilite temporariamente outras extensões de formatação (ex: Beautify, JS-CSS-HTML Formatter)
3. Verifique se tem configuração global que desabilita format on save:
   ```json
   // User settings.json (REMOVER se existir)
   "editor.formatOnSave": false  // ← REMOVER ESTA LINHA
   ```

### Problema: Formata alguns arquivos mas não outros

**Solução:**

1. Verifique `.prettierignore`:
   ```
   # Certifique que js/ não está ignorado
   node_modules/
   dist/
   build/
   .vscode/
   # js/ deve NÃO estar aqui!
   ```
2. Verifique language-specific settings:
   ```json
   // .vscode/settings.json - Já está correto!
   "[javascript]": {
     "editor.defaultFormatter": "esbenp.prettier-vscode"
   }
   ```

---

## 📋 Checklist Final

Antes de pedir ajuda, verifique:

- [ ] Recarreguei VS Code (`Ctrl+Shift+P` → `"Reload Window"`)
- [ ] Prettier aparece na barra de status (canto inferior direito)
- [ ] Formatação manual funciona (`Shift+Alt+F`)
- [ ] `editor.formatOnSave` está marcado ✓ em Settings (`Ctrl+,`)
- [ ] Prettier está selecionado como default formatter
- [ ] Extensão Prettier está habilitada (não desabilitada)
- [ ] Abri o VS Code como workspace (não arquivo individual)
- [ ] Não há erros no Output → Prettier

---

## 🎯 Comando Rápido de Validação

Execute no terminal para validar configuração:

```powershell
cd C:\Projects\tc-agro-solutions\poc\frontend

# Verificar extensões instaladas
code --list-extensions | Select-String -Pattern "eslint|prettier"

# Verificar arquivo de configuração existe
Test-Path .vscode/settings.json

# Ler configuração (deve mostrar formatOnSave: true)
Get-Content .vscode/settings.json | Select-String -Pattern "formatOnSave"
```

**Output esperado:**

```
dbaeumer.vscode-eslint
esbenp.prettier-vscode
True
  "editor.formatOnSave": true,
```

---

## ✅ Quando Está Funcionando

Você saberá que está funcionando quando:

1. Salvar arquivo `.js` = código se formata automaticamente
2. Espaços extras são removidos
3. Indentação é corrigida
4. Vírgulas são adicionadas/removidas conforme `.prettierrc.json`
5. Output → Prettier mostra: `"Formatting completed"`

---

## 📞 Ainda Não Funciona?

Se seguiu todos os passos e ainda não funciona:

1. **Desinstale e reinstale Prettier:**
   - `Ctrl+Shift+X`
   - Busque `"Prettier"`
   - Clique `"Uninstall"`
   - Reinicie VS Code
   - Reinstale Prettier
   - Recarregue VS Code

2. **Verifique versão do VS Code:**
   - `Help` → `About`
   - Versão deve ser >= 1.80
   - Se muito antiga, atualize

3. **Teste em arquivo novo:**
   - Crie `test.js` na raiz do projeto
   - Adicione: `function    test(   ){}`
   - Salve (`Ctrl+S`)
   - Se formatar = problema é com arquivo específico

4. **Última opção - Reset completo:**

   ```powershell
   # Backup settings atuais
   Copy-Item .vscode/settings.json .vscode/settings.backup.json

   # Delete e recrie
   Remove-Item .vscode/settings.json

   # Crie novamente com config mínima
   @"
   {
     "editor.formatOnSave": true,
     "editor.defaultFormatter": "esbenp.prettier-vscode"
   }
   "@ | Out-File .vscode/settings.json -Encoding UTF8

   # Recarregue VS Code
   ```

---

> **Dica de Ouro:** Na maioria dos casos, um simples **reload do VS Code** (`Ctrl+Shift+P` → `"Reload Window"`) resolve o problema! ⚡

> **Criado:** Janeiro 2026  
> **Atualizado:** Após setup completo de linting e formatação
