// TrustChain LTO - HPG Admin Routes
// Handles HPG clearance verification and certificate release

const express = require('express');
const router = express.Router();
const db = require('../database/services');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const storageService = require('../services/storageService');

// Get all HPG clearance requests
router.get('/requests', authenticateToken, authorizeRole(['admin', 'hpg_admin']), async (req, res) => {
    try {
        const { status } = req.query;
        
        let requests;
        if (status) {
            requests = await db.getClearanceRequestsByStatus(status);
        } else {
            requests = await db.getClearanceRequestsByType('hpg');
        }

        res.json({
            success: true,
            requests: requests,
            total: requests.length
        });

    } catch (error) {
        console.error('Error getting HPG requests:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get HPG requests: ' + error.message
        });
    }
});

// Get single HPG request by ID
router.get('/requests/:id', authenticateToken, authorizeRole(['admin', 'hpg_admin']), async (req, res) => {
    try {
        const { id } = req.params;
        
        const request = await db.getClearanceRequestById(id);
        if (!request || request.request_type !== 'hpg') {
            return res.status(404).json({
                success: false,
                error: 'HPG clearance request not found'
            });
        }

        // Get vehicle details
        const vehicle = await db.getVehicleById(request.vehicle_id);
        const certificates = await db.getCertificatesByRequest(id);

        res.json({
            success: true,
            request: {
                ...request,
                vehicle,
                certificates
            }
        });

    } catch (error) {
        console.error('Error getting HPG request:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get HPG request: ' + error.message
        });
    }
});

// Approve HPG verification
router.post('/verify/approve', authenticateToken, authorizeRole(['admin', 'hpg_admin']), async (req, res) => {
    try {
        const { requestId, engineNumber, chassisNumber, macroEtching, photos, stencil, remarks } = req.body;
        
        if (!requestId) {
            return res.status(400).json({
                success: false,
                error: 'Request ID is required'
            });
        }

        const clearanceRequest = await db.getClearanceRequestById(requestId);
        if (!clearanceRequest || clearanceRequest.request_type !== 'hpg') {
            return res.status(404).json({
                success: false,
                error: 'HPG clearance request not found'
            });
        }

        // Update clearance request status
        const updatedRequest = await db.updateClearanceRequestStatus(requestId, 'APPROVED', {
            engineNumber,
            chassisNumber,
            macroEtching: macroEtching || false,
            photos: photos || [],
            stencil: stencil || null,
            remarks: remarks || null,
            verifiedBy: req.user.userId,
            verifiedAt: new Date().toISOString()
        });

        // Assign to current user if not already assigned
        if (!clearanceRequest.assigned_to) {
            await db.assignClearanceRequest(requestId, req.user.userId);
        }

        // Update vehicle verification status (if vehicle_verifications table supports hpg)
        // For now, we'll just update the clearance request

        // Add to vehicle history
        await db.addVehicleHistory({
            vehicleId: clearanceRequest.vehicle_id,
            action: 'HPG_VERIFICATION_APPROVED',
            description: `HPG verification approved by ${req.user.email}. ${remarks || ''}`,
            performedBy: req.user.userId,
            transactionId: null,
            metadata: {
                clearanceRequestId,
                engineNumber,
                chassisNumber,
                macroEtching
            }
        });

        // Create notification for LTO admin
        const vehicle = await db.getVehicleById(clearanceRequest.vehicle_id);
        const dbModule = require('../database/db');
        const ltoAdmins = await dbModule.query(
            "SELECT id FROM users WHERE role = 'admin' LIMIT 1"
        );
        if (ltoAdmins.rows.length > 0) {
            await db.createNotification({
                userId: ltoAdmins.rows[0].id,
                title: 'HPG Verification Approved',
                message: `HPG verification approved for vehicle ${vehicle.plate_number || vehicle.vin}`,
                type: 'success'
            });
        }

        res.json({
            success: true,
            message: 'HPG verification approved successfully',
            request: updatedRequest
        });

    } catch (error) {
        console.error('Error approving HPG verification:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to approve HPG verification: ' + error.message
        });
    }
});

