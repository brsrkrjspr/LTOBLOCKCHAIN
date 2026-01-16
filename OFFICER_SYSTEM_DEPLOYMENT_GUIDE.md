# LTO Officer & Admin Implementation - Deployment Guide

## Overview

This guide provides step-by-step instructions for deploying the LTO Officer and Admin account system with enhanced accountability and audit trails.

---

## Phase 1: Database Migration (REQUIRED FIRST)

### Step 1: Connect to Server

```bash
# SSH into your DigitalOcean server
ssh root@your-server-ip

# Navigate to project directory
cd ~/LTOBLOCKCHAIN
```

### Step 2: Backup Database (CRITICAL)

```bash
# Create backup directory
mkdir -p ~/backups

# Backup current database
docker exec postgres pg_dump -U lto_user -d lto_blockchain > ~/backups/lto_blockchain_backup_$(date +%Y%m%d_%H%M%S).sql

# Verify backup was created
ls -lh ~/backups/

# Download backup to local machine (optional but recommended)
# From your local machine:
# scp root@your-server-ip:~/backups/lto_blockchain_backup_*.sql ./
```

### Step 3: Run Migration

```bash
# Copy migration file to server (if not already there)
# From your local machine:
# scp database/migrations/006_add_officer_roles_and_tracking.sql root@your-server-ip:~/LTOBLOCKCHAIN/database/migrations/

# Run the migration
docker exec postgres psql -U lto_user -d lto_blockchain -f /app/database/migrations/006_add_officer_roles_and_tracking.sql

# OR run directly:
docker exec -i postgres psql -U lto_user -d lto_blockchain < database/migrations/006_add_officer_roles_and_tracking.sql
```

### Step 4: Verify Migration

```bash
# Check new enum values
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT unnest(enum_range(NULL::user_role)) as role_values;"

# Check new columns in users table
docker exec postgres psql -U lto_user -d lto_blockchain -c "\d users"

# Check officer_activity_log table
docker exec postgres psql -U lto_user -d lto_blockchain -c "\d officer_activity_log"

# Check officer_performance_metrics view
docker exec postgres psql -U lto_user -d lto_blockchain -c "\d+ officer_performance_metrics"

# Verify updated admin user
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT email, role, employee_id, badge_number, department, branch_office FROM users WHERE email = 'admin@lto.gov.ph';"
```

Expected output should show:
- New roles: `lto_admin`, `lto_officer`, `lto_supervisor`
- New columns: `employee_id`, `badge_number`, `department`, `branch_office`, etc.
- Table `officer_activity_log` exists
- View `officer_performance_metrics` exists
- Admin user has employee_id = 'LTO-ADMIN-001'

---

## Phase 2: Backend Deployment

### Step 1: Upload New Files

```bash
# From your local machine, upload new files
scp backend/services/activityLogger.js root@your-server-ip:~/LTOBLOCKCHAIN/backend/services/
scp backend/routes/officers.js root@your-server-ip:~/LTOBLOCKCHAIN/backend/routes/
scp backend/middleware/authorize.js root@your-server-ip:~/LTOBLOCKCHAIN/backend/middleware/
```

### Step 2: Update Existing Files

```bash
# Upload updated server.js
scp server.js root@your-server-ip:~/LTOBLOCKCHAIN/
```

### Step 3: Restart Backend Services

```bash
# SSH into server
ssh root@your-server-ip
cd ~/LTOBLOCKCHAIN

# Restart backend container
docker-compose restart backend

# Check logs for errors
docker-compose logs -f backend

# Press Ctrl+C to exit logs when satisfied

# Verify backend is running
curl -s http://localhost:5000/api/health | jq .
```

### Step 4: Test New Endpoints

```bash
# Get auth token first (use admin credentials)
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@lto.gov.ph","password":"admin123"}' | jq -r '.token')

# Test officer performance metrics endpoint
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/officers/performance | jq .

# Test officers list endpoint
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/officers | jq .

# Test department stats
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/officers/stats/departments | jq .
```

Expected output: JSON responses with officer data, no errors

---

## Phase 3: Create Test Officer Accounts

### Create Sample LTO Officers

