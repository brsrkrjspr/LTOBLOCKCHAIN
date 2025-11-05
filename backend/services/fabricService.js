// TrustChain - Real Hyperledger Fabric Integration Service
// This service connects to the actual Fabric network

const { Gateway, Wallets } = require('fabric-network');
const fs = require('fs');
const path = require('path');
const mockBlockchainService = require('./mockBlockchainService');
const blockchainLedger = require('./blockchainLedger');

class FabricService {
    constructor() {
        this.gateway = new Gateway();
        this.wallet = null;
        this.network = null;
        this.contract = null;
        this.isConnected = false;
    }

    // Initialize connection to Fabric network
    async initialize() {
        try {
            console.log('🔗 Initializing Fabric connection...');
            
            // Create wallet
            const walletPath = path.join(process.cwd(), 'wallet');
            this.wallet = await Wallets.newFileSystemWallet(walletPath);
            
            // Check if user exists in wallet
            const userExists = await this.wallet.get('admin');
            if (!userExists) {
                console.log('⚠️  Admin user not found in wallet. Using mock mode.');
                return false;
            }

            // Connection profile
            const connectionProfile = {
                name: 'trustchain-network',
                version: '1.0.0',
                client: {
                    organization: 'LTO',
                    connection: {
                        timeout: {
                            peer: {
                                endorser: '300'
                            }
                        }
                    }
                },
                organizations: {
                    LTO: {
                        mspid: 'LTOMSP',
                        peers: ['peer0.lto.example.com'],
                        certificateAuthorities: ['ca.lto.example.com']
                    }
                },
                peers: {
                    'peer0.lto.example.com': {
                        url: 'grpc://localhost:7051'
                    }
                },
                certificateAuthorities: {
                    'ca.lto.example.com': {
                        url: 'https://localhost:7054',
                        caName: 'ca.lto.example.com'
                    }
                }
            };

            // Connect to gateway
            await this.gateway.connect(connectionProfile, {
                wallet: this.wallet,
                identity: 'admin',
                discovery: { enabled: true, asLocalhost: true }
            });

            // Get network and contract
            this.network = await this.gateway.getNetwork('trustchain-channel');
            this.contract = this.network.getContract('vehicle-registration');
            
            this.isConnected = true;
            console.log('✅ Connected to Fabric network successfully!');
            return true;

        } catch (error) {
            console.log('❌ Failed to connect to Fabric network:', error.message);
            console.log('🔄 Falling back to mock blockchain mode');
            this.isConnected = false;
            return false;
        }
    }

    // Register vehicle on blockchain
    async registerVehicle(vehicleData) {
        try {
            if (!this.isConnected) {
                return await this.mockRegisterVehicle(vehicleData);
            }

            console.log('📝 Registering vehicle on blockchain...');
            const result = await this.contract.submitTransaction(
                'RegisterVehicle',
                JSON.stringify(vehicleData)
            );

            const response = JSON.parse(result.toString());
            console.log('✅ Vehicle registered on blockchain:', response);
            return response;

        } catch (error) {
            console.error('❌ Failed to register vehicle:', error);
            throw new Error(`Blockchain registration failed: ${error.message}`);
        }
    }

    // Get vehicle from blockchain
    async getVehicle(vin) {
        try {
            if (!this.isConnected) {
                return await this.mockGetVehicle(vin);
            }

            console.log('🔍 Querying vehicle from blockchain...');
            const result = await this.contract.evaluateTransaction('GetVehicle', vin);
            const vehicle = JSON.parse(result.toString());
            
            console.log('✅ Vehicle retrieved from blockchain');
            return vehicle;

        } catch (error) {
            console.error('❌ Failed to get vehicle:', error);
            throw new Error(`Blockchain query failed: ${error.message}`);
        }
    }

    // Update verification status on blockchain
    async updateVerificationStatus(vin, verificationType, status, notes) {
        try {
            if (!this.isConnected) {
                return await this.mockUpdateVerificationStatus(vin, verificationType, status, notes);
            }

            console.log('📝 Updating verification status on blockchain...');
            const result = await this.contract.submitTransaction(
                'UpdateVerificationStatus',
                vin,
                verificationType,
                status,
                notes || ''
            );

            const response = JSON.parse(result.toString());
            console.log('✅ Verification status updated on blockchain:', response);
            return response;

        } catch (error) {
            console.error('❌ Failed to update verification status:', error);
            throw new Error(`Blockchain update failed: ${error.message}`);
        }
    }

