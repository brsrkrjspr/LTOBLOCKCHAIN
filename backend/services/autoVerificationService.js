// TrustChain LTO - Auto-Verification Service
// Automatically verifies insurance and HPG documents upon registration submission

const ocrService = require('./ocrService');
const insuranceDatabase = require('./insuranceDatabaseService');
const fraudDetectionService = require('./fraudDetectionService');
const certificateBlockchain = require('./certificateBlockchainService');
const storageService = require('./storageService');
const db = require('../database/services');
const fabricService = require('./optimizedFabricService');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const crypto = require('crypto');

// Emission feature removed (no emission auto-verification).
class AutoVerificationService {
    constructor() {
        this.enabled = process.env.AUTO_VERIFICATION_ENABLED !== 'false';
        this.minScore = parseInt(process.env.AUTO_VERIFICATION_MIN_SCORE || '90');
    }

    /**
     * Automatically verify insurance document
     * @param {string} vehicleId - Vehicle ID
     * @param {Object} insuranceDoc - Insurance document record
     * @param {Object} vehicle - Vehicle data
     * @returns {Promise<Object>} Verification result
     */
    async autoVerifyInsurance(vehicleId, insuranceDoc, vehicle) {
        if (!this.enabled) {
            return { status: 'PENDING', automated: false, reason: 'Auto-verification disabled' };
        }

        let ipfsTempPath = null;
        try {
            console.log(`[Auto-Verify] Starting insurance verification for vehicle ${vehicleId}`);

            // Get document file path (local or via storageService when IPFS/stale path)
            // Enhanced file path resolution with multiple fallback methods
            let filePath = insuranceDoc.file_path || insuranceDoc.filePath;
            let resolvedVia = null;

            // Method 1: Check if file_path exists and is accessible
            if (filePath && await this.fileExists(filePath)) {
                resolvedVia = 'file_path';
                console.log(`[Auto-Verify] Using file_path: ${filePath}`);
            }
            // Method 2: Try storageService.getDocument if file_path doesn't exist
            else if (insuranceDoc.id) {
                try {
                    const doc = await storageService.getDocument(insuranceDoc.id);
                    if (doc && doc.filePath && (await this.fileExists(doc.filePath))) {
                        filePath = doc.filePath;
                        resolvedVia = 'storageService';
                        if (doc.storageMode === 'ipfs') {
                            ipfsTempPath = doc.filePath;
                        }
                        console.log(`[Auto-Verify] Resolved via storageService: ${filePath} (mode: ${doc.storageMode || 'local'})`);
                    }
                } catch (e) {
                    console.warn('[Auto-Verify] storageService.getDocument failed:', e.message);
                }
            }

            // Method 3: Try constructing path from document ID if still not found
            if (!filePath || !(await this.fileExists(filePath))) {
                if (insuranceDoc.id) {
                    // Try common upload paths
                    const possiblePaths = [
                        path.join(process.env.UPLOAD_DIR || './uploads', `${insuranceDoc.id}.pdf`),
                        path.join(process.env.UPLOAD_DIR || './uploads', insuranceDoc.filename || insuranceDoc.original_name),
                        path.join('./uploads', `${insuranceDoc.id}.pdf`),
                        path.join('./uploads', insuranceDoc.filename || insuranceDoc.original_name)
                    ];

                    for (const possiblePath of possiblePaths) {
                        if (await this.fileExists(possiblePath)) {
                            filePath = possiblePath;
                            resolvedVia = 'path_construction';
                            console.log(`[Auto-Verify] Resolved via path construction: ${filePath}`);
                            break;
                        }
                    }
                }
            }

            // Final check: if still no file, return error
            if (!filePath || !(await this.fileExists(filePath))) {
                const errorReason = `Insurance document file not found. Tried: ${resolvedVia || 'none'}. Document ID: ${insuranceDoc.id || 'N/A'}`;
                console.error(`[Auto-Verify] ${errorReason}`);
                return {
                    status: 'PENDING',
                    automated: false,
                    reason: errorReason,
                    confidence: 0,
                    filePathAttempts: {
                        file_path: insuranceDoc.file_path || insuranceDoc.filePath,
                        storageService: insuranceDoc.id ? 'attempted' : 'skipped',
                        pathConstruction: insuranceDoc.id ? 'attempted' : 'skipped'
                    }
                };
            }

            console.log(`[Auto-Verify] File resolved successfully via: ${resolvedVia}, path: ${filePath}`);

            // Extract data via OCR
            const ocrData = await ocrService.extractInsuranceInfo(filePath, insuranceDoc.mime_type || insuranceDoc.mimeType);
            console.log(`[Auto-Verify] OCR extracted:`, ocrData);

            const policyNumber = ocrData.insurancePolicyNumber || ocrData.policyNumber;
            if (!policyNumber) {
                const reason = 'Policy number not found in document';
                console.warn('[Auto-Verify] Insurance verification issue: ', reason);

                const systemUserId = 'system';
                // Set to PENDING instead of REJECTED, store results in metadata
                await db.updateVerificationStatus(
                    vehicleId,
                    'insurance',
                    'PENDING',
                    systemUserId,
                    `Auto-verification completed with issues: ${reason}`,
                    {
                        automated: true,
                        verificationScore: 0,
                        verificationMetadata: {
                            ocrData,
                            autoVerified: true,
                            verificationResult: 'FAILED',
                            reason,
                            flagReasons: [reason],
                            verifiedAt: new Date().toISOString(),
                            patternCheck: { valid: false, reason },
                            authenticityCheck: null,
                            hashCheck: null,
                            expiryCheck: null
                        }
                    }
                );

                // Update blockchain with audit trail
                try {
                    await fabricService.updateVerificationStatus(
                        vehicle.vin,
                        'insurance',
                        'PENDING',
                        `Auto-verification completed with issues: ${reason}`
                    );
                    console.log(`[Auto-Verify] ✅ Blockchain audit trail updated for insurance PENDING: ${vehicle.vin}`);
                } catch (blockchainError) {
                    console.error(`[Auto-Verify] ⚠️ Blockchain audit trail update failed (continuing):`, blockchainError.message);
                }

                return {
                    status: 'PENDING',
                    automated: true,
                    reason,
                    confidence: 0,
                    ocrData,
                    verificationResult: 'FAILED',
                    flagReasons: [reason]
                };
            }

            // Pattern validation
            const patternCheck = this.validateDocumentNumberFormat(policyNumber, 'insurance');
            console.log(`[Auto-Verify] Pattern check:`, patternCheck);

            if (!patternCheck.valid) {
                const reason = `Invalid policy number format: ${patternCheck.reason}`;
                console.warn('[Auto-Verify] Insurance verification issue (pattern): ', reason);

                const systemUserId = 'system';
                // Set to PENDING instead of REJECTED, store results in metadata
                await db.updateVerificationStatus(
                    vehicleId,
                    'insurance',
                    'PENDING',
                    systemUserId,
                    `Auto-verification completed with issues: ${reason}`,
                    {
                        automated: true,
                        verificationScore: 0,
                        verificationMetadata: {
                            ocrData,
                            autoVerified: true,
                            verificationResult: 'FAILED',
                            reason,
                            flagReasons: [reason],
                            verifiedAt: new Date().toISOString(),
                            patternCheck,
                            authenticityCheck: null,
                            hashCheck: null,
                            expiryCheck: null
                        }
                    }
                );

                // Update blockchain with audit trail
                try {
                    await fabricService.updateVerificationStatus(
                        vehicle.vin,
                        'insurance',
                        'PENDING',
                        `Auto-verification completed with issues: ${reason}`
                    );
                    console.log(`[Auto-Verify] ✅ Blockchain audit trail updated for insurance PENDING: ${vehicle.vin}`);
                } catch (blockchainError) {
                    console.error(`[Auto-Verify] ⚠️ Blockchain audit trail update failed (continuing):`, blockchainError.message);
                }

                return {
                    status: 'PENDING',
                    automated: true,
                    reason,
                    confidence: 0,
                    ocrData,
                    patternCheck,
                    verificationResult: 'FAILED',
                    flagReasons: [reason]
                };
            }

            // Check expiry date
            const expiryCheck = this.checkExpiry(ocrData.insuranceExpiry || ocrData.expiryDate);

            // Calculate file hash
            const fileHash = insuranceDoc.file_hash || crypto.createHash('sha256').update(await fs.readFile(filePath)).digest('hex');

            // ============================================
            // CERTIFICATE AUTHENTICITY CHECK (Blockchain Source of Truth)
            // Verify that the certificate was issued by the certificate generator
            // ============================================
            const authenticityCheck = await certificateBlockchain.checkCertificateAuthenticity(
                fileHash,
                vehicleId,
                'insurance'
            );
            console.log(`[Auto-Verify] Certificate authenticity check:`, {
                authentic: authenticityCheck.authentic,
                reason: authenticityCheck.reason,
                originalFound: authenticityCheck.originalCertificateFound,
                score: authenticityCheck.authenticityScore
            });

            // Generate composite hash
            const expiryDateISO = expiryCheck.expiryDate || new Date().toISOString();
            const compositeHash = certificateBlockchain.generateCompositeHash(
                policyNumber,
                vehicle.vin,
                expiryDateISO,
                fileHash
            );
            console.log(`[Auto-Verify] Composite hash: ${compositeHash.substring(0, 16)}...`);

            // Check for duplicate hash (document reuse)
            const hashCheck = await certificateBlockchain.checkHashDuplicate(compositeHash);
            console.log(`[Auto-Verify] Hash duplicate check:`, hashCheck);

            if (hashCheck.exists) {
                // Duplicate detected - set to PENDING with results stored
                const reason = `Document already used for vehicle ${hashCheck.vehicleId}. Duplicate detected.`;
                console.warn('[Auto-Verify] Insurance duplicate detected: ', reason);

                const systemUserId = 'system';
                await db.updateVerificationStatus(
                    vehicleId,
                    'insurance',
                    'PENDING',
                    systemUserId,
                    `Auto-verification completed with critical issue: ${reason}`,
                    {
                        automated: true,
                        verificationScore: 0,
                        verificationMetadata: {
                            ocrData,
                            autoVerified: true,
                            verificationResult: 'FAILED',
                            reason,
                            flagReasons: [reason],
                            verifiedAt: new Date().toISOString(),
                            patternCheck: patternCheck.valid ? patternCheck : null,
                            authenticityCheck: null,
                            hashCheck,
                            expiryCheck: null
                        }
                    }
                );

                // Update blockchain with audit trail
                try {
                    await fabricService.updateVerificationStatus(
                        vehicle.vin,
                        'insurance',
                        'PENDING',
                        `Auto-verification completed with critical issue: ${reason}`
                    );
                    console.log(`[Auto-Verify] ✅ Blockchain audit trail updated for insurance PENDING: ${vehicle.vin}`);
                } catch (blockchainError) {
                    console.error(`[Auto-Verify] ⚠️ Blockchain audit trail update failed (continuing):`, blockchainError.message);
                }

                return {
                    status: 'PENDING',
                    automated: true,
                    reason,
                    confidence: 0,
                    hashCheck,
                    verificationResult: 'FAILED',
                    flagReasons: [reason]
                };
            }

            // Calculate pattern-based score
            const verificationScore = this.calculatePatternBasedScore(
                policyNumber,
                'insurance',
                !hashCheck.exists,
                expiryCheck.isValid
            );
            console.log(`[Auto-Verify] Verification score: ${verificationScore.percentage}%`);

            // Data-based fallback: if hash does not match (e.g. re-saved/renamed file) but extracted data
            // matches issued_certificates, still allow auto-approval with reason (Insurance org requirement).
            // Note: We intentionally do NOT require expiryCheck.isValid here, because if VIN+policy match
            // an issued certificate, the certificate IS genuine even if OCR couldn't extract the expiry.
            let dataValidatedMatch = false;
            let dataValidatedCertificate = null;
            const ocrExpiry = ocrData.insuranceExpiry || ocrData.expiryDate;
            if (!authenticityCheck.authentic && patternCheck.valid && !hashCheck.exists) {
                console.log('[Auto-Verify] Data-based lookup attempt:', {
                    vehicleVin: vehicle.vin,
                    policyNumber,
                    ocrExpiry,
                    certificateType: 'insurance'
                });
                dataValidatedCertificate = await certificateBlockchain.findIssuedCertificateByExtractedData(
                    vehicle.vin,
                    policyNumber,
                    'insurance',
                    ocrExpiry
                );
                if (dataValidatedCertificate) {
                    dataValidatedMatch = true;
                    console.log('[Auto-Verify] Data-based match: extracted data matches issued_certificates (hash mismatch, e.g. re-saved or renamed file)');
                } else {
                    console.log('[Auto-Verify] Data-based lookup: no matching row in issued_certificates (cert may be external or VIN/cert-number/expiry mismatch)');
                }
            }

            // Decision logic: (1) Hash authentic path, or (2) Data-validated path (extracted data matches backend)
            const shouldApproveByHash = verificationScore.percentage >= 80 &&
                patternCheck.valid &&
                authenticityCheck.authentic &&
                !hashCheck.exists &&
                expiryCheck.isValid;
            // Data-validated path: if VIN+policy match issued_certificates, certificate is genuine
            // regardless of whether OCR could extract the expiry. This handles Puppeteer-generated PDFs
            // where OCR may fail to cleanly associate labels with input field values.
            const shouldApproveByData = dataValidatedMatch &&
                verificationScore.percentage >= 80 &&
                patternCheck.valid &&
                !hashCheck.exists;
            const shouldApprove = shouldApproveByHash || shouldApproveByData;

            if (shouldApprove) {
                // Store hash on blockchain
                // Note: Auto-verification runs server-side, no user context available
                // Use system account or default LTO admin identity
                let blockchainTxId = null;
                try {
                    const blockchainResult = await certificateBlockchain.storeCertificateHashOnBlockchain(
                        compositeHash,
                        {
                            certificateType: 'insurance',
                            vehicleVIN: vehicle.vin,
                            vehicleId: vehicleId,
                            certificateNumber: policyNumber,
                            applicationStatus: 'PENDING', // Will update when application approved
                            issuedAt: new Date().toISOString(),
                            issuedBy: 'system',
                            fileHash: fileHash,
                            ipfsCid: null // Auto-verification may not have IPFS CID
                        },
                        null // No user context - will use default admin identity
                    );
                    blockchainTxId = blockchainResult.transactionId;
                    console.log(`[Auto-Verify] Hash stored on blockchain: ${blockchainTxId}`);
                } catch (blockchainError) {
                    console.error('[Auto-Verify] Blockchain storage failed:', blockchainError);
                    // Continue with approval even if blockchain storage fails
                }

                // Auto-approve (hash-authentic or data-validated path)
                const systemUserId = 'system';
                const approvalNote = shouldApproveByData
                    ? `Auto-approved: extracted data matched backend (hash mismatch, e.g. re-saved or renamed file). Policy: ${policyNumber}, Score: ${verificationScore.percentage}%`
                    : `Auto-verified: Pattern valid, Certificate authentic, Hash unique, Score ${verificationScore.percentage}%, Policy: ${policyNumber}`;
                await db.updateVerificationStatus(
                    vehicleId,
                    'insurance',
                    'APPROVED',
                    systemUserId,
                    approvalNote,
                    {
                        automated: true,
                        verificationScore: verificationScore.percentage,
                        verificationMetadata: {
                            ocrData,
                            patternCheck,
                            hashCheck,
                            expiryCheck,
                            authenticityCheck,
                            compositeHash,
                            blockchainTxId,
                            verificationScore,
                            verifiedAt: new Date().toISOString(),
                            dataValidatedMatch: shouldApproveByData || undefined,
                            dataValidatedReason: shouldApproveByData ? 'Extracted data matched issued_certificates; file hash differed (e.g. re-saved or renamed file).' : undefined,
                            dataValidatedCertificateId: dataValidatedCertificate?.id || undefined
                        }
                    }
                );

                // Update blockchain with audit trail
                try {
                    await fabricService.updateVerificationStatus(
                        vehicle.vin,
                        'insurance',
                        'APPROVED',
                        approvalNote
                    );
                    console.log(`[Auto-Verify] ✅ Blockchain audit trail updated for insurance APPROVED: ${vehicle.vin}`);
                } catch (blockchainError) {
                    console.error(`[Auto-Verify] ⚠️ Blockchain audit trail update failed (continuing):`, blockchainError.message);
                    // Continue even if blockchain update fails - database is source of truth
                }

                return {
                    status: 'APPROVED',
                    automated: true,
                    confidence: verificationScore.percentage / 100,
                    score: verificationScore.percentage,
                    basis: verificationScore.checks,
                    ocrData,
                    patternCheck,
                    hashCheck,
                    authenticityCheck,
                    compositeHash,
                    blockchainTxId,
                    dataValidatedMatch: shouldApproveByData || undefined,
                    dataValidatedReason: shouldApproveByData ? 'Extracted data matched backend; hash mismatch (e.g. re-saved or renamed file).' : undefined
                };
            } else {
                // Clearly invalid / low-confidence → set to PENDING with results stored
                const reasons = [];
                if (!patternCheck.valid) reasons.push(`Invalid format: ${patternCheck.reason}`);
                if (!authenticityCheck.authentic) reasons.push(`Certificate authenticity failed: ${authenticityCheck.reason}`);
                if (hashCheck.exists) reasons.push('Document already used (duplicate)');
                if (!expiryCheck.isValid) reasons.push('Document expired');
                if (verificationScore.percentage < 80) reasons.push(`Low score: ${verificationScore.percentage}%`);

                const reason = reasons.join(', ') || 'Auto-verification failed checks';
                console.warn('[Auto-Verify] Insurance verification issues detected: ', reason);

                const systemUserId = 'system';
                // Set to PENDING instead of REJECTED, store all verification results
                await db.updateVerificationStatus(
                    vehicleId,
                    'insurance',
                    'PENDING',
                    systemUserId,
                    `Auto-verification completed with issues: ${reason}`,
                    {
                        automated: true,
                        verificationScore: verificationScore.percentage,
                        verificationMetadata: {
                            ocrData,
                            autoVerified: true,
                            verificationResult: 'FAILED',
                            patternCheck,
                            hashCheck,
                            expiryCheck,
                            authenticityCheck,
                            verificationScore,
                            verifiedAt: new Date().toISOString(),
                            flagReasons: reasons,
                            policyNumber: policyNumber
                        }
                    }
                );

                // Update blockchain with audit trail
                try {
                    await fabricService.updateVerificationStatus(
                        vehicle.vin,
                        'insurance',
                        'PENDING',
                        `Auto-verification completed with issues: ${reason}`
                    );
                    console.log(`[Auto-Verify] ✅ Blockchain audit trail updated for insurance PENDING: ${vehicle.vin}`);
                } catch (blockchainError) {
                    console.error(`[Auto-Verify] ⚠️ Blockchain audit trail update failed (continuing):`, blockchainError.message);
                }

                return {
                    status: 'PENDING',
                    automated: true,
                    reason,
                    confidence: verificationScore.percentage / 100,
                    score: verificationScore.percentage,
                    basis: verificationScore.checks,
                    ocrData,
                    patternCheck,
                    hashCheck,
                    authenticityCheck,
                    verificationResult: 'FAILED',
                    flagReasons: reasons
                };
            }
        } catch (error) {
            console.error('[Auto-Verify] Insurance verification error:', error);
            return {
                status: 'PENDING',
                automated: false,
                reason: `Verification error: ${error.message}`,
                confidence: 0
            };
        } finally {
            if (ipfsTempPath) { try { fsSync.unlinkSync(ipfsTempPath); } catch (_) { } }
        }
    }

