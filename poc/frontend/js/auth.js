/**
 * TC Agro Solutions - Authentication Module
 * Handles login, logout, and token management
 *
 * ⚠️ SECURITY WARNING:
 * This frontend authentication is for UX flow control ONLY.
 * The backend MUST validate JWT tokens on every request.
 * A malicious user can bypass frontend checks.
 * NEVER trust frontend-only security.
 */

import { toast, t } from './i18n.js';
import {
  setToken,
  setUser,
  clearToken,
  getToken,
  isValidEmail,
  showLoading,
  hideLoading,
  navigateTo
} from './utils.js';

// ============================================
// LOGIN HANDLER
// ============================================

export async function handleLogin(email, password) {
  // Client-side validation
  if (!email || !isValidEmail(email)) {
    throw new Error('Please enter a valid email address');
  }

  if (!password || password.length < 1) {
    throw new Error('Please enter your password');
  }

  showLoading(t('auth.signing_in'));

  try {
    // ============================================
    // MOCK AUTHENTICATION (for demo)
    // Remove this block when backend is ready
    // ============================================
    await new Promise((resolve) => setTimeout(resolve, 800)); // Simulate network delay

    const mockResponse = {
      token:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZW1haWwiOiJhZG1pbkBhZ3JvLmNvbSIsIm5hbWUiOiJBZG1pbiBVc2VyIiwiaWF0IjoxNTE2MjM5MDIyfQ.demo-signature',
      user: {
        id: 'user-001',
        email: email,
        name: email
          .split('@')[0]
          .replace(/[._]/g, ' ')
          .replace(/\b\w/g, (l) => l.toUpperCase())
      }
    };

    // Store token and user info
    setToken(mockResponse.token);
    setUser(mockResponse.user);

    hideLoading();
    toast('auth.welcome', 'success', { name: mockResponse.user.name });

    return mockResponse;

    // ============================================
    // REAL API CALL (uncomment when backend ready)
    // ============================================
    /*
    const response = await api.post('/auth/login', { email, password });
    
    setToken(response.data.token);
    setUser(response.data.user);
    
    hideLoading();
    toast('auth.welcome', 'success', { name: response.data.user.name });
    
    return response.data;
    */
  } catch (error) {
    hideLoading();

    // Handle specific error types
    if (error.response?.status === 401) {
      throw new Error('Invalid email or password');
    }
    if (error.response?.status === 429) {
      throw new Error('Too many attempts. Please wait a moment.');
    }

    throw error;
  }
}

// ============================================
// LOGOUT HANDLER
// ============================================

/**
 * Handles user logout:
 * - Clears session storage (token + user data)
 * - Shows logout notification
 * - Redirects to login page
 */
export function handleLogout() {
  // Clear all session data
  clearToken();

  // Optional: Clear any other app-specific session data
  // sessionStorage.removeItem('app_preferences');
  // sessionStorage.removeItem('cached_data');

  // Show feedback
  toast('auth.logged_out', 'info');

  // Redirect to login
  setTimeout(() => {
    navigateTo('index.html');
  }, 500);
}

// ============================================
// TOKEN REFRESH
// ============================================

export function refreshToken() {
  const currentToken = getToken();

  if (!currentToken) {
    throw new Error('No token to refresh');
  }

  // ============================================
  // MOCK REFRESH (for demo)
  // ============================================
  return currentToken;

  // ============================================
  // REAL API CALL (uncomment when backend ready)
  // ============================================
  /*
  try {
    const response = await api.post('/auth/refresh', { token: currentToken });
    setToken(response.data.token);
    return response.data.token;
  } catch (error) {
    clearToken();
    navigateTo('index.html');
    throw error;
  }
  */
}

// ============================================
// CHECK AUTH STATUS
// ============================================

export function checkAuth() {
  const token = getToken();

  if (!token) {
    return false;
  }

  // Optional: Check token expiration
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = payload.exp;

    if (exp && Date.now() >= exp * 1000) {
      clearToken();
      return false;
    }
  } catch {
    // Invalid token format, but let backend validate
  }

  return true;
}

// ============================================
// GET CURRENT USER INFO FROM TOKEN
// ============================================

export function getTokenInfo() {
  const token = getToken();

  if (!token) return null;

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return {
      email: payload.email,
      name: payload.name,
      sub: payload.sub,
      exp: payload.exp ? new Date(payload.exp * 1000) : null
    };
  } catch {
    return null;
  }
}

// ============================================
// AUTH HELPERS FOR PROTECTED PAGES
// ============================================

/**
 * Check if user is authenticated
 */
export function isAuthenticated() {
  return checkAuth();
}

/**
 * Redirect to dashboard if authenticated
 */
export function redirectToDashboard() {
  navigateTo('dashboard.html');
}

/**
 * Redirect to login if not authenticated
 */
export function redirectToLogin() {
  navigateTo('index.html');
}

/**
 * Require auth - redirect to login if not authenticated
 */
export function requireAuth() {
  if (!checkAuth()) {
    redirectToLogin();
    return false;
  }
  return true;
}
