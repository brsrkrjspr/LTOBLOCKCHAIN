// TrustChain LTO - Transfer of Ownership Routes
// Handles transfer request management, approval, and verification

const express = require('express');
const router = express.Router();
const db = require('../database/services');
const { authenticateToken } = require('../middleware/auth');
const { authorizeRole } = require('../middleware/authorize');
const fabricService = require('../services/optimizedFabricService');
const docTypes = require('../config/documentTypes');
const jwt = require('jsonwebtoken');
const { sendMail } = require('../services/gmailApiService');

// Validate required environment variables
if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required. Set it in .env file.');
}

// Transfer invite token secret (uses JWT_SECRET if TRANSFER_INVITE_SECRET not set)
const INVITE_TOKEN_SECRET = process.env.TRANSFER_INVITE_SECRET || process.env.JWT_SECRET;

/**
 * Generate a short-lived transfer invite token that can be embedded in an email link.
 * Payload is minimal and validated against the database on use.
 */
function generateTransferInviteToken(transferRequestId, buyerEmail) {
    const payload = {
        type: 'transfer_invite',
        transferRequestId,
        buyerEmail
    };

    // 3 days is a reasonable default for completing a transfer
    return jwt.sign(payload, INVITE_TOKEN_SECRET, { expiresIn: '3d' });
}

/**
 * Validate a transfer invite token and return its payload.
 * Throws on invalid/expired tokens.
 */
function verifyTransferInviteToken(token) {
    const payload = jwt.verify(token, INVITE_TOKEN_SECRET);
    if (!payload || payload.type !== 'transfer_invite' || !payload.transferRequestId || !payload.buyerEmail) {
        throw new Error('Invalid transfer invite token');
    }
    return payload;
}

/**
 * Send transfer invite email to buyer with professional HTML template.
 */
