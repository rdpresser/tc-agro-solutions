/**
 * TC Agro Solutions - Sidebar Module
 * Simple, standalone sidebar toggle functionality
 */

// Self-executing function to avoid any module/import issues
(function() {
  'use strict';

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSidebar);
  } else {
    initSidebar();
  }

  function initSidebar() {
    const sidebar = document.getElementById('sidebar');
    const menuToggle = document.getElementById('menuToggle');
    const overlay = document.getElementById('sidebarOverlay');

    console.log('[Sidebar Module] Initializing...', {
      sidebar: !!sidebar,
      menuToggle: !!menuToggle,
      overlay: !!overlay
    });

    if (!menuToggle || !sidebar) {
      console.error('[Sidebar Module] Required elements not found!');
      return;
    }

    // Remove any existing listeners by cloning
    const newMenuToggle = menuToggle.cloneNode(true);
    menuToggle.parentNode.replaceChild(newMenuToggle, menuToggle);

    // Add click handler
    newMenuToggle.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      
      console.log('[Sidebar] Toggle clicked');
      
      if (window.innerWidth <= 768) {
        // Mobile: slide in/out
        sidebar.classList.toggle('open');
        if (overlay) overlay.classList.toggle('open');
        console.log('[Sidebar] Mobile - open:', sidebar.classList.contains('open'));
      } else {
        // Desktop: collapse/expand
        const willCollapse = !sidebar.classList.contains('collapsed');
        
        if (willCollapse) {
          sidebar.classList.add('collapsed');
          sidebar.style.width = '60px';
          const main = document.querySelector('.main-content');
          if (main) main.style.marginLeft = '60px';
        } else {
          sidebar.classList.remove('collapsed');
          sidebar.style.width = '';
          const main = document.querySelector('.main-content');
          if (main) main.style.marginLeft = '';
        }
        
        console.log('[Sidebar] Desktop - collapsed:', sidebar.classList.contains('collapsed'));
        console.log('[Sidebar] Style width:', sidebar.style.width);
      }
    });

    // Overlay click (mobile)
    if (overlay) {
      overlay.addEventListener('click', function() {
        sidebar.classList.remove('open');
        overlay.classList.remove('open');
      });
    }

    console.log('[Sidebar Module] Initialized successfully');
  }

  // Export for use in other modules if needed
  window.initSidebar = initSidebar;
})();
