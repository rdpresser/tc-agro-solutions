/**
 * TC Agro Solutions - Common Page Script
 * Handles authentication check, sidebar, logout, and user display
 */

import { getPendingAlertsSummary } from './api.js';
import { handleLogout, requireAuth, getTokenInfo } from './auth.js';
import { initSidebar } from './sidebar.js';
import { $, APP_CONFIG, getUser, navigateTo } from './utils.js';

const ALERTS_BELL_REFRESH_INTERVAL_MS = 60000;
let alertsBellRefreshIntervalId = null;

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
  setupUserMenuDropdown();
  setupTopbarAlertsBell();
  setupRoleBasedMenuVisibility();
  updateActiveNavItem();
  rewriteNavLinks();

  return true;
}

function getCurrentUserRoles() {
  const currentUser = getUser();

  if (!currentUser) {
    return [];
  }

  const roleCandidates = [
    ...(Array.isArray(currentUser.role) ? currentUser.role : [currentUser.role]),
    ...(Array.isArray(currentUser.roles) ? currentUser.roles : [currentUser.roles])
  ];

  return roleCandidates
    .filter(Boolean)
    .map((role) => String(role).trim().toLowerCase())
    .filter((role) => role.length > 0);
}

function isCurrentUserAdmin() {
  return getCurrentUserRoles().includes('admin');
}

function isCurrentUserProducer() {
  return getCurrentUserRoles().includes('producer');
}

function getCurrentUserOwnerId() {
  const tokenInfo = getTokenInfo() || {};
  const currentUser = getUser() || {};

  const ownerIdCandidates = [
    currentUser.ownerId,
    currentUser.sub,
    tokenInfo.sub,
    currentUser.id,
    currentUser.userId,
    currentUser.nameIdentifier
  ];

  const ownerId = ownerIdCandidates.find((candidate) => String(candidate || '').trim().length > 0);
  return ownerId ? String(ownerId).trim() : null;
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

function stopTopbarAlertsBellRefresh() {
  if (alertsBellRefreshIntervalId) {
    clearInterval(alertsBellRefreshIntervalId);
    alertsBellRefreshIntervalId = null;
  }
}

function setupTopbarAlertsBell() {
  stopTopbarAlertsBellRefresh();

  const topbarRight = document.querySelector('.topbar-right');
  const userMenu = topbarRight?.querySelector('.user-menu');
  if (!topbarRight || !userMenu) {
    return;
  }

  const existingBell = topbarRight.querySelector('[data-role="topbar-alert-bell"]');
  if (existingBell) {
    existingBell.remove();
  }

  if (!isCurrentUserProducer()) {
    return;
  }

  const alertsLink = document.createElement('a');
  alertsLink.href = 'alerts.html';
  alertsLink.className = 'topbar-alert-link';
  alertsLink.setAttribute('data-role', 'topbar-alert-bell');
  alertsLink.setAttribute('aria-label', 'View pending alerts');
  alertsLink.style.display = 'none';
  alertsLink.innerHTML = `
    <span class="topbar-alert-icon" aria-hidden="true">🔔</span>
    <span class="badge badge-danger topbar-alert-count" aria-live="polite">0</span>
  `;

  topbarRight.insertBefore(alertsLink, userMenu);

  const countElement = alertsLink.querySelector('.topbar-alert-count');
  if (!countElement) {
    return;
  }

  const applyCount = (count) => {
    const safeCount = Number.isFinite(Number(count)) ? Math.max(0, Number(count)) : 0;
    if (safeCount > 0) {
      countElement.textContent = safeCount > 99 ? '99+' : String(safeCount);
      alertsLink.style.display = 'inline-flex';
      return;
    }

    alertsLink.style.display = 'none';
  };

  const refreshCount = async () => {
    try {
      const ownerId = getCurrentUserOwnerId();
      if (!ownerId) {
        applyCount(0);
        return;
      }

      const summary = await getPendingAlertsSummary({ ownerId, windowHours: 24 });
      applyCount(summary?.pendingAlertsTotal || 0);
    } catch (error) {
      console.warn('[TopbarAlertsBell] Failed to refresh pending alerts count.', error);
      applyCount(0);
    }
  };

  void refreshCount();
  alertsBellRefreshIntervalId = setInterval(refreshCount, ALERTS_BELL_REFRESH_INTERVAL_MS);
}

function setupUserMenuDropdown() {
  const userMenu = document.querySelector('.user-menu');
  if (!userMenu) {
    return;
  }

  const topbarRight = userMenu.closest('.topbar-right');
  if (!topbarRight) {
    return;
  }

  topbarRight.classList.add('user-menu-host');

  const existingDropdown = topbarRight.querySelector('.user-menu-dropdown');
  if (existingDropdown) {
    existingDropdown.remove();
  }

  const tokenInfo = getTokenInfo() || {};
  const currentUser = getUser() || {};
  const userEmail = tokenInfo.email || currentUser.email || 'No email available';

  const dropdown = document.createElement('div');
  dropdown.className = 'user-menu-dropdown';
  dropdown.setAttribute('aria-hidden', 'true');
  dropdown.innerHTML = `
    <div class="user-menu-dropdown-header">
      <div class="user-menu-dropdown-title">Account</div>
      <div class="user-menu-dropdown-email">${userEmail}</div>
    </div>
    <div class="user-menu-dropdown-actions">
      <a href="#" class="user-menu-dropdown-link" data-action="change-password">🔐 Change password</a>
      <a href="#" class="user-menu-dropdown-link" data-action="dropdown-logout">🚪 Logout</a>
    </div>
  `;

  topbarRight.appendChild(dropdown);

  const closeDropdown = () => {
    userMenu.classList.remove('open');
    dropdown.classList.remove('open');
    userMenu.setAttribute('aria-expanded', 'false');
    dropdown.setAttribute('aria-hidden', 'true');
  };

  const openDropdown = () => {
    userMenu.classList.add('open');
    dropdown.classList.add('open');
    userMenu.setAttribute('aria-expanded', 'true');
    dropdown.setAttribute('aria-hidden', 'false');
  };

  userMenu.setAttribute('role', 'button');
  userMenu.setAttribute('tabindex', '0');
  userMenu.setAttribute('aria-haspopup', 'menu');
  userMenu.setAttribute('aria-expanded', 'false');

  userMenu.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (dropdown.classList.contains('open')) {
      closeDropdown();
      return;
    }

    openDropdown();
  });

  userMenu.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      userMenu.click();
    }
  });

  dropdown.addEventListener('click', (event) => {
    event.stopPropagation();

    const changePasswordLink = event.target.closest('[data-action="change-password"]');
    if (changePasswordLink) {
      event.preventDefault();
      closeDropdown();
      const encodedEmail = encodeURIComponent(String(userEmail || '').trim());
      const changePasswordPage = encodedEmail
        ? `change-password.html?email=${encodedEmail}`
        : 'change-password.html';
      navigateTo(changePasswordPage);
      return;
    }

    const logoutLink = event.target.closest('[data-action="dropdown-logout"]');
    if (logoutLink) {
      event.preventDefault();
      closeDropdown();
      handleLogout();
    }
  });

  document.addEventListener('click', () => {
    closeDropdown();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeDropdown();
    }
  });
}
