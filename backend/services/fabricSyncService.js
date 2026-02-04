// TrustChain LTO - Fabric-Postgres Sync Service
// Runs batch integrity checks and sends email alerts on discrepancies

const db = require('../database/db');
const integrityService = require('./integrityService');
const gmailApiService = require('./gmailApiService');
const fabricService = require('./optimizedFabricService');

const ALERT_EMAIL = process.env.SYNC_ALERT_EMAIL || 'ltolipablockchain@gmail.com';

class FabricSyncService {
    constructor() {
        this.lastSyncResult = null;
        this.isSyncing = false;
    }

    /**
     * Run full sync check: compare all REGISTERED vehicles in Postgres against Fabric
     * @returns {Object} Sync result with matched/mismatched counts and details
     */
    async runFullSync() {
        if (this.isSyncing) {
            return {
                success: false,
                error: 'Sync already in progress',
                lastSyncResult: this.lastSyncResult
            };
        }

        this.isSyncing = true;
        const startTime = Date.now();
        const discrepancies = [];
        let matched = 0;
        let mismatched = 0;
        let notOnBlockchain = 0;
        let errors = 0;

        try {
            console.log('🔄 Starting Fabric-Postgres full sync...');

            // Get all REGISTERED vehicles from Postgres
            const result = await db.query(`
                SELECT id, vin, plate_number, engine_number, chassis_number, make, model, year, status
                FROM vehicles
                WHERE status = 'REGISTERED'
                ORDER BY created_at DESC
            `);

            const vehicles = result.rows;
            console.log(`📊 Found ${vehicles.length} REGISTERED vehicles to check`);

            // Check each vehicle against Fabric
            for (const vehicle of vehicles) {
                try {
                    const integrityResult = await integrityService.checkIntegrityByVin(vehicle.vin);

                    if (integrityResult.status === 'VERIFIED') {
                        matched++;
                    } else if (integrityResult.status === 'NOT_REGISTERED') {
                        notOnBlockchain++;
                        discrepancies.push({
                            vin: vehicle.vin,
                            plateNumber: vehicle.plate_number,
                            status: 'NOT_ON_BLOCKCHAIN',
                            message: 'Vehicle registered in Postgres but not found in Fabric',
                            dbVehicle: integrityResult.dbVehicle
                        });
                    } else if (integrityResult.status === 'TAMPERED' || integrityResult.status === 'MISMATCH') {
                        mismatched++;
                        discrepancies.push({
                            vin: vehicle.vin,
                            plateNumber: vehicle.plate_number,
                            status: integrityResult.status,
                            message: integrityResult.message,
                            comparisons: integrityResult.comparisons.filter(c => !c.matches),
                            dbVehicle: integrityResult.dbVehicle,
                            blockchainVehicle: integrityResult.blockchainVehicle
                        });
                    } else if (integrityResult.status === 'ERROR') {
                        errors++;
                        console.warn(`⚠️ Error checking ${vehicle.vin}:`, integrityResult.error);
                    }
                } catch (error) {
                    errors++;
                    console.error(`❌ Exception checking ${vehicle.vin}:`, error.message);
                }
            }

            const duration = Date.now() - startTime;
            const syncResult = {
                success: true,
                syncedAt: new Date().toISOString(),
                durationMs: duration,
                totalChecked: vehicles.length,
                matched,
                mismatched,
                notOnBlockchain,
                errors,
                discrepancies: discrepancies.slice(0, 50), // Limit to 50 for response size
                hasDiscrepancies: discrepancies.length > 0
            };

            this.lastSyncResult = syncResult;

            console.log(`✅ Sync complete in ${duration}ms: ${matched} matched, ${mismatched} mismatched, ${notOnBlockchain} not on blockchain, ${errors} errors`);

            // Send email if discrepancies found
            if (discrepancies.length > 0) {
                await this.sendDiscrepancyEmail(syncResult);
            }

            return syncResult;

        } catch (error) {
            console.error('❌ Full sync error:', error);
            return {
                success: false,
                error: error.message,
                syncedAt: new Date().toISOString()
            };
        } finally {
            this.isSyncing = false;
        }
    }

    /**
     * Get current sync status without running a new sync
     */
    getSyncStatus() {
        return {
            success: true,
            isSyncing: this.isSyncing,
            lastSyncResult: this.lastSyncResult,
            alertEmail: ALERT_EMAIL
        };
    }

    /**
     * Send email alert about discrepancies
     */
    async sendDiscrepancyEmail(syncResult) {
        try {
            const subject = `⚠️ [TrustChain LTO] Data Discrepancy Alert - ${syncResult.mismatched + syncResult.notOnBlockchain} issues found`;

            const discrepancyRows = syncResult.discrepancies.map(d => `
                <tr>
                    <td style="padding: 8px; border: 1px solid #ddd;">${d.vin}</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">${d.plateNumber || 'N/A'}</td>
                    <td style="padding: 8px; border: 1px solid #ddd; color: ${d.status === 'TAMPERED' ? 'red' : 'orange'};">${d.status}</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">${d.message}</td>
                </tr>
            `).join('');

            const html = `
                <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
                    <h2 style="color: #e74c3c;">⚠️ Fabric-Postgres Data Discrepancy Alert</h2>
                    
                    <p>The automated sync check has detected discrepancies between PostgreSQL and Hyperledger Fabric.</p>
                    
                    <h3>Summary</h3>
                    <ul>
                        <li><strong>Checked:</strong> ${syncResult.totalChecked} vehicles</li>
                        <li><strong>Matched:</strong> ${syncResult.matched}</li>
                        <li><strong style="color: orange;">Mismatched:</strong> ${syncResult.mismatched}</li>
                        <li><strong style="color: red;">Not on Blockchain:</strong> ${syncResult.notOnBlockchain}</li>
                        <li><strong>Errors:</strong> ${syncResult.errors}</li>
                        <li><strong>Duration:</strong> ${syncResult.durationMs}ms</li>
                    </ul>
                    
                    <h3>Discrepancies (showing first ${syncResult.discrepancies.length})</h3>
                    <table style="border-collapse: collapse; width: 100%;">
                        <thead>
                            <tr style="background: #f5f5f5;">
                                <th style="padding: 8px; border: 1px solid #ddd;">VIN</th>
                                <th style="padding: 8px; border: 1px solid #ddd;">Plate</th>
                                <th style="padding: 8px; border: 1px solid #ddd;">Status</th>
                                <th style="padding: 8px; border: 1px solid #ddd;">Issue</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${discrepancyRows}
                        </tbody>
                    </table>
                    
                    <p style="margin-top: 20px; color: #666; font-size: 12px;">
                        This is an automated alert from TrustChain LTO System.<br>
                        Sync performed at: ${syncResult.syncedAt}
                    </p>
                </div>
            `;

            const text = `
Fabric-Postgres Data Discrepancy Alert

Summary:
- Checked: ${syncResult.totalChecked} vehicles
- Matched: ${syncResult.matched}
- Mismatched: ${syncResult.mismatched}
- Not on Blockchain: ${syncResult.notOnBlockchain}
- Errors: ${syncResult.errors}

Please check the admin dashboard for details.
Sync performed at: ${syncResult.syncedAt}
            `;

            await gmailApiService.sendMail({
                to: ALERT_EMAIL,
                subject,
                text,
                html
            });

            console.log(`📧 Discrepancy alert email sent to ${ALERT_EMAIL}`);
            return true;

        } catch (error) {
            console.error('❌ Failed to send discrepancy email:', error);
            return false;
        }
    }
}

// Export singleton
const fabricSyncService = new FabricSyncService();
module.exports = fabricSyncService;
