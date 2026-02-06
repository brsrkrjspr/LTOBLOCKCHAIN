// TrustChain LTO - Certificate Blockchain Service
// Handles blockchain storage and verification of certificate hashes

const crypto = require('crypto');
const fabricService = require('./optimizedFabricService');
const db = require('../database/services');
const dbRaw = require('../database/db');

class CertificateBlockchainService {
    /**
     * Generate composite hash for certificate verification
     * Composite hash = SHA-256(certificateNumber + vehicleVIN + expiryDate + fileHash)
     * @param {string} certificateNumber - Policy/certificate number
     * @param {string} vehicleVIN - Vehicle VIN
     * @param {string} expiryDate - Expiry date (ISO string)
     * @param {string} fileHash - SHA-256 hash of PDF file
     * @returns {string} Composite hash (hex)
     */
    generateCompositeHash(certificateNumber, vehicleVIN, expiryDate, fileHash) {
        const compositeData = `${certificateNumber}|${vehicleVIN}|${expiryDate}|${fileHash}`;
        return crypto.createHash('sha256').update(compositeData).digest('hex');
    }

    /**
     * Store certificate hash on Hyperledger Fabric blockchain
     * @param {string} compositeHash - Composite hash
     * @param {Object} metadata - Certificate metadata
     * @returns {Promise<Object>} Transaction result
     */
    async storeCertificateHashOnBlockchain(compositeHash, metadata, userContext = null) {
        try {
            // Initialize Fabric service with user context (if provided) for dynamic identity selection
            // userContext should be { role, email } from req.user
            await fabricService.initialize(userContext || {});

            // Check vehicle status - only store on blockchain if vehicle is REGISTERED
            // Vehicles in SUBMITTED/APPROVED status are not yet on blockchain
            if (metadata.vehicleId) {
                try {
                    const vehicle = await db.getVehicleById(metadata.vehicleId);
                    if (vehicle && vehicle.status !== 'REGISTERED') {
                        console.log(`[Certificate Blockchain] Storage deferred - vehicle ${metadata.vehicleVIN} is ${vehicle.status}, not yet registered on blockchain. Hash will be stored when vehicle is registered during approval.`);
                        return {
                            success: true,
                            transactionId: null,
                            hash: compositeHash,
                            metadata: {
                                hash: compositeHash,
                                certificateType: metadata.certificateType,
                                vehicleVIN: metadata.vehicleVIN,
                                vehicleId: metadata.vehicleId,
                                certificateNumber: metadata.certificateNumber,
                                applicationStatus: metadata.applicationStatus || 'PENDING',
                                issuedAt: metadata.issuedAt || new Date().toISOString(),
                                issuedBy: metadata.issuedBy || 'system',
                                fileHash: metadata.fileHash,
                                deferred: true,
                                reason: `Vehicle status is ${vehicle.status}, not yet registered on blockchain`
                            }
                        };
                    }
                } catch (vehicleLookupError) {
                    console.warn(`[Certificate Blockchain] Could not lookup vehicle ${metadata.vehicleId} for status check:`, vehicleLookupError.message);
                    // Continue with blockchain storage attempt - if it fails, error handling will catch it
                }
            }

            // Prepare metadata for blockchain
            const blockchainMetadata = {
                hash: compositeHash,
                certificateType: metadata.certificateType,
                vehicleVIN: metadata.vehicleVIN,
                vehicleId: metadata.vehicleId,
                certificateNumber: metadata.certificateNumber,
                applicationStatus: metadata.applicationStatus || 'PENDING',
                issuedAt: metadata.issuedAt || new Date().toISOString(),
                issuedBy: metadata.issuedBy || 'system',
                fileHash: metadata.fileHash
            };

            // Use dedicated UpdateCertificateHash chaincode function (NEW - per IMPLEMENTATION_PHASES.md)
            // This stores PDF hash and IPFS CID directly on-chain, separate from verification status
            const certificateType = metadata.certificateType || 'ORCR'; // Default to ORCR for OR/CR certificates
            const ipfsCid = metadata.ipfsCid || metadata.ipfs_cid || null; // IPFS CID if available
            
            // Extract PDF hash from composite hash or use fileHash directly
            // For OR/CR certificates, we store the PDF hash (SHA256 of PDF buffer)
            const pdfHash = metadata.fileHash || compositeHash; // Use fileHash if available, otherwise compositeHash
            
            const result = await fabricService.updateCertificateHash(
                metadata.vehicleVIN,
                certificateType,
                pdfHash,
                ipfsCid
            );

            return {
                success: true,
                transactionId: result.transactionId,
                hash: compositeHash,
                pdfHash: pdfHash,
                ipfsCid: ipfsCid,
                metadata: blockchainMetadata
            };
        } catch (error) {
            console.error('Error storing certificate hash on blockchain:', error);
            throw new Error(`Blockchain storage failed: ${error.message}`);
        }
    }

