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

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            scriptSrcAttr: ["'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'", "https:", "data:"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
        },
    },
}));
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
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
    res.sendFile(path.join(__dirname, 'login.html'));
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

app.get('/admin-blockchain-viewer', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin-blockchain-viewer.html'));
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

// Start server
app.listen(PORT, () => {
    console.log(`🚀 TrustChain LTO System running on port ${PORT}`);
    console.log(`📁 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 API Base URL: http://localhost:${PORT}/api`);
    console.log(`🌐 Frontend URL: http://localhost:${PORT}`);
});

module.exports = app;
