// TrustChain LTO - Production Vehicle Registration Chaincode
// Hyperledger Fabric v2.5 Smart Contract

'use strict';

const { Contract } = require('fabric-contract-api');

class VehicleRegistrationContract extends Contract {

    constructor() {
        super('VehicleRegistrationContract');
    }

    // Helper: Get deterministic timestamp from transaction context
    // CRITICAL: Using new Date() causes non-determinism across peers, breaking multi-org endorsement
    // ctx.stub.getTxTimestamp() returns the same value on all peers for the same transaction
    _getTxTimestamp(ctx) {
        const txTimestamp = ctx.stub.getTxTimestamp();
        // Convert protobuf Timestamp to ISO string
        const seconds = txTimestamp.seconds.low || txTimestamp.seconds;
        const nanos = txTimestamp.nanos || 0;
        const milliseconds = seconds * 1000 + Math.floor(nanos / 1000000);
        return new Date(milliseconds).toISOString();
    }

    // Initialize the chaincode
    async Init(ctx) {
        console.log('Vehicle Registration Chaincode initialized');
        return 'Chaincode initialized successfully';
    }

    // Register a new vehicle
    async RegisterVehicle(ctx, vehicleData) {
        try {
            const vehicle = JSON.parse(vehicleData);

            // Validate required fields
            if (!vehicle.vin || !vehicle.make || !vehicle.model || !vehicle.year || !vehicle.owner) {
                throw new Error('Missing required vehicle information');
            }

            // Check if vehicle already exists
            const existingVehicle = await ctx.stub.getState(vehicle.vin);
            if (existingVehicle && existingVehicle.length > 0) {
                throw new Error(`Vehicle with VIN ${vehicle.vin} already exists`);
            }

            // Organization-based authorization (Permissioned Network)
            // Only LTO organization can register vehicles
            const clientMSPID = ctx.clientIdentity.getMSPID();
            if (clientMSPID !== 'LTOMSP') {
                throw new Error(`Unauthorized: Only LTO organization (LTOMSP) can register vehicles. Current MSP: ${clientMSPID}`);
            }

            // Generate unique transaction ID
            const txId = ctx.stub.getTxID();
            const timestamp = this._getTxTimestamp(ctx);

            // Extract officer information if provided (for traceability)
            const officerInfo = vehicle.officerInfo || {};

            // Create vehicle record (CR - Certificate of Registration - permanent identity)
            const vehicleRecord = {
                docType: 'CR', // Certificate of Registration
                vin: vehicle.vin,
                crNumber: vehicle.crNumber || '', // Separate CR number
                plateNumber: vehicle.plateNumber || '',
                make: vehicle.make,
                model: vehicle.model,
                year: vehicle.year,
                color: vehicle.color || '',
                engineNumber: vehicle.engineNumber || '',
                chassisNumber: vehicle.chassisNumber || '',
                vehicleType: vehicle.vehicleType || 'Car',
                // LTO required fields
                vehicleCategory: vehicle.vehicleCategory || '',
                passengerCapacity: vehicle.passengerCapacity || 0,
                grossVehicleWeight: vehicle.grossVehicleWeight || 0,
                netWeight: vehicle.netWeight || 0,
                classification: vehicle.classification || vehicle.registrationType || 'Private',
                owner: vehicle.owner, // Current owner
                pastOwners: [], // Track all past owners for audit trail
                status: 'REGISTERED',
                verificationStatus: {
                    insurance: 'PENDING',
                    hpg: 'PENDING',
                    admin: 'PENDING'
                },
                documents: vehicle.documents || {},
                notes: {
                    admin: '',
                    insurance: '',
                    hpg: ''
                },
                registrationDate: timestamp,
                dateOfRegistration: vehicle.dateOfRegistration || timestamp,
                lastUpdated: timestamp,
                priority: vehicle.priority || 'MEDIUM',
                history: [{
                    action: 'REGISTERED',
                    timestamp: timestamp,
                    performedBy: ctx.clientIdentity.getMSPID(),
                    officerInfo: {
                        userId: officerInfo.userId || null,
                        email: officerInfo.email || null,
                        name: officerInfo.name || null,
                        mspId: ctx.clientIdentity.getMSPID()
                    },
                    details: 'Vehicle registration submitted',
                    transactionId: txId
                }],
                blockchainTxId: txId,
                createdBy: ctx.clientIdentity.getMSPID(),
                registeredByOfficer: officerInfo.userId || null, // Track registering officer
                createdAt: timestamp,
                // Backward compatibility
                orCrNumber: vehicle.crNumber || vehicle.orCrNumber || ''
            };

            // Store CR (Certificate of Registration) in world state
            await ctx.stub.putState(vehicle.vin, Buffer.from(JSON.stringify(vehicleRecord)));

            // Create separate OR (Official Receipt) asset if OR number is provided
            if (vehicle.orNumber) {
                const orRecord = {
                    docType: 'OR', // Official Receipt
                    orNumber: vehicle.orNumber,
                    relatedCR: vehicle.vin, // Link to CR via VIN
                    crNumber: vehicle.crNumber || '',
                    amountPaid: vehicle.amountPaid || 0,
                    paymentDate: timestamp,
                    expiryDate: vehicle.expiryDate || '',
                    status: 'ACTIVE',
                    registrationType: vehicle.registrationType || 'PRIVATE',
                    issuedAt: timestamp,
                    blockchainTxId: txId,
                    createdBy: ctx.clientIdentity.getMSPID()
                };

                // Store OR asset with OR number as key
                await ctx.stub.putState(vehicle.orNumber, Buffer.from(JSON.stringify(orRecord)));

                // Create composite key for OR lookup by CR
                const orCrKey = ctx.stub.createCompositeKey('or~cr', [vehicle.orNumber, vehicle.vin]);
                await ctx.stub.putState(orCrKey, Buffer.from(vehicle.orNumber));
            }

            // Create composite key for owner lookup
            const ownerKey = ctx.stub.createCompositeKey('owner~vin', [vehicle.owner.email, vehicle.vin]);
            await ctx.stub.putState(ownerKey, Buffer.from(vehicle.vin));

            // Create composite key for plate number lookup
            if (vehicle.plateNumber) {
                const plateKey = ctx.stub.createCompositeKey('plate~vin', [vehicle.plateNumber, vehicle.vin]);
                await ctx.stub.putState(plateKey, Buffer.from(vehicle.vin));
            }

            // Create composite key for CR number lookup
            if (vehicle.crNumber) {
                const crKey = ctx.stub.createCompositeKey('cr~vin', [vehicle.crNumber, vehicle.vin]);
                await ctx.stub.putState(crKey, Buffer.from(vehicle.vin));
            }

            // Emit event (payload must be Buffer/Uint8Array per Fabric spec)
            ctx.stub.setEvent('VehicleRegistered', Buffer.from(JSON.stringify({
                vin: vehicle.vin,
                plateNumber: vehicle.plateNumber,
                owner: vehicle.owner.email,
                timestamp: timestamp,
                transactionId: txId
            })));

            console.log(`Vehicle ${vehicle.vin} registered successfully`);
            return JSON.stringify({
                success: true,
                message: 'Vehicle registered successfully',
                vin: vehicle.vin,
                plateNumber: vehicle.plateNumber,
                transactionId: txId,
                timestamp: timestamp
            });

        } catch (error) {
            console.error('Error registering vehicle:', error);
            throw new Error(`Failed to register vehicle: ${error.message}`);
        }
    }

