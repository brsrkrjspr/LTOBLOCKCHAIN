// TrustChain LTO - Audit Trail Service
// Reconstructs complete audit trail from database and blockchain records

const db = require('../database/services');
const fabricService = require('../services/optimizedFabricService');

/**
 * Reconstruct complete audit trail for a vehicle
 * Merges database history entries with blockchain events
 * @param {string} vehicleId - Vehicle UUID
 * @param {string} vin - Vehicle VIN
 * @returns {Promise<Array>} Complete audit trail sorted chronologically
 */
async function reconstructVehicleAuditTrail(vehicleId, vin) {
    try {
        // Get database history entries
        const dbHistory = await db.getVehicleHistory(vehicleId);
        
        // Get blockchain history (if vehicle is registered)
        let blockchainHistory = [];
        try {
            if (fabricService.isConnected) {
                const vehicleData = await fabricService.getVehicle(vin);
                if (vehicleData && vehicleData.history) {
                    blockchainHistory = vehicleData.history.map(entry => ({
                        source: 'blockchain',
                        action: entry.action,
                        timestamp: entry.timestamp,
                        transactionId: entry.transactionId,
                        performedBy: entry.performedBy,
                        officerInfo: entry.officerInfo,
                        details: entry.details,
                        metadata: entry
                    }));
                }
            }
        } catch (blockchainError) {
            console.warn(`[Audit Trail] Could not fetch blockchain history for VIN ${vin}:`, blockchainError.message);
            // Continue with DB history only
        }
        
        // Merge and sort chronologically
        const mergedHistory = [
            ...dbHistory.map(entry => ({
                source: 'database',
                id: entry.id,
                action: entry.action,
                description: entry.description,
                timestamp: entry.performed_at,
                transactionId: entry.transaction_id,
                performedBy: entry.performed_by,
                metadata: entry.metadata
            })),
            ...blockchainHistory
        ].sort((a, b) => {
            const timeA = new Date(a.timestamp).getTime();
            const timeB = new Date(b.timestamp).getTime();
            return timeA - timeB;
        });
        
        return mergedHistory;
    } catch (error) {
        console.error('[Audit Trail] Error reconstructing audit trail:', error);
        throw new Error(`Failed to reconstruct audit trail: ${error.message}`);
    }
}

/**
 * Reconstruct audit trail for a clearance request
 * Includes related vehicle history entries
 * @param {string} clearanceRequestId - Clearance request UUID
 * @returns {Promise<Object>} Complete audit trail with request history and vehicle history
 */
async function reconstructClearanceAuditTrail(clearanceRequestId) {
    try {
        const request = await db.getClearanceRequestById(clearanceRequestId);
        if (!request) {
            throw new Error('Clearance request not found');
        }
        
        // Get vehicle history related to this clearance request
        const vehicleHistory = await db.query(
            `SELECT * FROM vehicle_history 
             WHERE vehicle_id = $1 
             AND metadata->>'clearanceRequestId' = $2
             ORDER BY performed_at ASC`,
            [request.vehicle_id, clearanceRequestId]
        );
        
        // Get vehicle for blockchain history
        const vehicle = await db.getVehicleById(request.vehicle_id);
        let blockchainHistory = [];
        
        if (vehicle && vehicle.vin) {
            try {
                if (fabricService.isConnected) {
                    const vehicleData = await fabricService.getVehicle(vehicle.vin);
                    if (vehicleData && vehicleData.history) {
                        // Filter blockchain history for this clearance type
                        blockchainHistory = vehicleData.history
                            .filter(entry => {
                                const notes = entry.notes || '';
                                return typeof notes === 'string' && notes.includes(clearanceRequestId);
                            })
                            .map(entry => ({
                                source: 'blockchain',
                                action: entry.action,
                                timestamp: entry.timestamp,
                                transactionId: entry.transactionId,
                                performedBy: entry.performedBy,
                                metadata: entry
                            }));
                    }
                }
            } catch (blockchainError) {
                console.warn(`[Audit Trail] Could not fetch blockchain history:`, blockchainError.message);
            }
        }
        
        return {
            clearanceRequest: request,
            vehicleHistory: vehicleHistory.rows,
            blockchainHistory: blockchainHistory,
            mergedHistory: [
                ...vehicleHistory.rows.map(entry => ({
                    source: 'database',
                    ...entry
                })),
                ...blockchainHistory
            ].sort((a, b) => {
                const timeA = new Date(a.performed_at || a.timestamp).getTime();
                const timeB = new Date(b.performed_at || b.timestamp).getTime();
                return timeA - timeB;
            })
        };
    } catch (error) {
        console.error('[Audit Trail] Error reconstructing clearance audit trail:', error);
        throw new Error(`Failed to reconstruct clearance audit trail: ${error.message}`);
    }
}

/**
 * Verify audit trail integrity
 * Checks for discrepancies between database and blockchain records
 * @param {string} vehicleId - Vehicle UUID
 * @param {string} vin - Vehicle VIN
 * @returns {Promise<Object>} Integrity check results
 */
async function verifyAuditTrailIntegrity(vehicleId, vin) {
    try {
        const dbHistory = await db.getVehicleHistory(vehicleId);
        const dbTxIds = dbHistory
            .filter(entry => entry.transaction_id)
            .map(entry => entry.transaction_id);
        
        let blockchainTxIds = [];
        try {
            if (fabricService.isConnected) {
                const vehicleData = await fabricService.getVehicle(vin);
                if (vehicleData && vehicleData.history) {
                    blockchainTxIds = vehicleData.history
                        .filter(entry => entry.transactionId)
                        .map(entry => entry.transactionId);
                }
            }
        } catch (blockchainError) {
            console.warn(`[Audit Trail] Could not verify blockchain integrity:`, blockchainError.message);
        }
        
        // Find discrepancies
        const missingInBlockchain = dbTxIds.filter(txId => !blockchainTxIds.includes(txId));
        const missingInDatabase = blockchainTxIds.filter(txId => !dbTxIds.includes(txId));
        
        return {
            integrity: missingInBlockchain.length === 0 && missingInDatabase.length === 0,
            dbHistoryCount: dbHistory.length,
            blockchainHistoryCount: blockchainTxIds.length,
            missingInBlockchain,
            missingInDatabase,
            discrepancies: missingInBlockchain.length + missingInDatabase.length
        };
    } catch (error) {
        console.error('[Audit Trail] Error verifying integrity:', error);
        throw new Error(`Failed to verify audit trail integrity: ${error.message}`);
    }
}

module.exports = {
    reconstructVehicleAuditTrail,
    reconstructClearanceAuditTrail,
    verifyAuditTrailIntegrity
};
