#!/bin/bash
# TrustChain LTO - Fix Password Mismatch
# Updates docker-compose.unified.yml to use POSTGRES_PASSWORD from .env
# Then restarts containers to apply the change

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

log_info "Fixing password mismatch in docker-compose.unified.yml..."

# Check if docker-compose.unified.yml exists
if [ ! -f "docker-compose.unified.yml" ]; then
    log_error "docker-compose.unified.yml not found!"
    exit 1
fi

# Backup the file
log_info "Creating backup..."
cp docker-compose.unified.yml docker-compose.unified.yml.backup
log_success "Backup created: docker-compose.unified.yml.backup"

# Check current DB_PASSWORD setting
CURRENT_DB_PASSWORD=$(grep "DB_PASSWORD=" docker-compose.unified.yml | head -1 || echo "")
log_info "Current DB_PASSWORD setting: ${CURRENT_DB_PASSWORD}"

# Update DB_PASSWORD to use environment variable
log_info "Updating DB_PASSWORD to use POSTGRES_PASSWORD from .env..."
sed -i 's/DB_PASSWORD=lto_password/DB_PASSWORD=${POSTGRES_PASSWORD:-lto_password}/g' docker-compose.unified.yml

# Verify the change
NEW_DB_PASSWORD=$(grep "DB_PASSWORD=" docker-compose.unified.yml | head -1 || echo "")
if echo "$NEW_DB_PASSWORD" | grep -q '\${POSTGRES_PASSWORD'; then
    log_success "docker-compose.unified.yml updated successfully!"
    log_info "New DB_PASSWORD setting: ${NEW_DB_PASSWORD}"
else
    log_error "Failed to update docker-compose.unified.yml"
    log_info "Restoring backup..."
    mv docker-compose.unified.yml.backup docker-compose.unified.yml
    exit 1
fi

# Restart containers to apply the change
log_info "Restarting application container to apply password change..."
docker compose -f docker-compose.unified.yml restart lto-app

log_info "Waiting 5 seconds for container to restart..."
sleep 5

# Verify the fix
log_info "Verifying password fix..."
bash scripts/verify-passwords.sh

log_success "Password mismatch fix completed!"
log_info "Try logging in to the application now."

