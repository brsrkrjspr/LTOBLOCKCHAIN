// TrustChain Authentication Routes
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Mock user database (in production, use real database)
const users = [
    {
        id: 'USR001',
        email: 'admin@lto.gov.ph',
        password: '$2a$12$0V4iR1vog9LRKdCxgKYQM.sH7QZWP2yMsu5i.80xLfH/imgycOGrG', // admin123
        firstName: 'Admin',
        lastName: 'User',
        role: 'admin',
        organization: 'LTO',
        isActive: true,
        createdAt: new Date().toISOString()
    },
    {
        id: 'USR002',
        email: 'verifier@insurance.com',
        password: '$2a$12$0V4iR1vog9LRKdCxgKYQM.sH7QZWP2yMsu5i.80xLfH/imgycOGrG', // admin123
        firstName: 'Insurance',
        lastName: 'Verifier',
        role: 'insurance_verifier',
        organization: 'Insurance Company',
        isActive: true,
        createdAt: new Date().toISOString()
    },
    {
        id: 'USR003',
        email: 'verifier@emission.com',
        password: '$2a$12$0V4iR1vog9LRKdCxgKYQM.sH7QZWP2yMsu5i.80xLfH/imgycOGrG', // admin123
        firstName: 'Emission',
        lastName: 'Verifier',
        role: 'emission_verifier',
        organization: 'Emission Testing Center',
        isActive: true,
        createdAt: new Date().toISOString()
    },
    {
        id: 'USR004',
        email: 'owner@example.com',
        password: '$2a$12$0V4iR1vog9LRKdCxgKYQM.sH7QZWP2yMsu5i.80xLfH/imgycOGrG', // admin123
        firstName: 'Vehicle',
        lastName: 'Owner',
        role: 'vehicle_owner',
        organization: 'Individual',
        isActive: true,
        createdAt: new Date().toISOString()
    }
];

// Register new user
router.post('/register', async (req, res) => {
    try {
        const { email, password, firstName, lastName, role, organization } = req.body;

        // Validate required fields
        if (!email || !password || !firstName || !lastName || !role) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields'
            });
        }

        // Check if user already exists
        const existingUser = users.find(user => user.email === email);
        if (existingUser) {
            return res.status(400).json({
                success: false,
                error: 'User with this email already exists'
            });
        }

        // Hash password
        const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Create new user
        const newUser = {
            id: 'USR' + Date.now(),
            email,
            password: hashedPassword,
            firstName,
            lastName,
            role,
            organization: organization || 'Individual',
            isActive: true,
            createdAt: new Date().toISOString()
        };

        users.push(newUser);

        // Generate JWT token
        const token = jwt.sign(
            { 
                userId: newUser.id, 
                email: newUser.email, 
                role: newUser.role 
            },
            process.env.JWT_SECRET || 'fallback-secret',
            { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
        );

        // Return user data (without password)
        const { password: _, ...userWithoutPassword } = newUser;

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            user: userWithoutPassword,
            token
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

        // Find user
        const user = users.find(u => u.email === email && u.isActive);
        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }

        // Generate JWT token
        const token = jwt.sign(
            { 
                userId: user.id, 
                email: user.email, 
                role: user.role 
            },
            process.env.JWT_SECRET || 'fallback-secret',
            { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
        );

        // Return user data (without password)
        const { password: _, ...userWithoutPassword } = user;

        res.json({
            success: true,
            message: 'Login successful',
            user: userWithoutPassword,
            token
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Get current user profile
router.get('/profile', authenticateToken, (req, res) => {
    try {
        const user = users.find(u => u.id === req.user.userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        const { password: _, ...userWithoutPassword } = user;

        res.json({
            success: true,
            user: userWithoutPassword
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
        const { firstName, lastName, organization } = req.body;
        const userIndex = users.findIndex(u => u.id === req.user.userId);
        
        if (userIndex === -1) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Update user data
        if (firstName) users[userIndex].firstName = firstName;
        if (lastName) users[userIndex].lastName = lastName;
        if (organization) users[userIndex].organization = organization;
        users[userIndex].lastUpdated = new Date().toISOString();

        const { password: _, ...userWithoutPassword } = users[userIndex];

        res.json({
            success: true,
            message: 'Profile updated successfully',
            user: userWithoutPassword
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

        const userIndex = users.findIndex(u => u.id === req.user.userId);
        if (userIndex === -1) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Verify current password
        const isValidPassword = await bcrypt.compare(currentPassword, users[userIndex].password);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                error: 'Current password is incorrect'
            });
        }

        // Hash new password
        const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

        // Update password
        users[userIndex].password = hashedPassword;
        users[userIndex].lastUpdated = new Date().toISOString();

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

// Logout (client-side token removal)
router.post('/logout', authenticateToken, (req, res) => {
    res.json({
        success: true,
        message: 'Logged out successfully'
    });
});

// Middleware to authenticate JWT token
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            success: false,
            error: 'Access token required'
        });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret', (err, user) => {
        if (err) {
            return res.status(403).json({
                success: false,
                error: 'Invalid or expired token'
            });
        }
        req.user = user;
        next();
    });
}

module.exports = router;
