const db = require('../database/db');

/**
 * Schema Validation Service
 * Validates critical database schema elements before server startup
 * Fails fast if schema mismatches are detected
 */
class SchemaValidationService {
    /**
     * Validate all critical schema elements
     * @returns {Promise<void>}
     * @throws {Error} If any critical check fails
     */
    async validateSchema() {
        console.log('🔍 Validating critical database schema elements...');
        
        const criticalChecks = [
            {
                name: 'documents.ipfs_cid column',
                check: () => this.checkColumnExists('documents', 'ipfs_cid'),
                required: true,
                fix: 'Run migration: database/fix-missing-columns.sql'
            },
            {
                name: 'document_type.hpg_clearance enum value',
                check: () => this.checkEnumValueExists('document_type', 'hpg_clearance'),
                required: true,
                fix: 'Run migration: database/add-vehicle-registration-document-types.sql'
            },
            {
                name: 'document_type.csr enum value',
                check: () => this.checkEnumValueExists('document_type', 'csr'),
                required: true,
                fix: 'Run migration: database/add-vehicle-registration-document-types.sql'
            },
            {
                name: 'document_type.sales_invoice enum value',
                check: () => this.checkEnumValueExists('document_type', 'sales_invoice'),
                required: true,
                fix: 'Run migration: database/add-vehicle-registration-document-types.sql'
            },
            {
                name: 'clearance_requests.status column',
                check: () => this.checkColumnExists('clearance_requests', 'status'),
                required: true,
                fix: 'Ensure clearance_requests table exists'
            },
            {
                name: 'documents table',
                check: () => this.checkTableExists('documents'),
                required: true,
                fix: 'Run database migrations'
            },
            {
                name: 'vehicles table',
                check: () => this.checkTableExists('vehicles'),
                required: true,
                fix: 'Run database migrations'
            }
        ];

        const results = await Promise.allSettled(
            criticalChecks.map(check => check.check())
        );

        const failures = [];
        const warnings = [];

        results.forEach((result, index) => {
            const check = criticalChecks[index];
            
            if (result.status === 'rejected') {
                failures.push({
                    check: check.name,
                    error: result.reason?.message || 'Unknown error',
                    fix: check.fix
                });
            } else if (!result.value.passed) {
                if (check.required) {
                    failures.push({
                        check: check.name,
                        error: result.value.description || 'Check failed',
                        fix: check.fix
                    });
                } else {
                    warnings.push({
                        check: check.name,
                        message: result.value.description || 'Check failed'
                    });
                }
            }
        });

        // Report warnings
        if (warnings.length > 0) {
            console.warn('⚠️ Schema validation warnings:');
            warnings.forEach(w => {
                console.warn(`   - ${w.check}: ${w.message}`);
            });
        }

        // Report failures
        if (failures.length > 0) {
            console.error('❌ Schema validation failed:');
            failures.forEach(f => {
                console.error(`   - ${f.check}: ${f.error}`);
                console.error(`     Fix: ${f.fix}`);
            });
            
            throw new Error(
                `Schema validation failed: ${failures.length} critical check(s) failed.\n` +
                `Please run database migrations before starting the server.\n` +
                `See SCHEMA_CROSS_CHECK_REPORT.md for details.`
            );
        }

        console.log('✅ Schema validation passed - all critical elements exist');
        return true;
    }

    /**
     * Check if a column exists in a table
     * @param {string} table - Table name
     * @param {string} column - Column name
     * @returns {Promise<{passed: boolean, description: string}>}
     */
    async checkColumnExists(table, column) {
        try {
            const result = await db.query(`
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public'
                    AND table_name = $1
                    AND column_name = $2
                ) AS exists
            `, [table, column]);
            
            const exists = result.rows[0]?.exists || false;
            
            return {
                passed: exists,
                description: exists 
                    ? `Column ${table}.${column} exists` 
                    : `Column ${table}.${column} does not exist`
            };
        } catch (error) {
            throw new Error(`Error checking column ${table}.${column}: ${error.message}`);
        }
    }

    /**
     * Check if an enum value exists
     * @param {string} enumType - Enum type name
     * @param {string} value - Enum value to check
     * @returns {Promise<{passed: boolean, description: string}>}
     */
    async checkEnumValueExists(enumType, value) {
        try {
            const result = await db.query(`
                SELECT EXISTS (
                    SELECT 1 FROM pg_enum
                    WHERE enumlabel = $1
                    AND enumtypid = (
                        SELECT oid FROM pg_type WHERE typname = $2
                    )
                ) AS exists
            `, [value, enumType]);
            
            const exists = result.rows[0]?.exists || false;
            
            return {
                passed: exists,
                description: exists
                    ? `Enum value ${enumType}.${value} exists`
                    : `Enum value ${enumType}.${value} does not exist`
            };
        } catch (error) {
            throw new Error(`Error checking enum value ${enumType}.${value}: ${error.message}`);
        }
    }

    /**
     * Check if a table exists
     * @param {string} table - Table name
     * @returns {Promise<{passed: boolean, description: string}>}
     */
    async checkTableExists(table) {
        try {
            const result = await db.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables
                    WHERE table_schema = 'public'
                    AND table_name = $1
                ) AS exists
            `, [table]);
            
            const exists = result.rows[0]?.exists || false;
            
            return {
                passed: exists,
                description: exists
                    ? `Table ${table} exists`
                    : `Table ${table} does not exist`
            };
        } catch (error) {
            throw new Error(`Error checking table ${table}: ${error.message}`);
        }
    }

    /**
     * Verify migration was applied successfully
     * @returns {Promise<{ipfs_cid: boolean, enum_values: {hpg_clearance: boolean, csr: boolean, sales_invoice: boolean}}>}
     */
    async verifyMigrations() {
        const [ipfsCidResult, hpgClearanceResult, csrResult, salesInvoiceResult] = await Promise.all([
            this.checkColumnExists('documents', 'ipfs_cid'),
            this.checkEnumValueExists('document_type', 'hpg_clearance'),
            this.checkEnumValueExists('document_type', 'csr'),
            this.checkEnumValueExists('document_type', 'sales_invoice')
        ]);

        return {
            ipfs_cid: ipfsCidResult.passed,
            enum_values: {
                hpg_clearance: hpgClearanceResult.passed,
                csr: csrResult.passed,
                sales_invoice: salesInvoiceResult.passed
            }
        };
    }
}

module.exports = new SchemaValidationService();
