#!/bin/bash
# TrustChain LTO - Database Contents Inspection Script
# Shows actual data stored in PostgreSQL and IPFS

echo "🔍 Checking Database Contents..."
echo ""

# Database connection details
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-lto_blockchain}"
DB_USER="${DB_USER:-lto_user}"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Function to run SQL query
run_query() {
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -A -c "$1" 2>/dev/null
}

# Function to run formatted query
run_query_formatted() {
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "$1" 2>/dev/null
}

echo "📊 DATABASE CONTENTS SUMMARY"
echo "================================"
echo ""

# Count all tables
echo "📋 Table Row Counts:"
echo ""

TABLES=("users" "vehicles" "documents" "vehicle_verifications" "transfer_requests" "transfer_documents" "vehicle_history" "notifications")

for table in "${TABLES[@]}"; do
    count=$(run_query "SELECT COUNT(*) FROM $table;")
    echo "  $table: $count rows"
done

echo ""
echo "📋 USERS TABLE"
echo "================================"
run_query_formatted "SELECT id, email, first_name, last_name, role, is_active, created_at FROM users ORDER BY created_at DESC LIMIT 10;"

echo ""
echo "📋 VEHICLES TABLE"
echo "================================"
run_query_formatted "SELECT id, vin, plate_number, make, model, year, status, owner_id, registration_date FROM vehicles ORDER BY registration_date DESC LIMIT 10;"

echo ""
echo "📋 DOCUMENTS TABLE"
echo "================================"
run_query_formatted "SELECT id, vehicle_id, document_type, original_name, file_size, ipfs_cid, verified, uploaded_at FROM documents ORDER BY uploaded_at DESC LIMIT 10;"

echo ""
echo "📋 Documents by Type:"
run_query_formatted "SELECT document_type, COUNT(*) as count, COUNT(CASE WHEN ipfs_cid IS NOT NULL THEN 1 END) as with_ipfs FROM documents GROUP BY document_type ORDER BY count DESC;"

echo ""
echo "📋 TRANSFER REQUESTS TABLE"
echo "================================"
run_query_formatted "SELECT id, vehicle_id, seller_id, buyer_id, status, submitted_at, reviewed_at FROM transfer_requests ORDER BY submitted_at DESC LIMIT 10;"

echo ""
echo "📋 Transfer Requests by Status:"
run_query_formatted "SELECT status, COUNT(*) as count FROM transfer_requests GROUP BY status ORDER BY count DESC;"

echo ""
echo "📋 TRANSFER DOCUMENTS TABLE"
echo "================================"
run_query_formatted "SELECT id, transfer_request_id, document_type, document_id, uploaded_at FROM transfer_documents ORDER BY uploaded_at DESC LIMIT 10;"

echo ""
echo "📋 Transfer Documents by Type:"
run_query_formatted "SELECT document_type, COUNT(*) as count FROM transfer_documents GROUP BY document_type ORDER BY count DESC;"

echo ""
echo "📋 VEHICLE VERIFICATIONS TABLE"
echo "================================"
run_query_formatted "SELECT id, vehicle_id, verification_type, status, verified_by, verified_at FROM vehicle_verifications ORDER BY verified_at DESC LIMIT 10;"

echo ""
echo "📋 VEHICLE HISTORY TABLE"
echo "================================"
run_query_formatted "SELECT id, vehicle_id, action, description, performed_by, performed_at FROM vehicle_history ORDER BY performed_at DESC LIMIT 10;"

echo ""
echo "📋 NOTIFICATIONS TABLE"
echo "================================"
run_query_formatted "SELECT id, user_id, title, type, read, sent_at FROM notifications ORDER BY sent_at DESC LIMIT 10;"

echo ""
echo "📋 IPFS DOCUMENTS (Documents with IPFS CID)"
echo "================================"
run_query_formatted "SELECT id, document_type, original_name, ipfs_cid, file_size, uploaded_at FROM documents WHERE ipfs_cid IS NOT NULL ORDER BY uploaded_at DESC LIMIT 10;"

echo ""
echo "📊 IPFS Statistics:"
IPFS_COUNT=$(run_query "SELECT COUNT(*) FROM documents WHERE ipfs_cid IS NOT NULL;")
TOTAL_DOCS=$(run_query "SELECT COUNT(*) FROM documents;")
echo "  Documents with IPFS CID: $IPFS_COUNT / $TOTAL_DOCS"
if [ "$TOTAL_DOCS" -gt 0 ]; then
    PERCENTAGE=$((IPFS_COUNT * 100 / TOTAL_DOCS))
    echo "  IPFS Coverage: $PERCENTAGE%"
fi

echo ""
echo "✅ Database contents check complete!"
