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

module.exports = router;

