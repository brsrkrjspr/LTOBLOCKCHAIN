#!/bin/bash
# TrustChain LTO - Database Schema Verification Script
# Checks if all required schema elements are in place for the transfer refactoring

echo "🔍 Checking Database Schema..."
echo ""

# Database connection details (adjust if needed)
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-lto_blockchain}"
DB_USER="${DB_USER:-lto_user}"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to run SQL query
run_query() {
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -A -c "$1" 2>/dev/null
}

# Function to check if query returns results
check_exists() {
    result=$(run_query "$1")
    if [ -n "$result" ] && [ "$result" != "" ]; then
        echo -e "${GREEN}✅${NC} $2"
        return 0
    else
        echo -e "${RED}❌${NC} $2"
        return 1
    fi
}

echo "📋 Checking Required Tables..."
echo ""

# Check if documents table exists
check_exists "SELECT 1 FROM information_schema.tables WHERE table_name = 'documents';" "documents table exists"

# Check if transfer_requests table exists
check_exists "SELECT 1 FROM information_schema.tables WHERE table_name = 'transfer_requests';" "transfer_requests table exists"

# Check if transfer_documents table exists
check_exists "SELECT 1 FROM information_schema.tables WHERE table_name = 'transfer_documents';" "transfer_documents table exists"

echo ""
echo "📋 Checking document_type ENUM Values..."
echo ""

# Get all ENUM values
ENUM_VALUES=$(run_query "SELECT enumlabel FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type') ORDER BY enumsortorder;")

REQUIRED_ENUMS=("registration_cert" "insurance_cert" "emission_cert" "owner_id" "deed_of_sale" "seller_id" "buyer_id" "other")

for enum in "${REQUIRED_ENUMS[@]}"; do
    if echo "$ENUM_VALUES" | grep -q "^$enum$"; then
        echo -e "${GREEN}✅${NC} ENUM value '$enum' exists"
    else
        echo -e "${RED}❌${NC} ENUM value '$enum' MISSING"
    fi
done

echo ""
echo "📋 Current ENUM Values:"
echo "$ENUM_VALUES" | while read -r value; do
    echo "  - $value"
done

echo ""
echo "📋 Checking documents Table Structure..."
echo ""

# Check documents table columns
check_exists "SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'document_type';" "documents.document_type column exists"
check_exists "SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'ipfs_cid';" "documents.ipfs_cid column exists"

# Check document_type is ENUM
ENUM_TYPE=$(run_query "SELECT udt_name FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'document_type';")
if [ "$ENUM_TYPE" = "document_type" ]; then
    echo -e "${GREEN}✅${NC} documents.document_type is ENUM type"
else
    echo -e "${RED}❌${NC} documents.document_type is NOT ENUM type (found: $ENUM_TYPE)"
fi

echo ""
echo "📋 Checking transfer_documents Table Structure..."
echo ""

# Check transfer_documents table columns
check_exists "SELECT 1 FROM information_schema.columns WHERE table_name = 'transfer_documents' AND column_name = 'document_type';" "transfer_documents.document_type column exists"

# Check CHECK constraint
CONSTRAINT=$(run_query "SELECT check_clause FROM information_schema.check_constraints WHERE constraint_name LIKE '%transfer_document%' LIMIT 1;")
if [ -n "$CONSTRAINT" ]; then
    echo -e "${GREEN}✅${NC} transfer_documents has CHECK constraint"
    echo "   Constraint: $CONSTRAINT"
else
    echo -e "${RED}❌${NC} transfer_documents CHECK constraint NOT FOUND"
fi

echo ""
echo "📋 Checking transfer_requests Table Structure..."
echo ""

REQUIRED_COLUMNS=("vehicle_id" "seller_id" "buyer_id" "buyer_info" "status")
for col in "${REQUIRED_COLUMNS[@]}"; do
    check_exists "SELECT 1 FROM information_schema.columns WHERE table_name = 'transfer_requests' AND column_name = '$col';" "transfer_requests.$col column exists"
done

echo ""
echo "📊 Summary:"
echo ""

# Count documents by type
echo "Documents by type:"
run_query "SELECT document_type, COUNT(*) as count FROM documents GROUP BY document_type ORDER BY document_type;" | while IFS='|' read -r type count; do
    echo "  $type: $count"
done

# Count transfer requests
TRANSFER_COUNT=$(run_query "SELECT COUNT(*) FROM transfer_requests;")
echo "Total transfer requests: $TRANSFER_COUNT"

# Count transfer documents
TRANSFER_DOCS_COUNT=$(run_query "SELECT COUNT(*) FROM transfer_documents;")
echo "Total transfer documents: $TRANSFER_DOCS_COUNT"

echo ""
echo "✅ Schema check complete!"