    // Get vehicle by VIN
    async GetVehicle(ctx, vin) {
        try {
            const vehicleBytes = await ctx.stub.getState(vin);
            if (!vehicleBytes || vehicleBytes.length === 0) {
                throw new Error(`Vehicle with VIN ${vin} not found`);
            }

            const vehicle = JSON.parse(vehicleBytes.toString());

            // Apply MSP-based filtering for non-LTO organizations
            const clientMSPID = ctx.clientIdentity.getMSPID();

            if (clientMSPID === 'HPGMSP' || clientMSPID === 'InsuranceMSP') {
                // Return filtered view for HPG/Insurance
                return JSON.stringify(this.filterVehicleForVerification(vehicle, clientMSPID));
            }

            // LTO sees full record
            return JSON.stringify(vehicle);

        } catch (error) {
            console.error('Error getting vehicle:', error);
            throw new Error(`Failed to get vehicle: ${error.message}`);
        }
    }

    // Get vehicle with filtered view for verification purposes (HPG/Insurance)
    async GetVehicleForVerification(ctx, vin) {
        try {
            const vehicleBytes = await ctx.stub.getState(vin);
            if (!vehicleBytes || vehicleBytes.length === 0) {
                throw new Error(`Vehicle with VIN ${vin} not found`);
            }

            const vehicle = JSON.parse(vehicleBytes.toString());
            const clientMSPID = ctx.clientIdentity.getMSPID();

            // Apply filtering based on MSP
            const filteredVehicle = this.filterVehicleForVerification(vehicle, clientMSPID);
            return JSON.stringify(filteredVehicle);

        } catch (error) {
            console.error('Error getting vehicle for verification:', error);
            throw new Error(`Failed to get vehicle for verification: ${error.message}`);
        }
    }

    // Helper function to filter vehicle data based on MSP
    filterVehicleForVerification(vehicle, mspId) {
        if (mspId === 'LTOMSP') {
            // LTO sees full record
            return vehicle;
        }

        if (mspId === 'HPGMSP') {
            // HPG needs: vehicle details, engine/chassis, owner name/email (minimal), HPG verification status
            return {
                vin: vehicle.vin,
                make: vehicle.make,
                model: vehicle.model,
                year: vehicle.year,
                color: vehicle.color || '',
                engineNumber: vehicle.engineNumber || '',
                chassisNumber: vehicle.chassisNumber || '',
                plateNumber: vehicle.plateNumber || '',
                crNumber: vehicle.crNumber || '',
                owner: vehicle.owner ? {
                    name: vehicle.owner.name || `${vehicle.owner.firstName || ''} ${vehicle.owner.lastName || ''}`.trim(),
                    email: vehicle.owner.email || ''
                    // NO phone, address, detailed personal info
                } : null,
                verificationStatus: {
                    hpg: vehicle.verificationStatus?.hpg || 'PENDING'
                },
                certificates: (vehicle.certificates || []).filter(c =>
                    c.type === 'or_cr' || c.type === 'hpg_clearance'
                ),
                status: vehicle.status,
                registrationDate: vehicle.registrationDate,
                lastUpdated: vehicle.lastUpdated
                // NO pastOwners, NO full history, NO admin notes, NO officer info
            };
        }

        if (mspId === 'InsuranceMSP') {
            // Insurance needs: vehicle details, owner name/email (minimal), insurance verification status
            return {
                vin: vehicle.vin,
                make: vehicle.make,
                model: vehicle.model,
                year: vehicle.year,
                color: vehicle.color || '',
                plateNumber: vehicle.plateNumber || '',
                owner: vehicle.owner ? {
                    name: vehicle.owner.name || `${vehicle.owner.firstName || ''} ${vehicle.owner.lastName || ''}`.trim(),
                    email: vehicle.owner.email || ''
                    // NO phone, address, detailed personal info
                } : null,
                verificationStatus: {
                    insurance: vehicle.verificationStatus?.insurance || 'PENDING'
                },
                certificates: (vehicle.certificates || []).filter(c =>
                    c.type === 'insurance' || c.type === 'or_cr'
                ),
                status: vehicle.status,
                registrationDate: vehicle.registrationDate,
                lastUpdated: vehicle.lastUpdated
                // NO engine/chassis (not needed for insurance), NO pastOwners, NO full history
            };
        }

        // Unknown MSP - return minimal data
        return {
            vin: vehicle.vin,
            make: vehicle.make,
            model: vehicle.model,
            year: vehicle.year,
            status: vehicle.status
        };
    }