    /**
     * Check if composite hash exists on blockchain (duplicate detection)
     * @param {string} compositeHash - Composite hash to check
     * @returns {Promise<Object>} Check result
     */
    async checkHashDuplicate(compositeHash) {
        try {
            // Check BOTH tables for duplicate composite hash
            // This prevents certificate reuse across different vehicles

            // Check 1: issued_certificates table (from certificate-generator.html)
            const issuedCertCheck = await dbRaw.query(
                `SELECT id, vehicle_vin, certificate_type, is_revoked, created_at
                 FROM issued_certificates 
                 WHERE composite_hash = $1`,
                [compositeHash]
            );

            if (issuedCertCheck.rows && issuedCertCheck.rows.length > 0) {
                const cert = issuedCertCheck.rows[0];
                // Get vehicle_id from VIN for consistency
                const vehicle = await db.getVehicleByVin(cert.vehicle_vin);
                return {
                    exists: true,
                    certificateId: cert.id,
                    vehicleId: vehicle ? vehicle.id : null,
                    vehicleVin: cert.vehicle_vin,
                    certificateType: cert.certificate_type,
                    isRevoked: cert.is_revoked,
                    source: 'issued_certificates'
                };
            }

            // Check 2: certificates table (from clearance workflow)
            const certCheck = await dbRaw.query(
                `SELECT id, vehicle_id, certificate_type, application_status, status 
                 FROM certificates 
                 WHERE composite_hash = $1`,
                [compositeHash]
            );

            if (certCheck.rows && certCheck.rows.length > 0) {
                const cert = certCheck.rows[0];
                return {
                    exists: true,
                    certificateId: cert.id,
                    vehicleId: cert.vehicle_id,
                    certificateType: cert.certificate_type,
                    applicationStatus: cert.application_status,
                    status: cert.status,
                    source: 'certificates'
                };
            }

            // No duplicate found in either table
            return {
                exists: false,
                source: 'database'
            };
        } catch (error) {
            console.error('Error checking hash duplicate:', error);
            // On error, assume not duplicate (fail open for availability)
            return {
                exists: false,
                error: error.message
            };
        }
    }

