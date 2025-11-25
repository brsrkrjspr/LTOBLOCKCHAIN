// TrustChain LTO - Optimized Fabric Service
// Automatically falls back to mock blockchain for laptop deployment

const { Gateway, Wallets } = require('fabric-network');
const fs = require('fs');
const path = require('path');
const mockBlockchainService = require('./mockBlockchainService');

class OptimizedFabricService {
    constructor() {
        this.gateway = new Gateway();
        this.wallet = null;
        this.network = null;
        this.contract = null;
        this.isConnected = false;
        this.mockService = mockBlockchainService;
        this.mode = 'mock'; // Default to mock mode
    }

    // Initialize connection (automatically falls back to mock)
    async initialize() {
        try {
            // Check environment variable first
            if (process.env.BLOCKCHAIN_MODE === 'mock') {
                console.log('🔧 Running in mock blockchain mode (environment setting)');
                this.isConnected = true;
                this.mode = 'mock';
                return { success: true, mode: 'mock' };
            }

            // Check if network configuration exists first (before attempting connection)
            let connectionProfilePath = path.join(__dirname, '../../network-config.json');
            let connectionProfile;
            
            if (!fs.existsSync(connectionProfilePath)) {
                // Try YAML file
                connectionProfilePath = path.join(__dirname, '../../network-config.yaml');
                if (!fs.existsSync(connectionProfilePath)) {
                    // No config found - skip connection attempt entirely
                    this.isConnected = true;
                    this.mode = 'mock';
                    return { success: true, mode: 'mock' };
                }
                // For YAML, we'd need a YAML parser, but for now, use JSON
                this.isConnected = true;
                this.mode = 'mock';
                return { success: true, mode: 'mock' };
            }
            
            // Load JSON connection profile
            connectionProfile = JSON.parse(fs.readFileSync(connectionProfilePath, 'utf8'));
            
            // Try to connect to real Fabric network (only if config exists)
            console.log('🔗 Attempting to connect to Hyperledger Fabric...');

            // Create wallet
            const walletPath = path.join(__dirname, '../../wallet');
            this.wallet = await Wallets.newFileSystemWallet(walletPath);
            
            // Check if admin user exists in wallet
            const userExists = await this.wallet.get('admin');
            if (!userExists) {
                console.log('⚠️ Admin user not found in wallet, using mock mode');
                this.isConnected = true;
                this.mode = 'mock';
                return { success: true, mode: 'mock' };
            }

            // Suppress gRPC error logs during connection attempt
            const originalError = console.error;
            const originalInfo = console.info;
            const suppressedErrors = [];
            
            // Intercept console.error to filter gRPC connection errors
            console.error = (...args) => {
                const message = args.join(' ');
                if (message.includes('ServiceEndpoint') || 
                    message.includes('Failed to connect before the deadline') ||
                    message.includes('waitForReady') ||
                    message.includes('Unable to connect') ||
                    message.includes('Endorser-') ||
                    message.includes('Committer-') ||
                    message.includes('buildPeer') ||
                    message.includes('buildOrderer')) {
                    suppressedErrors.push(message);
                    return; // Suppress these errors
                }
                originalError(...args);
            };
            
            // Also intercept console.info to filter connection attempts
            console.info = (...args) => {
                const message = args.join(' ');
                if (message.includes('ServiceEndpoint') || 
                    message.includes('Unable to connect')) {
                    return; // Suppress these info messages
                }
                originalInfo(...args);
            };

            try {
                // Connect to gateway with shorter timeout and disabled discovery to reduce connection attempts
                const connectPromise = this.gateway.connect(connectionProfile, {
                    wallet: this.wallet,
                    identity: 'admin',
                    discovery: { enabled: false, asLocalhost: true } // Disable discovery to reduce connection attempts
                });

                // Add timeout to connection attempt (reduced to 3 seconds)
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Connection timeout')), 3000);
                });

                await Promise.race([connectPromise, timeoutPromise]);
            } finally {
                // Restore original console methods
                console.error = originalError;
                console.info = originalInfo;
            }

