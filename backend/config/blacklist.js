// TrustChain LTO - Token Blacklist Configuration
// Database-only blacklist (no Redis dependency)

const db = require('../database/db');
const crypto = require('crypto');

/**
 * Hash token for storage
 */
function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Add token to blacklist by JTI (optimized - avoids double decode)
 */
async function addToBlacklistByJTI(jti, tokenHash, expirySeconds, reason = 'logout') {
    try {
        const expiresAt = new Date(Date.now() + (expirySeconds * 1000));

        await db.query(
            `INSERT INTO token_blacklist (token_jti, token_hash, expires_at, reason)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (token_jti) DO UPDATE 
             SET expires_at = EXCLUDED.expires_at, reason = EXCLUDED.reason`,
            [jti, tokenHash, expiresAt, reason]
        );

        return true;
    } catch (error) {
        console.error('Error adding token to blacklist:', error);
        return false;
    }
}

/**
 * Add token to blacklist (full token version - for compatibility)
 */
async function addToBlacklist(token, expirySeconds, reason = 'logout') {
    try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.decode(token);
        
        if (!decoded || !decoded.jti) {
            console.error('Token missing JTI, cannot blacklist');
            return false;
        }

        const tokenHash = hashToken(token);
        return await addToBlacklistByJTI(decoded.jti, tokenHash, expirySeconds, reason);
    } catch (error) {
        console.error('Error adding token to blacklist:', error);
        return false;
    }
}

/**
 * Check if token is blacklisted by JTI (optimized - avoids decode)
 */
async function isBlacklistedByJTI(jti) {
    try {
        const result = await db.query(
            `SELECT token_jti FROM token_blacklist 
             WHERE token_jti = $1 AND expires_at > CURRENT_TIMESTAMP
             LIMIT 1`,
            [jti]
        );

        return result.rows.length > 0;
    } catch (error) {
        console.error('Error checking token blacklist:', error);
        // Fail open - if database error, allow token (better UX than blocking all requests)
        return false;
    }
}

/**
 * Check if token is blacklisted (full token version - for compatibility)
 */
async function isBlacklisted(token) {
    try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.decode(token);
        
        if (!decoded || !decoded.jti) {
            return false;
        }

        return await isBlacklistedByJTI(decoded.jti);
    } catch (error) {
        console.error('Error checking token blacklist:', error);
        return false;
    }
}

/**
 * Cleanup expired blacklist entries
 */
async function cleanupExpired() {
    try {
        const result = await db.query('SELECT cleanup_expired_blacklist()');
        const deletedCount = result.rows[0]?.cleanup_expired_blacklist || 0;
        
        if (deletedCount > 0) {
            console.log(`🧹 Cleaned ${deletedCount} expired tokens from blacklist`);
        }
        
        return deletedCount;
    } catch (error) {
        console.error('Error cleaning up blacklist:', error);
        return 0;
    }
}

/**
 * Initialize periodic cleanup (runs every 15 minutes)
 */
function startCleanupJob() {
    // Run cleanup immediately on startup
    cleanupExpired().catch(err => {
        console.error('Initial blacklist cleanup failed:', err);
    });

    // Then run every 15 minutes
    setInterval(() => {
        cleanupExpired().catch(err => {
            console.error('Periodic blacklist cleanup failed:', err);
        });
    }, 15 * 60 * 1000); // 15 minutes

    console.log('✅ Token blacklist cleanup job started (runs every 15 minutes)');
}

module.exports = {
    addToBlacklist,
    addToBlacklistByJTI,
    isBlacklisted,
    isBlacklistedByJTI,
    cleanupExpired,
    startCleanupJob,
    hashToken
};

