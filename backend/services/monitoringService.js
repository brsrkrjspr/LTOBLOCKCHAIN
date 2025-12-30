// TrustChain LTO - Lightweight Monitoring Service
// Replaces heavy ELK stack with simple logging and metrics for laptop deployment

const fs = require('fs');
const path = require('path');
const os = require('os');
const db = require('../database/db');

class MonitoringService {
    constructor() {
        this.logsPath = path.join(process.cwd(), 'logs');
        this.metricsPath = path.join(this.logsPath, 'metrics');
        this.initializeMonitoring();
        this.startMetricsCollection();
    }

    // Initialize monitoring
    initializeMonitoring() {
        try {
            // Create logs directory
            if (!fs.existsSync(this.logsPath)) {
                fs.mkdirSync(this.logsPath, { recursive: true });
            }

            if (!fs.existsSync(this.metricsPath)) {
                fs.mkdirSync(this.metricsPath, { recursive: true });
            }

            console.log('✅ Monitoring service initialized');
        } catch (error) {
            console.error('❌ Failed to initialize monitoring:', error);
        }
    }

    // Log application events
    log(level, message, metadata = {}) {
        try {
            const timestamp = new Date().toISOString();
            const logEntry = {
                timestamp,
                level,
                message,
                metadata,
                pid: process.pid,
                hostname: os.hostname()
            };

            // Write to daily log file
            const date = new Date().toISOString().split('T')[0];
            const logFile = path.join(this.logsPath, `app-${date}.log`);
            
            fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');

            // Also log to console in development
            if (process.env.NODE_ENV !== 'production') {
                console.log(`[${level.toUpperCase()}] ${message}`, metadata);
            }

        } catch (error) {
            console.error('❌ Failed to write log:', error);
        }
    }

    // Log info level
    info(message, metadata = {}) {
        this.log('info', message, metadata);
    }

    // Log warning level
    warn(message, metadata = {}) {
        this.log('warn', message, metadata);
    }

    // Log error level
    error(message, metadata = {}) {
        this.log('error', message, metadata);
    }

    // Log debug level
    debug(message, metadata = {}) {
        this.log('debug', message, metadata);
    }

    // Collect system metrics
    collectSystemMetrics() {
        try {
            const metrics = {
                timestamp: new Date().toISOString(),
                system: {
                    uptime: os.uptime(),
                    loadAverage: os.loadavg(),
                    totalMemory: os.totalmem(),
                    freeMemory: os.freemem(),
                    cpuCount: os.cpus().length,
                    platform: os.platform(),
                    arch: os.arch()
                },
                process: {
                    pid: process.pid,
                    uptime: process.uptime(),
                    memoryUsage: process.memoryUsage(),
                    cpuUsage: process.cpuUsage(),
                    version: process.version
                },
                application: {
                    nodeEnv: process.env.NODE_ENV,
                    port: process.env.PORT || 3001
                }
            };

            // Save metrics to file
            const date = new Date().toISOString().split('T')[0];
            const metricsFile = path.join(this.metricsPath, `metrics-${date}.json`);
            
            let existingMetrics = [];
            if (fs.existsSync(metricsFile)) {
                try {
                    existingMetrics = JSON.parse(fs.readFileSync(metricsFile, 'utf8'));
                } catch (error) {
                    existingMetrics = [];
                }
            }

            existingMetrics.push(metrics);

            // Keep only last 1000 entries per day
            if (existingMetrics.length > 1000) {
                existingMetrics = existingMetrics.slice(-1000);
            }

            fs.writeFileSync(metricsFile, JSON.stringify(existingMetrics, null, 2));

            return metrics;

        } catch (error) {
            console.error('❌ Failed to collect system metrics:', error);
            return null;
        }
    }

    // Start metrics collection
    startMetricsCollection() {
        // Collect metrics every 5 minutes
        setInterval(() => {
            this.collectSystemMetrics();
        }, 5 * 60 * 1000);

        // Initial collection
        this.collectSystemMetrics();
    }