    /**
     * Auto-verify HPG documents with hashing and duplicate detection
     * Similar to Insurance/Emission but always requires manual final approval
     * @param {string} vehicleId - Vehicle ID
     * @param {Array} documents - Array of document records
     * @param {Object} vehicle - Vehicle data
     * @returns {Promise<Object>} Auto-verification result with confidence score
     */
    async autoVerifyHPG(vehicleId, documents, vehicle) {
        if (!this.enabled) {
            return { status: 'PENDING', automated: false, reason: 'Auto-verification disabled' };
        }

        try {
            console.log(`[Auto-Verify] Starting HPG auto-verification for vehicle ${vehicleId}`);
            console.log(`[Auto-Verify] Received ${documents.length} document(s) for verification`);
            console.log(`[Auto-Verify] Document details:`, documents.map(d => ({
                id: d.id,
                document_type: d.document_type,
                type: d.type,
                original_name: d.original_name || d.originalName
            })));

            // Find HPG Clearance document (HPG receives hpg_clearance, not OR/CR)
            // For transfer requests, buyer uploads with type 'buyer_hpg_clearance' (transfer role)
            // but the actual document in DB has document_type = 'hpg_clearance'
            const hpgClearanceDoc = documents.find(d =>
                d.document_type === 'hpg_clearance' ||
                d.document_type === 'hpgClearance' ||
                d.document_type === 'pnp_hpg_clearance' ||
                d.document_type === 'buyer_hpg_clearance' || // Transfer role (from transfer_documents)
                d.type === 'hpg_clearance' ||
                d.type === 'hpgClearance' ||
                d.type === 'pnp_hpg_clearance' ||
                d.type === 'buyer_hpg_clearance' // Transfer role (from metadata.documents)
            );

            if (hpgClearanceDoc) {
                console.log(`[Auto-Verify] Found HPG clearance document:`, {
                    id: hpgClearanceDoc.id,
                    document_type: hpgClearanceDoc.document_type,
                    type: hpgClearanceDoc.type,
                    original_name: hpgClearanceDoc.original_name || hpgClearanceDoc.originalName
                });
            } else {
                console.warn(`[Auto-Verify] HPG clearance document not found. Available document types:`,
                    documents.map(d => ({ document_type: d.document_type, type: d.type }))
                );
            }

            // Fallback: Also check for OR/CR (for transfer cases where OR/CR is submitted)
            const clearanceDoc = hpgClearanceDoc || documents.find(d =>
                d.document_type === 'registration_cert' ||
                d.document_type === 'registrationCert' ||
                d.type === 'registration_cert' ||
                d.type === 'registrationCert' ||
                d.type === 'or_cr'
            );

            if (!clearanceDoc) {
                console.error(`[Auto-Verify] No HPG clearance or OR/CR document found. Available documents:`,
                    documents.map(d => ({
                        id: d.id,
                        document_type: d.document_type,
                        type: d.type,
                        original_name: d.original_name || d.originalName
                    }))
                );
                return {
                    status: 'PENDING',
                    automated: false,
                    reason: `HPG Clearance document not found. Available document types: ${documents.map(d => d.document_type || d.type).join(', ')}`,
                    confidence: 0
                };
            }

            // --------------------------------------------
            // 1) HASH-FIRST AUTHENTICITY (no hard path dependency)
            // --------------------------------------------
            const existingFileHash = clearanceDoc.file_hash || clearanceDoc.fileHash || null;
            const filePath = clearanceDoc.file_path || clearanceDoc.filePath || null;
            const hasLocalFile = filePath ? await this.fileExists(filePath) : false;

            let ocrData = {};

            // Run OCR only if we actually have a local file; OCR is OPTIONAL for authenticity
            if (hasLocalFile) {
                const docMimeType = clearanceDoc.mime_type || clearanceDoc.mimeType || 'application/pdf';
                const docType = hpgClearanceDoc ? 'hpg_clearance' : 'registration_cert';

                try {
                    const extractedText = await ocrService.extractText(filePath, docMimeType);
                    ocrData = ocrService.parseVehicleInfo(extractedText, docType) || {};
                    console.log(`[Auto-Verify] OCR extracted from ${docType}:`, ocrData);
                } catch (ocrError) {
                    console.warn('[Auto-Verify] HPG OCR failed, continuing with hash-only authenticity:', ocrError.message);
                }
            } else {
                console.warn('[Auto-Verify] HPG document file not available locally. Skipping OCR and relying on hash-only authenticity.');
            }

            // OCR-first values; these may be backfilled from trusted sources
            // (certificate data / vehicle metadata) after authenticity passes.
            let engineNumber = ocrData.engineNumber || null;
            let chassisNumber = ocrData.chassisNumber || ocrData.vin || null;

            // Calculate / obtain file hash
            console.log('🔐 [Auto-Verify HPG] Preparing file hash for authenticity check...');
            console.log('🔐 [Auto-Verify HPG] Existing file_hash in doc:', existingFileHash ? existingFileHash.substring(0, 16) + '...' : 'NOT SET');
            console.log('🔐 [Auto-Verify HPG] File path:', filePath || 'NONE');

            let fileHash = existingFileHash;

            // Best-effort: if hash missing but file exists, compute it; otherwise stay hash-first and fail open to manual review
            if (!fileHash && hasLocalFile) {
                try {
                    fileHash = crypto.createHash('sha256').update(await fs.readFile(filePath)).digest('hex');
                    console.log('🔐 [Auto-Verify HPG] Computed file_hash from local file:', fileHash.substring(0, 32) + '...');
                } catch (hashError) {
                    console.error('🔐 [Auto-Verify HPG] Error computing file hash from local file:', hashError.message);
                }
            }

            if (!fileHash) {
                console.warn('🔐 [Auto-Verify HPG] No file hash available for HPG document. Falling back to manual review.');
                return {
                    status: 'PENDING',
                    automated: false,
                    reason: 'File hash missing for HPG document. Cannot verify issuer authenticity automatically.',
                    confidence: 0
                };
            }

            console.log('🔐 [Auto-Verify HPG] Final file_hash to use:', fileHash.substring(0, 32) + '...');
            console.log('🔐 [Auto-Verify HPG] File hash length:', fileHash.length);

            // ============================================
            // CERTIFICATE AUTHENTICITY CHECK (Blockchain Source of Truth)
            // ============================================
            console.log('🔍 [Auto-Verify HPG] ==========================================');
            console.log('🔍 [Auto-Verify HPG] Starting certificate authenticity check');
            console.log('🔍 [Auto-Verify HPG] Input parameters:', {
                fileHash: fileHash.substring(0, 32) + '...',
                vehicleId: vehicleId,
                vehicleVIN: vehicle.vin,
                certificateType: 'hpg_clearance'
            });

            const authenticityCheck = await certificateBlockchain.checkCertificateAuthenticity(
                fileHash,
                vehicleId,
                'hpg_clearance'
            );

            // MANDATORY VIN BINDING: If the certificate was found but issued for a different VIN,
            // we must flag this as a critical mismatch.
            const vinMismatch = authenticityCheck.originalVehicleVin &&
                authenticityCheck.originalVehicleVin.toUpperCase().trim() !== vehicle.vin.toUpperCase().trim();

            if (vinMismatch) {
                console.error(`[Auto-Verify] 🚨 CRITICAL VIN MISMATCH: Certificate issued for ${authenticityCheck.originalVehicleVin} but submitted for ${vehicle.vin}`);
                authenticityCheck.authentic = false;
                authenticityCheck.reason = `VIN Mismatch: Certificate belongs to vehicle ${authenticityCheck.originalVehicleVin}, not ${vehicle.vin}`;
                authenticityCheck.authenticityScore = 0;
            }

            console.log('🔍 [Auto-Verify HPG] ==========================================');
            console.log('🔍 [Auto-Verify HPG] Certificate authenticity check RESULT:');
            console.log('🔍 [Auto-Verify HPG]', JSON.stringify({
                authentic: authenticityCheck.authentic,
                reason: authenticityCheck.reason,
                originalFound: authenticityCheck.originalCertificateFound,
                score: authenticityCheck.authenticityScore,
                source: authenticityCheck.source,
                matchType: authenticityCheck.matchType,
                originalFileHash: authenticityCheck.originalFileHash ? authenticityCheck.originalFileHash.substring(0, 32) + '...' : null,
                submittedFileHash: authenticityCheck.submittedFileHash ? authenticityCheck.submittedFileHash.substring(0, 32) + '...' : null,
                originalCertificateId: authenticityCheck.originalCertificateId,
                originalCertificateNumber: authenticityCheck.originalCertificateNumber,
                originalVehicleVin: authenticityCheck.originalVehicleVin
            }, null, 2));
            console.log('🔍 [Auto-Verify HPG] ==========================================');

            // Trusted certificate fields (if authenticity is confirmed).
            // Used to avoid OCR-only penalties for system-issued, untampered documents.
            let trustedCertificateData = null;
            let originalEngine = null;
            let originalChassis = null;
            if (authenticityCheck.authentic && authenticityCheck.certificateData) {
                try {
                    trustedCertificateData = typeof authenticityCheck.certificateData === 'string'
                        ? JSON.parse(authenticityCheck.certificateData)
                        : authenticityCheck.certificateData;

                    originalEngine = trustedCertificateData.engineNumber || trustedCertificateData.engine_number || null;
                    originalChassis =
                        trustedCertificateData.chassisNumber ||
                        trustedCertificateData.chassis_number ||
                        trustedCertificateData.vin ||
                        trustedCertificateData.vehicleVin ||
                        null;
                } catch (parseError) {
                    console.warn('[Auto-Verify] Error parsing trusted certificate data for fallback:', parseError.message);
                }
            }

            if (authenticityCheck.authentic) {
                if (!engineNumber && originalEngine) engineNumber = originalEngine;
                if (!chassisNumber && originalChassis) chassisNumber = originalChassis;
                if (!engineNumber && vehicle.engine_number) engineNumber = vehicle.engine_number;
                if (!chassisNumber && (vehicle.chassis_number || vehicle.vin)) {
                    chassisNumber = vehicle.chassis_number || vehicle.vin;
                }
            }

            // Get original certificate for composite hash generation
            const originalCert = await certificateBlockchain.getOriginalCertificate(
                vehicleId,
                'hpg_clearance'
            );

            // Use original certificate number if available, otherwise generate new one
            let certificateNumber;
            let issueDateISO;
            if (originalCert && originalCert.certificate_number) {
                certificateNumber = originalCert.certificate_number;
                issueDateISO = originalCert.issued_at || new Date().toISOString();
                console.log(`[Auto-Verify] Using original certificate number: ${certificateNumber}`);
            } else {
                certificateNumber = `HPG-${vehicle.vin}-${Date.now()}`;
                issueDateISO = new Date().toISOString();
                console.log(`[Auto-Verify] No original certificate found, generating new number: ${certificateNumber}`);
            }

            // Generate composite hash using original certificate number (if available)
            const compositeHash = certificateBlockchain.generateCompositeHash(
                certificateNumber,
                vehicle.vin,
                issueDateISO,
                fileHash
            );
            console.log(`[Auto-Verify] Composite hash: ${compositeHash.substring(0, 16)}...`);

            // Check for duplicate hash (document reuse) - now uses correct certificate number
            const hashCheck = await certificateBlockchain.checkHashDuplicate(compositeHash);
            console.log(`[Auto-Verify] Hash duplicate check:`, hashCheck);

            if (hashCheck.exists) {
                return {
                    status: 'REJECTED',
                    automated: false,
                    reason: `Document already used for vehicle ${hashCheck.vehicleId}. Duplicate detected.`,
                    confidence: 0,
                    hashCheck,
                    compositeHash
                };
            }

            // Calculate confidence score based on:
            // - Certificate authenticity (30 points) - NEW: Uses blockchain as source of truth
            // - Data extraction quality (30 points) - Reduced from 40
            // - Hash uniqueness (20 points) - Reduced from 30
            // - Document completeness (15 points) - Reduced from 20
            // - Data match with vehicle record (5 points) - Reduced from 10
            let confidenceScore = 0;
            const scoreBreakdown = {
                certificateAuthenticity: 0,  // NEW: Blockchain-based authenticity check
                dataExtraction: 0,
                hashUniqueness: 0,
                documentCompleteness: 0,
                dataMatch: 0,
                total: 0
            };

            // Certificate authenticity (30 points) - Uses blockchain/database as source of truth
            if (authenticityCheck.authentic) {
                scoreBreakdown.certificateAuthenticity = 30;
                console.log(`[Auto-Verify] ✅ Certificate is AUTHENTIC - matches original on blockchain`);
            } else if (authenticityCheck.originalCertificateFound) {
                // Original certificate exists but hash doesn't match - might be fake or modified
                scoreBreakdown.certificateAuthenticity = 0;
                console.log(`[Auto-Verify] ⚠️ Certificate authenticity FAILED - hash mismatch with original`);
            } else {
                // No original certificate found - might be first submission or new certificate
                // Award partial points as we can't verify against original
                scoreBreakdown.certificateAuthenticity = 15;
                console.log(`[Auto-Verify] ⚠️ No original certificate found - cannot verify authenticity`);
            }

            // Data extraction quality (30 points) - Reduced from 40
            if (engineNumber && chassisNumber) {
                scoreBreakdown.dataExtraction = 30;
            } else if (engineNumber || chassisNumber) {
                scoreBreakdown.dataExtraction = 15;
            }

            // Hash uniqueness (20 points) - Reduced from 30
            if (!hashCheck.exists) {
                scoreBreakdown.hashUniqueness = 20;
            }

            // Document completeness (15 points)
            // Confidence in this module is certificate-legitimacy focused.
            // Do not penalize based on owner/seller/buyer ID presence here.
            const hasHPGClearance = !!clearanceDoc;
            if (hasHPGClearance) scoreBreakdown.documentCompleteness = 15;

            // Data match with vehicle record AND original certificate (5 points)
            // Compare extracted data with:
            // 1. Vehicle record in database
            // 2. Original certificate's stored data (if available)
            let engineMatch = false;
            let chassisMatch = false;
            let engineMatchOriginal = false;
            let chassisMatchOriginal = false;

            const normalizeIdValue = (value) => value
                ? String(value).toUpperCase().replace(/[^A-Z0-9]/g, '').trim()
                : '';
            const idsMatch = (a, b) => {
                const na = normalizeIdValue(a);
                const nb = normalizeIdValue(b);
                return !!na && !!nb && na === nb;
            };

            // Match 1: Compare with vehicle record
            engineMatch = idsMatch(engineNumber, vehicle.engine_number);
            chassisMatch = idsMatch(chassisNumber, vehicle.chassis_number);

            // Match 2: Compare with original certificate data (if available)
            const hasOriginalEngine = !!originalEngine;
            const hasOriginalChassis = !!originalChassis;
            engineMatchOriginal = hasOriginalEngine ? idsMatch(engineNumber, originalEngine) : false;
            chassisMatchOriginal = hasOriginalChassis ? idsMatch(chassisNumber, originalChassis) : false;

            const vehicleScore = engineMatch && chassisMatch ? 5 : (engineMatch || chassisMatch ? 2 : 0);
            let originalScore = 0;
            if (authenticityCheck.authentic) {
                // If a field is missing in original cert metadata, use vehicle-match fallback
                // to prevent legacy metadata gaps from capping confidence.
                const effectiveEngineMatch = hasOriginalEngine ? engineMatchOriginal : engineMatch;
                const effectiveChassisMatch = hasOriginalChassis ? chassisMatchOriginal : chassisMatch;
                if (effectiveEngineMatch && effectiveChassisMatch) {
                    originalScore = 5;
                } else if (effectiveEngineMatch || effectiveChassisMatch) {
                    originalScore = 3;
                }
            }

            scoreBreakdown.dataMatch = authenticityCheck.authentic
                ? Math.max(originalScore, vehicleScore)
                : vehicleScore;

            // Log data comparison results
            console.log(`[Auto-Verify] Data match results:`, {
                engineMatchVehicle: engineMatch,
                chassisMatchVehicle: chassisMatch,
                engineMatchOriginal: engineMatchOriginal,
                chassisMatchOriginal: chassisMatchOriginal,
                hasOriginalEngine,
                hasOriginalChassis,
                authenticityCheck: authenticityCheck.authentic
            });

            confidenceScore = Math.min(100,
                scoreBreakdown.certificateAuthenticity +
                scoreBreakdown.dataExtraction +
                scoreBreakdown.hashUniqueness +
                scoreBreakdown.documentCompleteness +
                scoreBreakdown.dataMatch
            );
            scoreBreakdown.total = confidenceScore;

            // Determine recommendation
            let recommendation = 'MANUAL_REVIEW';
            let recommendationReason = '';

            if (hashCheck.exists) {
                recommendation = 'AUTO_REJECT';
                recommendationReason = 'Document duplicate detected. Certificate already used.';
            } else if (!authenticityCheck.authentic && authenticityCheck.originalCertificateFound) {
                // Certificate hash doesn't match original - likely fake or modified
                recommendation = 'AUTO_REJECT';
                recommendationReason = 'Certificate authenticity check failed. File hash does not match original certificate on blockchain.';
            } else if (confidenceScore >= 80) {
                recommendation = 'AUTO_APPROVE';
                recommendationReason = authenticityCheck.authentic
                    ? 'High confidence score. Certificate authenticated via blockchain. All checks passed. Manual physical inspection still required.'
                    : 'High confidence score. All checks passed. Manual physical inspection still required.';
            } else if (confidenceScore >= 60) {
                recommendation = 'REVIEW';
                recommendationReason = authenticityCheck.authentic
                    ? 'Moderate confidence. Certificate authenticated via blockchain. Review recommended before approval.'
                    : 'Moderate confidence. Review recommended before approval.';
            } else {
                recommendation = 'MANUAL_REVIEW';
                recommendationReason = 'Low confidence score. Manual verification required.';
            }

            // Store verification metadata (but don't auto-approve - HPG always requires manual approval)
            await db.updateVerificationStatus(
                vehicleId,
                'hpg',
                'PENDING',
                null,
                `HPG auto-verified. Confidence: ${confidenceScore}%. ${recommendationReason}`,
                {
                    automated: true,
                    verificationScore: confidenceScore,
                    verificationMetadata: {
                        ocrData,
                        hashCheck,
                        compositeHash,
                        authenticityCheck,  // NEW: Blockchain authenticity verification
                        originalCertificate: originalCert ? {
                            certificateNumber: originalCert.certificate_number,
                            compositeHash: originalCert.composite_hash,
                            issuedAt: originalCert.issued_at
                        } : null,
                        scoreBreakdown,
                        recommendation,
                        recommendationReason,
                        autoVerifiedAt: new Date().toISOString(),
                        note: 'HPG always requires manual physical inspection and final approval'
                    }
                }
            );

            // Update blockchain with audit trail
            try {
                await fabricService.updateVerificationStatus(
                    vehicle.vin,
                    'hpg',
                    'PENDING',
                    `HPG auto-verified. Confidence: ${confidenceScore}%. ${recommendationReason}`
                );
                console.log(`[Auto-Verify] ✅ Blockchain audit trail updated for HPG PENDING: ${vehicle.vin}`);
            } catch (blockchainError) {
                console.error(`[Auto-Verify] ⚠️ Blockchain audit trail update failed (continuing):`, blockchainError.message);
            }

            const result = {
                status: 'PENDING', // Always PENDING - HPG requires manual approval
                automated: true,
                confidence: confidenceScore / 100,
                score: confidenceScore,
                recommendation,
                recommendationReason,
                scoreBreakdown,
                hashCheck,
                compositeHash,
                authenticityCheck,  // NEW: Blockchain authenticity verification
                dataComparison: {  // NEW: Data comparison results
                    engineMatchVehicle: engineMatch,
                    chassisMatchVehicle: chassisMatch,
                    engineMatchOriginal: engineMatchOriginal,
                    chassisMatchOriginal: chassisMatchOriginal,
                    originalCertificateData: authenticityCheck.authentic && authenticityCheck.certificateData
                        ? (typeof authenticityCheck.certificateData === 'string'
                            ? JSON.parse(authenticityCheck.certificateData)
                            : authenticityCheck.certificateData)
                        : null
                },
                ocrData,
                preFilledData: {
                    engineNumber,
                    chassisNumber
                }
            };

            console.log('✅ [Auto-Verify HPG] ==========================================');
            console.log('✅ [Auto-Verify HPG] AUTO-VERIFICATION COMPLETE - SUMMARY');
            console.log('✅ [Auto-Verify HPG] Vehicle:', {
                id: vehicleId,
                vin: vehicle.vin,
                engine_number: vehicle.engine_number,
                chassis_number: vehicle.chassis_number
            });
            console.log('✅ [Auto-Verify HPG] Extracted Data:', {
                engineNumber: engineNumber,
                chassisNumber: chassisNumber
            });
            console.log('✅ [Auto-Verify HPG] File Hash:', fileHash.substring(0, 32) + '...');
            console.log('✅ [Auto-Verify HPG] Composite Hash:', compositeHash ? compositeHash.substring(0, 32) + '...' : 'NULL');
            console.log('✅ [Auto-Verify HPG] Authenticity Check:', {
                authentic: authenticityCheck.authentic,
                originalFound: authenticityCheck.originalCertificateFound,
                source: authenticityCheck.source,
                originalCertificateId: authenticityCheck.originalCertificateId,
                originalCertificateNumber: authenticityCheck.originalCertificateNumber,
                originalVehicleVin: authenticityCheck.originalVehicleVin,
                reason: authenticityCheck.reason
            });
            console.log('✅ [Auto-Verify HPG] Score Breakdown:', scoreBreakdown);
            console.log('✅ [Auto-Verify HPG] Final Score:', confidenceScore);
            console.log('✅ [Auto-Verify HPG] Recommendation:', recommendation);
            console.log('✅ [Auto-Verify HPG] Recommendation Reason:', recommendationReason);
            console.log('✅ [Auto-Verify HPG] ==========================================');

            return result;
        } catch (error) {
            console.error('❌ [Auto-Verify HPG] ERROR:', error);
            console.error('❌ [Auto-Verify HPG] Error stack:', error.stack);
            return {
                status: 'PENDING',
                automated: false,
                reason: `Auto-verification error: ${error.message}`,
                confidence: 0
            };
        }
    }

