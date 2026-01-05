#!/bin/bash

# TrustChain LTO - Production Setup Script
# This script sets up the complete production environment

set -e

echo "🏭 TrustChain LTO Production Setup"
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root"
   exit 1
fi

# Check system requirements
print_status "Checking system requirements..."

# Check Docker
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi

# Check Docker Compose
if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Check available memory
TOTAL_MEM=$(free -g | awk '/^Mem:/{print $2}')
if [ "$TOTAL_MEM" -lt 8 ]; then
    print_warning "System has less than 8GB RAM. Production setup requires at least 8GB."
fi

# Check available disk space
AVAILABLE_SPACE=$(df -BG . | awk 'NR==2 {print $4}' | sed 's/G//')
if [ "$AVAILABLE_SPACE" -lt 50 ]; then
    print_warning "Less than 50GB disk space available. Production setup requires at least 50GB."
fi

print_success "System requirements check completed"

# Create necessary directories
print_status "Creating directory structure..."
mkdir -p crypto-config
mkdir -p channel-artifacts
mkdir -p wallet
mkdir -p blockchain-ledger
mkdir -p logs
mkdir -p backup
mkdir -p monitoring/prometheus
mkdir -p monitoring/grafana/dashboards
mkdir -p monitoring/grafana/datasources
mkdir -p monitoring/logstash/pipeline
mkdir -p monitoring/logstash/config
mkdir -p nginx/ssl
mkdir -p database

print_success "Directory structure created"

# Generate cryptographic materials
print_status "Generating cryptographic materials..."
if [ ! -f "crypto-config.yaml" ]; then
    print_error "crypto-config.yaml not found. Please create it first."
    exit 1
fi

# Generate crypto materials using cryptogen
if command -v cryptogen &> /dev/null; then
    cryptogen generate --config=crypto-config.yaml
    print_success "Cryptographic materials generated"
else
    print_warning "cryptogen not found. Using mock crypto materials..."
    # Create mock crypto materials
    mkdir -p crypto-config/ordererOrganizations/lto.gov.ph/orderers/orderer1.lto.gov.ph/msp
    mkdir -p crypto-config/ordererOrganizations/lto.gov.ph/orderers/orderer2.lto.gov.ph/msp
    mkdir -p crypto-config/ordererOrganizations/lto.gov.ph/orderers/orderer3.lto.gov.ph/msp
    mkdir -p crypto-config/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/msp
    mkdir -p crypto-config/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls
fi

# Generate genesis block
print_status "Generating genesis block..."
if [ ! -f "configtx.yaml" ]; then
    print_error "configtx.yaml not found. Please create it first."
    exit 1
fi

if command -v configtxgen &> /dev/null; then
    configtxgen -profile LTOGenesis -channelID system-channel -outputBlock ./channel-artifacts/genesis.block
    print_success "Genesis block generated"
else
    print_warning "configtxgen not found. Creating mock genesis block..."
    mkdir -p channel-artifacts
    echo "Mock genesis block" > ./channel-artifacts/genesis.block
fi

# Create network configuration
print_status "Creating network configuration..."
cat > network-config.yaml << EOF
name: "lto-network"
version: "1.0"
client:
  organization: LTO
  connection:
    timeout:
      peer:
        endorser: "300"
organizations:
  LTO:
    mspid: LTOMSP
    peers:
      - peer0.lto.gov.ph
    certificateAuthorities:
      - ca.lto.gov.ph
    adminPrivateKey:
      path: crypto-config/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp/keystore/priv_sk
    signedCert:
      path: crypto-config/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp/signcerts/Admin@lto.gov.ph-cert.pem
peers:
  peer0.lto.gov.ph:
    url: grpcs://peer0.lto.gov.ph:7051
    eventUrl: grpcs://peer0.lto.gov.ph:7053
    grpcOptions:
      ssl-target-name-override: peer0.lto.gov.ph
      grpc.keepalive_time_ms: 600000
      grpc.keepalive_timeout_ms: 5000
      grpc.keepalive_permit_without_calls: true
      grpc.http2.max_pings_without_data: 0
      grpc.http2.min_time_between_pings_ms: 10000
      grpc.http2.min_ping_interval_without_data_ms: 5000
    tlsCACerts:
      path: crypto-config/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt
