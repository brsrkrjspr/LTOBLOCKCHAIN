// TrustChain LTO - Emission Verifier Routes
// Handles emission verification workflow

const express = require('express');
const router = express.Router();
const db = require('../database/services');
const { authenticateToken } = require('../middleware/auth');
const { authorizeRole } = require('../middleware/authorize');

// Get all emission verification requests
router.get('/requests', authenticateToken, authorizeRole(['admin', 'emission_verifier']), async (req, res) => {
    try {
        const { status } = req.query;
        const requests = status 
            ? await db.getClearanceRequestsByStatus(status)
            : await db.getClearanceRequestsByType('emission');

        res.json({
            success: true,
            requests: requests.filter(r => r.request_type === 'emission'),
            total: requests.filter(r => r.request_type === 'emission').length
        });
    } catch (error) {
        console.error('Error getting emission requests:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get emission requests: ' + error.message
        });
    }
});

// Get single emission verification request
router.get('/requests/:id', authenticateToken, authorizeRole(['admin', 'emission_verifier']), async (req, res) => {
    try {
        const { id } = req.params;
        
        const request = await db.getClearanceRequestById(id);
        if (!request || request.request_type !== 'emission') {
            return res.status(404).json({
                success: false,
                error: 'Emission clearance request not found'
            });
        }

        // Get vehicle details
        const vehicle = await db.getVehicleById(request.vehicle_id);
        
        // Extract documents from metadata (filtered by LTO)
        // Emission should ONLY see documents that were explicitly included in metadata.documents
        const metadata = request.metadata || {};
        const documents = metadata.documents || [];
        
        console.log(`[Emission] Returning ${documents.length} document(s) from metadata (filtered by LTO)`);
        console.log(`[Emission] Document types: ${documents.map(d => d.type).join(', ')}`);

        res.json({
            success: true,
            request: {
                ...request,
                vehicle,
                documents: documents // Return filtered documents
            }
        });

    } catch (error) {
        console.error('Error getting Emission request:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get Emission request: ' + error.message
        });
    }
});

