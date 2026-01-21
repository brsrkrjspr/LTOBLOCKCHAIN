// TrustChain LTO - Certificate Upload & Verification Service
// Handles vehicle owner certificate uploads with automatic verification

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');
const db = require('../database/services');
const { authenticateToken } = require('../middleware/auth');
const storageService = require('../services/storageService');

// ============================================
// FILE UPLOAD CONFIGURATION
// ============================================

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB
    },
    fileFilter: (req, file, cb) => {
        const allowedMimes = ['application/pdf', 'image/jpeg', 'image/png'];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only PDF, JPG, PNG allowed.'));
        }
    }
});

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Calculate file hash
 */
function calculateFileHash(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Save file to disk
 */
async function saveFile(buffer, filename) {
    const uploadPath = path.join(__dirname, '../../uploads/certificates');
    await fs.mkdir(uploadPath, { recursive: true });
    const filePath = path.join(uploadPath, filename);
    await fs.writeFile(filePath, buffer);
    return filePath;
}

// ============================================
// CERTIFICATE UPLOAD & VERIFICATION
// ============================================

/**
 * Upload and verify certificate
 * POST /api/certificates/submit
 * 
 * Form Data:
 * - vehicleId (UUID)
 * - certificateType ('insurance', 'hpg_clearance')
 * - file (PDF/JPG/PNG)
 * 
 * Response:
 * - verification: { valid, reason, matchedCertificate }
 */
router.post('/submit',
    authenticateToken,
    upload.single('certificate'),
    async (req, res) => {
        try {
            const { vehicleId, certificateType } = req.body;
            const file = req.file;

            // ============================================
            // VALIDATION
            // ============================================

            if (!vehicleId || !certificateType || !file) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: vehicleId, certificateType, file'
                });
            }

            if (!['insurance', 'hpg_clearance'].includes(certificateType)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid certificate type'
                });
            }

            // Get vehicle
            const vehicle = await db.query(
                'SELECT * FROM vehicles WHERE id = $1',
                [vehicleId]
            );

            if (!vehicle.rows || vehicle.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Vehicle not found'
                });
            }

            const vehicleData = vehicle.rows[0];

            // Check ownership
            if (vehicleData.owner_id !== req.user.userId && req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    error: 'You can only upload certificates for your own vehicles'
                });
            }

            // ============================================
            // CALCULATE HASHES & SAVE FILE
            // ============================================

            const fileHash = calculateFileHash(file.buffer);
            const filename = `${certificateType}-${vehicleData.vin}-${Date.now()}.${file.mimetype === 'application/pdf' ? 'pdf' : 'jpg'}`;
            const filePath = await saveFile(file.buffer, filename);

            // ============================================
            // DUPLICATE DETECTION - PREVENT CERTIFICATE REUSE
            // ============================================
            
            // Check if this certificate was already submitted by another vehicle owner
            const duplicateSubmission = await db.query(
                `SELECT cs.id, cs.vehicle_id, cs.verification_status, cs.submitted_at,
                        v.vin as vehicle_vin, v.plate_number,
                        u.email as submitted_by_email
                 FROM certificate_submissions cs
                 LEFT JOIN vehicles v ON cs.vehicle_id = v.id
                 LEFT JOIN users u ON cs.submitted_by = u.id
                 WHERE cs.uploaded_file_hash = $1 
                   AND cs.certificate_type = $2
                   AND cs.vehicle_id != $3`,
                [fileHash, certificateType, vehicleId]
            );

            if (duplicateSubmission.rows && duplicateSubmission.rows.length > 0) {
                // Clean up the file we just saved
                try {
                    await fs.unlink(filePath);
                } catch (cleanupError) {
                    console.error('File cleanup error:', cleanupError);
                }

                const existingSubmission = duplicateSubmission.rows[0];
                return res.status(409).json({
                    success: false,
                    error: 'Certificate already submitted',
                    message: 'This certificate has already been submitted by another vehicle owner. Each certificate can only be used once.',
                    details: {
                        existingVehicleVIN: existingSubmission.vehicle_vin,
                        existingPlateNumber: existingSubmission.plate_number,
                        submittedAt: existingSubmission.submitted_at,
                        verificationStatus: existingSubmission.verification_status,
                        submittedBy: existingSubmission.submitted_by_email
                    }
                });
            }

            // ============================================
            // AUTO-VERIFICATION AGAINST BLOCKCHAIN
            // ============================================

            const matchedCert = await db.query(
                `SELECT ic.*, ei.company_name, ei.issuer_type
                 FROM issued_certificates ic
                 LEFT JOIN external_issuers ei ON ic.issuer_id = ei.id
                 WHERE ic.file_hash = $1 
                   AND ic.certificate_type = $2
                   AND ic.vehicle_vin = $3`,
                [fileHash, certificateType, vehicleData.vin]
            );

            let verificationStatus = 'PENDING';
            let verificationNotes = null;
            let matchedCertificateId = null;

            if (matchedCert.rows && matchedCert.rows.length > 0) {
                const cert = matchedCert.rows[0];
                matchedCertificateId = cert.id;

                // Determine verification status
                if (cert.is_revoked) {
                    verificationStatus = 'REJECTED';
                    verificationNotes = `Certificate has been revoked: ${cert.revocation_reason}`;
                } else if (cert.expires_at && new Date(cert.expires_at) < new Date()) {
                    verificationStatus = 'EXPIRED';
                    verificationNotes = `Certificate expired on ${new Date(cert.expires_at).toLocaleDateString()}`;
                } else {
                    verificationStatus = 'VERIFIED';
                    verificationNotes = `Certificate verified. Issued by: ${cert.company_name}. Hash matched on blockchain.`;
                }
            } else {
                // No match found - might be legitimate but not yet in our system
                verificationStatus = 'PENDING';
                verificationNotes = 'Certificate file hash not found in blockchain records. Manual verification required.';
            }

            // ============================================
            // STORE IN DATABASE
            // ============================================

            const submission = await db.query(
                `INSERT INTO certificate_submissions 
                (vehicle_id, certificate_type, uploaded_file_path, uploaded_file_hash, 
                 submitted_by, verification_status, matched_certificate_id, verification_notes)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING *`,
                [
                    vehicleId,
                    certificateType,
                    filePath,
                    fileHash,
                    req.user.userId,
                    verificationStatus,
                    matchedCertificateId,
                    verificationNotes
                ]
            );

            // ============================================
            // RESPONSE
            // ============================================

            res.json({
                success: true,
                message: 'Certificate uploaded successfully',
                submission: {
                    id: submission.rows[0].id,
                    vehicleId: submission.rows[0].vehicle_id,
                    certificateType: submission.rows[0].certificate_type,
                    submittedAt: submission.rows[0].submitted_at,
                    fileHash: submission.rows[0].uploaded_file_hash
                },
                verification: {
                    status: verificationStatus,
                    notes: verificationNotes,
                    matched: matchedCertificateId !== null,
                    matchedCertificateId: matchedCertificateId
                }
            });

        } catch (error) {
            console.error('Certificate upload error:', error);

            // Clean up file if error occurred
            if (res.locals.uploadedPath) {
                try {
                    await fs.unlink(res.locals.uploadedPath);
                } catch (cleanupError) {
                    console.error('File cleanup error:', cleanupError);
                }
            }

            res.status(500).json({
                success: false,
                error: 'Certificate upload failed',
                details: error.message
            });
        }
    }
);

