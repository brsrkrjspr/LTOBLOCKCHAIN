// TrustChain LTO - Integrity Watchdog Service
// Periodically audits DB vs Fabric and optionally auto-heals discrepancies

const integrityService = require('./integrityService');
const gmailApiService = require('./gmailApiService');

const DEFAULT_INTERVAL_MINUTES = 60;

class WatchdogService {
    constructor() {
        this.timer = null;
        this.isRunning = false;
        this.lastRunResult = null;
    }

    getConfig() {
        const enabled = String(process.env.WATCHDOG_ENABLED || 'false').toLowerCase() === 'true';
        const autoHeal = String(process.env.WATCHDOG_AUTO_HEAL || 'false').toLowerCase() === 'true';
        const intervalMinutes = parseInt(process.env.WATCHDOG_INTERVAL_MINUTES || DEFAULT_INTERVAL_MINUTES, 10);
        const alertEmail = process.env.WATCHDOG_ALERT_EMAIL || process.env.SYNC_ALERT_EMAIL || 'ltolipablockchain@gmail.com';

        return {
            enabled,
            autoHeal,
            intervalMinutes: Number.isFinite(intervalMinutes) && intervalMinutes > 0 ? intervalMinutes : DEFAULT_INTERVAL_MINUTES,
            alertEmail
        };
    }

    async runOnce() {
        if (this.isRunning) {
            return { success: false, error: 'Watchdog already running', lastRunResult: this.lastRunResult };
        }

        const { autoHeal, alertEmail } = this.getConfig();
        this.isRunning = true;

        try {
            const result = await integrityService.runForensicAudit(autoHeal);
            this.lastRunResult = result;

            if (result.tampered.length > 0 || result.errors > 0) {
                await this.sendAlertEmail(result, alertEmail, autoHeal);
            }

            return { success: true, ...result };
        } catch (error) {
            return { success: false, error: error.message || 'Watchdog run failed' };
        } finally {
            this.isRunning = false;
        }
    }

    async sendAlertEmail(result, alertEmail, autoHeal) {
        const subject = `⚠️ [TrustChain LTO] Integrity Watchdog Alert - ${result.tampered.length} tampered, ${result.errors} errors`;

        const tamperedRows = result.tampered.map(t => `
            <tr>
                <td style="padding: 8px; border: 1px solid #ddd;">${t.vin}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${t.owner || 'N/A'}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${(t.mismatches || []).join(', ') || 'N/A'}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${t.restored ? 'YES' : 'NO'}</td>
            </tr>
        `).join('');

        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
                <h2 style="color: #e74c3c;">⚠️ Integrity Watchdog Alert</h2>
                <p>Automated watchdog detected discrepancies between PostgreSQL and Hyperledger Fabric.</p>

                <h3>Summary</h3>
                <ul>
                    <li><strong>Checked:</strong> ${result.totalChecked}</li>
                    <li><strong>Verified:</strong> ${result.verified}</li>
                    <li><strong style="color: red;">Tampered:</strong> ${result.tampered.length}</li>
                    <li><strong>Restored:</strong> ${result.restored}</li>
                    <li><strong>Errors:</strong> ${result.errors}</li>
                    <li><strong>Auto-Heal:</strong> ${autoHeal ? 'ENABLED' : 'DISABLED'}</li>
                    <li><strong>Duration:</strong> ${result.duration}s</li>
                </ul>

                <h3>Tampered Records</h3>
                <table style="border-collapse: collapse; width: 100%;">
                    <thead>
                        <tr style="background: #f5f5f5;">
                            <th style="padding: 8px; border: 1px solid #ddd;">VIN</th>
                            <th style="padding: 8px; border: 1px solid #ddd;">Owner</th>
                            <th style="padding: 8px; border: 1px solid #ddd;">Mismatches</th>
                            <th style="padding: 8px; border: 1px solid #ddd;">Restored</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tamperedRows || '<tr><td colspan="4" style="padding: 8px; border: 1px solid #ddd; text-align: center;">None</td></tr>'}
                    </tbody>
                </table>
                <p style="margin-top: 20px; color: #666; font-size: 12px;">Automated alert from TrustChain LTO Watchdog.</p>
            </div>
        `;

        const text = `
Integrity Watchdog Alert

Summary:
- Checked: ${result.totalChecked}
- Verified: ${result.verified}
- Tampered: ${result.tampered.length}
- Restored: ${result.restored}
- Errors: ${result.errors}
- Auto-Heal: ${autoHeal ? 'ENABLED' : 'DISABLED'}
- Duration: ${result.duration}s
        `;

        await gmailApiService.sendMail({
            to: alertEmail,
            subject,
            text,
            html
        });
    }

    start() {
        const { enabled, intervalMinutes } = this.getConfig();
        if (!enabled) {
            console.log('🟡 Watchdog disabled (WATCHDOG_ENABLED=false)');
            return;
        }

        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }

        const intervalMs = intervalMinutes * 60 * 1000;
        console.log(`🕵️ Watchdog enabled. Interval: ${intervalMinutes} minutes`);

        // Run once on startup, then schedule
        this.runOnce().catch(error => {
            console.error('❌ Watchdog initial run failed:', error.message);
        });

        this.timer = setInterval(() => {
            this.runOnce().catch(error => {
                console.error('❌ Watchdog scheduled run failed:', error.message);
            });
        }, intervalMs);
    }

    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        console.log('🛑 Watchdog stopped');
    }
}

module.exports = new WatchdogService();