    /**
     * Check certificate authenticity by comparing file hash with original certificate
     * Uses blockchain/database as source of truth
     * Checks BOTH issued_certificates (from certificate-generator.html) AND certificates (from clearance workflow)
     * 
     * IMPORTANT: This verifies ISSUER AUTHENTICITY, not vehicle binding.
     * The file_hash is the unique identifier that proves the certificate was issued by the certificate generator.
     * 
     * @param {string} fileHash - File hash of submitted certificate
     * @param {string} vehicleId - Vehicle ID (UUID) - optional, used for fallback lookup only
     * @param {string} certificateType - Certificate type (hpg_clearance, insurance)
     * @returns {Promise<Object>} Authenticity check result
     */
    async checkCertificateAuthenticity(fileHash, vehicleId, certificateType) {
        try {
            console.log('🔐 [Certificate Authenticity] ==========================================');
            console.log('🔐 [Certificate Authenticity] Starting authenticity check');
            console.log('🔐 [Certificate Authenticity] Input:', {
                fileHash: fileHash.substring(0, 32) + '...',
                fileHashLength: fileHash.length,
                vehicleId: vehicleId,
                certificateType: certificateType
            });
            
            // ============================================
            // PRIMARY CHECK: Lookup by file_hash (issuer authenticity)
            // This verifies that the certificate was issued by the certificate generator,
            // regardless of which vehicle it's being submitted for.
            // ============================================
            
            // CHECK 1: issued_certificates table (from certificate-generator.html)
            // Lookup by file_hash first - this is the primary authenticity check.
            // Insurance certs may be stored as 'insurance' or 'ctpl' in issued_certificates.
            const issuedTypes = certificateType === 'insurance' ? ['insurance', 'ctpl'] : [certificateType];
            console.log('🔐 [Certificate Authenticity] CHECK 1: Looking up issued_certificates by file_hash');
            console.log('🔐 [Certificate Authenticity] Query:', `SELECT ... FROM issued_certificates WHERE file_hash = '${fileHash.substring(0, 16)}...' AND certificate_type = ANY(ARRAY[${issuedTypes.map(t => `'${t}'`).join(',')}])`);
            
            const issuedCertQuery = await dbRaw.query(
                `SELECT id, file_hash, composite_hash, certificate_number, 
                        vehicle_vin, metadata, issued_at, expires_at,
                        blockchain_tx_id, is_revoked, created_at, certificate_type
                 FROM issued_certificates 
                 WHERE file_hash = $1 
                   AND certificate_type = ANY($2::text[])
                   AND is_revoked = false
                 ORDER BY created_at DESC LIMIT 1`,
                [fileHash, issuedTypes]
            );
            
            console.log('🔐 [Certificate Authenticity] CHECK 1 Result:', {
                rowsFound: issuedCertQuery.rows?.length || 0,
                matchFound: issuedCertQuery.rows && issuedCertQuery.rows.length > 0
            });
            
            if (issuedCertQuery.rows && issuedCertQuery.rows.length > 0) {
                const original = issuedCertQuery.rows[0];
                console.log('🔐 [Certificate Authenticity] ✅ MATCH FOUND in issued_certificates!');
                console.log('🔐 [Certificate Authenticity] Original certificate data:', {
                    id: original.id,
                    certificate_number: original.certificate_number,
                    vehicle_vin: original.vehicle_vin,
                    file_hash: original.file_hash.substring(0, 32) + '...',
                    composite_hash: original.composite_hash ? original.composite_hash.substring(0, 32) + '...' : null,
                    issued_at: original.issued_at,
                    created_at: original.created_at,
                    metadata: original.metadata
                });
                console.log('🔐 [Certificate Authenticity] Hash comparison:', {
                    submittedHash: fileHash.substring(0, 32) + '...',
                    originalHash: original.file_hash.substring(0, 32) + '...',
                    match: original.file_hash === fileHash
                });
                
                // File hash matches - certificate is authentic!
                const result = {
                    authentic: true,
                    reason: 'Certificate file hash matches original certificate from certificate-generator (issuer verified)',
                    originalCertificateFound: true,
                    source: 'issued_certificates',
                    originalCertificateId: original.id,
                    originalCertificateNumber: original.certificate_number,
                    originalCompositeHash: original.composite_hash,
                    originalFileHash: original.file_hash,
                    originalVehicleVin: original.vehicle_vin,
                    blockchainTxId: original.blockchain_tx_id,
                    certificateData: original.metadata,
                    authenticityScore: 100,
                    matchType: 'file_hash'
                };
                console.log('🔐 [Certificate Authenticity] ✅ AUTHENTIC - Returning success result');
                console.log('🔐 [Certificate Authenticity] ==========================================');
                return result;
            }
            
            console.log('🔐 [Certificate Authenticity] ❌ No match in issued_certificates');

            // CHECK 2: certificates table (from clearance workflow)
            // Also lookup by file_hash for certificates from clearance workflow.
            // Use same type list as issued_certificates for insurance (insurance/ctpl).
            const certTypes = certificateType === 'insurance' ? ['insurance', 'ctpl'] : [certificateType];
            console.log('🔐 [Certificate Authenticity] CHECK 2: Looking up certificates table by file_hash');
            const certQuery = await dbRaw.query(
                `SELECT id, file_hash, composite_hash, certificate_number, 
                        status, application_status, issued_at, expires_at,
                        blockchain_tx_id, vehicle_id, certificate_type
                 FROM certificates 
                 WHERE file_hash = $1 
                   AND certificate_type = ANY($2::text[])
                   AND status IN ('ACTIVE')
                 ORDER BY issued_at DESC LIMIT 1`,
                [fileHash, certTypes]
            );
            
            console.log('🔐 [Certificate Authenticity] CHECK 2 Result:', {
                rowsFound: certQuery.rows?.length || 0,
                matchFound: certQuery.rows && certQuery.rows.length > 0
            });

            if (certQuery.rows && certQuery.rows.length > 0) {
                const original = certQuery.rows[0];
                console.log('🔐 [Certificate Authenticity] ✅ MATCH FOUND in certificates table!');
                console.log('🔐 [Certificate Authenticity] Original certificate data:', {
                    id: original.id,
                    certificate_number: original.certificate_number,
                    vehicle_id: original.vehicle_id,
                    file_hash: original.file_hash.substring(0, 32) + '...',
                    status: original.status,
                    application_status: original.application_status
                });
                
                // File hash matches - certificate is authentic!
                const result = {
                    authentic: true,
                    reason: 'Certificate file hash matches original certificate from clearance workflow',
                    originalCertificateFound: true,
                    source: 'certificates',
                    originalCertificateId: original.id,
                    originalCertificateNumber: original.certificate_number,
                    originalCompositeHash: original.composite_hash,
                    originalFileHash: original.file_hash,
                    originalVehicleId: original.vehicle_id,
                    originalStatus: original.status,
                    originalApplicationStatus: original.application_status,
                    blockchainTxId: original.blockchain_tx_id,
                    authenticityScore: 100,
                    matchType: 'file_hash'
                };
                console.log('🔐 [Certificate Authenticity] ✅ AUTHENTIC - Returning success result');
                console.log('🔐 [Certificate Authenticity] ==========================================');
                return result;
            }
            
            console.log('🔐 [Certificate Authenticity] ❌ No match in certificates table');

            // ============================================
            // FALLBACK CHECK: If file_hash lookup fails, try vehicle-based lookup
            // This is a fallback for edge cases, but file_hash should be primary
            // ============================================
            if (vehicleId) {
                const vehicle = await db.getVehicleById(vehicleId);
                if (vehicle && vehicle.vin) {
                    const vehicleVin = vehicle.vin;

                    // Fallback: Check issued_certificates by vehicle_vin (same type list as primary check)
                    const fallbackIssuedTypes = certificateType === 'insurance' ? ['insurance', 'ctpl'] : [certificateType];
                    const fallbackIssuedQuery = await dbRaw.query(
                        `SELECT id, file_hash, composite_hash, certificate_number, 
                                vehicle_vin, metadata, issued_at, expires_at,
                                blockchain_tx_id, is_revoked, created_at
                         FROM issued_certificates 
                         WHERE vehicle_vin = $1 
                           AND certificate_type = ANY($2::text[])
                           AND is_revoked = false
                         ORDER BY created_at DESC LIMIT 1`,
                        [vehicleVin, fallbackIssuedTypes]
                    );

                    if (fallbackIssuedQuery.rows && fallbackIssuedQuery.rows.length > 0) {
                        const original = fallbackIssuedQuery.rows[0];
                        
                        // File hash doesn't match - certificate might be fake or modified
                        return {
                            authentic: false,
                            reason: 'Certificate file hash does not match original certificate from certificate-generator (file modified or different certificate)',
                            originalCertificateFound: true,
                            source: 'issued_certificates',
                            originalCertificateId: original.id,
                            originalCertificateNumber: original.certificate_number,
                            originalFileHash: original.file_hash,
                            submittedFileHash: fileHash,
                            authenticityScore: 0,
                            matchType: 'none'
                        };
                    }

                    // Fallback: Check certificates table by vehicle_id (same type list as primary check)
                    const fallbackCertTypes = certificateType === 'insurance' ? ['insurance', 'ctpl'] : [certificateType];
                    const fallbackCertQuery = await dbRaw.query(
                        `SELECT id, file_hash, composite_hash, certificate_number, 
                                status, application_status, issued_at, expires_at,
                                blockchain_tx_id
                         FROM certificates 
                         WHERE vehicle_id = $1 
                           AND certificate_type = ANY($2::text[])
                           AND status IN ('ACTIVE')  
                         ORDER BY issued_at DESC LIMIT 1`,
                        [vehicleId, fallbackCertTypes]
                    );

                    if (fallbackCertQuery.rows && fallbackCertQuery.rows.length > 0) {
                        const original = fallbackCertQuery.rows[0];
                        
                        // File hash doesn't match - certificate might be fake or modified
                        return {
                            authentic: false,
                            reason: 'Certificate file hash does not match original certificate from clearance workflow (file modified or different certificate)',
                            originalCertificateFound: true,
                            source: 'certificates',
                            originalCertificateId: original.id,
                            originalCertificateNumber: original.certificate_number,
                            originalFileHash: original.file_hash,
                            submittedFileHash: fileHash,
                            originalStatus: original.status,
                            originalApplicationStatus: original.application_status,
                            authenticityScore: 0,
                            matchType: 'none'
                        };
                    }
                }
            }

            // No original certificate found in either table
            console.log('🔐 [Certificate Authenticity] ❌ NO MATCH FOUND in either table');
            console.log('🔐 [Certificate Authenticity] Checking all issued_certificates for debugging...');
            
            // Debug: Check all certificates of this type (use same type list for insurance)
            const debugTypes = certificateType === 'insurance' ? ['insurance', 'ctpl'] : [certificateType];
            const allCertsDebug = await dbRaw.query(
                `SELECT id, certificate_number, vehicle_vin, file_hash, certificate_type, created_at
                 FROM issued_certificates 
                 WHERE certificate_type = ANY($1::text[])
                 ORDER BY created_at DESC 
                 LIMIT 10`,
                [debugTypes]
            );
            console.log('🔐 [Certificate Authenticity] All certificates in issued_certificates:', {
                totalFound: allCertsDebug.rows.length,
                certificates: allCertsDebug.rows.map(c => ({
                    id: c.id,
                    certificate_number: c.certificate_number,
                    vehicle_vin: c.vehicle_vin,
                    file_hash: c.file_hash ? c.file_hash.substring(0, 16) + '...' : 'NULL',
                    created_at: c.created_at
                }))
            });
            
            const result = {
                authentic: false,
                reason: 'No original certificate found with matching file hash in issued_certificates or certificates tables',
                originalCertificateFound: false,
                source: 'none',
                authenticityScore: 0,
                debugInfo: {
                    searchedFileHash: fileHash.substring(0, 32) + '...',
                    certificateType: certificateType,
                    totalCertificatesChecked: allCertsDebug.rows.length
                }
            };
            console.log('🔐 [Certificate Authenticity] ❌ NOT AUTHENTIC - Returning failure result');
            console.log('🔐 [Certificate Authenticity] ==========================================');
            return result;
        } catch (error) {
            console.error('🔐 [Certificate Authenticity] ❌ ERROR:', error);
            console.error('🔐 [Certificate Authenticity] Error stack:', error.stack);
            const result = {
                authentic: false,
                reason: `Error checking authenticity: ${error.message}`,
                error: error.message,
                authenticityScore: 0
            };
            console.log('🔐 [Certificate Authenticity] ==========================================');
            return result;
        }
    }

