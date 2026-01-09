/**
 * TC Agro Solutions - Common Page Script
 * Handles sidebar, mobile menu, logout, and common UI interactions
 */

import { handleLogout, requireAuth, getTokenInfo } from './auth.js';
import { $ } from './utils.js';

// Check authentication for protected pages
export function initProtectedPage() {
  if (!requireAuth()) {
    return false;
  }
  
  // Setup common UI elements
  setupSidebar();
  setupUserDisplay();
  
  return true;
}

// Setup sidebar interactions
function setupSidebar() {
  const sidebar = $('#sidebar');
  const overlay = $('#sidebarOverlay');
  const menuToggle = $('#menuToggle');
  
  // Mobile menu toggle
  menuToggle?.addEventListener('click', () => {
    sidebar?.classList.toggle('active');
    overlay?.classList.toggle('active');
  });
  
  // Close sidebar when clicking overlay
  overlay?.addEventListener('click', () => {
    sidebar?.classList.remove('active');
    overlay?.classList.remove('active');
  });
  
  // Setup logout link
  const logoutLinks = document.querySelectorAll('[data-action="logout"]');
  logoutLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      handleLogout();
    });
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

export { setupSidebar, setupUserDisplay };