async function sendTransferInviteEmail({ to, buyerName, sellerName, vehicle, inviteToken }) {
    const subject = 'Vehicle Ownership Transfer Request - TrustChain LTO';
    const confirmationUrl = `${process.env.APP_BASE_URL || 'https://ltoblockchain.duckdns.org'}/transfer-confirmation.html?token=${encodeURIComponent(inviteToken)}`;

    const safeBuyerName = buyerName || 'Buyer';
    const safeSellerName = sellerName || 'A vehicle owner';
    const vehicleLabel = vehicle
        ? `${vehicle.plate_number || vehicle.plateNumber || vehicle.vin}${vehicle.make || vehicle.model ? ` (${vehicle.make || ''} ${vehicle.model || ''})` : ''}`
        : 'a vehicle';

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f4f4f4;
        }
        .email-container {
            background-color: #ffffff;
            border-radius: 8px;
            padding: 30px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header {
            background: linear-gradient(135deg, #003A8C 0%, #005FCC 100%);
            color: white;
            padding: 20px;
            border-radius: 8px 8px 0 0;
            margin: -30px -30px 30px -30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
        }
        .content {
            color: #333333;
        }
        .vehicle-info {
            background-color: #f8f9fa;
            border-left: 4px solid #3498db;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .vehicle-info strong {
            color: #2c3e50;
        }
        .button-container {
            text-align: center;
            margin: 30px 0;
        }
        .button {
            display: inline-block;
            background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
            color: white;
            padding: 14px 28px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            font-size: 16px;
            box-shadow: 0 2px 4px rgba(52, 152, 219, 0.3);
            transition: transform 0.2s;
        }
        .button:hover {
            transform: translateY(-2px);
        }
        .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e9ecef;
            color: #7f8c8d;
            font-size: 14px;
            text-align: center;
        }
        .warning {
            background-color: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 12px;
            margin: 20px 0;
            border-radius: 4px;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <h1>🚗 Vehicle Ownership Transfer Request</h1>
        </div>
        <div class="content">
            <p>Dear ${escapeHtml(safeBuyerName)},</p>
            
            <p>${escapeHtml(safeSellerName)} has initiated a request to transfer ownership of a vehicle to you in the TrustChain LTO system.</p>
            
            <div class="vehicle-info">
                <strong>Vehicle Details:</strong><br>
                ${escapeHtml(vehicleLabel)}
            </div>
            
            <p>To review and accept this transfer request, please click the button below:</p>
            
            <div class="button-container">
                <a href="${confirmationUrl}" class="button">Review Transfer Request</a>
            </div>
            
            <div class="warning">
                <strong>⚠️ Important:</strong> If you did not expect this email, you can safely ignore it. No ownership change will happen unless you log in to your account and explicitly accept the transfer.
            </div>
            
            <p>This link will expire in 3 days for security purposes.</p>
        </div>
        <div class="footer">
            <p>Best regards,<br><strong>TrustChain LTO System</strong></p>
            <p style="font-size: 12px; color: #95a5a6;">This is an automated message. Please do not reply to this email.</p>
        </div>
    </div>
</body>
</html>
    `.trim();

    const text = `
Vehicle Ownership Transfer Request - TrustChain LTO

Dear ${safeBuyerName},

${safeSellerName} has initiated a request to transfer ownership of ${vehicleLabel} to you in the TrustChain LTO system.

To review and accept this transfer request, please visit:
${confirmationUrl}

If you did not expect this email, you can safely ignore it. No ownership change will happen unless you log in to your account and explicitly accept the transfer.

This link will expire in 3 days for security purposes.

Best regards,
TrustChain LTO System
`.trim();

    try {
        const result = await sendMail({ to, subject, text, html });
        console.log('✅ Transfer invite email sent via Gmail API:', {
            messageId: result.id,
            threadId: result.threadId,
            to,
            subject
        });
        return { success: true, messageId: result.id };
    } catch (error) {
        console.error('❌ Failed to send transfer invite email via Gmail API:', error);
        throw error;
    }
}

/**
 * Send email to seller when buyer accepts transfer request
 */
async function sendTransferBuyerAcceptanceEmail({ to, sellerName, buyerName, vehicle }) {
    const subject = 'Transfer Request Accepted by Buyer - TrustChain LTO';
    
    const safeSellerName = sellerName || 'Vehicle Owner';
    const safeBuyerName = buyerName || 'the buyer';
    const vehicleLabel = vehicle
        ? `${vehicle.plate_number || vehicle.plateNumber || vehicle.vin}${vehicle.make || vehicle.model ? ` (${vehicle.make || ''} ${vehicle.model || ''})` : ''}`
        : 'your vehicle';

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f4f4f4;
        }
        .email-container {
            background-color: #ffffff;
            border-radius: 8px;
            padding: 30px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header {
            background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%);
            color: white;
            padding: 20px;
            border-radius: 8px 8px 0 0;
            margin: -30px -30px 30px -30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
        }
        .content {
            color: #333333;
        }
        .vehicle-info {
            background-color: #f8f9fa;
            border-left: 4px solid #27ae60;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .info-box {
            background-color: #e8f5e9;
            border-left: 4px solid #27ae60;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e9ecef;
            color: #7f8c8d;
            font-size: 14px;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <h1>✅ Transfer Request Accepted</h1>
        </div>
        <div class="content">
            <p>Dear ${escapeHtml(safeSellerName)},</p>
            
            <p>Good news! ${escapeHtml(safeBuyerName)} has accepted your transfer request.</p>
            
            <div class="vehicle-info">
                <strong>Vehicle Details:</strong><br>
                ${escapeHtml(vehicleLabel)}
            </div>
            
            <div class="info-box">
                <strong>📋 Next Steps:</strong><br>
                Your transfer request is now under review by the LTO administration. The system will proceed with validation from the required organizations (Insurance, Emission Testing, and HPG clearance) before final approval.
            </div>
            
            <p>You will receive another notification once the LTO has completed their review and made a decision on your transfer request.</p>
        </div>
        <div class="footer">
            <p>Best regards,<br><strong>TrustChain LTO System</strong></p>
            <p style="font-size: 12px; color: #95a5a6;">This is an automated message. Please do not reply to this email.</p>
        </div>
    </div>
</body>
</html>
    `.trim();

    const text = `
Transfer Request Accepted by Buyer - TrustChain LTO

Dear ${safeSellerName},

Good news! ${safeBuyerName} has accepted your transfer request for ${vehicleLabel}.

Your transfer request is now under review by the LTO administration. The system will proceed with validation from the required organizations (Insurance, Emission Testing, and HPG clearance) before final approval.

You will receive another notification once the LTO has completed their review and made a decision on your transfer request.

Best regards,
TrustChain LTO System
`.trim();

    try {
        const result = await sendMail({ to, subject, text, html });
        console.log('✅ Buyer acceptance email sent to seller via Gmail API:', {
            messageId: result.id,
            threadId: result.threadId,
            to,
            subject
        });
        return { success: true, messageId: result.id };
    } catch (error) {
        console.error('❌ Failed to send buyer acceptance email to seller via Gmail API:', error);
        throw error;
    }
}

/**
 * Send email to seller when buyer rejects transfer request
 */
async function sendTransferBuyerRejectionEmail({ to, sellerName, buyerName, vehicle }) {
    const subject = 'Transfer Request Rejected by Buyer - TrustChain LTO';
    
    const safeSellerName = sellerName || 'Vehicle Owner';
    const safeBuyerName = buyerName || 'the buyer';
    const vehicleLabel = vehicle
        ? `${vehicle.plate_number || vehicle.plateNumber || vehicle.vin}${vehicle.make || vehicle.model ? ` (${vehicle.make || ''} ${vehicle.model || ''})` : ''}`
        : 'your vehicle';

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f4f4f4;
        }
        .email-container {
            background-color: #ffffff;
            border-radius: 8px;
            padding: 30px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header {
            background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
            color: white;
            padding: 20px;
            border-radius: 8px 8px 0 0;
            margin: -30px -30px 30px -30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
        }
        .content {
            color: #333333;
        }
        .vehicle-info {
            background-color: #f8f9fa;
            border-left: 4px solid #e74c3c;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .info-box {
            background-color: #ffebee;
            border-left: 4px solid #e74c3c;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e9ecef;
            color: #7f8c8d;
            font-size: 14px;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <h1>❌ Transfer Request Rejected</h1>
        </div>
        <div class="content">
            <p>Dear ${escapeHtml(safeSellerName)},</p>
            
            <p>We regret to inform you that ${escapeHtml(safeBuyerName)} has rejected your transfer request.</p>
            
            <div class="vehicle-info">
                <strong>Vehicle Details:</strong><br>
                ${escapeHtml(vehicleLabel)}
            </div>
            
            <div class="info-box">
                <strong>📋 What This Means:</strong><br>
                The transfer request has been cancelled and will not proceed further. No action is required from your side at this time.
            </div>
            
            <p>If you wish to transfer this vehicle to another buyer, you can submit a new transfer request through your TrustChain account.</p>
        </div>
        <div class="footer">
            <p>Best regards,<br><strong>TrustChain LTO System</strong></p>
            <p style="font-size: 12px; color: #95a5a6;">This is an automated message. Please do not reply to this email.</p>
        </div>
    </div>
</body>
</html>
    `.trim();

    const text = `
Transfer Request Rejected by Buyer - TrustChain LTO

Dear ${safeSellerName},

We regret to inform you that ${safeBuyerName} has rejected your transfer request for ${vehicleLabel}.

The transfer request has been cancelled and will not proceed further. No action is required from your side at this time.

If you wish to transfer this vehicle to another buyer, you can submit a new transfer request through your TrustChain account.

Best regards,
TrustChain LTO System
`.trim();

    try {
        const result = await sendMail({ to, subject, text, html });
        console.log('✅ Buyer rejection email sent to seller via Gmail API:', {
            messageId: result.id,
            threadId: result.threadId,
            to,
            subject
        });
        return { success: true, messageId: result.id };
    } catch (error) {
        console.error('❌ Failed to send buyer rejection email to seller via Gmail API:', error);
        throw error;
    }
}

// Helper function to escape HTML
function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * Send email to seller when transfer is completed/approved
 */
async function sendTransferCompletionEmail({ to, sellerName, buyerName, vehicle, transferRequest, newOwner, blockchainTxId }) {
    const subject = 'Vehicle Ownership Transfer Completed - TrustChain LTO';
    
    const safeSellerName = sellerName || 'Vehicle Owner';
    const safeBuyerName = buyerName || 'the buyer';
    
    // Build comprehensive vehicle details
    const vehicleDetails = [];
    if (vehicle) {
        if (vehicle.vin) vehicleDetails.push(`<strong>VIN:</strong> ${escapeHtml(vehicle.vin)}`);
        if (vehicle.plate_number || vehicle.plateNumber) vehicleDetails.push(`<strong>Plate Number:</strong> ${escapeHtml(vehicle.plate_number || vehicle.plateNumber)}`);
        if (vehicle.make) vehicleDetails.push(`<strong>Make:</strong> ${escapeHtml(vehicle.make)}`);
        if (vehicle.model) vehicleDetails.push(`<strong>Model:</strong> ${escapeHtml(vehicle.model)}`);
        if (vehicle.year) vehicleDetails.push(`<strong>Year:</strong> ${escapeHtml(vehicle.year.toString())}`);
        if (vehicle.color) vehicleDetails.push(`<strong>Color:</strong> ${escapeHtml(vehicle.color)}`);
        if (vehicle.engine_number) vehicleDetails.push(`<strong>Engine Number:</strong> ${escapeHtml(vehicle.engine_number)}`);
        if (vehicle.chassis_number) vehicleDetails.push(`<strong>Chassis Number:</strong> ${escapeHtml(vehicle.chassis_number)}`);
    }
    
    const vehicleDetailsHtml = vehicleDetails.length > 0 
        ? vehicleDetails.join('<br>')
        : 'Vehicle details not available';
    
    // Build buyer information
    const buyerInfo = [];
    if (newOwner) {
        if (newOwner.first_name && newOwner.last_name) {
            buyerInfo.push(`<strong>Name:</strong> ${escapeHtml(`${newOwner.first_name} ${newOwner.last_name}`)}`);
        }
        if (newOwner.email) {
            buyerInfo.push(`<strong>Email:</strong> ${escapeHtml(newOwner.email)}`);
        }
    } else if (safeBuyerName && safeBuyerName !== 'the buyer') {
        buyerInfo.push(`<strong>Name:</strong> ${escapeHtml(safeBuyerName)}`);
    }
    
    const buyerInfoHtml = buyerInfo.length > 0 
        ? buyerInfo.join('<br>')
        : 'Buyer information not available';
    
    // Build transfer details
    const transferDetails = [];
    const transferDate = transferRequest?.reviewed_at || transferRequest?.updated_at || new Date().toISOString();
    transferDetails.push(`<strong>Transfer Date:</strong> ${escapeHtml(new Date(transferDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }))}`);
    if (transferRequest?.id) {
        transferDetails.push(`<strong>Transfer Request ID:</strong> ${escapeHtml(transferRequest.id.substring(0, 8))}...`);
    }
    if (blockchainTxId) {
        transferDetails.push(`<strong>Blockchain Transaction ID:</strong> ${escapeHtml(blockchainTxId)}`);
    }
    
    const transferDetailsHtml = transferDetails.join('<br>');

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f4f4f4;
        }
        .email-container {
            background-color: #ffffff;
            border-radius: 8px;
            padding: 30px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header {
            background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%);
            color: white;
            padding: 20px;
            border-radius: 8px 8px 0 0;
            margin: -30px -30px 30px -30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
        }
        .content {
            color: #333333;
        }
        .vehicle-info {
            background-color: #f8f9fa;
            border-left: 4px solid #27ae60;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .buyer-info {
            background-color: #e8f5e9;
            border-left: 4px solid #27ae60;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .transfer-info {
            background-color: #e3f2fd;
            border-left: 4px solid #2196f3;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .info-box {
            background-color: #e8f5e9;
            border-left: 4px solid #27ae60;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e9ecef;
            color: #7f8c8d;
            font-size: 14px;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <h1>✅ Vehicle Ownership Transfer Completed</h1>
        </div>
        <div class="content">
            <p>Dear ${escapeHtml(safeSellerName)},</p>
            
            <p>We are pleased to inform you that your vehicle ownership transfer has been successfully completed and approved by the LTO administration.</p>
            
            <div class="vehicle-info">
                <strong>Vehicle Details:</strong><br>
                ${vehicleDetailsHtml}
            </div>
            
            <div class="buyer-info">
                <strong>New Owner Information:</strong><br>
                ${buyerInfoHtml}
            </div>
            
            <div class="transfer-info">
                <strong>Transfer Details:</strong><br>
                ${transferDetailsHtml}
            </div>
            
            <div class="info-box">
                <strong>📋 Important Information:</strong><br>
                The ownership transfer has been recorded on the blockchain and is now complete. You are no longer the registered owner of this vehicle. The new owner can now access and manage this vehicle through their TrustChain LTO account.
            </div>
            
            <p>Thank you for using the TrustChain LTO System. If you have any questions or concerns, please contact our support team.</p>
        </div>
        <div class="footer">
            <p>Best regards,<br><strong>TrustChain LTO System</strong></p>
            <p style="font-size: 12px; color: #95a5a6;">This is an automated message. Please do not reply to this email.</p>
        </div>
    </div>
</body>
</html>
    `.trim();

    // Build text version
    const textDetails = [];
    if (vehicle) {
        if (vehicle.vin) textDetails.push(`VIN: ${vehicle.vin}`);
        if (vehicle.plate_number || vehicle.plateNumber) textDetails.push(`Plate Number: ${vehicle.plate_number || vehicle.plateNumber}`);
        if (vehicle.make) textDetails.push(`Make: ${vehicle.make}`);
        if (vehicle.model) textDetails.push(`Model: ${vehicle.model}`);
        if (vehicle.year) textDetails.push(`Year: ${vehicle.year}`);
        if (vehicle.color) textDetails.push(`Color: ${vehicle.color}`);
        if (vehicle.engine_number) textDetails.push(`Engine Number: ${vehicle.engine_number}`);
        if (vehicle.chassis_number) textDetails.push(`Chassis Number: ${vehicle.chassis_number}`);
    }
    
    const buyerTextInfo = [];
    if (newOwner) {
        if (newOwner.first_name && newOwner.last_name) {
            buyerTextInfo.push(`Name: ${newOwner.first_name} ${newOwner.last_name}`);
        }
        if (newOwner.email) {
            buyerTextInfo.push(`Email: ${newOwner.email}`);
        }
    } else if (safeBuyerName && safeBuyerName !== 'the buyer') {
        buyerTextInfo.push(`Name: ${safeBuyerName}`);
    }
    
    const transferTextDetails = [];
    transferTextDetails.push(`Transfer Date: ${new Date(transferDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`);
    if (transferRequest?.id) {
        transferTextDetails.push(`Transfer Request ID: ${transferRequest.id.substring(0, 8)}...`);
    }
    if (blockchainTxId) {
        transferTextDetails.push(`Blockchain Transaction ID: ${blockchainTxId}`);
    }

    const text = `
Vehicle Ownership Transfer Completed - TrustChain LTO

Dear ${safeSellerName},

We are pleased to inform you that your vehicle ownership transfer has been successfully completed and approved by the LTO administration.

Vehicle Details:
${textDetails.length > 0 ? textDetails.join('\n') : 'Vehicle details not available'}

New Owner Information:
${buyerTextInfo.length > 0 ? buyerTextInfo.join('\n') : 'Buyer information not available'}

Transfer Details:
${transferTextDetails.join('\n')}

Important Information:
The ownership transfer has been recorded on the blockchain and is now complete. You are no longer the registered owner of this vehicle. The new owner can now access and manage this vehicle through their TrustChain LTO account.

Thank you for using the TrustChain LTO System. If you have any questions or concerns, please contact our support team.

Best regards,
TrustChain LTO System
`.trim();

    try {
        const result = await sendMail({ to, subject, text, html });
        console.log('✅ Transfer completion email sent to seller via Gmail API:', {
            messageId: result.id,
            threadId: result.threadId,
            to,
            subject
        });
        return { success: true, messageId: result.id };
    } catch (error) {
        console.error('❌ Failed to send transfer completion email to seller via Gmail API:', error);
        throw error;
    }
}

// Create transfer request (owner submits)
// NEW: Accepts explicit document roles in documents object and buyerEmail (Option A - email invite)
// LEGACY: Still supports documentIds array and buyerId/buyerInfo for backward compatibility
router.post('/requests', authenticateToken, authorizeRole(['vehicle_owner', 'admin']), async (req, res) => {
    try {
        const {
            vehicleId,
            buyerId,
            buyerInfo,
            buyerEmail,
            buyerName,
            buyerPhone,
            documentIds,
            documents
        } = req.body;
        
        if (!vehicleId) {
            return res.status(400).json({
                success: false,
                error: 'Vehicle ID is required'
            });
        }
        
        // NEW: Only require buyer email (simplified workflow)
        if (!buyerEmail && !buyerId) {
            return res.status(400).json({
                success: false,
                error: 'Buyer email is required'
            });
        }
        
        // Get vehicle
        const vehicle = await db.getVehicleById(vehicleId);
        if (!vehicle) {
            return res.status(404).json({
                success: false,
                error: 'Vehicle not found'
            });
        }
        
        // Check if user is the owner (unless admin)
        if (req.user.role !== 'admin' && String(vehicle.owner_id) !== String(req.user.userId)) {
            return res.status(403).json({
                success: false,
                error: 'You can only create transfer requests for your own vehicles'
            });
        }
        
        // Prevent seller from transferring to themselves
        if (buyerEmail && buyerEmail.toLowerCase() === req.user.email.toLowerCase()) {
            return res.status(400).json({
                success: false,
                error: 'You cannot transfer ownership to yourself. Please enter a different buyer email address.'
            });
        }
        
        // Validate seller profile - ensure seller has complete profile information
        const seller = await db.getUserById(req.user.userId);
        if (!seller) {
            return res.status(404).json({
                success: false,
                error: 'Seller account not found'
            });
        }
        
        if (!seller.first_name || !seller.last_name) {
            return res.status(400).json({
                success: false,
                error: 'Seller profile incomplete. Please update your profile with first name and last name before creating transfer requests.',
                requiresProfileUpdate: true
            });
        }
        
        // Check if there's already a pending transfer request for this vehicle
        let existingRequests = [];
        try {
            existingRequests = await db.getTransferRequests({ vehicleId, status: 'PENDING' });
        } catch (checkError) {
            console.warn('⚠️ Error checking existing requests (continuing anyway):', checkError.message);
            // Continue - don't block transfer creation if check fails
        }
        if (existingRequests.length > 0) {
            return res.status(409).json({
                success: false,
                error: 'A pending transfer request already exists for this vehicle',
                existingRequestId: existingRequests[0].id
            });
        }

        // Resolve buyer identity based on buyerEmail (email-only workflow)
        let resolvedBuyerId = buyerId || null;
        let resolvedBuyerInfo = null;

        // Email-based lookup - if buyer has account, use it; otherwise store email for later
        if (!resolvedBuyerId && buyerEmail) {
            try {
                const existingBuyer = await db.getUserByEmail(buyerEmail);
                if (existingBuyer) {
                    // Buyer has account - use their account info
                    resolvedBuyerId = existingBuyer.id;
                    // Store buyer info from their account (real data, no placeholders)
                        resolvedBuyerInfo = {
                            email: buyerEmail,
                            firstName: existingBuyer.first_name,
                            lastName: existingBuyer.last_name,
                        phone: existingBuyer.phone || null
                        };
                } else {
                    // Buyer doesn't have account yet - store email only
                    // Name/phone will be collected when buyer accepts or registers
                    resolvedBuyerInfo = {
                        email: buyerEmail
                    };
                }
            } catch (lookupError) {
                console.error('❌ Buyer email lookup failed:', lookupError);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to verify buyer information',
                    message: lookupError.message
                });
            }
        }
        
        // Create transfer request
        let transferRequest;
        try {
            transferRequest = await db.createTransferRequest({
            vehicleId,
            sellerId: req.user.userId,
            buyerId: resolvedBuyerId || null,
            buyerInfo: resolvedBuyerInfo || null,
            metadata: {}
        });
            console.log('✅ Transfer request created successfully:', transferRequest.id);
        } catch (createError) {
            console.error('❌ Failed to create transfer request:', createError);
            console.error('Create error details:', {
                message: createError.message,
                stack: createError.stack,
                vehicleId,
                sellerId: req.user.userId,
                buyerId: resolvedBuyerId,
                hasBuyerInfo: !!resolvedBuyerInfo
            });
            throw createError;
        }
        
        // Link documents - NEW: Support explicit document roles, LEGACY: Support documentIds array
        const dbModule = require('../database/db');
        
        try {
        // NEW APPROACH: Explicit document roles (preferred)
        if (documents && typeof documents === 'object') {
            console.log('📋 Linking transfer documents with explicit roles:', {
                transferRequestId: transferRequest.id,
                vehicleId,
                sellerId: req.user.userId,
                documents: Object.keys(documents)
            });
            
            // Expected structure: { deedOfSale: "<docId>", sellerId: "<docId>", buyerId: "<docId>", orCr: "<docId>" }
            const documentRoleMap = {
                'deedOfSale': docTypes.TRANSFER_ROLES.DEED_OF_SALE,
                'deed_of_sale': docTypes.TRANSFER_ROLES.DEED_OF_SALE,
                'sellerId': docTypes.TRANSFER_ROLES.SELLER_ID,
                'seller_id': docTypes.TRANSFER_ROLES.SELLER_ID,
                'buyerId': docTypes.TRANSFER_ROLES.BUYER_ID,
                'buyer_id': docTypes.TRANSFER_ROLES.BUYER_ID,
                'orCr': docTypes.TRANSFER_ROLES.OR_CR,
                'or_cr': docTypes.TRANSFER_ROLES.OR_CR,
                'registrationCert': docTypes.TRANSFER_ROLES.OR_CR, // Legacy: registration cert = OR/CR
                'registration_cert': docTypes.TRANSFER_ROLES.OR_CR
            };
            
            for (const [roleKey, docId] of Object.entries(documents)) {
                if (!docId) continue; // Skip empty values
                
                // Map role key to transfer role
                const transferRole = documentRoleMap[roleKey];
                if (!transferRole) {
                    console.warn('⚠️ Unknown document role key:', { roleKey, docId });
                    continue;
                }
                
                // Validate document exists
                const document = await db.getDocumentById(docId);
                if (!document) {
                    console.warn('⚠️ Document not found for transfer:', { docId, roleKey });
                    continue;
                }
                
                // Validate transfer role
                if (!docTypes.isValidTransferRole(transferRole)) {
                    console.warn('⚠️ Invalid transfer role:', { roleKey, transferRole });
                    continue;
                }
                
                // Link document with explicit role (check if already exists first)
                const existingDoc = await dbModule.query(
                    `SELECT id FROM transfer_documents 
                     WHERE transfer_request_id = $1 AND document_id = $2 AND document_type = $3`,
                    [transferRequest.id, docId, transferRole]
                );
                
                if (existingDoc.rows.length === 0) {
                    await dbModule.query(
                        `INSERT INTO transfer_documents (transfer_request_id, document_type, document_id, uploaded_by)
                         VALUES ($1, $2, $3, $4)`,
                        [transferRequest.id, transferRole, docId, req.user.userId]
                    );
                }
                
                console.log('✅ Linked transfer document:', {
                    transferRequestId: transferRequest.id,
                    role: transferRole,
                    documentId: docId
                });
            }
        }
        // LEGACY APPROACH: Infer document types from documentIds array (backward compatibility)
        else if (documentIds && Array.isArray(documentIds) && documentIds.length > 0) {
            console.log('📋 Linking transfer documents (legacy mode):', {
                transferRequestId: transferRequest.id,
                documentCount: documentIds.length,
                note: 'Using legacy inference - consider migrating to explicit document roles'
            });
            
            for (const docId of documentIds) {
                // Determine document type from document (legacy inference)
                const document = await db.getDocumentById(docId);
                if (document) {
                    let docType = null;
                    if (document.document_type === 'owner_id') {
                        // Check if it's seller or buyer ID based on uploader (legacy inference)
                        docType = String(document.uploaded_by) === String(req.user.userId) 
                            ? docTypes.TRANSFER_ROLES.SELLER_ID 
                            : docTypes.TRANSFER_ROLES.BUYER_ID;
                    } else if (document.document_type === 'registration_cert') {
                        docType = docTypes.TRANSFER_ROLES.OR_CR;
                    } else if (document.document_type === 'deed_of_sale') {
                        docType = docTypes.TRANSFER_ROLES.DEED_OF_SALE;
                    }
                    
                    // Only insert if we have a valid transfer role
                    if (docType && docTypes.isValidTransferRole(docType)) {
                        // Check if already exists
                        const existingDoc = await dbModule.query(
                            `SELECT id FROM transfer_documents 
                             WHERE transfer_request_id = $1 AND document_id = $2 AND document_type = $3`,
                            [transferRequest.id, docId, docType]
                        );
                        
                        if (existingDoc.rows.length === 0) {
                            await dbModule.query(
                                `INSERT INTO transfer_documents (transfer_request_id, document_type, document_id, uploaded_by)
                                 VALUES ($1, $2, $3, $4)`,
                                [transferRequest.id, docType, docId, req.user.userId]
                            );
                        }
                    } else {
                        console.warn('⚠️ Could not determine transfer role for document:', { 
                            docId, 
                            documentType: document.document_type 
                        });
                    }
                }
            }
        }
        } catch (docLinkError) {
            // Don't fail the whole request if document linking fails
            console.error('⚠️ Error linking documents (transfer request still created):', docLinkError);
            console.error('Document linking error details:', docLinkError.message, docLinkError.stack);
        }
        
        // Log transfer request creation
        console.log('✅ Transfer request created:', {
            transferRequestId: transferRequest.id,
            vehicleId,
            sellerId: req.user.userId,
            buyerId: resolvedBuyerId || 'new_user',
            documentCount: documents ? Object.keys(documents).length : (documentIds?.length || 0),
            mode: documents ? 'explicit_roles' : 'legacy_inference'
        });
        
        // Add to vehicle history
        await db.addVehicleHistory({
            vehicleId,
            action: 'TRANSFER_REQUESTED',
            description: `Transfer request submitted by ${req.user.email}`,
            performedBy: req.user.userId,
            transactionId: null,
            metadata: { transferRequestId: transferRequest.id }
        });

        // Send email invite to buyer - use real seller and buyer names from database
        if (buyerEmail) {
            try {
                const inviteToken = generateTransferInviteToken(transferRequest.id, buyerEmail);
                
                // Get buyer name from database if buyer has account, otherwise use email
                let buyerDisplayName = buyerEmail;
                if (resolvedBuyerId && resolvedBuyerInfo) {
                    if (resolvedBuyerInfo.firstName && resolvedBuyerInfo.lastName) {
                        buyerDisplayName = `${resolvedBuyerInfo.firstName} ${resolvedBuyerInfo.lastName}`;
                    } else if (resolvedBuyerInfo.firstName) {
                        buyerDisplayName = resolvedBuyerInfo.firstName;
                    }
                }
                
                // Get seller full name from database (already fetched above)
                const sellerFullName = seller 
                    ? `${seller.first_name || ''} ${seller.last_name || ''}`.trim() || seller.email
                    : req.user.email;
                
                await sendTransferInviteEmail({
                    to: buyerEmail,
                    buyerName: buyerDisplayName,
                    sellerName: sellerFullName,
                    vehicle,
                    inviteToken
                });
                
                console.log('✅ Transfer invite email sent to buyer:', {
                    buyerEmail: buyerEmail,
                    buyerName: buyerDisplayName,
                    sellerName: sellerFullName
                });
                
                // Create in-app notification for buyer if they have an account
                if (resolvedBuyerId) {
                    try {
                        await db.createNotification({
                            userId: resolvedBuyerId,
                            title: 'New Transfer Request',
                            message: `${sellerFullName} has requested to transfer vehicle ${vehicle.plate_number || vehicle.plateNumber || vehicle.vin} to you. Please review and accept or reject the request.`,
                            type: 'info'
                        });
                        console.log('✅ Created notification for buyer:', resolvedBuyerId);
                    } catch (notifError) {
                        console.warn('⚠️ Failed to create buyer notification:', notifError.message);
                    }
                }
            } catch (inviteError) {
                // Log error but don't fail the request - email is important but not critical
                console.error('❌ Failed to send transfer invite email:', inviteError);
                console.error('Email error details:', {
                    buyerEmail: buyerEmail,
                    error: inviteError.message,
                    stack: inviteError.stack
                });
                // Continue - request is created, buyer can still access via notifications or direct link
            }
        }
        
        // Get full request with relations
        let fullRequest;
        try {
            fullRequest = await db.getTransferRequestById(transferRequest.id);
        } catch (fetchError) {
            console.warn('⚠️ Error fetching full request details (returning basic info):', fetchError.message);
            // Return basic request info if full fetch fails
            fullRequest = {
                ...transferRequest,
                buyer_info: resolvedBuyerInfo,
                vehicle: {
                    id: vehicle.id,
                    vin: vehicle.vin,
                    plate_number: vehicle.plate_number,
                    make: vehicle.make,
                    model: vehicle.model,
                    year: vehicle.year
                }
            };
        }
        
        res.status(201).json({
            success: true,
            message: 'Transfer request created successfully',
            transferRequest: fullRequest
        });
        
    } catch (error) {
        console.error('Create transfer request error:', error);
        console.error('Error stack:', error.stack);
        console.error('Request body:', JSON.stringify(req.body, null, 2));
        console.error('User:', { userId: req.user?.userId, email: req.user?.email, role: req.user?.role });
        
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: process.env.NODE_ENV === 'development' ? error.message : 'Failed to create transfer request',
            details: process.env.NODE_ENV === 'development' ? {
                stack: error.stack,
                requestBody: req.body
            } : undefined
        });
    }
});

