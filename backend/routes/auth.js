// TrustChain Authentication Routes
const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const router = express.Router();
const db = require('../database/services');
const { authenticateToken, verifyCsrf } = require('../middleware/auth');
const { generateAccessToken, generateRefreshToken, decodeToken } = require('../config/jwt');
const { addToBlacklistByJTI } = require('../config/blacklist');
const blacklistConfig = require('../config/blacklist');
const refreshTokenService = require('../services/refreshToken');

// Validate required environment variables
if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required. Set it in .env file.');
}

// Register new user
router.post('/register', async (req, res) => {
    try {
        const { email, password, firstName, lastName, role, organization, phone, address } = req.body;

        // Validate required fields
        if (!email || !password || !firstName || !lastName) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields (email, password, firstName, lastName)'
            });
        }

        // Check if user already exists
        const existingUser = await db.getUserByEmail(email);
        if (existingUser) {
            return res.status(400).json({
                success: false,
                error: 'User with this email already exists'
            });
        }

        // Hash password
        const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Create new user
        const newUser = await db.createUser({
            email,
            passwordHash,
            firstName,
            lastName,
            role: role || 'vehicle_owner',
            organization: organization || 'Individual',
            phone,
            address
        });

        // Generate access token with JTI
        const accessToken = generateAccessToken({
            userId: newUser.id,
            email: newUser.email,
            role: newUser.role
        });

        // Generate refresh token
        const refreshToken = generateRefreshToken({
            userId: newUser.id,
            email: newUser.email,
            role: newUser.role
        });

        // Store refresh token in database
        await refreshTokenService.createRefreshToken(newUser.id, refreshToken);

        // Generate CSRF token
        const csrfToken = crypto.randomBytes(32).toString('hex');

        // Set refresh token as HttpOnly cookie
        const isProduction = process.env.NODE_ENV === 'production';
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? 'strict' : 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        // Set CSRF token as readable cookie
        res.cookie('XSRF-TOKEN', csrfToken, {
            httpOnly: false,
            secure: isProduction,
            sameSite: isProduction ? 'strict' : 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        // Return user data (without password)
        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            user: {
                id: newUser.id,
                email: newUser.email,
                firstName: newUser.first_name,
                lastName: newUser.last_name,
                role: newUser.role,
                organization: newUser.organization,
                phone: newUser.phone,
                address: newUser.address,
                createdAt: newUser.created_at
            },
            token: accessToken
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Login user
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate required fields
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email and password are required'
            });
        }

        // Find user in database
        const user = await db.getUserByEmail(email);
        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }

        // Update last login
        await db.updateUserLastLogin(user.id);

        // Generate access token with JTI
        const accessToken = generateAccessToken({
            userId: user.id,
            email: user.email,
            role: user.role
        });

        // Generate refresh token
        const refreshToken = generateRefreshToken({
            userId: user.id,
            email: user.email,
            role: user.role
        });

        // Store refresh token in database
        const refreshTokenRecord = await refreshTokenService.createRefreshToken(user.id, refreshToken);

        // Create or update session
        await refreshTokenService.createOrUpdateSession(
            user.id,
            refreshTokenRecord.id,
            req.ip || req.connection.remoteAddress,
            req.get('user-agent') || ''
        );

        // Generate CSRF token
        const csrfToken = crypto.randomBytes(32).toString('hex');

        // Set refresh token as HttpOnly cookie
        const isProduction = process.env.NODE_ENV === 'production';
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? 'strict' : 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        // Set CSRF token as readable cookie
        res.cookie('XSRF-TOKEN', csrfToken, {
            httpOnly: false,
            secure: isProduction,
            sameSite: isProduction ? 'strict' : 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        // Return user data (without password)
        res.json({
            success: true,
            message: 'Login successful',
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                role: user.role,
                organization: user.organization,
                phone: user.phone,
                isActive: user.is_active,
                emailVerified: user.email_verified,
                createdAt: user.created_at
            },
            token: accessToken
        });

    } catch (error) {
        console.error('Login error:', error);
        console.error('Error stack:', error.stack);
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            detail: error.detail,
            hint: error.hint,
            table: error.table
        });
        
        // Log full error details in development/production for debugging
        const errorMessage = process.env.NODE_ENV === 'production' 
            ? 'Internal server error' 
            : error.message || 'Internal server error';
        const errorStack = process.env.NODE_ENV === 'development' ? error.stack : undefined;
        
        // Provide more helpful error messages for common database errors
        let userFriendlyError = errorMessage;
        if (error.code === '42P01') { // Table does not exist
            userFriendlyError = 'Database tables missing. Please run migrations: refresh_tokens and sessions tables are required.';
        } else if (error.code === '23505') { // Unique violation
            userFriendlyError = 'A record with this information already exists.';
        } else if (error.code === '23503') { // Foreign key violation
            userFriendlyError = 'Database integrity error. Please contact support.';
        }
        
        res.status(500).json({
            success: false,
            error: userFriendlyError,
            ...(errorStack && { stack: errorStack }),
            ...(process.env.NODE_ENV === 'development' && { 
                code: error.code,
                detail: error.detail,
                hint: error.hint
            })
        });
    }
});

// Get current user profile
router.get('/profile', authenticateToken, async (req, res) => {
    try {
        const user = await db.getUserById(req.user.userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                role: user.role,
                organization: user.organization,
                phone: user.phone,
                address: user.address,
                isActive: user.is_active,
                emailVerified: user.email_verified,
                createdAt: user.created_at
            }
        });

    } catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Update user profile