    // Get application health status
    getHealthStatus() {
        try {
            const metrics = this.collectSystemMetrics();
            const memoryUsage = process.memoryUsage();
            const freeMemory = os.freemem();
            const totalMemory = os.totalmem();
            const memoryUsagePercent = ((totalMemory - freeMemory) / totalMemory) * 100;

            const health = {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                memory: {
                    used: memoryUsage.heapUsed,
                    total: memoryUsage.heapTotal,
                    external: memoryUsage.external,
                    system: {
                        free: freeMemory,
                        total: totalMemory,
                        usagePercent: memoryUsagePercent
                    }
                },
                cpu: {
                    loadAverage: os.loadavg(),
                    count: os.cpus().length
                },
                disk: this.getDiskUsage(),
                application: {
                    version: '1.0.0',
                    environment: process.env.NODE_ENV || 'development',
                    port: process.env.PORT || 3001
                }
            };

            // Determine health status
            if (memoryUsagePercent > 90) {
                health.status = 'critical';
                health.issues = ['High memory usage'];
            } else if (memoryUsagePercent > 80) {
                health.status = 'warning';
                health.issues = ['Elevated memory usage'];
            }

            return health;

        } catch (error) {
            return {
                status: 'error',
                timestamp: new Date().toISOString(),
                error: error.message
            };
        }
    }

    // Get disk usage
    getDiskUsage() {
        try {
            const stats = fs.statSync(process.cwd());
            return {
                available: true,
                path: process.cwd()
            };
        } catch (error) {
            return {
                available: false,
                error: error.message
            };
        }
    }

    // Get application statistics
    getApplicationStats() {
        try {
            const stats = {
                timestamp: new Date().toISOString(),
                requests: {
                    total: this.getRequestCount(),
                    errors: this.getErrorCount(),
                    success: this.getSuccessCount()
                },
                users: {
                    active: this.getActiveUserCount(),
                    total: this.getTotalUserCount()
                },
                vehicles: {
                    total: this.getTotalVehicleCount(),
                    pending: this.getPendingVehicleCount(),
                    approved: this.getApprovedVehicleCount()
                },
                documents: {
                    total: this.getTotalDocumentCount(),
                    verified: this.getVerifiedDocumentCount()
                }
            };

            return stats;

        } catch (error) {
            console.error('❌ Failed to get application stats:', error);
            return null;
        }
    }

    // Get request count (real implementation)
    async getRequestCount() {
        try {
            // If request_logs table exists, use it; otherwise throw error
            const result = await db.query(
                `SELECT COUNT(*) as count FROM request_logs WHERE created_at > NOW() - INTERVAL '24 hours'`
            );
            return parseInt(result.rows[0]?.count) || 0;
        } catch (error) {
            console.error('Failed to get request count:', error);
            throw new Error('Monitoring service: Failed to retrieve request count from database. Ensure request_logs table exists.');
        }
    }

    // Get error count (real implementation)
    async getErrorCount() {
        try {
            const result = await db.query(
                `SELECT COUNT(*) as count FROM request_logs WHERE status_code >= 400 AND created_at > NOW() - INTERVAL '24 hours'`
            );
            return parseInt(result.rows[0]?.count) || 0;
        } catch (error) {
            console.error('Failed to get error count:', error);
            throw new Error('Monitoring service: Failed to retrieve error count from database.');
        }
    }

    // Get success count (real implementation)
    async getSuccessCount() {
        try {
            const requestCount = await this.getRequestCount();
            const errorCount = await this.getErrorCount();
            return requestCount - errorCount;
        } catch (error) {
            console.error('Failed to get success count:', error);
            throw new Error('Monitoring service: Failed to retrieve success count from database.');
        }
    }

    // Get active user count (real implementation)
    async getActiveUserCount() {
        try {
            const result = await db.query(
                `SELECT COUNT(DISTINCT user_id) as count FROM request_logs WHERE created_at > NOW() - INTERVAL '24 hours' AND user_id IS NOT NULL`
            );
            return parseInt(result.rows[0]?.count) || 0;
        } catch (error) {
            console.error('Failed to get active user count:', error);
            throw new Error('Monitoring service: Failed to retrieve active user count from database.');
        }
    }

    // Get total user count (real implementation)
    async getTotalUserCount() {
        try {
            const result = await db.query('SELECT COUNT(*) as count FROM users WHERE is_active = true');
            return parseInt(result.rows[0]?.count) || 0;
        } catch (error) {
            console.error('Failed to get total user count:', error);
            throw new Error('Monitoring service: Failed to retrieve total user count from database.');
        }
    }

    // Get total vehicle count (real implementation)
    async getTotalVehicleCount() {
        try {
            const result = await db.query('SELECT COUNT(*) as count FROM vehicles');
            return parseInt(result.rows[0]?.count) || 0;
        } catch (error) {
            console.error('Failed to get total vehicle count:', error);
            throw new Error('Monitoring service: Failed to retrieve total vehicle count from database.');
        }
    }

