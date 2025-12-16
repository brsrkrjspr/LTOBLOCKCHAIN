// TrustChain LTO - Database Service Helpers
// Provides high-level database operations for common tasks

const db = require('./db');

// ============================================
// USER OPERATIONS
// ============================================

async function getUserByEmail(email) {
    const result = await db.query(
        'SELECT * FROM users WHERE email = $1 AND is_active = true',
        [email]
    );
    return result.rows[0] || null;
}

async function getUserById(id) {
    const result = await db.query(
        'SELECT id, email, first_name, last_name, role, organization, phone, is_active, email_verified, created_at FROM users WHERE id = $1',
        [id]
    );
    return result.rows[0] || null;
}

async function createUser(userData) {
    const { email, passwordHash, firstName, lastName, role, organization, phone } = userData;
    const result = await db.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, role, organization, phone)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, email, first_name, last_name, role, organization, phone, created_at`,
        [email, passwordHash, firstName, lastName, role || 'vehicle_owner', organization, phone]
    );
    return result.rows[0];
}

async function updateUserLastLogin(userId) {
    await db.query(
        'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
        [userId]
    );
}

// ============================================
// VEHICLE OPERATIONS
// ============================================

async function getVehicleByVin(vin) {
    const result = await db.query(
        `SELECT v.*, 
                u.id as owner_id,
                u.first_name as owner_first_name,
                u.last_name as owner_last_name,
                u.first_name || ' ' || u.last_name as owner_name, 
                u.email as owner_email,
                u.phone as owner_phone,
                u.organization as owner_organization
         FROM vehicles v
         LEFT JOIN users u ON v.owner_id = u.id
         WHERE v.vin = $1`,
        [vin]
    );
    return result.rows[0] || null;
}

async function getVehicleById(id) {
    const result = await db.query(
        `SELECT v.*, 
                u.id as owner_id,
                u.first_name as owner_first_name,
                u.last_name as owner_last_name,
                u.first_name || ' ' || u.last_name as owner_name, 
                u.email as owner_email,
                u.phone as owner_phone,
                u.organization as owner_organization
         FROM vehicles v
         LEFT JOIN users u ON v.owner_id = u.id
         WHERE v.id = $1`,
        [id]
    );
    return result.rows[0] || null;
}

async function createVehicle(vehicleData) {
    const {
        vin, plateNumber, make, model, year, color, engineNumber, chassisNumber,
        vehicleType, fuelType, transmission, engineDisplacement, ownerId, status, notes
    } = vehicleData;

    const result = await db.query(
        `INSERT INTO vehicles (
            vin, plate_number, make, model, year, color, engine_number, chassis_number,
            vehicle_type, fuel_type, transmission, engine_displacement, owner_id, status, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING *`,
        [vin, plateNumber, make, model, year, color, engineNumber, chassisNumber,
         vehicleType || 'PASSENGER', fuelType || 'GASOLINE', transmission || 'MANUAL',
         engineDisplacement, ownerId, status || 'SUBMITTED', notes]
    );
    return result.rows[0];
}

async function updateVehicle(id, updateData) {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    Object.keys(updateData).forEach(key => {
        if (updateData[key] !== undefined) {
            // Convert camelCase to snake_case
            const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
            fields.push(`${dbKey} = $${paramIndex}`);
            values.push(updateData[key]);
            paramIndex++;
        }
    });

    if (fields.length === 0) {
        throw new Error('No fields to update');
    }

    values.push(id);
    const result = await db.query(
        `UPDATE vehicles SET ${fields.join(', ')}, last_updated = CURRENT_TIMESTAMP
         WHERE id = $${paramIndex}
         RETURNING *`,
        values
    );
    return result.rows[0] || null;
}

async function getVehiclesByOwner(ownerId) {
    const result = await db.query(
        'SELECT * FROM vehicles WHERE owner_id = $1 ORDER BY registration_date DESC',
        [ownerId]
    );
    return result.rows;
}

async function getAllVehicles(limit = 100, offset = 0) {
    const result = await db.query(
        `SELECT v.*, u.first_name || ' ' || u.last_name as owner_name, u.email as owner_email
         FROM vehicles v
         LEFT JOIN users u ON v.owner_id = u.id
         ORDER BY v.registration_date DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
    );
    return result.rows;
}

