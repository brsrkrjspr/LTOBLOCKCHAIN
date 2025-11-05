// TrustChain Vehicle Management Routes
const express = require('express');
const router = express.Router();
const fabricService = require('../services/fabricService');

// Mock vehicle database (in production, use blockchain)
const vehicles = [
    {
        vin: 'VIN123456789',
        plateNumber: 'ABC-1234',
        make: 'Toyota',
        model: 'Vios',
        year: 2023,
        color: 'White',
        engineNumber: '2NR-FE123456',
        chassisNumber: 'JT1234567890',
        ownerId: 'USR004',
        ownerName: 'Vehicle Owner',
        registrationDate: '2024-01-15T10:30:00Z',
        status: 'REGISTERED',
        documents: {
            registrationCert: 'registration_cert.pdf',
            insuranceCert: 'insurance_cert.pdf',
            emissionCert: 'emission_cert.pdf',
            ownerId: 'owner_id.pdf'
        },
        ipfsHashes: {
            registrationCert: 'QmXvJ1Z...',
            insuranceCert: 'QmAbC2D...',
            emissionCert: 'QmEfG3H...',
            ownerId: 'QmIjK4L...'
        },
        verificationStatus: {
            insurance: 'APPROVED',
            emission: 'APPROVED',
            admin: 'PENDING'
        },
        history: [
            {
                action: 'REGISTERED',
                timestamp: '2024-01-15T10:30:00Z',
                performedBy: 'USR004',
                details: 'Vehicle registration submitted'
            },
            {
                action: 'INSURANCE_APPROVED',
                timestamp: '2024-01-16T14:20:00Z',
                performedBy: 'USR002',
                details: 'Insurance certificate verified and approved'
            },
            {
                action: 'EMISSION_APPROVED',
                timestamp: '2024-01-17T09:15:00Z',
                performedBy: 'USR003',
                details: 'Emission test passed and approved'
            }
        ]
    }
];

