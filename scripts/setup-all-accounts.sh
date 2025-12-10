#!/bin/bash

# Script to create all real accounts in the database
# This script generates password hashes and creates accounts

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }
print_info() { echo -e "${YELLOW}ℹ️  $1${NC}"; }

echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║${NC}  Setting Up Real Accounts in Database"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Cannot generate password hashes."
    exit 1
fi

# Generate password hashes
print_info "Generating password hashes..."

ADMIN_HASH=$(node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('admin123', 12).then(h => console.log(h));" 2>/dev/null | tail -1)
SECURE_HASH=$(node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('SecurePass123!', 12).then(h => console.log(h));" 2>/dev/null | tail -1)

if [ -z "$ADMIN_HASH" ] || [ -z "$SECURE_HASH" ]; then
    print_error "Failed to generate password hashes"
    exit 1
fi

print_success "Password hashes generated"

# Create SQL file with actual hashes
SQL_FILE="database/create-real-accounts-actual.sql"

cat > "$SQL_FILE" << EOF
-- TrustChain LTO - Create Real Accounts for All Organizations
-- Generated automatically with correct password hashes

-- ============================================
-- LTO ADMIN
-- ============================================
INSERT INTO users (email, password_hash, first_name, last_name, role, organization, phone, is_active, email_verified)
VALUES (
    'admin@lto.gov.ph',
    '$ADMIN_HASH',
    'LTO',
    'Administrator',
    'admin',
    'Land Transportation Office',
    '+63 2 1234 5678',
    true,
    true
)
ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    role = 'admin',
    organization = 'Land Transportation Office',
    is_active = true,
    email_verified = true;

-- ============================================
-- HPG ADMIN
-- ============================================
INSERT INTO users (email, password_hash, first_name, last_name, role, organization, phone, is_active, email_verified)
VALUES (
    'hpgadmin@hpg.gov.ph',
    '$SECURE_HASH',
    'HPG',
    'Administrator',
    'admin',
    'Highway Patrol Group',
    '+63 2 2345 6789',
    true,
    true
)
ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    role = 'admin',
    organization = 'Highway Patrol Group',
    is_active = true,
    email_verified = true;

-- ============================================
-- INSURANCE VERIFIER
-- ============================================
INSERT INTO users (email, password_hash, first_name, last_name, role, organization, phone, is_active, email_verified)
VALUES (
    'insurance@insurance.gov.ph',
    '$SECURE_HASH',
    'Insurance',
    'Verifier',
    'insurance_verifier',
    'Insurance Verification Office',
    '+63 2 3456 7890',
    true,
    true
)
ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    role = 'insurance_verifier',
    organization = 'Insurance Verification Office',
    is_active = true,
    email_verified = true;

-- ============================================
-- EMISSION VERIFIER
-- ============================================
INSERT INTO users (email, password_hash, first_name, last_name, role, organization, phone, is_active, email_verified)
VALUES (
    'emission@emission.gov.ph',
    '$SECURE_HASH',
    'Emission',
    'Verifier',
    'emission_verifier',
    'Emission Testing Center',
    '+63 2 4567 8901',
    true,
    true
)
ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    role = 'emission_verifier',
    organization = 'Emission Testing Center',
    is_active = true,
    email_verified = true;

-- ============================================
-- VEHICLE OWNER (Sample account)
-- ============================================
INSERT INTO users (email, password_hash, first_name, last_name, role, organization, phone, is_active, email_verified)
VALUES (
    'owner@example.com',
    '$SECURE_HASH',
    'John',
    'Doe',
    'vehicle_owner',
    NULL,
    '+63 912 345 6789',
    true,
    true
)
ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    role = 'vehicle_owner',
    is_active = true,
    email_verified = true;

-- ============================================
-- VERIFY ACCOUNTS CREATED
-- ============================================
SELECT 
    email,
    first_name || ' ' || last_name as name,
    role,
    organization,
    is_active,
    email_verified
FROM users
WHERE email IN (
    'admin@lto.gov.ph',
    'hpgadmin@hpg.gov.ph',
    'insurance@insurance.gov.ph',
    'emission@emission.gov.ph',
    'owner@example.com'
)
ORDER BY role, email;
EOF

print_success "SQL file created: $SQL_FILE"

# Check if PostgreSQL container is running
if ! docker ps | grep -q postgres; then
    print_error "PostgreSQL container is not running"
    print_info "Start it with: docker-compose up -d postgres"
    exit 1
fi

# Execute SQL
print_info "Creating accounts in database..."
docker exec -i postgres psql -U lto_user -d lto_blockchain < "$SQL_FILE"

if [ $? -eq 0 ]; then
    print_success "All accounts created successfully!"
    echo ""
    print_info "Account credentials:"
    echo "  LTO Admin: admin@lto.gov.ph / admin123"
    echo "  HPG Admin: hpgadmin@hpg.gov.ph / SecurePass123!"
    echo "  Insurance: insurance@insurance.gov.ph / SecurePass123!"
    echo "  Emission: emission@emission.gov.ph / SecurePass123!"
    echo "  Owner: owner@example.com / SecurePass123!"
else
    print_error "Failed to create accounts"
    exit 1
fi

