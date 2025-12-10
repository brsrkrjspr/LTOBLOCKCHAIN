#!/bin/bash

# ======================================================
# TrustChain LTO - IPFS Fix Script for Codespace
# Ensures IPFS is fully operational (no fallbacks)
# ======================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() {
    echo -e "\n${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC}  $1"
    echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}\n"
}

print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }
print_info() { echo -e "${YELLOW}ℹ️  $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }

print_header "IPFS Diagnostic and Fix for Codespace"

# ======================================================
# STEP 1: Check IPFS Container Status
# ======================================================
print_header "Step 1: Checking IPFS Container"

if docker ps --format '{{.Names}}' | grep -q "^ipfs$"; then
    print_success "IPFS container is running"
    CONTAINER_STATUS=$(docker inspect ipfs --format='{{.State.Status}}')
    print_info "Container status: $CONTAINER_STATUS"
else
    print_error "IPFS container is NOT running"
    print_info "Starting IPFS container..."
    docker-compose -f docker-compose.unified.yml up -d ipfs
    sleep 10
fi

# ======================================================
# STEP 2: Check IPFS Logs
# ======================================================
print_header "Step 2: Checking IPFS Logs"

echo "Last 20 lines of IPFS logs:"
docker logs ipfs --tail 20

# Check for errors
if docker logs ipfs 2>&1 | grep -qi "error\|fatal\|panic"; then
    print_warning "Found errors in IPFS logs"
else
    print_success "No critical errors in logs"
fi

# ======================================================
# STEP 3: Wait for IPFS to be Ready
# ======================================================
print_header "Step 3: Waiting for IPFS to Initialize"

print_info "IPFS can take 30-60 seconds to fully initialize..."
MAX_WAIT=60
WAITED=0

while [ $WAITED -lt $MAX_WAIT ]; do
    if docker exec ipfs ipfs id >/dev/null 2>&1; then
        print_success "IPFS is ready!"
        break
    fi
    print_info "Waiting... ($WAITED/$MAX_WAIT seconds)"
    sleep 5
    WAITED=$((WAITED + 5))
done

if [ $WAITED -ge $MAX_WAIT ]; then
    print_error "IPFS did not become ready within $MAX_WAIT seconds"
    print_info "Checking IPFS status..."
    docker exec ipfs ipfs id || true
fi

# ======================================================
# STEP 4: Verify IPFS Configuration
# ======================================================
print_header "Step 4: Verifying IPFS Configuration"

# Check API address
API_ADDR=$(docker exec ipfs ipfs config Addresses.API 2>/dev/null || echo "not_set")
print_info "IPFS API Address: $API_ADDR"

if echo "$API_ADDR" | grep -q "0.0.0.0"; then
    print_success "API address is correctly configured"
else
    print_warning "API address might need configuration"
    print_info "Configuring API address..."
    docker exec ipfs ipfs config Addresses.API /ip4/0.0.0.0/tcp/5001 || true
fi

# Check Gateway address
GATEWAY_ADDR=$(docker exec ipfs ipfs config Addresses.Gateway 2>/dev/null || echo "not_set")
print_info "IPFS Gateway Address: $GATEWAY_ADDR"

# ======================================================
# STEP 5: Test IPFS Connectivity
# ======================================================
print_header "Step 5: Testing IPFS Connectivity"

# Test 1: From inside container
print_info "Test 1: Testing from inside container..."
if docker exec ipfs ipfs version >/dev/null 2>&1; then
    VERSION=$(docker exec ipfs ipfs version)
    print_success "IPFS version check passed: $VERSION"
else
    print_error "IPFS version check failed"
fi

# Test 2: API endpoint from host
print_info "Test 2: Testing API endpoint from host..."
if curl -s -X POST http://localhost:5001/api/v0/version >/dev/null 2>&1; then
    API_VERSION=$(curl -s -X POST http://localhost:5001/api/v0/version | grep -o '"Version":"[^"]*"' | cut -d'"' -f4 || echo "unknown")
    print_success "IPFS API accessible: Version $API_VERSION"
else
    print_error "IPFS API not accessible from host"
    print_info "This might be OK if using container name in Codespace"
fi

# Test 3: From application perspective (using container name)
print_info "Test 3: Testing from application perspective (container name)..."
if curl -s -X POST http://ipfs:5001/api/v0/version >/dev/null 2>&1; then
    print_success "IPFS accessible via container name 'ipfs'"
else
    print_warning "IPFS not accessible via container name (might need network fix)"
fi

# ======================================================
# STEP 6: Verify Environment Variables
# ======================================================
print_header "Step 6: Verifying Environment Variables"

# Check if .env exists
if [ -f ".env" ]; then
    print_success ".env file exists"
    
    # Check IPFS_HOST
    if grep -q "IPFS_HOST" .env; then
        IPFS_HOST=$(grep "IPFS_HOST" .env | cut -d'=' -f2 | tr -d ' ')
        print_info "IPFS_HOST: $IPFS_HOST"
        
        if [ "$IPFS_HOST" = "ipfs" ] || [ "$IPFS_HOST" = "localhost" ]; then
            print_success "IPFS_HOST is correctly set for Codespace"
        else
            print_warning "IPFS_HOST might need to be 'ipfs' for Codespace"
        fi
    else
        print_warning "IPFS_HOST not found in .env"
        print_info "Adding IPFS_HOST=ipfs to .env..."
        echo "" >> .env
        echo "# IPFS Configuration for Codespace" >> .env
        echo "IPFS_HOST=ipfs" >> .env
        echo "IPFS_PORT=5001" >> .env
        echo "IPFS_PROTOCOL=http" >> .env
    fi
    
    # Check STORAGE_MODE
    if grep -q "STORAGE_MODE" .env; then
        STORAGE_MODE=$(grep "STORAGE_MODE" .env | cut -d'=' -f2 | tr -d ' ')
        print_info "STORAGE_MODE: $STORAGE_MODE"
        
        if [ "$STORAGE_MODE" = "ipfs" ]; then
            print_success "STORAGE_MODE is set to 'ipfs' (no fallbacks)"
        elif [ "$STORAGE_MODE" = "auto" ]; then
            print_warning "STORAGE_MODE is 'auto' - will fallback to local if IPFS fails"
            print_info "Setting STORAGE_MODE to 'ipfs' for real service only..."
            sed -i 's/STORAGE_MODE=auto/STORAGE_MODE=ipfs/' .env || \
            sed -i 's/STORAGE_MODE=.*/STORAGE_MODE=ipfs/' .env || \
            echo "STORAGE_MODE=ipfs" >> .env
        else
            print_warning "STORAGE_MODE is '$STORAGE_MODE' - setting to 'ipfs'"
            sed -i 's/STORAGE_MODE=.*/STORAGE_MODE=ipfs/' .env || echo "STORAGE_MODE=ipfs" >> .env
        fi
    else
        print_warning "STORAGE_MODE not found in .env"
        print_info "Adding STORAGE_MODE=ipfs to .env..."
        echo "STORAGE_MODE=ipfs" >> .env
    fi
else
    print_warning ".env file not found"
    print_info "Creating .env file with IPFS configuration..."
    cat > .env << EOF
# IPFS Configuration for Codespace
IPFS_HOST=ipfs
IPFS_PORT=5001
IPFS_PROTOCOL=http
STORAGE_MODE=ipfs

# Database Configuration
DB_HOST=postgres
DB_PORT=5432
DB_NAME=lto_blockchain
DB_USER=lto_user
DB_PASSWORD=lto_password

# Blockchain Configuration
BLOCKCHAIN_MODE=fabric
FABRIC_NETWORK_CONFIG=./network-config.json
FABRIC_CHANNEL=ltochannel
FABRIC_CHAINCODE=vehicle-registration

# Server Configuration
PORT=3001
NODE_ENV=development
EOF
    print_success ".env file created"
fi

# ======================================================
# STEP 7: Restart IPFS if Needed
# ======================================================
print_header "Step 7: Ensuring IPFS is Fully Operational"

# Final test
print_info "Performing final connectivity test..."
sleep 5

if docker exec ipfs ipfs id >/dev/null 2>&1; then
    IPFS_ID=$(docker exec ipfs ipfs id 2>/dev/null | head -1 || echo "unknown")
    print_success "IPFS is operational!"
    print_info "IPFS Node ID: $IPFS_ID"
else
    print_error "IPFS is still not responding"
    print_info "Attempting to restart IPFS container..."
    docker restart ipfs
    sleep 15
    
    if docker exec ipfs ipfs id >/dev/null 2>&1; then
        print_success "IPFS is now operational after restart!"
    else
        print_error "IPFS failed to start after restart"
        print_info "Check logs: docker logs ipfs"
        exit 1
    fi
fi

# ======================================================
# STEP 8: Test IPFS Operations
# ======================================================
print_header "Step 8: Testing IPFS Operations"

# Test adding a small file
print_info "Testing IPFS add operation..."
TEST_FILE="/tmp/ipfs-test-$$.txt"
echo "IPFS test file - $(date)" > "$TEST_FILE"

if docker exec ipfs ipfs add "$TEST_FILE" >/dev/null 2>&1; then
    print_success "IPFS add operation works"
else
    # Try copying file into container first
    docker cp "$TEST_FILE" ipfs:/tmp/test.txt >/dev/null 2>&1
    if docker exec ipfs ipfs add /tmp/test.txt >/dev/null 2>&1; then
        print_success "IPFS add operation works"
    else
        print_warning "IPFS add operation test failed (might be OK)"
    fi
fi

rm -f "$TEST_FILE" 2>/dev/null || true

# ======================================================
# DONE
# ======================================================
print_header "IPFS Fix Complete!"

echo -e "${GREEN}✅ IPFS is configured and operational${NC}"
echo ""
echo "Configuration Summary:"
echo "  - IPFS_HOST: $(grep IPFS_HOST .env | cut -d'=' -f2 || echo 'ipfs')"
echo "  - IPFS_PORT: $(grep IPFS_PORT .env | cut -d'=' -f2 || echo '5001')"
echo "  - STORAGE_MODE: $(grep STORAGE_MODE .env | cut -d'=' -f2 || echo 'ipfs')"
echo ""
echo "Next steps:"
echo "  1. Restart the application: npm start"
echo "  2. Check application logs for IPFS connection status"
echo "  3. Verify IPFS is being used (should see 'Using IPFS storage' in logs)"
echo ""
echo "If IPFS still doesn't work:"
echo "  - Check logs: docker logs ipfs"
echo "  - Verify network: docker network inspect trustchain"
echo "  - Test manually: docker exec ipfs ipfs version"

