// TrustChain LTO - Clearance Service
// Handles automatic sending of clearance requests to organizations

const db = require('../database/services');
const dbModule = require('../database/db');

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

        // 1. Send to HPG (requires: hpg_clearance or registration_cert or owner_id)
        const hasHPGDocs = allDocuments.some(d => 
            d.document_type === 'hpg_clearance' ||
            d.document_type === 'registration_cert' || 
            d.document_type === 'owner_id' ||
            (documents && (documents.hpgClearance || documents.registrationCert || documents.ownerId))
        );

        if (hasHPGDocs) {
            try {
                const hpgResult = await sendToHPG(vehicleId, vehicle, allDocuments, requestedBy);
                results.hpg = hpgResult;
            } catch (error) {
                console.error('Error auto-sending to HPG:', error);
                results.hpg.error = error.message;
            }
        } else {
            console.log(`[Auto-Send] Skipping HPG - no registration_cert or owner_id documents found`);
        }

        // 2. Send to Insurance (requires: insurance_cert)
        const hasInsuranceDoc = allDocuments.some(d => 
            d.document_type === 'insurance_cert' ||
            d.document_type === 'insuranceCert' ||
            d.document_type === 'insurance' ||
            (documents && documents.insuranceCert)
        );

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
        const hasEmissionDoc = allDocuments.some(d => 
            d.document_type === 'emission_cert' ||
            d.document_type === 'emissionCert' ||
            d.document_type === 'emission' ||
            (documents && documents.emissionCert)
        );

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
            
            // Log to history
            await db.addVehicleHistory({
                vehicleId,
                action: 'CLEARANCE_REQUESTS_AUTO_SENT',
                description: `Clearance requests automatically sent to organizations. HPG: ${results.hpg.sent ? 'Yes' : 'No'}, Insurance: ${results.insurance.sent ? 'Yes' : 'No'}, Emission: ${results.emission.sent ? 'Yes' : 'No'}`,
                performedBy: requestedBy,
                transactionId: null,
                metadata: {
                    hpgRequestId: results.hpg.requestId,
                    insuranceRequestId: results.insurance.requestId,
                    emissionRequestId: results.emission.requestId
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

    // Find HPG admin user
    const hpgAdmins = await dbModule.query(
        "SELECT id FROM users WHERE role = 'hpg_admin' AND is_active = true LIMIT 1"
    );
    const assignedTo = hpgAdmins.rows[0]?.id || null;

    // Filter HPG-relevant documents (hpg_clearance, registration_cert, owner_id, or_cr)
    const hpgDocuments = allDocuments.filter(d => 
        d.document_type === 'hpg_clearance' ||
        d.document_type === 'hpgClearance' ||
        d.document_type === 'registration_cert' ||
        d.document_type === 'owner_id' ||
        d.document_type === 'or_cr' ||
        d.document_type === 'registrationCert' ||
        d.document_type === 'ownerId' ||
        d.document_type === 'orCr'
    );

    const ownerIdDoc = hpgDocuments.find(d => 
        d.document_type === 'owner_id' || d.document_type === 'ownerId'
    );
    const orCrDoc = hpgDocuments.find(d => 
        d.document_type === 'or_cr' || d.document_type === 'orCr'
    );
    const registrationCertDoc = hpgDocuments.find(d => 
        d.document_type === 'registration_cert' || d.document_type === 'registrationCert'
    );

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
            hpgClearanceDocId: hpgClearanceDoc?.id || null,
            hpgClearanceDocCid: hpgClearanceDoc?.ipfs_cid || null,
            hpgClearanceDocPath: hpgClearanceDoc?.file_path || null,
            hpgClearanceDocFilename: hpgClearanceDoc?.original_name || null,
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

    return {
        sent: true,
        requestId: clearanceRequest.id
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

    // Get insurance document only
    const insuranceDoc = allDocuments.find(d => 
        d.document_type === 'insurance_cert' || 
        d.document_type === 'insuranceCert' ||
        d.document_type === 'insurance' ||
        (d.original_name && d.original_name.toLowerCase().includes('insurance'))
    );

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

    return {
        sent: true,
        requestId: clearanceRequest.id
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

    // Get emission document only
    const emissionDoc = allDocuments.find(d => 
        d.document_type === 'emission_cert' || 
        d.document_type === 'emissionCert' ||
        d.document_type === 'emission' ||
        (d.original_name && d.original_name.toLowerCase().includes('emission'))
    );

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

    return {
        sent: true,
        requestId: clearanceRequest.id
    };
}

module.exports = {
    autoSendClearanceRequests
};
