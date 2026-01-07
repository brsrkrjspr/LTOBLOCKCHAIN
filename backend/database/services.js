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
        'SELECT id, email, first_name, last_name, role, organization, phone, address, is_active, email_verified, created_at FROM users WHERE id = $1',
        [id]
    );
    return result.rows[0] || null;
}

async function createUser(userData) {
    const { email, passwordHash, firstName, lastName, role, organization, phone, address } = userData;
    const result = await db.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, role, organization, phone, address)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, email, first_name, last_name, role, organization, phone, address, created_at`,
        [email, passwordHash, firstName, lastName, role || 'vehicle_owner', organization, phone, address || null]
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
                u.address as owner_address,
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
        vehicleType, fuelType, transmission, engineDisplacement, ownerId, status, notes, originType
    } = vehicleData;

    const result = await db.query(
        `INSERT INTO vehicles (
            vin, plate_number, make, model, year, color, engine_number, chassis_number,
            vehicle_type, fuel_type, transmission, engine_displacement, owner_id, status, notes, origin_type
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING *`,
        [vin, plateNumber, make, model, year, color, engineNumber, chassisNumber,
         vehicleType || 'PASSENGER', fuelType || 'GASOLINE', transmission || 'MANUAL',
         engineDisplacement, ownerId, status || 'SUBMITTED', notes, originType || 'NEW_REG']
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
    // Get ALL vehicles where the user is the owner (including pending applications)
    // Include all statuses: SUBMITTED, PENDING_BLOCKCHAIN, REGISTERED, APPROVED, etc.
    // This allows owners to see their pending applications in addition to registered vehicles
    // Use owner_id directly (current_owner_id may not exist in all schemas)
    // Use registration_date and last_updated for ordering (created_at may not exist in all schemas)
    const result = await db.query(
        `SELECT v.* FROM vehicles v
         WHERE v.owner_id = $1
         ORDER BY COALESCE(v.registration_date, v.last_updated) DESC, v.last_updated DESC`,
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
    let paramIndex = 2;
    
    // Only set completed_at if status is final (COMPLETED, APPROVED, or REJECTED)
    // Check if column exists first, or use a safer approach
    if (status === 'COMPLETED' || status === 'APPROVED' || status === 'REJECTED') {
        // Try to add completed_at update, but handle gracefully if column doesn't exist
        query += ', completed_at = CURRENT_TIMESTAMP';
    }
    
    if (metadata) {
        query += ', metadata = metadata || $' + paramIndex + '::jsonb';
        params.push(JSON.stringify(metadata));
        paramIndex++;
    }
    
    query += ', updated_at = CURRENT_TIMESTAMP';
    query += ' WHERE id = $' + paramIndex + ' RETURNING *';
    params.push(id);
    
    try {
        const result = await db.query(query, params);
        return result.rows[0] || null;
    } catch (error) {
        // If completed_at column doesn't exist, retry without it
        if (error.message && error.message.includes('completed_at')) {
            console.warn('completed_at column not found, updating without it');
            let fallbackQuery = `UPDATE clearance_requests SET status = $1`;
            const fallbackParams = [status];
            let fallbackIndex = 2;
            
            if (metadata) {
                fallbackQuery += ', metadata = metadata || $' + fallbackIndex + '::jsonb';
                fallbackParams.push(JSON.stringify(metadata));
                fallbackIndex++;
            }
            
            fallbackQuery += ', updated_at = CURRENT_TIMESTAMP';
            fallbackQuery += ' WHERE id = $' + fallbackIndex + ' RETURNING *';
            fallbackParams.push(id);
            
            const result = await db.query(fallbackQuery, fallbackParams);
            return result.rows[0] || null;
        }
        throw error;
    }
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
    
    try {
        const result = await db.query(
            `INSERT INTO transfer_requests 
             (vehicle_id, seller_id, buyer_id, buyer_info, metadata)
             VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)
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
    } catch (error) {
        console.error('Error creating transfer request:', error);
        console.error('Transfer data:', { vehicleId, sellerId, buyerId, hasBuyerInfo: !!buyerInfo });
        throw error;
    }
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
               COALESCE(
                   NULLIF(TRIM(seller.first_name || ' ' || seller.last_name), ''),
                   seller.email,
                   'Unknown Seller'
               ) as seller_name,
               seller.email as seller_email,
               seller.phone as seller_phone,
               COALESCE(
                   NULLIF(TRIM(buyer.first_name || ' ' || buyer.last_name), ''),
                   buyer.email,
                   NULL
               ) as buyer_name,
               buyer.email as buyer_email,
               buyer.phone as buyer_phone
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
        // Handle both single status and array of statuses
        if (Array.isArray(status)) {
            query += ` AND tr.status = ANY($${paramCount})`;
            params.push(status);
        } else {
            query += ` AND tr.status = $${paramCount}`;
            params.push(status);
        }
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
        query += ` AND tr.created_at >= $${paramCount}`;
        params.push(dateFrom);
    }
    
    if (dateTo) {
        paramCount++;
        query += ` AND tr.created_at <= $${paramCount}`;
        params.push(dateTo);
    }
    
    if (plateNumber) {
        paramCount++;
        query += ` AND v.plate_number ILIKE $${paramCount}`;
        params.push(`%${plateNumber}%`);
    }
    
    query += ` ORDER BY tr.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(limit, offset);
    
    let result;
    try {
        result = await db.query(query, params);
    } catch (queryError) {
        console.error('SQL Query Error in getTransferRequests:', queryError);
        console.error('Query:', query);
        console.error('Params:', params);
        throw queryError;
    }
    
    // Parse JSONB fields and ensure proper name extraction
    return result.rows.map(row => {
        const buyerInfo = row.buyer_info ? (typeof row.buyer_info === 'string' ? JSON.parse(row.buyer_info) : row.buyer_info) : null;
        const metadata = row.metadata ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) : {};
        
        // Extract buyer name - prioritize database join (real user data), then buyer_info JSONB
        // NEVER use placeholders - always use real data from records
        let finalBuyerName = row.buyer_name; // From database join (if buyer has account)
        
        // If no buyer_name from join, try buyer_info JSONB (for buyers without accounts yet)
        if (!finalBuyerName && buyerInfo) {
            if (buyerInfo.firstName && buyerInfo.lastName) {
                finalBuyerName = `${buyerInfo.firstName} ${buyerInfo.lastName}`;
            } else if (buyerInfo.firstName) {
                finalBuyerName = buyerInfo.firstName;
            } else if (buyerInfo.email) {
                // Last resort: use email (real data, not placeholder)
                finalBuyerName = buyerInfo.email;
            }
        }
        
        // If still no name, use buyer email from join (real data)
        if (!finalBuyerName && row.buyer_email) {
            finalBuyerName = row.buyer_email;
        }
        
        // If still no name and we have buyer_info with email, use that
        if (!finalBuyerName && buyerInfo && buyerInfo.email) {
            finalBuyerName = buyerInfo.email;
        }
        
        return {
            ...row,
            buyer_name: finalBuyerName || null, // Never use 'N/A' or placeholders
            buyer_info: buyerInfo,
            metadata: metadata,
            vehicle: {
                vin: row.vin,
                plate_number: row.plate_number,
                make: row.make,
                model: row.model,
                year: row.year
            }
        };
    });
}

async function updateTransferRequestStatus(id, status, reviewedBy = null, rejectionReason = null, metadata = null) {
    let query = `UPDATE transfer_requests SET status = $1`;
    const params = [status];
    let paramCount = 1;
    
    if (status === 'REVIEWING' || status === 'APPROVED' || status === 'REJECTED' || status === 'COMPLETED') {
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
        // Use COALESCE to ensure metadata exists before merging, and explicitly cast to help PostgreSQL determine the type
        query += `, metadata = COALESCE(metadata, '{}'::jsonb) || $${paramCount}::jsonb`;
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
    try {
        // Validate vehicleId
        if (!vehicleId) {
            console.warn('getOwnershipHistory called with null/undefined vehicleId');
            return [];
        }
        
        // First, get the vehicle to access owner information
        const vehicle = await getVehicleById(vehicleId);
        if (!vehicle) {
            console.warn(`Vehicle ${vehicleId} not found`);
            return [];
        }
        
        // Enhanced query with previous and new owner information
        let result;
        try {
            result = await db.query(
                `SELECT vh.*,
                        COALESCE(performer.first_name || ' ' || performer.last_name, 'System') as performed_by_name,
                        performer.email as performer_email,
                        v.vin, v.plate_number,
                        -- Current owner at time of record
                        COALESCE(current_owner.first_name || ' ' || current_owner.last_name, 'Unknown') as current_owner_name,
                        current_owner.email as current_owner_email,
                        -- Extract previous/new owner from metadata if available
                        vh.metadata->>'previousOwnerName' as previous_owner_name,
                        vh.metadata->>'previousOwnerEmail' as previous_owner_email,
                        vh.metadata->>'newOwnerName' as new_owner_name,
                        vh.metadata->>'newOwnerEmail' as new_owner_email,
                        vh.metadata->>'transferReason' as transfer_reason,
                        vh.metadata->>'transferDate' as transfer_date
                 FROM vehicle_history vh
                 JOIN vehicles v ON vh.vehicle_id = v.id
                 LEFT JOIN users performer ON vh.performed_by = performer.id
                 LEFT JOIN users current_owner ON v.owner_id = current_owner.id
                 WHERE vh.vehicle_id = $1 
                   AND (vh.action IN ('OWNERSHIP_TRANSFERRED', 'REGISTERED', 'BLOCKCHAIN_REGISTERED', 'CLEARANCE_APPROVED')
                        OR vh.metadata::text LIKE '%previousOwner%')
                 ORDER BY vh.performed_at ASC NULLS LAST`,
                [vehicleId]
            );
        } catch (queryError) {
            // If vehicle_history table doesn't exist or query fails, log and return empty history
            console.error(`Query error in getOwnershipHistory for vehicle ${vehicleId}:`, queryError);
            console.error('Error details:', {
                message: queryError.message,
                code: queryError.code,
                detail: queryError.detail,
                hint: queryError.hint
            });
            result = { rows: [] };
        }
        
        // Format history with enhanced owner information
        const history = result.rows.map((h, index) => {
            try {
                const metadata = h.metadata ? (typeof h.metadata === 'string' ? JSON.parse(h.metadata) : h.metadata) : {};
                return {
                    id: h.id,
                    vehicleId: h.vehicle_id,
                    action: h.action,
                    description: h.description,
                    timestamp: h.performed_at,
                    performedBy: h.performed_by,
                    performerName: h.performed_by_name,
                    performerEmail: h.performer_email,
                    transactionId: h.transaction_id,
                    vin: h.vin,
                    plateNumber: h.plate_number,
                    // Enhanced owner tracking
                    currentOwnerName: h.current_owner_name,
                    currentOwnerEmail: h.current_owner_email,
                    previousOwnerName: h.previous_owner_name || metadata.previousOwnerName || null,
                    previousOwnerEmail: h.previous_owner_email || metadata.previousOwnerEmail || null,
                    newOwnerName: h.new_owner_name || metadata.newOwnerName || null,
                    newOwnerEmail: h.new_owner_email || metadata.newOwnerEmail || null,
                    transferReason: h.transfer_reason || metadata.transferReason || null,
                    transferDate: h.transfer_date || metadata.transferDate || null,
                    // Full metadata for detailed view
                    metadata: metadata,
                    // Sequence number for timeline
                    sequenceNumber: index + 1
                };
            } catch (parseError) {
                console.warn(`Error parsing metadata for history record ${h.id}:`, parseError);
                return {
                    id: h.id,
                    vehicleId: h.vehicle_id,
                    action: h.action,
                    description: h.description,
                    timestamp: h.performed_at,
                    performedBy: h.performed_by,
                    performerName: h.performed_by_name,
                    performerEmail: h.performer_email,
                    transactionId: h.transaction_id,
                    vin: h.vin,
                    plateNumber: h.plate_number,
                    currentOwnerName: h.current_owner_name,
                    currentOwnerEmail: h.current_owner_email,
                    previousOwnerName: h.previous_owner_name || null,
                    previousOwnerEmail: h.previous_owner_email || null,
                    newOwnerName: h.new_owner_name || null,
                    newOwnerEmail: h.new_owner_email || null,
                    transferReason: h.transfer_reason || null,
                    transferDate: h.transfer_date || null,
                    metadata: {},
                    sequenceNumber: index + 1
                };
            }
        });
        
        // If no history exists but vehicle exists, create initial ownership entry
        if (history.length === 0 && vehicle) {
            // Get current owner information (safely handle errors)
            let ownerInfo = null;
            if (vehicle.owner_id) {
                try {
                    ownerInfo = await getUserById(vehicle.owner_id);
                } catch (userError) {
                    console.warn(`Error getting owner info for vehicle ${vehicleId}:`, userError);
                    ownerInfo = null;
                }
            }
            
            return [{
                id: null,
                vehicle_id: vehicleId,
                action: 'REGISTERED',
                description: 'Vehicle initially registered',
                performed_at: vehicle.created_at || vehicle.registration_date || new Date(),
                performed_by: vehicle.owner_id,
                performed_by_name: ownerInfo ? `${ownerInfo.first_name} ${ownerInfo.last_name}` : 'System',
                transaction_id: null,
                metadata: {
                    is_initial: true,
                    owner_id: vehicle.owner_id,
                    owner_name: ownerInfo ? `${ownerInfo.first_name} ${ownerInfo.last_name}` : null,
                    owner_email: ownerInfo ? ownerInfo.email : null
                },
                vin: vehicle.vin,
                plate_number: vehicle.plate_number,
                owner_name: ownerInfo ? `${ownerInfo.first_name} ${ownerInfo.last_name}` : null,
                owner_email: ownerInfo ? ownerInfo.email : null
            }];
        }
        
        // If we have history but no REGISTERED action, add initial registration as first entry
        const hasRegistered = history.some(h => h.action === 'REGISTERED');
        if (!hasRegistered && vehicle) {
            // Get current owner information (safely handle errors)
            let ownerInfo = null;
            if (vehicle.owner_id) {
                try {
                    ownerInfo = await getUserById(vehicle.owner_id);
                } catch (userError) {
                    console.warn(`Error getting owner info for vehicle ${vehicleId}:`, userError);
                    ownerInfo = null;
                }
            }
            
            // Find the earliest transfer to determine initial owner
            // If there are transfers, the initial owner is in the first transfer's metadata
            let initialOwnerId = vehicle.owner_id;
            let initialOwnerName = ownerInfo ? `${ownerInfo.first_name} ${ownerInfo.last_name}` : null;
            let initialOwnerEmail = ownerInfo ? ownerInfo.email : null;
            
            if (history.length > 0) {
                const firstTransfer = history[0];
                if (firstTransfer.metadata && firstTransfer.metadata.previousOwnerId) {
                    try {
                        const prevOwner = await getUserById(firstTransfer.metadata.previousOwnerId);
                        if (prevOwner) {
                            initialOwnerId = firstTransfer.metadata.previousOwnerId;
                            initialOwnerName = `${prevOwner.first_name} ${prevOwner.last_name}`;
                            initialOwnerEmail = prevOwner.email;
                        }
                    } catch (prevOwnerError) {
                        console.warn(`Error getting previous owner info:`, prevOwnerError);
                    }
                }
            }
            
            // Add initial registration as first entry
            history.unshift({
                id: null,
                vehicle_id: vehicleId,
                action: 'REGISTERED',
                description: 'Vehicle initially registered',
                performed_at: vehicle.created_at || vehicle.registration_date || (history.length > 0 ? new Date(new Date(history[0].performed_at).getTime() - 86400000) : new Date()),
                performed_by: initialOwnerId,
                performed_by_name: initialOwnerName || 'System',
                transaction_id: null,
                metadata: {
                    is_initial: true,
                    owner_id: initialOwnerId,
                    owner_name: initialOwnerName,
                    owner_email: initialOwnerEmail
                },
                vin: vehicle.vin,
                plate_number: vehicle.plate_number,
                owner_name: initialOwnerName,
                owner_email: initialOwnerEmail
            });
        }
        
        return history;
    } catch (error) {
        console.error(`Error in getOwnershipHistory for vehicle ${vehicleId}:`, error);
        console.error('Error stack:', error.stack);
        // Return empty array on error to prevent breaking the entire request
        return [];
    }
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

// ============================================
// OR/CR NUMBER GENERATION
// ============================================

/**
 * Generate a unique OR (Official Receipt) number
 * Format: OR-YYYY-XXXXXX (e.g., OR-2025-000001)
 * Uses database sequence for atomic increment
 * 
 * @returns {Promise<string>} The generated OR number
 */
async function generateOrNumber() {
    const year = new Date().getFullYear();
    
    try {
        // Use database sequence for atomic increment
        // This prevents race conditions when multiple approvals happen simultaneously
        const result = await db.query(
            `SELECT nextval('or_number_seq') as seq_num`
        );
        
        const sequenceNumber = parseInt(result.rows[0].seq_num);
        
        // Format: OR-YYYY-XXXXXX (6 digits, zero-padded)
        const orNumber = `OR-${year}-${String(sequenceNumber).padStart(6, '0')}`;
        
        // Verify uniqueness (safety check - should never fail with sequence)
        const existingCheck = await db.query(
            'SELECT id FROM vehicles WHERE or_number = $1',
            [orNumber]
        );
        
        if (existingCheck.rows.length > 0) {
            // Extremely rare case - retry with next sequence number
            console.warn(`OR number collision detected: ${orNumber}. Retrying...`);
            return generateOrNumber(); // Recursive retry
        }
        
        console.log(`[OR] Generated new number: ${orNumber}`);
        return orNumber;
        
    } catch (error) {
        if (error.message && error.message.includes('or_number_seq')) {
            throw new Error('OR number sequence not found. Run database migration to create or_number_seq sequence.');
        }
        throw error;
    }
}


/**
 * Generate a unique CR (Certificate of Registration) number
 * Format: CR-YYYY-XXXXXX (e.g., CR-2025-000001)
 * Uses database sequence for atomic increment
 * 
 * @returns {Promise<string>} The generated CR number
 */
async function generateCrNumber() {
    const year = new Date().getFullYear();
    
    try {
        // Use database sequence for atomic increment
        // This prevents race conditions when multiple approvals happen simultaneously
        const result = await db.query(
            `SELECT nextval('cr_number_seq') as seq_num`
        );
        
        const sequenceNumber = parseInt(result.rows[0].seq_num);
        
        // Format: CR-YYYY-XXXXXX (6 digits, zero-padded)
        const crNumber = `CR-${year}-${String(sequenceNumber).padStart(6, '0')}`;
        
        // Verify uniqueness (safety check - should never fail with sequence)
        const existingCheck = await db.query(
            'SELECT id FROM vehicles WHERE cr_number = $1',
            [crNumber]
        );
        
        if (existingCheck.rows.length > 0) {
            // Extremely rare case - retry with next sequence number
            console.warn(`CR number collision detected: ${crNumber}. Retrying...`);
            return generateCrNumber(); // Recursive retry
        }
        
        console.log(`[CR] Generated new number: ${crNumber}`);
        return crNumber;
        
    } catch (error) {
        if (error.message && error.message.includes('cr_number_seq')) {
            throw new Error('CR number sequence not found. Run database migration to create cr_number_seq sequence.');
        }
        throw error;
    }
}

/**
 * Assign separate OR and CR numbers to a vehicle
 * Updates the vehicle record with the generated OR and CR numbers
 * 
 * @param {string} vehicleId - The vehicle UUID
 * @returns {Promise<{orNumber: string, crNumber: string, orIssuedAt: Date, crIssuedAt: Date}>}
 */
async function assignOrAndCrNumbers(vehicleId) {
    const orNumber = await generateOrNumber();
    const crNumber = await generateCrNumber();
    const issuedAt = new Date();
    
    await db.query(
        `UPDATE vehicles 
         SET or_number = $1, 
             cr_number = $2, 
             or_issued_at = $3, 
             cr_issued_at = $3,
             date_of_registration = COALESCE(date_of_registration, registration_date, $3),
             last_updated = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [orNumber, crNumber, issuedAt, vehicleId]
    );
    
    console.log(`[OR/CR] Assigned OR: ${orNumber}, CR: ${crNumber} to vehicle ${vehicleId}`);
    
    return { 
        orNumber, 
        crNumber, 
        orIssuedAt: issuedAt, 
        crIssuedAt: issuedAt 
    };
}

