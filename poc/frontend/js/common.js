/**
 * TC Agro Solutions - Common Page Script
 * Handles authentication check, logout, and user display
 * Note: Sidebar is handled by sidebar.js (standalone script)
 */

import { handleLogout, requireAuth, getTokenInfo } from './auth.js';
import { $ } from './utils.js';

// Check authentication for protected pages
export function initProtectedPage() {
  if (!requireAuth()) {
    return false;
  }
  
  // Setup common UI elements (sidebar is handled by sidebar.js)
  setupLogout();
  setupUserDisplay();
  updateActiveNavItem();
  
  return true;
}

// Setup logout handlers
function setupLogout() {
  const logoutLinks = document.querySelectorAll('[data-action="logout"]');
  console.log('[Common] Logout links found:', logoutLinks.length);
  
  logoutLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('[Common] Logout triggered');
      handleLogout();
    });
  });
}

// Highlight current page in navigation
function updateActiveNavItem() {
  const currentPage = window.location.pathname.split('/').pop() || 'dashboard.html';
  document.querySelectorAll('.nav-item').forEach(item => {
    const href = item.getAttribute('href');
    if (href && currentPage.includes(href.replace('.html', ''))) {
      item.classList.add('active');
    }
  });
}

// Display user name in header
function setupUserDisplay() {
  const userDisplay = $('#userDisplay');
  const userInfo = getTokenInfo();
  
  if (userDisplay && userInfo?.name) {
    userDisplay.textContent = userInfo.name;
  }
}
