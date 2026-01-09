// TrustChain LTO - Email Verification Token Service
// Handles generation, validation, and resending of email verification tokens

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../database/db');

const VERIFICATION_TOKEN_EXPIRY = process.env.VERIFICATION_EMAIL_EXPIRY || '24h';
const VERIFICATION_LINK_EXPIRY_HOURS = parseInt(process.env.VERIFICATION_LINK_EXPIRY_HOURS) || 24;
const VERIFICATION_TOKEN_SECRET = process.env.JWT_SECRET; // Reuse main JWT secret for consistency

if (!VERIFICATION_TOKEN_SECRET) {
    throw new Error('JWT_SECRET environment variable is required for email verification tokens.');
}

/**
 * Hash token using SHA-256
 */
function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generate a new email verification token
 * Returns the unhashed token for sending via email
 */
async function generateVerificationToken(userId) {
    try {
        // Create JWT token with 24hr expiry
        const tokenPayload = {
            userId,
            type: 'email_verification',
            iat: Math.floor(Date.now() / 1000)
        };

        const unhashed = jwt.sign(tokenPayload, VERIFICATION_TOKEN_SECRET, {
            expiresIn: VERIFICATION_LINK_EXPIRY_HOURS + 'h'
        });

        // Hash for database storage
        const tokenHash = hashToken(unhashed);

        // Calculate expiry timestamp
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + VERIFICATION_LINK_EXPIRY_HOURS);

        // Check if user already has an unused token
        const existingToken = await db.query(
            `SELECT id FROM email_verification_tokens 
             WHERE user_id = $1 AND used_at IS NULL`,
            [userId]
        );

        // Delete existing unused token if any
        if (existingToken.rows.length > 0) {
            await db.query(
                `DELETE FROM email_verification_tokens 
                 WHERE user_id = $1 AND used_at IS NULL`,
                [userId]
            );
        }

        // Store token in database
        const result = await db.query(
            `INSERT INTO email_verification_tokens (user_id, token_hash, token_secret, expires_at)
             VALUES ($1, $2, $3, $4)
             RETURNING id, user_id, expires_at, created_at`,
            [userId, tokenHash, VERIFICATION_TOKEN_SECRET, expiresAt]
        );

        console.log('✅ Email verification token generated', {
            userId,
            tokenId: result.rows[0].id,
            expiresAt: result.rows[0].expires_at
        });

        return {
            token: unhashed,
            tokenId: result.rows[0].id,
            expiresAt: result.rows[0].expires_at
        };
    } catch (error) {
        console.error('❌ Error generating verification token:', error);
        throw error;
    }
}

/**
 * Verify email verification token
 * Returns user info if valid, null if invalid/expired/already used
 */
async function verifyToken(token, userIp) {
    try {
        // Decode JWT to verify signature and get payload
        let payload;
        try {
            payload = jwt.verify(token, VERIFICATION_TOKEN_SECRET);
        } catch (jwtError) {
            if (jwtError.name === 'TokenExpiredError') {
                console.warn('⚠️ Verification token expired');
                return { success: false, error: 'Token has expired. Please request a new verification link.' };
            }
            console.warn('⚠️ Invalid verification token signature');
            return { success: false, error: 'Invalid token.' };
        }

        // Validate token payload
        if (payload.type !== 'email_verification') {
            console.warn('⚠️ Token type mismatch');
            return { success: false, error: 'Invalid token.' };
        }

        // Hash the token for database lookup
        const tokenHash = hashToken(token);

        // Look up token in database
        const tokenResult = await db.query(
            `SELECT * FROM email_verification_tokens 
             WHERE token_hash = $1 AND user_id = $2`,
            [tokenHash, payload.userId]
        );

        if (tokenResult.rows.length === 0) {
            console.warn('⚠️ Token not found in database');
            return { success: false, error: 'Invalid token.' };
        }

        const tokenRecord = tokenResult.rows[0];

        // Check if token is already used
        if (tokenRecord.used_at !== null) {
            console.warn('⚠️ Verification token already used');
            return { success: false, error: 'Token has already been used. Please request a new verification link.' };
        }

        // Check if token is expired
        if (new Date(tokenRecord.expires_at) < new Date()) {
            console.warn('⚠️ Verification token database record expired');
            return { success: false, error: 'Token has expired. Please request a new verification link.' };
        }

        // Get user details
        const userResult = await db.query(
            `SELECT id, email, first_name, last_name, email_verified 
             FROM users WHERE id = $1`,
            [payload.userId]
        );

        if (userResult.rows.length === 0) {
            console.warn('⚠️ User not found for verification token');
            return { success: false, error: 'User not found.' };
        }

        const user = userResult.rows[0];

        // Check if email already verified
        if (user.email_verified) {
            console.warn('⚠️ User email already verified');
            return { success: false, error: 'Email is already verified.' };
        }

        // Mark token as used
        await db.query(
            `UPDATE email_verification_tokens 
             SET used_at = CURRENT_TIMESTAMP, used_by_ip = $1 
             WHERE id = $2`,
            [userIp, tokenRecord.id]
        );

        // Update user's email_verified status
        await db.query(
            `UPDATE users SET email_verified = true, updated_at = CURRENT_TIMESTAMP 
             WHERE id = $1`,
            [payload.userId]
        );

        console.log('✅ Email verified successfully', {
            userId: payload.userId,
            email: user.email,
            ip: userIp
        });

        return {
            success: true,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name
            }
        };
    } catch (error) {
        console.error('❌ Error verifying email token:', error);
        return { success: false, error: 'An error occurred during verification. Please try again.' };
    }
}

