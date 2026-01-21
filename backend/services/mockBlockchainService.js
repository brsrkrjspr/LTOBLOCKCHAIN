// TrustChain LTO - Enhanced Mock Blockchain Service
// Production-ready mock blockchain for laptop deployment
// Eliminates Hyperledger Fabric overhead while maintaining functionality

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class MockBlockchainService {
    constructor() {
        this.blocks = [];
        this.transactions = [];
        this.vehicles = new Map();
        this.owners = new Map();
        this.ledgerPath = path.join(process.cwd(), 'blockchain-ledger');
        this.initializeLedger();
    }

    // Initialize blockchain ledger
    initializeLedger() {
        try {
            // Create ledger directory if it doesn't exist
            if (!fs.existsSync(this.ledgerPath)) {
                fs.mkdirSync(this.ledgerPath, { recursive: true });
            }

            // Load existing data
            this.loadBlocks();
            this.loadTransactions();
            this.loadVehicles();
            this.loadOwners();

            // Create genesis block if none exists
            if (this.blocks.length === 0) {
                this.createGenesisBlock();
            }

            console.log('✅ Mock blockchain service initialized');
            console.log(`📊 Loaded ${this.blocks.length} blocks, ${this.transactions.length} transactions`);
        } catch (error) {
            console.error('❌ Failed to initialize mock blockchain:', error);
        }
    }

    // Create genesis block
    createGenesisBlock() {
        const genesisBlock = {
            index: 0,
            timestamp: new Date().toISOString(),
            previousHash: '0',
            hash: this.calculateHash(0, new Date().toISOString(), '0', []),
            transactions: [],
            nonce: 0,
            merkleRoot: '0'
        };

        this.blocks.push(genesisBlock);
        this.saveBlocks();
        console.log('🔗 Genesis block created');
    }

    // Register vehicle on blockchain
    async registerVehicle(vehicleData) {
        try {
            const txId = this.generateTransactionId();
            const timestamp = new Date().toISOString();

            // Create transaction
            const transaction = {
                id: txId,
                type: 'VEHICLE_REGISTRATION',
                timestamp: timestamp,
                data: {
                    vin: vehicleData.vin,
                    plateNumber: vehicleData.plateNumber,
                    make: vehicleData.make,
                    model: vehicleData.model,
                    year: vehicleData.year,
                    color: vehicleData.color,
                    engineNumber: vehicleData.engineNumber,
                    chassisNumber: vehicleData.chassisNumber,
                    owner: vehicleData.owner,
                    documents: vehicleData.documents,
                    status: 'REGISTERED'
                },
                hash: this.calculateTransactionHash(vehicleData),
                signature: this.generateSignature(vehicleData)
            };

            // Store vehicle data
            this.vehicles.set(vehicleData.vin, {
                ...transaction.data,
                registrationDate: timestamp,
                verificationStatus: {
                    insurance: 'PENDING',
                    admin: 'PENDING'
                },
                history: [{
                    action: 'REGISTERED',
                    timestamp: timestamp,
                    transactionId: txId,
                    details: 'Vehicle registered on blockchain'
                }]
            });

            // Store owner data
            if (vehicleData.owner) {
                this.owners.set(vehicleData.owner.email, {
                    ...vehicleData.owner,
                    vehicles: [...(this.owners.get(vehicleData.owner.email)?.vehicles || []), vehicleData.vin]
                });
            }

            // Add transaction to pending pool
            this.transactions.push(transaction);

            // Create new block if needed (every 10 transactions)
            if (this.transactions.length % 10 === 0) {
                await this.createNewBlock();
            }

            // Save data
            this.saveTransactions();
            this.saveVehicles();
            this.saveOwners();

            console.log(`✅ Vehicle ${vehicleData.vin} registered on blockchain`);
            
            return {
                success: true,
                message: 'Vehicle registered successfully',
                vin: vehicleData.vin,
                plateNumber: vehicleData.plateNumber,
                transactionId: txId,
                blockNumber: this.blocks.length,
                timestamp: timestamp
            };

        } catch (error) {
            console.error('❌ Failed to register vehicle:', error);
            throw new Error(`Blockchain registration failed: ${error.message}`);
        }
    }

    // Get vehicle from blockchain
    async getVehicle(vin) {
        try {
            const vehicle = this.vehicles.get(vin);
            if (!vehicle) {
                throw new Error(`Vehicle with VIN ${vin} not found`);
            }

            return {
                success: true,
                vehicle: vehicle
            };

        } catch (error) {
            console.error('❌ Failed to get vehicle:', error);
            throw new Error(`Blockchain query failed: ${error.message}`);
        }
    }

    // Update verification status
    async updateVerificationStatus(vin, verificationType, status, notes) {
        try {
            const vehicle = this.vehicles.get(vin);
            if (!vehicle) {
                throw new Error(`Vehicle with VIN ${vin} not found`);
            }

            const txId = this.generateTransactionId();
            const timestamp = new Date().toISOString();

            // Update verification status
            vehicle.verificationStatus[verificationType] = status;
            vehicle.lastUpdated = timestamp;

            // Add to history
            vehicle.history.push({
                action: `VERIFICATION_${status}`,
                timestamp: timestamp,
                transactionId: txId,
                details: `${verificationType} verification ${status.toLowerCase()}`,
                notes: notes || ''
            });

            // Create transaction
            const transaction = {
                id: txId,
                type: 'VERIFICATION_UPDATE',
                timestamp: timestamp,
                data: {
                    vin: vin,
                    verificationType: verificationType,
                    status: status,
                    notes: notes
                },
                hash: this.calculateTransactionHash({ vin, verificationType, status, notes }),
                signature: this.generateSignature({ vin, verificationType, status, notes })
            };

            this.transactions.push(transaction);
            this.vehicles.set(vin, vehicle);

            // Save data
            this.saveTransactions();
            this.saveVehicles();

            console.log(`✅ Verification status updated for vehicle ${vin}: ${verificationType} = ${status}`);

            return {
                success: true,
                message: 'Verification status updated successfully',
                vin: vin,
                verificationType: verificationType,
                status: status,
                transactionId: txId,
                timestamp: timestamp
            };

        } catch (error) {
            console.error('❌ Failed to update verification status:', error);
            throw new Error(`Blockchain update failed: ${error.message}`);
        }
    }

    // Transfer vehicle ownership
    async transferOwnership(vin, newOwnerData, transferData) {
        try {
            const vehicle = this.vehicles.get(vin);
            if (!vehicle) {
                throw new Error(`Vehicle with VIN ${vin} not found`);
            }

            const txId = this.generateTransactionId();
            const timestamp = new Date().toISOString();

            // Update ownership
            const previousOwner = vehicle.owner;
            vehicle.owner = newOwnerData;
            vehicle.lastUpdated = timestamp;

            // Add to history
            vehicle.history.push({
                action: 'OWNERSHIP_TRANSFERRED',
                timestamp: timestamp,
                transactionId: txId,
                details: `Ownership transferred from ${previousOwner.email} to ${newOwnerData.email}`,
                transferData: transferData
            });

            // Update owner mappings
            if (previousOwner) {
                const prevOwnerData = this.owners.get(previousOwner.email);
                if (prevOwnerData) {
                    prevOwnerData.vehicles = prevOwnerData.vehicles.filter(v => v !== vin);
                    this.owners.set(previousOwner.email, prevOwnerData);
                }
            }

            const newOwnerVehicles = this.owners.get(newOwnerData.email)?.vehicles || [];
            this.owners.set(newOwnerData.email, {
                ...newOwnerData,
                vehicles: [...newOwnerVehicles, vin]
            });

            // Create transaction
            const transaction = {
                id: txId,
                type: 'OWNERSHIP_TRANSFER',
                timestamp: timestamp,
                data: {
                    vin: vin,
                    previousOwner: previousOwner,
                    newOwner: newOwnerData,
                    transferData: transferData
                },
                hash: this.calculateTransactionHash({ vin, previousOwner, newOwner: newOwnerData }),
                signature: this.generateSignature({ vin, previousOwner, newOwner: newOwnerData })
            };

            this.transactions.push(transaction);
            this.vehicles.set(vin, vehicle);

            // Save data
            this.saveTransactions();
            this.saveVehicles();
            this.saveOwners();

            console.log(`✅ Ownership transferred for vehicle ${vin}`);

            return {
                success: true,
                message: 'Ownership transferred successfully',
                vin: vin,
                previousOwner: previousOwner.email,
                newOwner: newOwnerData.email,
                transactionId: txId,
                timestamp: timestamp
            };

        } catch (error) {
            console.error('❌ Failed to transfer ownership:', error);
            throw new Error(`Blockchain transfer failed: ${error.message}`);
        }
    }

    // Get vehicles by owner
    async getVehiclesByOwner(ownerEmail) {
        try {
            const owner = this.owners.get(ownerEmail);
            if (!owner) {
                return { success: true, vehicles: [] };
            }

            const vehicles = owner.vehicles.map(vin => this.vehicles.get(vin)).filter(Boolean);

            return {
                success: true,
                vehicles: vehicles
            };

        } catch (error) {
            console.error('❌ Failed to get vehicles by owner:', error);
            throw new Error(`Blockchain query failed: ${error.message}`);
        }
    }

    // Get vehicle history
    async getVehicleHistory(vin) {
        try {
            const vehicle = this.vehicles.get(vin);
            if (!vehicle) {
                throw new Error(`Vehicle with VIN ${vin} not found`);
            }

            return {
                success: true,
                history: vehicle.history
            };

        } catch (error) {
            console.error('❌ Failed to get vehicle history:', error);
            throw new Error(`Blockchain query failed: ${error.message}`);
        }
    }

    // Get system statistics
    async getSystemStats() {
        try {
            const stats = {
                totalVehicles: this.vehicles.size,
                totalOwners: this.owners.size,
                totalTransactions: this.transactions.length,
                totalBlocks: this.blocks.length,
                statusCounts: {},
                verificationCounts: {},
                timestamp: new Date().toISOString()
            };

            // Count by status
            for (const vehicle of this.vehicles.values()) {
                stats.statusCounts[vehicle.status] = (stats.statusCounts[vehicle.status] || 0) + 1;
                
                // Count by verification status
                Object.keys(vehicle.verificationStatus).forEach(verifier => {
                    const status = vehicle.verificationStatus[verifier];
                    const key = `${verifier}_${status}`;
                    stats.verificationCounts[key] = (stats.verificationCounts[key] || 0) + 1;
                });
            }

            return {
                success: true,
                stats: stats
            };

        } catch (error) {
            console.error('❌ Failed to get system stats:', error);
            throw new Error(`Blockchain query failed: ${error.message}`);
        }
    }

    // Create new block
    async createNewBlock() {
        try {
            const previousBlock = this.blocks[this.blocks.length - 1];
            const blockTransactions = this.transactions.slice(-10); // Last 10 transactions
            
            const block = {
                index: this.blocks.length,
                timestamp: new Date().toISOString(),
                previousHash: previousBlock.hash,
                transactions: blockTransactions,
                nonce: this.mineBlock(previousBlock.hash, blockTransactions),
                merkleRoot: this.calculateMerkleRoot(blockTransactions)
            };

            block.hash = this.calculateHash(
                block.index,
                block.timestamp,
                block.previousHash,
                block.transactions,
                block.nonce
            );

            this.blocks.push(block);
            this.saveBlocks();

            console.log(`🔗 New block created: ${block.hash}`);

        } catch (error) {
            console.error('❌ Failed to create new block:', error);
        }
    }

    // Mine block (simplified proof of work)
    mineBlock(previousHash, transactions) {
        let nonce = 0;
        const target = '0000'; // Simplified difficulty

        while (true) {
            const hash = this.calculateHash(
                this.blocks.length,
                new Date().toISOString(),
                previousHash,
                transactions,
                nonce
            );

            if (hash.startsWith(target)) {
                return nonce;
            }
            nonce++;
        }
    }

    // Calculate block hash
    calculateHash(index, timestamp, previousHash, transactions, nonce) {
        const data = index + timestamp + previousHash + JSON.stringify(transactions) + nonce;
        return crypto.createHash('sha256').update(data).digest('hex');
    }

    // Calculate transaction hash
    calculateTransactionHash(data) {
        return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
    }

    // Generate transaction ID
    generateTransactionId() {
        return 'tx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Generate signature (simplified)
    generateSignature(data) {
        return crypto.createHmac('sha256', 'mock-secret-key')
            .update(JSON.stringify(data))
            .digest('hex');
    }

    // Calculate Merkle root
    calculateMerkleRoot(transactions) {
        if (transactions.length === 0) return '0';
        if (transactions.length === 1) return transactions[0].hash;

        const hashes = transactions.map(tx => tx.hash);
        
        while (hashes.length > 1) {
            const nextLevel = [];
            for (let i = 0; i < hashes.length; i += 2) {
                const left = hashes[i];
                const right = hashes[i + 1] || left;
                const combined = crypto.createHash('sha256')
                    .update(left + right)
                    .digest('hex');
                nextLevel.push(combined);
            }
            hashes.splice(0, hashes.length, ...nextLevel);
        }

        return hashes[0];
    }

    // Data persistence methods
    saveBlocks() {
        try {
            fs.writeFileSync(
                path.join(this.ledgerPath, 'blocks.json'),
                JSON.stringify(this.blocks, null, 2)
            );
        } catch (error) {
            console.error('❌ Failed to save blocks:', error);
        }
    }

    loadBlocks() {
        try {
            const blocksFile = path.join(this.ledgerPath, 'blocks.json');
            if (fs.existsSync(blocksFile)) {
                this.blocks = JSON.parse(fs.readFileSync(blocksFile, 'utf8'));
            }
        } catch (error) {
            console.error('❌ Failed to load blocks:', error);
        }
    }

    saveTransactions() {
        try {
            fs.writeFileSync(
                path.join(this.ledgerPath, 'transactions.json'),
                JSON.stringify(this.transactions, null, 2)
            );
        } catch (error) {
            console.error('❌ Failed to save transactions:', error);
        }
    }

    loadTransactions() {
        try {
            const transactionsFile = path.join(this.ledgerPath, 'transactions.json');
            if (fs.existsSync(transactionsFile)) {
                this.transactions = JSON.parse(fs.readFileSync(transactionsFile, 'utf8'));
            }
        } catch (error) {
            console.error('❌ Failed to load transactions:', error);
        }
    }

    saveVehicles() {
        try {
            const vehiclesData = Object.fromEntries(this.vehicles);
            fs.writeFileSync(
                path.join(this.ledgerPath, 'vehicles.json'),
                JSON.stringify(vehiclesData, null, 2)
            );
        } catch (error) {
            console.error('❌ Failed to save vehicles:', error);
        }
    }

    loadVehicles() {
        try {
            const vehiclesFile = path.join(this.ledgerPath, 'vehicles.json');
            if (fs.existsSync(vehiclesFile)) {
                const vehiclesData = JSON.parse(fs.readFileSync(vehiclesFile, 'utf8'));
                this.vehicles = new Map(Object.entries(vehiclesData));
            }
        } catch (error) {
            console.error('❌ Failed to load vehicles:', error);
        }
    }

    saveOwners() {
        try {
            const ownersData = Object.fromEntries(this.owners);
            fs.writeFileSync(
                path.join(this.ledgerPath, 'owners.json'),
                JSON.stringify(ownersData, null, 2)
            );
        } catch (error) {
            console.error('❌ Failed to save owners:', error);
        }
    }

    loadOwners() {
        try {
            const ownersFile = path.join(this.ledgerPath, 'owners.json');
            if (fs.existsSync(ownersFile)) {
                const ownersData = JSON.parse(fs.readFileSync(ownersFile, 'utf8'));
                this.owners = new Map(Object.entries(ownersData));
            }
        } catch (error) {
            console.error('❌ Failed to load owners:', error);
        }
    }

    // Get network status
    getStatus() {
        return {
            connected: true,
            network: 'Mock Blockchain',
            channel: 'mock-channel',
            contract: 'mock-contract',
            blocks: this.blocks.length,
            transactions: this.transactions.length,
            vehicles: this.vehicles.size,
            owners: this.owners.size
        };
    }
}

// Create singleton instance
const mockBlockchainService = new MockBlockchainService();

module.exports = mockBlockchainService;
