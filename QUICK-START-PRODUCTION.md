# 🚀 Quick Start - Production Setup (Without IPFS)

## One-Command Start

```powershell
.\start-production.ps1
```

That's it! The script will:
- ✅ Check Docker is running
- ✅ Create necessary directories
- ✅ Start all services
- ✅ Verify health status
- ✅ Display access information

## What Gets Started

| Service | Port | Purpose |
|---------|------|---------|
| **Application** | 3001 | Main web application |
| **PostgreSQL** | 5432 | Database |
| **Redis** | 6379 | Cache |
| **Prometheus** | 9090 | Metrics |
| **Grafana** | 3000 | Dashboards |
| **Nginx** | 80 | Reverse proxy |

## First Time Setup

1. **Create environment file:**
   ```powershell
   Copy-Item .env.production .env
   ```

2. **Edit `.env` and change:**
   - `JWT_SECRET` - Strong random string (32+ chars)
   - `ENCRYPTION_KEY` - 32-character key
   - `DB_PASSWORD` - Strong password
   - `REDIS_PASSWORD` - Strong password

3. **Start the system:**
   ```powershell
   .\start-production.ps1
   ```

## Access the System

- **Application:** http://localhost:3001
- **Login:** admin@lto.gov.ph / admin123
- **Grafana:** http://localhost:3000 (admin/admin)
- **Prometheus:** http://localhost:9090

## Stop the System

```powershell
docker-compose -f docker-compose.production-no-ipfs.yml down
```

## View Logs

```powershell
docker-compose -f docker-compose.production-no-ipfs.yml logs -f
```

## Troubleshooting

**Port already in use?**
- Change ports in `docker-compose.production-no-ipfs.yml`

**Services not starting?**
- Check Docker Desktop is running
- Check logs: `docker-compose -f docker-compose.production-no-ipfs.yml logs`

**Database connection issues?**
- Wait 30 seconds for PostgreSQL to initialize
- Check logs: `docker-compose -f docker-compose.production-no-ipfs.yml logs postgres-prod`

## What's Different from Development?

- ✅ **Production database** (PostgreSQL instead of in-memory)
- ✅ **Redis caching** for performance
- ✅ **Monitoring** with Prometheus & Grafana
- ✅ **Nginx reverse proxy** for load balancing
- ✅ **Automated backups** of database
- ✅ **Health checks** for all services
- ✅ **Resource limits** configured
- ✅ **Production logging**

## Next Steps

1. **Change default passwords** (critical!)
2. **Configure SSL** in Nginx (for HTTPS)
3. **Set up monitoring alerts** in Grafana
4. **Review backup schedule**
5. **Test disaster recovery**

For detailed documentation, see `PRODUCTION-SETUP-NO-IPFS.md`