    /**
     * Find issued certificate by extracted data (policy number, VIN, type, optional expiry).
     * Used when file hash does not match (e.g. re-saved/renamed file) but OCR/extracted data
     * matches what was issued — allows data-based auto-approval with reason.
     * @param {string} vehicleVin - Vehicle VIN
     * @param {string} certificateNumber - Policy/certificate number (e.g. CTPL-2025-XXXXXX)
     * @param {string} certificateType - Certificate type ('insurance', 'hpg_clearance', etc.)
     * @param {string} [expiryDate] - Optional expiry (ISO or date string) to compare with issued_certificates.expires_at
     * @returns {Promise<Object|null>} Issued certificate row or null
     */
    async findIssuedCertificateByExtractedData(vehicleVin, certificateNumber, certificateType, expiryDate) {
        try {
            if (!vehicleVin || !certificateNumber || !certificateType) return null;
            const vin = String(vehicleVin).toUpperCase().trim();
            const number = String(certificateNumber).trim().toUpperCase().replace(/\s+/g, ' ');
            // Insurance certs in issued_certificates are stored as 'ctpl' by the certificate generator
            const types = certificateType === 'insurance' ? ['insurance', 'ctpl'] : [certificateType];
            const result = await dbRaw.query(
                `SELECT id, certificate_number, vehicle_vin, file_hash, composite_hash, 
                        issued_at, expires_at, certificate_type, is_revoked, metadata
                 FROM issued_certificates 
                 WHERE UPPER(TRIM(vehicle_vin)) = $1 
                   AND certificate_type = ANY($2::text[])
                   AND UPPER(REPLACE(TRIM(certificate_number), ' ', '')) = UPPER(REPLACE($3, ' ', ''))
                   AND is_revoked = false
                 ORDER BY created_at DESC LIMIT 1`,
                [vin, types, number]
            );
            if (!result.rows || result.rows.length === 0) {
                console.log(`[Certificate Authenticity] Data match: no row in issued_certificates for vin=${vin}, cert=${number}, type=${certificateType} (types tried: ${types.join(', ')})`);
                return null;
            }
            const row = result.rows[0];
            if (expiryDate) {
                const issuedExpiry = row.expires_at ? new Date(row.expires_at).toISOString().split('T')[0] : null;
                const submittedDate = this._parseExpiryToDate(expiryDate);
                const submittedExpiry = submittedDate ? submittedDate.toISOString().split('T')[0] : null;
                if (issuedExpiry && submittedExpiry && issuedExpiry !== submittedExpiry) {
                    console.log(`[Certificate Authenticity] Data match: expiry differs (issued: ${issuedExpiry}, submitted: ${submittedExpiry}, raw: ${expiryDate})`);
                    return null;
                }
            }
            return row;
        } catch (error) {
            console.error('Error in findIssuedCertificateByExtractedData:', error);
            return null;
        }
    }

