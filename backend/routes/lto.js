// TrustChain LTO - LTO Admin Routes
// Handles LTO admin actions: sending clearance requests, approving clearances

const express = require('express');
const router = express.Router();
const db = require('../database/services');
const { authenticateToken } = require('../middleware/auth');
const { authorizeRole } = require('../middleware/authorize');
const fabricService = require('../services/optimizedFabricService');

// Send clearance request to HPG
router.post('/send-to-hpg', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const { vehicleId, purpose, notes } = req.body;
        
        if (!vehicleId) {
            return res.status(400).json({
                success: false,
                error: 'Vehicle ID is required'
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

        // Check if HPG request already exists
        const existingRequests = await db.getClearanceRequestsByVehicle(vehicleId);
        const existingHPGRequest = existingRequests.find(r => r.request_type === 'hpg' && r.status !== 'REJECTED' && r.status !== 'COMPLETED');
        
        if (existingHPGRequest) {
            return res.status(409).json({
                success: false,
                error: 'HPG clearance request already exists for this vehicle',
                requestId: existingHPGRequest.id
            });
        }

        // Find HPG admin user (or assign to first admin if no HPG user exists)
        // Note: 'hpg_admin' role doesn't exist in enum, so we check by email pattern
        const dbModule = require('../database/db');
        const hpgAdmins = await dbModule.query(
            "SELECT id FROM users WHERE email LIKE '%hpg%' OR (role = 'admin' AND email LIKE '%hpg%') LIMIT 1"
        );
        const assignedTo = hpgAdmins.rows[0]?.id || null;

        // Create clearance request
        const clearanceRequest = await db.createClearanceRequest({
            vehicleId,
            requestType: 'hpg',
            requestedBy: req.user.userId,
            purpose: purpose || 'Vehicle clearance verification',
            notes: notes || null,
            metadata: {
                vehicleVin: vehicle.vin,
                vehiclePlate: vehicle.plate_number,
                ownerName: vehicle.owner_name
            },
            assignedTo
        });

        // Update vehicle status
        await db.updateVehicle(vehicleId, {
            status: 'HPG_CLEARANCE_PENDING'
        });

        // Add to history
        await db.addVehicleHistory({
            vehicleId,
            action: 'HPG_CLEARANCE_REQUESTED',
            description: `HPG clearance requested by ${req.user.email}. Purpose: ${purpose || 'Vehicle clearance verification'}`,
            performedBy: req.user.userId,
            transactionId: null,
            metadata: { clearanceRequestId: clearanceRequest.id }
        });

        // Create notification for HPG admin (if assigned)
        if (assignedTo) {
            await db.createNotification({
                userId: assignedTo,
                title: 'New HPG Clearance Request',
                message: `New clearance request for vehicle ${vehicle.plate_number || vehicle.vin}`,
                type: 'info'
            });
        }

        res.json({
            success: true,
            message: 'HPG clearance request sent successfully',
            requestId: clearanceRequest.id,
            clearanceRequest
        });

    } catch (error) {
        console.error('Error sending HPG clearance request:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send HPG clearance request: ' + error.message
        });
    }
});

