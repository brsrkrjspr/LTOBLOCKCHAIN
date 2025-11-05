// TrustChain LTO - Health Check Routes
// Lightweight health monitoring for laptop deployment

const express = require('express');
const router = express.Router();
const monitoringService = require('../services/monitoringService');

// Basic health check
router.get('/', (req, res) => {
    try {
        const health = monitoringService.getHealthStatus();
        res.json(health);
    } catch (error) {
        res.status(500).json({
            status: 'error',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

// Database health check
router.get('/database', async (req, res) => {
    try {
        // Mock database health check
        // In a real implementation, this would check actual database connection
        res.json({
            status: 'healthy',
            database: 'connected',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            database: 'disconnected',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Blockchain health check
router.get('/blockchain', (req, res) => {
    try {
        // Mock blockchain health check
        res.json({
            status: 'healthy',
            blockchain: 'mock',
            mode: 'connected',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            blockchain: 'disconnected',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Storage health check
router.get('/storage', (req, res) => {
    try {
        // Mock storage health check
        res.json({
            status: 'healthy',
            storage: 'local',
            mode: 'connected',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            storage: 'disconnected',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Detailed health check
router.get('/detailed', (req, res) => {
    try {
        const health = monitoringService.getHealthStatus();
        const stats = monitoringService.getApplicationStats();
        const metrics = monitoringService.getMetricsSummary();

        res.json({
            health: health,
            stats: stats,
            metrics: metrics,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

module.exports = router;
