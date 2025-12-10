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

        await db.updateVerificationStatus(request.vehicle_id, 'emission', 'APPROVED', notes);

        await db.addVehicleHistory({
            vehicleId: request.vehicle_id,
            action: 'EMISSION_VERIFICATION_APPROVED',
            description: `Emission verification approved by ${req.user.email}`,
            performedBy: req.user.userId
        });

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
        await db.updateVerificationStatus(request.vehicle_id, 'emission', 'REJECTED', reason);

        await db.addVehicleHistory({
            vehicleId: request.vehicle_id,
            action: 'EMISSION_VERIFICATION_REJECTED',
            description: `Emission verification rejected: ${reason}`,
            performedBy: req.user.userId
        });

        res.json({ success: true, message: 'Emission verification rejected' });
    } catch (error) {
        console.error('Error rejecting emission:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;

