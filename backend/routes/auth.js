// TrustChain Authentication Routes
const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const db = require('../database/services');
const { authenticateToken, verifyCsrf } = require('../middleware/auth');
const { generateAccessToken, generateRefreshToken, decodeToken } = require('../config/jwt');
const { addToBlacklistByJTI } = require('../config/blacklist');
const blacklistConfig = require('../config/blacklist');
const refreshTokenService = require('../services/refreshToken');
const emailVerificationService = require('../services/emailVerificationToken');
const gmailApiService = require('../services/gmailApiService');

// Load common passwords for validation (NIST SP 800-63B requirement)
let commonPasswords = new Set();
try {
    const passwordFile = path.join(__dirname, '../config/commonPasswords.txt');
    const passwords = fs.readFileSync(passwordFile, 'utf-8')
        .split('\n')
        .map(p => p.toLowerCase().trim())
        .filter(p => p.length > 0);
    commonPasswords = new Set(passwords);
    console.log(`✅ Loaded ${commonPasswords.size} common passwords for validation`);
} catch (error) {
    console.warn('⚠️ Could not load common passwords file:', error.message);
}

// Signup-specific rate limiter (strict: 3 attempts per 15 minutes per IP)
const signupLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 3, // Conservative: 3 attempts per IP per window
    message: { error: 'Too many signup attempts. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        // Use X-Forwarded-For for proxy/load balancer scenarios
        return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || req.socket.remoteAddress;
    }
});

// Validate required environment variables
if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required. Set it in .env file.');
}

/**
 * Validate signup input - comprehensive server-side validation per NIST SP 800-63B
 * Returns { valid: true } or { valid: false, errors: [...] }
 */
