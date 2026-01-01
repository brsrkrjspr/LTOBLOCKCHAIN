// TrustChain: Blockchain-based Vehicle Registration System
// Main server file for LTO Lipa City

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy (needed for reverse proxy/load balancer forwarding)
// Configure to trust only the first proxy (for correct IP detection)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            scriptSrcAttr: ["'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:", "http://localhost:8080", "blob:"],
            connectSrc: ["'self'", "https://ltoblockchain.duckdns.org"],
            fontSrc: ["'self'", "https:", "data:"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'self'", "blob:"], // Allow iframes from same origin and blob URLs
        },
    },
}));

// Debug: Log CSP configuration on startup
console.log('🔒 CSP Configuration:');
console.log('   imgSrc includes: blob:');
console.log('   frameSrc includes: blob:');

// Test endpoint to verify CSP headers
app.get('/api/test-csp', (req, res) => {
    res.json({
        message: 'CSP test endpoint',
        headers: {
            'Content-Security-Policy': res.getHeader('Content-Security-Policy') || 'Not set',
            'imgSrc': 'Should include: blob:'
        },
        note: 'Check Response Headers in browser DevTools to see actual CSP'
    });
});
app.use(cors({
    origin: process.env.FRONTEND_URL || (process.env.NODE_ENV === 'production' 
        ? 'https://ltoblockchain.duckdns.org' 
        : 'http://localhost:3001'),
    credentials: true
}));

// Rate limiting - more lenient for development
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // limit each IP to 1000 requests per windowMs (increased for development)
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    // Use a custom key generator that works with trust proxy
    keyGenerator: (req) => {
        // Use X-Forwarded-For header if available (from reverse proxy/load balancer)
        // Otherwise fall back to IP address
        return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || req.socket.remoteAddress;
    },
    skip: (req) => {
        // Skip rate limiting for health checks
        return req.path === '/api/health';
    }
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files - serve HTML files from root directory
app.use(express.static(path.join(__dirname)));

// API Routes
app.use('/api/auth', require('./backend/routes/auth'));
app.use('/api/vehicles', require('./backend/routes/vehicles'));
app.use('/api/documents', require('./backend/routes/documents'));
app.use('/api/blockchain', require('./backend/routes/blockchain'));
app.use('/api/ledger', require('./backend/routes/ledger'));
app.use('/api/notifications', require('./backend/routes/notifications'));
app.use('/api/lto', require('./backend/routes/lto'));
app.use('/api/hpg', require('./backend/routes/hpg'));
app.use('/api/insurance', require('./backend/routes/insurance'));
app.use('/api/emission', require('./backend/routes/emission'));
app.use('/api/vehicles/transfer', require('./backend/routes/transfer'));
app.use('/api/admin', require('./backend/routes/admin'));
app.use('/api/integrity', require('./backend/routes/integrity'));

// Laptop-optimized routes
app.use('/api/health', require('./backend/routes/health'));
app.use('/api/monitoring', require('./backend/routes/monitoring'));

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        message: 'TrustChain LTO System is running',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Serve HTML files directly
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/registration-wizard', (req, res) => {
    res.sendFile(path.join(__dirname, 'registration-wizard.html'));
});

app.get('/owner-dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'owner-dashboard.html'));
});

app.get('/admin-dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin-dashboard.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login-signup.html'));
});

app.get('/search', (req, res) => {
    res.sendFile(path.join(__dirname, 'search.html'));
});

app.get('/verifier-dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'verifier-dashboard.html'));
});

app.get('/insurance-verifier-dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'insurance-verifier-dashboard.html'));
});

app.get('/document-viewer', (req, res) => {
    res.sendFile(path.join(__dirname, 'document-viewer.html'));
});

// Route for verify page with transaction ID
// Only match if it's a valid transaction ID (long hex string, no file extension)
// Verify route - accepts UUIDs, hex strings, and other transaction ID formats
app.get('/verify/:transactionId', (req, res) => {
    // Validate transaction ID is not empty and doesn't contain path traversal
    const transactionId = req.params.transactionId;
    if (!transactionId || transactionId.includes('..') || transactionId.includes('/')) {
        return res.status(400).send('Invalid transaction ID');
    }
    res.sendFile(path.join(__dirname, 'verify.html'));
});

app.get('/admin-blockchain-viewer', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin-blockchain-viewer.html'));
});

app.get('/public-transaction-viewer', (req, res) => {
    res.sendFile(path.join(__dirname, 'public-transaction-viewer.html'));
});