// ============================================
// GET SUBMISSION STATUS
// ============================================

/**
 * Get certificate submission status
 * GET /api/certificates/submissions/:submissionId
 */
router.get('/submissions/:submissionId',
    authenticateToken,
    async (req, res) => {
        try {
            const { submissionId } = req.params;

            const submission = await db.query(
                `SELECT cs.*, v.vin, v.plate_number, u.email,
                        ic.certificate_number, ic.issued_at, ic.expires_at, ei.company_name
                 FROM certificate_submissions cs
                 LEFT JOIN vehicles v ON cs.vehicle_id = v.id
                 LEFT JOIN users u ON cs.submitted_by = u.id
                 LEFT JOIN issued_certificates ic ON cs.matched_certificate_id = ic.id
                 LEFT JOIN external_issuers ei ON ic.issuer_id = ei.id
                 WHERE cs.id = $1`,
                [submissionId]
            );

            if (!submission.rows || submission.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Submission not found'
                });
            }

            const sub = submission.rows[0];

            // Check permission
            if (sub.submitted_by !== req.user.userId && req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied'
                });
            }

            res.json({
                success: true,
                submission: {
                    id: sub.id,
                    vehicleVIN: sub.vin,
                    plateNumber: sub.plate_number,
                    certificateType: sub.certificate_type,
                    submittedAt: sub.submitted_at,
                    verificationStatus: sub.verification_status,
                    verificationNotes: sub.verification_notes,
                    rejectionReason: sub.rejection_reason,
                    verifiedAt: sub.verified_at,
                    submittedBy: sub.email
                },
                matchedCertificate: sub.certificate_number ? {
                    certificateNumber: sub.certificate_number,
                    issuer: sub.company_name,
                    issuedAt: sub.issued_at,
                    expiresAt: sub.expires_at
                } : null
            });

        } catch (error) {
            console.error('Get submission error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve submission'
            });
        }
    }
);

