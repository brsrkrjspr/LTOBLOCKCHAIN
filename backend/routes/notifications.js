// TrustChain Notification Routes
const express = require('express');
const nodemailer = require('nodemailer');
const router = express.Router();
const db = require('../database/services');
const { authenticateToken } = require('../middleware/auth');

// Validate required environment variables
if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required. Set it in .env file.');
}

// Real email service - requires SMTP configuration
async function sendEmail(to, subject, message) {
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
        throw new Error('Email service not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS environment variables.');
    }
    
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });
    
    const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: to,
        subject: subject,
        text: message,
        html: message.replace(/\n/g, '<br>')
    });
    
    return {
        success: true,
        messageId: info.messageId,
        timestamp: new Date().toISOString()
    };
}

// SMS service - throw error if not implemented
async function sendSMS(to, message) {
    throw new Error('SMS service not implemented. Configure SMS provider in environment variables.');
}

// Send notification
router.post('/send', authenticateToken, async (req, res) => {
    try {
        const { type, recipient, subject, message, vehicleVin } = req.body;

        // Validate required fields
        if (!type || !recipient || !message) {
            return res.status(400).json({
                success: false,
                error: 'Type, recipient, and message are required'
            });
        }

        // Validate notification type
        const validTypes = ['email', 'sms'];
        if (!validTypes.includes(type)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid notification type'
            });
        }

        let result;

        if (type === 'email') {
            result = await sendEmail(recipient, subject || 'TrustChain Notification', message);
        } else if (type === 'sms') {
            result = await sendSMS(recipient, message);
        }

        // Log notification
        const notification = {
            id: 'NOTIF' + Date.now(),
            type,
            recipient,
            subject: subject || null,
            message,
            vehicleVin: vehicleVin || null,
            sentBy: req.user.userId,
            sentAt: new Date().toISOString(),
            status: 'SENT',
            messageId: result.messageId
        };

        res.json({
            success: true,
            message: 'Notification sent successfully',
            notification
        });

    } catch (error) {
        console.error('Send notification error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send notification'
        });
    }
});