    /**
     * Parse expiry string (e.g. DD-MMM-YYYY like 01-Feb-2027, or ISO) to Date for comparison.
     * Uses UTC construction to avoid timezone-induced date shifts when comparing YYYY-MM-DD strings.
     */
    _parseExpiryToDate(expiryDate) {
        if (!expiryDate) return null;
        const s = String(expiryDate).trim();
        const ddmmyyyy = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
        if (ddmmyyyy) {
            const months = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
            const month = months[ddmmyyyy[2].toLowerCase().slice(0, 3)];
            if (month === undefined) return new Date(s);
            // Use Date.UTC to create date at midnight UTC, preventing timezone shifts
            // e.g. Date.UTC(2027, 1, 1) = Feb 1, 2027 00:00 UTC (not local time)
            const date = new Date(Date.UTC(parseInt(ddmmyyyy[3], 10), month, parseInt(ddmmyyyy[1], 10)));
            return isNaN(date.getTime()) ? new Date(s) : date;
        }
        // For other formats, try to parse as ISO date in UTC
        // If string is YYYY-MM-DD, append 'T00:00:00Z' to force UTC interpretation
        const isoDate = s.match(/^\d{4}-\d{2}-\d{2}$/);
        const d = isoDate ? new Date(s + 'T00:00:00Z') : new Date(s);
        return isNaN(d.getTime()) ? null : d;
    }

