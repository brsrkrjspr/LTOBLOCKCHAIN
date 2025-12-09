// TrustChain LTO - Production Vehicle Registration Chaincode
// Hyperledger Fabric v2.5 Smart Contract

'use strict';

const { Contract } = require('fabric-contract-api');

class VehicleRegistrationContract extends Contract {

    constructor() {
        super('VehicleRegistrationContract');
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
            const timestamp = new Date().toISOString();

            // Create vehicle record
            const vehicleRecord = {
                vin: vehicle.vin,
                plateNumber: vehicle.plateNumber || '',
                make: vehicle.make,
                model: vehicle.model,
                year: vehicle.year,
                color: vehicle.color || '',
                engineNumber: vehicle.engineNumber || '',
                chassisNumber: vehicle.chassisNumber || '',
                vehicleType: vehicle.vehicleType || 'PASSENGER',
                fuelType: vehicle.fuelType || 'GASOLINE',
                transmission: vehicle.transmission || 'MANUAL',
                engineDisplacement: vehicle.engineDisplacement || '',
                owner: vehicle.owner,
                status: 'REGISTERED',
                verificationStatus: {
                    insurance: 'PENDING',
                    emission: 'PENDING',
                    admin: 'PENDING'
                },
                documents: vehicle.documents || {},
                notes: {
                    admin: '',
                    insurance: '',
                    emission: ''
                },
                registrationDate: timestamp,
                lastUpdated: timestamp,
                priority: vehicle.priority || 'MEDIUM',
                history: [{
                    action: 'REGISTERED',
                    timestamp: timestamp,
                    performedBy: ctx.clientIdentity.getMSPID(),
                    details: 'Vehicle registration submitted',
                    transactionId: txId
                }],
                blockchainTxId: txId,
                createdBy: ctx.clientIdentity.getMSPID(),
                createdAt: timestamp
            };

            // Store vehicle in world state
            await ctx.stub.putState(vehicle.vin, Buffer.from(JSON.stringify(vehicleRecord)));

            // Create composite key for owner lookup
            const ownerKey = ctx.stub.createCompositeKey('owner~vin', [vehicle.owner.email, vehicle.vin]);
            await ctx.stub.putState(ownerKey, Buffer.from(vehicle.vin));

            // Create composite key for plate number lookup
            if (vehicle.plateNumber) {
                const plateKey = ctx.stub.createCompositeKey('plate~vin', [vehicle.plateNumber, vehicle.vin]);
                await ctx.stub.putState(plateKey, Buffer.from(vehicle.vin));
            }

            // Emit event
            ctx.stub.setEvent('VehicleRegistered', {
                vin: vehicle.vin,
                plateNumber: vehicle.plateNumber,
                owner: vehicle.owner.email,
                timestamp: timestamp,
                transactionId: txId
            });

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
            return JSON.stringify(vehicle);

        } catch (error) {
            console.error('Error getting vehicle:', error);
            throw new Error(`Failed to get vehicle: ${error.message}`);
        }
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
            const timestamp = new Date().toISOString();

            // Validate verifier type
            const validVerifiers = ['insurance', 'emission', 'admin'];
            if (!validVerifiers.includes(verifierType)) {
                throw new Error(`Invalid verifier type: ${verifierType}`);
            }

            // Validate status
            const validStatuses = ['PENDING', 'APPROVED', 'REJECTED'];
            if (!validStatuses.includes(status)) {
                throw new Error(`Invalid status: ${status}`);
            }

            // Organization-based authorization (Permissioned Network)
            // Only authorized organizations can perform specific verifications
            const clientMSPID = ctx.clientIdentity.getMSPID();
            const authorizedMSPs = {
                'insurance': ['InsuranceMSP', 'LTOMSP'], // Insurance companies or LTO can verify insurance
                'emission': ['EmissionMSP', 'LTOMSP'],  // Emission centers or LTO can verify emission
                'admin': ['LTOMSP'],                      // Only LTO can perform admin verification
                'hpg': ['HPGMSP', 'LTOMSP']              // HPG can report violations/stolen vehicles
            };

            if (!authorizedMSPs[verifierType] || !authorizedMSPs[verifierType].includes(clientMSPID)) {
                throw new Error(`Unauthorized: ${clientMSPID} cannot perform ${verifierType} verification. Authorized MSPs: ${authorizedMSPs[verifierType].join(', ')}`);
            }

            // Update verification status
            vehicle.verificationStatus[verifierType] = status;
            vehicle.notes[verifierType] = notes || '';
            vehicle.lastUpdated = timestamp;

