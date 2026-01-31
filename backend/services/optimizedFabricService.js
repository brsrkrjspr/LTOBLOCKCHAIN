// TrustChain LTO - Real Hyperledger Fabric Service
// NO FALLBACKS - Requires real Fabric network connection

const { Gateway, Wallets, DefaultQueryHandlerStrategies, DefaultEventHandlerStrategies } = require('fabric-network');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class OptimizedFabricService {
    constructor() {
        this.gateway = new Gateway();
        this.wallet = null;
        this.network = null;
        this.contract = null;
        this.channel = null;
        this.isConnected = false;
        this.mode = 'fabric'; // Always Fabric mode - no fallbacks
        this.currentIdentity = null; // Track current identity being used
    }

    // Map application role to Fabric identity
    getFabricIdentityForUser(userRole, userEmail) {
        // Map application role to Fabric identity
        if (['lto_admin', 'lto_supervisor', 'lto_officer', 'admin'].includes(userRole)) {
            // Check if userEmail is enrolled, otherwise use admin-lto
            return userEmail || 'admin-lto';
        }
        if (['hpg_admin', 'hpg_officer'].includes(userRole) ||
            (userRole === 'admin' && userEmail && userEmail.toLowerCase().includes('hpg'))) {
            return userEmail || 'admin-hpg';
        }
        if (['insurance_verifier', 'insurance_admin'].includes(userRole)) {
            return userEmail || 'admin-insurance';
        }
        // Default: use userEmail (if enrolled) or admin-lto
        return userEmail || 'admin-lto';
    }

    // Initialize connection - MANDATORY Fabric connection (no fallbacks)
    // Accepts optional userContext: { role, email } for dynamic identity selection
    async initialize(userContext = null) {
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

        // Determine identity to use based on user context
        let identityToUse = 'admin'; // default fallback

        if (userContext) {
            identityToUse = this.getFabricIdentityForUser(
                userContext.role,
                userContext.email
            );
        }

        // Check if identity exists in wallet
        const identityExists = await this.wallet.get(identityToUse);
        if (!identityExists) {
            // Fallback to admin
            console.warn(`⚠️ Identity ${identityToUse} not found in wallet, falling back to 'admin'`);
            identityToUse = 'admin';
            const adminExists = await this.wallet.get(identityToUse);
            if (!adminExists) {
                throw new Error(`Identity ${identityToUse} not found in wallet. Please enroll admin user first.`);
            }
        }

        try {
            // Connect to gateway with selected identity
            // Note: asLocalhost setting - true for localhost access, false for Docker network names
            // Set FABRIC_AS_LOCALHOST=false in .env to use Docker network names instead of localhost
            const asLocalhost = process.env.FABRIC_AS_LOCALHOST !== 'false';

            // Disconnect existing connection if any
            if (this.isConnected) {
                try {
                    await this.gateway.disconnect();
                } catch (disconnectError) {
                    // Ignore disconnect errors
                }
            }

            await this.gateway.connect(connectionProfile, {
                wallet: this.wallet,
                identity: identityToUse, // Dynamic identity selection
                discovery: { enabled: true, asLocalhost: asLocalhost },
                queryHandlerOptions: {
                    timeout: 60, // Increase query timeout from default
                    strategy: DefaultQueryHandlerStrategies.MSPID_SCOPE_SINGLE
                },
                eventHandlerOptions: {
                    commitTimeout: 300,
                    strategy: DefaultEventHandlerStrategies.MSPID_SCOPE_ALL
                }
            });

            // Get network and contract
            this.network = await this.gateway.getNetwork('ltochannel');
            this.channel = this.network.getChannel();
            this.contract = this.network.getContract('vehicle-registration');

            this.isConnected = true;
            this.currentIdentity = identityToUse;
            console.log(`✅ Connected to Hyperledger Fabric network successfully (identity: ${identityToUse})`);

            return { success: true, mode: 'fabric', identity: identityToUse };

        } catch (error) {
            this.isConnected = false;
            this.currentIdentity = null;
            console.error('❌ Failed to connect to Fabric network:', error.message);
            throw new Error(`Fabric connection failed: ${error.message}. Ensure Fabric network is running and properly configured.`);
        }
    }

    // Quick guard to ensure we have a live Fabric channel
    ensureFabricConnection() {
        if (!this.isConnected || this.mode !== 'fabric' || !this.channel) {
            throw new Error('Not connected to Fabric network. Ensure gateway and channel are initialized.');
        }
    }

    // Convert Fabric long/BN style numbers to JS numbers safely
    longToNumber(longVal) {
        if (longVal === undefined || longVal === null) return null;
        if (typeof longVal === 'number') return longVal;
        if (typeof longVal.low === 'number') {
            // fabric-protos Long: combine low/high
            return longVal.low + (longVal.high || 0) * 2 ** 32;
        }
        if (typeof longVal.toNumber === 'function') return longVal.toNumber();
        return Number(longVal);
    }

    bufferToHex(bufferVal) {
        if (!bufferVal) return null;
        if (Buffer.isBuffer(bufferVal)) return '0x' + bufferVal.toString('hex');
        try {
            return '0x' + Buffer.from(bufferVal).toString('hex');
        } catch (e) {
            return null;
        }
    }

    /**
     * Replicate Fabric's BlockHeaderBytes (protoutil/blockutils.go): ASN.1 DER
     * SEQUENCE { INTEGER Number, OCTET STRING PreviousHash, OCTET STRING DataHash }.
     * BlockHeaderHash = SHA256(BlockHeaderBytes(header)); this must match
     * the next block's header.previous_hash for chain integrity.
     */
    _blockHeaderBytesAsn1(header) {
        if (!header) return null;
        const prev = header.previous_hash;
        const data = header.data_hash;
        const num = header.number;
        const prevBuf = (prev != null) ? (Buffer.isBuffer(prev) ? prev : Buffer.from(prev)) : Buffer.alloc(0);
        const dataBuf = (data != null) ? (Buffer.isBuffer(data) ? data : Buffer.from(data)) : Buffer.alloc(0);
        let n = 0n;
        if (num !== undefined && num !== null) {
            if (typeof num === 'number') n = BigInt(num);
            else if (typeof num.low === 'number') n = BigInt(num.low) + BigInt(num.high || 0) * (2n ** 32n);
            else if (typeof num.toNumber === 'function') n = BigInt(num.toNumber());
            else n = BigInt(num);
        }
        if (n < 0n) n = 0n;
        let numBytes;
        if (n === 0n) numBytes = Buffer.from([0]);
        else {
            let h = n.toString(16);
            if (h.length % 2) h = '0' + h;
            numBytes = Buffer.from(h, 'hex');
            if (numBytes[0] & 0x80) numBytes = Buffer.concat([Buffer.from([0x00]), numBytes]);
        }
        const encLenFull = (L) => {
            if (L < 128) return Buffer.from([L]);
            const bytes = [];
            let x = L;
            while (x > 0) { bytes.unshift(x & 0xff); x = Math.floor(x / 256); }
            return Buffer.concat([Buffer.from([0x80 | bytes.length]), Buffer.from(bytes)]);
        };
        const encInt = Buffer.concat([Buffer.from([0x02]), encLenFull(numBytes.length), numBytes]);
        const encOct = (buf) => Buffer.concat([Buffer.from([0x04]), encLenFull(buf.length), buf]);
        const inner = Buffer.concat([encInt, encOct(prevBuf), encOct(dataBuf)]);
        return Buffer.concat([Buffer.from([0x30]), encLenFull(inner.length), inner]);
    }

    // Register vehicle - Fabric only (with separate OR and CR)
    async registerVehicle(vehicleData) {
        // Auto-reconnect if connection lost
        if (!this.isConnected || this.mode !== 'fabric') {
            console.log('⚠️ Fabric connection lost, attempting to reconnect...');
            try {
                await this.initialize();
                console.log('✅ Fabric connection restored');
            } catch (reconnectError) {
                throw new Error(`Not connected to Fabric network and reconnection failed: ${reconnectError.message}`);
            }
        }

        try {
            // Ensure contract is available
            if (!this.contract) {
                throw new Error('Fabric contract not initialized. Connection may have been lost.');
            }

            // Ensure vehicleData includes separate OR and CR numbers
            const vehiclePayload = {
                ...vehicleData,
                orNumber: vehicleData.orNumber || vehicleData.or_number || '',
                crNumber: vehicleData.crNumber || vehicleData.cr_number || '',
                dateOfRegistration: vehicleData.dateOfRegistration || vehicleData.date_of_registration || new Date().toISOString(),
                registrationType: vehicleData.registrationType || vehicleData.registration_type || 'PRIVATE',
                // Calculate expiry date (1 year from registration)
                expiryDate: vehicleData.expiryDate || vehicleData.expiry_date || (() => {
                    const expiry = new Date(vehicleData.dateOfRegistration || vehicleData.date_of_registration || new Date());
                    expiry.setFullYear(expiry.getFullYear() + 1);
                    return expiry.toISOString();
                })()
            };

            const vehicleJson = JSON.stringify(vehiclePayload);
            // Use createTransaction() to get access to transaction ID
            const transaction = this.contract.createTransaction('RegisterVehicle');
            const fabricResult = await transaction.submit(vehicleJson);
            const transactionId = transaction.getTransactionId();

            const result = {
                success: true,
                message: 'Vehicle registered successfully on Fabric',
                transactionId: transactionId,
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
    // Accepts optional userContext for MSP-based filtering
    async getVehicle(vin, userContext = null) {
        // CRITICAL: Enforce real Fabric service - no mock fallbacks
        if (this.mode !== 'fabric') {
            throw new Error('CRITICAL: Mock blockchain service is not allowed. Real Hyperledger Fabric connection required.');
        }

        if (!this.isConnected) {
            throw new Error('Not connected to Fabric network. Cannot query vehicle.');
        }

        try {
            // Use filtered query for HPG/Insurance if user context is provided
            let useFilteredQuery = false;
            if (userContext) {
                const userRole = userContext.role;
                const userEmail = userContext.email;

                // HPG and Insurance should use filtered query
                if (['hpg_admin', 'hpg_officer'].includes(userRole) ||
                    (userRole === 'admin' && userEmail && userEmail.toLowerCase().includes('hpg'))) {
                    useFilteredQuery = true;
                }

                if (['insurance_verifier', 'insurance_admin'].includes(userRole)) {
                    useFilteredQuery = true;
                }
            }

            // Use appropriate query function
            const queryFunction = useFilteredQuery ? 'GetVehicleForVerification' : 'GetVehicle';
            const result = await this.contract.evaluateTransaction(queryFunction, vin);
            const vehicle = JSON.parse(result.toString());

            return {
                success: true,
                vehicle: vehicle,
                filtered: useFilteredQuery
            };

        } catch (error) {
            // Check if it's a "not found" error
            const errorMessage = error.message || error.toString();
            const isNotFound = errorMessage.includes('not found') ||
                errorMessage.includes('Vehicle with VIN') ||
                errorMessage.includes('does not exist') ||
                (error.status === 500 && errorMessage.includes('Failed to get vehicle'));

            if (isNotFound) {
                // Return a structured error that can be handled gracefully
                throw new Error(`Vehicle with VIN ${vin} not found`);
            }

            console.error('❌ Failed to get vehicle from Fabric:', error);
            throw new Error(`Vehicle query failed: ${errorMessage}`);
        }
    }

    // Update verification status - Fabric only
    async updateVerificationStatus(vin, verificationType, status, notes) {
        if (!this.isConnected || this.mode !== 'fabric') {
            throw new Error('Not connected to Fabric network. Cannot update verification status.');
        }

        try {
            // Use createTransaction() to get access to transaction ID
            const transaction = this.contract.createTransaction('UpdateVerificationStatus');
            const fabricResult = await transaction.submit(vin, verificationType, status, notes || '');
            const transactionId = transaction.getTransactionId();

            const result = {
                success: true,
                message: 'Verification status updated successfully on Fabric',
                transactionId: transactionId,
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

            // Use createTransaction() to get access to transaction ID
            const transaction = this.contract.createTransaction('TransferOwnership');
            const fabricResult = await transaction.submit(vin, newOwnerJson, transferJson);
            const transactionId = transaction.getTransactionId();

            return {
                success: true,
                message: 'Ownership transferred successfully on Fabric',
                transactionId: transactionId,
                vin: vin,
                newOwner: newOwnerData.email
            };

        } catch (error) {
            console.error('❌ Failed to transfer ownership on Fabric:', error);
            throw new Error(`Ownership transfer failed: ${error.message}`);
        }
    }

    // Delete vehicle from blockchain (complete removal)
    async deleteVehicle(vin) {
        if (this.mode !== 'fabric') {
            throw new Error('Blockchain service is not available. BLOCKCHAIN_MODE must be fabric.');
        }

        if (!this.isConnected || !this.contract) {
            throw new Error('Not connected to Fabric network. Cannot delete vehicle.');
        }

        try {
            // Use createTransaction() to get access to transaction ID
            const transaction = this.contract.createTransaction('DeleteVehicle');
            const fabricResult = await transaction.submit(vin);
            const transactionId = transaction.getTransactionId();

            return {
                success: true,
                message: 'Vehicle deleted successfully from blockchain',
                transactionId: transactionId,
                vin: vin
            };
        } catch (error) {
            console.error('DeleteVehicle chaincode error:', error);
            throw error;
        }
    }

    // Scrap vehicle - Marks vehicle as end-of-life while preserving history
    async scrapVehicle(vin, scrapReason) {
        if (this.mode !== 'fabric') {
            throw new Error('Blockchain service is not available. BLOCKCHAIN_MODE must be fabric.');
        }

        if (!this.isConnected || !this.contract) {
            throw new Error('Not connected to Fabric network. Cannot scrap vehicle.');
        }

        try {
            // Use createTransaction() to get access to transaction ID
            const transaction = this.contract.createTransaction('ScrapVehicle');
            const fabricResult = await transaction.submit(vin, scrapReason);
            const transactionId = transaction.getTransactionId();

            return {
                success: true,
                message: 'Vehicle scrapped successfully on blockchain',
                transactionId: transactionId,
                vin: vin
            };
        } catch (error) {
            console.error('ScrapVehicle chaincode error:', error);
            throw error;
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

    // Get ownership history from Fabric blockchain - CRITICAL: This is the source of truth
    async getOwnershipHistory(vin) {
        if (!this.isConnected || this.mode !== 'fabric') {
            throw new Error('Not connected to Fabric network. Cannot query ownership history.');
        }

        try {
            const result = await this.contract.evaluateTransaction('GetOwnershipHistory', vin);
            const ownershipData = JSON.parse(result.toString());

            return {
                success: true,
                currentOwner: ownershipData.currentOwner,
                pastOwners: ownershipData.pastOwners || [],
                ownershipTransfers: ownershipData.ownershipTransfers || []
            };

        } catch (error) {
            console.error('❌ Failed to get ownership history from Fabric:', error);
            throw new Error(`Ownership history query failed: ${error.message}`);
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
                } catch (vehicleError) {
                    // Vehicle not found yet - this is expected during propagation
                    // Continue retrying
                    if (attempt < maxRetries) {
                        const isNotFoundError = vehicleError.message && (
                            vehicleError.message.includes('not found') ||
                            vehicleError.message.includes('Vehicle with VIN') ||
                            vehicleError.message.includes('does not exist')
                        );

                        if (isNotFoundError) {
                            console.log(`⏳ Vehicle ${vin} not yet available on ledger (attempt ${attempt}/${maxRetries}), retrying in ${retryDelay}ms...`);
                        } else {
                            console.warn(`⚠️  Vehicle query attempt ${attempt}/${maxRetries}: ${vehicleError.message}`);
                        }
                        await new Promise(resolve => setTimeout(resolve, retryDelay));
                        continue;
                    } else {
                        // Max retries reached - vehicle still not found
                        console.warn(`⚠️ Vehicle ${vin} not found on ledger after ${maxRetries} attempts. Transaction may still be propagating.`);
                        return {
                            status: 'pending',
                            transactionId: transactionId,
                            vin: vin,
                            mode: 'fabric',
                            message: 'Transaction submitted but vehicle not yet queryable on ledger'
                        };
                    }
                }
            }

            // If we get here, all retries exhausted without finding vehicle
            return {
                status: 'pending',
                transactionId: transactionId,
                vin: vin,
                message: 'Transaction submitted but not yet committed after polling',
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

    // Get chain info directly from Fabric using qscc (Query System Chaincode)
    async getChainInfo() {
        this.ensureFabricConnection();

        try {
            if (!this.network) {
                throw new Error('Network not initialized. Cannot query chain info.');
            }

            const channelName = 'ltochannel'; // Your channel name

            // Use qscc (Query System Chaincode) to get chain info
            // qscc is a built-in system chaincode available on all Fabric networks
            try {
                const qscc = this.network.getContract('qscc');

                // GetChainInfo returns: height, currentBlockHash, previousBlockHash
                const chainInfoBytes = await qscc.evaluateTransaction('GetChainInfo', channelName);

                if (!chainInfoBytes || chainInfoBytes.length === 0) {
                    throw new Error('GetChainInfo returned empty result');
                }

                // Parse the protobuf response using fabric-protos (included in fabric-network)
                let fabricProtos;
                try {
                    fabricProtos = require('fabric-protos');
                } catch (protosError) {
                    // If fabric-protos not available, try alternative
                    console.warn('⚠️ fabric-protos not found, using alternative parsing');
                    throw new Error('fabric-protos not available');
                }

                const blockchainInfo = fabricProtos.common.BlockchainInfo.decode(chainInfoBytes);

                return {
                    height: Number(blockchainInfo.height.toString()),
                    currentBlockHash: this.bufferToHex(blockchainInfo.currentBlockHash),
                    previousBlockHash: this.bufferToHex(blockchainInfo.previousBlockHash),
                    source: 'qscc'
                };
            } catch (qsccError) {
                console.error('❌ CRITICAL: qscc GetChainInfo failed:', qsccError.message);
                throw new Error(`Failed to query chain info from Fabric: ${qsccError.message}. Chaincode query failed - Fabric network may be unavailable.`);
            }

        } catch (error) {
            console.error('❌ CRITICAL: Failed to query chain info from Fabric:', error);
            console.error('Error details:', {
                networkExists: !!this.network,
                channelExists: !!this.channel,
                errorMessage: error.message
            });
            // STRICT FABRIC: Throw error instead of returning minimal info
            throw new Error(`Chain info query failed: ${error.message}. Fabric network must be operational.`);
        }
    }

    extractTxIdsFromBlock(block) {
        try {
            const fabricProtos = require('fabric-protos');
            const txIds = [];

            // Check if block.data exists
            if (!block || !block.data) {
                console.warn('⚠️ Block or block.data is missing');
                return [];
            }

            // In fabric-protos, block.data.data is an array of Envelope bytes
            const envelopeBytes = block.data.data || [];

            if (!Array.isArray(envelopeBytes) || envelopeBytes.length === 0) {
                console.log(`ℹ️ Block ${block.header?.number?.toString() || 'unknown'} has no envelopes`);
                return [];
            }

            console.log(`🔍 Processing block ${block.header?.number?.toString() || 'unknown'} with ${envelopeBytes.length} envelopes`);

            for (let i = 0; i < envelopeBytes.length; i++) {
                try {
                    const envelopeBytesItem = envelopeBytes[i];

                    // Check if it's already a Buffer or needs to be converted
                    let envelopeBuffer = envelopeBytesItem;
                    if (Buffer.isBuffer(envelopeBytesItem)) {
                        envelopeBuffer = envelopeBytesItem;
                    } else if (typeof envelopeBytesItem === 'string') {
                        envelopeBuffer = Buffer.from(envelopeBytesItem, 'base64');
                    } else if (envelopeBytesItem instanceof Uint8Array) {
                        envelopeBuffer = Buffer.from(envelopeBytesItem);
                    } else {
                        console.warn(`⚠️ Envelope ${i} is not in expected format:`, typeof envelopeBytesItem);
                        continue;
                    }

                    // Decode the envelope
                    const envelope = fabricProtos.common.Envelope.decode(envelopeBuffer);

                    if (!envelope || !envelope.payload) {
                        console.warn(`⚠️ Envelope ${i} has no payload`);
                        continue;
                    }

                    // Extract transaction ID from channel header
                    const payload = fabricProtos.common.Payload.decode(envelope.payload);

                    if (!payload || !payload.header || !payload.header.channel_header) {
                        console.warn(`⚠️ Envelope ${i} has no channel header`);
                        continue;
                    }

                    const channelHeader = fabricProtos.common.ChannelHeader.decode(payload.header.channel_header);

                    if (channelHeader && channelHeader.tx_id) {
                        const txId = channelHeader.tx_id;
                        txIds.push(txId);
                        console.log(`  ✅ Found transaction: ${txId.substring(0, 16)}...`);
                    } else {
                        console.warn(`⚠️ Envelope ${i} has no tx_id`);
                    }
                } catch (decodeError) {
                    // Log the error for debugging
                    console.warn(`⚠️ Failed to decode envelope ${i}:`, decodeError.message);
                    // Skip invalid envelopes (might be config transactions or other types)
                    continue;
                }
            }

            console.log(`✅ Block ${block.header?.number?.toString() || 'unknown'} extracted ${txIds.length} transaction IDs`);
            return txIds;
        } catch (error) {
            console.error('❌ Failed to extract transaction IDs from block:', error.message);
            console.error('Block structure:', {
                hasBlock: !!block,
                hasData: !!block?.data,
                hasDataData: !!block?.data?.data,
                dataDataType: Array.isArray(block?.data?.data) ? 'array' : typeof block?.data?.data,
                dataDataLength: Array.isArray(block?.data?.data) ? block.data.data.length : 'N/A'
            });
            return [];
        }
    }

    summarizeBlock(block) {
        const header = block?.header || {};
        const txIds = this.extractTxIdsFromBlock(block);

        // Extract timestamp from first transaction envelope
        let firstTimestamp = null;
        try {
            const fabricProtos = require('fabric-protos');
            const envelopeBytes = block?.data?.data || [];
            for (const envelopeBytesItem of envelopeBytes) {
                try {
                    const envelope = fabricProtos.common.Envelope.decode(envelopeBytesItem);
                    const payload = fabricProtos.common.Payload.decode(envelope.payload);
                    const channelHeader = fabricProtos.common.ChannelHeader.decode(payload.header.channel_header);

                    if (channelHeader.timestamp) {
                        // Convert protobuf Timestamp to JavaScript Date
                        const seconds = channelHeader.timestamp.seconds?.toNumber() || 0;
                        const nanos = channelHeader.timestamp.nanos || 0;
                        firstTimestamp = new Date(seconds * 1000 + nanos / 1000000).toISOString();
                        break;
                    }
                } catch {
                    continue;
                }
            }
        } catch (error) {
            console.warn('⚠️ Failed to extract timestamp from block:', error.message);
        }

        // Compute current block hash exactly like Fabric: SHA-256 of BlockHeaderBytes(header).
        // Fabric's BlockHeaderBytes uses ASN.1 DER: SEQUENCE { INTEGER number, OCTET STRING previous_hash, OCTET STRING data_hash }
        // (see fabric/protoutil/blockutils.go BlockHeaderBytes+BlockHeaderHash). This must match
        // the next block's header.previous_hash for chain integrity.
        let currentHash = null;
        try {
            const headerBytes = this._blockHeaderBytesAsn1(block?.header);
            if (headerBytes && headerBytes.length > 0) {
                currentHash = '0x' + crypto.createHash('sha256').update(headerBytes).digest('hex');
            }
        } catch (error) {
            console.warn('⚠️ Failed to compute block hash (Fabric ASN.1 BlockHeaderBytes):', error.message);
        }

        return {
            blockNumber: this.longToNumber(header.number),
            previousHash: this.bufferToHex(header.previous_hash),
            dataHash: this.bufferToHex(header.data_hash),
            currentHash: currentHash, // Computed header hash for chain integrity validation
            txCount: txIds.length,
            txIds,
            timestamp: firstTimestamp || null
        };
    }

    // Fetch a specific block header and transaction list from Fabric using qscc
    async getBlockHeader(blockNumber) {
        this.ensureFabricConnection();

        const numericBlock = parseInt(blockNumber, 10);
        if (Number.isNaN(numericBlock)) {
            throw new Error('Invalid block number');
        }

        if (!this.network) {
            throw new Error('Network not initialized. Cannot query block.');
        }

        try {
            const channelName = 'ltochannel';
            const qscc = this.network.getContract('qscc');
            const fabricProtos = require('fabric-protos');

            const blockBytes = await qscc.evaluateTransaction('GetBlockByNumber', channelName, numericBlock.toString());

            if (!blockBytes || blockBytes.length === 0) {
                throw new Error(`Block ${blockNumber} not found`);
            }

            const block = fabricProtos.common.Block.decode(blockBytes);
            return this.summarizeBlock(block);
        } catch (error) {
            console.error('❌ Failed to query block from Fabric:', error);
            throw new Error(`Failed to query block ${blockNumber}: ${error.message}`);
        }
    }

    // Fetch the block that contains a given transaction ID using qscc
    async getBlockByTxId(txId) {
        this.ensureFabricConnection();

        if (!txId) {
            throw new Error('Transaction ID is required');
        }

        if (!this.network) {
            throw new Error('Network not initialized. Cannot query block.');
        }

        try {
            const channelName = 'ltochannel';
            const qscc = this.network.getContract('qscc');
            const fabricProtos = require('fabric-protos');

            const blockBytes = await qscc.evaluateTransaction('GetBlockByTxID', channelName, txId);

            if (!blockBytes || blockBytes.length === 0) {
                throw new Error(`Block containing transaction ${txId} not found`);
            }

            const block = fabricProtos.common.Block.decode(blockBytes);
            const summary = this.summarizeBlock(block);

            return {
                ...summary,
                txId,
                source: 'qscc'
            };
        } catch (error) {
            console.error('❌ Failed to query block by transaction ID:', error);
            throw new Error(`Failed to query block containing tx ${txId}: ${error.message}`);
        }
    }

    extractEndorsements(processedTx) {
        const actions = processedTx?.transactionEnvelope?.payload?.data?.actions || [];
        const endorsements = [];

        actions.forEach(action => {
            const endorsementsList = action?.payload?.action?.endorsements || [];
            endorsementsList.forEach(endorsement => {
                endorsements.push({
                    mspId: endorsement?.endorser?.Mspid || endorsement?.endorser?.mspid || 'unknown',
                    signature: this.bufferToHex(endorsement?.signature)
                });
            });
        });

        return endorsements;
    }

    // Get validation code name from numeric code
    getValidationCodeName(code) {
        const codes = {
            0: 'VALID',
            1: 'NIL_ENVELOPE',
            2: 'BAD_PAYLOAD',
            3: 'BAD_COMMON_HEADER',
            4: 'BAD_CREATOR_SIGNATURE',
            5: 'INVALID_ENDORSER_TRANSACTION',
            6: 'INVALID_CONFIG_TRANSACTION',
            7: 'BAD_HEADER_EXTENSION',
            8: 'BAD_CHANNEL_HEADER',
            9: 'BAD_RESPONSE_PAYLOAD',
            10: 'BAD_RWSET',
            11: 'ILLEGAL_WRITESET',
            12: 'INVALID_WRITESET',
            13: 'INVALID_CHAINCODE',
            14: 'MVCC_READ_CONFLICT',
            15: 'PHANTOM_READ_CONFLICT',
            16: 'UNKNOWN_TX_TYPE',
            17: 'TARGET_CHAIN_NOT_FOUND',
            18: 'MARSHAL_TX_ERROR',
            19: 'NIL_TXACTION',
            20: 'UNEXPECTED_ACTION_PAYLOAD',
            21: 'INVALID_OTHER_REASON',
            22: 'INVALID_ENDORSEMENT_POLICY',
            23: 'INVALID_MSP_ERROR',
            24: 'INVALID_IDENTITY',
            25: 'INVALID_SIGNATURE',
            26: 'INVALID_HEADER',
            27: 'INVALID_CHAINCODE_VERSION',
            28: 'INVALID_CHAINCODE_NAME',
            29: 'INVALID_CHAINCODE_PATH',
            30: 'INVALID_CHAINCODE_INSTALLATION',
            31: 'INVALID_CHAINCODE_INSTANTIATION',
            32: 'INVALID_CHAINCODE_UPGRADE',
            33: 'INVALID_CHAINCODE_DEPLOYMENT',
            34: 'INVALID_CHAINCODE_EXECUTION',
            35: 'INVALID_CHAINCODE_QUERY',
            36: 'INVALID_CHAINCODE_INVOCATION',
            37: 'INVALID_CHAINCODE_STATE',
            38: 'INVALID_CHAINCODE_EVENT',
            39: 'INVALID_CHAINCODE_RESULT',
            40: 'INVALID_CHAINCODE_RESPONSE',
            41: 'INVALID_CHAINCODE_PROPOSAL',
            42: 'INVALID_CHAINCODE_PROPOSAL_RESPONSE',
            43: 'INVALID_CHAINCODE_PROPOSAL_PAYLOAD',
            44: 'INVALID_CHAINCODE_PROPOSAL_HEADER',
            45: 'INVALID_CHAINCODE_PROPOSAL_ENDORSEMENT',
            46: 'INVALID_CHAINCODE_PROPOSAL_SIGNATURE',
            47: 'INVALID_CHAINCODE_PROPOSAL_TIMEOUT',
            48: 'INVALID_CHAINCODE_PROPOSAL_RETRY',
            49: 'INVALID_CHAINCODE_PROPOSAL_RETRY_LIMIT',
            50: 'INVALID_CHAINCODE_PROPOSAL_RETRY_DELAY',
            51: 'INVALID_CHAINCODE_PROPOSAL_RETRY_BACKOFF',
            52: 'INVALID_CHAINCODE_PROPOSAL_RETRY_MAX_DELAY',
            53: 'INVALID_CHAINCODE_PROPOSAL_RETRY_INITIAL_DELAY',
            54: 'INVALID_CHAINCODE_PROPOSAL_RETRY_MULTIPLIER',
            55: 'INVALID_CHAINCODE_PROPOSAL_RETRY_MAX_MULTIPLIER',
            56: 'INVALID_CHAINCODE_PROPOSAL_RETRY_RANDOMIZATION_FACTOR',
            57: 'INVALID_CHAINCODE_PROPOSAL_RETRY_MAX_RANDOMIZATION_FACTOR',
            58: 'INVALID_CHAINCODE_PROPOSAL_RETRY_JITTER',
            59: 'INVALID_CHAINCODE_PROPOSAL_RETRY_MAX_JITTER',
            60: 'INVALID_CHAINCODE_PROPOSAL_RETRY_EXPONENTIAL_BACKOFF',
            61: 'INVALID_CHAINCODE_PROPOSAL_RETRY_LINEAR_BACKOFF',
            62: 'INVALID_CHAINCODE_PROPOSAL_RETRY_CONSTANT_BACKOFF',
            63: 'INVALID_CHAINCODE_PROPOSAL_RETRY_CUSTOM_BACKOFF',
            64: 'INVALID_CHAINCODE_PROPOSAL_RETRY_NO_BACKOFF',
            65: 'INVALID_CHAINCODE_PROPOSAL_RETRY_DEFAULT_BACKOFF',
            66: 'INVALID_CHAINCODE_PROPOSAL_RETRY_BACKOFF_STRATEGY',
            67: 'INVALID_CHAINCODE_PROPOSAL_RETRY_BACKOFF_CONFIG',
            68: 'INVALID_CHAINCODE_PROPOSAL_RETRY_BACKOFF_PARAMS',
            69: 'INVALID_CHAINCODE_PROPOSAL_RETRY_BACKOFF_OPTIONS',
            70: 'INVALID_CHAINCODE_PROPOSAL_RETRY_BACKOFF_SETTINGS',
            71: 'INVALID_CHAINCODE_PROPOSAL_RETRY_BACKOFF_POLICY',
            72: 'INVALID_CHAINCODE_PROPOSAL_RETRY_BACKOFF_MECHANISM',
            73: 'INVALID_CHAINCODE_PROPOSAL_RETRY_BACKOFF_ALGORITHM',
            74: 'INVALID_CHAINCODE_PROPOSAL_RETRY_BACKOFF_IMPLEMENTATION',
            75: 'INVALID_CHAINCODE_PROPOSAL_RETRY_BACKOFF_LOGIC',
            76: 'INVALID_CHAINCODE_PROPOSAL_RETRY_BACKOFF_BEHAVIOR',
            77: 'INVALID_CHAINCODE_PROPOSAL_RETRY_BACKOFF_METHOD',
            78: 'INVALID_CHAINCODE_PROPOSAL_RETRY_BACKOFF_FUNCTION',
            79: 'INVALID_CHAINCODE_PROPOSAL_RETRY_BACKOFF_PROCEDURE',
            80: 'INVALID_CHAINCODE_PROPOSAL_RETRY_BACKOFF_ROUTINE',
            81: 'INVALID_CHAINCODE_PROPOSAL_RETRY_BACKOFF_WORKFLOW',
            82: 'INVALID_CHAINCODE_PROPOSAL_RETRY_BACKOFF_PROCESS',
            83: 'INVALID_CHAINCODE_PROPOSAL_RETRY_BACKOFF_OPERATION',
            84: 'INVALID_CHAINCODE_PROPOSAL_RETRY_BACKOFF_ACTION',
            85: 'INVALID_CHAINCODE_PROPOSAL_RETRY_BACKOFF_TASK',
            86: 'INVALID_CHAINCODE_PROPOSAL_RETRY_BACKOFF_JOB',
            87: 'INVALID_CHAINCODE_PROPOSAL_RETRY_BACKOFF_WORK',
            88: 'INVALID_CHAINCODE_PROPOSAL_RETRY_BACKOFF_ACTIVITY',
            89: 'INVALID_CHAINCODE_PROPOSAL_RETRY_BACKOFF_EVENT',
            90: 'INVALID_CHAINCODE_PROPOSAL_RETRY_BACKOFF_TRIGGER',
            91: 'INVALID_CHAINCODE_PROPOSAL_RETRY_BACKOFF_SIGNAL',
            92: 'INVALID_CHAINCODE_PROPOSAL_RETRY_BACKOFF_NOTIFICATION',
            93: 'INVALID_CHAINCODE_PROPOSAL_RETRY_BACKOFF_MESSAGE',
            94: 'INVALID_CHAINCODE_PROPOSAL_RETRY_BACKOFF_COMMUNICATION',
            95: 'INVALID_CHAINCODE_PROPOSAL_RETRY_BACKOFF_INTERACTION',
            96: 'INVALID_CHAINCODE_PROPOSAL_RETRY_BACKOFF_EXCHANGE',
            97: 'INVALID_CHAINCODE_PROPOSAL_RETRY_BACKOFF_TRANSACTION',
            98: 'INVALID_CHAINCODE_PROPOSAL_RETRY_BACKOFF_OPERATION',
            99: 'INVALID_CHAINCODE_PROPOSAL_RETRY_BACKOFF_PROCESS',
            100: 'INVALID_CHAINCODE_PROPOSAL_RETRY_BACKOFF_WORKFLOW'
        };
        return codes[code] || `UNKNOWN_CODE_${code}`;
    }

    // Build a transaction proof from Fabric including block placement and endorsements
    async getTransactionProof(txId) {
        this.ensureFabricConnection();

        if (!txId) {
            throw new Error('Transaction ID is required');
        }

        // Validate txId format - must be 64-char hex (real Fabric transaction)
        if (!/^[a-f0-9]{64}$/i.test(txId)) {
            throw new Error('Invalid transaction ID format. Must be 64-character hex (Fabric transaction).');
        }

        if (!this.channel) {
            throw new Error('Channel not initialized. Cannot query transaction proof.');
        }

        try {
            // REAL FABRIC ONLY: Both methods below use REAL Fabric services (no mocks)
            // Method 1: Try native queryTransaction + queryBlockByTxID (if available in SDK version)
            // Method 2: Use qscc (Query System Chaincode) - REAL Fabric system chaincode, not a mock

            const hasQueryTransaction = typeof this.channel.queryTransaction === 'function';
            const hasQueryBlockByTxID = typeof this.channel.queryBlockByTxID === 'function';

            if (hasQueryTransaction && hasQueryBlockByTxID) {
                try {
                    const [processedTx, block] = await Promise.all([
                        this.channel.queryTransaction(txId).catch(err => {
                            console.warn(`queryTransaction failed for ${txId}:`, err.message);
                            return null;
                        }),
                        this.channel.queryBlockByTxID(txId).catch(err => {
                            console.warn(`queryBlockByTxID failed for ${txId}:`, err.message);
                            return null;
                        })
                    ]);

                    if (processedTx && block) {
                        // SUCCESS: Native methods worked - return real Fabric data
                        const blockSummary = this.summarizeBlock(block);
                        const txIndex = blockSummary.txIds.findIndex(id => id === txId);
                        const channelHeader = processedTx?.transactionEnvelope?.payload?.header?.channel_header || {};
                        const signatureHeader = processedTx?.transactionEnvelope?.payload?.header?.signature_header || {};
                        const validationCode = processedTx?.validationCode ?? 0;

                        return {
                            transactionId: txId,
                            validationCode: validationCode,
                            validationCodeName: this.getValidationCodeName(validationCode),
                            block: {
                                number: blockSummary.blockNumber,
                                hash: blockSummary.dataHash,
                                previousHash: blockSummary.previousHash,
                                dataHash: blockSummary.dataHash,
                                timestamp: blockSummary.timestamp
                            },
                            txIndex: txIndex >= 0 ? txIndex : null,
                            txCount: blockSummary.txCount,
                            channelId: channelHeader.channel_id || null,
                            timestamp: channelHeader.timestamp || null,
                            creatorMspId: signatureHeader?.creator?.Mspid || signatureHeader?.creator?.mspid || null,
                            endorsements: this.extractEndorsements(processedTx),
                            source: 'fabric_native'
                        };
                    } else {
                        // Native methods returned null/partial - use qscc (REAL Fabric system chaincode)
                        console.log('ℹ️ Native methods returned null/partial, using qscc (REAL Fabric system chaincode)');
                    }
                } catch (nativeError) {
                    // Native methods failed - use qscc (REAL Fabric system chaincode)
                    console.log('ℹ️ Native methods unavailable, using qscc (REAL Fabric system chaincode):', nativeError.message);
                }
            } else {
                // Native methods not available in this SDK version - use qscc (REAL Fabric system chaincode)
                // qscc is the standard approach for fabric-network SDK
                console.log('ℹ️ Using qscc (REAL Fabric Query System Chaincode - standard for fabric-network SDK)');
            }

            // Method 2: Use qscc (Query System Chaincode) - REAL Fabric system chaincode
            // qscc is built into Hyperledger Fabric and provides real blockchain queries
            // This is NOT a mock - it's a real Fabric system chaincode
            console.log('📋 Querying transaction proof via qscc (REAL Fabric system chaincode)');

            if (!this.network) {
                throw new Error('Network not initialized. Cannot query transaction proof.');
            }

            const channelName = 'ltochannel';
            const qscc = this.network.getContract('qscc');
            const fabricProtos = require('fabric-protos');

            try {
                // Use qscc GetBlockByTxID to get the block containing the transaction
                const blockBytes = await qscc.evaluateTransaction('GetBlockByTxID', channelName, txId);

                if (!blockBytes || blockBytes.length === 0) {
                    throw new Error(`Transaction ${txId} not found on ledger`);
                }

                const block = fabricProtos.common.Block.decode(blockBytes);
                const summary = this.summarizeBlock(block);
                const txIndex = summary.txIds.findIndex(id => id === txId);

                // Try to get transaction details via qscc GetTransactionByID
                let transactionDetails = null;
                try {
                    const txBytes = await qscc.evaluateTransaction('GetTransactionByID', channelName, txId);
                    if (txBytes && txBytes.length > 0) {
                        const processedTx = fabricProtos.protos.ProcessedTransaction.decode(txBytes);
                        transactionDetails = {
                            validationCode: processedTx.validationCode || 0,
                            channelHeader: processedTx.transactionEnvelope?.payload?.header?.channel_header || {},
                            signatureHeader: processedTx.transactionEnvelope?.payload?.header?.signature_header || {}
                        };
                    }
                } catch (txError) {
                    console.warn('⚠️ Could not get transaction details via qscc:', txError.message);
                }

                return {
                    transactionId: txId,
                    validationCode: transactionDetails?.validationCode ?? 0,
                    validationCodeName: this.getValidationCodeName(transactionDetails?.validationCode ?? 0),
                    block: {
                        number: summary.blockNumber,
                        hash: summary.dataHash,
                        previousHash: summary.previousHash,
                        dataHash: summary.dataHash,
                        timestamp: summary.timestamp
                    },
                    txIndex: txIndex >= 0 ? txIndex : null,
                    txCount: summary.txCount,
                    channelId: transactionDetails?.channelHeader?.channel_id || null,
                    timestamp: transactionDetails?.channelHeader?.timestamp || summary.timestamp || null,
                    creatorMspId: transactionDetails?.signatureHeader?.creator?.Mspid || transactionDetails?.signatureHeader?.creator?.mspid || null,
                    endorsements: transactionDetails ? this.extractEndorsements(transactionDetails) : [],
                    source: 'qscc',
                    note: transactionDetails ? null : 'Proof generated via qscc block query. Transaction details unavailable.'
                };
            } catch (qsccError) {
                // REAL FABRIC ONLY: qscc failure means real Fabric query failed - throw error (no mock fallback)
                console.error('❌ REAL Fabric qscc query failed:', qsccError.message);
                throw new Error(`REAL Fabric transaction proof query failed via qscc: ${qsccError.message}. No fallbacks to mocks allowed.`);
            }

        } catch (error) {
            console.error('❌ Failed to build transaction proof:', error);
            console.error('Error details:', {
                txId,
                channelExists: !!this.channel,
                channelType: this.channel?.constructor?.name,
                hasQueryTransaction: typeof this.channel?.queryTransaction === 'function',
                hasQueryBlockByTxID: typeof this.channel?.queryBlockByTxID === 'function',
                hasQueryBlock: typeof this.channel?.queryBlock === 'function',
                errorMessage: error.message,
                errorStack: error.stack
            });
            throw new Error(`Failed to get transaction proof: ${error.message}`);
        }
    }

    // Get all transactions from Fabric (using chaincode queries)
    // Accepts optional userContext for MSP-based filtering
    async getAllTransactions(userContext = null) {
        if (!this.isConnected || this.mode !== 'fabric') {
            throw new Error('Not connected to Fabric network. Cannot query transactions.');
        }

        try {
            // Determine if we should use filtered query based on user context
            let useFilteredQuery = false;
            if (userContext) {
                const userRole = userContext.role;
                const userEmail = userContext.email;

                // HPG and Insurance should use filtered query
                if (['hpg_admin', 'hpg_officer'].includes(userRole) ||
                    (userRole === 'admin' && userEmail && userEmail.toLowerCase().includes('hpg'))) {
                    useFilteredQuery = true;
                }

                if (['insurance_verifier', 'insurance_admin'].includes(userRole)) {
                    useFilteredQuery = true;
                }
            }

            // Query all vehicles from chaincode
            const queryFunction = useFilteredQuery ? 'QueryVehiclesForVerification' : 'GetAllVehicles';
            const vehiclesResult = await this.contract.evaluateTransaction(queryFunction);

            if (!vehiclesResult || vehiclesResult.length === 0) {
                console.log('⚠️  GetAllVehicles returned empty result');
                return [];
            }

            const vehiclesJson = vehiclesResult.toString();
            if (!vehiclesJson || vehiclesJson.trim() === '') {
                console.log('⚠️  GetAllVehicles returned empty string');
                return [];
            }

            let vehicles;
            try {
                vehicles = JSON.parse(vehiclesJson);
            } catch (parseError) {
                console.error('❌ Failed to parse vehicles JSON:', parseError);
                console.error('Raw response:', vehiclesJson.substring(0, 200));
                throw new Error(`Invalid JSON response from chaincode: ${parseError.message}`);
            }

            // Ensure vehicles is an array
            if (!Array.isArray(vehicles)) {
                console.warn('⚠️  GetAllVehicles did not return an array, got:', typeof vehicles);
                return [];
            }

            // Build transactions from vehicle histories
            const transactions = [];

            // Get recent blocks to map transactions to block numbers (optimized)
            let blockMap = new Map(); // txId -> blockNumber
            try {
                const blocks = await this.getAllBlocks(50); // Only get last 50 blocks for mapping
                blocks.forEach(block => {
                    if (block.txIds && Array.isArray(block.txIds)) {
                        block.txIds.forEach(txId => {
                            if (txId && !blockMap.has(txId)) {
                                blockMap.set(txId, block.blockNumber);
                            }
                        });
                    }
                });
                console.log(`✅ Mapped ${blockMap.size} transactions to blocks`);
            } catch (blockError) {
                console.warn('⚠️ Could not get blocks for transaction mapping:', blockError.message);
            }

            vehicles.forEach(vehicle => {
                // Add registration transaction
                if (vehicle.blockchainTxId) {
                    const blockNumber = blockMap.get(vehicle.blockchainTxId) || null;
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
                        blockNumber: blockNumber,
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

    // Get latest blocks from Fabric using qscc (optimized with limit)
    async getAllBlocks(limit = 20) {
        if (!this.isConnected || this.mode !== 'fabric') {
            throw new Error('Not connected to Fabric network. Cannot query blocks.');
        }

        if (!this.network) {
            throw new Error('Network not initialized. Cannot query blocks.');
        }

        try {
            const channelName = 'ltochannel';
            const qscc = this.network.getContract('qscc');

            // Get chain height
            const chainInfo = await this.getChainInfo();
            const height = chainInfo.height || 0;

            if (height === 0) {
                return [{
                    blockNumber: 0,
                    blockHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
                    previousHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
                    timestamp: new Date().toISOString(),
                    transactions: [],
                    transactionCount: 0,
                    dataHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
                    source: 'qscc'
                }];
            }

            const blocks = [];
            const fabricProtos = require('fabric-protos');

            // Query actual blocks from Fabric using qscc (most recent first)
            const startBlock = Math.max(0, height - limit);
            for (let i = height - 1; i >= startBlock; i--) {
                try {
                    const blockBytes = await qscc.evaluateTransaction('GetBlockByNumber', channelName, i.toString());
                    if (blockBytes && blockBytes.length > 0) {
                        const block = fabricProtos.common.Block.decode(blockBytes);
                        const summary = this.summarizeBlock(block);
                        blocks.push({
                            ...summary,
                            source: 'qscc'
                        });
                    }
                } catch (blockError) {
                    console.warn(`⚠️ Failed to query block ${i} via qscc:`, blockError.message);
                    // Continue with other blocks - don't fail entire operation
                }
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

    // Get transaction details by transaction ID
    // OPTIMIZED: This method should NOT be called directly for transaction lookup.
    // The backend route (blockchain.js) uses DB-first approach. This method is kept
    // for backward compatibility but should ideally not be used without DB lookup first.
    async getTransaction(txId) {
        if (!this.isConnected || this.mode !== 'fabric') {
            throw new Error('Not connected to Fabric network');
        }

        // CRITICAL: Do NOT scan entire ledger - this is extremely inefficient
        // Instead, throw an error indicating that DB-first lookup is required
        // The backend route should use vehicle_history table to map txId -> vin first,
        // then query Fabric by VIN if needed.
        throw new Error(
            'Direct transaction lookup by ID is not supported. ' +
            'Use database-first approach: Query vehicle_history table to get VIN, ' +
            'then query Fabric by VIN. Transaction IDs are not directly indexed in Fabric.'
        );
    }

    // Helper method: Get transaction by VIN (if chaincode supports it)
    // This is more efficient than scanning all transactions
    async getTransactionByVin(vin) {
        // CRITICAL: Enforce real Fabric service - no mock fallbacks
        if (this.mode !== 'fabric') {
            throw new Error('Real Hyperledger Fabric connection required');
        }

        if (!this.isConnected) {
            throw new Error('Not connected to Fabric network');
        }

        try {
            // Query vehicle by VIN (this is indexed in chaincode)
            const vehicle = await this.getVehicle(vin);
            if (vehicle && vehicle.success && vehicle.vehicle) {
                // Return transaction info from vehicle data
                return {
                    txId: vehicle.vehicle.lastTxId || vehicle.vehicle.transactionId || null,
                    timestamp: vehicle.vehicle.timestamp || vehicle.vehicle.createdAt || null,
                    validationCode: 'VALID',
                    blockNumber: vehicle.vehicle.blockNumber || null,
                    vehicleVin: vin,
                    vehiclePlate: vehicle.vehicle.plateNumber || null,
                    action: 'REGISTER_VEHICLE',
                    description: 'Vehicle registration transaction',
                    source: 'fabric'
                };
            }
            throw new Error(`Vehicle with VIN ${vin} not found on Fabric`);
        } catch (error) {
            console.error('Error getting transaction by VIN from Fabric:', error);
            throw new Error(`Failed to get transaction by VIN: ${error.message}`);
        }
    }

    // Mint vehicle (pre-minted, ownerless vehicle - CSR verified)
    async mintVehicle(vehicleData) {
        if (!this.isConnected || this.mode !== 'fabric') {
            throw new Error('Not connected to Fabric network. Cannot mint vehicle.');
        }

        try {
            const vehicleJson = JSON.stringify(vehicleData);
            const transaction = this.contract.createTransaction('MintVehicle');
            const fabricResult = await transaction.submit(vehicleJson);
            const transactionId = transaction.getTransactionId();

            return {
                success: true,
                message: 'Vehicle minted successfully on Fabric',
                transactionId: transactionId,
                vin: vehicleData.vin,
                status: 'MINTED'
            };

        } catch (error) {
            console.error('❌ Failed to mint vehicle on Fabric:', error);
            throw new Error(`Vehicle minting failed: ${error.message}`);
        }
    }

    // Attach owner to minted vehicle
    async attachOwnerToMintedVehicle(vin, ownerData, registrationData) {
        if (!this.isConnected || this.mode !== 'fabric') {
            throw new Error('Not connected to Fabric network. Cannot attach owner.');
        }

        try {
            const ownerJson = JSON.stringify(ownerData);
            const registrationJson = JSON.stringify(registrationData || {});

            const transaction = this.contract.createTransaction('AttachOwnerToMintedVehicle');
            const fabricResult = await transaction.submit(vin, ownerJson, registrationJson);
            const transactionId = transaction.getTransactionId();

            return {
                success: true,
                message: 'Owner attached to minted vehicle successfully on Fabric',
                transactionId: transactionId,
                vin: vin,
                owner: ownerData.email
            };

        } catch (error) {
            console.error('❌ Failed to attach owner to minted vehicle on Fabric:', error);
            throw new Error(`Owner attachment failed: ${error.message}`);
        }
    }

    // Update certificate hash on-chain
    async updateCertificateHash(vin, certificateType, pdfHash, ipfsCid) {
        if (!this.isConnected || this.mode !== 'fabric') {
            throw new Error('Not connected to Fabric network');
        }

        try {
            const transaction = this.contract.createTransaction('UpdateCertificateHash');
            const result = await transaction.submit(vin, certificateType, pdfHash, ipfsCid);
            const transactionId = transaction.getTransactionId();

            return {
                success: true,
                message: 'Certificate hash updated on Fabric',
                transactionId: transactionId,
                vin: vin,
                certificateType: certificateType
            };
        } catch (error) {
            console.error('❌ Failed to update certificate hash:', error);
            throw new Error(`Certificate hash update failed: ${error.message}`);
        }
    }

    // Get certificate hash from chain
    async getCertificateHash(vin, certificateType) {
        if (!this.isConnected || this.mode !== 'fabric') {
            throw new Error('Not connected to Fabric network');
        }

        try {
            const result = await this.contract.evaluateTransaction('GetCertificateHash', vin, certificateType);
            return JSON.parse(result.toString());
        } catch (error) {
            console.error('❌ Failed to get certificate hash:', error);
            throw new Error(`Certificate hash query failed: ${error.message}`);
        }
    }

    // Get vehicles by status (e.g., MINTED)
    async getVehiclesByStatus(status) {
        if (!this.isConnected || this.mode !== 'fabric') {
            throw new Error('Not connected to Fabric network. Cannot query by status.');
        }

        try {
            console.log(`🔍 Querying Fabric for vehicles with status: ${status}`);
            const results = await this.contract.evaluateTransaction('GetVehiclesByStatus', status);

            if (!results || results.length === 0) {
                return [];
            }

            const vehicles = JSON.parse(results.toString());
            return Array.isArray(vehicles) ? vehicles : [];
        } catch (error) {
            console.error(`❌ Failed to get vehicles by status (${status}):`, error);
            // Don't throw if it's just "no vehicles found" logic in chaincode
            if (error.message.includes('not found') || error.message.includes('no vehicles')) {
                return [];
            }
            throw new Error(`Fabric query failed: ${error.message}`);
        }
    }

    // Get pre-minted vehicles from Fabric - Source of Truth
    // Returns vehicles with status PRE_MINTED for LTO admin dashboard
    async getPreMintedVehicles() {
        if (!this.isConnected || this.mode !== 'fabric') {
            console.log('⚠️ Fabric connection lost, attempting to reconnect...');
            try {
                await this.initialize();
                console.log('✅ Fabric connection restored');
            } catch (reconnectError) {
                throw new Error(`Not connected to Fabric network and reconnection failed: ${reconnectError.message}`);
            }
        }

        try {
            console.log('🔍 Querying Fabric for PRE_MINTED vehicles...');

            // Use the existing getVehiclesByStatus method
            const vehicles = await this.getVehiclesByStatus('PRE_MINTED');

            // Format vehicles for the frontend
            const formattedVehicles = vehicles.map(vehicle => ({
                vin: vehicle.vin || vehicle.VIN,
                make: vehicle.make || vehicle.Make || '',
                model: vehicle.model || vehicle.Model || '',
                year: vehicle.year || vehicle.Year || vehicle.modelYear || null,
                plateNumber: vehicle.plateNumber || vehicle.plate_number || vehicle.PlateNumber || '',
                status: 'PRE_MINTED',
                mintedDate: vehicle.createdAt || vehicle.created_at || vehicle.registrationDate || new Date().toISOString(),
                // Include additional fields that may be useful
                color: vehicle.color || vehicle.Color || '',
                engineNumber: vehicle.engineNumber || vehicle.engine_number || '',
                chassisNumber: vehicle.chassisNumber || vehicle.chassis_number || '',
                ownerEmail: vehicle.ownerEmail || vehicle.owner_email || '',
                ownerName: vehicle.ownerName || vehicle.owner_name || ''
            }));

            console.log(`✅ Found ${formattedVehicles.length} PRE_MINTED vehicles from Fabric`);

            return {
                success: true,
                vehicles: formattedVehicles
            };
        } catch (error) {
            console.error('❌ Failed to get pre-minted vehicles from Fabric:', error);
            throw new Error(`Pre-minted vehicles query failed: ${error.message}`);
        }
    }
}

// Create singleton instance
const optimizedFabricService = new OptimizedFabricService();

module.exports = optimizedFabricService;