    // Update verification status
    async UpdateVerificationStatus(ctx, vin, verifierType, status, notes) {
        try {
            const vehicleBytes = await ctx.stub.getState(vin);
            if (!vehicleBytes || vehicleBytes.length === 0) {
                throw new Error(`Vehicle with VIN ${vin} not found`);
            }

            const vehicle = JSON.parse(vehicleBytes.toString());
            const txId = ctx.stub.getTxID();
            const timestamp = this._getTxTimestamp(ctx);

            // Validate verifier type (FIXED: removed 'emission', added 'hpg')
            const validVerifiers = ['insurance', 'hpg', 'admin'];
            if (!validVerifiers.includes(verifierType)) {
                throw new Error(`Invalid verifier type: ${verifierType}. Valid types: ${validVerifiers.join(', ')}`);
            }

            // Validate status
            const validStatuses = ['PENDING', 'APPROVED', 'REJECTED'];
            if (!validStatuses.includes(status)) {
                throw new Error(`Invalid status: ${status}`);
            }

            // Organization-based authorization (Permissioned Network)
            // CRITICAL FIX: Each MSP can ONLY set its own verification type to prevent LTO from forging external approvals
            const clientMSPID = ctx.clientIdentity.getMSPID();

            // Enforce strict MSP-to-verifier mapping: each MSP can only set its corresponding verification
            if (verifierType === 'insurance' && clientMSPID !== 'InsuranceMSP') {
                throw new Error(`Unauthorized: Only InsuranceMSP can set insurance verification. Current MSP: ${clientMSPID}`);
            }
            if (verifierType === 'hpg' && clientMSPID !== 'HPGMSP') {
                throw new Error(`Unauthorized: Only HPGMSP can set hpg verification. Current MSP: ${clientMSPID}`);
            }
            if (verifierType === 'admin' && clientMSPID !== 'LTOMSP') {
                throw new Error(`Unauthorized: Only LTOMSP can set admin verification. Current MSP: ${clientMSPID}`);
            }

            // Update verification status
            vehicle.verificationStatus[verifierType] = status;
            vehicle.notes[verifierType] = notes || '';
            vehicle.lastUpdated = timestamp;

            // Extract officer information from notes if provided (for admin approvals)
            // Notes can contain JSON with officerInfo: {userId, email, name}
            let officerInfo = null;
            try {
                const notesObj = JSON.parse(notes || '{}');
                if (notesObj.officerInfo) {
                    officerInfo = notesObj.officerInfo;
                }
            } catch (e) {
                // Notes is not JSON, use as-is
            }

            // Add to history with officer traceability (especially for admin approvals)
            vehicle.history.push({
                action: `VERIFICATION_${status}`,
                timestamp: timestamp,
                performedBy: ctx.clientIdentity.getMSPID(),
                officerInfo: officerInfo ? {
                    userId: officerInfo.userId || null,
                    email: officerInfo.email || null,
                    name: officerInfo.name || null,
                    employeeId: officerInfo.employeeId || null,
                    mspId: ctx.clientIdentity.getMSPID()
                } : {
                    mspId: ctx.clientIdentity.getMSPID()
                },
                details: `${verifierType} verification ${status.toLowerCase()}`,
                transactionId: txId,
                notes: notes || '',
                verifierType: verifierType
            });

            // Check if all verifications are complete
            const allVerified = Object.values(vehicle.verificationStatus).every(s => s === 'APPROVED');
            if (allVerified && vehicle.status !== 'APPROVED') {
                vehicle.status = 'APPROVED';
                vehicle.history.push({
                    action: 'APPROVED',
                    timestamp: timestamp,
                    performedBy: 'SYSTEM',
                    details: 'All verifications completed - vehicle approved',
                    transactionId: txId
                });
            }

            // Store updated vehicle
            await ctx.stub.putState(vin, Buffer.from(JSON.stringify(vehicle)));

            // PHASE 3: Emit specific events based on status for better traceability
            // Emit both generic VerificationUpdated and specific ClearanceApproved/ClearanceRejected events
            const eventPayload = {
                vin: vin,
                verifierType: verifierType,
                status: status,
                timestamp: timestamp,
                transactionId: txId
            };

            // Emit generic event (for backward compatibility)
            ctx.stub.setEvent('VerificationUpdated', Buffer.from(JSON.stringify(eventPayload)));

            // PHASE 3: Emit specific event based on status for better filtering and traceability
            if (status === 'APPROVED') {
                ctx.stub.setEvent('ClearanceApproved', Buffer.from(JSON.stringify({
                    ...eventPayload,
                    clearanceType: verifierType, // hpg, insurance, emission
                    approvedAt: timestamp
                })));
            } else if (status === 'REJECTED') {
                ctx.stub.setEvent('ClearanceRejected', Buffer.from(JSON.stringify({
                    ...eventPayload,
                    clearanceType: verifierType, // hpg, insurance, emission
                    rejectedAt: timestamp,
                    rejectionReason: notes || ''
                })));
            }

            console.log(`Verification status updated for vehicle ${vin}: ${verifierType} = ${status}`);
            return JSON.stringify({
                success: true,
                message: 'Verification status updated successfully',
                vin: vin,
                verifierType: verifierType,
                status: status,
                transactionId: txId,
                timestamp: timestamp
            });

        } catch (error) {
            console.error('Error updating verification status:', error);
            throw new Error(`Failed to update verification status: ${error.message}`);
        }
    }

    // Transfer vehicle ownership
    async TransferOwnership(ctx, vin, newOwnerData, transferData) {
        try {
            const vehicleBytes = await ctx.stub.getState(vin);
            if (!vehicleBytes || vehicleBytes.length === 0) {
                throw new Error(`Vehicle with VIN ${vin} not found`);
            }

            const vehicle = JSON.parse(vehicleBytes.toString());
            const newOwner = JSON.parse(newOwnerData);
            const transfer = JSON.parse(transferData);
            const txId = ctx.stub.getTxID();
            const timestamp = this._getTxTimestamp(ctx);

            // Organization-based authorization (Permissioned Network)
            // Only LTO organization can transfer ownership
            const clientMSPID = ctx.clientIdentity.getMSPID();
            if (clientMSPID !== 'LTOMSP') {
                throw new Error(`Unauthorized: Only LTO organization (LTOMSP) can transfer vehicle ownership. Current MSP: ${clientMSPID}`);
            }

            // Validate current ownership
            if (vehicle.owner.email !== transfer.currentOwnerEmail) {
                throw new Error('Current owner email does not match');
            }

            // Initialize pastOwners array if it doesn't exist (for backward compatibility)
            if (!vehicle.pastOwners) {
                vehicle.pastOwners = [];
            }

            // Update ownership - track past owner
            const previousOwner = vehicle.owner;
            vehicle.owner = newOwner;
            vehicle.lastUpdated = timestamp;

            // Add previous owner to pastOwners array (for traceability)
            vehicle.pastOwners.push({
                owner: previousOwner,
                transferDate: timestamp,
                transferReason: transfer.reason || 'Ownership transfer',
                transactionId: txId
            });

            // Extract officer information from transferData (LTO officer who approved)
            const officerInfo = transfer.officerInfo || {
                userId: transfer.approvedBy || null,
                email: transfer.approvedByEmail || null,
                name: transfer.approvedByName || null
            };

            // Add to history with full traceability
            vehicle.history.push({
                action: 'OWNERSHIP_TRANSFERRED',
                timestamp: timestamp,
                performedBy: ctx.clientIdentity.getMSPID(),
                officerInfo: {
                    userId: officerInfo.userId || null,
                    email: officerInfo.email || null,
                    name: officerInfo.name || null,
                    employeeId: officerInfo.employeeId || null,
                    mspId: ctx.clientIdentity.getMSPID()
                },
                previousOwner: {
                    email: previousOwner.email,
                    firstName: previousOwner.firstName || previousOwner.first_name || null,
                    lastName: previousOwner.lastName || previousOwner.last_name || null
                },
                newOwner: {
                    email: newOwner.email,
                    firstName: newOwner.firstName || newOwner.first_name || null,
                    lastName: newOwner.lastName || newOwner.last_name || null
                },
                details: `Ownership transferred from ${previousOwner.email} to ${newOwner.email}`,
                transactionId: txId,
                transferData: transfer
            });

            // Update owner composite key
            const oldOwnerKey = ctx.stub.createCompositeKey('owner~vin', [previousOwner.email, vin]);
            await ctx.stub.deleteState(oldOwnerKey);

            const newOwnerKey = ctx.stub.createCompositeKey('owner~vin', [newOwner.email, vin]);
            await ctx.stub.putState(newOwnerKey, Buffer.from(vin));

            // Store updated vehicle
            await ctx.stub.putState(vin, Buffer.from(JSON.stringify(vehicle)));

            // Emit event (payload must be Buffer/Uint8Array per Fabric spec)
            ctx.stub.setEvent('OwnershipTransferred', Buffer.from(JSON.stringify({
                vin: vin,
                previousOwner: previousOwner.email,
                newOwner: newOwner.email,
                timestamp: timestamp,
                transactionId: txId
            })));

            console.log(`Ownership transferred for vehicle ${vin} from ${previousOwner.email} to ${newOwner.email}`);
            return JSON.stringify({
                success: true,
                message: 'Ownership transferred successfully',
                vin: vin,
                previousOwner: previousOwner.email,
                newOwner: newOwner.email,
                transactionId: txId,
                timestamp: timestamp
            });

        } catch (error) {
            console.error('Error transferring ownership:', error);
            throw new Error(`Failed to transfer ownership: ${error.message}`);
        }
    }

