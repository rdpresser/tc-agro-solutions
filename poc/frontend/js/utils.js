/**
 * TC Agro Solutions - Utilities Module
 * Common helpers for DOM manipulation, formatting, validation, and UI feedback
 */

import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/en';

// Configure dayjs
dayjs.extend(relativeTime);
dayjs.locale('en');

// ============================================
// APP CONFIGURATION
// ============================================

/**
 * Detect API base URL based on context:
 * 1. Manual override: VITE_API_BASE_URL env var (for debugging)
 * 2. Cluster context: BASE_URL === '/agro/' → API at '/identity'
 * 3. Dev mode: localhost:3000 → API at 'http://localhost:5001'
 * 4. Docker Compose: default to 'http://localhost:5001' (browser access)
 */
function detectApiBaseUrl() {
  // Manual override for debugging (e.g., frontend local + identity in cluster)
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }

  const base = import.meta.env.BASE_URL || '/';
  const currentHost = window.location.host;

  // Cluster context: Vite base is '/agro/' → identity is at '/identity'
  if (base === '/agro/') {
    return '/identity';
  }

  // Dev mode: running on localhost:3000 → identity on localhost:5001
  if (currentHost.includes('localhost:3000') || currentHost.includes('127.0.0.1:3000')) {
    return 'http://localhost:5001';
  }

  // Docker Compose or other: default to localhost:5001 (external port)
  return 'http://localhost:5001';
}

/**
 * Detect Identity API base URL based on context:
 * 1. Manual override: VITE_IDENTITY_API_BASE_URL env var
 * 2. Cluster context: BASE_URL === '/agro/' → Identity at '/identity'
 * 3. Dev mode: localhost:3000 → Identity at 'http://localhost:5001'
 * 4. Docker Compose or other: default to 'http://localhost:5001'
 */
function detectIdentityApiBaseUrl() {
  if (import.meta.env.VITE_IDENTITY_API_BASE_URL) {
    return import.meta.env.VITE_IDENTITY_API_BASE_URL;
  }

  const base = import.meta.env.BASE_URL || '/';
  const currentHost = window.location.host;

  if (base === '/agro/') {
    return '/identity';
  }

  if (currentHost.includes('localhost:3000') || currentHost.includes('127.0.0.1:3000')) {
    return 'http://localhost:5001';
  }

  return 'http://localhost:5001';
}

export const APP_CONFIG = {
  apiBaseUrl: detectApiBaseUrl(),
  identityApiBaseUrl: detectIdentityApiBaseUrl(),
  tokenKey: 'agro_token',
  userKey: 'agro_user',
  signalREnabled: import.meta.env.VITE_SIGNALR_ENABLED === 'true',
  // Base path for navigation (Vite injects this at build time)
  basePath: import.meta.env.BASE_URL || '/'
};

/**
 * Navigate to a page respecting the base path configuration
 * @param {string} page - Page filename (e.g., 'dashboard.html')
 */
export function navigateTo(page) {
  // Remove leading slash if present
  const cleanPage = page.startsWith('/') ? page.slice(1) : page;
  // Ensure basePath ends with /
  const base = APP_CONFIG.basePath.endsWith('/') ? APP_CONFIG.basePath : APP_CONFIG.basePath + '/';
  window.location.href = base + cleanPage;
}

/**
 * Get full URL for a page respecting the base path
 * @param {string} page - Page filename (e.g., 'dashboard.html')
 * @returns {string} Full URL path
 */
export function getPageUrl(page) {
  const cleanPage = page.startsWith('/') ? page.slice(1) : page;
  const base = APP_CONFIG.basePath.endsWith('/') ? APP_CONFIG.basePath : APP_CONFIG.basePath + '/';
  return base + cleanPage;
}

// ============================================
// JWT DECODING HELPERS
// ============================================

/**
 * Decode JWT token and extract claims
 * @param {string} token - JWT token
 * @returns {Object|null} Decoded payload or null if invalid
 */
export function decodeJWT(token) {
  try {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = JSON.parse(atob(parts[1]));
    return payload;
  } catch (error) {
    console.error('Failed to decode JWT:', error);
    return null;
  }
}

/**
 * Extract user info from JWT token
 * @param {string} token - JWT token
 * @returns {Object|null} User info with name, email, role, unique_name or null
 */
export function extractUserFromToken(token) {
  const payload = decodeJWT(token);
  if (!payload) return null;

  return {
    name: payload.name || payload.unique_name || payload.email || 'User',
    email: payload.email,
    unique_name: payload.unique_name,
    role: payload.role || 'User',
    sub: payload.sub
  };
}

