#!/bin/bash
# TrustChain LTO - Apply Database Fix for completed_at Column
# This script adds the missing completed_at column to clearance_requests table

echo "🔧 Applying database fix for clearance_requests.completed_at column..."

# Check if postgres container is running
if ! docker ps --filter "name=postgres" --format "{{.Names}}" | grep -q postgres; then
    echo "❌ PostgreSQL container is not running!"
    echo "   Please start the database container first."
    exit 1
fi

echo "✅ PostgreSQL container found"

# Apply the SQL fix
echo "📝 Applying SQL migration..."

docker exec -i postgres psql -U lto_user -d lto_blockchain << 'SQL'
ALTER TABLE clearance_requests 
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;

COMMENT ON COLUMN clearance_requests.completed_at IS 'Timestamp when the clearance request was completed, approved, or rejected';
SQL

if [ $? -eq 0 ]; then
    echo "✅ Database fix applied successfully!"
    echo "   The completed_at column has been added to clearance_requests table."
else
    echo "❌ Failed to apply database fix!"
    exit 1
fi

echo ""
echo "✨ Done! You can now test Insurance and Emission approval workflows."
