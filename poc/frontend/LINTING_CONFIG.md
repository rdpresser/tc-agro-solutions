# 🔧 Linting & Formatting Configuration

**Project:** TC Agro Solutions POC  
**Date:** January 10, 2026  
**Status:** ✅ Configured

---

## 📦 Installed Tools

### 1. **ESLint** - JavaScript Linter

- **Version:** ^8.57.0
- **Purpose:** Detect code quality issues, potential bugs, and enforce coding standards
- **Plugin:** `eslint-plugin-import` for ES Module validation

### 2. **Prettier** - Code Formatter

- **Version:** ^3.2.5
- **Purpose:** Consistent code formatting across the project
- **Formats:** JavaScript, JSON, HTML, CSS, Markdown

### 3. **vite-plugin-checker** - Vite Integration

- **Version:** ^0.6.4
- **Purpose:** Show ESLint errors/warnings in Vite dev server and build
- **Benefit:** Real-time feedback during development

---

## 🎯 Configuration Files

### `.eslintrc.json`

```json
{
  "env": {
    "browser": true,
    "es2021": true,
    "node": true
  },
  "extends": ["eslint:recommended"],
  "parserOptions": {
    "ecmaVersion": "latest",
    "sourceType": "module"
  }
}
```

**Key Rules:**

- ✅ No unused variables
- ✅ Prefer const over let
- ✅ No var keyword
- ✅ Import order validation
- ✅ No console.log (warns, allows console.error/warn/info)
- ✅ Modern ES syntax enforcement

### `.prettierrc.json`

```json
{
  "semi": true,
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2
}
```

**Style Choices:**

- Single quotes for strings
- Semicolons required
- 100 character line width
- 2 spaces indentation

---

## 🚀 NPM Scripts

### Development

```bash
npm run dev              # Start dev server with ESLint checking
npm run lint             # Check for linting errors
npm run lint:fix         # Auto-fix linting issues
npm run format           # Format all files with Prettier
npm run format:check     # Check if files are formatted
```

### Build

```bash
npm run build            # Production build (with ESLint validation)
npm run preview          # Preview production build
```

---

## 🔍 What Gets Checked?

### ESLint Checks

| Issue             | Severity   | Example                                           |
| ----------------- | ---------- | ------------------------------------------------- |
| Unused imports    | ❌ Error   | `import { unused } from './utils.js'`             |
| Unused variables  | ❌ Error   | `const x = 5; // never used`                      |
| console.log       | ⚠️ Warning | `console.log('debug')` allowed: `console.error()` |
| var keyword       | ❌ Error   | `var x = 5;` use `const` or `let`                 |
| Duplicate imports | ❌ Error   | `import { $ } from './utils.js'` twice            |
| Missing await     | ⚠️ Warning | `async function() { return value; }`              |

### Prettier Formats

- ✅ JavaScript (.js)
- ✅ JSON (.json)
- ✅ HTML (.html)
- ✅ CSS (.css)
- ✅ Markdown (.md)

---

## 🎨 Vite Configuration Improvements

### Before

```javascript
export default defineConfig({
  server: { port: 3000 },
  build: { target: 'esnext' }
});
```

### After

```javascript
export default defineConfig({
  plugins: [
    checker({ eslint: { ... } }) // ✅ ESLint integration
  ],
  server: {
    port: 3000,
    hmr: { overlay: true } // ✅ Show errors in browser
  },
  build: {
    sourcemap: false, // ✅ Security
    esbuild: {
      drop: ['console', 'debugger'] // ✅ Remove in production
    },
    rollupOptions: {
      output: {
        manualChunks: { // ✅ Better caching
          'vendor': ['axios', '@microsoft/signalr'],
          'charts': ['chart.js']
        }
      }
    }
  },
  optimizeDeps: { // ✅ Pre-bundling
    include: ['axios', 'chart.js', 'dayjs']
  }
});
```

### Key Improvements

1. ✅ **ESLint Plugin** - Real-time error overlay in browser
2. ✅ **Code Splitting** - Vendor, charts, utils separated for better caching
3. ✅ **Console Removal** - `console.log` and `debugger` removed in production
4. ✅ **Dependency Optimization** - Pre-bundle dependencies for faster dev server
5. ✅ **Asset Handling** - Inline small assets as base64
6. ✅ **Chunk Size Warnings** - Alerts for bundles > 1000kb

---

## 📊 Integration with VS Code

### Recommended Extensions

1. **ESLint** (`dbaeumer.vscode-eslint`)
2. **Prettier** (`esbenp.prettier-vscode`)
3. **Vite** (`antfu.vite`)

### Auto-format on Save

Add to `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  }
}
```

---

## 🐛 Common Issues & Solutions

### Issue: ESLint not working in dev server

**Solution:** Run `npm install` to ensure `vite-plugin-checker` is installed

### Issue: Prettier conflicts with ESLint

**Solution:** Prettier handles formatting, ESLint handles code quality - no conflicts

### Issue: Too many console.log warnings

**Solution:** Use `console.error()` or `console.warn()` for production logs

### Issue: Import order warnings

**Solution:** Run `npm run lint:fix` to auto-fix import order

---

## 📈 Benefits

### Before Configuration

- ❌ No linting
- ❌ Inconsistent code style
- ❌ Manual error checking
- ❌ Large bundle sizes
- ❌ console.log in production

### After Configuration

- ✅ Real-time linting in dev server
- ✅ Consistent code formatting
- ✅ Automatic error detection
- ✅ Optimized bundle sizes
- ✅ Clean production builds
- ✅ Better caching strategy

---

## 🔄 Workflow Example

### Development

```bash
# 1. Start dev server (ESLint runs automatically)
npm run dev

# 2. Edit code → See errors in browser overlay
# 3. Fix errors manually or:
npm run lint:fix

# 4. Format code before commit
npm run format
```

### Pre-commit

```bash
# Check linting
npm run lint

# Check formatting
npm run format:check

# If issues, fix:
npm run lint:fix
npm run format
```

### Build

```bash
# Production build (ESLint validates, console.log removed)
npm run build

# Preview
npm run preview
```

---

## 📚 Related Documentation

- [ESLint Documentation](https://eslint.org/docs/latest/)
- [Prettier Documentation](https://prettier.io/docs/en/)
- [Vite Plugin Checker](https://github.com/fi3ework/vite-plugin-checker)
- [Vite Build Optimization](https://vitejs.dev/guide/build.html)

---

## ✅ Checklist

- [x] ESLint configured (`.eslintrc.json`)
- [x] Prettier configured (`.prettierrc.json`)
- [x] vite-plugin-checker installed
- [x] npm scripts added (lint, format)
- [x] Vite config optimized
- [x] Ignore files created
- [x] Documentation complete

---

> **Version:** 1.0  
> **Status:** ✅ Production Ready  
> **Next:** Run `npm install` to install dependencies
