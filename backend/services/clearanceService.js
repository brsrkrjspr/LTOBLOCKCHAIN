// TrustChain LTO - Clearance Service
// Handles automatic sending of clearance requests to organizations

const db = require('../database/services');
const dbModule = require('../database/db');
const docTypes = require('../config/documentTypes');
const hpgDatabaseService = require('./hpgDatabaseService');

// Emission feature removed (no emission clearance workflow).
/**
 * Wait for documents to be available with exponential backoff
 * @param {string} vehicleId - Vehicle ID
 * @param {number} maxRetries - Maximum retry attempts (default: 5)
 * @param {number} initialDelay - Initial delay in ms (default: 100)
 * @returns {Promise<Array>} Array of documents or empty array
 */
async function waitForDocuments(vehicleId, maxRetries = 5, initialDelay = 100) {
    // Try immediate query first
    let documents = await db.getDocumentsByVehicle(vehicleId);
    if (documents && documents.length > 0) {
        console.log(`[Auto-Send] Documents found immediately: ${documents.length}`);
        return documents;
    }
    
    // Retry with exponential backoff
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        const delay = initialDelay * Math.pow(2, attempt); // Exponential: 100ms, 200ms, 400ms, 800ms, 1600ms
        console.log(`[Auto-Send] Attempt ${attempt + 1}/${maxRetries}: No documents found, waiting ${delay}ms...`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        
        documents = await db.getDocumentsByVehicle(vehicleId);
        if (documents && documents.length > 0) {
            console.log(`[Auto-Send] Documents found after ${attempt + 1} retry(ies): ${documents.length}`);
            return documents;
        }
    }
    
    // Last attempt - query by uploaded_at window instead of vehicle_id
    // This catches documents that were uploaded but not yet linked
    console.log(`[Auto-Send] All retries exhausted. Trying time-window fallback...`);
    
    try {
        const vehicle = await db.getVehicleById(vehicleId);
        if (vehicle && vehicle.created_at) {
            // Query documents uploaded within 2 minutes of vehicle creation
            const windowStart = new Date(vehicle.created_at.getTime() - 120000); // 2 minutes before
            const windowEnd = new Date(vehicle.created_at.getTime() + 120000); // 2 minutes after
            
            const windowResult = await dbModule.query(`
                SELECT d.* 
                FROM documents d
                WHERE d.uploaded_at BETWEEN $1 AND $2
                AND (d.vehicle_id = $3 OR d.vehicle_id IS NULL)
                ORDER BY d.uploaded_at DESC
            `, [windowStart, windowEnd, vehicleId]);
            
            if (windowResult.rows && windowResult.rows.length > 0) {
                console.log(`[Auto-Send] Found ${windowResult.rows.length} document(s) via time-window fallback`);
                return windowResult.rows;
            }
        }
    } catch (windowError) {
        console.error(`[Auto-Send] Time-window fallback failed:`, windowError);
    }
    
    console.warn(`[Auto-Send] No documents found after all methods. Vehicle may not have documents yet.`);
    return [];
}