    // Get vehicles by owner
    async GetVehiclesByOwner(ctx, ownerEmail) {
        try {
            const queryString = {
                selector: {
                    owner: {
                        email: ownerEmail
                    }
                }
            };

            const results = await ctx.stub.getQueryResult(JSON.stringify(queryString));
            const vehicles = [];

            for await (const result of results) {
                const vehicle = JSON.parse(result.value.toString());
                vehicles.push(vehicle);
            }

            return JSON.stringify(vehicles);

        } catch (error) {
            console.error('Error getting vehicles by owner:', error);
            throw new Error(`Failed to get vehicles by owner: ${error.message}`);
        }
    }

    // Get vehicle history
    async GetVehicleHistory(ctx, vin) {
        try {
            const vehicleBytes = await ctx.stub.getState(vin);
            if (!vehicleBytes || vehicleBytes.length === 0) {
                throw new Error(`Vehicle with VIN ${vin} not found`);
            }

            const vehicle = JSON.parse(vehicleBytes.toString());
            return JSON.stringify(vehicle.history);

        } catch (error) {
            console.error('Error getting vehicle history:', error);
            throw new Error(`Failed to get vehicle history: ${error.message}`);
        }
    }

    // Get ownership history (current owner + all past owners)
    async GetOwnershipHistory(ctx, vin) {
        try {
            const vehicleBytes = await ctx.stub.getState(vin);
            if (!vehicleBytes || vehicleBytes.length === 0) {
                throw new Error(`Vehicle with VIN ${vin} not found`);
            }

            const vehicle = JSON.parse(vehicleBytes.toString());

            // Return comprehensive ownership history
            return JSON.stringify({
                currentOwner: vehicle.owner,
                pastOwners: vehicle.pastOwners || [],
                ownershipTransfers: vehicle.history.filter(h => h.action === 'OWNERSHIP_TRANSFERRED') || []
            });

        } catch (error) {
            console.error('Error getting ownership history:', error);
            throw new Error(`Failed to get ownership history: ${error.message}`);
        }
    }

    // Get officer approvals (all actions performed by LTO officers)
    async GetOfficerApprovals(ctx, vin) {
        try {
            const vehicleBytes = await ctx.stub.getState(vin);
            if (!vehicleBytes || vehicleBytes.length === 0) {
                throw new Error(`Vehicle with VIN ${vin} not found`);
            }

            const vehicle = JSON.parse(vehicleBytes.toString());

            // Filter history for entries with officer information
            const officerActions = vehicle.history.filter(h =>
                h.officerInfo && (h.officerInfo.userId || h.officerInfo.email || h.officerInfo.name)
            );

            return JSON.stringify({
                registeredByOfficer: vehicle.registeredByOfficer || null,
                officerActions: officerActions
            });

        } catch (error) {
            console.error('Error getting officer approvals:', error);
            throw new Error(`Failed to get officer approvals: ${error.message}`);
        }
    }

    // Query vehicles by status
    async QueryVehiclesByStatus(ctx, status) {
        try {
            // Use getStateByRange and filter by status to avoid async iterable issues
            const startKey = '';
            const endKey = '\uffff';
            const resultsIterator = await ctx.stub.getStateByRange(startKey, endKey);
            const vehicles = [];

            while (true) {
                const result = await resultsIterator.next();

                if (result.value) {
                    try {
                        const vehicle = JSON.parse(result.value.value.toString());
                        // Only include vehicles matching the status
                        if ((vehicle.docType === 'CR' || vehicle.vin) && vehicle.status === status) {
                            vehicles.push(vehicle);
                        }
                    } catch (parseError) {
                        // Skip non-vehicle entries
                    }
                }

                if (result.done) {
                    break;
                }
            }

            await resultsIterator.close();
            return JSON.stringify(vehicles);

        } catch (error) {
            console.error('Error querying vehicles by status:', error);
            throw new Error(`Failed to query vehicles by status: ${error.message}`);
        }
    }

    // Query vehicles by verification status
    async QueryVehiclesByVerificationStatus(ctx, verifierType, status) {
        try {
            // Use getStateByRange and filter by verification status to avoid async iterable issues
            const startKey = '';
            const endKey = '\uffff';
            const resultsIterator = await ctx.stub.getStateByRange(startKey, endKey);
            const vehicles = [];

            while (true) {
                const result = await resultsIterator.next();

                if (result.value) {
                    try {
                        const vehicle = JSON.parse(result.value.value.toString());
                        // Only include vehicles matching the verification status
                        if ((vehicle.docType === 'CR' || vehicle.vin) &&
                            vehicle.verificationStatus &&
                            vehicle.verificationStatus[verifierType] === status) {
                            vehicles.push(vehicle);
                        }
                    } catch (parseError) {
                        // Skip non-vehicle entries
                    }
                }

                if (result.done) {
                    break;
                }
            }

            await resultsIterator.close();
            return JSON.stringify(vehicles);

        } catch (error) {
            console.error('Error querying vehicles by verification status:', error);
            throw new Error(`Failed to query vehicles by verification status: ${error.message}`);
        }
    }

    // Get all vehicles (for admin)
    async GetAllVehicles(ctx) {
        try {
            // Use getStateByRange to get all vehicles
            // VINs are stored as keys, so we iterate through all keys
            // Using empty string to high value to get all keys
            const startKey = '';
            const endKey = '\uffff'; // Unicode high value to get all keys

            const resultsIterator = await ctx.stub.getStateByRange(startKey, endKey);
            const vehicles = [];
            const clientMSPID = ctx.clientIdentity.getMSPID();

            // Iterate through all results
            while (true) {
                const result = await resultsIterator.next();

                if (result.value) {
                    try {
                        const vehicle = JSON.parse(result.value.value.toString());

                        // Only include vehicles with docType 'CR' (skip composite keys, OR records, etc.)
                        if (vehicle.docType === 'CR' || vehicle.vin) {
                            // Apply MSP-based filtering
                            const filteredVehicle = this.filterVehicleForVerification(vehicle, clientMSPID);
                            vehicles.push(filteredVehicle);
                        }
                    } catch (parseError) {
                        // Skip non-vehicle entries (like composite keys)
                        console.warn('Skipping non-vehicle entry:', result.value.key);
                    }
                }

                if (result.done) {
                    break;
                }
            }

            // Close the iterator
            await resultsIterator.close();

            return JSON.stringify(vehicles);

        } catch (error) {
            console.error('Error getting all vehicles:', error);
            throw new Error(`Failed to get all vehicles: ${error.message}`);
        }
    }

