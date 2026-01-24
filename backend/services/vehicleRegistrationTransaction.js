// TrustChain LTO - Vehicle Registration Transaction Helper
// Handles atomic vehicle creation with document linking

const db = require('./db');

/**
 * Create vehicle with documents in a single transaction
 * @param {Object} params - Registration parameters
 * @param {Object} params.vehicle - Vehicle data
 * @param {Object} params.ownerUser - Owner user object
 * @param {Object} params.registrationData - Registration data including documents
 * @param {Object} params.safeMetadata - Safe metadata for history
 * @returns {Promise<Object>} - { vehicle, documentCids, documentLinkingResults }
 */
async function createVehicleWithDocumentsTransaction({ vehicle, ownerUser, registrationData, safeMetadata }) {
    const documentCids = {};
    const documentLinkingResults = {
        total: 0,
        linked: 0,
        failed: 0,
        failures: [],
        linkedDocuments: []
    };
    
    let newVehicle;
    
    await db.transaction(async (client) => {
        // 1. Create vehicle (within transaction)
        const vehicleResult = await client.query(
            `INSERT INTO vehicles (
                vin, plate_number, make, model, year, color, engine_number, chassis_number,
                vehicle_type, vehicle_category, passenger_capacity, gross_vehicle_weight, net_weight,
                registration_type, owner_id, status, notes, origin_type
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
            RETURNING *`,
            [
                vehicle.vin, vehicle.plateNumber, vehicle.make, vehicle.model, vehicle.year, vehicle.color,
                vehicle.engineNumber, vehicle.chassisNumber,
                vehicle.vehicleType || 'Car', vehicle.vehicleCategory,
                parseInt(vehicle.passengerCapacity), parseFloat(vehicle.grossVehicleWeight), parseFloat(vehicle.netWeight),
                vehicle.classification || 'Private', ownerUser.id, 'SUBMITTED', registrationData.notes, 'NEW_REG'
            ]
        );
        
        newVehicle = vehicleResult.rows[0];
        
        if (!newVehicle || !newVehicle.id) {
            throw new Error('Vehicle creation failed: newVehicle is missing or invalid');
        }
        
        // 2. Add to history (within transaction)
        try {
            const truncatedDescription = 'Vehicle registration submitted';
            await client.query(
                `INSERT INTO vehicle_history (vehicle_id, action, description, performed_by, transaction_id, metadata)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 RETURNING *`,
                [
                    newVehicle.id,
                    'REGISTERED',
                    truncatedDescription,
                    ownerUser.id,
                    null,
                    safeMetadata ? JSON.stringify(safeMetadata) : null
                ]
            );
        } catch (historyError) {
            console.error('❌ Failed to add vehicle history:', historyError);
            // Don't fail registration for history errors - log and continue
        }
        
        // 3. Link documents (all within transaction)
        if (registrationData.documents && typeof registrationData.documents === 'object') {
            documentLinkingResults.total = Object.keys(registrationData.documents).length;
            const docTypes = require('../config/documentTypes');
            
            // UUID validation regex (RFC 4122 compliant)
            const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            
            function isValidUUID(str) {
                return typeof str === 'string' && UUID_REGEX.test(str);
            }
            
            for (const [frontendKey, docData] of Object.entries(registrationData.documents)) {
                // Validate docData is an object
                if (!docData || typeof docData !== 'object') {
                    console.warn(`⚠️ Invalid document data for ${frontendKey}, skipping`);
                    continue;
                }
                
                // Map frontend key to logical type, then to database type
                const logicalType = docTypes.mapLegacyType(frontendKey);
                const dbDocType = docTypes.mapToDbType(logicalType);
                
                // Validate mapping results
                if (!logicalType || !dbDocType) {
                    console.error(`❌ Unknown document type key: ${frontendKey} (mapped to: ${logicalType}, dbType: ${dbDocType})`);
                    continue;
                }
                
                // Explicitly reject 'other' type
                if (dbDocType === 'other') {
                    console.error(`❌ Document type mapped to 'other' for key: ${frontendKey}. This indicates a configuration error.`);
                    continue;
                }
                
                // Validate logicalType is a valid logical type
                if (!docTypes.isValidLogicalType(logicalType)) {
                    console.warn(`⚠️ Invalid logical type for ${frontendKey}: ${logicalType}, skipping`);
                    continue;
                }
                
                try {
                    let documentRecord = null;
                    
                    // Method 1: If document ID is provided (from upload response), update directly
                    if (docData.id && typeof docData.id === 'string') {
                        // Skip TEMP_ and doc_ prefixed IDs
                        if (docData.id.startsWith('TEMP_') || docData.id.startsWith('doc_')) {
                            console.warn(`⚠️ Skipping invalid document ID format: ${docData.id} (temporary ID from failed database save)`);
                        }
                        // Validate UUID format before querying
                        else if (isValidUUID(docData.id)) {
                            try {
                                const docByIdResult = await client.query(
                                    'SELECT * FROM documents WHERE id = $1',
                                    [docData.id]
                                );
                                if (docByIdResult.rows && docByIdResult.rows.length > 0) {
                                    documentRecord = docByIdResult.rows[0];
                                    // Update to link to vehicle (within transaction)
                                    await client.query(
                                        'UPDATE documents SET vehicle_id = $1, document_type = $2, uploaded_by = $3 WHERE id = $4',
                                        [newVehicle.id, dbDocType, ownerUser.id, documentRecord.id]
                                    );
                                    console.log(`✅ Linked document ${frontendKey} by ID: ${documentRecord.id}`);
                                }
                            } catch (queryError) {
                                console.error(`❌ Error querying document by ID ${docData.id}:`, queryError.message);
                            }
                        } else {
                            console.warn(`⚠️ Invalid UUID format for document ID: ${docData.id}. Expected UUID format.`);
                        }
                    }
                    
                    // Method 2: If not found by ID, try filename or CID (for unlinked documents)
                    if (!documentRecord && (docData.filename || docData.cid)) {
                        try {
                            const docResult = await client.query(
                                'SELECT * FROM documents WHERE (filename = $1 OR ipfs_cid = $2) AND (vehicle_id IS NULL OR vehicle_id = $3) LIMIT 1',
                                [docData.filename || null, docData.cid || null, newVehicle.id]
                            );
                            if (docResult.rows && docResult.rows.length > 0) {
                                documentRecord = docResult.rows[0];
                                // Update to link to vehicle (within transaction)
                                await client.query(
                                    'UPDATE documents SET vehicle_id = $1, document_type = $2, uploaded_by = $3 WHERE id = $4',
                                    [newVehicle.id, dbDocType, ownerUser.id, documentRecord.id]
                                );
                                console.log(`✅ Linked document ${frontendKey} by filename/CID: ${documentRecord.id}`);
                            }
                        } catch (queryError) {
                            console.error(`❌ Error querying document by filename/CID:`, queryError.message);
                        }
                    }
                    
                    // Method 3: Try to find any unlinked document for this owner (fallback)
                    if (!documentRecord && ownerUser.id) {
                        try {
                            const recentUnlinkedResult = await client.query(
                                `SELECT * FROM documents 
                                 WHERE vehicle_id IS NULL 
                                 AND uploaded_by = $1 
                                 AND document_type = $2
                                 AND uploaded_at > NOW() - INTERVAL '1 hour'
                                 ORDER BY uploaded_at DESC 
                                 LIMIT 1`,
                                [ownerUser.id, dbDocType]
                            );
                            if (recentUnlinkedResult.rows && recentUnlinkedResult.rows.length > 0) {
                                documentRecord = recentUnlinkedResult.rows[0];
                                // Update to link to vehicle (within transaction)
                                await client.query(
                                    'UPDATE documents SET vehicle_id = $1, document_type = $2 WHERE id = $3',
                                    [newVehicle.id, dbDocType, documentRecord.id]
                                );
                                console.log(`✅ Linked document ${frontendKey} by recent unlinked document: ${documentRecord.id}`);
                            }
                        } catch (queryError) {
                            console.error(`❌ Error querying recent unlinked documents:`, queryError.message);
                        }
                    }
                    
                    // Method 4: Create new document record if not found (with minimal data)
                    if (!documentRecord) {
                        if (docData.filename || docData.cid) {
                            try {
                                const createDocResult = await client.query(
                                    `INSERT INTO documents (
                                        vehicle_id, document_type, filename, original_name, file_path,
                                        file_size, mime_type, file_hash, uploaded_by, ipfs_cid
                                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                                        RETURNING *`,
                                    [
                                        newVehicle.id,
                                        dbDocType,
                                        docData.filename || `unknown_${frontendKey}_${Date.now()}`,
                                        docData.filename || `unknown_${frontendKey}`,
                                        docData.url || `/uploads/${docData.filename || 'unknown'}`,
                                        0,
                                        docData.mimeType || 'application/pdf',
                                        null,
                                        ownerUser.id,
                                        docData.cid || null
                                    ]
                                );
                                documentRecord = createDocResult.rows[0];
                                console.log(`✅ Created new document record for ${frontendKey}: ${documentRecord.id}`);
                            } catch (createError) {
                                console.error(`❌ Error creating document record for ${frontendKey}:`, createError.message);
                            }
                        } else {
                            console.warn(`⚠️ Cannot link ${frontendKey} document: No ID, filename, CID, or unlinked document found`);
                        }
                    }
                    
                    // Track linking result
                    if (documentRecord) {
                        documentLinkingResults.linked++;
                        documentLinkingResults.linkedDocuments.push({
                            documentType: frontendKey,
                            id: documentRecord.id,
                            cid: documentRecord.ipfs_cid || docData.cid || null
                        });
                        
                        // Collect CID for blockchain
                        if ((documentRecord.ipfs_cid || docData.cid) && logicalType && docTypes.isValidLogicalType(logicalType)) {
                            documentCids[logicalType] = {
                                cid: documentRecord.ipfs_cid || docData.cid,
                                filename: documentRecord.filename || docData.filename || frontendKey,
                                documentType: dbDocType
                            };
                            console.log(`✅ Collected CID for blockchain: ${logicalType} = ${documentCids[logicalType].cid}`);
                        }
                    } else {
                        documentLinkingResults.failed++;
                        documentLinkingResults.failures.push({
                            documentType: frontendKey,
                            reason: 'No document record found after all fallback methods',
                            cid: docData.cid || null
                        });
                    }
                } catch (docError) {
                    console.error(`❌ Error linking ${frontendKey} document:`, docError);
                    documentLinkingResults.failed++;
                    documentLinkingResults.failures.push({
                        documentType: frontendKey,
                        reason: `Error during linking: ${docError.message}`,
                        cid: docData.cid || null
                    });
                }
            }
        } else {
            console.warn('⚠️ No documents provided in registration data - vehicle will be registered without documents');
        }
        
        // Transaction will commit automatically if no errors thrown
        console.log(`✅ Transaction committed: Vehicle ${newVehicle.id} with ${documentLinkingResults.linked} documents`);
    });
    
    // Update linked count based on documentCids
    const linkedCount = Object.keys(documentCids).length;
    documentLinkingResults.linked = linkedCount;
    documentLinkingResults.failed = documentLinkingResults.total - linkedCount;
    
    return {
        vehicle: newVehicle,
        documentCids,
        documentLinkingResults
    };
}

module.exports = {
    createVehicleWithDocumentsTransaction
};