/**
 * DEPRECATED: Generate a unique OR/CR number (combined)
 * Kept for backward compatibility
 * @deprecated Use generateOrNumber() and generateCrNumber() instead
 * @returns {Promise<string>} The generated OR/CR number
 */
async function generateOrCrNumber() {
    console.warn('[DEPRECATED] generateOrCrNumber() is deprecated. Use generateOrNumber() and generateCrNumber() instead.');
    // For backward compatibility, generate OR number format
    return generateOrNumber();
}


/**
 * DEPRECATED: Assign OR/CR number to a vehicle (combined)
 * @deprecated Use assignOrAndCrNumbers() instead
 * @param {string} vehicleId - The vehicle UUID
 * @returns {Promise<{orCrNumber: string, issuedAt: Date}>}
 */
async function assignOrCrNumber(vehicleId) {
    console.warn('[DEPRECATED] assignOrCrNumber() is deprecated. Use assignOrAndCrNumbers() instead.');
    // For backward compatibility, assign both OR and CR but return combined format
    const result = await assignOrAndCrNumbers(vehicleId);
    // Return in old format for backward compatibility
    return { 
        orCrNumber: result.orNumber, // Return OR number as orCrNumber for compatibility
        issuedAt: result.orIssuedAt 
    };
}

// ============================================
// MVIR NUMBER OPERATIONS
// ============================================