// Send vehicle registration notification
router.post('/vehicle-registered', authenticateToken, async (req, res) => {
    try {
        const { vehicleVin, ownerEmail, ownerName, plateNumber } = req.body;

        if (!vehicleVin || !ownerEmail || !ownerName || !plateNumber) {
            return res.status(400).json({
                success: false,
                error: 'Vehicle information is required'
            });
        }

        const subject = 'Vehicle Registration Successful - TrustChain LTO';
        const message = `
Dear ${ownerName},

Your vehicle registration has been successfully submitted to the TrustChain LTO System.

Vehicle Details:
- VIN: ${vehicleVin}
- Plate Number: ${plateNumber}
- Registration Date: ${new Date().toLocaleDateString()}

Your registration is now being processed. You will receive updates on the verification status of your documents.

You can track your registration status by logging into your TrustChain account.

Thank you for using TrustChain LTO System.

Best regards,
LTO Lipa City Team
        `;

        const result = await sendEmail(ownerEmail, subject, message);

        res.json({
            success: true,
            message: 'Vehicle registration notification sent successfully',
            notification: {
                type: 'email',
                recipient: ownerEmail,
                subject,
                vehicleVin,
                sentAt: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Vehicle registration notification error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send vehicle registration notification'
        });
    }
});

// Send verification status notification
router.post('/verification-status', authenticateToken, async (req, res) => {
    try {
        const { vehicleVin, ownerEmail, ownerName, verificationType, status, notes } = req.body;

        if (!vehicleVin || !ownerEmail || !ownerName || !verificationType || !status) {
            return res.status(400).json({
                success: false,
                error: 'Verification information is required'
            });
        }

        const statusText = status === 'APPROVED' ? 'approved' : status === 'REJECTED' ? 'rejected' : 'pending';
        const subject = `Vehicle ${verificationType} Verification ${status} - TrustChain LTO`;
        
        const message = `
Dear ${ownerName},

Your vehicle's ${verificationType} verification has been ${statusText}.

Vehicle Details:
- VIN: ${vehicleVin}
- Verification Type: ${verificationType.toUpperCase()}
- Status: ${status}
- Date: ${new Date().toLocaleDateString()}

${notes ? `Notes: ${notes}` : ''}

${status === 'APPROVED' ? 
    'Your document has been verified and approved. You can proceed with the next steps in your registration process.' :
    status === 'REJECTED' ?
    'Your document has been rejected. Please review the notes above and resubmit the required documents.' :
    'Your document is currently being reviewed. You will be notified once the verification is complete.'
}

You can track your registration status by logging into your TrustChain account.

Thank you for using TrustChain LTO System.

Best regards,
LTO Lipa City Team
        `;

        const result = await sendEmail(ownerEmail, subject, message);

        res.json({
            success: true,
            message: 'Verification status notification sent successfully',
            notification: {
                type: 'email',
                recipient: ownerEmail,
                subject,
                vehicleVin,
                verificationType,
                status,
                sentAt: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Verification status notification error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send verification status notification'
        });
    }
});

// Send ownership transfer notification
router.post('/ownership-transfer', authenticateToken, async (req, res) => {
    try {
        const { vehicleVin, previousOwnerEmail, newOwnerEmail, previousOwnerName, newOwnerName, plateNumber } = req.body;

        if (!vehicleVin || !previousOwnerEmail || !newOwnerEmail || !previousOwnerName || !newOwnerName || !plateNumber) {
            return res.status(400).json({
                success: false,
                error: 'Ownership transfer information is required'
            });
        }

        // Send notification to previous owner
        const previousOwnerSubject = 'Vehicle Ownership Transferred - TrustChain LTO';
        const previousOwnerMessage = `
Dear ${previousOwnerName},

Your vehicle ownership has been successfully transferred.

Vehicle Details:
- VIN: ${vehicleVin}
- Plate Number: ${plateNumber}
- New Owner: ${newOwnerName}
- Transfer Date: ${new Date().toLocaleDateString()}

The ownership transfer has been recorded on the blockchain and is now complete.

Thank you for using TrustChain LTO System.

Best regards,
LTO Lipa City Team
        `;

        // Send notification to new owner
        const newOwnerSubject = 'Vehicle Ownership Received - TrustChain LTO';
        const newOwnerMessage = `
Dear ${newOwnerName},

You have received ownership of a vehicle through the TrustChain LTO System.

Vehicle Details:
- VIN: ${vehicleVin}
- Plate Number: ${plateNumber}
- Previous Owner: ${previousOwnerName}
- Transfer Date: ${new Date().toLocaleDateString()}

You are now the registered owner of this vehicle. You can access your vehicle information by logging into your TrustChain account.

Thank you for using TrustChain LTO System.

Best regards,
LTO Lipa City Team
        `;

        const previousOwnerResult = await sendEmail(previousOwnerEmail, previousOwnerSubject, previousOwnerMessage);
        const newOwnerResult = await sendEmail(newOwnerEmail, newOwnerSubject, newOwnerMessage);

        res.json({
            success: true,
            message: 'Ownership transfer notifications sent successfully',
            notifications: [
                {
                    type: 'email',
                    recipient: previousOwnerEmail,
                    subject: previousOwnerSubject,
                    vehicleVin,
                    sentAt: new Date().toISOString()
                },
                {
                    type: 'email',
                    recipient: newOwnerEmail,
                    subject: newOwnerSubject,
                    vehicleVin,
                    sentAt: new Date().toISOString()
                }
            ]
        });

    } catch (error) {
        console.error('Ownership transfer notification error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send ownership transfer notifications'
        });
    }
});

// Send document expiry notification
router.post('/document-expiry', authenticateToken, async (req, res) => {
    try {
        const { vehicleVin, ownerEmail, ownerName, documentType, expiryDate, plateNumber } = req.body;

        if (!vehicleVin || !ownerEmail || !ownerName || !documentType || !expiryDate || !plateNumber) {
            return res.status(400).json({
                success: false,
                error: 'Document expiry information is required'
            });
        }

        const subject = 'Document Expiry Reminder - TrustChain LTO';
        const message = `
Dear ${ownerName},

This is a reminder that one of your vehicle documents is expiring soon.

Vehicle Details:
- VIN: ${vehicleVin}
- Plate Number: ${plateNumber}
- Document Type: ${documentType.toUpperCase()}
- Expiry Date: ${new Date(expiryDate).toLocaleDateString()}

Please ensure you renew this document before the expiry date to avoid any issues with your vehicle registration.

You can submit your renewed documents through the TrustChain LTO System.

Thank you for using TrustChain LTO System.

Best regards,
LTO Lipa City Team
        `;

        const result = await sendEmail(ownerEmail, subject, message);

        res.json({
            success: true,
            message: 'Document expiry notification sent successfully',
            notification: {
                type: 'email',
                recipient: ownerEmail,
                subject,
                vehicleVin,
                documentType,
                expiryDate,
                sentAt: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Document expiry notification error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send document expiry notification'
        });
    }
});

// Get user notifications (for dashboard)
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { limit = 50, unreadOnly = false } = req.query;
        const userId = req.user.userId;

        const notifications = await db.getUserNotifications(
            userId,
            parseInt(limit),
            unreadOnly === 'true'
        );

        res.json({
            success: true,
            notifications: notifications.map(notif => ({
                id: notif.id,
                title: notif.title,
                message: notif.message,
                type: notif.type,
                read: notif.read,
                sentAt: notif.sent_at,
                readAt: notif.read_at
            }))
        });
    } catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get notifications'
        });
    }
});

