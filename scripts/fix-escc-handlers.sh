#!/bin/bash

# Fix: Add handlers section to core.yaml for escc/vscc
# Fabric 2.5 requires handlers section even in dev mode

set -e

echo "=========================================="
echo "Adding handlers section to core.yaml"
echo "=========================================="

cd ~/LTOBLOCKCHAIN || { echo "Error: Cannot find LTOBLOCKCHAIN directory"; exit 1; }

if [ ! -f "fabric-network/config/core.yaml" ]; then
    echo "✗ ERROR: core.yaml not found!"
    echo "Run final-fix-create-minimal-core-yaml.sh first"
    exit 1
fi

echo ""
echo "Step 1: Checking if handlers section exists..."
if grep -q "^handlers:" fabric-network/config/core.yaml; then
    echo "✓ handlers section already exists"
    echo "Current handlers:"
    grep -A 10 "^handlers:" fabric-network/config/core.yaml
else
    echo "⚠ handlers section not found - adding it..."
    
    # Add handlers section before metrics section (or at end if no metrics)
    if grep -q "^metrics:" fabric-network/config/core.yaml; then
        # Insert before metrics
        sed -i '/^metrics:/i\
handlers:\
  endorsers:\
    escc:\
      name: DefaultEndorsement\
  validators:\
    vscc:\
      name: DefaultValidation\
' fabric-network/config/core.yaml
    else
        # Append at end
        cat >> fabric-network/config/core.yaml << 'EOF'
handlers:
  endorsers:
    escc:
      name: DefaultEndorsement
  validators:
    vscc:
      name: DefaultValidation
EOF
    fi
    
    echo "✓ handlers section added"
fi

echo ""
echo "Step 2: Verifying core.yaml structure..."
if grep -q "DefaultEndorsement" fabric-network/config/core.yaml && grep -q "DefaultValidation" fabric-network/config/core.yaml; then
    echo "✓ handlers section verified"
else
    echo "✗ ERROR: handlers section not properly added"
    exit 1
fi

echo ""
echo "Step 3: Restarting peer container..."
docker-compose -f docker-compose.unified.yml restart peer0.lto.gov.ph

echo ""
echo "Step 4: Waiting for peer to restart (20 seconds)..."
sleep 20

echo ""
echo "Step 5: Checking peer logs for errors..."
if docker logs peer0.lto.gov.ph 2>&1 | grep -qi "escc.*not found\|plugin.*not found"; then
    echo "⚠ WARNING: Still seeing escc plugin errors"
    docker logs peer0.lto.gov.ph 2>&1 | grep -i "escc\|plugin" | tail -5
else
    echo "✓ No escc plugin errors found"
fi

echo ""
echo "=========================================="
echo "Fix completed!"
echo "=========================================="
echo ""
echo "Now test the query:"
echo "  docker exec -it cli bash"
echo "  export CORE_PEER_LOCALMSPID=LTOMSP"
echo "  export CORE_PEER_TLS_ENABLED=true"
echo "  export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/peers/peer0.lto.gov.ph/tls/ca.crt"
echo "  export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp"
echo "  export CORE_PEER_ADDRESS=peer0.lto.gov.ph:7051"
echo "  peer chaincode query -C ltochannel -n vehicle-registration -c '{\"function\":\"GetAllVehicles\",\"Args\":[]}'"
echo ""