    /**
     * Get original certificate for vehicle (for composite hash generation)
     * Checks BOTH issued_certificates (from certificate-generator.html) AND certificates (from clearance workflow)
     * @param {string} vehicleId - Vehicle ID (UUID)
     * @param {string} certificateType - Certificate type
     * @returns {Promise<Object|null>} Original certificate or null
     */
    async getOriginalCertificate(vehicleId, certificateType) {
        try {
            // Get vehicle VIN (needed for issued_certificates lookup)
            const vehicle = await db.getVehicleById(vehicleId);
            if (!vehicle || !vehicle.vin) {
                return null;
            }
            const vehicleVin = vehicle.vin;

            // Priority 1: Check issued_certificates table (from certificate-generator.html).
            // Insurance certs may be stored as 'insurance' or 'ctpl'.
            const origIssuedTypes = certificateType === 'insurance' ? ['insurance', 'ctpl'] : [certificateType];
            const issuedCertResult = await dbRaw.query(
                `SELECT certificate_number, file_hash, composite_hash, issued_at, expires_at
                 FROM issued_certificates 
                 WHERE vehicle_vin = $1 
                   AND certificate_type = ANY($2::text[])
                   AND is_revoked = false
                 ORDER BY created_at DESC LIMIT 1`,
                [vehicleVin, origIssuedTypes]
            );

            if (issuedCertResult.rows && issuedCertResult.rows.length > 0) {
                return issuedCertResult.rows[0];
            }

            // Priority 2: Check certificates table (from clearance workflow)
            const origCertTypes = certificateType === 'insurance' ? ['insurance', 'ctpl'] : [certificateType];
            const certResult = await dbRaw.query(
                `SELECT certificate_number, file_hash, composite_hash, issued_at, expires_at
                 FROM certificates 
                 WHERE vehicle_id = $1 
                   AND certificate_type = ANY($2::text[])
                   AND status IN ('ACTIVE')  
                 ORDER BY issued_at DESC LIMIT 1`,
                [vehicleId, origCertTypes]
            );

            return certResult.rows && certResult.rows.length > 0 ? certResult.rows[0] : null;
        } catch (error) {
            console.error('Error getting original certificate:', error);
            return null;
        }
    }

