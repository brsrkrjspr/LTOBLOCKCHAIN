// TrustChain LTO - Insurance Verifier Routes
// Handles insurance verification workflow

const express = require('express');
const router = express.Router();
const db = require('../database/services');
const { authenticateToken } = require('../middleware/auth');
const { authorizeRole } = require('../middleware/authorize');

// Get insurance dashboard statistics
router.get('/stats', authenticateToken, authorizeRole(['admin', 'insurance_verifier']), async (req, res) => {
    try {
        const dbModule = require('../database/db');
        
        // Get start of current week (Monday)
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay() + 1); // Monday
        startOfWeek.setHours(0, 0, 0, 0);
        
        // Get start of today
        const startOfToday = new Date(now);
        startOfToday.setHours(0, 0, 0, 0);
        
        // Query for assigned tasks (pending requests)
        const assignedTasksResult = await dbModule.query(
            `SELECT COUNT(*) as count 
             FROM clearance_requests 
             WHERE request_type = 'insurance' 
             AND (status = 'PENDING' OR status = 'SENT' OR status = 'IN_PROGRESS')`
        );
        
        // Query for completed today
        const completedTodayResult = await dbModule.query(
            `SELECT COUNT(*) as count 
             FROM clearance_requests 
             WHERE request_type = 'insurance' 
             AND status = 'COMPLETED' 
             AND completed_at >= $1`,
            [startOfToday]
        );
        
        // Query for completed this week
        const completedThisWeekResult = await dbModule.query(
            `SELECT COUNT(*) as count 
             FROM clearance_requests 
             WHERE request_type = 'insurance' 
             AND status = 'COMPLETED' 
             AND completed_at >= $1`,
            [startOfWeek]
        );
        
        const stats = {
            assignedTasks: parseInt(assignedTasksResult.rows[0].count) || 0,
            completedToday: parseInt(completedTodayResult.rows[0].count) || 0,
            completedThisWeek: parseInt(completedThisWeekResult.rows[0].count) || 0
        };

        res.json({
            success: true,
            stats: stats
        });
    } catch (error) {
        console.error('Error getting insurance stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get insurance stats: ' + error.message
        });
    }
});

// Get all insurance verification requests
router.get('/requests', authenticateToken, authorizeRole(['admin', 'insurance_verifier']), async (req, res) => {
    try {
        const { status } = req.query;
        const requests = status 
            ? await db.getClearanceRequestsByStatus(status)
            : await db.getClearanceRequestsByType('insurance');

        res.json({
            success: true,
            requests: requests.filter(r => r.request_type === 'insurance'),
            total: requests.filter(r => r.request_type === 'insurance').length
        });
    } catch (error) {
        console.error('Error getting insurance requests:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get insurance requests: ' + error.message
        });
    }
});

// Get single insurance verification request
router.get('/requests/:id', authenticateToken, authorizeRole(['admin', 'insurance_verifier']), async (req, res) => {
    try {
        const { id } = req.params;
        
        const request = await db.getClearanceRequestById(id);
        if (!request || request.request_type !== 'insurance') {
            return res.status(404).json({
                success: false,
                error: 'Insurance clearance request not found'
            });
        }

        // Get vehicle details
        const vehicle = await db.getVehicleById(request.vehicle_id);
        
        // Extract documents from metadata (filtered by LTO)
        // Insurance should ONLY see documents that were explicitly included in metadata.documents
        const metadata = request.metadata || {};
        const documents = metadata.documents || [];
        
        console.log(`[Insurance] Returning ${documents.length} document(s) from metadata (filtered by LTO)`);
        console.log(`[Insurance] Document types: ${documents.map(d => d.type).join(', ')}`);

        res.json({
            success: true,
            request: {
                ...request,
                vehicle,
                documents: documents // Return filtered documents
            }
        });

    } catch (error) {
        console.error('Error getting Insurance request:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get Insurance request: ' + error.message
        });
    }
});

