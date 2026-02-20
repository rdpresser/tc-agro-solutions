/**
 * Users Form Page - TC Agro Solutions
 * Entry point script for user create/edit
 */

import {
  fetchIdentitySwagger,
  registerUser,
  getUserByEmail,
  updateUser,
  normalizeError
} from './api.js';
import { initProtectedPage } from './common.js';
import { toast, t } from './i18n.js';
import { $id, navigateTo, showLoading, hideLoading } from './utils.js';

// ============================================
// Page State
// ============================================

const hashQuery = window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '';
const queryParams = new URLSearchParams(window.location.search || hashQuery);
const editId = queryParams.get('id');
const editEmail = queryParams.get('email');
const isEditMode = queryParams.has('id') || queryParams.has('email');

// ============================================
// Page Initialization
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  if (!initProtectedPage()) return;

  await checkIdentityApi();

  if (isEditMode) {
    await setupEditMode();
  }

  setupPasswordToggle();
  setupFormHandler();
});

// ============================================
// Identity API Check
// ============================================

async function checkIdentityApi() {
  try {
    await fetchIdentitySwagger();
  } catch (error) {
    const { message } = normalizeError(error);
    toast(message || 'Identity API is not reachable', 'warning');
  }
}

// ============================================
// Edit Mode Setup
// ============================================

async function setupEditMode() {
  const pageTitle = $id('pageTitle');
  const formTitle = $id('formTitle');
  const breadcrumbCurrent = $id('breadcrumbCurrent');

  if (pageTitle) pageTitle.textContent = 'Edit User';
  if (formTitle) formTitle.textContent = 'Edit User';
  if (breadcrumbCurrent) breadcrumbCurrent.textContent = 'Edit';

  applyEditModeUI();

  if (!editEmail) {
    showFormError('Unable to load user. Email parameter is required.');
    return;
  }

  try {
    const user = await getUserByEmail(editEmail);
    populateForm(user);
  } catch (error) {
    const { message } = normalizeError(error);
    showFormError(message || 'User not found');
  }
}

function applyEditModeUI() {
  const passwordSection = $id('passwordSection');
  const passwordInput = $id('password');
  const toggleBtn = $id('togglePassword');
  const roleSelect = $id('role');
  const passwordHelper = document.querySelector('#passwordSection .form-helper');

  if (passwordSection) {
    passwordSection.style.display = 'none';
    passwordSection.hidden = true;
  }
  if (passwordInput) {
    passwordInput.required = false;
    passwordInput.value = '';
    passwordInput.setCustomValidity('');
  }
  if (toggleBtn) toggleBtn.disabled = true;
  if (roleSelect) {
    roleSelect.disabled = true;
    roleSelect.required = false;
  }
  if (passwordHelper) passwordHelper.style.display = 'none';
}

// ============================================
// Populate Form
// ============================================

function populateForm(user) {
  const fields = {
    userId: user.id || user.userId || '',
    name: user.name || user.fullName || '',
    email: user.email || '',
    username: user.username || user.userName || '',
    role: user.role || user.roles?.[0] || 'User'
  };

  Object.entries(fields).forEach(([id, value]) => {
    const element = $id(id);
    if (element) element.value = value;
  });
}

// ============================================
// Password Toggle
// ============================================

function setupPasswordToggle() {
  const toggleBtn = $id('togglePassword');
  const passwordInput = $id('password');

  if (!toggleBtn || !passwordInput) return;

  toggleBtn.addEventListener('click', () => {
    const isHidden = passwordInput.type === 'password';
    passwordInput.type = isHidden ? 'text' : 'password';
    toggleBtn.textContent = isHidden ? '🙈' : '👁️';
  });
}

// ============================================
// Form Handler
// ============================================

function setupFormHandler() {
  const form = $id('userForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    clearFormErrors();

    const payload = {
      name: $id('name')?.value?.trim(),
      email: $id('email')?.value?.trim(),
      username: $id('username')?.value?.trim()
    };

    if (!payload.name || !payload.email || !payload.username) {
      showFormError('All fields are required.');
      return;
    }

    if (!isEditMode) {
      payload.password = $id('password')?.value;
      payload.role = $id('role')?.value;
      if (!payload.password) {
        showFormError('All fields are required.');
        return;
      }
      if (!payload.role) {
        showFormError('All fields are required.');
        return;
      }
    }

    showLoading('Saving user...');

    try {
      if (isEditMode) {
        const userId = $id('userId')?.value || editId;
        if (!userId) {
          throw new Error('User ID is required for update.');
        }
        await updateUser(userId, payload);
        toast('User updated successfully', 'success');
      } else {
        await registerUser(payload);
        toast('User created successfully', 'success');
      }

      navigateTo('users.html');
    } catch (error) {
      const message = extractApiErrorMessage(error);
      showFormError(message);
    } finally {
      hideLoading();
    }
  });
}

// ============================================
// Error Handling
// ============================================

function extractApiErrorMessage(error) {
  const errorMessage = 'An error occurred. Please try again.';

  if (error?.response?.data) {
    const data = error.response.data;

    if (Array.isArray(data.errors) && data.errors.length > 0) {
      const reasons = data.errors.map((err) => err.reason || err.message).filter(Boolean);
      if (reasons.length > 0) {
        return reasons.join('\n');
      }
    } else if (data.message) {
      return data.message;
    } else if (data.title || data.detail) {
      return data.detail || data.title;
    }
  }

  const normalized = normalizeError(error);
  return normalized?.message || errorMessage;
}

function showFormError(message) {
  const errorDiv = $id('formErrors');
  if (!errorDiv) return;
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
}

function clearFormErrors() {
  const errorDiv = $id('formErrors');
  if (!errorDiv) return;
  errorDiv.textContent = '';
  errorDiv.style.display = 'none';
}

// ============================================
// Native Form Validation with i18n Messages
// ============================================

const userForm = document.getElementById('userForm');
if (userForm) {
  userForm.addEventListener(
    'invalid',
    (e) => {
      const el = e.target;
      const id = el.id;
      if (el.validity.valueMissing) {
        if (id === 'name') {
          el.setCustomValidity(t('validation.user.name_required'));
          toast('validation.user.name_required', 'warning');
        } else if (id === 'email') {
          el.setCustomValidity(t('validation.user.email_required'));
          toast('validation.user.email_required', 'warning');
        } else if (id === 'username') {
          el.setCustomValidity(t('validation.user.username_required'));
          toast('validation.user.username_required', 'warning');
        } else if (id === 'password') {
          el.setCustomValidity(t('validation.user.password_required'));
          toast('validation.user.password_required', 'warning');
        } else if (id === 'role') {
          el.setCustomValidity(t('validation.user.role_required'));
          toast('validation.user.role_required', 'warning');
        } else {
          el.setCustomValidity(t('validation.user.required_fields'));
          toast('validation.user.required_fields', 'warning');
        }
      } else if (el.validity.typeMismatch && el.type === 'email') {
        el.setCustomValidity(t('validation.user.email_invalid'));
        toast('validation.user.email_invalid', 'warning');
      }
    },
    true
  );

  // Clear custom messages on input
  userForm.addEventListener('input', (e) => {
    e.target.setCustomValidity('');
  });
}
