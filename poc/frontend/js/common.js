/**
 * TC Agro Solutions - Common Page Script
 * Handles authentication check, sidebar, logout, and user display
 */

import { handleLogout, requireAuth, getTokenInfo } from './auth.js';
import { initSidebar } from './sidebar.js';
import { $, APP_CONFIG, getUser, navigateTo } from './utils.js';

// Check authentication for protected pages
export function initProtectedPage(options = {}) {
  if (!requireAuth()) {
    return false;
  }

  const requireAdmin = options?.requireAdmin === true;
  if (requireAdmin && !isCurrentUserAdmin()) {
    navigateTo('dashboard.html');
    return false;
  }

  // Setup common UI elements
  initSidebar();
  setupLogout();
  setupUserDisplay();
  setupRoleBasedMenuVisibility();
  updateActiveNavItem();
  rewriteNavLinks();

  return true;
}

function isCurrentUserAdmin() {
  const currentUser = getUser();

  if (!currentUser) {
    return false;
  }

  const roleValues = Array.isArray(currentUser.role)
    ? currentUser.role
    : [currentUser.role].filter(Boolean);

  return roleValues.some((role) => String(role).trim().toLowerCase() === 'admin');
}

function setupRoleBasedMenuVisibility() {
  const isAdmin = isCurrentUserAdmin();

  const usersNavItems = document.querySelectorAll('.sidebar .nav-item[href$="users.html"]');
  usersNavItems.forEach((item) => {
    item.style.display = isAdmin ? '' : 'none';
    if (!isAdmin) {
      item.classList.remove('active');
    }
  });
}

// Rewrite navigation links to include base path
// This is needed because Vite only transforms asset URLs, not anchor hrefs
function rewriteNavLinks() {
  const basePath = APP_CONFIG.basePath;

  // Only rewrite if base path is not root
  if (basePath === '/' || basePath === './') {
    return;
  }

  // Normalize base path
  const base = basePath.endsWith('/') ? basePath : basePath + '/';

  // Find all internal links (relative .html links)
  document.querySelectorAll('a[href$=".html"]').forEach((link) => {
    const href = link.getAttribute('href');

    // Skip if already has base path or is external
    if (!href || href.startsWith('http') || href.startsWith(base)) {
      return;
    }

    // Handle query strings
    const cleanHref = href.startsWith('/') ? href.slice(1) : href;
    link.setAttribute('href', base + cleanHref);
  });
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
  const currentPage = (window.location.pathname.split('/').pop() || 'dashboard.html').toLowerCase();

  document.querySelectorAll('.nav-item').forEach((item) => {
    item.classList.remove('active');

    const href = item.getAttribute('href');
    if (!href || href === '#') {
      return;
    }

    const targetPage = href.split('?')[0].split('/').pop()?.toLowerCase();
    if (targetPage && targetPage === currentPage) {
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
