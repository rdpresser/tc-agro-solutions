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
  setupUserMenuDropdown();
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
      window.alert('Change password screen is not available yet.');
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
