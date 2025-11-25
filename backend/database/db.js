// TrustChain LTO - PostgreSQL Database Connection
// Manages database connection pool and provides query helpers

const { Pool } = require('pg');
require('dotenv').config();

// Database configuration from environment variables
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'lto_blockchain',
    user: process.env.DB_USER || 'lto_user',
    password: process.env.DB_PASSWORD || 'lto_password',
    // Connection pool settings
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
    connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection cannot be established
};

// Create connection pool
const pool = new Pool(dbConfig);

// Handle pool errors
pool.on('error', (err, client) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

// Test database connection
async function testConnection() {
    try {
        const result = await pool.query('SELECT NOW()');
        console.log('✅ PostgreSQL connection successful');
        console.log(`📅 Database time: ${result.rows[0].now}`);
        return true;
    } catch (error) {
        // Only log error in development mode or if explicitly requested
        if (process.env.NODE_ENV === 'development' && process.env.VERBOSE_DB_ERRORS === 'true') {
            console.error('❌ PostgreSQL connection failed:', error.message);
        }
        return false;
    }
}

// Query helper - executes a query and returns results
async function query(text, params) {
    const start = Date.now();
    try {
        const result = await pool.query(text, params);
        const duration = Date.now() - start;
        if (process.env.NODE_ENV === 'development') {
            console.log('Executed query', { text, duration, rows: result.rowCount });
        }
        return result;
    } catch (error) {
        console.error('Database query error:', error);
        throw error;
    }
}

// Transaction helper - executes multiple queries in a transaction
async function transaction(callback) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

// Get a client from the pool (for manual transaction control)
async function getClient() {
    return await pool.connect();
}

// Close all connections (for graceful shutdown)
async function close() {
    await pool.end();
    console.log('✅ Database connection pool closed');
}

// Initialize database connection on module load (silent, non-blocking)
if (require.main !== module) {
    // Only test connection if not running as main script
    // Run silently in background - don't block startup
    testConnection().catch(() => {
        // Silently fail - connection will be tested when actually needed
        // This prevents startup errors when database isn't immediately available
    });
}

module.exports = {
    pool,
    query,
    transaction,
    getClient,
    testConnection,
    close
};