router.put('/profile', authenticateToken, async (req, res) => {
    try {
        const { firstName, lastName, organization, phone, address } = req.body;
        const user = await db.getUserById(req.user.userId);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Update user data
        const updateData = {};
        if (firstName) updateData.first_name = firstName;
        if (lastName) updateData.last_name = lastName;
        if (organization) updateData.organization = organization;
        if (phone !== undefined) updateData.phone = phone;
        if (address !== undefined) updateData.address = address;

        if (Object.keys(updateData).length > 0) {
            const dbModule = require('../database/db');
            await dbModule.query(
                `UPDATE users SET ${Object.keys(updateData).map((key, i) => `${key} = $${i + 1}`).join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${Object.keys(updateData).length + 1}`,
                [...Object.values(updateData), req.user.userId]
            );
        }

        const updatedUser = await db.getUserById(req.user.userId);

        res.json({
            success: true,
            message: 'Profile updated successfully',
            user: {
                id: updatedUser.id,
                email: updatedUser.email,
                firstName: updatedUser.first_name,
                lastName: updatedUser.last_name,
                role: updatedUser.role,
                organization: updatedUser.organization,
                phone: updatedUser.phone,
                address: updatedUser.address
            }
        });

    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Change password
router.put('/change-password', authenticateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                error: 'Current password and new password are required'
            });
        }

        const user = await db.getUserByEmail(req.user.email);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Verify current password
        const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                error: 'Current password is incorrect'
            });
        }

        // Hash new password
        const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
        const passwordHash = await bcrypt.hash(newPassword, saltRounds);

        // Update password
        const dbModule = require('../database/db');
        await dbModule.query(
            'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [passwordHash, req.user.userId]
        );

        res.json({
            success: true,
            message: 'Password changed successfully'
        });

    } catch (error) {
        console.error('Password change error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Refresh access token
router.post('/refresh', verifyCsrf, async (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken;

        if (!refreshToken) {
            return res.status(401).json({
                success: false,
                error: 'Refresh token required'
            });
        }

        // Verify refresh token
        const verificationResult = await refreshTokenService.verifyRefreshToken(refreshToken);
        if (!verificationResult) {
            return res.status(403).json({
                success: false,
                error: 'Invalid or expired refresh token'
            });
        }

        const { user, tokenRecord } = verificationResult;

        // Generate new access token
        const newAccessToken = generateAccessToken({
            userId: user.id,
            email: user.email,
            role: user.role
        });

        // Update session last activity
        await refreshTokenService.createOrUpdateSession(
            user.id,
            tokenRecord.id,
            req.ip || req.connection.remoteAddress,
            req.get('user-agent') || ''
        );

        res.json({
            success: true,
            token: newAccessToken
        });

    } catch (error) {
        console.error('Token refresh error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to refresh token'
        });
    }
});

// Logout - revoke refresh token and blacklist access token
router.post('/logout', authenticateToken, verifyCsrf, async (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken;
        const accessToken = req.headers['authorization']?.split(' ')[1];

        // Revoke refresh token if present
        if (refreshToken) {
            const tokenHash = refreshTokenService.hashToken(refreshToken);
            await refreshTokenService.revokeRefreshToken(tokenHash);
        }

        // Blacklist access token by JTI (optimized - no decode needed)
        if (req.tokenJti && accessToken) {
            const decoded = decodeToken(accessToken);
            const expirySeconds = Math.max(0, decoded.exp - Math.floor(Date.now() / 1000));
            if (expirySeconds > 0) {
                const tokenHash = blacklistConfig.hashToken(accessToken);
                await addToBlacklistByJTI(req.tokenJti, tokenHash, expirySeconds, 'logout');
            }
        }

        // Clear cookies
        res.clearCookie('refreshToken');
        res.clearCookie('XSRF-TOKEN');

        res.json({
            success: true,
            message: 'Logged out successfully'
        });

    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to logout'
        });
    }
});

// Logout all sessions
router.post('/logout-all', authenticateToken, verifyCsrf, async (req, res) => {
    try {
        const userId = req.user.userId;

        // Revoke all refresh tokens for user
        await refreshTokenService.revokeAllUserTokens(userId);

        // Blacklist current access token by JTI (optimized)
        const accessToken = req.headers['authorization']?.split(' ')[1];
        if (req.tokenJti && accessToken) {
            const decoded = decodeToken(accessToken);
            const expirySeconds = Math.max(0, decoded.exp - Math.floor(Date.now() / 1000));
            if (expirySeconds > 0) {
                const tokenHash = blacklistConfig.hashToken(accessToken);
                await addToBlacklistByJTI(req.tokenJti, tokenHash, expirySeconds, 'logout-all');
            }
        }

        // Clear cookies
        res.clearCookie('refreshToken');
        res.clearCookie('XSRF-TOKEN');

        res.json({
            success: true,
            message: 'All sessions logged out successfully'
        });

    } catch (error) {
        console.error('Logout all error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to logout all sessions'
        });
    }
});

// Get user's active sessions
router.get('/sessions', authenticateToken, async (req, res) => {
    try {
        const sessions = await refreshTokenService.getUserSessions(req.user.userId);

        res.json({
            success: true,
            sessions: sessions.map(session => ({
                id: session.id,
                ipAddress: session.ip_address,
                userAgent: session.user_agent,
                createdAt: session.created_at,
                lastActivity: session.last_activity,
                expiresAt: session.expires_at
            }))
        });

    } catch (error) {
        console.error('Get sessions error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get sessions'
        });
    }
});

module.exports = router;
