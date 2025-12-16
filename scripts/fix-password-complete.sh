#!/bin/bash
# TrustChain LTO - Complete Password Fix
# Ensures .env, docker-compose, and containers all use the same password

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

log_info "=== Complete Password Fix ==="
echo ""

# Step 1: Check current .env file
log_info "Step 1: Checking .env file..."
if [ ! -f ".env" ]; then
    log_error ".env file not found!"
    exit 1
fi

ENV_PASSWORD=$(grep "^POSTGRES_PASSWORD=" .env | cut -d'=' -f2 | tr -d '"' | tr -d "'" | tr -d ' ' || echo "")
if [ -z "$ENV_PASSWORD" ]; then
    log_error "POSTGRES_PASSWORD not found in .env file!"
    exit 1
fi

log_info "Found in .env: POSTGRES_PASSWORD=${ENV_PASSWORD:0:15}..."
echo ""

# Step 2: Check what PostgreSQL is actually using
log_info "Step 2: Checking PostgreSQL container password..."
POSTGRES_CONTAINER_PASSWORD=$(docker exec postgres env 2>/dev/null | grep "^POSTGRES_PASSWORD=" | cut -d'=' -f2 || echo "")
if [ -z "$POSTGRES_CONTAINER_PASSWORD" ]; then
    log_error "Could not read PostgreSQL container password!"
    exit 1
fi

log_info "PostgreSQL container uses: ${POSTGRES_CONTAINER_PASSWORD:0:15}..."
echo ""

# Step 3: Determine which password to use
if [ "$ENV_PASSWORD" != "$POSTGRES_CONTAINER_PASSWORD" ]; then
    log_warn "⚠️  .env password differs from PostgreSQL container password!"
    log_warn "PostgreSQL container password will be used (data already exists with this password)"
    USE_PASSWORD="$POSTGRES_CONTAINER_PASSWORD"
    log_info "Will update .env to match PostgreSQL container password"
else
    USE_PASSWORD="$ENV_PASSWORD"
    log_success "Passwords match, using: ${USE_PASSWORD:0:15}..."
fi
echo ""

# Step 4: Update .env file if needed
if [ "$ENV_PASSWORD" != "$POSTGRES_CONTAINER_PASSWORD" ]; then
    log_info "Step 3: Updating .env file to match PostgreSQL container..."
    # Backup .env
    cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
    
    # Update POSTGRES_PASSWORD in .env
    if grep -q "^POSTGRES_PASSWORD=" .env; then
        sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${POSTGRES_CONTAINER_PASSWORD}|" .env
        log_success ".env file updated"
    else
        echo "POSTGRES_PASSWORD=${POSTGRES_CONTAINER_PASSWORD}" >> .env
        log_success "POSTGRES_PASSWORD added to .env"
    fi
else
    log_info "Step 3: .env file already matches PostgreSQL container (skipping update)"
fi
echo ""

# Step 5: Update docker-compose.unified.yml
log_info "Step 4: Updating docker-compose.unified.yml..."
if [ ! -f "docker-compose.unified.yml" ]; then
    log_error "docker-compose.unified.yml not found!"
    exit 1
fi

# Backup docker-compose
cp docker-compose.unified.yml docker-compose.unified.yml.backup.$(date +%Y%m%d_%H%M%S)

# Update DB_PASSWORD to use environment variable
if grep -q "DB_PASSWORD=lto_password" docker-compose.unified.yml; then
    sed -i 's/DB_PASSWORD=lto_password/DB_PASSWORD=${POSTGRES_PASSWORD:-lto_password}/g' docker-compose.unified.yml
    log_success "Updated DB_PASSWORD in docker-compose.unified.yml"
elif grep -q "DB_PASSWORD=\${POSTGRES_PASSWORD" docker-compose.unified.yml; then
    log_info "docker-compose.unified.yml already uses environment variable (OK)"
else
    log_warn "Could not find DB_PASSWORD in docker-compose.unified.yml"
fi
echo ""

# Step 6: Recreate containers to pick up new environment
log_info "Step 5: Recreating application container with correct password..."
log_warn "This will temporarily stop the application container..."

# Stop and remove lto-app container
docker compose -f docker-compose.unified.yml stop lto-app
docker compose -f docker-compose.unified.yml rm -f lto-app

# Start it again (will read from .env)
docker compose -f docker-compose.unified.yml up -d lto-app

log_info "Waiting 10 seconds for container to start..."
sleep 10
echo ""

# Step 7: Verify the fix
log_info "Step 6: Verifying password fix..."
echo ""

# Check application container password
APP_PASSWORD=$(docker exec lto-app env 2>/dev/null | grep "^DB_PASSWORD=" | cut -d'=' -f2 || echo "")
if [ -n "$APP_PASSWORD" ]; then
    log_info "Application container DB_PASSWORD: ${APP_PASSWORD:0:15}..."
    if [ "$APP_PASSWORD" = "$POSTGRES_CONTAINER_PASSWORD" ]; then
        log_success "✅ PASSWORDS MATCH!"
    else
        log_error "❌ Passwords still don't match!"
        log_error "   PostgreSQL: ${POSTGRES_CONTAINER_PASSWORD:0:15}..."
        log_error "   Application: ${APP_PASSWORD:0:15}..."
    fi
else
    log_error "Could not read application container password!"
fi
echo ""

# Test connection
log_info "Testing database connection..."
if docker exec lto-app node -e "
const db = require('./backend/database/db');
db.testConnection().then(result => {
    if (result) {
        console.log('✅ Database connection successful!');
        process.exit(0);
    } else {
        console.log('❌ Database connection failed');
        process.exit(1);
    }
}).catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});
" 2>/dev/null; then
    log_success "✅ Database connection test PASSED!"
else
    log_error "❌ Database connection test FAILED"
    log_info "Check logs: docker compose -f docker-compose.unified.yml logs lto-app"
fi

echo ""
log_success "=== Password Fix Complete ==="
log_info "Try logging into the application now."

