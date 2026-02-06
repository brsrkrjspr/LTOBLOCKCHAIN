// TrustChain LTO - Admin Routes
// Enhanced admin statistics and management endpoints

const express = require('express');
const router = express.Router();
const db = require('../database/services');
const { authenticateToken } = require('../middleware/auth');
const { authorizeRole } = require('../middleware/authorize');
const dbModule = require('../database/db');
const { normalizeStatusLower } = require('../config/statusConstants');
const fabricService = require('../services/optimizedFabricService');

// Get enhanced admin statistics
// STRICT: Allow admin and lto_admin only (system stats are admin-level)
router.get('/stats', authenticateToken, authorizeRole(['admin', 'lto_admin']), async (req, res) => {
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
            registered: 0,
            approved: 0,
            rejected: 0
        };
        
        vehicleStats.rows.forEach(row => {
            vehicles.total += parseInt(row.count);
            const status = normalizeStatusLower(row.status);
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
            const status = normalizeStatusLower(row.status);
            // Map UNDER_REVIEW to reviewing for backward compatibility
            const mappedStatus = status === 'under_review' ? 'reviewing' : status;
            if (transfers.hasOwnProperty(mappedStatus)) {
                transfers[mappedStatus] = parseInt(row.count);
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
            insurance: { total: 0, pending: 0, approved: 0, rejected: 0 }
        };
        
        clearanceStats.rows.forEach(row => {
            clearances.total += parseInt(row.count);
            const type = normalizeStatusLower(row.request_type);
            const status = normalizeStatusLower(row.status);
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
            insurance_verifier: 0
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
// STRICT: Allow admin and lto_admin only (viewing all clearance requests is admin-level)
router.get('/clearance-requests', authenticateToken, authorizeRole(['admin', 'lto_admin']), async (req, res) => {
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
            insurance: requests.filter(r => r.request_type === 'insurance')
        };
        
        // Count by status for each type
        const stats = {
            hpg: { pending: 0, approved: 0, rejected: 0, completed: 0 },
            insurance: { pending: 0, approved: 0, rejected: 0, completed: 0 }
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
// STRICT: Allow admin, lto_admin, and lto_officer (all users can view their own notifications)
router.get('/notifications', authenticateToken, authorizeRole(['admin', 'lto_admin', 'lto_officer']), async (req, res) => {
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
        const validRoles = ['admin', 'insurance_verifier', 'hpg_admin', 'staff', 'vehicle_owner'];
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
// STRICT: Allow admin and lto_admin only (user management is admin-level)
router.post('/create-user', authenticateToken, authorizeRole(['admin', 'lto_admin']), async (req, res) => {
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

        // Enroll staff/org accounts in Fabric CA (NOT vehicle_owner public signups)
        // This is BLOCKING - staff accounts MUST have Fabric identities to interact with blockchain
        if (newUser.role !== 'vehicle_owner') {
            try {
                const fabricEnrollment = require('../services/fabricEnrollmentService');
                await fabricEnrollment.enrollUser(newUser.email, newUser.role);
                console.log(`✅ Enrolled ${newUser.email} (${newUser.role}) in Fabric CA`);
            } catch (enrollError) {
                // CRITICAL: Staff account creation failed Fabric enrollment
                // Log error but don't fail the request (account exists in Postgres)
                // Admin can retry enrollment manually if needed
                console.error(`❌ Failed to enroll ${newUser.email} in Fabric CA:`, enrollError.message);
                console.error('⚠️ Staff account created but Fabric enrollment failed. Manual enrollment may be required.');
            }
        }

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

// Get all users (admin only)
// STRICT: Allow admin and lto_admin only (viewing all users is admin-level)
router.get('/users', authenticateToken, authorizeRole(['admin', 'lto_admin']), async (req, res) => {
    try {
        const users = await db.getAllUsers();
        
        // Format users for frontend
        const formattedUsers = users.map(user => ({
            id: user.id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            fullName: `${user.first_name} ${user.last_name}`,
            role: user.role,
            organization: user.organization || 'N/A',
            phone: user.phone || 'N/A',
            address: user.address || 'N/A',
            isActive: user.is_active,
            emailVerified: user.email_verified,
            createdAt: user.created_at,
            lastLogin: user.last_login
        }));
        
        res.json({
            success: true,
            users: formattedUsers,
            count: formattedUsers.length
        });
        
    } catch (error) {
        console.error('Get all users error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch users',
            message: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Manual verification for insurance (admin only)
// STRICT: Allow admin and lto_admin only (manual verification is admin-level)
router.post('/verifications/manual-verify', authenticateToken, authorizeRole(['admin', 'lto_admin']), async (req, res) => {
    try {
        const { vehicleId, requestId, verificationType, decision, notes } = req.body;
        
        // Validate input
        if (!vehicleId || !requestId || !verificationType || !decision) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: vehicleId, requestId, verificationType, decision'
            });
        }
        
        if (!['insurance'].includes(verificationType)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid verification type. Must be insurance'
            });
        }
        
        if (!['APPROVED', 'REJECTED'].includes(decision)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid decision. Must be APPROVED or REJECTED'
            });
        }
        
        // Get existing verification to preserve auto-verification metadata
        const verifications = await db.getVehicleVerifications(vehicleId);
        const existingVerification = verifications.find(v => v.verification_type === verificationType);
        
        if (!existingVerification) {
            return res.status(404).json({
                success: false,
                error: 'Verification not found'
            });
        }
        
        if (existingVerification.status !== 'PENDING') {
            return res.status(400).json({
                success: false,
                error: `Verification is already ${existingVerification.status}. Cannot manually verify.`
            });
        }
        
        // Parse existing verification metadata
        let existingMetadata = {};
        if (existingVerification.verification_metadata) {
            try {
                existingMetadata = typeof existingVerification.verification_metadata === 'string'
                    ? JSON.parse(existingVerification.verification_metadata)
                    : existingVerification.verification_metadata;
            } catch (e) {
                console.warn('Failed to parse existing verification metadata:', e);
            }
        }
        
        // Merge manual review data into metadata
        const updatedMetadata = {
            ...existingMetadata,
            manualReview: {
                manualReviewed: true,
                manualReviewedBy: req.user.userId,
                manualReviewedAt: new Date().toISOString(),
                manualDecision: decision,
                manualNotes: notes || null,
                autoVerificationResult: existingMetadata.verificationResult || 'FAILED',
                autoVerificationScore: existingMetadata.verificationScore?.percentage || existingMetadata.verificationScore || existingVerification.verification_score || 0,
                autoFlagReasons: existingMetadata.flagReasons || []
            }
        };

        // Get vehicle for VIN (needed for blockchain update)
        const vehicle = await db.getVehicleById(vehicleId);
        if (!vehicle) {
            return res.status(404).json({
                success: false,
                error: 'Vehicle not found'
            });
        }

        // Update vehicle verification status
        await db.updateVerificationStatus(
            vehicleId,
            verificationType,
            decision,
            req.user.userId,
            notes || `Manually ${decision.toLowerCase()} after auto-verification review`,
            {
                automated: existingVerification.automated || false, // Keep original automated flag
                verificationScore: existingVerification.verification_score || 0,
                verificationMetadata: updatedMetadata
            }
        );

        // Update blockchain with audit trail
        try {
            await fabricService.updateVerificationStatus(
                vehicle.vin,
                'admin',  // Admin verification
                decision,
                notes || `Manually ${decision.toLowerCase()} after auto-verification review`
            );
            console.log(`[Admin Manual Verify] ✅ Blockchain audit trail updated for admin ${decision}: ${vehicle.vin}`);
        } catch (blockchainError) {
            console.error(`[Admin Manual Verify] ⚠️ Blockchain audit trail update failed (continuing):`, blockchainError.message);
        }

        // Update clearance request status
        const clearanceRequest = await db.getClearanceRequestById(requestId);
        if (clearanceRequest) {
            await db.updateClearanceRequestStatus(requestId, decision, {
                verifiedBy: req.user.userId,
                verifiedAt: new Date().toISOString(),
                notes: notes || `Manually ${decision.toLowerCase()} by admin after auto-verification review`,
                manualReview: true,
                autoVerificationMetadata: existingMetadata
            });
        }

        // Add to vehicle history (vehicle already fetched above)
        await db.addVehicleHistory({
            vehicleId: vehicleId,
            action: `${verificationType.toUpperCase()}_MANUAL_VERIFICATION`,
            description: `${verificationType} manually ${decision.toLowerCase()} by admin. Auto-verification score: ${updatedMetadata.manualReview.autoVerificationScore}%. ${notes || ''}`,
            performedBy: req.user.userId,
            metadata: {
                verificationType,
                decision,
                notes,
                autoVerificationScore: updatedMetadata.manualReview.autoVerificationScore,
                autoFlagReasons: updatedMetadata.manualReview.autoFlagReasons,
                manualReview: true,
                clearanceRequestId: requestId
            }
        });
        
        // Update transfer request if linked
        if (clearanceRequest) {
            try {
                const transferField = verificationType === 'insurance' ? 'insurance_clearance_request_id' : 'emission_clearance_request_id';
                const transferRequests = await dbModule.query(
                    `SELECT id FROM transfer_requests WHERE ${transferField} = $1`,
                    [requestId]
                );
                
                if (transferRequests.rows.length > 0) {
                    for (const tr of transferRequests.rows) {
                        const statusField = verificationType === 'insurance' ? 'insurance_approval_status' : 'emission_approval_status';
                        const approvedAtField = verificationType === 'insurance' ? 'insurance_approved_at' : 'emission_approved_at';
                        const approvedByField = verificationType === 'insurance' ? 'insurance_approved_by' : 'emission_approved_by';
                        
                        // Check if columns exist
                        const colCheck = await dbModule.query(`
                            SELECT column_name FROM information_schema.columns 
                            WHERE table_name = 'transfer_requests' 
                            AND column_name IN ($1, $2, $3)
                        `, [statusField, approvedAtField, approvedByField]);
                        
                        const hasStatus = colCheck.rows.some(r => r.column_name === statusField);
                        const hasApprovedAt = colCheck.rows.some(r => r.column_name === approvedAtField);
                        const hasApprovedBy = colCheck.rows.some(r => r.column_name === approvedByField);
                        
                        if (hasStatus && hasApprovedAt && hasApprovedBy) {
                            await dbModule.query(
                                `UPDATE transfer_requests 
                                 SET ${statusField} = $1,
                                     ${approvedAtField} = CURRENT_TIMESTAMP,
                                     ${approvedByField} = $2,
                                     updated_at = CURRENT_TIMESTAMP
                                 WHERE id = $3`,
                                [decision, req.user.userId, tr.id]
                            );
                        }
                    }
                }
            } catch (transferError) {
                console.warn('Error updating transfer request:', transferError);
                // Continue even if transfer update fails
            }
        }
        
        // Send email notification if document is rejected
        if (decision === 'REJECTED' && vehicle) {
            try {
                // Get owner information
                let ownerEmail = vehicle.owner_email;
                let ownerName = vehicle.owner_name || 'Vehicle Owner';
                
                // If owner_email is not available, try to get from users table
                if (!ownerEmail && vehicle.owner_id) {
                    try {
                        const ownerUser = await db.getUserById(vehicle.owner_id);
                        if (ownerUser) {
                            ownerEmail = ownerUser.email;
                            ownerName = ownerUser.first_name && ownerUser.last_name 
                                ? `${ownerUser.first_name} ${ownerUser.last_name}` 
                                : ownerUser.email || ownerName;
                        }
                    } catch (userError) {
                        console.warn('Could not fetch owner user:', userError);
                    }
                }
                
                if (ownerEmail) {
                    const gmailApiService = require('../services/gmailApiService');
                    const appUrl = process.env.APP_URL || 'http://localhost:3000';
                    const dashboardUrl = `${appUrl}/owner-dashboard.html`;
                    
                    const subject = `Document Verification Rejected - ${verificationType.toUpperCase()} - TrustChain LTO`;
                    const html = `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <h2 style="color: #d32f2f;">Document Verification Rejected</h2>
                            <p>Dear ${ownerName},</p>
                            <p>We regret to inform you that your ${verificationType.toUpperCase()} document verification has been <strong>rejected</strong>.</p>
                            
                            <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 1rem; margin: 1rem 0;">
                                <h3 style="margin-top: 0; color: #856404;">Vehicle Details</h3>
                                <p style="margin: 0.5rem 0;"><strong>VIN:</strong> ${vehicle.vin || 'N/A'}</p>
                                ${vehicle.plate_number ? `<p style="margin: 0.5rem 0;"><strong>Plate Number:</strong> ${vehicle.plate_number}</p>` : ''}
                                ${vehicle.make ? `<p style="margin: 0.5rem 0;"><strong>Make:</strong> ${vehicle.make}</p>` : ''}
                                ${vehicle.model ? `<p style="margin: 0.5rem 0;"><strong>Model:</strong> ${vehicle.model}</p>` : ''}
                            </div>
                            
                            <div style="background: #f8d7da; border-left: 4px solid #dc3545; padding: 1rem; margin: 1rem 0;">
                                <h3 style="margin-top: 0; color: #721c24;">Reason for Rejection</h3>
                                <p style="margin: 0; white-space: pre-wrap;">${notes || 'No specific reason provided. Please review your document and ensure it meets all requirements.'}</p>
                            </div>
                            
                            <div style="background: #e7f3ff; border-left: 4px solid #2196f3; padding: 1rem; margin: 1rem 0;">
                                <h3 style="margin-top: 0; color: #0d47a1;">What You Need to Do</h3>
                                <p>Please review the reason above and upload a corrected document:</p>
                                <ol>
                                    <li>Log into your TrustChain account</li>
                                    <li>Go to your vehicle dashboard</li>
                                    <li>Find the application with status "Rejected" or "Pending"</li>
                                    <li>Click the "Update Document" button next to the ${verificationType.toUpperCase()} document</li>
                                    <li>Upload the corrected document</li>
                                </ol>
                                <p style="margin-top: 1rem;">
                                    <a href="${dashboardUrl}" style="background: #2196f3; color: white; padding: 0.75rem 1.5rem; text-decoration: none; border-radius: 4px; display: inline-block;">Go to Dashboard</a>
                                </p>
                            </div>
                            
                            <p style="margin-top: 2rem; color: #666; font-size: 0.9rem;">
                                If you have any questions, please contact LTO Lipa City.
                            </p>
                            
                            <p style="margin-top: 1rem;">
                                Best regards,<br>
                                <strong>LTO Lipa City Team</strong>
                            </p>
                        </div>
                    `;
                    
                    const text = `
Document Verification Rejected - TrustChain LTO

Dear ${ownerName},

We regret to inform you that your ${verificationType.toUpperCase()} document verification has been REJECTED.

Vehicle Details:
- VIN: ${vehicle.vin || 'N/A'}
${vehicle.plate_number ? `- Plate Number: ${vehicle.plate_number}` : ''}
${vehicle.make ? `- Make: ${vehicle.make}` : ''}
${vehicle.model ? `- Model: ${vehicle.model}` : ''}

Reason for Rejection:
${notes || 'No specific reason provided. Please review your document and ensure it meets all requirements.'}

What You Need to Do:
1. Log into your TrustChain account
2. Go to your vehicle dashboard
3. Find the application with status "Rejected" or "Pending"
4. Click the "Update Document" button next to the ${verificationType.toUpperCase()} document
5. Upload the corrected document

Dashboard: ${dashboardUrl}

If you have any questions, please contact LTO Lipa City.

Best regards,
LTO Lipa City Team
                    `;
                    
                    await gmailApiService.sendMail({
                        to: ownerEmail,
                        subject,
                        text,
                        html
                    });
                    
                    console.log(`✅ Rejection email sent to ${ownerEmail} for ${verificationType} verification`);
                }
            } catch (emailError) {
                console.error('❌ Failed to send rejection email:', emailError);
                // Don't fail the request if email fails
            }
            
            // Create in-app notification
            if (vehicle && vehicle.owner_id) {
                try {
                    await db.createNotification({
                        userId: vehicle.owner_id,
                        title: `${verificationType.toUpperCase()} Document Rejected`,
                        message: `Your ${verificationType} document verification has been rejected. Reason: ${notes || 'No reason provided'}`,
                        type: 'error'
                    });
                    console.log(`✅ In-app notification created for vehicle owner ${vehicle.owner_id}`);
                } catch (notifError) {
                    console.error('❌ Failed to create in-app notification:', notifError);
                    // Don't fail the request if notification fails
                }
            }
        }
        
        res.json({
            success: true,
            message: `${verificationType} verification manually ${decision.toLowerCase()} successfully`,
            verification: {
                vehicleId,
                verificationType,
                status: decision,
                notes: notes || null,
                manualReview: updatedMetadata.manualReview
            }
        });
        
    } catch (error) {
        console.error('Error in manual verification:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process manual verification',
            message: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router;