/**
 * Generate a unique MVIR (Motor Vehicle Inspection Report) number
 * Format: MVIR-YYYY-XXXXXX (e.g., MVIR-2025-000001)
 * Uses database sequence for atomic increment
 * 
 * @returns {Promise<string>} The generated MVIR number
 */
async function generateMvirNumber() {
    const year = new Date().getFullYear();
    
    try {
        // Use database sequence for atomic increment
        // This prevents race conditions when multiple inspections happen simultaneously
        const result = await db.query(
            `SELECT nextval('mvir_number_seq') as seq_num`
        );
        
        const sequenceNumber = parseInt(result.rows[0].seq_num);
        
        // Format: MVIR-YYYY-XXXXXX (6 digits, zero-padded)
        const mvirNumber = `MVIR-${year}-${String(sequenceNumber).padStart(6, '0')}`;
        
        // Verify uniqueness (safety check - should never fail with sequence)
        const existingCheck = await db.query(
            'SELECT id FROM vehicles WHERE mvir_number = $1',
            [mvirNumber]
        );
        
        if (existingCheck.rows.length > 0) {
            // Extremely rare case - retry with next sequence number
            console.warn(`MVIR number collision detected: ${mvirNumber}. Retrying...`);
            return generateMvirNumber(); // Recursive retry
        }
        
        console.log(`[MVIR] Generated new number: ${mvirNumber}`);
        return mvirNumber;
        
    } catch (error) {
        if (error.message && error.message.includes('mvir_number_seq')) {
            throw new Error('MVIR number sequence not found. Run database migration to create mvir_number_seq sequence.');
        }
        throw error;
    }
}

