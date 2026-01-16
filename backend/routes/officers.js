// TrustChain LTO - Officer Management Routes
// Routes for officer performance monitoring, activity logs, and management

const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authenticateToken } = require('../middleware/auth');
const { authorizePermission } = require('../middleware/authorize');
const {
    getOfficerActivities,
    getOfficerActivityStats,
    getAllOfficerActivities,
    getOfficerPerformanceMetrics
} = require('../services/activityLogger');

// ============================================
// OFFICER PERFORMANCE METRICS
// ============================================

/**
 * GET /api/officers/performance
 * Get performance metrics for all officers or filtered set
 * Permissions: report.generate, report.view_all, report.view_team
 */
router.get('/performance',
    authenticateToken,
    authorizePermission('report.generate'),
    async (req, res) => {
        try {
            const {
                officerId,
                department,
                branchOffice,
                role
            } = req.query;

            const metrics = await getOfficerPerformanceMetrics({
                officerId,
                department,
                branchOffice,
                role
            });

            res.json({
                success: true,
                count: metrics.length,
                metrics: metrics,
                filters: { officerId, department, branchOffice, role }
            });
        } catch (error) {
            console.error('Officer performance metrics error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve officer performance metrics'
            });
        }
    }
);

/**
 * GET /api/officers/performance/:officerId
 * Get detailed performance metrics for a specific officer
 * Permissions: report.generate, report.view_all, report.view_team
 */
router.get('/performance/:officerId',
    authenticateToken,
    authorizePermission('report.generate'),
    async (req, res) => {
        try {
            const { officerId } = req.params;

            const metrics = await getOfficerPerformanceMetrics({ officerId });

            if (metrics.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Officer not found or no performance data available'
                });
            }

            res.json({
                success: true,
                officer: metrics[0]
            });
        } catch (error) {
            console.error('Officer performance detail error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve officer performance details'
            });
        }
    }
);

// ============================================
// OFFICER ACTIVITY LOGS
// ============================================

/**
 * GET /api/officers/activities
 * Get activity logs with filtering
 * Permissions: audit.view_all, audit.view_team
 */
router.get('/activities',
    authenticateToken,
    authorizePermission('audit.view_all'),
    async (req, res) => {
        try {
            const {
                officerId,
                department,
                branchOffice,
                activityType,
                action,
                startDate,
                endDate,
                limit
            } = req.query;

            const activities = await getAllOfficerActivities({
                officerId,
                department,
                branchOffice,
                activityType,
                action,
                startDate: startDate ? new Date(startDate) : null,
                endDate: endDate ? new Date(endDate) : null,
                limit: limit ? parseInt(limit) : 100
            });

            res.json({
                success: true,
                count: activities.length,
                activities: activities,
                filters: { officerId, department, branchOffice, activityType, action, startDate, endDate }
            });
        } catch (error) {
            console.error('Officer activities error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve officer activities'
            });
        }
    }
);

/**
 * GET /api/officers/:officerId/activities
 * Get activity logs for a specific officer
 * Permissions: audit.view_all, audit.view_team
 */
router.get('/:officerId/activities',
    authenticateToken,
    authorizePermission('audit.view_all'),
    async (req, res) => {
        try {
            const { officerId } = req.params;
            const {
                activityType,
                action,
                startDate,
                endDate,
                limit
            } = req.query;

            const activities = await getOfficerActivities(officerId, {
                activityType,
                action,
                startDate: startDate ? new Date(startDate) : null,
                endDate: endDate ? new Date(endDate) : null,
                limit: limit ? parseInt(limit) : 50
            });

            res.json({
                success: true,
                officer_id: officerId,
                count: activities.length,
                activities: activities,
                filters: { activityType, action, startDate, endDate }
            });
        } catch (error) {
            console.error('Officer activity log error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve officer activity log'
            });
        }
    }
);

/**
 * GET /api/officers/:officerId/stats
 * Get activity statistics for a specific officer
 * Permissions: report.generate, report.view_all, report.view_team
 */
router.get('/:officerId/stats',
    authenticateToken,
    authorizePermission('report.generate'),
    async (req, res) => {
        try {
            const { officerId } = req.params;
            const { startDate, endDate } = req.query;

            const stats = await getOfficerActivityStats(officerId, {
                startDate: startDate ? new Date(startDate) : null,
                endDate: endDate ? new Date(endDate) : null
            });

            res.json({
                success: true,
                officer_id: officerId,
                stats: stats,
                filters: { startDate, endDate }
            });
        } catch (error) {
            console.error('Officer stats error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve officer statistics'
            });
        }
    }
);

// ============================================
// OFFICER INFORMATION
// ============================================

/**
 * GET /api/officers
 * Get list of all officers
 * Permissions: user.view_all
 */
