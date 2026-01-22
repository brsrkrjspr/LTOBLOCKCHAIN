#!/bin/bash
# ============================================
# Reset Fabric and IPFS Volumes
# Compatible with docker-compose.unified.yml
# ============================================
# 
# This script resets:
# - Hyperledger Fabric volumes (blockchain data)
# - IPFS volumes (document storage)
# 
# WARNING: This will delete ALL:
# - Blockchain transaction history
# - IPFS stored documents
# 
# Schema/structure remains intact
# ============================================

set -e

echo "============================================"
echo "  RESET FABRIC & IPFS VOLUMES"
echo "============================================"
echo ""

# Get project name from directory or docker compose
PROJECT_NAME=$(basename $(pwd) | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g')
echo "Detected project: $PROJECT_NAME"
echo ""

# Confirm action
read -p "This will delete ALL Fabric blockchain data and IPFS files. Continue? (yes/no): " confirmation
if [ "$confirmation" != "yes" ]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo "Step 1: Stopping containers..."
docker compose -f docker-compose.unified.yml stop ipfs peer0.lto.gov.ph orderer.lto.gov.ph couchdb 2>/dev/null || true
echo "✓ Containers stopped"

echo ""
echo "Step 2: Removing Fabric volumes..."

# Try multiple volume name patterns
for volume in orderer-data peer-data couchdb-data; do
    # Try prefixed name first
    prefixed_name="${PROJECT_NAME}_${volume}"
    direct_name="$volume"
    
    removed=false
    for name in "$prefixed_name" "$direct_name"; do
        if docker volume ls -q | grep -q "^${name}$"; then
            if docker volume rm "$name" 2>/dev/null; then
                echo "  ✓ Removed $name"
                removed=true
                break
            fi
        fi
    done
    
    if [ "$removed" = false ]; then
        echo "  ⊘ Volume $volume not found (may already be removed)"
    fi
done

echo ""
echo "Step 3: Removing IPFS volume..."

# Try multiple IPFS volume name patterns
ipfs_prefixed="${PROJECT_NAME}_ipfs-data"
ipfs_direct="ipfs-data"

removed=false
for name in "$ipfs_prefixed" "$ipfs_direct"; do
    if docker volume ls -q | grep -q "^${name}$"; then
        if docker volume rm "$name" 2>/dev/null; then
            echo "  ✓ Removed $name"
            removed=true
            break
        fi
    fi
done

if [ "$removed" = false ]; then
    echo "  ⊘ IPFS volume not found (may already be removed)"
fi

echo ""
echo "Step 4: Restarting containers..."
docker compose -f docker-compose.unified.yml up -d ipfs peer0.lto.gov.ph orderer.lto.gov.ph couchdb
echo "✓ Containers restarted"

echo ""
echo "============================================"
echo "  RESET COMPLETE"
echo "============================================"
echo ""
echo "✓ Fabric volumes reset (blockchain data cleared)"
echo "✓ IPFS volume reset (document storage cleared)"
echo ""
echo "Note: Database schema and user accounts are preserved."
echo "      Run database/clear-application-data.sql to clear database data."
echo ""
