// TrustChain LTO - Centralized API Client
// Handles all API requests with authentication, error handling, and token management

class APIClient {
    constructor() {
        this.baseURL = window.location.origin;
        this.timeout = 30000; // 30 seconds
    }

    // Get authentication token
    getAuthToken() {
        const token = localStorage.getItem('authToken');
        if (!token) {
            return null;
        }

        // Check token expiration
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const expiration = payload.exp * 1000; // Convert to milliseconds
            
            if (Date.now() >= expiration) {
                // Token expired
                this.clearAuth();
                window.location.href = 'login.html?expired=true';
                return null;
            }
            
            return token;
        } catch (error) {
            console.error('Error parsing token:', error);
            this.clearAuth();
            return null;
        }
    }

    // Clear authentication
    clearAuth() {
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUser');
    }

    // Check if user is authenticated
    isAuthenticated() {
        return this.getAuthToken() !== null;
    }

    // Make API request with automatic token handling
    async request(endpoint, options = {}) {
        const token = this.getAuthToken();
        
        // If token is required and not available, redirect to login
        if (!token && !options.public) {
            window.location.href = 'login.html?redirect=' + encodeURIComponent(window.location.pathname);
            throw new Error('Authentication required');
        }

        const url = `${this.baseURL}${endpoint}`;
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
            },
            timeout: this.timeout
        };

        // Add authorization header if token exists
        if (token) {
            defaultOptions.headers['Authorization'] = `Bearer ${token}`;
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
                this.clearAuth();
                window.location.href = 'login.html?expired=true';
                throw new Error('Session expired. Please login again.');
            }

            // Handle 403 Forbidden
            if (response.status === 403) {
                throw new Error('You do not have permission to perform this action.');
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
                throw new Error('Request timeout. Please check your connection and try again.');
            }

            if (error.name === 'TypeError' && error.message.includes('fetch')) {
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
    async delete(endpoint, options = {}) {
        return this.request(endpoint, {
            ...options,
            method: 'DELETE'
        });
    }

    // Upload file
    async upload(endpoint, formData, options = {}) {
        const token = this.getAuthToken();
        
        if (!token && !options.public) {
            window.location.href = 'login.html?redirect=' + encodeURIComponent(window.location.pathname);
            throw new Error('Authentication required');
        }

        const url = `${this.baseURL}${endpoint}`;
        const requestOptions = {
            method: 'POST',
            body: formData,
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 seconds for uploads
        requestOptions.signal = controller.signal;

        try {
            const response = await fetch(url, requestOptions);
            clearTimeout(timeoutId);

            if (response.status === 401) {
                this.clearAuth();
                window.location.href = 'login.html?expired=true';
                throw new Error('Session expired. Please login again.');
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