router.get('/',
    authenticateToken,
    authorizePermission('user.view_all'),
    async (req, res) => {
        try {
            const { department, branchOffice, role, isActive } = req.query;

            let query = `
                SELECT 
                    id,
                    email,
                    first_name,
                    last_name,
                    role,
                    employee_id,
                    badge_number,
                    department,
                    branch_office,
                    position,
                    hire_date,
                    organization,
                    phone,
                    is_active,
                    email_verified,
                    last_login,
                    created_at
                FROM users
                WHERE role IN ('lto_officer', 'lto_supervisor', 'lto_admin', 'staff', 'admin')
            `;
            const params = [];
            let paramCount = 0;

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
                query += ` AND role = $${paramCount}`;
                params.push(role);
            }

            if (isActive !== undefined) {
                paramCount++;
                query += ` AND is_active = $${paramCount}`;
                params.push(isActive === 'true');
            }

            query += ` ORDER BY department, branch_office, last_name, first_name`;

            const result = await db.query(query, params);

            res.json({
                success: true,
                count: result.rows.length,
                officers: result.rows,
                filters: { department, branchOffice, role, isActive }
            });
        } catch (error) {
            console.error('Officers list error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve officers list'
            });
        }
    }
);

/**
 * GET /api/officers/:officerId
 * Get detailed information for a specific officer
 * Permissions: user.view_all
 */
router.get('/:officerId',
    authenticateToken,
    authorizePermission('user.view_all'),
    async (req, res) => {
        try {
            const { officerId } = req.params;

            const result = await db.query(
                `SELECT 
                    id,
                    email,
                    first_name,
                    last_name,
                    role,
                    employee_id,
                    badge_number,
                    department,
                    branch_office,
                    position,
                    hire_date,
                    organization,
                    phone,
                    address,
                    is_active,
                    email_verified,
                    two_factor_enabled,
                    last_login,
                    created_at,
                    updated_at,
                    supervisor_id
                FROM users
                WHERE id = $1 
                AND role IN ('lto_officer', 'lto_supervisor', 'lto_admin', 'staff', 'admin')`,
                [officerId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Officer not found'
                });
            }

            // Get supervisor info if exists
            const officer = result.rows[0];
            if (officer.supervisor_id) {
                const supervisorResult = await db.query(
                    `SELECT id, email, first_name, last_name, employee_id, badge_number
                     FROM users WHERE id = $1`,
                    [officer.supervisor_id]
                );
                if (supervisorResult.rows.length > 0) {
                    officer.supervisor = supervisorResult.rows[0];
                }
            }

            res.json({
                success: true,
                officer: officer
            });
        } catch (error) {
            console.error('Officer detail error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve officer details'
            });
        }
    }
);

// ============================================
// DEPARTMENT AND BRANCH STATISTICS
// ============================================

/**
 * GET /api/officers/stats/departments
 * Get statistics by department
 * Permissions: report.generate
 */
router.get('/stats/departments',
    authenticateToken,
    authorizePermission('report.generate'),
    async (req, res) => {
        try {
            const result = await db.query(`
                SELECT 
                    department,
                    COUNT(*) as officer_count,
                    COUNT(CASE WHEN is_active = true THEN 1 END) as active_count,
                    COUNT(CASE WHEN role = 'lto_officer' THEN 1 END) as officers,
                    COUNT(CASE WHEN role = 'lto_supervisor' THEN 1 END) as supervisors,
                    COUNT(CASE WHEN role IN ('lto_admin', 'admin') THEN 1 END) as admins
                FROM users
                WHERE role IN ('lto_officer', 'lto_supervisor', 'lto_admin', 'staff', 'admin')
                AND department IS NOT NULL
                GROUP BY department
                ORDER BY officer_count DESC
            `);

            res.json({
                success: true,
                departments: result.rows
            });
        } catch (error) {
            console.error('Department stats error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve department statistics'
            });
        }
    }
);

/**
 * GET /api/officers/stats/branches
 * Get statistics by branch office
 * Permissions: report.generate
 */
router.get('/stats/branches',
    authenticateToken,
    authorizePermission('report.generate'),
    async (req, res) => {
        try {
            const result = await db.query(`
                SELECT 
                    branch_office,
                    COUNT(*) as officer_count,
                    COUNT(CASE WHEN is_active = true THEN 1 END) as active_count,
                    COUNT(CASE WHEN role = 'lto_officer' THEN 1 END) as officers,
                    COUNT(CASE WHEN role = 'lto_supervisor' THEN 1 END) as supervisors
                FROM users
                WHERE role IN ('lto_officer', 'lto_supervisor', 'lto_admin', 'staff', 'admin')
                AND branch_office IS NOT NULL
                GROUP BY branch_office
                ORDER BY officer_count DESC
            `);

            res.json({
                success: true,
                branches: result.rows
            });
        } catch (error) {
            console.error('Branch stats error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve branch statistics'
            });
        }
    }
);

module.exports = router;
