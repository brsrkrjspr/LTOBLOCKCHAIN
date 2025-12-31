// TrustChain LTO - Blockchain Integrity Monitor Routes
const express = require('express');
const router = express.Router();
const integrityService = require('../services/integrityService');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { authorizeRole } = require('../middleware/authorize');

// Public endpoint: Check integrity by VIN (for verify.html)
router.get('/check/:vin', optionalAuth, async (req, res) => {
    try {
        const { vin } = req.params;
        
        if (!vin || vin.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'VIN is required'
            });
        }

        const result = await integrityService.checkIntegrityByVin(vin.trim().toUpperCase());
        
        res.json({
            success: true,
            ...result
        });

    } catch (error) {
        console.error('Integrity check error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
});

// Admin endpoint: Check integrity by vehicle ID
router.get('/vehicle/:vehicleId', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const { vehicleId } = req.params;
        
        if (!vehicleId) {
            return res.status(400).json({
                success: false,
                error: 'Vehicle ID is required'
            });
        }

        const result = await integrityService.checkIntegrityById(vehicleId);
        
        res.json({
            success: true,
            ...result
        });

    } catch (error) {
        console.error('Integrity check by ID error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
});

// Batch check: Check integrity for multiple vehicles (admin only)
router.post('/batch', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const { vehicleIds } = req.body;
        
        if (!Array.isArray(vehicleIds) || vehicleIds.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'vehicleIds array is required'
            });
        }

        // Limit batch size to prevent overload
        const maxBatchSize = 50;
        const idsToCheck = vehicleIds.slice(0, maxBatchSize);

        const results = await Promise.all(
            idsToCheck.map(id => integrityService.checkIntegrityById(id))
        );

        res.json({
            success: true,
            results: results,
            checked: results.length,
            summary: {
                verified: results.filter(r => r.status === 'VERIFIED').length,
                tampered: results.filter(r => r.status === 'TAMPERED').length,
                mismatch: results.filter(r => r.status === 'MISMATCH').length,
                notRegistered: results.filter(r => r.status === 'NOT_REGISTERED').length,
                error: results.filter(r => r.status === 'ERROR').length
            }
        });

    } catch (error) {
        console.error('Batch integrity check error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
});

module.exports = router;

