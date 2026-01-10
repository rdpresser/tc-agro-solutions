/**
 * TC Agro Solutions - Login Page Entry Point
 */

import { handleLogin, isAuthenticated, redirectToDashboard } from './auth.js';
import { toast, t } from './i18n.js';
import { $ } from './utils.js';

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
        errorMessage.textContent = t('validation.auth.fill_fields');
        errorMessage.style.display = 'block';
      }
      return;
    }

    // Show loading state
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.classList.add('btn-loading');
      submitBtn.innerHTML = `<span class="spinner"></span> ${t('auth.signing_in')}`;
    }

    if (errorMessage) {
      errorMessage.style.display = 'none';
    }

    try {
      await handleLogin(email, password);
      toast('auth.login_success', 'success');
      redirectToDashboard();
    } catch (error) {
      console.error('Login error:', error);

      if (errorMessage) {
        errorMessage.textContent = error.message || t('auth.invalid_credentials');
        errorMessage.style.display = 'block';
      }

      // Reset button
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.classList.remove('btn-loading');
        submitBtn.innerHTML = '🔐 Sign In';
      }
    }
  });

  // Clear error on input
  [emailInput, passwordInput].forEach((input) => {
    input?.addEventListener('input', () => {
      if (errorMessage) {
        errorMessage.style.display = 'none';
      }
    });
  });

  // Override native validation messages to English and show toast
  loginForm.addEventListener(
    'invalid',
    (e) => {
      const el = e.target;
      if (el.validity.valueMissing) {
        if (el.id === 'password') {
          el.setCustomValidity(t('validation.auth.password_required'));
          toast('validation.auth.password_required', 'warning');
        } else {
          el.setCustomValidity(t('validation.auth.fill_fields'));
          toast('validation.auth.fill_fields', 'warning');
        }
      } else if (el.validity.typeMismatch && el.type === 'email') {
        el.setCustomValidity(t('validation.auth.email_invalid'));
        toast('validation.auth.email_invalid', 'warning');
      }
    },
    true
  );

  // Clear custom validity on input
  loginForm.addEventListener('input', (e) => {
    e.target.setCustomValidity('');
  });
});
