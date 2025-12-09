// TrustChain LTO - Real Hyperledger Fabric Service
// NO FALLBACKS - Requires real Fabric network connection

const { Gateway, Wallets } = require('fabric-network');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class OptimizedFabricService {
    constructor() {
        this.gateway = new Gateway();
        this.wallet = null;
        this.network = null;
        this.contract = null;
        this.isConnected = false;
        this.mode = 'fabric'; // Always Fabric mode - no fallbacks
    }

    // Initialize connection - MANDATORY Fabric connection (no fallbacks)
    async initialize() {
        // Enforce Fabric mode from environment
        if (process.env.BLOCKCHAIN_MODE !== 'fabric') {
            throw new Error('BLOCKCHAIN_MODE must be set to "fabric" in .env file. No fallbacks allowed.');
        }

        // Check if network configuration exists
        let connectionProfilePath = path.join(__dirname, '../../network-config.json');
        
        if (!fs.existsSync(connectionProfilePath)) {
            // Try YAML file
            connectionProfilePath = path.join(__dirname, '../../network-config.yaml');
            if (!fs.existsSync(connectionProfilePath)) {
                throw new Error('Network configuration file (network-config.json or network-config.yaml) not found. Cannot connect to Fabric.');
            }
            throw new Error('YAML connection profile not supported. Please use network-config.json');
        }
        
        // Load JSON connection profile
        let connectionProfile;
        try {
            connectionProfile = JSON.parse(fs.readFileSync(connectionProfilePath, 'utf8'));
        } catch (error) {
            throw new Error(`Failed to parse network configuration: ${error.message}`);
        }
        
        console.log('🔗 Connecting to Hyperledger Fabric network...');

        // Create wallet
        const walletPath = path.join(__dirname, '../../wallet');
        this.wallet = await Wallets.newFileSystemWallet(walletPath);
        
        // Check if admin user exists in wallet
        const userExists = await this.wallet.get('admin');
        if (!userExists) {
            throw new Error('Admin user not found in wallet. Please enroll admin user first.');
        }

        try {
            // Connect to gateway
            await this.gateway.connect(connectionProfile, {
                wallet: this.wallet,
                identity: 'admin',
                discovery: { enabled: true, asLocalhost: true }
            });

            // Get network and contract
            this.network = await this.gateway.getNetwork('ltochannel');
            this.contract = this.network.getContract('vehicle-registration');

            this.isConnected = true;
            console.log('✅ Connected to Hyperledger Fabric network successfully');

            return { success: true, mode: 'fabric' };

        } catch (error) {
            this.isConnected = false;
            console.error('❌ Failed to connect to Fabric network:', error.message);
            throw new Error(`Fabric connection failed: ${error.message}. Ensure Fabric network is running and properly configured.`);
        }
    }

    // Register vehicle - Fabric only
    async registerVehicle(vehicleData) {
        if (!this.isConnected || this.mode !== 'fabric') {
            throw new Error('Not connected to Fabric network. Cannot register vehicle.');
        }

        try {
            const vehicleJson = JSON.stringify(vehicleData);
            const fabricResult = await this.contract.submitTransaction('RegisterVehicle', vehicleJson);
            
            const result = {
                success: true,
                message: 'Vehicle registered successfully on Fabric',
                transactionId: fabricResult.toString(),
                vin: vehicleData.vin
            };

            console.log(`✅ Vehicle registered on Fabric: ${result.transactionId}`);
            return result;

        } catch (error) {
            console.error('❌ Failed to register vehicle on Fabric:', error);
            throw new Error(`Vehicle registration failed: ${error.message}`);
        }
    }

    // Get vehicle - Fabric only
    async getVehicle(vin) {
        if (!this.isConnected || this.mode !== 'fabric') {
            throw new Error('Not connected to Fabric network. Cannot query vehicle.');
        }

        try {
            const result = await this.contract.evaluateTransaction('GetVehicle', vin);
            const vehicle = JSON.parse(result.toString());
            
            return {
                success: true,
                vehicle: vehicle
            };

        } catch (error) {
            console.error('❌ Failed to get vehicle from Fabric:', error);
            throw new Error(`Vehicle query failed: ${error.message}`);
        }
    }

    // Update verification status - Fabric only
    async updateVerificationStatus(vin, verificationType, status, notes) {
        if (!this.isConnected || this.mode !== 'fabric') {
            throw new Error('Not connected to Fabric network. Cannot update verification status.');
        }

        try {
            const fabricResult = await this.contract.submitTransaction(
                'UpdateVerificationStatus', 
                vin, 
                verificationType, 
                status, 
                notes || ''
            );
            
            const result = {
                success: true,
                message: 'Verification status updated successfully on Fabric',
                transactionId: fabricResult.toString(),
                vin: vin,
                verificationType: verificationType,
                status: status
            };

            console.log(`✅ Verification updated on Fabric: ${result.transactionId}`);
            return result;

        } catch (error) {
            console.error('❌ Failed to update verification status on Fabric:', error);
            throw new Error(`Verification update failed: ${error.message}`);
        }
    }

    // Transfer ownership - Fabric only
    async transferOwnership(vin, newOwnerData, transferData) {
        if (!this.isConnected || this.mode !== 'fabric') {
            throw new Error('Not connected to Fabric network. Cannot transfer ownership.');
        }

        try {
            const newOwnerJson = JSON.stringify(newOwnerData);
            const transferJson = JSON.stringify(transferData);
            
            const result = await this.contract.submitTransaction(
                'TransferOwnership', 
                vin, 
                newOwnerJson, 
                transferJson
            );
            
            return {
                success: true,
                message: 'Ownership transferred successfully on Fabric',
                transactionId: result.toString(),
                vin: vin,
                newOwner: newOwnerData.email
            };

        } catch (error) {
            console.error('❌ Failed to transfer ownership on Fabric:', error);
            throw new Error(`Ownership transfer failed: ${error.message}`);
        }
    }

    // Get vehicles by owner - Fabric only
    async getVehiclesByOwner(ownerEmail) {
        if (!this.isConnected || this.mode !== 'fabric') {
            throw new Error('Not connected to Fabric network. Cannot query vehicles.');
        }

        try {
            const result = await this.contract.evaluateTransaction('GetVehiclesByOwner', ownerEmail);
            const vehicles = JSON.parse(result.toString());
            
            return {
                success: true,
                vehicles: vehicles
            };

        } catch (error) {
            console.error('❌ Failed to get vehicles by owner from Fabric:', error);
            throw new Error(`Vehicle query failed: ${error.message}`);
        }
    }

    // Get vehicle history - Fabric only
    async getVehicleHistory(vin) {
        if (!this.isConnected || this.mode !== 'fabric') {
            throw new Error('Not connected to Fabric network. Cannot query vehicle history.');
        }

        try {
            const result = await this.contract.evaluateTransaction('GetVehicleHistory', vin);
            const history = JSON.parse(result.toString());
            
            return {
                success: true,
                history: history
            };

        } catch (error) {
            console.error('❌ Failed to get vehicle history from Fabric:', error);
            throw new Error(`History query failed: ${error.message}`);
        }
    }

    // Get system statistics - Fabric only
    async getSystemStats() {
        if (!this.isConnected || this.mode !== 'fabric') {
            throw new Error('Not connected to Fabric network. Cannot query system stats.');
        }

        try {
            const result = await this.contract.evaluateTransaction('GetSystemStats');
            const stats = JSON.parse(result.toString());
            
            return {
                success: true,
                stats: stats
            };

        } catch (error) {
            console.error('❌ Failed to get system stats from Fabric:', error);
            throw new Error(`Stats query failed: ${error.message}`);
        }
    }

    // Get transaction status by polling the ledger - Fabric only
    async getTransactionStatus(transactionId, vin, maxRetries = 10, retryDelay = 2000) {
        if (!this.isConnected || this.mode !== 'fabric') {
            throw new Error('Not connected to Fabric network. Cannot check transaction status.');
        }

        try {
            // Poll by checking if vehicle exists on ledger
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    const vehicleResult = await this.getVehicle(vin);
                    
                    if (vehicleResult.success && vehicleResult.vehicle) {
                        const vehicle = vehicleResult.vehicle;
                        
                        // Check if this vehicle has the matching transaction ID
                        if (vehicle.blockchainTxId === transactionId || 
                            vehicle.history?.some(h => h.transactionId === transactionId)) {
                            return {
                                status: 'committed',
                                transactionId: transactionId,
                                vin: vin,
                                blockNumber: vehicle.blockNumber || null,
                                timestamp: vehicle.lastUpdated || vehicle.registrationDate,
                                mode: 'fabric',
                                vehicle: vehicle
                            };
                        }
                    }
                    
                    if (attempt < maxRetries) {
                        await new Promise(resolve => setTimeout(resolve, retryDelay));
                        continue;
                    }
                    
                    return {
                        status: 'pending',
                        transactionId: transactionId,
                        vin: vin,
                        message: 'Transaction submitted but not yet committed after polling',
                        attempts: attempt,
                        mode: 'fabric'
                    };
                    
                } catch (queryError) {
                    if (queryError.message.includes('not found') || queryError.message.includes('does not exist')) {
                        if (attempt < maxRetries) {
                            await new Promise(resolve => setTimeout(resolve, retryDelay));
                            continue;
                        }
                        
                        return {
                            status: 'pending',
                            transactionId: transactionId,
                            vin: vin,
                            message: 'Transaction submitted but vehicle not found on ledger after polling',
                            attempts: attempt,
                            mode: 'fabric'
                        };
                    }
                    
                    throw queryError;
                }
            }
            
            return {
                status: 'pending',
                transactionId: transactionId,
                vin: vin,
                message: 'Transaction status unknown after polling',
                attempts: maxRetries,
                mode: 'fabric'
            };
            
        } catch (error) {
            console.error('❌ Failed to get transaction status from Fabric:', error);
            return {
                status: 'unknown',
                transactionId: transactionId,
                vin: vin,
                error: error.message,
                mode: 'fabric'
            };
        }
    }

    // Get all transactions from Fabric (using chaincode queries)
    async getAllTransactions() {
        if (!this.isConnected || this.mode !== 'fabric') {
            throw new Error('Not connected to Fabric network. Cannot query transactions.');
        }

        try {
            // Query all vehicles from chaincode
            const vehiclesResult = await this.contract.evaluateTransaction('GetAllVehicles');
            const vehicles = JSON.parse(vehiclesResult.toString());
            
            // Build transactions from vehicle histories
            const transactions = [];
            
            vehicles.forEach(vehicle => {
                // Add registration transaction
                if (vehicle.blockchainTxId) {
                    transactions.push({
                        id: vehicle.blockchainTxId,
                        transactionId: vehicle.blockchainTxId,
                        type: 'VEHICLE_REGISTRATION',
                        vin: vehicle.vin,
                        plateNumber: vehicle.plateNumber || '',
                        owner: vehicle.owner || null,
                        timestamp: vehicle.registrationDate || vehicle.createdAt || new Date().toISOString(),
                        status: 'CONFIRMED',
                        hash: vehicle.blockchainTxId,
                        data: {
                            make: vehicle.make,
                            model: vehicle.model,
                            year: vehicle.year,
                            color: vehicle.color,
                            vehicleType: vehicle.vehicleType
                        }
                    });
                }
                
                // Add history entries as transactions
                if (vehicle.history && Array.isArray(vehicle.history)) {
                    vehicle.history.forEach(historyEntry => {
                        transactions.push({
                            id: historyEntry.transactionId || `tx_${vehicle.vin}_${historyEntry.timestamp}`,
                            transactionId: historyEntry.transactionId || `tx_${vehicle.vin}_${historyEntry.timestamp}`,
                            type: historyEntry.action || 'HISTORY_ENTRY',
                            vin: vehicle.vin,
                            plateNumber: vehicle.plateNumber || '',
                            owner: vehicle.owner || null,
                            timestamp: historyEntry.timestamp || new Date().toISOString(),
                            status: 'CONFIRMED',
                            hash: historyEntry.transactionId || `tx_${vehicle.vin}_${historyEntry.timestamp}`,
                            data: {
                                action: historyEntry.action,
                                details: historyEntry.details,
                                performedBy: historyEntry.performedBy,
                                notes: historyEntry.notes
                            }
                        });
                    });
                }
            });
            
            // Sort by timestamp (newest first)
            return transactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        } catch (error) {
            console.error('❌ Failed to get transactions from Fabric:', error);
            throw new Error(`Failed to query transactions: ${error.message}`);
        }
    }

    // Helper method to generate block hash
    generateBlockHash(blockNumber, transactions) {
        const data = `${blockNumber}_${transactions.map(tx => tx.id || tx.transactionId).join('_')}`;
        return '0x' + crypto.createHash('sha256').update(data).digest('hex');
    }

    // Get all blocks from Fabric (built from transactions)
    async getAllBlocks() {
        if (!this.isConnected || this.mode !== 'fabric') {
            throw new Error('Not connected to Fabric network. Cannot query blocks.');
        }

        try {
            // Get all transactions
            const transactions = await this.getAllTransactions();
            
            // Group transactions into blocks (simulate block structure)
            const transactionsPerBlock = 10;
            const blocks = [];
            
            // Genesis block
            blocks.push({
                blockNumber: 0,
                blockHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
                previousHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
                timestamp: new Date().toISOString(),
                transactions: [],
                transactionCount: 0,
                dataHash: '0x0000000000000000000000000000000000000000000000000000000000000000'
            });
            
            // Group transactions into blocks
            for (let i = 0; i < transactions.length; i += transactionsPerBlock) {
                const blockTransactions = transactions.slice(i, i + transactionsPerBlock);
                const blockNumber = Math.floor(i / transactionsPerBlock) + 1;
                
                const blockHash = this.generateBlockHash(blockNumber, blockTransactions);
                const previousHash = blocks[blocks.length - 1].blockHash;
                
                blocks.push({
                    blockNumber: blockNumber,
                    blockHash: blockHash,
                    previousHash: previousHash,
                    timestamp: blockTransactions[0]?.timestamp || new Date().toISOString(),
                    transactions: blockTransactions.map(tx => ({ 
                        id: tx.id || tx.transactionId, 
                        transactionId: tx.transactionId || tx.id 
                    })),
                    transactionCount: blockTransactions.length,
                    dataHash: blockHash
                });
            }
            
            return blocks;
        } catch (error) {
            console.error('❌ Failed to get blocks from Fabric:', error);
            throw new Error(`Failed to query blocks: ${error.message}`);
        }
    }

    // Get network status - Fabric only
    getStatus() {
        return {
            isConnected: this.isConnected,
            mode: 'fabric',
            network: 'Hyperledger Fabric',
            channel: 'ltochannel',
            contract: 'vehicle-registration'
        };
    }

    // Disconnect from network
    async disconnect() {
        try {
            if (this.gateway && this.isConnected) {
                await this.gateway.disconnect();
                console.log('✅ Disconnected from Fabric network');
            }
            this.isConnected = false;
        } catch (error) {
            console.error('❌ Error disconnecting from network:', error);
        }
    }
}

// Create singleton instance
const optimizedFabricService = new OptimizedFabricService();

module.exports = optimizedFabricService;