async function getVehiclesByStatus(status, limit = 100, offset = 0) {
    const result = await db.query(
        `SELECT v.*, u.first_name || ' ' || u.last_name as owner_name, u.email as owner_email
         FROM vehicles v
         LEFT JOIN users u ON v.owner_id = u.id
         WHERE v.status = $1
         ORDER BY v.registration_date DESC
         LIMIT $2 OFFSET $3`,
        [status, limit, offset]
    );
    return result.rows;
}

// ============================================
// VERIFICATION OPERATIONS
// ============================================

async function getVehicleVerifications(vehicleId) {
    const result = await db.query(
        `SELECT vv.*, u.first_name || ' ' || u.last_name as verifier_name
         FROM vehicle_verifications vv
         LEFT JOIN users u ON vv.verified_by = u.id
         WHERE vv.vehicle_id = $1
         ORDER BY vv.created_at DESC`,
        [vehicleId]
    );
    return result.rows;
}

async function updateVerificationStatus(vehicleId, verificationType, status, verifiedBy, notes) {
    // Check if verification exists
    const existing = await db.query(
        'SELECT id FROM vehicle_verifications WHERE vehicle_id = $1 AND verification_type = $2',
        [vehicleId, verificationType]
    );

    if (existing.rows.length > 0) {
        // Update existing
        const result = await db.query(
            `UPDATE vehicle_verifications
             SET status = $1, verified_by = $2, verified_at = CURRENT_TIMESTAMP, notes = $3, updated_at = CURRENT_TIMESTAMP
             WHERE vehicle_id = $4 AND verification_type = $5
             RETURNING *`,
            [status, verifiedBy, notes, vehicleId, verificationType]
        );
        return result.rows[0];
    } else {
        // Create new
        const result = await db.query(
            `INSERT INTO vehicle_verifications (vehicle_id, verification_type, status, verified_by, notes)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [vehicleId, verificationType, status, verifiedBy, notes]
        );
        return result.rows[0];
    }
}

// ============================================
// DOCUMENT OPERATIONS
// ============================================

async function createDocument(documentData) {
    const {
        vehicleId, documentType, filename, originalName, filePath,
        fileSize, mimeType, fileHash, uploadedBy, ipfsCid
    } = documentData;

    const result = await db.query(
        `INSERT INTO documents (
            vehicle_id, document_type, filename, original_name, file_path,
            file_size, mime_type, file_hash, uploaded_by, ipfs_cid
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`,
        [vehicleId, documentType, filename, originalName, filePath,
         fileSize, mimeType, fileHash, uploadedBy, ipfsCid || null]
    );
    return result.rows[0];
}

async function getDocumentsByVehicle(vehicleId) {
    const result = await db.query(
        `SELECT d.*, u.first_name || ' ' || u.last_name as uploader_name
         FROM documents d
         LEFT JOIN users u ON d.uploaded_by = u.id
         WHERE d.vehicle_id = $1
         ORDER BY d.uploaded_at DESC`,
        [vehicleId]
    );
    return result.rows;
}

async function getDocumentById(id) {
    const result = await db.query('SELECT * FROM documents WHERE id = $1', [id]);
    return result.rows[0] || null;
}

// Get document by CID (for linking during registration)
async function getDocumentByCid(cid) {
    const result = await db.query(
        'SELECT * FROM documents WHERE ipfs_cid = $1',
        [cid]
    );
    return result.rows[0] || null;
}

// Get unlinked documents (vehicle_id IS NULL)
async function getUnlinkedDocuments(limit = 100) {
    const result = await db.query(
        'SELECT * FROM documents WHERE vehicle_id IS NULL ORDER BY uploaded_at DESC LIMIT $1',
        [limit]
    );
    return result.rows;
}

async function verifyDocument(documentId, verifiedBy) {
    const result = await db.query(
        `UPDATE documents
         SET verified = true, verified_at = CURRENT_TIMESTAMP, verified_by = $1
         WHERE id = $2
         RETURNING *`,
        [verifiedBy, documentId]
    );
    return result.rows[0] || null;
}

// ============================================
// HISTORY OPERATIONS
// ============================================

async function addVehicleHistory(historyData) {
    const { vehicleId, action, description, performedBy, transactionId, metadata } = historyData;
    
    // Truncate transactionId to 100 characters to fit VARCHAR(100) constraint
    // Fabric transaction IDs can be longer, so we keep the last 100 chars (usually the most unique part)
    const truncatedTransactionId = transactionId 
        ? (transactionId.length > 100 ? transactionId.slice(-100) : transactionId)
        : null;
    
    // Truncate description to reasonable length if needed (TEXT field, but good practice)
    const truncatedDescription = description && description.length > 1000 
        ? description.substring(0, 1000) + '...' 
        : description;
    
    const result = await db.query(
        `INSERT INTO vehicle_history (vehicle_id, action, description, performed_by, transaction_id, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [vehicleId, action, truncatedDescription, performedBy, truncatedTransactionId, metadata ? JSON.stringify(metadata) : null]
    );
    return result.rows[0];
}

async function getVehicleHistory(vehicleId, limit = 50) {
    const result = await db.query(
        `SELECT vh.*, u.first_name || ' ' || u.last_name as performer_name
         FROM vehicle_history vh
         LEFT JOIN users u ON vh.performed_by = u.id
         WHERE vh.vehicle_id = $1
         ORDER BY vh.performed_at DESC
         LIMIT $2`,
        [vehicleId, limit]
    );
    return result.rows;
}

// ============================================
// NOTIFICATION OPERATIONS
// ============================================

async function createNotification(notificationData) {
    const { userId, title, message, type } = notificationData;
    const result = await db.query(
        `INSERT INTO notifications (user_id, title, message, type)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [userId, title, message, type || 'info']
    );
    return result.rows[0];
}

async function getUserNotifications(userId, limit = 50, unreadOnly = false) {
    let query = `SELECT * FROM notifications WHERE user_id = $1`;
    const params = [userId];
    
    if (unreadOnly) {
        query += ' AND read = false';
    }
    
    query += ' ORDER BY sent_at DESC LIMIT $' + (params.length + 1);
    params.push(limit);
    
    const result = await db.query(query, params);
    return result.rows;
}

async function markNotificationAsRead(notificationId, userId) {
    const result = await db.query(
        `UPDATE notifications
         SET read = true, read_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND user_id = $2
         RETURNING *`,
        [notificationId, userId]
    );
    return result.rows[0] || null;
}

// ============================================
// CLEARANCE REQUEST OPERATIONS
// ============================================

async function createClearanceRequest(requestData) {
    const { vehicleId, requestType, requestedBy, purpose, notes, metadata, assignedTo } = requestData;
    const result = await db.query(
        `INSERT INTO clearance_requests 
         (vehicle_id, request_type, requested_by, purpose, notes, metadata, assigned_to, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING')
         RETURNING *`,
        [vehicleId, requestType, requestedBy, purpose || null, notes || null, JSON.stringify(metadata || {}), assignedTo || null]
    );
    return result.rows[0];
}

async function getClearanceRequestById(id) {
    const result = await db.query(
        `SELECT cr.*, 
                v.vin, v.plate_number, v.make, v.model, v.year,
                u1.first_name || ' ' || u1.last_name as requested_by_name,
                u2.first_name || ' ' || u2.last_name as assigned_to_name
         FROM clearance_requests cr
         JOIN vehicles v ON cr.vehicle_id = v.id
         JOIN users u1 ON cr.requested_by = u1.id
         LEFT JOIN users u2 ON cr.assigned_to = u2.id
         WHERE cr.id = $1`,
        [id]
    );
    return result.rows[0] || null;
}

async function getClearanceRequestsByVehicle(vehicleId) {
    const result = await db.query(
        `SELECT cr.*, 
                u1.first_name || ' ' || u1.last_name as requested_by_name,
                u2.first_name || ' ' || u2.last_name as assigned_to_name
         FROM clearance_requests cr
         LEFT JOIN users u1 ON cr.requested_by = u1.id
         LEFT JOIN users u2 ON cr.assigned_to = u2.id
         WHERE cr.vehicle_id = $1
         ORDER BY cr.created_at DESC`,
        [vehicleId]
    );
    return result.rows;
}

async function getClearanceRequestsByType(requestType, status = null) {
    let query = `SELECT cr.*,
                        v.id as vehicle_id, v.vin, v.plate_number, v.make, v.model, v.year, v.color, v.vehicle_type,
                        u1.id as owner_id, u1.first_name as owner_first_name, u1.last_name as owner_last_name, u1.email as owner_email,
                        u2.first_name || ' ' || u2.last_name as requested_by_name,
                        u3.first_name || ' ' || u3.last_name as assigned_to_name
                 FROM clearance_requests cr
                 JOIN vehicles v ON cr.vehicle_id = v.id
                 LEFT JOIN users u1 ON v.owner_id = u1.id
                 LEFT JOIN users u2 ON cr.requested_by = u2.id
                 LEFT JOIN users u3 ON cr.assigned_to = u3.id
                 WHERE cr.request_type = $1`;
    const params = [requestType];
    
    if (status) {
        query += ' AND cr.status = $2';
        params.push(status);
    }
    
    query += ' ORDER BY cr.created_at DESC';
    
    const result = await db.query(query, params);
    
    // Transform results to include nested vehicle and owner objects
    return result.rows.map(row => ({
        ...row,
        vehicle: {
            id: row.vehicle_id,
            vin: row.vin,
            plate_number: row.plate_number,
            make: row.make,
            model: row.model,
            year: row.year,
            color: row.color,
            vehicle_type: row.vehicle_type
        },
        owner: {
            id: row.owner_id,
            first_name: row.owner_first_name,
            last_name: row.owner_last_name,
            email: row.owner_email
        }
    }));
}

async function getClearanceRequestsByStatus(status) {
    const result = await db.query(
        `SELECT cr.*,
                v.id as vehicle_id, v.vin, v.plate_number, v.make, v.model, v.year, v.color, v.vehicle_type,
                u1.id as owner_id, u1.first_name as owner_first_name, u1.last_name as owner_last_name, u1.email as owner_email,
                u2.first_name || ' ' || u2.last_name as requested_by_name,
                u3.first_name || ' ' || u3.last_name as assigned_to_name
         FROM clearance_requests cr
         JOIN vehicles v ON cr.vehicle_id = v.id
         LEFT JOIN users u1 ON v.owner_id = u1.id
         LEFT JOIN users u2 ON cr.requested_by = u2.id
         LEFT JOIN users u3 ON cr.assigned_to = u3.id
         WHERE cr.status = $1
         ORDER BY cr.created_at DESC`,
        [status]
    );
    
    // Transform results to include nested vehicle and owner objects
    return result.rows.map(row => ({
        ...row,
        vehicle: {
            id: row.vehicle_id,
            vin: row.vin,
            plate_number: row.plate_number,
            make: row.make,
            model: row.model,
            year: row.year,
            color: row.color,
            vehicle_type: row.vehicle_type
        },
        owner: {
            id: row.owner_id,
            first_name: row.owner_first_name,
            last_name: row.owner_last_name,
            email: row.owner_email
        }
    }));
}

async function updateClearanceRequestStatus(id, status, metadata = null) {
    let query = `UPDATE clearance_requests SET status = $1`;
    const params = [status];
    
    if (status === 'COMPLETED' || status === 'APPROVED' || status === 'REJECTED') {
        query += ', completed_at = CURRENT_TIMESTAMP';
    }
    
    if (metadata) {
        query += ', metadata = metadata || $2::jsonb';
        params.push(JSON.stringify(metadata));
    }
    
    query += ' WHERE id = $' + (params.length + 1) + ' RETURNING *';
    params.push(id);
    
    const result = await db.query(query, params);
    return result.rows[0] || null;
}

async function assignClearanceRequest(id, assignedTo) {
    const result = await db.query(
        `UPDATE clearance_requests 
         SET assigned_to = $1, status = 'SENT', updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING *`,
        [assignedTo, id]
    );
    return result.rows[0] || null;
}

// ============================================
// CERTIFICATE OPERATIONS
// ============================================

async function createCertificate(certificateData) {
    const { clearanceRequestId, vehicleId, certificateType, certificateNumber, filePath, ipfsCid, issuedBy, expiresAt, metadata } = certificateData;
    const result = await db.query(
        `INSERT INTO certificates 
         (clearance_request_id, vehicle_id, certificate_type, certificate_number, file_path, ipfs_cid, issued_by, expires_at, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [clearanceRequestId || null, vehicleId, certificateType, certificateNumber, filePath || null, ipfsCid || null, issuedBy, expiresAt || null, JSON.stringify(metadata || {})]
    );
    
    // Update clearance request with certificate_id
    if (clearanceRequestId) {
        await db.query(
            'UPDATE clearance_requests SET certificate_id = $1 WHERE id = $2',
            [result.rows[0].id, clearanceRequestId]
        );
    }
    
    return result.rows[0];
}

async function getCertificateById(id) {
    const result = await db.query(
        `SELECT c.*, 
                v.vin, v.plate_number, v.make, v.model, v.year,
                u.first_name || ' ' || u.last_name as issued_by_name
         FROM certificates c
         JOIN vehicles v ON c.vehicle_id = v.id
         JOIN users u ON c.issued_by = u.id
         WHERE c.id = $1`,
        [id]
    );
    return result.rows[0] || null;
}

async function getCertificatesByVehicle(vehicleId) {
    const result = await db.query(
        `SELECT c.*, 
                u.first_name || ' ' || u.last_name as issued_by_name
         FROM certificates c
         LEFT JOIN users u ON c.issued_by = u.id
         WHERE c.vehicle_id = $1
         ORDER BY c.issued_at DESC`,
        [vehicleId]
    );
    return result.rows;
}

async function getCertificatesByRequest(clearanceRequestId) {
    const result = await db.query(
        `SELECT c.*, 
                u.first_name || ' ' || u.last_name as issued_by_name
         FROM certificates c
         LEFT JOIN users u ON c.issued_by = u.id
         WHERE c.clearance_request_id = $1
         ORDER BY c.issued_at DESC`,
        [clearanceRequestId]
    );
    return result.rows;
}

async function updateCertificateStatus(id, status) {
    const result = await db.query(
        `UPDATE certificates 
         SET status = $1
         WHERE id = $2
         RETURNING *`,
        [status, id]
    );
    return result.rows[0] || null;
}

// ============================================
// TRANSFER REQUEST OPERATIONS
// ============================================

async function createTransferRequest(transferData) {
    const { vehicleId, sellerId, buyerId, buyerInfo, metadata } = transferData;
    const result = await db.query(
        `INSERT INTO transfer_requests 
         (vehicle_id, seller_id, buyer_id, buyer_info, metadata)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
            vehicleId,
            sellerId,
            buyerId || null,
            buyerInfo ? JSON.stringify(buyerInfo) : null,
            JSON.stringify(metadata || {})
        ]
    );
    return result.rows[0];
}

async function getTransferRequestById(id) {
    const result = await db.query(
        `SELECT tr.*,
                v.id as vehicle_id, v.vin, v.plate_number, v.make, v.model, v.year, v.color, 
                v.engine_number, v.chassis_number, v.vehicle_type,
                seller.id as seller_user_id, seller.first_name as seller_first_name, 
                seller.last_name as seller_last_name, seller.email as seller_email, 
                seller.phone as seller_phone,
                buyer.id as buyer_user_id, buyer.first_name as buyer_first_name,
                buyer.last_name as buyer_last_name, buyer.email as buyer_email,
                buyer.phone as buyer_phone,
                reviewer.first_name || ' ' || reviewer.last_name as reviewed_by_name
         FROM transfer_requests tr
         JOIN vehicles v ON tr.vehicle_id = v.id
         JOIN users seller ON tr.seller_id = seller.id
         LEFT JOIN users buyer ON tr.buyer_id = buyer.id
         LEFT JOIN users reviewer ON tr.reviewed_by = reviewer.id
         WHERE tr.id = $1`,
        [id]
    );
    
    if (result.rows.length === 0) {
        return null;
    }
    
    const row = result.rows[0];
    
    // Parse JSONB fields
    const buyerInfo = row.buyer_info ? (typeof row.buyer_info === 'string' ? JSON.parse(row.buyer_info) : row.buyer_info) : null;
    const metadata = row.metadata ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) : {};
    
    return {
        ...row,
        buyer_info: buyerInfo,
        metadata: metadata,
        vehicle: {
            id: row.vehicle_id,
            vin: row.vin,
            plate_number: row.plate_number,
            make: row.make,
            model: row.model,
            year: row.year,
            color: row.color,
            engine_number: row.engine_number,
            chassis_number: row.chassis_number,
            vehicle_type: row.vehicle_type
        },
        seller: {
            id: row.seller_user_id,
            first_name: row.seller_first_name,
            last_name: row.seller_last_name,
            email: row.seller_email,
            phone: row.seller_phone
        },
        buyer: row.buyer_user_id ? {
            id: row.buyer_user_id,
            first_name: row.buyer_first_name,
            last_name: row.buyer_last_name,
            email: row.buyer_email,
            phone: row.buyer_phone
        } : buyerInfo,
        reviewed_by_name: row.reviewed_by_name
    };
}

async function getTransferRequests(filters = {}) {
    const { status, sellerId, buyerId, vehicleId, dateFrom, dateTo, plateNumber, page = 1, limit = 50 } = filters;
    const offset = (page - 1) * limit;
    
    let query = `
        SELECT tr.*,
               v.vin, v.plate_number, v.make, v.model, v.year,
               seller.first_name || ' ' || seller.last_name as seller_name,
               seller.email as seller_email,
               buyer.first_name || ' ' || buyer.last_name as buyer_name,
               buyer.email as buyer_email
        FROM transfer_requests tr
        JOIN vehicles v ON tr.vehicle_id = v.id
        JOIN users seller ON tr.seller_id = seller.id
        LEFT JOIN users buyer ON tr.buyer_id = buyer.id
        WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 0;
    
    if (status) {
        paramCount++;
        query += ` AND tr.status = $${paramCount}`;
        params.push(status);
    }
    
    if (sellerId) {
        paramCount++;
        query += ` AND tr.seller_id = $${paramCount}`;
        params.push(sellerId);
    }
    
    if (buyerId) {
        paramCount++;
        query += ` AND tr.buyer_id = $${paramCount}`;
        params.push(buyerId);
    }
    
    if (vehicleId) {
        paramCount++;
        query += ` AND tr.vehicle_id = $${paramCount}`;
        params.push(vehicleId);
    }
    
    if (dateFrom) {
        paramCount++;
        query += ` AND tr.submitted_at >= $${paramCount}`;
        params.push(dateFrom);
    }
    
    if (dateTo) {
        paramCount++;
        query += ` AND tr.submitted_at <= $${paramCount}`;
        params.push(dateTo);
    }
    
    if (plateNumber) {
        paramCount++;
        query += ` AND v.plate_number ILIKE $${paramCount}`;
        params.push(`%${plateNumber}%`);
    }
    
    query += ` ORDER BY tr.submitted_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(limit, offset);
    
    const result = await db.query(query, params);
    
    // Parse JSONB fields
    return result.rows.map(row => ({
        ...row,
        buyer_info: row.buyer_info ? (typeof row.buyer_info === 'string' ? JSON.parse(row.buyer_info) : row.buyer_info) : null,
        metadata: row.metadata ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) : {}
    }));
}

async function updateTransferRequestStatus(id, status, reviewedBy = null, rejectionReason = null, metadata = null) {
    let query = `UPDATE transfer_requests SET status = $1`;
    const params = [status];
    let paramCount = 1;
    
    if (status === 'REVIEWING' || status === 'APPROVED' || status === 'REJECTED' || status === 'COMPLETED') {
        paramCount++;
        query += `, reviewed_at = CURRENT_TIMESTAMP`;
        if (reviewedBy) {
            paramCount++;
            query += `, reviewed_by = $${paramCount}`;
            params.push(reviewedBy);
        }
    }
    
    if (rejectionReason) {
        paramCount++;
        query += `, rejection_reason = $${paramCount}`;
        params.push(rejectionReason);
    }
    
    if (metadata) {
        paramCount++;
        query += `, metadata = metadata || $${paramCount}::jsonb`;
        params.push(JSON.stringify(metadata));
    }
    
    paramCount++;
    query += `, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramCount} RETURNING *`;
    params.push(id);
    
    const result = await db.query(query, params);
    return result.rows[0] || null;
}

async function getTransferRequestDocuments(transferRequestId) {
    const result = await db.query(
        `SELECT td.*,
                d.id as document_id, d.document_type, d.filename, d.original_name, 
                d.file_path, d.ipfs_cid, d.file_hash, d.uploaded_at,
                u.first_name || ' ' || u.last_name as uploaded_by_name
         FROM transfer_documents td
         LEFT JOIN documents d ON td.document_id = d.id
         LEFT JOIN users u ON td.uploaded_by = u.id
         WHERE td.transfer_request_id = $1
         ORDER BY td.uploaded_at DESC`,
        [transferRequestId]
    );
    return result.rows;
}

async function createTransferVerification(verificationData) {
    const { transferRequestId, documentId, verifiedBy, status, notes, checklist, flagged } = verificationData;
    const result = await db.query(
        `INSERT INTO transfer_verifications 
         (transfer_request_id, document_id, verified_by, status, notes, checklist, flagged)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
            transferRequestId,
            documentId || null,
            verifiedBy,
            status,
            notes || null,
            JSON.stringify(checklist || {}),
            flagged || false
        ]
    );
    return result.rows[0];
}

async function getTransferVerificationHistory(transferRequestId) {
    const result = await db.query(
        `SELECT tv.*,
                d.document_type, d.original_name,
                u.first_name || ' ' || u.last_name as verified_by_name
         FROM transfer_verifications tv
         LEFT JOIN documents d ON tv.document_id = d.id
         LEFT JOIN users u ON tv.verified_by = u.id
         WHERE tv.transfer_request_id = $1
         ORDER BY tv.verified_at DESC`,
        [transferRequestId]
    );
    
    return result.rows.map(row => ({
        ...row,
        checklist: row.checklist ? (typeof row.checklist === 'string' ? JSON.parse(row.checklist) : row.checklist) : {}
    }));
}

async function getOwnershipHistory(vehicleId) {
    const result = await db.query(
        `SELECT vh.*,
                u.first_name || ' ' || u.last_name as performed_by_name,
                v.vin, v.plate_number
         FROM vehicle_history vh
         JOIN vehicles v ON vh.vehicle_id = v.id
         LEFT JOIN users u ON vh.performed_by = u.id
         WHERE vh.vehicle_id = $1 
           AND (vh.action = 'OWNERSHIP_TRANSFERRED' OR vh.metadata->>'previousOwnerId' IS NOT NULL)
         ORDER BY vh.performed_at DESC`,
        [vehicleId]
    );
    
    return result.rows.map(row => ({
        ...row,
        metadata: row.metadata ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) : {}
    }));
}

async function getRegistrationProgress(vehicleId) {
    const vehicle = await getVehicleById(vehicleId);
    if (!vehicle) {
        return null;
    }
    
    const verifications = await getVehicleVerifications(vehicleId);
    const documents = await getDocumentsByVehicle(vehicleId);
    
    // Build progress timeline
    const progress = {
        applicationSubmitted: {
            status: vehicle.status !== 'SUBMITTED' ? 'completed' : 'pending',
            date: vehicle.registration_date || vehicle.created_at
        },
        emissionTest: {
            status: 'pending',
            date: null
        },
        insuranceVerification: {
            status: 'pending',
            date: null
        },
        hpgClearance: {
            status: 'pending',
            date: null
        },
        finalization: {
            status: 'pending',
            date: null
        },
        completed: {
            status: vehicle.status === 'REGISTERED' || vehicle.status === 'APPROVED' ? 'completed' : 'pending',
            date: vehicle.status === 'REGISTERED' ? vehicle.last_updated : null
        }
    };
    
    // Check emission verification
    const emissionVerification = verifications.find(v => v.verification_type === 'emission');
    if (emissionVerification) {
        progress.emissionTest = {
            status: emissionVerification.status === 'APPROVED' ? 'completed' : 
                   emissionVerification.status === 'REJECTED' ? 'rejected' : 'pending',
            date: emissionVerification.verified_at
        };
    }
    
    // Check insurance verification
    const insuranceVerification = verifications.find(v => v.verification_type === 'insurance');
    if (insuranceVerification) {
        progress.insuranceVerification = {
            status: insuranceVerification.status === 'APPROVED' ? 'completed' : 
                   insuranceVerification.status === 'REJECTED' ? 'rejected' : 'pending',
            date: insuranceVerification.verified_at
        };
    }
    
    // Check HPG clearance (via clearance_requests)
    const dbModule = require('./db');
    const hpgRequests = await dbModule.query(
        `SELECT * FROM clearance_requests 
         WHERE vehicle_id = $1 AND request_type = 'hpg' 
         ORDER BY created_at DESC LIMIT 1`,
        [vehicleId]
    );
    
    if (hpgRequests.rows.length > 0) {
        const hpgRequest = hpgRequests.rows[0];
        progress.hpgClearance = {
            status: hpgRequest.status === 'COMPLETED' || hpgRequest.status === 'APPROVED' ? 'completed' :
                   hpgRequest.status === 'REJECTED' ? 'rejected' : 'pending',
            date: hpgRequest.completed_at || hpgRequest.created_at
        };
    }
    
    // Finalization status (when all verifications are approved but not yet registered)
    const allVerificationsApproved = verifications.length >= 3 && 
                                     verifications.every(v => v.status === 'APPROVED');
    if (allVerificationsApproved && vehicle.status !== 'REGISTERED') {
        progress.finalization = {
            status: 'pending',
            date: null
        };
    } else if (vehicle.status === 'REGISTERED') {
        progress.finalization = {
            status: 'completed',
            date: vehicle.last_updated
        };
    }
    
    return progress;
}

module.exports = {
    // User operations
    getUserByEmail,
    getUserById,
    createUser,
    updateUserLastLogin,
    
    // Vehicle operations
    getVehicleByVin,
    getVehicleById,
    createVehicle,
    updateVehicle,
    getVehiclesByOwner,
    getAllVehicles,
    getVehiclesByStatus,
    
    // Verification operations
    getVehicleVerifications,
    updateVerificationStatus,
    
    // Document operations
    createDocument,
    getDocumentsByVehicle,
    getDocumentById,
    getDocumentByCid,
    getUnlinkedDocuments,
    verifyDocument,
    
    // History operations
    addVehicleHistory,
    getVehicleHistory,
    
    // Notification operations
    createNotification,
    getUserNotifications,
    markNotificationAsRead,
    
    // Clearance request operations
    createClearanceRequest,
    getClearanceRequestById,
    getClearanceRequestsByVehicle,
    getClearanceRequestsByType,
    getClearanceRequestsByStatus,
    updateClearanceRequestStatus,
    assignClearanceRequest,
    
    // Certificate operations
    createCertificate,
    getCertificateById,
    getCertificatesByVehicle,
    getCertificatesByRequest,
    updateCertificateStatus,
    
    // Transfer request operations
    createTransferRequest,
    getTransferRequestById,
    getTransferRequests,
    updateTransferRequestStatus,
    getTransferRequestDocuments,
    createTransferVerification,
    getTransferVerificationHistory,
    getOwnershipHistory,
    getRegistrationProgress
};