    /**
     * Pre-verify HPG documents (extract data, but always requires manual physical inspection)
     * @param {string} vehicleId - Vehicle ID
     * @param {Array} documents - Array of document records
     * @param {Object} vehicle - Vehicle data
     * @returns {Promise<Object>} Pre-verification result with extracted data
     */
    async preVerifyHPG(vehicleId, documents, vehicle) {
        if (!this.enabled) {
            return { status: 'PENDING', automated: false, reason: 'Auto-verification disabled' };
        }

        try {
            console.log(`[Auto-Verify] Starting HPG pre-verification for vehicle ${vehicleId}`);

            // Find registration cert and owner ID documents
            const registrationCert = documents.find(d =>
                d.document_type === 'registration_cert' || d.document_type === 'registrationCert'
            );
            const ownerId = documents.find(d =>
                d.document_type === 'owner_id' || d.document_type === 'ownerId'
            );

            let extractedData = {};

            // Extract from registration certificate
            if (registrationCert) {
                const regPath = registrationCert.file_path || registrationCert.filePath;
                if (regPath && await this.fileExists(regPath)) {
                    const regMimeType = registrationCert.mime_type || registrationCert.mimeType || 'application/pdf';
                    const hpgData = await ocrService.extractHPGInfo(
                        regPath,
                        null,
                        regMimeType,
                        null
                    );
                    extractedData = { ...extractedData, ...hpgData };
                }
            }

            // Extract from owner ID
            if (ownerId) {
                const ownerPath = ownerId.file_path || ownerId.filePath;
                if (ownerPath && await this.fileExists(ownerPath)) {
                    const ownerMimeType = ownerId.mime_type || ownerId.mimeType || 'application/pdf';
                    const ownerData = await ocrService.extractHPGInfo(
                        null,
                        ownerPath,
                        null,
                        ownerMimeType
                    );
                    extractedData = { ...extractedData, ...ownerData };
                }
            }

            console.log(`[Auto-Verify] HPG extracted data:`, extractedData);

            // Always keep status as PENDING (requires manual physical inspection)
            // But store extracted data for pre-filling HPG form
            await db.updateVerificationStatus(
                vehicleId,
                'hpg',
                'PENDING',
                null,
                'HPG pre-verified: Data extracted, manual physical inspection required',
                {
                    automated: true,
                    verificationScore: extractedData.engineNumber && extractedData.chassisNumber ? 50 : 0,
                    verificationMetadata: {
                        extractedData,
                        preVerifiedAt: new Date().toISOString(),
                        note: 'HPG always requires manual physical inspection'
                    }
                }
            );

            // Update blockchain with audit trail
            try {
                await fabricService.updateVerificationStatus(
                    vehicle.vin,
                    'hpg',
                    'PENDING',
                    'HPG pre-verified: Data extracted, manual physical inspection required'
                );
                console.log(`[Auto-Verify] ✅ Blockchain audit trail updated for HPG pre-verification PENDING: ${vehicle.vin}`);
            } catch (blockchainError) {
                console.error(`[Auto-Verify] ⚠️ Blockchain audit trail update failed (continuing):`, blockchainError.message);
            }

            return {
                status: 'PENDING',
                automated: false,
                reason: 'HPG requires manual physical inspection',
                extractedData,
                canPreFill: !!(extractedData.engineNumber && extractedData.chassisNumber)
            };
        } catch (error) {
            console.error('[Auto-Verify] HPG pre-verification error:', error);
            return {
                status: 'PENDING',
                automated: false,
                reason: `Pre-verification error: ${error.message}`,
                extractedData: {}
            };
        }
    }

