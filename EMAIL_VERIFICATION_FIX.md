# CRITICAL FIX: Email Verification Not Working

## Root Causes Identified

1. **DATABASE TABLE MISSING**: The `email_verification_tokens` table may not exist, causing `EMAIL_VERIFICATION_ENABLED` to be `false`
2. **MISSING UUID EXTENSION**: The `uuid-ossp` extension may not be enabled, causing migration to fail
3. **CREDENTIAL MISMATCH**: Docker compose might use different DB credentials than your .env file
4. **MIGRATION FAILURE**: The auto-migration in server.js may be failing silently

## Quick Fix: Use Manual Migration Script

The easiest way to fix this is to use the provided manual migration script:

```bash
ssh root@ltoblockchain.duckdns.org
cd /opt/lto-blockchain

# Run the manual migration script
./scripts/manual-email-verification-migration.sh

# Restart the application
docker compose -f docker-compose.unified.yml restart lto-app

# Check status
docker compose -f docker-compose.unified.yml logs lto-app | grep -i "email verification"
```

The script will:
- Auto-detect database credentials from `.env` or use defaults (`lto_user`/`lto_blockchain`)
- Ensure UUID extension exists
- Run the migration
- Verify table creation
- Provide clear success/failure messages

## Manual Solution Steps

If you prefer to run the migration manually:

### Step 1: Check Your Server Configuration

SSH into your DigitalOcean droplet and verify:

```bash
ssh root@ltoblockchain.duckdns.org
cd /opt/lto-blockchain

# Check what .env has for database (if exists)
if [ -f .env ]; then
    grep "DB_" .env | grep -E "DB_NAME|DB_USER|DB_PASSWORD"
else
    echo "No .env file found, using docker-compose defaults"
fi

# Check what docker-compose expects (defaults: lto_user/lto_blockchain)
grep "POSTGRES_" docker-compose.unified.yml | head -5
```

**Default credentials** (from docker-compose.unified.yml):
- Database: `lto_blockchain`
- User: `lto_user`
- Password: Set via `POSTGRES_PASSWORD` environment variable or `.env` file

### Step 2: Ensure UUID Extension Exists

```bash
# Auto-detect credentials
if [ -f .env ]; then
    DB_NAME=$(grep "^DB_NAME=" .env | cut -d= -f2 | tr -d '"' | tr -d "'" | xargs)
    DB_USER=$(grep "^DB_USER=" .env | cut -d= -f2 | tr -d '"' | tr -d "'" | xargs)
fi

# Fall back to defaults
DB_NAME=${DB_NAME:-lto_blockchain}
DB_USER=${DB_USER:-lto_user}

# Create UUID extension
docker compose -f docker-compose.unified.yml exec -T postgres psql \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
```

### Step 3: Run Migration Manually

```bash
# Use detected credentials
docker compose -f docker-compose.unified.yml exec -T postgres psql \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  < backend/migrations/add_email_verification.sql

# Verify table was created
docker compose -f docker-compose.unified.yml exec postgres psql \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'email_verification_tokens');"

# Should return "t" (true)
```

### Step 3: Restart Application with Logs

```bash
# Stop the app
docker compose -f docker-compose.unified.yml stop lto-app

# Clear logs
docker compose -f docker-compose.unified.yml logs -f lto-app > /tmp/startup.log 2>&1 &

# Start app with rebuild
docker compose -f docker-compose.unified.yml up -d --build lto-app

# Watch logs for 30 seconds
sleep 2 && tail -f /tmp/startup.log &
sleep 30
pkill -f "tail -f"

# Check for EMAIL_VERIFICATION_ENABLED status
docker compose -f docker-compose.unified.yml logs lto-app | grep -i "email verification"
```

### Step 4: Clean Database & Test Fresh

```bash
# Get credentials again
export DB_NAME=$(grep "DB_NAME=" .env | cut -d= -f2)
export DB_USER=$(grep "DB_USER=" .env | cut -d= -f2)

# Delete all test users and their tokens
docker compose -f docker-compose.unified.yml exec postgres psql -U "$DB_USER" -d "$DB_NAME" -c \
  "DELETE FROM email_verification_tokens; DELETE FROM users WHERE created_at > now() - INTERVAL '1 hour';"

# Verify cleanup
docker compose -f docker-compose.unified.yml exec postgres psql -U "$DB_USER" -d "$DB_NAME" -c \
  "SELECT COUNT(*) as users FROM users; SELECT COUNT(*) as tokens FROM email_verification_tokens;"
```

### Step 5: Test Complete Flow

1. Open browser in **incognito mode**
2. Navigate to `https://ltoblockchain.duckdns.org`
3. Register new account with test email
4. **Expected**: Redirect to email-verification-prompt.html
5. **Check logs**:
   ```bash
   docker compose -f docker-compose.unified.yml logs lto-app | grep -i "verification email sent"
   ```
6. **Check inbox** for verification email
7. Click verification link
8. Should auto-redirect to login

### Step 6: If Email Still Not Sent

```bash
# Check Gmail OAuth credentials
docker compose -f docker-compose.unified.yml exec lto-app env | grep GMAIL_

# Should show:
# GMAIL_USER=...
# GMAIL_CLIENT_ID=...
# GMAIL_CLIENT_SECRET=...
# GMAIL_REFRESH_TOKEN=...

# If any are missing, update .env and restart
```

