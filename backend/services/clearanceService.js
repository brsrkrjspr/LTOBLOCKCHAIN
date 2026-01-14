// TrustChain LTO - Clearance Service
// Handles automatic sending of clearance requests to organizations

const db = require('../database/services');
const dbModule = require('../database/db');
const docTypes = require('../config/documentTypes');
const hpgDatabaseService = require('./hpgDatabaseService');

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
        insurance: { sent: false, requestId: null, error: null },
        emission: { sent: false, requestId: null, error: null }
    };

    try {
        // Get vehicle data
        const vehicle = await db.getVehicleById(vehicleId);
        if (!vehicle) {
            throw new Error('Vehicle not found');
        }

        // Get all documents for the vehicle
        const allDocuments = await db.getDocumentsByVehicle(vehicleId);

        // 1. Send to HPG
        // For NEW REGISTRATION: requires owner_id and hpg_clearance (HPG Clearance Cert)
        // For TRANSFER: handled separately in transfer route
        const isNewRegistration = vehicle.registration_type === 'NEW' || 
                                  vehicle.origin_type === 'NEW' ||
                                  !vehicle.registration_type; // Default to NEW if not set
        
        const hasHPGDocs = allDocuments.some(d => {
            // Map document type to logical type
            const logicalType = docTypes.mapToLogicalType(d.document_type) || docTypes.mapLegacyType(d.document_type);
            if (isNewRegistration) {
                // New registration: needs owner ID and HPG clearance cert
                return logicalType === 'ownerId' ||
                       logicalType === 'hpgClearance' ||
                       d.document_type === 'owner_id' ||
                       d.document_type === 'hpg_clearance' ||
                       d.document_type === 'pnpHpgClearance';
            } else {
                // Transfer: needs owner ID and OR/CR (handled in transfer route)
                return logicalType === 'ownerId' ||
                       logicalType === 'registrationCert' ||
                       d.document_type === 'owner_id' ||
                       d.document_type === 'or_cr' ||
                       d.document_type === 'registration_cert';
            }
        }) || (documents && (
            isNewRegistration ? (
                documents.ownerValidId ||
                documents.ownerId ||
                documents.hpgClearance ||
                documents.pnpHpgClearance
            ) : (
                documents.ownerValidId ||
                documents.ownerId ||
                documents.registrationCert ||
                documents.orCr
            )
        ));

        if (hasHPGDocs) {
            try {
                const hpgResult = await sendToHPG(vehicleId, vehicle, allDocuments, requestedBy);
                results.hpg = hpgResult;
            } catch (error) {
                console.error('Error auto-sending to HPG:', error);
                results.hpg.error = error.message;
            }
        } else {
            console.log(`[Auto-Send] Skipping HPG - no owner_id or hpg_clearance documents found for new registration`);
        }

        // 2. Send to Insurance (requires: insurance_cert)
        // Use document type mapping to properly detect documents
        const hasInsuranceDoc = allDocuments.some(d => {
            const logicalType = docTypes.mapToLogicalType(d.document_type) || docTypes.mapLegacyType(d.document_type);
            return logicalType === 'insuranceCert' ||
                   d.document_type === 'insurance_cert' ||
                   d.document_type === 'insurance';
        }) || (documents && (
            documents.insuranceCertificate ||
            documents.insuranceCert ||
            documents.insurance
        ));

        if (hasInsuranceDoc) {
            try {
                const insuranceResult = await sendToInsurance(vehicleId, vehicle, allDocuments, requestedBy);
                results.insurance = insuranceResult;
            } catch (error) {
                console.error('Error auto-sending to Insurance:', error);
                results.insurance.error = error.message;
            }
        } else {
            console.log(`[Auto-Send] Skipping Insurance - no insurance_cert document found`);
        }

        // 3. Send to Emission (requires: emission_cert)
        // Use document type mapping to properly detect documents
        const hasEmissionDoc = allDocuments.some(d => {
            const logicalType = docTypes.mapToLogicalType(d.document_type) || docTypes.mapLegacyType(d.document_type);
            return logicalType === 'emissionCert' ||
                   d.document_type === 'emission_cert' ||
                   d.document_type === 'emission';
        }) || (documents && (
            documents.emissionCert ||
            documents.emission
        ));

        if (hasEmissionDoc) {
            try {
                const emissionResult = await sendToEmission(vehicleId, vehicle, allDocuments, requestedBy);
                results.emission = emissionResult;
            } catch (error) {
                console.error('Error auto-sending to Emission:', error);
                results.emission.error = error.message;
            }
        } else {
            console.log(`[Auto-Send] Skipping Emission - no emission_cert document found`);
        }

        // Update vehicle status to PENDING_VERIFICATION if at least one request was sent
        const anySent = results.hpg.sent || results.insurance.sent || results.emission.sent;
        if (anySent) {
            await db.updateVehicle(vehicleId, { status: 'PENDING_VERIFICATION' });
            
            // Log to history with auto-verification results
            const autoVerifySummary = [];
            if (results.insurance.autoVerification) {
                autoVerifySummary.push(`Insurance: ${results.insurance.autoVerification.status} (${results.insurance.autoVerification.automated ? 'Auto' : 'Manual'})`);
            }
            if (results.emission.autoVerification) {
                autoVerifySummary.push(`Emission: ${results.emission.autoVerification.status} (${results.emission.autoVerification.automated ? 'Auto' : 'Manual'})`);
            }
            if (results.hpg.autoVerification) {
                autoVerifySummary.push(`HPG: Pre-verified (${results.hpg.autoVerification.canPreFill ? 'Data extracted' : 'No data'})`);
            }
            
            await db.addVehicleHistory({
                vehicleId,
                action: 'CLEARANCE_REQUESTS_AUTO_SENT',
                description: `Clearance requests automatically sent to organizations. HPG: ${results.hpg.sent ? 'Yes' : 'No'}, Insurance: ${results.insurance.sent ? 'Yes' : 'No'}, Emission: ${results.emission.sent ? 'Yes' : 'No'}. ${autoVerifySummary.length > 0 ? 'Auto-verification: ' + autoVerifySummary.join(', ') : ''}`,
                performedBy: requestedBy,
                transactionId: null,
                metadata: {
                    hpgRequestId: results.hpg.requestId,
                    insuranceRequestId: results.insurance.requestId,
                    emissionRequestId: results.emission.requestId,
                    autoVerificationResults: {
                        insurance: results.insurance.autoVerification,
                        emission: results.emission.autoVerification,
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
    // Check if HPG request already exists
    const existingRequests = await db.getClearanceRequestsByVehicle(vehicleId);
    const existingHPGRequest = existingRequests.find(r => 
        r.request_type === 'hpg' && 
        r.status !== 'REJECTED' && 
        r.status !== 'COMPLETED'
    );
    
    if (existingHPGRequest) {
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

    // Filter HPG-relevant documents using document type mapping
    // For NEW REGISTRATION: HPG needs owner_id and hpg_clearance (HPG Clearance Cert)
    // For TRANSFER: Will be handled separately in transfer route
    const isTransfer = vehicle.registration_type === 'TRANSFER' || 
                       vehicle.origin_type === 'TRANSFER' ||
                       (vehicle.purpose && vehicle.purpose.toLowerCase().includes('transfer'));
    
    const hpgDocuments = allDocuments.filter(d => {
        const logicalType = docTypes.mapToLogicalType(d.document_type) || docTypes.mapLegacyType(d.document_type);
        // For new registration: only owner ID and HPG clearance cert
        if (!isTransfer) {
            return logicalType === 'ownerId' ||
                   logicalType === 'hpgClearance' ||
                   d.document_type === 'owner_id' ||
                   d.document_type === 'hpg_clearance' ||
                   d.document_type === 'pnpHpgClearance';
        } else {
            // For transfer: include OR/CR and owner ID (transfer route will handle this)
            return logicalType === 'ownerId' ||
                   logicalType === 'registrationCert' ||
                   d.document_type === 'owner_id' ||
                   d.document_type === 'or_cr' ||
                   d.document_type === 'registration_cert';
        }
    });

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
    } else {
        // Transfer: get OR/CR
        orCrDoc = hpgDocuments.find(d => {
            const logicalType = docTypes.mapToLogicalType(d.document_type) || docTypes.mapLegacyType(d.document_type);
            return logicalType === 'registrationCert' || 
                   d.document_type === 'or_cr' || 
                   d.document_type === 'registration_cert';
        });
        registrationCertDoc = orCrDoc;
    }

    // Create clearance request
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

    console.log(`[Auto-Send→HPG] Request created: ${clearanceRequest.id}`);

    // Detect if this is a transfer of ownership or new registration
    const isTransfer = clearanceRequest.metadata?.transferRequestId || 
                       clearanceRequest.purpose?.toLowerCase().includes('transfer');
    
    console.log(`[Auto-Send→HPG] Request type: ${isTransfer ? 'TRANSFER' : 'NEW_REGISTRATION'}`);

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

/**
 * Send clearance request to Emission
 */
async function sendToEmission(vehicleId, vehicle, allDocuments, requestedBy) {
    // Check if emission request already exists
    const existingRequests = await db.getClearanceRequestsByVehicle(vehicleId);
    const existingEmissionRequest = existingRequests.find(r => 
        r.request_type === 'emission' && 
        r.status !== 'REJECTED' && 
        r.status !== 'COMPLETED'
    );
    
    if (existingEmissionRequest) {
        return {
            sent: false,
            requestId: existingEmissionRequest.id,
            error: 'Emission verification request already exists'
        };
    }

    // Find emission verifier
    const emissionVerifiers = await dbModule.query(
        "SELECT id FROM users WHERE role = 'emission_verifier' AND is_active = true LIMIT 1"
    );
    const assignedTo = emissionVerifiers.rows[0]?.id || null;

    // Get emission document using document type mapping
    const emissionDoc = allDocuments.find(d => {
        const logicalType = docTypes.mapToLogicalType(d.document_type) || docTypes.mapLegacyType(d.document_type);
        return logicalType === 'emissionCert' ||
               d.document_type === 'emission_cert' ||
               d.document_type === 'emission' ||
               (d.original_name && d.original_name.toLowerCase().includes('emission'));
    });

    const emissionDocuments = emissionDoc ? [{
        id: emissionDoc.id,
        type: emissionDoc.document_type,
        cid: emissionDoc.ipfs_cid,
        path: emissionDoc.file_path,
        filename: emissionDoc.original_name
    }] : [];

    // Create clearance request
    const clearanceRequest = await db.createClearanceRequest({
        vehicleId,
        requestType: 'emission',
        requestedBy,
        purpose: 'Initial Vehicle Registration - Emission Verification',
        notes: 'Automatically sent upon vehicle registration submission',
        metadata: {
            vehicleVin: vehicle.vin,
            vehiclePlate: vehicle.plate_number,
            vehicleMake: vehicle.make,
            vehicleModel: vehicle.model,
            vehicleYear: vehicle.year,
            ownerName: vehicle.owner_name,
            ownerEmail: vehicle.owner_email,
            documentId: emissionDoc?.id || null,
            documentCid: emissionDoc?.ipfs_cid || null,
            documentPath: emissionDoc?.file_path || null,
            documentType: emissionDoc?.document_type || null,
            documentFilename: emissionDoc?.original_name || null,
            documents: emissionDocuments
        },
        assignedTo
    });

    // Update vehicle verification status
    await db.updateVerificationStatus(vehicleId, 'emission', 'PENDING', null, null);

    // Add to history
    await db.addVehicleHistory({
        vehicleId,
        action: 'EMISSION_VERIFICATION_REQUESTED',
        description: `Emission verification automatically requested`,
        performedBy: requestedBy,
        transactionId: null,
        metadata: { clearanceRequestId: clearanceRequest.id, documentId: emissionDoc?.id }
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

    console.log(`[Auto-Send→Emission] Request created: ${clearanceRequest.id}`);

    // Trigger auto-verification if emission document exists
    let autoVerificationResult = null;
    if (emissionDoc) {
        try {
            const autoVerificationService = require('./autoVerificationService');
            autoVerificationResult = await autoVerificationService.autoVerifyEmission(
                vehicleId,
                emissionDoc,
                vehicle
            );
            
            console.log(`[Auto-Verify→Emission] Result: ${autoVerificationResult.status}, Automated: ${autoVerificationResult.automated}`);
            
            // Add auto-verification result to history
            if (autoVerificationResult.automated !== false) {
                await db.addVehicleHistory({
                    vehicleId,
                    action: autoVerificationResult.status === 'APPROVED' 
                        ? 'EMISSION_AUTO_VERIFIED_APPROVED' 
                        : 'EMISSION_AUTO_VERIFIED_PENDING',
                    description: autoVerificationResult.status === 'APPROVED'
                        ? `Emission auto-verified and approved. Score: ${autoVerificationResult.score}%`
                        : `Emission auto-verified but flagged for manual review. Score: ${autoVerificationResult.score}%, Reason: ${autoVerificationResult.reason}`,
                    performedBy: requestedBy,
                    transactionId: null,
                    metadata: {
                        clearanceRequestId: clearanceRequest.id,
                        autoVerificationResult
                    }
                });
            }
        } catch (autoVerifyError) {
            console.error('[Auto-Verify→Emission] Error:', autoVerifyError);
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
