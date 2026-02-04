// TrustChain LTO - Transfer of Ownership Routes
// Handles transfer request management, approval, and verification

const express = require('express');
const router = express.Router();
const db = require('../database/services');
const { authenticateToken } = require('../middleware/auth');
const { authorizeRole } = require('../middleware/authorize');
const fabricService = require('../services/optimizedFabricService');
const docTypes = require('../config/documentTypes');
const transferValidationService = require('../services/transferAutoValidationService');
const transferDocumentGenerator = require('../services/transferDocumentGeneratorService');
const jwt = require('jsonwebtoken');
const { sendMail } = require('../services/gmailApiService');
const dbModule = require('../database/db');
const { TRANSFER_STATUS, VEHICLE_STATUS } = require('../config/statusConstants');
const { TRANSFER_ACTIONS, REGISTRATION_ACTIONS, normalizeAction } = require('../config/actionConstants');

const OWNER_ID_DB_TYPE = 'owner_id';
const TRANSFER_ROLE_LABELS = {
    [docTypes.TRANSFER_ROLES.DEED_OF_SALE]: 'Deed of Sale',
    [docTypes.TRANSFER_ROLES.SELLER_ID]: 'Seller ID',
    [docTypes.TRANSFER_ROLES.BUYER_ID]: 'Buyer ID',
    [docTypes.TRANSFER_ROLES.BUYER_TIN]: 'Buyer TIN',
    [docTypes.TRANSFER_ROLES.BUYER_CTPL]: 'Buyer CTPL',
    [docTypes.TRANSFER_ROLES.BUYER_HPG_CLEARANCE]: 'Buyer HPG Clearance'
};
const { validateTransferStatusTransition, validateVehicleStatusTransition } = require('../middleware/statusValidation');

const TRANSFER_DEADLINE_DAYS = 3;

// Validate required environment variables
if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required. Set it in .env file.');
}

// Transfer invite token secret (uses JWT_SECRET if TRANSFER_INVITE_SECRET not set)
const INVITE_TOKEN_SECRET = process.env.TRANSFER_INVITE_SECRET || process.env.JWT_SECRET;

// Auto-forward configuration (1: enabled, 2: only new requests, 3: per-organization toggles)
const AUTO_FORWARD_VERSION = '2026-01';
const AUTO_FORWARD_CONFIG = {
    enabled: process.env.TRANSFER_AUTO_FORWARD_ENABLED !== 'false',
    includeExisting: process.env.TRANSFER_AUTO_FORWARD_INCLUDE_EXISTING === 'true',
    orgs: {
        hpg: process.env.TRANSFER_AUTO_FORWARD_HPG !== 'false',
        insurance: process.env.TRANSFER_AUTO_FORWARD_INSURANCE !== 'false'
    }
};

function isAutoForwardEligible(request) {
    if (!AUTO_FORWARD_CONFIG.enabled) return false;
    const metadata = request?.metadata || {};
    if (!AUTO_FORWARD_CONFIG.includeExisting && metadata.autoForwardEligible !== true) return false;
    return true;
}

function getAutoForwardTargets(request) {
    return {
        hpg: AUTO_FORWARD_CONFIG.orgs.hpg && !request.hpg_clearance_request_id,
        insurance: AUTO_FORWARD_CONFIG.orgs.insurance && !request.insurance_clearance_request_id
    };
}

function computeExpiresAt(days = TRANSFER_DEADLINE_DAYS) {
    const ms = days * 24 * 60 * 60 * 1000;
    return new Date(Date.now() + ms);
}

/**
 * Link documents to transfer request based on explicit roles
 * @param {Object} params
 * @param {string} params.transferRequestId
 * @param {Object} params.documents - key/value mapping of role -> documentId
 * @param {string} params.uploadedBy - userId performing the linkage
 */
async function linkTransferDocuments({ transferRequestId, documents = {}, uploadedBy }) {
    // Prevent sellers (initiators) from uploading/linking documents to their own transfer request
    const transferRequest = await db.getTransferRequestById(transferRequestId);
    if (!transferRequest) {
        throw new Error('Transfer request not found');
    }

    const isSeller = transferRequest && String(transferRequest.seller_id || transferRequest.seller?.id) === String(uploadedBy);

    if (isSeller) {
        throw new Error('Sellers (initiators) are not allowed to upload or link documents to their own transfer requests. Only buyers can upload documents.');
    }

    if (!documents || typeof documents !== 'object') return;

    if (!uploadedBy) {
        throw new Error('uploadedBy is required for linking documents');
    }

    if (!transferRequestId) {
        throw new Error('transferRequestId is required for linking documents');
    }

    // Define ALL document roles (for seller creation and admin operations)
    const documentRoleMap = {
        'deedOfSale': docTypes.TRANSFER_ROLES.DEED_OF_SALE,
        'deed_of_sale': docTypes.TRANSFER_ROLES.DEED_OF_SALE,
        'sellerId': docTypes.TRANSFER_ROLES.SELLER_ID,
        'seller_id': docTypes.TRANSFER_ROLES.SELLER_ID,
        'buyerId': docTypes.TRANSFER_ROLES.BUYER_ID,
        'buyer_id': docTypes.TRANSFER_ROLES.BUYER_ID,
        // OR/CR removed: Not required for transfer requests. System automatically generates new OR/CR after transfer completion.
        // 'orCr': docTypes.TRANSFER_ROLES.OR_CR, // DEPRECATED
        // 'or_cr': docTypes.TRANSFER_ROLES.OR_CR, // DEPRECATED
        'buyerTin': docTypes.TRANSFER_ROLES.BUYER_TIN,
        'buyer_tin': docTypes.TRANSFER_ROLES.BUYER_TIN,
        'buyerCtpl': docTypes.TRANSFER_ROLES.BUYER_CTPL,
        'buyer_ctpl': docTypes.TRANSFER_ROLES.BUYER_CTPL,
        'buyerHpgClearance': docTypes.TRANSFER_ROLES.BUYER_HPG_CLEARANCE,
        'buyer_hpg_clearance': docTypes.TRANSFER_ROLES.BUYER_HPG_CLEARANCE
        // transferPackage and transferCertificate removed: System-generated, not user-uploaded
        // 'transferPackage': docTypes.TRANSFER_ROLES.TRANSFER_PACKAGE, // DEPRECATED
        // 'transfer_package_pdf': docTypes.TRANSFER_ROLES.TRANSFER_PACKAGE, // DEPRECATED
        // 'transferCertificate': docTypes.TRANSFER_ROLES.TRANSFER_CERTIFICATE, // DEPRECATED
        // 'transfer_certificate': docTypes.TRANSFER_ROLES.TRANSFER_CERTIFICATE // DEPRECATED
    };

    // Buyer-only allowed document types (when buyer is uploading)
    const buyerAllowedRoles = [
        docTypes.TRANSFER_ROLES.BUYER_ID,
        docTypes.TRANSFER_ROLES.BUYER_TIN,
        docTypes.TRANSFER_ROLES.BUYER_CTPL,
        docTypes.TRANSFER_ROLES.BUYER_HPG_CLEARANCE
    ];

    // Seller-only allowed document types (when seller is creating the request - handled elsewhere)
    const sellerOnlyRoles = [
        docTypes.TRANSFER_ROLES.DEED_OF_SALE,
        docTypes.TRANSFER_ROLES.SELLER_ID
    ];

    for (const [roleKey, docId] of Object.entries(documents)) {
        if (!docId) continue;

        try {
            // Validate UUID format - skip temporary document IDs (e.g., doc_1769319713555_bzef0npcc)
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(docId)) {
                console.warn('⚠️ Skipping invalid UUID format document ID:', { docId, roleKey, transferRequestId });
                continue;
            }

            const transferRole = documentRoleMap[roleKey];
            if (!transferRole) {
                console.warn('⚠️ Unknown document role key:', { roleKey, docId, transferRequestId });
                continue;
            }

            // Enforce buyer-only document restrictions: non-sellers (buyers) cannot upload seller documents
            // Sellers upload seller docs when creating the request (handled in POST /requests), not via linkTransferDocuments
            if (!isSeller && sellerOnlyRoles.includes(transferRole)) {
                console.warn('⚠️ Non-seller attempted to upload seller-only document:', { roleKey, transferRole, transferRequestId, uploadedBy, isSeller });
                throw new Error(`Only sellers can upload seller documents (${roleKey}). Buyers can only upload: Valid ID, TIN, HPG Clearance, and CTPL.`);
            }

            let document;
            try {
                document = await db.getDocumentById(docId);
            } catch (docErr) {
                console.error('❌ Error fetching document:', { docId, roleKey, transferRequestId, error: docErr.message });
                throw new Error(`Failed to fetch document ${docId} for role ${roleKey}: ${docErr.message}`);
            }

            if (!document) {
                console.warn('⚠️ Document not found for transfer:', { docId, roleKey, transferRequestId });
                continue;
            }

            if (!docTypes.isValidTransferRole(transferRole)) {
                console.warn('⚠️ Invalid transfer role:', { roleKey, transferRole });
                continue;
            }

            let existingDoc;
            try {
                existingDoc = await dbModule.query(
                    `SELECT id FROM transfer_documents 
                     WHERE transfer_request_id = $1 AND document_id = $2 AND document_type = $3`,
                    [transferRequestId, docId, transferRole]
                );
            } catch (queryErr) {
                console.error('❌ Error checking existing transfer document:', {
                    transferRequestId, docId, transferRole, error: queryErr.message
                });
                throw new Error(`Failed to check existing document link: ${queryErr.message}`);
            }

            if (existingDoc.rows.length === 0) {
                try {
                    await dbModule.query(
                        `INSERT INTO transfer_documents (transfer_request_id, document_type, document_id, uploaded_by)
                         VALUES ($1, $2, $3, $4)`,
                        [transferRequestId, transferRole, docId, uploadedBy]
                    );
                    console.log(`✅ Linked document ${docId} as ${roleKey} (${transferRole}) to transfer ${transferRequestId}`);
                } catch (insertErr) {
                    console.error('❌ Error inserting transfer document:', {
                        transferRequestId, docId, transferRole, uploadedBy, error: insertErr.message,
                        code: insertErr.code, constraint: insertErr.constraint
                    });
                    throw new Error(`Failed to link document ${docId} as ${roleKey}: ${insertErr.message}`);
                }
            } else {
                console.log(`ℹ️ Document ${docId} already linked as ${roleKey} to transfer ${transferRequestId}`);
            }
        } catch (err) {
            // Re-throw with context
            console.error('❌ Error in linkTransferDocuments loop:', {
                roleKey,
                docId,
                transferRequestId,
                uploadedBy,
                error: err.message,
                stack: err.stack
            });
            throw err;
        }
    }
}

/**
 * Link seller documents (deed_of_sale, seller_id) to transfer request.
 * Used when seller creates the request - linkTransferDocuments rejects sellers, so we insert directly.
 * @param {Object} params
 * @param {string} params.transferRequestId
 * @param {Object} params.documents - key/value mapping of role -> documentId (deed_of_sale, seller_id)
 * @param {string} params.uploadedBy - seller userId
 */
