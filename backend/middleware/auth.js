// TrustChain - Centralized Authentication Middleware
// Shared authentication and authorization middleware for all routes

const jwt = require('jsonwebtoken');

/**
 * Middleware to authenticate JWT token
 * Extracts and validates JWT token from Authorization header
 */
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            success: false,
            error: 'Access token required'
        });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret', (err, user) => {
        if (err) {
            return res.status(403).json({
                success: false,
                error: 'Invalid or expired token'
            });
        }
        req.user = user;
        next();
    });
}

/**
 * Middleware to authorize user roles
 * Checks if the authenticated user has one of the allowed roles
 * @param {string[]} allowedRoles - Array of role names allowed to access the route
 */
function authorizeRole(allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                error: 'Insufficient permissions'
            });
        }
        next();
    };
}

module.exports = {
    authenticateToken,
    authorizeRole
};