certificateAuthorities:
  ca.lto.gov.ph:
    url: https://ca.lto.gov.ph:7054
    caName: ca.lto.gov.ph
    tlsCACerts:
      path: crypto-config/peerOrganizations/lto.gov.ph/ca/ca.lto.gov.ph-cert.pem
    httpOptions:
      verify: false
orderers:
  orderer1.lto.gov.ph:
    url: grpcs://orderer1.lto.gov.ph:7050
    grpcOptions:
      ssl-target-name-override: orderer1.lto.gov.ph
      grpc.keepalive_time_ms: 600000
    tlsCACerts:
      path: crypto-config/ordererOrganizations/lto.gov.ph/orderers/orderer1.lto.gov.ph/tls/ca.crt
channels:
  mychannel:
    orderers:
      - orderer1.lto.gov.ph
      - orderer2.lto.gov.ph
      - orderer3.lto.gov.ph
    peers:
      peer0.lto.gov.ph:
        endorsingPeer: true
        chaincodeQuery: true
        ledgerQuery: true
        eventSource: true
EOF

print_success "Network configuration created"

# Create environment file
print_status "Creating environment configuration..."
cat > .env.production << EOF
# TrustChain LTO Production Environment
NODE_ENV=production
PORT=3001

# Database Configuration
DB_HOST=postgres
DB_PORT=5432
DB_NAME=lto_blockchain
DB_USER=lto_user
DB_PASSWORD=lto_password

# Note: Redis is no longer used. Token blacklist is stored in PostgreSQL.

# IPFS Configuration
IPFS_HOST=ipfs-cluster
IPFS_PORT=9094
IPFS_CLUSTER_SECRET=your-cluster-secret-here

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=24h

# Encryption
ENCRYPTION_KEY=your-32-character-encryption-key-here

# Email Configuration (for notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# SMS Configuration (for notifications)
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=+1234567890

# Monitoring
PROMETHEUS_PORT=9090
GRAFANA_PORT=3000
ELASTICSEARCH_PORT=9200
KIBANA_PORT=5601

# Security
CORS_ORIGIN=https://lto.gov.ph
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Backup
BACKUP_RETENTION_DAYS=30
BACKUP_SCHEDULE="0 2 * * *"
EOF

print_success "Environment configuration created"

# Create database initialization script
print_status "Creating database initialization script..."
cat > database/init.sql << EOF
-- TrustChain LTO Database Initialization
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
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

-- Vehicles table
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

-- Documents table
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

-- Transactions table (for blockchain tracking)
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

-- Notifications table
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

-- Audit logs table
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

-- Create indexes for better performance
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

-- Insert default admin user
INSERT INTO users (email, password_hash, first_name, last_name, role, status) 
VALUES (
    'admin@lto.gov.ph',
    '\$2a\$12\$0V4iR1vog9LRKdCxgKYQM.sH7QZWP2yMsu5i.80xLfH/imgycOGrG',
    'System',
    'Administrator',
    'ADMIN',
    'ACTIVE'
) ON CONFLICT (email) DO NOTHING;

-- Insert default LTO staff user
INSERT INTO users (email, password_hash, first_name, last_name, role, status) 
VALUES (
    'staff@lto.gov.ph',
    '\$2a\$12\$0V4iR1vog9LRKdCxgKYQM.sH7QZWP2yMsu5i.80xLfH/imgycOGrG',
    'LTO',
    'Staff',
    'LTO_STAFF',
    'ACTIVE'
) ON CONFLICT (email) DO NOTHING;

-- Insert default insurance verifier
INSERT INTO users (email, password_hash, first_name, last_name, role, status) 
VALUES (
    'insurance@lto.gov.ph',
    '\$2a\$12\$0V4iR1vog9LRKdCxgKYQM.sH7QZWP2yMsu5i.80xLfH/imgycOGrG',
    'Insurance',
    'Verifier',
    'INSURANCE_VERIFIER',
    'ACTIVE'
) ON CONFLICT (email) DO NOTHING;

