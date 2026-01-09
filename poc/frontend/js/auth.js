/**
 * TC Agro Solutions - Authentication Module
 * Handles login, logout, and session management
 * 
 * SECURITY NOTE:
 * ============================================================================
 * This frontend authentication is for UI FLOW CONTROL only.
 * Real security MUST be enforced on the backend:
 * 
 * - All API endpoints must have [Authorize] attribute
 * - JWT tokens must be validated on EVERY request
 * - Invalid tokens must return 401 Unauthorized
 * - Sensitive data must never be exposed without valid authentication
 * 
 * The frontend simply manages the user experience (showing/hiding pages).
 * Even if someone bypasses frontend checks, the backend blocks data access.
 * ============================================================================
 */

// =============================================================================
// Authentication Functions
// =============================================================================

/**
 * Handle login form submission
 * Currently uses mock authentication - uncomment AJAX code for real backend
 * 
 * @param {Event} event - Form submit event
 */
async function handleLogin(event) {
  event.preventDefault();
  
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const submitBtn = document.getElementById('loginBtn');
  const errorMsg = document.getElementById('errorMsg');
  
  // Clear previous errors
  if (errorMsg) errorMsg.style.display = 'none';
  
  // Show loading state
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner" style="width:20px;height:20px;border-width:2px;"></span> Signing in...';
  }
  
  try {
    // =========================================================================
    // MOCK AUTHENTICATION (for demo purposes)
    // Remove this block and uncomment the AJAX call below when backend is ready
    // =========================================================================
    await mockDelay(800); // Simulate network delay
    
    // For demo: accept any credentials (or empty)
    const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRmFybWVyIiwiZW1haWwiOiJqb2huQGZhcm0uY29tIiwiaWF0IjoxNTE2MjM5MDIyfQ.mock_signature';
    const mockUser = {
      id: '1',
      name: email ? email.split('@')[0] : 'Farm User',
      email: email || 'user@farm.com',
      role: 'producer'
    };
    
    // Store token and user info
    setToken(mockToken);
    setUser(mockUser);
    
    // Redirect to dashboard
    window.location.href = 'dashboard.html';
    return;
    // =========================================================================
    // END MOCK AUTHENTICATION
    // =========================================================================
    
    /* =========================================================================
     * REAL AUTHENTICATION (uncomment when backend is ready)
     * =========================================================================
     * 
     * const response = await fetch('/api/auth/login', {
     *   method: 'POST',
     *   headers: {
     *     'Content-Type': 'application/json',
     *   },
     *   body: JSON.stringify({ email, password }),
     * });
     * 
     * if (!response.ok) {
     *   const error = await response.json();
     *   throw new Error(error.message || 'Invalid credentials');
     * }
     * 
     * const data = await response.json();
     * 
     * // Expected response format:
     * // {
     * //   "access_token": "eyJhbGciOi...",
     * //   "expires_in": 28800,
     * //   "user": {
     * //     "id": "uuid",
     * //     "name": "John Farmer",
     * //     "email": "john@farm.com",
     * //     "role": "producer"
     * //   }
     * // }
     * 
     * // Store token and user info
     * setToken(data.access_token);
     * setUser(data.user);
     * 
     * // Redirect to dashboard
     * window.location.href = 'dashboard.html';
     * 
     * =========================================================================
     */
    
  } catch (error) {
    console.error('Login failed:', error);
    
    // Show error message
    if (errorMsg) {
      errorMsg.textContent = error.message || 'Login failed. Please try again.';
      errorMsg.style.display = 'block';
    }
  } finally {
    // Reset button state
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '🔐 Sign In';
    }
  }
}

/**
 * Handle user logout
 * Clears session and redirects to login
 */
function handleLogout() {
  // Clear all session data
  clearToken();
  
  // Show logout message (optional)
  // showToast('You have been logged out', 'info');
  
  // Redirect to login
  window.location.href = 'index.html';
}

/**
 * Check authentication status and redirect if needed
 * Call this on protected pages
 * 
 * @returns {boolean} True if authenticated
 */
function checkAuth() {
  if (!isAuthenticated()) {
    // Not authenticated - redirect to login
    window.location.href = 'index.html';
    return false;
  }
  return true;
}

/**
 * Refresh authentication token
 * Call this periodically to keep session alive
 */
async function refreshToken() {
  const currentToken = getToken();
  if (!currentToken) return;
  
  /* =========================================================================
   * REAL TOKEN REFRESH (uncomment when backend is ready)
   * =========================================================================
   * 
   * try {
   *   const response = await fetch('/api/auth/refresh', {
   *     method: 'POST',
   *     headers: {
   *       'Authorization': `Bearer ${currentToken}`,
   *       'Content-Type': 'application/json',
   *     },
   *   });
   * 
   *   if (response.ok) {
   *     const data = await response.json();
   *     setToken(data.access_token);
   *     console.log('Token refreshed successfully');
   *   } else if (response.status === 401) {
   *     // Token expired - logout user
   *     handleLogout();
   *   }
   * } catch (error) {
   *   console.error('Token refresh failed:', error);
   * }
   * 
   * =========================================================================
   */
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Mock network delay for demo purposes
 * @param {number} ms - Milliseconds to delay
 */
function mockDelay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Parse JWT token payload (for display purposes only)
 * NOTE: Never trust client-side token parsing for security decisions
 * 
 * @param {string} token - JWT token
 * @returns {object|null} Decoded payload
 */
function parseToken(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Failed to parse token:', error);
    return null;
  }
}

/**
 * Check if token is expired (client-side check only)
 * NOTE: Backend must always validate token expiration
 * 
 * @param {string} token - JWT token
 * @returns {boolean} True if expired
 */
function isTokenExpired(token) {
  const payload = parseToken(token);
  if (!payload || !payload.exp) return true;
  
  const expirationDate = new Date(payload.exp * 1000);
  return expirationDate < new Date();
}

// =============================================================================
// Event Listeners
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
  // Login form handler
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }
  
  // Logout button handler
  const logoutBtns = document.querySelectorAll('[data-action="logout"]');
  logoutBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      handleLogout();
    });
  });
  
  // Setup token refresh interval (every 5 minutes)
  if (isAuthenticated()) {
    setInterval(refreshToken, 5 * 60 * 1000);
  }
});

// =============================================================================
// Export for module usage (if needed)
// =============================================================================
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    handleLogin,
    handleLogout,
    checkAuth,
    refreshToken,
    parseToken,
    isTokenExpired,
  };
}
