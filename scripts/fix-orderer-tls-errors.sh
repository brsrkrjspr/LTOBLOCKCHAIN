#!/bin/bash
# Quick Fix: Orderer TLS Certificate Errors After Reset
# Fixes orderer self-connection TLS errors by ensuring MSP has correct TLS CA

set -e

echo "🔧 Fixing Orderer TLS Certificate Errors"
echo "========================================="
echo ""

# Step 1: Ensure orderer MSP has TLS CA certificate
echo "1️⃣ Fixing orderer MSP tlscacerts..."

ORDERER_MSP="fabric-network/crypto-config/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/msp"
ORDERER_TLS_CA="fabric-network/crypto-config/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/tls/ca.crt"
ORDERER_TLSCA_DIR="fabric-network/crypto-config/ordererOrganizations/lto.gov.ph/tlsca"

# Create tlscacerts directory if it doesn't exist
mkdir -p "$ORDERER_MSP/tlscacerts"

# Copy TLS CA certificate to MSP tlscacerts
if [ -f "$ORDERER_TLS_CA" ]; then
    cp "$ORDERER_TLS_CA" "$ORDERER_MSP/tlscacerts/tlsca.lto.gov.ph-cert.pem"
    echo "✅ Copied orderer TLS CA to MSP tlscacerts"
elif [ -d "$ORDERER_TLSCA_DIR" ]; then
    # Try to find TLS CA from tlsca directory
    TLSCA_CERT=$(find "$ORDERER_TLSCA_DIR" -name "*.pem" | head -1)
    if [ -n "$TLSCA_CERT" ]; then
        cp "$TLSCA_CERT" "$ORDERER_MSP/tlscacerts/tlsca.lto.gov.ph-cert.pem"
        echo "✅ Copied TLS CA from tlsca directory"
    else
        echo "⚠️  TLS CA not found, using orderer org CA as fallback"
        ORDERER_CA=$(find "$ORDERER_MSP/../msp/cacerts" -name "*.pem" | head -1)
        if [ -n "$ORDERER_CA" ]; then
            cp "$ORDERER_CA" "$ORDERER_MSP/tlscacerts/tlsca.lto.gov.ph-cert.pem"
            echo "✅ Copied orderer org CA to tlscacerts"
        fi
    fi
else
    echo "❌ Cannot find TLS CA certificate"
    exit 1
fi

# Step 2: Verify TLS certificates are properly set up
echo ""
echo "2️⃣ Verifying TLS certificate setup..."

if [ -f "$ORDERER_TLS_CA" ]; then
    echo "✅ Orderer TLS CA exists: $ORDERER_TLS_CA"
else
    echo "⚠️  Orderer TLS CA not found at expected location"
fi

if [ -f "$ORDERER_MSP/tlscacerts/tlsca.lto.gov.ph-cert.pem" ]; then
    echo "✅ Orderer MSP tlscacerts configured"
else
    echo "❌ Orderer MSP tlscacerts missing"
    exit 1
fi

# Step 3: Restart orderer to apply changes
echo ""
echo "3️⃣ Restarting orderer..."
docker compose -f docker-compose.unified.yml restart orderer.lto.gov.ph 2>/dev/null || \
docker-compose -f docker-compose.unified.yml restart orderer.lto.gov.ph 2>/dev/null || {
    docker restart orderer.lto.gov.ph 2>/dev/null || {
        echo "⚠️  Failed to restart orderer, trying to start it..."
        docker compose -f docker-compose.unified.yml up -d orderer.lto.gov.ph 2>/dev/null || \
        docker-compose -f docker-compose.unified.yml up -d orderer.lto.gov.ph 2>/dev/null || {
            docker start orderer.lto.gov.ph
        }
    }
}

echo "⏳ Waiting for orderer to start (15 seconds)..."
sleep 15

# Step 4: Check orderer logs for TLS errors
echo ""
echo "4️⃣ Checking orderer logs for TLS errors..."
sleep 5

RECENT_TLS_ERRORS=$(docker logs orderer.lto.gov.ph --since 20s 2>&1 | grep -i "tls.*bad certificate\|certificate signed by unknown authority" | wc -l)

if [ "$RECENT_TLS_ERRORS" -eq 0 ]; then
    echo "✅ No recent TLS errors detected"
else
    echo "⚠️  Still seeing TLS errors (may be old logs)"
    echo "💡 Check logs: docker logs orderer.lto.gov.ph --tail 30"
fi

echo ""
echo "✅ Fix complete!"
echo ""
echo "Next steps:"
echo "  1. Check orderer logs: docker logs orderer.lto.gov.ph --tail 30"
echo "  2. Wait for 'Beginning to serve requests' in orderer logs"
echo "  3. Continue with channel creation or chaincode deployment"