    // Query vehicles with filtered view for verification purposes
    async QueryVehiclesForVerification(ctx, status) {
        try {
            const startKey = '';
            const endKey = '\uffff';
            const resultsIterator = await ctx.stub.getStateByRange(startKey, endKey);
            const vehicles = [];
            const clientMSPID = ctx.clientIdentity.getMSPID();

            while (true) {
                const result = await resultsIterator.next();

                if (result.value) {
                    try {
                        const vehicle = JSON.parse(result.value.value.toString());

                        // Only include vehicles with docType 'CR'
                        if (vehicle.docType === 'CR' || vehicle.vin) {
                            // Filter by status if provided
                            if (status && vehicle.status !== status) {
                                continue;
                            }

                            // Apply MSP-based filtering
                            const filteredVehicle = this.filterVehicleForVerification(vehicle, clientMSPID);
                            vehicles.push(filteredVehicle);
                        }
                    } catch (parseError) {
                        // Skip non-vehicle entries
                        console.warn('Skipping non-vehicle entry:', result.value.key);
                    }
                }

                if (result.done) {
                    break;
                }
            }

            await resultsIterator.close();
            return JSON.stringify(vehicles);

        } catch (error) {
            console.error('Error querying vehicles for verification:', error);
            throw new Error(`Failed to query vehicles for verification: ${error.message}`);
        }
    }

    // Update vehicle information
    async UpdateVehicle(ctx, vin, updateData) {
        try {
            const vehicleBytes = await ctx.stub.getState(vin);
            if (!vehicleBytes || vehicleBytes.length === 0) {
                throw new Error(`Vehicle with VIN ${vin} not found`);
            }

            const vehicle = JSON.parse(vehicleBytes.toString());
            const updates = JSON.parse(updateData);
            const txId = ctx.stub.getTxID();
            const timestamp = this._getTxTimestamp(ctx);

            // Update allowed fields (LTO-compliant)
            const allowedFields = ['color', 'engineNumber', 'chassisNumber', 'vehicleType', 'vehicleCategory', 'passengerCapacity', 'grossVehicleWeight', 'netWeight', 'classification'];

            for (const field of allowedFields) {
                if (updates[field] !== undefined) {
                    vehicle[field] = updates[field];
                }
            }

            vehicle.lastUpdated = timestamp;

            // Add to history
            vehicle.history.push({
                action: 'VEHICLE_UPDATED',
                timestamp: timestamp,
                performedBy: ctx.clientIdentity.getMSPID(),
                details: 'Vehicle information updated',
                transactionId: txId,
                updates: updates
            });

            // Store updated vehicle
            await ctx.stub.putState(vin, Buffer.from(JSON.stringify(vehicle)));

            // Emit event (payload must be Buffer/Uint8Array per Fabric spec)
            ctx.stub.setEvent('VehicleUpdated', Buffer.from(JSON.stringify({
                vin: vin,
                timestamp: timestamp,
                transactionId: txId
            })));

            console.log(`Vehicle ${vin} updated successfully`);
            return JSON.stringify({
                success: true,
                message: 'Vehicle updated successfully',
                vin: vin,
                transactionId: txId,
                timestamp: timestamp
            });

        } catch (error) {
            console.error('Error updating vehicle:', error);
            throw new Error(`Failed to update vehicle: ${error.message}`);
        }
    }

    // Delete vehicle (admin only)
    async DeleteVehicle(ctx, vin) {
        try {
            const vehicleBytes = await ctx.stub.getState(vin);
            if (!vehicleBytes || vehicleBytes.length === 0) {
                throw new Error(`Vehicle with VIN ${vin} not found`);
            }

            const vehicle = JSON.parse(vehicleBytes.toString());
            const txId = ctx.stub.getTxID();
            const timestamp = this._getTxTimestamp(ctx);

            // Delete vehicle from world state
            await ctx.stub.deleteState(vin);

            // Delete composite keys
            const ownerKey = ctx.stub.createCompositeKey('owner~vin', [vehicle.owner.email, vin]);
            await ctx.stub.deleteState(ownerKey);

            if (vehicle.plateNumber) {
                const plateKey = ctx.stub.createCompositeKey('plate~vin', [vehicle.plateNumber, vin]);
                await ctx.stub.deleteState(plateKey);
            }

            // Emit event (payload must be Buffer/Uint8Array per Fabric spec)
            ctx.stub.setEvent('VehicleDeleted', Buffer.from(JSON.stringify({
                vin: vin,
                timestamp: timestamp,
                transactionId: txId
            })));

            console.log(`Vehicle ${vin} deleted successfully`);
            return JSON.stringify({
                success: true,
                message: 'Vehicle deleted successfully',
                vin: vin,
                transactionId: txId,
                timestamp: timestamp
            });

        } catch (error) {
            console.error('Error deleting vehicle:', error);
            throw new Error(`Failed to delete vehicle: ${error.message}`);
        }
    }

    // Scrap vehicle - Marks vehicle as end-of-life while preserving history
    // Better than Delete because blockchain maintains audit trail
    async ScrapVehicle(ctx, vin, scrapReason) {
        try {
            const vehicleBytes = await ctx.stub.getState(vin);
            if (!vehicleBytes || vehicleBytes.length === 0) {
                throw new Error(`Vehicle with VIN ${vin} not found`);
            }

            const vehicle = JSON.parse(vehicleBytes.toString());
            const txId = ctx.stub.getTxID();
            const timestamp = this._getTxTimestamp(ctx);

            // Only LTO can scrap vehicles
            const clientMSPID = ctx.clientIdentity.getMSPID();
            if (clientMSPID !== 'LTOMSP') {
                throw new Error(`Unauthorized: Only LTO organization can scrap vehicles. Current MSP: ${clientMSPID}`);
            }

            // Update vehicle status to SCRAPPED (preserve in world state, don't delete)
            vehicle.status = 'SCRAPPED';
            vehicle.scrappedAt = timestamp;
            vehicle.scrapReason = scrapReason || 'End of life';
            vehicle.lastUpdated = timestamp;

            // Add to history - IMPORTANT: preserves audit trail
            if (!vehicle.history) {
                vehicle.history = [];
            }
            vehicle.history.push({
                action: 'VEHICLE_SCRAPPED',
                timestamp: timestamp,
                performedBy: clientMSPID,
                details: `Vehicle scrapped: ${scrapReason || 'End of life'}`,
                transactionId: txId
            });

            // Store updated vehicle (NOT deleted - maintains history)
            await ctx.stub.putState(vin, Buffer.from(JSON.stringify(vehicle)));

            // Emit event
            ctx.stub.setEvent('VehicleScrapped', Buffer.from(JSON.stringify({
                vin: vin,
                scrapReason: scrapReason,
                timestamp: timestamp,
                transactionId: txId
            })));

            console.log(`Vehicle ${vin} marked as SCRAPPED`);
            return JSON.stringify({
                success: true,
                message: 'Vehicle scrapped successfully - record preserved for audit',
                vin: vin,
                transactionId: txId,
                timestamp: timestamp
            });

        } catch (error) {
            console.error('Error scrapping vehicle:', error);
            throw new Error(`Failed to scrap vehicle: ${error.message}`);
        }
    }