// Approve emission verification
router.post('/verify/approve', authenticateToken, authorizeRole(['admin', 'emission_verifier']), async (req, res) => {
    try {
        const { requestId, notes, testResult } = req.body;
        
        if (!requestId) {
            return res.status(400).json({ success: false, error: 'Request ID is required' });
        }

        const request = await db.getClearanceRequestById(requestId);
        if (!request || request.request_type !== 'emission') {
            return res.status(404).json({ success: false, error: 'Emission request not found' });
        }

        await db.updateClearanceRequestStatus(requestId, 'APPROVED', {
            verifiedBy: req.user.userId,
            verifiedAt: new Date().toISOString(),
            notes,
            testResult
        });

        // Update transfer request approval status if this clearance request is linked to a transfer request
        const dbModule = require('../database/db');
        const transferRequests = await dbModule.query(
            `SELECT id FROM transfer_requests WHERE emission_clearance_request_id = $1`,
            [requestId]
        );

        if (transferRequests.rows.length > 0) {
            for (const tr of transferRequests.rows) {
                await dbModule.query(
                    `UPDATE transfer_requests 
                     SET emission_approval_status = 'APPROVED',
                         emission_approved_at = CURRENT_TIMESTAMP,
                         emission_approved_by = $1,
                         updated_at = CURRENT_TIMESTAMP
                     WHERE id = $2`,
                    [req.user.userId, tr.id]
                );
                
                // Add to vehicle history for the transfer request
                const transferRequest = await db.getTransferRequestById(tr.id);
                if (transferRequest) {
                    await db.addVehicleHistory({
                        vehicleId: transferRequest.vehicle_id,
                        action: 'TRANSFER_EMISSION_APPROVED',
                        description: `Emission approved transfer request ${tr.id} via clearance request ${requestId}`,
                        performedBy: req.user.userId,
                        metadata: { 
                            transferRequestId: tr.id, 
                            clearanceRequestId: requestId,
                            notes: notes || null 
                        }
                    });
                }
            }
            console.log(`✅ Updated ${transferRequests.rows.length} transfer request(s) with Emission approval`);
        }

        await db.updateVerificationStatus(request.vehicle_id, 'emission', 'APPROVED', req.user.userId, notes);

        await db.addVehicleHistory({
            vehicleId: request.vehicle_id,
            action: 'EMISSION_VERIFICATION_APPROVED',
            description: `Emission verification approved by ${req.user.email}`,
            performedBy: req.user.userId
        });

        // Create notification for LTO admin
        const vehicle = await db.getVehicleById(request.vehicle_id);
        // dbModule already declared at line 96, reuse it
        const ltoAdmins = await dbModule.query(
            "SELECT id FROM users WHERE role = 'admin' LIMIT 1"
        );
        if (ltoAdmins.rows.length > 0) {
            await db.createNotification({
                userId: ltoAdmins.rows[0].id,
                title: 'Emission Verification Approved',
                message: `Emission verification approved for vehicle ${vehicle.plate_number || vehicle.vin}`,
                type: 'success'
            });
        }

        res.json({ success: true, message: 'Emission verification approved' });
    } catch (error) {
        console.error('Error approving emission:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Reject emission verification
router.post('/verify/reject', authenticateToken, authorizeRole(['admin', 'emission_verifier']), async (req, res) => {
    try {
        const { requestId, reason } = req.body;
        
        if (!requestId || !reason) {
            return res.status(400).json({ success: false, error: 'Request ID and reason required' });
        }

        const request = await db.getClearanceRequestById(requestId);
        if (!request || request.request_type !== 'emission') {
            return res.status(404).json({ success: false, error: 'Emission request not found' });
        }

        await db.updateClearanceRequestStatus(requestId, 'REJECTED', { reason });
        
        // Update transfer request approval status if this clearance request is linked to a transfer request
        const dbModule = require('../database/db');
        const transferRequests = await dbModule.query(
            `SELECT id FROM transfer_requests WHERE emission_clearance_request_id = $1`,
            [requestId]
        );

        if (transferRequests.rows.length > 0) {
            for (const tr of transferRequests.rows) {
                await dbModule.query(
                    `UPDATE transfer_requests 
                     SET emission_approval_status = 'REJECTED',
                         updated_at = CURRENT_TIMESTAMP
                     WHERE id = $1`,
                    [tr.id]
                );
                
                // Add to vehicle history for the transfer request
                const transferRequest = await db.getTransferRequestById(tr.id);
                if (transferRequest) {
                    await db.addVehicleHistory({
                        vehicleId: transferRequest.vehicle_id,
                        action: 'TRANSFER_EMISSION_REJECTED',
                        description: `Emission rejected transfer request ${tr.id} via clearance request ${requestId}. Reason: ${reason}`,
                        performedBy: req.user.userId,
                        metadata: { 
                            transferRequestId: tr.id, 
                            clearanceRequestId: requestId,
                            reason: reason 
                        }
                    });
                }
            }
            console.log(`✅ Updated ${transferRequests.rows.length} transfer request(s) with Emission rejection`);
        }
        
        await db.updateVerificationStatus(request.vehicle_id, 'emission', 'REJECTED', req.user.userId, reason);

        await db.addVehicleHistory({
            vehicleId: request.vehicle_id,
            action: 'EMISSION_VERIFICATION_REJECTED',
            description: `Emission verification rejected: ${reason}`,
            performedBy: req.user.userId
        });

        // Create notification for LTO admin
        const vehicle = await db.getVehicleById(request.vehicle_id);
        // dbModule already declared at line 181, reuse it
        const ltoAdmins = await dbModule.query(
            "SELECT id FROM users WHERE role = 'admin' LIMIT 1"
        );
        if (ltoAdmins.rows.length > 0) {
            await db.createNotification({
                userId: ltoAdmins.rows[0].id,
                title: 'Emission Verification Rejected',
                message: `Emission verification rejected for vehicle ${vehicle.plate_number || vehicle.vin}. Reason: ${reason}`,
                type: 'warning'
            });
        }

        res.json({ success: true, message: 'Emission verification rejected' });
    } catch (error) {
        console.error('Error rejecting emission:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create test emission request (for testing purposes)
router.post('/test-request', authenticateToken, authorizeRole(['admin', 'emission_verifier']), async (req, res) => {
    try {
        const { 
            ownerName, 
            plateNumber, 
            engineNumber,
            vehicleMake,
            vehicleModel,
            vehicleYear
        } = req.body;

        if (!ownerName || !plateNumber) {
            return res.status(400).json({
                success: false,
                error: 'Owner name and plate number are required'
            });
        }

        const dbModule = require('../database/db');
        const crypto = require('crypto');

        // Create a test vehicle
        const vehicleId = crypto.randomUUID();
        const vin = 'EMTEST' + Date.now().toString(36).toUpperCase();
        
        await dbModule.query(`
            INSERT INTO vehicles (id, vin, plate_number, engine_number, make, model, year, vehicle_type, status, current_owner_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'Sedan', 'pending', $8)
            ON CONFLICT (vin) DO UPDATE SET 
                plate_number = EXCLUDED.plate_number,
                engine_number = EXCLUDED.engine_number
        `, [
            vehicleId,
            vin,
            plateNumber,
            engineNumber || 'ENG' + Date.now(),
            vehicleMake || 'Test Make',
            vehicleModel || 'Test Model',
            vehicleYear || 2023,
            req.user.userId
        ]);

        // Create emission clearance request
        const clearanceRequest = await db.createClearanceRequest({
            vehicleId: vehicleId,
            requestType: 'emission',
            requestedBy: req.user.userId,
            assignedTo: req.user.userId,
            purpose: 'Emission test verification',
            notes: 'Test request created from Emission dashboard',
            metadata: {
                ownerName,
                plateNumber,
                engineNumber: engineNumber || 'ENG' + Date.now(),
                vehicleMake: vehicleMake || 'Test Make',
                vehicleModel: vehicleModel || 'Test Model',
                vehicleYear: vehicleYear || 2023,
                isTestRequest: true,
                testCreatedBy: req.user.email,
                testCreatedAt: new Date().toISOString()
            }
        });

        console.log(`[Emission] Test request created: ${clearanceRequest.id} for plate ${plateNumber}`);

        res.json({
            success: true,
            message: 'Test emission request created successfully',
            requestId: clearanceRequest.id,
            vehicleId: vehicleId,
            vin: vin
        });

    } catch (error) {
        console.error('Error creating test emission request:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create test emission request: ' + error.message
        });
    }
});

module.exports = router;

