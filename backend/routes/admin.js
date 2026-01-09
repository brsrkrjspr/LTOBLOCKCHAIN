// TrustChain LTO - Admin Routes
// Enhanced admin statistics and management endpoints

const express = require('express');
const router = express.Router();
const db = require('../database/services');
const { authenticateToken } = require('../middleware/auth');
const { authorizeRole } = require('../middleware/authorize');

// Get enhanced admin statistics
router.get('/stats', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const dbModule = require('../database/db');
        
        // Get vehicle statistics
        const vehicleStats = await dbModule.query(
            `SELECT status, COUNT(*) as count 
             FROM vehicles 
             GROUP BY status`
        );
        
        const vehicles = {
            total: 0,
            submitted: 0,
            pending_blockchain: 0,
            registered: 0,
            approved: 0,
            rejected: 0
        };
        
        vehicleStats.rows.forEach(row => {
            vehicles.total += parseInt(row.count);
            const status = row.status.toLowerCase();
            if (vehicles.hasOwnProperty(status)) {
                vehicles[status] = parseInt(row.count);
            }
        });
        
        // Get transfer request statistics
        const transferStats = await dbModule.query(
            `SELECT status, COUNT(*) as count 
             FROM transfer_requests 
             GROUP BY status`
        );
        
        const transfers = {
            total: 0,
            pending: 0,
            reviewing: 0,
            approved: 0,
            rejected: 0,
            completed: 0,
            forwarded_to_hpg: 0
        };
        
        transferStats.rows.forEach(row => {
            transfers.total += parseInt(row.count);
            const status = row.status.toLowerCase();
            if (transfers.hasOwnProperty(status)) {
                transfers[status] = parseInt(row.count);
            }
        });
        
        // Get clearance request statistics
        const clearanceStats = await dbModule.query(
            `SELECT request_type, status, COUNT(*) as count 
             FROM clearance_requests 
             GROUP BY request_type, status`
        );
        
        const clearances = {
            total: 0,
            hpg: { total: 0, pending: 0, approved: 0, rejected: 0 },
            insurance: { total: 0, pending: 0, approved: 0, rejected: 0 },
            emission: { total: 0, pending: 0, approved: 0, rejected: 0 }
        };
        
        clearanceStats.rows.forEach(row => {
            clearances.total += parseInt(row.count);
            const type = row.request_type.toLowerCase();
            const status = row.status.toLowerCase();
            if (clearances[type]) {
                clearances[type].total += parseInt(row.count);
                if (clearances[type].hasOwnProperty(status)) {
                    clearances[type][status] = parseInt(row.count);
                }
            }
        });
        
        // Get user statistics
        const userStats = await dbModule.query(
            `SELECT role, COUNT(*) as count 
             FROM users 
             WHERE is_active = true
             GROUP BY role`
        );
        
        const users = {
            total: 0,
            admin: 0,
            vehicle_owner: 0,
            insurance_verifier: 0,
            emission_verifier: 0
        };
        
        userStats.rows.forEach(row => {
            users.total += parseInt(row.count);
            const role = row.role.toLowerCase();
            if (users.hasOwnProperty(role)) {
                users[role] = parseInt(row.count);
            }
        });
        
        // Get document statistics
        const documentStats = await dbModule.query(
            `SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN verified = true THEN 1 END) as verified,
                COUNT(CASE WHEN verified = false OR verified IS NULL THEN 1 END) as unverified
             FROM documents`
        );
        
        const documents = {
            total: parseInt(documentStats.rows[0].total || 0),
            verified: parseInt(documentStats.rows[0].verified || 0),
            unverified: parseInt(documentStats.rows[0].unverified || 0)
        };
        
        // Get recent activity (last 24 hours)
        const recentActivity = await dbModule.query(
            `SELECT COUNT(*) as count 
             FROM vehicle_history 
             WHERE performed_at >= NOW() - INTERVAL '24 hours'`
        );
        
        res.json({
            success: true,
            stats: {
                vehicles,
                transfers,
                clearances,
                users,
                documents,
                recentActivity: parseInt(recentActivity.rows[0].count || 0)
            },
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Get admin stats error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Get all clearance requests (for verification tracker)
router.get('/clearance-requests', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const dbModule = require('../database/db');
        
        // Get all clearance requests with vehicle info
        const result = await dbModule.query(`
            SELECT 
                cr.*,
                v.vin,
                v.plate_number,
                v.make,
                v.model,
                v.year,
                v.engine_number,
                v.chassis_number,
                u1.email as requested_by_email,
                u1.first_name || ' ' || u1.last_name as requested_by_name,
                u2.email as assigned_to_email
            FROM clearance_requests cr
            LEFT JOIN vehicles v ON cr.vehicle_id = v.id
            LEFT JOIN users u1 ON cr.requested_by = u1.id
            LEFT JOIN users u2 ON cr.assigned_to = u2.id
            ORDER BY cr.updated_at DESC, cr.created_at DESC
            LIMIT 100
        `);
        
        // Group by type
        const requests = result.rows;
        const grouped = {
            hpg: requests.filter(r => r.request_type === 'hpg'),
            insurance: requests.filter(r => r.request_type === 'insurance'),
            emission: requests.filter(r => r.request_type === 'emission')
        };
        
        // Count by status for each type
        const stats = {
            hpg: { pending: 0, approved: 0, rejected: 0, completed: 0 },
            insurance: { pending: 0, approved: 0, rejected: 0, completed: 0 },
            emission: { pending: 0, approved: 0, rejected: 0, completed: 0 }
        };
        
        requests.forEach(r => {
            const type = r.request_type;
            const status = (r.status || 'PENDING').toLowerCase();
            if (stats[type] && stats[type].hasOwnProperty(status)) {
                stats[type][status]++;
            }
        });
        
        res.json({
            success: true,
            requests: requests,
            grouped: grouped,
            stats: stats,
            total: requests.length
        });
        
    } catch (error) {
        console.error('Get clearance requests error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get clearance requests: ' + error.message
        });
    }
});

