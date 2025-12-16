#!/bin/bash
# TrustChain LTO - Fix Database Schema Issues
# Fixes transaction_id field length and other schema issues

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

log_info "=== Fixing Database Schema ==="
echo ""

# Check if postgres container is running
if ! docker compose -f docker-compose.unified.yml ps postgres | grep -q "Up"; then
    log_error "PostgreSQL container is not running"
    exit 1
fi

# Check current transaction_id column length
log_info "Checking current transaction_id column length..."
CURRENT_LENGTH=$(docker exec postgres psql -U lto_user -d lto_blockchain -t -c "SELECT character_maximum_length FROM information_schema.columns WHERE table_name = 'vehicle_history' AND column_name = 'transaction_id';" 2>/dev/null | tr -d ' ' || echo "100")

log_info "Current transaction_id length: $CURRENT_LENGTH"

if [ "$CURRENT_LENGTH" = "100" ] || [ "$CURRENT_LENGTH" = "-1" ]; then
    log_info "Updating transaction_id column to VARCHAR(255)..."
    
    docker exec postgres psql -U lto_user -d lto_blockchain -c "ALTER TABLE vehicle_history ALTER COLUMN transaction_id TYPE VARCHAR(255);" 2>/dev/null
    
    if [ $? -eq 0 ]; then
        log_success "✅ transaction_id column updated to VARCHAR(255)"
    else
        log_error "❌ Failed to update transaction_id column"
        exit 1
    fi
else
    log_success "✅ transaction_id column is already VARCHAR(255) or larger"
fi

echo ""
log_success "=== Database Schema Fix Complete ==="
log_info "Transaction IDs up to 255 characters are now supported"

