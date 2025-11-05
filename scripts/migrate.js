// TrustChain LTO - Database Migration Script
// Runs database migrations for production setup

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigrations() {
    let pool;
    
    try {
        console.log('🔄 Starting database migrations...');

        // Create database connection
        pool = new Pool({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            database: process.env.DB_NAME || 'lto_blockchain',
            user: process.env.DB_USER || 'lto_user',
            password: process.env.DB_PASSWORD || 'lto_password',
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });

        // Test connection
        const client = await pool.connect();
        console.log('✅ Database connection established');

        // Run initialization script
        const initScriptPath = path.join(__dirname, '../database/init.sql');
        if (fs.existsSync(initScriptPath)) {
            console.log('📊 Running database initialization...');
            const initScript = fs.readFileSync(initScriptPath, 'utf8');
            await client.query(initScript);
            console.log('✅ Database initialization completed');
        }

        // Create migrations table if it doesn't exist
        await client.query(`
            CREATE TABLE IF NOT EXISTS migrations (
                id SERIAL PRIMARY KEY,
                version VARCHAR(50) UNIQUE NOT NULL,
                description TEXT,
                executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Get executed migrations
        const executedMigrations = await client.query('SELECT version FROM migrations ORDER BY id');
        const executedVersions = executedMigrations.rows.map(row => row.version);

        // Define migrations
        const migrations = [
            {
                version: '001',
                description: 'Create users table',
                sql: `
                    CREATE TABLE IF NOT EXISTS users (
                        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                        email VARCHAR(255) UNIQUE NOT NULL,
                        password_hash VARCHAR(255) NOT NULL,
                        first_name VARCHAR(100) NOT NULL,
                        last_name VARCHAR(100) NOT NULL,
                        phone VARCHAR(20),
                        address TEXT,
                        id_type VARCHAR(50),
                        id_number VARCHAR(100),
                        date_of_birth DATE,
                        nationality VARCHAR(50),
                        role VARCHAR(50) NOT NULL DEFAULT 'VEHICLE_OWNER',
                        status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
                        two_factor_enabled BOOLEAN DEFAULT FALSE,
                        two_factor_secret VARCHAR(255),
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                `
            },
            {
                version: '002',
                description: 'Create vehicles table',
                sql: `
                    CREATE TABLE IF NOT EXISTS vehicles (
                        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                        vin VARCHAR(17) UNIQUE NOT NULL,
                        plate_number VARCHAR(20) UNIQUE,
                        make VARCHAR(50) NOT NULL,
                        model VARCHAR(50) NOT NULL,
                        year INTEGER NOT NULL,
                        color VARCHAR(30),
                        engine_number VARCHAR(100),
                        chassis_number VARCHAR(100),
                        vehicle_type VARCHAR(50) NOT NULL,
                        fuel_type VARCHAR(30),
                        transmission VARCHAR(30),
                        engine_displacement VARCHAR(20),
                        owner_id UUID REFERENCES users(id),
                        status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
                        verification_status JSONB DEFAULT '{}',
                        documents JSONB DEFAULT '{}',
                        notes JSONB DEFAULT '{}',
                        registration_date TIMESTAMP,
                        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        priority VARCHAR(20) DEFAULT 'MEDIUM',
                        history JSONB DEFAULT '[]',
                        blockchain_tx_id VARCHAR(255),
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                `
            },
            {
                version: '003',
                description: 'Create documents table',
                sql: `
                    CREATE TABLE IF NOT EXISTS documents (
                        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                        filename VARCHAR(255) NOT NULL,
                        original_name VARCHAR(255) NOT NULL,
                        mime_type VARCHAR(100),
                        size BIGINT,
                        cid VARCHAR(255) UNIQUE NOT NULL,
                        url TEXT,
                        type VARCHAR(50),
                        document_type VARCHAR(50),
                        uploaded_by UUID REFERENCES users(id),
                        vehicle_id UUID REFERENCES vehicles(id),
                        status VARCHAR(20) DEFAULT 'PENDING',
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                `
            },
            {
                version: '004',
                description: 'Create transactions table',
                sql: `
                    CREATE TABLE IF NOT EXISTS transactions (
                        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                        transaction_id VARCHAR(255) UNIQUE NOT NULL,
                        type VARCHAR(50) NOT NULL,
                        vin VARCHAR(17),
                        plate_number VARCHAR(20),
                        owner_id UUID REFERENCES users(id),
                        vehicle_id UUID REFERENCES vehicles(id),
                        status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
                        block_number INTEGER,
                        block_hash VARCHAR(255),
                        transaction_hash VARCHAR(255),
                        gas_used BIGINT,
                        gas_price VARCHAR(50),
                        from_address VARCHAR(255),
                        to_address VARCHAR(255),
                        value VARCHAR(50),
                        input_data JSONB,
                        receipt JSONB,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                `
            },
            {
                version: '005',
                description: 'Create notifications table',
                sql: `
                    CREATE TABLE IF NOT EXISTS notifications (
                        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                        user_id UUID REFERENCES users(id),
                        type VARCHAR(50) NOT NULL,
                        title VARCHAR(255) NOT NULL,
                        message TEXT NOT NULL,
                        status VARCHAR(20) DEFAULT 'UNREAD',
                        sent_via JSONB DEFAULT '[]',
                        metadata JSONB DEFAULT '{}',
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        read_at TIMESTAMP
                    );
                `
            },
            {
                version: '006',
                description: 'Create audit_logs table',
                sql: `
                    CREATE TABLE IF NOT EXISTS audit_logs (
                        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                        user_id UUID REFERENCES users(id),
                        action VARCHAR(100) NOT NULL,
                        resource_type VARCHAR(50),
                        resource_id VARCHAR(255),
                        details JSONB DEFAULT '{}',
                        ip_address INET,
                        user_agent TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                `
            },
            {
                version: '007',
                description: 'Create indexes',
                sql: `
                    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
                    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
                    CREATE INDEX IF NOT EXISTS idx_vehicles_vin ON vehicles(vin);
                    CREATE INDEX IF NOT EXISTS idx_vehicles_plate_number ON vehicles(plate_number);
                    CREATE INDEX IF NOT EXISTS idx_vehicles_owner_id ON vehicles(owner_id);
                    CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status);
                    CREATE INDEX IF NOT EXISTS idx_documents_cid ON documents(cid);
                    CREATE INDEX IF NOT EXISTS idx_documents_vehicle_id ON documents(vehicle_id);
                    CREATE INDEX IF NOT EXISTS idx_transactions_transaction_id ON transactions(transaction_id);
                    CREATE INDEX IF NOT EXISTS idx_transactions_vin ON transactions(vin);
                    CREATE INDEX IF NOT EXISTS idx_transactions_owner_id ON transactions(owner_id);
                    CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
                    CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
                    CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
                `
            },
            {
                version: '008',
                description: 'Insert default users',
                sql: `
                    INSERT INTO users (email, password_hash, first_name, last_name, role, status) 
                    VALUES (
                        'admin@lto.gov.ph',
                        '\$2a\$12\$0V4iR1vog9LRKdCxgKYQM.sH7QZWP2yMsu5i.80xLfH/imgycOGrG',
                        'System',
                        'Administrator',
                        'ADMIN',
                        'ACTIVE'
                    ) ON CONFLICT (email) DO NOTHING;

                    INSERT INTO users (email, password_hash, first_name, last_name, role, status) 
                    VALUES (
                        'staff@lto.gov.ph',
                        '\$2a\$12\$0V4iR1vog9LRKdCxgKYQM.sH7QZWP2yMsu5i.80xLfH/imgycOGrG',
                        'LTO',
                        'Staff',
                        'LTO_STAFF',
                        'ACTIVE'
                    ) ON CONFLICT (email) DO NOTHING;

                    INSERT INTO users (email, password_hash, first_name, last_name, role, status) 
                    VALUES (
                        'insurance@lto.gov.ph',
                        '\$2a\$12\$0V4iR1vog9LRKdCxgKYQM.sH7QZWP2yMsu5i.80xLfH/imgycOGrG',
                        'Insurance',
                        'Verifier',
                        'INSURANCE_VERIFIER',
                        'ACTIVE'
                    ) ON CONFLICT (email) DO NOTHING;

                    INSERT INTO users (email, password_hash, first_name, last_name, role, status) 
                    VALUES (
                        'emission@lto.gov.ph',
                        '\$2a\$12\$0V4iR1vog9LRKdCxgKYQM.sH7QZWP2yMsu5i.80xLfH/imgycOGrG',
                        'Emission',
                        'Verifier',
                        'EMISSION_VERIFIER',
                        'ACTIVE'
                    ) ON CONFLICT (email) DO NOTHING;

                    INSERT INTO users (email, password_hash, first_name, last_name, role, status) 
                    VALUES (
                        'owner@example.com',
                        '\$2a\$12\$0V4iR1vog9LRKdCxgKYQM.sH7QZWP2yMsu5i.80xLfH/imgycOGrG',
                        'John',
                        'Doe',
                        'VEHICLE_OWNER',
                        'ACTIVE'
                    ) ON CONFLICT (email) DO NOTHING;
                `
            }
        ];

        // Run pending migrations
        for (const migration of migrations) {
            if (!executedVersions.includes(migration.version)) {
                console.log(`🔄 Running migration ${migration.version}: ${migration.description}`);
                
                try {
                    await client.query('BEGIN');
                    await client.query(migration.sql);
                    await client.query(
                        'INSERT INTO migrations (version, description) VALUES ($1, $2)',
                        [migration.version, migration.description]
                    );
                    await client.query('COMMIT');
                    
                    console.log(`✅ Migration ${migration.version} completed`);
                } catch (error) {
                    await client.query('ROLLBACK');
                    console.error(`❌ Migration ${migration.version} failed:`, error.message);
                    throw error;
                }
            } else {
                console.log(`⏭️ Migration ${migration.version} already executed`);
            }
        }

        console.log('🎉 All migrations completed successfully!');

        // Verify database structure
        console.log('🔍 Verifying database structure...');
        const tables = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name
        `);
        
        console.log('📊 Database tables:', tables.rows.map(row => row.table_name).join(', '));

        // Check user count
        const userCount = await client.query('SELECT COUNT(*) as count FROM users');
        console.log(`👥 Total users: ${userCount.rows[0].count}`);

        client.release();

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        if (pool) {
            await pool.end();
        }
    }
}

// Run migrations
if (require.main === module) {
    runMigrations();
}

module.exports = { runMigrations };
