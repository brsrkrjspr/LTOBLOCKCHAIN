// Script to register missing vehicles on blockchain
// Fixes data integrity issues where vehicles are REGISTERED but not on blockchain
//
// SECURITY: This script requires:
// 1. Server access (SSH/file system)
// 2. Database credentials (.env file)
// 3. Fabric network access (wallet, certificates)
// 4. Admin confirmation (interactive prompt)
//
// This script is NOT exposed via API - it's a server-side admin tool only.

const db = require('../database/db');
const fabricService = require('../services/optimizedFabricService');
const path = require('path');
const readline = require('readline');

// Security: Require admin confirmation
function requireAdminConfirmation() {
    return new Promise((resolve, reject) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        console.log('\n⚠️  SECURITY WARNING:');
        console.log('   This script will register vehicles on the blockchain.');
        console.log('   Only authorized administrators should run this script.\n');
        
        rl.question('Are you an authorized administrator? Type "YES" to continue: ', (answer) => {
            rl.close();
            
            if (answer.trim() !== 'YES') {
                console.log('\n❌ Operation cancelled. Only authorized administrators can run this script.');
                process.exit(1);
            }
            
            console.log('✅ Admin confirmation received\n');
            resolve();
        });
    });
}

async function registerMissingVehiclesOnBlockchain() {
    // SECURITY: Log who is running this script (if possible)
    const currentUser = process.env.USER || process.env.USERNAME || 'unknown';
    const hostname = require('os').hostname();
    
    try {
        // SECURITY: Require admin confirmation
        await requireAdminConfirmation();
        
        console.log('🔧 Registering missing vehicles on blockchain...\n');
        
        // Load environment variables
        const envPath = path.join(__dirname, '../../.env');
        try {
            require('dotenv').config({ path: envPath });
            console.log(`📋 Loaded environment variables from: ${envPath}`);
        } catch (error) {
            require('dotenv').config();
        }
        
        console.log(`👤 Running as: ${currentUser} on ${hostname}`);
        console.log(`⏰ Started at: ${new Date().toISOString()}\n`);
        
        // Check blockchain mode
        const blockchainMode = process.env.BLOCKCHAIN_MODE || 'fabric';
        if (blockchainMode !== 'fabric') {
            console.error('❌ BLOCKCHAIN_MODE must be "fabric" to register vehicles on blockchain');
            process.exit(1);
        }
        
        // Ensure Fabric is connected
        if (!fabricService.isConnected) {
            console.log('🔗 Connecting to Fabric network...');
            try {
                await fabricService.initialize();
            } catch (error) {
                console.error('❌ Failed to connect to Fabric:', error.message);
                process.exit(1);
            }
        }
        
        console.log('✅ Connected to Fabric network\n');
        
        // Find vehicles that are REGISTERED but not on blockchain
        const missingVehicles = await db.query(
            `SELECT v.id, v.vin, v.plate_number, v.status, v.origin_type,
                    v.make, v.model, v.year, v.color, v.engine_number, v.chassis_number,
                    v.vehicle_type, v.fuel_type, v.transmission, v.engine_displacement,
                    v.owner_id, v.or_number, v.cr_number,
                    u.email as owner_email, u.first_name, u.last_name,
                    v.blockchain_tx_id,
                    (SELECT COUNT(*) FROM vehicle_history vh 
                     WHERE vh.vehicle_id = v.id 
                     AND vh.action = 'BLOCKCHAIN_REGISTERED') as has_blockchain_history
             FROM vehicles v
             LEFT JOIN users u ON v.owner_id = u.id
             WHERE v.status = 'REGISTERED'
             AND (
                 v.blockchain_tx_id IS NULL 
                 OR v.blockchain_tx_id = ''
                 OR NOT EXISTS (
                     SELECT 1 FROM vehicle_history vh 
                     WHERE vh.vehicle_id = v.id 
                     AND vh.action = 'BLOCKCHAIN_REGISTERED'
                     AND vh.transaction_id IS NOT NULL
                 )
             )
             ORDER BY v.last_updated DESC`
        );
        
        if (missingVehicles.rows.length === 0) {
            console.log('✅ No vehicles need blockchain registration');
            return;
        }
        
        console.log(`📋 Found ${missingVehicles.rows.length} vehicle(s) missing blockchain registration:\n`);
        
        let successCount = 0;
        let failCount = 0;
        let alreadyExistsCount = 0;
        
        for (const vehicle of missingVehicles.rows) {
            console.log(`\n🚗 Processing vehicle: ${vehicle.vin}`);
            console.log(`   Plate: ${vehicle.plate_number || 'N/A'}`);
            console.log(`   Status: ${vehicle.status}`);
            console.log(`   Origin: ${vehicle.origin_type || 'N/A'}`);
            
            // Check if vehicle already exists on blockchain
            let existsOnBlockchain = false;
            let existingTxId = null;
            
            try {
                const blockchainResult = await fabricService.getVehicle(vehicle.vin);
                if (blockchainResult.success && blockchainResult.vehicle) {
                    existsOnBlockchain = true;
                    existingTxId = blockchainResult.vehicle.blockchainTxId || 
                                  blockchainResult.vehicle.transactionId ||
                                  blockchainResult.vehicle.lastTxId ||
                                  blockchainResult.vehicle.history?.[0]?.transactionId ||
                                  null;
                    
                    if (existingTxId) {
                        console.log(`   ✅ Vehicle already exists on blockchain with TX ID: ${existingTxId.substring(0, 20)}...`);
                        alreadyExistsCount++;
                        
                        // Update database with existing transaction ID
                        await db.query(
                            `UPDATE vehicles 
                             SET blockchain_tx_id = $1, last_updated = CURRENT_TIMESTAMP
                             WHERE id = $2`,
                            [existingTxId, vehicle.id]
                        );
                        
                        // Add history entry if missing
                        if (vehicle.has_blockchain_history === 0) {
                            await db.query(
                                `INSERT INTO vehicle_history 
                                 (vehicle_id, action, description, transaction_id, performed_by, metadata)
                                 VALUES ($1, $2, $3, $4, NULL, $5)`,
                                [
                                    vehicle.id,
                                    'BLOCKCHAIN_REGISTERED',
                                    `Vehicle found on blockchain (backfill). TX: ${existingTxId}`,
                                    existingTxId,
                                    JSON.stringify({ source: 'backfill_script', foundExisting: true })
                                ]
                            );
                            console.log(`   ✅ Added BLOCKCHAIN_REGISTERED history entry`);
                        }
                        
                        continue;
                    }
                }
            } catch (queryError) {
                // Vehicle doesn't exist - proceed with registration
                console.log(`   ℹ️  Vehicle not found on blockchain - will register now`);
            }
            
            // Prepare vehicle data for blockchain registration
            // For transferred vehicles, register with CURRENT owner (buyer after transfer)
            const ownerData = vehicle.owner_email ? {
                email: vehicle.owner_email,
                firstName: vehicle.first_name || '',
                lastName: vehicle.last_name || ''
            } : {
                email: 'unknown@example.com',
                firstName: 'Unknown',
                lastName: 'Owner'
            };
            
            // Get vehicle documents for blockchain record
            const documents = await db.query(
                `SELECT document_type, ipfs_cid, filename, original_name
                 FROM documents
                 WHERE vehicle_id = $1 AND ipfs_cid IS NOT NULL`,
                [vehicle.id]
            );
            
            const documentCids = {};
            const docTypes = require('../config/documentTypes');
            for (const doc of documents.rows) {
                if (doc.ipfs_cid) {
                    const logicalType = docTypes.mapToLogicalType(doc.document_type);
                    if (logicalType && logicalType !== 'other' && docTypes.isValidLogicalType(logicalType)) {
                        documentCids[logicalType] = {
                            cid: doc.ipfs_cid,
                            filename: doc.filename || doc.original_name || 'unknown',
                            documentType: doc.document_type
                        };
                    }
                }
            }
            
            const vehicleData = {
                vin: vehicle.vin,
                plateNumber: vehicle.plate_number || '',
                make: vehicle.make,
                model: vehicle.model,
                year: vehicle.year,
                color: vehicle.color || '',
                engineNumber: vehicle.engine_number || '',
                chassisNumber: vehicle.chassis_number || '',
                vehicleType: vehicle.vehicle_type || 'PASSENGER',
                fuelType: vehicle.fuel_type || 'GASOLINE',
                transmission: vehicle.transmission || 'MANUAL',
                engineDisplacement: vehicle.engine_displacement || '',
                owner: ownerData,
                orNumber: vehicle.or_number || '',
                crNumber: vehicle.cr_number || '',
                documents: documentCids // Include document CIDs
            };
            
            // Register on blockchain
            // Note: For transferred vehicles, we register with CURRENT owner (the buyer)
            // This creates the blockchain record with the correct ownership
            try {
                if (vehicle.origin_type === 'TRANSFER') {
                    console.log(`   🔗 Registering transferred vehicle on blockchain (with current owner: ${ownerData.email})...`);
                } else {
                    console.log(`   🔗 Registering on blockchain...`);
                }
                
                const result = await fabricService.registerVehicle(vehicleData);
                const blockchainTxId = result.transactionId;
                
                if (!blockchainTxId) {
                    throw new Error('Registration completed but no transaction ID returned');
                }
                
                console.log(`   ✅ Registered successfully. TX ID: ${blockchainTxId.substring(0, 20)}...`);
                
                // Update database
                await db.query(
                    `UPDATE vehicles 
                     SET blockchain_tx_id = $1, last_updated = CURRENT_TIMESTAMP
                     WHERE id = $2`,
                    [blockchainTxId, vehicle.id]
                );
                
                // Add history entry with security metadata
                await db.query(
                    `INSERT INTO vehicle_history 
                     (vehicle_id, action, description, transaction_id, performed_by, metadata)
                     VALUES ($1, $2, $3, $4, NULL, $5)`,
                    [
                        vehicle.id,
                        'BLOCKCHAIN_REGISTERED',
                        `Vehicle registered on blockchain (backfill script). TX: ${blockchainTxId}`,
                        blockchainTxId,
                        JSON.stringify({ 
                            source: 'backfill_script',
                            registered: true,
                            scriptUser: currentUser,
                            scriptHost: hostname,
                            scriptTimestamp: new Date().toISOString()
                        })
                    ]
                );
                
                successCount++;
                console.log(`   ✅ Database updated with blockchain transaction ID`);
                
            } catch (registerError) {
                console.error(`   ❌ Failed to register: ${registerError.message}`);
                failCount++;
            }
        }
        
        console.log(`\n\n📊 Summary:`);
        console.log(`   Total vehicles processed: ${missingVehicles.rows.length}`);
        console.log(`   ✅ Successfully registered: ${successCount}`);
        console.log(`   ✅ Already on blockchain: ${alreadyExistsCount}`);
        console.log(`   ❌ Failed: ${failCount}`);
        
        if (successCount > 0 || alreadyExistsCount > 0) {
            console.log(`\n✅ Fixed ${successCount + alreadyExistsCount} vehicle(s) - QR codes should now work!`);
        }
        
        // SECURITY: Log script completion
        console.log(`\n📝 Script completed by: ${currentUser} on ${hostname}`);
        console.log(`⏰ Completed at: ${new Date().toISOString()}`);
        
    } catch (error) {
        console.error('❌ Error:', error);
        console.error(`\n📝 Script failed - User: ${currentUser}, Host: ${hostname}`);
        throw error;
    } finally {
        await db.close();
    }
}

// Run if called directly
if (require.main === module) {
    registerMissingVehiclesOnBlockchain()
        .then(() => {
            console.log('\n✅ Script completed');
            process.exit(0);
        })
        .catch(error => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}

module.exports = { registerMissingVehiclesOnBlockchain };
