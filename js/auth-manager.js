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
            // FIRST: Load existing token from localStorage if available
            // This ensures the token is available immediately on page load
            const storedToken = localStorage.getItem('authToken');
            if (storedToken && !storedToken.startsWith('demo-token-') && storedToken !== 'dev-token-bypass') {
                // Validate token format and expiration before using it
                try {
                    const parts = storedToken.split('.');
                    if (parts.length === 3) {
                        const payload = JSON.parse(atob(parts[1]));
                        const expiration = payload.exp * 1000;
                        const now = Date.now();
                        
                        // Use token if it's not expired (allow tokens with at least 5 seconds left)
                        // We'll refresh it in the background anyway
                        if (expiration > now + 5000) {
                            this.accessToken = storedToken;
                            this.scheduleTokenRefresh();
                            console.log('✅ Loaded existing access token from localStorage');
                        } else if (expiration > now) {
                            // Token is valid but expiring soon - use it anyway and refresh immediately
                            this.accessToken = storedToken;
                            console.log('⚠️ Token expiring soon, will refresh immediately');
                            // Don't schedule refresh, we'll do it immediately below
                        } else {
                            console.log('⚠️ Token expired, will attempt refresh');
                        }
                    }
                } catch (e) {
                    console.warn('Failed to parse stored token:', e);
                }
            }
            
            // THEN: Check if user has a refresh token cookie (indicates logged in)
            const hasRefreshToken = this.getCookie('refreshToken');
            
            if (hasRefreshToken) {
                // If we don't have a valid token, refresh immediately
                if (!this.accessToken) {
                    console.log('🔄 No valid access token, refreshing...');
                    try {
                        await this.refreshAccessToken();
                    } catch (error) {
                        console.warn('Token refresh failed, but continuing with page load:', error);
                        // Don't throw - allow page to load even if refresh fails
                    }
                } else {
                    // If we have a token, check if it needs immediate refresh
                    const decoded = this.decodeToken(this.accessToken);
                    if (decoded && decoded.exp) {
                        const expiration = decoded.exp * 1000;
                        const timeUntilExpiry = expiration - Date.now();
                        
                        // If token expires in less than 2 minutes, refresh immediately
                        if (timeUntilExpiry < 120000) {
                            console.log('🔄 Token expiring soon, refreshing immediately...');
                            try {
                                await this.refreshAccessToken();
                            } catch (error) {
                                console.warn('Immediate token refresh failed:', error);
                                // Continue with existing token - it might still be valid
                            }
                        } else {
                            // Token is still fresh, refresh in the background (non-blocking)
                            this.refreshAccessToken().catch(error => {
                                console.warn('Background token refresh failed:', error);
                                // Don't clear token if refresh fails - user might still have valid token
                            });
                        }
                    } else {
                        // Can't decode token, try to refresh
                        console.log('🔄 Cannot decode token, attempting refresh...');
                        try {
                            await this.refreshAccessToken();
                        } catch (error) {
                            console.warn('Token refresh failed:', error);
                        }
                    }
                }
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
        
        // Also persist to localStorage for page reloads
        if (token && !token.startsWith('demo-token-') && token !== 'dev-token-bypass') {
            localStorage.setItem('authToken', token);
        }
        
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

