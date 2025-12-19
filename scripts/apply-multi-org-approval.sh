#!/bin/bash

# ======================================================
# TrustChain LTO - Apply Multi-Organization Approval Schema
# Adds organization approval tracking columns to transfer_requests table
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

print_header "Applying Multi-Organization Approval Database Schema"

# Check if PostgreSQL container is running
if ! docker ps | grep -q postgres; then
    print_error "PostgreSQL container is not running"
    print_info "Start it with: docker-compose -f docker-compose.unified.yml up -d postgres"
    exit 1
fi

print_success "PostgreSQL container is running"

# Check if schema file exists
SCHEMA_FILE="database/add-multi-org-approval.sql"
if [ ! -f "$SCHEMA_FILE" ]; then
    print_error "Schema file not found: $SCHEMA_FILE"
    exit 1
fi

print_info "Found schema file: $SCHEMA_FILE"

# Apply schema
print_info "Applying schema to database..."
if docker exec -i postgres psql -U lto_user -d lto_blockchain < "$SCHEMA_FILE" 2>&1; then
    print_success "Schema applied successfully!"
    print_info "Multi-organization approval columns added to transfer_requests table"
    print_info "You can now use the new approval endpoints for HPG, Insurance, and Emission"
else
    print_error "Failed to apply schema"
    exit 1
fi

print_header "Migration Complete"
