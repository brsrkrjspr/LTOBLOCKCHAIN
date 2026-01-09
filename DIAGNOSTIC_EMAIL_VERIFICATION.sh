#!/bin/bash
# Diagnostic script to check email verification setup

echo "========================================"
echo "EMAIL VERIFICATION DIAGNOSTIC"
echo "========================================"
echo ""

# Auto-detect database credentials
# Use docker-compose defaults (from docker-compose.unified.yml)
DB_NAME=lto_blockchain
DB_USER=lto_user

# Optionally override from .env if it has uncommented values
if [ -f .env ]; then
    ENV_DB_NAME=$(grep "^DB_NAME=" .env | cut -d= -f2 | tr -d '"' | tr -d "'" | xargs)
    ENV_DB_USER=$(grep "^DB_USER=" .env | cut -d= -f2 | tr -d '"' | tr -d "'" | xargs)
    
    # Only use .env values if they're not empty (handles commented lines)
    [ -n "$ENV_DB_NAME" ] && DB_NAME="$ENV_DB_NAME"
    [ -n "$ENV_DB_USER" ] && DB_USER="$ENV_DB_USER"
fi

echo "Using database credentials:"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo ""

# Check 1: Is email_verification_tokens table present?
echo "1. Checking if email_verification_tokens table exists..."
docker compose -f docker-compose.unified.yml exec postgres psql -U "$DB_USER" -d "$DB_NAME" -c \
  "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'email_verification_tokens');" 2>&1

echo ""
echo "2. Checking if email_verified column exists in users table..."
docker compose -f docker-compose.unified.yml exec postgres psql -U "$DB_USER" -d "$DB_NAME" -c \
  "SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'email_verified');" 2>&1

echo ""
echo "3. Checking EMAIL_VERIFICATION_ENABLED status in logs..."
docker compose -f docker-compose.unified.yml logs lto-app | grep -i "email verification" | tail -5

echo ""
echo "4. Checking for email sending errors..."
docker compose -f docker-compose.unified.yml logs lto-app | grep -i "failed to send\|error\|email" | tail -10

echo ""
echo "5. Checking Gmail environment variables are set..."
docker compose -f docker-compose.unified.yml exec lto-app env | grep GMAIL | head -4

echo ""
echo "6. Checking for verification tokens in database..."
docker compose -f docker-compose.unified.yml exec postgres psql -U "$DB_USER" -d "$DB_NAME" -c \
  "SELECT COUNT(*) as verification_tokens FROM email_verification_tokens;" 2>&1

echo ""
echo "7. Checking recent users and their email_verified status..."
docker compose -f docker-compose.unified.yml exec postgres psql -U "$DB_USER" -d "$DB_NAME" -c \
  "SELECT id, email, email_verified, created_at FROM users ORDER BY created_at DESC LIMIT 5;" 2>&1

echo ""
echo "========================================"
echo "END DIAGNOSTIC"
echo "========================================"