// Mark notification as read
router.patch('/:id/read', authenticateToken, async (req, res) => {
    try {
        // Debug logging
        console.log('🔍 [BACKEND] Mark notification as read request received');
        console.log('🔍 [BACKEND] Request params:', req.params);
        console.log('🔍 [BACKEND] Request user:', {
            hasUser: !!req.user,
            userId: req.user?.userId,
            email: req.user?.email,
            role: req.user?.role,
            userObject: req.user
        });
        
        // Validate authentication
        if (!req.user) {
            console.error('❌ [BACKEND] req.user is undefined - authentication middleware failed');
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }
        
        // Validate userId
        const userId = req.user.userId || req.user.id || req.user.user_id;
        if (!userId) {
            console.error('❌ [BACKEND] userId not found in req.user:', req.user);
            return res.status(401).json({
                success: false,
                error: 'User ID not found in token'
            });
        }
        
        // Validate notification ID
        const notificationId = req.params.id;
        if (!notificationId) {
            console.error('❌ [BACKEND] Notification ID missing from params');
            return res.status(400).json({
                success: false,
                error: 'Notification ID is required'
            });
        }
        
        // Validate UUID format (if using UUIDs)
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(notificationId) && notificationId.length < 1) {
            console.warn('⚠️ [BACKEND] Notification ID format may be invalid:', notificationId);
        }
        
        console.log('🔍 [BACKEND] Attempting to mark notification as read:', {
            notificationId,
            userId,
            userIdType: typeof userId
        });
        
        // Check database connection
        if (!db || typeof db.query !== 'function') {
            console.error('❌ [BACKEND] Database connection not available');
            return res.status(500).json({
                success: false,
                error: 'Database connection error'
            });
        }
        
        // Update notification and verify ownership in single query
        const result = await db.query(
            `UPDATE notifications
             SET read = true, read_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND user_id = $2
             RETURNING *`,
            [notificationId, userId]
        );
        
        console.log('🔍 [BACKEND] Database query result:', {
            rowCount: result?.rows?.length || 0,
            hasRows: !!result?.rows,
            firstRow: result?.rows?.[0] || null
        });

        if (!result || !result.rows || result.rows.length === 0) {
            console.warn('⚠️ [BACKEND] Notification not found or access denied:', {
                notificationId,
                userId,
                searchedFor: { id: notificationId, user_id: userId }
            });
            
            // Check if notification exists at all (for better error message)
            const checkResult = await db.query(
                `SELECT id, user_id FROM notifications WHERE id = $1`,
                [notificationId]
            );
            
            if (checkResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Notification not found'
                });
            } else {
                return res.status(403).json({
                    success: false,
                    error: 'You do not have permission to mark this notification as read'
                });
            }
        }

        const notification = result.rows[0];
        
        console.log('✅ [BACKEND] Successfully marked notification as read:', {
            notificationId: notification.id,
            userId: notification.user_id,
            read: notification.read,
            readAt: notification.read_at
        });

        res.json({
            success: true,
            notification: {
                id: notification.id,
                title: notification.title,
                message: notification.message,
                type: notification.type,
                read: notification.read,
                sentAt: notification.sent_at,
                readAt: notification.read_at
            }
        });
    } catch (error) {
        console.error('❌ [BACKEND] Mark notification as read error:', error);
        console.error('❌ [BACKEND] Error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name,
            code: error.code
        });
        
        // Return specific error messages based on error type
        if (error.code === '23505') { // Unique violation
            return res.status(409).json({
                success: false,
                error: 'Notification already marked as read'
            });
        } else if (error.code === '23503') { // Foreign key violation
            return res.status(400).json({
                success: false,
                error: 'Invalid notification or user reference'
            });
        } else if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
            return res.status(503).json({
                success: false,
                error: 'Database connection failed. Please try again later.'
            });
        }
        
        res.status(500).json({
            success: false,
            error: 'Failed to mark notification as read',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Get notification history
router.get('/history', authenticateToken, (req, res) => {
    try {
        const { limit = 10, offset = 0, type, vehicleVin } = req.query;

        // Mock notification history
        const notifications = [
            {
                id: 'NOTIF001',
                type: 'email',
                recipient: 'owner@example.com',
                subject: 'Vehicle Registration Successful',
                vehicleVin: 'VIN123456789',
                sentBy: 'USR001',
                sentAt: '2024-01-15T10:30:00Z',
                status: 'SENT'
            },
            {
                id: 'NOTIF002',
                type: 'email',
                recipient: 'owner@example.com',
                subject: 'Insurance Verification Approved',
                vehicleVin: 'VIN123456789',
                sentBy: 'USR002',
                sentAt: '2024-01-16T14:20:00Z',
                status: 'SENT'
            }
        ];

        // Filter notifications
        let filteredNotifications = notifications;
        
        if (type) {
            filteredNotifications = filteredNotifications.filter(n => n.type === type);
        }
        
        if (vehicleVin) {
            filteredNotifications = filteredNotifications.filter(n => n.vehicleVin === vehicleVin);
        }

        // Apply pagination
        const paginatedNotifications = filteredNotifications.slice(offset, offset + parseInt(limit));

        res.json({
            success: true,
            notifications: paginatedNotifications,
            pagination: {
                total: filteredNotifications.length,
                limit: parseInt(limit),
                offset: parseInt(offset)
            }
        });

    } catch (error) {
        console.error('Get notification history error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get notification history'
        });
    }
});


// Export router as default (for backward compatibility with server.js)
module.exports = router;
// Also export functions so they can be imported by other routes
module.exports.sendEmail = sendEmail;
module.exports.sendSMS = sendSMS;