async function autoSendClearanceRequests(vehicleId, documents, requestedBy) {
    const results = {
        hpg: { sent: false, requestId: null, error: null },
        insurance: { sent: false, requestId: null, error: null }
    };

    try {
        // Get vehicle data
        const vehicle = await db.getVehicleById(vehicleId);
        if (!vehicle) {
            throw new Error('Vehicle not found');
        }

        // Wait for documents with improved retry logic
        let allDocuments = await waitForDocuments(vehicleId);
        
        if (allDocuments.length === 0) {
            console.warn(`[Auto-Send] ⚠️ Still no documents found after retry. Documents may not be linked yet.`);
        }
        
        // Add detailed logging for debugging
        console.log(`[Auto-Send] Vehicle ${vehicleId}:`);
        console.log(`  - Registration Type: ${vehicle.registration_type || 'NOT SET'}`);
        console.log(`  - Origin Type: ${vehicle.origin_type || 'NOT SET'}`);
        console.log(`  - Total Documents: ${allDocuments.length}`);
        console.log(`  - Document Types:`, allDocuments.map(d => `${d.document_type} (${d.original_name || d.filename})`));
        
        // 1. Send to HPG
        // For NEW REGISTRATION: requires owner_id and hpg_clearance (HPG Clearance Cert)
        // For TRANSFER: handled separately in transfer route
        const isNewRegistration = vehicle.registration_type === 'NEW' || 
                                  vehicle.origin_type === 'NEW' ||
                                  !vehicle.registration_type; // Default to NEW if not set
        
        // Improved detection: check both database type directly AND mapped logical type
        const hasHPGDocs = allDocuments.some(d => {
            const dbType = d.document_type;
            
            // Direct database type check (most reliable)
            if (isNewRegistration) {
                // New registration: needs owner_id OR hpg_clearance (either one is enough)
                if (dbType === 'owner_id' || dbType === 'hpg_clearance') {
                    return true;
                }
            } else {
                // Transfer: needs owner_id OR registration_cert/or_cr
                if (dbType === 'owner_id' || dbType === 'or_cr' || dbType === 'registration_cert') {
                    return true;
                }
            }
            
            // Fallback: check mapped logical type
            const logicalType = docTypes.mapToLogicalType(dbType) || docTypes.mapLegacyType(dbType);
            if (isNewRegistration) {
                return logicalType === 'ownerId' || logicalType === 'hpgClearance';
            } else {
                return logicalType === 'ownerId' || logicalType === 'registrationCert';
            }
        });

        if (hasHPGDocs) {
            try {
                console.log(`[Auto-Send→HPG] Sending request for vehicle ${vehicleId}`);
                const hpgResult = await sendToHPG(vehicleId, vehicle, allDocuments, requestedBy);
                results.hpg = hpgResult;
                console.log(`[Auto-Send→HPG] Result:`, hpgResult);
            } catch (error) {
                console.error('[Auto-Send→HPG] Error:', error);
                console.error('[Auto-Send→HPG] Error stack:', error.stack);
                results.hpg.error = error.message;
            }
        } else {
            console.log(`[Auto-Send→HPG] Skipping - no owner_id or hpg_clearance documents found`);
            console.log(`[Auto-Send→HPG] Document detection:`, {
                totalDocuments: allDocuments.length,
                documentTypes: allDocuments.map(d => d.document_type),
                hasHPGDocs: hasHPGDocs,
                detectionMethod: 'database_query',
                isNewRegistration: isNewRegistration
            });
            console.log(`[Auto-Send→HPG] Available documents:`, allDocuments.map(d => ({
                type: d.document_type,
                logicalType: docTypes.mapToLogicalType(d.document_type) || docTypes.mapLegacyType(d.document_type),
                name: d.original_name || d.filename
            })));
        }

        // 2. Send to Insurance (requires: insurance_cert)
        // Improved detection: check both database type directly AND mapped logical type
        const hasInsuranceDoc = allDocuments.some(d => {
            const dbType = d.document_type;
            
            // Direct database type check (most reliable)
            if (dbType === 'insurance_cert' || dbType === 'insurance') {
                return true;
            }
            
            // Fallback: check mapped logical type
            const logicalType = docTypes.mapToLogicalType(dbType) || docTypes.mapLegacyType(dbType);
            return logicalType === 'insuranceCert';
        });

        if (hasInsuranceDoc) {
            try {
                console.log(`[Auto-Send→Insurance] Sending request for vehicle ${vehicleId}`);
                const insuranceResult = await sendToInsurance(vehicleId, vehicle, allDocuments, requestedBy);
                results.insurance = insuranceResult;
                console.log(`[Auto-Send→Insurance] Result:`, insuranceResult);
            } catch (error) {
                console.error('[Auto-Send→Insurance] Error:', error);
                console.error('[Auto-Send→Insurance] Error stack:', error.stack);
                results.insurance.error = error.message;
            }
        } else {
            console.log(`[Auto-Send→Insurance] Skipping - no insurance_cert document found`);
            console.log(`[Auto-Send→Insurance] Document detection:`, {
                totalDocuments: allDocuments.length,
                documentTypes: allDocuments.map(d => d.document_type),
                hasInsuranceDoc: hasInsuranceDoc,
                detectionMethod: 'database_query'
            });
            // Enhanced logging
            console.log(`[Auto-Send→Insurance] Available document types:`, 
                allDocuments.map(d => ({
                    id: d.id,
                    type: d.document_type,
                    logicalType: docTypes.mapToLogicalType(d.document_type) || docTypes.mapLegacyType(d.document_type),
                    filename: d.original_name || d.filename
                }))
            );
            
            // Check if 'other' documents exist that might be insurance
            const otherDocs = allDocuments.filter(d => d.document_type === 'other');
            if (otherDocs.length > 0) {
                console.warn(`[Auto-Send→Insurance] Found ${otherDocs.length} document(s) with type 'other' that may need correction:`, 
                    otherDocs.map(d => ({ id: d.id, filename: d.original_name || d.filename }))
                );
            }
        }

        // Update vehicle status if at least one request was sent
        const anySent = results.hpg.sent || results.insurance.sent;
        if (anySent) {
            // NOTE: vehicle_status is an enum. Valid values: SUBMITTED, REGISTERED, APPROVED, REJECTED, SUSPENDED
            // Use SUBMITTED for vehicles awaiting clearance verification
            await db.updateVehicle(vehicleId, { status: 'SUBMITTED' });
            
            // Log to history with auto-verification results
            const autoVerifySummary = [];
            if (results.insurance.autoVerification) {
                autoVerifySummary.push(`Insurance: ${results.insurance.autoVerification.status} (${results.insurance.autoVerification.automated ? 'Auto' : 'Manual'})`);
            }
            if (results.hpg.autoVerification) {
                autoVerifySummary.push(`HPG: Pre-verified (${results.hpg.autoVerification.canPreFill ? 'Data extracted' : 'No data'})`);
            }
            
            await db.addVehicleHistory({
                vehicleId,
                action: 'CLEARANCE_REQUESTS_AUTO_SENT',
                description: `Clearance requests automatically sent to organizations. HPG: ${results.hpg.sent ? 'Yes' : 'No'}, Insurance: ${results.insurance.sent ? 'Yes' : 'No'}. ${autoVerifySummary.length > 0 ? 'Auto-verification: ' + autoVerifySummary.join(', ') : ''}`,
                performedBy: requestedBy,
                transactionId: null,
                metadata: {
                    hpgRequestId: results.hpg.requestId,
                    insuranceRequestId: results.insurance.requestId,
                    autoVerificationResults: {
                        insurance: results.insurance.autoVerification,
                        hpg: results.hpg.autoVerification
                    }
                }
            });
        }

        return results;

    } catch (error) {
        console.error('Error in autoSendClearanceRequests:', error);
        throw error;
    }
}

