#!/bin/bash
# Script to check vehicle documents in the database
# Usage: ./scripts/check-vehicle-documents.sh

echo "🔍 Checking documents for vehicle: df1db102-2eb7-42d1-b622-454300a5c943"
echo ""

# Run SQL queries
docker exec postgres psql -U lto_user -d lto_blockchain -f /app/scripts/check-vehicle-documents.sql

echo ""
echo "✅ Diagnostic queries completed"
