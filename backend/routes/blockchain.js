// TrustChain Blockchain Integration Routes
const express = require('express');
const router = express.Router();
const fabricService = require('../services/optimizedFabricService');
const { optionalAuth } = require('../middleware/auth');

// CSR certificate generation and email for pre-minted vehicles (lazy load to avoid circular deps)
const getCsrServices = () => {
    return {
        certificatePdfGenerator: require('../services/certificatePdfGenerator'),
        certificateEmailService: require('../services/certificateEmailService'),
        certificateNumberGenerator: require('../utils/certificateNumberGenerator')
    };
};

/** Email address to auto-send CSR certificate for every minted vehicle (configurable via env) */
const PREMINTED_CSR_EMAIL = process.env.PREMINTED_CSR_EMAIL || 'ltolipablockchain@gmail.com';

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
    console.error('   2. Fabric network is running (docker-compose -f docker-compose.unified.yml up -d)');
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

// POST /api/blockchain/vehicles/mint - Mint new pre-minted vehicle
// STRICT: Only LTO admin can mint vehicles
router.post('/vehicles/mint', authenticateToken, async (req, res) => {
    try {
        // Only LTO admin can mint
        if (!['admin', 'lto_admin'].includes(req.user.role)) {
            return res.status(403).json({ 
                success: false, 
                error: 'Unauthorized: Only LTO admin can mint vehicles' 
            });
        }
        
        const vehicleData = req.body;
        
        // Validate required fields
        if (!vehicleData.vin || !vehicleData.make || !vehicleData.model || !vehicleData.year) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: VIN, make, model, year'
            });
        }
        
        // Initialize Fabric service with user context
        await fabricService.initialize({ role: req.user.role, email: req.user.email });
        
        // Mint vehicle on Fabric
        const result = await fabricService.mintVehicle(vehicleData);

        // Generate CSR certificate for the minted vehicle: bind to vehicle (IPFS + on-chain hash), then email
        try {
            const { certificatePdfGenerator, certificateEmailService, certificateNumberGenerator } = getCsrServices();
            const csrNumber = certificateNumberGenerator.generateCsrNumber();
            const issuanceDate = new Date().toISOString();
            const { pdfBuffer, fileHash, certificateNumber } = await certificatePdfGenerator.generateCsrCertificate({
                dealerName: 'LTO Pre-Minted (CSR Verified)',
                dealerLtoNumber: `LTO-PM-${Math.floor(1000 + Math.random() * 9000)}`,
                vehicleMake: vehicleData.make,
                vehicleModel: vehicleData.model,
                vehicleVariant: vehicleData.vehicleType || '',
                vehicleYear: vehicleData.year,
                bodyType: vehicleData.vehicleType || 'Car',
                color: vehicleData.color || '',
                fuelType: 'Gasoline',
                engineNumber: vehicleData.engineNumber || certificatePdfGenerator.generateRandomEngineNumber(),
                vehicleVIN: vehicleData.vin,
                issuanceDate,
                csrNumber
            });
            let csrIpfsCid = null;
            const ipfsService = require('../services/ipfsService');
            if (ipfsService.isAvailable()) {
                try {
                    const ipfsResult = await ipfsService.storeBuffer(pdfBuffer, { originalName: `CSR_${certificateNumber || csrNumber}_${vehicleData.vin}.pdf` });
                    csrIpfsCid = ipfsResult.cid;
                } catch (ipfsErr) {
                    console.warn('[Mint] IPFS store for CSR failed (hash will still be bound):', ipfsErr.message);
                }
            }
            await fabricService.updateCertificateHash(vehicleData.vin, 'csr', fileHash, csrIpfsCid);
            await certificateEmailService.sendCsrCertificate({
                to: PREMINTED_CSR_EMAIL,
                dealerName: 'LTO Pre-Minted (CSR Verified)',
                csrNumber: certificateNumber || csrNumber,
                vehicleVIN: vehicleData.vin,
                vehicleMake: vehicleData.make,
                vehicleModel: vehicleData.model,
                pdfBuffer
            });
            console.log(`[Mint] CSR certificate bound to VIN ${vehicleData.vin} (IPFS: ${csrIpfsCid || 'n/a'}) and sent to ${PREMINTED_CSR_EMAIL}`);
        } catch (csrError) {
            console.error('[Mint] CSR generation or email failed (vehicle was still minted):', csrError.message);
            // Do not fail the mint response; vehicle is already on Fabric
        }

        // Generate Sales Invoice for the minted vehicle: bind to vehicle (IPFS + on-chain hash), then email
        try {
            const { certificatePdfGenerator, certificateEmailService, certificateNumberGenerator } = getCsrServices();
            const invoiceNumber = certificateNumberGenerator.generateSalesInvoiceNumber();
            const dateOfSale = new Date().toISOString();
            const purchasePrice = Math.floor(500000 + Math.random() * 2000000); // Random price: 500k-2.5M PHP
            
            const { pdfBuffer: salesInvoicePdf, fileHash: salesInvoiceHash, certificateNumber: salesInvoiceCertNumber } = await certificatePdfGenerator.generateSalesInvoice({
                ownerName: 'LTO Pre-Minted (CSR Verified)',
                vehicleVIN: vehicleData.vin,
                vehiclePlate: vehicleData.plateNumber || '',
                vehicleMake: vehicleData.make,
                vehicleModel: vehicleData.model,
                vehicleYear: vehicleData.year,
                bodyType: vehicleData.vehicleType || 'Car',
                color: vehicleData.color || '',
                fuelType: 'Gasoline',
                engineNumber: vehicleData.engineNumber || certificatePdfGenerator.generateRandomEngineNumber(),
                invoiceNumber,
                dateOfSale,
                purchasePrice,
                sellerName: 'LTO Pre-Minted Dealer',
                sellerPosition: 'Authorized Dealer',
                dealerName: 'LTO Pre-Minted (CSR Verified)',
                dealerTin: `TIN-${Math.floor(100000000 + Math.random() * 900000000)}`,
                dealerAccreditationNo: `LTO-ACC-${Math.floor(10000 + Math.random() * 90000)}`
            });
            let salesInvoiceIpfsCid = null;
            const ipfsServiceSI = require('../services/ipfsService');
            if (ipfsServiceSI.isAvailable()) {
                try {
                    const ipfsResult = await ipfsServiceSI.storeBuffer(salesInvoicePdf, { originalName: `SalesInvoice_${salesInvoiceCertNumber || invoiceNumber}_${vehicleData.vin}.pdf` });
                    salesInvoiceIpfsCid = ipfsResult.cid;
                } catch (ipfsErr) {
                    console.warn('[Mint] IPFS store for Sales Invoice failed (hash will still be bound):', ipfsErr.message);
                }
            }
            await fabricService.updateCertificateHash(vehicleData.vin, 'sales_invoice', salesInvoiceHash, salesInvoiceIpfsCid);
            await certificateEmailService.sendSalesInvoice({
                to: PREMINTED_CSR_EMAIL,
                ownerName: 'LTO Pre-Minted (CSR Verified)',
                invoiceNumber: salesInvoiceCertNumber || invoiceNumber,
                vehicleVIN: vehicleData.vin,
                vehicleMake: vehicleData.make,
                vehicleModel: vehicleData.model,
                pdfBuffer: salesInvoicePdf
            });
            console.log(`[Mint] Sales Invoice bound to VIN ${vehicleData.vin} (IPFS: ${salesInvoiceIpfsCid || 'n/a'}) and sent to ${PREMINTED_CSR_EMAIL}`);
        } catch (salesInvoiceError) {
            console.error('[Mint] Sales Invoice generation or email failed (vehicle was still minted):', salesInvoiceError.message);
            // Do not fail the mint response; vehicle is already on Fabric
        }

        res.json({
            success: true,
            message: 'Vehicle minted successfully on Fabric',
            transactionId: result.transactionId,
            vin: result.vin,
            status: result.status
        });
        
    } catch (error) {
        console.error('Mint vehicle error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to mint vehicle'
        });
    }
});

