/**
 * TC Agro Solutions - Utility Functions
 * Common helpers used across the frontend POC
 */

// =============================================================================
// Constants
// =============================================================================
const APP_CONFIG = {
  appName: 'TC Agro Solutions',
  version: '1.0.0',
  apiBaseUrl: '/api',  // Change to actual API URL when backend is ready
  tokenKey: 'agro_token',
  userKey: 'agro_user',
  dateFormat: 'en-US',
};

// =============================================================================
// Session Storage Helpers
// =============================================================================

/**
 * Store authentication token
 * @param {string} token - JWT token from backend
 */
function setToken(token) {
  sessionStorage.setItem(APP_CONFIG.tokenKey, token);
}

/**
 * Retrieve authentication token
 * @returns {string|null} JWT token or null if not found
 */
function getToken() {
  return sessionStorage.getItem(APP_CONFIG.tokenKey);
}

/**
 * Remove authentication token (logout)
 */
function clearToken() {
  sessionStorage.removeItem(APP_CONFIG.tokenKey);
  sessionStorage.removeItem(APP_CONFIG.userKey);
}

/**
 * Store user info
 * @param {object} user - User object from backend
 */
function setUser(user) {
  sessionStorage.setItem(APP_CONFIG.userKey, JSON.stringify(user));
}

/**
 * Retrieve user info
 * @returns {object|null} User object or null if not found
 */
function getUser() {
  const user = sessionStorage.getItem(APP_CONFIG.userKey);
  return user ? JSON.parse(user) : null;
}

/**
 * Check if user is authenticated
 * @returns {boolean} True if token exists
 */
function isAuthenticated() {
  return !!getToken();
}

// =============================================================================
// Page Protection
// =============================================================================

/**
 * Protect page - redirect to login if not authenticated
 * Call this at the top of protected pages
 */
function requireAuth() {
  if (!isAuthenticated()) {
    window.location.href = 'index.html';
    return false;
  }
  return true;
}

/**
 * Redirect to dashboard if already authenticated
 * Call this on login page
 */
function redirectIfAuthenticated() {
  if (isAuthenticated()) {
    window.location.href = 'dashboard.html';
    return true;
  }
  return false;
}

// =============================================================================
// DOM Helpers
// =============================================================================

/**
 * Shorthand for document.getElementById
 * @param {string} id - Element ID
 * @returns {HTMLElement|null}
 */
function $(id) {
  return document.getElementById(id);
}

/**
 * Shorthand for document.querySelectorAll
 * @param {string} selector - CSS selector
 * @returns {NodeList}
 */
function $$(selector) {
  return document.querySelectorAll(selector);
}

/**
 * Add event listener with null check
 * @param {string} id - Element ID
 * @param {string} event - Event name
 * @param {function} handler - Event handler
 */
function on(id, event, handler) {
  const element = $(id);
  if (element) {
    element.addEventListener(event, handler);
  }
}

/**
 * Show element
 * @param {string|HTMLElement} element - Element ID or element
 */
function show(element) {
  const el = typeof element === 'string' ? $(element) : element;
  if (el) el.style.display = '';
}

/**
 * Hide element
 * @param {string|HTMLElement} element - Element ID or element
 */
function hide(element) {
  const el = typeof element === 'string' ? $(element) : element;
  if (el) el.style.display = 'none';
}

/**
 * Toggle element visibility
 * @param {string|HTMLElement} element - Element ID or element
 */
function toggle(element) {
  const el = typeof element === 'string' ? $(element) : element;
  if (el) {
    el.style.display = el.style.display === 'none' ? '' : 'none';
  }
}

// =============================================================================
// Formatting Helpers
// =============================================================================

/**
 * Format number with locale
 * @param {number} value - Number to format
 * @param {number} decimals - Decimal places
 * @returns {string} Formatted number
 */
function formatNumber(value, decimals = 0) {
  return new Intl.NumberFormat(APP_CONFIG.dateFormat, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Format currency
 * @param {number} value - Amount
 * @param {string} currency - Currency code (default: BRL)
 * @returns {string} Formatted currency
 */
function formatCurrency(value, currency = 'BRL') {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: currency,
  }).format(value);
}

/**
 * Format date
 * @param {string|Date} date - Date to format
 * @param {object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date
 */
function formatDate(date, options = {}) {
  const defaultOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  };
  return new Intl.DateTimeFormat(APP_CONFIG.dateFormat, { ...defaultOptions, ...options })
    .format(new Date(date));
}

/**
 * Format date with time
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted date with time
 */