    // Get system statistics
    async GetSystemStats(ctx) {
        try {
            // Use getStateByRange instead of getQueryResult to avoid async iterable issues
            const startKey = '';
            const endKey = '\uffff';
            const resultsIterator = await ctx.stub.getStateByRange(startKey, endKey);

            let totalVehicles = 0;
            let statusCounts = {};
            let verificationCounts = {};

            // Use while loop pattern (more compatible across Fabric versions)
            while (true) {
                const result = await resultsIterator.next();

                if (result.value) {
                    try {
                        const vehicle = JSON.parse(result.value.value.toString());

                        // Only count actual vehicle records (with docType 'CR' or vin)
                        if (vehicle.docType === 'CR' || vehicle.vin) {
                            totalVehicles++;

                            // Count by status
                            if (vehicle.status) {
                                statusCounts[vehicle.status] = (statusCounts[vehicle.status] || 0) + 1;
                            }

                            // Count by verification status
                            if (vehicle.verificationStatus) {
                                Object.keys(vehicle.verificationStatus).forEach(verifier => {
                                    const status = vehicle.verificationStatus[verifier];
                                    const key = `${verifier}_${status}`;
                                    verificationCounts[key] = (verificationCounts[key] || 0) + 1;
                                });
                            }
                        }
                    } catch (parseError) {
                        // Skip non-vehicle entries (composite keys, etc.)
                    }
                }

                if (result.done) {
                    break;
                }
            }

            await resultsIterator.close();

            return JSON.stringify({
                totalVehicles: totalVehicles,
                statusCounts: statusCounts,
                verificationCounts: verificationCounts,
                timestamp: this._getTxTimestamp(ctx)
            });

        } catch (error) {
            console.error('Error getting system stats:', error);
            throw new Error(`Failed to get system stats: ${error.message}`);
        }
    }

    // Report traffic violation (HPG only)
    async ReportViolation(ctx, vin, violationData) {
        try {
            const vehicleBytes = await ctx.stub.getState(vin);
            if (!vehicleBytes || vehicleBytes.length === 0) {
                throw new Error(`Vehicle with VIN ${vin} not found`);
            }

            const vehicle = JSON.parse(vehicleBytes.toString());
            const violation = JSON.parse(violationData);
            const txId = ctx.stub.getTxID();
            const timestamp = this._getTxTimestamp(ctx);

            // Organization-based authorization
            const clientMSPID = ctx.clientIdentity.getMSPID();
            if (clientMSPID !== 'HPGMSP' && clientMSPID !== 'LTOMSP') {
                throw new Error(`Unauthorized: Only HPG or LTO can report violations. Current MSP: ${clientMSPID}`);
            }

            // Initialize violations array if it doesn't exist
            if (!vehicle.violations) {
                vehicle.violations = [];
            }

            // Add violation record
            const violationRecord = {
                violationType: violation.violationType,
                description: violation.description || '',
                location: violation.location || '',
                officerId: violation.officerId || '',
                fineAmount: violation.fineAmount || 0,
                reportedBy: clientMSPID,
                timestamp: timestamp,
                transactionId: txId,
                status: 'PENDING'
            };

            vehicle.violations.push(violationRecord);
            vehicle.lastUpdated = timestamp;

            // Add to history
            vehicle.history.push({
                action: 'VIOLATION_REPORTED',
                timestamp: timestamp,
                performedBy: clientMSPID,
                details: `Traffic violation reported: ${violation.violationType}`,
                transactionId: txId
            });

            // Store updated vehicle
            await ctx.stub.putState(vin, Buffer.from(JSON.stringify(vehicle)));

            // Emit event (payload must be Buffer/Uint8Array per Fabric spec)
            ctx.stub.setEvent('ViolationReported', Buffer.from(JSON.stringify({
                vin: vin,
                violationType: violation.violationType,
                timestamp: timestamp,
                transactionId: txId
            })));

            console.log(`Violation reported for vehicle ${vin}`);
            return JSON.stringify({
                success: true,
                message: 'Violation reported successfully',
                vin: vin,
                violation: violationRecord,
                transactionId: txId,
                timestamp: timestamp
            });

        } catch (error) {
            console.error('Error reporting violation:', error);
            throw new Error(`Failed to report violation: ${error.message}`);
        }
    }

    // Report stolen vehicle (HPG only)
    async ReportStolen(ctx, vin, reportData) {
        try {
            const vehicleBytes = await ctx.stub.getState(vin);
            if (!vehicleBytes || vehicleBytes.length === 0) {
                throw new Error(`Vehicle with VIN ${vin} not found`);
            }

            const vehicle = JSON.parse(vehicleBytes.toString());
            const report = JSON.parse(reportData);
            const txId = ctx.stub.getTxID();
            const timestamp = this._getTxTimestamp(ctx);

            // Organization-based authorization
            const clientMSPID = ctx.clientIdentity.getMSPID();
            if (clientMSPID !== 'HPGMSP' && clientMSPID !== 'LTOMSP') {
                throw new Error(`Unauthorized: Only HPG or LTO can report stolen vehicles. Current MSP: ${clientMSPID}`);
            }

            // Mark vehicle as stolen
            vehicle.status = 'STOLEN';
            vehicle.stolenReport = {
                reportedBy: clientMSPID,
                reportDate: timestamp,
                reportNumber: report.reportNumber || '',
                officerId: report.officerId || '',
                location: report.location || '',
                description: report.description || '',
                transactionId: txId
            };
            vehicle.lastUpdated = timestamp;

            // Add to history
            vehicle.history.push({
                action: 'STOLEN_REPORTED',
                timestamp: timestamp,
                performedBy: clientMSPID,
                details: `Vehicle reported as stolen. Report #: ${report.reportNumber || 'N/A'}`,
                transactionId: txId
            });

            // Store updated vehicle
            await ctx.stub.putState(vin, Buffer.from(JSON.stringify(vehicle)));

            // Emit event (payload must be Buffer/Uint8Array per Fabric spec)
            ctx.stub.setEvent('VehicleStolen', Buffer.from(JSON.stringify({
                vin: vin,
                reportNumber: report.reportNumber,
                timestamp: timestamp,
                transactionId: txId
            })));

            console.log(`Vehicle ${vin} reported as stolen`);
            return JSON.stringify({
                success: true,
                message: 'Vehicle reported as stolen successfully',
                vin: vin,
                report: vehicle.stolenReport,
                transactionId: txId,
                timestamp: timestamp
            });

        } catch (error) {
            console.error('Error reporting stolen vehicle:', error);
            throw new Error(`Failed to report stolen vehicle: ${error.message}`);
        }
    }

