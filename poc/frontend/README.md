# 🌾 TC Agro Solutions - Frontend POC

**Purpose:** Demonstrate the dashboard UI for agricultural monitoring without requiring Azure/AppInsights access  
**Technology:** Vite + ES Modules + axios + Chart.js + dayjs + SignalR  
**Date:** January 2026

---

## 📋 Overview

This Proof of Concept (POC) provides a fully functional frontend UI that:
- ✅ Demonstrates login → dashboard → CRUD flows
- ✅ Uses mock data for immediate demonstration
- ✅ Prepares AJAX calls for backend integration (commented)
- ✅ Real-time updates with SignalR (mock fallback)
- ✅ Interactive charts with Chart.js
- ✅ Works offline (no backend required for demo)
- ✅ Hot reload development with Vite
- ✅ English (en-US) localization

---

## 📁 File Structure

```
poc/frontend/
├── index.html              # Login page (entry point)
├── dashboard.html          # Main dashboard with stats & charts
├── properties.html         # Properties list
├── properties-form.html    # Property create/edit form
├── plots.html              # Plots list
├── plots-form.html         # Plot create/edit form
├── sensors.html            # Sensor monitoring grid
├── alerts.html             # Alert management
├── css/
│   └── style.css           # Unified agro-themed styles
├── js/
│   ├── utils.js            # Common utilities (DOM, formatting, dayjs)
│   ├── auth.js             # Authentication logic
│   ├── api.js              # axios client + SignalR + mock data
│   ├── charts.js           # Chart.js wrapper functions
│   ├── common.js           # Shared page initialization
│   ├── index.js            # Login page entry point
│   ├── dashboard.js        # Dashboard with real-time + charts
│   ├── properties.js       # Properties page script
│   ├── properties-form.js  # Property form script
│   ├── plots.js            # Plots page script
│   ├── plots-form.js       # Plot form script
│   ├── sensors.js          # Sensors page script
│   └── alerts.js           # Alerts page script
├── package.json            # npm dependencies
├── vite.config.js          # Vite configuration
├── .gitignore              # node_modules, dist exclusions
└── README.md               # This file
```

---

## 🚀 Quick Start

### Development Mode (Recommended)
```bash
cd poc/frontend

# Install dependencies (first time only)
npm install

# Start development server with hot reload
npm run dev

# Opens automatically at http://localhost:3000
```

### Production Build
```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

### Demo Credentials
- **Email:** admin@agro.com (or any valid email format)
- **Password:** any (mock authentication)

---

## 🔐 Security Model

### ⚠️ CRITICAL: Frontend Security is for UX Only!

```
┌─────────────────────────────────────────────────────────────────────┐
│                    SECURITY RESPONSIBILITY MODEL                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   FRONTEND (this POC)              BACKEND (required)               │
│   ────────────────────             ───────────────────              │
│   ❌ Does NOT enforce security     ✅ MUST validate JWT tokens      │
│   ✅ Controls UI navigation        ✅ MUST use [Authorize] attr     │
│   ✅ Stores token in sessionStorage ✅ MUST reject invalid tokens   │
│   ✅ Sends Bearer token in headers ✅ MUST enforce business rules   │
│                                                                     │
│   The frontend security is for USER EXPERIENCE only.                │
│   A malicious user can bypass frontend checks.                      │
│   ALL security MUST be enforced on the BACKEND.                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Token Storage
- **Storage:** `sessionStorage` (clears when browser closes)
- **Key:** `agro_token`
- **Format:** JWT Bearer token

### Authentication Flow
```
1. User enters credentials on index.html
2. Frontend calls POST /auth/login (mock in POC)
3. Backend returns JWT token
4. Token stored in sessionStorage
5. All subsequent requests include: Authorization: Bearer <token>
6. Backend validates token on every request
7. If 401 returned → redirect to login
```

### How to Check Token
```javascript
// In browser console:
sessionStorage.getItem('agro_token')   // View current token
sessionStorage.removeItem('agro_token') // Force logout
```

---

## 🔄 Backend Integration

### Enabling Real AJAX Calls

All API calls are prepared in `js/api.js` with mock data. To enable real backend calls:

1. **Set the API base URL:**
```javascript
// In js/api.js, line 1:
const API_BASE_URL = 'https://your-api.azurewebsites.net/api';
```

2. **Uncomment the real fetch calls:**
```javascript
// Each function has this pattern:

// MOCK DATA (for demo)
return Promise.resolve({
  properties: 4,
  plots: 5,
  sensors: 12,
  alerts: 3
});

/* ============================================
 * REAL API CALL (uncomment when backend ready)
 * ============================================
const response = await fetch(`${API_BASE_URL}/dashboard/stats`, {
  headers: getHeaders()
});
return handleResponse(response);
 */
```

3. **Comment out the mock data block and uncomment the real API call**

### Authentication Integration

In `js/auth.js`, update the login handler:

```javascript
// Current mock:
return Promise.resolve({
  token: 'mock-jwt-token-for-demo',
  user: { email: email, name: 'Demo User' }
});

// Replace with real call:
const response = await fetch(`${API_BASE_URL}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});
return handleResponse(response);
```

### SignalR Integration

The POC simulates SignalR with `setInterval`. For real SignalR:

1. Include SignalR client library:
```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/microsoft-signalr/7.0.5/signalr.min.js"></script>
```

2. Update `js/api.js`:
```javascript
// Replace mock connection with real SignalR:
const connection = new signalR.HubConnectionBuilder()
  .withUrl(`${API_BASE_URL}/sensorHub`, {
    accessTokenFactory: () => getToken()
  })
  .withAutomaticReconnect()
  .build();