    // Get pending vehicle count (real implementation)
    async getPendingVehicleCount() {
        try {
            const result = await db.query(`SELECT COUNT(*) as count FROM vehicles WHERE status = 'PENDING'`);
            return parseInt(result.rows[0]?.count) || 0;
        } catch (error) {
            console.error('Failed to get pending vehicle count:', error);
            throw new Error('Monitoring service: Failed to retrieve pending vehicle count from database.');
        }
    }

    // Get approved vehicle count (real implementation)
    async getApprovedVehicleCount() {
        try {
            const result = await db.query(`SELECT COUNT(*) as count FROM vehicles WHERE status = 'APPROVED' OR status = 'REGISTERED'`);
            return parseInt(result.rows[0]?.count) || 0;
        } catch (error) {
            console.error('Failed to get approved vehicle count:', error);
            throw new Error('Monitoring service: Failed to retrieve approved vehicle count from database.');
        }
    }

    // Get total document count (real implementation)
    async getTotalDocumentCount() {
        try {
            const result = await db.query('SELECT COUNT(*) as count FROM documents');
            return parseInt(result.rows[0]?.count) || 0;
        } catch (error) {
            console.error('Failed to get total document count:', error);
            throw new Error('Monitoring service: Failed to retrieve total document count from database.');
        }
    }

    // Get verified document count (real implementation)
    async getVerifiedDocumentCount() {
        try {
            const result = await db.query(`SELECT COUNT(*) as count FROM documents WHERE verification_status = 'VERIFIED'`);
            return parseInt(result.rows[0]?.count) || 0;
        } catch (error) {
            console.error('Failed to get verified document count:', error);
            throw new Error('Monitoring service: Failed to retrieve verified document count from database.');
        }
    }

    // Get recent logs
    getRecentLogs(limit = 100) {
        try {
            const date = new Date().toISOString().split('T')[0];
            const logFile = path.join(this.logsPath, `app-${date}.log`);
            
            if (!fs.existsSync(logFile)) {
                return [];
            }

            const logContent = fs.readFileSync(logFile, 'utf8');
            const lines = logContent.trim().split('\n');
            const logs = lines.slice(-limit).map(line => {
                try {
                    return JSON.parse(line);
                } catch (error) {
                    return { message: line, timestamp: new Date().toISOString() };
                }
            });

            return logs.reverse(); // Most recent first

        } catch (error) {
            console.error('❌ Failed to get recent logs:', error);
            return [];
        }
    }

    // Get metrics summary
    getMetricsSummary() {
        try {
            const date = new Date().toISOString().split('T')[0];
            const metricsFile = path.join(this.metricsPath, `metrics-${date}.json`);
            
            if (!fs.existsSync(metricsFile)) {
                return null;
            }

            const metrics = JSON.parse(fs.readFileSync(metricsFile, 'utf8'));
            const latest = metrics[metrics.length - 1];

            return {
                timestamp: latest.timestamp,
                system: latest.system,
                process: latest.process,
                application: latest.application
            };

        } catch (error) {
            console.error('❌ Failed to get metrics summary:', error);
            return null;
        }
    }

    // Cleanup old logs
    cleanupOldLogs(daysToKeep = 7) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

            const files = fs.readdirSync(this.logsPath);
            let cleanedCount = 0;

            files.forEach(file => {
                if (file.startsWith('app-') && file.endsWith('.log')) {
                    const dateStr = file.replace('app-', '').replace('.log', '');
                    const fileDate = new Date(dateStr);

                    if (fileDate < cutoffDate) {
                        fs.unlinkSync(path.join(this.logsPath, file));
                        cleanedCount++;
                    }
                }
            });

            // Cleanup old metrics files
            const metricsFiles = fs.readdirSync(this.metricsPath);
            metricsFiles.forEach(file => {
                if (file.startsWith('metrics-') && file.endsWith('.json')) {
                    const dateStr = file.replace('metrics-', '').replace('.json', '');
                    const fileDate = new Date(dateStr);

                    if (fileDate < cutoffDate) {
                        fs.unlinkSync(path.join(this.metricsPath, file));
                        cleanedCount++;
                    }
                }
            });

            console.log(`✅ Cleaned up ${cleanedCount} old log/metrics files`);

            return {
                success: true,
                cleanedCount: cleanedCount
            };

        } catch (error) {
            console.error('❌ Failed to cleanup old logs:', error);
            throw new Error(`Log cleanup failed: ${error.message}`);
        }
    }
}

// Create singleton instance
const monitoringService = new MonitoringService();

module.exports = monitoringService;