/**
 * Resend verification email to user
 * Rate limited to 1 new token per 5 minutes per user
 */
async function resendToken(userId, userEmail) {
    try {
        // Check if user has valid (unexpired, unused) tokens from last 5 minutes
        const recentToken = await db.query(
            `SELECT id, created_at FROM email_verification_tokens 
             WHERE user_id = $1 AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP
             AND created_at > CURRENT_TIMESTAMP - INTERVAL '5 minutes'
             ORDER BY created_at DESC LIMIT 1`,
            [userId]
        );

        if (recentToken.rows.length > 0) {
            const createdAt = new Date(recentToken.rows[0].created_at);
            const minutesAgo = Math.floor((Date.now() - createdAt.getTime()) / 60000);
            const minutesUntilNextAllowed = 5 - minutesAgo;

            console.warn('⚠️ Resend rate limit hit', {
                userId,
                minutesAgo,
                minutesUntilNextAllowed
            });

            return {
                success: false,
                error: `Please wait ${minutesUntilNextAllowed} minute(s) before requesting another verification link.`,
                retryAfterMinutes: minutesUntilNextAllowed
            };
        }

        // Delete any old unused tokens
        await db.query(
            `DELETE FROM email_verification_tokens 
             WHERE user_id = $1 AND used_at IS NULL`,
            [userId]
        );

        // Generate new token
        const newToken = await generateVerificationToken(userId);

        console.log('✅ Verification token resent', {
            userId,
            email: userEmail,
            tokenId: newToken.tokenId
        });

        return {
            success: true,
            token: newToken.token,
            expiresAt: newToken.expiresAt
        };
    } catch (error) {
        console.error('❌ Error resending verification token:', error);
        throw error;
    }
}

/**
 * Get verification token status for a user
 * Returns: pending, verified, or expired
 */
async function getVerificationStatus(userId) {
    try {
        const result = await db.query(
            `SELECT email_verified, created_at FROM users WHERE id = $1`,
            [userId]
        );

        if (result.rows.length === 0) {
            return null;
        }

        const user = result.rows[0];

        if (user.email_verified) {
            return { status: 'verified', verifiedAt: user.created_at };
        }

        // Check for unexpired token
        const tokenResult = await db.query(
            `SELECT created_at, expires_at FROM email_verification_tokens 
             WHERE user_id = $1 AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP
             ORDER BY created_at DESC LIMIT 1`,
            [userId]
        );

        if (tokenResult.rows.length > 0) {
            return {
                status: 'pending',
                sentAt: tokenResult.rows[0].created_at,
                expiresAt: tokenResult.rows[0].expires_at
            };
        }

        return { status: 'expired' };
    } catch (error) {
        console.error('❌ Error getting verification status:', error);
        throw error;
    }
}

module.exports = {
    generateVerificationToken,
    verifyToken,
    resendToken,
    getVerificationStatus
};
