// TrustChain LTO - Monitoring Routes
// Lightweight monitoring endpoints for laptop deployment

const express = require('express');
const router = express.Router();
const monitoringService = require('../services/monitoringService');
const { authenticateToken } = require('../middleware/auth');
const { authorizeRole } = require('../middleware/authorize');

// Get system metrics (admin only)
router.get('/metrics', authenticateToken, authorizeRole(['admin']), (req, res) => {
    try {
        const metrics = monitoringService.getMetricsSummary();
        res.json({
            success: true,
            metrics: metrics,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Get application statistics (admin only)
router.get('/stats', authenticateToken, authorizeRole(['admin']), (req, res) => {
    try {
        const stats = monitoringService.getApplicationStats();
        res.json({
            success: true,
            stats: stats,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Get recent logs (admin only)
router.get('/logs', authenticateToken, authorizeRole(['admin']), (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const logs = monitoringService.getRecentLogs(limit);
        
        res.json({
            success: true,
            logs: logs,
            count: logs.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Get health status (admin only)
router.get('/health', authenticateToken, authorizeRole(['admin']), (req, res) => {
    try {
        const health = monitoringService.getHealthStatus();
        res.json({
            success: true,
            health: health,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Cleanup old logs (admin only)
router.post('/cleanup', authenticateToken, authorizeRole(['admin']), (req, res) => {
    try {
        const daysToKeep = parseInt(req.body.daysToKeep) || 7;
        const result = monitoringService.cleanupOldLogs(daysToKeep);
        
        res.json({
            success: true,
            result: result,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Log custom event (admin only)
router.post('/log', authenticateToken, authorizeRole(['admin']), (req, res) => {
    try {
        const { level, message, metadata } = req.body;
        
        if (!level || !message) {
            return res.status(400).json({
                success: false,
                error: 'Level and message are required',
                timestamp: new Date().toISOString()
            });
        }

        monitoringService.log(level, message, metadata || {});
        
        res.json({
            success: true,
            message: 'Log entry created',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

module.exports = router;
