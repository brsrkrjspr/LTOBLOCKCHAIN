#!/bin/bash
# TrustChain LTO - Check IPFS Service Status

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

log_info "=== Checking IPFS Service Status ==="
echo ""

# Check if IPFS container is running
log_info "1. Checking IPFS container status..."
if docker ps --format "{{.Names}}" | grep -q "^ipfs$"; then
    log_success "✅ IPFS container is running"
    
    # Check container health
    IPFS_STATUS=$(docker inspect ipfs --format='{{.State.Status}}' 2>/dev/null || echo "unknown")
    log_info "   Container status: $IPFS_STATUS"
else
    log_error "❌ IPFS container is not running"
    log_info "   Start it with: docker compose -f docker-compose.unified.yml up -d ipfs"
    exit 1
fi

echo ""

# Check IPFS API accessibility
log_info "2. Checking IPFS API accessibility..."
IPFS_API_RESPONSE=$(docker exec ipfs ipfs version 2>/dev/null || echo "failed")
if [ "$IPFS_API_RESPONSE" != "failed" ] && echo "$IPFS_API_RESPONSE" | grep -q "ipfs version"; then
    log_success "✅ IPFS API is accessible"
    log_info "   $IPFS_API_RESPONSE"
else
    log_error "❌ IPFS API is not accessible"
    log_info "   Check IPFS logs: docker compose -f docker-compose.unified.yml logs ipfs"
fi

echo ""

# Check STORAGE_MODE environment variable
log_info "3. Checking STORAGE_MODE configuration..."
if docker exec lto-app env 2>/dev/null | grep -q "^STORAGE_MODE=ipfs"; then
    STORAGE_MODE=$(docker exec lto-app env 2>/dev/null | grep "^STORAGE_MODE=" | cut -d'=' -f2)
    log_warn "⚠️  STORAGE_MODE is set to: $STORAGE_MODE"
    log_warn "   If IPFS is down, document uploads will fail with 503"
    log_info "   To allow fallback to local storage, set STORAGE_MODE=auto"
else
    STORAGE_MODE=$(docker exec lto-app env 2>/dev/null | grep "^STORAGE_MODE=" | cut -d'=' -f2 || echo "auto")
    log_info "   STORAGE_MODE: ${STORAGE_MODE:-auto}"
fi

echo ""

# Test IPFS API from application container
log_info "4. Testing IPFS connection from application container..."
if docker exec lto-app node -e "
const ipfsService = require('./backend/services/ipfsService');
ipfsService.initialize().then(result => {
    if (result.success && ipfsService.isAvailable()) {
        console.log('✅ IPFS is available from application');
        process.exit(0);
    } else {
        console.log('❌ IPFS is not available from application');
        console.log('Error:', result.error || 'Unknown error');
        process.exit(1);
    }
}).catch(err => {
    console.log('❌ IPFS connection test failed:', err.message);
    process.exit(1);
});
" 2>/dev/null; then
    log_success "✅ IPFS is accessible from application container"
else
    log_error "❌ IPFS is NOT accessible from application container"
    log_info "   This will cause 503 errors on document upload"
fi

echo ""
log_info "=== Summary ==="
if [ "$STORAGE_MODE" = "ipfs" ]; then
    log_warn "⚠️  STORAGE_MODE=ipfs requires IPFS to be running"
    log_info "   If IPFS is down, consider:"
    log_info "   1. Fix IPFS: docker compose -f docker-compose.unified.yml restart ipfs"
    log_info "   2. Or change STORAGE_MODE to 'auto' for fallback"
else
    log_success "✅ STORAGE_MODE allows fallback to local storage"
fi

