// TrustChain LTO - Admin Routes
// Enhanced admin statistics and management endpoints

const express = require('express');
const router = express.Router();
const db = require('../database/services');
const { authenticateToken } = require('../middleware/auth');
const { authorizeRole } = require('../middleware/authorize');

// Get enhanced admin statistics
router.get('/stats', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const dbModule = require('../database/db');
        
        // Get vehicle statistics
        const vehicleStats = await dbModule.query(
            `SELECT status, COUNT(*) as count 
             FROM vehicles 
             GROUP BY status`
        );
        
        const vehicles = {
            total: 0,
            submitted: 0,
            pending_blockchain: 0,
            registered: 0,
            approved: 0,
            rejected: 0
        };
        
        vehicleStats.rows.forEach(row => {
            vehicles.total += parseInt(row.count);
            const status = row.status.toLowerCase();
            if (vehicles.hasOwnProperty(status)) {
                vehicles[status] = parseInt(row.count);
            }
        });
        
        // Get transfer request statistics
        const transferStats = await dbModule.query(
            `SELECT status, COUNT(*) as count 
             FROM transfer_requests 
             GROUP BY status`
        );
        
        const transfers = {
            total: 0,
            pending: 0,
            reviewing: 0,
            approved: 0,
            rejected: 0,
            completed: 0,
            forwarded_to_hpg: 0
        };
        
        transferStats.rows.forEach(row => {
            transfers.total += parseInt(row.count);
            const status = row.status.toLowerCase();
            if (transfers.hasOwnProperty(status)) {
                transfers[status] = parseInt(row.count);
            }
        });
        
        // Get clearance request statistics
        const clearanceStats = await dbModule.query(
            `SELECT request_type, status, COUNT(*) as count 
             FROM clearance_requests 
             GROUP BY request_type, status`
        );
        
        const clearances = {
            total: 0,
            hpg: { total: 0, pending: 0, approved: 0, rejected: 0 },
            insurance: { total: 0, pending: 0, approved: 0, rejected: 0 },
            emission: { total: 0, pending: 0, approved: 0, rejected: 0 }
        };
        
        clearanceStats.rows.forEach(row => {
            clearances.total += parseInt(row.count);
            const type = row.request_type.toLowerCase();
            const status = row.status.toLowerCase();
            if (clearances[type]) {
                clearances[type].total += parseInt(row.count);
                if (clearances[type].hasOwnProperty(status)) {
                    clearances[type][status] = parseInt(row.count);
                }
            }
        });
        
        // Get user statistics
        const userStats = await dbModule.query(
            `SELECT role, COUNT(*) as count 
             FROM users 
             WHERE is_active = true
             GROUP BY role`
        );
        
        const users = {
            total: 0,
            admin: 0,
            vehicle_owner: 0,
            insurance_verifier: 0,
            emission_verifier: 0
        };
        
        userStats.rows.forEach(row => {
            users.total += parseInt(row.count);
            const role = row.role.toLowerCase();
            if (users.hasOwnProperty(role)) {
                users[role] = parseInt(row.count);
            }
        });
        
        // Get document statistics
        const documentStats = await dbModule.query(
            `SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN verified = true THEN 1 END) as verified,
                COUNT(CASE WHEN verified = false OR verified IS NULL THEN 1 END) as unverified
             FROM documents`
        );
        
        const documents = {
            total: parseInt(documentStats.rows[0].total || 0),
            verified: parseInt(documentStats.rows[0].verified || 0),
            unverified: parseInt(documentStats.rows[0].unverified || 0)
        };
        
        // Get recent activity (last 24 hours)
        const recentActivity = await dbModule.query(
            `SELECT COUNT(*) as count 
             FROM vehicle_history 
             WHERE performed_at >= NOW() - INTERVAL '24 hours'`
        );
        
        res.json({
            success: true,
            stats: {
                vehicles,
                transfers,
                clearances,
                users,
                documents,
                recentActivity: parseInt(recentActivity.rows[0].count || 0)
            },
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Get admin stats error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Get all clearance requests (for verification tracker)
router.get('/clearance-requests', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const dbModule = require('../database/db');
        
        // Get all clearance requests with vehicle info
        const result = await dbModule.query(`
            SELECT 
                cr.*,
                v.vin,
                v.plate_number,
                v.make,
                v.model,
                v.year,
                v.engine_number,
                v.chassis_number,
                u1.email as requested_by_email,
                u1.first_name || ' ' || u1.last_name as requested_by_name,
                u2.email as assigned_to_email
            FROM clearance_requests cr
            LEFT JOIN vehicles v ON cr.vehicle_id = v.id
            LEFT JOIN users u1 ON cr.requested_by = u1.id
            LEFT JOIN users u2 ON cr.assigned_to = u2.id
            ORDER BY cr.updated_at DESC, cr.created_at DESC
            LIMIT 100
        `);
        
        // Group by type
        const requests = result.rows;
        const grouped = {
            hpg: requests.filter(r => r.request_type === 'hpg'),
            insurance: requests.filter(r => r.request_type === 'insurance'),
            emission: requests.filter(r => r.request_type === 'emission')
        };
        
        // Count by status for each type
        const stats = {
            hpg: { pending: 0, approved: 0, rejected: 0, completed: 0 },
            insurance: { pending: 0, approved: 0, rejected: 0, completed: 0 },
            emission: { pending: 0, approved: 0, rejected: 0, completed: 0 }
        };
        
        requests.forEach(r => {
            const type = r.request_type;
            const status = (r.status || 'PENDING').toLowerCase();
            if (stats[type] && stats[type].hasOwnProperty(status)) {
                stats[type][status]++;
            }
        });
        
        res.json({
            success: true,
            requests: requests,
            grouped: grouped,
            stats: stats,
            total: requests.length
        });
        
    } catch (error) {
        console.error('Get clearance requests error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get clearance requests: ' + error.message
        });
    }
});

// Get notifications for admin
router.get('/notifications', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const notifications = await db.getNotificationsByUser(req.user.userId);
        
        res.json({
            success: true,
            notifications: notifications || [],
            unreadCount: (notifications || []).filter(n => !n.read).length
        });
        
    } catch (error) {
        console.error('Get admin notifications error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get notifications'
        });
    }
});

module.exports = router;