            // Get network and contract
            this.network = await this.gateway.getNetwork('ltochannel');
            this.contract = this.network.getContract('vehicle-registration');

            this.isConnected = true;
            this.mode = 'fabric';
            console.log('✅ Connected to Hyperledger Fabric network');

            return { success: true, mode: 'fabric' };

        } catch (error) {
            // Only show error if it's not a connection timeout (expected in mock mode)
            if (!error.message.includes('timeout') && !error.message.includes('Connection timeout')) {
                console.error('❌ Failed to connect to Fabric network, using mock mode:', error.message);
            }
            this.isConnected = true;
            this.mode = 'mock';
            return { success: true, mode: 'mock' };
        }
    }

    // Register vehicle
    async registerVehicle(vehicleData) {
        try {
            if (this.mode === 'mock') {
                return await this.mockService.registerVehicle(vehicleData);
            }

            // Real Fabric implementation
            const vehicleJson = JSON.stringify(vehicleData);
            const result = await this.contract.submitTransaction('RegisterVehicle', vehicleJson);
            
            return {
                success: true,
                message: 'Vehicle registered successfully',
                transactionId: result.toString(),
                vin: vehicleData.vin
            };

        } catch (error) {
            console.error('❌ Failed to register vehicle:', error);
            throw new Error(`Vehicle registration failed: ${error.message}`);
        }
    }

    // Get vehicle
    async getVehicle(vin) {
        try {
            if (this.mode === 'mock') {
                return await this.mockService.getVehicle(vin);
            }

            // Real Fabric implementation
            const result = await this.contract.evaluateTransaction('GetVehicle', vin);
            const vehicle = JSON.parse(result.toString());
            
            return {
                success: true,
                vehicle: vehicle
            };

        } catch (error) {
            console.error('❌ Failed to get vehicle:', error);
            throw new Error(`Vehicle query failed: ${error.message}`);
        }
    }

    // Update verification status
    async updateVerificationStatus(vin, verificationType, status, notes) {
        try {
            if (this.mode === 'mock') {
                return await this.mockService.updateVerificationStatus(vin, verificationType, status, notes);
            }

            // Real Fabric implementation
            const result = await this.contract.submitTransaction(
                'UpdateVerificationStatus', 
                vin, 
                verificationType, 
                status, 
                notes || ''
            );
            
            return {
                success: true,
                message: 'Verification status updated successfully',
                transactionId: result.toString(),
                vin: vin,
                verificationType: verificationType,
                status: status
            };

        } catch (error) {
            console.error('❌ Failed to update verification status:', error);
            throw new Error(`Verification update failed: ${error.message}`);
        }
    }

    // Transfer ownership
    async transferOwnership(vin, newOwnerData, transferData) {
        try {
            if (this.mode === 'mock') {
                return await this.mockService.transferOwnership(vin, newOwnerData, transferData);
            }

            // Real Fabric implementation
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
                message: 'Ownership transferred successfully',
                transactionId: result.toString(),
                vin: vin,
                newOwner: newOwnerData.email
            };

        } catch (error) {
            console.error('❌ Failed to transfer ownership:', error);
            throw new Error(`Ownership transfer failed: ${error.message}`);
        }
    }

    // Get vehicles by owner
    async getVehiclesByOwner(ownerEmail) {
        try {
            if (this.mode === 'mock') {
                return await this.mockService.getVehiclesByOwner(ownerEmail);
            }

            // Real Fabric implementation
            const result = await this.contract.evaluateTransaction('GetVehiclesByOwner', ownerEmail);
            const vehicles = JSON.parse(result.toString());
            
            return {
                success: true,
                vehicles: vehicles
            };

        } catch (error) {
            console.error('❌ Failed to get vehicles by owner:', error);
            throw new Error(`Vehicle query failed: ${error.message}`);
        }
    }

    // Get vehicle history
    async getVehicleHistory(vin) {
        try {
            if (this.mode === 'mock') {
                return await this.mockService.getVehicleHistory(vin);
            }

            // Real Fabric implementation
            const result = await this.contract.evaluateTransaction('GetVehicleHistory', vin);
            const history = JSON.parse(result.toString());
            
            return {
                success: true,
                history: history
            };

        } catch (error) {
            console.error('❌ Failed to get vehicle history:', error);
            throw new Error(`History query failed: ${error.message}`);
        }
    }

    // Get system statistics
    async getSystemStats() {
        try {
            if (this.mode === 'mock') {
                return await this.mockService.getSystemStats();
            }

            // Real Fabric implementation
            const result = await this.contract.evaluateTransaction('GetSystemStats');
            const stats = JSON.parse(result.toString());
            
            return {
                success: true,
                stats: stats
            };

        } catch (error) {
            console.error('❌ Failed to get system stats:', error);
            throw new Error(`Stats query failed: ${error.message}`);
        }
    }

    // Get transaction status by polling the ledger
    // This checks if a transaction has been committed by querying the vehicle
    async getTransactionStatus(transactionId, vin, maxRetries = 10, retryDelay = 2000) {
        try {
            if (this.mode === 'mock') {
                // In mock mode, assume transaction is immediately committed
                return {
                    status: 'committed',
                    transactionId: transactionId,
                    blockNumber: null,
                    timestamp: new Date().toISOString(),
                    mode: 'mock'
                };
            }

            // Real Fabric implementation - poll by checking if vehicle exists on ledger
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    // Try to get the vehicle from the ledger
                    // If it exists, the transaction was committed
                    const vehicleResult = await this.getVehicle(vin);
                    
                    if (vehicleResult.success && vehicleResult.vehicle) {
                        // Vehicle exists on ledger - transaction is committed
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
                    
                    // If vehicle doesn't exist yet, transaction might still be pending
                    // Wait and retry
                    if (attempt < maxRetries) {
                        await new Promise(resolve => setTimeout(resolve, retryDelay));
                        continue;
                    }
                    
                    // After max retries, assume pending
                    return {
                        status: 'pending',
                        transactionId: transactionId,
                        vin: vin,
                        message: 'Transaction submitted but not yet committed after polling',
                        attempts: attempt,
                        mode: 'fabric'
                    };
                    
                } catch (queryError) {
                    // If vehicle not found, transaction might still be pending
                    if (queryError.message.includes('not found') || queryError.message.includes('does not exist')) {
                        if (attempt < maxRetries) {
                            await new Promise(resolve => setTimeout(resolve, retryDelay));
                            continue;
                        }
                        
                        // After max retries, still not found
                        return {
                            status: 'pending',
                            transactionId: transactionId,
                            vin: vin,
                            message: 'Transaction submitted but vehicle not found on ledger after polling',
                            attempts: attempt,
                            mode: 'fabric'
                        };
                    }
                    
                    // Other error - might indicate transaction failed
                    throw queryError;
                }
            }
            
            // Should not reach here, but return pending status
            return {
                status: 'pending',
                transactionId: transactionId,
                vin: vin,
                message: 'Transaction status unknown after polling',
                attempts: maxRetries,
                mode: 'fabric'
            };
            
        } catch (error) {
            console.error('❌ Failed to get transaction status:', error);
            return {
                status: 'unknown',
                transactionId: transactionId,
                vin: vin,
                error: error.message,
                mode: this.mode
            };
        }
    }

    // Get network status
    getStatus() {
        if (this.mode === 'mock') {
            const mockStatus = this.mockService.getStatus();
            return {
                isConnected: mockStatus.connected || this.isConnected,
                mode: 'mock',
                network: mockStatus.network || 'Mock Blockchain',
                channel: null,
                contract: null
            };
        }

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
            if (this.mode === 'fabric' && this.gateway) {
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