    /**
     * Calculate verification score from checks
     * @param {Object} checks - Verification checks object
     * @returns {Object} Score result
     */
    calculateVerificationScore(checks) {
        let score = 0;
        let maxScore = 0;

        // Database match (40 points)
        maxScore += 40;
        if (checks.databaseMatch) score += 40;

        // Expiry check (20 points)
        maxScore += 20;
        if (checks.notExpired) score += 20;

        // Data consistency (20 points)
        maxScore += 20;
        if (checks.dataConsistent) score += 20;

        // Document quality (10 points)
        maxScore += 10;
        score += checks.documentQuality * 10;

        // Fraud detection (10 points) - inverse (lower fraud = higher score)
        maxScore += 10;
        score += (1 - checks.fraudScore) * 10;

        // Compliance check (optional, 10 points)
        if (checks.compliance !== undefined) {
            maxScore += 10;
            if (checks.compliance) score += 10;
        }

        const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

        return {
            score,
            maxScore,
            percentage,
            decision: percentage >= 90 ? 'APPROVE' : percentage >= 70 ? 'REVIEW' : 'REJECT'
        };
    }

    /**
     * Check if document is expired
     * @param {string} expiryDate - Expiry date string
     * @returns {Object} Expiry check result
     */
    checkExpiry(expiryDate) {
        if (!expiryDate) {
            return { isValid: false, reason: 'Expiry date not found' };
        }

        try {
            const expiry = this.parseDate(expiryDate);
            if (!expiry) {
                return { isValid: false, reason: 'Could not parse expiry date' };
            }

            const now = new Date();

            // Treat "date-only" expiries as valid until end-of-day (local time).
            // This avoids false "expired" results on the expiry date due to time-of-day / timezone.
            const isDateOnly =
                typeof expiryDate === 'string' &&
                (/^\d{4}-\d{2}-\d{2}$/.test(expiryDate.trim()) || /^[0-3]?\d-[A-Za-z]{3}-\d{4}$/.test(expiryDate.trim()));

            if (isDateOnly) {
                expiry.setHours(23, 59, 59, 999);
            }

            const isValid = expiry >= now;

            return {
                isValid,
                expiryDate: expiry.toISOString(),
                daysUntilExpiry: isValid ? Math.floor((expiry - now) / (1000 * 60 * 60 * 24)) : 0,
                reason: isValid ? 'Valid' : 'Expired'
            };
        } catch (error) {
            return { isValid: false, reason: `Error checking expiry: ${error.message}` };
        }
    }

