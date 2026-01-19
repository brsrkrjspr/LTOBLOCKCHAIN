-- ============================================
-- DATABASE INVESTIGATION QUERIES
-- Run these queries to investigate critical issues
-- ============================================

-- ============================================
-- 1. VEHICLES STUCK IN PENDING_BLOCKCHAIN
-- ============================================

-- Check all vehicles with PENDING_BLOCKCHAIN status
SELECT 
    v.id,
    v.vin,
    v.plate_number,
    v.status,
    v.registration_date,
    vh.transaction_id,
    vh.action,
    vh.description,
    vh.performed_at,
    EXTRACT(EPOCH FROM (NOW() - vh.performed_at))/3600 as hours_since_pending
FROM vehicles v
LEFT JOIN vehicle_history vh ON v.id = vh.vehicle_id 
    AND vh.action = 'BLOCKCHAIN_PENDING'
WHERE v.status = 'PENDING_BLOCKCHAIN'
ORDER BY vh.performed_at DESC;

-- Check if blockchain transactions exist in history
SELECT 
    v.vin,
    v.plate_number,
    COUNT(vh.id) as blockchain_history_count,
    MAX(vh.performed_at) as last_blockchain_action
FROM vehicles v
LEFT JOIN vehicle_history vh ON v.id = vh.vehicle_id 
    AND vh.action IN ('BLOCKCHAIN_PENDING', 'BLOCKCHAIN_REGISTERED')
WHERE v.status = 'PENDING_BLOCKCHAIN'
GROUP BY v.id, v.vin, v.plate_number;

-- ============================================
-- 2. HPG AUTO-VERIFICATION ISSUES
-- ============================================

-- Check HPG clearance documents and their file hashes
SELECT 
    d.id,
    d.document_type,
    d.filename,
    d.file_hash,
    CASE 
        WHEN d.file_hash IS NULL THEN 'MISSING'
        WHEN LENGTH(d.file_hash) < 64 THEN 'INVALID'
        ELSE 'OK'
    END as hash_status,
    d.file_path,
    d.verified,
    d.uploaded_at,
    v.vin,
    v.plate_number
FROM documents d
JOIN vehicles v ON d.vehicle_id = v.id
WHERE d.document_type = 'hpg_clearance'
ORDER BY d.uploaded_at DESC;

-- Check recent HPG auto-verification attempts
SELECT 
    vh.vehicle_id,
    v.vin,
    v.plate_number,
    vh.action,
    vh.description,
    vh.metadata->>'confidence' as confidence,
    vh.metadata->>'recommendation' as recommendation,
    vh.metadata->>'reason' as reason,
    vh.performed_at
FROM vehicle_history vh
JOIN vehicles v ON vh.vehicle_id = v.id
WHERE vh.action = 'HPG_AUTO_VERIFY'
ORDER BY vh.performed_at DESC
LIMIT 20;

-- Check if documents have file paths that exist
SELECT 
    d.id,
    d.document_type,
    d.filename,
    d.file_path,
    d.file_hash,
    d.verified,
    v.vin
FROM documents d
JOIN vehicles v ON d.vehicle_id = v.id
WHERE d.document_type = 'hpg_clearance'
AND (d.file_hash IS NULL OR d.file_path IS NULL);

-- ============================================
-- 3. CLEARANCE REQUESTS STATUS
-- ============================================

-- Check all clearance requests with details
SELECT 
    cr.id,
    cr.vehicle_id,
    v.vin,
    v.plate_number,
    cr.request_type,
    cr.status,
    cr.assigned_to,
    u.email as assigned_to_email,
    cr.requested_at,
    cr.completed_at,
    EXTRACT(EPOCH FROM (NOW() - cr.requested_at))/3600 as hours_pending,
    cr.notes
FROM clearance_requests cr
JOIN vehicles v ON cr.vehicle_id = v.id
LEFT JOIN users u ON cr.assigned_to = u.id
ORDER BY cr.request_type, cr.requested_at DESC;

-- Count clearance requests by type and status
SELECT 
    request_type,
    status,
    COUNT(*) as count,
    AVG(EXTRACT(EPOCH FROM (NOW() - requested_at))/3600) as avg_hours_pending
FROM clearance_requests
GROUP BY request_type, status
ORDER BY request_type, status;