    // Transfer vehicle ownership on blockchain
    async transferOwnership(vin, newOwnerId, newOwnerName, transferData) {
        try {
            if (!this.isConnected) {
                return await this.mockTransferOwnership(vin, newOwnerId, newOwnerName, transferData);
            }

            console.log('📝 Transferring ownership on blockchain...');
            const result = await this.contract.submitTransaction(
                'TransferOwnership',
                vin,
                newOwnerId,
                newOwnerName,
                JSON.stringify(transferData)
            );

            const response = JSON.parse(result.toString());
            console.log('✅ Ownership transferred on blockchain:', response);
            return response;

        } catch (error) {
            console.error('❌ Failed to transfer ownership:', error);
            throw new Error(`Blockchain transfer failed: ${error.message}`);
        }
    }

    // Get vehicles by owner from blockchain
    async getVehiclesByOwner(ownerId) {
        try {
            if (!this.isConnected) {
                return await this.mockGetVehiclesByOwner(ownerId);
            }

            console.log('🔍 Querying vehicles by owner from blockchain...');
            const result = await this.contract.evaluateTransaction('GetVehiclesByOwner', ownerId);
            const vehicles = JSON.parse(result.toString());
            
            console.log('✅ Vehicles retrieved from blockchain');
            return vehicles;

        } catch (error) {
            console.error('❌ Failed to get vehicles by owner:', error);
            throw new Error(`Blockchain query failed: ${error.message}`);
        }
    }

    // Get vehicle history from blockchain
    async getVehicleHistory(vin) {
        try {
            if (!this.isConnected) {
                return await this.mockGetVehicleHistory(vin);
            }

            console.log('🔍 Querying vehicle history from blockchain...');
            const result = await this.contract.evaluateTransaction('GetVehicleHistory', vin);
            const history = JSON.parse(result.toString());
            
            console.log('✅ Vehicle history retrieved from blockchain');
            return history;

        } catch (error) {
            console.error('❌ Failed to get vehicle history:', error);
            throw new Error(`Blockchain query failed: ${error.message}`);
        }
    }

    // Mock implementations (fallback when Fabric is not available)
    async mockRegisterVehicle(vehicleData) {
        console.log('🔄 Using mock blockchain for vehicle registration');
        
        const transactionId = 'mock_tx_' + Date.now();
        
        // Store transaction in blockchain ledger
        const transaction = blockchainLedger.addTransaction({
            transactionId: transactionId,
            type: 'VEHICLE_REGISTRATION',
            vin: vehicleData.vin,
            plateNumber: vehicleData.plateNumber,
            owner: vehicleData.owner,
            vehicle: vehicleData.vehicle,
            documents: vehicleData.documents
        });
        
        return {
            success: true,
            message: 'Vehicle registered successfully (mock)',
            vin: vehicleData.vin,
            plateNumber: vehicleData.plateNumber,
            transactionId: transactionId,
            blockNumber: transaction.blockNumber,
            blockHash: transaction.hash
        };
    }

    async mockGetVehicle(vin) {
        console.log('🔄 Using mock blockchain for vehicle query');
        return {
            vin: vin,
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
        };
    }

    async mockUpdateVerificationStatus(vin, verificationType, status, notes) {
        console.log('🔄 Using mock blockchain for verification update');
        return {
            success: true,
            message: 'Verification status updated successfully (mock)',
            vin: vin,
            verificationType: verificationType,
            status: status,
            transactionId: 'mock_tx_' + Date.now()
        };
    }

    async mockTransferOwnership(vin, newOwnerId, newOwnerName, transferData) {
        console.log('🔄 Using mock blockchain for ownership transfer');
        return {
            success: true,
            message: 'Ownership transferred successfully (mock)',
            vin: vin,
            newOwner: newOwnerName,
            transactionId: 'mock_tx_' + Date.now()
        };
    }

    async mockGetVehiclesByOwner(ownerId) {
        console.log('🔄 Using mock blockchain for owner vehicles query');
        return [{
            vin: 'VIN123456789',
            plateNumber: 'ABC-1234',
            make: 'Toyota',
            model: 'Vios',
            year: 2023,
            status: 'REGISTERED'
        }];
    }

    async mockGetVehicleHistory(vin) {
        console.log('🔄 Using mock blockchain for vehicle history query');
        return [{
            action: 'REGISTERED',
            timestamp: new Date().toISOString(),
            performedBy: 'USR001',
            details: 'Vehicle registration submitted'
        }];
    }

    // Get network status
    getStatus() {
        return {
            connected: this.isConnected,
            network: this.isConnected ? 'Hyperledger Fabric' : 'Mock Blockchain',
            channel: this.isConnected ? 'trustchain-channel' : 'mock-channel',
            contract: this.isConnected ? 'vehicle-registration' : 'mock-contract'
        };
    }

    // Disconnect from network
    async disconnect() {
        if (this.gateway && this.isConnected) {
            await this.gateway.disconnect();
            this.isConnected = false;
            console.log('🔌 Disconnected from Fabric network');
        }
    }
}

// Create singleton instance
const fabricService = new FabricService();

module.exports = fabricService;

