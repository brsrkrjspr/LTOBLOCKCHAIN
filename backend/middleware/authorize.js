// TrustChain Authorization Middleware
// Middleware to authorize user roles

function authorizeRole(allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }

        // Debug logging in development
        if (process.env.NODE_ENV === 'development') {
            console.log('Authorization check:', {
                userRole: req.user.role,
                userId: req.user.userId,
                email: req.user.email,
                allowedRoles: allowedRoles,
                hasPermission: allowedRoles.includes(req.user.role)
            });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                error: 'Insufficient permissions',
                message: `You do not have permission to perform this action. Required role: ${allowedRoles.join(' or ')}. Your role: ${req.user.role || 'none'}`
            });
        }
        next();
    };
}

module.exports = {
    authorizeRole
};

