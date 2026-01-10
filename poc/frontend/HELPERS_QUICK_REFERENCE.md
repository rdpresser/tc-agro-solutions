# Quick Reference - DOM & API Helpers

Quick guide for using the new utilities in TC Agro Solutions frontend.

---

## DOM Helpers (`js/utils.js`)

### `$id(id)` - Get element by ID

```javascript
import { $id } from './utils.js';

// BEFORE
const form = document.getElementById('myForm');

// AFTER
const form = $id('myForm');
```

### `onReady(callback)` - DOM ready handler

```javascript
import { onReady } from './utils.js';

onReady(() => {
  console.log('DOM is ready!');
  initPage();
});
```

### `toggleClass(element, className, force)` - Toggle CSS class

```javascript
import { toggleClass } from './utils.js';

// Toggle class
toggleClass(sidebar, 'open');

// Force add
toggleClass(sidebar, 'open', true);

// Force remove
toggleClass(sidebar, 'open', false);

// Works with selector too
toggleClass('#sidebar', 'open');
```

### `getFormData(form)` - Extract form values

```javascript
import { getFormData } from './utils.js';

const data = getFormData('#propertyForm');
console.log(data);
// { name: 'Farm A', location: 'SP', areaHectares: '100', status: 'active' }

// Works with element reference too
const form = $id('propertyForm');
const data = getFormData(form);
```

### `setFormData(form, data)` - Populate form

```javascript
import { setFormData } from './utils.js';

const property = {
  name: 'Farm A',
  location: 'São Paulo, SP',
  areaHectares: 150.5,
  status: 'active'
};

setFormData('#propertyForm', property);
// All matching fields are populated automatically
```

---

## API Helpers (`js/api.js`)

### Automatic Retry (Built-in)

```javascript
import { api } from './api.js';

// GET requests auto-retry on network errors or 5xx
const { data } = await api.get('/properties');
// If it fails with 503, retries after 1s, then 2s
// Max 2 retries (3 total attempts)
```

### `normalizeError(err)` - Consistent error handling

```javascript
import { api, normalizeError } from './api.js';

try {
  await api.post('/properties', propertyData);
} catch (error) {
  const { message, status, code } = normalizeError(error);

  console.log('Error:', message);
  console.log('Status:', status);
  console.log('Code:', code);

  showToast(message, 'error');
}
```

**Error shape returned:**

```javascript
{
  message: "Request failed",  // User-friendly message
  status: 404,                // HTTP status
  code: "ECONNABORTED",       // Error code
  url: "/api/properties",     // Request URL
  method: "POST",             // HTTP method
  details: {...}              // Full error object
}
```

---

## Complete Form Example

### Create/Edit Property Form

```javascript
import { $id, getFormData, setFormData, showToast } from './utils.js';
import { api, normalizeError } from './api.js';
import { getProperty, createProperty, updateProperty } from './api.js';

// Load existing property (edit mode)
async function loadProperty(id) {
  try {
    const property = await getProperty(id);
    setFormData('#propertyForm', property);
  } catch (error) {
    const { message } = normalizeError(error);
    showToast(message, 'error');
  }
}

// Submit form
async function handleSubmit(e) {
  e.preventDefault();

  const form = $id('propertyForm');
  const data = getFormData(form);

  // Validation
  if (!data.name || !data.location) {
    showToast('Please fill required fields', 'warning');
    return;
  }

  try {
    const id = $id('propertyId')?.value;

    if (id) {
      await updateProperty(id, data);
      showToast('Property updated', 'success');
    } else {
      await createProperty(data);
      showToast('Property created', 'success');
    }

    setTimeout(() => {
      window.location.href = 'properties.html';
    }, 1000);
  } catch (error) {
    const { message } = normalizeError(error);
    showToast(message, 'error');
  }
}
```

---

## Migration Patterns

### Pattern 1: Individual Field Access

**Before:**

```javascript
const name = document.getElementById('name')?.value;
const location = document.getElementById('location')?.value;
const area = parseFloat(document.getElementById('area')?.value);
```