// ============================================
// SESSION STORAGE HELPERS
// ============================================

export function setToken(token) {
  sessionStorage.setItem(APP_CONFIG.tokenKey, token);
}

export function getToken() {
  return sessionStorage.getItem(APP_CONFIG.tokenKey);
}

/**
 * Clear authentication session
 * Removes JWT token and user data from sessionStorage
 *
 * This ensures complete logout by:
 * - Removing JWT token (agro_token)
 * - Removing user info (agro_user)
 *
 * To clear additional session data, add:
 * sessionStorage.removeItem('your_custom_key');
 *
 * Or to clear everything:
 * sessionStorage.clear();
 */
export function clearToken() {
  sessionStorage.removeItem(APP_CONFIG.tokenKey);
  sessionStorage.removeItem(APP_CONFIG.userKey);

  // Optional: Clear all session storage
  // sessionStorage.clear();

  // Optional: Clear specific app data
  // sessionStorage.removeItem('dashboard_cache');
  // sessionStorage.removeItem('user_preferences');
}

export function setUser(user) {
  sessionStorage.setItem(APP_CONFIG.userKey, JSON.stringify(user));
}

export function getUser() {
  const user = sessionStorage.getItem(APP_CONFIG.userKey);
  return user ? JSON.parse(user) : null;
}

export function isAuthenticated() {
  return !!getToken();
}

// ============================================
// PAGE PROTECTION
// ============================================

export function requireAuth() {
  if (!isAuthenticated()) {
    navigateTo('index.html');
    return false;
  }

  // Update user display if element exists
  const userDisplay = document.getElementById('userDisplay');
  if (userDisplay) {
    const user = getUser();
    userDisplay.textContent = user?.name || user?.email || 'User';
  }

  // Initialize sidebar
  initSidebar();

  return true;
}

export function redirectIfAuthenticated() {
  if (isAuthenticated()) {
    navigateTo('dashboard.html');
    return true;
  }
  return false;
}

// ============================================
// DOM HELPERS
// ============================================

export function $(selector) {
  return document.querySelector(selector);
}

export function $$(selector) {
  return document.querySelectorAll(selector);
}

export function on(element, event, handler) {
  if (typeof element === 'string') {
    element = $(element);
  }
  if (element) {
    element.addEventListener(event, handler);
  }
}

export function show(element) {
  if (typeof element === 'string') element = $(element);
  if (element) element.style.display = '';
}

export function hide(element) {
  if (typeof element === 'string') element = $(element);
  if (element) element.style.display = 'none';
}

export function toggle(element, visible) {
  if (typeof element === 'string') element = $(element);
  if (element) element.style.display = visible ? '' : 'none';
}

/**
 * Get element by ID (short syntax)
 * @param {string} id - Element ID (without #)
 * @returns {HTMLElement|null}
 */
export function $id(id) {
  return document.getElementById(id);
}

/**
 * Execute callback when DOM is ready
 * @param {Function} callback - Function to execute
 */
export function onReady(callback) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback);
  } else {
    callback();
  }
}

/**
 * Toggle CSS class on element
 * @param {HTMLElement|string} element - Element or selector
 * @param {string} className - Class name to toggle
 * @param {boolean} [force] - Force add (true) or remove (false)
 */
export function toggleClass(element, className, force) {
  if (typeof element === 'string') element = $(element);
  if (element) {
    if (force !== undefined) {
      element.classList.toggle(className, force);
    } else {
      element.classList.toggle(className);
    }
  }
}

/**
 * Get all form field values as an object
 * Handles input[type=text], textarea, select, input[type=checkbox], input[type=radio]
 * @param {HTMLFormElement|string} form - Form element or selector
 * @returns {Object} Form values keyed by field name
 */
export function getFormData(form) {
  if (typeof form === 'string') form = $(form);
  if (!form) return {};

  const formData = new FormData(form);
  const data = {};

  for (const [key, value] of formData.entries()) {
    // Handle multiple values (checkboxes with same name)
    if (data[key]) {
      if (Array.isArray(data[key])) {
        data[key].push(value);
      } else {
        data[key] = [data[key], value];
      }
    } else {
      data[key] = value;
    }
  }

  return data;
}

/**
 * Set form field values from an object
 * @param {HTMLFormElement|string} form - Form element or selector
 * @param {Object} data - Data object keyed by field name
 */
export function setFormData(form, data) {
  if (typeof form === 'string') form = $(form);
  if (!form || !data) return;

  Object.entries(data).forEach(([key, value]) => {
    const field = form.elements[key];
    if (!field) return;

    // Handle different field types
    if (field.type === 'checkbox') {
      field.checked = !!value;
    } else if (field.type === 'radio') {
      const radio = form.querySelector(`input[name="${key}"][value="${value}"]`);
      if (radio) radio.checked = true;
    } else if (field.tagName === 'SELECT') {
      field.value = value;
    } else {
      field.value = value ?? '';
    }
  });
}

