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
        const db = require('../database/db');
        const isConnected = await db.testConnection();
        
        res.json({
            status: isConnected ? 'healthy' : 'unhealthy',
            database: isConnected ? 'connected' : 'disconnected',
            type: 'postgresql',
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
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
router.get('/blockchain', async (req, res) => {
    try {
        const fabricService = require('../services/optimizedFabricService');
        const status = fabricService.getStatus();
        
        res.json({
            status: status.isConnected ? 'healthy' : 'unhealthy',
            blockchain: status.mode === 'fabric' ? 'fabric' : 'mock',
            mode: status.isConnected ? 'connected' : 'disconnected',
            type: status.mode === 'fabric' ? 'Hyperledger Fabric' : 'Mock Blockchain',
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
router.get('/storage', async (req, res) => {
    try {
        const storageService = require('../services/storageService');
        const mode = storageService.getStorageMode();
        const ipfsService = require('../services/ipfsService');
        const ipfsAvailable = ipfsService.isAvailable();
        
        res.json({
            status: 'healthy',
            storage: mode,
            mode: mode === 'ipfs' && ipfsAvailable ? 'connected' : mode === 'local' ? 'connected' : 'disconnected',
            type: mode === 'ipfs' ? 'IPFS' : 'Local File Storage',
            ipfsAvailable: ipfsAvailable,
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
router.get('/detailed', async (req, res) => {
    try {
        const health = monitoringService.getHealthStatus();
        const stats = monitoringService.getApplicationStats();
        const metrics = monitoringService.getMetricsSummary();
        
        // Get service statuses
        const db = require('../database/db');
        const dbConnected = await db.testConnection();
        
        const fabricService = require('../services/optimizedFabricService');
        const fabricStatus = fabricService.getStatus();
        
        const storageService = require('../services/storageService');
        const storageMode = storageService.getStorageMode();
        const ipfsService = require('../services/ipfsService');
        const ipfsAvailable = ipfsService.isAvailable();

        res.json({
            status: 'healthy',
            health: health,
            stats: stats,
            metrics: metrics,
            services: {
                database: {
                    status: dbConnected ? 'connected' : 'disconnected',
                    type: 'postgresql',
                    host: process.env.DB_HOST || 'localhost',
                    port: process.env.DB_PORT || 5432
                },
                blockchain: {
                    status: fabricStatus.isConnected ? 'connected' : 'disconnected',
                    type: fabricStatus.mode === 'fabric' ? 'Hyperledger Fabric' : 'Mock Blockchain',
                    mode: fabricStatus.mode,
                    network: fabricStatus.network,
                    channel: fabricStatus.channel
                },
                storage: {
                    status: (storageMode === 'ipfs' && ipfsAvailable) || storageMode === 'local' ? 'connected' : 'disconnected',
                    type: storageMode === 'ipfs' ? 'IPFS' : 'Local File Storage',
                    mode: storageMode,
                    ipfsAvailable: ipfsAvailable
                }
            },
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
