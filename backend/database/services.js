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
        `SELECT v.*, u.first_name || ' ' || u.last_name as owner_name, u.email as owner_email
         FROM vehicles v
         LEFT JOIN users u ON v.owner_id = u.id
         WHERE v.vin = $1`,
        [vin]
    );
    return result.rows[0] || null;
}

async function getVehicleById(id) {
    const result = await db.query(
        `SELECT v.*, u.first_name || ' ' || u.last_name as owner_name, u.email as owner_email
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
    const result = await db.query(
        `INSERT INTO vehicle_history (vehicle_id, action, description, performed_by, transaction_id, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [vehicleId, action, description, performedBy, transactionId, metadata ? JSON.stringify(metadata) : null]
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
    markNotificationAsRead
};

