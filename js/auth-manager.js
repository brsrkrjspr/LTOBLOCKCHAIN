// TrustChain LTO - Auth Manager
// Manages access tokens in memory (not localStorage) and handles token refresh

class AuthManager {
    constructor() {
        this.accessToken = null;
        this.refreshPromise = null;
        this.refreshTimer = null;
    }

    /**
     * Initialize - check for existing session and refresh token if needed
     */
    async init() {
        try {
            // Check if user has a refresh token cookie (indicates logged in)
            const hasRefreshToken = this.getCookie('refreshToken');
            
            if (hasRefreshToken) {
                // User is logged in, refresh token immediately
                await this.refreshAccessToken();
            }
        } catch (error) {
            console.error('AuthManager init error:', error);
            // Don't throw - allow page to load even if refresh fails
        }
    }

    /**
     * Set access token in memory
     */
    setAccessToken(token) {
        this.accessToken = token;
        this.scheduleTokenRefresh();
    }

    /**
     * Get access token from memory
     */
    getAccessToken() {
        return this.accessToken;
    }

    /**
     * Get CSRF token from cookie
     */
    getCsrfToken() {
        return this.getCookie('XSRF-TOKEN');
    }

    /**
     * Get cookie value
     */
    getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
    }

    /**
     * Decode JWT token
     */
    decodeToken(token) {
        try {
            const parts = token.split('.');
            if (parts.length !== 3) return null;
            return JSON.parse(atob(parts[1]));
        } catch (error) {
            return null;
        }
    }

    /**
     * Schedule token refresh based on expiry
     */
    scheduleTokenRefresh() {
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
            this.refreshTimer = null;
        }

        if (!this.accessToken) return;

        const decoded = this.decodeToken(this.accessToken);
        if (!decoded || !decoded.exp) return;

        const expiryTime = decoded.exp * 1000; // Convert to milliseconds
        const now = Date.now();
        const timeUntilExpiry = expiryTime - now;
        const tokenLifetime = expiryTime - (decoded.iat * 1000);

        // Refresh at 80% of lifetime OR 1 min before expiry (whichever is longer)
        const refreshAt80Percent = tokenLifetime * 0.8;
        const refreshAt1MinBefore = Math.max(timeUntilExpiry - 60000, 0);
        const refreshDelay = Math.max(refreshAt80Percent, refreshAt1MinBefore);

        if (refreshDelay > 0) {
            this.refreshTimer = setTimeout(() => {
                this.refreshAccessToken().catch(error => {
                    console.error('Scheduled token refresh failed:', error);
                });
            }, refreshDelay);
        }
    }

    /**
     * Refresh access token using refresh token cookie
     */
    async refreshAccessToken() {
        // Prevent concurrent refresh requests
        if (this.refreshPromise) {
            return this.refreshPromise;
        }

        this.refreshPromise = (async () => {
            try {
                const csrfToken = this.getCsrfToken();
                if (!csrfToken) {
                    throw new Error('CSRF token not found');
                }

                const response = await fetch('/api/auth/refresh', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-XSRF-TOKEN': csrfToken
                    },
                    credentials: 'include'
                });

                if (!response.ok) {
                    if (response.status === 401 || response.status === 403) {
                        // Refresh token invalid, logout
                        this.logout();
                        throw new Error('Session expired');
                    }
                    throw new Error('Token refresh failed');
                }

                const data = await response.json();
                if (data.success && data.token) {
                    this.setAccessToken(data.token);
                    return data.token;
                } else {
                    throw new Error('Invalid refresh response');
                }
            } catch (error) {
                console.error('Token refresh error:', error);
                // If refresh fails, clear token and let user re-authenticate
                this.accessToken = null;
                throw error;
            } finally {
                this.refreshPromise = null;
            }
        })();

        return this.refreshPromise;
    }

    /**
     * Fetch with automatic token refresh on 401
     */
    async fetchWithAuth(url, options = {}) {
        // Wait for in-progress refresh before making request
        if (this.refreshPromise) {
            await this.refreshPromise;
        }

        const token = this.getAccessToken();
        const csrfToken = this.getCsrfToken();

        const headers = {
            ...options.headers,
            'Content-Type': 'application/json'
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        if (csrfToken) {
            headers['X-XSRF-TOKEN'] = csrfToken;
        }

        const response = await fetch(url, {
            ...options,
            headers,
            credentials: 'include'
        });

        // If 401, try to refresh token and retry once
        if (response.status === 401 && token) {
            try {
                await this.refreshAccessToken();
                // Retry request with new token
                const newToken = this.getAccessToken();
                const newHeaders = {
                    ...headers,
                    'Authorization': `Bearer ${newToken}`
                };
                return fetch(url, {
                    ...options,
                    headers: newHeaders,
                    credentials: 'include'
                });
            } catch (error) {
                // Refresh failed, redirect to login
                this.logout();
                window.location.href = 'login-signup.html?expired=true';
                throw error;
            }
        }

        return response;
    }

    /**
     * Logout - clear tokens and cookies
     */
    async logout() {
        try {
            const csrfToken = this.getCsrfToken();
            if (csrfToken) {
                await fetch('/api/auth/logout', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.accessToken || ''}`,
                        'X-XSRF-TOKEN': csrfToken
                    },
                    credentials: 'include'
                });
            }
        } catch (error) {
            console.error('Logout API error:', error);
        }

        // Clear in-memory token
        this.accessToken = null;
        
        // Clear refresh timer
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
            this.refreshTimer = null;
        }

        // Clear localStorage (user data, etc.)
        localStorage.removeItem('currentUser');
        localStorage.removeItem('authToken');
        localStorage.removeItem('token');

        // Redirect to login
        window.location.href = 'login-signup.html';
    }

    /**
     * Logout all sessions
     */
    async logoutAll() {
        try {
            const csrfToken = this.getCsrfToken();
            if (csrfToken) {
                await fetch('/api/auth/logout-all', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.accessToken || ''}`,
                        'X-XSRF-TOKEN': csrfToken
                    },
                    credentials: 'include'
                });
            }
        } catch (error) {
            console.error('Logout all API error:', error);
        }

        // Clear in-memory token
        this.accessToken = null;
        
        // Clear refresh timer
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
            this.refreshTimer = null;
        }

        // Clear localStorage
        localStorage.removeItem('currentUser');
        localStorage.removeItem('authToken');
        localStorage.removeItem('token');

        // Redirect to login
        window.location.href = 'login-signup.html';
    }
}

// Create global instance
const authManager = new AuthManager();

// Export for use in other scripts
window.AuthManager = AuthManager;
window.authManager = authManager;

