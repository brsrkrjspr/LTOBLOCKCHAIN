// TrustChain Notification Routes
const express = require('express');
const nodemailer = require('nodemailer');
const router = express.Router();

// Mock notification service (in production, use real email/SMS services)
class MockNotificationService {
    static async sendEmail(to, subject, message) {
        console.log(`Mock Email sent to: ${to}`);
        console.log(`Subject: ${subject}`);
        console.log(`Message: ${message}`);
        
        return {
            success: true,
            messageId: 'msg_' + Date.now(),
            timestamp: new Date().toISOString()
        };
    }

    static async sendSMS(to, message) {
        console.log(`Mock SMS sent to: ${to}`);
        console.log(`Message: ${message}`);
        
        return {
            success: true,
            messageId: 'sms_' + Date.now(),
            timestamp: new Date().toISOString()
        };
    }
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
            result = await MockNotificationService.sendEmail(recipient, subject || 'TrustChain Notification', message);
        } else if (type === 'sms') {
            result = await MockNotificationService.sendSMS(recipient, message);
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

        const result = await MockNotificationService.sendEmail(ownerEmail, subject, message);

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

        const result = await MockNotificationService.sendEmail(ownerEmail, subject, message);

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

        const previousOwnerResult = await MockNotificationService.sendEmail(previousOwnerEmail, previousOwnerSubject, previousOwnerMessage);
        const newOwnerResult = await MockNotificationService.sendEmail(newOwnerEmail, newOwnerSubject, newOwnerMessage);

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

        const result = await MockNotificationService.sendEmail(ownerEmail, subject, message);

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
router.get('/', authenticateToken, (req, res) => {
    try {
        // Return empty notifications array for now
        // In production, fetch from database based on req.user.userId
        res.json({
            success: true,
            notifications: []
        });
    } catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get notifications'
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

// Middleware to authenticate JWT token
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            success: false,
            error: 'Access token required'
        });
    }

    const jwt = require('jsonwebtoken');
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

module.exports = router;
