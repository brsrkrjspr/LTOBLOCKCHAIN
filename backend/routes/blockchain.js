// TrustChain Blockchain Integration Routes
const express = require('express');
const router = express.Router();
const fabricService = require('../services/optimizedFabricService');

// Initialize Fabric service
fabricService.initialize().then(connected => {
    if (connected) {
        console.log('✅ Real Hyperledger Fabric integration active');
    } else {
        console.log('🔄 Using mock blockchain service');
    }
});

// Legacy mock service for fallback
class MockBlockchainService {
    static async invokeChaincode(functionName, args) {
        // Simulate blockchain transaction
        console.log(`Invoking chaincode function: ${functionName} with args:`, args);
        
        // Mock response based on function name
        switch (functionName) {
            case 'RegisterVehicle':
                return {
                    success: true,
                    transactionId: 'tx_' + Date.now(),
                    result: {
                        vin: args[0]?.vin || 'VIN' + Date.now(),
                        plateNumber: args[0]?.plateNumber,
                        status: 'REGISTERED'
                    }
                };
            
            case 'GetVehicle':
                return {
                    success: true,
                    result: {
                        vin: args[0],
                        plateNumber: 'ABC-1234',
                        make: 'Toyota',
                        model: 'Vios',
                        year: 2023,
                        status: 'REGISTERED'
                    }
                };
            
            case 'UpdateVerificationStatus':
                return {
                    success: true,
                    transactionId: 'tx_' + Date.now(),
                    result: {
                        vin: args[0],
                        verificationType: args[1],
                        status: args[2]
                    }
                };
            
            default:
                return {
                    success: true,
                    result: 'Mock blockchain response'
                };
        }
    }

    static async queryChaincode(functionName, args) {
        // Simulate blockchain query
        console.log(`Querying chaincode function: ${functionName} with args:`, args);
        
        switch (functionName) {
            case 'GetVehicle':
                return {
                    success: true,
                    result: {
                        vin: args[0],
                        plateNumber: 'ABC-1234',
                        make: 'Toyota',
                        model: 'Vios',
                        year: 2023,
                        status: 'REGISTERED',
                        verificationStatus: {
                            insurance: 'APPROVED',
                            emission: 'APPROVED',
                            admin: 'PENDING'
                        }
                    }
                };
            
            case 'GetVehiclesByOwner':
                return {
                    success: true,
                    result: [
                        {
                            vin: 'VIN123456789',
                            plateNumber: 'ABC-1234',
                            make: 'Toyota',
                            model: 'Vios',
                            year: 2023,
                            status: 'REGISTERED'
                        }
                    ]
                };
            
            default:
                return {
                    success: true,
                    result: 'Mock blockchain query response'
                };
        }
    }
}

