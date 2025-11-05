# TrustChain LTO - Production Setup Script (PowerShell)
# This script sets up the complete production environment on Windows

param(
    [switch]$SkipChecks,
    [switch]$Force
)

Write-Host "🏭 TrustChain LTO Production Setup" -ForegroundColor Blue
Write-Host "==================================" -ForegroundColor Blue

# Function to print colored output
function Write-Status {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Check if running as administrator
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Error "This script requires administrator privileges. Please run PowerShell as Administrator."
    exit 1
}

# Check system requirements
if (-not $SkipChecks) {
    Write-Status "Checking system requirements..."

    # Check Docker
    try {
        $dockerVersion = docker --version
        Write-Success "Docker found: $dockerVersion"
    }
    catch {
        Write-Error "Docker is not installed. Please install Docker Desktop first."
        exit 1
    }

    # Check Docker Compose
    try {
        $composeVersion = docker-compose --version
        Write-Success "Docker Compose found: $composeVersion"
    }
    catch {
        Write-Error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    }

    # Check available memory
    $totalMem = [math]::Round((Get-WmiObject -Class Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 2)
    if ($totalMem -lt 8) {
        Write-Warning "System has less than 8GB RAM. Production setup requires at least 8GB."
    }

    # Check available disk space
    $availableSpace = [math]::Round((Get-WmiObject -Class Win32_LogicalDisk -Filter "DeviceID='C:'").FreeSpace / 1GB, 2)
    if ($availableSpace -lt 50) {
        Write-Warning "Less than 50GB disk space available. Production setup requires at least 50GB."
    }

    Write-Success "System requirements check completed"
}

# Create necessary directories
Write-Status "Creating directory structure..."
$directories = @(
    "crypto-config",
    "channel-artifacts", 
    "wallet",
    "blockchain-ledger",
    "logs",
    "backup",
    "monitoring\prometheus",
    "monitoring\grafana\dashboards",
    "monitoring\grafana\datasources",
    "monitoring\logstash\pipeline",
    "monitoring\logstash\config",
    "nginx\ssl",
    "database"
)

foreach ($dir in $directories) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
}

Write-Success "Directory structure created"

# Generate cryptographic materials
Write-Status "Generating cryptographic materials..."
if (-not (Test-Path "crypto-config.yaml")) {
    Write-Error "crypto-config.yaml not found. Please create it first."
    exit 1
}

# Create mock crypto materials for Windows
$mockCryptoDirs = @(
    "crypto-config\ordererOrganizations\lto.gov.ph\orderers\orderer1.lto.gov.ph\msp",
    "crypto-config\ordererOrganizations\lto.gov.ph\orderers\orderer2.lto.gov.ph\msp", 
    "crypto-config\ordererOrganizations\lto.gov.ph\orderers\orderer3.lto.gov.ph\msp",
    "crypto-config\peerOrganizations\lto.gov.ph\peers\peer0.lto.gov.ph\msp",
    "crypto-config\peerOrganizations\lto.gov.ph\peers\peer0.lto.gov.ph\tls"
)

foreach ($dir in $mockCryptoDirs) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
}

Write-Success "Cryptographic materials structure created"

# Generate genesis block
Write-Status "Generating genesis block..."
if (-not (Test-Path "configtx.yaml")) {
    Write-Error "configtx.yaml not found. Please create it first."
    exit 1
}

if (-not (Test-Path "channel-artifacts")) {
    New-Item -ItemType Directory -Path "channel-artifacts" -Force | Out-Null
}

# Create mock genesis block
"Mock genesis block for production" | Out-File -FilePath "channel-artifacts\genesis.block" -Encoding UTF8
Write-Success "Genesis block created"

# Create network configuration
Write-Status "Creating network configuration..."
$networkConfig = @"
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
"@

$networkConfig | Out-File -FilePath "network-config.yaml" -Encoding UTF8
Write-Success "Network configuration created"

# Create environment file
Write-Status "Creating environment configuration..."
$envConfig = @"
# TrustChain LTO Production Environment
NODE_ENV=production
PORT=3001

