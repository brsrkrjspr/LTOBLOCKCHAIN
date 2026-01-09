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
            blockchain: 'fabric',
            mode: status.isConnected ? 'connected' : 'disconnected',
            type: 'Hyperledger Fabric',
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

// Email verification health check
router.get('/email-verification', async (req, res) => {
    try {
        const db = require('../database/db');
        const isConnected = await db.testConnection();
        
        if (!isConnected) {
            return res.status(500).json({
                status: 'error',
                emailVerification: 'unknown',
                error: 'Database not connected',
                timestamp: new Date().toISOString()
            });
        }
        
        // Check if email_verification_tokens table exists
        const tableCheck = await db.query(
            `SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'email_verification_tokens'
            )`
        );
        const tableExists = tableCheck.rows[0].exists;
        
        // Check if email_verified column exists
        const columnCheck = await db.query(
            `SELECT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_name = 'users' 
                AND column_name = 'email_verified'
            )`
        );
        const columnExists = columnCheck.rows[0].exists;
        
        // Get EMAIL_VERIFICATION_ENABLED status from global
        const emailVerificationEnabled = global.EMAIL_VERIFICATION_ENABLED || false;
        
        // Determine overall status
        const isHealthy = tableExists && columnExists && emailVerificationEnabled;
        
        res.json({
            status: isHealthy ? 'healthy' : 'unhealthy',
            emailVerification: {
                enabled: emailVerificationEnabled,
                tableExists: tableExists,
                columnExists: columnExists,
                status: isHealthy ? 'operational' : 'not_operational'
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            emailVerification: 'unknown',
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
        
        // Check email verification status
        let emailVerificationStatus = {
            enabled: false,
            tableExists: false,
            columnExists: false,
            status: 'unknown'
        };
        
        if (dbConnected) {
            try {
                const tableCheck = await db.query(
                    `SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = 'public' 
                        AND table_name = 'email_verification_tokens'
                    )`
                );
                const columnCheck = await db.query(
                    `SELECT EXISTS (
                        SELECT FROM information_schema.columns 
                        WHERE table_name = 'users' 
                        AND column_name = 'email_verified'
                    )`
                );
                
                emailVerificationStatus = {
                    enabled: global.EMAIL_VERIFICATION_ENABLED || false,
                    tableExists: tableCheck.rows[0].exists,
                    columnExists: columnCheck.rows[0].exists,
                    status: (global.EMAIL_VERIFICATION_ENABLED && tableCheck.rows[0].exists && columnCheck.rows[0].exists) ? 'operational' : 'not_operational'
                };
            } catch (error) {
                // Silently fail - email verification check is optional
            }
        }

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
                    type: 'Hyperledger Fabric',
                    mode: 'fabric',
                    network: fabricStatus.network,
                    channel: fabricStatus.channel
                },
                storage: {
                    status: (storageMode === 'ipfs' && ipfsAvailable) || storageMode === 'local' ? 'connected' : 'disconnected',
                    type: storageMode === 'ipfs' ? 'IPFS' : 'Local File Storage',
                    mode: storageMode,
                    ipfsAvailable: ipfsAvailable
                },
                emailVerification: emailVerificationStatus
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