async function linkSellerDocumentsToTransfer({ transferRequestId, documents = {}, uploadedBy }) {
    if (!documents || typeof documents !== 'object' || !uploadedBy || !transferRequestId) return;

    const sellerRoles = {
        deedOfSale: docTypes.TRANSFER_ROLES.DEED_OF_SALE,
        deed_of_sale: docTypes.TRANSFER_ROLES.DEED_OF_SALE,
        sellerId: docTypes.TRANSFER_ROLES.SELLER_ID,
        seller_id: docTypes.TRANSFER_ROLES.SELLER_ID
    };

    for (const [roleKey, docId] of Object.entries(documents)) {
        if (!docId) continue;
        const transferRole = sellerRoles[roleKey];
        if (!transferRole) continue;

        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(docId)) {
            console.warn('⚠️ Skipping invalid UUID for seller document:', { docId, roleKey, transferRequestId });
            continue;
        }

        try {
            const document = await db.getDocumentById(docId);
            if (!document || !docTypes.isValidTransferRole(transferRole)) continue;

            const existingDoc = await dbModule.query(
                `SELECT id FROM transfer_documents 
                 WHERE transfer_request_id = $1 AND document_id = $2 AND document_type = $3`,
                [transferRequestId, docId, transferRole]
            );

            if (existingDoc.rows.length === 0) {
                await dbModule.query(
                    `INSERT INTO transfer_documents (transfer_request_id, document_type, document_id, uploaded_by)
                     VALUES ($1, $2, $3, $4)`,
                    [transferRequestId, transferRole, docId, uploadedBy]
                );
                console.log(`✅ Linked seller document ${docId} as ${roleKey} (${transferRole}) to transfer ${transferRequestId}`);
            }
        } catch (err) {
            console.error('❌ Error linking seller document:', { roleKey, docId, transferRequestId, error: err.message });
            throw err;
        }
    }
}

/**
 * Link seller documents (deed_of_sale, seller_id) to transfer request.
 * Sellers cannot use linkTransferDocuments (it rejects them), so this helper inserts directly.
 * @param {Object} params
 * @param {string} params.transferRequestId
 * @param {Object} params.documents - key/value mapping of role -> documentId (deed_of_sale, seller_id)
 * @param {string} params.uploadedBy - seller userId
 */
async function linkSellerDocumentsToTransfer({ transferRequestId, documents = {}, uploadedBy }) {
    if (!documents || typeof documents !== 'object' || !uploadedBy || !transferRequestId) return;

    const sellerRoles = {
        deedOfSale: docTypes.TRANSFER_ROLES.DEED_OF_SALE,
        deed_of_sale: docTypes.TRANSFER_ROLES.DEED_OF_SALE,
        sellerId: docTypes.TRANSFER_ROLES.SELLER_ID,
        seller_id: docTypes.TRANSFER_ROLES.SELLER_ID
    };

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    for (const [roleKey, docId] of Object.entries(documents)) {
        if (!docId || !sellerRoles[roleKey]) continue;
        if (!uuidRegex.test(docId)) {
            console.warn('⚠️ Skipping invalid UUID for seller document:', { docId, roleKey, transferRequestId });
            continue;
        }

        const transferRole = sellerRoles[roleKey];
        try {
            const document = await db.getDocumentById(docId);
            if (!document || !docTypes.isValidTransferRole(transferRole)) continue;

            const existingDoc = await dbModule.query(
                `SELECT id FROM transfer_documents 
                 WHERE transfer_request_id = $1 AND document_id = $2 AND document_type = $3`,
                [transferRequestId, docId, transferRole]
            );

            if (existingDoc.rows.length === 0) {
                await dbModule.query(
                    `INSERT INTO transfer_documents (transfer_request_id, document_type, document_id, uploaded_by)
                     VALUES ($1, $2, $3, $4)`,
                    [transferRequestId, transferRole, docId, uploadedBy]
                );
                console.log(`✅ Linked seller document ${docId} as ${roleKey} (${transferRole}) to transfer ${transferRequestId}`);
            }
        } catch (err) {
            console.error('❌ Error linking seller document:', { roleKey, docId, transferRequestId, error: err.message });
            throw err;
        }
    }
}

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

            <p style="font-weight: 600; color: #b45309;">Reminder: You must upload the required buyer documents (HPG clearance, CTPL insurance, IDs, TIN) within <strong>3 days</strong> of this invitation.</p>
            <p style="font-size: 0.9rem; color: #64748b; margin-top: 0.5rem;">Note: MVIR (Motor Vehicle Inspection Report) will be completed by LTO during the inspection process and is not required from you.</p>
            
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

Important: Upload the required buyer documents (HPG clearance, CTPL insurance, IDs, TIN) within 3 days of this invitation.

Note: MVIR (Motor Vehicle Inspection Report) will be completed by LTO during the inspection process and is not required from you.

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
                Your transfer request is now under review by the LTO administration. The system will proceed with validation from the required organizations (Insurance and HPG clearance) before final approval.
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

Your transfer request is now under review by the LTO administration. The system will proceed with validation from the required organizations (Insurance and HPG clearance) before final approval.

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

