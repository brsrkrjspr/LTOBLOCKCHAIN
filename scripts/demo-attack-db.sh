#!/bin/bash
set -e

# ==============================================================================
# ⚔️ LTO TrustChain - Database Tampering Attack Simulation
# ==============================================================================
# This script simulates a "Technical Carnapping" attack where a rogue admin
# or hacker gains direct access to the PostgreSQL database and modifies
# vehicle ownership, bypassing the Blockchain.
# ==============================================================================

# Load Configuration
SCRIPT_DIR="$(dirname "$0")"
if [ -f "$SCRIPT_DIR/demo-config.env" ]; then
    source "$SCRIPT_DIR/demo-config.env"
fi

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${RED}====================================================${NC}"
echo -e "${RED}   ⚔️  SIMULATING DATABASE TAMPERING ATTACK  ⚔️   ${NC}"
echo -e "${RED}====================================================${NC}"

# 1. Input Validation
VIN="${1:-$TARGET_VIN}"
ATTACKER_ID="${2:-$HACKER_ID}"

# Fallback if config not loaded and no args
ATTACKER_ID="${ATTACKER_ID:-"36b86e7e-7668-49dc-8dd6-6610ce092a73"}" 

if [ -z "$VIN" ]; then
    echo -e "${YELLOW}Usage: ./demo-attack-db.sh <VIN> [HACKER_USER_ID]${NC}"
    echo -e "Or set TARGET_VIN in demo-config.env"
    exit 1
fi

echo -e "${CYAN}Target Vehicle VIN :${NC} $VIN"
echo -e "${CYAN}New Fake Owner ID  :${NC} $ATTACKER_ID"
echo ""

# 2. Check current state (Before Attack)
echo -e "${YELLOW}[1/4] Capturing State BEFORE Attack...${NC}"
CURRENT_OWNER=$(docker exec postgres psql -U lto_user -d lto_blockchain -t -c "SELECT owner_id FROM vehicles WHERE vin='$VIN';" | xargs)
CURRENT_STATUS=$(docker exec postgres psql -U lto_user -d lto_blockchain -t -c "SELECT status FROM vehicles WHERE vin='$VIN';" | xargs)

if [ -z "$CURRENT_OWNER" ]; then
    echo -e "${RED}❌ Error: Vehicle with VIN $VIN not found in Database!${NC}"
    exit 1
fi

echo -e "   Current Owner  : $CURRENT_OWNER"
echo -e "   Current Status : $CURRENT_STATUS"

# Save original owner for restore script (audit trail)
echo "$CURRENT_OWNER" > ".original_owner_$VIN.txt"
echo -e "${GREEN}   ✅ Backup saved to .original_owner_$VIN.txt${NC}"

# 3. Execute Attack
echo -e "\n${YELLOW}[2/4] Injecting Malicious SQL Update...${NC}"
echo -e "${RED}   >>> UPDATE vehicles SET owner_id='$ATTACKER_ID', status='REGISTERED' WHERE vin='$VIN';${NC}"

docker exec postgres psql -U lto_user -d lto_blockchain -c "UPDATE vehicles SET owner_id='$ATTACKER_ID', status='REGISTERED', updated_at=NOW() WHERE vin='$VIN';" > /dev/null

# 4. Verify Attack Success
echo -e "\n${YELLOW}[3/4] Verifying Dirty State...${NC}"
NEW_OWNER=$(docker exec postgres psql -U lto_user -d lto_blockchain -t -c "SELECT owner_id FROM vehicles WHERE vin='$VIN';" | xargs)

if [ "$NEW_OWNER" == "$ATTACKER_ID" ]; then
    echo -e "${GREEN}   ✅ SUCCESS: Database has been tampered with!${NC}"
    echo -e "   PostgreSQL now says Owner is: ${RED}$NEW_OWNER${NC}"
else
    echo -e "${RED}   ❌ FAILED: Database update did not persist.${NC}"
    exit 1
fi

# 5. The "Gotcha" Setup
echo -e "\n${YELLOW}[4/4] Attack Complete.${NC}"
echo -e "   The Dashboard will now display this vehicle as belonging to the Hacker."
echo -e "   However, the Immutable Ledger (Fabric) has NOT been touched."
echo -e "\n   👉 Run ${CYAN}./verify-vehicle-integrity.sh $VIN${NC} to expose the fraud!"
