// TrustChain LTO - Officer Activity Logger Service
// Logs officer activities for accountability and performance tracking

const db = require('../database/db');

/**
 * Log an officer activity
 * @param {Object} activityData - Activity details
 * @param {string} activityData.officerId - UUID of the officer
 * @param {string} activityData.activityType - Type of activity (registration, verification, transfer, inspection, clearance, unauthorized_access)
 * @param {string} activityData.entityType - Type of entity (vehicle, document, transfer_request, clearance_request, system)
 * @param {string} [activityData.entityId] - UUID of the entity (optional)
 * @param {string} activityData.action - Action performed (created, approved, rejected, verified, updated, deleted, denied)
 * @param {number} [activityData.durationSeconds] - Duration of activity in seconds (optional)
 * @param {string} [activityData.notes] - Additional notes (optional)
 * @param {string} [activityData.ipAddress] - IP address of the officer (optional)
 * @param {string} [activityData.userAgent] - User agent string (optional)
 * @param {string} [activityData.sessionId] - Session ID (optional)
 * @param {Object} [activityData.metadata] - Additional metadata (optional)
 * @returns {Promise<Object>} Created activity log entry
 */
async function logOfficerActivity(activityData) {
    const {
        officerId,
        activityType,
        entityType,
        entityId = null,
        action,
        durationSeconds = null,
        notes = null,
        ipAddress = null,
        userAgent = null,
        sessionId = null,
        metadata = {}
    } = activityData;

    // Validate required fields
    if (!officerId || !activityType || !entityType || !action) {
        console.error('Missing required fields for activity logging:', {
            officerId: !!officerId,
            activityType: !!activityType,
            entityType: !!entityType,
            action: !!action
        });
        return null;
    }

    try {
        const result = await db.query(
            `INSERT INTO officer_activity_log 
             (officer_id, activity_type, entity_type, entity_id, action, 
              duration_seconds, notes, ip_address, user_agent, session_id, metadata)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             RETURNING *`,
            [
                officerId,
                activityType,
                entityType,
                entityId,
                action,
                durationSeconds,
                notes,
                ipAddress,
                userAgent,
                sessionId,
                metadata ? JSON.stringify(metadata) : '{}'
            ]
        );

        return result.rows[0];
    } catch (error) {
        console.error('Failed to log officer activity:', error);
        // Don't throw - logging failure shouldn't break the application
        return null;
    }
}

/**
 * Get activity logs for a specific officer
 * @param {string} officerId - UUID of the officer
 * @param {Object} options - Query options
 * @param {number} [options.limit=50] - Maximum number of records
 * @param {Date} [options.startDate] - Start date filter
 * @param {Date} [options.endDate] - End date filter
 * @param {string} [options.activityType] - Filter by activity type
 * @param {string} [options.action] - Filter by action
 * @returns {Promise<Array>} Array of activity log entries
 */
async function getOfficerActivities(officerId, options = {}) {
    const {
        limit = 50,
        startDate = null,
        endDate = null,
        activityType = null,
        action = null
    } = options;

    try {
        let query = `
            SELECT 
                oal.*,
                u.first_name || ' ' || u.last_name as officer_name,
                u.email as officer_email,
                u.employee_id,
                u.badge_number,
                u.department,
                u.branch_office
            FROM officer_activity_log oal
            LEFT JOIN users u ON oal.officer_id = u.id
            WHERE oal.officer_id = $1
        `;
        const params = [officerId];
        let paramCount = 1;

        if (startDate) {
            paramCount++;
            query += ` AND oal.created_at >= $${paramCount}`;
            params.push(startDate);
        }

        if (endDate) {
            paramCount++;
            query += ` AND oal.created_at <= $${paramCount}`;
            params.push(endDate);
        }

        if (activityType) {
            paramCount++;
            query += ` AND oal.activity_type = $${paramCount}`;
            params.push(activityType);
        }

        if (action) {
            paramCount++;
            query += ` AND oal.action = $${paramCount}`;
            params.push(action);
        }

        query += ` ORDER BY oal.created_at DESC LIMIT $${paramCount + 1}`;
        params.push(limit);

        const result = await db.query(query, params);
        return result.rows;
    } catch (error) {
        console.error('Failed to get officer activities:', error);
        throw error;
    }
}

/**
 * Get activity statistics for an officer
 * @param {string} officerId - UUID of the officer
 * @param {Object} options - Query options
 * @param {Date} [options.startDate] - Start date filter
 * @param {Date} [options.endDate] - End date filter
 * @returns {Promise<Object>} Activity statistics
 */