```bash
# Connect to database
docker exec -it postgres psql -U lto_user -d lto_blockchain

-- Create LTO Officer 1
INSERT INTO users (
    email, password_hash, first_name, last_name, role,
    employee_id, badge_number, department, branch_office, position,
    organization, phone, is_active, email_verified, hire_date
) VALUES (
    'officer.cruz@lto.gov.ph',
    '$2a$12$0V4iR1vog9LRKdCxgKYQM.sH7QZWP2yMsu5i.80xLfH/imgycOGrG',
    'Juan',
    'Cruz',
    'lto_officer',
    'LTO-2024-001234',
    'BADGE-5678',
    'Vehicle Registration',
    'LTO Manila Central',
    'Registration Officer I',
    'LTO',
    '+63-917-123-4567',
    true,
    true,
    '2024-01-15'
);

-- Create LTO Officer 2
INSERT INTO users (
    email, password_hash, first_name, last_name, role,
    employee_id, badge_number, department, branch_office, position,
    organization, phone, is_active, email_verified, hire_date
) VALUES (
    'officer.santos@lto.gov.ph',
    '$2a$12$0V4iR1vog9LRKdCxgKYQM.sH7QZWP2yMsu5i.80xLfH/imgycOGrG',
    'Maria',
    'Santos',
    'lto_officer',
    'LTO-2024-001235',
    'BADGE-5679',
    'Vehicle Registration',
    'LTO Quezon City',
    'Registration Officer II',
    'LTO',
    '+63-917-123-4568',
    true,
    true,
    '2024-02-01'
);

-- Create LTO Supervisor
INSERT INTO users (
    email, password_hash, first_name, last_name, role,
    employee_id, badge_number, department, branch_office, position,
    organization, phone, is_active, email_verified, hire_date
) VALUES (
    'supervisor.reyes@lto.gov.ph',
    '$2a$12$0V4iR1vog9LRKdCxgKYQM.sH7QZWP2yMsu5i.80xLfH/imgycOGrG',
    'Pedro',
    'Reyes',
    'lto_supervisor',
    'LTO-2024-001100',
    'SUPER-100',
    'Vehicle Registration',
    'LTO Manila Central',
    'Senior Registration Officer',
    'LTO',
    '+63-917-123-4500',
    true,
    true,
    '2023-06-01'
);

-- Update existing staff to lto_officer role (optional)
UPDATE users 
SET 
    role = 'lto_officer',
    employee_id = 'LTO-STAFF-001',
    badge_number = 'STAFF-001',
    department = 'Vehicle Registration',
    branch_office = 'LTO Manila Central',
    position = 'Registration Clerk',
    hire_date = '2024-01-01'
WHERE email = 'staff@lto.gov.ph';

-- Update existing admin to lto_admin role (optional - be careful!)
-- UPDATE users SET role = 'lto_admin' WHERE email = 'admin@lto.gov.ph';

-- Exit psql
\q
```

### Verify Test Accounts

```bash
# Check created officers
docker exec postgres psql -U lto_user -d lto_blockchain -c "
SELECT 
    email, role, employee_id, badge_number, 
    department, branch_office, position, is_active
FROM users 
WHERE role IN ('lto_officer', 'lto_supervisor', 'lto_admin')
ORDER BY email;
"
```

### Test Login with Officer Account

```bash
# Test officer login
curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "officer.cruz@lto.gov.ph",
    "password": "admin123"
  }' | jq .

# Expected: Success with JWT token and officer details including employee_id, badge_number
```

---

## Phase 4: Frontend Updates (Optional - Basic Functionality Works Without This)

### Step 1: Update User Management Page

The user management page needs to be updated to support officer-specific fields. This is optional for initial deployment but recommended for full functionality.

Files to update:
- `user-management.html` - Add officer-specific form fields
- `js/user-management.js` - Handle officer data in forms

These updates will be provided in a separate frontend update package.

---

## Phase 5: Testing & Verification

### Test Authorization System

```bash
# Get officer token
OFFICER_TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"officer.cruz@lto.gov.ph","password":"admin123"}' | jq -r '.token')

# Test officer can access their assigned permissions
curl -s -H "Authorization: Bearer $OFFICER_TOKEN" \
  http://localhost:5000/api/vehicles | jq '.success'
# Expected: true

# Test officer cannot access admin-only endpoints
curl -s -H "Authorization: Bearer $OFFICER_TOKEN" \
  http://localhost:5000/api/officers/performance | jq '.success'
# Expected: false (403 error - insufficient permissions)
```

### Test Activity Logging

```bash
# Perform an action as officer (e.g., view vehicles)
curl -s -H "Authorization: Bearer $OFFICER_TOKEN" \
  http://localhost:5000/api/vehicles > /dev/null

# Check if activity was logged (requires admin token)
ADMIN_TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@lto.gov.ph","password":"admin123"}' | jq -r '.token')

# Get officer's activity log
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:5000/api/officers/activities?limit=10" | jq '.activities[0]'

# Expected: Recent activity entries with officer details
```

### Test Performance Metrics

```bash
# Get performance metrics (as admin)
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:5000/api/officers/performance | jq '.metrics'

# Expected: Array of officer performance data
```

---

## Phase 6: Production Considerations

### Security Checklist

- [ ] Database backup completed and verified
- [ ] Migration ran successfully without errors
- [ ] Test accounts created and verified
- [ ] Authorization system tested
- [ ] Activity logging verified
- [ ] All endpoints return expected responses
- [ ] No sensitive data in logs
- [ ] SSL/TLS enabled (should already be configured)
- [ ] Rate limiting in place (should already be configured)

