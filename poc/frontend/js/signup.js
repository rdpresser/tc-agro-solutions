/**
 * Sign Up Page - TC Agro Solutions
 */

import { registerUser, checkEmailAvailability, normalizeError } from './api.js';
import { toast, t } from './i18n.js';
import { navigateTo } from './utils.js';

const DEFAULT_ROLE = 'Producer';
const EMAIL_CHECK_DEBOUNCE_MS = 450;

let emailCheckTimer = null;
let latestEmailCheckRequestId = 0;
let lastCheckedEmail = null;
let lastCheckedIsAvailable = null;

document.addEventListener('DOMContentLoaded', () => {
  setupPasswordToggle();
  setupEmailAvailabilityCheck();
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
  const form = document.getElementById('signupForm');
  const submitBtn = document.getElementById('signupBtn');
  const emailInput = document.getElementById('email');

  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFormError();

    const payload = {
      name: document.getElementById('name')?.value?.trim(),
      email: document.getElementById('email')?.value?.trim(),
      username: document.getElementById('username')?.value?.trim(),
      password: document.getElementById('password')?.value,
      role: DEFAULT_ROLE
    };

    if (!payload.name || !payload.email || !payload.username || !payload.password) {
      showFormError('Please fill in all required fields.');
      return;
    }

    const isEmailAvailable = await ensureEmailAvailableBeforeSubmit(payload.email, emailInput);
    if (!isEmailAvailable) {
      showFormError('This email is already registered. Please use another email.');
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.classList.add('btn-loading');
      submitBtn.innerHTML = '<span class="spinner"></span> Creating account...';
    }

    try {
      await registerUser(payload);
      toast('user.created_success', 'success');
      navigateTo(`index.html?email=${encodeURIComponent(payload.email)}`);
    } catch (error) {
      const message = extractApiErrorMessage(error);
      showFormError(message);
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.classList.remove('btn-loading');
        submitBtn.innerHTML = '✨ Create Account';
      }
    }
  });
}

function setupEmailAvailabilityCheck() {
  const emailInput = document.getElementById('email');
  if (!emailInput) return;

  emailInput.addEventListener('input', () => {
    const email = emailInput.value.trim();

    lastCheckedEmail = null;
    lastCheckedIsAvailable = null;

    if (emailCheckTimer) {
      clearTimeout(emailCheckTimer);
    }

    if (!email) {
      clearEmailAvailabilityState(emailInput);
      return;
    }

    if (!emailInput.checkValidity()) {
      setEmailAvailabilityState('unavailable', 'Enter a valid email address', emailInput, false);
      return;
    }

    setEmailAvailabilityState('checking', 'Checking availability...', emailInput, null);

    emailCheckTimer = setTimeout(async () => {
      await checkEmailAvailabilityRealtime(email, emailInput);
    }, EMAIL_CHECK_DEBOUNCE_MS);
  });
}

async function ensureEmailAvailableBeforeSubmit(email, emailInput) {
  const normalizedEmail = (email || '').trim();

  if (!normalizedEmail || !emailInput || !emailInput.checkValidity()) {
    return false;
  }

  if (lastCheckedEmail === normalizedEmail && lastCheckedIsAvailable === true) {
    return true;
  }

  return await checkEmailAvailabilityRealtime(normalizedEmail, emailInput);
}

async function checkEmailAvailabilityRealtime(email, emailInput) {
  const requestId = ++latestEmailCheckRequestId;

  try {
    const response = await checkEmailAvailability(email);

    if (requestId !== latestEmailCheckRequestId) {
      return lastCheckedIsAvailable === true;
    }

    const isAvailable = response?.isAvailable === true;

    lastCheckedEmail = email;
    lastCheckedIsAvailable = isAvailable;

    if (isAvailable) {
      setEmailAvailabilityState('available', 'Email available', emailInput, true);
      return true;
    }

    setEmailAvailabilityState('unavailable', 'Email already registered', emailInput, false);
    return false;
  } catch {
    if (requestId !== latestEmailCheckRequestId) {
      return false;
    }

    lastCheckedEmail = null;
    lastCheckedIsAvailable = null;
    setEmailAvailabilityState('unavailable', 'Unable to validate email now', emailInput, null);
    return false;
  }
}

function setEmailAvailabilityState(status, message, emailInput, markInvalid) {
  const icon = document.getElementById('emailAvailabilityIcon');
  const text = document.getElementById('emailAvailabilityText');

  if (!icon || !text || !emailInput) return;

  icon.classList.remove('available', 'unavailable', 'show');
  text.textContent = message || '';

  if (status === 'available') {
    icon.classList.add('show', 'available');
  } else if (status === 'unavailable') {
    icon.classList.add('show', 'unavailable');
  }

  if (markInvalid === true) {
    emailInput.classList.remove('is-invalid');
  } else if (markInvalid === false) {
    emailInput.classList.add('is-invalid');
  } else {
    emailInput.classList.remove('is-invalid');
  }
}

function clearEmailAvailabilityState(emailInput) {
  const icon = document.getElementById('emailAvailabilityIcon');
  const text = document.getElementById('emailAvailabilityText');

  if (icon) {
    icon.classList.remove('available', 'unavailable', 'show');
  }

  if (text) {
    text.textContent = '';
  }

  if (emailInput) {
    emailInput.classList.remove('is-invalid');
  }
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
  const signupForm = document.getElementById('signupForm');
  if (!signupForm) return;

  signupForm.addEventListener(
    'invalid',
    (e) => {
      const element = e.target;
      const id = element.id;

      if (element.validity.valueMissing) {
        if (id === 'name') {
          element.setCustomValidity(t('validation.user.name_required'));
          toast('validation.user.name_required', 'warning');
        } else if (id === 'email') {
          element.setCustomValidity(t('validation.user.email_required'));
          toast('validation.user.email_required', 'warning');
        } else if (id === 'username') {
          element.setCustomValidity(t('validation.user.username_required'));
          toast('validation.user.username_required', 'warning');
        } else if (id === 'password') {
          element.setCustomValidity(t('validation.user.password_required'));
          toast('validation.user.password_required', 'warning');
        } else {
          element.setCustomValidity(t('validation.user.required_fields'));
          toast('validation.user.required_fields', 'warning');
        }
      } else if (element.validity.typeMismatch && element.type === 'email') {
        element.setCustomValidity(t('validation.user.email_invalid'));
        toast('validation.user.email_invalid', 'warning');
      }
    },
    true
  );

  signupForm.addEventListener('input', (e) => {
    e.target.setCustomValidity('');
    clearFormError();
  });
}
