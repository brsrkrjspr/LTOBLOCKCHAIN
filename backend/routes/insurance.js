// TrustChain LTO - Insurance Verifier Routes
// Handles insurance verification workflow

const express = require('express');
const router = express.Router();
const db = require('../database/services');
const { authenticateToken } = require('../middleware/auth');
const { authorizeRole } = require('../middleware/authorize');
const { normalizeStatus, CLEARANCE_STATUS, isValidClearanceStatus } = require('../config/statusConstants');
const { INSURANCE_ACTIONS, normalizeAction } = require('../config/actionConstants');
const { validateClearanceStatusTransition } = require('../middleware/statusValidation');

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
        // Normalize status to uppercase (database format) before querying
        // This fixes case sensitivity issues (e.g., 'pending' vs 'PENDING')
        let requests;
        if (status) {
            const normalizedStatus = normalizeStatus(status);
            
            // Validate that the normalized status is a valid clearance status
            if (!normalizedStatus || !isValidClearanceStatus(normalizedStatus)) {
                return res.status(400).json({
                    success: false,
                    error: `Invalid status: "${status}". Valid statuses are: ${Object.values(CLEARANCE_STATUS).join(', ')}`
                });
            }
            
            const allRequests = await db.getClearanceRequestsByStatus(normalizedStatus);
            requests = allRequests.filter(r => r.request_type === 'insurance');
        } else {
            requests = await db.getClearanceRequestsByType('insurance');
        }

        res.json({
            success: true,
            requests: requests,
            total: requests.length
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
        
        // Get owner information for auto-fill
        let owner = null;
        if (vehicle && vehicle.owner_id) {
            owner = await db.getUserById(vehicle.owner_id);
        }
        
        // Extract documents from metadata (filtered by LTO)
        // Insurance should ONLY see documents that were explicitly included in metadata.documents
        // Parse metadata if it's a string
        const metadata = typeof request.metadata === 'string' 
            ? JSON.parse(request.metadata) 
            : (request.metadata || {});
        const documents = metadata.documents || [];
        
        console.log(`[Insurance] Returning ${documents.length} document(s) from metadata (filtered by LTO)`);
        console.log(`[Insurance] Document types: ${documents.map(d => d.type).join(', ')}`);

        res.json({
            success: true,
            request: {
                ...request,
                metadata: metadata, // Ensure metadata is properly parsed and returned
                vehicle,
                owner: owner ? {
                    id: owner.id,
                    firstName: owner.first_name,
                    lastName: owner.last_name,
                    email: owner.email,
                    phone: owner.phone,
                    address: owner.address,
                    organization: owner.organization
                } : null,
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
        
        // Check if insurance_clearance_request_id column exists before querying
        let transferRequests = { rows: [] };
        try {
            const colCheck = await dbModule.query(`
                SELECT column_name FROM information_schema.columns 
                WHERE table_name = 'transfer_requests' 
                AND column_name = 'insurance_clearance_request_id'
            `);
            
            if (colCheck.rows.length > 0) {
                // Column exists, safe to query
                transferRequests = await dbModule.query(
                    `SELECT id FROM transfer_requests WHERE insurance_clearance_request_id = $1`,
                    [requestId]
                );
            } else {
                console.warn('[Insurance Approve] insurance_clearance_request_id column does not exist. Skipping transfer request update. Run migration: database/add-insurance-clearance-column.sql');
            }
        } catch (colError) {
            console.error('[Insurance Approve] Error checking for insurance_clearance_request_id column:', colError);
            // Continue without transfer request update
        }

        if (transferRequests.rows.length > 0) {
            for (const tr of transferRequests.rows) {
                try {
                    // Check if approval status columns exist before updating
                    const colCheck = await dbModule.query(`
                        SELECT column_name FROM information_schema.columns 
                        WHERE table_name = 'transfer_requests' 
                        AND column_name IN ('insurance_approval_status', 'insurance_approved_at', 'insurance_approved_by', 'insurance_clearance_request_id')
                    `);
                    const hasApprovalStatus = colCheck.rows.some(r => r.column_name === 'insurance_approval_status');
                    const hasApprovedAt = colCheck.rows.some(r => r.column_name === 'insurance_approved_at');
                    const hasApprovedBy = colCheck.rows.some(r => r.column_name === 'insurance_approved_by');
                    
                    if (hasApprovalStatus && hasApprovedAt && hasApprovedBy) {
                        // Update Insurance approval status
                        await dbModule.query(
                            `UPDATE transfer_requests 
                             SET insurance_approval_status = 'APPROVED',
                                 insurance_approved_at = CURRENT_TIMESTAMP,
                                 insurance_approved_by = $1,
                                 updated_at = CURRENT_TIMESTAMP
                             WHERE id = $2`,
                            [req.user.userId, tr.id]
                        );
                        console.log(`✅ Updated transfer request ${tr.id} with Insurance approval`);
                        
                        // Get the updated transfer request to check all approvals
                        const transferRequest = await db.getTransferRequestById(tr.id);
                        if (transferRequest) {
                            // Check if all required organization approvals are complete
                            const pendingApprovals = [];
                            
                            // Check HPG approval if it was forwarded
                            if (transferRequest.hpg_clearance_request_id) {
                                if (!transferRequest.hpg_approval_status || transferRequest.hpg_approval_status === 'PENDING') {
                                    pendingApprovals.push('HPG');
                                }
                            }
                            // Insurance approval (just approved, so skip)
                            
                            // If all required approvals are complete, transition status back to UNDER_REVIEW
                            // Check if status is FORWARDED_TO_HPG (HPG was forwarded first) or if it's in a forwarded state
                            const isForwardedState = transferRequest.status === 'FORWARDED_TO_HPG' || 
                                                     (transferRequest.hpg_clearance_request_id && transferRequest.status.includes('FORWARDED'));
                            
                            if (pendingApprovals.length === 0 && isForwardedState) {
                                const statusValidation = require('../middleware/statusValidation');
                                const validation = statusValidation.validateTransferStatusTransition(transferRequest.status, 'UNDER_REVIEW');
                                
                                if (validation.valid) {
                                    await db.updateTransferRequestStatus(tr.id, 'UNDER_REVIEW', req.user.userId, null, {
                                        insuranceApproved: true,
                                        returnedToLTO: true,
                                        returnedAt: new Date().toISOString()
                                    });
                                    console.log(`✅ Transitioned transfer request ${tr.id} from ${transferRequest.status} to UNDER_REVIEW (all org approvals complete)`);
                                } else {
                                    console.warn(`⚠️ Cannot transition transfer request ${tr.id} to UNDER_REVIEW: ${validation.error}`);
                                }
                            } else if (pendingApprovals.length > 0) {
                                console.log(`ℹ️ Transfer request ${tr.id} still waiting for: ${pendingApprovals.join(', ')}`);
                            }
                        }
                    } else {
                        console.warn(`⚠️ Transfer request approval columns missing. Skipping transfer request ${tr.id} update. Run migration: database/verify-verification-columns.sql`);
                    }
                } catch (transferError) {
                    console.error(`[Insurance Approve] Error updating transfer request ${tr.id}:`, transferError);
                    // Continue with other operations even if transfer update fails
                }
                
                // Add to vehicle history for the transfer request (always try this)
                try {
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
                } catch (historyError) {
                    console.error(`[Insurance Approve] Error adding vehicle history for transfer ${tr.id}:`, historyError);
                }
            }
        }

        await db.updateVerificationStatus(request.vehicle_id, 'insurance', 'APPROVED', req.user.userId, notes);

        // PHASE 2: Log approval to blockchain for full traceability
        let blockchainTxId = null;
        let blockchainError = null;
        
        // Get vehicle for blockchain logging and notifications
        const vehicle = await db.getVehicleById(request.vehicle_id);
        if (!vehicle) {
            return res.status(404).json({ success: false, error: 'Vehicle not found' });
        }
        
        try {
            // PHASE 2: Log verification approval to blockchain for audit purposes
            const fabricService = require('../services/optimizedFabricService');
            
            // Initialize Fabric service with current user context for dynamic identity selection
            await fabricService.initialize({
                role: req.user.role,
                email: req.user.email
            });
            
            // Prepare notes with officer information
            const currentUser = await db.getUserById(req.user.userId);
            const notesWithOfficer = JSON.stringify({
                notes: notes || '',
                clearanceRequestId: requestId,
                officerInfo: {
                    userId: req.user.userId,
                    email: req.user.email,
                    name: `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() || req.user.email,
                    employeeId: currentUser?.employee_id || null
                }
            });
            
            // Call chaincode to update verification status on blockchain
            const blockchainResult = await fabricService.updateVerificationStatus(
                vehicle.vin,
                'insurance',
                'APPROVED',
                notesWithOfficer
            );
            
            if (blockchainResult && blockchainResult.transactionId) {
                blockchainTxId = blockchainResult.transactionId;
                console.log(`✅ [Phase 2] Insurance verification logged to blockchain. TX ID: ${blockchainTxId}`);
            } else {
                throw new Error('Blockchain update completed but no transaction ID returned');
            }
        } catch (blockchainErr) {
            // PHASE 2: Log blockchain error but don't fail the entire operation
            blockchainError = blockchainErr;
            console.error('⚠️ [Phase 2] Failed to log insurance approval to blockchain:', blockchainErr.message);
            // Continue with database operations
        }

        // PHASE 3: Add to vehicle history with standardized action name
        await db.addVehicleHistory({
            vehicleId: request.vehicle_id,
            action: INSURANCE_ACTIONS.APPROVED, // PHASE 3: Use standardized action constant
            description: `Insurance verification approved by ${req.user.email}. ${notes || ''}${blockchainTxId ? ` Blockchain TX: ${blockchainTxId}` : ''}`,
            performedBy: req.user.userId,
            transactionId: blockchainTxId || null,  // PHASE 2: Include blockchain transaction ID
            metadata: {
                clearanceRequestId: requestId,
                notes: notes || null,
                blockchainTxId: blockchainTxId || null,
                blockchainError: blockchainError ? blockchainError.message : null
            }
        });

        // PHASE 2: Enhanced notifications - notify LTO admin and vehicle owner
        try {
            // Notify LTO admin
            const ltoAdmins = await dbModule.query(
                "SELECT id FROM users WHERE role = 'admin' LIMIT 1"
            );
            if (ltoAdmins.rows.length > 0) {
                await db.createNotification({
                    userId: ltoAdmins.rows[0].id,
                    title: 'Insurance Verification Approved',
                    message: `Insurance verification approved for vehicle ${vehicle.plate_number || vehicle.vin}${blockchainTxId ? `. Blockchain TX: ${blockchainTxId.substring(0, 16)}...` : ''}`,
                    type: 'success'
                });
            }
            
            // PHASE 2: Notify vehicle owner about verification approval
            if (vehicle.owner_id) {
                try {
                    await db.createNotification({
                        userId: vehicle.owner_id,
                        title: 'Insurance Verification Approved',
                        message: `Your insurance verification request for vehicle ${vehicle.plate_number || vehicle.vin} has been approved.${blockchainTxId ? ` Transaction ID: ${blockchainTxId.substring(0, 16)}...` : ''}`,
                        type: 'success'
                    });
                } catch (ownerNotifyError) {
                    console.warn('[Phase 2] Failed to notify vehicle owner:', ownerNotifyError.message);
                    // Continue - owner notification failure shouldn't block approval
                }
            }
        } catch (notificationError) {
            console.warn('[Phase 2] Notification error (non-blocking):', notificationError.message);
            // Continue - notification failures shouldn't block the approval
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
        
        // Check if insurance_clearance_request_id column exists before querying
        let transferRequests = { rows: [] };
        try {
            const colCheck = await dbModule.query(`
                SELECT column_name FROM information_schema.columns 
                WHERE table_name = 'transfer_requests' 
                AND column_name = 'insurance_clearance_request_id'
            `);
            
            if (colCheck.rows.length > 0) {
                // Column exists, safe to query
                transferRequests = await dbModule.query(
                    `SELECT id FROM transfer_requests WHERE insurance_clearance_request_id = $1`,
                    [requestId]
                );
            } else {
                console.warn('[Insurance Reject] insurance_clearance_request_id column does not exist. Skipping transfer request update. Run migration: database/add-insurance-clearance-column.sql');
            }
        } catch (colError) {
            console.error('[Insurance Reject] Error checking for insurance_clearance_request_id column:', colError);
            // Continue without transfer request update
        }

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

        // PHASE 2: Log rejection to blockchain for full traceability
        let blockchainTxId = null;
        let blockchainError = null;
        
        // Get vehicle for blockchain logging and notifications
        const vehicle = await db.getVehicleById(request.vehicle_id);
        if (!vehicle) {
            return res.status(404).json({ success: false, error: 'Vehicle not found' });
        }
        
        try {
            // PHASE 2: Log verification rejection to blockchain for audit purposes
            const fabricService = require('../services/optimizedFabricService');
            
            // Initialize Fabric service with current user context for dynamic identity selection
            await fabricService.initialize({
                role: req.user.role,
                email: req.user.email
            });
            
            // Prepare notes with officer information and rejection reason
            const currentUser = await db.getUserById(req.user.userId);
            const notesWithOfficer = JSON.stringify({
                notes: reason || '',
                clearanceRequestId: requestId,
                rejectionReason: reason,
                officerInfo: {
                    userId: req.user.userId,
                    email: req.user.email,
                    name: `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() || req.user.email,
                    employeeId: currentUser?.employee_id || null
                }
            });
            
            // Call chaincode to update verification status on blockchain
            const blockchainResult = await fabricService.updateVerificationStatus(
                vehicle.vin,
                'insurance',
                'REJECTED',
                notesWithOfficer
            );
            
            if (blockchainResult && blockchainResult.transactionId) {
                blockchainTxId = blockchainResult.transactionId;
                console.log(`✅ [Phase 2] Insurance verification rejection logged to blockchain. TX ID: ${blockchainTxId}`);
            } else {
                throw new Error('Blockchain update completed but no transaction ID returned');
            }
        } catch (blockchainErr) {
            // PHASE 2: Log blockchain error but don't fail the entire operation
            blockchainError = blockchainErr;
            console.error('⚠️ [Phase 2] Failed to log insurance rejection to blockchain:', blockchainErr.message);
            // Continue with database operations
        }

        // PHASE 3: Add to vehicle history with standardized action name
        await db.addVehicleHistory({
            vehicleId: request.vehicle_id,
            action: INSURANCE_ACTIONS.REJECTED, // PHASE 3: Use standardized action constant
            description: `Insurance verification rejected by ${req.user.email}. Reason: ${reason}${blockchainTxId ? ` Blockchain TX: ${blockchainTxId}` : ''}`,
            performedBy: req.user.userId,
            transactionId: blockchainTxId || null,  // PHASE 2: Include blockchain transaction ID
            metadata: {
                clearanceRequestId: requestId,
                reason: reason || null,
                blockchainTxId: blockchainTxId || null,
                blockchainError: blockchainError ? blockchainError.message : null
            }
        });

        // PHASE 2: Enhanced notifications - notify LTO admin and vehicle owner
        try {
            // Notify LTO admin
            const ltoAdmins = await dbModule.query(
                "SELECT id FROM users WHERE role = 'admin' LIMIT 1"
            );
            if (ltoAdmins.rows.length > 0) {
                await db.createNotification({
                    userId: ltoAdmins.rows[0].id,
                    title: 'Insurance Verification Rejected',
                    message: `Insurance verification rejected for vehicle ${vehicle.plate_number || vehicle.vin}. Reason: ${reason}${blockchainTxId ? ` Blockchain TX: ${blockchainTxId.substring(0, 16)}...` : ''}`,
                    type: 'warning'
                });
            }
            
            // PHASE 2: Notify vehicle owner about verification rejection
            if (vehicle.owner_id) {
                try {
                    await db.createNotification({
                        userId: vehicle.owner_id,
                        title: 'Insurance Verification Rejected',
                        message: `Your insurance verification request for vehicle ${vehicle.plate_number || vehicle.vin} has been rejected. Reason: ${reason}${blockchainTxId ? ` Transaction ID: ${blockchainTxId.substring(0, 16)}...` : ''}`,
                        type: 'warning'
                    });
                } catch (ownerNotifyError) {
                    console.warn('[Phase 2] Failed to notify vehicle owner:', ownerNotifyError.message);
                    // Continue - owner notification failure shouldn't block rejection
                }
            }
        } catch (notificationError) {
            console.warn('[Phase 2] Notification error (non-blocking):', notificationError.message);
            // Continue - notification failures shouldn't block the rejection
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
            INSERT INTO vehicles (id, vin, plate_number, engine_number, make, model, year, vehicle_type, status, owner_id)
            VALUES ($1, $2, $3, $4, $5, $6, 2023, 'Sedan', 'SUBMITTED', $7)
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

