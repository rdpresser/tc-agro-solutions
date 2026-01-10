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

# 🔧 VS Code - Troubleshooting Format On Save

**Date:** January 2026  
**Issue:** `Ctrl+S` is not formatting automatically with Prettier

---

## ✅ Current Configuration (Correct)

### File: `.vscode/settings.json`

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

### Installed Extensions

- ✅ `dbaeumer.vscode-eslint` (ESLint)
- ✅ `esbenp.prettier-vscode` (Prettier)

---

## 🔧 Fix in 5 Steps

### Step 1: Reload VS Code (MOST IMPORTANT)

**Shortcut:** `Ctrl+Shift+P` → type `"Reload Window"` → `Enter`

**Why?** VS Code needs a reload to apply new workspace settings.

**Test after reload:**

1. Open any `.js` file
2. Add extra spaces: `function  test(   ) {    }`
3. Save (`Ctrl+S`)
4. If it auto-formats = ✅ **FIXED!**

---

### Step 2: Check Status Bar

**Location:** Bottom-right of VS Code

**What to see:**

- ✅ Should display `Prettier` (icon or text)
- ❌ If it shows `undefined` or nothing = Prettier is not active

**How to activate:**

1. Click the status bar formatter name
2. Select `"Configure Default Formatter"`
3. Choose `"Prettier - Code formatter"`

---

### Step 3: Test Manual Formatting

**Shortcut:** `Shift+Alt+F` (Windows) or `Shift+Option+F` (Mac)

**Test:**

1. Open `js/utils.js`
2. Break formatting: `function    test(   x  ,  y   ){}`
3. Press `Shift+Alt+F`

**Possible results:**

- ✅ Formatted: Prettier works; issue is only formatOnSave
- ❌ Prompt to choose formatter: select `Prettier - Code formatter`
- ❌ Error: see Step 5 (Output Logs)

---

### Step 4: Check User Settings

**Shortcut:** `Ctrl+,` (opens Settings)

**Verify:**

1. Search: `format on save` → should be **ENABLED** ✓
2. Search: `default formatter` → should show `Prettier - Code formatter`

**If not enabled:**

- Enable `Editor: Format On Save` ✓
- Select `Prettier` as default formatter

**Note:** User-level settings can override the workspace settings.

---

### Step 5: Check Output Logs

**Shortcut:** `Ctrl+Shift+U` (Output panel)

**Steps:**

1. In the dropdown, select `"Prettier"`
2. Open a `.js` file
3. Make a change and save (`Ctrl+S`)
4. Watch the logs

**Common messages:**

- ✅ `"Formatting completed"` = Working
- ❌ `"No parser found"` = Configuration issue
- ❌ `"Cannot format"` = File may be in `.prettierignore`

---

## 🧪 30-Second Quick Test

```bash
# 1. Close VS Code completely (File → Exit)

# 2. Reopen VS Code (reload is important)

# 3. Open the workspace:
#    File → Open Folder → Select: C:\Projects\tc-agro-solutions\poc\frontend

# 4. Open: js/utils.js

# 5. Add extra spaces in any function:
function    test(   x  ,  y   ){   return x+y;   }

# 6. Save (Ctrl+S)

# 7. Expected result:
function test(x, y) {
  return x + y;
}
```

**If it formatted:** ✅ **WORKING!**  
**If not:** continue below.

---

## 🔍 Advanced Troubleshooting

### Issue: Prettier not showing in status bar

**Fix:**

1. `Ctrl+Shift+P` → `"Format Document With..."`
2. Select `"Configure Default Formatter..."`
3. Choose `"Prettier - Code formatter"`
4. Save again

### Issue: "There is no formatter for 'javascript' files installed"

**Fix:**

1. Ensure the Prettier extension is enabled:
   - `Ctrl+Shift+X` (Extensions)
   - Search `"Prettier"`
   - It should show `"Disable"` (meaning it is enabled)
2. If it shows `"Enable"`, click to enable
3. Reload VS Code

### Issue: Manual format works, but save does not

**Fix:**

1. Check for conflicts with other formatter extensions
2. Temporarily disable other formatters (e.g., Beautify, JS-CSS-HTML Formatter)
3. Ensure no global setting disables format on save:
   ```json
   // User settings.json (REMOVE if present)
   "editor.formatOnSave": false
   ```

### Issue: Some files format, others do not

**Fix:**

1. Check `.prettierignore`:
   ```
   # Make sure js/ is NOT ignored
   node_modules/
   dist/
   build/
   .vscode/
   # js/ should NOT be here!
   ```
2. Verify language-specific settings:
   ```json
   // .vscode/settings.json (already correct)
   "[javascript]": {
     "editor.defaultFormatter": "esbenp.prettier-vscode"
   }
   ```

---

## 📋 Final Checklist

Before asking for help, confirm:

- [ ] Reloaded VS Code (`Ctrl+Shift+P` → `"Reload Window"`)
- [ ] Prettier shows in the status bar (bottom right)
- [ ] Manual format works (`Shift+Alt+F`)
- [ ] `editor.formatOnSave` is enabled in Settings (`Ctrl+,`)
- [ ] Prettier is the default formatter
- [ ] Prettier extension is enabled (not disabled)
- [ ] Workspace is opened (not a single file)
- [ ] No errors in Output → Prettier

---

## 🎯 Quick Validation Command

Run in the terminal to validate setup:

```powershell
cd C:\Projects\tc-agro-solutions\poc\frontend

# Check installed extensions
code --list-extensions | Select-String -Pattern "eslint|prettier"

# Verify settings file exists
Test-Path .vscode/settings.json

# Read settings (should show formatOnSave: true)
Get-Content .vscode/settings.json | Select-String -Pattern "formatOnSave"
```

**Expected output:**

```
   }
esbenp.prettier-vscode
True
  "editor.formatOnSave": true,
```

---

## ✅ Signs It Is Working

You know it is working when:

1. Saving a `.js` file auto-formats the code
2. Extra spaces are removed
3. Indentation is corrected
   "@ | Out-File .vscode/settings.json -Encoding UTF8

   # Recarregue VS Code

   ```

   ```

---

> **Dica de Ouro:** Na maioria dos casos, um simples **reload do VS Code** (`Ctrl+Shift+P` → `"Reload Window"`) resolve o problema! ⚡

> **Criado:** Janeiro 2026  
> **Atualizado:** Após setup completo de linting e formatação