    // Mark vehicle as recovered (HPG only)
    async MarkRecovered(ctx, vin, recoveryData) {
        try {
            const vehicleBytes = await ctx.stub.getState(vin);
            if (!vehicleBytes || vehicleBytes.length === 0) {
                throw new Error(`Vehicle with VIN ${vin} not found`);
            }

            const vehicle = JSON.parse(vehicleBytes.toString());

            if (vehicle.status !== 'STOLEN') {
                throw new Error(`Vehicle ${vin} is not marked as stolen`);
            }

            const recovery = JSON.parse(recoveryData || '{}');
            const txId = ctx.stub.getTxID();
            const timestamp = this._getTxTimestamp(ctx);

            // Organization-based authorization
            const clientMSPID = ctx.clientIdentity.getMSPID();
            if (clientMSPID !== 'HPGMSP' && clientMSPID !== 'LTOMSP') {
                throw new Error(`Unauthorized: Only HPG or LTO can mark vehicles as recovered. Current MSP: ${clientMSPID}`);
            }

            // Mark vehicle as recovered
            vehicle.status = vehicle.previousStatus || 'REGISTERED';
            vehicle.recoveryReport = {
                recoveredBy: clientMSPID,
                recoveryDate: timestamp,
                recoveryLocation: recovery.location || '',
                officerId: recovery.officerId || '',
                condition: recovery.condition || 'UNKNOWN',
                transactionId: txId
            };
            vehicle.lastUpdated = timestamp;

            // Add to history
            vehicle.history.push({
                action: 'VEHICLE_RECOVERED',
                timestamp: timestamp,
                performedBy: clientMSPID,
                details: `Vehicle recovered. Location: ${recovery.location || 'N/A'}`,
                transactionId: txId
            });

            // Store updated vehicle
            await ctx.stub.putState(vin, Buffer.from(JSON.stringify(vehicle)));

            // Emit event (payload must be Buffer/Uint8Array per Fabric spec)
            ctx.stub.setEvent('VehicleRecovered', Buffer.from(JSON.stringify({
                vin: vin,
                timestamp: timestamp,
                transactionId: txId
            })));

            console.log(`Vehicle ${vin} marked as recovered`);
            return JSON.stringify({
                success: true,
                message: 'Vehicle marked as recovered successfully',
                vin: vin,
                recovery: vehicle.recoveryReport,
                transactionId: txId,
                timestamp: timestamp
            });

        } catch (error) {
            console.error('Error marking vehicle as recovered:', error);
            throw new Error(`Failed to mark vehicle as recovered: ${error.message}`);
        }
    }

    // Mint vehicle (pre-minted, ownerless vehicle - CSR verified)
    async MintVehicle(ctx, vehicleData) {
        try {
            const vehicle = JSON.parse(vehicleData);

            // Validate required fields (no owner required for minting)
            if (!vehicle.vin || !vehicle.make || !vehicle.model || !vehicle.year) {
                throw new Error('Missing required vehicle information (VIN, make, model, year)');
            }

            // Check if vehicle already exists
            const existingVehicle = await ctx.stub.getState(vehicle.vin);
            if (existingVehicle && existingVehicle.length > 0) {
                const existing = JSON.parse(existingVehicle.toString());
                if (existing.status !== 'MINTED' || existing.owner) {
                    throw new Error(`Vehicle with VIN ${vehicle.vin} already exists and is not available for minting`);
                }
                // Already minted, return success
                return JSON.stringify({
                    success: true,
                    message: 'Vehicle already minted',
                    vin: vehicle.vin,
                    status: 'MINTED'
                });
            }

            // Only LTO can mint vehicles
            const clientMSPID = ctx.clientIdentity.getMSPID();
            if (clientMSPID !== 'LTOMSP') {
                throw new Error(`Unauthorized: Only LTO organization (LTOMSP) can mint vehicles. Current MSP: ${clientMSPID}`);
            }

            const txId = ctx.stub.getTxID();
            const timestamp = this._getTxTimestamp(ctx);

            // Create minted vehicle record (ownerless, CSR-verified state)
            const vehicleRecord = {
                docType: 'CR',
                vin: vehicle.vin,
                crNumber: vehicle.crNumber || '',
                plateNumber: vehicle.plateNumber || '',
                make: vehicle.make,
                model: vehicle.model,
                year: vehicle.year,
                color: vehicle.color || '',
                engineNumber: vehicle.engineNumber || '',
                chassisNumber: vehicle.chassisNumber || '',
                vehicleType: vehicle.vehicleType || 'Car',
                vehicleCategory: vehicle.vehicleCategory || '',
                passengerCapacity: vehicle.passengerCapacity || 0,
                grossVehicleWeight: vehicle.grossVehicleWeight || 0,
                netWeight: vehicle.netWeight || 0,
                classification: vehicle.classification || vehicle.registrationType || 'Private',
                owner: null, // No owner yet - this is pre-minted
                pastOwners: [],
                status: 'MINTED', // Pre-minted, unassigned status
                verificationStatus: {
                    insurance: 'PENDING',
                    hpg: 'PENDING',
                    admin: 'PENDING'
                },
                documents: vehicle.documents || {},
                notes: {
                    admin: '',
                    insurance: '',
                    hpg: ''
                },
                registrationDate: null, // Not registered yet
                dateOfRegistration: null,
                lastUpdated: timestamp,
                priority: vehicle.priority || 'MEDIUM',
                history: [{
                    action: 'MINTED',
                    timestamp: timestamp,
                    performedBy: ctx.clientIdentity.getMSPID(),
                    details: 'Vehicle pre-minted (CSR verified, ownerless)',
                    transactionId: txId
                }],
                blockchainTxId: txId,
                createdBy: ctx.clientIdentity.getMSPID(),
                createdAt: timestamp,
                mintedAt: timestamp
            };

            // Store minted vehicle
            await ctx.stub.putState(vehicle.vin, Buffer.from(JSON.stringify(vehicleRecord)));

            // Create composite key for plate number lookup (if provided)
            if (vehicle.plateNumber) {
                const plateKey = ctx.stub.createCompositeKey('plate~vin', [vehicle.plateNumber, vehicle.vin]);
                await ctx.stub.putState(plateKey, Buffer.from(vehicle.vin));
            }

            // Create composite key for CR number lookup (if provided)
            if (vehicle.crNumber) {
                const crKey = ctx.stub.createCompositeKey('cr~vin', [vehicle.crNumber, vehicle.vin]);
                await ctx.stub.putState(crKey, Buffer.from(vehicle.vin));
            }

            // Emit event
            ctx.stub.setEvent('VehicleMinted', Buffer.from(JSON.stringify({
                vin: vehicle.vin,
                timestamp: timestamp,
                transactionId: txId
            })));

            console.log(`Vehicle ${vehicle.vin} minted successfully (pre-minted, ownerless)`);
            return JSON.stringify({
                success: true,
                message: 'Vehicle minted successfully',
                vin: vehicle.vin,
                status: 'MINTED',
                transactionId: txId,
                timestamp: timestamp
            });

        } catch (error) {
            console.error('Error minting vehicle:', error);
            throw new Error(`Failed to mint vehicle: ${error.message}`);
        }
    }

