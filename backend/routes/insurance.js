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

        res.json({ success: true, message: 'Insurance verification rejected' });
    } catch (error) {
        console.error('Error rejecting insurance:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;

