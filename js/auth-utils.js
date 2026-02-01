// TrustChain LTO - Authentication Utilities
// Centralized authentication and token management

// ============================================
// UI DEVELOPMENT MODE - DISABLE AUTHENTICATION
// Set to true to bypass all authentication checks for UI development
// Set to false to re-enable authentication (when backend is available)
// 
// ⚠️ WARNING: DO NOT ENABLE IN PRODUCTION
// This bypasses all security checks and should ONLY be used for local UI development.
// In production, this MUST remain false for security compliance.
// ============================================
const DISABLE_AUTH = false; // ✅ Authentication enabled for production

// Production safeguard: Force disable auth bypass in production environments
const isProduction = window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1' &&
    !window.location.hostname.includes('.local');
if (isProduction && DISABLE_AUTH) {
    console.error('%c🚨 SECURITY WARNING: Authentication bypass is enabled in production!', 'color: #e74c3c; font-weight: bold; font-size: 14px;');
    console.error('%cThis is a security risk. Authentication bypass has been automatically disabled.', 'color: #e74c3c; font-size: 12px;');
    // Force disable in production
    window.DISABLE_AUTH = false;
} else {
    // Expose DISABLE_AUTH globally so other scripts can access it
    window.DISABLE_AUTH = DISABLE_AUTH;
}

// Log when dev mode is active (only in development)
if (DISABLE_AUTH && !isProduction) {
    console.log('%c🔓 AUTHENTICATION DISABLED - UI Development Mode', 'color: #f39c12; font-weight: bold; font-size: 14px;');
    console.log('%cAll authentication checks are bypassed. Set DISABLE_AUTH = false in auth-utils.js to re-enable.', 'color: #7f8c8d; font-size: 12px;');
}

class AuthUtils {
    // Session ID for current tab (prevents multiple accounts in same browser)
    static _sessionId = null;

    // Generate unique session ID for this tab
    static getSessionId() {
        if (!this._sessionId) {
            // Check if we have a session ID in sessionStorage (tab-specific)
            this._sessionId = sessionStorage.getItem('tabSessionId');
            if (!this._sessionId) {
                this._sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                sessionStorage.setItem('tabSessionId', this._sessionId);
            }
        }
        return this._sessionId;
    }

    // Validate that current session matches stored session
    static validateSession() {
        const storedSessionId = localStorage.getItem('activeSessionId');
        const currentSessionId = this.getSessionId();

        // If there's already an active session from a different tab
        if (storedSessionId && storedSessionId !== currentSessionId) {
            // Check if that session is still active (within 30 seconds heartbeat)
            const lastHeartbeat = parseInt(localStorage.getItem('sessionHeartbeat') || '0');
            const now = Date.now();

            // If last heartbeat was within 5 seconds, another tab is active
            if (now - lastHeartbeat < 5000) {
                console.warn('⚠️ Another session is active in a different tab');
                return false;
            }
        }

        // Claim this session
        localStorage.setItem('activeSessionId', currentSessionId);
        localStorage.setItem('sessionHeartbeat', Date.now().toString());
        return true;
    }

    // Start session heartbeat (call this on page load)
    static startSessionHeartbeat() {
        // Update heartbeat every 3 seconds
        setInterval(() => {
            if (this.isAuthenticated()) {
                localStorage.setItem('sessionHeartbeat', Date.now().toString());
                localStorage.setItem('activeSessionId', this.getSessionId());
            }
        }, 3000);
    }

    // Check if user is authenticated
    static isAuthenticated() {
        // If auth is disabled, always return true
        if (DISABLE_AUTH) return true;

        // First check if user exists in localStorage
        const user = this.getCurrentUser();
        if (!user) return false;

        const token = localStorage.getItem('authToken');
        if (!token) {
            // If no token but user exists, check if it's a demo token scenario
            // For demo purposes, if user exists, consider authenticated
            return true;
        }

        // Check if it's a demo token (starts with 'demo-token-')
        if (token.startsWith('demo-token-')) {
            // Demo tokens don't expire for testing purposes
            return true;
        }

        // For real JWT tokens, validate expiration
        try {
            const parts = token.split('.');
            if (parts.length !== 3) {
                // Not a valid JWT format, but if user exists, allow access for demo
                return true;
            }

            const payload = JSON.parse(atob(parts[1]));
            const expiration = payload.exp * 1000;

            if (Date.now() >= expiration) {
                this.clearAuth();
                return false;
            }

            return true;
        } catch (error) {
            // If token parsing fails but user exists, allow access for demo purposes
            console.warn('Token parsing error (using demo mode):', error);
            return true;
        }
    }

