# Testing Guide - Menu Toggle & Logout

## Recent Fixes (January 9, 2026)

Fixed three critical issues in the frontend:

1. **Menu Toggle** - Sidebar collapse/expand stopped working (CSS/JS class mismatch)
2. **Logout** - Logout button wasn't clearing session and redirecting
3. **Login Spinner** - Login button lost loading spinner animation

---

## How to Test

### 1. Start Development Server

```bash
cd poc/frontend
npm run dev
```

Server will start at: http://localhost:3000

### 2. Test Login Flow with Spinner

1. Open http://localhost:3000/index.html
2. Enter any email (e.g., `admin@agro.com`)
3. Enter any password
4. Click **🔐 Sign In**
5. ✅ Should see spinner animation inside button
6. ✅ Button text changes to "Signing in..."
7. ✅ Button is disabled during login
8. ✅ Should redirect to dashboard after 800ms

**Visual:**
```
Before click: [🔐 Sign In]
During login: [⚪ Signing in...] ← spinning animation
After success: → redirects to dashboard
```

### 3. Test Menu Toggle (Mobile/Desktop)

**Desktop (resize browser to < 768px):**
1. Click the **☰** button in the top-left
2. ✅ Sidebar should slide in from the left
3. Click **☰** again or click the overlay
4. ✅ Sidebar should slide out

**Console logs (DEV mode):**
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
sessionStorage.getItem('agro_token')  // Should return null
sessionStorage.getItem('agro_user')   // Should return null
```

### 5. Test Protected Pages (Auth Check)

1. Logout or clear session: `sessionStorage.clear()`
2. Try to access: http://localhost:3000/dashboard.html
3. ✅ Should redirect to login immediately
4. Same for: properties.html, plots.html, sensors.html, alerts.html

---

## Technical Details

### Files Modified

| File | Change |
|------|--------|
| `js/dashboard.js` | Now uses `initProtectedPage()` from common.js |
| `js/common.js` | Added debug logs for sidebar setup |
| `js/auth.js` | Improved `handleLogout()` with comments and timeout |
| `js/utils.js` | Documented `clearToken()` with sessionStorage cleanup |

### Session Storage Keys

| Key | Purpose |
|-----|---------|
| `agro_token` | JWT authentication token |
| `agro_user` | User info (email, name, id) |

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
