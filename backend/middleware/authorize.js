// TrustChain Authorization Middleware
// Middleware to authorize user roles and permissions

const { logOfficerActivity } = require('../services/activityLogger');

// Role-based authorization (existing functionality)
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
            // Log unauthorized access attempt
            logOfficerActivity({
                officerId: req.user.userId,
                activityType: 'unauthorized_access',
                entityType: 'system',
                action: 'denied',
                notes: `Attempted to access ${req.path} without required role: ${allowedRoles.join(' or ')}`,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent']
            }).catch(err => console.error('Failed to log unauthorized access:', err));

            return res.status(403).json({
                success: false,
                error: 'Insufficient permissions',
                message: `You do not have permission to perform this action. Required role: ${allowedRoles.join(' or ')}. Your role: ${req.user.role || 'none'}`
            });
        }
        next();
    };
}

// Permission-based authorization (fine-grained control)
function authorizePermission(requiredPermission) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }

        const userRole = req.user.role;
        const permissions = getPermissionsForRole(userRole);

        if (process.env.NODE_ENV === 'development') {
            console.log('Permission check:', {
                userRole: userRole,
                requiredPermission: requiredPermission,
                userPermissions: permissions,
                hasPermission: permissions.includes(requiredPermission)
            });
        }

        if (!permissions.includes(requiredPermission)) {
            // Log unauthorized access attempt
            logOfficerActivity({
                officerId: req.user.userId,
                activityType: 'unauthorized_access',
                entityType: 'system',
                action: 'denied',
                notes: `Attempted ${requiredPermission} on ${req.path} without permission`,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent']
            }).catch(err => console.error('Failed to log unauthorized access:', err));

            return res.status(403).json({
                success: false,
                error: 'Insufficient permissions',
                message: `You do not have permission to ${requiredPermission}. Your role: ${userRole}`
            });
        }

        next();
    };
}

// Get permissions for a given role
function getPermissionsForRole(role) {
    const permissionMap = {
        'lto_admin': [
            // Vehicle permissions
            'vehicle.view', 'vehicle.view_all', 'vehicle.register', 'vehicle.approve', 'vehicle.reject', 'vehicle.suspend', 'vehicle.delete',
            // Document permissions
            'document.view', 'document.view_all', 'document.upload', 'document.verify', 'document.delete',
            // Transfer permissions
            'transfer.view', 'transfer.view_all', 'transfer.create', 'transfer.review', 'transfer.approve', 'transfer.reject',
            // Inspection permissions
            'inspection.conduct', 'inspection.approve', 'inspection.view_all',
            // Clearance permissions
            'clearance.request', 'clearance.process', 'clearance.view_all',
            // User management permissions
            'user.create', 'user.edit', 'user.deactivate', 'user.view_all',
            // Report and audit permissions
            'report.generate', 'report.view_all', 'audit.view_all',
            // System permissions
            'system.settings', 'system.blockchain',
            // Blockchain permissions
            'blockchain.view', 'blockchain.write'
        ],
        'lto_supervisor': [
            // Vehicle permissions
            'vehicle.view', 'vehicle.view_all', 'vehicle.register', 'vehicle.approve', 'vehicle.reject',
            // Document permissions
            'document.view', 'document.view_all', 'document.upload', 'document.verify', 'document.delete',
            // Transfer permissions
            'transfer.view', 'transfer.view_all', 'transfer.review', 'transfer.approve', 'transfer.reject',
            // Inspection permissions
            'inspection.conduct', 'inspection.approve', 'inspection.view_team',
            // Clearance permissions
            'clearance.request', 'clearance.view_team',
            // Report and audit permissions
            'report.generate', 'report.view_team', 'audit.view_team',
            // Blockchain permissions
            'blockchain.view'
        ],
        'lto_officer': [
            // Vehicle permissions
            'vehicle.view', 'vehicle.view_assigned', 'vehicle.register', 'vehicle.approve', 'vehicle.reject',
            // Document permissions
            'document.view', 'document.upload', 'document.verify',
            // Transfer permissions
            'transfer.view', 'transfer.view_assigned', 'transfer.review', 'transfer.approve_under_limit',
            // Inspection permissions
            'inspection.conduct', 'inspection.view_own',
            // Clearance permissions
            'clearance.request', 'clearance.view_own',
            // Blockchain permissions
            'blockchain.view'
        ],
        'admin': [
            // Legacy admin role - full permissions (backward compatibility)
            'vehicle.view', 'vehicle.view_all', 'vehicle.register', 'vehicle.approve', 'vehicle.reject', 'vehicle.suspend', 'vehicle.delete',
            'document.view', 'document.view_all', 'document.upload', 'document.verify', 'document.delete',
            'transfer.view', 'transfer.view_all', 'transfer.create', 'transfer.review', 'transfer.approve', 'transfer.reject',
            'inspection.conduct', 'inspection.approve', 'inspection.view_all',
            'clearance.request', 'clearance.process', 'clearance.view_all',
            'user.create', 'user.edit', 'user.deactivate', 'user.view_all',
            'report.generate', 'report.view_all', 'audit.view_all',
            'system.settings', 'system.blockchain',
            'blockchain.view', 'blockchain.write'
        ],
        'staff': [
            // Limited staff permissions
            'vehicle.view', 'vehicle.view_assigned',
            'document.view', 'document.upload',
            'transfer.view', 'transfer.view_assigned',
            'inspection.view_own'
        ],
        'vehicle_owner': [
            // Vehicle owner permissions
            'vehicle.create', 'vehicle.view_own',
            'document.upload_own', 'document.view_own',
            'transfer.create_own', 'transfer.view_own'
        ],
        'insurance_verifier': [
            // Insurance verifier permissions
            'clearance.process_insurance',
            'document.verify_insurance',
            'document.upload',
            'clearance.view_own'
        ],
        'emission_verifier': [
            // Emission verifier permissions
            'clearance.process_emission',
            'document.verify_emission',
            'document.upload',
            'clearance.view_own'
        ]
    };

    return permissionMap[role] || [];
}

// Check if user has specific permission
function hasPermission(user, permission) {
    if (!user || !user.role) return false;
    const permissions = getPermissionsForRole(user.role);
    return permissions.includes(permission);
}

// Check if user has any of the specified permissions
function hasAnyPermission(user, permissionList) {
    if (!user || !user.role) return false;
    const permissions = getPermissionsForRole(user.role);
    return permissionList.some(permission => permissions.includes(permission));
}

// Check if user has all of the specified permissions
function hasAllPermissions(user, permissionList) {
    if (!user || !user.role) return false;
    const permissions = getPermissionsForRole(user.role);
    return permissionList.every(permission => permissions.includes(permission));
}

module.exports = {
    authorizeRole,
    authorizePermission,
    getPermissionsForRole,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions
};