// ============================================
// FORMATTING HELPERS (using dayjs)
// ============================================

export function formatNumber(num, decimals = 0) {
  if (num === null || num === undefined) return '--';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(num);
}

export function formatCurrency(num) {
  if (num === null || num === undefined) return '--';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(num);
}

export function formatDate(date, format = 'DD/MM/YYYY') {
  if (!date) return '--';
  return dayjs(date).format(format);
}

export function formatDateTime(date) {
  if (!date) return '--';
  return dayjs(date).format('DD/MM/YYYY HH:mm');
}

export function formatRelativeTime(date) {
  if (!date) return '--';
  return dayjs(date).fromNow();
}

export function formatArea(hectares) {
  if (hectares === null || hectares === undefined) return '--';
  return `${formatNumber(hectares, 1)} ha`;
}

export function formatTemperature(celsius) {
  if (celsius === null || celsius === undefined) return '--';
  return `${formatNumber(celsius, 1)}°C`;
}

export function formatPercentage(value) {
  if (value === null || value === undefined) return '--';
  return `${formatNumber(value, 0)}%`;
}

// ============================================
// VALIDATION HELPERS
// ============================================

export function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

export function isRequired(value) {
  return value !== null && value !== undefined && value.toString().trim() !== '';
}

export function isMinLength(value, min) {
  return value && value.length >= min;
}

export function isInRange(value, min, max) {
  const num = parseFloat(value);
  return !isNaN(num) && num >= min && num <= max;
}

// ============================================
// UI FEEDBACK
// ============================================

let loadingOverlay = null;

export function showLoading(message = 'Loading...') {
  if (!loadingOverlay) {
    loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'loading-overlay';
    loadingOverlay.innerHTML = `
      <div class="loading-spinner"></div>
      <div class="loading-message">${message}</div>
    `;
    document.body.appendChild(loadingOverlay);
  }
  loadingOverlay.querySelector('.loading-message').textContent = message;
  loadingOverlay.style.display = 'flex';
}

export function hideLoading() {
  if (loadingOverlay) {
    loadingOverlay.style.display = 'none';
  }
}

// Toast notification system
let toastContainer = null;

export function showToast(message, type = 'info', duration = 3000) {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }

  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span class="toast-message">${message}</span>
  `;

  toastContainer.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add('toast-show');
  });

  // Auto remove
  setTimeout(() => {
    toast.classList.remove('toast-show');
    toast.classList.add('toast-hide');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

export function confirm(message, title = 'Confirm') {
  return window.confirm(`${title}\n\n${message}`);
}

// ============================================
// TABLE HELPERS
// ============================================

export function renderTable(containerId, columns, data, rowRenderer) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!data || data.length === 0) {
    container.innerHTML = `
      <tr>
        <td colspan="${columns.length}" class="text-center text-muted" style="padding: 40px;">
          No data available
        </td>
      </tr>
    `;
    return;
  }

  container.innerHTML = data.map(rowRenderer).join('');
}

// ============================================
// URL HELPERS
// ============================================

export function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

export function buildUrl(base, params) {
  const url = new URL(base, window.location.origin);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      url.searchParams.set(key, value);
    }
  });
  return url.toString();
}

// ============================================
// SIDEBAR INITIALIZATION
// ============================================

export function initSidebar() {
  const menuToggle = document.getElementById('menuToggle');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');

  if (menuToggle && sidebar) {
    menuToggle.addEventListener('click', () => {
      sidebar.classList.toggle('sidebar-open');
      overlay?.classList.toggle('active');
    });
  }

  if (overlay) {
    overlay.addEventListener('click', () => {
      sidebar?.classList.remove('sidebar-open');
      overlay.classList.remove('active');
    });
  }

  // Logout handler
  document.querySelectorAll('[data-action="logout"]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      if (window.confirm('Are you sure you want to logout?')) {
        clearToken();
        navigateTo('index.html');
      }
    });
  });
}

// ============================================
// DEBOUNCE / THROTTLE
// ============================================

export function debounce(fn, delay = 300) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

export function throttle(fn, limit = 100) {
  let inThrottle;
  return (...args) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// ============================================
// CONFIRM DIALOG
// ============================================

export function showConfirm(message) {
  return new Promise((resolve) => {
    const confirmed = window.confirm(message);
    resolve(confirmed);
  });
}
