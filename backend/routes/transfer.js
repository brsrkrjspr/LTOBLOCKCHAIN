// TrustChain LTO - Transfer of Ownership Routes
// Handles transfer request management, approval, and verification

const express = require('express');
const router = express.Router();
const db = require('../database/services');
const { authenticateToken } = require('../middleware/auth');
const { authorizeRole } = require('../middleware/authorize');
const fabricService = require('../services/optimizedFabricService');

// Create transfer request (owner submits)
router.post('/requests', authenticateToken, authorizeRole(['vehicle_owner', 'admin']), async (req, res) => {
    try {
        const { vehicleId, buyerId, buyerInfo, documentIds } = req.body;
        
        if (!vehicleId) {
            return res.status(400).json({
                success: false,
                error: 'Vehicle ID is required'
            });
        }
        
        if (!buyerId && !buyerInfo) {
            return res.status(400).json({
                success: false,
                error: 'Either buyer ID or buyer information is required'
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
        
        // Check if there's already a pending transfer request for this vehicle
        const existingRequests = await db.getTransferRequests({ vehicleId, status: 'PENDING' });
        if (existingRequests.length > 0) {
            return res.status(409).json({
                success: false,
                error: 'A pending transfer request already exists for this vehicle',
                existingRequestId: existingRequests[0].id
            });
        }
        
        // Create transfer request
        const transferRequest = await db.createTransferRequest({
            vehicleId,
            sellerId: req.user.userId,
            buyerId: buyerId || null,
            buyerInfo: buyerInfo || null,
            metadata: {}
        });
        
        // Link documents if provided
        if (documentIds && Array.isArray(documentIds) && documentIds.length > 0) {
            const dbModule = require('../database/db');
            for (const docId of documentIds) {
                // Determine document type from document
                const document = await db.getDocumentById(docId);
                if (document) {
                    let docType = 'other';
                    if (document.document_type === 'owner_id') {
                        // Check if it's seller or buyer ID based on uploader
                        docType = String(document.uploaded_by) === String(req.user.userId) ? 'seller_id' : 'buyer_id';
                    } else if (document.document_type === 'registration_cert') {
                        docType = 'or_cr';
                    }
                    
                    await dbModule.query(
                        `INSERT INTO transfer_documents (transfer_request_id, document_type, document_id, uploaded_by)
                         VALUES ($1, $2, $3, $4)`,
                        [transferRequest.id, docType, docId, req.user.userId]
                    );
                }
            }
        }
        
        // Add to vehicle history
        await db.addVehicleHistory({
            vehicleId,
            action: 'TRANSFER_REQUESTED',
            description: `Transfer request submitted by ${req.user.email}`,
            performedBy: req.user.userId,
            transactionId: null,
            metadata: { transferRequestId: transferRequest.id }
        });
        
        // Get full request with relations
        const fullRequest = await db.getTransferRequestById(transferRequest.id);
        
        res.status(201).json({
            success: true,
            message: 'Transfer request created successfully',
            transferRequest: fullRequest
        });
        
    } catch (error) {
        console.error('Create transfer request error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: process.env.NODE_ENV === 'development' ? error.message : 'Failed to create transfer request'
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
        
        const requests = await db.getTransferRequests(filters);
        
        // Get total count for pagination
        const dbModule = require('../database/db');
        let countQuery = 'SELECT COUNT(*) FROM transfer_requests WHERE 1=1';
        const countParams = [];
        let paramCount = 0;
        
        if (status) {
            paramCount++;
            countQuery += ` AND status = $${paramCount}`;
            countParams.push(status);
        }
        
        if (req.user.role === 'vehicle_owner') {
            paramCount++;
            countQuery += ` AND seller_id = $${paramCount}`;
            countParams.push(req.user.userId);
        }
        
        const countResult = await dbModule.query(countQuery, countParams);
        const totalCount = parseInt(countResult.rows[0].count);
        
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

// Get transfer request statistics
router.get('/requests/stats', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const dbModule = require('../database/db');
        
        const stats = {
            total: 0,
            pending: 0,
            reviewing: 0,
            approved: 0,
            rejected: 0,
            completed: 0,
            forwarded_to_hpg: 0
        };
        
        const result = await dbModule.query(
            `SELECT status, COUNT(*) as count 
             FROM transfer_requests 
             GROUP BY status`
        );
        
        result.rows.forEach(row => {
            stats.total += parseInt(row.count);
            const status = row.status.toLowerCase();
            // Handle both snake_case and camelCase status values
            if (status === 'forwarded_to_hpg' || status === 'forwardedtohpg') {
                stats.forwarded_to_hpg = parseInt(row.count);
            } else if (stats.hasOwnProperty(status)) {
                stats[status] = parseInt(row.count);
            }
        });
        
        res.json({
            success: true,
            stats
        });
        
    } catch (error) {
        console.error('Get transfer stats error:', error);
        console.error('Error details:', error.message, error.stack);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: process.env.NODE_ENV === 'development' ? error.message : 'Failed to retrieve transfer statistics'
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
        
        if (request.status !== 'PENDING' && request.status !== 'REVIEWING') {
            return res.status(400).json({
                success: false,
                error: `Cannot approve request with status: ${request.status}`
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
        
        // Update vehicle ownership
        await db.updateVehicle(request.vehicle_id, { ownerId: buyerId });
        
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
        
        // Add to vehicle history
        await db.addVehicleHistory({
            vehicleId: request.vehicle_id,
            action: 'OWNERSHIP_TRANSFERRED',
            description: `Ownership transferred via transfer request ${id}. Approved by ${req.user.email}`,
            performedBy: req.user.userId,
            transactionId: blockchainTxId,
            metadata: {
                transferRequestId: id,
                previousOwnerId: request.seller_id,
                newOwnerId: buyerId,
                approvedBy: req.user.userId
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
        
        // Create HPG clearance request
        const clearanceRequest = await db.createClearanceRequest({
            vehicleId: request.vehicle_id,
            requestType: 'hpg',
            requestedBy: req.user.userId,
            purpose: purpose || 'Vehicle ownership transfer clearance',
            notes: notes || null,
            metadata: {
                transferRequestId: id,
                vehicleVin: request.vehicle.vin,
                vehiclePlate: request.vehicle.plate_number
            }
        });
        
        // Update transfer request
        const dbModule = require('../database/db');
        await dbModule.query(
            `UPDATE transfer_requests 
             SET forwarded_to_hpg = true, 
                 hpg_clearance_request_id = $1,
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
            metadata: { transferRequestId: id, clearanceRequestId: clearanceRequest.id }
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
        
        // Update document verification status
        await db.verifyDocument(docId, status === 'APPROVED', req.user.userId);
        
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
        console.error('Verify document error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
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

module.exports = router;

