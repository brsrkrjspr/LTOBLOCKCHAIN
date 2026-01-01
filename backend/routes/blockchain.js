// TrustChain Blockchain Integration Routes
const express = require('express');
const router = express.Router();
const fabricService = require('../services/optimizedFabricService');
const { optionalAuth } = require('../middleware/auth');

// Validate required environment variables
if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required. Set it in .env file.');
}

// Initialize Fabric service - MANDATORY Fabric connection (no fallbacks)
fabricService.initialize().then(result => {
    if (result && result.mode === 'fabric') {
        console.log('✅ Real Hyperledger Fabric integration active');
    } else {
        throw new Error('Fabric initialization failed - no fallback mode allowed');
    }
}).catch(err => {
    console.error('❌ CRITICAL: Fabric initialization failed:', err.message);
    console.error('⚠️  System requires real Hyperledger Fabric network. Please ensure:');
    console.error('   1. BLOCKCHAIN_MODE=fabric in .env file');
    console.error('   2. Fabric network is running (docker-compose -f docker-compose.fabric.yml up -d)');
    console.error('   3. network-config.json exists and is properly configured');
    console.error('   4. Admin user is enrolled in wallet');
    process.exit(1); // Exit if Fabric connection fails
});

// NOTE: Mock service removed - system requires real Hyperledger Fabric only

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
                vehicle: result.vehicle
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

        // Query blockchain chaincode from Fabric
        const result = await fabricService.getVehiclesByOwner(ownerId);

        if (result.success) {
            res.json({
                success: true,
                vehicles: result.vehicles || [],
                count: result.vehicles ? result.vehicles.length : 0
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Failed to query vehicles from Fabric blockchain'
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

        // Query blockchain chaincode from Fabric
        const result = await fabricService.getVehicleHistory(vin);

        if (result.success) {
            res.json({
                success: true,
                history: result.history || []
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'Vehicle history not found on Fabric blockchain'
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

        // Invoke blockchain chaincode on Fabric
        const newOwnerData = {
            id: newOwnerId,
            email: newOwnerId, // Assuming ownerId is email
            name: newOwnerName
        };
        const result = await fabricService.transferOwnership(vin, newOwnerData, transferData);

        if (result.success) {
            res.json({
                success: true,
                message: 'Ownership transferred on Fabric blockchain successfully',
                transactionId: result.transactionId,
                vin: result.vin,
                newOwner: result.newOwner
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Failed to transfer ownership on Fabric blockchain'
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
router.get('/status', optionalAuth, (req, res) => {
    try {
        const fabricStatus = fabricService.getStatus();
        
        const status = {
            networkName: process.env.FABRIC_NETWORK_NAME || 'trustchain-network',
            channelName: process.env.FABRIC_CHANNEL_NAME || 'trustchain-channel',
            chaincodeName: process.env.FABRIC_CHAINCODE_NAME || 'vehicle-registration',
            chaincodeVersion: process.env.FABRIC_CHAINCODE_VERSION || '1.0',
            status: fabricStatus.isConnected ? 'CONNECTED' : 'DISCONNECTED',
            network: fabricStatus.network,
            channel: fabricStatus.channel,
            contract: fabricStatus.contract,
            timestamp: new Date().toISOString(),
            peers: [
                {
                    name: 'peer0.lto.example.com',
                    status: fabricStatus.isConnected ? 'UP' : 'DOWN',
                    port: 7051
                },
                {
                    name: 'peer0.insurance.example.com',
                    status: fabricStatus.isConnected ? 'UP' : 'DOWN',
                    port: 8051
                },
                {
                    name: 'peer0.emission.example.com',
                    status: fabricStatus.isConnected ? 'UP' : 'DOWN',
                    port: 9051
                }
            ],
            orderer: {
                name: 'orderer.example.com',
                status: fabricStatus.isConnected ? 'UP' : 'DOWN',
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

// Get recent transactions from Fabric
router.get('/transactions', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const { limit = 10, offset = 0 } = req.query;

        // Query transactions from Fabric
        const allTransactions = await fabricService.getAllTransactions();
        
        // Apply pagination
        const limitNum = parseInt(limit);
        const offsetNum = parseInt(offset);
        const paginatedTransactions = allTransactions.slice(offsetNum, offsetNum + limitNum);

        res.json({
            success: true,
            transactions: paginatedTransactions,
            pagination: {
                total: allTransactions.length,
                limit: limitNum,
                offset: offsetNum,
                hasMore: offsetNum + limitNum < allTransactions.length
            },
            source: 'Hyperledger Fabric'
        });

    } catch (error) {
        console.error('Get transactions from Fabric error:', error);
        res.status(500).json({
            success: false,
            error: `Failed to get transactions from Fabric: ${error.message}`
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
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
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

// GET /api/blockchain/transactions/:txId - Get transaction details by ID
// Public endpoint - optional auth for enhanced details
router.get('/transactions/:txId', optionalAuth, async (req, res) => {
    try {
        const { txId } = req.params;
        
        if (!txId || txId === 'undefined' || txId === 'null') {
            return res.status(400).json({
                success: false,
                error: 'Transaction ID is required'
            });
        }
        
        const db = require('../database/db');
        
        // Helper function to get transaction from database
        const getTransactionFromDatabase = async (txId) => {
            const historyResult = await db.query(
                `SELECT vh.*, v.vin, v.plate_number, v.status as vehicle_status
                 FROM vehicle_history vh
                 JOIN vehicles v ON vh.vehicle_id = v.id
                 WHERE vh.transaction_id = $1
                 ORDER BY vh.performed_at DESC
                 LIMIT 1`,
                [txId]
            );
            
            if (historyResult.rows.length > 0) {
                const history = historyResult.rows[0];
                const vehicleStatus = history.vehicle_status;
                const isPending = vehicleStatus === 'PENDING_BLOCKCHAIN' || vehicleStatus === 'SUBMITTED';
                
                return {
                    success: true,
                    transaction: {
                        txId: history.transaction_id,
                        timestamp: history.performed_at,
                        vehicleVin: history.vin,
                        vehiclePlate: history.plate_number,
                        action: history.action,
                        description: history.description || `${history.action} transaction`,
                        validationCode: isPending ? 'PENDING' : 'VALID',
                        source: 'database',
                        vehicleStatus: vehicleStatus,
                        isPending: isPending
                    }
                };
            }
            return null;
        };
        
        // Try to get from database first (faster and more reliable)
        const dbResult = await getTransactionFromDatabase(txId);
        if (dbResult) {
            // If transaction is pending, return 202 (Accepted) instead of 200
            if (dbResult.transaction.isPending) {
                return res.status(202).json({
                    ...dbResult,
                    message: 'Transaction is pending blockchain confirmation'
                });
            }
            return res.json(dbResult);
        }
        
        // If not in database, check if txId is a UUID (vehicle ID) - this means transaction hasn't been indexed yet
        // UUIDs have format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (contains hyphens)
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(txId);
        if (isUuid) {
            console.log(`🔍 Received UUID ${txId}, attempting vehicle lookup...`);
            
            try {
                const vehicle = await db.getVehicleById(txId);
                if (vehicle && vehicle.vin) {
                    const fabricService = require('../services/optimizedFabricService');
                    
                    // Ensure real Fabric service
                    if (fabricService.mode !== 'fabric') {
                        return res.status(503).json({
                            success: false,
                            error: 'Blockchain service unavailable',
                            message: 'Real Hyperledger Fabric connection required for verification'
                        });
                    }
                    
                    // Query Fabric by VIN
                    const blockchainResult = await fabricService.getVehicle(vehicle.vin);
                    if (blockchainResult && blockchainResult.success && blockchainResult.vehicle) {
                        const blockchainVehicle = blockchainResult.vehicle;
                        // Found on blockchain - return verification data
                        return res.json({
                            success: true,
                            transaction: {
                                txId: blockchainVehicle.lastTxId || blockchainVehicle.transactionId || blockchainVehicle.blockchainTxId || txId,
                                timestamp: blockchainVehicle.lastUpdated || blockchainVehicle.registrationDate || blockchainVehicle.timestamp || vehicle.created_at,
                                vehicleVin: vehicle.vin,
                                vehiclePlate: vehicle.plate_number,
                                action: 'VEHICLE_REGISTRATION',
                                description: 'Vehicle registered on blockchain',
                                validationCode: 'VALID',
                                source: 'blockchain_ledger',
                                vehicleStatus: vehicle.status,
                                isPending: false,
                                // Include blockchain proof data
                                blockchainData: {
                                    make: blockchainVehicle.make,
                                    model: blockchainVehicle.model,
                                    year: blockchainVehicle.year,
                                    engineNumber: blockchainVehicle.engineNumber,
                                    chassisNumber: blockchainVehicle.chassisNumber,
                                    plateNumber: blockchainVehicle.plateNumber,
                                    registrationDate: blockchainVehicle.registrationDate || blockchainVehicle.lastUpdated
                                }
                            }
                        });
                    }
                }
            } catch (lookupError) {
                console.warn('UUID lookup failed:', lookupError.message);
            }
            
            // UUID provided but vehicle not found on blockchain
            return res.status(404).json({
                success: false,
                error: 'Transaction not found',
                message: 'This appears to be a vehicle ID. The blockchain transaction could not be located. The vehicle may not yet be registered on the blockchain.',
                isVehicleId: true
            });
        }
        
        // Original 404 response for non-UUID transaction IDs not found
        return res.status(404).json({
            success: false,
            error: 'Transaction not found',
            message: 'The specified transaction ID was not found on the blockchain ledger.'
        });
        
    } catch (error) {
        console.error('Error getting transaction:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to retrieve transaction'
        });
    }
});

module.exports = router;