## Diagnostic Tools

### Quick Diagnostic Script

Run the diagnostic script to check all aspects of email verification:

```bash
cd /opt/lto-blockchain
./DIAGNOSTIC_EMAIL_VERIFICATION.sh
```

This script will:
- Check if `email_verification_tokens` table exists
- Check if `email_verified` column exists
- Check EMAIL_VERIFICATION_ENABLED status in logs
- Check for email sending errors
- Verify Gmail credentials are set
- Show recent users and their verification status

### Health Check Endpoint

You can also check email verification status via the health check API:

```bash
# Check email verification status
curl https://ltoblockchain.duckdns.org/api/health/email-verification

# Or check detailed health (includes email verification)
curl https://ltoblockchain.duckdns.org/api/health/detailed
```

The response will show:
- `enabled`: Whether EMAIL_VERIFICATION_ENABLED is true
- `tableExists`: Whether the table exists
- `columnExists`: Whether the column exists
- `status`: Overall operational status

### Manual Diagnostic Commands

If you prefer to run diagnostics manually:

```bash
cd /opt/lto-blockchain

# Auto-detect credentials
if [ -f .env ]; then
    DB_NAME=$(grep "^DB_NAME=" .env | cut -d= -f2 | tr -d '"' | tr -d "'" | xargs)
    DB_USER=$(grep "^DB_USER=" .env | cut -d= -f2 | tr -d '"' | tr -d "'" | xargs)
fi
DB_NAME=${DB_NAME:-lto_blockchain}
DB_USER=${DB_USER:-lto_user}

echo "=== DATABASE CHECK ==="
docker compose -f docker-compose.unified.yml exec postgres psql -U "$DB_USER" -d "$DB_NAME" -c \
  "SELECT 'email_verification_tokens' as table_name, COUNT(*) FROM email_verification_tokens UNION ALL SELECT 'users', COUNT(*) FROM users;"

echo ""
echo "=== EMAIL VERIFICATION STATUS ==="
docker compose -f docker-compose.unified.yml logs lto-app | grep -i "email verification: " | tail -1

echo ""
echo "=== GMAIL CREDENTIALS ==="
docker compose -f docker-compose.unified.yml exec lto-app env | grep "GMAIL_" | grep -v "^$"

echo ""
echo "=== RECENT USERS ==="
docker compose -f docker-compose.unified.yml exec postgres psql -U "$DB_USER" -d "$DB_NAME" -c \
  "SELECT email, email_verified, created_at FROM users ORDER BY created_at DESC LIMIT 3;"
```

## Troubleshooting

### Common Issues

#### Issue 1: Migration Fails with "function uuid_generate_v4() does not exist"

**Solution**: Ensure UUID extension is enabled:
```bash
docker compose -f docker-compose.unified.yml exec postgres psql \
  -U lto_user -d lto_blockchain \
  -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
```

#### Issue 2: Table Still Not Created After Migration

**Check migration logs**:
```bash
docker compose -f docker-compose.unified.yml logs lto-app | grep -i "auto-migration"
```

Look for error messages. The enhanced error logging will show:
- File path
- File existence
- Database connection details
- Full error stack trace

#### Issue 3: EMAIL_VERIFICATION_ENABLED Still False

**Verify table exists**:
```bash
docker compose -f docker-compose.unified.yml exec postgres psql \
  -U lto_user -d lto_blockchain \
  -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'email_verification_tokens');"
```

If it returns `f` (false), the table doesn't exist. Run the manual migration script again.

#### Issue 4: Credential Mismatch

**Check credentials match**:
- `.env` file: `DB_USER` and `DB_NAME`
- `docker-compose.unified.yml`: `POSTGRES_USER` and `POSTGRES_DB`

They should match. The diagnostic script auto-detects from `.env` first, then falls back to docker-compose defaults.

### Verification Checklist

After running the migration, verify:

- [ ] `email_verification_tokens` table exists
- [ ] `email_verified` column exists in `users` table
- [ ] UUID extension is enabled
- [ ] Server logs show: `📧 Email verification: Enabled ✓`
- [ ] Health check endpoint shows `enabled: true`
- [ ] Gmail credentials are configured
- [ ] Test signup sends verification email

## Expected Output

After successful fix, you should see:

**In Server Logs**:
```
✅ Auto-migration successful: email_verification_tokens table created
📧 Email verification: Enabled ✓
```

**In Health Check** (`/api/health/email-verification`):
```json
{
  "status": "healthy",
  "emailVerification": {
    "enabled": true,
    "tableExists": true,
    "columnExists": true,
    "status": "operational"
  }
}
```

**When Signing Up**:
- User redirected to `email-verification-prompt.html`
- Log shows: `Verification email sent { userId: X, email: Y }`
- Email arrives in user's inbox
- Clicking link verifies email and redirects to login

**Gmail Credentials** (all should be present):
- `GMAIL_USER`
- `GMAIL_CLIENT_ID`
- `GMAIL_CLIENT_SECRET`
- `GMAIL_REFRESH_TOKEN`