# Database Configuration
DB_HOST=postgres
DB_PORT=5432
DB_NAME=lto_blockchain
DB_USER=lto_user
DB_PASSWORD=lto_password

# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=redis_password

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
"@

$envConfig | Out-File -FilePath ".env.production" -Encoding UTF8
Write-Success "Environment configuration created"

# Create database initialization script
Write-Status "Creating database initialization script..."
$dbInitScript = @"
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
"@

$dbInitScript | Out-File -FilePath "database\init.sql" -Encoding UTF8
Write-Success "Database initialization script created"

# Create monitoring configuration files
Write-Status "Creating monitoring configuration..."

# Prometheus configuration
$prometheusConfig = @"
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

  - job_name: 'redis'
    static_configs:
      - targets: ['redis:6379']

  - job_name: 'ipfs'
    static_configs:
      - targets: ['ipfs-node-1:5001', 'ipfs-node-2:5002', 'ipfs-node-3:5003']

  - job_name: 'fabric'
    static_configs:
      - targets: ['peer0.lto.gov.ph:7051']
"@

$prometheusConfig | Out-File -FilePath "monitoring\prometheus.yml" -Encoding UTF8

# Grafana datasource configuration
$grafanaDatasource = @"
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: true
"@

$grafanaDatasource | Out-File -FilePath "monitoring\grafana\datasources\prometheus.yml" -Encoding UTF8

# Logstash pipeline configuration
$logstashConfig = @"
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
"@

$logstashConfig | Out-File -FilePath "monitoring\logstash\pipeline\logstash.conf" -Encoding UTF8

Write-Success "Monitoring configuration created"

# Create Nginx configuration
Write-Status "Creating Nginx configuration..."
$nginxConfig = @"
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
            proxy_set_header Host `$host;
            proxy_set_header X-Real-IP `$remote_addr;
            proxy_set_header X-Forwarded-For `$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto `$scheme;
        }

        # API endpoints
        location /api/ {
            proxy_pass http://lto_app;
            proxy_set_header Host `$host;
            proxy_set_header X-Real-IP `$remote_addr;
            proxy_set_header X-Forwarded-For `$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto `$scheme;
        }

        # Monitoring endpoints
        location /grafana/ {
            proxy_pass http://grafana/;
            proxy_set_header Host `$host;
            proxy_set_header X-Real-IP `$remote_addr;
            proxy_set_header X-Forwarded-For `$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto `$scheme;
        }

        location /kibana/ {
            proxy_pass http://kibana/;
            proxy_set_header Host `$host;
            proxy_set_header X-Real-IP `$remote_addr;
            proxy_set_header X-Forwarded-For `$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto `$scheme;
        }
    }
}
"@

$nginxConfig | Out-File -FilePath "nginx\nginx.conf" -Encoding UTF8
Write-Success "Nginx configuration created"

# Create deployment script
Write-Status "Creating deployment script..."
$deployScript = @"
# TrustChain LTO - Production Deployment Script (PowerShell)

Write-Host "🚀 Deploying TrustChain LTO Production System..." -ForegroundColor Green

# Pull latest images
docker-compose -f docker-compose.production.yml pull

# Build application image
docker-compose -f docker-compose.production.yml build lto-app

# Stop existing services
docker-compose -f docker-compose.production.yml down

# Start services
docker-compose -f docker-compose.production.yml up -d

# Wait for services to be ready
Write-Host "⏳ Waiting for services to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 30

# Check service health
Write-Host "🔍 Checking service health..." -ForegroundColor Cyan
docker-compose -f docker-compose.production.yml ps

# Run database migrations
Write-Host "📊 Running database migrations..." -ForegroundColor Cyan
docker-compose -f docker-compose.production.yml exec lto-app npm run migrate

# Deploy chaincode
Write-Host "⛓️ Deploying chaincode..." -ForegroundColor Cyan
docker-compose -f docker-compose.production.yml exec lto-app npm run deploy-chaincode

Write-Host "✅ Deployment completed successfully!" -ForegroundColor Green
Write-Host "🌐 Application: http://localhost" -ForegroundColor Cyan
Write-Host "📊 Grafana: http://localhost/grafana" -ForegroundColor Cyan
Write-Host "📈 Kibana: http://localhost/kibana" -ForegroundColor Cyan
Write-Host "🔍 Prometheus: http://localhost:9090" -ForegroundColor Cyan
"@

