# 🏭 TrustChain LTO - Production Setup Guide (Without IPFS)

## Overview

This guide provides instructions for setting up a production-ready TrustChain LTO system **without IPFS**. The system uses:
- **Local file storage** instead of IPFS
- **PostgreSQL** for database (token blacklist stored in database)
- **Mock blockchain** (can be upgraded to Hyperledger Fabric)
- **Prometheus & Grafana** for monitoring
- **Nginx** as reverse proxy

**Note:** Redis has been completely removed. Token blacklisting is now handled by PostgreSQL.

## Prerequisites

- Docker Desktop installed and running
- Docker Compose v2.0+
- At least 8GB RAM (16GB recommended)
- 20GB free disk space
- PowerShell (for Windows) or Bash (for Linux/Mac)

## Quick Start

### 1. Clone and Navigate to Project

```powershell
cd C:\Users\Jasper\OneDrive\Documents\GitHub\LTOBLOCKCHAIN
```

### 2. Configure Environment

Copy the production environment template:

```powershell
Copy-Item .env.production .env
```

Edit `.env` and update the following critical values:
- `JWT_SECRET` - Use a strong random string (minimum 32 characters)
- `ENCRYPTION_KEY` - Use a 32-character encryption key
- `DB_PASSWORD` - Strong database password

**Note:** Redis is no longer used. Token blacklist is stored in PostgreSQL.

### 3. Start Production Services

```powershell
.\start-production.ps1
```

Or manually:

```powershell
docker-compose -f docker-compose.production-no-ipfs.yml up -d
```

### 4. Verify Services

```powershell
# Check all services
docker-compose -f docker-compose.production-no-ipfs.yml ps

# Check application health
curl http://localhost:3001/api/health

# View logs
docker-compose -f docker-compose.production-no-ipfs.yml logs -f
```

## Access Points

| Service | URL | Credentials |
|---------|-----|-------------|
| **Application** | http://localhost:3001 | admin@lto.gov.ph / admin123 |
| **Prometheus** | http://localhost:9090 | N/A |
| **Grafana** | http://localhost:3000 | admin / admin |
| **PostgreSQL** | localhost:5432 | lto_user / lto_password |

## Default Users

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@lto.gov.ph | admin123 |
| Staff | staff@lto.gov.ph | admin123 |
| Insurance Verifier | insurance@lto.gov.ph | admin123 |
| Emission Verifier | emission@lto.gov.ph | admin123 |
| Vehicle Owner | owner@example.com | admin123 |

**⚠️ IMPORTANT:** Change all default passwords in production!

## Architecture

```
┌─────────────┐
│   Nginx     │ (Port 80, 443)
│  (Reverse   │
│   Proxy)    │
└──────┬──────┘
       │
┌──────▼──────┐
│  LTO App   │ (Port 3001)
│  (Node.js) │
└──────┬──────┘
       │
   ┌───┴───────────┐
   │               │
┌──▼──┐      ┌───▼────┐
│Post │      │Blockchain│
│gres │      │  (Mock) │
└─────┘      └─────────┘
```

## Services

### Application (lto-app-prod)
- **Port:** 3001
- **Image:** Custom build from Dockerfile.laptop
- **Storage:** Local file system (`./uploads`)
- **Blockchain:** Mock blockchain service
- **Database:** PostgreSQL (includes token blacklist)

### PostgreSQL (postgres-prod)
- **Port:** 5432
- **Database:** lto_blockchain
- **User:** lto_user
- **Password:** lto_password (change in production)
- **Optimized:** For 8GB+ RAM systems

**Note:** Redis has been removed. Token blacklisting is now handled by PostgreSQL.

### Prometheus (prometheus-prod)
- **Port:** 9090
- **Purpose:** Metrics collection
- **Retention:** 200 hours

### Grafana (grafana-prod)
- **Port:** 3000
- **Default Password:** admin
- **Purpose:** Monitoring dashboards

### Nginx (nginx-prod)
- **Ports:** 80, 443
- **Purpose:** Reverse proxy, load balancing
- **Features:** Rate limiting, SSL (when configured)

## Storage Configuration

### Local File Storage

Documents are stored locally in:
- `./uploads/documents/registration/` - Registration certificates
- `./uploads/documents/insurance/` - Insurance certificates
- `./uploads/documents/emission/` - Emission test certificates
- `./uploads/documents/identity/` - Owner identification

### Blockchain Ledger

Mock blockchain data stored in:
- `./blockchain-ledger/blocks.json` - Block data
- `./blockchain-ledger/transactions.json` - Transaction data
- `./blockchain-ledger/vehicles.json` - Vehicle records
- `./blockchain-ledger/owners.json` - Owner records

## Monitoring

### Prometheus Metrics

Application exposes metrics at:
- `http://localhost:3001/api/monitoring/metrics`

### Grafana Dashboards

