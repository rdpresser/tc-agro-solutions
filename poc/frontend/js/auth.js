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

import { setToken, setUser, clearToken, getToken, isValidEmail, showToast, showLoading, hideLoading } from './utils.js';
import { api } from './api.js';

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
  
  showLoading('Signing in...');
  
  try {
    // ============================================
    // MOCK AUTHENTICATION (for demo)
    // Remove this block when backend is ready
    // ============================================
    await new Promise(resolve => setTimeout(resolve, 800)); // Simulate network delay
    
    const mockResponse = {
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZW1haWwiOiJhZG1pbkBhZ3JvLmNvbSIsIm5hbWUiOiJBZG1pbiBVc2VyIiwiaWF0IjoxNTE2MjM5MDIyfQ.demo-signature',
      user: {
        id: 'user-001',
        email: email,
        name: email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
      }
    };
    
    // Store token and user info
    setToken(mockResponse.token);
    setUser(mockResponse.user);
    
    hideLoading();
    showToast(`Welcome, ${mockResponse.user.name}!`, 'success');
    
    return mockResponse;
    
    // ============================================
    // REAL API CALL (uncomment when backend ready)
    // ============================================
    /*
    const response = await api.post('/auth/login', { email, password });
    
    setToken(response.data.token);
    setUser(response.data.user);
    
    hideLoading();
    showToast(`Welcome, ${response.data.user.name}!`, 'success');
    
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

export function handleLogout() {
  clearToken();
  showToast('You have been logged out', 'info');
  window.location.href = 'index.html';
}

// ============================================
// TOKEN REFRESH
// ============================================

export async function refreshToken() {
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
    window.location.href = 'index.html';
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
  window.location.href = 'dashboard.html';
}

/**
 * Redirect to login if not authenticated
 */
export function redirectToLogin() {
  window.location.href = 'index.html';
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