-- Check vehicles with incomplete clearance requests
SELECT 
    v.id,
    v.vin,
    v.plate_number,
    v.status,
    COUNT(DISTINCT cr.id) as total_requests,
    COUNT(DISTINCT CASE WHEN cr.status = 'APPROVED' THEN cr.id END) as approved_requests,
    COUNT(DISTINCT CASE WHEN cr.status = 'PENDING' THEN cr.id END) as pending_requests,
    COUNT(DISTINCT CASE WHEN cr.status = 'SENT' THEN cr.id END) as sent_requests
FROM vehicles v
LEFT JOIN clearance_requests cr ON v.id = cr.vehicle_id
WHERE v.status IN ('PENDING_BLOCKCHAIN', 'SUBMITTED')
GROUP BY v.id, v.vin, v.plate_number, v.status
HAVING COUNT(DISTINCT CASE WHEN cr.status = 'APPROVED' THEN cr.id END) < 3
ORDER BY v.registration_date DESC;

-- ============================================
-- 4. VEHICLE VERIFICATIONS STATUS
-- ============================================

-- Check vehicle verification statuses
SELECT 
    vv.vehicle_id,
    v.vin,
    v.plate_number,
    vv.verification_type,
    vv.status,
    vv.automated,
    vv.verification_score,
    vv.verified_at,
    vv.verified_by,
    u.email as verified_by_email,
    vv.notes
FROM vehicle_verifications vv
JOIN vehicles v ON vv.vehicle_id = v.id
LEFT JOIN users u ON vv.verified_by = u.id
ORDER BY vv.vehicle_id, vv.verification_type;

-- Check which vehicles have all verifications approved
SELECT 
    v.id,
    v.vin,
    v.plate_number,
    v.status,
    COUNT(vv.id) as total_verifications,
    COUNT(CASE WHEN vv.status = 'APPROVED' THEN 1 END) as approved_count,
    COUNT(CASE WHEN vv.status = 'PENDING' THEN 1 END) as pending_count,
    CASE 
        WHEN COUNT(vv.id) >= 3 AND COUNT(CASE WHEN vv.status = 'APPROVED' THEN 1 END) = COUNT(vv.id)
        THEN 'READY_FOR_CERTIFICATE'
        ELSE 'INCOMPLETE'
    END as readiness_status
FROM vehicles v
LEFT JOIN vehicle_verifications vv ON v.id = vv.vehicle_id
WHERE v.status IN ('PENDING_BLOCKCHAIN', 'SUBMITTED', 'APPROVED')
GROUP BY v.id, v.vin, v.plate_number, v.status
ORDER BY v.registration_date DESC;

-- ============================================
-- 5. DOCUMENT VERIFICATION STATUS
-- ============================================

-- Check document verification status by type
SELECT 
    document_type,
    COUNT(*) as total,
    COUNT(CASE WHEN verified = true THEN 1 END) as verified_count,
    COUNT(CASE WHEN verified = false THEN 1 END) as unverified_count,
    COUNT(CASE WHEN file_hash IS NULL THEN 1 END) as missing_hash_count,
    COUNT(CASE WHEN file_path IS NULL THEN 1 END) as missing_path_count
FROM documents
GROUP BY document_type
ORDER BY document_type;

-- Check documents for vehicles with pending clearances
SELECT 
    d.id,
    d.document_type,
    d.filename,
    d.verified,
    d.file_hash,
    d.uploaded_at,
    v.vin,
    v.plate_number,
    v.status as vehicle_status,
    cr.request_type,
    cr.status as clearance_status
FROM documents d
JOIN vehicles v ON d.vehicle_id = v.id
LEFT JOIN clearance_requests cr ON v.id = cr.vehicle_id 
    AND (
        (d.document_type = 'insurance_cert' AND cr.request_type = 'insurance') OR
        (d.document_type = 'emission_cert' AND cr.request_type = 'emission') OR
        (d.document_type = 'hpg_clearance' AND cr.request_type = 'hpg')
    )
WHERE v.status IN ('PENDING_BLOCKCHAIN', 'SUBMITTED')
ORDER BY v.vin, d.document_type;

-- ============================================
-- 6. CERTIFICATE GENERATION STATUS
-- ============================================

-- Check if certificates exist for vehicles
SELECT 
    v.id,
    v.vin,
    v.plate_number,
    v.status,
    COUNT(c.id) as certificate_count,
    COUNT(ic.id) as issued_certificate_count
FROM vehicles v
LEFT JOIN certificates c ON v.id = c.vehicle_id
LEFT JOIN issued_certificates ic ON v.vin = ic.vehicle_vin
WHERE v.status IN ('SUBMITTED', 'APPROVED', 'REGISTERED')
GROUP BY v.id, v.vin, v.plate_number, v.status
ORDER BY v.registration_date DESC;