// Get all vehicles (admin only)
router.get('/', authenticateToken, authorizeRole(['admin']), (req, res) => {
    try {
        const { status, page = 1, limit = 10 } = req.query;
        
        let filteredVehicles = vehicles;
        
        // Filter by status if provided
        if (status) {
            filteredVehicles = vehicles.filter(vehicle => vehicle.status === status);
        }

        // Pagination
        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;
        const paginatedVehicles = filteredVehicles.slice(startIndex, endIndex);

        res.json({
            success: true,
            vehicles: paginatedVehicles,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(filteredVehicles.length / limit),
                totalVehicles: filteredVehicles.length,
                hasNext: endIndex < filteredVehicles.length,
                hasPrev: startIndex > 0
            }
        });

    } catch (error) {
        console.error('Get vehicles error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Get vehicle by VIN
router.get('/:vin', authenticateToken, (req, res) => {
    try {
        const { vin } = req.params;
        const vehicle = vehicles.find(v => v.vin === vin);

        if (!vehicle) {
            return res.status(404).json({
                success: false,
                error: 'Vehicle not found'
            });
        }

        // Check if user has permission to view this vehicle
        if (req.user.role !== 'admin' && vehicle.ownerId !== req.user.userId) {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }

        res.json({
            success: true,
            vehicle
        });

    } catch (error) {
        console.error('Get vehicle error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Get vehicle by plate number
router.get('/plate/:plateNumber', authenticateToken, (req, res) => {
    try {
        const { plateNumber } = req.params;
        const vehicle = vehicles.find(v => v.plateNumber === plateNumber);

        if (!vehicle) {
            return res.status(404).json({
                success: false,
                error: 'Vehicle not found'
            });
        }

        // Check if user has permission to view this vehicle
        if (req.user.role !== 'admin' && vehicle.ownerId !== req.user.userId) {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }

        res.json({
            success: true,
            vehicle
        });

    } catch (error) {
        console.error('Get vehicle by plate error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Get vehicles by owner
router.get('/owner/:ownerId', authenticateToken, (req, res) => {
    try {
        const { ownerId } = req.params;

        // Check if user has permission to view these vehicles
        if (req.user.role !== 'admin' && req.user.userId !== ownerId) {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }

        const ownerVehicles = vehicles.filter(v => v.ownerId === ownerId);

        res.json({
            success: true,
            vehicles: ownerVehicles,
            count: ownerVehicles.length
        });

    } catch (error) {
        console.error('Get vehicles by owner error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Register new vehicle (new endpoint for registration wizard)
router.post('/register', async (req, res) => {
    try {
        const registrationData = req.body;
        
        // Validate required fields
        if (!registrationData.vehicle || !registrationData.owner) {
            return res.status(400).json({
                success: false,
                error: 'Missing required vehicle or owner information'
            });
        }
        
        const { vehicle, owner } = registrationData;
        
        if (!vehicle.vin || !vehicle.plateNumber || !vehicle.make || !vehicle.model) {
            return res.status(400).json({
                success: false,
                error: 'Missing required vehicle information (VIN, plate number, make, model)'
            });
        }
        
        if (!owner.firstName || !owner.lastName || !owner.email) {
            return res.status(400).json({
                success: false,
                error: 'Missing required owner information (name, email)'
            });
        }
        
        // Check if vehicle already exists
        const existingVehicle = vehicles.find(v => v.vin === vehicle.vin || v.plateNumber === vehicle.plateNumber);
        if (existingVehicle) {
            return res.status(409).json({
                success: false,
                error: 'Vehicle with this VIN or plate number already exists'
            });
        }
        
        // Create comprehensive vehicle record
        const newVehicle = {
            id: registrationData.id || 'VH' + String(vehicles.length + 1).padStart(3, '0'),
            vin: vehicle.vin,
            plateNumber: vehicle.plateNumber,
            make: vehicle.make,
            model: vehicle.model,
            year: vehicle.year,
            color: vehicle.color,
            engineNumber: vehicle.engineNumber,
            chassisNumber: vehicle.chassisNumber,
            vehicleType: vehicle.vehicleType || 'PASSENGER',
            fuelType: vehicle.fuelType || 'GASOLINE',
            transmission: vehicle.transmission || 'AUTOMATIC',
            engineDisplacement: vehicle.engineDisplacement || '1.5L',
            ownerId: owner.id || 'OWN' + String(Date.now()).slice(-6),
            ownerName: `${owner.firstName} ${owner.lastName}`,
            owner: {
                id: owner.id || 'OWN' + String(Date.now()).slice(-6),
                firstName: owner.firstName,
                lastName: owner.lastName,
                email: owner.email,
                phone: owner.phone,
                address: owner.address,
                idType: owner.idType,
                idNumber: owner.idNumber,
                dateOfBirth: owner.dateOfBirth,
                nationality: owner.nationality || 'Filipino'
            },
            status: 'SUBMITTED',
            verificationStatus: {
                insurance: 'PENDING',
                emission: 'PENDING',
                admin: 'PENDING'
            },
            documents: registrationData.documents || {},
            notes: {
                admin: '',
                insurance: '',
                emission: ''
            },
            registrationDate: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            priority: registrationData.priority || 'MEDIUM',
            history: [{
                action: 'REGISTERED',
                timestamp: new Date().toISOString(),
                performedBy: owner.id || 'SYSTEM',
                details: 'Vehicle registration submitted'
            }]
        };
        
        // Store in local database
        vehicles.push(newVehicle);
        
        // Register on blockchain
        try {
            const blockchainResult = await fabricService.registerVehicle(newVehicle);
            console.log('✅ Vehicle registered on blockchain:', blockchainResult);
            
            // Update status to reflect blockchain registration
            newVehicle.status = 'REGISTERED';
            newVehicle.blockchainTxId = blockchainResult.transactionId;
            
        } catch (blockchainError) {
            console.error('❌ Blockchain registration failed:', blockchainError);
            // Continue with local registration even if blockchain fails
            newVehicle.status = 'PENDING_BLOCKCHAIN';
            newVehicle.blockchainError = blockchainError.message;
        }
        
        // Send notification (mock)
        try {
            await sendRegistrationNotification(newVehicle);
        } catch (notificationError) {
            console.error('❌ Notification failed:', notificationError);
        }
        
        res.json({
            success: true,
            message: 'Vehicle registration submitted successfully',
            vehicle: newVehicle,
            blockchainStatus: newVehicle.blockchainTxId ? 'REGISTERED' : 'PENDING'
        });
        
    } catch (error) {
        console.error('Vehicle registration error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Register new vehicle (legacy endpoint)
router.post('/', authenticateToken, authorizeRole(['vehicle_owner', 'admin']), (req, res) => {
    try {
        const {
            plateNumber,
            make,
            model,
            year,
            color,
            engineNumber,
            chassisNumber,
            documents,
            ipfsHashes
        } = req.body;

        // Validate required fields
        if (!plateNumber || !make || !model || !year || !color || !engineNumber || !chassisNumber) {
            return res.status(400).json({
                success: false,
                error: 'Missing required vehicle information'
            });
        }

        // Check if vehicle with same plate number already exists
        const existingVehicle = vehicles.find(v => v.plateNumber === plateNumber);
        if (existingVehicle) {
            return res.status(400).json({
                success: false,
                error: 'Vehicle with this plate number already exists'
            });
        }

        // Generate VIN (in production, this would be validated)
        const vin = 'VIN' + Date.now().toString().slice(-9);

        // Create new vehicle record
        const newVehicle = {
            vin,
            plateNumber,
            make,
            model,
            year: parseInt(year),
            color,
            engineNumber,
            chassisNumber,
            ownerId: req.user.userId,
            ownerName: req.user.firstName + ' ' + req.user.lastName,
            registrationDate: new Date().toISOString(),
            status: 'PENDING',
            documents: documents || {},
            ipfsHashes: ipfsHashes || {},
            verificationStatus: {
                insurance: 'PENDING',
                emission: 'PENDING',
                admin: 'PENDING'
            },
            history: [{
                action: 'REGISTERED',
                timestamp: new Date().toISOString(),
                performedBy: req.user.userId,
                details: 'Vehicle registration submitted'
            }]
        };

        vehicles.push(newVehicle);

        res.status(201).json({
            success: true,
            message: 'Vehicle registered successfully',
            vehicle: newVehicle
        });

    } catch (error) {
        console.error('Register vehicle error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Update vehicle verification status
router.put('/:vin/verification', authenticateToken, authorizeRole(['admin', 'insurance_verifier', 'emission_verifier']), (req, res) => {
    try {
        const { vin } = req.params;
        const { verificationType, status, notes } = req.body;

        // Validate verification type
        const validTypes = ['insurance', 'emission', 'admin'];
        if (!validTypes.includes(verificationType)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid verification type'
            });
        }

        // Validate status
        const validStatuses = ['PENDING', 'APPROVED', 'REJECTED'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid status'
            });
        }

        // Check role permissions
        if (req.user.role === 'insurance_verifier' && verificationType !== 'insurance') {
            return res.status(403).json({
                success: false,
                error: 'Insufficient permissions for this verification type'
            });
        }

        if (req.user.role === 'emission_verifier' && verificationType !== 'emission') {
            return res.status(403).json({
                success: false,
                error: 'Insufficient permissions for this verification type'
            });
        }

        // Find vehicle
        const vehicleIndex = vehicles.findIndex(v => v.vin === vin);
        if (vehicleIndex === -1) {
            return res.status(404).json({
                success: false,
                error: 'Vehicle not found'
            });
        }

        // Update verification status
        vehicles[vehicleIndex].verificationStatus[verificationType] = status;
        vehicles[vehicleIndex].lastUpdated = new Date().toISOString();

        // Add to history
        vehicles[vehicleIndex].history.push({
            action: `${verificationType.toUpperCase()}_${status}`,
            timestamp: new Date().toISOString(),
            performedBy: req.user.userId,
            details: notes || `${verificationType} verification ${status.toLowerCase()}`
        });

        // Check if all verifications are complete
        const verifications = vehicles[vehicleIndex].verificationStatus;
        if (verifications.insurance === 'APPROVED' && 
            verifications.emission === 'APPROVED' && 
            verifications.admin === 'APPROVED') {
            vehicles[vehicleIndex].status = 'REGISTERED';
        }

        res.json({
            success: true,
            message: 'Verification status updated successfully',
            vehicle: vehicles[vehicleIndex]
        });

    } catch (error) {
        console.error('Update verification error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Get vehicle history
router.get('/:vin/history', authenticateToken, (req, res) => {
    try {
        const { vin } = req.params;
        const vehicle = vehicles.find(v => v.vin === vin);

        if (!vehicle) {
            return res.status(404).json({
                success: false,
                error: 'Vehicle not found'
            });
        }

        // Check if user has permission to view this vehicle
        if (req.user.role !== 'admin' && vehicle.ownerId !== req.user.userId) {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }

        res.json({
            success: true,
            history: vehicle.history
        });

    } catch (error) {
        console.error('Get vehicle history error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Transfer vehicle ownership
router.put('/:vin/transfer', authenticateToken, authorizeRole(['vehicle_owner', 'admin']), (req, res) => {
    try {
        const { vin } = req.params;
        const { newOwnerId, newOwnerName, transferData } = req.body;

        if (!newOwnerId || !newOwnerName) {
            return res.status(400).json({
                success: false,
                error: 'New owner information is required'
            });
        }

        // Find vehicle
        const vehicleIndex = vehicles.findIndex(v => v.vin === vin);
        if (vehicleIndex === -1) {
            return res.status(404).json({
                success: false,
                error: 'Vehicle not found'
            });
        }

        // Check if user has permission to transfer this vehicle
        if (req.user.role !== 'admin' && vehicles[vehicleIndex].ownerId !== req.user.userId) {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }

        // Check if all verifications are approved
        const verifications = vehicles[vehicleIndex].verificationStatus;
        if (verifications.insurance !== 'APPROVED' || 
            verifications.emission !== 'APPROVED' || 
            verifications.admin !== 'APPROVED') {
            return res.status(400).json({
                success: false,
                error: 'Vehicle must be fully verified before ownership transfer'
            });
        }

        const previousOwnerId = vehicles[vehicleIndex].ownerId;
        const previousOwnerName = vehicles[vehicleIndex].ownerName;

        // Update ownership
        vehicles[vehicleIndex].ownerId = newOwnerId;
        vehicles[vehicleIndex].ownerName = newOwnerName;
        vehicles[vehicleIndex].ownershipTransferDate = new Date().toISOString();
        vehicles[vehicleIndex].lastUpdated = new Date().toISOString();

        // Reset verification status for new owner
        vehicles[vehicleIndex].verificationStatus = {
            insurance: 'PENDING',
            emission: 'PENDING',
            admin: 'PENDING'
        };

        // Add to history
        vehicles[vehicleIndex].history.push({
            action: 'OWNERSHIP_TRANSFERRED',
            timestamp: new Date().toISOString(),
            performedBy: req.user.userId,
            details: `Ownership transferred from ${previousOwnerName} to ${newOwnerName}`,
            transferData: transferData
        });

        res.json({
            success: true,
            message: 'Ownership transferred successfully',
            vehicle: vehicles[vehicleIndex]
        });

    } catch (error) {
        console.error('Transfer ownership error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
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

    const jwt = require('jsonwebtoken');
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

// Middleware to authorize user roles
function authorizeRole(allowedRoles) {
    return (req, res, next) => {
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                error: 'Insufficient permissions'
            });
        }
        next();
    };
}

// Helper function to send registration notification
async function sendRegistrationNotification(vehicle) {
    try {
        // Mock notification - in production, integrate with email/SMS services
        console.log(`📧 Sending registration notification to ${vehicle.owner.email}`);
        console.log(`📱 Vehicle ${vehicle.plateNumber} (${vehicle.make} ${vehicle.model}) registered successfully`);
        
        // Simulate notification delay
        await new Promise(resolve => setTimeout(resolve, 100));
        
        return {
            success: true,
            message: 'Notification sent successfully'
        };
    } catch (error) {
        console.error('Notification error:', error);
        throw error;
    }
}

module.exports = router;
