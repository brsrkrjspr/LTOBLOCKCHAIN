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

            // Try to connect to real Fabric network
            console.log('🔗 Attempting to connect to Hyperledger Fabric...');
            
            // Check if network configuration exists
            const connectionProfilePath = path.join(__dirname, '../../network-config.yaml');
            if (!fs.existsSync(connectionProfilePath)) {
                console.log('⚠️ Network configuration not found, using mock mode');
                this.isConnected = true;
                this.mode = 'mock';
                return { success: true, mode: 'mock' };
            }

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

            // Load connection profile
            const connectionProfile = JSON.parse(fs.readFileSync(connectionProfilePath, 'utf8'));

            // Connect to gateway with timeout
            const connectPromise = this.gateway.connect(connectionProfile, {
                wallet: this.wallet,
                identity: 'admin',
                discovery: { enabled: true, asLocalhost: true }
            });

            // Add timeout to connection attempt
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Connection timeout')), 10000); // 10 second timeout
            });

            await Promise.race([connectPromise, timeoutPromise]);

            // Get network and contract
            this.network = await this.gateway.getNetwork('ltochannel');
            this.contract = this.network.getContract('vehicle-registration');

            this.isConnected = true;
            this.mode = 'fabric';
            console.log('✅ Connected to Hyperledger Fabric network');

            return { success: true, mode: 'fabric' };

        } catch (error) {
            console.error('❌ Failed to connect to Fabric network, using mock mode:', error.message);
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

    // Get network status
    getStatus() {
        if (this.mode === 'mock') {
            return this.mockService.getStatus();
        }

        return {
            connected: this.isConnected,
            network: 'Hyperledger Fabric',
            channel: 'ltochannel',
            contract: 'vehicle-registration',
            mode: this.mode
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