function formatDateTime(date) {
  return formatDate(date, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format area in hectares
 * @param {number} hectares - Area value
 * @returns {string} Formatted area
 */
function formatArea(hectares) {
  return `${formatNumber(hectares, 2)} ha`;
}

/**
 * Format temperature
 * @param {number} celsius - Temperature in Celsius
 * @returns {string} Formatted temperature
 */
function formatTemperature(celsius) {
  return `${formatNumber(celsius, 1)}°C`;
}

/**
 * Format percentage
 * @param {number} value - Percentage value (0-100)
 * @returns {string} Formatted percentage
 */
function formatPercentage(value) {
  return `${formatNumber(value, 1)}%`;
}

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid
 */
function isValidEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

/**
 * Validate required field
 * @param {string} value - Value to check
 * @returns {boolean} True if not empty
 */
function isRequired(value) {
  return value !== null && value !== undefined && value.toString().trim() !== '';
}

/**
 * Validate minimum length
 * @param {string} value - Value to check
 * @param {number} min - Minimum length
 * @returns {boolean} True if valid
 */
function minLength(value, min) {
  return value && value.length >= min;
}

/**
 * Validate number range
 * @param {number} value - Value to check
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {boolean} True if in range
 */
function inRange(value, min, max) {
  const num = parseFloat(value);
  return !isNaN(num) && num >= min && num <= max;
}

// =============================================================================
// UI Feedback
// =============================================================================

/**
 * Show loading spinner in element
 * @param {string} elementId - Target element ID
 */
function showLoading(elementId) {
  const el = $(elementId);
  if (el) {
    el.innerHTML = '<div class="spinner"></div>';
  }
}

/**
 * Show toast notification
 * @param {string} message - Message to display
 * @param {string} type - Type: success, warning, danger, info
 * @param {number} duration - Duration in ms (default: 3000)
 */
function showToast(message, type = 'info', duration = 3000) {
  // Create toast element
  const toast = document.createElement('div');
  toast.className = `alert alert-${type} fade-in`;
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 9999;
    max-width: 400px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  `;
  
  const icons = {
    success: '✅',
    warning: '⚠️',
    danger: '❌',
    info: 'ℹ️',
  };
  
  toast.innerHTML = `
    <span class="alert-icon">${icons[type] || icons.info}</span>
    <span>${message}</span>
  `;
  
  document.body.appendChild(toast);
  
  // Auto-remove
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/**
 * Show confirmation dialog
 * @param {string} message - Confirmation message
 * @returns {boolean} True if confirmed
 */
function confirm(message) {
  return window.confirm(message);
}

// =============================================================================
// Table Helpers
// =============================================================================

/**
 * Render table body from data array
 * @param {string} tableId - Table body element ID
 * @param {array} data - Array of objects
 * @param {function} rowRenderer - Function to render each row
 */
function renderTable(tableId, data, rowRenderer) {
  const tbody = $(tableId);
  if (!tbody) return;
  
  if (!data || data.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="100" class="text-center text-muted" style="padding: 40px;">
          <div class="empty-state">
            <div class="empty-state-icon">📭</div>
            <div class="empty-state-title">No data found</div>
            <p>Start by adding a new record.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }
  
  tbody.innerHTML = data.map((item, index) => rowRenderer(item, index)).join('');
}

// =============================================================================
// URL Helpers
// =============================================================================

/**
 * Get URL query parameter
 * @param {string} name - Parameter name
 * @returns {string|null} Parameter value
 */
function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

/**
 * Build URL with query parameters
 * @param {string} base - Base URL
 * @param {object} params - Query parameters
 * @returns {string} Full URL
 */
function buildUrl(base, params = {}) {
  const url = new URL(base, window.location.origin);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      url.searchParams.set(key, value);
    }
  });
  return url.toString();
}

// =============================================================================
// Sidebar Functions
// =============================================================================

/**
 * Initialize sidebar toggle functionality
 */
function initSidebar() {
  const menuToggle = $('menuToggle');
  const sidebar = $('sidebar');
  const overlay = $('sidebarOverlay');
  
  if (menuToggle && sidebar) {
    menuToggle.addEventListener('click', () => {
      // Mobile: toggle open class
      if (window.innerWidth <= 768) {
        sidebar.classList.toggle('open');
      } else {
        // Desktop: toggle collapsed class
        sidebar.classList.toggle('collapsed');
      }
    });
  }
  
  // Close sidebar on overlay click (mobile)
  if (overlay) {
    overlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
    });
  }
  
  // Update active nav item
  const currentPage = window.location.pathname.split('/').pop() || 'dashboard.html';
  $$('.nav-item').forEach(item => {
    const href = item.getAttribute('href') || item.getAttribute('data-page');
    if (href && href.includes(currentPage.replace('.html', ''))) {
      item.classList.add('active');
    }
  });
}

// =============================================================================
// Initialize on DOM Ready
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
  // Initialize sidebar if present
  if ($('sidebar')) {
    initSidebar();
  }
  
  // Update user display if present
  const userDisplay = $('userDisplay');
  const user = getUser();
  if (userDisplay && user) {
    userDisplay.textContent = user.name || user.email || 'User';
  }
});

// =============================================================================
// Export for module usage (if needed)
// =============================================================================
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    APP_CONFIG,
    setToken, getToken, clearToken,
    setUser, getUser,
    isAuthenticated, requireAuth, redirectIfAuthenticated,
    $, $$, on, show, hide, toggle,
    formatNumber, formatCurrency, formatDate, formatDateTime,
    formatArea, formatTemperature, formatPercentage,
    isValidEmail, isRequired, minLength, inRange,
    showLoading, showToast, confirm,
    renderTable, getQueryParam, buildUrl,
    initSidebar,
  };
}
