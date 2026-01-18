#!/bin/bash
# Script to add missing document types (csr, hpg_clearance, sales_invoice) to document_type enum
# Usage: ./scripts/add-missing-document-types.sh

echo "🔧 Adding missing document types to document_type enum..."
echo ""

# Copy SQL file to container if needed
docker cp database/add-vehicle-registration-document-types.sql postgres:/tmp/add-vehicle-registration-document-types.sql

# Run migration
docker exec postgres psql -U lto_user -d lto_blockchain -f /tmp/add-vehicle-registration-document-types.sql

echo ""
echo "✅ Migration completed!"
echo ""
echo "Verifying enum values..."
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT enumlabel as document_type_value FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type') ORDER BY enumsortorder;"