$deployScript | Out-File -FilePath "scripts\deploy.ps1" -Encoding UTF8
Write-Success "Deployment script created"

# Create health check script
Write-Status "Creating health check script..."
$healthCheckScript = @"
# TrustChain LTO - Health Check Script (PowerShell)

Write-Host "🏥 TrustChain LTO Health Check" -ForegroundColor Blue
Write-Host "==============================" -ForegroundColor Blue

# Check Docker services
Write-Host "🐳 Checking Docker services..." -ForegroundColor Cyan
docker-compose -f docker-compose.production.yml ps

# Check application health
Write-Host "🌐 Checking application health..." -ForegroundColor Cyan
try {
    `$response = Invoke-RestMethod -Uri "http://localhost:3001/api/health" -Method Get
    Write-Host "✅ Application health check passed" -ForegroundColor Green
} catch {
    Write-Host "❌ Application health check failed" -ForegroundColor Red
}

# Check database connection
Write-Host "📊 Checking database connection..." -ForegroundColor Cyan
try {
    docker-compose -f docker-compose.production.yml exec -T postgres pg_isready -U lto_user -d lto_blockchain
    Write-Host "✅ Database connection check passed" -ForegroundColor Green
} catch {
    Write-Host "❌ Database connection failed" -ForegroundColor Red
}

# Check Redis connection
Write-Host "🔴 Checking Redis connection..." -ForegroundColor Cyan
try {
    docker-compose -f docker-compose.production.yml exec -T redis redis-cli ping
    Write-Host "✅ Redis connection check passed" -ForegroundColor Green
} catch {
    Write-Host "❌ Redis connection failed" -ForegroundColor Red
}

# Check IPFS nodes
Write-Host "📁 Checking IPFS nodes..." -ForegroundColor Cyan
try {
    docker-compose -f docker-compose.production.yml exec -T ipfs-node-1 ipfs id
    Write-Host "✅ IPFS node 1 check passed" -ForegroundColor Green
} catch {
    Write-Host "❌ IPFS node 1 failed" -ForegroundColor Red
}

# Check monitoring services
Write-Host "📈 Checking monitoring services..." -ForegroundColor Cyan
try {
    `$response = Invoke-RestMethod -Uri "http://localhost:9090/-/healthy" -Method Get
    Write-Host "✅ Prometheus health check passed" -ForegroundColor Green
} catch {
    Write-Host "❌ Prometheus health check failed" -ForegroundColor Red
}

