# Testing Guide - TC Agro Solutions Frontend

**Purpose:** Testing guide for login, authentication, sidebar, and form functionality  
**Updated:** January 10, 2026  
**Architecture:** Vite + ES Modules

---

## Overview

This guide covers manual testing of the frontend POC:

- ✅ Login flow with spinner animation
- ✅ Sidebar toggle (mobile + desktop)
- ✅ Logout and session clearing
- ✅ Protected page authentication
- ✅ Form functionality (Properties & Plots)

For DOM helper usage and API patterns, see [HELPERS_QUICK_REFERENCE.md](./HELPERS_QUICK_REFERENCE.md).

---

## Prerequisites

### Start Development Server

```bash
cd poc/frontend
npm install  # First time only
npm run dev
```

Server will start at: **http://localhost:3000** (or 3001 if 3000 is in use)

### Demo Credentials

- **Email:** admin@agro.com (or any valid email)
- **Password:** any (mock authentication)

---

## Test Scenarios

### 1. Login Flow with Spinner ✅

**Steps:**

1. Open http://localhost:3000/index.html
2. Enter email: `admin@agro.com`
3. Enter any password
4. Click **🔐 Sign In**

**Expected:**

- ✅ Button shows spinner: `[⚪ Signing in...]`
- ✅ Button is disabled during login
- ✅ Redirects to dashboard after 800ms

**Console Output:**

```
[Auth] Login initiated for: admin@agro.com
[Auth] Login successful
```

### 2. Sidebar Toggle - Desktop ✅

**Steps:**

1. Resize browser width > 768px
2. Click **☰** menu button

**Expected:**

- ✅ Sidebar collapses to 60px width
- ✅ Main content shifts left margin to 60px
- ✅ Menu icons remain visible

**Click again:**

- ✅ Sidebar expands to 250px
- ✅ Main content returns to full width

**Console Output:**

```
[Sidebar Module] Initializing...
[Sidebar] Toggle clicked
[Sidebar] Desktop - collapsed: true
[Sidebar] Style width: 60px
```

### 3. Sidebar Toggle - Mobile ✅

**Steps:**

1. Resize browser width ≤ 768px
2. Click **☰** menu button

**Expected:**

- ✅ Sidebar slides in from left
- ✅ Dark overlay appears
- ✅ Can click overlay to close

**Console Output:**

```
[Sidebar] Toggle clicked
[Sidebar] Mobile - open: true
```

### 4. Logout Functionality ✅

**Steps:**

1. From any protected page (dashboard, properties, etc.)
2. Click **🚪 Logout** in sidebar

**Expected:**

- ✅ Toast message: "You have been logged out"
- ✅ Redirects to login page
- ✅ Session storage cleared

**Verify in Console:**

```javascript
sessionStorage.getItem('agro_token'); // null
sessionStorage.getItem('agro_user'); // null
```

### 5. Protected Page Access ✅

**Steps:**

1. Logout or clear session: `sessionStorage.clear()`
2. Try to access: http://localhost:3000/dashboard.html

**Expected:**

- ✅ Immediately redirects to login page
- ✅ Works for all protected pages:
  - dashboard.html
  - properties.html
  - plots.html
  - sensors.html
  - alerts.html

### 6. Properties Form (CRUD) ✅

**Create Property:**

1. Login → Properties → Add Property
2. Fill form with `$id()` helpers:
   - Name: "Test Farm"
   - Location: "São Paulo, SP"
   - Area: 100
3. Click Save

**Expected:**

- ✅ Success toast shown
- ✅ Redirects to properties list
- ✅ New property appears in table

**Edit Property:**

1. Click Edit on any property
2. Form populates using `setFormData()`
3. Modify fields
4. Click Update

**Expected:**

- ✅ Form loads correctly
- ✅ Update succeeds
- ✅ Returns to list

### 7. Plots Form (CRUD) ✅

**Create Plot:**

1. Login → Plots → Add Plot
2. Fill all fields (crop type is mandatory)
3. Click Save

**Expected:**

- ✅ All 19 fields use `$id()` for access
- ✅ Crop type validation works
- ✅ Success toast shown

---

## ES Module Architecture

All JavaScript files are ES Modules:

**Import Example:**

```javascript
// From properties-form.js
import { $id, getFormData, setFormData } from './utils.js';
import { createProperty, updateProperty } from './api.js';
```

**Module Loading:**

```html
<!-- All pages use type="module" -->
<script type="module" src="/js/dashboard.js"></script>
```

**Benefits:**

- ✅ Explicit dependencies
- ✅ No global pollution
- ✅ Tree-shaking enabled