// Register vehicle on blockchain
router.post('/vehicles/register', authenticateToken, async (req, res) => {
    try {
        const vehicleData = req.body;

        // Validate required fields
        if (!vehicleData.vin || !vehicleData.plateNumber || !vehicleData.ownerId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required vehicle information'
            });
        }

        // Invoke blockchain chaincode
        const result = await fabricService.registerVehicle(vehicleData);

        if (result.success) {
            res.json({
                success: true,
                message: 'Vehicle registered on blockchain successfully',
                transactionId: result.transactionId,
                vehicle: result.result
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Failed to register vehicle on blockchain'
            });
        }

    } catch (error) {
        console.error('Blockchain register vehicle error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Get vehicle from blockchain
router.get('/vehicles/:vin', authenticateToken, async (req, res) => {
    try {
        const { vin } = req.params;

        // Query blockchain chaincode
        const result = await fabricService.getVehicle(vin);

        if (result.success) {
            res.json({
                success: true,
                vehicle: result.result
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'Vehicle not found on blockchain'
            });
        }

    } catch (error) {
        console.error('Blockchain get vehicle error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Update verification status on blockchain
router.put('/vehicles/:vin/verification', authenticateToken, async (req, res) => {
    try {
        const { vin } = req.params;
        const { verificationType, status, notes } = req.body;

        // Validate parameters
        if (!verificationType || !status) {
            return res.status(400).json({
                success: false,
                error: 'Verification type and status are required'
            });
        }

        // Invoke blockchain chaincode
        const result = await fabricService.updateVerificationStatus(vin, verificationType, status, notes);

        if (result.success) {
            res.json({
                success: true,
                message: 'Verification status updated on blockchain successfully',
                transactionId: result.transactionId,
                result: result.result
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Failed to update verification status on blockchain'
            });
        }

    } catch (error) {
        console.error('Blockchain update verification error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Get vehicles by owner from blockchain
router.get('/vehicles/owner/:ownerId', authenticateToken, async (req, res) => {
    try {
        const { ownerId } = req.params;

        // Check if user has permission to view these vehicles
        if (req.user.role !== 'admin' && req.user.userId !== ownerId) {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }

        // Query blockchain chaincode
        const result = await MockBlockchainService.queryChaincode('GetVehiclesByOwner', [ownerId]);

        if (result.success) {
            res.json({
                success: true,
                vehicles: result.result,
                count: result.result.length
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Failed to query vehicles from blockchain'
            });
        }

    } catch (error) {
        console.error('Blockchain get vehicles by owner error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Get vehicle history from blockchain
router.get('/vehicles/:vin/history', authenticateToken, async (req, res) => {
    try {
        const { vin } = req.params;

        // Query blockchain chaincode
        const result = await MockBlockchainService.queryChaincode('GetVehicleHistory', [vin]);

        if (result.success) {
            res.json({
                success: true,
                history: result.result
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'Vehicle history not found on blockchain'
            });
        }

    } catch (error) {
        console.error('Blockchain get vehicle history error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Transfer vehicle ownership on blockchain
router.put('/vehicles/:vin/transfer', authenticateToken, async (req, res) => {
    try {
        const { vin } = req.params;
        const { newOwnerId, newOwnerName, transferData } = req.body;

        if (!newOwnerId || !newOwnerName) {
            return res.status(400).json({
                success: false,
                error: 'New owner information is required'
            });
        }

        // Invoke blockchain chaincode
        const result = await MockBlockchainService.invokeChaincode('TransferOwnership', [
            vin, newOwnerId, newOwnerName, transferData
        ]);

        if (result.success) {
            res.json({
                success: true,
                message: 'Ownership transferred on blockchain successfully',
                transactionId: result.transactionId,
                result: result.result
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Failed to transfer ownership on blockchain'
            });
        }

    } catch (error) {
        console.error('Blockchain transfer ownership error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Get blockchain network status
router.get('/status', authenticateToken, (req, res) => {
    try {
        const fabricStatus = fabricService.getStatus();
        
        const status = {
            networkName: process.env.FABRIC_NETWORK_NAME || 'trustchain-network',
            channelName: process.env.FABRIC_CHANNEL_NAME || 'trustchain-channel',
            chaincodeName: process.env.FABRIC_CHAINCODE_NAME || 'vehicle-registration',
            chaincodeVersion: process.env.FABRIC_CHAINCODE_VERSION || '1.0',
            status: fabricStatus.connected ? 'CONNECTED' : 'MOCK_MODE',
            network: fabricStatus.network,
            channel: fabricStatus.channel,
            contract: fabricStatus.contract,
            timestamp: new Date().toISOString(),
            peers: [
                {
                    name: 'peer0.lto.example.com',
                    status: fabricStatus.connected ? 'UP' : 'MOCK',
                    port: 7051
                },
                {
                    name: 'peer0.insurance.example.com',
                    status: fabricStatus.connected ? 'UP' : 'MOCK',
                    port: 8051
                },
                {
                    name: 'peer0.emission.example.com',
                    status: fabricStatus.connected ? 'UP' : 'MOCK',
                    port: 9051
                }
            ],
            orderer: {
                name: 'orderer.example.com',
                status: fabricStatus.connected ? 'UP' : 'MOCK',
                port: 7050
            }
        };

        res.json({
            success: true,
            blockchain: status
        });

    } catch (error) {
        console.error('Blockchain status error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get blockchain status'
        });
    }
});

// Get recent transactions
router.get('/transactions', authenticateToken, authorizeRole(['admin']), (req, res) => {
    try {
        const { limit = 10, offset = 0 } = req.query;

        // Mock recent transactions
        const transactions = [
            {
                transactionId: 'tx_1705123456789',
                type: 'RegisterVehicle',
                vin: 'VIN123456789',
                timestamp: new Date().toISOString(),
                status: 'SUCCESS',
                blockNumber: 12345
            },
            {
                transactionId: 'tx_1705123456790',
                type: 'UpdateVerificationStatus',
                vin: 'VIN123456789',
                timestamp: new Date().toISOString(),
                status: 'SUCCESS',
                blockNumber: 12346
            }
        ];

        res.json({
            success: true,
            transactions: transactions.slice(offset, offset + parseInt(limit)),
            pagination: {
                total: transactions.length,
                limit: parseInt(limit),
                offset: parseInt(offset)
            }
        });

    } catch (error) {
        console.error('Get transactions error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get transactions'
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

module.exports = router;
