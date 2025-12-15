#!/bin/bash

# ======================================================
# TrustChain LTO - Apply Transfer Ownership Schema
# Applies the transfer_requests, transfer_documents, transfer_verifications tables
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

print_header "Applying Transfer Ownership Database Schema"

# Check if PostgreSQL container is running
if ! docker ps | grep -q postgres; then
    print_error "PostgreSQL container is not running"
    print_info "Start it with: docker-compose -f docker-compose.unified.yml up -d postgres"
    exit 1
fi

print_success "PostgreSQL container is running"

# Check if schema file exists
SCHEMA_FILE="database/add-transfer-ownership.sql"
if [ ! -f "$SCHEMA_FILE" ]; then
    print_error "Schema file not found: $SCHEMA_FILE"
    exit 1
fi

print_info "Found schema file: $SCHEMA_FILE"

# Apply schema
print_info "Applying schema to database..."
if docker exec -i postgres psql -U lto_user -d lto_blockchain < "$SCHEMA_FILE" 2>&1; then
    print_success "Schema applied successfully!"
else
    print_error "Failed to apply schema"
    print_info "Note: Some errors may be expected if tables already exist (IF NOT EXISTS)"
    exit 1
fi

# Verify tables were created
print_info "Verifying tables..."
TABLES=("transfer_requests" "transfer_documents" "transfer_verifications")
ALL_EXIST=true

for table in "${TABLES[@]}"; do
    if docker exec postgres psql -U lto_user -d lto_blockchain -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '$table');" | grep -q t; then
        print_success "Table '$table' exists"
    else
        print_error "Table '$table' does NOT exist"
        ALL_EXIST=false
    fi
done

if [ "$ALL_EXIST" = true ]; then
    print_success "All tables verified successfully!"
    echo ""
    print_info "Next steps:"
    echo "  1. Restart your Node.js server: npm start"
    echo "  2. Test the new endpoints (see scripts/test-transfer-apis.sh)"
else
    print_error "Some tables are missing. Check the error messages above."
    exit 1
fi

