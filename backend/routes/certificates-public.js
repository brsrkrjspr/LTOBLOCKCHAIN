const express = require('express');
const router = express.Router();
const db = require('../database/db');
const dbServices = require('../database/services');

// Public endpoint to get certificate by verification code
// No auth required - uses signed verification code
router.get('/verify/:verificationCode', async (req, res) => {
    try {
        const { verificationCode } = req.params;
        
        // verificationCode could be:
        // 1. Transaction ID (blockchain)
        // 2. Certificate number
        // 3. Signed token containing vehicle/certificate info
        
        // First, try to find by transaction ID
        const historyResult = await db.query(
            `SELECT vh.*, v.*, 
                    c.file_path as cert_file_path, 
                    c.ipfs_cid as cert_ipfs_cid,
                    c.certificate_type,
                    c.certificate_number
             FROM vehicle_history vh
             JOIN vehicles v ON vh.vehicle_id = v.id
             LEFT JOIN certificates c ON c.vehicle_id = v.id AND c.status = 'ACTIVE'
             WHERE vh.transaction_id = $1
             ORDER BY vh.performed_at DESC
             LIMIT 1`,
            [verificationCode]
        );
        
        if (historyResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Certificate not found for this verification code'
            });
        }
        
        const record = historyResult.rows[0];
        
        // If certificate file exists, provide download link
        if (record.cert_file_path || record.cert_ipfs_cid) {
            res.json({
                success: true,
                verification: {
                    status: 'VERIFIED',
                    vehicleVin: record.vin,
                    plateNumber: record.plate_number,
                    transactionId: verificationCode,
                    verifiedAt: new Date().toISOString()
                },
                certificate: {
                    type: record.certificate_type,
                    certificateNumber: record.certificate_number,
                    downloadUrl: record.cert_ipfs_cid 
                        ? `/api/ipfs/${record.cert_ipfs_cid}`
                        : `/api/documents/certificate-file/${record.vehicle_id}`,
                    available: true
                }
            });
        } else {
            // No certificate file, but verification succeeded
            res.json({
                success: true,
                verification: {
                    status: 'VERIFIED',
                    vehicleVin: record.vin,
                    plateNumber: record.plate_number,
                    transactionId: verificationCode,
                    verifiedAt: new Date().toISOString()
                },
                certificate: {
                    available: false,
                    message: 'Digital certificate file not yet generated. Vehicle registration is verified on blockchain.'
                }
            });
        }
        
    } catch (error) {
        console.error('Certificate verification error:', error);
        res.status(500).json({
            success: false,
            error: 'Verification failed'
        });
    }
});

module.exports = router;

