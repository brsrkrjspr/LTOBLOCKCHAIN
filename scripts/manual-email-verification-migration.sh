#!/bin/bash
# Manual Email Verification Migration Script
# This script manually runs the email verification migration to fix the EMAIL_VERIFICATION_ENABLED issue
# Run this on your server if auto-migration fails

set -e  # Exit on error

echo "========================================"
echo "EMAIL VERIFICATION MIGRATION"
echo "========================================"
echo ""

# Auto-detect database credentials
# Use docker-compose defaults (from docker-compose.unified.yml)
DB_NAME=lto_blockchain
DB_USER=lto_user
DB_HOST=postgres

# Optionally override from .env if it has uncommented values
if [ -f .env ]; then
    ENV_DB_NAME=$(grep "^DB_NAME=" .env | cut -d= -f2 | tr -d '"' | tr -d "'" | xargs)
    ENV_DB_USER=$(grep "^DB_USER=" .env | cut -d= -f2 | tr -d '"' | tr -d "'" | xargs)
    ENV_DB_HOST=$(grep "^DB_HOST=" .env | cut -d= -f2 | tr -d '"' | tr -d "'" | xargs)
    
    # Only use .env values if they're not empty (handles commented lines)
    [ -n "$ENV_DB_NAME" ] && DB_NAME="$ENV_DB_NAME"
    [ -n "$ENV_DB_USER" ] && DB_USER="$ENV_DB_USER"
    [ -n "$ENV_DB_HOST" ] && DB_HOST="$ENV_DB_HOST"
fi

echo "Database Configuration:"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo "  Host: $DB_HOST"
echo ""

# Check if migration file exists
MIGRATION_FILE="backend/migrations/add_email_verification.sql"
if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ ERROR: Migration file not found: $MIGRATION_FILE"
    echo "   Please ensure you're running this script from the project root directory"
    exit 1
fi

echo "✅ Migration file found: $MIGRATION_FILE"
echo ""

# Step 1: Ensure UUID extension exists
echo "Step 1: Ensuring UUID extension exists..."
docker compose -f docker-compose.unified.yml exec -T postgres psql \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";" 2>&1

if [ $? -eq 0 ]; then
    echo "✅ UUID extension check complete"
else
    echo "❌ ERROR: Failed to create UUID extension"
    exit 1
fi

echo ""

# Step 2: Run migration
echo "Step 2: Running email verification migration..."
docker compose -f docker-compose.unified.yml exec -T postgres psql \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  < "$MIGRATION_FILE" 2>&1

if [ $? -eq 0 ]; then
    echo "✅ Migration SQL executed successfully"
else
    echo "❌ ERROR: Migration failed"
    exit 1
fi

echo ""

# Step 3: Verify table was created
echo "Step 3: Verifying email_verification_tokens table exists..."
TABLE_EXISTS=$(docker compose -f docker-compose.unified.yml exec -T postgres psql \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'email_verification_tokens');" 2>&1 | xargs)

if [ "$TABLE_EXISTS" = "t" ]; then
    echo "✅ email_verification_tokens table exists"
else
    echo "❌ ERROR: email_verification_tokens table was not created"
    exit 1
fi

echo ""

# Step 4: Verify email_verified column exists
echo "Step 4: Verifying email_verified column exists in users table..."
COLUMN_EXISTS=$(docker compose -f docker-compose.unified.yml exec -T postgres psql \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -t -c "SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'email_verified');" 2>&1 | xargs)

if [ "$COLUMN_EXISTS" = "t" ]; then
    echo "✅ email_verified column exists in users table"
else
    echo "⚠️  WARNING: email_verified column was not found (may already exist or migration incomplete)"
fi

echo ""

# Step 5: Check for cleanup function
echo "Step 5: Verifying cleanup function exists..."
FUNCTION_EXISTS=$(docker compose -f docker-compose.unified.yml exec -T postgres psql \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -t -c "SELECT EXISTS (SELECT FROM pg_proc WHERE proname = 'cleanup_expired_verification_tokens');" 2>&1 | xargs)

if [ "$FUNCTION_EXISTS" = "t" ]; then
    echo "✅ cleanup_expired_verification_tokens function exists"
else
    echo "⚠️  WARNING: cleanup function was not found"
fi

echo ""

# Summary
echo "========================================"
echo "MIGRATION SUMMARY"
echo "========================================"
echo "✅ Migration completed successfully"
echo ""
echo "Next steps:"
echo "1. Restart the application:"
echo "   docker compose -f docker-compose.unified.yml restart lto-app"
echo ""
echo "2. Check logs for EMAIL_VERIFICATION_ENABLED status:"
echo "   docker compose -f docker-compose.unified.yml logs lto-app | grep -i 'email verification'"
echo ""
echo "3. You should see: '📧 Email verification: Enabled ✓'"
echo ""
echo "4. Test by registering a new user and checking for verification email"
echo "========================================"
