// TrustChain LTO - Centralized API Client
// Handles all API requests with authentication, error handling, and token management

// Check if auth is disabled (from auth-utils.js)
function isAuthDisabled() {
    // Check if DISABLE_AUTH is defined globally (exposed by auth-utils.js)
    if (typeof window !== 'undefined' && typeof window.DISABLE_AUTH !== 'undefined') {
        return window.DISABLE_AUTH === true;
    }
    // Fallback: check if DISABLE_AUTH is defined in this scope
    if (typeof DISABLE_AUTH !== 'undefined') {
        return DISABLE_AUTH === true;
    }
    return false;
}

class APIClient {
    constructor() {
        this.baseURL = window.location.origin;
        // Extend default timeout to accommodate long-running batch cert generation
        this.timeout = 120000; // 120 seconds
    }

    // Get authentication token
    getAuthToken() {
        // If auth is disabled, return a mock token
        if (isAuthDisabled()) {
            return 'dev-token-bypass';
        }
        
        // Check AuthManager first (memory), then localStorage (backward compatibility)
        if (typeof window !== 'undefined' && window.authManager) {
            const token = window.authManager.getAccessToken();
            if (token) {
                return token;
            }
        }
        
        const token = localStorage.getItem('authToken');
        if (!token) {
            return null;
        }

        // Check if it's a demo token (starts with 'demo-token-')
        if (token.startsWith('demo-token-')) {
            // Demo tokens don't expire for testing purposes
            return token;
        }

        // For real JWT tokens, validate expiration
        try {
            const parts = token.split('.');
            if (parts.length !== 3) {
                // Not a valid JWT format, but if it's a demo token, allow it
                console.warn('Token format invalid, but allowing for demo purposes');
                return token;
            }
            
            const payload = JSON.parse(atob(parts[1]));
            const expiration = payload.exp * 1000; // Convert to milliseconds
            
            if (Date.now() >= expiration) {
                // Token expired
                // Only redirect if auth is not disabled
                if (!isAuthDisabled()) {
                    this.clearAuth();
                    window.location.href = 'login-signup.html?expired=true';
                }
                return null;
            }
            
            return token;
        } catch (error) {
            // If token parsing fails, check if user exists - if so, allow for demo
            const user = localStorage.getItem('currentUser');
            if (user) {
                console.warn('Token parsing error, but user exists - allowing for demo:', error);
                return token;
            }
            console.error('Error parsing token and no user found:', error);
            // Don't clear auth if user exists - might be demo mode
            return null;
        }
    }

    // Clear authentication
    clearAuth() {
        // Don't clear auth if it's disabled (dev mode)
        if (isAuthDisabled()) {
            console.log('🔓 [DEV MODE] Skipping auth clear - authentication is disabled');
            return;
        }
        
        // Clear AuthManager
        if (typeof window !== 'undefined' && window.authManager) {
            window.authManager.accessToken = null;
        }
        
        // Check if it's a demo token before clearing
        const token = localStorage.getItem('authToken');
        if (token && token.startsWith('demo-token-')) {
            // Don't clear demo tokens automatically - let user stay logged in
            console.log('Demo token detected - skipping auto-clear');
            return;
        }
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUser');
        localStorage.removeItem('token');
    }

    // Check if user is authenticated
    isAuthenticated() {
        return this.getAuthToken() !== null;
    }