// GET /api/blockchain/vehicles - Get all vehicles from Fabric
// STRICT: Only LTO staff can query
router.get('/vehicles', authenticateToken, async (req, res) => {
    try {
        // Only LTO staff can query
        if (!['admin', 'lto_admin', 'lto_officer'].includes(req.user.role)) {
            return res.status(403).json({ 
                success: false, 
                error: 'Unauthorized' 
            });
        }
        
        const { status } = req.query;
        
        // Initialize Fabric service with user context
        await fabricService.initialize({ role: req.user.role, email: req.user.email });
        
        // Get all vehicles from Fabric
        const allVehicles = await fabricService.getAllTransactions({ 
            role: req.user.role, 
            email: req.user.email 
        });
        
        // Filter by status if provided
        let vehicles = allVehicles;
        if (status) {
            const statusUpper = status.toUpperCase();
            vehicles = allVehicles.filter(v => v.status === statusUpper);
        }
        
        res.json({
            success: true,
            vehicles: vehicles,
            count: vehicles.length,
            source: 'Hyperledger Fabric'
        });
        
    } catch (error) {
        console.error('Get vehicles from Fabric error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get vehicles from Fabric'
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
// STRICT: Allow admin, lto_admin, and lto_officer (all have blockchain.view permission)
router.get('/transactions', authenticateToken, authorizeRole(['admin', 'lto_admin', 'lto_officer']), async (req, res) => {
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
// STRICT FABRIC ENFORCEMENT: Transaction MUST exist on Fabric to be returned
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
        
        // STRICT FABRIC: Ensure Fabric service is available
        if (fabricService.mode !== 'fabric') {
            return res.status(503).json({
                success: false,
                error: 'Blockchain service unavailable',
                message: 'Real Hyperledger Fabric connection required for transaction verification'
            });
        }
        
        // Ensure Fabric connection
        if (!fabricService.isConnected) {
            try {
                await fabricService.initialize();
            } catch (initError) {
                console.error('❌ Failed to initialize Fabric connection:', initError.message);
                return res.status(503).json({
                    success: false,
                    error: 'Blockchain service unavailable',
                    message: 'Failed to connect to Hyperledger Fabric network'
                });
            }
        }
        
        // Check if txId is a UUID (vehicle ID) - handle differently
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(txId);
        if (isUuid) {
            console.log(`🔍 Received UUID ${txId}, attempting vehicle lookup...`);
            
            try {
                const vehicle = await db.getVehicleById(txId);
                if (vehicle && vehicle.vin) {
                    // Query Fabric by VIN to get actual transaction ID
                    const blockchainResult = await fabricService.getVehicle(vehicle.vin);
                    if (blockchainResult && blockchainResult.success && blockchainResult.vehicle) {
                        const blockchainVehicle = blockchainResult.vehicle;
                        const actualTxId = blockchainVehicle.lastTxId || blockchainVehicle.transactionId || blockchainVehicle.blockchainTxId;
                        
                        if (actualTxId) {
                            // Verify the actual transaction ID on Fabric
                            try {
                                const transactionProof = await fabricService.getTransactionProof(actualTxId);
                                
                                if (transactionProof && transactionProof.validationCode === 0) {
                                    return res.json({
                                        success: true,
                                        transaction: {
                                            txId: actualTxId,
                                            timestamp: transactionProof.timestamp || blockchainVehicle.lastUpdated || blockchainVehicle.registrationDate || vehicle.created_at,
                                            vehicleVin: vehicle.vin,
                                            vehiclePlate: vehicle.plate_number,
                                            action: 'VEHICLE_REGISTRATION',
                                            description: 'Vehicle registered on blockchain',
                                            validationCode: 'VALID',
                                            validationCodeName: 'VALID',
                                            source: 'fabric_verified',
                                            vehicleStatus: vehicle.status,
                                            isPending: false,
                                            fabricVerified: true,
                                            blockNumber: transactionProof.block?.number || null,
                                            blockHash: transactionProof.block?.hash || null,
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
                                } else {
                                    return res.status(404).json({
                                        success: false,
                                        error: 'Transaction validation failed',
                                        message: `Transaction ${actualTxId} found on Fabric but validation code is ${transactionProof?.validationCodeName || 'INVALID'}`,
                                        validationCode: transactionProof?.validationCode,
                                        validationCodeName: transactionProof?.validationCodeName
                                    });
                                }
                            } catch (proofError) {
                                console.error(`❌ Failed to verify transaction ${actualTxId} on Fabric:`, proofError.message);
                                return res.status(404).json({
                                    success: false,
                                    error: 'Transaction verification failed',
                                    message: `Transaction ID ${actualTxId} could not be verified on Fabric: ${proofError.message}`
                                });
                            }
                        }
                    }
                }
            } catch (lookupError) {
                console.warn('UUID lookup failed:', lookupError.message);
            }
            
            // UUID provided but vehicle not found on blockchain
            return res.status(404).json({
                success: false,
                error: 'Transaction not found',
                message: 'This appears to be a vehicle ID. The blockchain transaction could not be located on Fabric. The vehicle may not yet be registered on the blockchain.',
                isVehicleId: true
            });
        }
        
        // STRICT FABRIC: For non-UUID transaction IDs, MUST verify on Fabric
        // Validate transaction ID format (should be 64-char hex for Fabric)
        const isValidFabricTxId = /^[a-f0-9]{64}$/i.test(txId);
        if (!isValidFabricTxId) {
            return res.status(400).json({
                success: false,
                error: 'Invalid transaction ID format',
                message: 'Transaction ID must be a 64-character hexadecimal string (Fabric transaction ID format)',
                providedFormat: txId.length < 50 ? 'short' : txId.includes('-') ? 'uuid' : 'unknown'
            });
        }
        
        // STRICT FABRIC: Verify transaction exists on Fabric FIRST
        let transactionProof = null;
        try {
            console.log(`🔍 STRICT FABRIC: Verifying transaction ${txId.substring(0, 20)}... on Fabric...`);
            transactionProof = await fabricService.getTransactionProof(txId);
            
            if (!transactionProof) {
                throw new Error('Transaction proof returned null');
            }
            
            if (transactionProof.validationCode !== 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Transaction validation failed',
                    message: `Transaction found on Fabric but validation code is ${transactionProof.validationCodeName || 'INVALID'}`,
                    validationCode: transactionProof.validationCode,
                    validationCodeName: transactionProof.validationCodeName,
                    fabricVerified: false
                });
            }
            
            console.log(`✅ STRICT FABRIC: Transaction ${txId.substring(0, 20)}... verified on Fabric (Block ${transactionProof.block?.number})`);
        } catch (fabricError) {
            console.error(`❌ STRICT FABRIC: Transaction ${txId.substring(0, 20)}... NOT FOUND on Fabric:`, fabricError.message);
            
            // Even if found in database, reject if not on Fabric
            return res.status(404).json({
                success: false,
                error: 'Transaction not found on blockchain',
                message: `Transaction ID ${txId} does not exist on Hyperledger Fabric ledger. This transaction may be invalid or the database record may be corrupted.`,
                fabricError: fabricError.message,
                fabricVerified: false,
                strictEnforcement: true
            });
        }
        
        // Transaction verified on Fabric - now get additional details from database if available
        let dbTransaction = null;
        try {
            const historyResult = await db.query(
                `SELECT vh.*, v.vin, v.plate_number, v.status as vehicle_status, v.make, v.model, v.year, v.color
                 FROM vehicle_history vh
                 JOIN vehicles v ON vh.vehicle_id = v.id
                 WHERE vh.transaction_id = $1
                 ORDER BY vh.performed_at DESC
                 LIMIT 1`,
                [txId]
            );
            
            if (historyResult.rows.length > 0) {
                dbTransaction = historyResult.rows[0];
            }
        } catch (dbError) {
            console.warn('Could not fetch transaction from database:', dbError.message);
            // Continue without database data - Fabric verification is primary
        }
        
        // Build response with Fabric-verified data
        const response = {
            success: true,
            transaction: {
                txId: txId,
                timestamp: transactionProof.timestamp || (dbTransaction ? dbTransaction.performed_at : null),
                vehicleVin: dbTransaction?.vin || null,
                vehiclePlate: dbTransaction?.plate_number || null,
                action: dbTransaction?.action || 'BLOCKCHAIN_TRANSACTION',
                description: dbTransaction?.description || 'Blockchain transaction verified on Fabric',
                validationCode: transactionProof.validationCode,
                validationCodeName: transactionProof.validationCodeName,
                source: 'fabric_verified',
                vehicleStatus: dbTransaction?.vehicle_status || null,
                isPending: false,
                fabricVerified: true,
                blockNumber: transactionProof.block?.number || null,
                blockHash: transactionProof.block?.hash || null,
                previousBlockHash: transactionProof.block?.previousHash || null,
                txIndex: transactionProof.txIndex || null,
                txCount: transactionProof.txCount || null,
                channelId: transactionProof.channelId || null,
                creatorMspId: transactionProof.creatorMspId || null,
                endorsements: transactionProof.endorsements || []
            }
        };
        
        // Add vehicle details if available from database
        if (dbTransaction) {
            response.transaction.blockchainData = {
                make: dbTransaction.make,
                model: dbTransaction.model,
                year: dbTransaction.year,
                color: dbTransaction.color,
                plateNumber: dbTransaction.plate_number
            };
        }
        
        return res.json(response);
        
    } catch (error) {
        console.error('Error getting transaction:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to retrieve transaction'
        });
    }
});

module.exports = router;