// ============================================
// LIST SUBMISSIONS FOR VEHICLE
// ============================================

/**
 * Get all certificate submissions for a vehicle
 * GET /api/certificates/vehicle/:vehicleId
 */
router.get('/vehicle/:vehicleId',
    authenticateToken,
    async (req, res) => {
        try {
            const { vehicleId } = req.params;

            // Check vehicle ownership
            const vehicle = await db.query(
                'SELECT owner_id FROM vehicles WHERE id = $1',
                [vehicleId]
            );

            if (!vehicle.rows || vehicle.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Vehicle not found'
                });
            }

            const vehicleData = vehicle.rows[0];

            if (vehicleData.owner_id !== req.user.userId && req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied'
                });
            }

            // Get submissions
            const submissions = await db.query(
                `SELECT cs.*, ic.certificate_number, ic.issued_at, ic.expires_at, ei.company_name
                 FROM certificate_submissions cs
                 LEFT JOIN issued_certificates ic ON cs.matched_certificate_id = ic.id
                 LEFT JOIN external_issuers ei ON ic.issuer_id = ei.id
                 WHERE cs.vehicle_id = $1
                 ORDER BY cs.submitted_at DESC`,
                [vehicleId]
            );

            res.json({
                success: true,
                submissions: submissions.rows.map(sub => ({
                    id: sub.id,
                    certificateType: sub.certificate_type,
                    submittedAt: sub.submitted_at,
                    verificationStatus: sub.verification_status,
                    verificationNotes: sub.verification_notes,
                    issuer: sub.company_name,
                    certificateNumber: sub.certificate_number
                }))
            });

        } catch (error) {
            console.error('List submissions error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve submissions'
            });
        }
    }
);

// ============================================
// ADMIN: VERIFY/REJECT SUBMISSION
// ============================================

/**
 * Admin manually verify or reject submission
 * POST /api/certificates/submissions/:submissionId/verify
 */
router.post('/submissions/:submissionId/verify',
    authenticateToken,
    async (req, res) => {
        try {
            const { submissionId } = req.params;
            const { action, notes } = req.body; // action: 'approve' or 'reject'

            // Admin only
            if (req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    error: 'Admin only endpoint'
                });
            }

            if (!['approve', 'reject'].includes(action)) {
                return res.status(400).json({
                    success: false,
                    error: 'Action must be "approve" or "reject"'
                });
            }

            // Get submission
            const submission = await db.query(
                'SELECT * FROM certificate_submissions WHERE id = $1',
                [submissionId]
            );

            if (!submission.rows || submission.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Submission not found'
                });
            }

            // Update submission
            const newStatus = action === 'approve' ? 'VERIFIED' : 'REJECTED';
            const result = await db.query(
                `UPDATE certificate_submissions 
                 SET verification_status = $1, 
                     verified_by = $2,
                     verified_at = CURRENT_TIMESTAMP,
                     verification_notes = $3
                 WHERE id = $4
                 RETURNING *`,
                [
                    newStatus,
                    req.user.userId,
                    notes || (action === 'approve' ? 'Approved by admin' : 'Rejected by admin'),
                    submissionId
                ]
            );

            res.json({
                success: true,
                message: `Certificate ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
                submission: {
                    id: result.rows[0].id,
                    verificationStatus: result.rows[0].verification_status,
                    verifiedAt: result.rows[0].verified_at,
                    verificationNotes: result.rows[0].verification_notes
                }
            });

        } catch (error) {
            console.error('Verify submission error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to verify submission'
            });
        }
    }
);

module.exports = router;