function validateSignupInput(data) {
    const errors = [];

    // Email validation
    if (!data.email) {
        errors.push('Email is required');
    } else {
        const email = data.email.trim().toLowerCase();
        // Basic email format validation (RFC 5322 simplified)
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            errors.push('Invalid email format');
        }
        if (email.length > 255) {
            errors.push('Email is too long (max 255 characters)');
        }
    }

    // Password validation (NIST SP 800-63B: min 12 chars, blocklist, no complexity rules)
    if (!data.password) {
        errors.push('Password is required');
    } else {
        if (data.password.length < 12) {
            errors.push('Password must be at least 12 characters');
        }
        if (data.password.length > 128) {
            errors.push('Password is too long (max 128 characters)');
        }
        // Check against common passwords (case-insensitive)
        if (commonPasswords.has(data.password.toLowerCase())) {
            errors.push('This password is too common. Please choose a different one');
        }
    }

    // First name validation
    if (!data.firstName) {
        errors.push('First name is required');
    } else {
        const firstName = data.firstName.trim();
        if (firstName.length < 2) {
            errors.push('First name must be at least 2 characters');
        }
        if (firstName.length > 50) {
            errors.push('First name is too long (max 50 characters)');
        }
        // Basic alphanumeric + spaces/hyphens check
        if (!/^[a-zA-Z\s\-']+$/.test(firstName)) {
            errors.push('First name can only contain letters, spaces, hyphens, and apostrophes');
        }
    }

    // Last name validation
    if (!data.lastName) {
        errors.push('Last name is required');
    } else {
        const lastName = data.lastName.trim();
        if (lastName.length < 2) {
            errors.push('Last name must be at least 2 characters');
        }
        if (lastName.length > 50) {
            errors.push('Last name is too long (max 50 characters)');
        }
        if (!/^[a-zA-Z\s\-']+$/.test(lastName)) {
            errors.push('Last name can only contain letters, spaces, hyphens, and apostrophes');
        }
    }

    // Phone validation (optional, but if provided, validate format)
    if (data.phone) {
        const phone = data.phone.trim();
        if (phone.length > 20) {
            errors.push('Phone number is too long');
        }
        // Allow digits, spaces, hyphens, parentheses, plus sign (international format)
        if (!/^[\d\s\-\(\)\+]+$/.test(phone)) {
            errors.push('Phone number contains invalid characters');
        }
    }

    // Address validation (optional, but if provided, validate)
    if (data.address) {
        if (data.address.length > 500) {
            errors.push('Address is too long (max 500 characters)');
        }
    }

    return errors.length === 0 
        ? { valid: true }
        : { valid: false, errors };
}

// Register new user - with comprehensive security hardening
router.post('/register', signupLimiter, async (req, res) => {
    const clientIp = req.ip || req.connection.remoteAddress;
    
    try {
        // Extract only safe fields - explicitly ignore 'role' to prevent escalation
        const { email: rawEmail, password, firstName: rawFirstName, lastName: rawLastName, organization, phone, address } = req.body;

        // Log suspicious activity: if client attempts to specify a role
        if (req.body.role && req.body.role !== 'vehicle_owner') {
            console.warn('⚠️ Signup role escalation attempt', {
                ip: clientIp,
                email: rawEmail,
                attemptedRole: req.body.role,
                timestamp: new Date().toISOString()
            });
        }

        // CRITICAL: Hard-code role - never trust client input
        const role = 'vehicle_owner';

        // Normalize email (lowercase + trim)
        const email = rawEmail ? rawEmail.trim().toLowerCase() : '';
        const firstName = rawFirstName ? rawFirstName.trim() : '';
        const lastName = rawLastName ? rawLastName.trim() : '';

        // Input validation (comprehensive, server-side)
        const validation = validateSignupInput({
            email,
            password,
            firstName,
            lastName,
            phone: phone ? phone.trim() : undefined,
            address: address ? address.trim() : undefined
        });

        if (!validation.valid) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: validation.errors
            });
        }

        // Check if user already exists (check both active and inactive for email recovery)
        const existingUser = await db.getUserByEmail(email, false); // false = check all users
        if (existingUser) {
            // Log this - could indicate account recovery attempt
            console.warn('⚠️ Signup attempt with existing email', {
                ip: clientIp,
                email: email,
                existingUserId: existingUser.id,
                existingUserActive: existingUser.is_active,
                timestamp: new Date().toISOString()
            });
            
            return res.status(409).json({
                success: false,
                error: 'Email already registered'
            });
        }

        // Hash password with bcrypt
        const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Create new user with validated, normalized data
        const newUser = await db.createUser({
            email, // normalized (lowercase)
            passwordHash,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            role, // hard-coded, not from client
            organization: organization ? organization.trim() : 'Individual',
            phone: phone ? phone.trim() : null,
            address: address ? address.trim() : null
        });

        // Log successful user creation
        console.log('✅ User registered successfully', {
            userId: newUser.id,
            email: newUser.email,
            role: newUser.role,
            ip: clientIp,
            timestamp: new Date().toISOString()
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

        // Generate email verification token
        let verificationToken = null;
        let verificationLink = null;
        try {
            const tokenResult = await emailVerificationService.generateVerificationToken(newUser.id);
            verificationToken = tokenResult.token;
            
            const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
            verificationLink = `${baseUrl}/email-verification.html?token=${verificationToken}`;

            // Send verification email
            await gmailApiService.sendMail({
                to: newUser.email,
                subject: 'Verify Your TrustChain LTO Email',
                text: `Hello ${newUser.first_name},\n\nWelcome to TrustChain LTO! Please verify your email by clicking the link below. This link will expire in 24 hours.\n\n${verificationLink}\n\nIf you did not create an account, please ignore this email.\n\nBest regards,\nTrustChain LTO System`,
                html: `
                    <h2>Welcome to TrustChain LTO</h2>
                    <p>Hello ${newUser.first_name},</p>
                    <p>Thank you for registering. Please verify your email address by clicking the button below:</p>
                    <p>
                        <a href="${verificationLink}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">
                            Verify Email
                        </a>
                    </p>
                    <p>Or copy and paste this link in your browser:</p>
                    <p><a href="${verificationLink}">${verificationLink}</a></p>
                    <p><strong>This link will expire in 24 hours.</strong></p>
                    <p>If you did not create an account, please ignore this email.</p>
                    <p>Best regards,<br>TrustChain LTO System</p>
                `
            });

            console.log('✅ Verification email sent', {
                userId: newUser.id,
                email: newUser.email
            });
        } catch (emailError) {
            console.error('⚠️ Failed to send verification email (non-fatal):', emailError.message);
            // Continue with registration - email failure is operational, not user's fault
        }

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
            message: 'User registered successfully. Please check your email to verify your account.',
            user: {
                id: newUser.id,
                email: newUser.email,
                firstName: newUser.first_name,
                lastName: newUser.last_name,
                role: newUser.role,
                organization: newUser.organization,
                phone: newUser.phone,
                address: newUser.address,
                emailVerified: newUser.email_verified,
                createdAt: newUser.created_at
            },
            token: accessToken
        });

    } catch (error) {
        // Handle specific database errors
        if (error.code === '23505') {
            // Unique constraint violation (email already exists)
            // This shouldn't happen due to our check above, but catch it as defense-in-depth
            console.error('❌ Unique constraint violation at DB level:', error);
            return res.status(409).json({
                success: false,
                error: 'Email already registered'
            });
        }

        // Log the full error for debugging
        console.error('❌ Registration error:', {
            message: error.message,
            code: error.code,
            ip: clientIp,
            timestamp: new Date().toISOString()
        });

        // Don't leak implementation details to client
        res.status(500).json({
            success: false,
            error: 'Registration failed. Please try again later.'
        });
    }
});