// Approve insurance verification
router.post('/verify/approve', authenticateToken, authorizeRole(['admin', 'insurance_verifier']), async (req, res) => {
    try {
        const { requestId, notes } = req.body;
        
        if (!requestId) {
            return res.status(400).json({ success: false, error: 'Request ID is required' });
        }

        const request = await db.getClearanceRequestById(requestId);
        if (!request || request.request_type !== 'insurance') {
            return res.status(404).json({ success: false, error: 'Insurance request not found' });
        }

        await db.updateClearanceRequestStatus(requestId, 'APPROVED', {
            verifiedBy: req.user.userId,
            verifiedAt: new Date().toISOString(),
            notes
        });

        // Update transfer request approval status if this clearance request is linked to a transfer request
        const dbModule = require('../database/db');
        const transferRequests = await dbModule.query(
            `SELECT id FROM transfer_requests WHERE insurance_clearance_request_id = $1`,
            [requestId]
        );

        if (transferRequests.rows.length > 0) {
            for (const tr of transferRequests.rows) {
                await dbModule.query(
                    `UPDATE transfer_requests 
                     SET insurance_approval_status = 'APPROVED',
                         insurance_approved_at = CURRENT_TIMESTAMP,
                         insurance_approved_by = $1,
                         updated_at = CURRENT_TIMESTAMP
                     WHERE id = $2`,
                    [req.user.userId, tr.id]
                );
                
                // Add to vehicle history for the transfer request
                const transferRequest = await db.getTransferRequestById(tr.id);
                if (transferRequest) {
                    await db.addVehicleHistory({
                        vehicleId: transferRequest.vehicle_id,
                        action: 'TRANSFER_INSURANCE_APPROVED',
                        description: `Insurance approved transfer request ${tr.id} via clearance request ${requestId}`,
                        performedBy: req.user.userId,
                        metadata: { 
                            transferRequestId: tr.id, 
                            clearanceRequestId: requestId,
                            notes: notes || null 
                        }
                    });
                }
            }
            console.log(`✅ Updated ${transferRequests.rows.length} transfer request(s) with Insurance approval`);
        }

        await db.updateVerificationStatus(request.vehicle_id, 'insurance', 'APPROVED', req.user.userId, notes);

        await db.addVehicleHistory({
            vehicleId: request.vehicle_id,
            action: 'INSURANCE_VERIFICATION_APPROVED',
            description: `Insurance verification approved by ${req.user.email}`,
            performedBy: req.user.userId
        });

        // Create notification for LTO admin
        const vehicle = await db.getVehicleById(request.vehicle_id);
        // dbModule already declared at line 95, reuse it
        const ltoAdmins = await dbModule.query(
            "SELECT id FROM users WHERE role = 'admin' LIMIT 1"
        );
        if (ltoAdmins.rows.length > 0) {
            await db.createNotification({
                userId: ltoAdmins.rows[0].id,
                title: 'Insurance Verification Approved',
                message: `Insurance verification approved for vehicle ${vehicle.plate_number || vehicle.vin}`,
                type: 'success'
            });
        }

        res.json({ success: true, message: 'Insurance verification approved' });
    } catch (error) {
        console.error('Error approving insurance:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Reject insurance verification
router.post('/verify/reject', authenticateToken, authorizeRole(['admin', 'insurance_verifier']), async (req, res) => {
    try {
        const { requestId, reason } = req.body;
        
        if (!requestId || !reason) {
            return res.status(400).json({ success: false, error: 'Request ID and reason required' });
        }

        const request = await db.getClearanceRequestById(requestId);
        if (!request || request.request_type !== 'insurance') {
            return res.status(404).json({ success: false, error: 'Insurance request not found' });
        }

        await db.updateClearanceRequestStatus(requestId, 'REJECTED', { reason });
        
        // Update transfer request approval status if this clearance request is linked to a transfer request
        const dbModule = require('../database/db');
        const transferRequests = await dbModule.query(
            `SELECT id FROM transfer_requests WHERE insurance_clearance_request_id = $1`,
            [requestId]
        );

        if (transferRequests.rows.length > 0) {
            for (const tr of transferRequests.rows) {
                await dbModule.query(
                    `UPDATE transfer_requests 
                     SET insurance_approval_status = 'REJECTED',
                         updated_at = CURRENT_TIMESTAMP
                     WHERE id = $1`,
                    [tr.id]
                );
                
                // Add to vehicle history for the transfer request
                const transferRequest = await db.getTransferRequestById(tr.id);
                if (transferRequest) {
                    await db.addVehicleHistory({
                        vehicleId: transferRequest.vehicle_id,
                        action: 'TRANSFER_INSURANCE_REJECTED',
                        description: `Insurance rejected transfer request ${tr.id} via clearance request ${requestId}. Reason: ${reason}`,
                        performedBy: req.user.userId,
                        metadata: { 
                            transferRequestId: tr.id, 
                            clearanceRequestId: requestId,
                            reason: reason 
                        }
                    });
                }
            }
            console.log(`✅ Updated ${transferRequests.rows.length} transfer request(s) with Insurance rejection`);
        }
        
        await db.updateVerificationStatus(request.vehicle_id, 'insurance', 'REJECTED', req.user.userId, reason);

        await db.addVehicleHistory({
            vehicleId: request.vehicle_id,
            action: 'INSURANCE_VERIFICATION_REJECTED',
            description: `Insurance verification rejected: ${reason}`,
            performedBy: req.user.userId
        });

        // Create notification for LTO admin
        const vehicle = await db.getVehicleById(request.vehicle_id);
        // dbModule already declared at line 180, reuse it
        const ltoAdmins = await dbModule.query(
            "SELECT id FROM users WHERE role = 'admin' LIMIT 1"
        );
        if (ltoAdmins.rows.length > 0) {
            await db.createNotification({
                userId: ltoAdmins.rows[0].id,
                title: 'Insurance Verification Rejected',
                message: `Insurance verification rejected for vehicle ${vehicle.plate_number || vehicle.vin}. Reason: ${reason}`,
                type: 'warning'
            });
        }

        res.json({ success: true, message: 'Insurance verification rejected' });
    } catch (error) {
        console.error('Error rejecting insurance:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create test insurance request (for testing purposes)
router.post('/test-request', authenticateToken, authorizeRole(['admin', 'insurance_verifier']), async (req, res) => {
    try {
        const { 
            ownerName, 
            plateNumber, 
            engineNumber,
            policyNumber,
            vehicleMake,
            vehicleModel
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
        const vin = 'INSTEST' + Date.now().toString(36).toUpperCase();
        
        await dbModule.query(`
            INSERT INTO vehicles (id, vin, plate_number, engine_number, make, model, year, vehicle_type, status, current_owner_id)
            VALUES ($1, $2, $3, $4, $5, $6, 2023, 'Sedan', 'pending', $7)
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
            req.user.userId
        ]);

        // Create insurance clearance request
        const clearanceRequest = await db.createClearanceRequest({
            vehicleId: vehicleId,
            requestType: 'insurance',
            requestedBy: req.user.userId,
            assignedTo: req.user.userId,
            purpose: 'Insurance verification',
            notes: 'Test request created from Insurance dashboard',
            metadata: {
                ownerName,
                plateNumber,
                engineNumber: engineNumber || 'ENG' + Date.now(),
                policyNumber: policyNumber || 'POL-TEST-' + Date.now(),
                vehicleMake: vehicleMake || 'Test Make',
                vehicleModel: vehicleModel || 'Test Model',
                isTestRequest: true,
                testCreatedBy: req.user.email,
                testCreatedAt: new Date().toISOString()
            }
        });

        console.log(`[Insurance] Test request created: ${clearanceRequest.id} for plate ${plateNumber}`);

        res.json({
            success: true,
            message: 'Test insurance request created successfully',
            requestId: clearanceRequest.id,
            vehicleId: vehicleId,
            vin: vin
        });

    } catch (error) {
        console.error('Error creating test insurance request:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create test insurance request: ' + error.message
        });
    }
});

module.exports = router;