/**
 * Assign MVIR number and inspection data to a vehicle
 * Updates the vehicle record with inspection information
 * 
 * @param {string} vehicleId - The vehicle UUID
 * @param {Object} inspectionData - Inspection data object
 * @param {string} inspectionData.inspectionResult - PASS, FAIL, PENDING
 * @param {string} inspectionData.roadworthinessStatus - ROADWORTHY, NOT_ROADWORTHY
 * @param {string} inspectionData.emissionCompliance - COMPLIANT, NON_COMPLIANT
 * @param {string} inspectionData.inspectionOfficer - Name of inspecting officer
 * @param {string} [inspectionData.inspectionNotes] - Optional inspection notes
 * @returns {Promise<{mvirNumber: string, inspectionDate: Date}>}
 */
async function assignMvirNumber(vehicleId, inspectionData) {
    const {
        inspectionResult,
        roadworthinessStatus,
        emissionCompliance,
        inspectionOfficer,
        inspectionNotes
    } = inspectionData;
    
    // Generate MVIR number
    const mvirNumber = await generateMvirNumber();
    const inspectionDate = new Date();
    
    // Update vehicle with inspection data
    await db.query(
        `UPDATE vehicles 
         SET mvir_number = $1,
             inspection_date = $2,
             inspection_result = $3,
             roadworthiness_status = $4,
             emission_compliance = $5,
             inspection_officer = $6,
             inspection_notes = $7,
             last_updated = CURRENT_TIMESTAMP
         WHERE id = $8`,
        [
            mvirNumber,
            inspectionDate,
            inspectionResult || 'PASS',
            roadworthinessStatus || 'ROADWORTHY',
            emissionCompliance || 'COMPLIANT',
            inspectionOfficer || 'LTO INSPECTION OFFICER',
            inspectionNotes || null,
            vehicleId
        ]
    );
    
    console.log(`[MVIR] Assigned MVIR: ${mvirNumber} to vehicle ${vehicleId}`);
    
    return {
        mvirNumber,
        inspectionDate
    };
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
    getRegistrationProgress,
    
    // OR/CR Number operations (new separate functions)
    generateOrNumber,
    generateCrNumber,
    assignOrAndCrNumbers,
    // Deprecated functions (kept for backward compatibility)
    generateOrCrNumber,
    assignOrCrNumber,
    
    // MVIR Number operations
    generateMvirNumber,
    assignMvirNumber
};

