#!/bin/bash
# Verify that clearance workflow migration was successful

echo "🔍 Verifying clearance workflow migration..."
echo ""

docker exec postgres psql -U lto_user -d lto_blockchain -c "\d clearance_requests" 2>/dev/null | head -20
echo ""
docker exec postgres psql -U lto_user -d lto_blockchain -c "\d certificates" 2>/dev/null | head -20
echo ""
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT COUNT(*) as clearance_requests_count FROM clearance_requests;" 2>/dev/null
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT COUNT(*) as certificates_count FROM certificates;" 2>/dev/null

echo ""
echo "✅ Migration verification complete!"