// Send insurance verification request
router.post('/send-to-insurance', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const { vehicleId, purpose, notes } = req.body;
        
        if (!vehicleId) {
            return res.status(400).json({
                success: false,
                error: 'Vehicle ID is required'
            });
        }

        const vehicle = await db.getVehicleById(vehicleId);
        if (!vehicle) {
            return res.status(404).json({
                success: false,
                error: 'Vehicle not found'
            });
        }

        // Check if insurance request already exists
        const existingRequests = await db.getClearanceRequestsByVehicle(vehicleId);
        const existingInsuranceRequest = existingRequests.find(r => r.request_type === 'insurance' && r.status !== 'REJECTED' && r.status !== 'COMPLETED');
        
        if (existingInsuranceRequest) {
            return res.status(409).json({
                success: false,
                error: 'Insurance verification request already exists for this vehicle',
                requestId: existingInsuranceRequest.id
            });
        }

        // Find insurance verifier
        const dbModule = require('../database/db');
        const insuranceVerifiers = await dbModule.query(
            "SELECT id FROM users WHERE role = 'insurance_verifier' LIMIT 1"
        );
        const assignedTo = insuranceVerifiers.rows[0]?.id || null;

        // Create clearance request
        const clearanceRequest = await db.createClearanceRequest({
            vehicleId,
            requestType: 'insurance',
            requestedBy: req.user.userId,
            purpose: purpose || 'Insurance verification',
            notes: notes || null,
            metadata: {
                vehicleVin: vehicle.vin,
                vehiclePlate: vehicle.plate_number
            },
            assignedTo
        });

        // Update vehicle verification status
        await db.updateVerificationStatus(vehicleId, 'insurance', 'PENDING', null);

        // Add to history
        await db.addVehicleHistory({
            vehicleId,
            action: 'INSURANCE_VERIFICATION_REQUESTED',
            description: `Insurance verification requested by ${req.user.email}`,
            performedBy: req.user.userId,
            transactionId: null,
            metadata: { clearanceRequestId: clearanceRequest.id }
        });

        // Create notification
        if (assignedTo) {
            await db.createNotification({
                userId: assignedTo,
                title: 'New Insurance Verification Request',
                message: `New insurance verification request for vehicle ${vehicle.plate_number || vehicle.vin}`,
                type: 'info'
            });
        }

        res.json({
            success: true,
            message: 'Insurance verification request sent successfully',
            requestId: clearanceRequest.id,
            clearanceRequest
        });

    } catch (error) {
        console.error('Error sending insurance verification request:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send insurance verification request: ' + error.message
        });
    }
});

// Send emission verification request
router.post('/send-to-emission', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const { vehicleId, purpose, notes } = req.body;
        
        if (!vehicleId) {
            return res.status(400).json({
                success: false,
                error: 'Vehicle ID is required'
            });
        }

        const vehicle = await db.getVehicleById(vehicleId);
        if (!vehicle) {
            return res.status(404).json({
                success: false,
                error: 'Vehicle not found'
            });
        }

        // Check if emission request already exists
        const existingRequests = await db.getClearanceRequestsByVehicle(vehicleId);
        const existingEmissionRequest = existingRequests.find(r => r.request_type === 'emission' && r.status !== 'REJECTED' && r.status !== 'COMPLETED');
        
        if (existingEmissionRequest) {
            return res.status(409).json({
                success: false,
                error: 'Emission verification request already exists for this vehicle',
                requestId: existingEmissionRequest.id
            });
        }

        // Find emission verifier
        const dbModule = require('../database/db');
        const emissionVerifiers = await dbModule.query(
            "SELECT id FROM users WHERE role = 'emission_verifier' LIMIT 1"
        );
        const assignedTo = emissionVerifiers.rows[0]?.id || null;

        // Create clearance request
        const clearanceRequest = await db.createClearanceRequest({
            vehicleId,
            requestType: 'emission',
            requestedBy: req.user.userId,
            purpose: purpose || 'Emission test verification',
            notes: notes || null,
            metadata: {
                vehicleVin: vehicle.vin,
                vehiclePlate: vehicle.plate_number
            },
            assignedTo
        });

        // Update vehicle verification status
        await db.updateVerificationStatus(vehicleId, 'emission', 'PENDING', null);

        // Add to history
        await db.addVehicleHistory({
            vehicleId,
            action: 'EMISSION_VERIFICATION_REQUESTED',
            description: `Emission verification requested by ${req.user.email}`,
            performedBy: req.user.userId,
            transactionId: null,
            metadata: { clearanceRequestId: clearanceRequest.id }
        });

        // Create notification
        if (assignedTo) {
            await db.createNotification({
                userId: assignedTo,
                title: 'New Emission Verification Request',
                message: `New emission verification request for vehicle ${vehicle.plate_number || vehicle.vin}`,
                type: 'info'
            });
        }

        res.json({
            success: true,
            message: 'Emission verification request sent successfully',
            requestId: clearanceRequest.id,
            clearanceRequest
        });

    } catch (error) {
        console.error('Error sending emission verification request:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send emission verification request: ' + error.message
        });
    }
});