    /**
     * Check data consistency between OCR data, database, and vehicle
     * @param {Object} ocrData - OCR extracted data
     * @param {Object} databaseCheck - Database verification result
     * @param {Object} vehicle - Vehicle data
     * @returns {boolean} True if data is consistent
     */
    checkDataConsistency(ocrData, databaseCheck, vehicle) {
        // If database check found a record, verify consistency
        if (databaseCheck.found && databaseCheck.record) {
            // Check vehicle details match
            const plateMatch = !vehicle.plate_number || !databaseCheck.record.plateNumber ||
                vehicle.plate_number.toUpperCase().replace(/\s+/g, ' ') ===
                databaseCheck.record.plateNumber.toUpperCase().replace(/\s+/g, ' ');

            // For insurance: check policy number matches
            if (ocrData.insurancePolicyNumber || ocrData.policyNumber) {
                const policyMatch = databaseCheck.record.policyNumber &&
                    (ocrData.insurancePolicyNumber || ocrData.policyNumber).toUpperCase().replace(/\s+/g, '') ===
                    databaseCheck.record.policyNumber.toUpperCase().replace(/\s+/g, '');
                return plateMatch && policyMatch;
            }

            return plateMatch;
        }

        // If no database record, consider it consistent (manual verification will handle)
        return true;
    }