See [README.md](./README.md#🏗️-es-module-architecture) for full architecture details.

---

## Debugging

### Console Log Prefixes

| Prefix             | Module     | Purpose              |
| ------------------ | ---------- | -------------------- |
| `[Sidebar Module]` | sidebar.js | Initialization       |
| `[Sidebar]`        | sidebar.js | Toggle events        |
| `[Common]`         | common.js  | Logout, user display |
| `[Auth]`           | auth.js    | Login/logout flow    |
| `[API]`            | api.js     | HTTP requests, retry |

### Common Issues

**Issue:** Menu toggle doesn't work  
**Fix:** Verify `initSidebar()` is called from `common.js`

**Issue:** Forms not populating  
**Fix:** Check `setFormData()` is importing from `utils.js`

**Issue:** Logout doesn't redirect  
**Fix:** Verify `handleLogout()` is clearing token and redirecting

**Issue:** Protected pages not redirecting  
**Fix:** Ensure `initProtectedPage()` is in `DOMContentLoaded`

---

## Manual Test Checklist

Use this checklist for comprehensive testing:

- [ ] Login spinner shows on submit
- [ ] Login redirects to dashboard
- [ ] Sidebar collapses on desktop (click ☰)
- [ ] Sidebar slides on mobile (width ≤ 768px)
- [ ] Overlay closes sidebar on mobile
- [ ] Logout clears session storage
- [ ] Logout redirects to login
- [ ] Unauthenticated access redirects
- [ ] Properties create form works
- [ ] Properties edit form populates
- [ ] Plots create form validates crop type
- [ ] Plots edit form works
- [ ] All forms use `$id()` helper
- [ ] All pages are ES modules

---

## Related Documentation

- **[README.md](./README.md)** - Complete frontend overview
- **[HELPERS_QUICK_REFERENCE.md](./HELPERS_QUICK_REFERENCE.md)** - DOM & API helper reference
- **[MODERNIZATION_SUMMARY.md](./MODERNIZATION_SUMMARY.md)** - Refactoring details

---

## Key Files

| File            | Purpose                                         |
| --------------- | ----------------------------------------------- |
| `js/common.js`  | Sidebar, logout, user display (ES Module)       |
| `js/sidebar.js` | Sidebar toggle logic (ES Module)                |
| `js/auth.js`    | Login/logout handlers (ES Module)               |
| `js/utils.js`   | DOM helpers + session storage (ES Module)       |
| `js/api.js`     | Axios + retry + error normalization (ES Module) |

---

> **Status:** ✅ All tests passing  
> **Architecture:** Pure ES Modules  
> **Version:** 3.0  
> **Updated:** January 10, 2026

```
[Sidebar Setup] { sidebar: true, overlay: true, menuToggle: true }
[Menu Toggle] Clicked
```

### 4. Test Logout

**From any protected page (dashboard, properties, plots, sensors, alerts):**

1. Click **🚪 Logout** in the sidebar
2. ✅ Should see toast message: "You have been logged out"
3. ✅ Should redirect to login page (index.html)
4. ✅ Session storage should be cleared

**Console logs (DEV mode):**

```
[Logout Links] Found: 1
[Logout] Triggered
```

**Verify session cleared:**
Open browser console and type:

```javascript
sessionStorage.getItem('agro_token'); // Should return null
sessionStorage.getItem('agro_user'); // Should return null
```

### 5. Test Protected Pages (Auth Check)

1. Logout or clear session: `sessionStorage.clear()`
2. Try to access: http://localhost:3000/dashboard.html
3. ✅ Should redirect to login immediately
4. Same for: properties.html, plots.html, sensors.html, alerts.html

---

## Technical Details

### Files Modified

| File              | Change                                                |
| ----------------- | ----------------------------------------------------- |
| `js/dashboard.js` | Now uses `initProtectedPage()` from common.js         |
| `js/common.js`    | Added debug logs for sidebar setup                    |
| `js/auth.js`      | Improved `handleLogout()` with comments and timeout   |
| `js/utils.js`     | Documented `clearToken()` with sessionStorage cleanup |

### Session Storage Keys

| Key          | Purpose                     |
| ------------ | --------------------------- |
| `agro_token` | JWT authentication token    |
| `agro_user`  | User info (email, name, id) |

### How Logout Works

1. User clicks logout button (`[data-action="logout"]`)
2. `handleLogout()` is called (auth.js)
3. `clearToken()` removes token + user from sessionStorage
4. Toast notification shown
5. Redirect to `/index.html` after 500ms
6. Protected pages check auth → redirect to login

### How Menu Toggle Works

1. User clicks **☰** button (`#menuToggle`)
2. Event listener in `common.js` toggles classes
3. Sidebar gets `.active` class → slides in via CSS
4. Overlay gets `.active` class → becomes visible
5. Clicking overlay removes `.active` → sidebar slides out

---

## Debugging

### Enable Console Logs

Development mode logs are enabled by default with Vite.

Look for these prefixes in console:

- `[Sidebar Setup]` - Element detection
- `[Menu Toggle]` - Button clicks
- `[Overlay]` - Overlay clicks
- `[Logout Links]` - Found logout buttons
- `[Logout]` - Logout triggered

### Common Issues

**Issue:** Menu toggle doesn't work  
**Fix:** Check if `id="menuToggle"` exists in HTML and `common.js` is loaded

**Issue:** Logout doesn't redirect  
**Fix:** Check browser console for errors, verify `handleLogout()` is called

**Issue:** Protected page doesn't redirect to login  
**Fix:** Verify `initProtectedPage()` is called at the top of each page's JS file

---

## Related Files

- [README.md](README.md) - Full frontend documentation
- [js/common.js](js/common.js) - Sidebar and logout logic
- [js/auth.js](js/auth.js) - Authentication handlers
- [js/utils.js](js/utils.js) - Session storage utilities

---

> **Status:** ✅ All fixes tested and working  
> **Version:** 2.1 (Vite + ES Modules + Fixed Menu & Logout)  
> **Date:** January 9, 2026
