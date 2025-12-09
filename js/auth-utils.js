// TrustChain LTO - Authentication Utilities
// Centralized authentication and token management

class AuthUtils {
    // Check if user is authenticated
    static isAuthenticated() {
        const token = localStorage.getItem('authToken');
        if (!token) return false;

        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const expiration = payload.exp * 1000;
            
            if (Date.now() >= expiration) {
                this.clearAuth();
                return false;
            }
            
            return true;
        } catch (error) {
            console.error('Error checking token:', error);
            this.clearAuth();
            return false;
        }
    }

    // Get current user
    static getCurrentUser() {
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
        const token = localStorage.getItem('authToken');
        if (!token) return null;

        // Check expiration
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const expiration = payload.exp * 1000;
            
            if (Date.now() >= expiration) {
                this.clearAuth();
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
    static clearAuth() {
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUser');
    }

    // Require authentication (redirect if not authenticated)
    static requireAuth() {
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
}

// Export for global use
window.AuthUtils = AuthUtils;