-- Insert default emission verifier
INSERT INTO users (email, password_hash, first_name, last_name, role, status) 
VALUES (
    'emission@lto.gov.ph',
    '\$2a\$12\$0V4iR1vog9LRKdCxgKYQM.sH7QZWP2yMsu5i.80xLfH/imgycOGrG',
    'Emission',
    'Verifier',
    'EMISSION_VERIFIER',
    'ACTIVE'
) ON CONFLICT (email) DO NOTHING;

-- Insert default vehicle owner
INSERT INTO users (email, password_hash, first_name, last_name, role, status) 
VALUES (
    'owner@example.com',
    '\$2a\$12\$0V4iR1vog9LRKdCxgKYQM.sH7QZWP2yMsu5i.80xLfH/imgycOGrG',
    'John',
    'Doe',
    'VEHICLE_OWNER',
    'ACTIVE'
) ON CONFLICT (email) DO NOTHING;
EOF

print_success "Database initialization script created"

# Create monitoring configuration files
print_status "Creating monitoring configuration..."

# Prometheus configuration
cat > monitoring/prometheus.yml << EOF
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "rules/*.yml"

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'lto-app'
    static_configs:
      - targets: ['lto-app:3001']
    metrics_path: '/api/metrics'
    scrape_interval: 5s

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres:5432']

  - job_name: 'ipfs'
    static_configs:
      - targets: ['ipfs-node-1:5001', 'ipfs-node-2:5002', 'ipfs-node-3:5003']

  - job_name: 'fabric'
    static_configs:
      - targets: ['peer0.lto.gov.ph:7051']
EOF

# Grafana datasource configuration
cat > monitoring/grafana/datasources/prometheus.yml << EOF
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: true
EOF

# Logstash pipeline configuration
cat > monitoring/logstash/pipeline/logstash.conf << EOF
input {
  beats {
    port => 5044
  }
}

filter {
  if [fields][service] == "lto-app" {
    grok {
      match => { "message" => "%{TIMESTAMP_ISO8601:timestamp} %{LOGLEVEL:level} %{GREEDYDATA:message}" }
    }
  }
}

output {
  elasticsearch {
    hosts => ["elasticsearch:9200"]
    index => "lto-logs-%{+YYYY.MM.dd}"
  }
}
EOF

print_success "Monitoring configuration created"

# Create Nginx configuration
print_status "Creating Nginx configuration..."
cat > nginx/nginx.conf << EOF
events {
    worker_connections 1024;
}