async function getOfficerActivityStats(officerId, options = {}) {
    const {
        startDate = null,
        endDate = null
    } = options;

    try {
        let query = `
            SELECT 
                COUNT(*) as total_activities,
                COUNT(CASE WHEN DATE(created_at) = CURRENT_DATE THEN 1 END) as today_activities,
                COUNT(CASE WHEN DATE_TRUNC('week', created_at) = DATE_TRUNC('week', CURRENT_DATE) THEN 1 END) as week_activities,
                COUNT(CASE WHEN DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE) THEN 1 END) as month_activities,
                AVG(duration_seconds) as avg_duration_seconds,
                COUNT(DISTINCT activity_type) as activity_types_count,
                COUNT(CASE WHEN activity_type = 'registration' THEN 1 END) as registration_count,
                COUNT(CASE WHEN activity_type = 'verification' THEN 1 END) as verification_count,
                COUNT(CASE WHEN activity_type = 'transfer' THEN 1 END) as transfer_count,
                COUNT(CASE WHEN activity_type = 'inspection' THEN 1 END) as inspection_count,
                COUNT(CASE WHEN activity_type = 'clearance' THEN 1 END) as clearance_count,
                COUNT(CASE WHEN activity_type = 'unauthorized_access' THEN 1 END) as unauthorized_attempts,
                MAX(created_at) as last_activity_at
            FROM officer_activity_log
            WHERE officer_id = $1
        `;
        const params = [officerId];
        let paramCount = 1;

        if (startDate) {
            paramCount++;
            query += ` AND created_at >= $${paramCount}`;
            params.push(startDate);
        }

        if (endDate) {
            paramCount++;
            query += ` AND created_at <= $${paramCount}`;
            params.push(endDate);
        }

        const result = await db.query(query, params);
        return result.rows[0];
    } catch (error) {
        console.error('Failed to get officer activity stats:', error);
        throw error;
    }
}

/**
 * Get all officer activities with filtering
 * @param {Object} filters - Filter options
 * @param {string} [filters.officerId] - Filter by officer ID
 * @param {string} [filters.department] - Filter by department
 * @param {string} [filters.branchOffice] - Filter by branch office
 * @param {string} [filters.activityType] - Filter by activity type
 * @param {string} [filters.action] - Filter by action
 * @param {Date} [filters.startDate] - Start date filter
 * @param {Date} [filters.endDate] - End date filter
 * @param {number} [filters.limit=100] - Maximum number of records
 * @returns {Promise<Array>} Array of activity log entries
 */
async function getAllOfficerActivities(filters = {}) {
    const {
        officerId = null,
        department = null,
        branchOffice = null,
        activityType = null,
        action = null,
        startDate = null,
        endDate = null,
        limit = 100
    } = filters;

    try {
        let query = `
            SELECT 
                oal.*,
                u.first_name || ' ' || u.last_name as officer_name,
                u.email as officer_email,
                u.employee_id,
                u.badge_number,
                u.department,
                u.branch_office,
                u.position
            FROM officer_activity_log oal
            LEFT JOIN users u ON oal.officer_id = u.id
            WHERE 1=1
        `;
        const params = [];
        let paramCount = 0;

        if (officerId) {
            paramCount++;
            query += ` AND oal.officer_id = $${paramCount}`;
            params.push(officerId);
        }

        if (department) {
            paramCount++;
            query += ` AND u.department = $${paramCount}`;
            params.push(department);
        }

        if (branchOffice) {
            paramCount++;
            query += ` AND u.branch_office = $${paramCount}`;
            params.push(branchOffice);
        }

        if (activityType) {
            paramCount++;
            query += ` AND oal.activity_type = $${paramCount}`;
            params.push(activityType);
        }

        if (action) {
            paramCount++;
            query += ` AND oal.action = $${paramCount}`;
            params.push(action);
        }

        if (startDate) {
            paramCount++;
            query += ` AND oal.created_at >= $${paramCount}`;
            params.push(startDate);
        }

        if (endDate) {
            paramCount++;
            query += ` AND oal.created_at <= $${paramCount}`;
            params.push(endDate);
        }

        query += ` ORDER BY oal.created_at DESC LIMIT $${paramCount + 1}`;
        params.push(limit);

        const result = await db.query(query, params);
        return result.rows;
    } catch (error) {
        console.error('Failed to get all officer activities:', error);
        throw error;
    }
}

/**
 * Get officer performance metrics
 * @param {Object} filters - Filter options
 * @param {string} [filters.officerId] - Filter by officer ID
 * @param {string} [filters.department] - Filter by department
 * @param {string} [filters.branchOffice] - Filter by branch office
 * @param {string} [filters.role] - Filter by role
 * @returns {Promise<Array>} Array of officer performance metrics
 */
async function getOfficerPerformanceMetrics(filters = {}) {
    const {
        officerId = null,
        department = null,
        branchOffice = null,
        role = null
    } = filters;

    try {
        let query = `SELECT * FROM officer_performance_metrics WHERE 1=1`;
        const params = [];
        let paramCount = 0;

        if (officerId) {
            paramCount++;
            query += ` AND officer_id = $${paramCount}`;
            params.push(officerId);
        }

        if (department) {
            paramCount++;
            query += ` AND department = $${paramCount}`;
            params.push(department);
        }

        if (branchOffice) {
            paramCount++;
            query += ` AND branch_office = $${paramCount}`;
            params.push(branchOffice);
        }

        if (role) {
            paramCount++;
            query += ` AND officer_role = $${paramCount}`;
            params.push(role);
        }

        query += ` ORDER BY total_activities DESC`;

        const result = await db.query(query, params);
        return result.rows;
    } catch (error) {
        console.error('Failed to get officer performance metrics:', error);
        throw error;
    }
}

module.exports = {
    logOfficerActivity,
    getOfficerActivities,
    getOfficerActivityStats,
    getAllOfficerActivities,
    getOfficerPerformanceMetrics
};