    // Make API request with automatic token handling
    async request(endpoint, options = {}) {
        const token = this.getAuthToken();
        
        // If token is required and not available, redirect to login (only if auth is enabled)
        if (!token && !options.public && !isAuthDisabled()) {
            window.location.href = 'login-signup.html?redirect=' + encodeURIComponent(window.location.pathname);
            throw new Error('Authentication required');
        }
        
        // If auth is disabled, log a warning but continue
        if (isAuthDisabled() && !options.public) {
            console.log('🔓 [DEV MODE] Making API request without authentication:', endpoint);
        }

        const url = `${this.baseURL}${endpoint}`;
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
            },
            timeout: this.timeout,
            credentials: 'include' // Include cookies for refresh token
        };

        // Add authorization header if token exists
        if (token) {
            defaultOptions.headers['Authorization'] = `Bearer ${token}`;
        }

        // Add CSRF token if available
        if (typeof window !== 'undefined' && window.authManager) {
            const csrfToken = window.authManager.getCsrfToken();
            if (csrfToken) {
                defaultOptions.headers['X-XSRF-TOKEN'] = csrfToken;
            }
        }

        // Merge options
        const requestOptions = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...(options.headers || {})
            }
        };

        // Create AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        requestOptions.signal = controller.signal;

        try {
            const response = await fetch(url, requestOptions);
            clearTimeout(timeoutId);

            // Handle 401 Unauthorized
            if (response.status === 401) {
                // Only redirect if auth is not disabled
                if (!isAuthDisabled()) {
                    // Try to refresh token using AuthManager
                    if (typeof window !== 'undefined' && window.authManager) {
                        try {
                            await window.authManager.refreshAccessToken();
                            // Retry request with new token
                            const newToken = window.authManager.getAccessToken();
                            if (newToken) {
                                requestOptions.headers['Authorization'] = `Bearer ${newToken}`;
                                const retryResponse = await fetch(url, requestOptions);
                                clearTimeout(timeoutId);
                                if (retryResponse.ok) {
                                    const retryData = await retryResponse.json();
                                    return retryData;
                                }
                            }
                        } catch (refreshError) {
                            // Refresh failed, logout
                            if (typeof window !== 'undefined' && window.authManager) {
                                window.authManager.logout();
                            } else {
                                this.clearAuth();
                                window.location.href = 'login-signup.html?expired=true';
                            }
                            throw new Error('Session expired. Please login again.');
                        }
                    } else {
                        this.clearAuth();
                        window.location.href = 'login-signup.html?expired=true';
                        throw new Error('Session expired. Please login again.');
                    }
                } else {
                    // In dev mode, just log the error and continue
                    console.warn('🔓 [DEV MODE] Received 401 but auth is disabled - continuing anyway');
                    // Return a mock response for dev mode
                    return { success: false, error: 'Backend not available (dev mode)' };
                }
            }

            // Handle 403 Forbidden
            if (response.status === 403) {
                // Try to get detailed error message from response
                let errorMessage = 'You do not have permission to perform this action.';
                try {
                    const errorData = await response.json();
                    if (errorData.message) {
                        errorMessage = errorData.message;
                    } else if (errorData.error) {
                        errorMessage = errorData.error;
                    }
                } catch (e) {
                    // If response is not JSON, use default message
                }
                
                // Check if it's a demo token or auth is disabled
                const token = this.getAuthToken();
                if (isAuthDisabled()) {
                    // In dev mode, just log the error and continue
                    console.warn('🔓 [DEV MODE] Received 403 but auth is disabled - continuing anyway');
                    // Return a mock response for dev mode
                    return { success: false, error: 'Backend not available (dev mode)' };
                } else if (token && token.startsWith('demo-token-')) {
                    errorMessage = 'Demo accounts cannot access admin features. Please login with a real admin account.';
                    // Clear demo credentials
                    this.clearAuth();
                    setTimeout(() => {
                        window.location.href = 'login-signup.html?message=Please login as admin';
                    }, 2000);
                }
                
                const error = new Error(errorMessage);
                error.status = 403;
                throw error;
            }

            // Handle 404 Not Found
            if (response.status === 404) {
                throw new Error('Resource not found.');
            }

            // Handle 409 Conflict (e.g., duplicate vehicle)
            if (response.status === 409) {
                const data = await response.json().catch(() => ({}));
                const errorMessage = data.error || data.message || 'This record already exists. Please check your information.';
                const error = new Error(errorMessage);
                error.status = 409;
                error.isConflict = true;
                throw error;
            }

            // Handle 500+ Server Errors
            if (response.status >= 500) {
                // Try to get error details from response
                let errorMessage = 'Server error. Please try again later.';
                let errorDetails = null;
                
                try {
                    const errorData = await response.json().catch(() => ({}));
                    
                    if (errorData.error) {
                        errorMessage = errorData.error;
                    } else if (errorData.message) {
                        errorMessage = errorData.message;
                    }
                    
                    // Include details in development
                    if (errorData.details && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
                        errorDetails = errorData.details;
                        console.error('Server error details:', errorDetails);
                    }
                } catch (e) {
                    // If we can't parse JSON, try to get text
                    try {
                        // Response body might already be consumed, so try text
                        const text = await response.text().catch(() => '');
                        if (text) {
                            errorMessage = `Server error: ${text.substring(0, 200)}`;
                        }
                    } catch (textError) {
                        // Use default message
                    }
                }
                
                const error = new Error(errorMessage);
                error.status = response.status;
                error.isServerError = true;
                if (errorDetails) {
                    error.details = errorDetails;
                }
                throw error;
            }

            // Parse response
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || data.message || 'Request failed');
            }

            return data;
        } catch (error) {
            clearTimeout(timeoutId);
            
            // Preserve error status and conflict flag if set
            if (error.status) {
                const enhancedError = new Error(error.message);
                enhancedError.status = error.status;
                enhancedError.isConflict = error.isConflict || false;
                throw enhancedError;
            }

            // Handle network errors
            if (error.name === 'AbortError') {
                // In dev mode, return a mock response instead of throwing
                if (isAuthDisabled()) {
                    console.warn('🔓 [DEV MODE] Request timeout (backend not available)');
                    return { success: false, error: 'Backend not available (dev mode)' };
                }
                throw new Error('Request timeout. Please check your connection and try again.');
            }

            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                // In dev mode, return a mock response instead of throwing
                if (isAuthDisabled()) {
                    console.warn('🔓 [DEV MODE] Network error (backend not available)');
                    return { success: false, error: 'Backend not available (dev mode)' };
                }
                throw new Error('Network error. Please check your internet connection.');
            }

            // Re-throw other errors
            throw error;
        }
    }

    // GET request
    async get(endpoint, options = {}) {
        return this.request(endpoint, {
            ...options,
            method: 'GET'
        });
    }

    // POST request
    async post(endpoint, data, options = {}) {
        // Check if data is FormData
        if (data instanceof FormData) {
            // Use upload method for FormData
            return this.upload(endpoint, data, options);
        }
        
        return this.request(endpoint, {
            ...options,
            method: 'POST',
            data: data,
            body: JSON.stringify(data)
        });
    }

    // PUT request
    async put(endpoint, data, options = {}) {
        return this.request(endpoint, {
            ...options,
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    // DELETE request
    // PATCH request
    async patch(endpoint, data, options = {}) {
        return this.request(endpoint, {
            ...options,
            method: 'PATCH',
            body: JSON.stringify(data)
        });
    }

    async delete(endpoint, options = {}) {
        return this.request(endpoint, {
            ...options,
            method: 'DELETE'
        });
    }

    // Upload file
    async upload(endpoint, formData, options = {}) {
        const token = this.getAuthToken();
        
        if (!token && !options.public && !isAuthDisabled()) {
            window.location.href = 'login-signup.html?redirect=' + encodeURIComponent(window.location.pathname);
            throw new Error('Authentication required');
        }
        
        // If auth is disabled, log a warning but continue
        if (isAuthDisabled() && !options.public) {
            console.log('🔓 [DEV MODE] Uploading file without authentication:', endpoint);
        }

        const url = `${this.baseURL}${endpoint}`;
        const headers = {};
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        // Add CSRF token if available
        if (typeof window !== 'undefined' && window.authManager) {
            const csrfToken = window.authManager.getCsrfToken();
            if (csrfToken) {
                headers['X-XSRF-TOKEN'] = csrfToken;
            }
        }
        
        const requestOptions = {
            method: 'POST',
            body: formData,
            headers,
            credentials: 'include' // Include cookies for refresh token
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 seconds for uploads
        requestOptions.signal = controller.signal;

        try {
            const response = await fetch(url, requestOptions);
            clearTimeout(timeoutId);

            if (response.status === 401) {
                // Only redirect if auth is not disabled
                if (!isAuthDisabled()) {
                    this.clearAuth();
                    window.location.href = 'login-signup.html?expired=true';
                    throw new Error('Session expired. Please login again.');
                } else {
                    // In dev mode, just log the error and continue
                    console.warn('🔓 [DEV MODE] Upload received 401 but auth is disabled - continuing anyway');
                    return { success: false, error: 'Backend not available (dev mode)' };
                }
            }

            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: 'Upload failed' }));
                throw new Error(error.error || error.message || 'Upload failed');
            }

            return await response.json();
        } catch (error) {
            clearTimeout(timeoutId);
            
            if (error.name === 'AbortError') {
                throw new Error('Upload timeout. Please try again.');
            }

            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                throw new Error('Network error. Please check your internet connection.');
            }

            throw error;
        }
    }
}

// Create global instance
const apiClient = new APIClient();

// Export for use in other scripts
window.APIClient = APIClient;
window.apiClient = apiClient;

