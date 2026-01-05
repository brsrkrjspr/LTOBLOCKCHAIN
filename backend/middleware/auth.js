// TrustChain Authentication Middleware
const jwt = require('jsonwebtoken');
const { isBlacklistedByJTI } = require('../config/blacklist');
const { verifyAccessToken } = require('../config/jwt');

// Validate required environment variables
if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required. Set it in .env file.');
}

// Middleware to authenticate JWT token
async function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            success: false,
            error: 'Access token required'
        });
    }

    // Block demo tokens in production mode
    if (process.env.NODE_ENV === 'production' && token.startsWith('demo-token-')) {
        return res.status(403).json({
            success: false,
            error: 'Demo tokens are not allowed in production'
        });
    }

    try {
        // Verify and decode token (single decode operation)
        const decoded = verifyAccessToken(token);
        
        // Check blacklist by JTI (no double decode - optimized!)
        const blacklisted = await isBlacklistedByJTI(decoded.jti);
        if (blacklisted) {
            return res.status(403).json({
                success: false,
                error: 'Token has been revoked'
            });
        }

        req.user = decoded;
        req.tokenJti = decoded.jti; // Store JTI for potential blacklisting
        next();
    } catch (err) {
        return res.status(403).json({
            success: false,
            error: 'Invalid or expired token'
        });
    }
}

// Optional authentication - sets req.user if token is valid, but doesn't require it
async function optionalAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
        try {
            const decoded = verifyAccessToken(token);
            
            // Check blacklist by JTI (optimized)
            const blacklisted = await isBlacklistedByJTI(decoded.jti);
            if (!blacklisted) {
                req.user = decoded;
                req.tokenJti = decoded.jti;
            }
        } catch (err) {
            // Token invalid, continue without req.user
        }
    }
    // Continue regardless of token validity
    next();
}

// CSRF verification middleware
function verifyCsrf(req, res, next) {
    // Only verify CSRF for state-changing requests
    const stateChangingMethods = ['POST', 'PATCH', 'PUT', 'DELETE'];
    if (!stateChangingMethods.includes(req.method)) {
        return next();
    }

    // Skip CSRF for public endpoints
    const publicPaths = ['/api/auth/login', '/api/auth/register'];
    if (publicPaths.includes(req.path)) {
        return next();
    }

    const cookieToken = req.cookies['XSRF-TOKEN'];
    const headerToken = req.headers['x-xsrf-token'];

    if (!cookieToken || !headerToken) {
        return res.status(403).json({
            success: false,
            error: 'CSRF token required'
        });
    }

    if (cookieToken !== headerToken) {
        return res.status(403).json({
            success: false,
            error: 'Invalid CSRF token'
        });
    }

    next();
}

module.exports = {
    authenticateToken,
    optionalAuth,
    verifyCsrf
};