async function forwardTransferToHPG({ request, requestedBy, purpose, notes, autoTriggered = false }) {
    // Get transfer documents and vehicle documents
    const transferDocuments = await db.getTransferRequestDocuments(request.id);
    const vehicleDocuments = await db.getDocumentsByVehicle(request.vehicle_id);

    // Find OR/CR from vehicle documents only (not from transfer documents)
    // OR/CR is not required for transfer submission - system automatically generates new OR/CR after transfer
    // But HPG may need existing OR/CR for clearance, so we pull it from vehicle records if available
    let orCrDoc = null;
    if (vehicleDocuments.length > 0) {
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

    // Build HPG documents array (OR/CR, Owner ID, and Buyer's HPG Clearance)
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

    // Add Owner ID (Seller ID) if found
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

    // FIX 1: Add Buyer's HPG Clearance Certificate (HPG needs this to verify)
    const buyerHpgTransferDoc = transferDocuments.find(td =>
        td.document_type === docTypes.TRANSFER_ROLES.BUYER_HPG_CLEARANCE && td.document_id
    );

    let buyerHpgDoc = null;
    if (buyerHpgTransferDoc && buyerHpgTransferDoc.document_id) {
        try {
            buyerHpgDoc = await db.getDocumentById(buyerHpgTransferDoc.document_id);
            if (buyerHpgDoc) {
                hpgDocuments.push({
                    id: buyerHpgDoc.id,
                    type: 'buyer_hpg_clearance',
                    cid: buyerHpgDoc.ipfs_cid,
                    path: buyerHpgDoc.file_path,
                    filename: buyerHpgDoc.original_name
                });
                console.log(`[Transfer→HPG] Added buyer's HPG clearance certificate: ${buyerHpgDoc.original_name || buyerHpgDoc.id}`);
            }
        } catch (hpgDocError) {
            console.warn(`[Transfer→HPG] Failed to fetch buyer's HPG clearance document:`, hpgDocError.message);
        }
    } else {
        // No buyer_hpg_clearance in transfer_documents - clearance will remain PENDING (no auto-verify)
        console.warn(`[Transfer→HPG] No buyer HPG clearance in transfer_documents - clearance will remain PENDING until buyer uploads or manual review`);
    }

    console.log(`[Transfer→HPG] ${autoTriggered ? 'Auto-forward' : 'Manual forward'} sending ${hpgDocuments.length} documents to HPG (from transfer_documents + vehicle OR/CR)`);
    console.log(`[Transfer→HPG] Document types sent: ${hpgDocuments.map(d => d.type).join(', ')}`);

    // Create HPG clearance request with filtered documents
    const clearanceRequest = await db.createClearanceRequest({
        vehicleId: request.vehicle_id,
        requestType: 'hpg',
        requestedBy,
        purpose: purpose || 'Vehicle ownership transfer clearance',
        notes: notes || null,
        metadata: {
            transferRequestId: request.id,
            vehicleVin: request.vehicle.vin,
            vehiclePlate: request.vehicle.plate_number,
            vehicleMake: request.vehicle.make,
            vehicleModel: request.vehicle.model,
            vehicleYear: request.vehicle.year,
            vehicleColor: request.vehicle.color,
            engineNumber: request.vehicle.engine_number,
            chassisNumber: request.vehicle.chassis_number,
            // Include individual document references
            orCrDocId: orCrDoc?.document_id || orCrDoc?.id || null,
            orCrDocCid: orCrDoc?.ipfs_cid || null,
            orCrDocPath: orCrDoc?.file_path || null,
            orCrDocFilename: orCrDoc?.original_name || null,
            ownerIdDocId: ownerIdDoc?.document_id || ownerIdDoc?.id || null,
            ownerIdDocCid: ownerIdDoc?.ipfs_cid || null,
            ownerIdDocPath: ownerIdDoc?.file_path || null,
            ownerIdDocFilename: ownerIdDoc?.original_name || null,
            // Include buyer's HPG clearance certificate reference
            buyerHpgDocId: buyerHpgDoc?.id || null,
            buyerHpgDocCid: buyerHpgDoc?.ipfs_cid || null,
            buyerHpgDocPath: buyerHpgDoc?.file_path || null,
            buyerHpgDocFilename: buyerHpgDoc?.original_name || null,
            // Include ALL HPG-relevant documents (OR/CR, Owner ID, and Buyer's HPG Clearance)
            documents: hpgDocuments,
            autoTriggered
        }
    });

    // PHASE 1 AUTOMATION: OCR Extraction and Database Check for Transfer
    try {
        const hpgDatabaseService = require('../services/hpgDatabaseService');
        const ocrService = require('../services/ocrService');
        const fs = require('fs').promises;
        let extractedData = {};
        let databaseCheckResult = null;

        // Step 1: OCR Extraction from OR/CR (for transfers)
        if (orCrDoc) {
            const orCrPath = orCrDoc.file_path || orCrDoc.filePath;
            if (orCrPath) {
                try {
                    await fs.access(orCrPath);
                    const orCrMimeType = orCrDoc.mime_type || orCrDoc.mimeType || 'application/pdf';
                    const ownerIdPath = ownerIdDoc?.file_path || ownerIdDoc?.filePath;
                    const ownerIdMimeType = ownerIdDoc?.mime_type || ownerIdDoc?.mimeType;
                    extractedData = await ocrService.extractHPGInfo(
                        orCrPath,
                        ownerIdPath || null,
                        orCrMimeType,
                        ownerIdMimeType || null
                    );
                    console.log(`[Transfer→HPG] OCR extracted data:`, {
                        engineNumber: extractedData.engineNumber,
                        chassisNumber: extractedData.chassisNumber
                    });
                    const dataMatch = {
                        engineNumber: extractedData.engineNumber && request.vehicle.engine_number ?
                            extractedData.engineNumber.toUpperCase().trim() === request.vehicle.engine_number.toUpperCase().trim() : null,
                        chassisNumber: extractedData.chassisNumber && request.vehicle.chassis_number ?
                            extractedData.chassisNumber.toUpperCase().trim() === request.vehicle.chassis_number.toUpperCase().trim() : null
                    };
                    extractedData.dataMatch = dataMatch;
                    extractedData.ocrExtracted = true;
                    extractedData.ocrExtractedAt = new Date().toISOString();
                } catch (fileError) {
                    console.warn(`[Transfer→HPG] OR/CR file not accessible: ${fileError.message}`);
                }
            }
        }

        // Step 2: Automated Database Check
        databaseCheckResult = await hpgDatabaseService.checkVehicle({
            plateNumber: request.vehicle.plate_number,
            engineNumber: request.vehicle.engine_number,
            chassisNumber: request.vehicle.chassis_number,
            vin: request.vehicle.vin
        });
        await hpgDatabaseService.storeCheckResult(clearanceRequest.id, databaseCheckResult);

        // Update metadata with automation results
        const updatedMetadata = {
            ...clearanceRequest.metadata,
            ...(Object.keys(extractedData).length > 0 && { extractedData }),
            ...(databaseCheckResult && { hpgDatabaseCheck: databaseCheckResult }),
            automationPhase1: {
                completed: true,
                completedAt: new Date().toISOString(),
                isTransfer: true,
                ocrExtracted: Object.keys(extractedData).length > 0,
                databaseChecked: !!databaseCheckResult
            }
        };

        await dbModule.query(
            `UPDATE clearance_requests SET metadata = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
            [JSON.stringify(updatedMetadata), clearanceRequest.id]
        );

        await db.addVehicleHistory({
            vehicleId: request.vehicle_id,
            action: 'HPG_AUTOMATION_PHASE1',
            description: `HPG Phase 1 automation completed for transfer. OCR: ${Object.keys(extractedData).length > 0 ? 'Yes' : 'No'}, Database: ${databaseCheckResult?.status || 'ERROR'}`,
            performedBy: requestedBy,
            transactionId: null,
            metadata: {
                transferRequestId: request.id,
                clearanceRequestId: clearanceRequest.id,
                extractedData: Object.keys(extractedData).length > 0 ? extractedData : null,
                databaseCheckResult
            }
        });

        if (databaseCheckResult?.status === 'FLAGGED') {
            const flaggedNote = `⚠️ WARNING: Vehicle found in HPG hot list. ${databaseCheckResult.details}`;
            await dbModule.query(
                `UPDATE clearance_requests SET notes = COALESCE(notes || E'\n', '') || $1 WHERE id = $2`,
                [flaggedNote, clearanceRequest.id]
            );
        }
    } catch (automationError) {
        console.error('[Transfer→HPG] Automation error:', automationError);
    }

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
            request.id
        ]
    );

    await db.addVehicleHistory({
        vehicleId: request.vehicle_id,
        action: 'TRANSFER_FORWARDED_TO_HPG',
        description: `Transfer request forwarded to HPG for clearance review`,
        performedBy: requestedBy,
        transactionId: null,
        metadata: {
            transferRequestId: request.id,
            clearanceRequestId: clearanceRequest.id,
            documentsSent: hpgDocuments.length,
            autoTriggered
        }
    });

    // Trigger auto-verification if HPG clearance document exists (buyer uploads this)
    // Note: buyerHpgTransferDoc is already declared above in the HPG forwarding section
    let autoVerificationResult = null;

    if (buyerHpgTransferDoc && buyerHpgTransferDoc.document_id) {
        try {
            // Get actual document record
            const hpgClearanceDoc = await db.getDocumentById(buyerHpgTransferDoc.document_id);
            if (hpgClearanceDoc) {
                const autoVerificationService = require('../services/autoVerificationService');
                const vehicle = await db.getVehicleById(request.vehicle_id);

                // Prepare documents array for auto-verification (HPG expects array)
                const documentsForVerification = [hpgClearanceDoc];
                if (orCrDoc && orCrDoc.document_id) {
                    const orCrDocRecord = await db.getDocumentById(orCrDoc.document_id);
                    if (orCrDocRecord) documentsForVerification.push(orCrDocRecord);
                }

                autoVerificationResult = await autoVerificationService.autoVerifyHPG(
                    request.vehicle_id,
                    documentsForVerification,
                    vehicle
                );

                console.log(`[Transfer→HPG Auto-Verify] Result: ${autoVerificationResult.status}, Automated: ${autoVerificationResult.automated}`);

                // Update clearance request metadata with auto-verification result
                const updatedMetadata = {
                    ...clearanceRequest.metadata,
                    autoVerify: {
                        completed: true,
                        completedAt: new Date().toISOString(),
                        completedBy: 'system',
                        confidenceScore: autoVerificationResult.score || autoVerificationResult.confidence * 100,
                        recommendation: autoVerificationResult.recommendation || 'MANUAL_REVIEW',
                        authenticityCheck: autoVerificationResult.authenticityCheck || {}
                    }
                };

                await dbModule.query(
                    `UPDATE clearance_requests SET metadata = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
                    [JSON.stringify(updatedMetadata), clearanceRequest.id]
                );

                // Add auto-verification result to history
                if (autoVerificationResult.automated) {
                    await db.addVehicleHistory({
                        vehicleId: request.vehicle_id,
                        action: autoVerificationResult.status === 'APPROVED'
                            ? 'TRANSFER_HPG_AUTO_VERIFIED_APPROVED'
                            : 'TRANSFER_HPG_AUTO_VERIFIED_PENDING',
                        description: autoVerificationResult.status === 'APPROVED'
                            ? `Transfer HPG auto-verified and approved. Score: ${autoVerificationResult.score}%`
                            : `Transfer HPG auto-verified but flagged for manual review. Score: ${autoVerificationResult.score}%, Reason: ${autoVerificationResult.reason}`,
                        performedBy: requestedBy,
                        transactionId: null,
                        metadata: {
                            transferRequestId: request.id,
                            clearanceRequestId: clearanceRequest.id,
                            autoVerificationResult
                        }
                    });

                    // Send notification to buyer if auto-verification failed (status is PENDING, not APPROVED)
                    if (autoVerificationResult.status === 'PENDING' && autoVerificationResult.reason) {
                        const buyerId = request.buyer_id || request.buyer_user_id;
                        const buyerEmail = request.buyer_email || (request.buyer_info && request.buyer_info.email);

                        if (buyerId) {
                            try {
                                await db.createNotification({
                                    userId: buyerId,
                                    title: 'HPG Clearance Document Issue Detected',
                                    message: `Your HPG Clearance document was flagged during auto-verification. Issues: ${autoVerificationResult.reason}. Please review and update the document if needed.`,
                                    type: 'warning'
                                });
                                console.log(`✅ Notification sent to buyer ${buyerId} for HPG auto-verification failure`);
                            } catch (notifError) {
                                console.error('[Transfer→HPG Auto-Verify] Failed to create buyer notification:', notifError);
                            }
                        }
                    }
                }
            }
        } catch (autoVerifyError) {
            console.error('[Transfer→HPG Auto-Verify] Error:', autoVerifyError);
            // Don't fail clearance request creation if auto-verification fails
        }
    }

    const updatedRequest = await db.getTransferRequestById(request.id);
    return { clearanceRequest, updatedRequest, autoVerification: autoVerificationResult };
}

async function forwardTransferToInsurance({ request, requestedBy, purpose, notes, autoTriggered = false }) {
    // Get transfer documents - use ONLY buyer's CTPL from transfer_documents (not vehicle registration docs)
    const transferDocuments = await db.getTransferRequestDocuments(request.id);

    // Find CTPL from transfer documents (buyer uploads this)
    // Do NOT fallback to vehicle documents - transfer requires buyer's new CTPL, not seller's old one
    let insuranceDoc = null;
    const buyerCtplTransferDoc = transferDocuments.find(td =>
        td.document_type === docTypes.TRANSFER_ROLES.BUYER_CTPL && td.document_id
    );

    if (buyerCtplTransferDoc && buyerCtplTransferDoc.document_id) {
        insuranceDoc = await db.getDocumentById(buyerCtplTransferDoc.document_id);
    }

    // If no buyer_ctpl in transfer_documents, do NOT auto-verify - status remains PENDING
    if (!insuranceDoc) {
        console.warn(`[Transfer→Insurance] No buyer CTPL in transfer_documents - clearance will remain PENDING until buyer uploads or manual review`);
    }

    const insuranceDocuments = insuranceDoc ? [{
        id: insuranceDoc.id,
        type: insuranceDoc.document_type,
        cid: insuranceDoc.ipfs_cid,
        path: insuranceDoc.file_path,
        filename: insuranceDoc.original_name
    }] : [];

    console.log(`[Transfer→Insurance] ${autoTriggered ? 'Auto-forward' : 'Manual forward'} sending ${insuranceDocuments.length} document(s) to Insurance (from transfer_documents)`);
    console.log(`[Transfer→Insurance] Document type sent: ${insuranceDoc?.document_type || 'none'}`);

    const clearanceRequest = await db.createClearanceRequest({
        vehicleId: request.vehicle_id,
        requestType: 'insurance',
        requestedBy,
        purpose: purpose || 'Vehicle ownership transfer clearance',
        notes: notes || null,
        metadata: {
            transferRequestId: request.id,
            vehicleVin: request.vehicle?.vin,
            vehiclePlate: request.vehicle?.plate_number,
            documentId: insuranceDoc?.id || null,
            documentCid: insuranceDoc?.ipfs_cid || null,
            documentPath: insuranceDoc?.file_path || null,
            documentType: insuranceDoc?.document_type || null,
            documentFilename: insuranceDoc?.original_name || null,
            documents: insuranceDocuments,
            autoTriggered
        }
    });

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
            request.id
        ]
    );

    await db.addVehicleHistory({
        vehicleId: request.vehicle_id,
        action: 'TRANSFER_FORWARDED_TO_INSURANCE',
        description: `Transfer request forwarded to Insurance for clearance review`,
        performedBy: requestedBy,
        metadata: {
            transferRequestId: request.id,
            clearanceRequestId: clearanceRequest.id,
            documentsSent: insuranceDocuments.length,
            autoTriggered
        }
    });

    // Trigger auto-verification if insurance document exists
    let autoVerificationResult = null;
    if (insuranceDoc) {
        try {
            const autoVerificationService = require('../services/autoVerificationService');
            const vehicle = await db.getVehicleById(request.vehicle_id);
            autoVerificationResult = await autoVerificationService.autoVerifyInsurance(
                request.vehicle_id,
                insuranceDoc,
                vehicle
            );

            console.log(`[Transfer→Insurance Auto-Verify] Result: ${autoVerificationResult.status}, Automated: ${autoVerificationResult.automated}`);

            // Update clearance request status if auto-approved
            if (autoVerificationResult.automated && autoVerificationResult.status === 'APPROVED') {
                await db.updateClearanceRequestStatus(clearanceRequest.id, 'APPROVED', {
                    verifiedBy: 'system',
                    verifiedAt: new Date().toISOString(),
                    notes: `Auto-verified and approved. Score: ${autoVerificationResult.score}%`,
                    autoVerified: true,
                    autoVerificationResult
                });
                console.log(`[Transfer→Insurance Auto-Verify] Updated clearance request ${clearanceRequest.id} status to APPROVED`);

                // FIX 2: Update transfer request insurance approval status
                try {
                    await dbModule.query(
                        `UPDATE transfer_requests 
                         SET insurance_approval_status = 'APPROVED',
                             insurance_approved_at = CURRENT_TIMESTAMP,
                             -- approved_by has FK to users; auto-verify has no user row, so keep it NULL
                             insurance_approved_by = NULL,
                             updated_at = CURRENT_TIMESTAMP
                         WHERE id = $1`,
                        [request.id]
                    );
                    console.log(`[Transfer→Insurance Auto-Verify] Updated transfer request ${request.id} insurance_approval_status to APPROVED`);
                } catch (statusUpdateError) {
                    console.error(`[Transfer→Insurance Auto-Verify] Failed to update transfer request insurance status:`, statusUpdateError.message);
                    // Don't fail the whole process if status update fails
                }
            }

            // Add auto-verification result to history
            if (autoVerificationResult.automated) {
                await db.addVehicleHistory({
                    vehicleId: request.vehicle_id,
                    action: autoVerificationResult.status === 'APPROVED'
                        ? 'TRANSFER_INSURANCE_AUTO_VERIFIED_APPROVED'
                        : 'TRANSFER_INSURANCE_AUTO_VERIFIED_PENDING',
                    description: autoVerificationResult.status === 'APPROVED'
                        ? `Transfer Insurance auto-verified and approved. Score: ${autoVerificationResult.score}%`
                        : `Transfer Insurance auto-verified but flagged for manual review. Score: ${autoVerificationResult.score}%, Reason: ${autoVerificationResult.reason}`,
                    performedBy: requestedBy,
                    transactionId: null,
                    metadata: {
                        transferRequestId: request.id,
                        clearanceRequestId: clearanceRequest.id,
                        autoVerificationResult
                    }
                });

                // Send notification to buyer if auto-verification failed (status is PENDING, not APPROVED)
                if (autoVerificationResult.status === 'PENDING' && autoVerificationResult.reason) {
                    const buyerId = request.buyer_id || request.buyer_user_id;
                    const buyerEmail = request.buyer_email || (request.buyer_info && request.buyer_info.email);

                    if (buyerId) {
                        try {
                            await db.createNotification({
                                userId: buyerId,
                                title: 'CTPL Insurance Document Issue Detected',
                                message: `Your CTPL Insurance document was flagged during auto-verification. Issues: ${autoVerificationResult.reason}. Please review and update the document if needed.`,
                                type: 'warning'
                            });
                            console.log(`✅ Notification sent to buyer ${buyerId} for Insurance auto-verification failure`);
                        } catch (notifError) {
                            console.error('[Transfer→Insurance Auto-Verify] Failed to create buyer notification:', notifError);
                        }
                    }
                }
            }
        } catch (autoVerifyError) {
            console.error('[Transfer→Insurance Auto-Verify] Error:', autoVerifyError);
            // Don't fail clearance request creation if auto-verification fails
        }
    }

    const updatedRequest = await db.getTransferRequestById(request.id);
    return { clearanceRequest, updatedRequest, autoVerification: autoVerificationResult };
}