Pre-configured dashboards available:
- System overview
- Application performance
- Database metrics
- Request rates

### Health Checks

```powershell
# Application health
curl http://localhost:3001/api/health

# Prometheus health
curl http://localhost:9090/-/healthy

# Grafana health
curl http://localhost:3000/api/health
```

## Backup and Recovery

### Automated Backups

PostgreSQL backups run daily:
- Location: `./backup/`
- Format: `backup_YYYYMMDD_HHMMSS.sql`
- Retention: 7 days

### Manual Backup

```powershell
docker exec postgres-prod pg_dump -U lto_user lto_blockchain > backup_manual.sql
```

### Restore

```powershell
docker exec -i postgres-prod psql -U lto_user lto_blockchain < backup_manual.sql
```

## Security Best Practices

1. **Change Default Passwords**
   - Update all passwords in `.env`
   - Use strong, unique passwords

2. **JWT Secret**
   - Generate a strong random string
   - Minimum 32 characters

3. **Encryption Key**
   - Use a 32-character encryption key
   - Store securely (consider key management service)

4. **SSL/TLS**
   - Configure SSL certificates in `nginx/ssl/`
   - Update `nginx/production.conf` to enable HTTPS

5. **Firewall**
   - Only expose necessary ports
   - Use firewall rules to restrict access

6. **Rate Limiting**
   - Already configured in Nginx
   - Adjust limits in `nginx/production.conf`

7. **File Permissions**
   - Ensure uploads directory has proper permissions
   - Restrict access to sensitive files

## Maintenance

### View Logs

```powershell
# All services
docker-compose -f docker-compose.production-no-ipfs.yml logs -f

# Specific service
docker-compose -f docker-compose.production-no-ipfs.yml logs -f lto-app-prod
```

### Restart Services

```powershell
# Restart all
docker-compose -f docker-compose.production-no-ipfs.yml restart

# Restart specific service
docker-compose -f docker-compose.production-no-ipfs.yml restart lto-app-prod
```

### Update Application

```powershell
# Pull latest code
git pull

# Rebuild and restart
docker-compose -f docker-compose.production-no-ipfs.yml up -d --build
```

### Cleanup

```powershell
# Remove stopped containers
docker-compose -f docker-compose.production-no-ipfs.yml down

# Remove volumes (⚠️ deletes data)
docker-compose -f docker-compose.production-no-ipfs.yml down -v
```

## Troubleshooting

### Port Already in Use

```powershell
# Check what's using the port
netstat -ano | findstr :3001

# Change port in docker-compose.production-no-ipfs.yml
```

### Database Connection Issues

```powershell
# Check PostgreSQL logs
docker-compose -f docker-compose.production-no-ipfs.yml logs postgres-prod

# Test connection
docker exec -it postgres-prod psql -U lto_user -d lto_blockchain
```

### Application Not Starting

```powershell
# Check application logs
docker-compose -f docker-compose.production-no-ipfs.yml logs lto-app-prod

# Check environment variables
docker exec lto-app-prod env | grep DB_
```

### High Memory Usage

```powershell
# Check resource usage
docker stats

# Adjust PostgreSQL settings in docker-compose file
# Reduce shared_buffers and effective_cache_size
```

## Performance Tuning

### PostgreSQL

Edit `docker-compose.production-no-ipfs.yml`:
- Adjust `shared_buffers` based on RAM
- Tune `effective_cache_size`
- Adjust `max_connections`

### Application

- Increase worker processes in Nginx
- Adjust connection pool sizes
- Enable caching where appropriate

## Scaling

### Horizontal Scaling

1. Run multiple application instances
2. Use load balancer (Nginx already configured)
3. Scale with: `docker-compose -f docker-compose.production-no-ipfs.yml up -d --scale lto-app=3`

### Vertical Scaling

1. Increase container resource limits
2. Adjust database settings

## Upgrade Path

### From Mock to Hyperledger Fabric

1. Set `BLOCKCHAIN_MODE=fabric` in `.env`
2. Deploy Hyperledger Fabric network
3. Update network configuration
4. Restart application

### From Local to Cloud Storage

1. Implement cloud storage adapter (S3, Azure Blob, etc.)
2. Update `localStorageService.js`
3. Migrate existing files
4. Update storage configuration

## Support

For issues or questions:
1. Check logs first
2. Review this documentation
3. Check GitHub issues
4. Contact development team

## Production Checklist

- [ ] Changed all default passwords
- [ ] Configured strong JWT secret
- [ ] Set encryption key
- [ ] Configured SSL certificates
- [ ] Set up monitoring alerts
- [ ] Configured backup schedule
- [ ] Tested disaster recovery
- [ ] Secured firewall rules
- [ ] Documented access procedures
- [ ] Trained operators

---

**System Status:** ✅ Production Ready (Without IPFS)

**Last Updated:** 2025-01-XX

