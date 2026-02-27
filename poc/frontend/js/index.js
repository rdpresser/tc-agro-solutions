/**
 * TC Agro Solutions - Login Page Entry Point
 */

import { handleLogin, isAuthenticated, redirectToDashboard } from './auth.js';
import { toast, t } from './i18n.js';
import { $, getPageUrl } from './utils.js';

// ============================================
// ERROR HANDLING UTILITIES
// ============================================

/**
 * Parse and group validation errors by field name
 * @param {Array} errors - Array of error objects with { name, reason, code }
 * @returns {Object} Grouped errors: { Email: [...], Password: [...] }
 */
function groupErrorsByField(errors) {
  const grouped = {};
  errors.forEach((err) => {
    const fieldName = err.name || 'General';
    if (!grouped[fieldName]) {
      grouped[fieldName] = [];
    }
    grouped[fieldName].push(err.reason || err.message || String(err));
  });
  return grouped;
}

/**
 * Apply validation errors to form fields
 * Shows tooltip on hover with field-specific errors
 */
function applyFieldErrors(groupedErrors) {
  // Clear previous error states
  document.querySelectorAll('.form-control.is-invalid').forEach((el) => {
    el.classList.remove('is-invalid');
    el.removeAttribute('data-error-tooltip');
    el.removeAttribute('title');
  });
  document.querySelectorAll('.field-error-icon').forEach((el) => el.remove());

  // Apply error states for each field
  Object.entries(groupedErrors).forEach(([fieldName, reasons]) => {
    // Map backend field names to form input IDs
    const fieldId = fieldName.toLowerCase();
    const input = $(`#${fieldId}`);

    if (input) {
      // Add error class for styling
      input.classList.add('is-invalid');

      // Create tooltip text with all errors for this field
      const tooltipText = reasons.join('\n• ');
      input.setAttribute('title', `⚠️ ${tooltipText}`);
      input.setAttribute('data-error-tooltip', tooltipText);

      // Add error icon next to field (optional visual indicator)
      const errorIcon = document.createElement('span');
      errorIcon.className = 'field-error-icon';
      errorIcon.textContent = '⚠️';
      errorIcon.style.position = 'absolute';
      errorIcon.style.right = '12px';
      errorIcon.style.top = '50%';
      errorIcon.style.transform = 'translateY(-50%)';
      errorIcon.style.cursor = 'help';
      errorIcon.style.fontSize = '1.2em';
      errorIcon.setAttribute('title', `• ${reasons.join('\n• ')}`);

      const formGroup = input.closest('.form-group');
      if (formGroup) {
        formGroup.style.position = 'relative';
        formGroup.appendChild(errorIcon);
      }
    }
  });
}

// If already authenticated, redirect to dashboard
if (isAuthenticated()) {
  redirectToDashboard();
}

// Setup login form
document.addEventListener('DOMContentLoaded', () => {
  const signupLink = document.querySelector('a[href="signup.html"]');
  const changePasswordLink = document.querySelector('a[href="change-password.html"]');
  const loginForm = $('#login-form');
  const emailInput = $('#email');
  const passwordInput = $('#password');
  const submitBtn = loginForm?.querySelector('button[type="submit"]');
  const errorMessage = $('.error-message');

  const getErrorTextElement = () => {
    if (!errorMessage) return null;
    return errorMessage.querySelector('span:last-child') || errorMessage;
  };

  const showTopError = (message) => {
    if (!errorMessage) return;
    const errorText = getErrorTextElement();
    if (errorText) {
      errorText.innerText = message;
      errorText.style.whiteSpace = 'pre-line';
    }
    errorMessage.style.display = 'block';
  };

  const clearTopError = () => {
    if (!errorMessage) return;
    errorMessage.style.display = 'none';
  };

  if (signupLink) {
    signupLink.setAttribute('href', getPageUrl('signup.html'));
  }

  if (changePasswordLink) {
    changePasswordLink.setAttribute('href', getPageUrl('change-password.html'));
  }

  const params = new URLSearchParams(window.location.search);
  const prefilledEmail = params.get('email');
  if (prefilledEmail && emailInput) {
    emailInput.value = prefilledEmail;
    passwordInput?.focus();
  }

  if (!loginForm) return;

  const isValidEmailFormat = () => {
    if (!emailInput) return false;
    const value = emailInput.value?.trim() || '';
    if (!value) return false;
    return emailInput.validity.valid;
  };

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = emailInput?.value?.trim();
    const password = passwordInput?.value;

    // Basic validation
    if (!email || !password) {
      showTopError(t('validation.auth.fill_fields'));
      return;
    }

    if (!isValidEmailFormat()) {
      showTopError(t('validation.auth.email_invalid'));
      return;
    }

    // Show loading state
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.classList.add('btn-loading');
      submitBtn.innerHTML = `<span class="spinner"></span> ${t('auth.signing_in')}`;
    }

    clearTopError();

    try {
      await handleLogin(email, password);
      toast('auth.login_success', 'success');
      redirectToDashboard();
    } catch (error) {
      console.error('Login error:', error);

      // Clear previous field errors
      document.querySelectorAll('.form-control.is-invalid').forEach((el) => {
        el.classList.remove('is-invalid');
      });
      document.querySelectorAll('.field-error-icon').forEach((el) => el.remove());

      // Extract meaningful error message from backend response
      let displayMessage = t('auth.invalid_credentials');

      if (error.response?.data) {
        const data = error.response.data;

        // 1. FastEndpoints/ASP.NET Validation Errors (array of { name, reason, code })
        if (Array.isArray(data.errors) && data.errors.length > 0) {
          const firstError = data.errors[0];

          // Check if this is the new grouped format { name, reason, code }
          if (firstError.name && firstError.reason) {
            // Group and apply field-level errors
            const groupedErrors = groupErrorsByField(data.errors);
            applyFieldErrors(groupedErrors);

            // Show summary in alert box
            const fieldSummary = Object.entries(groupedErrors)
              .map(([field, reasons]) => `${field}: ${reasons.join(', ')}`)
              .join('\n');
            displayMessage = fieldSummary;
          } else {
            // Fallback: old format (array of strings)
            const cleanMessages = data.errors.map((err) => {
              if (typeof err === 'string') return err;
              if (err && typeof err === 'object') {
                return (
                  err.message || err.errorMessage || err.detail || err.title || JSON.stringify(err)
                );
              }
              return String(err);
            });

            if (cleanMessages.length > 0) {
              displayMessage = cleanMessages.join('\n');
            }
          }
        }
        // 2. Old format: errors object as { field: ["msg"] }
        else if (data.errors && typeof data.errors === 'object' && !Array.isArray(data.errors)) {
          const details = Object.values(data.errors).flat();
          if (details.length > 0) {
            displayMessage = details.join('\n');
          }
        }
        // 3. Standard error message ({ message: "..." })
        else if (data.message) {
          displayMessage = data.message;
        }
        // 4. ProblemDetails ({ title: "...", detail: "..." })
        else if (data.title || data.detail) {
          displayMessage = data.detail || data.title;
        }
      }
      // 5. Fallback to generic status text if available
      else if (error.message && error.message !== 'Network Error') {
        if (!error.message.includes('status code')) {
          displayMessage = error.message;
        }
      }

      showTopError(displayMessage);

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
      clearTopError();
    });
  });
});