// Approve clearance (final approval after all verifications complete)
router.post('/approve-clearance', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const { vehicleId, notes } = req.body;
        
        if (!vehicleId) {
            return res.status(400).json({
                success: false,
                error: 'Vehicle ID is required'
            });
        }

        const vehicle = await db.getVehicleById(vehicleId);
        if (!vehicle) {
            return res.status(404).json({
                success: false,
                error: 'Vehicle not found'
            });
        }

        // Check if all required verifications are complete
        const verifications = await db.getVehicleVerifications(vehicleId);
        const clearanceRequests = await db.getClearanceRequestsByVehicle(vehicleId);
        
        // Check HPG clearance
        const hpgRequest = clearanceRequests.find(r => r.request_type === 'hpg');
        if (hpgRequest && hpgRequest.status !== 'COMPLETED' && hpgRequest.status !== 'APPROVED') {
            return res.status(400).json({
                success: false,
                error: 'HPG clearance is not yet completed',
                pendingVerifications: ['hpg']
            });
        }

        // Check insurance verification
        const insuranceVerification = verifications.find(v => v.verification_type === 'insurance');
        if (!insuranceVerification || insuranceVerification.status !== 'APPROVED') {
            return res.status(400).json({
                success: false,
                error: 'Insurance verification is not yet approved',
                pendingVerifications: ['insurance']
            });
        }

        // Check emission verification
        const emissionVerification = verifications.find(v => v.verification_type === 'emission');
        if (!emissionVerification || emissionVerification.status !== 'APPROVED') {
            return res.status(400).json({
                success: false,
                error: 'Emission verification is not yet approved',
                pendingVerifications: ['emission']
            });
        }

        // All verifications complete - approve and register on blockchain
        await db.updateVehicle(vehicleId, {
            status: 'APPROVED'
        });

        // Register vehicle on blockchain
        let blockchainTxId = null;
        try {
            if (fabricService.isConnected && fabricService.mode === 'fabric') {
                const vehicleData = {
                    vin: vehicle.vin,
                    plateNumber: vehicle.plate_number,
                    make: vehicle.make,
                    model: vehicle.model,
                    year: vehicle.year,
                    color: vehicle.color,
                    engineNumber: vehicle.engine_number,
                    chassisNumber: vehicle.chassis_number,
                    vehicleType: vehicle.vehicle_type,
                    fuelType: vehicle.fuel_type,
                    transmission: vehicle.transmission,
                    engineDisplacement: vehicle.engine_displacement,
                    owner: vehicle.owner_name || vehicle.owner_email,
                    documents: {}
                };

                const result = await fabricService.registerVehicle(vehicleData);
                blockchainTxId = result.transactionId;
            }
        } catch (blockchainError) {
            console.error('Failed to register vehicle on blockchain:', blockchainError);
            // Continue with approval even if blockchain fails
        }

        // Update vehicle status to REGISTERED if blockchain registration succeeded
        if (blockchainTxId) {
            await db.updateVehicle(vehicleId, {
                status: 'REGISTERED'
            });
        }

        // Add to history
        await db.addVehicleHistory({
            vehicleId,
            action: 'CLEARANCE_APPROVED',
            description: `Clearance approved by ${req.user.email}. ${notes || 'All verifications complete.'}`,
            performedBy: req.user.userId,
            transactionId: blockchainTxId,
            metadata: { 
                notes,
                blockchainTxId,
                verifications: verifications.map(v => ({ type: v.verification_type, status: v.status }))
            }
        });

        // Create notification for owner
        if (vehicle.owner_id) {
            await db.createNotification({
                userId: vehicle.owner_id,
                title: 'Vehicle Registration Approved',
                message: `Your vehicle registration (${vehicle.plate_number || vehicle.vin}) has been approved!`,
                type: 'success'
            });
        }

        res.json({
            success: true,
            message: 'Clearance approved successfully',
            vehicleId,
            blockchainTxId,
            status: blockchainTxId ? 'REGISTERED' : 'APPROVED'
        });

    } catch (error) {
        console.error('Error approving clearance:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to approve clearance: ' + error.message
        });
    }
});

module.exports = router;

