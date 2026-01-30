#!/bin/bash

# Quick Fix: Install Chaincode Package
# The chaincode definition exists but the package is not installed
# This script installs the chaincode package

set +e

echo "=========================================="
echo "Quick Fix: Install Chaincode Package"
echo "=========================================="
echo ""
echo "This script will install the vehicle-registration chaincode package"
echo "on the peer so it can actually run."
echo ""

cd ~/LTOBLOCKCHAIN || { echo "Error: Cannot find LTOBLOCKCHAIN directory"; exit 1; }

# Helper function to run docker exec with timeout
run_docker_exec() {
    local cmd="$1"
    local timeout="${2:-30}"
    timeout $timeout docker exec cli bash -c "$cmd" 2>&1
}

# Check if CLI container is running
if ! docker ps --format '{{.Names}}' | grep -q "^cli$"; then
    echo "❌ CLI container is not running!"
    echo "  Starting CLI container..."
    docker-compose -f docker-compose.unified.yml up -d cli
    sleep 5
fi

CHAINCODE_DIR="/opt/gopath/src/github.com/chaincode/vehicle-registration-production"

# Step 1: Ensure chaincode exists in CLI container
echo "Step 1: Checking chaincode directory in CLI container..."
if ! docker exec cli test -d "$CHAINCODE_DIR" 2>/dev/null; then
    echo "⚠ Chaincode directory not found in CLI container"
    if [ -d "chaincode/vehicle-registration-production" ]; then
        echo "  Copying chaincode to CLI container..."
        docker cp chaincode/vehicle-registration-production cli:"$CHAINCODE_DIR"
        echo "✓ Chaincode copied"
    else
        echo "❌ Chaincode directory not found locally: chaincode/vehicle-registration-production"
        exit 1
    fi
else
    echo "✓ Chaincode directory exists in CLI container"
fi

# Step 2: Check if already installed
echo ""
echo "Step 2: Checking if chaincode is already installed..."
INSTALLED_OUTPUT=$(run_docker_exec "
export CORE_PEER_LOCALMSPID=LTOMSP
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp
export CORE_PEER_ADDRESS=peer0.lto.gov.ph:7051
peer lifecycle chaincode queryinstalled 2>&1
" 30)

if echo "$INSTALLED_OUTPUT" | grep -q "vehicle-registration"; then
    echo "✓ Chaincode package is already installed"
    PACKAGE_ID=$(echo "$INSTALLED_OUTPUT" | grep "vehicle-registration" | \
        sed -n 's/.*Package ID: \([^,]*\),.*/\1/p' | head -1)
    if [ -n "$PACKAGE_ID" ]; then
        echo "  Package ID: ${PACKAGE_ID:0:50}..."
        echo ""
        echo "✅ Chaincode is already installed!"
        echo ""
        echo "If you're still seeing 'chaincode is not installed' errors,"
        echo "the issue may be that the chaincode definition doesn't match the installed package."
        echo "Try running: bash scripts/complete-fix-restore-working-state.sh"
        exit 0
    fi
fi

# Step 3: Package chaincode
echo ""
echo "Step 3: Packaging chaincode..."
PACKAGE_OUTPUT=$(run_docker_exec "
export CORE_PEER_LOCALMSPID=LTOMSP
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp
export CORE_PEER_ADDRESS=peer0.lto.gov.ph:7051
cd /opt/gopath/src/github.com/hyperledger/fabric/peer
peer lifecycle chaincode package vehicle-registration.tar.gz \
    --path $CHAINCODE_DIR \
    --lang node \
    --label vehicle-registration_1.0 2>&1
" 60)

if echo "$PACKAGE_OUTPUT" | grep -qi "error\|failed"; then
    echo "❌ Failed to package chaincode:"
    echo "$PACKAGE_OUTPUT" | tail -10
    exit 1
fi
echo "✓ Chaincode packaged"

# Step 4: Install chaincode
echo ""
echo "Step 4: Installing chaincode package on peer..."
INSTALL_OUTPUT=$(run_docker_exec "
export CORE_PEER_LOCALMSPID=LTOMSP
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp
export CORE_PEER_ADDRESS=peer0.lto.gov.ph:7051
cd /opt/gopath/src/github.com/hyperledger/fabric/peer
peer lifecycle chaincode install vehicle-registration.tar.gz 2>&1
" 60)

if echo "$INSTALL_OUTPUT" | grep -qi "error\|failed"; then
    if echo "$INSTALL_OUTPUT" | grep -qi "already successfully installed"; then
        echo "✓ Chaincode already installed (from previous attempt)"
    else
        echo "❌ Failed to install chaincode:"
        echo "$INSTALL_OUTPUT" | tail -10
        if echo "$INSTALL_OUTPUT" | grep -q "FROM requires either one or three arguments"; then
            echo ""
            echo "→ Use CCAAS install instead (bypasses peer Docker build):"
            echo "  bash scripts/install-chaincode-ccaas.sh"
        fi
        exit 1
    fi
else
    echo "✓ Chaincode installed successfully"
fi

# Step 5: Wait and verify
echo ""
echo "Step 5: Waiting for installation to complete (10 seconds)..."
sleep 10

echo ""
echo "Step 6: Verifying installation..."
INSTALLED_OUTPUT=$(run_docker_exec "
export CORE_PEER_LOCALMSPID=LTOMSP
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp
export CORE_PEER_ADDRESS=peer0.lto.gov.ph:7051
peer lifecycle chaincode queryinstalled 2>&1
" 30)

if echo "$INSTALLED_OUTPUT" | grep -q "vehicle-registration"; then
    PACKAGE_ID=$(echo "$INSTALLED_OUTPUT" | grep "vehicle-registration" | \
        sed -n 's/.*Package ID: \([^,]*\),.*/\1/p' | head -1)
    echo "✓ Chaincode is installed!"
    echo "  Package ID: ${PACKAGE_ID:0:50}..."
    echo ""
    echo "=========================================="
    echo "✅ INSTALLATION SUCCESSFUL!"
    echo "=========================================="
    echo ""
    echo "The chaincode package is now installed on the peer."
    echo "The chaincode should now be able to run."
    echo ""
    echo "If you still see errors, you may need to:"
    echo "1. Restart the peer: docker-compose -f docker-compose.unified.yml restart peer0.lto.gov.ph"
    echo "2. Wait for peer to be ready (check logs for 'Deployed system chaincodes')"
    echo "3. Restart your application: docker-compose -f docker-compose.unified.yml restart lto-app"
else
    echo "⚠ WARNING: Could not verify installation"
    echo "  Installed chaincodes:"
    echo "$INSTALLED_OUTPUT" | head -10
    echo ""
    echo "  Installation may have succeeded, but verification failed."
    echo "  Try restarting the peer and checking logs."
fi
