/**
 * TC Agro Solutions - Common Page Script
 * Handles authentication check, sidebar, logout, and user display
 */

import { handleLogout, requireAuth, getTokenInfo } from './auth.js';
import { initSidebar } from './sidebar.js';
import { $ } from './utils.js';

// Check authentication for protected pages
export function initProtectedPage() {
  if (!requireAuth()) {
    return false;
  }

  // Setup common UI elements
  initSidebar();
  setupLogout();
  setupUserDisplay();
  updateActiveNavItem();

  return true;
}

// Setup logout handlers
function setupLogout() {
  const logoutLinks = document.querySelectorAll('[data-action="logout"]');

  logoutLinks.forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      handleLogout();
    });
  });
}

// Highlight current page in navigation
function updateActiveNavItem() {
  const currentPage = window.location.pathname.split('/').pop() || 'dashboard.html';
  document.querySelectorAll('.nav-item').forEach((item) => {
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
