#!/bin/bash

# Comprehensive Handler Diagnostic: Check why handlers aren't working
# Based on analysis that config is correct but handlers aren't being used

set -e

echo "=========================================="
echo "Comprehensive Handler Diagnostic"
echo "=========================================="

cd ~/LTOBLOCKCHAIN || { echo "Error: Cannot find LTOBLOCKCHAIN directory"; exit 1; }

echo ""
echo "Step 1: Check Fabric version..."
docker exec peer0.lto.gov.ph peer version 2>&1 | head -10

echo ""
echo "Step 2: Check if handlers section is in config dump..."
docker logs peer0.lto.gov.ph 2>&1 | grep -A 5 "handlers:" | head -10 || echo "No handlers in config dump"

echo ""
echo "Step 3: Check for handler initialization messages..."
docker logs peer0.lto.gov.ph 2>&1 | grep -iE "handler.*init|handler.*load|handler.*register|DefaultEndorsement.*init|plugin.*register" | head -20 || echo "No handler initialization messages found"

echo ""
echo "Step 4: Check peer startup sequence for handler-related messages..."
docker logs peer0.lto.gov.ph 2>&1 | head -300 | grep -iE "handler|endorsement|plugin|chaincode.*init|system.*chaincode" | head -30

echo ""
echo "Step 5: Check for any errors related to handlers..."
docker logs peer0.lto.gov.ph 2>&1 | grep -iE "error.*handler|error.*endorsement|error.*plugin|fail.*handler|fail.*endorsement" | head -20 || echo "No handler-related errors found"

echo ""
echo "Step 6: Verify exact handlers structure in container..."
docker exec peer0.lto.gov.ph cat /var/hyperledger/fabric/config/core.yaml | grep -A 6 "^handlers:"

echo ""
echo "Step 7: Check if there's a handler library path issue..."
docker exec peer0.lto.gov.ph ls -la /opt/gopath/src/github.com/hyperledger/fabric/core/handlers/ 2>&1 | head -10 || echo "Handler library path not accessible"

echo ""
echo "Step 8: Check chaincode system chaincode deployment..."
docker logs peer0.lto.gov.ph 2>&1 | grep -iE "Deployed system chaincode|system.*chaincode.*deploy|escc|vscc" | head -20

echo ""
echo "Step 9: Check if mode: dev is being recognized..."
docker logs peer0.lto.gov.ph 2>&1 | grep -iE "mode.*dev|chaincode.*mode|dev.*mode" | head -10 || echo "No mode: dev messages found"

echo ""
echo "=========================================="
echo "Diagnostic Complete"
echo "=========================================="
echo ""
echo "Next Steps:"
echo "1. Review handler initialization messages (Step 3)"
echo "2. Check if system chaincodes are deployed (Step 8)"
echo "3. Verify mode: dev is recognized (Step 9)"
echo "4. If no handler init messages, handlers may not be registering"