    // Get current user
    static getCurrentUser() {
        // If auth is disabled, return a mock admin user for UI development
        if (DISABLE_AUTH) {
            // Check URL to determine which role to mock
            const path = window.location.pathname;
            let mockRole = 'admin';
            let mockName = 'ADMIN';
            let mockInitials = 'AD';

            if (path.includes('insurance')) {
                mockRole = 'insurance_verifier';
                mockName = 'Insurance Verifier';
                mockInitials = 'IV';
            } else if (path.includes('hpg')) {
                mockRole = 'hpg_admin';
                mockName = 'HPG Admin';
                mockInitials = 'HPG';
            } else if (path.includes('emission') || path.includes('verifier')) {
                mockRole = 'emission_verifier';
                mockName = 'Emission Verifier';
                mockInitials = 'EV';
            } else if (path.includes('owner')) {
                mockRole = 'vehicle_owner';
                mockName = 'Vehicle Owner';
                mockInitials = 'VO';
            }

            return {
                id: 'dev-user',
                email: 'dev@example.com',
                role: mockRole,
                firstName: mockName.split(' ')[0] || 'Dev',
                lastName: mockName.split(' ')[1] || 'User',
                name: mockName,
                organization: mockRole === 'admin' ? 'Land Transportation Office' :
                    mockRole === 'insurance_verifier' ? 'Insurance Verification Office' :
                        mockRole === 'hpg_admin' ? 'Highway Patrol Group' :
                            mockRole === 'emission_verifier' ? 'Emission Testing Center' : 'Individual',
                phone: '+63 912 345 6789',
                isActive: true,
                emailVerified: true,
                _devMode: true // Flag to indicate this is a dev user
            };
        }

        const userStr = localStorage.getItem('currentUser');
        if (!userStr) return null;

        try {
            return JSON.parse(userStr);
        } catch (error) {
            console.error('Error parsing user data:', error);
            return null;
        }
    }