app.get('/demo-workflow', (req, res) => {
    res.sendFile(path.join(__dirname, 'demo-workflow.html'));
});

app.get('/login-signup', (req, res) => {
    res.sendFile(path.join(__dirname, 'login-signup.html'));
});

// Serve React app for all other routes (fallback)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// Initialize storage service on startup (non-blocking)
const storageService = require('./backend/services/storageService');
storageService.initialize().then(result => {
    console.log(`📦 Storage service initialized: ${result.mode} mode`);
    if (process.env.STORAGE_MODE === 'ipfs' && result.mode !== 'ipfs') {
        console.error('❌ WARNING: STORAGE_MODE=ipfs but storage service initialized in', result.mode, 'mode');
    }
}).catch(error => {
    console.error('❌ Storage service initialization failed:', error.message);
    if (process.env.STORAGE_MODE === 'ipfs') {
        console.error('❌ CRITICAL: IPFS mode required but initialization failed. Documents will fail to upload.');
    }
});

// Start server
app.listen(PORT, () => {
    const frontendUrl = process.env.FRONTEND_URL || (process.env.NODE_ENV === 'production' 
        ? 'https://ltoblockchain.duckdns.org' 
        : `http://localhost:${PORT}`);
    const apiUrl = process.env.FRONTEND_URL 
        ? `${process.env.FRONTEND_URL}/api`
        : (process.env.NODE_ENV === 'production' 
            ? 'https://ltoblockchain.duckdns.org/api'
            : `http://localhost:${PORT}/api`);
    
    console.log(`🚀 TrustChain LTO System running on port ${PORT}`);
    console.log(`📁 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 API Base URL: ${apiUrl}`);
    console.log(`🌐 Frontend URL: ${frontendUrl}`);
    console.log(`📦 Storage Mode: ${process.env.STORAGE_MODE || 'auto'}`);
    console.log(`⛓️  Blockchain Mode: ${process.env.BLOCKCHAIN_MODE || 'fabric'} (Fabric-only, no fallbacks)`);
    
    // Initialize scheduled tasks
    initializeScheduledTasks();
});

// Initialize scheduled tasks (expiry notifications, etc.)
function initializeScheduledTasks() {
    // Only run scheduled tasks in production or if explicitly enabled
    if (process.env.NODE_ENV === 'production' || process.env.ENABLE_SCHEDULED_TASKS === 'true') {
        console.log('⏰ Initializing scheduled tasks...');
        
        // Load expiry service
        const expiryService = require('./backend/services/expiryService');
        
        // Run expiry check immediately on startup (after 30 seconds to let DB connect)
        setTimeout(() => {
            console.log('🔔 Running initial expiry notification check...');
            expiryService.checkExpiringRegistrations()
                .then(results => {
                    console.log(`✅ Initial expiry check complete: ${results.notificationsSent} notifications sent`);
                })
                .catch(error => {
                    console.error('❌ Error in initial expiry check:', error);
                });
        }, 30000); // 30 seconds delay
        
        // Schedule daily expiry check (runs at 9:00 AM every day)
        // Calculate milliseconds until next 9:00 AM
        const now = new Date();
        const nextCheck = new Date();
        nextCheck.setHours(9, 0, 0, 0);
        if (nextCheck <= now) {
            nextCheck.setDate(nextCheck.getDate() + 1); // Move to tomorrow if already past 9 AM
        }
        const msUntilNextCheck = nextCheck - now;
        
        console.log(`⏰ Next expiry check scheduled for: ${nextCheck.toLocaleString()}`);
        
        // Set up interval to run daily at 9:00 AM
        setInterval(() => {
            const checkTime = new Date();
            const currentHour = checkTime.getHours();
            
            // Only run if it's around 9 AM (between 9:00 and 9:59)
            if (currentHour === 9) {
                console.log('🔔 Running scheduled expiry notification check...');
                expiryService.checkExpiringRegistrations()
                    .then(results => {
                        console.log(`✅ Scheduled expiry check complete: ${results.notificationsSent} notifications sent`);
                    })
                    .catch(error => {
                        console.error('❌ Error in scheduled expiry check:', error);
                    });
            }
        }, 60 * 60 * 1000); // Check every hour to catch 9 AM
        
        console.log('✅ Scheduled tasks initialized');
    } else {
        console.log('⏰ Scheduled tasks disabled (set ENABLE_SCHEDULED_TASKS=true to enable)');
    }
}

module.exports = app;
