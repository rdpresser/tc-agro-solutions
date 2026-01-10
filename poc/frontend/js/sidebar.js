/**
 * TC Agro Solutions - Sidebar Module
 * ES Module for sidebar toggle functionality
 */

import { $id, $, toggleClass } from './utils.js';

/**
 * Initialize sidebar toggle behavior
 * Handles both mobile slide-in/out and desktop collapse/expand
 */
export function initSidebar() {
  const sidebar = $id('sidebar');
  const menuToggle = $id('menuToggle');
  const overlay = $id('sidebarOverlay');

  if (!menuToggle || !sidebar) {
    return;
  }

  // Remove any existing listeners by cloning
  const newMenuToggle = menuToggle.cloneNode(true);
  menuToggle.parentNode.replaceChild(newMenuToggle, menuToggle);

  // Add click handler
  newMenuToggle.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (window.innerWidth <= 768) {
      // Mobile: slide in/out
      toggleClass(sidebar, 'open');
      if (overlay) toggleClass(overlay, 'open');
    } else {
      // Desktop: collapse/expand
      const willCollapse = !sidebar.classList.contains('collapsed');

      if (willCollapse) {
        sidebar.classList.add('collapsed');
        sidebar.style.width = '60px';
        const main = $('.main-content');
        if (main) main.style.marginLeft = '60px';
      } else {
        sidebar.classList.remove('collapsed');
        sidebar.style.width = '';
        const main = $('.main-content');
        if (main) main.style.marginLeft = '';
      }
    }
  });

  // Overlay click (mobile)
  if (overlay) {
    overlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('open');
    });
  }
}
