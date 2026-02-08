#!/bin/bash
set -e

# ==============================================================================
# 🕵️ LTO TrustChain - Forensic Integrity Verification
# ==============================================================================
# This tool queries BOTH the PostgreSQL Database (Mutable) and the
# Hyperledger Fabric Blockchain (Immutable) to detect discrepancies.
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

echo -e "${CYAN}====================================================${NC}"
echo -e "${CYAN}   🕵️  TRUSTCHAIN FORENSIC AUDIT TOOL  🕵️   ${NC}"
echo -e "${CYAN}====================================================${NC}"

VIN="${1:-$TARGET_VIN}"

if [ -z "$VIN" ]; then
    echo -e "${YELLOW}Usage: ./verify-vehicle-integrity.sh <VIN>${NC}"
    echo -e "Or set TARGET_VIN in demo-config.env"
    exit 1
fi

echo -e "Auditing Vehicle VIN: ${YELLOW}$VIN${NC}...\n"

# 1. Fetch from Database (PostgreSQL)
echo -ne "1️⃣  Querying PostgreSQL Registration Database... "
# Use a JOIN to get the owner's email, as the blockchain uses email for identity
DB_JSON=$(docker exec postgres psql -U lto_user -d lto_blockchain -t -c "SELECT json_build_object('vin', v.vin, 'owner_email', u.email, 'status', v.status) FROM vehicles v JOIN users u ON v.owner_id = u.id WHERE v.vin='$VIN';" | head -n 1 | xargs)

if [ -z "$DB_JSON" ] || [ "$DB_JSON" == "{}" ]; then
    echo -e "${RED}NOT FOUND${NC}"
    echo -e "   Vehicle does not exist in the Database."
    exit 1
fi
echo -e "${GREEN}OK${NC}"
# Extract DB fields
DB_OWNER=$(echo "$DB_JSON" | grep -o '"owner_email" : "[^"]*"' | cut -d'"' -f4)
DB_STATUS=$(echo "$DB_JSON" | grep -o '"status" : "[^"]*"' | cut -d'"' -f4)

# 2. Fetch from Blockchain (Fabric)
echo -ne "2️⃣  Querying Hyperledger Fabric Ledger...        "
CHAIN_JSON=$(docker exec cli peer chaincode query -C ltochannel -n vehicle-registration -c "{\"Args\":[\"GetVehicle\", \"$VIN\"]}" 2>/dev/null)

if [ $? -ne 0 ] || [ -z "$CHAIN_JSON" ]; then
    echo -e "${RED}ERROR${NC}"
    echo -e "   Failed to query Chaincode or Vehicle not found on Chain."
    exit 1
fi
echo -e "${GREEN}OK${NC}"

# Extract Chain fields (using simple grep/cut to avoid jq dependency on minimal vps)
# We look for "email":"..." inside the owner object or anywhere in the JSON
# GetVehicle returns the full vehicle object which includes owner: { email: ... }
CHAIN_OWNER=$(echo "$CHAIN_JSON" | grep -o '"email":"[^"]*"' | head -n 1 | cut -d'"' -f4)
CHAIN_STATUS=$(echo "$CHAIN_JSON" | sed -n 's/.*"status":"\([^"]*\)".*/\1/p')

# 3. Compare and Report
echo -e "\n${YELLOW}=== 📊 COMPARISON REPORT ===${NC}"

MISMATCH=0

# Compare Owner
if [ "$DB_OWNER" != "$CHAIN_OWNER" ]; then
    echo -e "owner_email :"
    echo -e "   🏛️  Database : ${RED}$DB_OWNER${NC} (SUSPICIOUS)"
    echo -e "   🔗 Blockchain: ${GREEN}$CHAIN_OWNER${NC} (VERIFIED TRUTH)"
    MISMATCH=1
else
    echo -e "owner_email : ${GREEN}MATCH ✅${NC} ($DB_OWNER)"
fi

# Compare Status
if [ "$DB_STATUS" != "$CHAIN_STATUS" ]; then
    echo -e "status   :"
    echo -e "   🏛️  Database : ${RED}$DB_STATUS${NC}"
    echo -e "   🔗 Blockchain: ${GREEN}$CHAIN_STATUS${NC}"
    MISMATCH=1
else
    echo -e "status   : ${GREEN}MATCH ✅${NC} ($DB_STATUS)"
fi

echo -e "\n${YELLOW}=== 🏁 AUDIT CONCLUSION ===${NC}"
if [ $MISMATCH -eq 1 ]; then
    echo -e "${RED}🚨 CRITICAL ALERT: DATA TAMPERING DETECTED! 🚨${NC}"
    echo -e "The record in the database does NOT match the immutable ledger."
    echo -e "This vehicle has likely been compromised via a 'Technical Carnapping' attack."
else
    echo -e "${GREEN}✅ INTEGRITY CONFIRMED.${NC}"
    echo -e "The database record is perfectly synced with the Blockchain/Ledger."
fi
echo -e "${CYAN}====================================================${NC}"
