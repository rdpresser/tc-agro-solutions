/**
 * Change Password Page - TC Agro Solutions
 */

import { changePassword, normalizeError } from './api.js';
import { toast, t } from './i18n.js';
import { getPageUrl, navigateTo } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
  const signInLink = document.querySelector('a[href="index.html"]');

  if (signInLink) {
    signInLink.setAttribute('href', getPageUrl('index.html'));
  }

  const params = new URLSearchParams(window.location.search);
  const prefilledEmail = params.get('email');
  const emailInput = document.getElementById('email');
  if (prefilledEmail && emailInput) {
    emailInput.value = prefilledEmail;
  }

  setupPasswordToggle();
  setupFormHandler();
  setupNativeValidation();
});

function setupPasswordToggle() {
  const toggleBtn = document.getElementById('togglePassword');
  const passwordInput = document.getElementById('password');

  if (!toggleBtn || !passwordInput) return;

  toggleBtn.addEventListener('click', () => {
    const isHidden = passwordInput.type === 'password';
    passwordInput.type = isHidden ? 'text' : 'password';
    toggleBtn.textContent = isHidden ? '🙈' : '👁️';
  });
}

function setupFormHandler() {
  const form = document.getElementById('changePasswordForm');
  const submitBtn = document.getElementById('changePasswordBtn');

  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFormError();

    const payload = {
      email: document.getElementById('email')?.value?.trim(),
      password: document.getElementById('password')?.value
    };

    if (!payload.email || !payload.password) {
      showFormError('Please fill in all required fields.');
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.classList.add('btn-loading');
      submitBtn.innerHTML = '<span class="spinner"></span> Updating password...';
    }

    try {
      await changePassword(payload);
      toast('Password updated successfully.', 'success');
      navigateTo(`index.html?email=${encodeURIComponent(payload.email)}`);
    } catch (error) {
      const message = extractApiErrorMessage(error);
      showFormError(message);
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.classList.remove('btn-loading');
        submitBtn.innerHTML = '🔄 Change Password';
      }
    }
  });
}

function extractApiErrorMessage(error) {
  const fallbackMessage = 'An error occurred. Please try again.';

  if (error?.response?.data) {
    const data = error.response.data;

    if (Array.isArray(data.errors) && data.errors.length > 0) {
      const reasons = data.errors.map((err) => err.reason || err.message).filter(Boolean);
      if (reasons.length > 0) {
        return reasons.join('\n');
      }
    } else if (data.errors && typeof data.errors === 'object' && !Array.isArray(data.errors)) {
      const details = Object.values(data.errors).flat().filter(Boolean);
      if (details.length > 0) {
        return details.join('\n');
      }
    } else if (data.message) {
      return data.message;
    } else if (data.title || data.detail) {
      return data.detail || data.title;
    }
  }

  const normalized = normalizeError(error);
  return normalized?.message || fallbackMessage;
}

function showFormError(message) {
  const errorBox = document.getElementById('formErrors');
  const errorText = document.getElementById('formErrorsText');
  if (!errorBox || !errorText) return;
  errorText.innerText = message;
  errorText.style.whiteSpace = 'pre-line';
  errorBox.style.display = 'flex';
}

function clearFormError() {
  const errorBox = document.getElementById('formErrors');
  const errorText = document.getElementById('formErrorsText');
  if (!errorBox || !errorText) return;
  errorText.textContent = '';
  errorBox.style.display = 'none';
}

function setupNativeValidation() {
  const form = document.getElementById('changePasswordForm');
  const emailInput = document.getElementById('email');

  if (!form) return;

  form.addEventListener(
    'invalid',
    (event) => {
      const element = event.target;
      const id = element.id;
      let validationMessage = '';

      if (element.validity.valueMissing) {
        validationMessage =
          id === 'email' ? t('validation.user.email_required') : 'Password is required';
      } else if (element.validity.typeMismatch && id === 'email') {
        validationMessage = t('validation.user.email_invalid');
      }

      if (validationMessage) {
        element.setCustomValidity(validationMessage);
        showFormError(validationMessage);
        event.preventDefault();
      }
    },
    true
  );

  form.addEventListener('input', (event) => {
    event.target.setCustomValidity('');
    clearFormError();
  });

  emailInput?.addEventListener('blur', () => {
    if (!emailInput.value) return;
    if (!emailInput.validity.valid) {
      showFormError(t('validation.user.email_invalid'));
    }
  });
}