async function autoForwardTransferRequest(request, triggeredBy) {
    if (!isAutoForwardEligible(request)) {
        return { skipped: true, reason: 'Auto-forward disabled or not eligible for this request', transferRequest: request };
    }

    const targets = getAutoForwardTargets(request);
    const anyTarget = targets.hpg || targets.insurance;
    if (!anyTarget) {
        return { skipped: true, reason: 'No pending organizations to forward', transferRequest: request };
    }

    const startedAt = new Date().toISOString();
    const results = {};
    let latestRequest = request;

    if (targets.hpg) {
        try {
            const { clearanceRequest, updatedRequest } = await forwardTransferToHPG({
                request: latestRequest,
                requestedBy: triggeredBy,
                purpose: 'Vehicle ownership transfer clearance',
                notes: 'Auto-forwarded on buyer acceptance',
                autoTriggered: true
            });
            latestRequest = updatedRequest;
            results.hpg = { success: true, clearanceRequestId: clearanceRequest.id };
        } catch (error) {
            console.error('[AutoForward→HPG] Error:', error);
            results.hpg = { success: false, error: error.message };
        }
    }

    if (targets.insurance) {
        try {
            const { clearanceRequest, updatedRequest } = await forwardTransferToInsurance({
                request: latestRequest,
                requestedBy: triggeredBy,
                purpose: 'Vehicle ownership transfer clearance',
                notes: 'Auto-forwarded on buyer acceptance',
                autoTriggered: true
            });
            latestRequest = updatedRequest;
            results.insurance = { success: true, clearanceRequestId: clearanceRequest.id };
        } catch (error) {
            console.error('[AutoForward→Insurance] Error:', error);
            results.insurance = { success: false, error: error.message };
        }
    }

    const finishedAt = new Date().toISOString();
    const patch = {
        autoForward: {
            version: AUTO_FORWARD_VERSION,
            startedAt,
            finishedAt,
            triggeredBy: triggeredBy || null,
            results,
            autoTriggered: true
        }
    };

    await dbModule.query(
        `UPDATE transfer_requests 
         SET metadata = metadata || $1::jsonb,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [JSON.stringify(patch), request.id]
    );

    const refreshedRequest = await db.getTransferRequestById(request.id);
    return { transferRequest: refreshedRequest, results };
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
        const expiresAt = computeExpiresAt();

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
            existingRequests = await db.getTransferRequests({
                vehicleId,
                status: [
                    TRANSFER_STATUS.PENDING,
                    TRANSFER_STATUS.AWAITING_BUYER_DOCS,
                    TRANSFER_STATUS.UNDER_REVIEW
                ]
            });
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
                metadata: {
                    autoForwardEligible: true,
                    autoForwardVersion: AUTO_FORWARD_VERSION,
                    expiresAt: expiresAt.toISOString()
                },
                expiresAt: expiresAt.toISOString()
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

        // Set vehicle status to transfer in progress
        try {
            await db.updateVehicle(vehicleId, { status: VEHICLE_STATUS.TRANSFER_IN_PROGRESS });
        } catch (statusError) {
            console.warn('⚠️ Failed to set vehicle status to TRANSFER_IN_PROGRESS:', statusError.message);
        }

        // Link documents - seller uploads deed_of_sale and seller_id at creation
        // linkTransferDocuments rejects sellers, so we use linkSellerDocumentsToTransfer for seller docs
        try {
            // 1. Link seller documents (deed_of_sale, seller_id) - seller is the creator
            if (documents && typeof documents === 'object' && Object.keys(documents).length > 0) {
                await linkSellerDocumentsToTransfer({
                    transferRequestId: transferRequest.id,
                    documents,
                    uploadedBy: req.user.userId
                });
            }

            // 2. Legacy: infer and link from documentIds array
            if (documentIds && Array.isArray(documentIds) && documentIds.length > 0) {
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
                            // OR/CR removed: Not required for transfer requests. System automatically generates new OR/CR after transfer completion.
                            // docType = docTypes.TRANSFER_ROLES.OR_CR; // DEPRECATED
                            docType = null; // Skip OR/CR documents in legacy inference
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
                AND tr.seller_id != $1  -- Explicitly exclude requests where user is the seller
                AND tr.status IN ('PENDING', 'AWAITING_BUYER_DOCS', 'UNDER_REVIEW')
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
        if (![TRANSFER_STATUS.PENDING, TRANSFER_STATUS.AWAITING_BUYER_DOCS].includes(request.status)) {
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

        const providedDocuments = (req.body && req.body.documents && Object.keys(req.body.documents || {}).length > 0);
        const legacyDocumentIds = Array.isArray(req.body?.documentIds) ? req.body.documentIds : [];
        const nowIso = new Date().toISOString();
        let statusAfterAccept = TRANSFER_STATUS.AWAITING_BUYER_DOCS;
        let validationResult = null;

        // Link buyer documents if provided
        if (providedDocuments) {
            try {
                await linkTransferDocuments({
                    transferRequestId: id,
                    documents: req.body.documents,
                    uploadedBy: currentUserId
                });
            } catch (linkErr) {
                console.error('Failed to link buyer documents:', linkErr);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to link buyer documents',
                    message: linkErr.message
                });
            }
        }

        // If no explicit docs but legacy array provided, link minimally as deed (fallback)
        if (!providedDocuments && legacyDocumentIds.length > 0) {
            for (const docId of legacyDocumentIds) {
                try {
                    await dbModule.query(
                        `INSERT INTO transfer_documents (transfer_request_id, document_type, document_id, uploaded_by)
                         VALUES ($1, $2, $3, $4)
                         ON CONFLICT DO NOTHING`,
                        [id, docTypes.TRANSFER_ROLES.BUYER_ID, docId, currentUserId]
                    );
                } catch (legacyErr) {
                    console.warn('Legacy buyer document link failed:', legacyErr.message);
                }
            }
        }

        // If buyer provided docs, run auto-validation and move to UNDER_REVIEW
        if (providedDocuments || legacyDocumentIds.length > 0) {
            const transferRequestRefreshed = await db.getTransferRequestById(id);
            const vehicle = await db.getVehicleById(request.vehicle_id);
            const transferDocs = await db.getTransferRequestDocuments(id);

            validationResult = await transferValidationService.validateDocuments({
                transferRequest: transferRequestRefreshed,
                vehicle,
                documents: transferDocs
            });

            // Note: MVIR auto-verification removed - MVIR comes from LTO inspection (vehicles.inspection_documents),
            // not from buyer uploads. MVIR is verified during LTO inspection process, not during transfer acceptance.

            const metadataUpdate = {
                buyerAcceptedAt: nowIso,
                buyerAcceptedBy: currentUserId,
                buyerSubmittedAt: nowIso,
                validation: validationResult
            };

            await db.updateTransferRequestStatus(
                id,
                TRANSFER_STATUS.UNDER_REVIEW,
                null,
                null,
                metadataUpdate,
                nowIso
            );
            statusAfterAccept = TRANSFER_STATUS.UNDER_REVIEW;
        } else {
            const metadataUpdate = {
                buyerAcceptedAt: nowIso,
                buyerAcceptedBy: currentUserId,
                awaitingBuyerDocs: true
            };
            await db.updateTransferRequestStatus(
                id,
                TRANSFER_STATUS.AWAITING_BUYER_DOCS,
                null,
                null,
                metadataUpdate
            );
        }

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

        // Send notifications only when buyer docs have been submitted (UNDER_REVIEW)
        if (statusAfterAccept === TRANSFER_STATUS.UNDER_REVIEW) {
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

            try {
                await db.createNotification({
                    userId: request.seller_id,
                    title: 'Transfer Request Accepted by Buyer',
                    message: `${buyerName} has accepted your transfer request for vehicle ${vehicle?.plate_number || vehicle?.vin || 'your vehicle'}. The request is now under review.`,
                    type: 'success'
                });
                console.log('✅ Created notification for seller about buyer acceptance');
            } catch (notifError) {
                console.warn('⚠️ Failed to create seller notification:', notifError.message);
            }
        }

        let updatedRequest = await db.getTransferRequestById(id);
        let autoForward = null;

        if (statusAfterAccept === TRANSFER_STATUS.UNDER_REVIEW && isAutoForwardEligible(updatedRequest)) {
            try {
                autoForward = await autoForwardTransferRequest(updatedRequest, req.user.userId);
                if (autoForward?.transferRequest) {
                    updatedRequest = autoForward.transferRequest;
                }

                // Notify buyer about auto-forward status
                if (autoForward && !autoForward.skipped) {
                    const forwardedOrgs = [];
                    if (autoForward.results?.hpg?.success) forwardedOrgs.push('HPG');
                    if (autoForward.results?.insurance?.success) forwardedOrgs.push('Insurance');

                    if (forwardedOrgs.length > 0) {
                        try {
                            await db.createNotification({
                                userId: currentUserId,
                                title: 'Documents Auto-Forwarded',
                                message: `Your documents have been automatically sent to ${forwardedOrgs.join(' and ')} for verification. The transfer request is now under review.`,
                                type: 'info'
                            });
                            console.log('✅ Created notification for buyer about auto-forward');
                        } catch (notifError) {
                            console.warn('⚠️ Failed to create buyer auto-forward notification:', notifError.message);
                        }
                    }
                }
            } catch (autoForwardError) {
                console.error('Auto-forward after buyer acceptance failed:', autoForwardError);
                autoForward = { success: false, error: autoForwardError.message };
            }
        }

        res.json({
            success: true,
            message: statusAfterAccept === TRANSFER_STATUS.UNDER_REVIEW
                ? 'Buyer documents submitted. Awaiting LTO review.'
                : 'Buyer acceptance recorded. Please upload required documents within 3 days.',
            transferRequest: updatedRequest,
            autoForward,
            validation: validationResult
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

        if (![TRANSFER_STATUS.PENDING, TRANSFER_STATUS.AWAITING_BUYER_DOCS, TRANSFER_STATUS.UNDER_REVIEW].includes(request.status)) {
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
        await db.updateTransferRequestStatus(id, TRANSFER_STATUS.REJECTED, null, 'Rejected by buyer', metadataUpdate);

        // Revert vehicle status when buyer rejects
        try {
            await db.updateVehicle(request.vehicle_id, { status: VEHICLE_STATUS.REGISTERED });
        } catch (statusErr) {
            console.warn('⚠️ Failed to revert vehicle status after buyer rejection:', statusErr.message);
        }

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
router.get('/requests', authenticateToken, authorizeRole(['admin', 'lto_admin', 'lto_officer', 'vehicle_owner']), async (req, res) => {
    try {
        const { status, sellerId, buyerId, vehicleId, dateFrom, dateTo, plateNumber, page = 1, limit = 50 } = req.query;

        // Build filters
        const filters = {};
        if (status) {
            // Handle comma-separated status values (e.g., "PENDING,UNDER_REVIEW")
            const statusValues = status.split(',').map(s => s.trim().toUpperCase()).filter(s => s);
            filters.status = statusValues.length === 1 ? statusValues[0] : statusValues;
        }
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
            transferRequests: requests, // Frontend expects 'transferRequests'
            requests: requests, // Also include 'requests' for backward compatibility
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
// STRICT: Allow admin and lto_admin only (officers should not see system-wide stats)
router.get('/requests/stats', authenticateToken, authorizeRole(['admin', 'lto_admin']), async (req, res) => {
    try {
        const dbModule = require('../database/db');

        const stats = {
            total: 0,
            pending: 0,
            awaiting_buyer_docs: 0,
            under_review: 0,
            approved: 0,
            rejected: 0,
            expired: 0,
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

// Expire stale transfer requests (admin-triggered)
// STRICT: Allow admin and lto_admin only (bulk operations are admin-level)
router.post('/requests/expire-stale', authenticateToken, authorizeRole(['admin', 'lto_admin']), async (req, res) => {
    try {
        const dbModule = require('../database/db');
        const result = await dbModule.query(
            `UPDATE transfer_requests
             SET status = $1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE status IN ($2, $3)
               AND expires_at IS NOT NULL
               AND expires_at < CURRENT_TIMESTAMP
             RETURNING id, vehicle_id`,
            [TRANSFER_STATUS.EXPIRED, TRANSFER_STATUS.PENDING, TRANSFER_STATUS.AWAITING_BUYER_DOCS]
        );

        const expiredIds = result.rows.map(r => r.id);
        for (const row of result.rows) {
            try {
                await db.updateVehicle(row.vehicle_id, { status: VEHICLE_STATUS.REGISTERED });
            } catch (statusErr) {
                console.warn('⚠️ Failed to revert vehicle for expired transfer:', row.vehicle_id, statusErr.message);
            }
        }

        res.json({
            success: true,
            message: `Expired ${expiredIds.length} transfer requests`,
            expiredRequestIds: expiredIds
        });
    } catch (error) {
        console.error('Expire stale transfer requests error:', error);
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

        // Check permissions - allow seller OR buyer
        const isSeller = req.user.role === 'vehicle_owner' && String(request.seller_id) === String(req.user.userId);
        const buyerInfo = request.buyer_info;
        const buyerId = request.buyer_id || request.buyer_user_id;
        const isBuyer = buyerId && String(buyerId) === String(req.user.userId);
        const isBuyerByEmail = !buyerId && buyerInfo && buyerInfo.email && buyerInfo.email.toLowerCase() === req.user.email.toLowerCase();

        if (req.user.role === 'vehicle_owner' && !isSeller && !isBuyer && !isBuyerByEmail) {
            return res.status(403).json({
                success: false,
                error: 'Access denied. You must be the seller or buyer for this transfer request.'
            });
        }

        // Get documents
        const documents = await db.getTransferRequestDocuments(id);

        // Automatically include OR/CR from vehicle records (even though seller didn't upload it)
        // OR/CR is linked to the vehicle, so it's automatically compiled with the transfer application
        const vehicleDocuments = await db.getDocumentsByVehicle(request.vehicle_id);
        const orCrDoc = vehicleDocuments.find(d =>
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

        // Add OR/CR to documents array if found (marked as auto-included from vehicle)
        if (orCrDoc) {
            documents.push({
                ...orCrDoc,
                document_type: 'or_cr',
                auto_included: true, // Flag indicating this was pulled from vehicle, not uploaded by seller
                source: 'vehicle_record'
            });
        }

        request.documents = documents;

        // Build categorized documents for admin details UI (vehicle/seller/buyer)
        const vehicleDocs = await db.getDocumentsByVehicle(request.vehicle_id);
        const normalizedDocs = documents.map(doc => {
            const normalizedType = (doc.document_type || doc.type || doc.document_db_type || doc.documentType || '')
                .toLowerCase();
            return {
                ...doc,
                document_type: normalizedType
            };
        });
        request.sellerDocuments = normalizedDocs.filter(doc => ['deed_of_sale', 'seller_id'].includes(doc.document_type));
        request.buyerDocuments = normalizedDocs.filter(doc =>
            ['buyer_id', 'buyer_tin', 'buyer_ctpl', 'buyer_hpg_clearance'].includes(doc.document_type)
        );
        request.vehicleDocuments = vehicleDocs || [];

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

        // Check permissions - allow seller OR buyer
        const isSeller = req.user.role === 'vehicle_owner' && String(request.seller_id) === String(req.user.userId);
        const buyerInfo = request.buyer_info;
        const buyerId = request.buyer_id || request.buyer_user_id;
        const isBuyer = buyerId && String(buyerId) === String(req.user.userId);
        const isBuyerByEmail = !buyerId && buyerInfo && buyerInfo.email && buyerInfo.email.toLowerCase() === req.user.email.toLowerCase();

        if (req.user.role === 'vehicle_owner' && !isSeller && !isBuyer && !isBuyerByEmail) {
            return res.status(403).json({
                success: false,
                error: 'Access denied. You must be the seller or buyer for this transfer request.'
            });
        }

        const documents = await db.getTransferRequestDocuments(id);

        // Automatically include OR/CR from vehicle records (even though seller didn't upload it)
        // OR/CR is linked to the vehicle, so it's automatically compiled with the transfer application
        const vehicle = await db.getVehicleById(request.vehicle_id);
        if (vehicle) {
            const vehicleDocuments = await db.getDocumentsByVehicle(request.vehicle_id);
            const orCrDoc = vehicleDocuments.find(d =>
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

            // Add OR/CR to documents array if found (marked as auto-included from vehicle)
            if (orCrDoc) {
                documents.push({
                    ...orCrDoc,
                    document_type: 'or_cr',
                    auto_included: true, // Flag indicating this was pulled from vehicle, not uploaded by seller
                    source: 'vehicle_record'
                });
            }
        }

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
// STRICT: Allow admin, lto_admin, and lto_officer (all LTO staff can view verification history)
router.get('/requests/:id/verification-history', authenticateToken, authorizeRole(['admin', 'lto_admin', 'lto_officer']), async (req, res) => {
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
// STRICT: Allow admin, lto_admin, and lto_officer (officers can approve transfers under limit - see value check below)
router.post('/requests/:id/approve', authenticateToken, authorizeRole(['admin', 'lto_admin', 'lto_officer']), async (req, res) => {
    try {
        const { id } = req.params;
        const { notes } = req.body;

        // Get current user to check role for transfer value limits
        const currentUser = await db.getUserById(req.user.userId);
        const userRole = currentUser?.role || req.user.role;

        const request = await db.getTransferRequestById(id);
        if (!request) {
            return res.status(404).json({
                success: false,
                error: 'Transfer request not found'
            });
        }

        // STRICT: lto_officer can only approve transfers under 500k PHP value
        // NOTE: Transfer value is not currently stored in transfer_requests table
        // If transfer value tracking is added, implement check here:
        // if (userRole === 'lto_officer' && transferValue > 500000) {
        //     return res.status(403).json({
        //         success: false,
        //         error: 'Transfer value exceeds officer approval limit',
        //         message: 'Transfers over 500,000 PHP require lto_admin or admin approval'
        //     });
        // }

        // PHASE 3: Validate transfer status transition before updating
        // Handle status transition properly: UNDER_REVIEW must go through APPROVED first
        let currentStatus = request.status;
        let needsApprovalTransition = false;

        // Check if we need to transition through APPROVED first
        if (currentStatus === TRANSFER_STATUS.UNDER_REVIEW) {
            // UNDER_REVIEW cannot directly transition to COMPLETED
            // Must first transition to APPROVED, then to COMPLETED
            const approvalValidation = validateTransferStatusTransition(currentStatus, TRANSFER_STATUS.APPROVED);
            if (!approvalValidation.valid) {
                console.error(`[Phase 3] Invalid status transition: ${currentStatus} → ${TRANSFER_STATUS.APPROVED}`, approvalValidation.error);
                return res.status(400).json({
                    success: false,
                    error: 'Invalid status transition',
                    message: approvalValidation.error,
                    currentStatus: currentStatus,
                    newStatus: TRANSFER_STATUS.APPROVED
                });
            }
            needsApprovalTransition = true;
        }

        // Validate final transition to COMPLETED
        const targetStatus = TRANSFER_STATUS.COMPLETED;
        const finalStatus = needsApprovalTransition ? TRANSFER_STATUS.APPROVED : currentStatus;
        const statusValidation = validateTransferStatusTransition(finalStatus, targetStatus);
        if (!statusValidation.valid) {
            console.error(`[Phase 3] Invalid status transition: ${finalStatus} → ${targetStatus}`, statusValidation.error);
            return res.status(400).json({
                success: false,
                error: 'Invalid status transition',
                message: statusValidation.error,
                currentStatus: finalStatus,
                newStatus: targetStatus
            });
        }

        // Allow approval from the normal review states AND from the forwarded-to-HPG state.
        // Rationale:
        // - enum in DB includes FORWARDED_TO_HPG
        // - once org approvals (HPG/Insurance) are done, LTO should still be able to finalize
        //   even though status remains FORWARDED_TO_HPG.
        const approvableStatuses = [
            TRANSFER_STATUS.PENDING,
            TRANSFER_STATUS.AWAITING_BUYER_DOCS,
            TRANSFER_STATUS.UNDER_REVIEW,
            TRANSFER_STATUS.FORWARDED_TO_HPG
        ];

        if (!approvableStatuses.includes(request.status)) {
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

        // HPG and Insurance are the only required organizations for transfer approval.

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

        // LTO inspection requirement: vehicle must have a recorded MVIR before ownership can change.
        // We treat any existing mvir_number as evidence of a completed LTO inspection.
        const hasInspection = !!vehicle.mvir_number;
        if (!hasInspection) {
            // If not already flagged, mark the transfer as under review (awaiting LTO inspection) and notify parties.
            // NOTE: AWAITING_LTO_INSPECTION is not in database CHECK constraint, so we use UNDER_REVIEW
            if (request.status !== TRANSFER_STATUS.UNDER_REVIEW) {
                const nowIso = new Date().toISOString();
                await db.updateTransferRequestStatus(
                    id,
                    TRANSFER_STATUS.UNDER_REVIEW,
                    req.user.userId,
                    null,
                    {
                        ltoInspectionRequired: true,
                        ltoInspectionRequiredAt: nowIso
                    }
                );

                try {
                    // Notify seller that an LTO inspection is required.
                    await db.createNotification({
                        userId: request.seller_id,
                        title: 'Transfer Requires LTO Inspection',
                        message: `Your transfer request for vehicle ${vehicle.plate_number || vehicle.vin} requires an LTO inspection. Please bring the vehicle to your LTO office for inspection.`,
                        type: 'warning'
                    });

                    // Notify buyer if buyer_id is already resolved.
                    if (request.buyer_id) {
                        await db.createNotification({
                            userId: request.buyer_id,
                            title: 'Transfer Pending LTO Inspection',
                            message: `The vehicle ${vehicle.plate_number || vehicle.vin} must be inspected by LTO before the ownership transfer can be completed.`,
                            type: 'info'
                        });
                    }
                } catch (notifError) {
                    console.warn('⚠️ Failed to create LTO inspection notifications:', notifError.message);
                }
            }

            return res.status(400).json({
                success: false,
                error: 'Cannot approve transfer request. Vehicle requires LTO inspection before approval.',
                code: 'LTO_INSPECTION_REQUIRED'
            });
        }



        // Check MVIR auto-verification status from metadata (if available)
        const mvirAutoVerification = request.metadata?.mvirAutoVerification;
        if (mvirAutoVerification && mvirAutoVerification.status === 'PENDING' && mvirAutoVerification.automated === false) {
            console.warn(`[Transfer Approval] MVIR auto-verification failed: ${mvirAutoVerification.reason}`);
            // Don't block approval, but log warning - LTO admin can manually verify
        } else if (mvirAutoVerification && mvirAutoVerification.status === 'APPROVED' && mvirAutoVerification.automated === true) {
            console.log(`[Transfer Approval] ✅ MVIR auto-verified successfully`);
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

        // Enforce required transfer documents before ownership can change.
        // Seller must have: deed of sale + seller ID.
        // Buyer must have: valid ID, TIN, CTPL insurance, HPG clearance.
        // Note: MVIR comes from LTO inspection (vehicles.inspection_documents), not from buyer uploads.
        let transferDocs = null;
        try {
            transferDocs = await db.getTransferRequestDocuments(id);
        } catch (docError) {
            console.error('Failed to load transfer documents before approval:', docError);
            return res.status(500).json({
                success: false,
                error: 'Failed to load transfer documents for approval',
                message: process.env.NODE_ENV === 'development' ? docError.message : undefined
            });
        }

        const presentRoles = new Set(
            (transferDocs || [])
                .map(d => (d.document_type || '').toLowerCase())
                .filter(Boolean)
        );
        const presentDocumentTypes = new Set(
            (transferDocs || [])
                .map(d => (d.document_db_type || d.document_type || '').toLowerCase())
                .filter(Boolean)
        );

        const sellerRequiredRoles = [
            docTypes.TRANSFER_ROLES.DEED_OF_SALE,
            docTypes.TRANSFER_ROLES.SELLER_ID
        ];

        const buyerRequiredRoles = [
            docTypes.TRANSFER_ROLES.BUYER_ID,
            docTypes.TRANSFER_ROLES.BUYER_TIN,
            docTypes.TRANSFER_ROLES.BUYER_CTPL,
            docTypes.TRANSFER_ROLES.BUYER_HPG_CLEARANCE
        ];

        const missingSellerRoles = sellerRequiredRoles.filter(role => !presentRoles.has(role));
        const sellerDocsFromVehicle = await db.getDocumentsByVehicle(request.vehicle_id);
        const sellerDocsPresent = {
            [docTypes.TRANSFER_ROLES.DEED_OF_SALE]: sellerDocsFromVehicle.some(doc => doc.document_type === 'deed_of_sale'),
            [docTypes.TRANSFER_ROLES.SELLER_ID]: sellerDocsFromVehicle.some(doc => doc.document_type === 'seller_id')
        };
        const missingSellerRolesAdjusted = missingSellerRoles.filter(role => !sellerDocsPresent[role]);
        const missingBuyerRoles = buyerRequiredRoles.filter(role => !presentRoles.has(role));
        const missingBuyerRolesAdjusted = missingBuyerRoles.filter(role => {
            if (role === docTypes.TRANSFER_ROLES.BUYER_TIN) {
                return !presentDocumentTypes.has('tin_id') && !presentDocumentTypes.has(OWNER_ID_DB_TYPE);
            }
            if (role === docTypes.TRANSFER_ROLES.BUYER_HPG_CLEARANCE) {
                return !presentDocumentTypes.has('hpg_clearance') && !presentDocumentTypes.has(OWNER_ID_DB_TYPE);
            }
            if (role === docTypes.TRANSFER_ROLES.BUYER_CTPL) {
                return !presentDocumentTypes.has('insurance_cert');
            }
            return true;
        });

        if (missingSellerRolesAdjusted.length > 0 || missingBuyerRolesAdjusted.length > 0) {
            const missingLabels = {
                seller: missingSellerRolesAdjusted.map(role => TRANSFER_ROLE_LABELS[role] || role),
                buyer: missingBuyerRolesAdjusted.map(role => TRANSFER_ROLE_LABELS[role] || role)
            };
            return res.status(400).json({
                success: false,
                error: 'Cannot approve transfer request. Required transfer documents are missing.',
                missing: {
                    seller: missingSellerRolesAdjusted,
                    buyer: missingBuyerRolesAdjusted
                },
                missingLabels
            });
        }

        // Update vehicle ownership and set origin type to TRANSFER for the new owner
        // After transfer completion, vehicle should remain REGISTERED (or APPROVED) so it shows up properly for the new owner
        // TRANSFER_COMPLETED and TRANSFER_IN_PROGRESS are temporary statuses - we should restore the vehicle to its active status
        let vehicleStatusAfterTransfer;
        if (vehicle.status === 'REGISTERED' || vehicle.status === 'APPROVED') {
            // Keep the existing active status
            vehicleStatusAfterTransfer = vehicle.status;
        } else if (vehicle.status === 'TRANSFER_COMPLETED' || vehicle.status === 'TRANSFER_IN_PROGRESS') {
            // Explicitly revert transfer statuses to REGISTERED (they were active before transfer started)
            vehicleStatusAfterTransfer = VEHICLE_STATUS.REGISTERED;
        } else {
            // For any other status, default to REGISTERED
            vehicleStatusAfterTransfer = VEHICLE_STATUS.REGISTERED;
        }

        // Transfer ownership on blockchain FIRST to get transaction ID
        // CRITICAL: Blockchain transaction is MANDATORY for ownership transfers
        // If blockchain fails, the entire transfer must fail (blockchain is source of truth)
        let blockchainTxId = null;

        // STRICT FABRIC: Enforce real blockchain service - NO FALLBACKS ALLOWED
        const blockchainMode = process.env.BLOCKCHAIN_MODE || 'fabric';
        if (blockchainMode !== 'fabric') {
            console.error('❌ CRITICAL: BLOCKCHAIN_MODE must be "fabric". No fallback mode allowed.');
            return res.status(500).json({
                success: false,
                error: 'Blockchain mode invalid',
                message: 'BLOCKCHAIN_MODE must be set to "fabric". System requires real Hyperledger Fabric network. No fallback modes allowed.'
            });
        }

        // Validate Fabric connection - MANDATORY
        if (!fabricService.isConnected || fabricService.mode !== 'fabric') {
            return res.status(503).json({
                success: false,
                error: 'Blockchain service unavailable',
                message: 'Cannot complete transfer: Hyperledger Fabric network is not connected. Please ensure the blockchain network is running.'
            });
        }

        // Blockchain is ALWAYS required - proceed with transfer
        try {
            const buyer = await db.getUserById(buyerId);
            // Fetch current user to get employee_id
            const currentUser = await db.getUserById(req.user.userId);

            // Initialize Fabric service with current user context for dynamic identity selection
            await fabricService.initialize({
                role: req.user.role,
                email: req.user.email
            });

            const transferData = {
                reason: 'Ownership transfer approved',
                transferDate: new Date().toISOString(),
                approvedBy: req.user.email,
                currentOwnerEmail: vehicle.owner_email,  // Include current owner email for validation
                // Include officer information for traceability (with employee_id)
                officerInfo: {
                    userId: req.user.userId,
                    email: req.user.email,
                    name: `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() || req.user.email,
                    employeeId: currentUser?.employee_id || null
                },
                approvedByEmail: req.user.email,
                approvedByName: `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() || req.user.email
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

            if (!blockchainTxId) {
                throw new Error('Blockchain transfer completed but no transaction ID returned');
            }

            console.log(`✅ Blockchain transfer successful. TX ID: ${blockchainTxId}`);

            // PHASE 3: Add BLOCKCHAIN_TRANSFERRED history entry immediately after successful blockchain transfer
            // This mirrors the BLOCKCHAIN_REGISTERED pattern from registration workflow
            // Get vehicle for metadata before updating it
            const vehicleForHistory = await db.getVehicleById(request.vehicle_id);
            const previousOwnerForHistory = vehicleForHistory.owner_id ? await db.getUserById(vehicleForHistory.owner_id) : null;
            const buyerForHistory = await db.getUserById(buyerId);

            await db.addVehicleHistory({
                vehicleId: request.vehicle_id,
                action: TRANSFER_ACTIONS.BLOCKCHAIN_TRANSFERRED, // PHASE 3: Use standardized action constant
                description: `Ownership transfer recorded on Hyperledger Fabric. TX: ${blockchainTxId}`,
                performedBy: req.user.userId,
                transactionId: blockchainTxId,
                metadata: {
                    source: 'transfer_approval',
                    transferRequestId: id,
                    previousOwner: previousOwnerForHistory?.email || vehicleForHistory.owner_email,
                    newOwner: buyerForHistory?.email,
                    fabricNetwork: 'ltochannel',
                    chaincode: 'vehicle-registration',
                    transferredAt: new Date().toISOString()
                }
            });
            console.log(`✅ [Phase 3] Created BLOCKCHAIN_TRANSFERRED history entry with txId: ${blockchainTxId}`);
        } catch (blockchainError) {
            console.error('❌ CRITICAL: Blockchain transfer failed:', blockchainError.message);
            return res.status(500).json({
                success: false,
                error: 'Blockchain transfer failed',
                message: `Cannot complete transfer: ${blockchainError.message}. The ownership transfer must be recorded on the blockchain. Please try again or contact support if the issue persists.`
            });
        }

        // STRICT FABRIC: Validate blockchain transaction ID exists - MANDATORY
        if (!blockchainTxId) {
            console.error('❌ CRITICAL: Blockchain transaction ID missing after transfer');
            return res.status(500).json({
                success: false,
                error: 'Blockchain transaction ID missing',
                message: 'Transfer completed but blockchain transaction ID was not recorded. This should not happen. Please contact support.'
            });
        }

        // Update vehicle with new owner, status, and blockchain transaction ID
        await db.updateVehicle(request.vehicle_id, {
            ownerId: buyerId,
            originType: 'TRANSFER',
            status: vehicleStatusAfterTransfer,
            blockchainTxId: blockchainTxId  // Save blockchain transaction ID (MANDATORY - always required)
        });

        // Update transfer request status with proper transition
        // If we need to transition through APPROVED first, do it now
        if (needsApprovalTransition) {
            await db.updateTransferRequestStatus(id, TRANSFER_STATUS.APPROVED, req.user.userId, null, {
                approvedAt: new Date().toISOString(),
                notes: notes || null
            });
            console.log(`✅ [Phase 3] Transitioned transfer status: ${currentStatus} → ${TRANSFER_STATUS.APPROVED}`);
        }

        // Now transition to COMPLETED
        await db.updateTransferRequestStatus(id, TRANSFER_STATUS.COMPLETED, req.user.userId, null, {
            blockchainTxId,
            approvedAt: new Date().toISOString(),
            notes: notes || null
        });
        console.log(`✅ [Phase 3] Transitioned transfer status: ${needsApprovalTransition ? TRANSFER_STATUS.APPROVED : currentStatus} → ${TRANSFER_STATUS.COMPLETED}`);
        try {
            const buyerDocs = await db.getTransferRequestDocuments(id);
            const buyerDocIds = buyerDocs
                .filter(td => td.document_type && td.document_type.startsWith('buyer_') && td.document_id)
                .map(td => td.document_id)
                .filter(Boolean);

            if (buyerDocIds.length > 0) {
                await dbModule.query(
                    `UPDATE documents 
                     SET vehicle_id = $1
                     WHERE id = ANY($2::uuid[])`,
                    [request.vehicle_id, buyerDocIds]
                );
                console.log(`[Transfer Approval] Linked ${buyerDocIds.length} buyer document(s) to vehicle ${request.vehicle_id}`);
            }

            // Mark old owner's documents as inactive (keep for blockchain history but mark as previous owner)
            // Note: This assumes documents table has an is_active column. If not, skip this step.
            try {
                await dbModule.query(
                    `UPDATE documents 
                     SET is_active = false
                     WHERE vehicle_id = $1 AND uploaded_by = $2 AND (is_active IS NULL OR is_active = true)`,
                    [request.vehicle_id, request.seller_id]
                );
                console.log(`[Transfer Approval] Marked old owner's documents as inactive for vehicle ${request.vehicle_id}`);
            } catch (inactiveError) {
                // Column might not exist, that's okay - just log and continue
                console.log(`[Transfer Approval] Note: Could not mark old documents as inactive (column may not exist): ${inactiveError.message}`);
            }
        } catch (docLinkError) {
            console.error(`[Transfer Approval] Failed to link buyer documents to vehicle:`, docLinkError.message);
            // Don't fail the transfer approval if document linking fails
        }

        // Transfer package generation removed - not needed per requirements
        // Seller: Deed of Sale, ID
        // Buyer: MVIR, HPG, Insurance (CTPL), ID, TIN
        // OR/CR is auto-linked to vehicle
        /*
        let generatedPackage = null;
        try {
            generatedPackage = await transferDocumentGenerator.generateTransferPackage({
                transferRequest: request,
                vehicle,
                seller: {
                    name: previousOwner ? `${previousOwner.first_name} ${previousOwner.last_name}` : 'Unknown',
                    email: previousOwner?.email
                },
                buyer: {
                    name: newOwner ? `${newOwner.first_name} ${newOwner.last_name}` : 'Unknown',
                    email: newOwner?.email
                },
                deadline: request.expires_at
            });

            const documentRecord = await db.createDocument({
                vehicleId: request.vehicle_id,
                documentType: docTypes.DB_TYPES.TRANSFER_PACKAGE,
                filename: generatedPackage.filename,
                originalName: generatedPackage.filename,
                filePath: generatedPackage.filePath,
                fileSize: generatedPackage.fileSize,
                mimeType: generatedPackage.mimeType,
                fileHash: generatedPackage.fileHash,
                uploadedBy: req.user.userId
            });

            await dbModule.query(
                `INSERT INTO transfer_documents (transfer_request_id, document_type, document_id, uploaded_by)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT DO NOTHING`,
                [id, docTypes.TRANSFER_ROLES.TRANSFER_PACKAGE, documentRecord.id, req.user.userId]
            );
        } catch (packageError) {
            console.warn('⚠️ Failed to generate transfer package document:', packageError.message);
        }
        */

        // Get full owner details for history (after vehicle update)
        const previousOwner = await db.getUserById(request.seller_id);
        const newOwner = await db.getUserById(buyerId);

        // PHASE 3: Add TRANSFER_COMPLETED history entry with standardized action name
        // This represents the completion of the transfer workflow (separate from blockchain entry)
        await db.addVehicleHistory({
            vehicleId: request.vehicle_id,
            action: TRANSFER_ACTIONS.COMPLETED, // PHASE 3: Use standardized action constant
            description: `Transfer completed: Ownership transferred from ${previousOwner ? `${previousOwner.first_name} ${previousOwner.last_name}` : 'Unknown'} to ${newOwner ? `${newOwner.first_name} ${newOwner.last_name}` : 'Unknown'}`,
            performedBy: req.user.userId,
            transactionId: blockchainTxId,
            metadata: {
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
            }
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
// STRICT: Allow admin, lto_admin, and lto_officer (all LTO staff can reject transfers)
router.post('/requests/:id/reject', authenticateToken, authorizeRole(['admin', 'lto_admin', 'lto_officer']), async (req, res) => {
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

        if (request.status === TRANSFER_STATUS.COMPLETED) {
            return res.status(400).json({
                success: false,
                error: 'Cannot reject an already approved or completed request'
            });
        }

        // Update transfer request status
        await db.updateTransferRequestStatus(id, TRANSFER_STATUS.REJECTED, req.user.userId, reason);

        // Clear HPG/Insurance clearance request IDs and supersede old clearance requests so resubmission can auto-forward again (same fix as initial registration resubmission)
        try {
            const dbModule = require('../database/db');
            if (request.hpg_clearance_request_id || request.insurance_clearance_request_id) {
                const idsToSupersede = [request.hpg_clearance_request_id, request.insurance_clearance_request_id].filter(Boolean);
                if (idsToSupersede.length > 0) {
                    await dbModule.query(
                        `UPDATE clearance_requests SET status = 'REJECTED', notes = COALESCE(notes, '') || ' Superseded by transfer rejection.'
                         WHERE id = ANY($1::uuid[]) AND status IN ('PENDING', 'SENT')`,
                        [idsToSupersede]
                    );
                }
                await dbModule.query(
                    `UPDATE transfer_requests SET hpg_clearance_request_id = NULL, insurance_clearance_request_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
                    [id]
                );
                console.log(`[Transfer Reject] Cleared clearance request IDs for transfer ${id} so resubmission can forward again`);
            }
        } catch (clearErr) {
            console.warn('⚠️ Failed to clear transfer clearance request IDs (non-blocking):', clearErr.message);
        }

        try {
            await db.updateVehicle(request.vehicle_id, { status: VEHICLE_STATUS.REGISTERED });
        } catch (statusErr) {
            console.warn('⚠️ Failed to revert vehicle status after admin rejection:', statusErr.message);
        }

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

        // Send email notification to seller
        try {
            const vehicle = await db.getVehicleById(request.vehicle_id);
            const sellerEmail = request.seller_email;
            const sellerName = request.seller_first_name && request.seller_last_name
                ? `${request.seller_first_name} ${request.seller_last_name}`
                : sellerEmail || 'Vehicle Owner';

            if (sellerEmail) {
                const gmailApiService = require('../services/gmailApiService');
                const appUrl = process.env.APP_URL || 'http://localhost:3000';
                const dashboardUrl = `${appUrl}/owner-dashboard.html`;

                const subject = 'Transfer Request Rejected - TrustChain LTO';
                const html = `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #d32f2f;">Transfer Request Rejected</h2>
                        <p>Dear ${sellerName},</p>
                        <p>We regret to inform you that your vehicle ownership transfer request has been <strong>rejected</strong>.</p>
                        
                        <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 1rem; margin: 1rem 0;">
                            <h3 style="margin-top: 0; color: #856404;">Vehicle Details</h3>
                            ${vehicle ? `
                                <p style="margin: 0.5rem 0;"><strong>VIN:</strong> ${vehicle.vin || 'N/A'}</p>
                                ${vehicle.plate_number ? `<p style="margin: 0.5rem 0;"><strong>Plate Number:</strong> ${vehicle.plate_number}</p>` : ''}
                                ${vehicle.make ? `<p style="margin: 0.5rem 0;"><strong>Make:</strong> ${vehicle.make}</p>` : ''}
                                ${vehicle.model ? `<p style="margin: 0.5rem 0;"><strong>Model:</strong> ${vehicle.model}</p>` : ''}
                            ` : '<p>Vehicle details not available</p>'}
                        </div>
                        
                        <div style="background: #f8d7da; border-left: 4px solid #dc3545; padding: 1rem; margin: 1rem 0;">
                            <h3 style="margin-top: 0; color: #721c24;">Reason for Rejection</h3>
                            <p style="margin: 0; white-space: pre-wrap;">${reason}</p>
                        </div>
                        
                        <div style="background: #e7f3ff; border-left: 4px solid #2196f3; padding: 1rem; margin: 1rem 0;">
                            <h3 style="margin-top: 0; color: #0d47a1;">What You Can Do</h3>
                            <p>If you believe this rejection was made in error, or if you can address the issues mentioned above:</p>
                            <ol>
                                <li>Review the rejection reason carefully</li>
                                <li>Log into your TrustChain account</li>
                                <li>Go to your vehicle dashboard</li>
                                <li>If documents need updating, click the "Update Document" button next to the relevant document</li>
                                <li>Upload corrected documents if needed</li>
                                <li>Contact LTO Lipa City if you have questions</li>
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
Transfer Request Rejected - TrustChain LTO

Dear ${sellerName},

We regret to inform you that your vehicle ownership transfer request has been REJECTED.

Vehicle Details:
${vehicle ? `
- VIN: ${vehicle.vin || 'N/A'}
${vehicle.plate_number ? `- Plate Number: ${vehicle.plate_number}` : ''}
${vehicle.make ? `- Make: ${vehicle.make}` : ''}
${vehicle.model ? `- Model: ${vehicle.model}` : ''}
` : 'Vehicle details not available'}

Reason for Rejection:
${reason}

What You Can Do:
1. Review the rejection reason carefully
2. Log into your TrustChain account
3. Go to your vehicle dashboard
4. If documents need updating, click the "Update Document" button next to the relevant document
5. Upload corrected documents if needed
6. Contact LTO Lipa City if you have questions

Dashboard: ${dashboardUrl}

If you have any questions, please contact LTO Lipa City.

Best regards,
LTO Lipa City Team
                `;

                await gmailApiService.sendMail({
                    to: sellerEmail,
                    subject,
                    text,
                    html
                });

                console.log(`✅ Rejection email sent to seller ${sellerEmail} for transfer request ${id}`);
            }
        } catch (emailError) {
            console.error('❌ Failed to send rejection email:', emailError);
            // Don't fail the request if email fails
        }

        // Send email notification to buyer if buyer email exists
        try {
            const buyerEmail = request.buyer_email;
            if (buyerEmail && buyerEmail !== request.seller_email) {
                const vehicle = await db.getVehicleById(request.vehicle_id);
                const buyerName = request.buyer_first_name && request.buyer_last_name
                    ? `${request.buyer_first_name} ${request.buyer_last_name}`
                    : buyerEmail;

                const gmailApiService = require('../services/gmailApiService');
                const appUrl = process.env.APP_URL || 'http://localhost:3000';
                const dashboardUrl = `${appUrl}/my-vehicle-ownership.html`;

                const subject = 'Transfer Request Rejected - TrustChain LTO';
                const html = `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #d32f2f;">Transfer Request Rejected</h2>
                        <p>Dear ${buyerName},</p>
                        <p>The vehicle ownership transfer request you were involved in has been <strong>rejected</strong>.</p>
                        
                        <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 1rem; margin: 1rem 0;">
                            <h3 style="margin-top: 0; color: #856404;">Vehicle Details</h3>
                            ${vehicle ? `
                                <p style="margin: 0.5rem 0;"><strong>VIN:</strong> ${vehicle.vin || 'N/A'}</p>
                                ${vehicle.plate_number ? `<p style="margin: 0.5rem 0;"><strong>Plate Number:</strong> ${vehicle.plate_number}</p>` : ''}
                                ${vehicle.make ? `<p style="margin: 0.5rem 0;"><strong>Make:</strong> ${vehicle.make}</p>` : ''}
                                ${vehicle.model ? `<p style="margin: 0.5rem 0;"><strong>Model:</strong> ${vehicle.model}</p>` : ''}
                            ` : '<p>Vehicle details not available</p>'}
                        </div>
                        
                        <div style="background: #f8d7da; border-left: 4px solid #dc3545; padding: 1rem; margin: 1rem 0;">
                            <h3 style="margin-top: 0; color: #721c24;">Reason for Rejection</h3>
                            <p style="margin: 0; white-space: pre-wrap;">${reason}</p>
                        </div>
                        
                        <p style="margin-top: 2rem; color: #666; font-size: 0.9rem;">
                            Please contact the seller or LTO Lipa City if you have any questions.
                        </p>
                        
                        <p style="margin-top: 1rem;">
                            Best regards,<br>
                            <strong>LTO Lipa City Team</strong>
                        </p>
                    </div>
                `;

                const text = `
Transfer Request Rejected - TrustChain LTO

Dear ${buyerName},

The vehicle ownership transfer request you were involved in has been REJECTED.

Vehicle Details:
${vehicle ? `
- VIN: ${vehicle.vin || 'N/A'}
${vehicle.plate_number ? `- Plate Number: ${vehicle.plate_number}` : ''}
${vehicle.make ? `- Make: ${vehicle.make}` : ''}
${vehicle.model ? `- Model: ${vehicle.model}` : ''}
` : 'Vehicle details not available'}

Reason for Rejection:
${reason}

Please contact the seller or LTO Lipa City if you have any questions.

Best regards,
LTO Lipa City Team
                `;

                await gmailApiService.sendMail({
                    to: buyerEmail,
                    subject,
                    text,
                    html
                });

                console.log(`✅ Rejection email sent to buyer ${buyerEmail} for transfer request ${id}`);
            }
        } catch (emailError) {
            console.error('❌ Failed to send rejection email to buyer:', emailError);
            // Don't fail the request if email fails
        }

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
// STRICT: Allow admin, lto_admin, and lto_officer (all LTO staff can forward to HPG)
router.post('/requests/:id/forward-hpg', authenticateToken, authorizeRole(['admin', 'lto_admin', 'lto_officer']), async (req, res) => {
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

        const { clearanceRequest, updatedRequest } = await forwardTransferToHPG({
            request,
            requestedBy: req.user.userId,
            purpose,
            notes,
            autoTriggered: false
        });

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

// Re-run MVIR auto-verification (LTO-side) for a transfer request
// STRICT: Allow admin, lto_admin, and lto_officer (all LTO staff can verify MVIR)
router.post('/requests/:id/verify-mvir', authenticateToken, authorizeRole(['admin', 'lto_admin', 'lto_officer']), async (req, res) => {
    try {
        const { id } = req.params;

        const request = await db.getTransferRequestById(id);
        if (!request) {
            return res.status(404).json({
                success: false,
                error: 'Transfer request not found'
            });
        }

        // Do not allow changes once the transfer is finalized
        if (['APPROVED', 'COMPLETED', 'REJECTED'].includes(request.status)) {
            return res.status(400).json({
                success: false,
                error: 'Cannot re-run MVIR verification for a finalized transfer request'
            });
        }

        const vehicle = await db.getVehicleById(request.vehicle_id);
        if (!vehicle) {
            return res.status(404).json({
                success: false,
                error: 'Vehicle not found'
            });
        }



        // Persist to transfer_requests.metadata for UI display
        const dbModule = require('../database/db');
        const patch = {
            mvirAutoVerification: {
                status: result.status,
                automated: result.automated,
                reason: result.reason,
                verifiedAt: new Date().toISOString(),
                confidence: result.confidence
            }
        };

        await dbModule.query(
            `UPDATE transfer_requests
             SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [JSON.stringify(patch), id]
        );

        const updatedRequest = await db.getTransferRequestById(id);

        return res.json({
            success: true,
            message: 'MVIR verification completed',
            result,
            transferRequest: updatedRequest
        });
    } catch (error) {
        console.error('Verify MVIR error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Verify document for transfer request
// STRICT: Allow admin, lto_admin, and lto_officer (all LTO staff can verify documents)
router.post('/requests/:id/documents/:docId/verify', authenticateToken, authorizeRole(['admin', 'lto_admin', 'lto_officer']), async (req, res) => {
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
// STRICT: Allow admin and lto_admin only (bulk operations are admin-level)
router.post('/requests/bulk-approve', authenticateToken, authorizeRole(['admin', 'lto_admin']), async (req, res) => {
    try {
        const { requestIds } = req.body;

        if (!Array.isArray(requestIds) || requestIds.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'requestIds array is required'
            });
        }

        return res.status(400).json({
            success: false,
            error: 'Bulk approve is not supported for the gated transfer flow. Please approve individually to ensure ownership, documents, and blockchain updates are applied correctly.'
        });

        const results = [];
        const errors = [];

        for (const requestId of requestIds) {
            try {
                const request = await db.getTransferRequestById(requestId);
                if (!request) {
                    errors.push({ requestId, error: 'Request not found' });
                    continue;
                }

                if (![TRANSFER_STATUS.PENDING, TRANSFER_STATUS.AWAITING_BUYER_DOCS, TRANSFER_STATUS.UNDER_REVIEW].includes(request.status)) {
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
// STRICT: Allow admin and lto_admin only (bulk operations are admin-level)
router.post('/requests/bulk-reject', authenticateToken, authorizeRole(['admin', 'lto_admin']), async (req, res) => {
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

// Forward transfer request to Insurance
// STRICT: Allow admin, lto_admin, and lto_officer (all LTO staff can forward to Insurance)
router.post('/requests/:id/forward-insurance', authenticateToken, authorizeRole(['admin', 'lto_admin', 'lto_officer']), async (req, res) => {
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

        const { clearanceRequest, updatedRequest } = await forwardTransferToInsurance({
            request,
            requestedBy: req.user.userId,
            purpose,
            notes,
            autoTriggered: false
        });

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

// Link document to transfer request (for document updates)
router.post('/requests/:id/link-document', authenticateToken, authorizeRole(['vehicle_owner', 'admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { documents } = req.body;

        if (!documents || typeof documents !== 'object') {
            return res.status(400).json({
                success: false,
                error: 'Documents object is required'
            });
        }

        const request = await db.getTransferRequestById(id);
        if (!request) {
            return res.status(404).json({
                success: false,
                error: 'Transfer request not found'
            });
        }

        // Check permissions - user must be seller OR buyer
        const isSeller = req.user.role === 'vehicle_owner' && String(request.seller_id) === String(req.user.userId);
        const buyerInfo = request.buyer_info;
        const buyerId = request.buyer_id || request.buyer_user_id;
        const isBuyer = buyerId && String(buyerId) === String(req.user.userId);
        const isBuyerByEmail = !buyerId && buyerInfo && buyerInfo.email && buyerInfo.email.toLowerCase() === req.user.email.toLowerCase();

        if (req.user.role === 'vehicle_owner' && !isSeller && !isBuyer && !isBuyerByEmail) {
            return res.status(403).json({
                success: false,
                error: 'Access denied. You must be the seller or buyer for this transfer request.'
            });
        }

        // Link documents using the existing linkTransferDocuments function
        await linkTransferDocuments({
            transferRequestId: id,
            documents: documents,
            uploadedBy: req.user.userId
        });

        res.json({
            success: true,
            message: 'Document linked to transfer request successfully'
        });

    } catch (error) {
        console.error('Link document to transfer request error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router;