    /**
     * Verify certificate on blockchain
     * @param {string} compositeHash - Composite hash
     * @param {string} vehicleVIN - Vehicle VIN to verify against
     * @returns {Promise<Object>} Verification result
     */
    async verifyCertificate(compositeHash, vehicleVIN) {
        try {
            // Check database first
            const cert = await dbRaw.query(
                `SELECT c.*, v.status as vehicle_status, v.vin 
                 FROM certificates c
                 JOIN vehicles v ON c.vehicle_id = v.id
                 WHERE c.composite_hash = $1`,
                [compositeHash]
            );

            if (!cert.rows || cert.rows.length === 0) {
                return {
                    valid: false,
                    reason: 'Certificate not found on blockchain'
                };
            }

            const certificate = cert.rows[0];

            // Check 1: Application status
            if (certificate.application_status !== 'APPROVED') {
                return {
                    valid: false,
                    reason: `Certificate issued but application was ${certificate.application_status}`,
                    applicationStatus: certificate.application_status
                };
            }

            // Check 2: Vehicle matches
            if (certificate.vin !== vehicleVIN) {
                return {
                    valid: false,
                    reason: 'Certificate was issued for a different vehicle',
                    expectedVIN: certificate.vin,
                    providedVIN: vehicleVIN
                };
            }

            // Check 3: Vehicle application status
            if (certificate.vehicle_status === 'REJECTED') {
                return {
                    valid: false,
                    reason: 'Vehicle application was rejected',
                    vehicleStatus: certificate.vehicle_status
                };
            }

            // Check 4: Certificate not revoked
            if (certificate.status === 'REVOKED') {
                return {
                    valid: false,
                    reason: 'Certificate has been revoked',
                    revocationReason: certificate.revocation_reason,
                    revokedAt: certificate.revoked_at
                };
            }

            return {
                valid: true,
                certificate: {
                    id: certificate.id,
                    certificateNumber: certificate.certificate_number,
                    certificateType: certificate.certificate_type,
                    issuedAt: certificate.issued_at,
                    applicationStatus: certificate.application_status,
                    status: certificate.status,
                    blockchainTxId: certificate.blockchain_tx_id
                }
            };
        } catch (error) {
            console.error('Error verifying certificate:', error);
            return {
                valid: false,
                reason: `Verification error: ${error.message}`
            };
        }
    }

    /**
     * Revoke certificate on blockchain
     * @param {string} certificateId - Certificate ID
     * @param {string} reason - Revocation reason
     * @returns {Promise<Object>} Revocation result
     */
    async revokeCertificateOnBlockchain(certificateId, reason) {
        try {
            // Update database
            await dbRaw.query(
                `UPDATE certificates 
                 SET status = 'REVOKED', 
                     application_status = 'REJECTED',
                     revocation_reason = $1,
                     revoked_at = CURRENT_TIMESTAMP
                 WHERE id = $2`,
                [reason, certificateId]
            );

            // TODO: Update blockchain record if needed
            // For now, database update is sufficient

            return {
                success: true,
                certificateId,
                reason,
                revokedAt: new Date().toISOString()
            };
        } catch (error) {
            console.error('Error revoking certificate:', error);
            throw new Error(`Revocation failed: ${error.message}`);
        }
    }
}

module.exports = new CertificateBlockchainService();
