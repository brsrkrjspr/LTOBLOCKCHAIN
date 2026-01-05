# 🏭 TrustChain LTO - Production Setup Guide

This comprehensive guide will help you set up the TrustChain LTO Blockchain Vehicle Registration System in a production environment.

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [System Requirements](#system-requirements)
3. [Quick Start](#quick-start)
4. [Detailed Setup](#detailed-setup)
5. [Configuration](#configuration)
6. [Deployment](#deployment)
7. [Monitoring](#monitoring)
8. [Security](#security)
9. [Backup & Recovery](#backup--recovery)
10. [Troubleshooting](#troubleshooting)

## 🔧 Prerequisites

### Software Requirements
- **Operating System**: Ubuntu 20.04+ / Windows 10+ / macOS 10.15+
- **Docker**: 20.10+ with Docker Compose 2.0+
- **Node.js**: 18+ (for development)
- **Git**: Latest version
- **PowerShell**: 5.1+ (Windows) or PowerShell Core 7+ (Linux/macOS)

### Hardware Requirements
- **CPU**: 8+ cores (Intel/AMD x64)
- **RAM**: 16GB+ (32GB recommended)
- **Storage**: 100GB+ SSD (500GB recommended)
- **Network**: Stable internet connection

### Network Requirements
- **Ports**: 80, 443, 3001, 5432, 6379, 4001-4003, 5001-5003, 7050-7051, 8050, 9050, 9090, 9094-9096, 9200, 5601
- **Firewall**: Configure to allow required ports
- **SSL**: Valid SSL certificates for production

## 🖥️ System Requirements

### Minimum Production Setup
```
CPU: 8 cores
RAM: 16GB
Storage: 100GB SSD
Network: 1Gbps
```

### Recommended Production Setup
```
CPU: 16 cores
RAM: 32GB
Storage: 500GB NVMe SSD
Network: 10Gbps
Load Balancer: HAProxy/Nginx
```

### High Availability Setup
```
CPU: 32 cores (distributed)
RAM: 64GB (distributed)
Storage: 1TB NVMe SSD (distributed)
Network: 10Gbps redundant
Load Balancer: HAProxy cluster
Database: PostgreSQL cluster
```

## 🚀 Quick Start

### Windows Setup

1. **Clone Repository**
   ```powershell
   git clone <repository-url>
   cd lto-blockchain
   ```

2. **Run Setup Script (as Administrator)**
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
   .\scripts\setup-production.ps1
   ```

3. **Deploy System**
   ```powershell
   .\scripts\deploy.ps1
   ```

4. **Check Health**
   ```powershell
   .\scripts\health-check.ps1
   ```

### Linux/macOS Setup

1. **Clone Repository**
   ```bash
   git clone <repository-url>
   cd lto-blockchain
   ```

2. **Run Setup Script**
   ```bash
   chmod +x scripts/setup-production.sh
   ./scripts/setup-production.sh
   ```

3. **Deploy System**
   ```bash
   ./scripts/deploy.sh
   ```

4. **Check Health**
   ```bash
   ./scripts/health-check.sh
   ```

## 🔧 Detailed Setup

### 1. Environment Preparation

#### Windows
```powershell
# Enable Hyper-V (if not already enabled)
Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V -All

# Install Docker Desktop
# Download from: https://www.docker.com/products/docker-desktop

# Install Git
# Download from: https://git-scm.com/download/win

# Install PowerShell Core (optional)
winget install Microsoft.PowerShell
```

#### Ubuntu
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install Git
sudo apt install git -y

# Install Node.js (for development)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 2. Repository Setup

```bash
# Clone repository
git clone <repository-url>
cd lto-blockchain

# Create necessary directories
mkdir -p crypto-config channel-artifacts wallet blockchain-ledger logs backup
mkdir -p monitoring/prometheus monitoring/grafana/dashboards monitoring/grafana/datasources
mkdir -p monitoring/logstash/pipeline monitoring/logstash/config
mkdir -p nginx/ssl database
```

### 3. Configuration Files

The setup script creates the following configuration files:

- `docker-compose.production.yml` - Production Docker services
- `Dockerfile.production` - Production application image
- `.env.production` - Environment variables
- `network-config.yaml` - Fabric network configuration
- `crypto-config.yaml` - Cryptographic materials configuration
- `configtx.yaml` - Channel configuration
- `database/init.sql` - Database initialization
- `monitoring/` - Monitoring configurations
- `nginx/nginx.conf` - Load balancer configuration

## ⚙️ Configuration

### Environment Variables

Edit `.env.production` to customize your setup:

```bash
# Application
NODE_ENV=production
PORT=3001

# Database
DB_HOST=postgres
DB_PORT=5432
DB_NAME=lto_blockchain
DB_USER=lto_user
DB_PASSWORD=your-secure-password

# Note: Redis is no longer used. Token blacklist is stored in PostgreSQL.

# IPFS
IPFS_HOST=ipfs-cluster
IPFS_PORT=9094
IPFS_CLUSTER_SECRET=your-cluster-secret

# Security
JWT_SECRET=your-super-secret-jwt-key-32-characters
ENCRYPTION_KEY=your-32-character-encryption-key

# Email (for notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# SMS (for notifications)
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=+1234567890
```

### SSL Certificates

Place your SSL certificates in `nginx/ssl/`:

```bash
nginx/ssl/
├── cert.pem          # SSL certificate
├── key.pem           # Private key
└── ca.pem            # Certificate authority (if needed)
```

### Database Configuration

The system uses PostgreSQL with the following default settings:

- **Database**: lto_blockchain
- **User**: lto_user
- **Password**: lto_password (change in production)
- **Port**: 5432
- **Extensions**: uuid-ossp

### IPFS Configuration

IPFS cluster is configured with:

- **3 nodes** for redundancy
- **Automatic pinning** of uploaded documents
- **Encryption** at rest
- **Access control** via API keys

## 🚀 Deployment

### 1. Pre-deployment Checklist

- [ ] All environment variables configured
- [ ] SSL certificates installed
- [ ] Firewall rules configured
- [ ] DNS records set up
- [ ] Backup strategy implemented
- [ ] Monitoring configured

### 2. Deploy Services

```bash
# Pull latest images
docker-compose -f docker-compose.production.yml pull

# Build application
docker-compose -f docker-compose.production.yml build lto-app

# Start services
docker-compose -f docker-compose.production.yml up -d

# Check status
docker-compose -f docker-compose.production.yml ps
```

### 3. Initialize Database

```bash
# Run migrations
docker-compose -f docker-compose.production.yml exec lto-app npm run migrate

# Verify database
docker-compose -f docker-compose.production.yml exec postgres psql -U lto_user -d lto_blockchain -c "\dt"
```

### 4. Deploy Chaincode

```bash
# Deploy smart contracts
docker-compose -f docker-compose.production.yml exec lto-app npm run deploy-chaincode

# Verify deployment
docker-compose -f docker-compose.production.yml exec lto-app npm run test-chaincode
```

## 📊 Monitoring

### Services Overview

| Service | Port | URL | Purpose |
|---------|------|-----|---------|
| LTO App | 3001 | http://localhost:3001 | Main application |
| Grafana | 3000 | http://localhost/grafana | Dashboards |
| Prometheus | 9090 | http://localhost:9090 | Metrics |
| Kibana | 5601 | http://localhost/kibana | Logs |
| Elasticsearch | 9200 | http://localhost:9200 | Log storage |

### Default Credentials

- **Grafana**: admin/admin
- **Kibana**: No authentication (configure in production)
- **Application**: See [Default Users](#default-users)

### Key Metrics

The system monitors:

- **Application Performance**: Response times, error rates, throughput
- **Database Performance**: Connection pool, query times, locks
- **Blockchain Performance**: Transaction throughput, block times
- **IPFS Performance**: Storage usage, replication status
- **System Resources**: CPU, memory, disk, network

### Alerts

Configure alerts for:

- High error rates (>5%)
- Slow response times (>2s)
- Database connection issues
- Blockchain network issues
- Disk space low (<20%)
- Memory usage high (>80%)

## 🔒 Security

### 1. Network Security

```bash
# Configure firewall (Ubuntu)
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable

# Configure firewall (Windows)
New-NetFirewallRule -DisplayName "LTO App" -Direction Inbound -Protocol TCP -LocalPort 3001 -Action Allow
```

### 2. SSL/TLS Configuration

```nginx
# nginx/nginx.conf
server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers off;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=63072000" always;
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
}
```

### 3. Application Security

- **JWT Tokens**: Secure secret keys, short expiration times
- **Password Hashing**: bcrypt with salt rounds 12+
- **Rate Limiting**: 100 requests per 15 minutes per IP
- **CORS**: Configured for specific origins
- **Input Validation**: All inputs validated and sanitized

### 4. Database Security

- **Connection Encryption**: SSL/TLS enabled
- **Access Control**: Role-based permissions
- **Backup Encryption**: Encrypted backups
- **Audit Logging**: All database changes logged

## 💾 Backup & Recovery

### 1. Automated Backups

The system includes automated backup scripts:

```bash
# Run backup
./scripts/backup.sh

# Schedule daily backups (crontab)
0 2 * * * /path/to/lto-blockchain/scripts/backup.sh
```

### 2. Backup Contents

- **Database**: Full PostgreSQL dump
- **Blockchain Ledger**: All transaction data
- **IPFS Data**: Document storage metadata
- **Configuration**: Environment and config files

### 3. Recovery Process

```bash
# Stop services
docker-compose -f docker-compose.production.yml down

# Restore database
docker-compose -f docker-compose.production.yml exec -T postgres psql -U lto_user -d lto_blockchain < backup/database_YYYYMMDD_HHMMSS.sql

# Restore blockchain ledger
docker cp backup/blockchain-ledger_YYYYMMDD_HHMMSS lto-app:/app/blockchain-ledger

# Restore IPFS data
docker-compose -f docker-compose.production.yml exec -T ipfs-cluster ipfs-cluster-ctl pin add <cid>

# Start services
docker-compose -f docker-compose.production.yml up -d
```

## 🐛 Troubleshooting

### Common Issues

#### 1. Services Won't Start

```bash
# Check logs
docker-compose -f docker-compose.production.yml logs <service-name>

# Check resource usage
docker stats

# Restart specific service
docker-compose -f docker-compose.production.yml restart <service-name>
```

#### 2. Database Connection Issues

```bash
# Check database status
docker-compose -f docker-compose.production.yml exec postgres pg_isready -U lto_user -d lto_blockchain

# Check connection pool
docker-compose -f docker-compose.production.yml exec postgres psql -U lto_user -d lto_blockchain -c "SELECT * FROM pg_stat_activity;"
```

#### 3. Blockchain Network Issues

```bash
# Check peer status
docker-compose -f docker-compose.production.yml exec peer0.lto.gov.ph peer node status

# Check orderer status
docker-compose -f docker-compose.production.yml exec orderer1.lto.gov.ph orderer version
```

#### 4. IPFS Issues

```bash
# Check IPFS nodes
docker-compose -f docker-compose.production.yml exec ipfs-node-1 ipfs id

# Check cluster status
docker-compose -f docker-compose.production.yml exec ipfs-cluster ipfs-cluster-ctl status
```

### Performance Issues

#### 1. Slow Response Times

- Check database query performance
- Monitor memory usage
- Review application logs for bottlenecks
- Scale services if needed

#### 2. High Memory Usage

- Check for memory leaks
- Increase container memory limits
- Optimize database queries
- Review caching strategies

#### 3. Storage Issues

- Monitor disk space
- Clean up old logs
- Archive old blockchain data
- Optimize IPFS storage

### Log Analysis

```bash
# Application logs
docker-compose -f docker-compose.production.yml logs -f lto-app

# Database logs
docker-compose -f docker-compose.production.yml logs -f postgres

# Blockchain logs
docker-compose -f docker-compose.production.yml logs -f peer0.lto.gov.ph

# Search logs in Kibana
# Access: http://localhost/kibana
```

## 📞 Support

### Getting Help

1. **Documentation**: Check this guide and README files
2. **Logs**: Review application and system logs
3. **Health Check**: Run health check scripts
4. **Community**: Contact development team

### Useful Commands

```bash
# System status
docker-compose -f docker-compose.production.yml ps

# Service logs
docker-compose -f docker-compose.production.yml logs -f <service>

# Health check
./scripts/health-check.sh

# Backup
./scripts/backup.sh

# Restart all services
docker-compose -f docker-compose.production.yml restart

# Clean restart
docker-compose -f docker-compose.production.yml down && docker-compose -f docker-compose.production.yml up -d
```

---

## 🎯 Default Users

After setup, the following users are available:

| Role | Email | Password | Description |
|------|-------|----------|-------------|
| Admin | admin@lto.gov.ph | admin123 | System administrator |
| Staff | staff@lto.gov.ph | admin123 | LTO staff member |
| Insurance | insurance@lto.gov.ph | admin123 | Insurance verifier |
| Emission | emission@lto.gov.ph | admin123 | Emission test verifier |
| Owner | owner@example.com | admin123 | Vehicle owner (demo) |

**⚠️ IMPORTANT**: Change all default passwords in production!

---

## 🚀 Next Steps

1. **Customize Configuration**: Update environment variables and settings
2. **Deploy to Production**: Follow deployment steps
3. **Configure Monitoring**: Set up alerts and dashboards
4. **Implement Security**: Configure SSL, firewall, and access controls
5. **Set Up Backups**: Schedule automated backups
6. **Train Users**: Provide training for system users
7. **Go Live**: Deploy to production environment

**🎉 Congratulations! Your TrustChain LTO Blockchain Vehicle Registration System is ready for production!**
