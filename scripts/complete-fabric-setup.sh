#!/bin/bash
# Complete Fabric Setup Script for Codespace
# Handles chaincode deployment with proper error handling

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to print status
print_status() {
    echo -e "${CYAN}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

echo "📦 Completing Fabric Chaincode Deployment"
echo "=========================================="
echo ""

# Check if CLI container is running
print_status "Checking CLI container..."
if ! docker ps --format "{{.Names}}" | grep -q "^cli$"; then
    print_error "CLI container is not running!"
    print_error "Please start the Fabric network first: bash scripts/start-codespace.sh"
    exit 1
fi

# Check if peer is joined to channel
print_status "Checking if peer is joined to channel..."
if ! docker exec cli peer channel list 2>&1 | grep -q "ltochannel"; then
    print_error "Peer is not joined to channel 'ltochannel'!"
    print_error "Please join the peer to the channel first: bash scripts/start-codespace.sh"
    exit 1
fi
print_success "Peer is joined to channel"

# Check if chaincode is already installed
print_status "Checking if chaincode is already installed..."
if docker exec cli peer lifecycle chaincode queryinstalled 2>&1 | grep -q "vehicle-registration"; then
    print_success "Chaincode already installed"
    PACKAGE_ID=$(docker exec cli peer lifecycle chaincode queryinstalled 2>&1 | \
        grep "vehicle-registration" | \
        sed -n 's/.*vehicle-registration[^:]*:\([a-f0-9]*\).*/\1/p' | head -1)
    if [ -n "$PACKAGE_ID" ]; then
        print_status "Package ID: $PACKAGE_ID"
    fi
    
    # Check if chaincode is committed
    if docker exec cli peer lifecycle chaincode querycommitted --channelID ltochannel --name vehicle-registration > /dev/null 2>&1; then
        print_success "Chaincode is already committed to channel"
        echo ""
        echo "Chaincode deployment is complete!"
        exit 0
    else
        print_warning "Chaincode is installed but not committed. Continuing with approval and commit..."
    fi
fi

print_status "Step 1/6: Packaging chaincode..."

# Check if chaincode directory exists in CLI container
if ! docker exec cli test -d /opt/gopath/src/github.com/chaincode/vehicle-registration-production; then
    print_error "Chaincode directory not found in CLI container!"
    print_error "Expected: /opt/gopath/src/github.com/chaincode/vehicle-registration-production"
    exit 1
fi

docker exec cli peer lifecycle chaincode package vehicle-registration.tar.gz \
    --path /opt/gopath/src/github.com/chaincode/vehicle-registration-production \
    --lang node \
    --label vehicle-registration_1.0

if [ $? -ne 0 ]; then
    print_error "Failed to package chaincode"
    print_error "Check if chaincode directory has proper structure and node_modules"
    exit 1
fi

print_success "Chaincode packaged successfully"

print_status "Step 2/6: Installing chaincode on peer..."
INSTALL_OUTPUT=$(docker exec cli peer lifecycle chaincode install vehicle-registration.tar.gz 2>&1)
INSTALL_EXIT_CODE=$?

if [ $INSTALL_EXIT_CODE -ne 0 ]; then
    print_error "Failed to install chaincode"
    echo "$INSTALL_OUTPUT"
    print_error "Check peer logs: docker logs peer0.lto.gov.ph"
    exit 1
fi

# Wait a bit for installation to complete
print_status "Waiting for installation to complete..."
sleep 8

print_status "Step 3/6: Getting package ID..."
PACKAGE_ID=$(docker exec cli peer lifecycle chaincode queryinstalled 2>&1 | \
    grep "vehicle-registration" | \
    sed -n 's/.*vehicle-registration[^:]*:\([a-f0-9]*\).*/\1/p' | head -1)

if [ -z "$PACKAGE_ID" ]; then
    print_error "Package ID not found. Installation may have failed."
    print_error "Installed chaincodes:"
    docker exec cli peer lifecycle chaincode queryinstalled
    print_error "Check peer logs: docker logs peer0.lto.gov.ph | tail -50"
    exit 1
fi

print_success "Package ID: $PACKAGE_ID"

print_status "Step 4/6: Approving chaincode for organization..."
APPROVE_OUTPUT=$(docker exec cli peer lifecycle chaincode approveformyorg \
    -o orderer1.lto.gov.ph:7050 \
    --channelID ltochannel \
    --name vehicle-registration \
    --version 1.0 \
    --package-id "$PACKAGE_ID" \
    --sequence 1 \
    --tls \
    --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/lto.gov.ph/orderers/orderer1.lto.gov.ph/msp/tlscacerts/tlsca.lto.gov.ph-cert.pem 2>&1)

if [ $? -ne 0 ]; then
    print_error "Failed to approve chaincode"
    echo "$APPROVE_OUTPUT"
    exit 1
fi

print_success "Chaincode approved successfully"

print_status "Step 5/6: Committing chaincode to channel..."
COMMIT_OUTPUT=$(docker exec cli peer lifecycle chaincode commit \
    -o orderer1.lto.gov.ph:7050 \
    --channelID ltochannel \
    --name vehicle-registration \
    --version 1.0 \
    --sequence 1 \
    --tls \
    --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/lto.gov.ph/orderers/orderer1.lto.gov.ph/msp/tlscacerts/tlsca.lto.gov.ph-cert.pem 2>&1)

if [ $? -ne 0 ]; then
    print_error "Failed to commit chaincode"
    echo "$COMMIT_OUTPUT"
    exit 1
fi

print_success "Chaincode committed to channel successfully"

print_status "Step 6/6: Testing chaincode..."
TEST_OUTPUT=$(docker exec cli peer chaincode query \
    -C ltochannel \
    -n vehicle-registration \
    -c '{"function":"GetSystemStats","Args":[]}' 2>&1)

if [ $? -eq 0 ]; then
    print_success "Chaincode test passed!"
    echo "Response: $TEST_OUTPUT"
else
    print_warning "Chaincode test failed (may need initialization)"
    echo "Output: $TEST_OUTPUT"
    print_warning "This is normal if the chaincode hasn't been initialized yet"
fi

echo ""
echo "=========================================="
print_success "Chaincode deployment complete!"
echo ""
echo "Summary:"
echo "  ✓ Chaincode packaged"
echo "  ✓ Chaincode installed"
echo "  ✓ Chaincode approved"
echo "  ✓ Chaincode committed to channel"
echo ""
echo "Chaincode is now ready to use!"
echo "You can interact with it through the application or CLI."