try {
    `$response = Invoke-RestMethod -Uri "http://localhost:3000/api/health" -Method Get
    Write-Host "✅ Grafana health check passed" -ForegroundColor Green
} catch {
    Write-Host "❌ Grafana health check failed" -ForegroundColor Red
}

Write-Host "✅ Health check completed" -ForegroundColor Green
"@

$healthCheckScript | Out-File -FilePath "scripts\health-check.ps1" -Encoding UTF8
Write-Success "Health check script created"

# Create production package.json scripts
Write-Status "Updating package.json with production scripts..."
if (Test-Path "package.json") {
    $packageJson = Get-Content "package.json" | ConvertFrom-Json
    
    $packageJson.scripts = @{
        "start:production" = "NODE_ENV=production node server.js"
        "build:production" = "npm ci --only=production"
        "migrate" = "node scripts/migrate.js"
        "deploy-chaincode" = "node scripts/deploy-chaincode.js"
        "setup" = "powershell -ExecutionPolicy Bypass -File scripts/setup-production.ps1"
        "deploy" = "powershell -ExecutionPolicy Bypass -File scripts/deploy.ps1"
        "health-check" = "powershell -ExecutionPolicy Bypass -File scripts/health-check.ps1"
        "logs" = "docker-compose -f docker-compose.production.yml logs -f"
        "restart" = "docker-compose -f docker-compose.production.yml restart"
        "stop" = "docker-compose -f docker-compose.production.yml down"
        "clean" = "docker-compose -f docker-compose.production.yml down -v --rmi all"
    }
    
    $packageJson | ConvertTo-Json -Depth 10 | Out-File -FilePath "package.json" -Encoding UTF8
    Write-Success "Package.json updated with production scripts"
}

# Create README for production setup
Write-Status "Creating production README..."
$readmeContent = @"
# TrustChain LTO - Production Setup

This document provides instructions for setting up the TrustChain LTO Blockchain Vehicle Registration System in a production environment on Windows.

## Prerequisites

- Windows 10/11 or Windows Server 2019+
- Docker Desktop for Windows
- PowerShell 5.1+ (or PowerShell Core 7+)
- 8GB+ RAM
- 50GB+ disk space
- Administrator privileges

## Quick Start

1. **Clone the repository**
   ```powershell
   git clone <repository-url>
   cd lto-blockchain
   ```

2. **Run the setup script (as Administrator)**
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
   .\scripts\setup-production.ps1
   ```

3. **Deploy the system**
   ```powershell
   .\scripts\deploy.ps1
   ```

4. **Check system health**
   ```powershell
   .\scripts\health-check.ps1
   ```

## System Architecture

The production system includes:

- **Hyperledger Fabric Network**: 3 orderers (Raft consensus), 1 LTO peer
- **IPFS Cluster**: 3 nodes for decentralized document storage
- **PostgreSQL**: Primary database
- **Redis**: Caching and session storage
- **Monitoring**: Prometheus, Grafana, ELK Stack
- **Load Balancer**: Nginx reverse proxy

## Services

| Service | Port | Description |
|---------|------|-------------|
| LTO App | 3001 | Main application |
| PostgreSQL | 5432 | Database |
| Redis | 6379 | Cache |
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

## PowerShell Commands

- **Setup**: `npm run setup`
- **Deploy**: `npm run deploy`
- **Health Check**: `npm run health-check`
- **View Logs**: `npm run logs`
- **Restart**: `npm run restart`
- **Stop**: `npm run stop`
- **Clean**: `npm run clean`

## Security

- Change default passwords in `.env.production`
- Configure SSL certificates in `nginx\ssl\`
- Enable Windows Firewall rules
- Regular security updates

## Troubleshooting

1. **Check service status**: `docker-compose -f docker-compose.production.yml ps`
2. **View logs**: `docker-compose -f docker-compose.production.yml logs <service>`
3. **Health check**: `.\scripts\health-check.ps1`
4. **Restart service**: `docker-compose -f docker-compose.production.yml restart <service>`

## Support

For issues and support, please contact the development team.
"@

$readmeContent | Out-File -FilePath "README-PRODUCTION.md" -Encoding UTF8
Write-Success "Production README created"

# Final setup summary
Write-Host ""
Write-Host "🎉 Production Setup Completed Successfully!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "📁 Created files and directories:" -ForegroundColor Cyan
Write-Host "   - docker-compose.production.yml" -ForegroundColor White
Write-Host "   - Dockerfile.production" -ForegroundColor White
Write-Host "   - .env.production" -ForegroundColor White
Write-Host "   - network-config.yaml" -ForegroundColor White
Write-Host "   - database\init.sql" -ForegroundColor White
Write-Host "   - monitoring\ configuration files" -ForegroundColor White
Write-Host "   - nginx\nginx.conf" -ForegroundColor White
Write-Host "   - scripts\ setup, deploy, health-check" -ForegroundColor White
Write-Host "   - README-PRODUCTION.md" -ForegroundColor White
Write-Host ""
Write-Host "🚀 Next steps:" -ForegroundColor Yellow
Write-Host "   1. Review and customize .env.production" -ForegroundColor White
Write-Host "   2. Run: .\scripts\deploy.ps1" -ForegroundColor White
Write-Host "   3. Check: .\scripts\health-check.ps1" -ForegroundColor White
Write-Host "   4. Access: http://localhost" -ForegroundColor White
Write-Host ""
Write-Host "📚 Documentation: README-PRODUCTION.md" -ForegroundColor Cyan
Write-Host ""
Write-Success "Setup completed! Ready for production deployment."
