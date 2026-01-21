// TrustChain LTO - Clearance Service
// Handles automatic sending of clearance requests to organizations

const db = require('../database/services');
const dbModule = require('../database/db');
const docTypes = require('../config/documentTypes');
const hpgDatabaseService = require('./hpgDatabaseService');

// Emission feature removed (no emission clearance workflow).

/**
 * Automatically send clearance requests to all required organizations
 * @param {string} vehicleId - The vehicle ID
 * @param {Object} documents - Document references from registration
 * @param {string} requestedBy - User ID who submitted the registration
 * @returns {Promise<Object>} Results of auto-send operation
 */
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

        // Small delay to ensure documents are committed to database
        // This prevents race condition where documents are linked but not yet visible
        await new Promise(resolve => setTimeout(resolve, 100));

        // Get all documents for the vehicle (retry once if empty)
        let allDocuments = await db.getDocumentsByVehicle(vehicleId);
        
        // If no documents found, wait a bit longer and retry (documents might still be committing)
        if (allDocuments.length === 0) {
            console.log(`[Auto-Send] No documents found on first attempt, retrying...`);
            await new Promise(resolve => setTimeout(resolve, 500));
            allDocuments = await db.getDocumentsByVehicle(vehicleId);
            if (allDocuments.length === 0) {
                console.warn(`[Auto-Send] ⚠️ Still no documents found after retry. Documents may not be linked yet.`);
            } else {
                console.log(`[Auto-Send] ✅ Documents found on retry: ${allDocuments.length} document(s)`);
            }
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

        // 3. Emission clearance removed from workflow (no-op).

        // Update vehicle status if at least one request was sent
        const anySent = results.hpg.sent || results.insurance.sent;
        if (anySent) {
            // NOTE: vehicle_status is an enum. Valid values: SUBMITTED, PENDING_BLOCKCHAIN, REGISTERED, APPROVED, REJECTED, SUSPENDED
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
async function sendToInsurance(vehicleId, vehicle, allDocuments, requestedBy) {
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

    // Create clearance request
    const clearanceRequest = await db.createClearanceRequest({
        vehicleId,
        requestType: 'insurance',
        requestedBy,
        purpose: 'Initial Vehicle Registration - Insurance Verification',
        notes: 'Automatically sent upon vehicle registration submission',
        metadata: {
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
            documents: insuranceDocuments
        },
        assignedTo
    });

    // Update vehicle verification status
    await db.updateVerificationStatus(vehicleId, 'insurance', 'PENDING', null, null);

    // Add to history
    await db.addVehicleHistory({
        vehicleId,
        action: 'INSURANCE_VERIFICATION_REQUESTED',
        description: `Insurance verification automatically requested`,
        performedBy: requestedBy,
        transactionId: null,
        metadata: { clearanceRequestId: clearanceRequest.id, documentId: insuranceDoc?.id }
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

    console.log(`[Auto-Send→Insurance] Request created: ${clearanceRequest.id}`);

    // Trigger auto-verification if insurance document exists
    let autoVerificationResult = null;
    if (insuranceDoc) {
        try {
            const autoVerificationService = require('./autoVerificationService');
            autoVerificationResult = await autoVerificationService.autoVerifyInsurance(
                vehicleId,
                insuranceDoc,
                vehicle
            );
            
            console.log(`[Auto-Verify→Insurance] Result: ${autoVerificationResult.status}, Automated: ${autoVerificationResult.automated}`);
            
            // Update clearance request status if auto-approved
            if (autoVerificationResult.automated && autoVerificationResult.status === 'APPROVED') {
                await db.updateClearanceRequestStatus(clearanceRequest.id, 'APPROVED', {
                    verifiedBy: 'system',
                    verifiedAt: new Date().toISOString(),
                    notes: `Auto-verified and approved. Score: ${autoVerificationResult.score}%`,
                    autoVerified: true,
                    autoVerificationResult
                });
                console.log(`[Auto-Verify→Insurance] Updated clearance request ${clearanceRequest.id} status to APPROVED`);
            }
            
            // Add auto-verification result to history
            if (autoVerificationResult.automated) {
                await db.addVehicleHistory({
                    vehicleId,
                    action: autoVerificationResult.status === 'APPROVED' 
                        ? 'INSURANCE_AUTO_VERIFIED_APPROVED' 
                        : 'INSURANCE_AUTO_VERIFIED_PENDING',
                    description: autoVerificationResult.status === 'APPROVED'
                        ? `Insurance auto-verified and approved. Score: ${autoVerificationResult.score}%`
                        : `Insurance auto-verified but flagged for manual review. Score: ${autoVerificationResult.score}%, Reason: ${autoVerificationResult.reason}`,
                    performedBy: requestedBy,
                    transactionId: null,
                    metadata: {
                        clearanceRequestId: clearanceRequest.id,
                        autoVerificationResult
                    }
                });
            }
        } catch (autoVerifyError) {
            console.error('[Auto-Verify→Insurance] Error:', autoVerifyError);
            // Don't fail clearance request creation if auto-verification fails
        }
    }

    return {
        sent: true,
        requestId: clearanceRequest.id,
        autoVerification: autoVerificationResult
    };
}

module.exports = {
    autoSendClearanceRequests
};