// Get notifications for admin
router.get('/notifications', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const notifications = await db.getNotificationsByUser(req.user.userId);
        
        res.json({
            success: true,
            notifications: notifications || [],
            unreadCount: (notifications || []).filter(n => !n.read).length
        });
        
    } catch (error) {
        console.error('Get admin notifications error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get notifications'
        });
    }
});

// Load common passwords list for validation
const fs = require('fs');
const path = require('path');
const commonPasswordsPath = path.join(__dirname, '../config/commonPasswords.txt');
const commonPasswords = new Set(
    fs.readFileSync(commonPasswordsPath, 'utf8')
        .split('\n')
        .map(p => p.trim().toLowerCase())
        .filter(p => p.length > 0)
);

// Validation helper - reuse from auth.js logic
function validateUserInput(data, isAdminCreation = false) {
    const errors = [];

    // Email validation
    if (!data.email) {
        errors.push('Email is required');
    } else {
        const email = data.email.trim().toLowerCase();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            errors.push('Invalid email format');
        }
        if (email.length > 255) {
            errors.push('Email is too long (max 255 characters)');
        }
    }

    // Password validation (NIST SP 800-63B)
    if (!data.password) {
        errors.push('Password is required');
    } else {
        if (data.password.length < 12) {
            errors.push('Password must be at least 12 characters');
        }
        if (data.password.length > 128) {
            errors.push('Password is too long (max 128 characters)');
        }
        if (commonPasswords.has(data.password.toLowerCase())) {
            errors.push('This password is too common. Please choose a different one');
        }
    }

    // First name validation
    if (!data.firstName) {
        errors.push('First name is required');
    } else {
        const firstName = data.firstName.trim();
        if (firstName.length < 2) {
            errors.push('First name must be at least 2 characters');
        }
        if (firstName.length > 50) {
            errors.push('First name is too long (max 50 characters)');
        }
        if (!/^[a-zA-Z\s\-']+$/.test(firstName)) {
            errors.push('First name can only contain letters, spaces, hyphens, and apostrophes');
        }
    }

    // Last name validation
    if (!data.lastName) {
        errors.push('Last name is required');
    } else {
        const lastName = data.lastName.trim();
        if (lastName.length < 2) {
            errors.push('Last name must be at least 2 characters');
        }
        if (lastName.length > 50) {
            errors.push('Last name is too long (max 50 characters)');
        }
        if (!/^[a-zA-Z\s\-']+$/.test(lastName)) {
            errors.push('Last name can only contain letters, spaces, hyphens, and apostrophes');
        }
    }

    // Role validation (for admin creation only)
    if (isAdminCreation) {
        const validRoles = ['admin', 'insurance_verifier', 'emission_verifier', 'hpg_admin', 'staff', 'vehicle_owner'];
        if (!data.role) {
            errors.push('Role is required for admin account creation');
        } else if (!validRoles.includes(data.role)) {
            errors.push(`Invalid role. Allowed roles: ${validRoles.join(', ')}`);
        }
    }

    // Phone validation (optional)
    if (data.phone) {
        const phone = data.phone.trim();
        if (phone.length > 20) {
            errors.push('Phone number is too long');
        }
        if (!/^[\d\s\-\(\)\+]+$/.test(phone)) {
            errors.push('Phone number contains invalid characters');
        }
    }

    // Address validation (optional)
    if (data.address && data.address.length > 500) {
        errors.push('Address is too long (max 500 characters)');
    }

    return errors.length === 0 
        ? { valid: true }
        : { valid: false, errors };
}

// Admin-only endpoint: Create privileged user account
router.post('/create-user', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    const clientIp = req.ip || req.connection.remoteAddress;
    const adminUser = req.user; // Admin who is creating the account
    
    try {
        const { 
            email: rawEmail, 
            password, 
            firstName: rawFirstName, 
            lastName: rawLastName, 
            role: requestedRole,
            organization, 
            phone, 
            address 
        } = req.body;

        // Normalize input
        const email = rawEmail ? rawEmail.trim().toLowerCase() : '';
        const firstName = rawFirstName ? rawFirstName.trim() : '';
        const lastName = rawLastName ? rawLastName.trim() : '';
        const role = requestedRole ? requestedRole.trim().toLowerCase() : '';

        // Validate input (including role validation)
        const validation = validateUserInput({
            email,
            password,
            firstName,
            lastName,
            role,
            phone: phone ? phone.trim() : undefined,
            address: address ? address.trim() : undefined
        }, true); // true = admin creation mode

        if (!validation.valid) {
            // Audit log failed validation attempt
            console.warn('⚠️ Admin create-user validation failed', {
                adminId: adminUser.id,
                adminEmail: adminUser.email,
                attemptedEmail: email,
                attemptedRole: role,
                ip: clientIp,
                errors: validation.errors.length,
                timestamp: new Date().toISOString()
            });
            
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: validation.errors
            });
        }

        // Check if user already exists
        const existingUser = await db.getUserByEmail(email, false);
        if (existingUser) {
            console.warn('⚠️ Admin attempted to create user with existing email', {
                adminId: adminUser.id,
                adminEmail: adminUser.email,
                attemptedEmail: email,
                existingUserId: existingUser.id,
                existingUserActive: existingUser.is_active,
                ip: clientIp,
                timestamp: new Date().toISOString()
            });
            
            return res.status(409).json({
                success: false,
                error: 'Email already registered'
            });
        }

        // Hash password with bcrypt
        const bcrypt = require('bcryptjs');
        const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Create new user with validated data
        const newUser = await db.createUser({
            email,
            passwordHash,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            role, // validated role from admin
            organization: organization ? organization.trim() : 'Government',
            phone: phone ? phone.trim() : null,
            address: address ? address.trim() : null
        });

        // Audit log successful privileged account creation
        console.log('✅ Admin created privileged user account', {
            adminId: adminUser.id,
            adminEmail: adminUser.email,
            newUserId: newUser.id,
            newUserEmail: newUser.email,
            newUserRole: newUser.role,
            ip: clientIp,
            timestamp: new Date().toISOString()
        });

        // Return success (do not return password or sensitive data)
        res.status(201).json({
            success: true,
            message: 'User account created successfully',
            user: {
                id: newUser.id,
                email: newUser.email,
                firstName: newUser.first_name,
                lastName: newUser.last_name,
                role: newUser.role,
                organization: newUser.organization,
                emailVerified: newUser.email_verified,
                isActive: newUser.is_active
            }
        });

    } catch (error) {
        // Audit log error
        console.error('❌ Admin create-user error', {
            adminId: adminUser?.id,
            adminEmail: adminUser?.email,
            error: error.message,
            ip: clientIp,
            timestamp: new Date().toISOString()
        });

        // Check for unique constraint violation (defense-in-depth)
        if (error.code === '23505') {
            return res.status(409).json({
                success: false,
                error: 'Email already registered'
            });
        }

        res.status(500).json({
            success: false,
            error: 'Failed to create user account',
            message: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router;