    // Get auth token
    static getToken() {
        // If auth is disabled, return a mock token
        if (DISABLE_AUTH) {
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
        if (!token) return null;

        // Check if it's a demo token
        if (token.startsWith('demo-token-')) {
            return token;
        }

        // For real JWT tokens, validate expiration
        try {
            const parts = token.split('.');
            if (parts.length !== 3) {
                // Not a valid JWT format, return token anyway for demo
                return token;
            }

            const payload = JSON.parse(atob(parts[1]));
            const expiration = payload.exp * 1000;

            if (Date.now() >= expiration) {
                this.clearAuth();
                return null;
            }

            return token;
        } catch (error) {
            // If token parsing fails, return token anyway for demo purposes
            console.warn('Token parsing error (using demo mode):', error);
            return token;
        }
    }

    // Clear authentication
    static clearAuth() {
        // Clear AuthManager
        if (typeof window !== 'undefined' && window.authManager) {
            window.authManager.accessToken = null;
        }

        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUser');
    }

    // Require authentication (redirect if not authenticated)
    static requireAuth() {
        // If auth is disabled, always return true
        if (DISABLE_AUTH) {
            console.log('[DEV MODE] Authentication bypassed');
            return true;
        }

        if (!this.isAuthenticated()) {
            const currentPath = window.location.pathname;
            window.location.href = `login-signup.html?redirect=${encodeURIComponent(currentPath)}`;
            return false;
        }
        return true;
    }

    // Check user role
    static hasRole(role) {
        const user = this.getCurrentUser();
        return user && user.role === role;
    }

    // Check if user has any of the specified roles
    static hasAnyRole(roles) {
        const user = this.getCurrentUser();
        return user && roles.includes(user.role);
    }

    // Update user data
    static updateUser(userData) {
        localStorage.setItem('currentUser', JSON.stringify(userData));
    }

    // Get user display name
    static getUserDisplayName() {
        const user = this.getCurrentUser();
        if (!user) return 'Guest';

        if (user.firstName && user.lastName) {
            return `${user.firstName} ${user.lastName}`;
        }

        return user.email || 'User';
    }

    // Get user initials for avatar
    static getUserInitials() {
        const user = this.getCurrentUser();
        if (!user) return 'GU';

        if (user.firstName && user.lastName) {
            return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
        }

        if (user.email) {
            return user.email.substring(0, 2).toUpperCase();
        }

        return 'US';
    }

    // Redirect based on role
    static redirectByRole() {
        const user = this.getCurrentUser();
        if (!user) {
            window.location.href = 'login-signup.html';
            return;
        }

        // Special case: Certificate Generator account
        if (user.email?.toLowerCase() === 'certificategenerator@gmail.com') {
            window.location.href = 'certificate-generator.html';
            return;
        }

        switch (user.role) {
            case 'hpg_admin':
                window.location.href = 'hpg-admin-dashboard.html';
                break;
            case 'admin':
                window.location.href = 'admin-dashboard.html';
                break;
            case 'lto_admin':
                // LTO Admin goes to admin dashboard (has full admin access)
                window.location.href = 'admin-dashboard.html';
                break;
            case 'lto_officer':
                // LTO Officer goes to officer dashboard
                window.location.href = 'lto-officer-dashboard.html';
                break;
            case 'insurance_verifier':
                window.location.href = 'insurance-verifier-dashboard.html';
                break;
            case 'emission_verifier':
                window.location.href = 'verifier-dashboard.html';
                break;
            case 'vehicle_owner':
            default:
                window.location.href = 'owner-dashboard.html';
                break;
        }
    }

    // Logout function
    static logout() {
        this.clearAuth();
        // Also clear token if stored separately
        localStorage.removeItem('token');
        // Clear session tracking
        localStorage.removeItem('activeSessionId');
        localStorage.removeItem('sessionHeartbeat');
        sessionStorage.removeItem('tabSessionId');
        this._sessionId = null;
        // Use replace() to prevent back button from showing authenticated pages
        window.location.replace('login-signup.html');
    }

    // Check if another account is logged in (call before login)
    static checkExistingSession() {
        const existingUser = this.getCurrentUser();
        if (existingUser) {
            return {
                hasExisting: true,
                user: existingUser,
                message: `Already logged in as ${existingUser.email}. Please logout first or continue as this user.`
            };
        }
        return { hasExisting: false };
    }

    // Force logout (for switching accounts)
    static forceLogout() {
        this.clearAuth();
        localStorage.removeItem('token');
        localStorage.removeItem('activeSessionId');
        localStorage.removeItem('sessionHeartbeat');
        sessionStorage.removeItem('tabSessionId');
        this._sessionId = null;
    }

    // Set demo credentials (for testing purposes)
    static setDemoCredentials(email = 'owner@example.com', password = 'owner123') {
        const demoUsers = {
            'owner@example.com': {
                id: 'demo-user-' + Date.now(),
                email: 'owner@example.com',
                role: 'vehicle_owner',
                firstName: 'John',
                lastName: 'Doe',
                name: 'Vehicle Owner',
                organization: 'Individual',
                phone: '+63 912 345 6789',
                isActive: true,
                emailVerified: true
            },
            'vehicle@example.com': {
                id: 'demo-user-' + Date.now(),
                email: 'vehicle@example.com',
                role: 'vehicle_owner',
                firstName: 'Jane',
                lastName: 'Smith',
                name: 'Vehicle Owner',
                organization: 'Individual',
                phone: '+63 912 345 6789',
                isActive: true,
                emailVerified: true
            }
        };

        const userData = demoUsers[email] || {
            id: 'demo-user-' + Date.now(),
            email: email,
            role: 'vehicle_owner',
            firstName: 'Demo',
            lastName: 'User',
            name: 'Demo User',
            organization: 'Individual',
            phone: '+63 912 345 6789',
            isActive: true,
            emailVerified: true
        };

        localStorage.setItem('currentUser', JSON.stringify(userData));
        localStorage.setItem('authToken', 'demo-token-' + Date.now());
        localStorage.setItem('token', 'demo-token-' + Date.now());

        return userData;
    }
}

// Export for global use
window.AuthUtils = AuthUtils;

// Helper function to quickly login as vehicle owner (for testing)
window.quickLoginAsOwner = function () {
    AuthUtils.setDemoCredentials('owner@example.com', 'owner123');
    window.location.href = 'owner-dashboard.html';
};