    /**
     * Parse date string
     * @param {string} dateString - Date string
     * @returns {Date|null} Parsed date
     */
    parseDate(dateString) {
        if (!dateString) return null;

        // Try common formats
        const formats = [
            /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/,
            /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})/
        ];

        for (const format of formats) {
            const match = dateString.match(format);
            if (match) {
                const month = parseInt(match[1]);
                const day = parseInt(match[2]);
                let year = parseInt(match[3]);

                if (year < 100) {
                    year += year < 50 ? 2000 : 1900;
                }

                const date = new Date(year, month - 1, day);
                if (date.getMonth() === month - 1 && date.getDate() === day) {
                    return date;
                }
            }
        }

        const isoDate = new Date(dateString);
        if (!isNaN(isoDate.getTime())) {
            return isoDate;
        }

        return null;
    }

    /**
     * Check if file exists
     * @param {string} filePath - File path
     * @returns {Promise<boolean>} True if file exists
     */
    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get document number patterns for validation
     * @param {string} documentType - Document type: 'insurance', 'hpg'
     * @returns {Object} Pattern object with regex and description
     */
    getDocumentNumberPatterns(documentType) {
        const patterns = {
            insurance: {
                // Matches generator format: CTPL-YYYY-XXXXXX (6 alphanumeric chars)
                regex: /^CTPL-\d{4}-[A-Z0-9]{6}$/,
                description: 'CTPL-YYYY-XXXXXX (e.g., CTPL-2026-C9P5EX)',
                example: 'CTPL-2026-C9P5EX'
            },
            hpg: {
                // Matches generator format: HPG-YYYY-XXXXXX (6 alphanumeric chars)
                regex: /^HPG-\d{4}-[A-Z0-9]{6}$/,
                description: 'HPG-YYYY-XXXXXX (e.g., HPG-2026-I240CT)',
                example: 'HPG-2026-I240CT'
            }
        };

        return patterns[documentType] || null;
    }

    /**
     * Validate document number format
     * @param {string} documentNumber - Document number to validate
     * @param {string} documentType - Document type: 'insurance', 'hpg'
     * @returns {Object} Validation result
     */
    validateDocumentNumberFormat(documentNumber, documentType) {
        if (!documentNumber || !documentType) {
            return {
                valid: false,
                confidence: 0,
                reason: 'Document number or type is missing'
            };
        }

        const pattern = this.getDocumentNumberPatterns(documentType);
        if (!pattern) {
            return {
                valid: false,
                confidence: 0,
                reason: `Unknown document type: ${documentType}`
            };
        }

        const normalized = documentNumber.trim().toUpperCase();
        const matches = pattern.regex.test(normalized);

        if (matches) {
            return {
                valid: true,
                confidence: 100,
                normalized,
                pattern: pattern.description,
                reason: 'Format matches expected pattern'
            };
        } else {
            return {
                valid: false,
                confidence: 0,
                normalized,
                expectedPattern: pattern.description,
                example: pattern.example,
                reason: `Format does not match expected pattern: ${pattern.description}`
            };
        }
    }

    /**
     * Auto-verify MVIR document against LTO inspection record
     * Validates that buyer-uploaded MVIR matches the vehicle's LTO inspection (mvir_number)
     * @param {string} vehicleId - Vehicle ID
     * @param {Object} mvirDoc - MVIR document record from transfer_documents
     * @param {Object} vehicle - Vehicle data (must include mvir_number from LTO inspection)
     * @returns {Promise<Object>} Auto-verification result
     */
    async autoVerifyMVIR(vehicleId, mvirDoc, vehicle) {
        if (!this.enabled) {
            return { status: 'PENDING', automated: false, reason: 'Auto-verification disabled' };
        }

        try {
            console.log(`[Auto-Verify MVIR] Starting MVIR verification for vehicle ${vehicleId}`);

            // Check if vehicle has LTO inspection record
            if (!vehicle.mvir_number) {
                return {
                    status: 'PENDING',
                    automated: false,
                    reason: 'Vehicle does not have LTO inspection record (mvir_number). LTO inspection must be completed first.',
                    confidence: 0
                };
            }

            // Get document file path (local or via storageService when IPFS/stale path)
            let filePath = mvirDoc.file_path || mvirDoc.filePath;
            if (!filePath || !(await this.fileExists(filePath))) {
                if (mvirDoc.document_id || mvirDoc.id) {
                    try {
                        const doc = await storageService.getDocument(mvirDoc.document_id || mvirDoc.id);
                        if (doc && doc.filePath && (await this.fileExists(doc.filePath))) {
                            filePath = doc.filePath;
                        }
                    } catch (e) {
                        console.warn('[Auto-Verify MVIR] storageService.getDocument failed:', e.message);
                    }
                }
                if (!filePath || !(await this.fileExists(filePath))) {
                    return {
                        status: 'PENDING',
                        automated: false,
                        reason: 'MVIR document file not found',
                        confidence: 0
                    };
                }
            }

            // Extract MVIR number from uploaded document via OCR
            let extractedMvirNumber = null;
            try {
                const mvirText = await ocrService.extractText(filePath, mvirDoc.mime_type || mvirDoc.mimeType || 'application/pdf');

                // Extract MVIR number using patterns (MVIR-YYYY-XXXXXX or similar)
                // Pattern 1: MVIR-YYYY-XXXXXX (6 alphanumeric)
                const mvirPattern1 = /MVIR[-\s]?(\d{4})[-\s]?([A-Z0-9]{6,})/i;
                const match1 = mvirText.match(mvirPattern1);
                if (match1) {
                    extractedMvirNumber = `MVIR-${match1[1]}-${match1[2].substring(0, 6).toUpperCase()}`;
                } else {
                    // Pattern 2: Just look for MVIR number format anywhere
                    const mvirPattern2 = /(MVIR[-\s]?\d{4}[-\s]?[A-Z0-9]{6})/i;
                    const match2 = mvirText.match(mvirPattern2);
                    if (match2) {
                        extractedMvirNumber = match2[1].replace(/\s+/g, '-').toUpperCase();
                    } else {
                        // Pattern 3: Look for "MVIR Number" or "Inspection Number" label
                        const mvirPattern3 = /(?:MVIR|Inspection)\s*(?:Number|No\.?)[\s:.]*([A-Z0-9\-]+)/i;
                        const match3 = mvirText.match(mvirPattern3);
                        if (match3) {
                            extractedMvirNumber = match3[1].trim().toUpperCase();
                        }
                    }
                }
                console.log(`[Auto-Verify MVIR] Extracted MVIR number from document: ${extractedMvirNumber}`);
            } catch (ocrError) {
                console.warn('[Auto-Verify MVIR] OCR extraction failed:', ocrError.message);
                // Continue with hash-only validation if OCR fails
            }

            // Get file hash for authenticity check
            let fileHash = mvirDoc.file_hash || mvirDoc.fileHash;
            if (!fileHash && filePath) {
                try {
                    const fileBuffer = await fs.readFile(filePath);
                    fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
                    console.log(`[Auto-Verify MVIR] Computed file hash: ${fileHash.substring(0, 16)}...`);
                } catch (hashError) {
                    console.warn('[Auto-Verify MVIR] Failed to compute file hash:', hashError.message);
                }
            }

            // Compare extracted MVIR number with vehicle's mvir_number
            let mvirNumberMatch = false;
            if (extractedMvirNumber && vehicle.mvir_number) {
                // Normalize both for comparison (remove spaces, dashes, case-insensitive)
                const normalizedExtracted = extractedMvirNumber.replace(/[\s\-]/g, '').toUpperCase();
                const normalizedVehicle = vehicle.mvir_number.replace(/[\s\-]/g, '').toUpperCase();
                mvirNumberMatch = normalizedExtracted === normalizedVehicle;
                console.log(`[Auto-Verify MVIR] MVIR number match: ${mvirNumberMatch} (extracted: ${extractedMvirNumber}, vehicle: ${vehicle.mvir_number})`);
            }

            // Check hash against issued certificate (if available)
            let hashMatch = false;
            let originalCertificateFound = false;
            if (fileHash) {
                try {
                    // Look for issued MVIR certificate for this vehicle.
                    // NOTE: issued_certificates table stores MVIR as certificate_type = 'hpg_clearance'
                    // with metadata.originalCertificateType = 'mvir_cert', and uses vehicle_vin (no vehicle_id column).
                    const issuedCert = await dbRaw.query(
                        `SELECT * FROM issued_certificates 
                         WHERE vehicle_vin = $1
                           AND certificate_type = 'hpg_clearance'
                           AND (metadata->>'originalCertificateType') = 'mvir_cert'
                         ORDER BY issued_at DESC
                         LIMIT 1`,
                        [vehicle.vin]
                    );

                    if (issuedCert.rows.length > 0) {
                        originalCertificateFound = true;
                        const cert = issuedCert.rows[0];

                        // Compare file hash
                        if (cert.file_hash && cert.file_hash === fileHash) {
                            hashMatch = true;
                            console.log(`[Auto-Verify MVIR] ✅ File hash matches issued certificate`);
                        } else {
                            console.log(`[Auto-Verify MVIR] ⚠️ File hash mismatch with issued certificate`);
                        }

                        // Also check composite hash if available
                        if (cert.composite_hash && vehicle.mvir_number && vehicle.vin) {
                            const expectedCompositeHash = certificateBlockchain.generateCompositeHash(
                                vehicle.mvir_number,
                                vehicle.vin,
                                vehicle.inspection_date ? new Date(vehicle.inspection_date).toISOString() : new Date().toISOString(),
                                fileHash
                            );
                            if (cert.composite_hash === expectedCompositeHash) {
                                hashMatch = true;
                                console.log(`[Auto-Verify MVIR] ✅ Composite hash matches issued certificate`);
                            }
                        }
                    } else {
                        console.log(`[Auto-Verify MVIR] No issued certificate found for comparison`);
                    }
                } catch (certError) {
                    console.warn('[Auto-Verify MVIR] Failed to check issued certificate:', certError.message);
                }
            }

            // Determine verification status
            let status = 'PENDING';
            let automated = false;
            let confidence = 0;
            const flagReasons = [];

            if (mvirNumberMatch) {
                status = 'APPROVED';
                automated = true;
                confidence = 100;
                console.log(`[Auto-Verify MVIR] ✅ MVIR number matches - AUTO-APPROVED`);
            } else if (hashMatch && originalCertificateFound) {
                status = 'APPROVED';
                automated = true;
                confidence = 95;
                console.log(`[Auto-Verify MVIR] ✅ Hash matches issued certificate - AUTO-APPROVED`);
            } else {
                if (!extractedMvirNumber) {
                    flagReasons.push('MVIR number could not be extracted from document (OCR failed or format not recognized)');
                } else if (!mvirNumberMatch) {
                    flagReasons.push(`MVIR number mismatch: extracted "${extractedMvirNumber}" does not match vehicle inspection record "${vehicle.mvir_number}"`);
                }
                if (!hashMatch && originalCertificateFound) {
                    flagReasons.push('File hash does not match issued certificate');
                }
                if (!originalCertificateFound && !mvirNumberMatch) {
                    flagReasons.push('Cannot verify authenticity: no issued certificate found and MVIR number does not match');
                }
                confidence = mvirNumberMatch ? 50 : (hashMatch ? 40 : 0);
            }

            // Update verification status in database
            try {
                await db.updateVerificationStatus(
                    vehicleId,
                    'mvir',
                    status,
                    'system',
                    automated ? 'Auto-verified: MVIR matches LTO inspection record' : `Auto-verification completed with issues: ${flagReasons.join('; ')}`,
                    {
                        automated,
                        verificationScore: confidence,
                        verificationMetadata: {
                            extractedMvirNumber,
                            vehicleMvirNumber: vehicle.mvir_number,
                            mvirNumberMatch,
                            hashMatch,
                            originalCertificateFound,
                            fileHash: fileHash ? fileHash.substring(0, 32) + '...' : null,
                            verifiedAt: new Date().toISOString(),
                            flagReasons: flagReasons.length > 0 ? flagReasons : null
                        }
                    }
                );
            } catch (updateError) {
                console.warn('[Auto-Verify MVIR] Failed to update verification status:', updateError.message);
            }

            return {
                status,
                automated,
                confidence: confidence / 100,
                reason: flagReasons.length > 0 ? flagReasons.join('; ') : 'MVIR verified successfully',
                flagReasons: flagReasons.length > 0 ? flagReasons : [],
                extractedMvirNumber,
                vehicleMvirNumber: vehicle.mvir_number,
                mvirNumberMatch,
                hashMatch,
                originalCertificateFound
            };

        } catch (error) {
            console.error('[Auto-Verify MVIR] MVIR verification error:', error);
            return {
                status: 'PENDING',
                automated: false,
                reason: `Verification error: ${error.message}`,
                confidence: 0
            };
        }
    }

    /**
     * Calculate pattern-based score for verification
     * @param {string} documentNumber - Document number
     * @param {string} documentType - Document type
     * @param {boolean} hashUnique - Whether hash is unique (not duplicate)
     * @param {boolean} notExpired - Whether document is not expired
     * @returns {Object} Score result
     */
    calculatePatternBasedScore(documentNumber, documentType, hashUnique, notExpired) {
        const patternCheck = this.validateDocumentNumberFormat(documentNumber, documentType);

        let score = 0;
        let maxScore = 0;
        const checks = {};

        // Pattern validation (50 points)
        maxScore += 50;
        if (patternCheck.valid) {
            score += 50;
            checks.patternValid = true;
        } else {
            checks.patternValid = false;
            checks.patternReason = patternCheck.reason;
        }

        // Hash uniqueness (30 points)
        maxScore += 30;
        if (hashUnique) {
            score += 30;
            checks.hashUnique = true;
        } else {
            checks.hashUnique = false;
            checks.hashReason = 'Hash already exists (duplicate document)';
        }

        // Expiry check (20 points)
        maxScore += 20;
        if (notExpired) {
            score += 20;
            checks.notExpired = true;
        } else {
            checks.notExpired = false;
            checks.expiryReason = 'Document has expired';
        }

        const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

        return {
            score,
            maxScore,
            percentage,
            checks,
            patternCheck,
            decision: percentage >= 80 ? 'APPROVE' : percentage >= 60 ? 'REVIEW' : 'REJECT'
        };
    }

}

module.exports = new AutoVerificationService();