**After:**

```javascript
const name = $id('name')?.value;
const location = $id('location')?.value;
const area = parseFloat($id('area')?.value);
```

**Even Better (if all fields needed):**

```javascript
const { name, location, area } = getFormData('#myForm');
```

---

### Pattern 2: Form Population

**Before:**

```javascript
document.getElementById('name').value = property.name || '';
document.getElementById('location').value = property.location || '';
document.getElementById('area').value = property.area || '';
```

**After:**

```javascript
setFormData('#myForm', property);
```

---

### Pattern 3: Error Handling

**Before:**

```javascript
try {
  const response = await api.get('/properties');
} catch (error) {
  let message = 'Unknown error';
  if (error.response) {
    if (typeof error.response.data === 'string') {
      message = error.response.data;
    } else if (error.response.data.message) {
      message = error.response.data.message;
    } else {
      message = `HTTP ${error.response.status}`;
    }
  } else if (error.message) {
    message = error.message;
  }
  showToast(message, 'error');
}
```

**After:**

```javascript
try {
  const response = await api.get('/properties');
} catch (error) {
  const { message } = normalizeError(error);
  showToast(message, 'error');
}
```

---

## Best Practices

### ✅ DO

- Use `$id()` for all ID-based element access
- Use `getFormData()` when you need all form fields
- Use `setFormData()` for populating forms from objects
- Use `normalizeError()` for consistent error display
- Let axios retry handle transient network errors

### ❌ DON'T

- Don't mix `document.getElementById()` and `$id()` in same file
- Don't manually build form data objects if `getFormData()` works
- Don't manually parse axios errors; use `normalizeError()`
- Don't implement custom retry logic; use built-in interceptor

---

## Existing Helpers (Already Available)

### DOM Queries

```javascript
import { $, $$, on, show, hide, toggle } from './utils.js';

const sidebar = $('#sidebar'); // querySelector
const links = $$('.nav-link'); // querySelectorAll
on('#logout', 'click', handleLogout); // addEventListener
show('#modal'); // show element
hide('#spinner'); // hide element
toggle('#dropdown', isVisible); // toggle visibility
```

### Validation

```javascript
import { isValidEmail, isRequired, isMinLength, isInRange } from './utils.js';

if (!isValidEmail(email)) { ... }
if (!isRequired(name)) { ... }
if (!isMinLength(password, 8)) { ... }
if (!isInRange(age, 18, 100)) { ... }
```

### Formatting

```javascript
import { formatNumber, formatCurrency, formatDate, formatRelativeTime } from './utils.js';

formatNumber(1234.56, 2); // "1,234.56"
formatCurrency(99.99); // "$99.99"
formatDate('2026-01-10'); // "01/10/2026"
formatRelativeTime('2026-01-09'); // "1 day ago"
```

---

## Testing Your Changes

### Quick Test Checklist

1. **Import check:**

```javascript
import { $id, getFormData, setFormData } from './utils.js';
console.log('Helpers loaded:', { $id, getFormData, setFormData });
```

2. **Element access:**

```javascript
const form = $id('myForm');
console.log('Form found:', !!form);
```

3. **Form data extraction:**

```javascript
const data = getFormData('#myForm');
console.log('Form data:', data);
```

4. **Form population:**

```javascript
setFormData('#myForm', { name: 'Test', status: 'active' });
console.log('Fields:', $id('name').value, $id('status').value);
```

5. **Error handling:**

```javascript
try {
  throw new Error('Test error');
} catch (error) {
  const normalized = normalizeError(error);
  console.log('Normalized:', normalized);
}
```

---

## Need Help?

- **Full docs:** See [MODERNIZATION_SUMMARY.md](./MODERNIZATION_SUMMARY.md)
- **Utils source:** Check `js/utils.js` for all available helpers
- **API source:** Check `js/api.js` for axios configuration
- **Examples:** Look at `js/properties-form.js` or `js/plots-form.js`

---

> **Last updated:** January 10, 2026  
> **Version:** 1.0  
> **Status:** Production-ready
