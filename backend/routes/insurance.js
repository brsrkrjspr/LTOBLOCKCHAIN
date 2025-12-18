// TrustChain LTO - Insurance Verifier Routes
// Handles insurance verification workflow

const express = require('express');
const router = express.Router();
const db = require('../database/services');
const { authenticateToken } = require('../middleware/auth');
const { authorizeRole } = require('../middleware/authorize');

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

        await db.updateVerificationStatus(request.vehicle_id, 'insurance', 'APPROVED', notes);

        await db.addVehicleHistory({
            vehicleId: request.vehicle_id,
            action: 'INSURANCE_VERIFICATION_APPROVED',
            description: `Insurance verification approved by ${req.user.email}`,
            performedBy: req.user.userId
        });

        // Create notification for LTO admin
        const vehicle = await db.getVehicleById(request.vehicle_id);
        const dbModule = require('../database/db');
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
        await db.updateVerificationStatus(request.vehicle_id, 'insurance', 'REJECTED', reason);

        await db.addVehicleHistory({
            vehicleId: request.vehicle_id,
            action: 'INSURANCE_VERIFICATION_REJECTED',
            description: `Insurance verification rejected: ${reason}`,
            performedBy: req.user.userId
        });

        // Create notification for LTO admin
        const vehicle = await db.getVehicleById(request.vehicle_id);
        const dbModule = require('../database/db');
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