connection.on('SensorReading', (reading) => {
  updateMetricCard('temperature', reading.temperature);
  updateMetricCard('humidity', reading.humidity);
  // ...
});

await connection.start();
```

---

## 🎨 Design System

### Color Palette (Agro Theme)
```css
--color-primary: #2D5016;        /* Dark Green - headers, buttons */
--color-primary-light: #4A7C2C;  /* Light Green - hover states */
--color-secondary: #6B4423;      /* Soil Brown - accents */
--color-background: #F5F5F0;     /* Light Earth - page background */
--color-surface: #FFFFFF;        /* White - cards */
--color-text: #333333;           /* Dark Gray - body text */
--color-text-muted: #666666;     /* Medium Gray - secondary text */
```

### Icons (Unicode Emoji)
```
🌾 Brand/Logo       📊 Dashboard       🏘️ Properties
🌱 Plots            📡 Sensors         🔔 Alerts
🔐 Security         👤 User            🚪 Logout
✅ Success          ⚠️ Warning         🚨 Critical
💧 Humidity         🌡️ Temperature     🌧️ Rainfall
```

### Responsive Breakpoints
```css
/* Mobile First Approach */
@media (min-width: 768px)  { /* Tablet */ }
@media (min-width: 1024px) { /* Desktop */ }
```

---

## 📱 Pages Overview

### 1. Login (index.html)
- Email/password form
- Error message display
- Loading state
- Redirects if already authenticated

### 2. Dashboard (dashboard.html)
- 4 stat cards (Properties, Plots, Sensors, Alerts)
- Chart placeholders (7-day readings, alert distribution)
- Real-time metrics grid (Temperature, Humidity, Soil, Rainfall)
- Latest sensor readings table
- Pending alerts list
- SignalR mock for live updates

### 3. Properties (properties.html + properties-form.html)
- List with search/filter
- CRUD operations
- Location settings
- Status management

### 4. Plots (plots.html + plots-form.html)
- List with property/crop filters
- **Crop type is mandatory** (hackathon requirement)
- Alert threshold configuration
- Irrigation type selection
- Associated sensors display

### 5. Sensors (sensors.html)
- Grid view with status cards
- Online/Warning/Offline states
- Real-time readings display
- Battery level monitoring
- Refresh functionality

### 6. Alerts (alerts.html)
- Tabbed view (Pending/Resolved/All)
- Severity levels (Critical/Warning/Info)
- Resolution actions
- Alert rules documentation

---

## 🧪 Testing the POC

### Functional Tests
1. **Login Flow:** Open index.html → Enter any email → Click Login → Should redirect to dashboard
2. **Logout Flow:** Click Logout in sidebar → Should return to login
3. **Navigation:** Click each sidebar item → Should show correct page
4. **CRUD:** Properties → Add Property → Fill form → Save → Should show success toast
5. **Responsive:** Resize browser → Sidebar should collapse on mobile

### Browser Console Tests
```javascript
// Check authentication state
console.log('Token:', sessionStorage.getItem('agro_token'));
console.log('User:', sessionStorage.getItem('agro_user'));

// Test logout
clearToken();
location.reload();  // Should redirect to login

// Test protected page access
sessionStorage.removeItem('agro_token');
window.location.href = 'dashboard.html';  // Should redirect to login
```

---

## 🔗 Backend API Expectations

The frontend expects these backend endpoints:

### Authentication
```
POST /auth/login
  Request:  { email, password }
  Response: { token, user: { email, name } }

POST /auth/refresh
  Request:  { token }
  Response: { token }
```

### Dashboard
```
GET /dashboard/stats
  Response: { properties, plots, sensors, alerts }

GET /dashboard/latest?limit=5
  Response: [{ sensorId, plotName, temperature, humidity, soilMoisture, timestamp }]
```

### Properties
```
GET    /properties
POST   /properties
GET    /properties/{id}
PUT    /properties/{id}
DELETE /properties/{id}
```

### Plots
```
GET    /plots?propertyId={id}
POST   /plots
GET    /plots/{id}
PUT    /plots/{id}
DELETE /plots/{id}
```

### Sensors
```
GET /sensors?plotId={id}
GET /sensors/{id}/readings?days=7
```

### Alerts
```
GET  /alerts?status=pending
POST /alerts/{id}/resolve
```

---

## 📦 Dependencies

This POC uses npm-managed libraries:

| Package | Version | Purpose |
|---------|---------|---------|
| vite | ^5.4.21 | Dev server + bundler |
| axios | ^1.6.x | HTTP client |
| chart.js | ^4.4.x | Interactive charts |
| dayjs | ^1.11.x | Date formatting |
| @microsoft/signalr | ^8.x | Real-time updates |

### Install
```bash
npm install
```

---

## 🚧 Limitations

1. **No real authentication:** Frontend security is simulated
2. **Mock data only:** All data is hardcoded in JavaScript
3. **No data persistence:** Refreshing page resets state
4. **SignalR mocked:** Uses setInterval fallback until backend ready

---

## 📚 Related Documentation

- [Technical Roadmap](../../README_ROADMAP.md)
- [Local Development Setup](../../docs/development/local-setup.md)
- [API Conventions](../../docs/adr/) (ADRs)
- [Security Model](../../.github/copilot-instructions.md#jwt-authentication)

---

## 🎯 Next Steps

1. **Backend Integration:** Uncomment AJAX calls when APIs are ready
2. **Real SignalR:** Replace mock with actual SignalR hub
3. **Form Validation:** Add client-side validation library
4. **Error Handling:** Improve error states and messages

---

> **POC Version:** 2.0 (Vite + ES Modules)  
> **Created:** January 2026  
> **Purpose:** Hackathon 8NETT demonstration without Azure dependencies