// Get transfer requests where the current user is the intended buyer
// Matches on buyer_id or buyer_info.email, and limits to active statuses.
router.get('/requests/pending-for-buyer', authenticateToken, authorizeRole(['vehicle_owner', 'admin']), async (req, res) => {
    try {
        const userId = req.user.userId;
        const userEmail = req.user.email;
        const dbModule = require('../database/db');

        const result = await dbModule.query(
            `
            SELECT tr.*,
                   v.vin, v.plate_number, v.make, v.model, v.year,
                   seller.first_name || ' ' || seller.last_name as seller_name,
                   seller.email as seller_email
            FROM transfer_requests tr
            JOIN vehicles v ON tr.vehicle_id = v.id
            JOIN users seller ON tr.seller_id = seller.id
            WHERE
                (tr.buyer_id = $1 OR (tr.buyer_id IS NULL AND ((tr.buyer_info::jsonb)->>'email') = $2))
                AND tr.status IN ('PENDING', 'REVIEWING')
            ORDER BY tr.created_at DESC
            `,
            [userId, userEmail]
        );

        const requests = result.rows.map(row => {
            // Extract vehicle fields and create nested vehicle object
            const vehicle = {
                id: row.vehicle_id,
                vin: row.vin,
                plate_number: row.plate_number,
                plateNumber: row.plate_number, // Support both naming conventions
                make: row.make,
                model: row.model,
                year: row.year
            };
            
            // Remove vehicle fields from the main object to avoid duplication
            const { vin, plate_number, make, model, year, ...transferRequest } = row;
            
            return {
                ...transferRequest,
                vehicle: vehicle, // Nested vehicle object for frontend compatibility
                buyer_info: row.buyer_info ? (typeof row.buyer_info === 'string' ? JSON.parse(row.buyer_info) : row.buyer_info) : null,
                metadata: row.metadata ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) : {}
            };
        });

        res.json({
            success: true,
            requests
        });
    } catch (error) {
        console.error('Get pending transfer requests for buyer error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Buyer accepts a transfer request (handshake step)
router.post('/requests/:id/accept', authenticateToken, authorizeRole(['vehicle_owner', 'admin']), async (req, res) => {
    try {
        const { id } = req.params;

        const request = await db.getTransferRequestById(id);
        if (!request) {
            return res.status(404).json({
                success: false,
                error: 'Transfer request not found'
            });
        }

        // Only allow acceptance when request is still pending from LTO perspective
        if (request.status !== 'PENDING' && request.status !== 'REVIEWING') {
            return res.status(400).json({
                success: false,
                error: `Cannot accept request with status: ${request.status}`
            });
        }

        const currentUserId = req.user.userId;
        const currentUserEmail = req.user.email;

        const buyerInfo = request.buyer_info;
        // Check buyer_id from database row or buyer_user_id from JOIN
        const buyerId = request.buyer_id || request.buyer_user_id;
        const isDesignatedBuyerById = buyerId && String(buyerId) === String(currentUserId);
        const isDesignatedBuyerByEmail = !buyerId && buyerInfo && buyerInfo.email && buyerInfo.email.toLowerCase() === currentUserEmail.toLowerCase();

        if (!isDesignatedBuyerById && !isDesignatedBuyerByEmail) {
            return res.status(403).json({
                success: false,
                error: 'You are not the designated buyer for this transfer request'
            });
        }

        const dbModule = require('../database/db');

        // If buyer_id is not yet set but email matches, bind this user as the buyer
        if (!buyerId && isDesignatedBuyerByEmail) {
            await dbModule.query(
                `UPDATE transfer_requests
                 SET buyer_id = $1,
                     buyer_info = jsonb_set(COALESCE(buyer_info, '{}'::jsonb), '{email}', to_jsonb($2::text), true),
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $3`,
                [currentUserId, currentUserEmail, id]
            );
            
            // Create notification for buyer now that account is linked
            // Get seller and vehicle info for notification message
            const sellerName = request.seller_first_name && request.seller_last_name
                ? `${request.seller_first_name} ${request.seller_last_name}`
                : request.seller_email;
            const vehicle = await db.getVehicleById(request.vehicle_id);
            const vehicleLabel = vehicle?.plate_number || vehicle?.vin || 'a vehicle';
            
            try {
                await db.createNotification({
                    userId: currentUserId,
                    title: 'New Transfer Request',
                    message: `${sellerName} has requested to transfer vehicle ${vehicleLabel} to you. Please review and accept or reject the request.`,
                    type: 'info'
                });
                console.log('✅ Created notification for buyer after account linking:', currentUserId);
            } catch (notifError) {
                console.warn('⚠️ Failed to create buyer notification after linking:', notifError.message);
                // Don't fail the request if notification fails
            }
        }

        // Update status to REVIEWING to indicate that buyer has accepted and LTO review is next
        const metadataUpdate = {
            buyerAcceptedAt: new Date().toISOString(),
            buyerAcceptedBy: currentUserId
        };
        
        await db.updateTransferRequestStatus(id, 'REVIEWING', null, null, metadataUpdate);

        // Get vehicle information for email
        let vehicle = null;
        try {
            vehicle = await db.getVehicleById(request.vehicle_id);
            if (!vehicle) {
                console.warn(`Vehicle not found: ${request.vehicle_id}`);
            }
        } catch (vehicleError) {
            console.error('Failed to get vehicle:', vehicleError);
            // Don't fail the request if vehicle lookup fails - continue with null vehicle
        }
        
        // Get seller information
        const sellerEmail = request.seller_email;
        const sellerName = request.seller_first_name && request.seller_last_name
            ? `${request.seller_first_name} ${request.seller_last_name}`
            : request.seller_email;
        
        // Get buyer name for email
        const buyerName = request.buyer_first_name && request.buyer_last_name
            ? `${request.buyer_first_name} ${request.buyer_last_name}`
            : (request.buyer_email || currentUserEmail);

        // Send email notification to seller
        if (sellerEmail) {
            try {
                await sendTransferBuyerAcceptanceEmail({
                    to: sellerEmail,
                    sellerName: sellerName,
                    buyerName: buyerName,
                    vehicle: vehicle
                });
                console.log('✅ Buyer acceptance email sent to seller:', sellerEmail);
            } catch (emailError) {
                console.error('❌ Failed to send buyer acceptance email to seller:', emailError);
                // Don't fail the request if email fails
            }
        }

        // Create in-app notification for seller
        try {
            await db.createNotification({
                userId: request.seller_id,
                title: 'Transfer Request Accepted by Buyer',
                message: `${buyerName} has accepted your transfer request for vehicle ${vehicle?.plate_number || vehicle?.vin || 'your vehicle'}. The request is now under LTO review.`,
                type: 'success'
            });
            console.log('✅ Created notification for seller about buyer acceptance');
        } catch (notifError) {
            console.warn('⚠️ Failed to create seller notification:', notifError.message);
        }

        const updatedRequest = await db.getTransferRequestById(id);

        res.json({
            success: true,
            message: 'Transfer request accepted. Awaiting LTO review.',
            transferRequest: updatedRequest
        });
    } catch (error) {
        const transferRequestId = req.params?.id || 'unknown';
        console.error('Buyer accept transfer request error:', {
            error: error.message,
            stack: error.stack,
            transferRequestId: transferRequestId,
            userId: req.user?.userId,
            userEmail: req.user?.email,
            requestData: request ? {
                vehicle_id: request.vehicle_id,
                seller_id: request.seller_id,
                buyer_id: request.buyer_id,
                status: request.status
            } : null
        });
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: process.env.NODE_ENV === 'development' ? error.message : 'Failed to accept transfer request'
        });
    }
});

// Buyer rejects a transfer request
router.post('/requests/:id/reject-by-buyer', authenticateToken, authorizeRole(['vehicle_owner', 'admin']), async (req, res) => {
    try {
        const { id } = req.params;

        const request = await db.getTransferRequestById(id);
        if (!request) {
            return res.status(404).json({
                success: false,
                error: 'Transfer request not found'
            });
        }

        if (request.status !== 'PENDING' && request.status !== 'REVIEWING') {
            return res.status(400).json({
                success: false,
                error: `Cannot reject request with status: ${request.status}`
            });
        }

        const currentUserId = req.user.userId;
        const currentUserEmail = req.user.email;
        const buyerInfo = request.buyer_info;
        // Check buyer_id from database row or buyer_user_id from JOIN
        const buyerId = request.buyer_id || request.buyer_user_id;
        const isDesignatedBuyerById = buyerId && String(buyerId) === String(currentUserId);
        const isDesignatedBuyerByEmail = !buyerId && buyerInfo && buyerInfo.email && buyerInfo.email.toLowerCase() === currentUserEmail.toLowerCase();

        if (!isDesignatedBuyerById && !isDesignatedBuyerByEmail) {
            return res.status(403).json({
                success: false,
                error: 'You are not the designated buyer for this transfer request'
            });
        }

        const metadataUpdate = {
            rejectedBy: 'buyer',
            rejectedByUserId: currentUserId,
            buyerRejectedAt: new Date().toISOString()
        };
        await db.updateTransferRequestStatus(id, 'REJECTED', null, 'Rejected by buyer', metadataUpdate);

        // Get vehicle information for email
        const vehicle = await db.getVehicleById(request.vehicle_id);
        
        // Get seller information
        const sellerEmail = request.seller_email;
        const sellerName = request.seller_first_name && request.seller_last_name
            ? `${request.seller_first_name} ${request.seller_last_name}`
            : request.seller_email;
        
        // Get buyer name for email
        const buyerName = request.buyer_first_name && request.buyer_last_name
            ? `${request.buyer_first_name} ${request.buyer_last_name}`
            : (request.buyer_email || currentUserEmail);

        // Send email notification to seller
        if (sellerEmail) {
            try {
                await sendTransferBuyerRejectionEmail({
                    to: sellerEmail,
                    sellerName: sellerName,
                    buyerName: buyerName,
                    vehicle: vehicle
                });
                console.log('✅ Buyer rejection email sent to seller:', sellerEmail);
            } catch (emailError) {
                console.error('❌ Failed to send buyer rejection email to seller:', emailError);
                // Don't fail the request if email fails
            }
        }

        // Create in-app notification for seller
        try {
            await db.createNotification({
                userId: request.seller_id,
                title: 'Transfer Request Rejected by Buyer',
                message: `${buyerName} has rejected your transfer request for vehicle ${vehicle?.plate_number || vehicle?.vin || 'your vehicle'}.`,
                type: 'error'
            });
            console.log('✅ Created notification for seller about buyer rejection');
        } catch (notifError) {
            console.warn('⚠️ Failed to create seller notification:', notifError.message);
        }

        const updatedRequest = await db.getTransferRequestById(id);

        res.json({
            success: true,
            message: 'Transfer request rejected by buyer.',
            transferRequest: updatedRequest
        });
    } catch (error) {
        console.error('Buyer reject transfer request error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Public preview of a transfer request via email invite token (no PII)
router.get('/requests/preview-from-token', async (req, res) => {
    try {
        const { token } = req.query;
        if (!token) {
            return res.status(400).json({
                success: false,
                error: 'Token is required'
            });
        }

        let payload;
        try {
            payload = verifyTransferInviteToken(token);
        } catch (verifyError) {
            return res.status(400).json({
                success: false,
                error: 'Invalid or expired token'
            });
        }

        const transferRequest = await db.getTransferRequestById(payload.transferRequestId);
        if (!transferRequest) {
            return res.status(404).json({
                success: false,
                error: 'Transfer request not found'
            });
        }

        // Ensure token buyerEmail still matches current intended buyer (buyer_email or buyer_info.email)
        const intendedEmail =
            (transferRequest.buyer && transferRequest.buyer.email) ||
            (transferRequest.buyer_info && transferRequest.buyer_info.email);

        if (!intendedEmail || intendedEmail.toLowerCase() !== payload.buyerEmail.toLowerCase()) {
            return res.status(403).json({
                success: false,
                error: 'Token does not match current buyer for this transfer request'
            });
        }

        // Return limited, non-sensitive information for preview
        const vehicle = transferRequest.vehicle || {};
        const seller = transferRequest.seller || {};

        res.json({
            success: true,
            preview: {
                transferRequestId: transferRequest.id,
                status: transferRequest.status,
                vehicle: {
                    vin: vehicle.vin,
                    plateNumber: vehicle.plate_number,
                    make: vehicle.make,
                    model: vehicle.model,
                    year: vehicle.year
                },
                seller: {
                    name: seller.first_name && seller.last_name
                        ? `${seller.first_name} ${seller.last_name}`
                        : seller.email,
                    emailMasked: seller.email
                        ? seller.email.replace(/^(.{2}).+(@.+)$/, '$1***$2')
                        : null
                }
            }
        });
    } catch (error) {
        console.error('Preview transfer request from token error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Get transfer requests (with filters)
router.get('/requests', authenticateToken, authorizeRole(['admin', 'vehicle_owner']), async (req, res) => {
    try {
        const { status, sellerId, buyerId, vehicleId, dateFrom, dateTo, plateNumber, page = 1, limit = 50 } = req.query;
        
        // Build filters
        const filters = {};
        if (status) filters.status = status;
        if (sellerId) filters.sellerId = sellerId;
        if (buyerId) filters.buyerId = buyerId;
        if (vehicleId) filters.vehicleId = vehicleId;
        if (dateFrom) filters.dateFrom = dateFrom;
        if (dateTo) filters.dateTo = dateTo;
        if (plateNumber) filters.plateNumber = plateNumber;
        filters.page = parseInt(page);
        filters.limit = parseInt(limit);
        
        // If vehicle_owner, only show their requests
        if (req.user.role === 'vehicle_owner') {
            filters.sellerId = req.user.userId;
        }
        
        // Only apply status filter if user explicitly provided one
        // No default filtering - show all requests unless user filters
        // (The UI can handle filtering on the frontend if needed)
        
        const requests = await db.getTransferRequests(filters);
        
        // Get total count for pagination
        const dbModule = require('../database/db');
        let countQuery = 'SELECT COUNT(*) FROM transfer_requests WHERE 1=1';
        const countParams = [];
        let paramCount = 0;
        
        // Use the same status filter as the main query (only if explicitly provided)
        const statusFilter = filters.status;
        
        if (statusFilter) {
            paramCount++;
            // Handle both single status and array of statuses
            if (Array.isArray(statusFilter)) {
                countQuery += ` AND status = ANY($${paramCount})`;
                countParams.push(statusFilter);
            } else {
            countQuery += ` AND status = $${paramCount}`;
                countParams.push(statusFilter);
            }
        }
        
        if (req.user.role === 'vehicle_owner') {
            paramCount++;
            countQuery += ` AND seller_id = $${paramCount}`;
            countParams.push(req.user.userId);
        }
        
        const countResult = await dbModule.query(countQuery, countParams);
        const totalCount = parseInt(countResult.rows[0]?.count || 0);
        
        res.json({
            success: true,
            requests,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalCount / parseInt(limit)),
                totalRequests: totalCount,
                hasNext: (parseInt(page) - 1) * parseInt(limit) + requests.length < totalCount,
                hasPrev: parseInt(page) > 1
            }
        });
        
    } catch (error) {
        console.error('Get transfer requests error:', error);
        console.error('Error details:', error.message, error.stack);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: process.env.NODE_ENV === 'development' ? error.message : 'Failed to load transfer requests'
        });
    }
});

// Get transfer request statistics (MUST BE BEFORE /requests/:id to avoid route conflict)
router.get('/requests/stats', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const dbModule = require('../database/db');
        
        const stats = {
            total: 0,
            pending: 0,
            reviewing: 0,
            approved: 0,
            rejected: 0,
            completed: 0
        };
        
        const result = await dbModule.query(
            `SELECT status, COUNT(*) as count 
             FROM transfer_requests 
             GROUP BY status`
        );
        
        result.rows.forEach(row => {
            stats.total += parseInt(row.count);
            const status = row.status.toLowerCase();
            if (stats.hasOwnProperty(status)) {
                stats[status] = parseInt(row.count);
            }
        });
        
        res.json({
            success: true,
            stats
        });
        
    } catch (error) {
        console.error('Get transfer stats error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Get transfer request by ID
router.get('/requests/:id', authenticateToken, authorizeRole(['admin', 'vehicle_owner']), async (req, res) => {
    try {
        const { id } = req.params;
        
        const request = await db.getTransferRequestById(id);
        if (!request) {
            return res.status(404).json({
                success: false,
                error: 'Transfer request not found'
            });
        }
        
        // Check permissions
        if (req.user.role === 'vehicle_owner' && String(request.seller_id) !== String(req.user.userId)) {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }
        
        // Get documents
        const documents = await db.getTransferRequestDocuments(id);
        request.documents = documents;
        
        // Get verification history
        const verificationHistory = await db.getTransferVerificationHistory(id);
        request.verificationHistory = verificationHistory;
        
        res.json({
            success: true,
            transferRequest: request
        });
        
    } catch (error) {
        console.error('Get transfer request error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Get transfer request documents
router.get('/requests/:id/documents', authenticateToken, authorizeRole(['admin', 'vehicle_owner']), async (req, res) => {
    try {
        const { id } = req.params;
        
        const request = await db.getTransferRequestById(id);
        if (!request) {
            return res.status(404).json({
                success: false,
                error: 'Transfer request not found'
            });
        }
        
        // Check permissions
        if (req.user.role === 'vehicle_owner' && String(request.seller_id) !== String(req.user.userId)) {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }
        
        const documents = await db.getTransferRequestDocuments(id);
        
        res.json({
            success: true,
            documents
        });
        
    } catch (error) {
        console.error('Get transfer request documents error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Get transfer request verification history
router.get('/requests/:id/verification-history', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        
        const history = await db.getTransferVerificationHistory(id);
        
        res.json({
            success: true,
            verificationHistory: history
        });
        
    } catch (error) {
        console.error('Get verification history error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Approve transfer request
router.post('/requests/:id/approve', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { notes } = req.body;
        
        const request = await db.getTransferRequestById(id);
        if (!request) {
            return res.status(404).json({
                success: false,
                error: 'Transfer request not found'
            });
        }
        
        if (request.status !== 'PENDING' && request.status !== 'REVIEWING' && request.status !== 'FORWARDED_TO_HPG') {
            return res.status(400).json({
                success: false,
                error: `Cannot approve request with status: ${request.status}`
            });
        }
        
        // Check if all organization approvals are complete
        // Only check organizations that were actually forwarded to
        const pendingApprovals = [];
        const rejectedApprovals = [];
        
        // Check HPG approval only if it was forwarded to HPG
        if (request.hpg_clearance_request_id) {
            if (!request.hpg_approval_status || request.hpg_approval_status === 'PENDING') {
                pendingApprovals.push('HPG');
            } else if (request.hpg_approval_status === 'REJECTED') {
                rejectedApprovals.push('HPG');
            }
        }
        
        // Check Insurance approval only if it was forwarded to Insurance
        if (request.insurance_clearance_request_id) {
            if (!request.insurance_approval_status || request.insurance_approval_status === 'PENDING') {
                pendingApprovals.push('Insurance');
            } else if (request.insurance_approval_status === 'REJECTED') {
                rejectedApprovals.push('Insurance');
            }
        }
        
        // Check Emission approval only if it was forwarded to Emission
        if (request.emission_clearance_request_id) {
            if (!request.emission_approval_status || request.emission_approval_status === 'PENDING') {
                pendingApprovals.push('Emission');
            } else if (request.emission_approval_status === 'REJECTED') {
                rejectedApprovals.push('Emission');
            }
        }
        
        if (pendingApprovals.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Cannot approve transfer request. Pending organization approvals required.',
                pendingApprovals,
                message: `The following organizations must approve before LTO can finalize: ${pendingApprovals.join(', ')}`
            });
        }
        
        if (rejectedApprovals.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Cannot approve transfer request. Some organizations have rejected.',
                rejectedApprovals,
                message: `The following organizations have rejected: ${rejectedApprovals.join(', ')}`
            });
        }
        
        // Get vehicle
        const vehicle = await db.getVehicleById(request.vehicle_id);
        if (!vehicle) {
            return res.status(404).json({
                success: false,
                error: 'Vehicle not found'
            });
        }
        
        // Determine buyer ID (create user if buyer_info exists)
        let buyerId = request.buyer_id;
        if (!buyerId && request.buyer_info) {
            // Create buyer user account
            const bcrypt = require('bcryptjs');
            const buyerInfo = typeof request.buyer_info === 'string' ? JSON.parse(request.buyer_info) : request.buyer_info;
            const tempPassword = await bcrypt.hash('temp_password_' + Date.now(), 12);
            
            const buyerUser = await db.createUser({
                email: buyerInfo.email,
                passwordHash: tempPassword,
                firstName: buyerInfo.firstName || buyerInfo.first_name,
                lastName: buyerInfo.lastName || buyerInfo.last_name,
                role: 'vehicle_owner',
                organization: 'Individual',
                phone: buyerInfo.phone
            });
            
            buyerId = buyerUser.id;
            
            // Update request with buyer_id
            const dbModule = require('../database/db');
            await dbModule.query(
                'UPDATE transfer_requests SET buyer_id = $1 WHERE id = $2',
                [buyerId, id]
            );
        }
        
        if (!buyerId) {
            return res.status(400).json({
                success: false,
                error: 'Buyer information is missing'
            });
        }
        
        // Update vehicle ownership and set origin type to TRANSFER for the new owner
        await db.updateVehicle(request.vehicle_id, { ownerId: buyerId, originType: 'TRANSFER' });
        
        // Transfer ownership on blockchain
        let blockchainTxId = null;
        try {
            if (fabricService.isConnected && fabricService.mode === 'fabric') {
                const buyer = await db.getUserById(buyerId);
                const transferData = {
                    reason: 'Ownership transfer approved',
                    transferDate: new Date().toISOString(),
                    approvedBy: req.user.email
                };
                
                const result = await fabricService.transferOwnership(
                    vehicle.vin,
                    {
                        email: buyer.email,
                        firstName: buyer.first_name,
                        lastName: buyer.last_name
                    },
                    transferData
                );
                
                blockchainTxId = result.transactionId;
            }
        } catch (blockchainError) {
            console.warn('Blockchain transfer failed:', blockchainError.message);
            // Continue with approval even if blockchain fails
        }
        
        // Update transfer request status
        await db.updateTransferRequestStatus(id, 'APPROVED', req.user.userId, null, {
            blockchainTxId,
            approvedAt: new Date().toISOString(),
            notes: notes || null
        });
        
        // Get full owner details for history
        const previousOwner = await db.getUserById(request.seller_id);
        const newOwner = await db.getUserById(buyerId);
        
        // Add to vehicle history with enhanced metadata
        await db.addVehicleHistory({
            vehicleId: request.vehicle_id,
            action: 'OWNERSHIP_TRANSFERRED',
            description: `Ownership transferred from ${previousOwner ? `${previousOwner.first_name} ${previousOwner.last_name}` : 'Unknown'} to ${newOwner ? `${newOwner.first_name} ${newOwner.last_name}` : 'Unknown'}`,
            performedBy: req.user.userId,
            transactionId: blockchainTxId,
            metadata: JSON.stringify({
                transferRequestId: id,
                previousOwnerId: request.seller_id,
                previousOwnerName: previousOwner ? `${previousOwner.first_name} ${previousOwner.last_name}` : null,
                previousOwnerEmail: previousOwner ? previousOwner.email : null,
                newOwnerId: buyerId,
                newOwnerName: newOwner ? `${newOwner.first_name} ${newOwner.last_name}` : null,
                newOwnerEmail: newOwner ? newOwner.email : null,
                transferReason: request.reason || 'Sale',
                transferDate: new Date().toISOString(),
                approvedBy: req.user.userId,
                blockchainTxId: blockchainTxId
            })
        });
        
        // Create notifications
        await db.createNotification({
            userId: request.seller_id,
            title: 'Transfer Request Approved',
            message: `Your transfer request for vehicle ${vehicle.plate_number || vehicle.vin} has been approved.`,
            type: 'success'
        });
        
        if (buyerId) {
            await db.createNotification({
                userId: buyerId,
                title: 'Vehicle Ownership Transferred',
                message: `You are now the owner of vehicle ${vehicle.plate_number || vehicle.vin}.`,
                type: 'info'
            });
        }
        
        // Get updated request
        const updatedRequest = await db.getTransferRequestById(id);
        
        // Send email notification to seller
        if (previousOwner && previousOwner.email) {
            try {
                await sendTransferCompletionEmail({
                    to: previousOwner.email,
                    sellerName: `${previousOwner.first_name} ${previousOwner.last_name}`,
                    buyerName: newOwner ? `${newOwner.first_name} ${newOwner.last_name}` : 'Unknown',
                    vehicle: vehicle,
                    transferRequest: updatedRequest,
                    newOwner: newOwner,
                    blockchainTxId: blockchainTxId
                });
                console.log('✅ Transfer completion email sent to seller:', previousOwner.email);
            } catch (emailError) {
                console.error('❌ Failed to send transfer completion email:', emailError);
                // Don't fail the request if email fails
            }
        }
        
        res.json({
            success: true,
            message: 'Transfer request approved successfully',
            transferRequest: updatedRequest,
            blockchainTxId
        });
        
    } catch (error) {
        console.error('Approve transfer request error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: process.env.NODE_ENV === 'development' ? error.message : 'Failed to approve transfer request'
        });
    }
});

// Reject transfer request
router.post('/requests/:id/reject', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        
        if (!reason || !reason.trim()) {
            return res.status(400).json({
                success: false,
                error: 'Rejection reason is required'
            });
        }
        
        const request = await db.getTransferRequestById(id);
        if (!request) {
            return res.status(404).json({
                success: false,
                error: 'Transfer request not found'
            });
        }
        
        if (request.status === 'APPROVED' || request.status === 'COMPLETED') {
            return res.status(400).json({
                success: false,
                error: 'Cannot reject an already approved or completed request'
            });
        }
        
        // Update transfer request status
        await db.updateTransferRequestStatus(id, 'REJECTED', req.user.userId, reason);
        
        // Add to vehicle history
        await db.addVehicleHistory({
            vehicleId: request.vehicle_id,
            action: 'TRANSFER_REQUEST_REJECTED',
            description: `Transfer request rejected by ${req.user.email}. Reason: ${reason}`,
            performedBy: req.user.userId,
            transactionId: null,
            metadata: { transferRequestId: id, rejectionReason: reason }
        });
        
        // Create notification
        await db.createNotification({
            userId: request.seller_id,
            title: 'Transfer Request Rejected',
            message: `Your transfer request has been rejected. Reason: ${reason}`,
            type: 'error'
        });
        
        // Get updated request
        const updatedRequest = await db.getTransferRequestById(id);
        
        res.json({
            success: true,
            message: 'Transfer request rejected',
            transferRequest: updatedRequest
        });
        
    } catch (error) {
        console.error('Reject transfer request error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Forward transfer request to HPG
router.post('/requests/:id/forward-hpg', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { purpose, notes } = req.body;
        
        const request = await db.getTransferRequestById(id);
        if (!request) {
            return res.status(404).json({
                success: false,
                error: 'Transfer request not found'
            });
        }
        
        // Get transfer documents and vehicle documents
        const transferDocuments = await db.getTransferRequestDocuments(id);
        const vehicleDocuments = await db.getDocumentsByVehicle(request.vehicle_id);
        
        // Find OR/CR from transfer documents (document_type = 'or_cr') or vehicle documents
        let orCrDoc = transferDocuments.find(td => td.document_type === 'or_cr' && td.document_id);
        if (!orCrDoc && vehicleDocuments.length > 0) {
            orCrDoc = vehicleDocuments.find(d => 
                d.document_type === 'or_cr' || 
                d.document_type === 'registration_cert' || 
                d.document_type === 'registrationCert' ||
                d.document_type === 'registration' ||
                (d.original_name && (
                    d.original_name.toLowerCase().includes('or_cr') ||
                    d.original_name.toLowerCase().includes('or-cr') ||
                    d.original_name.toLowerCase().includes('orcr') ||
                    d.original_name.toLowerCase().includes('registration')
                ))
            );
        }
        
        // Find Owner ID from transfer documents (document_type = 'seller_id') or vehicle documents
        let ownerIdDoc = transferDocuments.find(td => td.document_type === 'seller_id' && td.document_id);
        if (!ownerIdDoc && vehicleDocuments.length > 0) {
            ownerIdDoc = vehicleDocuments.find(d => 
                d.document_type === 'owner_id' || 
                d.document_type === 'ownerId' ||
                (d.original_name && d.original_name.toLowerCase().includes('id'))
            );
        }
        
        // Build HPG documents array (only OR/CR and Owner ID)
        const hpgDocuments = [];
        
        // Add OR/CR if found
        if (orCrDoc) {
            if (orCrDoc.document_id) {
                // From transfer documents
                hpgDocuments.push({
                    id: orCrDoc.document_id,
                    type: orCrDoc.document_type || 'or_cr',
                    cid: orCrDoc.ipfs_cid,
                    path: orCrDoc.file_path,
                    filename: orCrDoc.original_name
                });
            } else {
                // From vehicle documents
                hpgDocuments.push({
                    id: orCrDoc.id,
                    type: orCrDoc.document_type,
                    cid: orCrDoc.ipfs_cid,
                    path: orCrDoc.file_path,
                    filename: orCrDoc.original_name
                });
            }
        }
        
        // Add Owner ID if found
        if (ownerIdDoc) {
            if (ownerIdDoc.document_id) {
                // From transfer documents
                hpgDocuments.push({
                    id: ownerIdDoc.document_id,
                    type: ownerIdDoc.document_type || 'seller_id',
                    cid: ownerIdDoc.ipfs_cid,
                    path: ownerIdDoc.file_path,
                    filename: ownerIdDoc.original_name
                });
            } else {
                // From vehicle documents
                hpgDocuments.push({
                    id: ownerIdDoc.id,
                    type: ownerIdDoc.document_type,
                    cid: ownerIdDoc.ipfs_cid,
                    path: ownerIdDoc.file_path,
                    filename: ownerIdDoc.original_name
                });
            }
        }
        
        console.log(`[Transfer→HPG] Sending ${hpgDocuments.length} documents to HPG (filtered from ${transferDocuments.length} transfer docs + ${vehicleDocuments.length} vehicle docs)`);
        console.log(`[Transfer→HPG] Document types sent: ${hpgDocuments.map(d => d.type).join(', ')}`);
        
        // Create HPG clearance request with filtered documents
        const clearanceRequest = await db.createClearanceRequest({
            vehicleId: request.vehicle_id,
            requestType: 'hpg',
            requestedBy: req.user.userId,
            purpose: purpose || 'Vehicle ownership transfer clearance',
            notes: notes || null,
            metadata: {
                transferRequestId: id,
                vehicleVin: request.vehicle.vin,
                vehiclePlate: request.vehicle.plate_number,
                // Include individual document references
                orCrDocId: orCrDoc?.document_id || orCrDoc?.id || null,
                orCrDocCid: orCrDoc?.ipfs_cid || null,
                orCrDocPath: orCrDoc?.file_path || null,
                orCrDocFilename: orCrDoc?.original_name || null,
                ownerIdDocId: ownerIdDoc?.document_id || ownerIdDoc?.id || null,
                ownerIdDocCid: ownerIdDoc?.ipfs_cid || null,
                ownerIdDocPath: ownerIdDoc?.file_path || null,
                ownerIdDocFilename: ownerIdDoc?.original_name || null,
                // Include ONLY HPG-relevant documents (OR/CR and Owner ID)
                documents: hpgDocuments
            }
        });
        
        // Update transfer request
        const dbModule = require('../database/db');
        await dbModule.query(
            `UPDATE transfer_requests 
             SET forwarded_to_hpg = true, 
                 hpg_clearance_request_id = $1,
                 hpg_approval_status = 'PENDING',
                 status = 'FORWARDED_TO_HPG',
                 metadata = metadata || $2::jsonb,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $3`,
            [
                clearanceRequest.id,
                JSON.stringify({ hpgClearanceRequestId: clearanceRequest.id }),
                id
            ]
        );
        
        // Add to vehicle history
        await db.addVehicleHistory({
            vehicleId: request.vehicle_id,
            action: 'TRANSFER_FORWARDED_TO_HPG',
            description: `Transfer request forwarded to HPG for clearance review`,
            performedBy: req.user.userId,
            transactionId: null,
            metadata: { 
                transferRequestId: id, 
                clearanceRequestId: clearanceRequest.id,
                documentsSent: hpgDocuments.length
            }
        });
        
        // Get updated request
        const updatedRequest = await db.getTransferRequestById(id);
        
        res.json({
            success: true,
            message: 'Transfer request forwarded to HPG',
            transferRequest: updatedRequest,
            clearanceRequest
        });
        
    } catch (error) {
        console.error('Forward to HPG error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Verify document for transfer request
router.post('/requests/:id/documents/:docId/verify', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const { id, docId } = req.params;
        const { status, notes, checklist, flagged } = req.body;
        
        if (!status || !['APPROVED', 'REJECTED', 'PENDING'].includes(status)) {
            return res.status(400).json({
                success: false,
                error: 'Valid status is required (APPROVED, REJECTED, or PENDING)'
            });
        }
        
        const request = await db.getTransferRequestById(id);
        if (!request) {
            return res.status(404).json({
                success: false,
                error: 'Transfer request not found'
            });
        }

        // Do not allow verification changes once the transfer is finalized
        if (['APPROVED', 'COMPLETED', 'REJECTED'].includes(request.status)) {
            return res.status(400).json({
                success: false,
                error: 'Cannot modify document verification for a finalized transfer request'
            });
        }
        
        const document = await db.getDocumentById(docId);
        if (!document) {
            return res.status(404).json({
                success: false,
                error: 'Document not found'
            });
        }
        
        // Create verification record
        const verification = await db.createTransferVerification({
            transferRequestId: id,
            documentId: docId,
            verifiedBy: req.user.userId,
            status,
            notes: notes || null,
            checklist: checklist || {},
            flagged: flagged || false
        });
        
        // Update document verification status (only if approved)
        // Note: verifyDocument always sets verified=true, so only call for APPROVED status
        if (status === 'APPROVED') {
            await db.verifyDocument(docId, req.user.userId);
        }
        // For REJECTED/PENDING, the verification record is created but document verified flag is not updated
        
        // Add to vehicle history
        await db.addVehicleHistory({
            vehicleId: request.vehicle_id,
            action: 'TRANSFER_DOCUMENT_VERIFIED',
            description: `Document verified: ${status}. ${notes || ''}`,
            performedBy: req.user.userId,
            transactionId: null,
            metadata: {
                transferRequestId: id,
                documentId: docId,
                status,
                flagged: flagged || false
            }
        });
        
        res.json({
            success: true,
            message: 'Document verification saved',
            verification
        });
        
    } catch (error) {
        console.error('Verify document error:', {
            error: error.message,
            stack: error.stack,
            transferRequestId: id,
            documentId: docId,
            status: req.body.status,
            userId: req.user?.userId
        });
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: process.env.NODE_ENV === 'development' ? error.message : 'Failed to verify document'
        });
    }
});

// Bulk approve transfer requests
router.post('/requests/bulk-approve', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const { requestIds } = req.body;
        
        if (!Array.isArray(requestIds) || requestIds.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'requestIds array is required'
            });
        }
        
        const results = [];
        const errors = [];
        
        for (const requestId of requestIds) {
            try {
                const request = await db.getTransferRequestById(requestId);
                if (!request) {
                    errors.push({ requestId, error: 'Request not found' });
                    continue;
                }
                
                if (request.status !== 'PENDING' && request.status !== 'REVIEWING') {
                    errors.push({ requestId, error: `Cannot approve request with status: ${request.status}` });
                    continue;
                }
                
                // Approve the request (reuse approve logic)
                // For simplicity, we'll update status directly here
                // In production, you might want to call the approve endpoint logic
                await db.updateTransferRequestStatus(requestId, 'APPROVED', req.user.userId);
                
                results.push({ requestId, status: 'approved' });
            } catch (error) {
                errors.push({ requestId, error: error.message });
            }
        }
        
        res.json({
            success: true,
            message: `Processed ${results.length} requests, ${errors.length} errors`,
            results,
            errors: errors.length > 0 ? errors : undefined
        });
        
    } catch (error) {
        console.error('Bulk approve error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Bulk reject transfer requests
router.post('/requests/bulk-reject', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const { requestIds, reason } = req.body;
        
        if (!Array.isArray(requestIds) || requestIds.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'requestIds array is required'
            });
        }
        
        if (!reason || !reason.trim()) {
            return res.status(400).json({
                success: false,
                error: 'Rejection reason is required'
            });
        }
        
        const results = [];
        const errors = [];
        
        for (const requestId of requestIds) {
            try {
                const request = await db.getTransferRequestById(requestId);
                if (!request) {
                    errors.push({ requestId, error: 'Request not found' });
                    continue;
                }
                
                if (request.status === 'APPROVED' || request.status === 'COMPLETED') {
                    errors.push({ requestId, error: 'Cannot reject an already approved request' });
                    continue;
                }
                
                await db.updateTransferRequestStatus(requestId, 'REJECTED', req.user.userId, reason);
                
                results.push({ requestId, status: 'rejected' });
            } catch (error) {
                errors.push({ requestId, error: error.message });
            }
        }
        
        res.json({
            success: true,
            message: `Processed ${results.length} requests, ${errors.length} errors`,
            results,
            errors: errors.length > 0 ? errors : undefined
        });
        
    } catch (error) {
        console.error('Bulk reject error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// HPG approves transfer request
router.post('/requests/:id/hpg-approve', authenticateToken, authorizeRole(['admin', 'hpg_admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { notes } = req.body;
        
        const request = await db.getTransferRequestById(id);
        if (!request) {
            return res.status(404).json({
                success: false,
                error: 'Transfer request not found'
            });
        }
        
        // Update HPG approval status
        const dbModule = require('../database/db');
        await dbModule.query(
            `UPDATE transfer_requests 
             SET hpg_approval_status = 'APPROVED',
                 hpg_approved_at = CURRENT_TIMESTAMP,
                 hpg_approved_by = $1,
                 metadata = metadata || $2::jsonb,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $3`,
            [
                req.user.userId,
                JSON.stringify({ hpgApprovalNotes: notes || null }),
                id
            ]
        );
        
        // Add to vehicle history
        await db.addVehicleHistory({
            vehicleId: request.vehicle_id,
            action: 'TRANSFER_HPG_APPROVED',
            description: `HPG approved transfer request ${id}`,
            performedBy: req.user.userId,
            metadata: { transferRequestId: id, notes: notes || null }
        });
        
        const updatedRequest = await db.getTransferRequestById(id);
        
        res.json({
            success: true,
            message: 'HPG approval recorded successfully',
            transferRequest: updatedRequest
        });
        
    } catch (error) {
        console.error('HPG approve transfer error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Insurance approves transfer request
router.post('/requests/:id/insurance-approve', authenticateToken, authorizeRole(['admin', 'insurance_admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { notes } = req.body;
        
        const request = await db.getTransferRequestById(id);
        if (!request) {
            return res.status(404).json({
                success: false,
                error: 'Transfer request not found'
            });
        }
        
        // Update Insurance approval status
        const dbModule = require('../database/db');
        await dbModule.query(
            `UPDATE transfer_requests 
             SET insurance_approval_status = 'APPROVED',
                 insurance_approved_at = CURRENT_TIMESTAMP,
                 insurance_approved_by = $1,
                 metadata = metadata || $2::jsonb,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $3`,
            [
                req.user.userId,
                JSON.stringify({ insuranceApprovalNotes: notes || null }),
                id
            ]
        );
        
        // Add to vehicle history
        await db.addVehicleHistory({
            vehicleId: request.vehicle_id,
            action: 'TRANSFER_INSURANCE_APPROVED',
            description: `Insurance approved transfer request ${id}`,
            performedBy: req.user.userId,
            metadata: { transferRequestId: id, notes: notes || null }
        });
        
        const updatedRequest = await db.getTransferRequestById(id);
        
        res.json({
            success: true,
            message: 'Insurance approval recorded successfully',
            transferRequest: updatedRequest
        });
        
    } catch (error) {
        console.error('Insurance approve transfer error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Emission approves transfer request
router.post('/requests/:id/emission-approve', authenticateToken, authorizeRole(['admin', 'emission_admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { notes } = req.body;
        
        const request = await db.getTransferRequestById(id);
        if (!request) {
            return res.status(404).json({
                success: false,
                error: 'Transfer request not found'
            });
        }
        
        // Update Emission approval status
        const dbModule = require('../database/db');
        await dbModule.query(
            `UPDATE transfer_requests 
             SET emission_approval_status = 'APPROVED',
                 emission_approved_at = CURRENT_TIMESTAMP,
                 emission_approved_by = $1,
                 metadata = metadata || $2::jsonb,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $3`,
            [
                req.user.userId,
                JSON.stringify({ emissionApprovalNotes: notes || null }),
                id
            ]
        );
        
        // Add to vehicle history
        await db.addVehicleHistory({
            vehicleId: request.vehicle_id,
            action: 'TRANSFER_EMISSION_APPROVED',
            description: `Emission approved transfer request ${id}`,
            performedBy: req.user.userId,
            metadata: { transferRequestId: id, notes: notes || null }
        });
        
        const updatedRequest = await db.getTransferRequestById(id);
        
        res.json({
            success: true,
            message: 'Emission approval recorded successfully',
            transferRequest: updatedRequest
        });
        
    } catch (error) {
        console.error('Emission approve transfer error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Forward transfer request to Insurance
router.post('/requests/:id/forward-insurance', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { purpose, notes } = req.body;
        
        const request = await db.getTransferRequestById(id);
        if (!request) {
            return res.status(404).json({
                success: false,
                error: 'Transfer request not found'
            });
        }
        
        // Get vehicle documents - Insurance ONLY receives Insurance Certificate
        const vehicleDocuments = await db.getDocumentsByVehicle(request.vehicle_id);
        
        // Find Insurance Certificate document
        const insuranceDoc = vehicleDocuments.find(d => 
            d.document_type === 'insurance_cert' || 
            d.document_type === 'insuranceCert' ||
            d.document_type === 'insurance' ||
            (d.original_name && d.original_name.toLowerCase().includes('insurance'))
        );
        
        // Build insurance documents array (only Insurance Certificate, max 1)
        const insuranceDocuments = insuranceDoc ? [{
            id: insuranceDoc.id,
            type: insuranceDoc.document_type,
            cid: insuranceDoc.ipfs_cid,
            path: insuranceDoc.file_path,
            filename: insuranceDoc.original_name
        }] : [];
        
        if (!insuranceDoc) {
            console.warn(`[Transfer→Insurance] Warning: No insurance certificate found for vehicle ${request.vehicle_id}`);
        }
        
        console.log(`[Transfer→Insurance] Sending ${insuranceDocuments.length} document(s) to Insurance (filtered from ${vehicleDocuments.length} total)`);
        console.log(`[Transfer→Insurance] Document type sent: ${insuranceDoc?.document_type || 'none'}`);
        
        // Create Insurance clearance request with filtered documents
        const clearanceRequest = await db.createClearanceRequest({
            vehicleId: request.vehicle_id,
            requestType: 'insurance',
            requestedBy: req.user.userId,
            purpose: purpose || 'Vehicle ownership transfer clearance',
            notes: notes || null,
            metadata: {
                transferRequestId: id,
                vehicleVin: request.vehicle?.vin,
                vehiclePlate: request.vehicle?.plate_number,
                // Include individual document reference
                documentId: insuranceDoc?.id || null,
                documentCid: insuranceDoc?.ipfs_cid || null,
                documentPath: insuranceDoc?.file_path || null,
                documentType: insuranceDoc?.document_type || null,
                documentFilename: insuranceDoc?.original_name || null,
                // Include ONLY Insurance Certificate
                documents: insuranceDocuments
            }
        });
        
        // Update transfer request
        const dbModule = require('../database/db');
        await dbModule.query(
            `UPDATE transfer_requests 
             SET insurance_clearance_request_id = $1,
                 insurance_approval_status = 'PENDING',
                 metadata = metadata || $2::jsonb,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $3`,
            [
                clearanceRequest.id,
                JSON.stringify({ insuranceClearanceRequestId: clearanceRequest.id }),
                id
            ]
        );
        
        // Add to vehicle history
        await db.addVehicleHistory({
            vehicleId: request.vehicle_id,
            action: 'TRANSFER_FORWARDED_TO_INSURANCE',
            description: `Transfer request forwarded to Insurance for clearance review`,
            performedBy: req.user.userId,
            metadata: { 
                transferRequestId: id, 
                clearanceRequestId: clearanceRequest.id,
                documentsSent: insuranceDocuments.length
            }
        });
        
        const updatedRequest = await db.getTransferRequestById(id);
        
        res.json({
            success: true,
            message: 'Transfer request forwarded to Insurance',
            transferRequest: updatedRequest,
            clearanceRequest
        });
        
    } catch (error) {
        console.error('Forward to Insurance error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Forward transfer request to Emission
router.post('/requests/:id/forward-emission', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { purpose, notes } = req.body;
        
        const request = await db.getTransferRequestById(id);
        if (!request) {
            return res.status(404).json({
                success: false,
                error: 'Transfer request not found'
            });
        }
        
        // Get vehicle documents - Emission ONLY receives Emission Certificate
        const vehicleDocuments = await db.getDocumentsByVehicle(request.vehicle_id);
        
        // Find Emission Certificate document
        const emissionDoc = vehicleDocuments.find(d => 
            d.document_type === 'emission_cert' || 
            d.document_type === 'emissionCert' ||
            d.document_type === 'emission' ||
            (d.original_name && d.original_name.toLowerCase().includes('emission'))
        );
        
        // Build emission documents array (only Emission Certificate, max 1)
        const emissionDocuments = emissionDoc ? [{
            id: emissionDoc.id,
            type: emissionDoc.document_type,
            cid: emissionDoc.ipfs_cid,
            path: emissionDoc.file_path,
            filename: emissionDoc.original_name
        }] : [];
        
        if (!emissionDoc) {
            console.warn(`[Transfer→Emission] Warning: No emission certificate found for vehicle ${request.vehicle_id}`);
        }
        
        console.log(`[Transfer→Emission] Sending ${emissionDocuments.length} document(s) to Emission (filtered from ${vehicleDocuments.length} total)`);
        console.log(`[Transfer→Emission] Document type sent: ${emissionDoc?.document_type || 'none'}`);
        
        // Create Emission clearance request with filtered documents
        const clearanceRequest = await db.createClearanceRequest({
            vehicleId: request.vehicle_id,
            requestType: 'emission',
            requestedBy: req.user.userId,
            purpose: purpose || 'Vehicle ownership transfer clearance',
            notes: notes || null,
            metadata: {
                transferRequestId: id,
                vehicleVin: request.vehicle?.vin,
                vehiclePlate: request.vehicle?.plate_number,
                // Include individual document reference
                documentId: emissionDoc?.id || null,
                documentCid: emissionDoc?.ipfs_cid || null,
                documentPath: emissionDoc?.file_path || null,
                documentType: emissionDoc?.document_type || null,
                documentFilename: emissionDoc?.original_name || null,
                // Include ONLY Emission Certificate
                documents: emissionDocuments
            }
        });
        
        // Update transfer request
        const dbModule = require('../database/db');
        await dbModule.query(
            `UPDATE transfer_requests 
             SET emission_clearance_request_id = $1,
                 emission_approval_status = 'PENDING',
                 metadata = metadata || $2::jsonb,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $3`,
            [
                clearanceRequest.id,
                JSON.stringify({ emissionClearanceRequestId: clearanceRequest.id }),
                id
            ]
        );
        
        // Add to vehicle history
        await db.addVehicleHistory({
            vehicleId: request.vehicle_id,
            action: 'TRANSFER_FORWARDED_TO_EMISSION',
            description: `Transfer request forwarded to Emission for clearance review`,
            performedBy: req.user.userId,
            metadata: { 
                transferRequestId: id, 
                clearanceRequestId: clearanceRequest.id,
                documentsSent: emissionDocuments.length
            }
        });
        
        const updatedRequest = await db.getTransferRequestById(id);
        
        res.json({
            success: true,
            message: 'Transfer request forwarded to Emission',
            transferRequest: updatedRequest,
            clearanceRequest
        });
        
    } catch (error) {
        console.error('Forward to Emission error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

module.exports = router;

