#!/bin/bash

# ======================================================
# TrustChain LTO - Apply OR/CR Number Migration
# Adds OR/CR number support to vehicles table
# ======================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo -e "\n${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC}  $1"
    echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}\n"
}

print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }
print_info() { echo -e "${YELLOW}ℹ️  $1${NC}"; }

# Change to script directory's parent (project root)
cd "$(dirname "$0")/.."

print_header "Applying OR/CR Number Migration"

# Check if running in Docker environment
if docker ps | grep -q postgres; then
    print_info "Detected Docker environment - using docker exec"
    
    # Apply migration via Docker
    if docker exec -i postgres psql -U lto_user -d lto_blockchain < database/add-or-cr-number.sql; then
        print_success "Migration applied successfully via Docker!"
    else
        print_error "Migration failed via Docker"
        exit 1
    fi
else
    print_info "Docker not detected - attempting direct PostgreSQL connection"
    
    # Try direct connection (for SSH deployment)
    # Adjust these variables based on your environment
    DB_HOST="${DB_HOST:-localhost}"
    DB_PORT="${DB_PORT:-5432}"
    DB_NAME="${DB_NAME:-lto_blockchain}"
    DB_USER="${DB_USER:-lto_user}"
    
    print_info "Connecting to PostgreSQL: ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
    
    if PGPASSWORD="${POSTGRES_PASSWORD:-lto_password}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f database/add-or-cr-number.sql; then
        print_success "Migration applied successfully via direct connection!"
    else
        print_error "Migration failed via direct connection"
        print_info "Please ensure PostgreSQL is accessible and credentials are correct"
        exit 1
    fi
fi

# Verify migration
print_info "Verifying migration..."

if docker ps | grep -q postgres; then
    VERIFY_RESULT=$(docker exec postgres psql -U lto_user -d lto_blockchain -t -c "SELECT COUNT(*) FROM information_schema.columns WHERE table_name='vehicles' AND column_name='or_cr_number';" 2>/dev/null | tr -d ' ')
else
    VERIFY_RESULT=$(PGPASSWORD="${POSTGRES_PASSWORD:-lto_password}" psql -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" -U "${DB_USER:-lto_user}" -d "${DB_NAME:-lto_blockchain}" -t -c "SELECT COUNT(*) FROM information_schema.columns WHERE table_name='vehicles' AND column_name='or_cr_number';" 2>/dev/null | tr -d ' ')
fi

if [ "$VERIFY_RESULT" = "1" ]; then
    print_success "Migration verified: or_cr_number column exists"
else
    print_error "Migration verification failed: or_cr_number column not found"
    exit 1
fi

# Check sequence
print_info "Checking sequence..."

if docker ps | grep -q postgres; then
    SEQ_EXISTS=$(docker exec postgres psql -U lto_user -d lto_blockchain -t -c "SELECT COUNT(*) FROM pg_sequences WHERE sequencename='or_cr_number_seq';" 2>/dev/null | tr -d ' ')
else
    SEQ_EXISTS=$(PGPASSWORD="${POSTGRES_PASSWORD:-lto_password}" psql -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" -U "${DB_USER:-lto_user}" -d "${DB_NAME:-lto_blockchain}" -t -c "SELECT COUNT(*) FROM pg_sequences WHERE sequencename='or_cr_number_seq';" 2>/dev/null | tr -d ' ')
fi

if [ "$SEQ_EXISTS" = "1" ]; then
    print_success "Migration verified: or_cr_number_seq sequence exists"
else
    print_error "Migration verification failed: or_cr_number_seq sequence not found"
    exit 1
fi

print_success "OR/CR number migration completed successfully!"
print_info "The system is now ready to generate OR/CR numbers for vehicle registrations."

