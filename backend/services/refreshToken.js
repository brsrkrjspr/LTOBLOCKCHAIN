// TrustChain LTO - Refresh Token Service
// Handles refresh token creation, verification, and revocation

const crypto = require('crypto');
const db = require('../database/db');
const { verifyRefreshToken: verifyJWTRefreshToken, REFRESH_TOKEN_EXPIRY } = require('../config/jwt');

/**
 * Hash refresh token using SHA-256
 */
function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Create a new refresh token
 */
async function createRefreshToken(userId, token) {
    const tokenHash = hashToken(token);
    
    // Calculate expiry time (7 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    
    const result = await db.query(
        `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [userId, tokenHash, expiresAt]
    );
    
    return result.rows[0];
}

/**
 * Verify refresh token and return token record
 */
async function verifyRefreshToken(token) {
    try {
        // Verify JWT signature
        const decoded = verifyJWTRefreshToken(token);
        
        // Hash the token
        const tokenHash = hashToken(token);
        
        // Find token in database
        const result = await db.query(
            `SELECT rt.*, u.id as user_id, u.email, u.role
             FROM refresh_tokens rt
             JOIN users u ON rt.user_id = u.id
             WHERE rt.token_hash = $1 AND rt.expires_at > CURRENT_TIMESTAMP`,
            [tokenHash]
        );
        
        if (result.rows.length === 0) {
            return null;
        }
        
        return {
            tokenRecord: result.rows[0],
            user: {
                id: result.rows[0].user_id,
                email: result.rows[0].email,
                role: result.rows[0].role
            }
        };
    } catch (error) {
        return null;
    }
}

/**
 * Find refresh token by hash
 */
async function findRefreshTokenByHash(tokenHash) {
    const result = await db.query(
        `SELECT * FROM refresh_tokens WHERE token_hash = $1`,
        [tokenHash]
    );
    
    return result.rows[0] || null;
}

/**
 * Revoke a specific refresh token
 */
async function revokeRefreshToken(tokenHash) {
    const result = await db.query(
        `DELETE FROM refresh_tokens WHERE token_hash = $1 RETURNING *`,
        [tokenHash]
    );
    
    return result.rows[0] || null;
}

/**
 * Revoke all refresh tokens for a user
 */
async function revokeAllUserTokens(userId) {
    const result = await db.query(
        `DELETE FROM refresh_tokens WHERE user_id = $1 RETURNING *`,
        [userId]
    );
    
    return result.rows;
}

/**
 * Get user's active sessions
 */
async function getUserSessions(userId) {
    const result = await db.query(
        `SELECT s.*, rt.created_at as token_created_at
         FROM sessions s
         JOIN refresh_tokens rt ON s.refresh_token_id = rt.id
         WHERE s.user_id = $1 AND s.expires_at > CURRENT_TIMESTAMP
         ORDER BY s.last_activity DESC`,
        [userId]
    );
    
    return result.rows;
}

/**
 * Create or update session
 */
async function createOrUpdateSession(userId, refreshTokenId, ipAddress, userAgent) {
    // Check if session exists
    const existing = await db.query(
        `SELECT * FROM sessions WHERE refresh_token_id = $1`,
        [refreshTokenId]
    );
    
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days
    
    if (existing.rows.length > 0) {
        // Update existing session
        const result = await db.query(
            `UPDATE sessions
             SET last_activity = CURRENT_TIMESTAMP,
                 ip_address = $1,
                 user_agent = $2
             WHERE refresh_token_id = $3
             RETURNING *`,
            [ipAddress, userAgent, refreshTokenId]
        );
        return result.rows[0];
    } else {
        // Create new session
        const result = await db.query(
            `INSERT INTO sessions (user_id, refresh_token_id, ip_address, user_agent, expires_at)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [userId, refreshTokenId, ipAddress, userAgent, expiresAt]
        );
        return result.rows[0];
    }
}

/**
 * Delete session
 */
async function deleteSession(sessionId) {
    const result = await db.query(
        `DELETE FROM sessions WHERE id = $1 RETURNING *`,
        [sessionId]
    );
    
    return result.rows[0] || null;
}

module.exports = {
    hashToken,
    createRefreshToken,
    verifyRefreshToken,
    findRefreshTokenByHash,
    revokeRefreshToken,
    revokeAllUserTokens,
    getUserSessions,
    createOrUpdateSession,
    deleteSession
};

