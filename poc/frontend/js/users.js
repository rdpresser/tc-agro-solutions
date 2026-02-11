/**
 * TC Agro Solutions - Users Page Entry Point
 */

import { fetchIdentitySwagger, getUsers, deleteUser, normalizeError } from './api.js';
import { getTokenInfo } from './auth.js';
import { initProtectedPage } from './common.js';
import { toast } from './i18n.js';
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

function updatePageOptions(pageCount, currentPage) {
  const pageSelect = $('#pageNumber');
  if (!pageSelect) return;

  const pages = Math.max(1, pageCount || 1);
  pageSelect.innerHTML = Array.from({ length: pages }, (_, index) => {
    const page = index + 1;
    return `<option value="${page}">${page}</option>`;
  }).join('');

  const safePage = Math.min(Math.max(1, currentPage || 1), pages);
  pageSelect.value = String(safePage);
}

async function loadUsers(filters = getFiltersFromUI()) {
  const tbody = $('#users-tbody');
  const summary = $('#usersSummary');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="6" class="text-center">Loading...</td></tr>';

  try {
    const data = await getUsers(filters);
    const normalized = normalizeUsersResponse(data, filters);

    renderUsersTable(normalized.items);
    updatePageOptions(normalized.pageCount, normalized.pageNumber);

    if (summary) {
      summary.textContent = `Showing ${normalized.items.length} of ${normalized.totalCount} users · Page ${normalized.pageNumber} of ${normalized.pageCount}`;
    }
  } catch (error) {
    const { message } = normalizeError(error);
    tbody.innerHTML =
      '<tr><td colspan="6" class="text-center text-danger">Error loading users</td></tr>';
    if (summary) summary.textContent = 'Failed to load users';
    toast(message || 'Failed to load users', 'error');
  }
}

function normalizeUsersResponse(data, filters) {
  if (Array.isArray(data)) {
    const totalCount = data.length;
    const pageSize = filters?.pageSize || totalCount || 1;
    return {
      items: data,
      totalCount,
      pageNumber: filters?.pageNumber || 1,
      pageSize,
      pageCount: Math.max(1, Math.ceil(totalCount / pageSize))
    };
  }

  const items = data?.items || data?.data || data?.users || data?.results || [];
  const totalCount = data?.totalCount ?? data?.total ?? data?.count ?? items.length;
  const pageNumber = data?.pageNumber || filters?.pageNumber || 1;
  const pageSize = data?.pageSize || filters?.pageSize || 10;
  const pageCount = Math.max(1, Math.ceil((totalCount || 0) / pageSize));

  return { items, totalCount, pageNumber, pageSize, pageCount };
}

function renderUsersTable(users) {
  const tbody = $('#users-tbody');
  if (!tbody) return;

  if (!users.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No users found</td></tr>';
    return;
  }

  // Get current logged-in user email
  const currentUser = getTokenInfo();
  const currentEmail = currentUser?.email?.toLowerCase();

  tbody.innerHTML = users
    .map((user) => {
      const id = user.id || user.userId || '';
      const email = user.email || '';
      const role = user.role || user.roles?.[0] || 'User';
      const status = formatStatus(user);
      const editUrl = getPageUrl(
        `users-form.html${id || email ? `?id=${encodeURIComponent(id)}&email=${encodeURIComponent(email)}` : ''}`
      );

      // Check if this is the currently logged-in user
      const isCurrentUser = email && currentEmail && email.toLowerCase() === currentEmail;

      // Disable delete button for current user with tooltip
      const deleteButton = isCurrentUser
        ? `<button class="btn btn-sm btn-danger" disabled title="You cannot delete yourself" style="cursor: not-allowed; opacity: 0.5;">🗑️</button>`
        : `<button class="btn btn-sm btn-danger" data-action="delete" data-id="${id}" data-email="${email}">🗑️</button>`;

      return `
    <tr data-id="${id}" data-email="${email}" ${isCurrentUser ? 'style="background-color: rgba(45, 80, 22, 0.05);"' : ''}>
      <td><strong>${user.name || user.fullName || '-'}${isCurrentUser ? ' <span style="color: #2d5016; font-weight: bold;">(You)</span>' : ''}</strong></td>
      <td>${email || '-'}</td>
      <td>${user.username || user.userName || '-'}</td>
      <td>${role}</td>
      <td><span class="badge ${status.badge}">${status.label}</span></td>
      <td class="actions">
        <a href="${editUrl}" class="btn btn-sm btn-outline">✏️ Edit</a>
        ${deleteButton}
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

  const pageNumber = $('#pageNumber');
  pageNumber?.addEventListener('change', async () => {
    await loadUsers();
  });

  const pageSize = $('#pageSize');
  pageSize?.addEventListener('change', async () => {
    await loadUsers();
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
  if (!id) {
    toast('Unable to delete user: missing id', 'error');
    return;
  }

  const currentUser = getTokenInfo();
  const currentEmail = currentUser?.email?.toLowerCase();

  // Double-check protection (should not happen with disabled button)
  if (email && currentEmail && email.toLowerCase() === currentEmail) {
    window.alert(
      '⚠️ You cannot delete your own user account.\n\nPlease ask another administrator to delete your account if needed.'
    );
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

// Export for debugging
if (import.meta.env.DEV) {
  window.usersDebug = { loadUsers };
}
