#!/bin/bash
set -e

# ==============================================================================
# 🛡️ LTO TrustChain - Database Restore / Undo
# ==============================================================================
# This script reverts the changes made by demo-attack-db.sh.
# It requires the .original_owner_<VIN>.txt file to exist.
# ==============================================================================

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${GREEN}====================================================${NC}"
echo -e "${GREEN}   🛡️  RESTORING DATABASE INTEGRITY  🛡️   ${NC}"
echo -e "${GREEN}====================================================${NC}"

if [ -z "$1" ]; then
    echo -e "${YELLOW}Usage: ./demo-restore-db.sh <VIN>${NC}"
    exit 1
fi

VIN="$1"
BACKUP_FILE=".original_owner_$VIN.txt"

if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}❌ Error: Backup file $BACKUP_FILE not found!${NC}"
    echo "   Cannot automatically restore. You must manually fix the DB."
    exit 1
fi

ORIGINAL_OWNER=$(cat "$BACKUP_FILE" | xargs)

echo -e "${CYAN}Target Vehicle VIN :${NC} $VIN"
echo -e "${CYAN}Restoring Owner ID :${NC} $ORIGINAL_OWNER"

# Execute Restore
echo -e "\n${YELLOW}Reverting Database Changes...${NC}"
docker exec postgres psql -U lto_user -d lto_blockchain -c "UPDATE vehicles SET owner_id='$ORIGINAL_OWNER' WHERE vin='$VIN';" > /dev/null

# Verify
CURRENT_OWNER=$(docker exec postgres psql -U lto_user -d lto_blockchain -t -c "SELECT owner_id FROM vehicles WHERE vin='$VIN';" | xargs)

if [ "$CURRENT_OWNER" == "$ORIGINAL_OWNER" ]; then
    echo -e "\n${GREEN}✅ SUCCESS: Database integrity restored.${NC}"
    rm "$BACKUP_FILE"
else
    echo -e "\n${RED}❌ FAILED: Owner ID mismatch. Expected $ORIGINAL_OWNER, got $CURRENT_OWNER${NC}"
fi
