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

export const APP_CONFIG = {
  apiBaseUrl: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  tokenKey: 'agro_token',
  userKey: 'agro_user',
  signalREnabled: import.meta.env.VITE_SIGNALR_ENABLED === 'true'
};

// ============================================
// SESSION STORAGE HELPERS
// ============================================

export function setToken(token) {
  sessionStorage.setItem(APP_CONFIG.tokenKey, token);
}

export function getToken() {
  return sessionStorage.getItem(APP_CONFIG.tokenKey);
}

export function clearToken() {
  sessionStorage.removeItem(APP_CONFIG.tokenKey);
  sessionStorage.removeItem(APP_CONFIG.userKey);
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
    window.location.href = 'index.html';
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
    window.location.href = 'dashboard.html';
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

// ============================================
// FORMATTING HELPERS (using dayjs)
// ============================================

export function formatNumber(num, decimals = 0) {
  if (num == null) return '--';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(num);
}

export function formatCurrency(num) {
  if (num == null) return '--';
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
  if (hectares == null) return '--';
  return `${formatNumber(hectares, 1)} ha`;
}

export function formatTemperature(celsius) {
  if (celsius == null) return '--';
  return `${formatNumber(celsius, 1)}°C`;
}

export function formatPercentage(value) {
  if (value == null) return '--';
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

export async function confirm(message, title = 'Confirm') {
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
  document.querySelectorAll('[data-action="logout"]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      if (window.confirm('Are you sure you want to logout?')) {
        clearToken();
        window.location.href = 'index.html';
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
      setTimeout(() => inThrottle = false, limit);
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