-- Check vehicles that should have certificates but don't
SELECT 
    v.id,
    v.vin,
    v.plate_number,
    v.status,
    COUNT(vv.id) as verification_count,
    COUNT(CASE WHEN vv.status = 'APPROVED' THEN 1 END) as approved_verifications,
    COUNT(c.id) as certificate_count
FROM vehicles v
JOIN vehicle_verifications vv ON v.id = vv.vehicle_id
LEFT JOIN certificates c ON v.id = c.vehicle_id
WHERE v.status IN ('APPROVED', 'REGISTERED')
GROUP BY v.id, v.vin, v.plate_number, v.status
HAVING COUNT(CASE WHEN vv.status = 'APPROVED' THEN 1 END) >= 3
AND COUNT(c.id) = 0
ORDER BY v.registration_date DESC;

-- ============================================
-- 7. WORKFLOW BOTTLENECK ANALYSIS
-- ============================================

-- Overall workflow status summary
SELECT 
    'Vehicles' as category,
    status as item,
    COUNT(*) as count
FROM vehicles
GROUP BY status

UNION ALL

SELECT 
    'Clearance Requests' as category,
    request_type || ' - ' || status as item,
    COUNT(*) as count
FROM clearance_requests
GROUP BY request_type, status

UNION ALL

SELECT 
    'Verifications' as category,
    verification_type || ' - ' || status as item,
    COUNT(*) as count
FROM vehicle_verifications
GROUP BY verification_type, status

UNION ALL

SELECT 
    'Documents' as category,
    document_type || ' - ' || CASE WHEN verified THEN 'Verified' ELSE 'Unverified' END as item,
    COUNT(*) as count
FROM documents
GROUP BY document_type, verified

ORDER BY category, item;

-- ============================================
-- 8. RECENT ACTIVITY CHECK
-- ============================================

-- Check recent vehicle history activity
SELECT 
    vh.action,
    COUNT(*) as count,
    MAX(vh.performed_at) as last_occurrence,
    MIN(vh.performed_at) as first_occurrence
FROM vehicle_history vh
WHERE vh.performed_at > NOW() - INTERVAL '7 days'
GROUP BY vh.action
ORDER BY count DESC;

-- Check vehicles with no recent activity
SELECT 
    v.id,
    v.vin,
    v.plate_number,
    v.status,
    v.registration_date,
    MAX(vh.performed_at) as last_activity,
    EXTRACT(EPOCH FROM (NOW() - MAX(vh.performed_at)))/3600 as hours_since_activity
FROM vehicles v
LEFT JOIN vehicle_history vh ON v.id = vh.vehicle_id
WHERE v.status IN ('PENDING_BLOCKCHAIN', 'SUBMITTED')
GROUP BY v.id, v.vin, v.plate_number, v.status, v.registration_date
HAVING MAX(vh.performed_at) < NOW() - INTERVAL '1 hour'
ORDER BY last_activity DESC NULLS LAST;

-- ============================================
-- 9. DATA INTEGRITY CHECKS
-- ============================================

-- Check for orphaned records
SELECT 
    'Documents without vehicles' as issue,
    COUNT(*) as count
FROM documents d
LEFT JOIN vehicles v ON d.vehicle_id = v.id
WHERE v.id IS NULL

UNION ALL

SELECT 
    'Clearance requests without vehicles' as issue,
    COUNT(*) as count
FROM clearance_requests cr
LEFT JOIN vehicles v ON cr.vehicle_id = v.id
WHERE v.id IS NULL

UNION ALL

SELECT 
    'Verifications without vehicles' as issue,
    COUNT(*) as count
FROM vehicle_verifications vv
LEFT JOIN vehicles v ON vv.vehicle_id = v.id
WHERE v.id IS NULL;

-- Check for missing required data
SELECT 
    'Vehicles without owner' as issue,
    COUNT(*) as count
FROM vehicles
WHERE owner_id IS NULL

UNION ALL

SELECT 
    'Documents without file_hash' as issue,
    COUNT(*) as count
FROM documents
WHERE file_hash IS NULL

UNION ALL

SELECT 
    'Clearance requests without assigned_to' as issue,
    COUNT(*) as count
FROM clearance_requests
WHERE status = 'PENDING'
AND assigned_to IS NULL;