// Login user
router.post('/login', async (req, res) => {
    try {
        const { email: rawEmail, password } = req.body;

        // Validate required fields
        if (!rawEmail || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email and password are required'
            });
        }

        // Normalize email (lowercase + trim) - prevents case-sensitivity attacks
        const email = rawEmail.trim().toLowerCase();

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

        // Check email verification status (allow unverified for now with warning)
        // In future, you may enforce: if (!user.email_verified) return 403
        if (!user.email_verified) {
            // Log unverified login attempt (potential account recovery issue)
            console.warn('⚠️ Login attempt with unverified email', {
                userId: user.id,
                email: user.email,
                ip: req.ip || req.connection.remoteAddress
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

// Verify email with magic link token
router.post('/verify-email', async (req, res) => {
    try {
        const { token } = req.body || req.query;

        // Validate token parameter
        if (!token) {
            return res.status(400).json({
                success: false,
                error: 'Verification token is required'
            });
        }

        // Get user IP for audit logging
        const userIp = req.ip || req.connection.remoteAddress;

        // Verify token
        const result = await emailVerificationService.verifyToken(token, userIp);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                error: result.error
            });
        }

        // Email verified successfully
        res.json({
            success: true,
            message: 'Email verified successfully!',
            user: result.user
        });

    } catch (error) {
        console.error('Email verification error:', error);
        res.status(500).json({
            success: false,
            error: 'An error occurred during verification'
        });
    }
});

// Resend email verification link
router.post('/resend-verification-email', async (req, res) => {
    try {
        const { email } = req.body;

        // Validate email parameter
        if (!email) {
            return res.status(400).json({
                success: false,
                error: 'Email is required'
            });
        }

        // Find user by email
        const user = await db.getUserByEmail(email);
        if (!user) {
            // Return generic message to prevent user enumeration (per OWASP)
            return res.status(200).json({
                success: true,
                message: 'If an account exists with this email, a new verification link has been sent.'
            });
        }

        // Check if email already verified
        if (user.email_verified) {
            return res.status(200).json({
                success: true,
                message: 'This email is already verified.'
            });
        }

        // Get user IP for rate limiting
        const userIp = req.ip || req.connection.remoteAddress;

        // Resend verification token (includes rate limit checking)
        const resendResult = await emailVerificationService.resendToken(user.id, user.email);

        if (!resendResult.success) {
            // Log rate limit attempt (potential abuse indicator)
            console.warn('⚠️ Email resend rate limit hit', {
                userId: user.id,
                email: user.email,
                ip: userIp
            });

            return res.status(429).json({
                success: false,
                error: resendResult.error,
                retryAfterMinutes: resendResult.retryAfterMinutes
            });
        }

        // Build verification link
        const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const verificationLink = `${baseUrl}/email-verification.html?token=${resendResult.token}`;

        // Send verification email
        try {
            await gmailApiService.sendMail({
                to: user.email,
                subject: 'Verify Your TrustChain LTO Email',
                text: `Hello ${user.first_name},\n\nPlease verify your email by clicking the link below. This link will expire in 24 hours.\n\n${verificationLink}\n\nIf you did not create an account, please ignore this email.\n\nBest regards,\nTrustChain LTO System`,
                html: `
                    <h2>Verify Your Email</h2>
                    <p>Hello ${user.first_name},</p>
                    <p>Thank you for registering with TrustChain LTO. Please verify your email address by clicking the button below:</p>
                    <p>
                        <a href="${verificationLink}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">
                            Verify Email
                        </a>
                    </p>
                    <p>Or copy and paste this link in your browser:</p>
                    <p><a href="${verificationLink}">${verificationLink}</a></p>
                    <p><strong>This link will expire in 24 hours.</strong></p>
                    <p>If you did not create an account, please ignore this email.</p>
                    <p>Best regards,<br>TrustChain LTO System</p>
                `
            });

            console.log('✅ Verification email resent', {
                userId: user.id,
                email: user.email,
                ip: userIp
            });
        } catch (emailError) {
            console.error('❌ Failed to send verification email:', emailError);
            // Still return success to client (email sending failure is an ops issue)
            // but log it for monitoring
        }

        // Return success message (generic for security)
        res.status(200).json({
            success: true,
            message: 'If an account exists with this email, a new verification link has been sent.'
        });

    } catch (error) {
        console.error('Resend verification email error:', error);
        // Return success message to prevent leaking account existence
        res.status(200).json({
            success: true,
            message: 'If an account exists with this email, a new verification link has been sent.'
        });
    }
});

module.exports = router;