// Reject HPG verification
router.post('/verify/reject', authenticateToken, authorizeRole(['admin', 'hpg_admin']), async (req, res) => {
    try {
        const { requestId, reason } = req.body;
        
        if (!requestId || !reason) {
            return res.status(400).json({
                success: false,
                error: 'Request ID and reason are required'
            });
        }

        const clearanceRequest = await db.getClearanceRequestById(requestId);
        if (!clearanceRequest || clearanceRequest.request_type !== 'hpg') {
            return res.status(404).json({
                success: false,
                error: 'HPG clearance request not found'
            });
        }

        // Update clearance request status
        const updatedRequest = await db.updateClearanceRequestStatus(requestId, 'REJECTED', {
            rejectionReason: reason,
            rejectedBy: req.user.userId,
            rejectedAt: new Date().toISOString()
        });

        // Add to vehicle history
        await db.addVehicleHistory({
            vehicleId: clearanceRequest.vehicle_id,
            action: 'HPG_VERIFICATION_REJECTED',
            description: `HPG verification rejected by ${req.user.email}. Reason: ${reason}`,
            performedBy: req.user.userId,
            transactionId: null,
            metadata: {
                clearanceRequestId,
                reason
            }
        });

        // Create notification for LTO admin
        const vehicle = await db.getVehicleById(clearanceRequest.vehicle_id);
        const dbModule = require('../database/db');
        const ltoAdmins = await dbModule.query(
            "SELECT id FROM users WHERE role = 'admin' LIMIT 1"
        );
        if (ltoAdmins.rows.length > 0) {
            await db.createNotification({
                userId: ltoAdmins.rows[0].id,
                title: 'HPG Verification Rejected',
                message: `HPG verification rejected for vehicle ${vehicle.plate_number || vehicle.vin}. Reason: ${reason}`,
                type: 'warning'
            });
        }

        res.json({
            success: true,
            message: 'HPG verification rejected',
            request: updatedRequest
        });

    } catch (error) {
        console.error('Error rejecting HPG verification:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to reject HPG verification: ' + error.message
        });
    }
});

// Release certificate
router.post('/certificate/release', authenticateToken, authorizeRole(['admin', 'hpg_admin']), async (req, res) => {
    try {
        const { requestId, certificateNumber, certificateFile } = req.body;
        
        if (!requestId || !certificateNumber) {
            return res.status(400).json({
                success: false,
                error: 'Request ID and certificate number are required'
            });
        }

        const clearanceRequest = await db.getClearanceRequestById(requestId);
        if (!clearanceRequest || clearanceRequest.request_type !== 'hpg') {
            return res.status(404).json({
                success: false,
                error: 'HPG clearance request not found'
            });
        }

        if (clearanceRequest.status !== 'APPROVED') {
            return res.status(400).json({
                success: false,
                error: 'Cannot release certificate. Verification must be approved first.'
            });
        }

        // Upload certificate file to storage (IPFS or local)
        let filePath = null;
        let ipfsCid = null;
        
        if (certificateFile) {
            try {
                // If it's a base64 file, decode and upload
                if (certificateFile.startsWith('data:')) {
                    const fileBuffer = Buffer.from(certificateFile.split(',')[1], 'base64');
                    const fileName = `hpg_certificate_${certificateNumber}_${Date.now()}.pdf`;
                    
                    // Upload to storage service
                    const uploadResult = await storageService.uploadFile(fileBuffer, fileName, 'application/pdf');
                    filePath = uploadResult.path || uploadResult.filePath;
                    ipfsCid = uploadResult.cid || uploadResult.ipfsCid;
                }
            } catch (uploadError) {
                console.error('Error uploading certificate file:', uploadError);
                // Continue without file path if upload fails
            }
        }

        // Create certificate record
        const certificate = await db.createCertificate({
            clearanceRequestId: requestId,
            vehicleId: clearanceRequest.vehicle_id,
            certificateType: 'hpg_clearance',
            certificateNumber,
            filePath,
            ipfsCid,
            issuedBy: req.user.userId,
            expiresAt: null, // Set expiration if needed
            metadata: {
                certificateNumber,
                issuedAt: new Date().toISOString()
            }
        });

        // Update clearance request status to COMPLETED
        await db.updateClearanceRequestStatus(requestId, 'COMPLETED');

        // Add to vehicle history
        await db.addVehicleHistory({
            vehicleId: clearanceRequest.vehicle_id,
            action: 'HPG_CERTIFICATE_RELEASED',
            description: `HPG clearance certificate released by ${req.user.email}. Certificate #: ${certificateNumber}`,
            performedBy: req.user.userId,
            transactionId: null,
            metadata: {
                clearanceRequestId: requestId,
                certificateId: certificate.id,
                certificateNumber
            }
        });

        // Create notification for LTO admin
        const vehicle = await db.getVehicleById(clearanceRequest.vehicle_id);
        const dbModule = require('../database/db');
        const ltoAdmins = await dbModule.query(
            "SELECT id FROM users WHERE role = 'admin' LIMIT 1"
        );
        if (ltoAdmins.rows.length > 0) {
            await db.createNotification({
                userId: ltoAdmins.rows[0].id,
                title: 'HPG Certificate Released',
                message: `HPG clearance certificate released for vehicle ${vehicle.plate_number || vehicle.vin}`,
                type: 'success'
            });
        }

        res.json({
            success: true,
            message: 'Certificate released successfully',
            certificate,
            requestId
        });

    } catch (error) {
        console.error('Error releasing certificate:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to release certificate: ' + error.message
        });
    }
});

module.exports = router;

