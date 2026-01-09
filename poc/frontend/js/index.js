/**
 * TC Agro Solutions - Login Page Entry Point
 */

import { handleLogin, isAuthenticated, redirectToDashboard } from './auth.js';
import { showToast, $ } from './utils.js';

// If already authenticated, redirect to dashboard
if (isAuthenticated()) {
  redirectToDashboard();
}

// Setup login form
document.addEventListener('DOMContentLoaded', () => {
  const loginForm = $('#login-form');
  const emailInput = $('#email');
  const passwordInput = $('#password');
  const submitBtn = loginForm?.querySelector('button[type="submit"]');
  const errorMessage = $('.error-message');
  
  if (!loginForm) return;
  
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = emailInput?.value?.trim();
    const password = passwordInput?.value;
    
    // Basic validation
    if (!email || !password) {
      if (errorMessage) {
        errorMessage.textContent = 'Please fill in all fields.';
        errorMessage.style.display = 'block';
      }
      return;
    }
    
    // Show loading state
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Entrando...';
    }
    
    if (errorMessage) {
      errorMessage.style.display = 'none';
    }
    
    try {
      await handleLogin(email, password);
      showToast('Login successful!', 'success');
      redirectToDashboard();
    } catch (error) {
      console.error('Login error:', error);
      
      if (errorMessage) {
        errorMessage.textContent = error.message || 'Invalid email or password.';
        errorMessage.style.display = 'block';
      }
      
      // Reset button
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Entrar';
      }
    }
  });
  
  // Clear error on input
  [emailInput, passwordInput].forEach(input => {
    input?.addEventListener('input', () => {
      if (errorMessage) {
        errorMessage.style.display = 'none';
      }
    });
  });
});
