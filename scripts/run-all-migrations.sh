#!/bin/bash
# Run All Critical Database Migrations
# This script runs all required migrations for LTO Admin/Officer functionality

set -e  # Exit on error

echo "=========================================="
echo "LTO Database Migration Script"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if postgres container exists
if ! docker ps | grep -q postgres; then
    echo -e "${RED}❌ Error: PostgreSQL container not found${NC}"
    echo "Please ensure Docker containers are running:"
    echo "  docker compose -f docker-compose.unified.yml up -d postgres"
    exit 1
fi

echo -e "${GREEN}✅ PostgreSQL container found${NC}"
echo ""

# Function to run migration
run_migration() {
    local file=$1
    local description=$2
    
    echo -e "${YELLOW}📦 Running: $description${NC}"
    echo "   File: $file"
    
    if docker exec -i postgres psql -U lto_user -d lto_blockchain < "$file" 2>&1 | grep -i "error\|fatal"; then
        echo -e "${RED}❌ Migration failed: $file${NC}"
        return 1
    else
        echo -e "${GREEN}✅ Migration completed: $description${NC}"
        echo ""
        return 0
    fi
}

# Phase 1: Core Application Migrations
echo "=========================================="
echo "Phase 1: Core Application Migrations"
echo "=========================================="
echo ""

run_migration "backend/migrations/add_refresh_tokens.sql" "Refresh Tokens & Sessions"
run_migration "backend/migrations/add_token_blacklist.sql" "Token Blacklist"
run_migration "backend/migrations/add_email_verification.sql" "Email Verification"

# Phase 2: Vehicle & Inspection Migrations
echo "=========================================="
echo "Phase 2: Vehicle & Inspection Migrations"
echo "=========================================="
echo ""

run_migration "backend/migrations/add-inspection-columns.sql" "Inspection Columns"
run_migration "backend/migrations/add-expiry-tracking.sql" "Expiry Tracking"
run_migration "database/migrations/add-blockchain-tx-id-to-vehicles.sql" "Blockchain TX ID"

# Phase 2.5: Transfer & Registration Workflow (Required before officer metrics view)
echo "=========================================="
echo "Phase 2.5: Transfer & Registration Workflow"
echo "=========================================="
echo ""

run_migration "database/migrations/007_registration_workflow_and_transfer_ownership.sql" "Registration Workflow & Transfer Ownership"

# Phase 3: LTO Roles (CRITICAL)
echo "=========================================="
echo "Phase 3: LTO Admin/Officer Roles (CRITICAL)"
echo "=========================================="
echo ""

run_migration "database/migrations/006_add_officer_roles_and_tracking.sql" "Officer Roles & Tracking"

# Verification
echo "=========================================="
echo "Verification"
echo "=========================================="
echo ""

echo -e "${YELLOW}🔍 Checking user_role enum values...${NC}"
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT unnest(enum_range(NULL::user_role)) as role_values ORDER BY role_values;" 2>/dev/null || echo "⚠️  Could not verify enum"

echo ""
echo -e "${YELLOW}🔍 Checking critical tables...${NC}"
docker exec postgres psql -U lto_user -d lto_blockchain -c "\dt" | grep -E "refresh_tokens|token_blacklist|sessions|email_verification_tokens|officer_activity_log" || echo "⚠️  Some tables may not exist"

echo ""
echo -e "${YELLOW}🔍 Checking critical functions...${NC}"
docker exec postgres psql -U lto_user -d lto_blockchain -c "\df" | grep -E "cleanup_expired_blacklist|cleanup_expired_verification_tokens" || echo "⚠️  Some functions may not exist"

echo ""
echo "=========================================="
echo -e "${GREEN}✅ All migrations completed!${NC}"
echo "=========================================="
echo ""
echo "📋 Next Steps:"
echo "1. Create LTO accounts:"
echo "   docker exec -i postgres psql -U lto_user -d lto_blockchain < database/create-lto-admin-officer-accounts.sql"
echo ""
echo "2. Restart application:"
echo "   docker compose -f docker-compose.unified.yml restart lto-app"
echo ""
echo "3. Test login with:"
echo "   - ltoadmin@lto.gov.ph (password: admin123)"
echo "   - ltofficer@lto.gov.ph (password: admin123)"
echo ""