/**
 * Send clearance request to HPG
 */
async function sendToHPG(vehicleId, vehicle, allDocuments, requestedBy) {
    console.log(`[sendToHPG] Starting for vehicle ${vehicleId}`);
    
    // Check if HPG request already exists
    const existingRequests = await db.getClearanceRequestsByVehicle(vehicleId);
    const existingHPGRequest = existingRequests.find(r => 
        r.request_type === 'hpg' && 
        r.status !== 'REJECTED' && 
        r.status !== 'COMPLETED'
    );
    
    if (existingHPGRequest) {
        console.log(`[sendToHPG] Request already exists: ${existingHPGRequest.id}`);
        return {
            sent: false,
            requestId: existingHPGRequest.id,
            error: 'HPG clearance request already exists'
        };
    }

    // Find HPG admin user (HPG admin has role='admin' with organization='Highway Patrol Group')
    const hpgAdmins = await dbModule.query(
        "SELECT id FROM users WHERE role = 'admin' AND (organization = 'Highway Patrol Group' OR email LIKE '%hpg%') AND is_active = true LIMIT 1"
    );
    const assignedTo = hpgAdmins.rows[0]?.id || null;
    console.log(`[sendToHPG] HPG Admin found: ${assignedTo ? 'Yes' : 'No'}`);

    // Filter HPG-relevant documents using document type mapping
    // For NEW REGISTRATION: HPG needs owner_id and hpg_clearance (HPG Clearance Cert)
    // For TRANSFER: Will be handled separately in transfer route
    const isTransfer = vehicle.registration_type === 'TRANSFER' || 
                       vehicle.origin_type === 'TRANSFER' ||
                       (vehicle.purpose && vehicle.purpose.toLowerCase().includes('transfer'));
    
    console.log(`[sendToHPG] Is Transfer: ${isTransfer}`);
    console.log(`[sendToHPG] All documents before filtering:`, allDocuments.map(d => ({
        type: d.document_type,
        name: d.original_name || d.filename
    })));
    
    const hpgDocuments = allDocuments.filter(d => {
        const logicalType = docTypes.mapToLogicalType(d.document_type) || docTypes.mapLegacyType(d.document_type);
        // For new registration: only owner ID and HPG clearance cert
        if (!isTransfer) {
            const matches = logicalType === 'ownerId' ||
                   logicalType === 'hpgClearance' ||
                   d.document_type === 'owner_id' ||
                   d.document_type === 'hpg_clearance' ||
                   d.document_type === 'pnpHpgClearance';
            if (matches) {
                console.log(`[sendToHPG] Document matched (NEW): ${d.document_type} -> ${logicalType}`);
            }
            return matches;
        } else {
            // For transfer: include OR/CR and owner ID (transfer route will handle this)
            const matches = logicalType === 'ownerId' ||
                   logicalType === 'registrationCert' ||
                   d.document_type === 'owner_id' ||
                   d.document_type === 'or_cr' ||
                   d.document_type === 'registration_cert';
            if (matches) {
                console.log(`[sendToHPG] Document matched (TRANSFER): ${d.document_type} -> ${logicalType}`);
            }
            return matches;
        }
    });
    
    console.log(`[sendToHPG] Filtered HPG documents: ${hpgDocuments.length}`, hpgDocuments.map(d => ({
        type: d.document_type,
        name: d.original_name || d.filename
    })));

    // Find documents using logical type mapping
    // For NEW REGISTRATION: Owner ID and HPG Clearance Cert
    // For TRANSFER: Owner ID and OR/CR (handled in transfer route)
    const ownerIdDoc = hpgDocuments.find(d => {
        const logicalType = docTypes.mapToLogicalType(d.document_type) || docTypes.mapLegacyType(d.document_type);
        return logicalType === 'ownerId' || d.document_type === 'owner_id';
    });
    
    let orCrDoc = null;
    let registrationCertDoc = null;
    let hpgClearanceDoc = null;
    
    if (!isTransfer) {
        // New registration: get HPG Clearance Cert
        hpgClearanceDoc = hpgDocuments.find(d => {
            const logicalType = docTypes.mapToLogicalType(d.document_type) || docTypes.mapLegacyType(d.document_type);
            return logicalType === 'hpgClearance' || 
                   d.document_type === 'hpg_clearance' ||
                   d.document_type === 'pnpHpgClearance';
        });
        console.log(`[sendToHPG] Owner ID Doc: ${ownerIdDoc ? ownerIdDoc.id : 'NOT FOUND'}`);
        console.log(`[sendToHPG] HPG Clearance Doc: ${hpgClearanceDoc ? hpgClearanceDoc.id : 'NOT FOUND'}`);
    } else {
        // Transfer: get OR/CR
        orCrDoc = hpgDocuments.find(d => {
            const logicalType = docTypes.mapToLogicalType(d.document_type) || docTypes.mapLegacyType(d.document_type);
            return logicalType === 'registrationCert' || 
                   d.document_type === 'or_cr' || 
                   d.document_type === 'registration_cert';
        });
        registrationCertDoc = orCrDoc;
        console.log(`[sendToHPG] Owner ID Doc: ${ownerIdDoc ? ownerIdDoc.id : 'NOT FOUND'}`);
        console.log(`[sendToHPG] OR/CR Doc: ${orCrDoc ? orCrDoc.id : 'NOT FOUND'}`);
    }

    // Create clearance request
    console.log(`[sendToHPG] Creating clearance request with ${hpgDocuments.length} document(s)`);
    console.log(`[sendToHPG] Vehicle ID: ${vehicleId}, Requested By: ${requestedBy}, Assigned To: ${assignedTo}`);
    
    const clearanceRequest = await db.createClearanceRequest({
        vehicleId,
        requestType: 'hpg',
        requestedBy,
        purpose: 'Initial Vehicle Registration - HPG Clearance',
        notes: 'Automatically sent upon vehicle registration submission',
        metadata: {
            vehicleVin: vehicle.vin,
            vehiclePlate: vehicle.plate_number,
            vehicleMake: vehicle.make,
            vehicleModel: vehicle.model,
            vehicleYear: vehicle.year,
            vehicleColor: vehicle.color,
            engineNumber: vehicle.engine_number,
            chassisNumber: vehicle.chassis_number,
            ownerName: vehicle.owner_name,
            ownerEmail: vehicle.owner_email,
            ownerIdDocId: ownerIdDoc?.id || null,
            ownerIdDocCid: ownerIdDoc?.ipfs_cid || null,
            ownerIdDocPath: ownerIdDoc?.file_path || null,
            ownerIdDocFilename: ownerIdDoc?.original_name || null,
            orCrDocId: orCrDoc?.id || null,
            orCrDocCid: orCrDoc?.ipfs_cid || null,
            orCrDocPath: orCrDoc?.file_path || null,
            orCrDocFilename: orCrDoc?.original_name || null,
            registrationCertDocId: registrationCertDoc?.id || null,
            registrationCertDocCid: registrationCertDoc?.ipfs_cid || null,
            hpgClearanceDocId: hpgClearanceDoc?.id || null,
            hpgClearanceDocCid: hpgClearanceDoc?.ipfs_cid || null,
            hpgClearanceDocPath: hpgClearanceDoc?.file_path || null,
            hpgClearanceDocFilename: hpgClearanceDoc?.original_name || null,
            documents: hpgDocuments.map(d => ({
                id: d.id,
                type: d.document_type,
                cid: d.ipfs_cid,
                path: d.file_path,
                filename: d.original_name
            }))
        },
        assignedTo
    });

    // Update vehicle verification status (create initial PENDING record)
    await db.updateVerificationStatus(vehicleId, 'hpg', 'PENDING', null, null);

    // Add to history
    await db.addVehicleHistory({
        vehicleId,
        action: 'HPG_CLEARANCE_REQUESTED',
        description: `HPG clearance automatically requested. Purpose: Initial Vehicle Registration - HPG Clearance`,
        performedBy: requestedBy,
        transactionId: null,
        metadata: { clearanceRequestId: clearanceRequest.id }
    });

    // Create notification for HPG admin
    if (assignedTo) {
        await db.createNotification({
            userId: assignedTo,
            title: 'New HPG Clearance Request',
            message: `New clearance request for vehicle ${vehicle.plate_number || vehicle.vin}`,
            type: 'info'
        });
    }

    console.log(`[Auto-Send→HPG] Request created successfully: ${clearanceRequest.id}`);
    console.log(`[Auto-Send→HPG] Request details:`, {
        id: clearanceRequest.id,
        vehicleId: clearanceRequest.vehicle_id,
        requestType: clearanceRequest.request_type,
        status: clearanceRequest.status,
        assignedTo: clearanceRequest.assigned_to
    });

    // Note: isTransfer is already determined above (line 227) based on vehicle registration_type
    // Re-check for transfer based on clearance request metadata (for transfer-specific requests)
    const isTransferRequest = clearanceRequest.metadata?.transferRequestId || 
                              clearanceRequest.purpose?.toLowerCase().includes('transfer');
    
    console.log(`[Auto-Send→HPG] Request type: ${isTransfer ? 'TRANSFER' : 'NEW_REGISTRATION'}`);
    console.log(`[Auto-Send→HPG] Transfer request flag: ${isTransferRequest}`);

    // PHASE 1 AUTOMATION: OCR Extraction (for transfers only) and Database Check (for both)
    let autoVerificationResult = null;
    let databaseCheckResult = null;
    let extractedData = {};

    // Step 1: OCR Extraction (only for transfers - they have existing OR/CR documents)
    if (isTransfer && orCrDoc) {
        try {
            const ocrService = require('./ocrService');
            const fs = require('fs').promises;
            
            // Check if file exists
            const orCrPath = orCrDoc.file_path || orCrDoc.filePath;
            if (orCrPath) {
                try {
                    await fs.access(orCrPath);
                    
                    const orCrMimeType = orCrDoc.mime_type || orCrDoc.mimeType || 'application/pdf';
                    const ownerIdPath = ownerIdDoc?.file_path || ownerIdDoc?.filePath;
                    const ownerIdMimeType = ownerIdDoc?.mime_type || ownerIdDoc?.mimeType;
                    
                    // Extract HPG info from OR/CR document
                    extractedData = await ocrService.extractHPGInfo(
                        orCrPath,
                        ownerIdPath || null,
                        orCrMimeType,
                        ownerIdMimeType || null
                    );
                    
                    console.log(`[Auto-Send→HPG] OCR extracted data:`, {
                        engineNumber: extractedData.engineNumber,
                        chassisNumber: extractedData.chassisNumber,
                        plateNumber: extractedData.plateNumber
                    });
                    
                    // Compare extracted data with vehicle record
                    const dataMatch = {
                        engineNumber: extractedData.engineNumber && vehicle.engine_number ? 
                                     extractedData.engineNumber.toUpperCase().trim() === vehicle.engine_number.toUpperCase().trim() : null,
                        chassisNumber: extractedData.chassisNumber && vehicle.chassis_number ? 
                                      extractedData.chassisNumber.toUpperCase().trim() === vehicle.chassis_number.toUpperCase().trim() : null,
                        plateNumber: extractedData.plateNumber && vehicle.plate_number ? 
                                    extractedData.plateNumber.toUpperCase().replace(/\s+/g, ' ').trim() === vehicle.plate_number.toUpperCase().replace(/\s+/g, ' ').trim() : null
                    };
                    
                    console.log(`[Auto-Send→HPG] Data match results:`, dataMatch);
                    
                    // Add data matching results to extracted data
                    extractedData.dataMatch = dataMatch;
                    extractedData.ocrExtracted = true;
                    extractedData.ocrExtractedAt = new Date().toISOString();
                    
                } catch (fileError) {
                    console.warn(`[Auto-Send→HPG] OR/CR file not accessible: ${fileError.message}`);
                }
            }
        } catch (ocrError) {
            console.error('[Auto-Send→HPG] OCR extraction error:', ocrError);
            // Continue without OCR data
        }
    } else if (!isTransfer) {
        // For new registrations, use vehicle metadata (already in clearance request)
        extractedData = {
            engineNumber: vehicle.engine_number,
            chassisNumber: vehicle.chassis_number,
            plateNumber: vehicle.plate_number,
            vin: vehicle.vin,
            ocrExtracted: false,
            source: 'vehicle_metadata'
        };
        console.log(`[Auto-Send→HPG] Using vehicle metadata (new registration)`);
    }

    // Step 2: Automated Database Check (for both new registrations and transfers)
    try {
        databaseCheckResult = await hpgDatabaseService.checkVehicle({
            plateNumber: vehicle.plate_number,
            engineNumber: vehicle.engine_number,
            chassisNumber: vehicle.chassis_number,
            vin: vehicle.vin
        });
        
        // Store database check result
        await hpgDatabaseService.storeCheckResult(clearanceRequest.id, databaseCheckResult);
        
        console.log(`[Auto-Send→HPG] Database check result:`, databaseCheckResult.status);
        
        // If vehicle is flagged, add warning to notes
        if (databaseCheckResult.status === 'FLAGGED') {
            const flaggedNote = `⚠️ WARNING: Vehicle found in HPG hot list. ${databaseCheckResult.details}`;
            await dbModule.query(
                `UPDATE clearance_requests SET notes = COALESCE(notes || E'\n', '') || $1 WHERE id = $2`,
                [flaggedNote, clearanceRequest.id]
            );
            
            // Create urgent notification for HPG admin
            if (assignedTo) {
                await db.createNotification({
                    userId: assignedTo,
                    title: '⚠️ URGENT: Vehicle Flagged in HPG Database',
                    message: `Vehicle ${vehicle.plate_number || vehicle.vin} found in HPG hot list. Immediate review required.`,
                    type: 'warning'
                });
            }
        }
    } catch (dbCheckError) {
        console.error('[Auto-Send→HPG] Database check error:', dbCheckError);
        // Continue without database check result
    }

    // Step 3: Update metadata with extracted data and database check results
    const updatedMetadata = {
        ...clearanceRequest.metadata,
        ...(Object.keys(extractedData).length > 0 && { extractedData }),
        ...(databaseCheckResult && { hpgDatabaseCheck: databaseCheckResult }),
        automationPhase1: {
            completed: true,
            completedAt: new Date().toISOString(),
            isTransfer,
            ocrExtracted: isTransfer && Object.keys(extractedData).length > 0,
            databaseChecked: !!databaseCheckResult
        }
    };
    
    await dbModule.query(
        `UPDATE clearance_requests SET metadata = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [JSON.stringify(updatedMetadata), clearanceRequest.id]
    );

    // Add automation history entry
    await db.addVehicleHistory({
        vehicleId,
        action: 'HPG_AUTOMATION_PHASE1',
        description: `HPG Phase 1 automation completed. ${isTransfer ? 'OCR extracted' : 'Metadata used'}, Database: ${databaseCheckResult?.status || 'ERROR'}`,
        performedBy: requestedBy,
        transactionId: null,
        metadata: {
            clearanceRequestId: clearanceRequest.id,
            isTransfer,
            extractedData: Object.keys(extractedData).length > 0 ? extractedData : null,
            databaseCheckResult
        }
    });

    return {
        sent: true,
        requestId: clearanceRequest.id,
        automation: {
            phase1: {
                completed: true,
                isTransfer,
                ocrExtracted: isTransfer && Object.keys(extractedData).length > 0,
                databaseChecked: !!databaseCheckResult,
                databaseStatus: databaseCheckResult?.status || 'ERROR'
            }
        }
    };
}

/**
 * Send clearance request to Insurance
 */
async function sendToInsurance(vehicleId, vehicle, allDocuments, requestedBy, existingVerificationResult = null) {
    // Check if insurance request already exists
    const existingRequests = await db.getClearanceRequestsByVehicle(vehicleId);
    const existingInsuranceRequest = existingRequests.find(r => 
        r.request_type === 'insurance' && 
        r.status !== 'REJECTED' && 
        r.status !== 'COMPLETED'
    );
    
    if (existingInsuranceRequest) {
        return {
            sent: false,
            requestId: existingInsuranceRequest.id,
            error: 'Insurance verification request already exists'
        };
    }

    // Find insurance verifier
    const insuranceVerifiers = await dbModule.query(
        "SELECT id FROM users WHERE role = 'insurance_verifier' AND is_active = true LIMIT 1"
    );
    const assignedTo = insuranceVerifiers.rows[0]?.id || null;

    // Get insurance document using document type mapping
    const insuranceDoc = allDocuments.find(d => {
        const logicalType = docTypes.mapToLogicalType(d.document_type) || docTypes.mapLegacyType(d.document_type);
        return logicalType === 'insuranceCert' ||
               d.document_type === 'insurance_cert' ||
               d.document_type === 'insurance' ||
               (d.original_name && d.original_name.toLowerCase().includes('insurance'));
    });

    const insuranceDocuments = insuranceDoc ? [{
        id: insuranceDoc.id,
        type: insuranceDoc.document_type,
        cid: insuranceDoc.ipfs_cid,
        path: insuranceDoc.file_path,
        filename: insuranceDoc.original_name
    }] : [];

    // Step 1: Run auto-verification FIRST (independent of request creation)
    let verificationResult = existingVerificationResult;
    
    if (!verificationResult && insuranceDoc) {
        try {
            console.log(`[Auto-Send→Insurance] Running auto-verification before request creation...`);
            const autoVerificationService = require('./autoVerificationService');
            verificationResult = await autoVerificationService.autoVerifyInsurance(
                vehicleId,
                insuranceDoc,
                vehicle
            );
            console.log(`[Auto-Send→Insurance] Auto-verification completed: ${verificationResult.status}, Automated: ${verificationResult.automated}`);
            
            // Verification results are automatically saved to vehicle_verifications table by autoVerifyInsurance
            // No need to save separately here
            
        } catch (verifError) {
            console.error(`[Auto-Send→Insurance] Auto-verification failed:`, verifError);
            console.error(`[Auto-Send→Insurance] Error stack:`, verifError.stack);
            
            // Save error to vehicle_verifications for admin review
            try {
                await db.updateVerificationStatus(vehicleId, 'insurance', 'PENDING', 'system', 
                    `Auto-verification failed: ${verifError.message}`, {
                        automated: false,
                        verificationScore: 0,
                        verificationMetadata: {
                            autoVerified: false,
                            verificationResult: 'ERROR',
                            error: verifError.message,
                            errorStack: verifError.stack,
                            verifiedAt: new Date().toISOString()
                        }
                    }
                );
                console.log(`[Auto-Send→Insurance] Saved verification error to database for admin review`);
            } catch (saveError) {
                console.error(`[Auto-Send→Insurance] Failed to save error to database:`, saveError);
            }
            
            // Continue - create request anyway, verification can be done manually
            verificationResult = {
                status: 'PENDING',
                error: verifError.message,
                automated: false,
                verifiedAt: new Date().toISOString(),
                verifiedBy: 'system'
            };
        }
    }

    // Step 2: Create clearance request (with verification results if available)
    try {
        const requestMetadata = {
            vehicleVin: vehicle.vin,
            vehiclePlate: vehicle.plate_number,
            vehicleMake: vehicle.make,
            vehicleModel: vehicle.model,
            vehicleYear: vehicle.year,
            ownerName: vehicle.owner_name,
            ownerEmail: vehicle.owner_email,
            documentId: insuranceDoc?.id || null,
            documentCid: insuranceDoc?.ipfs_cid || null,
            documentPath: insuranceDoc?.file_path || null,
            documentType: insuranceDoc?.document_type || null,
            documentFilename: insuranceDoc?.original_name || null,
            documents: insuranceDocuments,
            autoVerificationResult: verificationResult,  // Include verification results
            autoVerified: verificationResult?.automated || false,
            verifiedAt: verificationResult?.verifiedAt || null,
            verifiedBy: verificationResult?.verifiedBy || 'system'
        };
        
        const clearanceRequest = await db.createClearanceRequest({
            vehicleId,
            requestType: 'insurance',
            requestedBy,
            purpose: 'Initial Vehicle Registration - Insurance Verification',
            notes: 'Automatically sent upon vehicle registration submission',
            metadata: requestMetadata,
            assignedTo
        });

        console.log(`[Auto-Send→Insurance] Request created: ${clearanceRequest.id} (with verification: ${verificationResult?.status || 'none'})`);

        // Step 3: Update clearance request status if verification was successful
        if (verificationResult && verificationResult.automated && verificationResult.status === 'APPROVED') {
            await db.updateClearanceRequestStatus(clearanceRequest.id, 'APPROVED', {
                verifiedBy: 'system',
                verifiedAt: verificationResult.verifiedAt || new Date().toISOString(),
                notes: `Auto-verified and approved. Score: ${verificationResult.score || 0}%`,
                autoVerified: true,
                autoVerificationResult: verificationResult
            });
            console.log(`[Auto-Verify→Insurance] Updated clearance request ${clearanceRequest.id} status to APPROVED`);
        }

        // Update vehicle verification status (if not already updated by autoVerifyInsurance)
        if (verificationResult && verificationResult.status) {
            try {
                await db.updateVerificationStatus(
                    vehicleId, 
                    'insurance', 
                    verificationResult.status, 
                    verificationResult.verifiedBy || 'system', 
                    verificationResult.reason || null,
                    {
                        automated: verificationResult.automated || false,
                        verificationScore: verificationResult.score || 0,
                        verificationMetadata: {
                            autoVerified: verificationResult.automated || false,
                            verificationResult: verificationResult.status,
                            ...verificationResult
                        }
                    }
                );
            } catch (updateError) {
                console.warn(`[Auto-Send→Insurance] Failed to update vehicle verification status:`, updateError.message);
                // Don't fail - verification status may have been updated by autoVerifyInsurance
            }
        } else {
            // Set to PENDING if no verification result
            await db.updateVerificationStatus(vehicleId, 'insurance', 'PENDING', null, null);
        }

        // Add to history
        await db.addVehicleHistory({
            vehicleId,
            action: verificationResult && verificationResult.automated && verificationResult.status === 'APPROVED'
                ? 'INSURANCE_AUTO_VERIFIED_APPROVED'
                : verificationResult && verificationResult.automated
                ? 'INSURANCE_AUTO_VERIFIED_PENDING'
                : 'INSURANCE_VERIFICATION_REQUESTED',
            description: verificationResult && verificationResult.automated && verificationResult.status === 'APPROVED'
                ? `Insurance auto-verified and approved. Score: ${verificationResult.score || 0}%`
                : verificationResult && verificationResult.automated
                ? `Insurance auto-verified but flagged for manual review. Score: ${verificationResult.score || 0}%, Reason: ${verificationResult.reason || 'Unknown'}`
                : `Insurance verification automatically requested`,
            performedBy: requestedBy,
            transactionId: null,
            metadata: { 
                clearanceRequestId: clearanceRequest.id, 
                documentId: insuranceDoc?.id,
                autoVerificationResult: verificationResult
            }
        });

        // Create notification
        if (assignedTo) {
            await db.createNotification({
                userId: assignedTo,
                title: verificationResult && verificationResult.automated && verificationResult.status === 'APPROVED'
                    ? 'Insurance Auto-Verified and Approved'
                    : 'New Insurance Verification Request',
                message: verificationResult && verificationResult.automated && verificationResult.status === 'APPROVED'
                    ? `Insurance for vehicle ${vehicle.plate_number || vehicle.vin} was auto-verified and approved. Score: ${verificationResult.score || 0}%`
                    : `New insurance verification request for vehicle ${vehicle.plate_number || vehicle.vin}`,
                type: verificationResult && verificationResult.automated && verificationResult.status === 'APPROVED' ? 'success' : 'info'
            });
        }

        return {
            sent: true,
            requestId: clearanceRequest.id,
            autoVerification: verificationResult
        };
        
    } catch (requestError) {
        console.error(`[Auto-Send→Insurance] Request creation failed:`, requestError);
        console.error(`[Auto-Send→Insurance] Error stack:`, requestError.stack);
        
        // Verification results are still saved in vehicle_verifications table
        // Admin can manually create request later and it will use existing verification
        console.log(`[Auto-Send→Insurance] Verification results saved. Admin can create request manually.`);
        
        // Re-throw to be caught by caller
        throw requestError;
    }
}

module.exports = {
    autoSendClearanceRequests,
    waitForDocuments
};
