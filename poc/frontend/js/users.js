/**
 * TC Agro Solutions - Users Page Entry Point
 */

import {
  fetchIdentitySwagger,
  getUsers,
  getUserByEmail,
  deleteUser,
  normalizeError
} from './api.js';
import { getTokenInfo } from './auth.js';
import { initProtectedPage } from './common.js';
import { toast, t } from './i18n.js';
import { $, showConfirm, getPageUrl } from './utils.js';

// ============================================
// PAGE INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  if (!initProtectedPage()) {
    return;
  }

  await checkIdentityApi();
  await loadUsers();
  setupEventListeners();
});

// ============================================
// DATA LOADING
// ============================================

async function checkIdentityApi() {
  try {
    await fetchIdentitySwagger();
  } catch (error) {
    const { message } = normalizeError(error);
    toast(message || 'Identity API is not reachable', 'warning');
  }
}

function getFiltersFromUI() {
  return {
    pageNumber: Number($('#pageNumber')?.value || 1),
    pageSize: Number($('#pageSize')?.value || 10),
    sortBy: $('#sortBy')?.value || 'id',
    sortDirection: $('#sortDirection')?.value || 'asc',
    filter: $('#filterInput')?.value?.trim() || ''
  };
}

async function loadUsers(filters = getFiltersFromUI()) {
  const tbody = $('#users-tbody');
  const summary = $('#usersSummary');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="6" class="text-center">Loading...</td></tr>';

  try {
    const data = await getUsers(filters);
    const { items, totalCount } = normalizeUsersResponse(data);

    renderUsersTable(items);

    if (summary) {
      summary.textContent = `Showing ${items.length} of ${totalCount} users`;
    }
  } catch (error) {
    const { message } = normalizeError(error);
    tbody.innerHTML =
      '<tr><td colspan="6" class="text-center text-danger">Error loading users</td></tr>';
    if (summary) summary.textContent = 'Failed to load users';
    toast(message || 'Failed to load users', 'error');
  }
}

async function loadUserByEmail(email) {
  const tbody = $('#users-tbody');
  const summary = $('#usersSummary');
  if (!tbody) return;

  if (!email) {
    toast('Please enter an email to search', 'warning');
    return;
  }

  tbody.innerHTML = '<tr><td colspan="6" class="text-center">Loading...</td></tr>';

  try {
    const user = await getUserByEmail(email);
    const items = Array.isArray(user) ? user : [user];
    renderUsersTable(items);

    if (summary) {
      summary.textContent = `Found ${items.length} user(s)`;
    }
  } catch (error) {
    const { message } = normalizeError(error);
    tbody.innerHTML =
      '<tr><td colspan="6" class="text-center text-danger">User not found</td></tr>';
    if (summary) summary.textContent = 'User not found';
    toast(message || 'User not found', 'error');
  }
}

function normalizeUsersResponse(data) {
  if (Array.isArray(data)) {
    return { items: data, totalCount: data.length };
  }

  const items = data?.items || data?.data || data?.users || data?.results || [];
  const totalCount =
    data?.totalCount || data?.total || data?.count || (Array.isArray(items) ? items.length : 0);

  return { items, totalCount };
}

function renderUsersTable(users) {
  const tbody = $('#users-tbody');
  if (!tbody) return;

  if (!users.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No users found</td></tr>';
    return;
  }

  tbody.innerHTML = users
    .map((user) => {
      const id = user.id || user.userId || '';
      const email = user.email || '';
      const role = user.role || user.roles?.[0] || 'User';
      const status = formatStatus(user);
      const editUrl = getPageUrl(
        `users-form.html${id || email ? `?id=${encodeURIComponent(id)}&email=${encodeURIComponent(email)}` : ''}`
      );

      return `
    <tr data-id="${id}" data-email="${email}">
      <td><strong>${user.name || user.fullName || '-'}</strong></td>
      <td>${email || '-'}</td>
      <td>${user.username || user.userName || '-'}</td>
      <td>${role}</td>
      <td><span class="badge ${status.badge}">${status.label}</span></td>
      <td class="actions">
        <a href="${editUrl}" class="btn btn-sm btn-outline">✏️ Edit</a>
        <button class="btn btn-sm btn-danger" data-action="delete" data-id="${id}" data-email="${email}">🗑️</button>
      </td>
    </tr>
  `;
    })
    .join('');
}

function formatStatus(user) {
  if (user.isActive === false || user.status === 'inactive') {
    return { label: 'Inactive', badge: 'badge-warning' };
  }
  if (user.status === 'blocked' || user.status === 'disabled') {
    return { label: 'Disabled', badge: 'badge-danger' };
  }
  return { label: 'Active', badge: 'badge-success' };
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
  const filterForm = $('#usersFilterForm');
  filterForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await loadUsers();
  });

  const emailBtn = $('#filterEmailBtn');
  emailBtn?.addEventListener('click', async () => {
    const email = $('#filterEmail')?.value?.trim() || '';
    await loadUserByEmail(email);
  });

  const tbody = $('#users-tbody');
  tbody?.addEventListener('click', async (e) => {
    const deleteBtn = e.target.closest('[data-action="delete"]');
    if (deleteBtn) {
      const id = deleteBtn.dataset.id;
      const email = deleteBtn.dataset.email;
      await handleDelete(id, email);
    }
  });
}

async function handleDelete(id, email) {
  const currentUser = getTokenInfo();
  const currentEmail = currentUser?.email?.toLowerCase();

  if (email && currentEmail && email.toLowerCase() === currentEmail) {
    toast('You cannot delete the currently logged in user', 'warning');
    return;
  }

  const confirmed = await showConfirm('Are you sure you want to delete this user?');
  if (!confirmed) return;

  try {
    await deleteUser(id);
    toast('user.deleted_success', 'success');
    await loadUsers();
  } catch (error) {
    const { message } = normalizeError(error);
    toast(message || 'user.load_failed', 'error');
  }
}

// ============================================
// Native Form Validation with i18n Messages
// ============================================

const usersFilterForm = document.getElementById('usersFilterForm');
if (usersFilterForm) {
  usersFilterForm.addEventListener(
    'invalid',
    (e) => {
      const el = e.target;
      if (el.validity.valueMissing) {
        el.setCustomValidity(t('validation.user.required_fields'));
        toast('validation.user.required_fields', 'warning');
      } else if (el.validity.typeMismatch && el.type === 'email') {
        el.setCustomValidity(t('validation.user.email_invalid'));
        toast('validation.user.email_invalid', 'warning');
      } else if (el.validity.typeMismatch && el.type === 'number') {
        el.setCustomValidity('Please enter a valid number');
      }
    },
    true
  );

  // Clear custom messages on input
  usersFilterForm.addEventListener('input', (e) => {
    e.target.setCustomValidity('');
  });
}

// Export for debugging
if (import.meta.env.DEV) {
  window.usersDebug = { loadUsers, loadUserByEmail };
}
