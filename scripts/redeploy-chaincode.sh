#!/bin/bash
# Redeploy chaincode after fixing the export format
# This script handles upgrading an already committed chaincode

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

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

echo "🔄 Redeploying Chaincode with Fixed Export"
echo "==========================================="
echo ""

# Check if CLI container is running
print_status "Checking CLI container..."
if ! docker ps --format "{{.Names}}" | grep -q "^cli$"; then
    print_error "CLI container is not running!"
    exit 1
fi

# Check current sequence number
print_status "Checking current chaincode commit status..."
CURRENT_SEQUENCE=0
if docker exec cli peer lifecycle chaincode querycommitted --channelID ltochannel --name vehicle-registration > /dev/null 2>&1; then
    COMMITTED_INFO=$(docker exec cli peer lifecycle chaincode querycommitted --channelID ltochannel --name vehicle-registration 2>&1)
    CURRENT_SEQUENCE=$(echo "$COMMITTED_INFO" | grep -oP 'Sequence: \K\d+' || echo "0")
    print_status "Current committed sequence: $CURRENT_SEQUENCE"
else
    print_status "Chaincode not yet committed"
fi

# Calculate next sequence
NEXT_SEQUENCE=$((CURRENT_SEQUENCE + 1))
print_status "Next sequence will be: $NEXT_SEQUENCE"

# Step 1: Package the updated chaincode
print_status "Step 1/5: Packaging chaincode with new label..."
LABEL="vehicle-registration_1.0.${NEXT_SEQUENCE}"
docker exec cli peer lifecycle chaincode package vehicle-registration-v${NEXT_SEQUENCE}.tar.gz \
    --path /opt/gopath/src/github.com/chaincode/vehicle-registration-production \
    --lang node \
    --label "$LABEL"

if [ $? -ne 0 ]; then
    print_error "Failed to package chaincode"
    exit 1
fi
print_success "Chaincode packaged with label: $LABEL"

# Step 2: Install the new package
print_status "Step 2/5: Installing chaincode on peer..."
docker exec cli peer lifecycle chaincode install vehicle-registration-v${NEXT_SEQUENCE}.tar.gz 2>&1

if [ $? -ne 0 ]; then
    print_error "Failed to install chaincode"
    exit 1
fi

# Wait for installation
print_status "Waiting for installation to complete..."
sleep 10

# Step 3: Get the new package ID
print_status "Step 3/5: Getting new package ID..."
PACKAGE_ID=$(docker exec cli peer lifecycle chaincode queryinstalled 2>&1 | \
    grep "$LABEL" | \
    sed -n 's/.*Package ID: \([^,]*\),.*/\1/p' | head -1)

if [ -z "$PACKAGE_ID" ]; then
    print_error "Package ID not found. Let me show installed chaincodes:"
    docker exec cli peer lifecycle chaincode queryinstalled
    exit 1
fi

print_success "Package ID: $PACKAGE_ID"

# Step 4: Approve the new definition
print_status "Step 4/5: Approving chaincode for organization..."
docker exec cli peer lifecycle chaincode approveformyorg \
    -o orderer.lto.gov.ph:7050 \
    --channelID ltochannel \
    --name vehicle-registration \
    --version 1.0 \
    --package-id "$PACKAGE_ID" \
    --sequence $NEXT_SEQUENCE \
    --tls \
    --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/msp/tlscacerts/tlsca.lto.gov.ph-cert.pem

if [ $? -ne 0 ]; then
    print_error "Failed to approve chaincode"
    exit 1
fi
print_success "Chaincode approved"

# Step 5: Commit the new definition
print_status "Step 5/5: Committing chaincode to channel..."
docker exec cli peer lifecycle chaincode commit \
    -o orderer.lto.gov.ph:7050 \
    --channelID ltochannel \
    --name vehicle-registration \
    --version 1.0 \
    --sequence $NEXT_SEQUENCE \
    --tls \
    --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/msp/tlscacerts/tlsca.lto.gov.ph-cert.pem

if [ $? -ne 0 ]; then
    print_error "Failed to commit chaincode"
    exit 1
fi
print_success "Chaincode committed to channel"

# Verify deployment
print_status "Verifying chaincode deployment..."
sleep 3
docker exec cli peer lifecycle chaincode querycommitted --channelID ltochannel --name vehicle-registration

# Test the chaincode
print_status "Testing chaincode..."
TEST_OUTPUT=$(docker exec cli peer chaincode query \
    -C ltochannel \
    -n vehicle-registration \
    -c '{"function":"GetSystemStats","Args":[]}' 2>&1)

if [ $? -eq 0 ]; then
    print_success "Chaincode test passed!"
    echo "Response: $TEST_OUTPUT"
else
    print_warning "Chaincode query returned: $TEST_OUTPUT"
    print_warning "This might be normal if there's no data yet"
fi

echo ""
echo "==========================================="
print_success "Chaincode redeployment complete!"
echo ""
echo "Summary:"
echo "  ✓ Chaincode re-packaged (label: $LABEL)"
echo "  ✓ Chaincode re-installed (Package ID: ${PACKAGE_ID:0:30}...)"
echo "  ✓ Chaincode approved for organization"
echo "  ✓ Chaincode committed (sequence: $NEXT_SEQUENCE)"
echo ""
echo "The chaincode is now ready to use!"
echo "Restart your application to connect to the updated chaincode."