            // Add to history
            vehicle.history.push({
                action: `VERIFICATION_${status}`,
                timestamp: timestamp,
                performedBy: ctx.clientIdentity.getMSPID(),
                details: `${verifierType} verification ${status.toLowerCase()}`,
                transactionId: txId,
                notes: notes || ''
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

            // Emit event
            ctx.stub.setEvent('VerificationUpdated', {
                vin: vin,
                verifierType: verifierType,
                status: status,
                timestamp: timestamp,
                transactionId: txId
            });

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
            const timestamp = new Date().toISOString();

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

            // Update ownership
            const previousOwner = vehicle.owner;
            vehicle.owner = newOwner;
            vehicle.lastUpdated = timestamp;

            // Add to history
            vehicle.history.push({
                action: 'OWNERSHIP_TRANSFERRED',
                timestamp: timestamp,
                performedBy: ctx.clientIdentity.getMSPID(),
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

            // Emit event
            ctx.stub.setEvent('OwnershipTransferred', {
                vin: vin,
                previousOwner: previousOwner.email,
                newOwner: newOwner.email,
                timestamp: timestamp,
                transactionId: txId
            });

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

    // Query vehicles by status
    async QueryVehiclesByStatus(ctx, status) {
        try {
            const queryString = {
                selector: {
                    status: status
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
            console.error('Error querying vehicles by status:', error);
            throw new Error(`Failed to query vehicles by status: ${error.message}`);
        }
    }

    // Query vehicles by verification status
    async QueryVehiclesByVerificationStatus(ctx, verifierType, status) {
        try {
            const queryString = {
                selector: {
                    verificationStatus: {
                        [verifierType]: status
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
            console.error('Error querying vehicles by verification status:', error);
            throw new Error(`Failed to query vehicles by verification status: ${error.message}`);
        }
    }

    // Get all vehicles (for admin)
    async GetAllVehicles(ctx) {
        try {
            const queryString = {
                selector: {}
            };

            const results = await ctx.stub.getQueryResult(JSON.stringify(queryString));
            const vehicles = [];

            for await (const result of results) {
                const vehicle = JSON.parse(result.value.toString());
                vehicles.push(vehicle);
            }

            return JSON.stringify(vehicles);

        } catch (error) {
            console.error('Error getting all vehicles:', error);
            throw new Error(`Failed to get all vehicles: ${error.message}`);
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
            const timestamp = new Date().toISOString();

            // Update allowed fields
            const allowedFields = ['color', 'engineNumber', 'chassisNumber', 'vehicleType', 'fuelType', 'transmission', 'engineDisplacement'];
            
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

            // Emit event
            ctx.stub.setEvent('VehicleUpdated', {
                vin: vin,
                timestamp: timestamp,
                transactionId: txId
            });

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
            const timestamp = new Date().toISOString();

            // Delete vehicle from world state
            await ctx.stub.deleteState(vin);

            // Delete composite keys
            const ownerKey = ctx.stub.createCompositeKey('owner~vin', [vehicle.owner.email, vin]);
            await ctx.stub.deleteState(ownerKey);

            if (vehicle.plateNumber) {
                const plateKey = ctx.stub.createCompositeKey('plate~vin', [vehicle.plateNumber, vin]);
                await ctx.stub.deleteState(plateKey);
            }

            // Emit event
            ctx.stub.setEvent('VehicleDeleted', {
                vin: vin,
                timestamp: timestamp,
                transactionId: txId
            });

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

    // Get system statistics
    async GetSystemStats(ctx) {
        try {
            const queryString = {
                selector: {}
            };

            const results = await ctx.stub.getQueryResult(JSON.stringify(queryString));
            let totalVehicles = 0;
            let statusCounts = {};
            let verificationCounts = {};

            for await (const result of results) {
                const vehicle = JSON.parse(result.value.toString());
                totalVehicles++;

                // Count by status
                statusCounts[vehicle.status] = (statusCounts[vehicle.status] || 0) + 1;

                // Count by verification status
                Object.keys(vehicle.verificationStatus).forEach(verifier => {
                    const status = vehicle.verificationStatus[verifier];
                    const key = `${verifier}_${status}`;
                    verificationCounts[key] = (verificationCounts[key] || 0) + 1;
                });
            }

            return JSON.stringify({
                totalVehicles: totalVehicles,
                statusCounts: statusCounts,
                verificationCounts: verificationCounts,
                timestamp: new Date().toISOString()
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
            const timestamp = new Date().toISOString();

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

            // Emit event
            ctx.stub.setEvent('ViolationReported', {
                vin: vin,
                violationType: violation.violationType,
                timestamp: timestamp,
                transactionId: txId
            });

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
            const timestamp = new Date().toISOString();

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

            // Emit event
            ctx.stub.setEvent('VehicleStolen', {
                vin: vin,
                reportNumber: report.reportNumber,
                timestamp: timestamp,
                transactionId: txId
            });

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
            const timestamp = new Date().toISOString();

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

            // Emit event
            ctx.stub.setEvent('VehicleRecovered', {
                vin: vin,
                timestamp: timestamp,
                transactionId: txId
            });

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
}

module.exports = VehicleRegistrationContract;
