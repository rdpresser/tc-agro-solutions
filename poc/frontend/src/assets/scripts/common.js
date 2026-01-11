/**
 * TC Agro Solutions - Common Module
 * Shared utilities for protected pages
 */

import { requireAuth, clearToken, getUser } from './utils.js';
import { initSidebar } from './sidebar.js';
import { t } from './i18n.js';

/**
 * Initialize a protected page
 * - Verify user is authenticated
 * - Initialize sidebar
 * - Setup logout handler
 * - Display user name
 * - Highlight active nav item
 */
export async function initProtectedPage() {
  // Check authentication (redirects to login if not authenticated)
  requireAuth();

  // Initialize sidebar toggle
  initSidebar();

  // Setup user display
  const user = getUser();
  const userDisplay = document.getElementById('userDisplay');
  if (userDisplay && user?.email) {
    userDisplay.textContent = user.email;
  }

  // Setup logout button
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      clearToken();
      window.location.href = '/index.html';
    });
  }

  // Highlight active nav item
  const currentPath = window.location.pathname;
  const navItems = document.querySelectorAll('.nav-item a');
  navItems.forEach((item) => {
    if (item.getAttribute('href').includes(currentPath.split('/').pop())) {
      item.parentElement.classList.add('active');
    } else {
      item.parentElement.classList.remove('active');
    }
  });
}
