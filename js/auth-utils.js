// TrustChain LTO - Authentication Utilities
// Centralized authentication and token management

// ============================================
// UI DEVELOPMENT MODE - DISABLE AUTHENTICATION
// Set to true to bypass all authentication checks for UI development
// Set to false to re-enable authentication (when backend is available)
// ============================================
const DISABLE_AUTH = false; // ✅ Authentication enabled for production

// Expose DISABLE_AUTH globally so other scripts can access it
window.DISABLE_AUTH = DISABLE_AUTH;

// Log when dev mode is active
if (DISABLE_AUTH) {
    console.log('%c🔓 AUTHENTICATION DISABLED - UI Development Mode', 'color: #f39c12; font-weight: bold; font-size: 14px;');
    console.log('%cAll authentication checks are bypassed. Set DISABLE_AUTH = false in auth-utils.js to re-enable.', 'color: #7f8c8d; font-size: 12px;');
}

class AuthUtils {
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

        switch(user.role) {
            case 'hpg_admin':
                window.location.href = 'hpg-admin-dashboard.html';
                break;
            case 'admin':
                window.location.href = 'admin-dashboard.html';
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
        window.location.href = 'index.html';
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
window.quickLoginAsOwner = function() {
    AuthUtils.setDemoCredentials('owner@example.com', 'owner123');
    window.location.href = 'owner-dashboard.html';
};

