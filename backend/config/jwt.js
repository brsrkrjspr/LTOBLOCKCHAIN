// TrustChain LTO - JWT Configuration
// Centralizes JWT token configuration and generation

const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

// Validate required environment variables
if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required. Set it in .env file.');
}

// Access token configuration
const ACCESS_TOKEN_SECRET = process.env.JWT_SECRET;
const ACCESS_TOKEN_EXPIRY = process.env.JWT_ACCESS_EXPIRY || '2h'; // 2 hours (government work session)

// Refresh token configuration
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET + '_refresh';
const REFRESH_TOKEN_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d'; // 7 days

/**
 * Generate access token with JTI (JWT ID) for blacklisting
 */
function generateAccessToken(payload) {
    const jti = uuidv4(); // Unique token ID for blacklisting
    
    return jwt.sign(
        {
            ...payload,
            jti, // JWT ID for blacklisting
            type: 'access'
        },
        ACCESS_TOKEN_SECRET,
        { expiresIn: ACCESS_TOKEN_EXPIRY }
    );
}

/**
 * Generate refresh token
 */
function generateRefreshToken(payload) {
    return jwt.sign(
        {
            ...payload,
            type: 'refresh'
        },
        REFRESH_TOKEN_SECRET,
        { expiresIn: REFRESH_TOKEN_EXPIRY }
    );
}

/**
 * Verify access token
 */
function verifyAccessToken(token) {
    return jwt.verify(token, ACCESS_TOKEN_SECRET);
}

/**
 * Verify refresh token
 */
function verifyRefreshToken(token) {
    return jwt.verify(token, REFRESH_TOKEN_SECRET);
}

/**
 * Decode token without verification (for extracting JTI)
 */
function decodeToken(token) {
    return jwt.decode(token);
}

module.exports = {
    generateAccessToken,
    generateRefreshToken,
    verifyAccessToken,
    verifyRefreshToken,
    decodeToken,
    ACCESS_TOKEN_EXPIRY,
    REFRESH_TOKEN_EXPIRY
};