### Monitoring

```bash
# Monitor backend logs for errors
docker-compose logs -f backend | grep -i error

# Monitor database connections
docker exec postgres psql -U lto_user -d lto_blockchain -c "
SELECT count(*) as active_connections 
FROM pg_stat_activity 
WHERE datname = 'lto_blockchain';
"

# Check activity log growth
docker exec postgres psql -U lto_user -d lto_blockchain -c "
SELECT 
    COUNT(*) as total_activities,
    COUNT(CASE WHEN created_at >= CURRENT_DATE THEN 1 END) as today_activities,
    pg_size_pretty(pg_total_relation_size('officer_activity_log')) as table_size
FROM officer_activity_log;
"
```

### Performance Optimization

If the `officer_activity_log` table grows large:

```sql
-- Archive old activities (older than 6 months)
CREATE TABLE officer_activity_log_archive AS 
SELECT * FROM officer_activity_log 
WHERE created_at < CURRENT_DATE - INTERVAL '6 months';

DELETE FROM officer_activity_log 
WHERE created_at < CURRENT_DATE - INTERVAL '6 months';

-- Re-analyze table
ANALYZE officer_activity_log;
```

---

## Rollback Plan (In Case of Issues)

### If Migration Fails

```bash
# Restore from backup
docker exec -i postgres psql -U lto_user -d lto_blockchain < ~/backups/lto_blockchain_backup_TIMESTAMP.sql

# Restart services
docker-compose restart
```

### If Backend Fails

```bash
# Check logs
docker-compose logs backend

# Rollback to previous server.js (if you have it)
# Or remove the new route:
# Comment out: app.use('/api/officers', require('./backend/routes/officers'));

# Restart
docker-compose restart backend
```

---

## Post-Deployment Tasks

### 1. Update Documentation

- Document new officer roles and permissions
- Update API documentation with new endpoints
- Create user guide for officer features

### 2. Train Staff

- Train LTO admins on officer management
- Train officers on new system features
- Provide quick reference guides

### 3. Monitor Performance

- Monitor API response times
- Track activity log growth
- Review performance metrics weekly

---

## Quick Commands Reference

```bash
# Check officer count
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT role, COUNT(*) FROM users WHERE role IN ('lto_officer', 'lto_supervisor', 'lto_admin') GROUP BY role;"

# Check today's activity count
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT COUNT(*) as today_activities FROM officer_activity_log WHERE DATE(created_at) = CURRENT_DATE;"

# Get top 10 most active officers today
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT u.email, u.first_name, u.last_name, COUNT(*) as activities FROM officer_activity_log oal JOIN users u ON oal.officer_id = u.id WHERE DATE(oal.created_at) = CURRENT_DATE GROUP BY u.id, u.email, u.first_name, u.last_name ORDER BY activities DESC LIMIT 10;"

# Check unauthorized access attempts
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT COUNT(*) as unauthorized_attempts FROM officer_activity_log WHERE activity_type = 'unauthorized_access' AND DATE(created_at) = CURRENT_DATE;"
```

---

## Support & Troubleshooting

### Common Issues

**Issue:** Migration fails with "type already exists"
```bash
# Solution: The ENUM values already exist, this is OK, continue with migration
```

**Issue:** Backend won't start after update
```bash
# Check logs
docker-compose logs backend

# Common causes:
# - Syntax error in new files
# - Missing dependencies
# - Port conflicts

# Solution: Review logs and fix errors
```

**Issue:** Cannot access /api/officers endpoints
```bash
# Check if route is registered in server.js
grep "api/officers" server.js

# Check if file exists
ls -l backend/routes/officers.js

# Restart backend
docker-compose restart backend
```

---

## Success Criteria

Deployment is successful when:

✅ Database migration completes without errors  
✅ All new tables and views are created  
✅ Backend restarts successfully  
✅ New API endpoints return valid responses  
✅ Officer accounts can log in  
✅ Activity logging is working  
✅ Performance metrics are available  
✅ Authorization system blocks unauthorized access  
✅ No errors in application logs  

---

## Next Steps

After successful deployment:

1. **Create real officer accounts** with proper credentials
2. **Migrate existing staff accounts** to appropriate officer roles
3. **Update frontend** with officer-specific UI (Phase 6-7)
4. **Train users** on new system features
5. **Monitor system performance** and adjust as needed
6. **Gather feedback** from officers and admins
7. **Iterate and improve** based on usage patterns

---

## Contact & Support

For issues or questions:
- Check application logs: `docker-compose logs -f backend`
- Review this deployment guide
- Consult the main analysis document: `LTO_OFFICER_ADMIN_ANALYSIS.md`

---

**Deployment completed:** [DATE]  
**Deployed by:** [NAME]  
**Version:** 1.0.0 (Officer & Admin System)