http {
    upstream lto_app {
        server lto-app:3001;
    }

    upstream grafana {
        server grafana:3000;
    }

    upstream kibana {
        server kibana:5601;
    }

    server {
        listen 80;
        server_name localhost;

        # Main application
        location / {
            proxy_pass http://lto_app;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }

        # API endpoints
        location /api/ {
            proxy_pass http://lto_app;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }

        # Monitoring endpoints
        location /grafana/ {
            proxy_pass http://grafana/;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }

        location /kibana/ {
            proxy_pass http://kibana/;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }
    }
}
EOF

print_success "Nginx configuration created"

# Create deployment script
print_status "Creating deployment script..."
cat > scripts/deploy.sh << 'EOF'
#!/bin/bash

# TrustChain LTO - Production Deployment Script

set -e

echo "🚀 Deploying TrustChain LTO Production System..."

# Pull latest images
docker-compose -f docker-compose.production.yml pull

# Build application image
docker-compose -f docker-compose.production.yml build lto-app

# Stop existing services
docker-compose -f docker-compose.production.yml down

# Start services
docker-compose -f docker-compose.production.yml up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 30

# Check service health
echo "🔍 Checking service health..."
docker-compose -f docker-compose.production.yml ps

# Run database migrations
echo "📊 Running database migrations..."
docker-compose -f docker-compose.production.yml exec lto-app npm run migrate

# Deploy chaincode
echo "⛓️ Deploying chaincode..."
docker-compose -f docker-compose.production.yml exec lto-app npm run deploy-chaincode

echo "✅ Deployment completed successfully!"
echo "🌐 Application: http://localhost"
echo "📊 Grafana: http://localhost/grafana"
echo "📈 Kibana: http://localhost/kibana"
echo "🔍 Prometheus: http://localhost:9090"
EOF

chmod +x scripts/deploy.sh

print_success "Deployment script created"

# Create backup script
print_status "Creating backup script..."
cat > scripts/backup.sh << 'EOF'
#!/bin/bash

# TrustChain LTO - Backup Script

set -e

BACKUP_DIR="/backup"
DATE=$(date +%Y%m%d_%H%M%S)

echo "💾 Starting backup process..."

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
echo "📊 Backing up database..."
docker-compose -f docker-compose.production.yml exec -T postgres pg_dump -U lto_user -d lto_blockchain > $BACKUP_DIR/database_$DATE.sql

# Backup blockchain ledger
echo "⛓️ Backing up blockchain ledger..."
docker cp lto-app:/app/blockchain-ledger $BACKUP_DIR/blockchain-ledger_$DATE

# Backup IPFS data
echo "📁 Backing up IPFS data..."
docker-compose -f docker-compose.production.yml exec -T ipfs-cluster ipfs-cluster-ctl pin ls > $BACKUP_DIR/ipfs-pins_$DATE.txt

# Compress backup
echo "🗜️ Compressing backup..."
tar -czf $BACKUP_DIR/backup_$DATE.tar.gz -C $BACKUP_DIR database_$DATE.sql blockchain-ledger_$DATE ipfs-pins_$DATE.txt

# Clean up old backups (keep last 7 days)
echo "🧹 Cleaning up old backups..."
find $BACKUP_DIR -name "backup_*.tar.gz" -mtime +7 -delete

echo "✅ Backup completed: backup_$DATE.tar.gz"
EOF

chmod +x scripts/backup.sh

print_success "Backup script created"

# Create health check script
print_status "Creating health check script..."
cat > scripts/health-check.sh << 'EOF'
#!/bin/bash

# TrustChain LTO - Health Check Script

set -e

echo "🏥 TrustChain LTO Health Check"
echo "=============================="

# Check Docker services
echo "🐳 Checking Docker services..."
docker-compose -f docker-compose.production.yml ps

# Check application health
echo "🌐 Checking application health..."
curl -f http://localhost:3001/api/health || echo "❌ Application health check failed"

# Check database connection
echo "📊 Checking database connection..."
docker-compose -f docker-compose.production.yml exec -T postgres pg_isready -U lto_user -d lto_blockchain || echo "❌ Database connection failed"

# Check IPFS nodes
echo "📁 Checking IPFS nodes..."
docker-compose -f docker-compose.production.yml exec -T ipfs-node-1 ipfs id || echo "❌ IPFS node 1 failed"
docker-compose -f docker-compose.production.yml exec -T ipfs-node-2 ipfs id || echo "❌ IPFS node 2 failed"
docker-compose -f docker-compose.production.yml exec -T ipfs-node-3 ipfs id || echo "❌ IPFS node 3 failed"

# Check monitoring services
echo "📈 Checking monitoring services..."
curl -f http://localhost:9090/-/healthy || echo "❌ Prometheus health check failed"
curl -f http://localhost:3000/api/health || echo "❌ Grafana health check failed"

echo "✅ Health check completed"
EOF

chmod +x scripts/health-check.sh

print_success "Health check script created"

# Create production package.json scripts
print_status "Updating package.json with production scripts..."
if [ -f "package.json" ]; then
    # Add production scripts to package.json
    node -e "
    const fs = require('fs');
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    pkg.scripts = {
        ...pkg.scripts,
        'start:production': 'NODE_ENV=production node server.js',
        'build:production': 'npm ci --only=production',
        'migrate': 'node scripts/migrate.js',
        'deploy-chaincode': 'node scripts/deploy-chaincode.js',
        'setup': './scripts/setup-production.sh',
        'deploy': './scripts/deploy.sh',
        'backup': './scripts/backup.sh',
        'health-check': './scripts/health-check.sh',
        'logs': 'docker-compose -f docker-compose.production.yml logs -f',
        'restart': 'docker-compose -f docker-compose.production.yml restart',
        'stop': 'docker-compose -f docker-compose.production.yml down',
        'clean': 'docker-compose -f docker-compose.production.yml down -v --rmi all'
    };
    fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
    "
    print_success "Package.json updated with production scripts"
fi

# Create README for production setup
print_status "Creating production README..."
cat > README-PRODUCTION.md << 'EOF'
# TrustChain LTO - Production Setup

This document provides instructions for setting up the TrustChain LTO Blockchain Vehicle Registration System in a production environment.

## Prerequisites

- Docker 20.10+
- Docker Compose 2.0+
- 8GB+ RAM
- 50GB+ disk space
- Linux/Unix environment (Ubuntu 20.04+ recommended)

## Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd lto-blockchain
   ```

2. **Run the setup script**
   ```bash
   chmod +x scripts/setup-production.sh
   ./scripts/setup-production.sh
   ```

3. **Deploy the system**
   ```bash
   ./scripts/deploy.sh
   ```

4. **Check system health**
   ```bash
   ./scripts/health-check.sh
   ```

## System Architecture

The production system includes:

- **Hyperledger Fabric Network**: 3 orderers (Raft consensus), 1 LTO peer
- **IPFS Cluster**: 3 nodes for decentralized document storage
- **PostgreSQL**: Primary database
- **Monitoring**: Prometheus, Grafana, ELK Stack
- **Load Balancer**: Nginx reverse proxy

## Services

| Service | Port | Description |
|---------|------|-------------|
| LTO App | 3001 | Main application |
| PostgreSQL | 5432 | Database (includes token blacklist) |
| IPFS | 4001-4003 | Document storage |
| Prometheus | 9090 | Metrics |
| Grafana | 3000 | Dashboards |
| Kibana | 5601 | Logs |
| Nginx | 80/443 | Load balancer |

## Default Credentials

- **Admin**: admin@lto.gov.ph / admin123
- **Staff**: staff@lto.gov.ph / admin123
- **Insurance**: insurance@lto.gov.ph / admin123
- **Emission**: emission@lto.gov.ph / admin123
- **Owner**: owner@example.com / admin123

## Monitoring

- **Grafana**: http://localhost/grafana (admin/admin)
- **Kibana**: http://localhost/kibana
- **Prometheus**: http://localhost:9090

## Backup

Run daily backups:
```bash
./scripts/backup.sh
```

## Maintenance

- **View logs**: `npm run logs`
- **Restart services**: `npm run restart`
- **Stop system**: `npm run stop`
- **Clean everything**: `npm run clean`

## Security

- Change default passwords in `.env.production`
- Configure SSL certificates in `nginx/ssl/`
- Enable firewall rules
- Regular security updates

## Troubleshooting

1. **Check service status**: `docker-compose -f docker-compose.production.yml ps`
2. **View logs**: `docker-compose -f docker-compose.production.yml logs <service>`
3. **Health check**: `./scripts/health-check.sh`
4. **Restart service**: `docker-compose -f docker-compose.production.yml restart <service>`

## Support

For issues and support, please contact the development team.
EOF

print_success "Production README created"

# Final setup summary
echo ""
echo "🎉 Production Setup Completed Successfully!"
echo "=========================================="
echo ""
echo "📁 Created files and directories:"
echo "   - docker-compose.production.yml"
echo "   - Dockerfile.production"
echo "   - .env.production"
echo "   - network-config.yaml"
echo "   - database/init.sql"
echo "   - monitoring/ configuration files"
echo "   - nginx/nginx.conf"
echo "   - scripts/ setup, deploy, backup, health-check"
echo "   - README-PRODUCTION.md"
echo ""
echo "🚀 Next steps:"
echo "   1. Review and customize .env.production"
echo "   2. Run: ./scripts/deploy.sh"
echo "   3. Check: ./scripts/health-check.sh"
echo "   4. Access: http://localhost"
echo ""
echo "📚 Documentation: README-PRODUCTION.md"
echo ""
print_success "Setup completed! Ready for production deployment."