    // Attach owner to minted vehicle
    async AttachOwnerToMintedVehicle(ctx, vin, ownerData, registrationData) {
        try {
            const vehicleBytes = await ctx.stub.getState(vin);
            if (!vehicleBytes || vehicleBytes.length === 0) {
                throw new Error(`Vehicle with VIN ${vin} not found`);
            }

            const vehicle = JSON.parse(vehicleBytes.toString());

            // Validate vehicle is in MINTED state and has no owner
            if (vehicle.status !== 'MINTED') {
                throw new Error(`Vehicle with VIN ${vin} is not in MINTED state. Current status: ${vehicle.status}`);
            }
            if (vehicle.owner) {
                throw new Error(`Vehicle with VIN ${vin} already has an owner: ${vehicle.owner.email || 'unknown'}`);
            }

            const newOwner = JSON.parse(ownerData);
            const registration = JSON.parse(registrationData || '{}');

            // Only LTO can attach owners
            const clientMSPID = ctx.clientIdentity.getMSPID();
            if (clientMSPID !== 'LTOMSP') {
                throw new Error(`Unauthorized: Only LTO organization can attach owners to minted vehicles. Current MSP: ${clientMSPID}`);
            }

            // Validate that external verifications are approved (per requirement: LTO can't approve unless verified by orgs)
            if (vehicle.verificationStatus.hpg !== 'APPROVED' || vehicle.verificationStatus.insurance !== 'APPROVED') {
                throw new Error(`Cannot attach owner: External verifications not complete. HPG: ${vehicle.verificationStatus.hpg}, Insurance: ${vehicle.verificationStatus.insurance}`);
            }

            const txId = ctx.stub.getTxID();
            const timestamp = this._getTxTimestamp(ctx);

            // Attach owner and transition status
            vehicle.owner = newOwner;
            vehicle.status = 'REGISTERED';
            vehicle.registrationDate = timestamp;
            vehicle.dateOfRegistration = registration.dateOfRegistration || timestamp;
            vehicle.lastUpdated = timestamp;

            // Update OR number if provided
            if (registration.orNumber) {
                vehicle.orNumber = registration.orNumber;
            }

            // Create composite key for owner lookup
            const ownerKey = ctx.stub.createCompositeKey('owner~vin', [newOwner.email, vehicle.vin]);
            await ctx.stub.putState(ownerKey, Buffer.from(vehicle.vin));

            // Add to history
            vehicle.history.push({
                action: 'OWNER_ATTACHED',
                timestamp: timestamp,
                performedBy: clientMSPID,
                details: `Owner attached to minted vehicle: ${newOwner.email}`,
                transactionId: txId,
                owner: newOwner.email
            });

            // Store updated vehicle
            await ctx.stub.putState(vin, Buffer.from(JSON.stringify(vehicle)));

            // Emit event
            ctx.stub.setEvent('OwnerAttachedToMintedVehicle', Buffer.from(JSON.stringify({
                vin: vin,
                owner: newOwner.email,
                timestamp: timestamp,
                transactionId: txId
            })));

            console.log(`Owner attached to minted vehicle ${vin}: ${newOwner.email}`);
            return JSON.stringify({
                success: true,
                message: 'Owner attached to minted vehicle successfully',
                vin: vin,
                owner: newOwner.email,
                status: 'REGISTERED',
                transactionId: txId,
                timestamp: timestamp
            });

        } catch (error) {
            console.error('Error attaching owner to minted vehicle:', error);
            throw new Error(`Failed to attach owner to minted vehicle: ${error.message}`);
        }
    }

    // Update certificate hash (for OR/CR PDFs)
    async UpdateCertificateHash(ctx, vin, certificateType, pdfHash, ipfsCid) {
        try {
            const vehicleBytes = await ctx.stub.getState(vin);
            if (!vehicleBytes || vehicleBytes.length === 0) {
                throw new Error(`Vehicle with VIN ${vin} not found`);
            }

            const vehicle = JSON.parse(vehicleBytes.toString());
            const txId = ctx.stub.getTxID();
            const timestamp = this._getTxTimestamp(ctx);

            // Only LTO can update certificate hashes
            const clientMSPID = ctx.clientIdentity.getMSPID();
            if (clientMSPID !== 'LTOMSP') {
                throw new Error(`Unauthorized: Only LTO can update certificate hashes. Current MSP: ${clientMSPID}`);
            }

            // Initialize certificates array if it doesn't exist
            if (!vehicle.certificates) {
                vehicle.certificates = [];
            }

            // Add or update certificate hash
            const certIndex = vehicle.certificates.findIndex(c => c.type === certificateType);
            const certRecord = {
                type: certificateType, // 'OR', 'CR', or 'ORCR'
                pdfHash: pdfHash,
                ipfsCid: ipfsCid,
                issuedAt: timestamp,
                transactionId: txId,
                issuedBy: clientMSPID
            };

            if (certIndex >= 0) {
                vehicle.certificates[certIndex] = certRecord;
            } else {
                vehicle.certificates.push(certRecord);
            }

            vehicle.lastUpdated = timestamp;

            // Add to history
            vehicle.history.push({
                action: 'CERTIFICATE_HASH_UPDATED',
                timestamp: timestamp,
                performedBy: clientMSPID,
                details: `${certificateType} certificate hash updated`,
                transactionId: txId,
                certificateType: certificateType,
                pdfHash: pdfHash,
                ipfsCid: ipfsCid
            });

            await ctx.stub.putState(vin, Buffer.from(JSON.stringify(vehicle)));

            // Emit event
            ctx.stub.setEvent('CertificateHashUpdated', Buffer.from(JSON.stringify({
                vin: vin,
                certificateType: certificateType,
                pdfHash: pdfHash,
                ipfsCid: ipfsCid,
                timestamp: timestamp,
                transactionId: txId
            })));

            return JSON.stringify({
                success: true,
                message: 'Certificate hash updated successfully',
                vin: vin,
                certificateType: certificateType,
                transactionId: txId
            });

        } catch (error) {
            console.error('Error updating certificate hash:', error);
            throw new Error(`Failed to update certificate hash: ${error.message}`);
        }
    }

    // Get certificate hash for verification
    async GetCertificateHash(ctx, vin, certificateType) {
        try {
            const vehicleBytes = await ctx.stub.getState(vin);
            if (!vehicleBytes || vehicleBytes.length === 0) {
                throw new Error(`Vehicle with VIN ${vin} not found`);
            }

            const vehicle = JSON.parse(vehicleBytes.toString());

            if (!vehicle.certificates || vehicle.certificates.length === 0) {
                return JSON.stringify({ found: false });
            }

            const cert = vehicle.certificates.find(c => c.type === certificateType);
            if (!cert) {
                return JSON.stringify({ found: false });
            }

            return JSON.stringify({
                found: true,
                certificateType: cert.type,
                pdfHash: cert.pdfHash,
                ipfsCid: cert.ipfsCid,
                issuedAt: cert.issuedAt,
                transactionId: cert.transactionId
            });

        } catch (error) {
            console.error('Error getting certificate hash:', error);
            throw new Error(`Failed to get certificate hash: ${error.message}`);
        }
    }
}

// Export contracts in the format required by Hyperledger Fabric 2.x
// The fabric-contract-api requires contracts to be exported as an array
module.exports.contracts = [VehicleRegistrationContract];
